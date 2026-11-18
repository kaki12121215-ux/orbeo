/* ORBEO · app · versión 1.0.12 · se genera con src/build.js a partir de src/app */
(function () {
'use strict';
/* ---- 00_base.js ---- */
/* ============================ BASE ============================
   Orbeo: viajes que se planean juntos. App web instalable (iPhone y ordenador).
   Los datos viven en el móvil y se sincronizan con un script de Google (Codigo.gs) dentro de una hoja. */
const VERSION = '1.0.12';
const MIN_SCRIPT = '1.0.0';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const espera = ms => new Promise(ok => setTimeout(ok, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ESCRITORIO = () => innerWidth >= 960;
function verNum(v) { return String(v || '0').split('.').map(Number).reduce((a, n) => a * 1000 + (n || 0), 0); }

/* ---------- registro (para el feedback y para comprobar) */
const REG = [];
function anotar(donde, e) {
  const m = e && e.message ? e.message : String(e);
  REG.push({ t: Date.now(), donde: donde, m: m.slice(0, 300) });
  if (REG.length > 120) REG.shift();
  try { console.warn('[orbeo]', donde, m); } catch (x) { }
}
window.addEventListener('error', e => anotar('error', e.message + ' @' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => anotar('promesa', e.reason));

/* ---------- almacenamiento local: IndexedDB y, si no hay, localStorage */
const DB = {
  db: null, modo: 'memoria', mem: {},
  abrir() {
    return new Promise(ok => {
      let hecho = false;
      const fin = m => { if (!hecho) { hecho = true; this.modo = m; ok(); } };
      setTimeout(() => fin(this.lsOk() ? 'local' : 'memoria'), 2000);
      try {
        const r = indexedDB.open('orbeo', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; fin('idb'); };
        r.onerror = () => fin(this.lsOk() ? 'local' : 'memoria');
      } catch (e) { fin(this.lsOk() ? 'local' : 'memoria'); }
    });
  },
  lsOk() { try { localStorage.setItem('orbeo-x', '1'); localStorage.removeItem('orbeo-x'); return true; } catch (e) { return false; } },
  tx(m, f) {
    return new Promise((ok, ko) => {
      try { const t = this.db.transaction('kv', m); const r = f(t.objectStore('kv')); t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error); } catch (e) { ko(e); }
    });
  },
  async get(k) {
    if (k in this.mem) return this.mem[k];
    try {
      if (this.modo === 'idb') return await this.tx('readonly', s => s.get(k));
      if (this.modo === 'local') { const v = localStorage.getItem('orbeo:' + k); return v ? JSON.parse(v) : undefined; }
    } catch (e) { anotar('leer ' + k, e); }
    return undefined;
  },
  async set(k, v) {
    if (!(v instanceof Blob)) this.mem[k] = v;
    try {
      if (this.modo === 'idb') await this.tx('readwrite', s => s.put(v, k));
      else if (this.modo === 'local' && !(v instanceof Blob)) localStorage.setItem('orbeo:' + k, JSON.stringify(v));
    } catch (e) { anotar('guardar ' + k, e); }
  },
  async del(k) {
    delete this.mem[k];
    try {
      if (this.modo === 'idb') await this.tx('readwrite', s => s.delete(k));
      else if (this.modo === 'local') localStorage.removeItem('orbeo:' + k);
    } catch (e) { anotar('borrar ' + k, e); }
  }
};

/* ---------- estado */
const S = {
  cfg: null,          /* { url, token, persona, rol, sid } · o { demo: true } */
  recs: {},           /* col › id › { f, t, rev, por } */
  seq: 0, sid: '', sv: '',
  cola: {},           /* 'col|id' › { id, col, f, t, v } */
  red: { ok: true, ultimo: 0, error: null, enviando: false },
  imgs: {},           /* id › url para <img> */
  pref: {},           /* ajustes de este móvil */
  tasas: null         /* cambio de moneda guardado */
};
let guardarT = null;
function guardarLocal(ya) {
  clearTimeout(guardarT);
  const f = () => { DB.set('datos', { recs: S.recs, seq: S.seq, sid: S.sid }); DB.set('cola', S.cola); };
  if (ya) f(); else guardarT = setTimeout(f, 250);
}
function guardarPref() { DB.set('pref', S.pref); }

/* ---------- registros */
function lista(col, filtro) {
  const o = S.recs[col] || {};
  return Object.keys(o).map(id => Object.assign({ id: id, _por: o[id].por }, o[id].f)).filter(x => !x._b && (!filtro || filtro(x)));
}
function dato(col, id) { const r = S.recs[col] && S.recs[col][id]; return r && !r.f._b ? Object.assign({ id: id, _por: r.por }, r.f) : null; }
function yo() { return S.cfg ? S.cfg.persona : ''; }
function miRol() { const p = dato('personas', yo()); return (p && p.rol) || (S.cfg && S.cfg.rol) || 'lector'; }
function puedoEditar() { return S.cfg && (S.cfg.demo || miRol() !== 'lector'); }
function soyAdmin() { return S.cfg && (S.cfg.demo || miRol() === 'admin'); }

/* Cambia campos de un registro al momento y deja el envío en la cola. */
function poner(col, id, campos, opts) {
  opts = opts || {};
  const ahora = Date.now();
  S.recs[col] = S.recs[col] || {};
  const r = S.recs[col][id] || (S.recs[col][id] = { f: {}, t: {}, rev: 0, por: yo() });
  const k = col + '|' + id;
  const op = S.cola[k] || (S.cola[k] = { id: id, col: col, f: {}, t: {}, v: 0 });
  Object.keys(campos).forEach(c => { r.f[c] = campos[c]; r.t[c] = ahora; op.f[c] = campos[c]; op.t[c] = ahora; });
  if (!r.por) r.por = yo();
  op.v++;
  if (S.cfg && S.cfg.demo) delete S.cola[k];
  guardarLocal();
  if (!opts.callado) Nav.refrescar();
  if (S.cfg && !S.cfg.demo) Sync.pronto();
  return id;
}
function nuevo(col, campos, opts) { const id = (col.slice(0, 2)) + uid(); poner(col, id, Object.assign({ creado: Date.now(), por: yo() }, campos), opts); return id; }
function borrar(col, id) { poner(col, id, { _b: 1 }); }
function actividad(viaje, txt) { if (viaje) nuevo('actividad', { viaje: viaje, txt: txt, cuando: Date.now() }, { callado: true }); }

/* ---------- llamadas al script */
function ErrR(code, msg) { const e = new Error(msg); e.code = code; e.orbeo = true; return e; }
async function api(a, extra, opts) {
  opts = opts || {};
  const url = opts.url || (S.cfg && S.cfg.url);
  if (!url) throw ErrR('config', S.cfg && S.cfg.demo ? 'En el viaje de ejemplo no hay script conectado. Conecta tu espacio en Ajustes.' : 'Este móvil no está conectado a ningún espacio.');
  const cuerpo = Object.assign({ a: a }, extra || {});
  if (!opts.sinToken && S.cfg && S.cfg.token) cuerpo.t = S.cfg.token;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), opts.ms || 40000);
  let txt = '';
  try {
    /* Sin cabeceras: así el navegador no hace la consulta previa (CORS) que Apps Script no admite. */
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(cuerpo), signal: ctl.signal, redirect: 'follow', cache: 'no-store' });
    txt = await r.text();
    if (!r.ok && !txt) throw ErrR('red', 'Google ha respondido con un error ' + r.status + '.');
  } catch (e) {
    if (e.orbeo) { anotar(a, e); throw e; }
    let err;
    if (e.name === 'AbortError') err = ErrR('tiempo', 'El script no ha respondido a tiempo. Vuelve a intentarlo en un momento.');
    else if (navigator.onLine === false) err = ErrR('sinred', 'Sin conexión. Se guardará al volver.');
    else err = ErrR('red', 'No consigo llegar al script. Revisa que la implementación tenga «Quién tiene acceso: Cualquier usuario» y que la dirección acabe en /exec.');
    anotar(a, err.message + ' [' + (e.message || e.name) + ']');
    throw err;
  } finally { clearTimeout(to); }
  let j;
  try { j = JSON.parse(txt); } catch (e) {
    const login = /accounts\.google|ServiceLogin|Iniciar sesi|Sign in/i.test(txt);
    const err = ErrR('html', login ? 'Google pide iniciar sesión: la implementación no tiene «Quién tiene acceso: Cualquier usuario».' : 'Google ha devuelto una página en vez de datos. Ejecuta «configurar» en el script, acepta los permisos y publica una versión nueva.');
    anotar(a, err.message);
    throw err;
  }
  if (j.sv) S.sv = j.sv;
  if (!j.ok) { const err = ErrR(j.code || 'script', j.error || 'El script ha dado un error.'); anotar(a, err.message); throw err; }
  return j;
}
function urlScript(txt) {
  const s = String(txt || '').trim();
  if (/\/dev(\?|$)/.test(s)) return { error: 'Esa es la dirección de pruebas (acaba en /dev). Copia la de la implementación, que acaba en /exec.' };
  const m = s.match(/script\.google\.com\/(?:a\/[^/]+\/)?macros\/s\/([A-Za-z0-9_-]{20,})\/exec/);
  if (m) return { url: s.split('?')[0].split('#')[0], id: m[1] };
  if (/^[A-Za-z0-9_-]{40,}$/.test(s)) return { url: 'https://script.google.com/macros/s/' + s + '/exec', id: s };
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(s)) return { url: s, id: s };
  return { error: 'No parece la dirección del script. Empieza por https://script.google.com/macros/s/ y acaba en /exec.' };
}
/* Invitación: ORBEO1-<base64 de {u, c, n}>. También va dentro del enlace: …/#inv=ORBEO1-… */
function crearPaquete(codigo) {
  const d = { u: S.cfg.url, c: codigo.replace('-', ''), n: (dato('espacio', 'espacio') || {}).nombre || '' };
  const m = d.u.match(/macros\/s\/([^/]+)\/exec/);
  if (m) d.u = m[1];
  return 'ORBEO1-' + btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function leerPaquete(txt) {
  const m = String(txt || '').replace(/\s+/g, '').match(/ORBEO1-([A-Za-z0-9_-]+)/);
  if (!m) return { error: 'No encuentro la invitación. Empieza por ORBEO1-. Cópiala entera y pégala otra vez.' };
  try {
    let b = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const d = JSON.parse(decodeURIComponent(escape(atob(b))));
    const u = urlScript(d.u);
    if (u.error) return u;
    return { url: u.url, codigo: String(d.c || ''), espacio: d.n || '' };
  } catch (e) { return { error: 'La invitación está incompleta. Cópiala entera y pégala otra vez.' }; }
}

/* ---------- fechas y horas
   Las horas del plan se guardan siempre en hora local del destino (dia «AAAA-MM-DD», hora «HH:MM»). */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const p2 = n => ('0' + n).slice(-2);
function fecha(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); }
function iso(d) { return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
function sumaDias(i, n) { const d = fecha(i); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
function difDias(a, b) { return Math.round((fecha(b) - fecha(a)) / 86400000); }
function diaSemana(i) { return DIAS[fecha(i).getUTCDay()]; }
function fechaLarga(i) { const d = fecha(i); return cap(DIAS[d.getUTCDay()]) + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; }
function fechaCorta(i) { const d = fecha(i); return d.getUTCDate() + ' ' + MES3[d.getUTCMonth()]; }
function rango(a, b) {
  if (!a) return '';
  const da = fecha(a), db = fecha(b || a);
  if (a === b || !b) return fechaCorta(a);
  if (da.getUTCMonth() === db.getUTCMonth()) return da.getUTCDate() + ' – ' + db.getUTCDate() + ' ' + MES3[db.getUTCMonth()];
  return fechaCorta(a) + ' – ' + fechaCorta(b);
}
function minutos(h) { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ''); return m ? +m[1] * 60 + +m[2] : null; }
function hhmm(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return p2(Math.floor(min / 60)) + ':' + p2(min % 60); }
const TZ_CASA = () => S.pref.tzCasa || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid');
/* Fecha y hora «de pared» en una zona: { dia, hora, min } */
function enZona(tz, t) {
  try {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(t || Date.now())).forEach(x => { p[x.type] = x.value; });
    const h = p.hour === '24' ? '00' : p.hour;
    return { dia: p.year + '-' + p.month + '-' + p.day, hora: h + ':' + p.minute, min: +h * 60 + +p.minute };
  } catch (e) { const d = new Date(t || Date.now()); return { dia: d.toISOString().slice(0, 10), hora: p2(d.getHours()) + ':' + p2(d.getMinutes()), min: d.getHours() * 60 + d.getMinutes() }; }
}
/* Minutos que la zona va por delante de UTC en ese momento */
function desfase(tz, t) {
  const w = enZona(tz, t || Date.now()); const [y, m, d] = w.dia.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d, Math.floor(w.min / 60), w.min % 60);
  return Math.round((utc - Math.floor((t || Date.now()) / 60000) * 60000) / 60000);
}
/* Pasa una hora de pared de una zona a otra (el mismo instante) */
function cambiarZona(dia, hora, de, a) {
  const [y, m, d] = dia.split('-').map(Number), mi = minutos(hora) || 0;
  let t = Date.UTC(y, m - 1, d, Math.floor(mi / 60), mi % 60) - desfase(de, Date.UTC(y, m - 1, d, 12)) * 60000;
  return enZona(a, t);
}
function nombreZona(tz) { const c = ciudadDeZona(tz); return c ? c.n : String(tz || '').split('/').pop().replace(/_/g, ' '); }
function difHoras(tzA, tzB) {
  const d = (desfase(tzA) - desfase(tzB)) / 60;
  if (!d) return 'Misma hora';
  const v = Math.abs(d) % 1 ? Math.abs(d).toFixed(1).replace('.', ',') : Math.abs(d);
  return (d > 0 ? '+' : '−') + v + ' h';
}

/* ---------- distancias y tiempos entre paradas (aproximados) */
function distKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, r = x => x * Math.PI / 180;
  const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function trayecto(a, b) {
  const km = distKm(a, b);
  if (km == null) return null;
  if (km < 1.8) return { modo: 'pie', min: Math.max(2, Math.round(km * 1.3 / 4.8 * 60)), km: km };
  if (km < 60) return { modo: 'transporte', min: Math.round(8 + km * 1.25 / 22 * 60), km: km };
  return { modo: 'tren', min: Math.round(20 + km / 180 * 60), km: km };
}
function duracion(min) { if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return h + ' h' + (m ? ' ' + m : ''); }

/* ---------- formato de números */
const nf = (v, dec) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec }).format(v);
function iniciales(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase(); }
const COLORES = ['#E8C9A0', '#B9C8B4', '#C7B8D8', '#E6B4A6', '#A9C4D6', '#D8CFA0', '#C9A9B5', '#9FC2B8'];
function avatar(p, s) { p = p || {}; const f = p.foto ? urlMedio(p.foto) : ''; return `<span class="o-av${f ? ' o-av-f' : ''}" style="background:${esc(p.color || '#D8D1C8')}${f ? ` url(${esc(f)}) center/cover` : ''};${s ? `width:${s}px;height:${s}px;font-size:${Math.round(s * .36)}px` : ''}">${f ? '' : esc(iniciales(p.nombre))}</span>`; }
function nombreDe(id) { const p = dato('personas', id); return p ? p.nombre.split(' ')[0] : 'Alguien'; }
function copiar(txt) {
  try { if (navigator.clipboard) return navigator.clipboard.writeText(txt).then(() => true, () => copiarViejo(txt)); } catch (e) { }
  return Promise.resolve(copiarViejo(txt));
}
function copiarViejo(txt) { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } t.remove(); return ok; }
function vibrar(ms) { try { navigator.vibrate && navigator.vibrate(ms || 8); } catch (e) { } }
/* Mantener pulsado no selecciona texto ni saca la lupa de Safari (salvo en campos para escribir) */
(function () {
  const campo = e => { const t = e.target && e.target.nodeType === 3 ? e.target.parentNode : e.target; return !!(t && t.closest && t.closest('input,textarea,[contenteditable]')); };
  document.addEventListener('selectstart', e => { if (!campo(e)) e.preventDefault(); });
  document.addEventListener('contextmenu', e => { if (!campo(e) && !(e.target.closest && e.target.closest('a[href]'))) e.preventDefault(); });
})();

/* ---- 01_sync.js ---- */
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

/* ---- 02_anim.js ---- */
/* ============================ MOVIMIENTO ============================
   Tres curvas (entrar, muelle, salir). Todo lo que se toca responde; nada aparece de golpe.
   Con «Reducir movimiento» todo lo que se desliza o crece pasa a ser un fundido corto. */
const CURVA = { entrar: 'cubic-bezier(.2,0,0,1)', muelle: 'cubic-bezier(.3,1.2,.4,1)', salir: 'cubic-bezier(.4,0,1,1)', heroe: 'cubic-bezier(.16,.8,.2,1)', circulo: 'cubic-bezier(.3,0,.1,1)', bajar: 'cubic-bezier(.4,0,.8,1)' };
const mqReducir = matchMedia('(prefers-reduced-motion: reduce)');
const reducido = () => mqReducir.matches;

