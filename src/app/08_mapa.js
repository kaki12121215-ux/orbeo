/* ============================ MAPA Y LUGARES ============================
   Con clave de Google Maps: mapa de Google con su buscador de sitios y sus fotos.
   Sin clave: mapa propio con teselas de CARTO (OpenStreetMap), buscador Photon y fotos de Wikipedia. */
function claveMaps() { return (S.pref.mapsKey || ((dato('espacio', 'espacio') || {}).mapsKey) || '').trim(); }

const GM = {
  prom: null,
  cargar() {
    const k = claveMaps();
    if (!k) return Promise.reject(new Error('sin clave'));
    if (window.google && google.maps && google.maps.Map) return Promise.resolve(google.maps);
    if (this.prom && this.k === k) return this.prom;
    this.k = k;
    this.prom = new Promise((ok, ko) => {
      window.__orbeoMaps = () => ok(google.maps);
      window.gm_authFailure = () => { anotar('maps', 'La clave de Google Maps no es válida o no tiene permiso para esta dirección.'); aviso('Google Maps no acepta la clave. Revísala en Ajustes.'); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(k)}&v=weekly&loading=async&libraries=places&language=es&callback=__orbeoMaps`;
      s.async = true; s.onerror = () => { this.prom = null; ko(new Error('No se ha podido cargar Google Maps')); };
      document.head.appendChild(s);
      setTimeout(() => ko(new Error('Google Maps tarda demasiado')), 15000);
    });
    return this.prom;
  }
};

const Lugar = {
  token: null,
  async buscar(q, o) {
    o = o || {}; q = String(q || '').trim();
    if (q.length < 2) return [];
    const loc = o.ciudades ? buscarCiudades(q).map(c => ({ n: c.n, sub: nombrePais(c.pais), lat: c.lat, lng: c.lng, tz: c.tz, pais: c.pais })) : [];
    let red = [];
    try {
      if (claveMaps()) {
        await GM.cargar();
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places');
        this.token = this.token || new AutocompleteSessionToken();
        const pet = { input: q, sessionToken: this.token, language: 'es' };
        if (o.cerca && o.cerca.lat != null) pet.locationBias = { center: { lat: o.cerca.lat, lng: o.cerca.lng }, radius: 50000 };
        if (o.ciudades) pet.includedPrimaryTypes = ['(regions)'];
        const r = await AutocompleteSuggestion.fetchAutocompleteSuggestions(pet);
        red = r.suggestions.filter(s => s.placePrediction).slice(0, 6).map(s => ({ n: s.placePrediction.mainText ? s.placePrediction.mainText.text : s.placePrediction.text.text, sub: s.placePrediction.secondaryText ? s.placePrediction.secondaryText.text : '', pid: s.placePrediction.placeId }));
      } else {
        const bias = o.cerca && o.cerca.lat != null ? `&lat=${o.cerca.lat}&lon=${o.cerca.lng}` : '';
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6${bias}${o.ciudades ? '&osm_tag=place' : ''}`);
        const j = await r.json();
        red = (j.features || []).map(f => {
          const p = f.properties || {};
          return { n: p.name || q, sub: [p.street, p.city || p.county, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], pais: (p.countrycode || '').toUpperCase(), tipo: tipoOsm(p.osm_key, p.osm_value) };
        });
      }
    } catch (e) { anotar('buscar', e); }
    const vistos = {};
    return loc.concat(red).filter(s => { const k = s.n.toLowerCase(); if (vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, 7);
  },
  /* Completa coordenadas, dirección y país de una sugerencia de Google */
  async completar(s) {
    if (!s.pid || s.lat != null) return s;
    try {
      await GM.cargar();
      const { Place } = await google.maps.importLibrary('places');
      const p = new Place({ id: s.pid });
      await p.fetchFields({ fields: ['displayName', 'location', 'formattedAddress', 'addressComponents', 'photos', 'types'] });
      this.token = null;
      const pais = ((p.addressComponents || []).find(c => (c.types || []).indexOf('country') >= 0) || {}).shortText || '';
      s.lat = p.location.lat(); s.lng = p.location.lng(); s.sub = p.formattedAddress || s.sub; s.pais = pais;
      s.fotoG = p.photos && p.photos[0] ? p.photos[0].getURI({ maxWidth: 1600 }) : '';
      const ty = p.types || [];
      s.tipo = ty.some(t => /restaurant|cafe|bar|food|bakery/.test(t)) ? 'comida' : ty.some(t => /lodging/.test(t)) ? 'hotel' : ty.some(t => /station|airport/.test(t)) ? 'transporte' : 'visita';
    } catch (e) { anotar('lugar', e); }
    return s;
  },
  async foto(s) {
    if (s.fotoG) return s.fotoG;
    if (s.pid && claveMaps()) { const c = await this.completar(Object.assign({}, s, { lat: null })); if (c.fotoG) return c.fotoG; }
    return this.fotoWiki(s.n);
  },
  /* Wikipedia: la foto principal del artículo; si es un mapa o una bandera (países), la primera foto de verdad */
  async fotoWiki(n) {
    const MALA = /map|mapa|flag|bandera|escudo|coat.of.arms|locator|location|logo|seal|emblem|blas[oó]n|orthographic|relief|topogr|sello|stamp|banknote|billete|diagram|chart|gr[aá]fico|signature|firma/i;
    const nombre = String(n || '').trim(); if (!nombre) return '';
    for (const idioma of ['es', 'en']) {
      try {
        const t = encodeURIComponent(nombre.replace(/ /g, '_'));
        const r = await fetch(`https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${t}?redirect=true`);
        if (!r.ok) continue;
        const j = await r.json();
        const u = (j.originalimage && j.originalimage.width >= 700 ? j.originalimage.source : null) || (j.thumbnail && j.thumbnail.source && j.thumbnail.source.replace(/\/\d+px-/, '/1280px-'));
        if (u && !/\.svg/i.test(u) && !MALA.test(decodeURIComponent(u.split('/').pop()))) return u;
        const r2 = await fetch(`https://${idioma}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent((j.titles && j.titles.canonical) || nombre.replace(/ /g, '_'))}`);
        if (!r2.ok) continue;
        const items = ((await r2.json()).items || []).filter(i => i.type === 'image' && /\.jpe?g$/i.test(i.title || '') && !MALA.test(i.title || ''));
        for (const it of items.slice(0, 4)) {
          const r3 = await fetch(`https://${idioma}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(it.title)}&prop=imageinfo&iiprop=url|size&iiurlwidth=1600&format=json&origin=*`);
          const pg = Object.values(((await r3.json()).query || {}).pages || {})[0];
          const ii = pg && pg.imageinfo && pg.imageinfo[0];
          if (ii && ii.width >= 900 && ii.width >= ii.height * .9) return ii.thumburl || ii.url;
        }
      } catch (e) { }
    }
    return '';
  }
};
function tipoOsm(k, v) { if (k === 'amenity' && /restaurant|cafe|bar|pub|fast_food|food_court/.test(v)) return 'comida'; if (k === 'tourism' && /hotel|hostel|guest_house|apartment/.test(v)) return 'hotel'; if (/railway|aeroway|public_transport/.test(k)) return 'transporte'; return 'visita'; }
function nombrePais(c) { try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(c); } catch (e) { return c; } }

