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