const NEUTRO = /^(opacity:1|transform:none|filter:(none|blur\(0(px)?\))|scale:1|translate:none|rotate:none|boxShadow:none)$/;
/* Web Animations con limpieza: al terminar se fijan los estilos y se cancela (para no pisar estilos posteriores) */
function animar(el, kf, o) {
  if (!el || !el.animate) return Promise.resolve();
  o = Object.assign({ duration: 400, easing: CURVA.entrar, fill: 'both' }, o || {});
  if (reducido() && !o.siempre) {
    const ult = kf[kf.length - 1] || {};
    const fin = {}; if ('opacity' in ult) fin.opacity = ult.opacity;
    kf = [{ opacity: 'opacity' in (kf[0] || {}) ? kf[0].opacity : 1 }, Object.assign({ opacity: 1 }, fin)];
    o.duration = Math.min(o.duration, 150); o.delay = Math.min(o.delay || 0, 60);
  }
  delete o.siempre;
  const a = el.animate(kf, o);
  /* Al terminar se escribe a mano el último fotograma y se cancela. No se usa commitStyles: en Safari del iPhone
     a veces fija el primer fotograma y deja palabras, campos y letras invisibles. */
  const fin = Object.assign({}, kf[kf.length - 1] || {});
  delete fin.offset; delete fin.easing; delete fin.composite;
  const fija = o.fill === 'both' || o.fill === 'forwards';
  return a.finished.then(() => {
    try {
      if (fija) for (const k in fin) {
        const v = String(fin[k]);
        /* Un valor neutro se borra en vez de escribirse: así no queda una capa transformada que emborrona el texto */
        el.style[k] = NEUTRO.test(k + ':' + v) ? '' : v;
      }
    } catch (e) { }
    try { a.cancel(); } catch (e) { }
  }, () => { });
}
const Anim = {
  /* Entrada escalonada de los bloques de una pantalla: [data-e] = sube | pop | heroe | izq | der | foto */
  entrar(root, o) {
    o = o || {};
    const els = $$('[data-e]', root).filter(e => !e.closest('.o-oculto'));
    let i = 0;
    els.forEach(el => {
      const tipo = el.dataset.e; const n = Math.min(i++, 8);
      const d = (o.retraso || 0) + n * (o.paso || 60) + (+el.dataset.d || 0);
      if (tipo === 'pop') animar(el, [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d, easing: CURVA.muelle });
      else if (tipo === 'heroe') animar(el, [{ opacity: 0, transform: 'translateY(40px) scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: d, easing: CURVA.heroe });
      else if (tipo === 'foto') animar(el, [{ opacity: 0, transform: 'scale(1.12)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 1100, delay: d, easing: CURVA.heroe });
      else if (tipo === 'izq') animar(el, [{ opacity: 0, transform: 'translateX(-22px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d });
      else if (tipo === 'der') animar(el, [{ opacity: 0, transform: 'translateX(28px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: d });
      else if (tipo === 'titulo') Anim.letras(el, d);
      else if (tipo === 'linea') animar(el, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: d, easing: CURVA.entrar });
      else animar(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d });
    });
  },
  /* Títulos grandes: cada palabra sube desde detrás de una máscara */
  letras(el, d) {
    if (reducido()) return animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    if (!el.dataset.part) {
      el.dataset.part = '1';
      el.innerHTML = el.innerHTML.split(/(<br>|\s+)/).map(w => w === '<br>' ? w : /^\s+$/.test(w) ? ' ' : w ? `<span class="o-pal"><span>${w}</span></span>` : '').join('');
    }
    $$('.o-pal>span', el).forEach((s, i) => animar(s, [{ transform: 'translateY(105%) rotate(3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 820, delay: d + i * 70, easing: CURVA.heroe }));
  },
  /* Números que ruedan: el viejo sube y se va; el nuevo llega desde abajo */
  numero(el, nuevo) {
    if (!el) return;
    const viejo = el.dataset.v;
    nuevo = String(nuevo);
    if (viejo === nuevo) return;
    el.dataset.v = nuevo;
    if (viejo == null || reducido()) { el.textContent = nuevo; return; }
    const sube = parseFloat(String(nuevo).replace(/[^\d,-]/g, '').replace(',', '.')) >= parseFloat(String(viejo).replace(/[^\d,-]/g, '').replace(',', '.'));
    const w = el.getBoundingClientRect().width;
    el.style.minWidth = w + 'px';
    el.innerHTML = `<span class="o-rueda"><span class="o-rv">${esc(viejo)}</span><span class="o-rn">${esc(nuevo)}</span></span>`;
    const v = $('.o-rv', el), n = $('.o-rn', el);
    animar(v, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${sube ? -60 : 60}%)`, opacity: 0 }], { duration: 160, easing: CURVA.salir, siempre: true });
    animar(n, [{ transform: `translateY(${sube ? 60 : -60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, delay: 60, easing: CURVA.entrar, siempre: true }).then(() => { if (el.dataset.v === nuevo) { el.textContent = nuevo; el.style.minWidth = ''; } });
  },
  /* Cuenta hacia arriba desde 0 al entrar en pantalla */
  contar(el, hasta, ms) {
    if (!el) return;
    hasta = +hasta || 0;
    if (reducido() || hasta < 2) { el.textContent = hasta; return; }
    const t0 = performance.now(); ms = ms || 900;
    const f = t => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(hasta * e); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  },
  /* Elemento compartido: una copia de la imagen viaja de su sitio al destino */
  async vuela(desde, hacia, o) {
    o = o || {};
    if (!desde || !hacia || reducido()) return;
    /* La copia aterriza en la caja visible del destino (con sus esquinas redondeadas), no en la foto interior */
    const caja = o.caja ? (hacia.closest(o.caja) || hacia) : hacia;
    const a = desde.getBoundingClientRect(), b = caja.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const c = document.createElement('div');
    c.className = 'o-vuelo';
    const radio = x => { const s = getComputedStyle(x); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join(' '); };
    const radA = radio(desde), radB = radio(caja);
    c.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;border-radius:${radA};background-image:${o.imagen ? `url("${o.imagen}")` : getComputedStyle(desde).backgroundImage}`;
    document.body.appendChild(c);
    hacia.style.opacity = '0';
    /* Por si algo falla, el destino nunca se queda en blanco */
    const seguro = setTimeout(() => { hacia.style.opacity = ''; }, (o.ms || 700) + 400);
    await animar(c, [
      { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: radA },
      { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: radB }
    ], { duration: o.ms || 700, easing: CURVA.entrar, fill: 'forwards' });
    clearTimeout(seguro);
    hacia.style.opacity = '';
    animar(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, siempre: true }).then(() => c.remove());
  },
  /* Revela un elemento con un círculo que crece desde un punto */
  circulo(el, x, y, ms) {
    if (reducido()) return animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    return animar(el, [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }], { duration: ms || 760, easing: CURVA.circulo });
  },
  /* Píldora que se desliza entre opciones (pestañas, días, filtros) */
  pildora(cont, el, ms) {
    if (!cont || !el) return;
    const p = $('.o-pild', cont); if (!p) return;
    const a = cont.getBoundingClientRect(), b = el.getBoundingClientRect();
    const x = b.left - a.left + cont.scrollLeft, w = b.width;
    if (!p.dataset.ok || reducido()) { p.style.transition = 'none'; p.style.transform = `translateX(${x}px)`; p.style.width = w + 'px'; p.offsetWidth; p.style.transition = ''; p.dataset.ok = '1'; return; }
    p.style.transitionDuration = (ms || 420) + 'ms';
    p.style.transform = `translateX(${x}px)`; p.style.width = w + 'px';
  },
  /* Coloca las píldoras de una pantalla recién montada (sin animar) y centra la opción elegida */
  pildoras(root) {
    $$('.o-pild', root).forEach(p => {
      const cont = p.parentNode, on = Array.from(cont.children).find(x => x.classList.contains('o-on'));
      if (!on) return;
      p.dataset.ok = '';
      if (cont.scrollWidth > cont.clientWidth + 4) cont.scrollLeft = Math.max(0, on.offsetLeft - cont.clientWidth / 2 + on.offsetWidth / 2);
      Anim.pildora(cont, on);
    });
  },
  /* Destello en el sitio donde se ha tocado (para acciones importantes) */
  onda(el, ev) {
    if (reducido() || !el) return;
    const r = el.getBoundingClientRect();
    const x = (ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2) - r.left, y = (ev && ev.clientY != null ? ev.clientY : r.top + r.height / 2) - r.top;
    const o = document.createElement('span'); o.className = 'o-onda';
    const s = Math.max(r.width, r.height) * 2.2;
    o.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
    el.appendChild(o);
    animar(o, [{ transform: 'scale(0)', opacity: .35 }, { transform: 'scale(1)', opacity: 0 }], { duration: 650, easing: CURVA.entrar }).then(() => o.remove());
  },
  /* Sacude suavemente (campo con error) */
  no(el) { animar(el, [{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }); vibrar(20); },
  /* Lo que se va: escala y se funde */
  fuera(el, ms) { return animar(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: ms || 220, easing: CURVA.salir }); },
  /* Salto del favorito o de una casilla */
  salto(el) { animar(el, [{ transform: 'scale(1)' }, { transform: 'scale(.8)', offset: .25 }, { transform: 'scale(1.22)', offset: .6 }, { transform: 'scale(1)' }], { duration: 460, easing: 'ease-out' }); }
};

/* ---------- Respuesta al toque en todo lo que lleva .t
   Pulsar: escala 0,95 en 120 ms. Soltar: vuelve con muelle en 340 ms. La acción va al soltar (click). */
(function () {
  let actual = null, x0 = 0, y0 = 0;
  const soltar = () => { if (actual) { actual.classList.remove('pres'); actual = null; } };
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('.t');
    if (!t || t.disabled) return;
    actual = t; x0 = e.clientX; y0 = e.clientY;
    t.classList.add('pres');
  }, { passive: true });
  document.addEventListener('pointermove', e => { if (actual && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) soltar(); }, { passive: true });
  document.addEventListener('pointerup', soltar, { passive: true });
  document.addEventListener('pointercancel', soltar, { passive: true });
  document.addEventListener('scroll', soltar, { passive: true, capture: true });
})();

/* ---------- Iconos: un solo juego de línea, trazo redondo */
const ICONOS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  map: '<path d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  idea: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  doc: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19V5a1.5 1.5 0 011-1.5z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h4"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M16 14.1c2.4.1 4 1.7 4.5 4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10.5 21l2-6.5-2.5-2.5 1-4.5 3 2.5 3 1M10 7.5l-3 2-1 3.5M12.5 14.5l2.5 2.5 1 4"/>',
  bus: '<rect x="5" y="3.5" width="14" height="14" rx="3"/><path d="M5 11h14M8 17.5V20M16 17.5V20"/><circle cx="8.5" cy="14.3" r=".6"/><circle cx="15.5" cy="14.3" r=".6"/>',
  train: '<rect x="6" y="3.5" width="12" height="13" rx="3.5"/><path d="M6 10.5h12M9 20l1.5-3.5M15 20l-1.5-3.5"/><circle cx="9.5" cy="13.5" r=".6"/><circle cx="14.5" cy="13.5" r=".6"/>',
  plane: '<path d="M10.5 13.5L4 11l1.2-1.4 7 .9 4.3-4.6c.8-.8 2.2-.9 2.8-.3.6.6.5 2-.3 2.8l-4.6 4.3.9 7-1.4 1.2-2.5-6.5-3.2 3 .2 2.3-1.1 1.1-1.4-3.4-3.4-1.4 1.1-1.1 2.3.2z"/>',
  bed: '<path d="M3.5 18.5v-11M3.5 14.5h17v4M20.5 14.5v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11.3" r="1.8"/>',
  food: '<path d="M6.5 3.5v6a2 2 0 002 2v9M10.5 3.5v6a2 2 0 01-2 2M8.5 3.5v5M16.5 20.5v-17c-2 1-3 3.5-3 6.5 0 2 1 3 3 3"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2a2.5 2.5 0 000-5z"/><path d="M14 6v12" stroke-dasharray="1.6 2.2"/>',
  car: '<path d="M5 16.5V12l1.8-4.5A2 2 0 018.7 6h6.6a2 2 0 011.9 1.5L19 12v4.5M5 12h14"/><rect x="4" y="12" width="16" height="5" rx="1.5"/><path d="M6.5 17v2M17.5 17v2"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z"/><circle cx="12" cy="12.8" r="3.3"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  share: '<path d="M12 15V3.5M8 7.5l4-4 4 4M6.5 11H6a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 006 20h12a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0018 11h-.5"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  more: '<circle cx="5.5" cy="12" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="18.5" cy="12" r=".9"/>',
  edit: '<path d="M4.5 19.5l.8-3.7L15.7 5.4a1.8 1.8 0 012.6 0l.3.3a1.8 1.8 0 010 2.6L8.2 18.7z"/><path d="M13.5 7.5l3 3"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V9M10 13h4"/>',
  undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 010 11h-3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5l1-12.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5l1.6 1-1.8 3.2-1.8-.6a7.5 7.5 0 01-2.3 1.4l-.3 1.9h-3.6l-.3-1.9a7.5 7.5 0 01-2.3-1.4l-1.8.6L4.9 14.5l1.6-1a7.6 7.6 0 010-3l-1.6-1 1.8-3.2 1.8.6a7.5 7.5 0 012.3-1.4l.3-1.9h3.6l.3 1.9a7.5 7.5 0 012.3 1.4l1.8-.6 1.8 3.2-1.6 1a7.6 7.6 0 010 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 019.5 4.5a7.5 7.5 0 1010 10z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 000-17z" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-4.5-4.5-8 8.5"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="3"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
  film: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.3 4.3 0 0112 6.6a4.3 4.3 0 017.5 2.9c0 5.4-7.5 10-7.5 10z"/>',
  spark: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  swap: '<path d="M7 4.5v15M3.5 8L7 4.5 10.5 8M17 19.5v-15M13.5 16l3.5 3.5 3.5-3.5"/>',
  paste: '<rect x="5.5" y="5" width="13" height="16" rx="2.5"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
  out: '<path d="M14 4.5h4A1.5 1.5 0 0119.5 6v12a1.5 1.5 0 01-1.5 1.5h-4M10 16.5L5.5 12 10 7.5M5.5 12H15"/>',
  ext: '<path d="M13.5 4.5h6v6M19.5 4.5L11 13M17.5 14v4A1.5 1.5 0 0116 19.5H6A1.5 1.5 0 014.5 18V8A1.5 1.5 0 016 6.5h4"/>',
  key: '<circle cx="8" cy="15" r="3.8"/><path d="M10.8 12.3L19.5 3.5M16 7l2.5 2.5M14 9l2 2"/>',
  bubble: '<path d="M5 18.5l1-3.5A7.5 7.5 0 1112 19.5a7.6 7.6 0 01-3.5-.9z"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
  tiktok: '<path d="M14 3.5v11.2a3.8 3.8 0 11-3.8-3.8"/><path d="M14 3.5c.4 2.6 2.2 4.3 5 4.5"/>',
  insta: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r=".7"/>',
  gmaps: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><path d="M9.7 10h4.6a2.3 2.3 0 11-.7-1.6"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15zM10 20.5h4"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
  tag: '<path d="M3.5 12.2V4.8c0-.7.6-1.3 1.3-1.3h7.4l8.3 8.3a1.3 1.3 0 010 1.8l-7.4 7.4a1.3 1.3 0 01-1.8 0z"/><circle cx="8.2" cy="8.2" r="1.4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 016 0V8"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r=".9"/><circle cx="4.6" cy="12" r=".9"/><circle cx="4.6" cy="17.5" r=".9"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6"/>',
  tree: '<path d="M12 3l6 8h-3.5l4.5 6H5l4.5-6H6z"/><path d="M12 17v4"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 0113-5.1l2 2M19.5 4v5h-5M19.5 12a7.5 7.5 0 01-13 5.1l-2-2M4.5 20v-5h5"/>'
};
function ic(n, s, w) { return `<svg class="ic" width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`; }

/* El logo: un planeta claro con el mapa que asoma por la izquierda y una ruta coral por su borde con tres paradas */
function logo(s, o) {
  o = o || {};
  const k = 100 / 1024, cx = -193 * k, cy = 942 * k, R = 1020 * k, P = a => [cx + R * Math.cos(a * Math.PI / 180), cy + R * Math.sin(a * Math.PI / 180)];
  const p0 = P(-110), p1 = P(10), pts = [-52.5, -28.5, -4.5].map(P), f = n => n.toFixed(2);
  return `<svg class="o-logo${o.clase ? ' ' + o.clase : ''}" width="${s}" height="${s}" viewBox="0 0 100 100" aria-label="Orbeo">
  <defs><linearGradient id="lg-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6DFD4"/><stop offset="1" stop-color="#DAD1C4"/></linearGradient>
  <clipPath id="lg-c"><rect width="100" height="100" rx="22.5"/></clipPath></defs>
  <g clip-path="url(#lg-c)"><rect class="o-lg-fondo" width="100" height="100" fill="url(#lg-f)"/>
  <image class="o-lg-orbe" href="icons/logo-planeta.webp" width="100" height="100"/>
  <path class="o-lg-ruta" d="M${f(p0[0])} ${f(p0[1])} A${f(R)} ${f(R)} 0 0 1 ${f(p1[0])} ${f(p1[1])}" fill="none" stroke="#D9775A" stroke-width="2.73" stroke-linecap="round" pathLength="1"/>
  ${pts.map(p => `<circle class="o-lg-b" cx="${f(p[0])}" cy="${f(p[1])}" r="7.62" fill="#D9775A"/>`).join('')}</g>
  </svg>`;
}

/* ============================ REPINTAR SIN PARPADEOS ============================
   Cambia solo lo que es distinto entre lo que hay en pantalla y el HTML nuevo. Las fotos, los botones y el
   scroll se quedan donde están: nada desaparece para volver a aparecer. Los hijos con data-id se emparejan
   por su id; los que llevan data-fijo (mapas) no se tocan. */
function morph(raiz, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphHijos(raiz, t.content);
}
/* La clave lleva la primera clase: un evento del calendario no se reutiliza como fila del itinerario (se llevaría su altura) */
function claseNodo(n) { return n.nodeType === 1 && n.classList ? (n.classList[0] || '') : ''; }
function claveNodo(n) { return n.nodeType === 1 ? (n.id ? '#' + n.id : n.dataset && n.dataset.id ? n.tagName + ':' + claseNodo(n) + ':' + n.dataset.id + ':' + (n.dataset.a || '') : null) : null; }
function morphHijos(a, b) {
  const viejos = Array.from(a.childNodes), nuevos = Array.from(b.childNodes);
  const porClave = {};
  viejos.forEach(n => { const k = claveNodo(n); if (k && !porClave[k]) porClave[k] = n; });
  const usados = new Set();
  let i = 0;
  const orden = [];
  nuevos.forEach(nb => {
    const k = claveNodo(nb);
    let na = null;
    if (k && porClave[k] && !usados.has(porClave[k])) na = porClave[k];
    else if (!k) {
      while (i < viejos.length && (usados.has(viejos[i]) || claveNodo(viejos[i]))) i++;
      const c = viejos[i];
      if (c && c.nodeType === nb.nodeType && (c.nodeType !== 1 || (c.tagName === nb.tagName && claseNodo(c) === claseNodo(nb)))) { na = c; i++; }
    }
    if (na) { usados.add(na); morphNodo(na, nb); orden.push(na); }
    else orden.push(nb);
  });
  viejos.forEach(n => { if (!usados.has(n)) a.removeChild(n); });
  orden.forEach((n, j) => { if (a.childNodes[j] !== n) a.insertBefore(n, a.childNodes[j] || null); });
}
function morphNodo(a, b) {
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1) return;
  if (a.hasAttribute('data-fijo') && b.hasAttribute('data-fijo')) return;
  Array.from(a.attributes).forEach(at => { if (at.name !== 'style' && !b.hasAttribute(at.name)) a.removeAttribute(at.name); });
  Array.from(b.attributes).forEach(at => { if (at.name !== 'style' && a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); });
  /* el estilo del HTML solo se cambia si ha cambiado el HTML (no se pisa lo que deja una animación) */
  const st = b.getAttribute('style') || '';
  if (a._st === undefined) a._st = st ? (a.getAttribute('style') || '') : '';
  if (st !== a._st) { a.setAttribute('style', st); a._st = st; }
  if (a.tagName === 'INPUT') { const v = b.getAttribute('value') || ''; if (document.activeElement !== a && a.value !== v) a.value = v; return; }
  if (a.tagName === 'TEXTAREA') { if (document.activeElement !== a && a.value !== b.textContent) a.value = b.textContent; return; }
  if (a.dataset.part && a.dataset.e === 'titulo') {
    if (a.textContent.replace(/\s+/g, ' ').trim() === b.textContent.replace(/\s+/g, ' ').trim()) return;
    delete a.dataset.part; a.innerHTML = b.innerHTML; return;
  }
  morphHijos(a, b);
}

/* ---------- Fotos ya decodificadas antes de enseñarlas (no llegan tarde ni parpadean) */
const Fotos = {
  hechas: {}, guardadas: [],
  una(u) {
    if (!u) return Promise.resolve();
    if (this.hechas[u]) return this.hechas[u];
    const im = new Image(); im.decoding = 'async'; im.src = u;
    const pr = (im.decode ? im.decode() : new Promise(r => { im.onload = r; im.onerror = r; })).catch(() => { });
    this.hechas[u] = pr; this.guardadas.push(im); if (this.guardadas.length > 160) this.guardadas.shift();
    return pr;
  },
  /* Espera como mucho «ms»: si la red va lenta, no se bloquea la navegación */
  varias(us, ms) { const t = Promise.all((us || []).filter(Boolean).map(u => this.una(u))); return ms ? Promise.race([t, espera(ms)]) : t; }
};

/* ---------- Lo que va fijo en pantalla (barra de pestañas, botones de arriba) mientras la pantalla se mueve.
   Dentro de una pantalla que se mueve, «fixed» deja de ser fijo: se pasa un momento a «absolute» en su sitio. */
function fijar(el) {
  if (!el) return;
  const er = el.getBoundingClientRect();
  $$('.o-tabs,.o-pd-bar,.o-pd-mcab', el).forEach(f => {
    if (f.dataset.fijado) return;
    const r = f.getBoundingClientRect();
    f.dataset.fijado = '1';
    f.style.position = 'absolute'; f.style.top = (el.scrollTop + r.top - er.top) + 'px'; f.style.bottom = 'auto';
  });
}
function soltarFijos(el) {
  if (!el) return;
  $$('[data-fijado]', el).forEach(f => { delete f.dataset.fijado; f.style.position = ''; f.style.top = ''; f.style.bottom = ''; });
}

/* ---------- Listas que cambian (filtros): lo que se queda se desliza a su sitio nuevo, lo que se va se encoge
   y lo nuevo entra. Nada se queda en blanco. */
function cambiarLista(cont, html, sel) {
  const antes = {};
  const t = document.createElement('template'); t.innerHTML = html;
  const quedan = {}; Array.from(t.content.querySelectorAll(sel)).forEach(x => { quedan[x.dataset.id] = 1; });
  const cr = cont.getBoundingClientRect();
  const fuera = [];
  $$(sel, cont).forEach(x => {
    const r = x.getBoundingClientRect(); antes[x.dataset.id] = r;
    if (!quedan[x.dataset.id]) {
      const c = x.cloneNode(true);
      c.style.cssText += `;position:absolute;left:${r.left - cr.left}px;top:${r.top - cr.top}px;width:${r.width}px;margin:0;pointer-events:none;z-index:0`;
      fuera.push(c);
    }
  });
  morph(cont, html);
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
  fuera.forEach(c => { cont.appendChild(c); animar(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 240, easing: CURVA.salir, siempre: true }).then(() => { if (c.parentNode) c.parentNode.removeChild(c); }); });
  let n = 0;
  $$(sel, cont).forEach(x => {
    if (fuera.indexOf(x) >= 0) return;
    const a = antes[x.dataset.id], b = x.getBoundingClientRect();
    if (a) { const dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) animar(x, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 480, easing: CURVA.entrar }); }
    else animar(x, [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 120 + Math.min(n++, 6) * 50, easing: CURVA.entrar });
  });
}

/* ---- 03_nav.js ---- */
/* ============================ NAVEGACIÓN ============================
   Una pila de pantallas. Al avanzar, la nueva entra desde la derecha y la de debajo se retira un poco;
   al volver (botón o deslizando desde el borde izquierdo), al revés. Las hojas suben desde abajo y
   la pantalla de detrás se encoge como una tarjeta. */
const PANT = {};     /* id › { render(p, el), alEntrar(el, p, primera), acciones, clase } */
const ACC = {};      /* acciones comunes a todas las pantallas */

const Nav = {
  pila: [], refT: null, ocupado: false,
  actual() { return this.pila[this.pila.length - 1]; },
  crear(id, p) {
    const def = PANT[id];
    const el = document.createElement('section');
    el.className = 'o-pant' + (def.clase ? ' ' + def.clase : '');
    el.dataset.p = id;
    const pa = { id, p: p || {}, el, def };
    this.pintar(pa, true);
    el.addEventListener('click', e => this.click(e, pa));
    el.addEventListener('scroll', () => def.alDeslizar && def.alDeslizar(el, pa), { passive: true });
    return pa;
  },
  pintar(pa, primera) {
    const html = pa.def.render(pa.p, pa.el, pa);
    /* Al repintar con datos nuevos solo cambia lo distinto: ni parpadean las fotos ni salta el scroll */
    if (!primera && pa.el.firstChild) morph(pa.el, html); else pa.el.innerHTML = html;
    if (pa.def.alPintar) pa.def.alPintar(pa.el, pa.p, primera, pa);
  },
  click(e, pa) {
    const t = e.target.closest('[data-a]');
    if (!t || !pa.el.contains(t) || t.classList.contains('o-des')) return;
    const a = t.dataset.a;
    const f = (pa.def.acciones && pa.def.acciones[a]) || ACC[a];
    if (f) { e.preventDefault(); f(t, e, pa.p, pa); }
  },
  async ir(id, p, o) {
    o = o || {};
    if (this.ocupado) return;
    const vieja = this.actual();
    /* Dos toques seguidos no abren dos veces la misma pantalla */
    if (vieja && vieja.id === id && JSON.stringify(vieja.p.id) === JSON.stringify((p || {}).id)) return;
    this.ocupado = true;
    this.limpiar();
    const nueva = this.crear(id, p);
    /* Las fotos de arriba se preparan antes de enseñar la pantalla (como mucho 0,35 s) */
    const urls = $$('[style*="background-image"]', nueva.el).slice(0, 8).map(x => (x.getAttribute('style').match(/url\(['"]?([^'")]+)/) || [])[1]);
    if (o.vuela && o.vuela.imagen) urls.unshift(o.vuela.imagen);
    await Fotos.varias(urls, 350);
    nueva.el.style.zIndex = this.pila.length + 2;
    $('#app').appendChild(nueva.el);
    Anim.pildoras(nueva.el);
    this.pila.push(nueva);
    try { history.pushState({ n: this.pila.length }, ''); } catch (e) { }
    document.body.classList.add('o-moviendo');
    if (vieja) fijar(vieja.el);
    const ent = nueva.def.alEntrar ? () => nueva.def.alEntrar(nueva.el, nueva.p, nueva) : null;
    if (o.vuela) {
      /* La foto tocada viaja recta hasta su sitio y la pantalla nueva aparece debajo, sin círculos ni giros */
      const dest = $(o.vuela.hacia, nueva.el);
      if (vieja) animar(vieja.el, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.96)', opacity: .6 }], { duration: 560, easing: CURVA.entrar });
      const pr = animar(nueva.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
      Anim.vuela(o.vuela.desde, dest, { ms: 620, imagen: o.vuela.imagen, caja: o.vuela.caja });
      Anim.entrar(nueva.el, { retraso: 260, paso: 45 });
      ent && ent();
      await Promise.all([pr, espera(620)]);
      if (vieja) vieja.el.style.opacity = '';
    } else if (o.circulo) {
      if (vieja) animar(vieja.el, [{ transform: 'none' }, { transform: 'scale(.94)' }], { duration: 760, easing: CURVA.entrar });
      const pr = Anim.circulo(nueva.el, o.circulo.x, o.circulo.y, 760);
      Anim.entrar(nueva.el, { retraso: 330, paso: 45 });
      ent && ent();
      await pr;
    } else {
      if (vieja) { this.sombra(vieja.el, true); animar(vieja.el, [{ transform: 'none' }, { transform: 'translateX(-28%)' }], { duration: 600, easing: CURVA.entrar }); }
      const pr = animar(nueva.el, [{ transform: 'translateX(100%)', boxShadow: '0 0 0 rgba(0,0,0,0)' }, { transform: 'none', boxShadow: '-20px 0 50px rgba(0,0,0,.12)' }], { duration: 600, easing: CURVA.entrar });
      Anim.entrar(nueva.el, { retraso: 140 });
      ent && ent();
      await pr;
    }
    nueva.el.style.boxShadow = ''; nueva.el.style.clipPath = ''; nueva.el.style.opacity = '';
    if (vieja) { vieja.el.classList.add('o-detras'); vieja.el.style.visibility = 'hidden'; }
    document.body.classList.remove('o-moviendo');
    this.ocupado = false;
    Sync.programar();
  },
  /* Quita del documento cualquier pantalla que ya no esté en la pila (para que nunca asome una vieja) */
  limpiar() {
    const vivas = new Set(this.pila.map(x => x.el));
    $$('#app > .o-pant').forEach(el => { if (!vivas.has(el)) el.parentNode.removeChild(el); });
  },
  sombra(el, on) {
    let s = $('.o-somb', el);
    if (on) { if (!s) { s = document.createElement('div'); s.className = 'o-somb'; el.appendChild(s); } animar(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 }); }
    else if (s) animar(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }).then(() => s.remove());
  },
  atras() { if (this.pila.length > 1) { try { history.back(); } catch (e) { this.quitar(); } } },
  async quitar(desdeGesto) {
    if (this.pila.length < 2 || this.ocupado) return;
    this.ocupado = true;
    const vieja = this.pila.pop(), debajo = this.actual();
    debajo.el.classList.remove('o-detras'); debajo.el.style.visibility = '';
    if (vieja.def.alSalir) vieja.def.alSalir(vieja.el, vieja.p);
    document.body.classList.add('o-moviendo');
    if (this.refPend) { this.refPend = false; this.pintar(debajo, false); }
    const x = desdeGesto ? desdeGesto.x : 0;
    fijar(vieja.el); fijar(debajo.el);
    debajo.el.style.opacity = '';
    this.sombra(debajo.el, false);
    animar(debajo.el, [{ transform: desdeGesto ? `translateX(${-28 + x / innerWidth * 28}%)` : (debajo.el.style.transform.indexOf('scale') >= 0 ? 'scale(.94)' : 'translateX(-28%)') }, { transform: 'none' }], { duration: 420, easing: CURVA.entrar });
    await animar(vieja.el, [{ transform: `translateX(${x}px)` }, { transform: 'translateX(100%)' }], { duration: desdeGesto ? 300 : 420, easing: desdeGesto ? CURVA.entrar : 'cubic-bezier(.4,0,.2,1)' });
    vieja.el.remove();
    debajo.el.style.transform = '';
    soltarFijos(debajo.el);
    this.limpiar();
    document.body.classList.remove('o-moviendo');
    this.ocupado = false;
    if (debajo.def.alVolver) debajo.def.alVolver(debajo.el, debajo.p, debajo);
    Sync.programar();
  },
  async raiz(id, p) {
    Capa.cerrarTodo();
    const viejas = this.pila.slice();
    this.pila = [];
    const n = this.crear(id, p);
    n.el.style.zIndex = 2;
    $('#app').appendChild(n.el);
    Anim.pildoras(n.el);
    this.pila.push(n);
    try { history.replaceState({ n: 1 }, ''); } catch (e) { }
    viejas.forEach(v => animar(v.el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 360, easing: CURVA.salir }).then(() => v.el.remove()));
    animar(n.el, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: viejas.length ? 120 : 0 });
    Anim.entrar(n.el, { retraso: 160 });
    if (n.def.alEntrar) n.def.alEntrar(n.el, n.p, n);
    Sync.programar();
  },
  /* Vuelve a pintar la pantalla de arriba con datos nuevos (sin animaciones de entrada) */
  refrescar() {
    clearTimeout(this.refT);
    this.refT = setTimeout(() => {
      const pa = this.actual(); if (!pa) return;
      Capa.refrescar();
      const foco = document.activeElement;
      if (foco && pa.el.contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) { this.refPend = true; return; }
      if (this.ocupado) { this.refPend = true; return; }
      const st = pa.el.scrollTop;
      const sub = pa.def.scrollInterno ? pa.def.scrollInterno(pa.el) : null;
      this.pintar(pa, false);
      pa.el.scrollTop = st;
      if (sub && pa.def.restaurarScroll) pa.def.restaurarScroll(pa.el, sub);
      this.pila.slice(0, -1).forEach(x => { x.sucia = true; });
    }, 60);
  }
};
window.addEventListener('popstate', () => { if (Capa.abiertas.length) { Capa.cerrar(); try { history.pushState({ n: Nav.pila.length }, ''); } catch (e) { } return; } Nav.quitar(); });
ACC.atras = () => Nav.atras();

/* ---------- Volver deslizando desde el borde izquierdo */
(function () {
  let g = null;
  document.addEventListener('touchstart', e => {
    if (Nav.pila.length < 2 || Nav.ocupado || Capa.abiertas.length) return;
    const t = e.touches[0];
    if (t.clientX > 26) return;
    g = { x0: t.clientX, y0: t.clientY, x: 0, t0: Date.now(), on: false, arr: Nav.actual(), deb: Nav.pila[Nav.pila.length - 2] };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.on) { if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { g = null; return; } if (dx < 8) return; g.on = true; Nav.limpiar(); Nav.pila.forEach(x => { if (x !== g.arr && x !== g.deb) x.el.style.visibility = 'hidden'; }); fijar(g.arr.el); fijar(g.deb.el); g.deb.el.classList.remove('o-detras'); g.deb.el.style.visibility = ''; g.deb.el.style.opacity = ''; document.body.classList.add('o-moviendo'); }
    g.x = Math.max(0, dx);
    g.arr.el.style.transform = `translateX(${g.x}px)`;
    g.arr.el.style.boxShadow = '-20px 0 50px rgba(0,0,0,.12)';
    g.deb.el.style.transform = `translateX(${-28 + g.x / innerWidth * 28}%)`;
    const s = $('.o-somb', g.deb.el); if (s) s.style.opacity = 1 - g.x / innerWidth;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!g) return;
    const x = g, v = x.x / Math.max(1, Date.now() - x.t0);
    g = null;
    if (!x.on) return;
    if (x.x > innerWidth * .33 || v > .55) { x.arr.el.style.transform = ''; x.deb.el.style.transform = ''; history.back(); Nav.gesto = { x: x.x }; }
    else {
      animar(x.arr.el, [{ transform: `translateX(${x.x}px)` }, { transform: 'none' }], { duration: 300 }).then(() => { x.arr.el.style.boxShadow = ''; soltarFijos(x.arr.el); });
      animar(x.deb.el, [{ transform: x.deb.el.style.transform }, { transform: 'translateX(-28%)' }], { duration: 300 }).then(() => { x.deb.el.classList.add('o-detras'); x.deb.el.style.visibility = 'hidden'; document.body.classList.remove('o-moviendo'); });
      const s = $('.o-somb', x.deb.el); if (s) s.style.opacity = 1;
    }
  });
  /* El gesto usa la misma salida que el botón, pero desde donde está el dedo */
  const q = Nav.quitar.bind(Nav);
  Nav.quitar = function () { const gg = Nav.gesto; Nav.gesto = null; return q(gg); };
})();

/* ============================ CAPAS: hojas, menús, avisos ============================ */
const Capa = {
  abiertas: [],
  detras(on) {
    const app = $('#app');
    const n = this.abiertas.filter(c => c.tipo === 'hoja').length;
    app.classList.toggle('o-encogida', n > 0 && !ESCRITORIO());
    this.abiertas.forEach((c, i) => { if (c.tipo === 'hoja') c.el.classList.toggle('o-debajo', i < this.abiertas.length - 1); });
  },
  /* Hoja que sube desde abajo. o: { html(), clase, alAbrir(el), acciones, alCerrar, ancho } */
  hoja(o) {
    const c = { tipo: 'hoja', o };
    const el = document.createElement('div');
    el.className = 'o-capa';
    el.innerHTML = `<div class="o-velo"></div><div class="o-hoja ${o.clase || ''}" role="dialog"><div class="o-asa"><span></span></div><div class="o-hoja-c">${typeof o.html === 'function' ? o.html() : o.html}</div></div>`;
    c.el = el; c.hoja = $('.o-hoja', el);
    $('#capas').appendChild(el);
    this.abiertas.push(c);
    this.detras();
    animar($('.o-velo', el), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    animar(c.hoja, [{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 560, easing: CURVA.entrar });
    Anim.entrar(c.hoja, { retraso: 90, paso: 28 });
    $('.o-velo', el).addEventListener('click', () => { if (o.cerrable !== false) this.cerrar(c); });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-a]'); if (!t || t.classList.contains('o-des')) return;
      const a = t.dataset.a;
      if (a === 'cerrar') { e.preventDefault(); this.cerrar(c); return; }
      const f = (o.acciones && o.acciones[a]) || ACC[a];
      if (f) { e.preventDefault(); f(t, e, c); }
    });
    this.arrastre(c);
    if (o.alAbrir) o.alAbrir(c.hoja, c);
    c.cerrar = (forzar) => this.cerrar(c, 0, forzar === true);
    c.repintar = () => { morph($('.o-hoja-c', el), typeof o.html === 'function' ? o.html() : o.html); if (o.alAbrir) o.alAbrir(c.hoja, c, true); };
    return c;
  },
  arrastre(c) {
    let g = null;
    const zona = c.hoja;
    zona.addEventListener('touchstart', e => {
      const sc = e.target.closest('.o-hoja-c');
      if (sc && sc.scrollTop > 0 && !e.target.closest('.o-asa,.o-hcab')) return;
      if (e.target.closest('input,textarea,.o-nodrag')) return;
      g = { y0: e.touches[0].clientY, y: 0, t0: Date.now(), on: false };
    }, { passive: true });
    zona.addEventListener('touchmove', e => {
      if (!g) return;
      const dy = e.touches[0].clientY - g.y0;
      if (!g.on && dy < 6) return;
      g.on = true; g.y = Math.max(0, dy);
      c.hoja.style.transform = `translateY(${g.y}px)`;
      $('.o-velo', c.el).style.opacity = Math.max(0, 1 - g.y / 500);
    }, { passive: true });
    zona.addEventListener('touchend', () => {
      if (!g || !g.on) { g = null; return; }
      const v = g.y / Math.max(1, Date.now() - g.t0), y = g.y; g = null;
      if ((y > 130 || v > .6) && c.o.cerrable !== false) this.cerrar(c, y);
      else { animar(c.hoja, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], { duration: 380, easing: CURVA.muelle }); $('.o-velo', c.el).style.opacity = 1; }
    });
  },
  async cerrar(c, desde, forzar) {
    c = c || this.abiertas[this.abiertas.length - 1];
    if (!c || c.cerrando) return;
    /* Una hoja puede preguntar antes de irse (p. ej. guardar como borrador) */
    if (!forzar && c.o && c.o.antesCerrar) {
      if (c.preguntando) return;
      c.preguntando = true;
      let ok = true; try { ok = await c.o.antesCerrar(c); } catch (e) { }
      c.preguntando = false;
      if (!ok) { if (desde) { animar(c.hoja, [{ transform: `translateY(${desde}px)` }, { transform: 'none' }], { duration: 420, easing: CURVA.muelle }); $('.o-velo', c.el).style.opacity = 1; } return; }
    }
    c.cerrando = true;
    this.abiertas = this.abiertas.filter(x => x !== c);
    this.detras();
    if (c.tipo === 'menu') { await animar(c.panel, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 160, easing: CURVA.salir }); c.el.remove(); return; }
    animar($('.o-velo', c.el), [{ opacity: getComputedStyle($('.o-velo', c.el)).opacity }, { opacity: 0 }], { duration: 380 });
    await animar(c.hoja, [{ transform: `translateY(${desde || 0}px)` }, { transform: 'translateY(105%)' }], { duration: 420, easing: CURVA.bajar });
    c.el.remove();
    if (c.o.alCerrar) c.o.alCerrar();
  },
  cerrarTodo() { this.abiertas.slice().forEach(c => this.cerrar(c)); },
  refrescar() { this.abiertas.forEach(c => { if (c.o && c.o.vivo) { const f = document.activeElement; if (!(f && c.el.contains(f) && /INPUT|TEXTAREA/.test(f.tagName))) c.repintar(); } }); },
  /* Menú flotante junto a un botón. ops: [{ t, ic, f, peligro }] */
  menu(boton, ops) {
    const r = boton.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'o-menu-capa';
    const der = r.left + r.width / 2 > innerWidth / 2, abajo = r.top < innerHeight * .6;
    el.innerHTML = `<div class="o-menu o-vid" style="${der ? `right:${Math.max(12, innerWidth - r.right)}px` : `left:${Math.max(12, r.left)}px`};${abajo ? `top:${r.bottom + 8}px` : `bottom:${innerHeight - r.top + 8}px`};transform-origin:${der ? 'right' : 'left'} ${abajo ? 'top' : 'bottom'}">
      ${ops.map((o, i) => o === '-' ? '<div class="o-menu-sep"></div>' : `<button class="o-menu-f t${o.peligro ? ' o-mal' : ''}" data-i="${i}">${esc(o.t)}<span>${ic(o.ic, 19)}</span></button>`).join('')}</div>`;
    $('#capas').appendChild(el);
    const c = { tipo: 'menu', el, panel: $('.o-menu', el), o: {} };
    this.abiertas.push(c);
    animar(c.panel, [{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: CURVA.muelle });
    $$('.o-menu-f', el).forEach((b, i) => animar(b, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 22 }));
    el.addEventListener('click', e => {
      const b = e.target.closest('.o-menu-f');
      this.cerrar(c);
      if (b) { const o = ops[+b.dataset.i]; setTimeout(() => o.f && o.f(), 120); }
    });
  },
  /* Pregunta con varias salidas. o.ops = [{ k, t, clase }]. Devuelve la k elegida o null */
  preguntar(o) {
    return new Promise(ok => {
      let r = null;
      const c = this.hoja({
        clase: 'o-hoja-peq',
        html: `<div class="o-conf"><div class="o-t3" data-e>${esc(o.titulo)}</div>${o.texto ? `<p class="o-txt" data-e style="margin-top:8px">${esc(o.texto)}</p>` : ''}
          <div class="o-conf-v">${o.ops.map(x => `<button class="o-pil t ${x.clase || ''}" data-a="op" data-k="${x.k}" data-e>${x.ic ? ic(x.ic, 18) : ''}${esc(x.t)}</button>`).join('')}</div></div>`,
        acciones: { op: (b) => { r = b.dataset.k; c.cerrar(); } },
        alCerrar: () => ok(r)
      });
    });
  },
  confirmar(o) {
    return new Promise(ok => {
      let r = false;
      const c = this.hoja({
        clase: 'o-hoja-peq',
        html: `<div class="o-conf"><div class="o-t3" data-e>${esc(o.titulo)}</div>${o.texto ? `<p class="o-txt" data-e style="margin-top:8px">${esc(o.texto)}</p>` : ''}
          <div class="o-conf-b" data-e><button class="o-pil o-sec t" data-a="cerrar">${esc(o.no || 'Cancelar')}</button><button class="o-pil t ${o.peligro ? 'o-pmal' : ''}" data-a="si">${esc(o.si || 'Aceptar')}</button></div></div>`,
        acciones: { si: () => { r = true; c.cerrar(); } },
        alCerrar: () => ok(r)
      });
    });
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (Capa.abiertas.length) Capa.cerrar(); else Nav.atras(); } });

/* ---------- Avisos: bajan desde arriba con un pequeño rebote y se van solos */
function aviso(txt, o) {
  o = o || {};
  const el = document.createElement('div');
  el.className = 'o-aviso';
  el.innerHTML = `${o.ic ? ic(o.ic, 18) : '<span class="o-punto"></span>'}<span>${esc(txt)}</span>${o.accion ? `<button class="o-enlace t">${esc(o.accion.t)}</button>` : ''}`;
  const cont = $('#avisos');
  while (cont.children.length > 1) cont.firstChild.remove();
  cont.appendChild(el);
  animar(el, [{ opacity: 0, transform: 'translateY(60%) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: CURVA.muelle });
  const fuera = () => { if (!el.isConnected) return; animar(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40%) scale(.96)' }], { duration: 240, easing: CURVA.salir }).then(() => el.remove()); };
  if (o.accion) $('button', el).onclick = () => { fuera(); o.accion.f(); };
  el.addEventListener('click', e => { if (!e.target.closest('button')) fuera(); });
  setTimeout(fuera, o.ms || (o.accion ? 4200 : 2200));
}

/* ---------- Reloj: los relojes de la cabecera cambian cada minuto (el número rueda) */
const Reloj = {
  t: null, ult: '',
  arrancar() { clearInterval(this.t); this.t = setInterval(() => this.tic(), 15000); },
  tic() {
    $$('[data-reloj]').forEach(el => Anim.numero(el, enZona(el.dataset.reloj).hora));
    const m = enZona(TZ_CASA()).hora;
    if (m !== this.ult) { const viejo = this.ult; this.ult = m; if (viejo) { const pa = Nav.actual(); if (pa && pa.def.alMinuto) pa.def.alMinuto(pa.el, pa.p, pa); } }
  }
};

/* ---- 04_datos.js ---- */
/* ============================ DATOS ============================
   Colecciones: espacio, personas, viajes, paradas, ideas, docs, medios, actividad, feedback.
   Las horas del plan siempre en hora local del destino. */

/* Ciudades con su zona horaria (para el aviso de hora y el conversor). [nombre, país, zona, lat, lng] */
const CIUDADES = [
  ['Kioto', 'JP', 'Asia/Tokyo', 35.0116, 135.7681], ['Tokio', 'JP', 'Asia/Tokyo', 35.6762, 139.6503], ['Osaka', 'JP', 'Asia/Tokyo', 34.6937, 135.5023], ['Hakone', 'JP', 'Asia/Tokyo', 35.2324, 139.1069], ['Nara', 'JP', 'Asia/Tokyo', 34.6851, 135.8048],
  ['Seúl', 'KR', 'Asia/Seoul', 37.5665, 126.978], ['Pekín', 'CN', 'Asia/Shanghai', 39.9042, 116.4074], ['Shanghái', 'CN', 'Asia/Shanghai', 31.2304, 121.4737], ['Hong Kong', 'HK', 'Asia/Hong_Kong', 22.3193, 114.1694], ['Taipéi', 'TW', 'Asia/Taipei', 25.033, 121.5654],
  ['Bangkok', 'TH', 'Asia/Bangkok', 13.7563, 100.5018], ['Chiang Mai', 'TH', 'Asia/Bangkok', 18.7883, 98.9853], ['Phuket', 'TH', 'Asia/Bangkok', 7.8804, 98.3923], ['Hanói', 'VN', 'Asia/Ho_Chi_Minh', 21.0278, 105.8342], ['Ho Chi Minh', 'VN', 'Asia/Ho_Chi_Minh', 10.8231, 106.6297],
  ['Singapur', 'SG', 'Asia/Singapore', 1.3521, 103.8198], ['Bali', 'ID', 'Asia/Makassar', -8.3405, 115.092], ['Yakarta', 'ID', 'Asia/Jakarta', -6.2088, 106.8456], ['Kuala Lumpur', 'MY', 'Asia/Kuala_Lumpur', 3.139, 101.6869], ['Manila', 'PH', 'Asia/Manila', 14.5995, 120.9842],
  ['Delhi', 'IN', 'Asia/Kolkata', 28.6139, 77.209], ['Bombay', 'IN', 'Asia/Kolkata', 19.076, 72.8777], ['Katmandú', 'NP', 'Asia/Kathmandu', 27.7172, 85.324], ['Maldivas', 'MV', 'Indian/Maldives', 4.1755, 73.5093], ['Dubái', 'AE', 'Asia/Dubai', 25.2048, 55.2708],
  ['Estambul', 'TR', 'Europe/Istanbul', 41.0082, 28.9784], ['Capadocia', 'TR', 'Europe/Istanbul', 38.6431, 34.8289], ['Tel Aviv', 'IL', 'Asia/Jerusalem', 32.0853, 34.7818], ['Ammán', 'JO', 'Asia/Amman', 31.9539, 35.9106], ['El Cairo', 'EG', 'Africa/Cairo', 30.0444, 31.2357],
  ['Marrakech', 'MA', 'Africa/Casablanca', 31.6295, -7.9811], ['Ciudad del Cabo', 'ZA', 'Africa/Johannesburg', -33.9249, 18.4241], ['Nairobi', 'KE', 'Africa/Nairobi', -1.2921, 36.8219], ['Zanzíbar', 'TZ', 'Africa/Dar_es_Salaam', -6.1659, 39.2026],
  ['Lisboa', 'PT', 'Europe/Lisbon', 38.7223, -9.1393], ['Oporto', 'PT', 'Europe/Lisbon', 41.1579, -8.6291], ['Madeira', 'PT', 'Atlantic/Madeira', 32.6669, -16.9241], ['Azores', 'PT', 'Atlantic/Azores', 37.7412, -25.6756],
  ['Madrid', 'ES', 'Europe/Madrid', 40.4168, -3.7038], ['Barcelona', 'ES', 'Europe/Madrid', 41.3874, 2.1686], ['Bilbao', 'ES', 'Europe/Madrid', 43.263, -2.935], ['San Sebastián', 'ES', 'Europe/Madrid', 43.3183, -1.9812], ['Sevilla', 'ES', 'Europe/Madrid', 37.3891, -5.9845], ['Valencia', 'ES', 'Europe/Madrid', 39.4699, -0.3763], ['Mallorca', 'ES', 'Europe/Madrid', 39.6953, 3.0176], ['Tenerife', 'ES', 'Atlantic/Canary', 28.2916, -16.6291], ['Gran Canaria', 'ES', 'Atlantic/Canary', 27.9202, -15.5474],
  ['París', 'FR', 'Europe/Paris', 48.8566, 2.3522], ['Niza', 'FR', 'Europe/Paris', 43.7102, 7.262], ['Londres', 'GB', 'Europe/London', 51.5072, -0.1276], ['Edimburgo', 'GB', 'Europe/London', 55.9533, -3.1883], ['Dublín', 'IE', 'Europe/Dublin', 53.3498, -6.2603],
  ['Ámsterdam', 'NL', 'Europe/Amsterdam', 52.3676, 4.9041], ['Bruselas', 'BE', 'Europe/Brussels', 50.8503, 4.3517], ['Berlín', 'DE', 'Europe/Berlin', 52.52, 13.405], ['Múnich', 'DE', 'Europe/Berlin', 48.1351, 11.582], ['Viena', 'AT', 'Europe/Vienna', 48.2082, 16.3738], ['Praga', 'CZ', 'Europe/Prague', 50.0755, 14.4378], ['Budapest', 'HU', 'Europe/Budapest', 47.4979, 19.0402], ['Cracovia', 'PL', 'Europe/Warsaw', 50.0647, 19.945],
  ['Zúrich', 'CH', 'Europe/Zurich', 47.3769, 8.5417], ['Roma', 'IT', 'Europe/Rome', 41.9028, 12.4964], ['Florencia', 'IT', 'Europe/Rome', 43.7696, 11.2558], ['Venecia', 'IT', 'Europe/Rome', 45.4408, 12.3155], ['Milán', 'IT', 'Europe/Rome', 45.4642, 9.19], ['Nápoles', 'IT', 'Europe/Rome', 40.8518, 14.2681], ['Sicilia', 'IT', 'Europe/Rome', 37.6, 14.0154],
  ['Atenas', 'GR', 'Europe/Athens', 37.9838, 23.7275], ['Santorini', 'GR', 'Europe/Athens', 36.3932, 25.4615], ['Dubrovnik', 'HR', 'Europe/Zagreb', 42.6507, 18.0944], ['Copenhague', 'DK', 'Europe/Copenhagen', 55.6761, 12.5683], ['Estocolmo', 'SE', 'Europe/Stockholm', 59.3293, 18.0686], ['Oslo', 'NO', 'Europe/Oslo', 59.9139, 10.7522], ['Tromsø', 'NO', 'Europe/Oslo', 69.6492, 18.9553], ['Helsinki', 'FI', 'Europe/Helsinki', 60.1699, 24.9384], ['Laponia', 'FI', 'Europe/Helsinki', 66.5039, 25.7294],
  ['Reikiavik', 'IS', 'Atlantic/Reykjavik', 64.1466, -21.9426], ['Nueva York', 'US', 'America/New_York', 40.7128, -74.006], ['Miami', 'US', 'America/New_York', 25.7617, -80.1918], ['Boston', 'US', 'America/New_York', 42.3601, -71.0589], ['Washington', 'US', 'America/New_York', 38.9072, -77.0369], ['Chicago', 'US', 'America/Chicago', 41.8781, -87.6298], ['Nueva Orleans', 'US', 'America/Chicago', 29.9511, -90.0715],
  ['Denver', 'US', 'America/Denver', 39.7392, -104.9903], ['Las Vegas', 'US', 'America/Los_Angeles', 36.1699, -115.1398], ['Los Ángeles', 'US', 'America/Los_Angeles', 34.0522, -118.2437], ['San Francisco', 'US', 'America/Los_Angeles', 37.7749, -122.4194], ['Seattle', 'US', 'America/Los_Angeles', 47.6062, -122.3321], ['Honolulu', 'US', 'Pacific/Honolulu', 21.3069, -157.8583],
  ['Toronto', 'CA', 'America/Toronto', 43.6532, -79.3832], ['Montreal', 'CA', 'America/Toronto', 45.5017, -73.5673], ['Vancouver', 'CA', 'America/Vancouver', 49.2827, -123.1207], ['Ciudad de México', 'MX', 'America/Mexico_City', 19.4326, -99.1332], ['Cancún', 'MX', 'America/Cancun', 21.1619, -86.8515], ['Oaxaca', 'MX', 'America/Mexico_City', 17.0732, -96.7266],
  ['La Habana', 'CU', 'America/Havana', 23.1136, -82.3666], ['Punta Cana', 'DO', 'America/Santo_Domingo', 18.5601, -68.3725], ['San José', 'CR', 'America/Costa_Rica', 9.9281, -84.0907], ['Cartagena', 'CO', 'America/Bogota', 10.391, -75.4794], ['Bogotá', 'CO', 'America/Bogota', 4.711, -74.0721], ['Lima', 'PE', 'America/Lima', -12.0464, -77.0428], ['Cuzco', 'PE', 'America/Lima', -13.532, -71.9675],
  ['Buenos Aires', 'AR', 'America/Argentina/Buenos_Aires', -34.6037, -58.3816], ['Patagonia', 'AR', 'America/Argentina/Rio_Gallegos', -50.3379, -72.2648], ['Santiago de Chile', 'CL', 'America/Santiago', -33.4489, -70.6693], ['Río de Janeiro', 'BR', 'America/Sao_Paulo', -22.9068, -43.1729], ['São Paulo', 'BR', 'America/Sao_Paulo', -23.5505, -46.6333],
  ['Sídney', 'AU', 'Australia/Sydney', -33.8688, 151.2093], ['Melbourne', 'AU', 'Australia/Melbourne', -37.8136, 144.9631], ['Auckland', 'NZ', 'Pacific/Auckland', -36.8485, 174.7633], ['Queenstown', 'NZ', 'Pacific/Auckland', -45.0312, 168.6626]
].map(c => ({ n: c[0], pais: c[1], tz: c[2], lat: c[3], lng: c[4] }));
const MONEDA_PAIS = { JP: 'JPY', KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD', TH: 'THB', VN: 'VND', SG: 'SGD', ID: 'IDR', MY: 'MYR', PH: 'PHP', IN: 'INR', NP: 'NPR', MV: 'MVR', AE: 'AED', TR: 'TRY', IL: 'ILS', JO: 'JOD', EG: 'EGP', MA: 'MAD', ZA: 'ZAR', KE: 'KES', TZ: 'TZS', GB: 'GBP', CH: 'CHF', CZ: 'CZK', HU: 'HUF', PL: 'PLN', DK: 'DKK', SE: 'SEK', NO: 'NOK', IS: 'ISK', US: 'USD', CA: 'CAD', MX: 'MXN', CU: 'CUP', DO: 'DOP', CR: 'CRC', CO: 'COP', PE: 'PEN', AR: 'ARS', CL: 'CLP', BR: 'BRL', AU: 'AUD', NZ: 'NZD' };
const EURO = ['ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'IE', 'GR', 'HR', 'FI', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY'];
function monedaDe(pais) { return EURO.indexOf(pais) >= 0 ? 'EUR' : (MONEDA_PAIS[pais] || 'EUR'); }
const SIMBOLO = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', THB: '฿', INR: '₹', TRY: '₺', CHF: 'CHF', ISK: 'kr', NOK: 'kr', SEK: 'kr', DKK: 'kr', MXN: '$', AUD: '$', CAD: '$', NZD: '$', BRL: 'R$', VND: '₫', ILS: '₪', PHP: '₱' };
function ciudadDeZona(tz) { return CIUDADES.find(c => c.tz === tz); }
function ciudadCercana(lat, lng) {
  let mej = null, d = 1e9;
  CIUDADES.forEach(c => { const k = distKm({ lat, lng }, c); if (k < d) { d = k; mej = c; } });
  return mej;
}
function buscarCiudades(q) {
  const n = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  q = n(q.trim()); if (!q) return [];
  return CIUDADES.filter(c => n(c.n).indexOf(q) >= 0).slice(0, 6);
}

const TIPOS = {
  visita: { t: 'Visita', ic: 'pin' }, comida: { t: 'Comida', ic: 'food' }, actividad: { t: 'Actividad', ic: 'ticket' },
  transporte: { t: 'Transporte', ic: 'train' }, vuelo: { t: 'Vuelo', ic: 'plane' }, hotel: { t: 'Alojamiento', ic: 'bed' }
};
Object.assign(TIPOS, { compras: { t: 'Compras', ic: 'bag' }, noche: { t: 'Noche', ic: 'moon' }, naturaleza: { t: 'Naturaleza', ic: 'tree' } });
/* ---------- Categorías: las de siempre más las que cree el grupo (se guardan y salen en toda la app) */
function categorias() {
  const o = Object.assign({}, TIPOS);
  lista('categorias').sort((a, b) => (a.creado || 0) - (b.creado || 0)).forEach(c => { o[c.id] = { t: c.t, ic: 'tag', propia: true }; });
  return o;
}
function tipoDe(k, sinDefecto) {
  if (TIPOS[k]) return TIPOS[k];
  const c = k && dato('categorias', k);
  if (c) return { t: c.t, ic: 'tag', propia: true };
  return sinDefecto ? null : TIPOS.visita;
}
/* Fila de categorías para elegir una. o.a = acción al tocar */
function chipsCat(sel, o) {
  o = o || {};
  const cs = categorias();
  return `<div class="o-cats">${Object.keys(cs).map(k => `<button class="o-cat t t-s${k === sel ? ' o-on' : ''}" data-a="${o.a || 'cat'}" data-k="${k}">${ic(cs[k].ic, 16, 1.8)}<span>${esc(cs[k].t)}</span></button>`).join('')}<button class="o-cat o-cat-mas t t-s" data-a="catNueva">${ic('plus', 16, 2)}<span>Nueva</span></button></div>`;
}
function marcarCat(b, on) {
  $$('.o-cat', b.parentNode).forEach(x => x.classList.toggle('o-on', on && x === b));
  if (on) Anim.salto(b);
}
/* Crea una categoría propia y la devuelve (o null si se cancela) */
function nuevaCategoria() {
  return new Promise(ok => {
    let r = null;
    const c = Capa.hoja({
      clase: 'o-hoja-peq',
      html: `<div class="o-conf"><div class="o-t3" data-e>Nueva categoría</div><p class="o-nota" data-e style="margin-top:6px">Se guarda para todo el grupo y sale en paradas e ideas.</p>
        <input id="f-catn" class="o-in" data-e placeholder="Miradores, cafés bonitos, playas…" autocomplete="off" style="margin-top:16px" maxlength="28">
        <div class="o-conf-b" data-e><button class="o-pil o-sec t" data-a="cerrar">Cancelar</button><button class="o-pil t" data-a="crearCat">Crear</button></div></div>`,
      alAbrir: (h) => { const i = $('#f-catn', h); setTimeout(() => i.focus(), 350); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-a="crearCat"]', h).click(); } }); },
      acciones: {
        crearCat: () => {
          const i = $('#f-catn', c.hoja), t = i.value.trim();
          if (!t) { Anim.no(i); return; }
          const ya = Object.entries(categorias()).find(([k, x]) => x.t.toLowerCase() === t.toLowerCase());
          r = ya ? ya[0] : nuevo('categorias', { t: t.slice(0, 1).toUpperCase() + t.slice(1) }, { callado: true });
          c.cerrar();
        }
      },
      alCerrar: () => ok(r)
    });
  });
}
const TIPOS_DOC = {
  vuelo: { t: 'Vuelo', ic: 'plane' }, hotel: { t: 'Alojamiento', ic: 'bed' }, tren: { t: 'Tren o bus', ic: 'train' },
  coche: { t: 'Coche', ic: 'car' }, entrada: { t: 'Entrada', ic: 'ticket' }, seguro: { t: 'Seguro', ic: 'shield' }, otro: { t: 'Otro', ic: 'doc' }
};

/* ---------- viajes */
function viajes(archivados) { return lista('viajes', v => !v.archivado === !archivados).sort((a, b) => (a.desde || '').localeCompare(b.desde || '')); }
function diasDe(v) { const n = Math.max(0, difDias(v.desde, v.hasta || v.desde)); return Array.from({ length: n + 1 }, (_, i) => sumaDias(v.desde, i)); }
function hoyEn(v) { return enZona(v.tz || TZ_CASA()).dia; }
function estadoViaje(v) {
  const h = hoyEn(v);
  if (h < v.desde) return { e: 'futuro', faltan: difDias(h, v.desde) };
  if (h > (v.hasta || v.desde)) return { e: 'pasado', hace: difDias(v.hasta || v.desde, h) };
  return { e: 'curso', dia: difDias(v.desde, h) + 1, total: diasDe(v).length };
}
function paradasDe(vid, dia) {
  return lista('paradas', p => p.viaje === vid && (!dia || p.dia === dia)).sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || ((minutos(a.hora) ?? 9999) - (minutos(b.hora) ?? 9999)) || (a.creado || 0) - (b.creado || 0));
}
/* La parada «de ahora»: la última que ya ha empezado y aún no acaba la siguiente */
function paradaAhora(v, dia, ps) {
  const h = enZona(v.tz || TZ_CASA());
  if (h.dia !== dia || !ps.length) return { idx: -1, ahora: false };
  let idx = -1;
  ps.forEach((p, i) => { const m = minutos(p.hora); if (m != null && m <= h.min) idx = i; });
  if (idx >= 0) {
    const sig = ps[idx + 1], fin = minutos(ps[idx].fin) ?? (sig ? minutos(sig.hora) : minutos(ps[idx].hora) + 120);
    if (h.min < fin && !ps[idx].hecho) return { idx, ahora: true };
  }
  const prox = ps.findIndex(p => !p.hecho && (minutos(p.hora) ?? 9999) > h.min);
  return { idx: prox, ahora: false };
}
/* w: ancho en píxeles; para los círculos pequeños se pide una foto pequeña y carga mucho antes */
function fotoParada(p, w) { return p && p.fotos && p.fotos[0] ? urlMedio(p.fotos[0], w) : ''; }
function portadaUrl(v) {
  if (!v) return '';
  if (v.portada) return urlMedio(v.portada);
  return '';
}
function personasViaje(v) { const ids = v.quienes && v.quienes.length ? v.quienes : lista('personas').map(p => p.id); return ids.map(id => dato('personas', id)).filter(Boolean); }

/* ---------- ejemplo de prueba: tres viajes completos con fotos reales (Kioto en curso, Lisboa próximo, Islandia vivido) */
function crearDemo() {
  S.recs = {}; S.cola = {};
  const pon = (col, id, f) => { S.recs[col] = S.recs[col] || {}; S.recs[col][id] = { f: Object.assign({ creado: Date.now() }, f), t: {}, rev: 1, por: f.por || 'p1' }; };
  const F = n => ({ demo: n });
  pon('espacio', 'espacio', { nombre: 'Viajes con amigos' });
  [['p1', 'Clara Ortiz', COLORES[0], 'admin', 'per_clara'], ['p2', 'Erik Aguirre', COLORES[1], 'editor', 'per_erik'], ['p3', 'Amara Ferrer', COLORES[2], 'editor', 'per_amara'], ['p4', 'Dani Ibarra', COLORES[4], 'lector', 'per_dani']]
    .forEach(([id, nombre, color, rol, foto]) => pon('personas', id, { nombre, color, rol, foto: F(foto) }));
  const hoyC = enZona(TZ_CASA()).dia;

  /* ===== KIOTO · 4 días, hoy es el tercero (en hora de Kioto) ===== */
  const k0 = sumaDias(enZona('Asia/Tokyo').dia, -2), K = n => sumaDias(k0, n);
  pon('viajes', 'vkt', { nombre: 'Kioto', lugar: 'Templos, bambú y arces rojos', ciudad: 'Kioto', pais: 'JP', tz: 'Asia/Tokyo', moneda: 'JPY', lat: 35.0116, lng: 135.7681, desde: k0, hasta: K(3), portada: F('kio_kiyomizu'), quienes: ['p1', 'p2', 'p3', 'p4'] });
  const PK = (id, d, hora, nombre, tipo, lat, lng, extra) => pon('paradas', id, Object.assign({ viaje: 'vkt', dia: K(d), hora, nombre, tipo, lugar: { lat, lng, dir: 'Kioto, Japón' } }, extra || {}));
  PK('k01', 0, '14:20', 'Llegada a la estación de Kioto', 'transporte', 34.9858, 135.7588, { hecho: true, fin: '14:40', nota: 'Shinkansen Nozomi desde Tokio. Taquillas para las maletas en la planta baja.', por: 'p2' });
  PK('k02', 0, '15:30', 'Ryokan Yoshida-sanso', 'hotel', 35.0262, 135.7905, { hecho: true, fotos: [F('kio_te')], nota: 'Entrada desde las 15:00. Cena kaiseki a las 19:00 el último día. Reserva a nombre de Erik.', por: 'p2' });
  PK('k03', 0, '17:00', 'Paseo por Gion y Hanamikoji', 'visita', 35.0037, 135.7752, { hecho: true, fotos: [F('kio_gion')], nota: 'Con suerte se ve alguna maiko yendo a trabajar. No hacer fotos en las calles privadas.' });
  PK('k04', 0, '19:30', 'Cena en Pontocho', 'comida', 35.0050, 135.7708, { hecho: true, fotos: [F('kio_pontocho')], nota: 'Mesa para 4 en la terraza sobre el río (kawayuka).', por: 'p3' });
  PK('k11', 1, '07:30', 'Fushimi Inari', 'visita', 34.9671, 135.7727, { hecho: true, fotos: [F('kio_inari')], nota: 'Subir hasta el mirador de Yotsutsuji: una hora y media ida y vuelta. A primera hora casi no hay nadie.' });
  PK('k12', 1, '11:00', 'Kinkaku-ji, el pabellón dorado', 'visita', 35.0394, 135.7292, { hecho: true, fotos: [F('kio_kinkaku')], nota: 'Entrada 500 yenes. La mejor foto, desde la primera orilla del estanque.' });
  PK('k13', 1, '13:30', 'Ramen en Menya Inoichi', 'comida', 35.0036, 135.7647, { hecho: true, fotos: [F('kio_ramen')], nota: 'Hay que coger número en la puerta y volver a la hora que te dicen.', por: 'p3' });
  PK('k14', 1, '16:00', 'Ceremonia del té en Camellia', 'actividad', 34.9967, 135.7805, { hecho: true, fotos: [F('kio_te')], nota: '45 minutos. Pagado: 4 plazas.', por: 'p1' });
  PK('k21', 2, '08:00', 'Bosque de bambú de Arashiyama', 'visita', 35.0170, 135.6713, { fotos: [F('kio_bambu')], nota: 'Ir antes de las 9: después se llena. Salir por el templo Tenryu-ji.' });
  PK('k22', 2, '10:30', 'Villa Okochi Sanso y sus arces', 'visita', 35.0168, 135.6697, { fotos: [F('kio_arces')], nota: 'La entrada incluye un té matcha con dulce al final del jardín.' });
  PK('k23', 2, '13:00', 'Mercado de Nishiki', 'comida', 35.0050, 135.7649, { fotos: [F('kio_nishiki')], nota: 'Probar el tamagoyaki, los pinchos de pulpo y el helado de sésamo negro.', por: 'p3' });
  PK('k24', 2, '16:00', 'Kiyomizu-dera', 'visita', 34.9949, 135.7850, { fotos: [F('kio_kiyomizu'), F('kio_kiyomizu2')], nota: 'La terraza de madera al atardecer. Después bajar por Sannenzaka y Ninenzaka.', enlaces: ['https://www.kiyomizudera.or.jp/en/'] });
  PK('k25', 2, '18:30', 'Pagoda Yasaka al atardecer', 'visita', 34.9986, 135.7794, { fotos: [F('kio_yasaka')], nota: 'La foto clásica, desde lo alto de la cuesta de Yasaka-dori.', por: 'p2' });
  PK('k26', 2, '20:30', 'Cena en Gion Karyo', 'comida', 35.0032, 135.7745, { nota: 'Menú degustación. Reserva confirmada para 4.', por: 'p1' });
  PK('k31', 3, '09:00', 'Templo Kodai-ji', 'visita', 35.0006, 135.7810, { fotos: [F('kio_kiyomizu2')], nota: 'Jardín zen y el bosquecillo de bambú pequeño.' });
  PK('k32', 3, '11:30', 'Últimas compras en Teramachi', 'actividad', 35.0068, 135.7676);
  PK('k33', 3, '15:10', 'Haruka al aeropuerto de Kansai', 'transporte', 34.9858, 135.7588, { fin: '16:28', nota: 'Andén 30. Asientos reservados en el coche 3.', por: 'p2' });
  pon('categorias', 'cmira', { t: 'Miradores' });
  const IK = (id, titulo, fuente, url, img, extra) => pon('ideas', id, Object.assign({ viaje: 'vkt', titulo, fuente, url, imagen: img ? F(img) : null }, extra || {}));
  IK('ik1', 'Los 5 mejores ramen de Kioto', 'tiktok', 'https://www.tiktok.com/@ejemplo/video/1', 'kio_ramen', { autor: '@comeconjapon', por: 'p3', cat: 'comida', nota: 'El de Menbaka Fire Ramen lo flambean delante. Ir pronto, hay cola.' });
  IK('ik2', 'Pontocho cuando encienden los farolillos', 'instagram', 'https://www.instagram.com/p/ejemplo1/', 'kio_pontocho', { autor: '@kyoto.light', por: 'p2', cat: 'noche' });
  IK('ik3', 'Arces rojos de Arashiyama', 'instagram', 'https://www.instagram.com/p/ejemplo2/', 'kio_arces', { autor: '@momiji.days', cat: 'naturaleza' });
  IK('ik4', 'Kinkaku-ji al abrir', 'tiktok', 'https://www.tiktok.com/@ejemplo/video/2', 'kio_kinkaku', { autor: '@viajaconmapa', cat: 'cmira', nota: 'Abre a las 9:00. Llegar 15 minutos antes.' });
  IK('ik5', 'Ceremonia del té Camellia', 'maps', 'https://maps.google.com/?q=34.9967,135.7805', 'kio_te', { lugar: { lat: 34.9967, lng: 135.7805 }, nota: 'Tiene muy buenas reseñas y la explican en inglés.', por: 'p1', cat: 'actividad' });
  IK('ik6', 'Ninenzaka sin gente', 'maps', 'https://maps.google.com/?q=34.9981,135.7808', 'kio_yasaka', { lugar: { lat: 34.9981, lng: 135.7808 }, cat: 'cmira' });
  const DK = (id, tipo, titulo, cuando, extra) => pon('docs', id, Object.assign({ viaje: 'vkt', tipo, titulo, cuando }, extra || {}));
  DK('dk1', 'vuelo', 'Madrid → Osaka Kansai', K(0) + ' 09:05', { codigo: 'K7Q2LM', detalles: 'Vuelo con escala en Helsinki. 4 pasajeros. Maleta de 23 kg cada uno.', por: 'p2' });
  DK('dk2', 'tren', 'Shinkansen Nozomi', K(0) + ' 12:03', { codigo: 'JR-4471', detalles: 'Coche 7, asientos 12 A a D' });
  DK('dk3', 'hotel', 'Ryokan Yoshida-sanso', K(0) + ' 15:00', { codigo: 'YS-88213', detalles: '2 habitaciones de tatami · 3 noches · desayuno incluido', por: 'p2' });
  DK('dk4', 'entrada', 'Ceremonia del té Camellia', K(1) + ' 16:00', { codigo: 'CAM-1604', detalles: '4 plazas' });
  DK('dk5', 'tren', 'Haruka al aeropuerto', K(3) + ' 15:10', { codigo: 'HK-3310', detalles: 'Coche 3 · asientos reservados' });
  DK('dk6', 'seguro', 'Seguro de viaje', '', { codigo: 'PL-55120', detalles: 'Asistencia 24 h: +34 900 000 000' });
  ['kio_inari', 'kio_kinkaku', 'kio_ramen', 'kio_te', 'kio_bambu'].forEach((f, i) => pon('medios', 'mk' + i, { viaje: 'vkt', dia: K(1), tipo: 'foto', demo: f, por: ['p1', 'p2', 'p3', 'p4'][i % 4] }));
  ['kio_gion', 'kio_pontocho'].forEach((f, i) => pon('medios', 'mk0' + i, { viaje: 'vkt', dia: K(0), tipo: 'foto', demo: f, por: 'p3' }));

  /* ===== LISBOA · 3 días, dentro de tres semanas ===== */
  const l0 = sumaDias(hoyC, 23), L = n => sumaDias(l0, n);
  pon('viajes', 'vls', { nombre: 'Lisboa', lugar: 'Alfama, Belém y Sintra', ciudad: 'Lisboa', pais: 'PT', tz: 'Europe/Lisbon', moneda: 'EUR', lat: 38.7223, lng: -9.1393, desde: l0, hasta: L(2), portada: F('lis_alfama'), quienes: ['p1', 'p2', 'p3'] });
  const PL = (id, d, hora, nombre, tipo, lat, lng, extra) => pon('paradas', id, Object.assign({ viaje: 'vls', dia: L(d), hora, nombre, tipo, lugar: { lat, lng, dir: 'Lisboa, Portugal' } }, extra || {}));
  PL('l01', 0, '10:05', 'Llegada al aeropuerto Humberto Delgado', 'vuelo', 38.7742, -9.1342, { nota: 'Metro línea roja hasta Alameda y cambio a la verde.', por: 'p2' });
  PL('l02', 0, '12:30', 'Hotel Bairro Alto', 'hotel', 38.7108, -9.1435, { fotos: [F('lis_chiado')], nota: 'Dejar las maletas; la habitación se entrega a las 15:00.' });
  PL('l03', 0, '15:00', 'Tranvía 28 hasta Graça', 'transporte', 38.7116, -9.1393, { fotos: [F('lis_tranvia')], nota: 'Subir en Martim Moniz, que es cabecera y hay sitio para sentarse.' });
  PL('l04', 0, '17:30', 'Castillo de San Jorge y miradores de Alfama', 'visita', 38.7139, -9.1335, { fotos: [F('lis_alfama'), F('lis_azulejos')], nota: 'Bajar andando por el mirador de Santa Luzia.' });
  PL('l05', 0, '21:00', 'Cena y fado en Bairro Alto', 'comida', 38.7134, -9.1446, { fotos: [F('lis_bairro')], nota: 'Tasca do Chico: sin reserva, llegar antes de las 21:00.', por: 'p3' });
  PL('l11', 1, '09:30', 'Torre de Belém', 'visita', 38.6916, -9.2160, { fotos: [F('lis_belem')], nota: 'Entradas compradas para las 9:30.' });
  PL('l12', 1, '11:00', 'Monasterio de los Jerónimos', 'visita', 38.6979, -9.2068, { fotos: [F('lis_jeronimos')], nota: 'El claustro es lo mejor. Entrada combinada con la torre.' });
  PL('l13', 1, '12:45', 'Pastéis de Belém', 'comida', 38.6975, -9.2032, { fotos: [F('lis_nata')], nota: 'Pedir para tomar dentro: la cola de fuera es solo para llevar.', por: 'p3' });
  PL('l14', 1, '19:00', 'Atardecer junto al puente 25 de Abril', 'visita', 38.7047, -9.1778, { fotos: [F('lis_puente')], nota: 'Desde LX Factory o el muelle de Santo Amaro.' });
  PL('l21', 2, '08:40', 'Tren a Sintra desde Rossio', 'transporte', 38.7144, -9.1411, { fin: '09:20' });
  PL('l22', 2, '10:00', 'Palacio da Pena', 'visita', 38.7876, -9.3906, { fotos: [F('lis_sintra')], nota: 'Entrada con hora a las 10:00. Subir en el autobús 434.', por: 'p1' });
  PL('l23', 2, '20:30', 'Vuelo de vuelta a Madrid', 'vuelo', 38.7742, -9.1342);
  const IL = (id, titulo, fuente, url, img, extra) => pon('ideas', id, Object.assign({ viaje: 'vls', titulo, fuente, url, imagen: img ? F(img) : null }, extra || {}));
  IL('il1', 'Los mejores pastéis de nata de Lisboa', 'tiktok', 'https://www.tiktok.com/@ejemplo/video/3', 'lis_nata', { autor: '@lisboacome', por: 'p3', cat: 'comida', nota: 'Manteigaria mejor que Belém, y sin cola.' });
  IL('il2', 'Fachadas de azulejo en Alfama', 'instagram', 'https://www.instagram.com/p/ejemplo3/', 'lis_azulejos', { autor: '@azulejo.walks', cat: 'visita' });
  IL('il3', 'Arte urbano en Bairro Alto', 'instagram', 'https://www.instagram.com/p/ejemplo4/', 'lis_bairro', { autor: '@streetlisboa', por: 'p2', cat: 'noche' });
  IL('il4', 'Miradouro da Senhora do Monte', 'maps', 'https://maps.google.com/?q=38.7192,-9.1325', 'lis_alfama', { lugar: { lat: 38.7192, lng: -9.1325 }, nota: 'El mirador más alto, menos gente que Santa Luzia.', cat: 'cmira' });
  IL('il5', 'Sintra en un día', 'web', 'https://www.ejemplo.com/sintra', 'lis_sintra', { nota: 'Orden recomendado: Pena, Moorish y Quinta da Regaleira.' });
  const DL = (id, tipo, titulo, cuando, extra) => pon('docs', id, Object.assign({ viaje: 'vls', tipo, titulo, cuando }, extra || {}));
  DL('dl1', 'vuelo', 'Madrid → Lisboa', L(0) + ' 09:15', { codigo: 'TP1027', detalles: '3 pasajeros · solo equipaje de mano', por: 'p2' });
  DL('dl2', 'hotel', 'Hotel Bairro Alto', L(0) + ' 15:00', { codigo: 'BA-77410', detalles: '2 habitaciones · 2 noches' });
  DL('dl3', 'entrada', 'Torre de Belém y Jerónimos', L(1) + ' 09:30', { codigo: 'BEL-3093', detalles: 'Entrada combinada · 3 personas' });
  DL('dl4', 'entrada', 'Palacio da Pena', L(2) + ' 10:00', { codigo: 'PENA-1000', detalles: '3 entradas con hora' });
  DL('dl5', 'vuelo', 'Lisboa → Madrid', L(2) + ' 20:30', { codigo: 'TP1028', detalles: '3 pasajeros' });

  /* ===== ISLANDIA · 4 días, vivido hace dos meses ===== */
  const i0 = sumaDias(hoyC, -62), I = n => sumaDias(i0, n);
  pon('viajes', 'vis', { nombre: 'Islandia', lugar: 'Costa sur y auroras boreales', ciudad: 'Reikiavik', pais: 'IS', tz: 'Atlantic/Reykjavik', moneda: 'ISK', lat: 64.1466, lng: -21.9426, desde: i0, hasta: I(3), portada: F('isl_aurora_casa'), quienes: ['p1', 'p2', 'p3', 'p4'] });
  const PI = (id, d, hora, nombre, tipo, lat, lng, extra) => pon('paradas', id, Object.assign({ viaje: 'vis', dia: I(d), hora, nombre, tipo, lugar: { lat, lng, dir: 'Islandia' }, hecho: true }, extra || {}));
  PI('s01', 0, '10:00', 'Llegada a Keflavík', 'vuelo', 63.985, -22.6056, { nota: 'Recoger el 4x4 en el aparcamiento P2.', por: 'p2' });
  PI('s02', 0, '13:30', 'Hallgrímskirkja', 'visita', 64.1417, -21.9266, { fotos: [F('isl_hallgrim')], nota: 'Subir a la torre: 1.400 coronas.' });
  PI('s03', 0, '17:00', 'Laguna Azul', 'actividad', 63.8804, -22.4495, { fotos: [F('isl_laguna')], nota: 'Mascarilla de sílice incluida. Llevar el pelo recogido.', por: 'p3' });
  PI('s11', 1, '10:00', 'Geysir y Strokkur', 'visita', 64.3104, -20.3024, { fotos: [F('isl_geysir')], nota: 'Strokkur salta cada 6 u 8 minutos.' });
  PI('s12', 1, '14:00', 'Carretera hacia la costa sur', 'transporte', 63.9, -20.2, { fotos: [F('isl_valle')], fin: '16:30' });
  PI('s13', 1, '22:30', 'Auroras desde la cabaña', 'actividad', 63.53, -19.51, { fotos: [F('isl_aurora_casa')], nota: 'Previsión de actividad 5. Salieron a las 23:10.', por: 'p4' });
  PI('s21', 2, '09:00', 'Seljalandsfoss', 'visita', 63.6156, -19.9886, { fotos: [F('isl_seljaland')], nota: 'Se puede pasar por detrás: chubasquero imprescindible.' });
  PI('s22', 2, '11:30', 'Skógafoss', 'visita', 63.5321, -19.5114, { fotos: [F('isl_skogafoss')], nota: 'Con sol sale arcoíris casi siempre.' });
  PI('s23', 2, '15:00', 'Playa negra de Reynisfjara', 'visita', 63.4044, -19.0444, { fotos: [F('isl_reynis')], nota: 'Cuidado con las olas: no acercarse a la orilla.', por: 'p2' });
  PI('s24', 2, '23:00', 'Auroras en la carretera 1', 'actividad', 63.42, -19.0, { fotos: [F('isl_aurora_ruta')] });
  PI('s31', 3, '10:00', 'Jökulsárlón y la playa de los diamantes', 'visita', 64.0484, -16.1799, { fotos: [F('isl_diamante')], nota: 'Paseo en barca anfibia entre icebergs.', por: 'p1' });
  PI('s32', 3, '18:00', 'Vuelta a Reikiavik', 'transporte', 64.1466, -21.9426, { fin: '23:00' });
  pon('ideas', 'is1', { viaje: 'vis', titulo: 'Previsión de auroras', fuente: 'web', url: 'https://www.ejemplo.com/auroras', imagen: F('isl_aurora_ruta'), nota: 'Mirar a partir de las 21:00.', pasada: true });
  pon('ideas', 'is2', { viaje: 'vis', titulo: 'Diamond Beach al amanecer', fuente: 'tiktok', url: 'https://www.tiktok.com/@ejemplo/video/4', imagen: F('isl_diamante'), autor: '@nordiclight' });
  pon('docs', 'ds1', { viaje: 'vis', tipo: 'vuelo', titulo: 'Madrid → Keflavík', cuando: I(0) + ' 06:20', codigo: 'FI597', detalles: '4 pasajeros' });
  pon('docs', 'ds2', { viaje: 'vis', tipo: 'coche', titulo: 'Alquiler 4x4', cuando: I(0) + ' 10:30', codigo: 'BLU-5521', detalles: 'Seguro de gravilla y ceniza incluido' });
  [['isl_hallgrim', 0], ['isl_laguna', 0], ['isl_geysir', 1], ['isl_valle', 1], ['isl_aurora_casa', 1], ['isl_seljaland', 2], ['isl_skogafoss', 2], ['isl_reynis', 2], ['isl_aurora_ruta', 2], ['isl_diamante', 3]]
    .forEach(([f, d], i) => pon('medios', 'ms' + i, { viaje: 'vis', dia: I(d), tipo: 'foto', demo: f, por: ['p1', 'p2', 'p3', 'p4'][i % 4] }));

  [['vkt', 'p3', 'ha añadido Mercado de Nishiki', 25], ['vkt', 'p2', 'ha subido 3 fotos de Fushimi Inari', 90], ['vkt', 'p1', 'ha marcado Ceremonia del té como hecho', 180], ['vkt', 'p3', 'ha guardado una idea de TikTok', 400], ['vkt', 'p4', 'se ha unido al viaje', 2900],
   ['vls', 'p2', 'ha subido la reserva del vuelo', 1300], ['vls', 'p3', 'ha guardado una idea de Instagram', 2100], ['vis', 'p4', 'ha subido las fotos de las auroras', 88000]]
    .forEach(([v, por, txt, min], i) => pon('actividad', 'ac' + i, { viaje: v, txt, por, cuando: Date.now() - min * 60000 }));
  S.seq = 1;
}

/* ---- 05_inicio.js ---- */
/* ============================ BIENVENIDA, CONEXIÓN E INICIO ============================ */

/* ---------- Pantalla de bienvenida */
PANT.bienvenida = {
  clase: 'o-oscura',
  render() {
    return `<div class="o-bien">
      <div class="o-bien-foto" data-e="foto" style="background-image:url(img/demo/viajera.jpg)"></div>
      <div class="o-bien-velo"></div>
      <div class="o-bien-cab" data-e>${logo(34, { clase: 'o-logo-bl' })}<span class="o-marca">orbeo</span></div>
      <div class="o-bien-c">
        <div class="o-cap o-claro" data-e>Viajes en grupo, día a día</div>
        <h1 class="o-t0 o-bien-t" data-e="titulo">Planead<br>juntos.<br>Viajad<br>ligeros.</h1>
        <p class="o-bien-p" data-e>El plan de cada día con sus horas, el mapa, las ideas que guardáis de TikTok o Instagram, las reservas y la película del día. Para todo el grupo y sin conexión.</p>
        <div class="o-bien-b">
          <button class="o-pil o-blanca t t-g" data-a="crear" data-e>Crear nuestro espacio</button>
          <button class="o-pil o-vido t t-g" data-a="unirse" data-e>Tengo una invitación</button>
          <button class="o-pil o-vido o-demo-b t" data-a="demo" data-e>${ic('play', 16)}Ver ejemplo de prueba</button>
        </div>
      </div></div>`;
  },
  acciones: {
    crear: () => Nav.ir('conectar', { modo: 'crear' }),
    unirse: () => Nav.ir('conectar', { modo: 'unirse' }),
    demo: async () => { S.cfg = { demo: true, persona: 'p1', rol: 'admin' }; await DB.set('cfg', S.cfg); crearDemo(); guardarLocal(true); Nav.raiz('inicio'); aviso('Ejemplo de prueba: tres viajes inventados. Lo que cambies se queda en este móvil.'); }
  }
};

/* ---------- Conectar: crear el espacio (con el código de alta) o unirse con una invitación */
PANT.conectar = {
  render(p) {
    const crear = p.modo === 'crear';
    p.color = p.color || COLORES[0];
    return `<div class="o-cont o-form">
      <div class="o-cab"><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button></div>
      <div class="o-cap" data-e style="margin-top:18px">${crear ? 'Paso único' : 'Invitación'}</div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:8px">${crear ? 'Vuestro espacio' : 'Únete al grupo'}</h1>
      <p class="o-txt" data-e style="margin-top:10px">${crear ? 'Se guarda en una hoja de Google tuya, con el script de Orbeo. Las instrucciones están en el paso a paso.' : 'Pega la invitación que te han enviado. Empieza por ORBEO1-.'}</p>
      ${crear ? `
        ${campo('esp', 'Nombre del espacio', 'Viajes con amigos', p.esp)}
        ${campo('url', 'Dirección del script', 'https://script.google.com/macros/s/…/exec', p.url, { ayuda: 'Acaba en /exec. Está en Implementar › Gestionar implementaciones.' })}
        ${campo('cod', 'Código de alta', 'ABCD-EFGH', p.cod, { ayuda: 'Sale en el registro del script al ejecutar «configurar».', mayus: true })}`
      : `${campo('inv', 'Invitación', 'ORBEO1-…', p.inv, { area: true })}
        <div class="o-inv-info" data-e>${p.info ? `<div class="o-fila"><div class="o-avs">${(p.info.personas || []).slice(0, 5).map(x => avatar(x)).join('')}</div><div><div class="o-t3">${esc((p.info.espacio && p.info.espacio.nombre) || p.espacio || 'Espacio')}</div><div class="o-nota">${(p.info.personas || []).length} personas · entras como ${p.info.rol === 'admin' ? 'administración' : p.info.rol === 'lector' ? 'solo lectura' : 'editor'}</div></div></div>` : ''}</div>`}
      ${campo('nom', 'Tu nombre', 'Nombre y apellido', p.nom)}
      <div class="o-campo" data-e><div class="o-etq">Tu color</div><div class="o-colores">${COLORES.map(c => `<button class="o-color t t-s${c === p.color ? ' o-on' : ''}" data-a="color" data-c="${c}" style="background:${c}"><span>${ic('check', 16, 2.2)}</span></button>`).join('')}</div></div>
      <div class="o-error" id="c-err"></div>
      <button class="o-pil t t-g" data-a="ok" data-e style="margin-top:22px">${crear ? 'Crear el espacio' : 'Unirme'}</button>
      <button class="o-enlace t" data-a="ayuda" data-e style="margin:18px auto 0;display:block">¿Dónde está todo esto?</button>
    </div>`;
  },
  alPintar(el, p) {
    if (p.modo !== 'crear') {
      const i = $('#f-inv', el);
      i && i.addEventListener('input', () => PANT.conectar.verInv(el, p));
      if (p.inv && !p.info) PANT.conectar.verInv(el, p);
    }
  },
  async verInv(el, p) {
    p.inv = $('#f-inv', el).value; const k = leerPaquete(p.inv);
    if (k.error) return;
    try {
      const r = await api('invitacion-ver', { codigo: k.codigo }, { url: k.url, sinToken: true });
      p.info = r; p.espacio = k.espacio;
      const box = $('.o-inv-info', el);
      const papel = r.rol === 'admin' ? 'administración' : r.rol === 'lector' ? 'solo lectura' : 'editor';
      box.innerHTML = r.persona
        ? `<div class="o-fila">${avatar(r.persona, 44)}<div><div class="o-t3">Entras como ${esc(r.persona.nombre)}</div><div class="o-nota">Este aparato se une a tu espacio con tus viajes y tu papel</div></div></div>`
        : `<div class="o-fila"><div class="o-avs">${(r.personas || []).slice(0, 5).map(x => avatar(x)).join('')}</div><div><div class="o-t3">${r.viaje ? esc(r.viaje.nombre) : esc((r.espacio && r.espacio.nombre) || k.espacio || 'Espacio')}</div><div class="o-nota">${r.viaje ? 'Te invitan a este viaje' : (r.personas || []).length + ' personas'} · entras como ${papel}</div></div></div>`;
      const nom = $('#f-nom', el); if (nom) nom.closest('.o-campo').style.display = r.persona ? 'none' : '';
      const col = $('.o-colores', el); if (col) col.closest('.o-campo').style.display = r.persona ? 'none' : '';
      animar(box, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: CURVA.muelle });
      if (r.persona) { $('#f-nom', el).value = r.persona.nombre; }
    } catch (e) { error(el, e.message); }
  },
  acciones: {
    color: (b, e, p) => { p.color = b.dataset.c; $$('.o-color', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.salto(b); },
    ayuda: () => ayudaScript(),
    ok: async (b, e, p, pa) => {
      const el = pa.el, v = id => ($('#f-' + id, el) || {}).value || '';
      const nom = v('nom').trim();
      if (!nom) { Anim.no($('#f-nom', el).parentNode); return error(el, 'Escribe tu nombre.'); }
      cargando(b, true);
      try {
        let url, codigo;
        if (p.modo === 'crear') {
          const u = urlScript(v('url')); if (u.error) throw ErrR('datos', u.error);
          url = u.url; codigo = v('cod');
          const h = await api('hola', {}, { url, sinToken: true });
          if (!h.configurado) throw ErrR('config', 'El script todavía no está configurado. En el editor, ejecuta «configurar».');
        } else {
          const k = leerPaquete(v('inv')); if (k.error) throw ErrR('datos', k.error);
          url = k.url; codigo = k.codigo;
        }
        const r = await api('unirse', { codigo, nombre: nom, color: p.color, espacio: p.modo === 'crear' ? { nombre: v('esp').trim() || 'Nuestros viajes' } : null }, { url, sinToken: true, ms: 60000 });
        S.cfg = { url, token: r.token, persona: r.persona, rol: r.rol, sid: r.sid };
        S.recs = {}; S.cola = {}; S.seq = 0; S.sid = r.sid;
        await DB.set('cfg', S.cfg);
        Nav.raiz('inicio');
        await Sync.ya();
        aviso(p.modo === 'crear' ? 'Espacio creado. Ya puedes crear el primer viaje.' : 'Ya estás dentro.');
      } catch (er) { error(el, er.message); Anim.no(b); }
      finally { cargando(b, false); }
    }
  }
};
function campo(id, etq, ph, val, o) {
  o = o || {};
  return `<label class="o-campo" data-e><span class="o-etq">${esc(etq)}</span>${o.area
    ? `<textarea id="f-${id}" class="o-in o-area" placeholder="${esc(ph)}" rows="${o.filas || 3}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(val || '')}</textarea>`
    : `<input id="f-${id}" class="o-in" type="${o.tipo || 'text'}" placeholder="${esc(ph)}" value="${esc(val || '')}" autocomplete="off" ${o.mayus ? 'autocapitalize="characters"' : o.tipo === 'url' ? 'autocapitalize="off"' : ''} ${o.extra || ''}>`}
    ${o.ayuda ? `<span class="o-nota o-ayuda">${esc(o.ayuda)}</span>` : ''}</label>`;
}
function error(el, msg) {
  const e = $('#c-err', el) || $('.o-error', el); if (!e) { aviso(msg); return; }
  e.textContent = msg;
  animar(e, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 360 });
}
function cargando(b, on) {
  if (!b) return;
  if (on) { b.dataset.txt = b.innerHTML; b.classList.add('o-cargando'); b.innerHTML = '<span class="o-giro"></span>'; b.disabled = true; }
  else if (b.dataset.txt != null) { b.innerHTML = b.dataset.txt; b.classList.remove('o-cargando'); b.disabled = false; delete b.dataset.txt; }
}
function ayudaScript() {
  Capa.hoja({
    html: `<div class="o-hcab"><div class="o-t2" data-e>Cómo se conecta</div></div>
    <ol class="o-pasos">
      ${['Crea una hoja de Google vacía y abre Extensiones › Apps Script.', 'Pega el archivo Codigo.gs del paquete y guarda.', 'Elige «configurar» arriba y pulsa Ejecutar. Acepta los permisos. En el registro sale tu código de alta.', 'Implementar › Nueva implementación › Aplicación web. Ejecutar como: yo. Quién tiene acceso: cualquier usuario.', 'Copia la dirección que acaba en /exec y pégala aquí con el código.']
        .map((t, i) => `<li data-e><span class="o-paso-n tn">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}
    </ol><p class="o-nota" data-e style="margin-top:14px">Para leer reservas y crear portadas con IA, añade tu clave de Gemini en el script: Configuración del proyecto › Propiedades del script › GEMINI_API_KEY.</p>`
  });
}

/* ---------- Inicio: los viajes */
PANT.inicio = {
  alVolver(el, p, pa) { if (pa.sucia) { pa.sucia = false; Nav.pintar(pa, false); } },
  render() {
    const vs = viajes().map(v => Object.assign(v, { _e: estadoViaje(v) }));
    const curso = vs.filter(v => v._e.e === 'curso'), fut = vs.filter(v => v._e.e === 'futuro'), pas = vs.filter(v => v._e.e === 'pasado').reverse();
    const heroe = curso[0] || fut[0] || null;
    const resto = curso.slice(1).concat(fut.filter(v => v !== heroe));
    const me = dato('personas', yo());
    const h = new Date().getHours();
    const saludo = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    return `<div class="o-cont o-ini">
      <div class="o-cab" data-e>
        <div class="o-fila" style="gap:9px">${logo(30)}<span class="o-marca">orbeo</span></div>
        <div class="o-fila" style="gap:8px">${puedoEditar() ? `<button class="o-bt o-borde t t-s" data-a="nuevo" aria-label="Nuevo viaje">${ic('plus')}</button>` : ''}
        <button class="o-bt t t-s" data-a="ajustes" aria-label="Ajustes">${me ? avatar(me, 40) : ic('settings')}</button></div>
      </div>
      <div class="o-ini-sal" data-e><div class="o-nota">${saludo}${me ? ', ' + esc(me.nombre.split(' ')[0]) : ''}</div><h1 class="o-t1" data-e="titulo">${heroe ? (heroe._e.e === 'curso' ? 'De viaje' : 'Lo próximo') : 'Tus viajes'}</h1></div>
      <div class="o-ini-rej">
      ${heroe ? tarjetaHeroe(heroe) : vacioInicio()}
      <div class="o-ini-lado">
      ${resto.length ? `<div class="o-sec" data-e><span class="o-cap">Próximos</span><span class="o-nota tn">${resto.length}</span></div>
        <div class="o-filas">${resto.map(filaViaje).join('')}</div>` : ''}
      ${borradores().length ? `<div class="o-sec" data-e><span class="o-cap">Borradores</span><span class="o-nota tn">${borradores().length}</span></div>
        <div class="o-filas">${borradores().map(filaBorrador).join('')}</div>` : ''}
      ${pas.length ? `<div class="o-sec" data-e><span class="o-cap">Recuerdos</span><span class="o-nota tn">${pas.length}</span></div>
        ${galeriaRecuerdos(pas)}` : ''}
      ${carpetasInicio()}
      </div></div>
    </div>`;
  },
  alEntrar(el) {
    $$('[data-cuenta]', el).forEach(n => Anim.contar(n, n.dataset.cuenta, 1100));
    /* Portadas y caras listas para cuando se abra un viaje */
    setTimeout(() => Fotos.varias(viajes().map(portadaUrl).concat(lista('personas').map(x => x.foto ? urlMedio(x.foto) : ''))), 300);
  },
  acciones: {
    abrir: (b, e) => abrirViaje(b.dataset.id, b, e),
    nuevo: () => editarViaje(null),
    borrador: (b) => editarViaje(null, { borrador: b.dataset.id }),
    quitarBorrador: async (b, e) => {
      e.stopPropagation();
      const id = b.dataset.id; borrar('borradores', id);
      aviso('Borrador borrado', { accion: { t: 'Deshacer', f: () => poner('borradores', id, { _b: 0 }) } });
    },
    ajustes: () => Nav.ir('ajustes'),
    archivados: () => Nav.ir('archivados'),
    papelera: () => Nav.ir('papelera', {})
  }
};
function borradores() { return lista('borradores', b => b.por === yo() || b._por === yo()).sort((a, b) => (b.cuando || 0) - (a.cuando || 0)); }
function filaBorrador(b) {
  const d = b.datos || {}, url = d.portada ? urlMedio(d.portada) : '';
  const cuando = b.cuando ? new Date(b.cuando) : null;
  return `<div class="o-filav o-bor" data-id="${b.id}" data-e>
    <button class="o-bor-a t" data-a="borrador" data-id="${b.id}">
      <span class="o-filav-f" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : ic('edit', 18)}</span>
      <span class="o-filav-t"><span class="o-t3">${esc(d.nombre || d.ciudad || 'Viaje sin nombre')}</span><span class="o-nota">Sin terminar${d.ciudad && d.nombre ? ' · ' + esc(d.ciudad) : ''}${cuando ? ' · ' + cuando.getDate() + ' ' + MESES[cuando.getMonth()].slice(0, 3) : ''}</span></span>
    </button>
    <button class="o-bt t t-s o-bor-x" data-a="quitarBorrador" data-id="${b.id}" aria-label="Borrar borrador">${ic('close', 16)}</button>
  </div>`;
}
function vacioInicio() {
  return `<div class="o-vacio-ini" data-e="heroe">
    <div class="o-vacio-orbe">${logo(120)}</div>
    <div class="o-t2" style="margin-top:22px">Vuestro primer viaje</div>
    <p class="o-txt" style="margin-top:8px">Ponle nombre, destino y fechas. Después añadís las paradas de cada día entre todos.</p>
    ${puedoEditar() ? `<button class="o-pil t t-g" data-a="nuevo" style="margin-top:22px">${ic('plus', 18, 2)}Crear un viaje</button>` : ''}
  </div>`;
}
function tarjetaHeroe(v) {
  const e = v._e, n = paradasDe(v.id).length, ni = lista('ideas', i => i.viaje === v.id).length;
  const etiqueta = e.e === 'curso' ? `En curso · Día ${e.dia} de ${e.total}` : `Próximo · ${rango(v.desde, v.hasta)}`;
  const grande = e.e === 'curso' ? [e.dia, 'día'] : [e.faltan, e.faltan === 1 ? 'día falta' : 'días faltan'];
  const url = portadaUrl(v);
  return `<button class="o-heroe t t-g" data-a="abrir" data-lp="viaje" data-id="${v.id}" data-e="heroe">
    <div class="o-heroe-foto" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : portadaVacia(v)}</div>
    <div class="o-heroe-velo"></div>
    <div class="o-heroe-arr"><span class="o-chip o-vido">${e.e === 'curso' ? '<span class="o-punto"></span>' : ''}${esc(etiqueta)}</span></div>
    <div class="o-heroe-txt">
      <div class="o-heroe-n">${esc(v.nombre)}</div>
      <div class="o-heroe-l">${esc(v.lugar || v.ciudad || '')}</div>
    </div>
    <div class="o-heroe-dat o-vido">
      <div class="o-dato"><span class="o-num tn" data-cuenta="${grande[0]}">${grande[0]}</span><span class="o-cap">${grande[1]}</span></div>
      <div class="o-dato"><span class="o-num tn" data-cuenta="${n}">${n}</span><span class="o-cap">paradas</span></div>
      <div class="o-dato"><span class="o-num tn" data-cuenta="${ni}">${ni}</span><span class="o-cap">ideas</span></div>
      <div class="o-avs">${personasViaje(v).slice(0, 4).map(p => avatar(p, 30)).join('')}</div>
    </div>
  </button>`;
}
function portadaVacia(v) { return `<div class="o-port-vacia"><span>${esc((v.nombre || '?').slice(0, 1))}</span></div>`; }
function filaViaje(v) {
  const e = v._e, url = portadaUrl(v);
  return `<button class="o-filav t" data-a="abrir" data-lp="viaje" data-id="${v.id}" data-e>
    <span class="o-filav-f" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : esc((v.nombre || '?')[0])}</span>
    <span class="o-filav-t"><span class="o-t3">${esc(v.nombre)}</span><span class="o-nota">${esc(rango(v.desde, v.hasta))} · ${esc(v.ciudad || v.lugar || '')}</span></span>
    <span class="o-filav-d"><span class="o-num tn">${e.e === 'curso' ? e.dia : e.faltan}</span><span class="o-cap">${e.e === 'curso' ? 'día' : 'días'}</span></span>
  </button>`;
}
/* Recuerdos en galería: el último viaje grande y los demás en mosaico de dos columnas con alturas distintas */
function galeriaRecuerdos(vs) {
  if (!vs.length) return '';
  const cols = [[], []]; vs.slice(1).forEach((v, i) => cols[i % 2].push(v));
  return `<div class="o-gal">${tarjetaRecuerdo(vs[0], 'g')}${cols.map((c, k) => c.length ? `<div class="o-gal-c">${c.map((v, i) => tarjetaRecuerdo(v, (i + k) % 2 ? 'b' : 'a')).join('')}</div>` : '').join('')}</div>`;
}
function fechaRecuerdo(v) { const f = fecha(v.desde); return f.getUTCFullYear() + ' · ' + cap(MESES[f.getUTCMonth()]); }
function tarjetaRecuerdo(v, t) {
  const url = portadaUrl(v), dias = diasDe(v).length;
  const datos = t === 'g'
    ? `<span class="o-rec-dat"><span><b class="tn">${dias}</b><i>${dias === 1 ? 'día' : 'días'}</i></span><span><b class="tn">${paradasDe(v.id).length}</b><i>paradas</i></span></span>`
    : `<span class="o-rec-s">${esc(v.lugar || v.ciudad || '')}</span>`;
  return `<button class="o-rec o-rec-${t || 'a'} t" data-a="abrir" data-lp="viaje" data-id="${v.id}" data-e="pop">
    <span class="o-rec-f" style="${url ? `background-image:url('${url}')` : ''}"></span>
    <span class="o-rec-ch tn">${esc(fechaRecuerdo(v))}</span>
    <span class="o-rec-t"><span class="o-rec-n">${esc(v.nombre)}</span>${datos}</span>
  </button>`;
}
function abrirViaje(id, b, e) {
  const foto = b && $('.o-heroe-foto,.o-filav-f,.o-rec-f', b);
  const v = dato('viajes', id);
  const x = e && e.clientX != null ? e.clientX : innerWidth / 2, y = e && e.clientY != null ? e.clientY : innerHeight / 2;
  Nav.ir('viaje', { id, tab: 'plan' }, { circulo: { x, y }, vuela: foto && portadaUrl(v) ? { desde: foto, hacia: '.o-vcab-foto', caja: '.o-vcab', imagen: portadaUrl(v) } : null });
}

/* ---------- Crear o editar un viaje (hoja) */
function editarViaje(v, o) {
  o = o || {};
  const nuevoV = !v;
  const bor = o.borrador ? dato('borradores', o.borrador) : null;
  let hecho = false, fotoT = null;
  const f = v ? JSON.parse(JSON.stringify(v)) : bor ? JSON.parse(JSON.stringify(bor.datos || {})) : { nombre: '', ciudad: '', lugar: '', desde: sumaDias(enZona(TZ_CASA()).dia, 30), hasta: sumaDias(enZona(TZ_CASA()).dia, 36), tz: '', moneda: 'EUR', quienes: lista('personas').map(p => p.id) };
  let sugT = null;
  const vistaPortada = () => {
    const u = f.portada ? urlMedio(f.portada) : '';
    return `<div class="o-port-prev" style="${u ? `background-image:url('${u}')` : ''}">${u ? '' : `<span class="o-nota">${f.ciudad ? 'Buscando foto…' : 'Elige destino y saldrá una foto'}</span>`}</div>`;
  };
  const c = Capa.hoja({
    clase: 'o-hoja-alta',
    html: `<div class="o-hcab" data-e><button class="o-enlace t" data-a="cerrar">Cancelar</button><div class="o-t3">${nuevoV ? 'Nuevo viaje' : 'Editar viaje'}</div><button class="o-enlace t" data-a="guardar">${nuevoV ? 'Crear' : 'Guardar'}</button></div>
      <div class="o-hoja-scroll">
      <div class="o-port" data-e>${vistaPortada()}
        <div class="o-port-ops">
          <button class="o-chip o-vido t" data-a="pfoto">${ic('image', 16)}Foto del lugar</button>
          <button class="o-chip o-vido t" data-a="pia">${ic('spark', 16)}Crear con IA</button>
          <button class="o-chip o-vido t" data-a="ppropia">${ic('camera', 16)}Mi foto</button>
        </div></div>
      ${campo('vn', 'Nombre del viaje', 'Japón', f.nombre)}
      <label class="o-campo" data-e><span class="o-etq">Destino</span><input id="f-vd" name="orbeo-destino" type="search" enterkeyhint="search" class="o-in" placeholder="Ciudad o región" value="${esc(f.ciudad || '')}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false"><div class="o-sugs" id="v-sugs"></div></label>
      ${campo('vl', 'Ruta', 'Tokio, Hakone y Kioto', f.lugar)}
      <div class="o-dos" data-e>${campo('vde', 'Desde', '', f.desde, { tipo: 'date' })}${campo('vha', 'Hasta', '', f.hasta, { tipo: 'date' })}</div>
      <div class="o-campo" data-e><span class="o-etq">Hora del destino</span><div class="o-zona" id="v-zona">${zonaTxt(f.tz)}</div></div>
      <div class="o-campo" data-e><span class="o-etq">Quién va</span><div class="o-quien">${lista('personas').map(p => `<button class="o-quien-p t t-s${f.quienes.indexOf(p.id) >= 0 ? ' o-on' : ''}" data-a="quien" data-id="${p.id}">${avatar(p, 44)}<span>${esc(p.nombre.split(' ')[0])}</span></button>`).join('')}</div></div>
      <div class="o-error" id="c-err"></div>
      ${!nuevoV && soyAdmin() ? `<button class="o-pil o-sec o-pmal-t t" data-a="borrar" data-e style="margin-top:26px">${ic('trash', 18)}Borrar el viaje</button>` : ''}
      </div>`,
    alAbrir: (h) => {
      const i = $('#f-vd', h);
      i.addEventListener('input', () => {
        clearTimeout(sugT); sugT = setTimeout(async () => pintarSugs(h, await Lugar.buscar(i.value, { ciudades: true })), 260);
        /* Aunque no elijas ninguna sugerencia, sale la foto de lo que has escrito */
        clearTimeout(fotoT);
        const q = i.value.trim();
        if (q.length >= 3 && (!f.portada || f.portadaAuto)) fotoT = setTimeout(() => PANT_portadaLugar(f, { n: q }, () => { if (i.value.trim() !== q) return; f.portadaAuto = true; ponerPortada(h); }), 900);
      });
    },
    antesCerrar: async () => {
      if (hecho || !nuevoV) return true;
      leer(c.hoja);
      if (!(f.nombre || f.ciudad || f.lugar || f.portada)) { if (bor) borrar('borradores', bor.id); return true; }
      const r = await Capa.preguntar({ titulo: bor ? '¿Guardas los cambios del borrador?' : '¿Guardar como borrador?', texto: 'Lo tendrás en el inicio para terminarlo cuando quieras.', ops: [{ k: 'guardar', t: 'Guardar borrador', ic: 'download' }, { k: 'borrar', t: bor ? 'Borrar el borrador' : 'Borrar', clase: 'o-sec o-pmal-t', ic: 'trash' }, { k: 'seguir', t: 'Seguir editando', clase: 'o-sec' }] });
      if (r === 'guardar') {
        const datos = JSON.parse(JSON.stringify(f));
        if (bor) poner('borradores', bor.id, { datos, cuando: Date.now() }); else nuevo('borradores', { datos, cuando: Date.now() });
        aviso('Guardado en borradores', { ic: 'check' });
        return true;
      }
      if (r === 'borrar') { if (bor) { borrar('borradores', bor.id); aviso('Borrador borrado'); } return true; }
      return false;
    },
    acciones: {
      sug: async (b) => {
        const s = await Lugar.completar(JSON.parse(b.dataset.j));
        const h = c.hoja; $('#f-vd', h).value = s.n; $('#v-sugs', h).innerHTML = '';
        f.ciudad = s.n; f.lat = s.lat; f.lng = s.lng; f.pais = s.pais || f.pais;
        const cerca = s.tz ? { tz: s.tz } : (s.lat != null ? ciudadCercana(s.lat, s.lng) : null);
        f.tz = (cerca && cerca.tz) || f.tz; f.moneda = monedaDe(f.pais || (cerca && cerca.pais));
        if (!$('#f-vn', h).value) $('#f-vn', h).value = s.n;
        $('#v-zona', h).innerHTML = zonaTxt(f.tz); animar($('#v-zona', h), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        clearTimeout(fotoT);
        if (!f.portada || f.portadaAuto) PANT_portadaLugar(f, s, () => { f.portadaAuto = true; ponerPortada(h); });
      },
      pfoto: (b) => {
        const n = f.ciudad || $('#f-vd', c.hoja).value.trim() || $('#f-vn', c.hoja).value.trim();
        if (!n) return aviso('Escribe primero el destino.');
        cargando(b, true);
        PANT_portadaLugar(f, { n, lat: f.lat, lng: f.lng, pid: f.pid }, () => { f.portadaAuto = true; ponerPortada(c.hoja); }).then(() => { cargando(b, false); if (!f.portada) aviso('No he encontrado foto de «' + n + '». Prueba con «Crear con IA» o «Mi foto».'); });
      },
      pia: async (b) => {
        if (!Sync.activo()) return aviso('Crear portadas con IA necesita el script con tu clave de Gemini.');
        cargando(b, true);
        try {
          const r = await api('portada', { destino: f.ciudad || $('#f-vd', c.hoja).value, nombre: $('#f-vn', c.hoja).value, ruta: $('#f-vl', c.hoja).value }, { ms: 90000 });
          const bin = atob(r.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const blob = new Blob([u], { type: r.tipo || 'image/png' });
          const id = 'm' + uid(); await DB.set('med:' + id, blob); S.imgs[id] = URL.createObjectURL(blob);
          f.portada = { id, fid: r.fid }; f.portadaAuto = false;
          $('.o-port-prev', c.hoja).outerHTML = vistaPortada();
          Anim.circulo($('.o-port-prev', c.hoja), 180, 110, 900);
        } catch (e) { aviso(e.message); } finally { cargando(b, false); }
      },
      ppropia: async () => {
        const [file] = await elegirArchivos('image/*'); if (!file) return;
        const blob = await reducir(file, 1800, .86);
        const id = await Subidas.guardar(blob, 'portada.jpg');
        f.portada = { id }; f.portadaAuto = false;
        $('.o-port-prev', c.hoja).outerHTML = vistaPortada();
        animar($('.o-port-prev', c.hoja), [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: CURVA.muelle });
      },
      quien: (b) => { const id = b.dataset.id, i = f.quienes.indexOf(id); if (i >= 0) f.quienes.splice(i, 1); else f.quienes.push(id); b.classList.toggle('o-on', i < 0); Anim.salto($('.o-av', b)); },
      borrar: async () => {
        if (!(await Capa.confirmar({ titulo: '¿Borrar «' + v.nombre + '»?', texto: 'Va a la papelera del inicio con sus paradas, ideas y documentos. Puedes recuperarlo durante 30 días.', si: 'Borrar', peligro: true }))) return;
        borrar('viajes', v.id); c.cerrar(); Nav.raiz('inicio'); aviso('Viaje en la papelera', { accion: { t: 'Deshacer', f: () => restaurar('viajes', v.id) } });
      },
      guardar: async (b) => {
        const h = c.hoja;
        leer(h);
        if (!f.nombre) { Anim.no($('#f-vn', h).parentNode); return error(h, 'Ponle un nombre al viaje.'); }
        if (!f.desde) { Anim.no($('#f-vde', h).parentNode); return error(h, 'Falta la fecha de salida.'); }
        if (!f.hasta || f.hasta < f.desde) f.hasta = f.desde;
        /* Destino escrito sin elegir sugerencia: se busca igualmente para saber su hora y su moneda */
        if (!f.tz && f.ciudad && f.lat == null) { cargando(b, true); try { const s1 = (await Lugar.buscar(f.ciudad, { ciudades: true }))[0]; if (s1 && s1.lat != null) { f.lat = s1.lat; f.lng = s1.lng; f.pais = s1.pais || ''; const cc0 = s1.tz ? s1 : ciudadCercana(s1.lat, s1.lng); if (cc0 && cc0.tz) f.tz = cc0.tz; f.moneda = monedaDe(f.pais || (cc0 && cc0.pais)); } } catch (e) { } cargando(b, false); }
        if (!f.tz) { const cc = buscarCiudades(f.ciudad)[0]; f.tz = cc ? cc.tz : TZ_CASA(); if (cc) { f.lat = cc.lat; f.lng = cc.lng; f.pais = cc.pais; f.moneda = monedaDe(cc.pais); } }
        const campos = { nombre: f.nombre, lugar: f.lugar, ciudad: f.ciudad, desde: f.desde, hasta: f.hasta, tz: f.tz, moneda: f.moneda || 'EUR', pais: f.pais || '', lat: f.lat ?? null, lng: f.lng ?? null, quienes: f.quienes, portada: f.portada || null };
        let id = v && v.id;
        if (nuevoV) { id = nuevo('viajes', campos); actividad(id, 'ha creado el viaje'); if (bor) borrar('borradores', bor.id); }
        else poner('viajes', id, campos);
        /* Si todavía no hay portada, se busca la foto del destino después */
        if (!campos.portada && f.ciudad) { const vid = id; Lugar.foto({ n: f.ciudad, lat: f.lat, lng: f.lng, pid: f.pid }).then(u => { if (u && dato('viajes', vid) && !dato('viajes', vid).portada) poner('viajes', vid, { portada: { url: u } }); }).catch(() => { }); }
        hecho = true;
        c.cerrar(true);
        if (nuevoV) setTimeout(() => Nav.ir('viaje', { id, tab: 'plan' }, { circulo: { x: innerWidth / 2, y: innerHeight * .4 } }), 260);
      }
    }
  });
  function leer(h) {
    const val = id => ($('#f-' + id, h) || {}).value ? $('#f-' + id, h).value.trim() : '';
    f.nombre = val('vn'); f.lugar = val('vl'); f.desde = val('vde') || f.desde; f.hasta = val('vha') || f.hasta;
    const d = val('vd'); if (d !== (f.ciudad || '')) { f.ciudad = d; }
  }
  function ponerPortada(h) {
    const p = $('.o-port-prev', h); if (!p) return;
    p.outerHTML = vistaPortada();
    animar($('.o-port-prev', h), [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: CURVA.heroe });
  }
  function pintarSugs(h, ls) {
    const box = $('#v-sugs', h);
    const q = ($('#f-vd', h) || {}).value || '';
    box.innerHTML = ls.length ? ls.map(s => `<button class="o-sug t" data-a="sug" data-j='${esc(JSON.stringify(s))}'>${ic('pin', 18)}<span><span>${esc(s.n)}</span><span class="o-nota">${esc(s.sub || '')}</span></span></button>`).join('')
      : q.trim().length >= 3 ? `<div class="o-nota o-sug-nada">Aquí va la ciudad o la región del viaje (Tokio, Japón…). Los hoteles, restaurantes y sitios se añaden después como paradas, dentro del viaje.</div>` : '';
    $$('.o-sug', box).forEach((x, i) => animar(x, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 40 }));
  }
}
function zonaTxt(tz) {
  if (!tz) return '<span class="o-nota">Se pone sola al elegir el destino</span>';
  const casa = TZ_CASA();
  return `<span>${ic('clock', 18)}${esc(nombreZona(tz))} <b class="tn">${enZona(tz).hora}</b></span><span class="o-nota">${tz === casa || desfase(tz) === desfase(casa) ? 'La misma hora que tú' : difHoras(tz, casa) + ' respecto a ' + esc(nombreZona(casa))}</span>`;
}
/* Portada por defecto: la foto real del lugar (Google si hay clave; si no, Wikipedia) */
async function PANT_portadaLugar(f, s, listo) {
  try {
    const u = await Lugar.foto(s);
    if (u && !(f.portada && f.portada.url === u)) { f.portada = { url: u }; listo(); }
  } catch (e) { anotar('portada', e); }
}

/* ---- 06_viaje.js ---- */
/* ============================ VIAJE ============================
   Una pantalla con cuatro pestañas (Plan, Mapa, Ideas, Docs) y la barra flotante de cristal.
   En el ordenador, el plan y el mapa van uno al lado del otro. */
const TABS = {};
const TAB_LISTA = [['plan', 'Plan', 'plan'], ['mapa', 'Mapa', 'map'], ['ideas', 'Ideas', 'idea'], ['docs', 'Docs', 'doc']];

PANT.viaje = {
  clase: 'o-pviaje',
  render(p) {
    const v = dato('viajes', p.id);
    if (!v) return `<div class="o-cont"><div class="o-cab"><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button></div><div class="o-vacio" style="margin-top:30vh"><div class="o-t2">Este viaje ya no está</div><p class="o-nota">Puede que alguien lo haya borrado.</p></div></div>`;
    p.tab = p.tab || 'plan';
    if (ESCRITORIO() && p.tab === 'mapa') p.tab = 'plan';
    return `<div class="o-vt" data-tab="${p.tab}">${TABS[p.tab].render(v, p)}</div>${barraTabs(p.tab)}`;
  },
  alPintar(el, p, primera, pa) {
    const v = dato('viajes', p.id); if (!v) return;
    const t = TABS[p.tab];
    t.alPintar && t.alPintar($('.o-vt', el), v, p, primera, pa);
    Anim.pildora($('.o-tabs', el), $('.o-tab.o-on', el));
  },
  alEntrar(el, p, pa) { $$('[data-cuenta]', el).forEach(n => Anim.contar(n, n.dataset.cuenta)); setTimeout(() => Fotos.varias(fotosViaje(p.id)), 700); },
  alVolver(el, p, pa) { if (pa.sucia) { pa.sucia = false; Nav.pintar(pa, false); } },
  alSalir(el, p) { Mapa.desmontar(el); },
  alMinuto(el, p, pa) { if (p.tab === 'plan') Nav.refrescar(); },
  alDeslizar(el, pa) { const t = TABS[pa.p.tab]; t && t.alDeslizar && t.alDeslizar(el, pa.p); },
  scrollInterno(el) { const d = $('.o-dias', el); return d ? d.scrollLeft : null; },
  restaurarScroll(el, x) { const d = $('.o-dias', el); if (d) d.scrollLeft = x; },
  acciones: {}
};
/* Todas las fotos de un viaje, para tenerlas listas al cambiar de día o de pestaña */
function fotosViaje(vid) {
  const us = [];
  paradasDe(vid).forEach(x => (x.fotos || []).forEach(m => us.push(urlMedio(m))));
  lista('ideas', i => i.viaje === vid).forEach(i => us.push(urlMedio(i.imagen)));
  lista('medios', m => m.viaje === vid).forEach(m => us.push(urlMedio(m)));
  return us.filter(Boolean);
}
function barraTabs(on) {
  return `<nav class="o-tabs o-vid" data-e="pop" data-d="200"><span class="o-pild"></span>${TAB_LISTA.filter(t => !(ESCRITORIO() && t[0] === 'mapa')).map(([id, n, i]) => `<button class="o-tab t t-s${id === on ? ' o-on' : ''}" data-a="tab" data-t="${id}" aria-label="${n}">${ic(i, 21, 1.7)}<span class="o-tab-n">${n}</span></button>`).join('')}</nav>`;
}
/* Cambio de pestaña: la píldora se desliza, la vieja se funde subiendo y la nueva entra escalonada */
PANT.viaje.acciones.tab = async (b, e, p, pa) => {
  const t = b.dataset.t; if (t === p.tab) { pa.el.scrollTo({ top: 0, behavior: reducido() ? 'auto' : 'smooth' }); return; }
  if (pa.cambiando) return; pa.cambiando = true;
  const el = pa.el, vt = $('.o-vt', el);
  p.scroll = p.scroll || {}; p.scroll[p.tab] = el.scrollTop;
  $$('.o-tab', el).forEach(x => x.classList.toggle('o-on', x === b));
  Anim.pildora($('.o-tabs', el), b);
  const v = dato('viajes', p.id);
  const html = TABS[t].render(v, p);
  /* Fundido corto: la vieja se va en 140 ms mientras se preparan las fotos de la nueva; nada se queda en blanco */
  await Promise.all([animar(vt, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: CURVA.salir }), Fotos.varias(urlsDe(html), 300)]);
  Mapa.desmontar(el);
  p.tab = t;
  vt.dataset.tab = t;
  vt.innerHTML = html;
  el.scrollTop = (p.scroll[t] || 0);
  TABS[t].alPintar && TABS[t].alPintar(vt, v, p, true, pa);
  Anim.pildoras(vt);
  await animar(vt, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: CURVA.entrar });
  $$('[data-cuenta]', vt).forEach(n => Anim.contar(n, n.dataset.cuenta));
  pa.cambiando = false;
};
/* Las fotos que lleva un trozo de HTML (para prepararlas antes de enseñarlo) */
function urlsDe(html) { const r = [], re = /url\(['"]?([^'")]+)/g; let m; while ((m = re.exec(html)) && r.length < 12) r.push(m[1]); return r; }
PANT.viaje.acciones.mas = (b, e, p) => {
  const v = dato('viajes', p.id);
  Capa.menu(b, [
    { t: 'Película del día', ic: 'film', f: () => Nav.ir('pelicula', { id: v.id, dia: p.dia || hoyEn(v) }) },
    { t: 'Hora y moneda', ic: 'globe', f: () => Nav.ir('hora', { id: v.id }) },
    soyAdmin() ? { t: 'Compartir este viaje', ic: 'share', f: () => invitar(v.id, { soloViaje: true }) } : null,
    { t: 'Grupo e invitaciones', ic: 'users', f: () => Nav.ir('grupo', { id: v.id }) },
    '-',
    puedoEditar() ? { t: 'Editar el viaje', ic: 'edit', f: () => editarViaje(v) } : null,
    puedoEditar() ? { t: v.archivado ? 'Sacar de archivados' : 'Archivar el viaje', ic: 'archive', f: () => archivarViaje(v.id, !v.archivado) } : null,
    { t: 'Papelera' + (papeleraViaje(v.id).length ? ' · ' + papeleraViaje(v.id).length : ''), ic: 'trash', f: () => Nav.ir('papelera', { viaje: v.id }) },
    { t: 'Ajustes', ic: 'settings', f: () => Nav.ir('ajustes') }
  ].filter(Boolean));
};
PANT.viaje.acciones.hora = (b, e, p) => Nav.ir('hora', { id: p.id });
PANT.viaje.acciones.papeleraV = (b, e, p) => Nav.ir('papelera', { viaje: p.id });
PANT.viaje.acciones.grupo = (b, e, p) => Nav.ir('grupo', { id: p.id });

/* Cabecera con la portada (común a las pestañas) */
function cabViaje(v, o) {
  o = o || {};
  const url = portadaUrl(v), casa = TZ_CASA(), mismo = !v.tz || desfase(v.tz) === desfase(casa);
  const ps = personasViaje(v);
  return `<header class="o-vcab${o.baja ? ' o-baja' : ''}">
    <div class="o-vcab-foto" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : portadaVacia(v)}</div>
    <div class="o-vcab-velo"></div>
    <div class="o-vcab-bar">
      <button class="o-bt o-vido t t-s" data-a="atras" aria-label="Volver">${ic('back', 20)}</button>
      <button class="o-chip o-vido t" data-a="hora">${ic('clock', 15)}<span>${esc(nombreZona(v.tz))} <b class="tn" data-reloj="${esc(v.tz || casa)}">${enZona(v.tz || casa).hora}</b></span>${mismo ? '' : `<span class="o-chip-sep"></span><span>${esc(nombreZona(casa))} <b class="tn" data-reloj="${esc(casa)}">${enZona(casa).hora}</b></span>`}</button>
      <button class="o-bt o-vido t t-s" data-a="mas" aria-label="Más">${ic('more', 20, 2.4)}</button>
    </div>
    <div class="o-vcab-txt">
      <div class="o-vcab-fecha" data-e><span class="o-chip o-vido">${ic('plan', 14, 1.9)}${esc(rango(v.desde, v.hasta))}<span class="o-chip-sep"></span>${diasDe(v).length} días</span></div>
      <h1 class="o-vcab-n" data-e="titulo">${esc(v.nombre)}</h1>
      <div class="o-fila o-vcab-pie" data-e><span>${esc(v.lugar || v.ciudad || '')}</span><button class="o-avs t" data-a="grupo">${ps.slice(0, 5).map(x => avatar(x, 28)).join('')}</button></div>
    </div>
  </header>`;
}

/* ============================ PESTAÑA PLAN ============================ */
TABS.plan = {
  render(v, p) {
    const dias = diasDe(v), hoy = hoyEn(v);
    p.vista = p.vista || S.pref.vistaPlan || 'lista';
    if (!p.dia || dias.indexOf(p.dia) < 0) p.dia = dias.indexOf(hoy) >= 0 ? hoy : dias[0];
    const ps = paradasDe(v.id, p.dia);
    const n = dias.indexOf(p.dia) + 1;
    const ah = paradaAhora(v, p.dia, ps);
    const t = Tiempo.de(v, p.dia);
    const fotosDia = lista('medios', m => m.viaje === v.id && m.dia === p.dia).length + ps.reduce((a, x) => a + (x.fotos ? x.fotos.length : 0), 0);
    const plan = `
      ${cabViaje(v)}
      <div class="o-plan">
      <div class="o-dias" data-e><span class="o-pild"></span>${dias.map((d, i) => {
        const tiene = paradasDe(v.id, d).length;
        return `<button class="o-dia t t-s${d === p.dia ? ' o-on' : ''}${d === hoy ? ' o-hoy' : ''}" data-a="dia" data-d="${d}"><span class="o-dia-s">${'DLMXJVS'[fecha(d).getUTCDay()]}</span><span class="o-dia-n tn">${fecha(d).getUTCDate()}</span><span class="o-dia-p${tiene ? ' o-si' : ''}"></span></button>`;
      }).join('')}</div>
      <div class="o-dcab" data-e>
        <div class="o-dcab-n tn" data-v="${fecha(p.dia).getUTCDate()}">${fecha(p.dia).getUTCDate()}</div>
        <div class="o-dcab-t"><div class="o-dcab-s">${cap(diaSemana(p.dia))}${p.dia === hoy ? ' <span class="o-hoy-et">hoy</span>' : ''}</div>
        <div class="o-cap">${esc(MESES[fecha(p.dia).getUTCMonth()])} · Día ${n} de ${dias.length}${t ? ` · <span class="o-tiempo">${t.ic} ${t.max}°</span>` : ''}</div></div>
        <div class="o-vista"><span class="o-pild"></span><button class="o-vista-b t t-s${p.vista !== 'cal' ? ' o-on' : ''}" data-a="vista" data-v="lista" aria-label="Itinerario">${ic('list', 19, 1.8)}</button><button class="o-vista-b t t-s${p.vista === 'cal' ? ' o-on' : ''}" data-a="vista" data-v="cal" aria-label="Calendario">${ic('cal', 19, 1.7)}</button></div>
      </div>
      ${p.vista === 'cal' ? calDia(v, p.dia, ps) : `<div class="o-linea-t" data-dia="${p.dia}">
        ${ps.length ? ps.map((x, i) => filaParada(x, i, ps, ah, v)).join('') : `<div class="o-vacio-dia" data-e="pop"><div class="o-vacio-dia-o">${ic('plan', 26, 1.5)}</div><div class="o-t3">Día libre</div><p class="o-nota">${puedoEditar() ? 'Añade la primera parada o pasa una idea guardada.' : 'Todavía no hay nada planeado.'}</p></div>`}
      </div>`}
      ${puedoEditar() ? `<div class="o-plan-b" data-e><button class="o-pil o-sec t t-g" data-a="nuevaParada">${ic('plus', 18, 2)}Añadir parada</button>${lista('ideas', i => i.viaje === v.id && !i.parada).length ? `<button class="o-pil o-sec t t-g" data-a="deIdea">${ic('idea', 17)}De una idea</button>` : ''}</div>` : ''}
      <button class="o-peli t t-g" data-a="peli" data-e>
        <span class="o-peli-fs">${(lista('medios', m => m.viaje === v.id && m.dia === p.dia).slice(0, 3).map(m => `<span style="background-image:url('${urlMedio(m)}')"></span>`).join('')) || `<span class="o-peli-v">${ic('film', 22, 1.5)}</span>`}</span>
        <span class="o-peli-t"><span class="o-t3">Película del día</span><span class="o-nota">${fotosDia ? fotosDia + (fotosDia === 1 ? ' foto' : ' fotos') + ', se monta sola' : 'Añade fotos y se monta sola'}</span></span>
        <span class="o-bt o-lleno">${ic('play', 16, 2)}</span>
      </button>
      <button class="o-carp-v t" data-a="papeleraV" data-e>${ic('trash', 16, 1.7)}Papelera del viaje${papeleraViaje(v.id).length ? ' · ' + papeleraViaje(v.id).length : ''}</button>
      </div>`;
    if (ESCRITORIO()) return `<div class="o-esc"><div class="o-esc-plan">${plan}</div><div class="o-esc-mapa"><div class="o-mapa" id="mapa-esc" data-fijo></div></div></div>`;
    return plan;
  },
  alPintar(el, v, p, primera, pa) {
    const vi = $('.o-vista', el); if (vi) Anim.pildora(vi, $('.o-vista-b.o-on', vi));
    const dias = $('.o-dias', el), on = $('.o-dia.o-on', el);
    if (dias && on) {
      Anim.pildora(dias, on);
      if (primera) dias.scrollLeft = Math.max(0, on.offsetLeft - dias.clientWidth / 2 + on.offsetWidth / 2);
    }
    if (ESCRITORIO()) Mapa.montar($('#mapa-esc', el), v, p.dia, { escritorio: true });
    Tiempo.pedir(v);
  },
  alDeslizar(el, p) {
    const f = $('.o-vcab-foto', el); if (!f || reducido()) return;
    const y = (ESCRITORIO() ? ($('.o-esc-plan', el) || el) : el).scrollTop;
    /* Solo un poco de profundidad: la foto se queda algo atrás, sin girar ni encogerse */
    f.style.transform = y > 0 ? `translateY(${Math.min(y, 500) * .25}px)` : '';
    const tx = $('.o-vcab-txt', el); if (tx) tx.style.opacity = Math.max(0, 1 - y / 300);
  }
};
/* ---------- Vista calendario: el día en horas, como una agenda. Cada parada ocupa su rato. */
const COLOR_CAT = { visita: '#A8834F', comida: '#C0614A', actividad: '#6F8A4E', transporte: '#4F7398', vuelo: '#5B6FA8', hotel: '#8A5F8F', compras: '#B5577A', noche: '#465284', naturaleza: '#3F8A69' };
const COLOR_PROPIA = ['#9A6B3F', '#5E7F8C', '#8C6A9E', '#A0563F', '#4F8A5B', '#7A7442'];
function colorCat(k) {
  if (COLOR_CAT[k]) return COLOR_CAT[k];
  let h = 0; String(k || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) | 0; });
  return COLOR_PROPIA[Math.abs(h) % COLOR_PROPIA.length];
}
const CAL_H = 64;
function calDia(v, dia, ps) {
  const conHora = ps.filter(x => minutos(x.hora) != null), sin = ps.filter(x => minutos(x.hora) == null);
  const ev = conHora.map((x, i) => {
    const a = minutos(x.hora); let b = minutos(x.fin);
    if (b == null || b <= a) { const sig = conHora[i + 1]; b = sig && minutos(sig.hora) > a ? Math.min(minutos(sig.hora), a + 120) : a + 60; }
    if (b - a < 40) b = a + 40;
    return { x, a, b };
  });
  let ini = 8 * 60, fin = 22 * 60;
  ev.forEach(e => { ini = Math.min(ini, Math.floor(e.a / 60) * 60); fin = Math.max(fin, Math.ceil(e.b / 60) * 60); });
  fin = Math.min(fin, 24 * 60);
  /* Si dos paradas se pisan, se reparten el ancho */
  const grupos = []; let g = null, gfin = -1;
  ev.slice().sort((p, q) => p.a - q.a).forEach(e => { if (!g || e.a >= gfin) { g = []; grupos.push(g); gfin = e.b; } else gfin = Math.max(gfin, e.b); g.push(e); });
  grupos.forEach(gr => { const cols = []; gr.forEach(e => { let c = cols.findIndex(f => f <= e.a); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = e.b; e.col = c; }); gr.forEach(e => { e.n = cols.length; }); });
  const y = m => (m - ini) / 60 * CAL_H;
  const ahora = hoyEn(v) === dia ? enZona(v.tz).min : null;
  const horas = []; for (let h = ini / 60; h <= fin / 60; h++) horas.push(h);
  return `<div class="o-cal" data-dia="${dia}">
    ${sin.length ? `<div class="o-cal-sin" data-e><span class="o-cap">Sin hora</span>${sin.map(x => `<button class="o-cal-chip t" data-a="parada" data-lp="parada" data-id="${x.id}" style="--cc:${colorCat(x.tipo)}"><span class="o-cal-pt"></span><span class="o-1l">${esc(x.nombre)}</span></button>`).join('')}</div>` : ''}
    <div class="o-cal-g" data-e data-a="${puedoEditar() ? 'calHueco' : ''}" data-ini="${ini}" style="height:${y(fin) + 8}px">
      ${horas.map(h => `<div class="o-cal-h" style="top:${y(h * 60)}px"><span class="tn">${String(h).padStart(2, '0')}:00</span></div>`).join('')}
      <div class="o-cal-evs">
      ${ev.map(e => {
        const x = e.x, foto = fotoParada(x, 330), alto = y(e.b) - y(e.a) - 4;
        return `<button class="o-cal-ev t${x.hecho ? ' o-hecho' : ''}${alto < 54 ? ' o-corto' : ''}" data-a="parada" data-lp="parada" data-id="${x.id}" data-e="pop" style="--cc:${colorCat(x.tipo)};top:${y(e.a) + 2}px;height:${alto}px;left:calc(${e.col} * 100% / ${e.n});width:calc(100% / ${e.n} - 4px)">
          ${foto && alto >= 54 && e.n < 3 ? `<span class="o-cal-f" style="background-image:url('${foto}')"></span>` : ''}
          <span class="o-cal-tx"><span class="o-cal-n">${esc(x.nombre)}</span><span class="o-cal-s tn">${esc(x.hora)}${x.fin ? ' – ' + esc(x.fin) : ''}${alto >= 70 && x.lugar && x.lugar.dir ? ' · ' + esc(x.lugar.dir.split(',')[0]) : ''}</span></span>
        </button>`;
      }).join('')}
      </div>
      ${ahora != null && ahora >= ini && ahora <= fin ? `<div class="o-cal-ya" style="top:${y(ahora)}px"><span></span></div>` : ''}
    </div>
    ${!ps.length ? `<p class="o-nota o-cal-pista" data-e>${puedoEditar() ? 'Toca una hora para añadir una parada.' : 'Todavía no hay nada planeado.'}</p>` : ''}
  </div>`;
}
function filaParada(x, i, ps, ah, v) {
  const foto = fotoParada(x, 330), tp = tipoDe(x.tipo);
  const es = i === ah.idx, pasado = x.hecho;
  const sig = ps[i + 1], tr = sig ? trayecto(x.lugar, sig.lugar) : null;
  const ent = tr ? `<div class="o-tray" data-e><span class="o-tray-l"></span><span class="o-tray-c">${ic(tr.modo === 'pie' ? 'walk' : tr.modo === 'tren' ? 'train' : 'bus', 14, 1.8)}${tr.modo === 'pie' ? 'A pie' : tr.modo === 'tren' ? 'En tren' : 'En transporte'} · ${duracion(tr.min)}</span></div>` : (sig ? '<div class="o-tray o-tray-v" data-e><span class="o-tray-l"></span></div>' : '');
  const nodo = `<button class="o-nodo t t-s${pasado ? ' o-hecho' : ''}" data-a="hecho" data-id="${x.id}" aria-label="Marcar como hecho">${puedoEditar() ? `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>` : ''}</button>`;
  if (es) {
    const sigTr = i > 0 ? trayecto(ps[i - 1].lugar, x.lugar) : null;
    const estado = ah.ahora ? 'Ahora' : 'Siguiente';
    const m = minutos(x.hora) - enZona(v.tz).min;
    const falta = ah.ahora ? (x.fin ? 'Hasta ' + x.fin : (sig ? 'Hasta ' + sig.hora : '')) : (m > 0 ? 'En ' + duracion(m) : '');
    return `<div class="o-par o-ahora" data-e>
      <div class="o-par-h tn">${esc(x.hora || '')}</div>
      <div class="o-par-n">${nodo}<span class="o-par-l"></span></div>
      <div class="o-ahora-c o-vid t t-g" data-a="parada" data-lp="parada" data-id="${x.id}">
        <div class="o-fila" style="align-items:center">
          <span class="o-ahora-f" style="${foto ? `background-image:url('${foto}')` : ''}">${foto ? '' : ic(tp.ic, 26, 1.5)}</span>
          <span class="o-ahora-t"><span class="o-ahora-e"><span class="o-punto${ah.ahora ? ' o-vivo' : ''}"></span>${estado}${falta ? ' · ' + esc(falta) : ''}</span><span class="o-ahora-nom">${esc(x.nombre)}</span>${x.nota ? `<span class="o-nota o-1l">${esc(x.nota)}</span>` : ''}</span>
        </div>
        ${x.lugar && x.lugar.lat != null ? `<button class="o-pil o-peq t" data-a="llegar" data-id="${x.id}" style="width:100%;margin-top:12px">${ic(sigTr && sigTr.modo !== 'pie' ? 'bus' : 'walk', 17, 1.8)}Cómo llegar</button>` : ''}
      </div></div>${ent}`;
  }
  return `<div class="o-par${pasado ? ' o-pasada' : ''}" data-e>
    <div class="o-par-h tn">${esc(x.hora || '')}</div>
    <div class="o-par-n">${nodo}<span class="o-par-l"></span></div>
    <button class="o-par-c t" data-a="parada" data-lp="parada" data-id="${x.id}">
      <span class="o-par-f" style="${foto ? `background-image:url('${foto}')` : ''}">${foto ? '' : ic(tp.ic, 19, 1.6)}</span>
      <span class="o-par-t"><span class="o-par-nom">${esc(x.nombre)}</span><span class="o-nota o-1l">${esc(x.fin ? x.hora + ' – ' + x.fin + ' · ' + tp.t : (x.nota || tp.t))}</span></span>
      ${x._por && x._por !== yo() && dato('personas', x._por) ? avatar(dato('personas', x._por), 22) : ''}
    </button></div>${ent}`;
}
Object.assign(PANT.viaje.acciones, {
  dia: async (b, e, p, pa) => {
    if (b.dataset.d === p.dia || pa.cambiando) return;
    pa.cambiando = true;
    const viejo = p.dia; p.dia = b.dataset.d;
    const el = pa.el, cont = $('.o-dias', el);
    $$('.o-dia', cont).forEach(x => x.classList.toggle('o-on', x === b));
    Anim.pildora(cont, b);
    const atras = p.dia < viejo;
    const v = dato('viajes', p.id), vt = $('.o-vt', el);
    const html = TABS.plan.render(v, p);
    const lt = $('.o-linea-t,.o-cal', el), dc = $('.o-dcab', el), pb = $('.o-plan-b', el), pe = $('.o-peli', el);
    await Promise.all([
      animar(lt, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${atras ? 18 : -18}px)` }], { duration: 170, easing: CURVA.salir }),
      animar(dc, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 150, easing: CURVA.salir }),
      Fotos.varias(urlsDe(html), 300)
    ]);
    const st = el.scrollTop, sl = cont.scrollLeft;
    /* Solo cambia lo del día: la portada, la tira de días y la barra se quedan quietas */
    morph(vt, html);
    TABS.plan.alPintar(vt, v, p, false, pa);
    cont.scrollLeft = sl; el.scrollTop = st;
    animar($('.o-dcab', vt), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380 });
    await animar($('.o-linea-t,.o-cal', vt), [{ opacity: 0, transform: `translateX(${atras ? -18 : 18}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 });
    pa.cambiando = false;
  },
  parada: (b, e, p) => {
    const f = $('.o-par-f,.o-ahora-f,.o-carr-f,.o-cal-f', b) || b;
    const x = dato('paradas', b.dataset.id), u = fotoParada(x);
    Nav.ir('parada', { id: b.dataset.id }, u ? { circulo: { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 }, vuela: { desde: f, hacia: '.o-pd-foto', imagen: u } } : {});
  },
  hecho: (b) => {
    if (!puedoEditar()) return;
    const x = dato('paradas', b.dataset.id), on = !x.hecho;
    b.classList.toggle('o-hecho', on); Anim.salto(b); vibrar(10);
    const fila = b.closest('.o-par'); if (fila) fila.classList.toggle('o-pasada', on);
    setTimeout(() => { poner('paradas', x.id, { hecho: on }); if (on) actividad(x.viaje, 'ha marcado ' + x.nombre + ' como hecho'); }, 520);
  },
  llegar: (b) => { const x = dato('paradas', b.dataset.id); abrirRuta(x); },
  nuevaParada: (b, e, p) => editarParada(null, { viaje: p.id, dia: p.dia }),
  calHueco: (b, e, p) => {
    if (e.target.closest('.o-cal-ev')) return;
    const r = b.getBoundingClientRect(), m = +b.dataset.ini + Math.floor((e.clientY - r.top) / CAL_H * 2) * 30;
    if (m < 0 || m >= 24 * 60) return;
    editarParada(null, { viaje: p.id, dia: p.dia, hora: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') });
  },
  vista: async (b, e, p, pa) => {
    const nv = b.dataset.v; if (nv === p.vista || pa.cambiando) return;
    pa.cambiando = true;
    p.vista = nv; S.pref.vistaPlan = nv; guardarPref();
    const cont = b.parentNode; $$('.o-vista-b', cont).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(cont, b);
    const el = pa.el, vt = $('.o-vt', el), v = dato('viajes', p.id);
    const html = TABS.plan.render(v, p);
    await Promise.all([animar($('.o-linea-t,.o-cal', el), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 160, easing: CURVA.salir }), Fotos.varias(urlsDe(html), 300)]);
    const st = el.scrollTop, sl = $('.o-dias', el).scrollLeft;
    morph(vt, html);
    TABS.plan.alPintar(vt, v, p, false, pa);
    $('.o-dias', el).scrollLeft = sl; el.scrollTop = st;
    const nuevo_ = $('.o-linea-t,.o-cal', vt);
    animar(nuevo_, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: CURVA.entrar });
    $$('.o-cal-ev,.o-par', nuevo_).slice(0, 10).forEach((x, i) => animar(x, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 60 + i * 40, easing: CURVA.entrar }));
    await espera(420);
    pa.cambiando = false;
  },
  deIdea: (b, e, p) => elegirIdea(p.id, p.dia),
  peli: (b, e, p) => Nav.ir('pelicula', { id: p.id, dia: p.dia }, { circulo: { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 } })
});
function abrirRuta(x) {
  if (!x || !x.lugar || x.lugar.lat == null) return aviso('Esta parada no tiene sitio en el mapa.');
  const q = x.lugar.pid ? `&destination_place_id=${encodeURIComponent(x.lugar.pid)}` : '';
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${x.lugar.lat},${x.lugar.lng}${q}&travelmode=${x.modo || 'walking'}`, '_blank');
}

/* ---------- El tiempo de cada día (Open-Meteo, sin clave). Solo los próximos 15 días. */
const Tiempo = {
  datos: {}, pidiendo: {},
  de(v, dia) { const d = this.datos[v.id]; return d && d[dia] ? d[dia] : null; },
  async pedir(v) {
    if (v.lat == null || this.pidiendo[v.id]) return;
    this.pidiendo[v.id] = true;
    const hoy = hoyEn(v), fin = sumaDias(hoy, 15);
    const a = v.desde > hoy ? v.desde : hoy, b = (v.hasta || v.desde) < fin ? (v.hasta || v.desde) : fin;
    if (a > b) return;
    try {
      const c = await DB.get('tiempo:' + v.id);
      if (c && Date.now() - c.t < 3 * 3600000) { this.datos[v.id] = c.d; return; }
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${v.lat}&longitude=${v.lng}&daily=temperature_2m_max,weathercode&timezone=auto&start_date=${a}&end_date=${b}`);
      const j = await r.json(), d = {};
      (j.daily.time || []).forEach((t, i) => { d[t] = { max: Math.round(j.daily.temperature_2m_max[i]), ic: iconoTiempo(j.daily.weathercode[i]) }; });
      this.datos[v.id] = d; DB.set('tiempo:' + v.id, { t: Date.now(), d });
      Nav.refrescar();
    } catch (e) { anotar('tiempo', e); }
  }
};
function iconoTiempo(c) { return c <= 1 ? '☀︎' : c <= 3 ? '☁︎' : c <= 48 ? '〰︎' : c <= 67 ? '☂︎' : c <= 77 ? '❄︎' : '☂︎'; }

/* ---- 07_parada.js ---- */
/* ============================ PARADA ============================ */
PANT.parada = {
  render(p) {
    const x = dato('paradas', p.id);
    if (!x) return `<div class="o-cont"><div class="o-cab"><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button></div><div class="o-vacio" style="margin-top:30vh"><div class="o-t2">Esta parada ya no está</div></div></div>`;
    const v = dato('viajes', x.viaje) || {}, tp = tipoDe(x.tipo);
    const foto = fotoParada(x), casa = TZ_CASA(), otra = v.tz && x.hora && desfase(v.tz) !== desfase(casa);
    const enCasa = otra ? cambiarZona(x.dia, x.hora, v.tz, casa) : null;
    const por = dato('personas', x.por || x._por);
    const fotos = (x.fotos || []).concat(lista('medios', m => m.parada === x.id));
    return `<div class="o-pd">
      <div class="o-pd-foto" style="${foto ? `background-image:url('${foto}')` : ''}">${foto ? '' : `<div class="o-pd-ic">${ic(tp.ic, 54, 1.1)}</div>`}</div>
      <div class="o-pd-mcab"><span class="o-1l">${esc(x.nombre)}</span></div>
      <div class="o-pd-bar"><button class="o-bt o-vido t t-s" data-a="atras" aria-label="Volver">${ic('back', 20)}</button>${puedoEditar() ? `<button class="o-bt o-vido t t-s" data-a="masP" aria-label="Más">${ic('more', 20, 2.4)}</button>` : ''}</div>
      <div class="o-pd-c">
        <div class="o-cap" data-e>${esc(fechaLarga(x.dia))}${x.hora ? ' · ' + esc(x.hora) + (x.fin ? ' – ' + esc(x.fin) : '') : ''}</div>
        <h1 class="o-t1" data-e="titulo" style="margin-top:8px">${esc(x.nombre)}</h1>
        <div class="o-pd-chips" data-e><span class="o-chip o-sup">${ic(tp.ic, 15)}${tp.t}</span>${por ? `<span class="o-chip o-sup">${avatar(por, 20)}${esc(por.nombre.split(' ')[0])}</span>` : ''}${x.hecho ? `<span class="o-chip o-sup">${ic('check', 15, 2)}Hecho</span>` : ''}</div>
        ${otra ? `<div class="o-pd-zona" data-e>${ic('globe', 17)}<span><b class="tn">${esc(x.hora)}</b> en ${esc(nombreZona(v.tz))} · <b class="tn">${esc(enCasa.hora)}</b> en ${esc(nombreZona(casa))}${enCasa.dia !== x.dia ? ' (' + esc(fechaCorta(enCasa.dia)) + ')' : ''}</span></div>` : ''}
        <div class="o-pd-b" data-e>
          ${x.lugar && x.lugar.lat != null ? `<button class="o-pil t t-g" data-a="llegar">${ic('walk', 18, 1.8)}Cómo llegar</button>` : ''}
          ${puedoEditar() ? `<button class="o-pil o-sec t t-g o-pd-hecho${x.hecho ? ' o-on' : ''}" data-a="hechoP"><span class="o-casilla">${ic('check', 14, 2.6)}</span>${x.hecho ? 'Hecho' : 'Marcar hecho'}</button>` : ''}
        </div>
        ${x.nota ? `<p class="o-txt o-pd-nota" data-e>${esc(x.nota).replace(/\n/g, '<br>')}</p>` : ''}
        ${x.lugar && (x.lugar.dir || x.lugar.lat != null) ? `<button class="o-pd-lugar t" data-a="verMapa" data-e><span class="o-pd-mini" id="pd-mini" data-fijo></span><span><span class="o-nota">Dónde</span><span>${esc(x.lugar.dir || (x.lugar.lat.toFixed(4) + ', ' + x.lugar.lng.toFixed(4)))}</span></span>${ic('fwd', 18)}</button>` : ''}
        ${(x.enlaces || []).length ? `<div class="o-sec" data-e><span class="o-cap">Enlaces</span></div>${x.enlaces.map(u => `<a class="o-enl t" href="${esc(u)}" target="_blank" rel="noopener" data-e>${ic('link', 18)}<span class="o-1l">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 16)}</a>`).join('')}` : ''}
        <div class="o-sec" data-e><span class="o-cap">Fotos</span><span class="o-nota tn">${fotos.length || ''}</span></div>
        <div class="o-fotos">${fotos.map((m, i) => `<button class="o-foto t" data-a="verFoto" data-i="${i}" data-e="pop" style="background-image:url('${urlMedio(m)}')">${m.tipo === 'video' ? `<span class="o-foto-v">${ic('play', 14, 2)}</span>` : ''}</button>`).join('')}
          ${puedoEditar() ? `<button class="o-foto o-foto-mas t" data-a="masFotos" data-e="pop">${ic('plus', 22, 1.6)}<span class="o-nota">Añadir</span></button>` : ''}</div>
      </div></div>`;
  },
  alPintar(el, p) {
    const x = dato('paradas', p.id); if (!x) return;
    const m = $('#pd-mini', el); if (m && x.lugar && x.lugar.lat != null) Mapa.mini(m, x.lugar);
  },
  alDeslizar(el) {
    const f = $('.o-pd-foto', el), y = el.scrollTop;
    if (f) f.style.transform = y < 0 ? `translateY(${y}px)` : reducido() ? '' : `translateY(${Math.min(y, 600) * .3}px)`;
    /* Al bajar, arriba aparece una barra de cristal con el nombre (no choca con el botón de volver) */
    const lim = (f ? f.offsetHeight : 300) - 120;
    el.classList.toggle('o-pd-col', y > lim);
  },
  acciones: {
    llegar: (b, e, p) => abrirRuta(dato('paradas', p.id)),
    hechoP: (b, e, p) => {
      const x = dato('paradas', p.id), on = !x.hecho;
      b.classList.toggle('o-on', on); Anim.salto($('.o-casilla', b)); vibrar(10);
      setTimeout(() => poner('paradas', x.id, { hecho: on }), 480);
    },
    masP: (b, e, p) => {
      const x = dato('paradas', p.id);
      Capa.menu(b, [
        { t: 'Editar', ic: 'edit', f: () => editarParada(x) },
        { t: 'Pasar a otro día', ic: 'plan', f: () => editarParada(x, { foco: 'dia' }) },
        x.lugar && x.lugar.lat != null ? { t: 'Copiar ubicación', ic: 'copy', f: () => copiar(`https://maps.google.com/?q=${x.lugar.lat},${x.lugar.lng}`).then(() => aviso('Ubicación copiada')) } : null,
        '-',
        { t: 'Borrar', ic: 'trash', peligro: true, f: async () => { if (await Capa.confirmar({ titulo: '¿Borrar «' + x.nombre + '»?', si: 'Borrar', peligro: true })) { borrar('paradas', x.id); Nav.atras(); aviso('Parada borrada', { accion: { t: 'Deshacer', f: () => poner('paradas', x.id, { _b: 0 }) } }); } } }
      ].filter(Boolean));
    },
    verMapa: (b, e, p) => { const x = dato('paradas', p.id); Nav.atras(); setTimeout(() => { const pa = Nav.actual(); if (pa && pa.id === 'viaje') { pa.p.foco = x.id; const tb = $('.o-tab[data-t="mapa"]', pa.el); if (tb) tb.click(); else Mapa.enfocar(x); } }, 460); },
    verFoto: (b, e, p) => { const x = dato('paradas', p.id); const fotos = (x.fotos || []).concat(lista('medios', m => m.parada === x.id)); verFotos(fotos, +b.dataset.i, b); },
    masFotos: async (b, e, p) => {
      const x = dato('paradas', p.id);
      const fs = await elegirArchivos('image/*,video/*', true); if (!fs.length) return;
      for (const f of fs) {
        const video = /^video/.test(f.type);
        const blob = video ? f : await reducir(f, 1800, .85);
        const id = await Subidas.guardar(blob, f.name || 'foto.jpg');
        nuevo('medios', { viaje: x.viaje, dia: x.dia, parada: x.id, tipo: video ? 'video' : 'foto', mid: id }, { callado: true });
      }
      Nav.refrescar(); aviso(fs.length === 1 ? 'Foto añadida' : fs.length + ' fotos añadidas');
    }
  }
};

/* Visor de fotos a pantalla completa: sale de la miniatura y se cierra deslizando hacia abajo */
function verFotos(fotos, i, desde) {
  const el = document.createElement('div'); el.className = 'o-visor';
  const pintar = () => {
    const m = fotos[i], u = urlMedio(m);
    el.innerHTML = `<div class="o-visor-f">${m.tipo === 'video' ? `<video src="${u}" controls playsinline autoplay></video>` : `<img src="${u}" alt="">`}</div>
      <div class="o-visor-bar"><span class="o-chip o-vido tn">${i + 1} / ${fotos.length}</span><button class="o-bt o-vido t t-s" data-x="cerrar">${ic('close', 20)}</button></div>`;
  };
  pintar();
  $('#capas').appendChild(el);
  const r = desde.getBoundingClientRect();
  animar(el, [{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.94)' }], { duration: 400 });
  animar($('.o-visor-f', el), [{ transform: `translate(${r.left + r.width / 2 - innerWidth / 2}px,${r.top + r.height / 2 - innerHeight / 2}px) scale(${r.width / innerWidth})`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 560, easing: CURVA.entrar });
  const cerrar = () => { animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }).then(() => el.remove()); };
  el.addEventListener('click', e => { if (e.target.closest('[data-x="cerrar"]') || e.target === el || e.target.classList.contains('o-visor-f')) cerrar(); });
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) { $('.o-visor-f', el).style.transform = `translateY(${dy}px) scale(${1 - dy / 2000})`; el.style.backgroundColor = `rgba(0,0,0,${.94 - dy / 600})`; } }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = y0 = null;
    if (dy > 110) return cerrar();
    $('.o-visor-f', el).style.transform = ''; el.style.backgroundColor = 'rgba(0,0,0,.94)';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      const n = i + (dx < 0 ? 1 : -1); if (n < 0 || n >= fotos.length) return;
      i = n; pintar();
      animar($('.o-visor-f', el), [{ opacity: 0, transform: `translateX(${dx < 0 ? 40 : -40}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 });
    }
  });
}

/* ---------- Crear o editar una parada (hoja)
   Si estás en otra zona horaria que el destino, pregunta de qué zona es la hora que escribes. */
function editarParada(x, o) {
  o = o || {};
  const nueva = !x;
  const v = dato('viajes', x ? x.viaje : o.viaje);
  const f = x ? JSON.parse(JSON.stringify(x)) : { viaje: v.id, dia: o.dia || v.desde, hora: '', tipo: 'visita', nombre: '', nota: '', enlaces: [], lugar: null, fotos: [] };
  const casa = TZ_CASA(), otra = v.tz && desfase(v.tz) !== desfase(casa);
  let zonaElegida = 'destino', sugT = null;
  const c = Capa.hoja({
    clase: 'o-hoja-alta',
    html: `<div class="o-hcab" data-e><button class="o-enlace t" data-a="cerrar">Cancelar</button><div class="o-t3">${nueva ? 'Nueva parada' : 'Editar parada'}</div><button class="o-enlace t" data-a="guardar">Guardar</button></div>
    <div class="o-hoja-scroll">
      <label class="o-campo" data-e><span class="o-etq">Título</span><input id="f-pn" class="o-in o-in-g" placeholder="Vuelo a París, cena con amigos…" value="${esc(f.nombre)}" autocomplete="off"></label>
      <div class="o-campo" data-e><span class="o-etq">Ubicación <span class="o-opc">si procede</span></span>
        <div id="p-lugar">${f.lugar ? `<div class="o-lugar-sel">${lugarTxt(f.lugar, (f.fotos || [])[0] && urlMedio(f.fotos[0]))}</div>` : buscadorLugar()}</div><div class="o-sugs" id="p-sugs"></div></div>
      <div class="o-campo" data-e><span class="o-etq">Categoría</span><div id="p-cats">${chipsCat(f.tipo, { a: 'tipo' })}</div></div>
      <div class="o-campo" data-e><span class="o-etq">Día</span><div class="o-dsel">${diasDe(v).map((d, i) => `<button class="o-dsel-b t t-s${d === f.dia ? ' o-on' : ''}" data-a="pdia" data-d="${d}"><span class="o-nota">${'DLMXJVS'[fecha(d).getUTCDay()]}</span><span class="tn">${fecha(d).getUTCDate()}</span></button>`).join('')}</div></div>
      <div class="o-dos" data-e>${campo('ph', 'Hora', '', f.hora, { tipo: 'time' })}${campo('pf', 'Hasta (opcional)', '', f.fin, { tipo: 'time' })}</div>
      ${otra ? `<div class="o-campo o-tzq" data-e><span class="o-etq">¿De qué hora hablas?</span>
        <div class="o-seg"><span class="o-pild"></span><button class="o-seg-b t o-on" data-a="zona" data-z="destino">Hora de ${esc(nombreZona(v.tz))}</button><button class="o-seg-b t" data-a="zona" data-z="casa">Hora de ${esc(nombreZona(casa))}</button></div>
        <div class="o-nota o-tz-eq" id="p-eq"></div></div>` : ''}
      ${campo('pno', 'Nota', 'Qué hacer, qué pedir, a qué hora abre…', f.nota, { area: true, filas: 3 })}
      ${campo('pen', 'Enlaces', 'Uno por línea', (f.enlaces || []).join('\n'), { area: true, filas: 2 })}
      <div class="o-error" id="c-err"></div>
    </div>`,
    alAbrir: (h, cc) => {
      $$('.o-seg', h).forEach(s => Anim.pildora(s, $('.o-on', s)));
      cc.buscador = () => {
        const i = $('#f-pl', h); if (!i) return;
        i.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(async () => pintar(h, await Lugar.buscar(i.value, { cerca: v })), 280); });
      };
      cc.buscador();
      const eq = () => {
        const e = $('#p-eq', h); if (!e) return;
        const hv = $('#f-ph', h).value; if (!hv) { e.textContent = ''; return; }
        const r = zonaElegida === 'destino' ? cambiarZona(f.dia, hv, v.tz, casa) : cambiarZona(f.dia, hv, casa, v.tz);
        e.innerHTML = zonaElegida === 'destino' ? `Son las <b class="tn">${r.hora}</b> en ${esc(nombreZona(casa))}` : `En ${esc(nombreZona(v.tz))} serán las <b class="tn">${r.hora}</b>${r.dia !== f.dia ? ' del ' + esc(fechaCorta(r.dia)) : ''}. Se guarda así.`;
      };
      $('#f-ph', h).addEventListener('input', eq); cc.eq = eq; eq();
      if (o.hora) $('#f-ph', h).value = o.hora;
      if (o.foco === 'dia') setTimeout(() => $('.o-dsel', h).scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
      const on = $('.o-dsel-b.o-on', h); if (on) on.parentNode.scrollLeft = on.offsetLeft - 120;
    },
    acciones: {
      tipo: (b) => { f.tipo = b.dataset.k; marcarCat(b, true); },
      catNueva: async () => { const k = await nuevaCategoria(); if (!k) return; f.tipo = k; const box = $('#p-cats', c.hoja); box.innerHTML = chipsCat(f.tipo, { a: 'tipo' }); const b = $('.o-cat.o-on', box); if (b) { b.scrollIntoView({ inline: 'center', block: 'nearest' }); Anim.salto(b); } },
      pdia: (b) => { f.dia = b.dataset.d; $$('.o-dsel-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.salto(b); c.eq && c.eq(); },
      zona: (b) => { zonaElegida = b.dataset.z; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); c.eq(); },
      sug: async (b) => {
        const s = await Lugar.completar(JSON.parse(b.dataset.j)), h = c.hoja;
        f.lugar = { lat: s.lat, lng: s.lng, dir: [s.n, s.sub].filter(Boolean).join(', '), pid: s.pid || '' };
        /* El título solo se rellena si está vacío: «Vuelo a París» se queda como lo escribiste */
        const inp = $('#f-pn', h); if (!inp.value.trim()) inp.value = s.n;
        $('#p-sugs', h).innerHTML = '';
        if (s.tipo && nueva && f.tipo === 'visita') { f.tipo = s.tipo; const b = $(`.o-cat[data-k="${s.tipo}"]`, h); if (b) marcarCat(b, true); }
        const box = $('#p-lugar', h); box.innerHTML = `<div class="o-lugar-sel">${lugarTxt(f.lugar)}</div>`;
        animar(box, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: CURVA.muelle });
        if (!(f.fotos || []).length) { const u = await Lugar.foto(s).catch(() => ''); if (u) { f.fotos = [{ url: u }]; box.innerHTML = `<div class="o-lugar-sel">${lugarTxt(f.lugar, u)}</div>`; } }
      },
      quitarLugar: () => { f.lugar = null; f.fotos = (f.fotos || []).filter(m => !m.url); $('#p-lugar', c.hoja).innerHTML = buscadorLugar(); c.buscador(); $('#f-pl', c.hoja).focus(); },
      guardar: () => {
        const h = c.hoja, val = id => $('#f-' + id, h).value.trim();
        f.nombre = val('pn'); f.nota = val('pno'); f.enlaces = val('pen').split(/\s*\n\s*/).filter(Boolean);
        let hora = val('ph'), fin = val('pf');
        if (!f.nombre) { Anim.no($('#f-pn', h).parentNode); return error(h, 'Ponle un título a la parada.'); }
        if (otra && zonaElegida === 'casa' && hora) {
          const r = cambiarZona(f.dia, hora, casa, v.tz); hora = r.hora; f.dia = diasDe(v).indexOf(r.dia) >= 0 ? r.dia : f.dia;
          if (fin) fin = cambiarZona(f.dia, fin, casa, v.tz).hora;
        }
        const campos = { viaje: v.id, dia: f.dia, hora, fin: fin || '', tipo: f.tipo, nombre: f.nombre, nota: f.nota, enlaces: f.enlaces, lugar: f.lugar, fotos: f.fotos || [] };
        if (nueva) { nuevo('paradas', campos); actividad(v.id, 'ha añadido ' + f.nombre); }
        else poner('paradas', x.id, campos);
        c.cerrar();
        if (nueva) { const pa = Nav.actual(); if (pa && pa.id === 'viaje' && pa.p.dia !== f.dia) { pa.p.dia = f.dia; Nav.refrescar(); } }
        aviso(nueva ? 'Parada añadida' : 'Cambios guardados', { ic: 'check' });
      }
    }
  });
  function pintar(h, ls) {
    const box = $('#p-sugs', h);
    const q = ($('#f-pl', h) || {}).value || '';
    if (!ls.length) { box.innerHTML = q.trim().length >= 2 ? `<div class="o-sug-nada o-nota">No encuentro «${esc(q.trim())}». Prueba con el nombre y la ciudad.</div>` : ''; return; }
    box.innerHTML = ls.map(s => `<button class="o-sug t" data-a="sug" data-j='${esc(JSON.stringify(s))}'>${ic('pin', 18)}<span><span>${esc(s.n)}</span><span class="o-nota o-1l">${esc(s.sub || '')}</span></span></button>`).join('');
    $$('.o-sug', box).forEach((x, i) => animar(x, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 40 }));
  }
}
function buscadorLugar() {
  return `<div class="o-lbus">${ic('search', 18)}<input id="f-pl" class="o-lbus-in" placeholder="Busca el sitio para verlo en el mapa" autocomplete="off"></div>`;
}
function lugarTxt(l, foto) {
  if (!l) return '';
  return `<span class="o-lugar-f" style="${foto ? `background-image:url('${foto}')` : ''}">${foto ? '' : ic('pin', 18)}</span><span class="o-1l">${esc(l.dir || (l.lat.toFixed(4) + ', ' + l.lng.toFixed(4)))}</span><button class="o-bt t t-s" data-a="quitarLugar" style="width:36px;height:36px">${ic('close', 16)}</button>`;
}

/* ---------- Pasar una idea al plan */
function elegirIdea(vid, dia) {
  const ids = lista('ideas', i => i.viaje === vid && !i.parada);
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Pasar una idea</div></div><p class="o-nota" data-e>Se añade al ${esc(fechaLarga(dia).toLowerCase())}. Luego le pones hora.</p>
      <div class="o-ideas-l">${ids.map(i => `<button class="o-idea-f t" data-a="usar" data-id="${i.id}" data-e><span class="o-idea-fm" style="background-image:url('${urlMedio(i.imagen)}')"></span><span><span>${esc(i.titulo)}</span><span class="o-nota">${esc(FUENTES[i.fuente] ? FUENTES[i.fuente].t : 'Web')}</span></span>${ic('plus', 18)}</button>`).join('')}</div>`,
    acciones: { usar: (b) => { const i = dato('ideas', b.dataset.id); pasarIdea(i, dia); c.cerrar(); } }
  });
}
function pasarIdea(i, dia) {
  const id = nuevo('paradas', { viaje: i.viaje, dia, hora: '', tipo: i.fuente === 'maps' ? 'visita' : 'actividad', nombre: i.titulo, nota: i.nota || '', enlaces: i.url ? [i.url] : [], lugar: i.lugar || null, fotos: i.imagen ? [i.imagen] : [] });
  poner('ideas', i.id, { parada: id });
  actividad(i.viaje, 'ha pasado una idea al plan: ' + i.titulo);
  aviso('Añadida al ' + fechaCorta(dia), { ic: 'check', accion: { t: 'Ponerle hora', f: () => editarParada(dato('paradas', id)) } });
}

/* ---- 08_mapa.js ---- */
/* ============================ MAPA Y LUGARES ============================
   Con clave de Google Maps: mapa de Google con su buscador de sitios y sus fotos.
   Sin clave: mapa propio con teselas de CARTO (OpenStreetMap), buscador Photon y fotos de Wikipedia. */
function claveMaps() { if (GM_MAL) return ''; return (S.pref.mapsKey || ((dato('espacio', 'espacio') || {}).mapsKey) || '').trim(); }

let GM_MAL = false;
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
      window.gm_authFailure = () => {
        anotar('maps', 'La clave de Google Maps no es válida o no tiene permiso para esta dirección.');
        aviso('Google Maps no acepta la clave (mira Ajustes). Mientras, sale el mapa abierto.');
        /* Se vuelve al mapa abierto: nunca se queda la pantalla gris de error */
        GM_MAL = true; GM.prom = null;
        $$('.o-mapa').forEach(c => { c._mapa = null; c.innerHTML = ''; });
        Nav.refrescar();
      };
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
      if (claveMaps() && !this.gmMal) {
        await Promise.race([GM.cargar(), new Promise((_, no) => setTimeout(() => no(new Error('Google no carga')), 6000))]);
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places');
        this.token = this.token || new AutocompleteSessionToken();
        const pet = { input: q, sessionToken: this.token, language: 'es' };
        if (o.cerca && o.cerca.lat != null) pet.locationBias = { center: { lat: o.cerca.lat, lng: o.cerca.lng }, radius: 50000 };
        if (o.ciudades) pet.includedPrimaryTypes = ['(regions)'];
        const r = await Promise.race([AutocompleteSuggestion.fetchAutocompleteSuggestions(pet), new Promise((_, no) => setTimeout(() => no(new Error('Google no responde')), 6000))]);
        red = r.suggestions.filter(s => s.placePrediction).slice(0, 6).map(s => ({ n: s.placePrediction.mainText ? s.placePrediction.mainText.text : s.placePrediction.text.text, sub: s.placePrediction.secondaryText ? s.placePrediction.secondaryText.text : '', pid: s.placePrediction.placeId }));
      }
    } catch (e) { anotar('buscar', e); this.gmMal = true; setTimeout(() => { this.gmMal = false; }, 60000); }
    try {
      if (!red.length) {
        const bias = o.cerca && o.cerca.lat != null ? `&lat=${o.cerca.lat}&lon=${o.cerca.lng}` : '';
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}${o.ciudades ? '&osm_tag=place' : ''}`);
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
    /* Sin ficha de Google: Wikipedia por el nombre y, si no, por la ciudad */
    const u = await this.fotoWiki(s.n); if (u) return u;
    if (s.lat != null) { const c = await this.fotoCerca(s.lat, s.lng); if (c) return c; }
    for (const t of String(s.sub || '').split(',').map(x => x.trim()).filter(x => x && !/\d/.test(x)).reverse().slice(1, 3).reverse()) { const v = await this.fotoWiki(t); if (v) return v; }
    return '';
  },
  /* Wikipedia: la foto del sitio conocido más cercano (a menos de 1,5 km) */
  async fotoCerca(lat, lng) {
    const MALA = /map|mapa|flag|bandera|escudo|logo|seal|emblem|locator|location|\.svg/i;
    for (const idioma of ['en', 'es']) {
      try {
        const r = await fetch(`https://${idioma}.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=1500&ggslimit=15&prop=pageimages|coordinates&piprop=thumbnail|original&pithumbsize=1280&format=json&origin=*`);
        const ps = Object.values(((await r.json()).query || {}).pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
        for (const p of ps) { const o = p.original; if (o && o.width >= 700 && o.width >= o.height * .8 && !MALA.test(o.source)) return (p.thumbnail && p.thumbnail.source) || fotoLigera(o.source); }
      } catch (e) { }
    }
    return '';
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
        const u = (j.originalimage && j.originalimage.width >= 700 ? fotoLigera(j.originalimage.source) : null) || (j.thumbnail && j.thumbnail.source && j.thumbnail.source.replace(/\/\d+px-/, '/1280px-'));
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
/* Teselas de Esri (gris claro / gris oscuro), sin clave; los nombres van en una capa aparte encima */
function tesela(z, x, y, oscuro) {
  const s = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${oscuro ? 'Dark' : 'Light'}_Gray_`;
  return { base: `${s}Base/MapServer/tile/${z}/${y}/${x}`, nombres: `${s}Reference/MapServer/tile/${z}/${y}/${x}` };
}
class Teselas {
  constructor(cont, o) {
    this.c = cont; this.o = o || {}; this.z = 13; this.cx = 0; this.cy = 0; this.mks = []; this.imgs = {};
    cont.classList.add('o-tm');
    cont.innerHTML = `<div class="o-tm-capa"><div class="o-tm-tes"></div><svg class="o-tm-ruta"></svg><div class="o-tm-mks"></div></div><div class="o-tm-atr">© Esri · OpenStreetMap</div>`;
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
        im = document.createElement('span'); im.className = 'o-tm-t';
        const t = tesela(z, xx, ty, oscuro), pre = new Image(); pre.onload = () => im.classList.add('o-ok'); pre.src = t.base;
        im.style.backgroundImage = `url('${t.nombres}'),url('${t.base}')`;
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
    const t = tesela(z, tx, ty, oscuro);
    el.innerHTML = `<span class="o-tm-t o-ok" style="background-image:url('${t.nombres}'),url('${t.base}');transform:translate(${W / 2 - (x - tx * 256)}px,${H / 2 - (y - ty * 256)}px)"><span class="o-punto o-g"></span>`;
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
        const f = fotoParada(x, 330), tp = tipoDe(x.tipo);
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

/* ---- 09_ideas.js ---- */
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
  return `<button class="o-idea t t-g${x.cargando ? ' o-carga' : ''}${x.parada ? ' o-enplan' : ''}" data-a="idea" data-lp="idea" data-id="${x.id}" data-e="pop">
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

/* ---- 10_docs.js ---- */
/* ============================ DOCUMENTOS Y RESERVAS ============================
   «Pega una reserva»: el texto del correo o el PDF se lee con Gemini (con la clave del script)
   y sale ordenado: qué es, cuándo, el localizador. Con un toque, también al plan. */
TABS.docs = {
  render(v) {
    const ds = lista('docs', d => d.viaje === v.id).sort((a, b) => (a.cuando || '9').localeCompare(b.cuando || '9'));
    return `<div class="o-cont o-tabc">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span class="o-nota">${esc(v.nombre)}</span>${puedoEditar() ? `<button class="o-bt o-borde t t-s" data-a="docMano" aria-label="Añadir a mano">${ic('plus')}</button>` : '<span style="width:46px"></span>'}</div>
      <div class="o-tabc-t"><h1 class="o-t1" data-e="titulo">Documentos</h1><span class="o-num o-tabc-n tn" data-e>${ds.length}</span></div>
      ${puedoEditar() ? `<button class="o-reserva t t-g" data-a="reserva" data-e="heroe">
        <span class="o-reserva-ic">${ic('spark', 24, 1.5)}</span>
        <span class="o-reserva-t"><span class="o-t3">Pega una reserva</span><span class="o-nota">El correo del vuelo, el hotel o las entradas. Se ordena solo.</span></span>
        ${ic('fwd', 20)}</button>` : ''}
      ${ds.length ? `<div class="o-docs">${ds.map(tarjetaDoc).join('')}</div>` : `<div class="o-vacio" data-e="pop"><div class="o-vacio-ic">${ic('doc', 30, 1.4)}</div><div class="o-t3">Ni un papel</div><p class="o-nota">Vuelos, hoteles, entradas y seguros, a mano y sin conexión para todo el grupo.</p></div>`}
    </div>`;
  }
};
function tarjetaDoc(d) {
  const T = TIPOS_DOC[d.tipo] || TIPOS_DOC.otro;
  const [dia, hora] = String(d.cuando || '').split(' ');
  return `<button class="o-doc t t-g" data-a="doc" data-lp="doc" data-id="${d.id}" data-e>
    <span class="o-doc-ic">${ic(T.ic, 22, 1.5)}</span>
    <span class="o-doc-t"><span class="o-cap">${esc(T.t)}${dia ? ' · ' + esc(fechaCorta(dia)) : ''}${hora ? ' · ' + esc(hora) : ''}</span><span class="o-doc-n">${esc(d.titulo)}</span>${d.detalles ? `<span class="o-nota o-1l">${esc(d.detalles)}</span>` : ''}</span>
    ${d.codigo ? `<span class="o-doc-c tn">${esc(d.codigo)}</span>` : ''}
    ${d.fid || d.mid ? `<span class="o-doc-adj">${ic('link', 13, 2)}</span>` : ''}
  </button>`;
}
Object.assign(PANT.viaje.acciones, {
  doc: (b) => verDoc(dato('docs', b.dataset.id)),
  docMano: (b, e, p) => editarDoc(null, p.id),
  reserva: (b, e, p) => pegarReserva(p.id)
});
function verDoc(d) {
  if (!d) return;
  const T = TIPOS_DOC[d.tipo] || TIPOS_DOC.otro, [dia, hora] = String(d.cuando || '').split(' ');
  const c = Capa.hoja({
    html: `<div class="o-dv">
      <div class="o-dv-ic" data-e="pop">${ic(T.ic, 30, 1.4)}</div>
      <div class="o-cap" data-e style="margin-top:16px">${esc(T.t)}</div>
      <div class="o-t2" data-e style="margin-top:6px">${esc(d.titulo)}</div>
      ${dia ? `<div class="o-dv-f" data-e><span class="o-num tn">${fecha(dia).getUTCDate()}</span><span><span>${esc(fechaLarga(dia))}</span>${hora ? `<span class="o-nota tn">${esc(hora)}</span>` : ''}</span></div>` : ''}
      ${d.codigo ? `<button class="o-dv-c t t-g" data-a="copiarC" data-e><span class="o-cap">Localizador</span><span class="o-dv-cod tn">${esc(d.codigo)}</span><span class="o-nota o-dv-cp">${ic('copy', 14)}Tocar para copiar</span></button>` : ''}
      ${d.detalles ? `<p class="o-txt" data-e style="margin-top:14px;white-space:pre-line">${esc(d.detalles)}</p>` : ''}
      <div class="o-conf-b" data-e>${d.fid || d.mid ? `<button class="o-pil t" data-a="abrirA">${ic('ext', 17)}Abrir el archivo</button>` : ''}${puedoEditar() ? `<button class="o-pil o-sec t" data-a="editarD">${ic('edit', 17)}Editar</button>` : ''}</div>
      ${puedoEditar() ? `<button class="o-enlace o-mal t" data-a="borrarD" data-e style="display:block;margin:18px auto 0">Borrar</button>` : ''}
    </div>`,
    acciones: {
      copiarC: (b) => copiar(d.codigo).then(() => { const n = $('.o-dv-cp', b); n.innerHTML = ic('check', 14, 2.2) + 'Copiado'; Anim.salto($('.o-dv-cod', b)); vibrar(10); }),
      abrirA: async (b) => {
        cargando(b, true);
        try { const bl = await blobMedio({ mid: d.mid, fid: d.fid }); if (!bl) throw new Error('El archivo aún no ha llegado a este móvil.'); window.open(URL.createObjectURL(bl), '_blank'); }
        catch (e) { aviso(e.message); } finally { cargando(b, false); }
      },
      editarD: () => { c.cerrar(); setTimeout(() => editarDoc(d, d.viaje), 280); },
      borrarD: async () => { c.cerrar(); if (await Capa.confirmar({ titulo: '¿Borrar «' + d.titulo + '»?', si: 'Borrar', peligro: true })) { borrar('docs', d.id); aviso('Documento borrado'); } }
    }
  });
}
function editarDoc(d, vid, pre) {
  const nuevoD = !d;
  const f = d ? Object.assign({}, d) : Object.assign({ viaje: vid, tipo: 'vuelo', titulo: '', cuando: '', codigo: '', detalles: '' }, pre || {});
  const [dia, hora] = String(f.cuando || '').split(' ');
  const c = Capa.hoja({
    clase: 'o-hoja-alta',
    html: `<div class="o-hcab" data-e><button class="o-enlace t" data-a="cerrar">Cancelar</button><div class="o-t3">${nuevoD ? 'Nuevo documento' : 'Editar'}</div><button class="o-enlace t" data-a="guardarD">Guardar</button></div>
    <div class="o-hoja-scroll">
      <div class="o-campo" data-e><span class="o-etq">Tipo</span><div class="o-seg o-seg-s"><span class="o-pild"></span>${Object.keys(TIPOS_DOC).map(k => `<button class="o-seg-b t t-s${f.tipo === k ? ' o-on' : ''}" data-a="dtipo" data-k="${k}">${ic(TIPOS_DOC[k].ic, 18)}<span>${TIPOS_DOC[k].t}</span></button>`).join('')}</div></div>
      ${campo('dt', 'Qué es', 'Madrid → Tokio', f.titulo)}
      <div class="o-dos" data-e>${campo('dd', 'Día', '', dia || '', { tipo: 'date' })}${campo('dh', 'Hora', '', hora || '', { tipo: 'time' })}</div>
      ${campo('dc', 'Localizador o número', 'K7Q2LM', f.codigo, { mayus: true })}
      ${campo('ddet', 'Detalles', 'Asientos, terminal, teléfono…', f.detalles, { area: true })}
      <button class="o-adj t" data-a="adjuntar" data-e>${ic('link', 18)}<span id="d-adj">${f.mid || f.fid ? 'Archivo adjunto · cambiar' : 'Adjuntar PDF o foto'}</span></button>
      <div class="o-error" id="c-err"></div>
    </div>`,
    alAbrir: h => { const s = $('.o-seg', h); Anim.pildora(s, $('.o-on', s)); },
    acciones: {
      dtipo: (b) => { f.tipo = b.dataset.k; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); },
      adjuntar: async () => { const [fi] = await elegirArchivos('application/pdf,image/*'); if (!fi) return; const bl = /^image/.test(fi.type) ? await reducir(fi, 2200, .88) : fi; f.mid = await Subidas.guardar(bl, fi.name); f.fid = ''; f.nombreArchivo = fi.name; $('#d-adj', c.hoja).textContent = fi.name; Anim.salto($('#d-adj', c.hoja)); },
      guardarD: () => {
        const h = c.hoja, val = id => $('#f-' + id, h).value.trim();
        f.titulo = val('dt'); if (!f.titulo) { Anim.no($('#f-dt', h).parentNode); return error(h, 'Escribe qué es.'); }
        const campos = { viaje: f.viaje, tipo: f.tipo, titulo: f.titulo, cuando: (val('dd') + (val('dh') ? ' ' + val('dh') : '')).trim(), codigo: val('dc').toUpperCase(), detalles: val('ddet'), mid: f.mid || '', fid: f.fid || '', nombreArchivo: f.nombreArchivo || '' };
        if (nuevoD) { nuevo('docs', campos); actividad(f.viaje, 'ha añadido ' + f.titulo); } else poner('docs', d.id, campos);
        c.cerrar(); aviso('Guardado', { ic: 'check' });
      }
    }
  });
}

/* ---------- Pegar una reserva: texto o archivo › Gemini › tarjetas para revisar */
function pegarReserva(vid) {
  const v = dato('viajes', vid);
  let archivo = null, res = null;
  const c = Capa.hoja({
    clase: 'o-hoja-alta',
    html: `<div class="o-hcab" data-e><button class="o-enlace t" data-a="cerrar">Cancelar</button><div class="o-t3">Pega una reserva</div><span style="width:60px"></span></div>
    <div class="o-hoja-scroll" id="r-cuerpo">
      <p class="o-txt" data-e>Copia el correo de confirmación entero y pégalo aquí, o adjunta el PDF. Lo lee Gemini con tu clave y no se guarda en ningún otro sitio.</p>
      <textarea id="f-rtxt" class="o-in o-area o-area-g" data-e rows="7" placeholder="Pega aquí el correo…"></textarea>
      <button class="o-adj t" data-a="radj" data-e>${ic('link', 18)}<span id="r-adj">Adjuntar PDF o captura</span></button>
      <div class="o-error" id="c-err"></div>
      <button class="o-pil t t-g" data-a="leer" data-e style="margin-top:18px">${ic('spark', 18)}Leer la reserva</button>
      <button class="o-enlace t" data-a="aMano" data-e style="display:block;margin:16px auto 0">Prefiero escribirla a mano</button>
    </div>`,
    acciones: {
      radj: async () => { const [fi] = await elegirArchivos('application/pdf,image/*'); if (!fi) return; archivo = /^image/.test(fi.type) ? await reducir(fi, 2000, .86) : fi; archivo.nombre = fi.name; $('#r-adj', c.hoja).textContent = fi.name; Anim.salto($('#r-adj', c.hoja)); },
      aMano: () => { c.cerrar(); setTimeout(() => editarDoc(null, vid), 280); },
      leer: async (b) => {
        const txt = $('#f-rtxt', c.hoja).value.trim();
        if (!txt && !archivo) { Anim.no($('#f-rtxt', c.hoja)); return error(c.hoja, 'Pega el correo o adjunta el archivo.'); }
        if (!Sync.activo()) return error(c.hoja, 'Leer reservas necesita el script de Google con tu clave de Gemini. En el viaje de ejemplo no está conectado.');
        cargando(b, true); leyendo(c.hoja, true);
        try {
          const extra = { texto: txt.slice(0, 20000), hoy: hoyEn(v), destino: v.ciudad || v.nombre, tz: v.tz };
          if (archivo) { if (archivo.size > 7 * 1024 * 1024) throw ErrR('archivo', 'El archivo pasa de 7 MB. Prueba con una captura o pega el texto.'); extra.archivo = await blobA64(archivo); extra.tipoArchivo = archivo.type || 'application/pdf'; }
          const r = await api('reserva', extra, { ms: 90000 });
          res = (r.items || []).filter(x => x.titulo);
          if (!res.length) throw ErrR('gemini', 'No he encontrado ninguna reserva en ese texto.');
          mostrarResultado();
        } catch (e) { leyendo(c.hoja, false); error(c.hoja, e.message); } finally { cargando(b, false); }
      },
      plan: (b) => { b.classList.toggle('o-on'); Anim.salto($('.o-casilla', b)); },
      guardarR: async () => {
        let mid = '';
        if (archivo) mid = await Subidas.guardar(archivo, archivo.nombre || 'reserva.pdf');
        let n = 0;
        $$('.o-rres', c.hoja).forEach((el, i) => {
          const x = res[i]; if (!$('.o-rres-inc', el).classList.contains('o-on')) return;
          nuevo('docs', { viaje: vid, tipo: TIPOS_DOC[x.tipo] ? x.tipo : 'otro', titulo: x.titulo, cuando: ((x.fecha || '') + (x.hora ? ' ' + x.hora : '')).trim(), codigo: (x.codigo || '').toUpperCase(), detalles: x.detalles || '', mid, nombreArchivo: archivo ? archivo.nombre : '' });
          n++;
          if ($('.o-rres-plan', el).classList.contains('o-on') && x.fecha) {
            const dia = diasDe(v).indexOf(x.fecha) >= 0 ? x.fecha : null;
            if (dia) nuevo('paradas', { viaje: vid, dia, hora: x.hora || '', fin: x.horaFin || '', tipo: { vuelo: 'vuelo', hotel: 'hotel', tren: 'transporte', coche: 'transporte', entrada: 'actividad' }[x.tipo] || 'visita', nombre: x.titulo, nota: [x.codigo ? 'Localizador ' + x.codigo : '', x.detalles || ''].filter(Boolean).join('. '), lugar: x.lat != null ? { lat: x.lat, lng: x.lng, dir: x.lugar || '' } : null });
          }
        });
        if (n) actividad(vid, 'ha añadido ' + (n === 1 ? 'una reserva' : n + ' reservas'));
        c.cerrar(); aviso(n === 1 ? 'Reserva guardada' : n + ' reservas guardadas', { ic: 'check' });
      }
    }
  });
  function mostrarResultado() {
    const cu = $('#r-cuerpo', c.hoja);
    leyendo(c.hoja, false);
    animar(cu, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 200, easing: CURVA.salir }).then(() => {
      cu.innerHTML = `<div class="o-cap" data-e>He encontrado ${res.length === 1 ? 'una reserva' : res.length + ' reservas'}</div>
      ${res.map(x => { const T = TIPOS_DOC[x.tipo] || TIPOS_DOC.otro; return `<div class="o-rres" data-e>
        <button class="o-rres-inc o-on t t-s" data-a="plan"><span class="o-casilla">${ic('check', 13, 2.6)}</span></button>
        <div class="o-rres-c"><div class="o-fila" style="gap:10px"><span class="o-doc-ic">${ic(T.ic, 20, 1.5)}</span><div><div class="o-t3">${esc(x.titulo)}</div><div class="o-nota tn">${x.fecha ? esc(fechaLarga(x.fecha)) : 'Sin fecha'}${x.hora ? ' · ' + esc(x.hora) : ''}</div></div></div>
          ${x.codigo ? `<div class="o-rres-cod tn">${esc(x.codigo)}</div>` : ''}${x.detalles ? `<div class="o-nota">${esc(x.detalles)}</div>` : ''}
          <button class="o-rres-plan o-chk t${x.fecha && diasDe(v).indexOf(x.fecha) >= 0 ? ' o-on' : ' o-des'}" data-a="plan"><span class="o-casilla">${ic('check', 12, 2.6)}</span>Añadir también al plan del día</button></div></div>`; }).join('')}
      <button class="o-pil t t-g" data-a="guardarR" data-e style="margin-top:20px">Guardar en documentos</button>`;
      cu.style.opacity = ''; cu.style.transform = '';
      Anim.entrar(cu, { paso: 80 });
    });
  }
}
function leyendo(h, on) {
  let l = $('.o-leyendo', h);
  if (on && !l) { l = document.createElement('div'); l.className = 'o-leyendo'; l.innerHTML = `<div class="o-leyendo-o">${logo(70, { clase: 'o-logo-gira' })}</div><div class="o-nota">Leyendo la reserva…</div>`; $('.o-hoja-c', h).appendChild(l); animar(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }
  else if (!on && l) animar(l, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).then(() => l.remove());
}

/* ---- 11_grupo.js ---- */
/* ============================ GRUPO E INVITACIONES ============================
   Tres papeles: administración (todo, invita y cambia papeles), editor (cambia el plan) y lector (solo ve). */
const ROLES = { admin: 'Administración', editor: 'Editor', lector: 'Solo ver' };
function haceCuanto(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}
PANT.grupo = {
  render(p) {
    const ps = lista('personas').sort((a, b) => (a.nombre.split(' ').slice(1).join(' ') || a.nombre).localeCompare(b.nombre.split(' ').slice(1).join(' ') || b.nombre, 'es'));
    const esp = dato('espacio', 'espacio') || {};
    const act = lista('actividad', a => !p.id || a.viaje === p.id).sort((a, b) => b.cuando - a.cuando).slice(0, 25);
    const v = p.id ? dato('viajes', p.id) : null;
    return `<div class="o-cont">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button>${soyAdmin() ? `<button class="o-pil o-peq t" data-a="invitar">${ic('plus', 16, 2)}Invitar</button>` : ''}</div>
      <div class="o-cap" data-e style="margin-top:14px">${esc(esp.nombre || 'Vuestro espacio')}</div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:6px">El grupo</h1>
      <div class="o-grupo-avs" data-e>${ps.map((x, i) => `<span style="--i:${i}">${avatar(x, 58)}</span>`).join('')}</div>
      <div class="o-filas o-grupo">${ps.map(x => `<button class="o-per t" data-a="per" data-id="${x.id}" data-e>
        ${avatar(x, 44)}<span class="o-per-t"><span class="o-t3">${esc(x.nombre)}${x.id === yo() ? ' <span class="o-nota">· tú</span>' : ''}</span><span class="o-nota">${x.viajes && x.viajes.length ? (x.viajes.length === 1 ? 'Solo ve ' + esc((dato('viajes', x.viajes[0]) || { nombre: 'un viaje' }).nombre) : 'Ve ' + x.viajes.length + ' viajes') : v && v.quienes && v.quienes.indexOf(x.id) < 0 ? 'No va a este viaje' : (lista('paradas', q => (q.por || q._por) === x.id && (!p.id || q.viaje === p.id)).length + ' paradas añadidas')}</span></span>
        <span class="o-chip o-sup o-rol-${x.rol || 'editor'}">${ROLES[x.rol] || 'Editor'}</span></button>`).join('')}</div>
      ${act.length ? `<div class="o-sec" data-e><span class="o-cap">Lo último${v ? ' en ' + esc(v.nombre) : ''}</span></div>
      <div class="o-act">${act.map(a => { const pe = dato('personas', a.por || a._por); return `<div class="o-act-f" data-e>${avatar(pe, 30)}<span><b>${esc(pe ? pe.nombre.split(' ')[0] : 'Alguien')}</b> ${esc(a.txt)}</span><span class="o-nota tn">${haceCuanto(a.cuando)}</span></div>`; }).join('')}</div>` : ''}
    </div>`;
  },
  alEntrar(el) { $$('.o-grupo-avs>span', el).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateX(-30px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 200 + i * 80, easing: CURVA.muelle })); },
  acciones: {
    invitar: (b, e, p) => invitar(p.id),
    per: (b) => {
      const x = dato('personas', b.dataset.id);
      if (x.id === yo()) { Capa.menu($('.o-chip', b), [{ t: 'Cambiar mi foto', ic: 'camera', f: () => cambiarFotoPersona(x.id) }, { t: 'Ajustes', ic: 'settings', f: () => Nav.ir('ajustes') }]); return; }
      if (!soyAdmin()) return;
      const cambiar = async rol => {
        if (S.cfg.demo) { poner('personas', x.id, { rol }); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); return; }
        try { const r = await api('persona-rol', { id: x.id, rol }); recibir(r); Sync.ya(); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); } catch (e) { aviso(e.message); }
      };
      Capa.menu($('.o-chip', b), [
        { t: 'Administración', ic: x.rol === 'admin' ? 'check' : 'key', f: () => cambiar('admin') },
        { t: 'Editor', ic: x.rol === 'editor' || !x.rol ? 'check' : 'edit', f: () => cambiar('editor') },
        { t: 'Solo ver', ic: x.rol === 'lector' ? 'check' : 'info', f: () => cambiar('lector') },
        '-',
        { t: 'Qué viajes ve', ic: 'plan', f: () => viajesDePersona(x) },
        { t: x.foto ? 'Cambiar su foto' : 'Ponerle foto', ic: 'camera', f: () => cambiarFotoPersona(x.id) },
        x.foto ? { t: 'Quitar su foto', ic: 'close', f: () => poner('personas', x.id, { foto: null }) } : null,
        '-',
        { t: 'Quitar del espacio', ic: 'out', peligro: true, f: async () => {
          if (!(await Capa.confirmar({ titulo: '¿Quitar a ' + x.nombre + '?', texto: 'Su móvil deja de tener acceso. Lo que ha añadido se queda.', si: 'Quitar', peligro: true }))) return;
          if (S.cfg.demo) { borrar('personas', x.id); return; }
          try { const r = await api('persona-quitar', { id: x.id }); recibir(r); Sync.ya(); aviso('Quitado del espacio'); } catch (e) { aviso(e.message); }
        } }
      ].filter(Boolean));
    }
  }
};
function invitar(vid, o) {
  o = o || {};
  let rol = 'editor', alcance = vid ? 'viaje' : 'todo';
  const v = vid ? dato('viajes', vid) : null;
  const yoMismo = !!o.yoMismo;
  const c = Capa.hoja({
    html: yoMismo ? `<div class="o-hcab" data-e><div class="o-t2">Otro dispositivo tuyo</div></div>
      <p class="o-txt" data-e>Crea un código y ábrelo en el ordenador u otro móvil. Entrarás como tú, con tu papel y tus viajes, sin aparecer dos veces en el grupo. Sirve una vez y dura 12 horas.</p>
      <div id="i-res"></div>
      <button class="o-pil t t-g" data-a="crearInv" data-e style="margin-top:20px">Crear código</button>`
    : `<div class="o-hcab" data-e><div class="o-t2">${v && o.soloViaje ? 'Compartir «' + esc(v.nombre) + '»' : 'Invitar'}</div></div>
      <p class="o-txt" data-e>Crea una invitación y mándala por WhatsApp o por donde quieras. Sirve una vez y dura 12 horas.</p>
      ${v && !o.soloViaje ? `<div class="o-campo" data-e><span class="o-etq">A qué</span><div class="o-seg o-seg-al"><span class="o-pild"></span><button class="o-seg-b t o-on" data-a="alc" data-k="viaje">Solo este viaje</button><button class="o-seg-b t" data-a="alc" data-k="todo">Todo el espacio</button></div>
      <div class="o-nota" id="i-alc" style="margin-top:8px">Solo verá «${esc(v.nombre)}». El resto de tus viajes no.</div></div>` : ''}
      <div class="o-campo" data-e><span class="o-etq">Qué podrá hacer</span><div class="o-seg o-seg-rol"><span class="o-pild"></span>${Object.keys(ROLES).filter(k => !(alcance === 'viaje' && k === 'admin')).map(k => `<button class="o-seg-b t${k === rol ? ' o-on' : ''}" data-a="rol" data-r="${k}">${k === 'admin' && alcance === 'viaje' ? '' : ROLES[k]}</button>`).join('')}</div>
      <div class="o-nota" id="i-rol" style="margin-top:8px">Puede añadir y cambiar paradas, ideas y documentos.</div></div>
      <div id="i-res"></div>
      <button class="o-pil t t-g" data-a="crearInv" data-e style="margin-top:20px">Crear invitación</button>`,
    alAbrir: h => { $$('.o-seg', h).forEach(s => Anim.pildora(s, $('.o-on', s))); },
    acciones: {
      alc: (b) => {
        alcance = b.dataset.k; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b);
        const t = $('#i-alc', c.hoja); t.textContent = alcance === 'viaje' ? 'Solo verá «' + v.nombre + '». El resto de tus viajes no.' : 'Verá todos los viajes del espacio, también los que creéis después.';
        animar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        /* Administración solo tiene sentido para todo el espacio */
        const seg = $('.o-seg-rol', c.hoja), ad = $('[data-r="admin"]', seg);
        if (alcance === 'viaje' && ad) { ad.remove(); if (rol === 'admin') { rol = 'editor'; $('[data-r="editor"]', seg).classList.add('o-on'); } Anim.pildora(seg, $('.o-on', seg)); }
        if (alcance === 'todo' && !ad) { const n = document.createElement('button'); n.className = 'o-seg-b t'; n.dataset.a = 'rol'; n.dataset.r = 'admin'; n.textContent = ROLES.admin; seg.insertBefore(n, seg.children[1]); Anim.pildora(seg, $('.o-on', seg)); }
      },
      rol: (b) => { rol = b.dataset.r; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); const t = $('#i-rol', c.hoja); t.textContent = { admin: 'Puede hacerlo todo, también invitar y cambiar papeles.', editor: 'Puede añadir y cambiar paradas, ideas y documentos.', lector: 'Ve todo, pero no cambia nada.' }[rol]; animar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); },
      crearInv: async (b) => {
        if (S.cfg.demo) { aviso('En el ejemplo de prueba no se pueden crear invitaciones. Conecta tu espacio en Ajustes.'); return; }
        cargando(b, true);
        try {
          const r = yoMismo ? await api('invitar-yo', {}) : await api('invitar', { rol, viaje: alcance === 'viaje' && v ? v.id : '' });
          const paq = crearPaquete(r.codigo), enlace = location.origin + location.pathname + '#inv=' + paq;
          c.enlace = enlace; c.paq = paq;
          c.texto = yoMismo ? 'Abre esto en tu otro dispositivo para entrar en Orbeo como tú: ' : alcance === 'viaje' && v ? 'Te invito a «' + v.nombre + '» en Orbeo: ' : 'Únete a nuestros viajes en Orbeo: ';
          const box = $('#i-res', c.hoja);
          box.innerHTML = `<div class="o-inv"><span class="o-cap">Código</span><div class="o-inv-c tn">${r.codigo.split('').map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div><span class="o-nota">Caduca a las ${esc(enZona(TZ_CASA(), r.caduca).hora)}</span>
            <div class="o-conf-b">${navigator.share ? `<button class="o-pil t" data-a="compartirInv">${ic('share', 17)}Enviar</button>` : ''}<button class="o-pil o-sec t" data-a="copiarInv">${ic('copy', 17)}Copiar</button></div></div>`;
          b.remove();
          $$('.o-inv-c span', box).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateY(60%) rotate(8deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: i * 45, easing: CURVA.muelle }));
          animar(box, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: CURVA.muelle });
        } catch (e) { aviso(e.message); cargando(b, false); }
      },
      compartirInv: () => navigator.share({ title: 'Orbeo', text: c.texto, url: c.enlace }).catch(() => { }),
      copiarInv: (b) => copiar(c.texto + c.enlace + '\n\nSi te pide la invitación: ' + c.paq).then(() => { b.innerHTML = ic('check', 17, 2) + 'Copiado'; Anim.salto(b); })
    }
  });
}
/* Elegir qué viajes ve una persona */
function viajesDePersona(x) {
  const vs = viajes().concat(viajes(true)); let sel = (x.viajes && x.viajes.length) ? x.viajes.slice() : null;
  const pintar = () => `<div class="o-hcab" data-e><div class="o-t2">Qué ve ${esc(x.nombre.split(' ')[0])}</div></div>
    <button class="o-vsel t${!sel ? ' o-on' : ''}" data-a="todos" data-e><span class="o-casilla">${ic('check', 14, 2.6)}</span><span><span class="o-t3">Todo el espacio</span><span class="o-nota">También los viajes que creéis después</span></span></button>
    <div class="o-sec" data-e><span class="o-cap">O solo estos viajes</span></div>
    ${vs.map(v => `<button class="o-vsel t${sel && sel.indexOf(v.id) >= 0 ? ' o-on' : ''}" data-a="uno" data-id="${v.id}" data-e><span class="o-casilla">${ic('check', 14, 2.6)}</span><span class="o-vsel-f" style="${portadaUrl(v) ? `background-image:url('${portadaUrl(v)}')` : ''}"></span><span><span class="o-t3">${esc(v.nombre)}</span><span class="o-nota">${esc(rango(v.desde, v.hasta))}</span></span></button>`).join('')}
    <button class="o-pil t t-g" data-a="ok" data-e style="margin-top:20px">Guardar</button>`;
  const c = Capa.hoja({
    clase: 'o-hoja-alta', html: () => `<div class="o-hoja-scroll">${pintar()}</div>`,
    acciones: {
      todos: () => { sel = null; c.repintar(); },
      uno: (b) => { sel = sel || []; const i = sel.indexOf(b.dataset.id); if (i >= 0) sel.splice(i, 1); else sel.push(b.dataset.id); if (!sel.length) sel = null; c.repintar(); Anim.salto($('.o-casilla', $(`[data-id="${b.dataset.id}"]`, c.hoja))); },
      ok: async (b) => {
        if (S.cfg.demo) { poner('personas', x.id, { viajes: sel || [] }); c.cerrar(); aviso('Guardado'); return; }
        cargando(b, true);
        try { const r = await api('persona-viajes', { id: x.id, viajes: sel }); recibir(r); Sync.ya(); c.cerrar(); aviso(sel ? x.nombre.split(' ')[0] + ' ve ' + sel.length + (sel.length === 1 ? ' viaje' : ' viajes') : x.nombre.split(' ')[0] + ' ve todo el espacio'); }
        catch (e) { aviso(e.message); cargando(b, false); }
      }
    }
  });
}
/* Foto de una persona: la tuya o, si administras, la de cualquiera */
async function cambiarFotoPersona(id) {
  const [file] = await elegirArchivos('image/*'); if (!file) return;
  const blob = await reducir(file, 600, .86);
  const mid = await Subidas.guardar(blob, 'cara.jpg');
  poner('personas', id, { foto: { id: mid } });
  aviso('Foto cambiada', { ic: 'check' });
}

/* ---- 12_hora.js ---- */
/* ============================ HORA Y MONEDA ============================ */
const Cambio = {
  async tasas() {
    if (!S.tasas) S.tasas = await DB.get('tasas');
    if (S.tasas && Date.now() - S.tasas.t < 6 * 3600000) return S.tasas;
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/EUR'); const j = await r.json();
      if (j.result === 'success') { S.tasas = { t: Date.now(), act: (j.time_last_update_unix || 0) * 1000, r: j.rates }; DB.set('tasas', S.tasas); }
    } catch (e) { anotar('cambio', e); }
    return S.tasas;
  },
  convertir(v, de, a) { const t = S.tasas && S.tasas.r; if (!t || !t[de] || !t[a]) return null; return v / t[de] * t[a]; }
};
function dinero(v, mon) {
  if (v == null || isNaN(v)) return '—';
  const dec = ['JPY', 'KRW', 'ISK', 'VND', 'IDR', 'CLP', 'COP', 'HUF'].indexOf(mon) >= 0 ? 0 : (v >= 1000 ? 0 : 2);
  return nf(v, dec);
}
PANT.hora = {
  render(p) {
    const v = dato('viajes', p.id) || {}, casa = TZ_CASA(), tz = v.tz || casa;
    const a = enZona(tz), b = enZona(casa);
    const monA = v.moneda || 'EUR', monB = S.pref.monedaCasa || 'EUR';
    p.de = p.de || monA; p.a = p.a || (p.de === monA ? monB : monA);
    p.cant = p.cant != null ? p.cant : (p.de === 'JPY' ? 1000 : p.de === 'KRW' ? 10000 : 10);
    const hora0 = Math.floor(a.min / 60);
    return `<div class="o-cont o-hora">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span class="o-nota">${esc(v.nombre || '')}</span><span style="width:46px"></span></div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:14px">Hora y moneda</h1>
      <div class="o-relojes" data-e>
        <div class="o-reloj"><span class="o-cap">${esc(nombreZona(tz))} · allí</span><span class="o-reloj-h tn" data-reloj="${esc(tz)}">${a.hora}</span><span class="o-nota">${esc(fechaLarga(a.dia))}</span></div>
        <div class="o-reloj-dif"><span class="o-chip o-sup tn">${esc(difHoras(tz, casa))}</span></div>
        <div class="o-reloj o-reloj-b"><span class="o-cap">${esc(nombreZona(casa))} · en casa</span><span class="o-reloj-h tn" data-reloj="${esc(casa)}">${b.hora}</span><span class="o-nota">${esc(fechaLarga(b.dia))}</span></div>
      </div>
      <div class="o-sec" data-e><span class="o-cap">Las 24 horas</span><span class="o-nota">Arriba ${esc(nombreZona(tz))}, abajo ${esc(nombreZona(casa))}</span></div>
      <div class="o-horas o-nodrag" data-e><span class="o-pild"></span>${Array.from({ length: 24 }, (_, h) => { const c = cambiarZona(a.dia, p2(h) + ':00', tz, casa); const noche = h < 7 || h >= 23, cn = +c.hora.slice(0, 2) < 7 || +c.hora.slice(0, 2) >= 23; return `<button class="o-hr t t-s${h === hora0 ? ' o-on' : ''}" data-a="hr"><span class="tn${noche ? ' o-noche' : ''}">${p2(h)}</span><span class="tn${cn ? ' o-noche' : ''}">${c.hora.slice(0, 2)}</span></button>`; }).join('')}</div>
      <div class="o-sec" data-e><span class="o-cap">Conversor</span><span class="o-nota" id="h-act"></span></div>
      <div class="o-conv" data-e>
        <label class="o-conv-f"><span class="o-conv-m">${esc(p.de)}</span><input id="f-cant" class="o-conv-in tn" inputmode="decimal" value="${esc(nf(p.cant, 2).replace(/\./g, ''))}"><span class="o-conv-s">${esc(SIMBOLO[p.de] || p.de)}</span></label>
        <button class="o-conv-sw t t-s" data-a="girar">${ic('swap', 20)}</button>
        <div class="o-conv-f o-conv-r"><span class="o-conv-m">${esc(p.a)}</span><span class="o-conv-out tn" id="h-res">—</span><span class="o-conv-s">${esc(SIMBOLO[p.a] || p.a)}</span></div>
      </div>
      <div class="o-rapidas" data-e>${(p.de === 'JPY' || p.de === 'KRW' || p.de === 'ISK' ? [500, 1000, 5000, 10000, 30000] : [5, 10, 20, 50, 100]).map(n => `<button class="o-chip o-sup t t-s" data-a="rapida" data-n="${n}">${nf(n, 0)} ${esc(SIMBOLO[p.de] || p.de)}</button>`).join('')}</div>
      <div class="o-nota" data-e style="margin-top:16px;text-align:center" id="h-tasa"></div>
    </div>`;
  },
  alPintar(el, p) {
    const hs = $('.o-horas', el); Anim.pildora(hs, $('.o-hr.o-on', hs)); const on = $('.o-hr.o-on', hs); if (on) hs.scrollLeft = on.offsetLeft - hs.clientWidth / 2 + 24;
    const inp = $('#f-cant', el);
    const calc = () => {
      p.cant = parseFloat(inp.value.replace(/\./g, '').replace(',', '.')) || 0;
      const r = Cambio.convertir(p.cant, p.de, p.a);
      Anim.numero($('#h-res', el), dinero(r, p.a));
      const t1 = Cambio.convertir(1, p.a, p.de);
      $('#h-tasa', el).textContent = t1 ? `1 ${SIMBOLO[p.a] || p.a} = ${nf(t1, t1 > 100 ? 0 : 2)} ${SIMBOLO[p.de] || p.de}` : 'Sin cambio guardado todavía. Hace falta conexión una vez.';
      if (S.tasas) $('#h-act', el).textContent = 'Actualizado ' + haceCuanto(S.tasas.act || S.tasas.t);
    };
    inp.addEventListener('input', calc);
    inp.addEventListener('focus', () => inp.select());
    Cambio.tasas().then(calc); calc();
    p.calc = calc;
  },
  acciones: {
    girar: (b, e, p, pa) => {
      animar(b, [{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 520, easing: CURVA.muelle });
      const r = Cambio.convertir(p.cant, p.de, p.a);
      [p.de, p.a] = [p.a, p.de]; p.cant = r ? Math.round(r * 100) / 100 : p.cant;
      const fs = $$('.o-conv-f', pa.el);
      fs.forEach((f, i) => animar(f, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${i ? -16 : 16}px)` }], { duration: 180, easing: CURVA.salir }));
      setTimeout(() => { Nav.pintar(pa, false); $$('.o-conv-f', pa.el).forEach((f, i) => animar(f, [{ opacity: 0, transform: `translateY(${i ? 16 : -16}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 })); }, 190);
    },
    rapida: (b, e, p, pa) => { const i = $('#f-cant', pa.el); i.value = nf(+b.dataset.n, 0).replace(/\./g, ''); Anim.salto(b); p.calc(); },
    hr: (b) => { Anim.pildora(b.parentNode, b); $$('.o-hr', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); }
  }
};

