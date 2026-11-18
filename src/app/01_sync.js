/* ============================ SINCRONIZACIÓN ============================
   Igual que en Ronda: todo cambio se hace al momento en el móvil y entra en la cola; la cola se envía
   en orden y, al traer cambios, se juntan campo a campo sin pisar lo que aún no se ha enviado.
   Con el plan o las ideas abiertos pregunta cada 4 s; en el resto, cada 15 s. */
const Sync = {
  t: null, corriendo: false, otra: false, fallos: 0, pendT: null,
  pendientes() { return Object.keys(S.cola).length; },
  activo() { return S.cfg && !S.cfg.demo && S.cfg.url; },
  intervalo() {
    if (document.hidden) return 0;
    const p = Nav.actual();
    const vivo = p && (p.id === 'viaje' || p.id === 'parada');
    const base = vivo ? 4000 : 15000;
    return this.fallos ? Math.min(60000, base * Math.pow(2, this.fallos)) : base;
  },
  programar() { clearTimeout(this.t); const ms = this.intervalo(); if (ms && this.activo()) this.t = setTimeout(() => this.ya(), ms); },
  pronto() { clearTimeout(this.pendT); this.pendT = setTimeout(() => this.ya(), 350); },
  async ya() {
    if (!this.activo()) return;
    if (this.corriendo) { this.otra = true; return; }
    this.corriendo = true; clearTimeout(this.t);
    const antes = JSON.stringify([S.red.ok, this.pendientes()]);
    try {
      const ops = Object.keys(S.cola).map(k => S.cola[k]);
      let r;
      if (ops.length) {
        S.red.enviando = true;
        const foto = ops.map(o => [o.col + '|' + o.id, o.v]);
        r = await api('guardar', { ops: ops.slice(0, 200).map(o => ({ id: o.id, col: o.col, f: o.f, t: o.t })), desde: S.seq });
        foto.slice(0, 200).forEach(x => { const o = S.cola[x[0]]; if (o && o.v === x[1]) delete S.cola[x[0]]; });
        if (r.avisos && r.avisos.some(x => x.indexOf('permiso') === 0)) aviso('Con tu papel en este espacio solo puedes ver. Pide a quien lo administra que te haga editor.');
        if (ops.length > 200) this.otra = true;
      } else r = await api('cambios', { desde: S.seq });
      recibir(r);
      S.red.viejo = verNum(S.sv) < verNum(MIN_SCRIPT);
      S.red.ok = true; S.red.error = null; S.red.ultimo = Date.now(); this.fallos = 0;
    } catch (e) {
      S.red.ok = false; S.red.error = e;
      if (e.code === 'token') { accesoAnulado(); return; }
      if (e.code === 'ocupado') { S.red.ok = true; S.red.error = null; this.otra = true; }
      else this.fallos = Math.min(this.fallos + 1, 5);
    } finally {
      this.corriendo = false; S.red.enviando = false;
      guardarLocal();
      if (antes !== JSON.stringify([S.red.ok, this.pendientes()])) Red.pintar();
      if (this.otra) { this.otra = false; setTimeout(() => this.ya(), 30); } else this.programar();
    }
  }
};

function recibir(r) {
  if (r.sid && S.sid && r.sid !== S.sid) { S.recs = {}; S.seq = 0; S.sid = r.sid; Sync.otra = true; return; }
  if (r.sid) S.sid = r.sid;
  let hay = false; const nuevos = [];
  (r.cambios || []).forEach(c => {
    S.recs[c.col] = S.recs[c.col] || {};
    const n = { f: Object.assign({}, c.f), t: Object.assign({}, c.t), rev: c.rev, por: c.por };
    const op = S.cola[c.col + '|' + c.id];
    if (op) Object.keys(op.f).forEach(k => { if ((op.t[k] || 0) >= (n.t[k] || 0)) { n.f[k] = op.f[k]; n.t[k] = op.t[k]; } });
    const viejo = S.recs[c.col][c.id];
    if (!viejo || JSON.stringify(viejo.f) !== JSON.stringify(n.f)) hay = true;
    if (!viejo && S.seq && c.por && c.por !== yo() && !n.f._b && ['paradas', 'ideas', 'docs'].indexOf(c.col) >= 0) nuevos.push(c);
    S.recs[c.col][c.id] = n;
    if (c.col === 'personas' && c.id === yo() && n.f._b) accesoAnulado();
  });
  if (r.seq > S.seq) S.seq = r.seq;
  if (hay) Nav.refrescar();
  /* Lo que añaden los demás se avisa con su nombre, como en un chat */
  if (nuevos.length === 1) { const c = nuevos[0]; aviso(nombreDe(c.por) + ' ha añadido «' + (c.f.nombre || c.f.titulo || 'algo') + '»'); }
  else if (nuevos.length > 1) aviso(nombreDe(nuevos[0].por) + ' ha añadido ' + nuevos.length + ' cosas');
}
function accesoAnulado() {
  S.cfg = null; DB.del('cfg'); S.recs = {}; S.cola = {}; S.seq = 0; guardarLocal(true);
  aviso('Este móvil ya no tiene acceso al espacio.'); Nav.raiz('bienvenida');
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sync.ya(); Reloj.tic(); } else { clearTimeout(Sync.t); guardarLocal(true); } });
window.addEventListener('online', () => { Sync.fallos = 0; Sync.ya(); Red.pintar(); });
window.addEventListener('offline', () => { S.red.ok = false; S.red.error = ErrR('sinred', 'Sin conexión'); Red.pintar(); });
window.addEventListener('pagehide', () => guardarLocal(true));

