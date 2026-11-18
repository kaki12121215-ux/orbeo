/* ============================ IDEAS ============================
   Se pega un enlace de TikTok, Instagram, Google Maps o cualquier web y se guarda con su foto y su título.
   Luego se pasa al plan de un día con un toque. */
const FUENTES = { tiktok: { t: 'TikTok', ic: 'tiktok' }, instagram: { t: 'Instagram', ic: 'insta' }, maps: { t: 'Google Maps', ic: 'gmaps' }, web: { t: 'Web', ic: 'web' } };
function fuenteDe(u) {
  if (/tiktok\.com/i.test(u)) return 'tiktok';
  if (/instagram\.com|instagr\.am/i.test(u)) return 'instagram';
  if (/google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|g\.co\/kgs/i.test(u)) return 'maps';
  return 'web';
}
/* Lo que se puede sacar de un enlace de Maps sin preguntar a nadie */
function leerMaps(u) {
  const o = {};
  let m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || u.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) o.lugar = { lat: +m[1], lng: +m[2] };
  const n = u.match(/\/place\/([^/@?]+)/) || u.match(/[?&](?:q|query)=([^&]+)/);
  if (n && !/^-?\d/.test(decodeURIComponent(n[1]))) o.titulo = decodeURIComponent(n[1].replace(/\+/g, ' '));
  return o;
}
/* El número del vídeo de TikTok (para enseñar el propio vídeo como vista previa) */
function idTikTok(u) { const m = String(u || '').match(/\/(?:video|photo|v)\/(\d{8,})/) || String(u || '').match(/[?&]item_id=(\d{8,})/); return m ? m[1] : ''; }
function reproductorTikTok(id, o) {
  o = o || {};
  const q = o.mini ? 'controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&loop=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0' : 'rel=0&music_info=1&description=1&native_context_menu=0';
  return `<iframe class="o-tt${o.mini ? ' o-tt-mini' : ''}" src="https://www.tiktok.com/player/v1/${id}?${q}" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Vídeo de TikTok"${o.mini ? ' tabindex="-1"' : ''}></iframe>`;
}
function extraerUrl(t) { const m = String(t || '').match(/https?:\/\/[^\s<>"']+/); return m ? m[0].replace(/[).,;]+$/, '') : ''; }

const Ideas = {
  async desdeEnlace(vid, url) {
    url = extraerUrl(url);
    if (!url) { aviso('Eso no parece un enlace. Cópialo entero desde la app y pégalo.'); return; }
    if (lista('ideas', i => i.viaje === vid && i.url === url).length) { aviso('Esa idea ya está guardada'); return; }
    const fuente = fuenteDe(url);
    const base = { viaje: vid, url, fuente, titulo: '', cargando: true };
    if (fuente === 'maps') Object.assign(base, leerMaps(url));
    if (fuente === 'tiktok' && idTikTok(url)) base.ttid = idTikTok(url);
    const id = nuevo('ideas', base);
    vibrar(10);
    /* Se abre su ficha para elegir categoría y escribir una nota mientras se carga */
    setTimeout(() => abrirIdea(id), 380);
    let info = {};
    try {
      if (Sync.activo()) info = await api('enlace-info', { url }, { ms: 30000 });
      if (fuente === 'tiktok' && !info.titulo && !info.imagen) {
        const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url)); const j = await r.json();
        const vid_ = j.embed_product_id || ((j.html || '').match(/data-video-id="(\d+)"/) || [])[1];
        info = { titulo: j.title, autor: j.author_unique_id ? '@' + j.author_unique_id : (j.author_name || ''), imagenUrl: j.thumbnail_url, ttid: vid_ };
      }
    } catch (e) { anotar('enlace', e); }
    const campos = { cargando: false };
    if (info.ttid) campos.ttid = String(info.ttid);
    else if (fuente === 'tiktok' && info.final && idTikTok(info.final)) campos.ttid = idTikTok(info.final);
    if (info.titulo) campos.titulo = info.titulo.slice(0, 140);
    if (info.autor) campos.autor = info.autor;
    if (info.final && fuente === 'maps') Object.assign(campos, leerMaps(info.final));
    if (info.lat != null) campos.lugar = { lat: info.lat, lng: info.lng };
    if (info.imagen) {
      const bin = atob(info.imagen), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const mid = await Subidas.guardar(new Blob([u], { type: info.tipoImagen || 'image/jpeg' }), 'idea.jpg');
      campos.imagen = { id: mid };
    } else if (info.imagenUrl) campos.imagen = { url: info.imagenUrl };
    const ya = dato('ideas', id) || {};
    if (!ya.titulo && !campos.titulo) campos.titulo = fuente === 'maps' ? 'Sitio de Google Maps' : fuente === 'tiktok' ? 'Vídeo de TikTok' : fuente === 'instagram' ? 'Publicación de Instagram' : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    if (!campos.imagen && (campos.lugar || ya.lugar) && claveMaps()) { const fo = await Lugar.foto({ n: campos.titulo || ya.titulo, lat: (campos.lugar || ya.lugar).lat }).catch(() => ''); if (fo) campos.imagen = { url: fo }; }
    poner('ideas', id, campos);
    actividad(vid, 'ha guardado una idea de ' + FUENTES[fuente].t);
  }
};

TABS.ideas = {
  render(v, p) {
    p.fil = p.fil || 'todas';
    const todas = lista('ideas', i => i.viaje === v.id).sort((a, b) => (b.creado || 0) - (a.creado || 0));
    const ls = todas.filter(i => p.fil === 'todas' || i.fuente === p.fil || 'c:' + i.cat === p.fil);
    const catsUsadas = []; todas.forEach(i => { if (i.cat && tipoDe(i.cat, true) && catsUsadas.indexOf(i.cat) < 0) catsUsadas.push(i.cat); });
    const fuentesUsadas = Object.keys(FUENTES).filter(k => todas.some(i => i.fuente === k));
    const fils = [['todas', 'Todas', '']].concat(catsUsadas.map(k => ['c:' + k, tipoDe(k).t, tipoDe(k).ic]), (fuentesUsadas.length > 1 ? fuentesUsadas : []).map(k => [k, FUENTES[k].t.replace('Google ', ''), FUENTES[k].ic]));
    const cols = [[], []]; ls.forEach((x, i) => cols[i % 2].push(x));
    return `<div class="o-cont o-tabc">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span class="o-nota">${esc(v.nombre)}</span><span style="width:46px"></span></div>
      <div class="o-tabc-t"><h1 class="o-t1" data-e="titulo">Ideas</h1><span class="o-num o-tabc-n tn" data-e>${todas.length}</span></div>
      ${puedoEditar() ? `<div class="o-pegar o-vid" data-e><span class="o-pegar-i">${ic('link', 19)}</span><input id="f-idea" class="o-pegar-in" placeholder="Pega un enlace de TikTok, Instagram o Maps" autocomplete="off" autocapitalize="off" inputmode="url"><button class="o-pil o-peq t" data-a="pegar">${ic('paste', 16)}Pegar</button></div>` : ''}
      ${fils.length > 1 ? `<div class="o-fils" data-e><span class="o-pild"></span>${fils.map(([k, n, i]) => `<button class="o-fil t t-s${p.fil === k ? ' o-on' : ''}" data-a="fil" data-f="${k}">${i ? ic(i, 15) : ''}${esc(n)}</button>`).join('')}</div>` : ''}
      ${ls.length ? `<div class="o-mas">${cols.map(c => `<div class="o-mas-c">${c.map(tarjetaIdea).join('')}</div>`).join('')}</div>`
      : `<div class="o-vacio" data-e="pop"><div class="o-vacio-ic">${ic('idea', 30, 1.4)}</div><div class="o-t3">${todas.length ? 'Nada de aquí todavía' : 'Guardad aquí lo que os inspire'}</div><p class="o-nota">Copia el enlace de un vídeo de TikTok, una foto de Instagram o un sitio de Google Maps y pégalo arriba.</p></div>`}
    </div>`;
  },
  alPintar(el, v, p) {
    const f = $('.o-fils', el); if (f) Anim.pildora(f, $('.o-fil.o-on', f));
    const i = $('#f-idea', el);
    if (i) {
      i.addEventListener('paste', () => setTimeout(() => { if (extraerUrl(i.value)) { Ideas.desdeEnlace(v.id, i.value); i.value = ''; i.blur(); } }, 30));
      i.addEventListener('keydown', e => { if (e.key === 'Enter' && i.value.trim()) { Ideas.desdeEnlace(v.id, i.value); i.value = ''; i.blur(); } });
    }
  }
};
function tarjetaIdea(x) {
  const F = FUENTES[x.fuente] || FUENTES.web, u = urlMedio(x.imagen), por = dato('personas', x.por || x._por);
  const alto = x.fuente === 'tiktok' ? 'o-alta' : x.fuente === 'maps' ? 'o-baja' : '';
  const cat = x.cat ? tipoDe(x.cat, true) : null;
  /* Sin foto, un TikTok enseña su propio vídeo (quieto, sin botones) */
  const tt = !u && x.fuente === 'tiktok' && x.ttid ? reproductorTikTok(x.ttid, { mini: true }) : '';
  return `<button class="o-idea t t-g${x.cargando ? ' o-carga' : ''}${x.parada ? ' o-enplan' : ''}" data-a="idea" data-id="${x.id}" data-e="pop">
    <span class="o-idea-img ${alto}" style="${u ? `background-image:url('${u}')` : ''}">${u ? '' : tt || `<span class="o-idea-ph">${ic(F.ic, 30, 1.3)}</span>`}
      <span class="o-idea-src o-vido">${ic(F.ic, 14, 1.9)}</span>${x.fuente === 'tiktok' && u ? `<span class="o-idea-play">${ic('play', 16, 2)}</span>` : ''}
      ${x.parada ? `<span class="o-idea-plan o-vido">${ic('check', 13, 2.4)}En el plan</span>` : ''}</span>
    <span class="o-idea-t">${x.cargando ? '<span class="o-brillo-t"></span><span class="o-brillo-t o-c"></span>' : `${cat ? `<span class="o-idea-cat" style="--cc:${colorCat(x.cat)}">${ic(cat.ic, 13, 2)}${esc(cat.t)}</span>` : ''}<span class="o-idea-n">${esc(x.titulo)}</span>${x.nota ? `<span class="o-idea-nota">${esc(x.nota)}</span>` : ''}<span class="o-idea-a">${por ? avatar(por, 18) : ''}<span class="o-nota o-1l">${esc(x.autor || F.t)}</span></span>`}</span>
  </button>`;
}
Object.assign(PANT.viaje.acciones, {
  pegar: async (b, e, p) => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (er) { }
    if (!extraerUrl(t)) { const i = $('#f-idea'); i && i.focus(); aviso('Mantén pulsado el campo y elige «Pegar».'); return; }
    Anim.onda(b, e); Ideas.desdeEnlace(p.id, t);
  },
  fil: (b, e, p, pa) => {
    if (b.dataset.f === p.fil) return;
    p.fil = b.dataset.f;
    const f = b.parentNode; $$('.o-fil', f).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(f, b);
    const v = dato('viajes', p.id), vt = $('.o-vt', pa.el), st = pa.el.scrollTop;
    /* Las que se quedan se deslizan a su sitio, las que sobran se encogen y las nuevas entran */
    cambiarLista(vt, TABS.ideas.render(v, p), '.o-idea');
    pa.el.scrollTop = st;
    const vac = $('.o-vacio', vt); if (vac) animar(vac, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 120 });
  },
  idea: (b) => abrirIdea(b.dataset.id)
});