/* ---- 13_pelicula.js ---- */
/* ============================ PELÍCULA DEL DÍA ============================
   Con las fotos y vídeos del día se monta un vídeo vertical: portada con el día, cada foto con un
   movimiento lento y su parada, fundidos entre ellas, música suave generada en el móvil y un final.
   Se ve al momento y se puede guardar (MediaRecorder) para compartirlo. */
function clipsDelDia(v, dia) {
  const ps = paradasDe(v.id, dia);
  const out = [];
  ps.forEach(x => (x.fotos || []).forEach(f => out.push({ m: f, tipo: 'foto', parada: x })));
  lista('medios', m => m.viaje === v.id && m.dia === dia).sort((a, b) => (a.creado || 0) - (b.creado || 0)).forEach(m => {
    const x = m.parada ? dato('paradas', m.parada) : null;
    if (out.some(o => urlMedio(o.m) === urlMedio(m))) return;
    out.push({ m, tipo: m.tipo === 'video' ? 'video' : 'foto', parada: x });
  });
  return { clips: out.slice(0, 30), paradas: ps };
}
function tituloPeli(v, dia, ps) {
  const ns = ps.map(p => p.nombre);
  if (/inari/i.test(ns.join(' '))) return 'Mil puertas<br>rojas';
  if (ns.length >= 2) return esc(ns[0].split(' ').slice(-1)[0]) + ' y<br>' + esc(ns[ns.length - 1].replace(/^(Cena|Comida|Paseo) (en|por) /, ''));
  if (ns.length === 1) return esc(ns[0]);
  return esc(v.ciudad || v.nombre);
}
PANT.pelicula = {
  clase: 'o-oscura o-ppeli',
  render(p) {
    const v = dato('viajes', p.id); if (!v) return '';
    const { clips, paradas } = clipsDelDia(v, p.dia);
    const fotos = clips.filter(c => c.tipo === 'foto').length, videos = clips.length - fotos;
    const dur = Math.round(2.4 + clips.length * 2.8 + 2.6);
    const portada = clips[0] ? urlMedio(clips[0].m) : portadaUrl(v);
    p.titulo = tituloPeli(v, p.dia, paradas);
    return `<div class="o-peli-p">
      <div class="o-peli-fondo" data-e="foto" style="${portada ? `background-image:url('${portada}')` : ''}"></div>
      <canvas class="o-peli-cv" width="720" height="1280"></canvas>
      <div class="o-peli-velo"></div>
      <div class="o-peli-seg">${(clips.length ? [0].concat(clips.map(() => 0), [0]) : [0]).map(() => '<span><i></i></span>').join('')}</div>
      <div class="o-peli-bar"><button class="o-bt o-vido t t-s" data-a="atras">${ic('back', 20)}</button><span class="o-chip o-vido"><span class="o-punto"></span>Película del día</span><button class="o-bt o-vido t t-s" data-a="peliMas">${ic('more', 20, 2.4)}</button></div>
      <div class="o-peli-info">
        <div class="o-cap o-claro" data-e>${esc(cap(diaSemana(p.dia)))} ${fecha(p.dia).getUTCDate()} · ${esc(v.ciudad || v.nombre)}</div>
        <h1 class="o-peli-tit" data-e="titulo">${p.titulo}</h1>
        <div class="o-peli-dat" data-e>${[[paradas.length, 'lugares'], [fotos, 'fotos'], [videos, 'vídeos'], [clips.length ? Math.floor(dur / 60) + ':' + p2(dur % 60) : '0:00', 'minutos']].map(([n, l]) => `<div><span class="o-num tn">${n}</span><span class="o-cap">${l}</span></div>`).join('')}</div>
        <div class="o-peli-b" data-e>
          ${clips.length ? `<button class="o-pil o-blanca t t-g" data-a="ver">${ic('play', 15, 2)}<span>Ver la película</span></button>` : `<button class="o-pil o-blanca t t-g" data-a="anadir">${ic('plus', 16, 2)}Añadir fotos y vídeos</button>`}
          ${clips.length ? `<button class="o-bt o-vido t t-s" data-a="guardarPeli" style="width:54px;height:54px" aria-label="Guardar vídeo">${ic('download', 19)}</button><button class="o-bt o-vido t t-s${S.pref.sinMusica ? ' o-apagado' : ''}" data-a="musica" style="width:54px;height:54px" aria-label="Música">${ic('music', 19)}</button>` : ''}
        </div>
        ${clips.length ? `<button class="o-enlace o-claro t" data-a="anadir" data-e style="margin:14px auto 0;display:block">Añadir más fotos y vídeos</button>` : `<p class="o-nota o-claro" data-e style="margin-top:14px;text-align:center">Las fotos que pongáis en las paradas de este día también salen.</p>`}
      </div>
    </div>`;
  },
  alSalir(el, p) { if (p.peli) p.peli.parar(); },
  acciones: {
    ver: async (b, e, p, pa) => {
      const el = pa.el;
      if (p.peli && p.peli.corre) { p.peli.pausa(); return; }
      if (p.peli && p.peli.pausado) { p.peli.seguir(); return; }
      el.classList.add('o-viendo');
      cargando(b, true);
      const v = dato('viajes', p.id);
      p.peli = new Peli($('.o-peli-cv', el), clipsDelDia(v, p.dia).clips, { v, dia: p.dia, titulo: p.titulo.replace(/<br>/g, '\n').replace(/&amp;/g, '&') }, $$('.o-peli-seg i', el));
      await p.peli.cargar();
      cargando(b, false);
      b.innerHTML = ic('pause', 15, 2) + '<span>Pausar</span>';
      p.peli.alFin = () => { el.classList.remove('o-viendo'); b.innerHTML = ic('play', 15, 2) + '<span>Ver otra vez</span>'; p.peli = null; };
      p.peli.alPausa = on => { b.innerHTML = on ? ic('play', 15, 2) + '<span>Seguir</span>' : ic('pause', 15, 2) + '<span>Pausar</span>'; el.classList.toggle('o-viendo', !on); };
      p.peli.empezar(!S.pref.sinMusica);
    },
    musica: (b) => { S.pref.sinMusica = !S.pref.sinMusica; guardarPref(); b.classList.toggle('o-apagado', S.pref.sinMusica); Anim.salto(b); aviso(S.pref.sinMusica ? 'Sin música' : 'Con música'); },
    anadir: async (b, e, p) => {
      const fs = await elegirArchivos('image/*,video/*', true); if (!fs.length) return;
      if (!puedoEditar()) return aviso('Con tu papel solo puedes ver.');
      for (const f of fs) {
        const video = /^video/.test(f.type);
        const blob = video ? f : await reducir(f, 1800, .85);
        const mid = await Subidas.guardar(blob, f.name || (video ? 'video.mp4' : 'foto.jpg'));
        nuevo('medios', { viaje: p.id, dia: p.dia, tipo: video ? 'video' : 'foto', mid }, { callado: true });
      }
      Nav.refrescar(); aviso(fs.length === 1 ? 'Añadida a la película' : fs.length + ' añadidas a la película', { ic: 'check' });
    },
    guardarPeli: async (b, e, p, pa) => {
      if (!window.MediaRecorder) return aviso('Este navegador no puede guardar vídeos. Prueba con Safari actualizado o Chrome.');
      if (p.peli) p.peli.parar();
      const v = dato('viajes', p.id), el = pa.el;
      el.classList.add('o-viendo', 'o-grabando');
      const pr = Capa.hoja({ clase: 'o-hoja-peq', cerrable: false, html: `<div class="o-grab"><div class="o-t3" data-e>Montando la película…</div><p class="o-nota" data-e>Se graba a tiempo real. No cierres la app.</p><div class="o-barra" data-e><i id="g-bar"></i></div></div>` });
      try {
        const peli = new Peli($('.o-peli-cv', el), clipsDelDia(v, p.dia).clips, { v, dia: p.dia, titulo: p.titulo.replace(/<br>/g, '\n').replace(/&amp;/g, '&') }, $$('.o-peli-seg i', el));
        await peli.cargar();
        peli.alAvance = k => { const g = $('#g-bar'); if (g) g.style.transform = `scaleX(${k})`; };
        const blob = await peli.grabar(!S.pref.sinMusica);
        pr.cerrar(); el.classList.remove('o-viendo', 'o-grabando');
        entregarPeli(blob, v, p.dia);
      } catch (er) { pr.cerrar(); el.classList.remove('o-viendo', 'o-grabando'); aviso('No se ha podido grabar: ' + er.message); anotar('grabar', er); }
    },
    peliMas: (b, e, p) => Capa.menu(b, [
      { t: 'Elegir otro día', ic: 'plan', f: () => { const v = dato('viajes', p.id); const c = Capa.hoja({ html: `<div class="o-hcab"><div class="o-t2" data-e>¿Qué día?</div></div><div class="o-dsel" data-e>${diasDe(v).map(d => `<button class="o-dsel-b t t-s${d === p.dia ? ' o-on' : ''}" data-a="d" data-d="${d}"><span class="o-nota">${'DLMXJVS'[fecha(d).getUTCDay()]}</span><span class="tn">${fecha(d).getUTCDate()}</span></button>`).join('')}</div>`, acciones: { d: (bb) => { p.dia = bb.dataset.d; c.cerrar(); const pa = Nav.actual(); Nav.pintar(pa, false); Anim.entrar(pa.el); } } }); } },
      { t: 'Añadir fotos y vídeos', ic: 'camera', f: () => PANT.pelicula.acciones.anadir(null, null, p) }
    ])
  }
};
function entregarPeli(blob, v, dia) {
  const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
  const nombre = `Orbeo ${v.nombre} ${dia}.${ext}`;
  const url = URL.createObjectURL(blob);
  const file = new File([blob], nombre, { type: blob.type });
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Lista</div></div>
      <video class="o-grab-v" data-e="pop" src="${url}" playsinline controls autoplay muted loop></video>
      <div class="o-conf-b" data-e>${navigator.canShare && navigator.canShare({ files: [file] }) ? `<button class="o-pil t" data-a="comp">${ic('share', 17)}Compartir</button>` : ''}<a class="o-pil o-sec t" href="${url}" download="${esc(nombre)}">${ic('download', 17)}Descargar</a></div>
      ${puedoEditar() ? `<button class="o-enlace t" data-a="aViaje" data-e style="display:block;margin:16px auto 0">Guardar en el viaje para el grupo</button>` : ''}`,
    acciones: {
      comp: () => navigator.share({ files: [file], title: v.nombre }).catch(() => { }),
      aViaje: async (b) => { const mid = await Subidas.guardar(blob, nombre); nuevo('medios', { viaje: v.id, dia, tipo: 'pelicula', mid }, { callado: true }); b.textContent = 'Guardada en el viaje'; Anim.salto(b); }
    }
  });
}

class Peli {
  constructor(cv, clips, info, barras) {
    this.cv = cv; this.x = cv.getContext('2d'); this.clips = clips; this.info = info; this.barras = barras || [];
    this.segs = [{ tipo: 'intro', dur: 2.4 }].concat(clips.map(c => ({ tipo: c.tipo, c, dur: 2.8 })), [{ tipo: 'fin', dur: 2.6 }]);
    this.total = this.segs.reduce((a, s) => a + s.dur, 0);
    this.t = 0; this.corre = false; this.pausado = false;
    const st = getComputedStyle(document.documentElement);
    this.acento = '#D9C3A1'; this.st = st;
  }
  async cargar() {
    await Promise.all([document.fonts.load('200 120px Inter'), document.fonts.load('500 30px Inter')]).catch(() => { });
    await Promise.all(this.segs.filter(s => s.c).map(async s => {
      const u = urlMedio(s.c.m) || (await blobMedio(s.c.m).then(b => b ? URL.createObjectURL(b) : '').catch(() => ''));
      if (!u) { s.malo = true; return; }
      if (s.tipo === 'video') {
        const vd = document.createElement('video'); vd.src = u; vd.muted = true; vd.playsInline = true; vd.crossOrigin = 'anonymous'; vd.preload = 'auto';
        await new Promise(ok => { vd.onloadeddata = ok; vd.onerror = ok; setTimeout(ok, 6000); });
        s.el = vd; s.dur = Math.min(4.5, Math.max(2, vd.duration || 3));
      } else {
        const im = new Image(); if (/^https?:/.test(u) && u.indexOf(location.origin) !== 0) im.crossOrigin = 'anonymous';
        await new Promise(ok => { im.onload = ok; im.onerror = () => { s.malo = true; ok(); }; im.src = u; });
        s.el = im;
      }
    }));
    this.segs = this.segs.filter(s => !s.malo);
    this.total = this.segs.reduce((a, s) => a + s.dur, 0);
    this.fondo = (this.segs.find(s => s.el && s.tipo === 'foto') || {}).el;
  }
  empezar(musica) {
    this.corre = true; this.t0 = performance.now(); this.t = 0;
    if (musica) this.musica = Musica.iniciar(this.total);
    const f = now => { if (!this.corre) return; this.t = (now - this.t0) / 1000; if (this.t >= this.total) { this.pintar(this.total - .001); this.fin(); return; } this.pintar(this.t); this.raf = requestAnimationFrame(f); };
    this.raf = requestAnimationFrame(f);
  }
  pausa() { this.corre = false; this.pausado = true; cancelAnimationFrame(this.raf); this.segs.forEach(s => s.el && s.el.pause && s.el.pause()); this.musica && this.musica.pausa(); this.alPausa && this.alPausa(true); }
  seguir() { this.pausado = false; this.corre = true; this.t0 = performance.now() - this.t * 1000; this.musica && this.musica.seguir(); this.alPausa && this.alPausa(false); const f = now => { if (!this.corre) return; this.t = (now - this.t0) / 1000; if (this.t >= this.total) { this.fin(); return; } this.pintar(this.t); this.raf = requestAnimationFrame(f); }; this.raf = requestAnimationFrame(f); }
  parar() { this.corre = false; cancelAnimationFrame(this.raf); this.musica && this.musica.parar(); this.segs.forEach(s => s.el && s.el.pause && s.el.pause()); }
  fin() { this.parar(); this.alFin && this.alFin(); }
  async grabar(musica) {
    const tipos = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const tipo = tipos.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const vs = this.cv.captureStream(30);
    let pistas = vs.getVideoTracks();
    if (musica) { this.musica = Musica.iniciar(this.total, true); if (this.musica && this.musica.stream) pistas = pistas.concat(this.musica.stream.getAudioTracks()); }
    const rec = new MediaRecorder(new MediaStream(pistas), tipo ? { mimeType: tipo, videoBitsPerSecond: 6000000 } : {});
    const trozos = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
    const listo = new Promise(ok => { rec.onstop = () => ok(new Blob(trozos, { type: rec.mimeType || tipo || 'video/webm' })); });
    rec.start(500);
    this.corre = true; this.t0 = performance.now();
    await new Promise(ok => {
      const f = now => { this.t = (now - this.t0) / 1000; this.alAvance && this.alAvance(Math.min(1, this.t / this.total)); if (this.t >= this.total) { this.pintar(this.total - .001); ok(); return; } this.pintar(this.t); requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    await espera(300);
    rec.stop(); this.parar();
    return listo;
  }
  cubrir(el, k, dir, alpha) {
    const x = this.x, W = 720, H = 1280;
    const iw = el.videoWidth || el.naturalWidth || W, ih = el.videoHeight || el.naturalHeight || H;
    const s = Math.max(W / iw, H / ih) * (1 + .1 * k);
    const w = iw * s, h = ih * s;
    const px = (W - w) / 2 + (dir % 2 ? 1 : -1) * 26 * (k - .5), py = (H - h) / 2 + (dir % 3 ? -1 : 1) * 30 * (k - .5);
    x.globalAlpha = alpha; x.drawImage(el, px, py, w, h); x.globalAlpha = 1;
  }
  seg(t) { let a = 0; for (let i = 0; i < this.segs.length; i++) { if (t < a + this.segs[i].dur) return [i, t - a]; a += this.segs[i].dur; } return [this.segs.length - 1, this.segs[this.segs.length - 1].dur]; }
  pintar(t) {
    const x = this.x, W = 720, H = 1280, [i, lt] = this.seg(t), s = this.segs[i], FUND = .6;
    x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, W, H);
    this.dibujar(s, i, lt / s.dur, 1);
    const sig = this.segs[i + 1];
    if (sig && lt > s.dur - FUND) { const k = (lt - (s.dur - FUND)) / FUND; this.dibujar(sig, i + 1, 0, k * k * (3 - 2 * k)); }
    this.barras.forEach((b, j) => { b.style.transform = `scaleX(${j < i ? 1 : j > i ? 0 : lt / s.dur})`; });
  }
  dibujar(s, i, k, alpha) {
    const x = this.x, W = 720, H = 1280;
    if (s.tipo === 'intro' || s.tipo === 'fin') {
      if (this.fondo) { x.save(); x.filter = 'blur(28px) brightness(.5)'; this.cubrir(this.fondo, s.tipo === 'fin' ? 1 - k : k, 1, alpha); x.restore(); }
      x.globalAlpha = alpha;
      const sube = (1 - Math.min(1, k * 2.2)) * 40;
      x.fillStyle = 'rgba(243,238,231,.7)'; x.font = '600 22px Inter'; x.textAlign = 'left';
      const d = this.info.dia, v = this.info.v;
      if (s.tipo === 'intro') {
        espaciado(x, (cap(diaSemana(d)) + ' ' + fecha(d).getUTCDate() + ' · ' + (v.ciudad || v.nombre)).toUpperCase(), 56, 780 + sube, 4);
        x.fillStyle = '#F3EEE7'; x.font = '200 112px Inter';
        this.info.titulo.split('\n').forEach((l, j) => x.fillText(l, 50, 900 + j * 112 + sube));
      } else {
        x.textAlign = 'center'; x.fillStyle = '#F3EEE7'; x.font = '200 150px Inter';
        x.fillText(String(fecha(d).getUTCDate()), W / 2, 600 + sube);
        x.font = '600 22px Inter'; x.fillStyle = 'rgba(243,238,231,.7)';
        espaciado(x, ('Día ' + (difDias(v.desde, d) + 1) + ' · ' + v.nombre).toUpperCase(), W / 2, 660 + sube, 4, true);
        const R = 46, cx = W / 2, cy = 840;
        [-150, -118, -90, -62, -30].forEach((a, j) => { const px = cx + R * Math.cos(a * Math.PI / 180), py = cy + R * Math.sin(a * Math.PI / 180); x.beginPath(); x.arc(px, py, j === 3 ? 7 : 5.5, 0, Math.PI * 2); x.fillStyle = j === 3 ? this.acento : 'rgba(243,238,231,.85)'; if (j === 3) { x.shadowColor = this.acento; x.shadowBlur = 24; } x.fill(); x.shadowBlur = 0; });
        x.font = '300 34px Inter'; x.fillStyle = '#F3EEE7'; x.fillText('orbeo', W / 2, 950);
      }
      x.globalAlpha = 1; x.textAlign = 'left';
      return;
    }
    if (s.el) {
      if (s.tipo === 'video') { if (alpha > .05 && s.el.paused && this.corre) { try { s.el.currentTime = 0; s.el.play(); } catch (e) { } } }
      this.cubrir(s.el, k, i, alpha);
      const g = x.createLinearGradient(0, H * .62, 0, H);
      g.addColorStop(0, 'rgba(8,8,9,0)'); g.addColorStop(1, 'rgba(8,8,9,.75)');
      x.globalAlpha = alpha; x.fillStyle = g; x.fillRect(0, H * .6, W, H * .4);
      if (s.c.parada) {
        const sube = (1 - Math.min(1, k * 3)) * 24;
        x.fillStyle = 'rgba(243,238,231,.7)'; x.font = '600 20px Inter';
        espaciado(x, (s.c.parada.hora || '').toUpperCase(), 50, H - 170 + sube, 4);
        x.fillStyle = '#F3EEE7'; x.font = '250 56px Inter';
        x.fillText(s.c.parada.nombre, 50, H - 110 + sube);
      }
      x.globalAlpha = 1;
    }
  }
}
function espaciado(x, txt, px, py, esp, centrar) {
  if (centrar) { let w = 0; for (const c of txt) w += x.measureText(c).width + esp; px -= w / 2; }
  for (const c of txt) { x.fillText(c, px, py); px += x.measureText(c).width + esp; }
}

/* Música suave hecha en el móvil: acordes largos con un arpegio encima. Nada de archivos. */
const Musica = {
  iniciar(total, grabar) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = new AC(), out = ac.createGain(), filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 2400; filtro.connect(out);
    out.gain.setValueAtTime(0, ac.currentTime); out.gain.linearRampToValueAtTime(.5, ac.currentTime + 1.2);
    out.gain.setValueAtTime(.5, ac.currentTime + Math.max(1.3, total - 1.6)); out.gain.linearRampToValueAtTime(0, ac.currentTime + total);
    out.connect(ac.destination);
    let dest = null; if (grabar && ac.createMediaStreamDestination) { dest = ac.createMediaStreamDestination(); out.connect(dest); }
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    const acordes = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]];
    const t0 = ac.currentTime + .05, compas = 2.4;
    for (let c = 0; c * compas < total; c++) {
      const ac4 = acordes[c % 4], tc = t0 + c * compas;
      ac4.forEach(n => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = (Math.random() - .5) * 8;
        g.gain.setValueAtTime(0, tc); g.gain.linearRampToValueAtTime(.06, tc + .8); g.gain.linearRampToValueAtTime(0, tc + compas + .6);
        o.connect(g); g.connect(filtro); o.start(tc); o.stop(tc + compas + .7);
      });
      [0, 1, 2, 3, 2, 1].forEach((j, k) => {
        const tn = tc + k * compas / 6, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = hz(ac4[j] + 12);
        g.gain.setValueAtTime(0, tn); g.gain.linearRampToValueAtTime(.05, tn + .02); g.gain.exponentialRampToValueAtTime(.0005, tn + .9);
        o.connect(g); g.connect(filtro); o.start(tn); o.stop(tn + 1);
      });
    }
    return { stream: dest && dest.stream, parar: () => { try { ac.close(); } catch (e) { } }, pausa: () => ac.suspend(), seguir: () => ac.resume() };
  }
};

/* ---- 14_ajustes.js ---- */
/* ============================ AJUSTES Y FEEDBACK ============================ */
function aplicarTema() {
  const t = S.pref.tema || 'auto';
  const o = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = o ? 'oscuro' : 'claro';
  const tc = $('#tc'); if (tc) tc.content = o ? '#0B0B0C' : '#F7F4EF';
  try { localStorage.setItem('orbeo-tema', t); } catch (e) { }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((S.pref.tema || 'auto') === 'auto') { aplicarTema(); Nav.refrescar(); } });
const MONEDAS = ['EUR', 'USD', 'GBP', 'CHF', 'MXN', 'ARS', 'COP', 'CLP', 'JPY'];

PANT.ajustes = {
  render() {
    const me = dato('personas', yo()), demo = S.cfg && S.cfg.demo;
    const tema = S.pref.tema || 'auto';
    const zonas = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : CIUDADES.map(c => c.tz)).filter((z, i, a) => a.indexOf(z) === i);
    const casa = TZ_CASA();
    if (zonas.indexOf(casa) < 0) zonas.unshift(casa);
    const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<div class="o-cont o-ajus">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button></div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:14px">Ajustes</h1>
      ${me ? `<div class="o-yo" data-e><button class="o-yo-av t t-s" data-a="fotoYo" aria-label="Cambiar tu foto">${avatar(me, 64)}<span class="o-yo-cam">${ic('camera', 13, 2)}</span></button><div><div class="o-t2">${esc(me.nombre)}</div><div class="o-nota">${esc(ROLES[me.rol] || 'Editor')} · ${esc((dato('espacio', 'espacio') || {}).nombre || '')}</div></div><button class="o-bt o-borde t t-s" data-a="editarYo">${ic('edit', 19)}</button></div>` : ''}
      ${demo ? `<div class="o-demo" data-e><div class="o-t3">Es el ejemplo de prueba</div><p class="o-nota">Tres viajes inventados. Lo que cambies se queda en este móvil. Cuando quieras, conecta vuestro espacio de verdad.</p><button class="o-pil o-peq t" data-a="salirDemo">Conectar nuestro espacio</button></div>` : ''}
      <div class="o-grupo-a" data-e><div class="o-cap">Aspecto</div>
        <div class="o-seg"><span class="o-pild"></span>${[['auto', 'Automático', 'auto'], ['claro', 'Porcelana', 'sun'], ['oscuro', 'Grafito', 'moon']].map(([k, n, i]) => `<button class="o-seg-b t${tema === k ? ' o-on' : ''}" data-a="tema" data-k="${k}">${ic(i, 17)}<span>${n}</span></button>`).join('')}</div>
        <p class="o-nota" style="margin-top:8px">Automático cambia solo con el modo del iPhone.</p></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Tu casa</div>
        <label class="o-aj-f"><span>Hora de casa</span><select class="o-sel" id="f-tz">${zonas.map(z => `<option value="${esc(z)}"${z === casa ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></label>
        <label class="o-aj-f"><span>Moneda de casa</span><select class="o-sel" id="f-mon">${MONEDAS.map(m => `<option${m === (S.pref.monedaCasa || 'EUR') ? ' selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Google Maps</div>
        <label class="o-aj-f o-aj-col"><span>Clave de la API</span><input id="f-maps" class="o-in" placeholder="AIza…" value="${esc(S.pref.mapsKey || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="o-nota">${claveMaps() ? 'Mapa de Google y buscador de sitios activos.' : 'Sin clave se usa un mapa abierto (OpenStreetMap) y fotos de Wikipedia.'} ${soyAdmin() && !demo ? 'Al guardarla, la usará todo el grupo.' : ''}</p>
        <button class="o-pil o-sec o-peq t" data-a="guardarMaps" style="margin-top:10px">Guardar la clave</button></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Conexión</div>
        <div class="o-aj-f"><span>Estado</span><span class="o-nota">${demo ? 'Viaje de ejemplo · sin script' : S.red.ok ? 'Conectado' + (S.red.ultimo ? ' · ' + haceCuanto(S.red.ultimo) : '') : 'Sin conexión con el script'}</span></div>
        <div class="o-aj-f"><span>Pendiente de enviar</span><span class="o-nota tn">${Sync.pendientes()} cambios</span></div>
        <div class="o-fila" style="margin-top:10px;gap:8px"><button class="o-pil o-sec o-peq t" data-a="sync">${ic('rotate', 16)}Sincronizar</button><button class="o-pil o-sec o-peq t" data-a="comprobar">${ic('check', 16)}Comprobar todo</button></div>
        <div id="a-comp"></div></div>
      ${!demo ? `<div class="o-grupo-a" data-e><div class="o-cap">Tus dispositivos</div>
        <p class="o-nota">Para abrir tu espacio también en el ordenador o en otro móvil, como tú y sin duplicarte en el grupo.</p>
        <button class="o-pil o-peq t" data-a="otroDisp" style="margin-top:10px">${ic('desktop', 16)}Conectar otro dispositivo mío</button></div>` : ''}
      <div class="o-grupo-a" data-e><div class="o-cap">Importar</div>
        <p class="o-nota">Trae viajes ya planificados desde un archivo de Orbeo, con sus paradas, hoteles y fotos.</p>
        <button class="o-pil o-peq t" data-a="importar" style="margin-top:10px">${ic('download', 16)}Importar viajes</button></div>
      ${!instalada ? `<div class="o-grupo-a" data-e><div class="o-cap">En el iPhone</div><p class="o-txt">Abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Así se abre a pantalla completa y sin conexión.</p></div>` : ''}
      <div class="o-grupo-a" data-e><div class="o-cap">Feedback</div>
        <p class="o-nota">Apunta lo que falle o lo que se te ocurra, con capturas. Luego lo exportas en un zip.</p>
        <div class="o-fila" style="margin-top:10px;gap:8px"><button class="o-pil o-peq t" data-a="feedback">${ic('bubble', 16)}Apuntar algo</button>${lista('feedback').length ? `<button class="o-pil o-sec o-peq t" data-a="zip">${ic('download', 16)}Exportar zip (${lista('feedback').length})</button>` : ''}</div>
        ${lista('feedback').sort((a, b) => b.creado - a.creado).slice(0, 5).map(f => `<div class="o-fb" data-e><span class="o-nota tn">${esc(haceCuanto(f.creado))}${f.fotos && f.fotos.length ? ' · ' + f.fotos.length + ' fotos' : ''}</span><span class="o-1l">${esc(f.txt)}</span></div>`).join('')}</div>
      <div class="o-grupo-a" data-e>
        <button class="o-pil o-sec o-pmal-t t" data-a="salir">${ic('out', 17)}${demo ? 'Salir del ejemplo' : 'Desconectar este móvil'}</button>
        <p class="o-nota" style="text-align:center;margin-top:16px">Orbeo ${VERSION}${S.sv ? ' · script ' + esc(S.sv) : ''}</p></div>
    </div>`;
  },
  alPintar(el) {
    const s = $('.o-seg', el); Anim.pildora(s, $('.o-on', s));
    $('#f-tz', el).addEventListener('change', e => { S.pref.tzCasa = e.target.value; guardarPref(); aviso('Hora de casa: ' + nombreZona(e.target.value)); });
    $('#f-mon', el).addEventListener('change', e => { S.pref.monedaCasa = e.target.value; guardarPref(); });
  },
  acciones: {
    tema: (b) => { S.pref.tema = b.dataset.k; guardarPref(); $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); setTimeout(() => { aplicarTema(); Nav.pila.forEach(pa => { pa.sucia = true; }); }, 380); },
    guardarMaps: (b, e, p, pa) => {
      const k = $('#f-maps', pa.el).value.trim();
      S.pref.mapsKey = k; guardarPref();
      if (soyAdmin() && S.cfg && !S.cfg.demo) poner('espacio', 'espacio', { mapsKey: k }, { callado: true });
      GM.prom = null;
      aviso(k ? 'Clave guardada. El mapa de Google sale al abrir un viaje.' : 'Clave quitada');
      Anim.salto(b);
    },
    sync: async (b) => { if (!Sync.activo()) return aviso('No hay script conectado.'); cargando(b, true); await Sync.ya(); cargando(b, false); aviso(S.red.ok ? 'Todo al día' : S.red.error.message); Nav.refrescar(); },
    comprobar: async (b, e, p, pa) => {
      cargando(b, true);
      const box = $('#a-comp', pa.el); box.innerHTML = '<div class="o-comp"></div>';
      const lst = $('.o-comp', box);
      const fila = (ok, t, d) => { const f = document.createElement('div'); f.className = 'o-comp-f'; f.innerHTML = `<span class="o-comp-i ${ok ? 'o-ok' : 'o-mal'}">${ic(ok ? 'check' : 'close', 13, 2.6)}</span><span><span>${esc(t)}</span>${d ? `<span class="o-nota">${esc(d)}</span>` : ''}</span>`; lst.appendChild(f); animar(f, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380 }); };
      fila(DB.modo !== 'memoria', 'Guardado en el móvil', DB.modo === 'idb' ? 'IndexedDB' : DB.modo === 'local' ? 'localStorage' : 'Solo en memoria: se perderá al cerrar');
      fila(navigator.onLine, 'Conexión a internet');
      if (Sync.activo()) { try { const r = await api('estado'); fila(true, 'Script de Google', 'Versión ' + r.sv + ' · ' + ROLES[r.rol]); fila(!!r.gemini, 'Clave de Gemini', r.gemini ? 'Lista para leer reservas y crear portadas' : 'Falta GEMINI_API_KEY en las propiedades del script'); } catch (er) { fila(false, 'Script de Google', er.message); } }
      else fila(false, 'Script de Google', 'No hay espacio conectado');
      if (claveMaps()) { try { await GM.cargar(); fila(true, 'Google Maps'); } catch (er) { fila(false, 'Google Maps', er.message); } } else fila(true, 'Mapa abierto', 'Sin clave de Google');
      const t = await Cambio.tasas(); fila(!!t, 'Cambio de moneda', t ? 'Actualizado ' + haceCuanto(t.act || t.t) : 'No se ha podido descargar');
      fila('serviceWorker' in navigator && !!navigator.serviceWorker.controller, 'Funciona sin conexión', navigator.serviceWorker && navigator.serviceWorker.controller ? 'Listo' : 'Se activa al volver a abrir');
      cargando(b, false);
    },
    importar: () => { if (!puedoEditar()) return aviso('Con solo lectura no puedes importar viajes.'); Importar.elegir(); },
    fotoYo: () => cambiarFotoPersona(yo()),
    otroDisp: () => invitar(null, { yoMismo: true }),
    editarYo: () => {
      const me = dato('personas', yo()); let color = me.color;
      const c = Capa.hoja({
        html: `<div class="o-hcab" data-e><div class="o-t2">Tú</div></div>
          <div class="o-yo-foto" data-e>${avatar(me, 88)}<div class="o-fila" style="gap:8px"><button class="o-pil o-sec o-peq t" data-a="fotoYoH">${ic('camera', 16)}${me.foto ? 'Cambiar foto' : 'Poner foto'}</button>${me.foto ? `<button class="o-pil o-sec o-peq t" data-a="sinFoto">Quitar</button>` : ''}</div></div>
          ${campo('yn', 'Nombre', '', me.nombre)}
          <div class="o-campo" data-e><div class="o-etq">Color</div><div class="o-colores">${COLORES.map(k => `<button class="o-color t t-s${k === me.color ? ' o-on' : ''}" data-a="col" data-c="${k}" style="background:${k}"><span>${ic('check', 16, 2.2)}</span></button>`).join('')}</div></div>
          <button class="o-pil t t-g" data-a="ok" data-e style="margin-top:18px">Guardar</button>`,
        acciones: {
          fotoYoH: async () => { await cambiarFotoPersona(yo()); c.cerrar(); },
          sinFoto: () => { poner('personas', yo(), { foto: null }); c.cerrar(); },
          col: (b) => { color = b.dataset.c; $$('.o-color', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.salto(b); },
          ok: () => { const n = $('#f-yn', c.hoja).value.trim(); if (n) poner('personas', yo(), { nombre: n, color }); c.cerrar(); }
        }
      });
    },
    feedback: () => feedback(),
    zip: async (b) => { cargando(b, true); try { await exportarFeedback(); } catch (e) { aviso(e.message); } cargando(b, false); },
    salirDemo: async () => { S.cfg = null; await DB.del('cfg'); S.recs = {}; S.cola = {}; guardarLocal(true); Nav.raiz('bienvenida'); },
    salir: async () => {
      const demo = S.cfg && S.cfg.demo;
      if (!(await Capa.confirmar({ titulo: demo ? '¿Salir del ejemplo?' : '¿Desconectar este móvil?', texto: demo ? '' : 'Se borra la copia de este móvil. Los datos siguen en la hoja de Google y en los móviles del grupo.' + (Sync.pendientes() ? ' Hay ' + Sync.pendientes() + ' cambios sin enviar que se perderán.' : ''), si: demo ? 'Salir' : 'Desconectar', peligro: !demo }))) return;
      S.cfg = null; await DB.del('cfg'); S.recs = {}; S.cola = {}; S.seq = 0; guardarLocal(true); Nav.raiz('bienvenida');
    }
  }
};

function feedback() {
  const fotos = [];
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Apuntar algo</div></div>
      <textarea id="f-fb" class="o-in o-area o-area-g" data-e rows="6" placeholder="Qué ha pasado, en qué pantalla, qué esperabas…"></textarea>
      <div class="o-fotos" id="fb-f" data-e><button class="o-foto o-foto-mas t" data-a="fbfoto">${ic('camera', 22, 1.6)}<span class="o-nota">Captura</span></button></div>
      <button class="o-pil t t-g" data-a="fbok" data-e style="margin-top:18px">Guardar</button>`,
    acciones: {
      fbfoto: async () => {
        const fs = await elegirArchivos('image/*', true);
        for (const f of fs) { const b = await reducir(f, 1600, .85); const mid = await Subidas.guardar(b, 'captura.jpg'); fotos.push({ id: mid }); const el = document.createElement('div'); el.className = 'o-foto'; el.style.backgroundImage = `url('${S.imgs[mid]}')`; $('#fb-f', c.hoja).prepend(el); animar(el, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: CURVA.muelle }); }
      },
      fbok: () => {
        const t = $('#f-fb', c.hoja).value.trim(); if (!t && !fotos.length) return Anim.no($('#f-fb', c.hoja));
        const pa = Nav.pila.map(x => x.id).join(' › ');
        nuevo('feedback', { txt: t, fotos, version: VERSION, pantalla: pa, ancho: innerWidth + '×' + innerHeight, tema: document.documentElement.dataset.tema, agente: navigator.userAgent });
        c.cerrar(); aviso('Apuntado. Gracias.', { ic: 'check' });
      }
    }
  });
}

/* ---------- ZIP sin compresión (formato «store»): basta para texto y fotos ya comprimidas */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function hacerZip(archivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  archivos.forEach(a => {
    const nom = enc.encode(a.nombre), d = a.datos instanceof Uint8Array ? a.datos : enc.encode(String(a.datos)), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nom.length, true);
    partes.push(new Uint8Array(h.buffer), nom, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nom.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nom);
    off += 30 + nom.length + d.length;
  });
  const tam = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, archivos.length, true); e.setUint16(10, archivos.length, true); e.setUint32(12, tam, true); e.setUint32(16, off, true);
  return new Blob(partes.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
}
async function exportarFeedback() {
  const fb = lista('feedback').sort((a, b) => a.creado - b.creado);
  const arch = [];
  let txt = 'ORBEO · feedback · ' + new Date().toLocaleString('es-ES') + '\nVersión ' + VERSION + (S.sv ? ' · script ' + S.sv : '') + '\n\n';
  for (let i = 0; i < fb.length; i++) {
    const f = fb[i], n = p2(i + 1);
    txt += `#${n} · ${new Date(f.creado).toLocaleString('es-ES')} · ${nombreDe(f.por || f._por)}\nPantalla: ${f.pantalla || '-'} · ${f.ancho || ''} · ${f.tema || ''}\n${f.txt}\n`;
    for (let j = 0; j < (f.fotos || []).length; j++) {
      try { const b = await blobMedio(f.fotos[j]); if (b) { arch.push({ nombre: `capturas/${n}_${j + 1}.jpg`, datos: new Uint8Array(await b.arrayBuffer()) }); txt += `  captura: capturas/${n}_${j + 1}.jpg\n`; } } catch (e) { txt += '  (captura no disponible en este móvil)\n'; }
    }
    txt += '\n';
  }
  arch.unshift({ nombre: 'feedback.txt', datos: txt }, { nombre: 'feedback.json', datos: JSON.stringify(fb, null, 2) }, { nombre: 'registro.txt', datos: REG.map(r => new Date(r.t).toISOString() + ' · ' + r.donde + ' · ' + r.m).join('\n') });
  const zip = hacerZip(arch);
  const nombre = 'orbeo_feedback_' + enZona(TZ_CASA()).dia + '.zip';
  const file = new File([zip], nombre, { type: 'application/zip' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Feedback de Orbeo' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
}

/* ---- 14_importar.js ---- */
/* ============================ IMPORTAR VIAJES ============================
   Lee un archivo .json de Orbeo ({ orbeo: 'viajes', viajes: [...] }) y crea los viajes con sus
   paradas, alojamientos, ideas y documentos. Después busca una foto real para la portada y para
   cada parada (Google si hay clave, si no Wikipedia) y la guarda. Si se corta, al volver a importar
   el mismo archivo no duplica nada y solo busca las fotos que falten. */
const Importar = {
  async elegir() {
    const fs = await elegirArchivos('.json,application/json', false);
    if (!fs.length) return;
    let d;
    try { d = JSON.parse(await fs[0].text()); } catch (e) { return aviso('Ese archivo no es un archivo de viajes de Orbeo.'); }
    if (!d || d.orbeo !== 'viajes' || !Array.isArray(d.viajes)) return aviso('Ese archivo no es un archivo de viajes de Orbeo.');
    this.hoja(d);
  },
  clave(v) { return (v.nombre + '|' + v.desde).toLowerCase(); },
  existente(v) { const k = this.clave(v); return lista('viajes').find(x => x.imp === k); },
  hoja(d) {
    const vs = d.viajes, nuevos = vs.filter(v => !this.existente(v));
    const nP = vs.reduce((n, v) => n + (v.paradas || []).length, 0);
    const fecha = v => { const a = new Date(v.desde + 'T12:00'), b = new Date((v.hasta || v.desde) + 'T12:00'); const m = x => x.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', ''); return m(a) + ' – ' + m(b) + ' ' + b.getFullYear(); };
    const c = Capa.hoja({
      html: `<div class="o-hcab" data-e><div class="o-t2">Importar viajes</div></div>
        <p class="o-nota" data-e>${vs.length} viajes · ${nP} paradas. Después busco una foto para cada sitio; tarda un par de minutos, deja la app abierta.</p>
        <div class="o-imp-l" data-e>${vs.map(v => { const ya = this.existente(v); return `<div class="o-imp-f"><span class="o-imp-i">${ic(ya ? 'check' : 'globe', 18)}</span><span><span class="o-t3">${esc(v.nombre)}</span><span class="o-nota">${esc(fecha(v))} · ${(v.paradas || []).length} paradas${ya ? ' · ya está' : ''}</span></span></div>`; }).join('')}</div>
        <div class="o-imp-p" data-e hidden><div class="o-nota" id="imp-t">Preparando…</div><div class="o-barra"><i id="imp-b"></i></div></div>
        <button class="o-pil t t-g" data-a="imp" data-e style="margin-top:18px">${nuevos.length ? 'Importar ' + nuevos.length + (nuevos.length === 1 ? ' viaje' : ' viajes') : 'Buscar las fotos que falten'}</button>`,
      acciones: {
        imp: async (b) => {
          if (b.disabled) return; b.disabled = true; cargando(b, true);
          const caja = $('.o-imp-p', c.hoja); caja.hidden = false; animar(caja, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
          const t = $('#imp-t', c.hoja), barra = $('#imp-b', c.hoja);
          const ids = this.crear(vs);
          t.textContent = 'Viajes creados. Buscando fotos…';
          Nav.refrescar();
          await this.fotos(ids, (h, n) => { t.textContent = `Buscando fotos · ${h} de ${n}`; barra.style.transform = `scaleX(${n ? h / n : 1})`; });
          cargando(b, false); b.disabled = false;
          b.textContent = 'Listo'; b.dataset.a = 'fin';
          t.textContent = 'Todo importado, con sus fotos.';
          Nav.pila.forEach(pa => { pa.sucia = true; }); Nav.refrescar();
        },
        fin: () => c.cerrar()
      }
    });
  },
  /* Crea lo que falte y devuelve los viajes del archivo (nuevos y ya existentes) */
  crear(vs) {
    const quienes = [yo()].filter(Boolean), salida = [];
    vs.forEach(v => {
      const k = this.clave(v);
      let id = (this.existente(v) || {}).id;
      if (!id) {
        id = nuevo('viajes', { nombre: v.nombre, lugar: v.lugar || '', ciudad: v.ciudad || '', pais: v.pais || '', tz: v.tz || TZ_CASA(), moneda: v.moneda || 'EUR', lat: v.lat ?? null, lng: v.lng ?? null, desde: v.desde, hasta: v.hasta || v.desde, quienes, portada: null, imp: k, impPortada: v.portada || [] }, { callado: true });
        (v.paradas || []).forEach((p, i) => nuevo('paradas', { viaje: id, dia: p.dia, hora: p.hora || '', fin: p.fin || '', nombre: p.nombre, tipo: p.tipo || 'visita', nota: p.nota || '', lugar: p.lat != null ? { lat: p.lat, lng: p.lng, dir: v.ciudad || '' } : null, fotos: [], impWiki: p.wiki || [], creado: Date.now() + i }, { callado: true }));
        (v.ideas || []).forEach(x => nuevo('ideas', { viaje: id, titulo: x.titulo, fuente: 'maps', url: x.lat != null ? `https://maps.google.com/?q=${x.lat},${x.lng}` : '', imagen: null, cat: x.cat || '', nota: x.nota || '', lugar: x.lat != null ? { lat: x.lat, lng: x.lng } : null, impWiki: x.wiki || [] }, { callado: true }));
        (v.docs || []).forEach(x => nuevo('docs', { viaje: id, tipo: TIPOS_DOC[x.tipo] ? x.tipo : 'otro', titulo: x.titulo, cuando: x.cuando || '', codigo: x.codigo || '', detalles: x.detalles || '' }, { callado: true }));
      }
      salida.push(id);
    });
    return salida;
  },
  /* Busca la foto de cada cosa que no la tenga todavía, de cuatro en cuatro */
  async fotos(vids, avance) {
    const tareas = [];
    vids.forEach(vid => {
      const v = dato('viajes', vid); if (!v) return;
      const cerca = { lat: v.lat, lng: v.lng };
      const deCiudad = [].concat(v.impPortada || [], v.ciudad ? [v.ciudad] : []);
      if (!v.portada) tareas.push(async () => { const u = await this.buscar(null, deCiudad); if (u) poner('viajes', vid, { portada: { url: u } }, { callado: true }); });
      paradasDe(vid).filter(p => !(p.fotos && p.fotos.length)).forEach(p => tareas.push(async () => {
        const u = await this.buscar(p.tipo === 'comida' || p.tipo === 'hotel' || p.tipo === 'compras' || p.tipo === 'noche' ? { q: p.nombre + ', ' + (v.ciudad || ''), cerca: p.lugar || cerca } : null, (p.impWiki || []).concat(deCiudad));
        if (u) poner('paradas', p.id, { fotos: [{ url: u }] }, { callado: true });
      }));
      lista('ideas', x => x.viaje === vid && !x.imagen).forEach(x => tareas.push(async () => {
        const u = await this.buscar(null, (x.impWiki || []).concat(deCiudad));
        if (u) poner('ideas', x.id, { imagen: { url: u } }, { callado: true });
      }));
    });
    let hechas = 0; avance(0, tareas.length);
    const cola = tareas.slice();
    const obrero = async () => { while (cola.length) { const t = cola.shift(); try { await t(); } catch (e) { anotar('importar', e); } avance(++hechas, tareas.length); } };
    await Promise.all([obrero(), obrero(), obrero(), obrero()]);
  },
  cache: {},
  /* Primero la ficha de Google del sitio (si hay clave y está cerca de donde debe), luego Wikipedia */
  async buscar(g, wikis) {
    if (g && claveMaps()) {
      try {
        const r = (await Lugar.buscar(g.q, { cerca: g.cerca }))[0];
        if (r && r.pid) {
          const s = await Lugar.completar(Object.assign({}, r));
          if (s.fotoG && (!g.cerca || g.cerca.lat == null || distanciaKm(s, g.cerca) < 8)) return s.fotoG;
        }
      } catch (e) { }
    }
    for (const w of wikis) {
      if (!w) continue;
      if (!(w in this.cache)) this.cache[w] = Lugar.fotoWiki(w);
      const u = await this.cache[w];
      if (u) return u;
    }
    return '';
  }
};
function distanciaKm(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---- 14_papelera.js ---- */
/* ============================ PAPELERA Y ARCHIVADOS ============================
   Borrar no borra: lo deja en la papelera 30 días (_b: 1) y se puede recuperar. «Borrar para siempre»
   lo marca _b: 2 y ya no sale en ningún sitio. Archivar un viaje lo quita del inicio y lo guarda en
   «Archivados», al final del inicio. Mantener pulsado un viaje, una parada, una idea o un documento
   abre su menú con estas opciones. */
const DIAS_PAPELERA = 30;
const COLS_PAPELERA = { viajes: 'Viaje', paradas: 'Parada', ideas: 'Idea', docs: 'Documento' };

/* Lo borrado de una colección en los últimos 30 días, con la fecha en que se borró */
function enPapelera(col, filtro) {
  const o = S.recs[col] || {}, lim = Date.now() - DIAS_PAPELERA * 864e5;
  return Object.keys(o).filter(id => o[id].f._b === 1 && (o[id].t._b || 0) > lim)
    .map(id => Object.assign({ id, _col: col, _bt: o[id].t._b || 0 }, o[id].f))
    .filter(x => !filtro || filtro(x)).sort((a, b) => b._bt - a._bt);
}
function papeleraInicio() { return enPapelera('viajes'); }
function papeleraViaje(vid) { return ['paradas', 'ideas', 'docs'].reduce((r, c) => r.concat(enPapelera(c, x => x.viaje === vid)), []).sort((a, b) => b._bt - a._bt); }
function restaurar(col, id) { poner(col, id, { _b: 0 }); }
function borrarYa(col, id) { poner(col, id, { _b: 2 }); }
function aPapelera(col, id, nombre) {
  borrar(col, id);
  aviso((nombre ? '«' + nombre + '» ' : '') + 'a la papelera', { accion: { t: 'Deshacer', f: () => restaurar(col, id) } });
}
function archivarViaje(id, si) {
  const v = dato('viajes', id); if (!v) return;
  poner('viajes', id, { archivado: !!si });
  aviso(si ? '«' + v.nombre + '» archivado' : '«' + v.nombre + '» vuelve al inicio', si ? { accion: { t: 'Deshacer', f: () => poner('viajes', id, { archivado: false }) } } : null);
}

/* Las dos carpetas al final del inicio */
function carpetasInicio() {
  const na = viajes(true).length, np = papeleraInicio().length;
  const f = (a, i, t, n) => `<button class="o-carp t" data-a="${a}"><span class="o-carp-i">${ic(i, 19, 1.6)}</span><span class="o-carp-n">${t}</span><span class="o-nota tn">${n || ''}</span></button>`;
  return `<div class="o-carps" data-e>${f('archivados', 'archive', 'Archivados', na)}${f('papelera', 'trash', 'Papelera', np)}</div>`;
}

/* ---------- Menú al mantener pulsado */
const MENU_LARGO = {
  viaje(id) {
    const v = dato('viajes', id); if (!v) return null;
    return [
      { t: 'Abrir', ic: 'fwd', f: () => abrirViaje(id) },
      puedoEditar() ? { t: v.archivado ? 'Sacar de archivados' : 'Archivar', ic: 'archive', f: () => archivarViaje(id, !v.archivado) } : null,
      soyAdmin() ? '-' : null,
      soyAdmin() ? { t: 'Borrar', ic: 'trash', peligro: true, f: () => aPapelera('viajes', id, v.nombre) } : null
    ];
  },
  parada(id) {
    const x = dato('paradas', id); if (!x || !puedoEditar()) return null;
    return [{ t: 'Abrir', ic: 'fwd', f: () => Nav.ir('parada', { id }) }, '-', { t: 'Borrar', ic: 'trash', peligro: true, f: () => aPapelera('paradas', id, x.nombre) }];
  },
  idea(id) {
    const x = dato('ideas', id); if (!x || !puedoEditar()) return null;
    return [{ t: 'Borrar la idea', ic: 'trash', peligro: true, f: () => aPapelera('ideas', id, x.titulo) }];
  },
  doc(id) {
    const x = dato('docs', id); if (!x || !puedoEditar()) return null;
    return [{ t: 'Borrar el documento', ic: 'trash', peligro: true, f: () => aPapelera('docs', id, x.titulo) }];
  },
  pap(id, el) {
    const col = el.dataset.col;
    return [{ t: 'Recuperar', ic: 'undo', f: () => recuperar(col, id) }, '-', { t: 'Borrar para siempre', ic: 'trash', peligro: true, f: () => borrarParaSiempre(col, id) }];
  }
};
(function () {
  let tm = null, x0 = 0, y0 = 0, hecho = false;
  const parar = () => { clearTimeout(tm); tm = null; };
  document.addEventListener('pointerdown', e => {
    hecho = false;
    const t = e.target.closest('[data-lp]'); if (!t || (e.button && e.button !== 0)) return;
    x0 = e.clientX; y0 = e.clientY; parar();
    tm = setTimeout(() => {
      tm = null;
      const ops = (MENU_LARGO[t.dataset.lp](t.dataset.id, t) || []).filter(Boolean);
      if (!ops.length) return;
      hecho = true;
      t.classList.remove('pres');
      try { navigator.vibrate && navigator.vibrate(12); } catch (er) { }
      animar(t, [{ transform: 'scale(.95)' }, { transform: 'scale(1.02)', offset: .55 }, { transform: 'none' }], { duration: 380, easing: CURVA.muelle });
      Capa.menu(t, ops);
    }, 480);
  }, { passive: true });
  document.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) parar(); }, { passive: true });
  document.addEventListener('pointerup', parar, { passive: true });
  document.addEventListener('pointercancel', parar, { passive: true });
  document.addEventListener('scroll', parar, { passive: true, capture: true });
  /* El toque que termina una pulsación larga no abre nada */
  document.addEventListener('click', e => { if (hecho) { hecho = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-lp]')) e.preventDefault(); });
})();

function recuperar(col, id) {
  restaurar(col, id);
  const x = S.recs[col] && S.recs[col][id] && S.recs[col][id].f;
  /* Si se recupera algo de un viaje que está en la papelera, vuelve también el viaje */
  if (x && x.viaje && S.recs.viajes && S.recs.viajes[x.viaje] && S.recs.viajes[x.viaje].f._b === 1) restaurar('viajes', x.viaje);
  aviso('Recuperado');
}
async function borrarParaSiempre(col, id) {
  const x = (S.recs[col] && S.recs[col][id] && S.recs[col][id].f) || {};
  if (!(await Capa.confirmar({ titulo: '¿Borrar «' + (x.nombre || x.titulo || '') + '» para siempre?', texto: 'Ya no se podrá recuperar.', si: 'Borrar para siempre', peligro: true }))) return;
  borrarYa(col, id);
}

/* ---------- Pantalla de la papelera (la del inicio o la de un viaje) */
PANT.papelera = {
  render(p) {
    const v = p.viaje ? dato('viajes', p.viaje) : null;
    const xs = p.viaje ? papeleraViaje(p.viaje) : papeleraInicio();
    return `<div class="o-cont">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span class="o-nota">${v ? esc(v.nombre) : ''}</span>${xs.length && puedoEditar() ? `<button class="o-pil o-sec o-peq o-pmal-t t" data-a="vaciar">Vaciar</button>` : '<span style="width:46px"></span>'}</div>
      <div class="o-tabc-t"><h1 class="o-t1" data-e="titulo">Papelera</h1><span class="o-num o-tabc-n tn" data-e>${xs.length}</span></div>
      <p class="o-nota" data-e style="margin-top:6px">${p.viaje ? 'Paradas, ideas y documentos borrados de este viaje.' : 'Viajes borrados.'} Se quedan aquí ${DIAS_PAPELERA} días. Mantén pulsado para recuperar o borrar para siempre.</p>
      ${xs.length ? `<div class="o-filas" style="margin-top:14px">${xs.map(filaPapelera).join('')}</div>`
      : `<div class="o-vacio" data-e="pop" style="margin-top:12vh"><div class="o-vacio-ic">${ic('trash', 30, 1.4)}</div><div class="o-t3">La papelera está vacía</div><p class="o-nota">Lo que borres se queda aquí ${DIAS_PAPELERA} días por si te arrepientes.</p></div>`}
    </div>`;
  },
  alVolver(el, p, pa) { if (pa.sucia) { pa.sucia = false; Nav.pintar(pa, false); } },
  acciones: {
    pap: (b) => Capa.menu(b, MENU_LARGO.pap(b.dataset.id, b)),
    recup: (b, e) => { e.stopPropagation(); recuperar(b.dataset.col, b.dataset.id); },
    vaciar: async (b, e, p) => {
      const xs = p.viaje ? papeleraViaje(p.viaje) : papeleraInicio();
      if (!(await Capa.confirmar({ titulo: '¿Vaciar la papelera?', texto: (xs.length === 1 ? 'Lo que hay' : 'Las ' + xs.length + ' cosas que hay') + ' se borra para siempre.', si: 'Vaciar', peligro: true }))) return;
      xs.forEach(x => poner(x._col, x.id, { _b: 2 }, { callado: true }));
      Nav.refrescar(); aviso('Papelera vacía');
    }
  }
};
function filaPapelera(x) {
  const quedan = Math.max(1, DIAS_PAPELERA - Math.floor((Date.now() - x._bt) / 864e5));
  const url = x._col === 'viajes' ? portadaUrl(x) : x._col === 'paradas' ? fotoParada(x, 330) : x._col === 'ideas' ? urlMedio(x.imagen, 330) : '';
  const icono = x._col === 'viajes' ? 'globe' : x._col === 'paradas' ? tipoDe(x.tipo).ic : x._col === 'ideas' ? 'idea' : 'doc';
  const d = new Date(x._bt);
  return `<div class="o-filav o-papf" data-e>
    <button class="o-papf-a t" data-a="pap" data-lp="pap" data-col="${x._col}" data-id="${x.id}">
      <span class="o-filav-f" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : ic(icono, 20, 1.5)}</span>
      <span class="o-filav-t"><span class="o-t3 o-1l">${esc(x.nombre || x.titulo || 'Sin nombre')}</span><span class="o-nota">${COLS_PAPELERA[x._col]} · borrado el ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} · ${quedan === 1 ? 'queda 1 día' : 'quedan ' + quedan + ' días'}</span></span>
    </button>
    ${puedoEditar() ? `<button class="o-bt o-borde t t-s" data-a="recup" data-col="${x._col}" data-id="${x.id}" aria-label="Recuperar">${ic('undo', 18)}</button>` : ''}
  </div>`;
}

/* ---------- Viajes archivados */
PANT.archivados = {
  render() {
    const vs = viajes(true).reverse();
    return `<div class="o-cont">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span></span><span style="width:46px"></span></div>
      <div class="o-tabc-t"><h1 class="o-t1" data-e="titulo">Archivados</h1><span class="o-num o-tabc-n tn" data-e>${vs.length}</span></div>
      <p class="o-nota" data-e style="margin-top:6px">Viajes que has quitado del inicio. Mantén pulsado uno para devolverlo al inicio o borrarlo.</p>
      ${vs.length ? `<div style="margin-top:18px">${galeriaRecuerdos(vs)}</div>`
      : `<div class="o-vacio" data-e="pop" style="margin-top:12vh"><div class="o-vacio-ic">${ic('archive', 30, 1.4)}</div><div class="o-t3">Nada archivado</div><p class="o-nota">Mantén pulsado un viaje del inicio y elige Archivar.</p></div>`}
    </div>`;
  },
  alVolver(el, p, pa) { if (pa.sucia) { pa.sucia = false; Nav.pintar(pa, false); } },
  acciones: { abrir: (b, e) => abrirViaje(b.dataset.id, b, e) }
};

/* ---- 15_arranque.js ---- */
/* ============================ ARRANQUE ============================ */
function splash() {
  const el = document.createElement('div'); el.className = 'o-splash';
  el.innerHTML = `<div class="o-splash-c">${logo(132, { clase: 'o-logo-sp' })}<div class="o-splash-m">${'orbeo'.split('').map(l => `<span>${l}</span>`).join('')}</div></div>`;
  document.body.appendChild(el);
  if (reducido()) return { fuera: () => animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).then(() => el.remove()) };
  const orbe = $('.o-lg-orbe', el), ruta = $('.o-lg-ruta', el), bs = $$('.o-lg-b', el), ls = $$('.o-splash-m span', el);
  animar($('svg', el), [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: CURVA.heroe, siempre: true });
  animar(orbe, [{ opacity: 0, transform: 'translate(-22px,10px)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 60, easing: CURVA.heroe, siempre: true });
  animar(ruta, [{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }], { duration: 700, delay: 180, easing: CURVA.entrar, siempre: true });
  bs.forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'center'; animar(b, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 430 + i * 140, easing: CURVA.muelle, siempre: true }); });
  ls.forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateY(70%)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 520 + i * 50, easing: CURVA.heroe, siempre: true }));
  const listo = espera(1150);
  return {
    fuera: async () => {
      await listo;
      animar($('.o-splash-c', el), [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.12) translateY(-10px)', opacity: 0 }], { duration: 460, easing: CURVA.salir, siempre: true });
      await animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 120, siempre: true });
      el.remove();
    }
  };
}