/* ---------- archivos: fotos, vídeos y documentos
   Se guardan en el móvil al momento (se ven sin conexión) y se suben a Drive por trozos. */
function blobA64(blob) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => ko(r.error); r.readAsDataURL(blob); }); }
async function conReintentos(f) {
  for (let i = 0; ; i++) { try { return await f(); } catch (e) { if (i >= 3 || e.code === 'token' || e.code === 'archivo' || e.code === 'permiso') throw e; await espera(1200 * (i + 1)); } }
}
async function subirArchivo(blob, nombre, progreso) {
  const b64 = await blobA64(blob);
  const tipo = blob.type || 'application/octet-stream';
  const T = 1048576, total = Math.max(1, Math.ceil(b64.length / T));
  const sid = uid().replace(/[^a-z0-9]/g, '');
  if (total === 1) { const r = await conReintentos(() => api('archivo-subir', { sid, n: 0, total: 1, nombre, tipo, data: b64 }, { ms: 90000 })); progreso && progreso(1); return r.fid; }
  const ids = new Array(total); let hechos = 0, sig = 0;
  const trabajador = async () => {
    while (sig < total) {
      const n = sig++;
      const r = await conReintentos(() => api('archivo-subir', { sid, n, total, nombre, tipo, data: b64.slice(n * T, (n + 1) * T), parte: true }, { ms: 90000 }));
      ids[n] = r.tid; hechos++; progreso && progreso(hechos / (total + 1));
    }
  };
  await Promise.all([0, 1, 2, 3].slice(0, Math.min(4, total)).map(trabajador));
  const r = await conReintentos(() => api('archivo-unir', { sid, ids, total, nombre, tipo }, { ms: 120000 }));
  progreso && progreso(1);
  return r.fid;
}
async function bajarArchivo(fid) {
  const partes = []; let desde = 0, total = 1, tipo = '';
  while (desde < total) {
    let r, largo = 1572864;
    for (let i = 0; ; i++) {
      try { r = await api('archivo-leer', { fid, desde, largo }, { ms: 60000 }); break; }
      catch (e) { if (i >= 2 || e.code === 'token' || e.code === 'archivo' || e.code === 'sinred') throw e; largo = Math.max(196608, Math.floor(largo / 6) * 3); await espera(1200 * (i + 1)); }
    }
    const bin = atob(r.data), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    partes.push(u); desde += u.length; total = r.total; tipo = r.tipo;
    if (!u.length) break;
  }
  return new Blob(partes, { type: tipo });
}