/* Ficha de una idea: su vídeo o foto, la categoría, una nota para el grupo y pasarla al plan */
function abrirIdea(id) {
  const x0 = dato('ideas', id); if (!x0) return;
  const v = dato('viajes', x0.viaje);
  const html = () => {
    const x = dato('ideas', id) || x0, F = FUENTES[x.fuente] || FUENTES.web, u = urlMedio(x.imagen);
    const video = x.fuente === 'tiktok' && x.ttid;
    return `${video ? `<div class="o-ih o-ih-tt" data-e="foto">${reproductorTikTok(x.ttid)}</div>` : `<div class="o-ih${x.cargando ? ' o-carga' : ''}" data-e="foto" style="${u ? `background-image:url('${u}')` : ''}">${u ? '' : `<span class="o-idea-ph">${ic(F.ic, 34, 1.3)}</span>`}<span class="o-chip o-vido">${ic(F.ic, 15)}${F.t}</span></div>`}
      <div class="o-t2" data-e style="margin-top:18px">${x.cargando && !x.titulo ? 'Leyendo el enlace…' : esc(x.titulo)}</div>
      ${x.autor ? `<div class="o-nota" data-e style="margin-top:4px">${esc(x.autor)}</div>` : ''}
      ${puedoEditar() ? `<div class="o-campo" data-e style="margin-top:16px"><span class="o-etq">Categoría</span><div id="i-cats">${chipsCat(x.cat || '', { a: 'icat' })}</div></div>
        <label class="o-campo" data-e><span class="o-etq">Nota</span><textarea id="f-inota" class="o-in o-area" rows="2" placeholder="Por qué mola, a qué hora ir, qué pedir…">${esc(x.nota || '')}</textarea></label>`
        : `${x.cat && tipoDe(x.cat, true) ? `<div class="o-nota" data-e style="margin-top:10px">${esc(tipoDe(x.cat).t)}</div>` : ''}${x.nota ? `<p class="o-txt" data-e style="margin-top:10px">${esc(x.nota)}</p>` : ''}`}
      <div class="o-conf-b" data-e><a class="o-pil o-sec t" href="${esc(x.url)}" target="_blank" rel="noopener">${ic('ext', 17)}Abrir</a>${puedoEditar() && !x.parada ? `<button class="o-pil t" data-a="aPlan">${ic('plus', 17, 2)}Al plan</button>` : x.parada ? `<button class="o-pil o-sec t" data-a="verPlan">${ic('check', 17, 2)}Ver en el plan</button>` : ''}</div>
      ${puedoEditar() && !x.parada ? `<div class="o-dsel o-ih-d" data-e>${diasDe(v).map(d => `<button class="o-dsel-b t t-s" data-a="aDia" data-d="${d}"><span class="o-nota">${'DLMXJVS'[fecha(d).getUTCDay()]}</span><span class="tn">${fecha(d).getUTCDate()}</span></button>`).join('')}</div>` : ''}
      ${puedoEditar() ? `<button class="o-enlace o-mal t" data-a="borrarI" data-e style="display:block;margin:18px auto 0">Borrar la idea</button>` : ''}`;
  };
  const guardarNota = () => { const n = $('#f-inota', c.hoja); if (n && dato('ideas', id) && n.value.trim() !== (dato('ideas', id).nota || '')) poner('ideas', id, { nota: n.value.trim() }); };
  const c = Capa.hoja({
    clase: 'o-hoja-alta',
    html: `<div class="o-hoja-scroll">${html()}</div>`,
    alAbrir: (h, cc, otra) => { const n = $('#f-inota', h); if (n && !n.dataset.ok) { n.dataset.ok = '1'; n.addEventListener('change', guardarNota); n.addEventListener('blur', guardarNota); } },
    alCerrar: () => { guardarNota(); clearInterval(mirar); },
    acciones: {
      icat: (bb) => { const x = dato('ideas', id), k = x.cat === bb.dataset.k ? '' : bb.dataset.k; marcarCat(bb, !!k); poner('ideas', id, { cat: k }, { callado: true }); Nav.refrescar(); },
      catNueva: async () => { const k = await nuevaCategoria(); if (!k) return; poner('ideas', id, { cat: k }, { callado: true }); const box = $('#i-cats', c.hoja); box.innerHTML = chipsCat(k, { a: 'icat' }); const bb = $('.o-cat.o-on', box); if (bb) { bb.scrollIntoView({ inline: 'center', block: 'nearest' }); Anim.salto(bb); } Nav.refrescar(); },
      aPlan: () => { const d = $('.o-ih-d', c.hoja); d.classList.add('o-ver'); animar(d, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 360 }); $$('.o-dsel-b', d).forEach((z, i) => animar(z, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 30, easing: CURVA.muelle })); },
      aDia: (bb) => { guardarNota(); pasarIdea(dato('ideas', id), bb.dataset.d); c.cerrar(); },
      verPlan: () => { const pr = dato('paradas', dato('ideas', id).parada); c.cerrar(); if (pr) setTimeout(() => Nav.ir('parada', { id: pr.id }), 300); },
      borrarI: () => { borrar('ideas', id); c.cerrar(); aviso('Idea borrada', { accion: { t: 'Deshacer', f: () => poner('ideas', id, { _b: 0 }) } }); }
    }
  });
  /* Mientras se lee el enlace, la ficha se completa sola (sin tocar lo que estás escribiendo) */
  let antes = JSON.stringify(Object.assign({}, dato('ideas', id), { nota: '', cat: '' }));
  const mirar = setInterval(() => {
    const x = dato('ideas', id); if (!x) return clearInterval(mirar);
    const ahora = JSON.stringify(Object.assign({}, x, { nota: '', cat: '' }));
    if (ahora !== antes) { antes = ahora; morph($('.o-hoja-scroll', c.hoja), html()); }
    if (!x.cargando) setTimeout(() => clearInterval(mirar), 1500);
  }, 500);
}