async function arrancar() {
  const sp = splash();
  await DB.abrir();
  S.pref = (await DB.get('pref')) || {};
  aplicarTema();
  S.cfg = (await DB.get('cfg')) || null;
  const d = await DB.get('datos');
  if (d) { S.recs = d.recs || {}; S.seq = d.seq || 0; S.sid = d.sid || ''; }
  S.cola = (await DB.get('cola')) || {};
  const q = new URLSearchParams(location.search);
  if (q.get('demo') === '1' && !S.cfg) { S.cfg = { demo: true, persona: 'p1', rol: 'admin' }; await DB.set('cfg', S.cfg); crearDemo(); guardarLocal(true); }
  if (q.get('tema')) { S.pref.tema = q.get('tema'); aplicarTema(); }
  if (S.cfg && S.cfg.demo && !lista('viajes').length) crearDemo();
  const inv = (location.hash.match(/inv=(ORBEO1-[A-Za-z0-9_-]+)/) || [])[1];
  const fuera = sp.fuera();
  await espera(reducido() ? 0 : 820);
  if (inv && (!S.cfg || S.cfg.demo)) { history.replaceState(null, '', location.pathname + location.search); Nav.raiz('bienvenida'); setTimeout(() => Nav.ir('conectar', { modo: 'unirse', inv }), 500); }
  else if (S.cfg) Nav.raiz('inicio');
  else Nav.raiz('bienvenida');
  await fuera;
  Red.pintar(); Reloj.arrancar(); Reloj.tic();
  if (Sync.activo()) Sync.ya();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => anotar('sw', e));
  Cambio.tasas();
}
/* En el ordenador se repinta al cruzar el ancho de dos columnas */
let anchoEsc = ESCRITORIO();
window.addEventListener('resize', () => { const e = ESCRITORIO(); if (e !== anchoEsc) { anchoEsc = e; const pa = Nav.actual(); if (pa) { Mapa.desmontar(pa.el); Nav.pintar(pa, false); } } });
arrancar();

})();