/* Medios (fotos, vídeos, archivos de documentos): «m» es { id, fid, demo, url } */
const bajando = {};
/* Las fotos originales de Wikimedia pueden pesar 20 MB: el iPhone las deja a medias. Se piden a 1280 px */
function fotoLigera(u, w) {
  w = w || 1280;
  /* Fotos de Google: se pide el ancho justo */
  if (/googleusercontent\.com|googleapis\.com/.test(u || '')) return String(u).replace(/maxWidthPx=\d+/, 'maxWidthPx=' + w).replace(/=s\d+(-w\d+)?(-h\d+)?$/, '=s' + w);
  /* Miniatura de Wikipedia ya hecha: se cambia el ancho */
  const th = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/thumb\/.+\/)\d+px-([^/]+)$/.exec(u || '');
  if (th) return th[1] + w + 'px-' + th[2];
  const x = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/(commons|[a-z]{2,3})\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/.exec(u || '');
  if (!x || /\.svg$/i.test(x[4])) return u;
  return `https://upload.wikimedia.org/wikipedia/${x[1]}/thumb/${x[2]}/${x[3]}/${x[4]}/${w}px-${x[4]}${/\.tiff?$/i.test(x[4]) ? '.jpg' : ''}`;
}
function urlMedio(m, w) {
  if (!m) return '';
  if (m.demo) return 'img/demo/' + m.demo + '.jpg';
  if (m.url) return fotoLigera(m.url, w);
  const k = m.mid || m.id || m.fid;
  if (S.imgs[k]) return S.imgs[k];
  if (!bajando[k]) {
    bajando[k] = (async () => {
      try {
        let b = await DB.get('med:' + k);
        if (!b && m.fid && Sync.activo()) { b = await bajarArchivo(m.fid); DB.set('med:' + k, b); }
        if (b) { S.imgs[k] = URL.createObjectURL(b); Nav.refrescar(); }
      } catch (e) { anotar('medio', e); setTimeout(() => { delete bajando[k]; }, 30000); }
    })();
  }
  return '';
}
async function blobMedio(m) {
  if (m.demo) return (await fetch('img/demo/' + m.demo + '.jpg')).blob();
  let b = await DB.get('med:' + (m.mid || m.id || m.fid));
  if (!b && m.fid) b = await bajarArchivo(m.fid);
  return b;
}
/* Guarda un archivo en el móvil y lo sube a Drive cuando se pueda */
const Subidas = {
  cola: [], corriendo: false,
  async guardar(blob, nombre) {
    const id = 'm' + uid();
    await DB.set('med:' + id, blob);
    S.imgs[id] = URL.createObjectURL(blob);
    if (Sync.activo()) { this.cola.push({ id, blob, nombre }); this.seguir(); }
    return id;
  },
  async seguir() {
    if (this.corriendo) return; this.corriendo = true;
    while (this.cola.length) {
      const x = this.cola[0];
      try {
        if (x.blob.size > 20 * 1024 * 1024) { this.cola.shift(); aviso('El archivo pasa de 20 MB: se queda solo en este móvil.'); continue; }
        const fid = await subirArchivo(x.blob, x.nombre);
        this.cola.shift();
        apuntarFid(x.id, fid);
      } catch (e) { anotar('subida', e); await espera(15000); if (!navigator.onLine) break; }
    }
    this.corriendo = false;
  }
};
/* Cuando un archivo termina de subir, se apunta su fid allí donde se usa */
function apuntarFid(mid, fid) {
  ['medios', 'docs', 'viajes', 'feedback'].forEach(col => lista(col).forEach(r => {
    if (r.mid === mid && !r.fid) poner(col, r.id, { fid }, { callado: true });
    if (r.portada && r.portada.id === mid && !r.portada.fid) poner(col, r.id, { portada: Object.assign({}, r.portada, { fid }) }, { callado: true });
    if (Array.isArray(r.fotos) && r.fotos.some(f => f.id === mid && !f.fid)) poner(col, r.id, { fotos: r.fotos.map(f => f.id === mid ? Object.assign({}, f, { fid }) : f) }, { callado: true });
  }));
}

/* Reduce una imagen en el móvil: lado mayor como mucho «max» píxeles */
function cargarImagen(file) {
  return new Promise((ok, ko) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => ok({ img, url }); img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('No puedo abrir esa imagen.')); }; img.src = url; });
}
async function reducir(file, max, calidad) {
  const { img, url } = await cargarImagen(file);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', calidad || 0.85));
}
function elegirArchivos(accept, multiple) {
  return new Promise(ok => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple;
    i.style.cssText = 'position:fixed;left:-100px;opacity:0'; document.body.appendChild(i);
    i.onchange = () => { ok(Array.from(i.files || [])); i.remove(); };
    i.click();
  });
}

/* ---------- indicador de conexión: una pastilla discreta que solo sale cuando algo no va */
const Red = {
  el: null,
  pintar() {
    if (!this.el) { this.el = document.createElement('div'); this.el.className = 'o-red o-vid o-fuera'; document.body.appendChild(this.el); }
    let txt = '';
    if (Sync.activo()) {
      if (!navigator.onLine) txt = 'Sin conexión · se guarda en el móvil';
      else if (!S.red.ok && S.red.error && S.red.error.code !== 'ocupado') txt = 'No llego al script · reintentando';
      else if (S.red.viejo) txt = 'Actualiza el script de Google';
    }
    if (txt) this.el.innerHTML = `<span class="o-punto" style="background:var(--mal);box-shadow:none;width:6px;height:6px"></span>${esc(txt)}`;
    this.el.classList.toggle('o-fuera', !txt);
  }
};