/* ---------- Mapa propio con teselas (sin clave) */
class Teselas {
  constructor(cont, o) {
    this.c = cont; this.o = o || {}; this.z = 13; this.cx = 0; this.cy = 0; this.mks = []; this.imgs = {};
    cont.classList.add('o-tm');
    cont.innerHTML = `<div class="o-tm-capa"><div class="o-tm-tes"></div><svg class="o-tm-ruta"></svg><div class="o-tm-mks"></div></div><div class="o-tm-atr">© OpenStreetMap · © CARTO</div>`;
    this.capa = $('.o-tm-capa', cont); this.tes = $('.o-tm-tes', cont); this.svg = $('.o-tm-ruta', cont); this.mkc = $('.o-tm-mks', cont);
    this.gestos();
    this.ro = new ResizeObserver(() => this.pintar()); this.ro.observe(cont);
  }
  static px(lat, lng, z) { const s = 256 * Math.pow(2, z), r = lat * Math.PI / 180; return [(lng + 180) / 360 * s, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s]; }
  centro(lat, lng, z) { if (z != null) this.z = z; const [x, y] = Teselas.px(lat, lng, this.z); this.cx = x; this.cy = y; this.pintar(); }
  encuadrar(ps, pad) {
    if (!ps.length) return;
    if (ps.length === 1) return this.centro(ps[0].lat, ps[0].lng, 15);
    const W = this.c.clientWidth || 360, H = this.c.clientHeight || 600; pad = pad || { t: 90, b: 230, l: 40, r: 40 };
    let z = 17;
    for (; z > 2; z--) {
      const xs = ps.map(p => Teselas.px(p.lat, p.lng, z));
      const w = Math.max(...xs.map(a => a[0])) - Math.min(...xs.map(a => a[0])), h = Math.max(...xs.map(a => a[1])) - Math.min(...xs.map(a => a[1]));
      if (w < W - pad.l - pad.r && h < H - pad.t - pad.b) break;
    }
    this.z = z;
    const xs = ps.map(p => Teselas.px(p.lat, p.lng, z));
    this.cx = (Math.max(...xs.map(a => a[0])) + Math.min(...xs.map(a => a[0]))) / 2 + (pad.r - pad.l) / 2;
    this.cy = (Math.max(...xs.map(a => a[1])) + Math.min(...xs.map(a => a[1]))) / 2 + (pad.b - pad.t) / 2;
    this.pintar();
  }
  volar(lat, lng, z) {
    const [x1, y1] = Teselas.px(lat, lng, this.z); const x0 = this.cx, y0 = this.cy, t0 = performance.now(), ms = reducido() ? 1 : 650;
    const yOff = this.o.desplazar || 0;
    const f = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); this.cx = x0 + (x1 - x0) * e; this.cy = y0 + (y1 + yOff - y0) * e; this.pintar(); if (k < 1) requestAnimationFrame(f); else if (z && z !== this.z) this.zoom(z - this.z); };
    requestAnimationFrame(f);
  }
  zoom(d, px, py) {
    const nz = clamp(this.z + d, 2, 19); if (nz === this.z) return;
    const W = this.c.clientWidth, H = this.c.clientHeight;
    px = px == null ? W / 2 : px; py = py == null ? H / 2 : py;
    const k = Math.pow(2, nz - this.z);
    const wx = this.cx - W / 2 + px, wy = this.cy - H / 2 + py;
    const fin = () => { this.capa.style.transform = ''; this.z = nz; this.cx = wx * k - px + W / 2; this.cy = wy * k - py + H / 2; this.imgs = {}; this.tes.innerHTML = ''; this.pintar(); };
    if (reducido()) return fin();
    this.capa.style.transformOrigin = `${px}px ${py}px`;
    animar(this.capa, [{ transform: 'scale(1)' }, { transform: `scale(${k})` }], { duration: 280, easing: CURVA.entrar, siempre: true }).then(fin);
  }
  pintar() {
    const W = this.c.clientWidth, H = this.c.clientHeight; if (!W) return;
    const z = this.z, n = Math.pow(2, z), x0 = this.cx - W / 2, y0 = this.cy - H / 2;
    const oscuro = document.documentElement.dataset.tema === 'oscuro';
    const vistos = {};
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W) / 256); tx++) for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      const xx = ((tx % n) + n) % n, k = z + '/' + tx + '/' + ty; vistos[k] = 1;
      let im = this.imgs[k];
      if (!im) {
        im = document.createElement('img'); im.className = 'o-tm-t'; im.alt = ''; im.decoding = 'async';
        im.onload = () => im.classList.add('o-ok');
        im.src = `https://${'abcd'[(xx + ty) % 4]}.basemaps.cartocdn.com/${oscuro ? 'dark_all' : 'light_all'}/${z}/${xx}/${ty}@2x.png`;
        this.imgs[k] = im; this.tes.appendChild(im);
      }
      im.style.transform = `translate(${tx * 256 - x0}px,${ty * 256 - y0}px)`;
    }
    Object.keys(this.imgs).forEach(k => { if (!vistos[k]) { this.imgs[k].remove(); delete this.imgs[k]; } });
    this.mks.forEach(m => { const [x, y] = Teselas.px(m.lat, m.lng, z); m.el.style.transform = `translate(${x - x0}px,${y - y0}px)`; });
    if (this.lin) {
      const pts = this.lin.map(p => Teselas.px(p.lat, p.lng, z)).map(([x, y]) => [x - x0, y - y0]);
      this.svg.setAttribute('width', W); this.svg.setAttribute('height', H);
      this.svg.innerHTML = pts.length > 1 ? `<path d="${curva(pts)}" class="o-ruta-l"/>` : '';
    }
  }
  marcar(ps, alTocar) {
    this.mkc.innerHTML = ''; this.mks = [];
    ps.forEach((p, i) => {
      const el = document.createElement('div'); el.className = 'o-mk-w'; el.innerHTML = p.html;
      el.addEventListener('click', e => { e.stopPropagation(); alTocar && alTocar(p, i); });
      this.mkc.appendChild(el); this.mks.push({ lat: p.lat, lng: p.lng, el });
      animar(el.firstElementChild, [{ opacity: 0, transform: 'translateY(-14px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 200 + i * 70, easing: CURVA.muelle });
    });
    this.pintar();
  }
  ruta(ps) {
    this.lin = ps; this.pintar();
    const pth = $('path', this.svg);
    if (!reducido()) animar(this.svg, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 250 });
  }
  gestos() {
    const pts = new Map(); let ult = null, d0 = 0, vel = [0, 0], tUlt = 0, toque = 0;
    this.c.addEventListener('pointerdown', e => { if (e.target.closest('.o-mk-w')) return; this.c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); ult = [e.clientX, e.clientY]; tUlt = performance.now(); vel = [0, 0]; if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    this.c.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d0 && Math.abs(Math.log2(d / d0)) > .6) { const r = this.c.getBoundingClientRect(); this.zoom(d > d0 ? 1 : -1, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); d0 = d; } return; }
      const t = performance.now(), dx = e.clientX - ult[0], dy = e.clientY - ult[1];
      this.cx -= dx; this.cy -= dy; vel = [dx / Math.max(1, t - tUlt), dy / Math.max(1, t - tUlt)]; tUlt = t; ult = [e.clientX, e.clientY];
      this.pintar();
    });
    const fin = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if (pts.size || reducido()) return;
      let [vx, vy] = vel; if (performance.now() - tUlt > 80) return;
      const f = () => { vx *= .92; vy *= .92; this.cx -= vx * 16; this.cy -= vy * 16; this.pintar(); if (Math.hypot(vx, vy) > .02) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    };
    this.c.addEventListener('pointerup', e => { const ahora = Date.now(); if (ahora - toque < 280) { const r = this.c.getBoundingClientRect(); this.zoom(1, e.clientX - r.left, e.clientY - r.top); } toque = ahora; fin(e); });
    this.c.addEventListener('pointercancel', fin);
    this.c.addEventListener('wheel', e => { e.preventDefault(); if (this.rueda) return; this.rueda = true; setTimeout(() => { this.rueda = false; }, 320); const r = this.c.getBoundingClientRect(); this.zoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  quitar() { try { this.ro.disconnect(); } catch (e) { } }
}
function curva(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
    d += ` L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/* ---------- Google Maps con la misma forma de uso */
const ESTILO_CLARO = [{ elementType: 'geometry', stylers: [{ color: '#efebe4' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#7d766e' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f4ef' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fbfaf8' }] }, { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6e0d6' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d6dee2' }] }, { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }, { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e2e6d8' }] }, { featureType: 'transit', elementType: 'labels.icon', stylers: [{ saturation: -100 }] }];
const ESTILO_OSCURO = [{ elementType: 'geometry', stylers: [{ color: '#151413' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#8f8a84' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b0c' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#24221f' }] }, { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1b1a18' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a2026' }] }, { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }, { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1b1f19' }] }, { featureType: 'transit', elementType: 'labels.icon', stylers: [{ saturation: -100 }] }];
class MapaG {
  constructor(cont, gm) {
    this.c = cont; this.gm = gm; this.ovs = [];
    this.map = new gm.Map(cont, { center: { lat: 0, lng: 0 }, zoom: 3, disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false, styles: document.documentElement.dataset.tema === 'oscuro' ? ESTILO_OSCURO : ESTILO_CLARO, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--mapa') });
    const Base = gm.OverlayView;
    this.Ov = class extends Base {
      constructor(p, html, f) { super(); this.p = p; this.div = document.createElement('div'); this.div.className = 'o-mk-w o-mk-g'; this.div.innerHTML = html; this.div.addEventListener('click', e => { e.stopPropagation(); f && f(); }); }
      onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.div); }
      draw() { const q = this.getProjection().fromLatLngToDivPixel(new gm.LatLng(this.p.lat, this.p.lng)); this.div.style.transform = `translate(${q.x}px,${q.y}px)`; }
      onRemove() { this.div.remove(); }
    };
  }
  marcar(ps, alTocar) {
    this.ovs.forEach(o => o.setMap(null)); this.ovs = [];
    ps.forEach((p, i) => { const o = new this.Ov(p, p.html, () => alTocar && alTocar(p, i)); o.setMap(this.map); this.ovs.push(o); setTimeout(() => o.div.firstElementChild && animar(o.div.firstElementChild, [{ opacity: 0, transform: 'translateY(-14px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 70, easing: CURVA.muelle }), 60); });
  }
  ruta(ps) {
    if (this.lin) this.lin.setMap(null);
    if (ps.length < 2) return;
    const col = getComputedStyle(document.documentElement).getPropertyValue('--tinta').trim();
    this.lin = new this.gm.Polyline({ path: ps, geodesic: true, strokeOpacity: 0, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: .55, strokeColor: col, scale: 2.5 }, offset: '0', repeat: '12px' }], map: this.map });
  }
  encuadrar(ps) {
    if (!ps.length) return;
    if (ps.length === 1) { this.map.setCenter(ps[0]); this.map.setZoom(15); return; }
    const b = new this.gm.LatLngBounds(); ps.forEach(p => b.extend(p));
    this.map.fitBounds(b, { top: 100, bottom: 240, left: 40, right: 40 });
  }
  centro(lat, lng, z) { this.map.setCenter({ lat, lng }); if (z) this.map.setZoom(z); }
  volar(lat, lng) { this.map.panTo({ lat, lng }); }
  zoom(d) { this.map.setZoom(this.map.getZoom() + d); }
  quitar() { }
}

const Mapa = {
  async crear(cont) {
    try { const gm = await GM.cargar(); return new MapaG(cont, gm); } catch (e) { return new Teselas(cont); }
  },
  async montar(cont, v, dia, o) {
    if (!cont) return; o = o || {};
    const nuevo = !cont._mapa;
    const m = cont._mapa || await this.crear(cont); cont._mapa = m;
    const ps = (dia && dia !== 'todos' ? paradasDe(v.id, dia) : paradasDe(v.id)).filter(x => x.lugar && x.lugar.lat != null);
    const ideas = o.ideas ? lista('ideas', i => i.viaje === v.id && !i.parada && i.lugar && i.lugar.lat != null) : [];
    const ah = dia && dia !== 'todos' ? paradaAhora(v, dia, paradasDe(v.id, dia)) : { idx: -1 };
    const todos = paradasDe(v.id, dia && dia !== 'todos' ? dia : null);
    const puntos = ps.map(x => { const i = todos.findIndex(y => y.id === x.id); const on = i === ah.idx; return { lat: x.lugar.lat, lng: x.lugar.lng, id: x.id, html: `<button class="o-mk${on ? ' o-mk-on' : ''}${x.hecho ? ' o-mk-h' : ''}"><span class="tn">${on ? '' : (dia === 'todos' ? fecha(x.dia).getUTCDate() : i + 1)}</span></button>` }; })
      .concat(ideas.map(x => ({ lat: x.lugar.lat, lng: x.lugar.lng, id: x.id, idea: true, html: `<button class="o-mk o-mk-i">${ic('idea', 13, 2)}</button>` })));
    m.marcar(puntos, (p) => o.alTocar && o.alTocar(p));
    if (dia !== 'todos') m.ruta(ps.map(x => ({ lat: x.lugar.lat, lng: x.lugar.lng })));
    if (!nuevo) return m;
    if (puntos.length) requestAnimationFrame(() => m.encuadrar(puntos, o.escritorio ? { t: 60, b: 60, l: 60, r: 60 } : null));
    else if (v.lat != null) m.centro(v.lat, v.lng, 12);
    return m;
  },
  desmontar(el) { $$('.o-mapa', el).forEach(c => { if (c._mapa) { c._mapa.quitar(); c._mapa = null; } }); },
  enfocar(x) { const c = $('.o-mapa'); if (c && c._mapa && x.lugar) c._mapa.volar(x.lugar.lat, x.lugar.lng, 16); },
  /* Mapa pequeño fijo para el detalle de una parada */
  mini(el, l) {
    const clave = l.lat + ',' + l.lng + document.documentElement.dataset.tema; if (el.dataset.ok === clave) return; el.dataset.ok = clave;
    const z = 15, [x, y] = Teselas.px(l.lat, l.lng, z), W = 64, H = 64;
    const oscuro = document.documentElement.dataset.tema === 'oscuro';
    const tx = Math.floor(x / 256), ty = Math.floor(y / 256);
    el.innerHTML = `<img alt="" src="https://a.basemaps.cartocdn.com/${oscuro ? 'dark_all' : 'light_all'}/${z}/${tx}/${ty}@2x.png" style="transform:translate(${W / 2 - (x - tx * 256)}px,${H / 2 - (y - ty * 256)}px)"><span class="o-punto o-g"></span>`;
  }
};

/* ============================ PESTAÑA MAPA ============================ */
TABS.mapa = {
  render(v, p) {
    const dias = diasDe(v);
    p.mdia = p.mdia || p.dia || 'todos';
    const ps = (p.mdia === 'todos' ? paradasDe(v.id) : paradasDe(v.id, p.mdia));
    return `<div class="o-vmapa">
      <div class="o-mapa" id="mapa-v" data-fijo></div>
      <div class="o-vmapa-bar">
        <button class="o-bt o-vid t t-s" data-a="atras">${ic('back', 20)}</button>
        <div class="o-vmapa-d o-vid o-nodrag"><span class="o-pild"></span><button class="o-md t t-s${p.mdia === 'todos' ? ' o-on' : ''}" data-a="mdia" data-d="todos">Todo</button>${dias.map(d => `<button class="o-md t t-s${p.mdia === d ? ' o-on' : ''}" data-a="mdia" data-d="${d}"><span class="tn">${fecha(d).getUTCDate()}</span></button>`).join('')}</div>
      </div>
      <div class="o-vmapa-zoom"><button class="o-bt o-vid t t-s" data-a="zmas">${ic('plus', 18)}</button><button class="o-bt o-vid t t-s" data-a="zmenos"><svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg></button></div>
      <div class="o-carr">${ps.length ? ps.map((x, i) => {
        const f = fotoParada(x), tp = tipoDe(x.tipo);
        return `<button class="o-carr-c o-vid t t-g" data-a="mfoco" data-id="${x.id}" data-e="der"><span class="o-carr-f" style="${f ? `background-image:url('${f}')` : ''}">${f ? '' : ic(tp.ic, 22, 1.5)}</span><span class="o-carr-t"><span class="o-cap">${p.mdia === 'todos' ? esc(fechaCorta(x.dia)) + ' · ' : ''}${esc(x.hora || 'Sin hora')}</span><span class="o-carr-n">${esc(x.nombre)}</span><span class="o-nota o-1l">${esc(x.lugar && x.lugar.dir ? x.lugar.dir : tp.t)}</span></span></button>`;
      }).join('') : `<div class="o-carr-c o-vid o-carr-vacio" data-e="der"><span class="o-nota">No hay paradas con sitio en el mapa este día.</span></div>`}</div>
    </div>`;
  },
  alPintar(el, v, p) {
    const d = $('.o-vmapa-d', el); Anim.pildora(d, $('.o-md.o-on', d));
    const on = $('.o-md.o-on', d); if (on) d.scrollLeft = on.offsetLeft - 60;
    Mapa.montar($('#mapa-v', el), v, p.mdia, { ideas: true, alTocar: pt => {
      if (pt.idea) { aviso('Idea guardada: ' + (dato('ideas', pt.id) || {}).titulo); return; }
      const c = $(`.o-carr-c[data-id="${pt.id}"]`, el); if (c) { c.parentNode.scrollTo({ left: c.offsetLeft - 16, behavior: reducido() ? 'auto' : 'smooth' }); Anim.salto(c); }
    } }).then(m => { if (p.foco) { const x = dato('paradas', p.foco); p.foco = null; if (x && x.lugar) setTimeout(() => m.volar(x.lugar.lat, x.lugar.lng, 16), 500); } });
    /* Al deslizar el carrusel, el mapa va a la parada del centro */
    const car = $('.o-carr', el); let t = null;
    car.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
      const cs = $$('.o-carr-c[data-id]', car); const mid = car.scrollLeft + car.clientWidth / 2;
      const c = cs.sort((a, b) => Math.abs(a.offsetLeft + a.offsetWidth / 2 - mid) - Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid))[0];
      if (c && c.dataset.id !== car.dataset.foco) { car.dataset.foco = c.dataset.id; const x = dato('paradas', c.dataset.id), m = $('#mapa-v', el)._mapa; if (x && m && x.lugar) m.volar(x.lugar.lat, x.lugar.lng); $$('.o-mk', el).forEach(k => k.classList.remove('o-mk-sel')); }
    }, 140); }, { passive: true });
  }
};
Object.assign(PANT.viaje.acciones, {
  mdia: (b, e, p, pa) => { p.mdia = b.dataset.d; Anim.pildora(b.parentNode, b); $$('.o-md', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); setTimeout(() => { const vt = $('.o-vt', pa.el); Mapa.desmontar(pa.el); const v = dato('viajes', p.id); vt.innerHTML = TABS.mapa.render(v, p); TABS.mapa.alPintar(vt, v, p); Anim.entrar($('.o-carr', vt), { paso: 50 }); }, 220); },
  mfoco: (b, e, p, pa) => { const x = dato('paradas', b.dataset.id); const m = $('#mapa-v', pa.el)._mapa; if (m && x.lugar) { if (b.dataset.sel === '1') return PANT.viaje.acciones.parada(b, e, p); $$('.o-carr-c', pa.el).forEach(c => { c.dataset.sel = ''; }); b.dataset.sel = '1'; m.volar(x.lugar.lat, x.lugar.lng, 16); } else PANT.viaje.acciones.parada(b, e, p); },
  zmas: (b, e, p, pa) => { const m = $('#mapa-v', pa.el)._mapa; m && m.zoom(1); },
  zmenos: (b, e, p, pa) => { const m = $('#mapa-v', pa.el)._mapa; m && m.zoom(-1); }
});
