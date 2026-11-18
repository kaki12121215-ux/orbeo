/**
 * ORBEO · script de Google Apps Script · versión 1.0.0
 *
 * Va DENTRO de una hoja de Google: Extensiones › Apps Script › pegar todo este archivo.
 * Este archivo no lleva ninguna clave. Lo privado se guarda en
 * «Configuración del proyecto › Propiedades del script».
 *   GEMINI_API_KEY  › tu clave de Gemini (para leer reservas, enlaces y crear portadas con IA)
 *
 * Funciones que se ejecutan a mano desde el editor (desplegable de arriba › Ejecutar):
 *   configurar     › la primera vez. Prepara la hoja y la carpeta de Drive, pide los permisos
 *                    y escribe en el registro tu CÓDIGO DE ALTA.
 *   codigoDeAlta   › si el código de alta ha caducado (dura 12 horas), te da otro.
 *   comprobar      › revisa que todo está bien y dice qué falta.
 *   probarGemini   › prueba la clave de Gemini con una reserva de ejemplo.
 *
 * Al cambiar este código: Implementar › Gestionar implementaciones › lápiz ›
 * Versión: «Nueva versión» › Implementar. NUNCA «Nueva implementación» (cambia la dirección).
 */
const VERSION_SCRIPT = '1.1.0';
const ZONA = 'Europe/Madrid';
const HORAS_CODIGO = 12;
const MAX_ARCHIVO = 20 * 1024 * 1024;
const MAX_DIRECTO = 100 * 1024 * 1024;
const TROZO_CELDA = 45000;
const TROZOS_JSON = 4;
const ANCHO = 4 + TROZOS_JSON;
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const COLORES = ['#E8C9A0', '#B9C8B4', '#C7B8D8', '#E6B4A6', '#A9C4D6', '#D8CFA0', '#C9A9B5', '#9FC2B8'];
const ROLES = ['admin', 'editor', 'lector'];
const SOLO_SCRIPT = { personas: ['rol', 'alta', '_b', 'viajes'] };
const MODELOS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
const MODELOS_IMAGEN = ['gemini-3-pro-image', 'gemini-3-flash-image', 'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];

let LIBRO_ = null, HOJA_ = null, PROPS_ = null, T0_ = 0, PASOS_ = [];
function paso_(n) { PASOS_.push(n + ' ' + (Date.now() - T0_) + 'ms'); }
function P_() { if (!PROPS_) PROPS_ = PropertiesService.getScriptProperties(); return PROPS_; }

/* ============================ FUNCIONES PARA EL EDITOR ============================ */

function configurar() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  if (!libro) throw new Error('Este script tiene que estar dentro de una hoja de Google: ábrelo desde la hoja con Extensiones › Apps Script.');
  const p = P_();
  p.setProperty('HOJA_ID', libro.getId());
  let h = libro.getSheetByName('datos');
  if (!h) {
    h = libro.insertSheet('datos');
    h.getRange(1, 1, 1, ANCHO).setValues([['id', 'col', 'rev', 'por', 'json', 'json2', 'json3', 'json4']]);
    h.setFrozenRows(1);
  }
  h.getRange(1, 1, h.getMaxRows(), ANCHO).setNumberFormat('@');
  let lee = libro.getSheetByName('Léeme');
  if (!lee) {
    lee = libro.getSheets()[0].getName() === 'datos' ? libro.insertSheet('Léeme', 0) : libro.getSheets()[0].setName('Léeme');
    lee.getRange(1, 1, 4, 1).setValues([['Orbeo guarda aquí los datos de vuestros viajes.'], ['No borres ni cambies la pestaña «datos»: la app la usa tal cual.'], ['Las fotos y documentos están en la carpeta de Drive «Orbeo · archivos».'], ['Versión del script: ' + VERSION_SCRIPT]]);
  }
  let carpeta = null;
  try { carpeta = DriveApp.getFolderById(p.getProperty('CARPETA_ID') || 'x'); if (carpeta.isTrashed()) carpeta = null; } catch (e) { carpeta = null; }
  if (!carpeta) { carpeta = DriveApp.createFolder('Orbeo · archivos'); p.setProperty('CARPETA_ID', carpeta.getId()); }
  let tmp = null;
  try { tmp = DriveApp.getFolderById(p.getProperty('TMP_ID') || 'x'); if (tmp.isTrashed()) tmp = null; } catch (e) { tmp = null; }
  if (!tmp) { tmp = carpeta.createFolder('temporal'); p.setProperty('TMP_ID', tmp.getId()); }
  let red = 'sí';
  try { UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }); } catch (e) { red = 'no (' + e.message + ')'; }
  if (!p.getProperty('SID')) p.setProperty('SID', nuevoId_(12));
  if (!p.getProperty('SEQ')) p.setProperty('SEQ', '0');
  console.log('ORBEO · configurado (script ' + VERSION_SCRIPT + ')');
  console.log('Hoja: ' + libro.getName() + ' · Carpeta: Orbeo · archivos · Conexiones externas: ' + red + ' · Gemini: ' + (p.getProperty('GEMINI_API_KEY') ? 'clave puesta' : 'falta GEMINI_API_KEY'));
  if (p.getProperty('HAY_ADMIN') === '1') console.log('Ya hay administración en este espacio. Para conectar otro móvil, invita desde la app (Grupo › Invitar).');
  else codigoDeAlta();
}

function codigoDeAlta() {
  if (!P_().getProperty('HOJA_ID')) throw new Error('Primero ejecuta «configurar».');
  const c = crearCodigo_({ rol: 'admin', alta: true });
  console.log('TU CÓDIGO DE ALTA: ' + formatoCodigo_(c.codigo));
  console.log('Caduca el ' + Utilities.formatDate(new Date(c.caduca), ZONA, 'dd/MM/yyyy') + ' a las ' + Utilities.formatDate(new Date(c.caduca), ZONA, 'HH:mm') + '. Sirve una sola vez.');
  console.log('En la app: Crear nuestro espacio › pega la dirección del script (la que acaba en /exec) y este código.');
  return formatoCodigo_(c.codigo);
}

function comprobar() {
  const p = P_(), r = [];
  const ok = (t, f) => { try { r.push('OK · ' + t + (f ? ' · ' + f() : '')); } catch (e) { r.push('FALLA · ' + t + ' · ' + e.message); } };
  r.push('Orbeo · script ' + VERSION_SCRIPT + ' · zona ' + Session.getScriptTimeZone());
  ok('Hoja', () => libro_().getName());
  ok('Pestaña datos', () => (hoja_().getLastRow() - 1) + ' filas');
  ok('Carpeta de Drive', () => DriveApp.getFolderById(p.getProperty('CARPETA_ID')).getName());
  ok('Conexiones externas', () => UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }).getResponseCode());
  ok('Administración', () => p.getProperty('HAY_ADMIN') === '1' ? 'sí' : 'todavía no (usa el código de alta)');
  ok('Clave de Gemini', () => p.getProperty('GEMINI_API_KEY') ? 'puesta' : 'falta (Propiedades del script › GEMINI_API_KEY)');
  r.push('Móviles conectados: ' + Object.keys(p.getProperties()).filter(k => k.indexOf('tok:') === 0).length);
  r.forEach(x => console.log(x));
  return r.join('\n');
}

function probarGemini() {
  T0_ = Date.now(); PASOS_ = [];
  try {
    const r = reserva_({ texto: 'Confirmación de reserva. Vuelo IB6801 Madrid (MAD) - Tokio Haneda (HND). Salida 14/04/2027 12:05, llegada 15/04/2027 09:40 hora local. Localizador: K7Q2LM. Pasajeros: 4.', hoy: '2027-03-01', destino: 'Japón', tz: 'Asia/Tokyo' });
    console.log('Modelos probados: ' + PASOS_.join(' · '));
    console.log('Funciona con ' + r.modelo + ': ' + JSON.stringify(r.items));
    return r;
  } catch (e) { console.log('Modelos probados: ' + PASOS_.join(' · ')); throw e; }
}

/* ============================ WEB ============================ */

function doGet() {
  return ContentService.createTextOutput('Orbeo funciona · script ' + VERSION_SCRIPT + '. Esta dirección no se abre en el navegador: se pega en la app.');
}

function doPost(e) {
  const t0 = Date.now(); T0_ = t0; PASOS_ = [];
  let d = {};
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const r = atender_(d) || {};
    r.ok = true; r.sv = VERSION_SCRIPT;
    console.log((d.a || '?') + ' · ' + (Date.now() - t0) + ' ms' + (PASOS_.length ? ' · ' + PASOS_.join(' · ') : ''));
    return json_(r);
  } catch (err) {
    const propio = err && err.orbeo;
    console.error((d.a || '?') + ' · error · ' + (Date.now() - t0) + ' ms · ' + PASOS_.join(' · ') + ' · ' + (err && err.stack ? err.stack : err));
    return json_({ ok: false, sv: VERSION_SCRIPT, code: propio ? err.code : 'interno', error: propio ? err.message : 'Error dentro del script: ' + (err && err.message ? err.message : err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fallo_(code, msg) { const e = new Error(msg); e.orbeo = true; e.code = code; throw e; }

function atender_(d) {
  const a = String(d.a || '');
  if (a === 'hola') return { app: 'Orbeo', configurado: !!P_().getProperty('HOJA_ID'), hayAdmin: P_().getProperty('HAY_ADMIN') === '1', sid: P_().getProperty('SID') || '' };
  if (!P_().getProperty('HOJA_ID')) fallo_('config', 'El script todavía no está configurado. En el editor de Apps Script, ejecuta «configurar».');
  if (a === 'invitacion-ver') return verInvitacion_(d);
  if (a === 'unirse') return conBloqueo_(() => unirse_(d));
  const yo = quienSoy_(d.t);
  switch (a) {
    case 'estado': return { persona: yo.p, rol: yo.rol, viajes: yo.vias, seq: seq_(), sid: sidDe_(yo), gemini: !!P_().getProperty('GEMINI_API_KEY') };
    case 'cambios': return cambios_(Number(d.desde) || 0, yo);
    case 'invitar-yo': return conBloqueo_(() => invitarYo_(yo));
    case 'persona-viajes': soloAdmin_(yo); return conBloqueo_(() => personaViajes_(String(d.id || ''), d.viajes, yo));
    case 'guardar': return conBloqueo_(() => guardar_(d.ops || [], yo, Number(d.desde) || 0));
    case 'invitar': soloAdmin_(yo); return conBloqueo_(() => invitar_(d, yo));
    case 'persona-quitar': soloAdmin_(yo); return conBloqueo_(() => quitarPersona_(String(d.id || ''), yo));
    case 'persona-rol': soloAdmin_(yo); return conBloqueo_(() => cambiarRol_(String(d.id || ''), String(d.rol || ''), yo));
    case 'archivo-subir': puedeEditar_(yo); return subir_(d);
    case 'archivo-unir': puedeEditar_(yo); return unirArchivo_(d);
    case 'archivo-sesion': puedeEditar_(yo); return sesionSubida_(d);
    case 'archivo-leer': return leerArchivo_(d);
    case 'archivo-borrar': puedeEditar_(yo); archivoNuestro_(d.fid).setTrashed(true); return {};
    case 'reserva': puedeEditar_(yo); return reserva_(d);
    case 'enlace-info': puedeEditar_(yo); return enlaceInfo_(String(d.url || ''));
    case 'portada': puedeEditar_(yo); return portada_(d);
    default: fallo_('accion', 'Acción desconocida: «' + a + '». Puede que el script sea más antiguo que la app: actualízalo.');
  }
}

/* Fila para las peticiones que escriben: se espera como mucho 8 s; si sigue ocupada, la app reintenta sola. */
function conBloqueo_(f) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) { paso_('fila ocupada'); fallo_('ocupado', 'El script está ocupado con otra petición. Se reintentará solo.'); }
  paso_('fila');
  try { return f(); } finally { try { SpreadsheetApp.flush(); } catch (e) { } paso_('escrito'); lock.releaseLock(); }
}

/* ============================ PERSONAS Y CÓDIGOS ============================ */

function huella_(t) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8);
  return b.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
}
function nuevoId_(n) { let s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n).toLowerCase(); }
function nuevoCodigo_() {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now(), Utilities.Charset.UTF_8);
  let c = ''; for (let i = 0; i < 8; i++) c += ALFABETO[(b[i] & 255) % ALFABETO.length]; return c;
}
function formatoCodigo_(c) { return c.slice(0, 4) + '-' + c.slice(4); }
function limpiarCodigo_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function crearCodigo_(datos) {
  const p = P_(), todas = p.getProperties(), ahora = Date.now();
  Object.keys(todas).forEach(k => { if (k.indexOf('inv:') === 0) { try { if (JSON.parse(todas[k]).caduca < ahora) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); } } });
  const codigo = nuevoCodigo_();
  const o = Object.assign({ caduca: ahora + HORAS_CODIGO * 3600000, creado: ahora }, datos);
  p.setProperty('inv:' + codigo, JSON.stringify(o));
  return { codigo: codigo, caduca: o.caduca };
}
function leerCodigo_(codigo) {
  const c = limpiarCodigo_(codigo);
  if (c.length !== 8) fallo_('invitacion', 'El código no está completo. Vuelve a copiarlo y pegarlo entero.');
  const raw = P_().getProperty('inv:' + c);
  if (!raw) fallo_('invitacion', 'Esa invitación no existe o ya se ha usado. Pide una nueva.');
  const o = JSON.parse(raw);
  if (o.caduca < Date.now()) { P_().deleteProperty('inv:' + c); fallo_('invitacion', 'Esa invitación ha caducado (duran 12 horas). Pide una nueva.'); }
  if (o.alta && P_().getProperty('HAY_ADMIN') === '1') fallo_('invitacion', 'Este espacio ya tiene administración. Para entrar, pide una invitación desde la app.');
  o.codigo = c;
  return o;
}
function personasActivas_(filas) { return filas.filter(r => r.col === 'personas').map(r => ({ id: r.id, f: r.rec.f })).filter(x => !x.f._b); }
function verInvitacion_(d) {
  const inv = leerCodigo_(d.codigo), filas = leerTodo_(), pers = personasActivas_(filas);
  const esp = filas.filter(r => r.col === 'espacio')[0];
  const yoMismo = inv.persona ? pers.filter(x => x.id === inv.persona)[0] : null;
  const via = inv.viaje ? filas.filter(r => r.col === 'viajes' && r.id === inv.viaje && !r.rec.f._b)[0] : null;
  return { rol: inv.rol, alta: !!inv.alta, espacio: esp ? { nombre: esp.rec.f.nombre } : null, personas: pers.map(x => ({ id: x.id, nombre: x.f.nombre, color: x.f.color })),
    persona: yoMismo ? { id: yoMismo.id, nombre: yoMismo.f.nombre, color: yoMismo.f.color } : null, viaje: via ? { id: via.id, nombre: via.rec.f.nombre } : null };
}
function unirse_(d) {
  const inv = leerCodigo_(d.codigo), p = P_(), filas = leerTodo_(), pers = personasActivas_(filas);
  /* Otro aparato de la misma persona: entra como ella, sin crear a nadie nuevo */
  if (inv.persona) {
    const yo = pers.filter(x => x.id === inv.persona)[0];
    if (!yo) fallo_('invitacion', 'Esa persona ya no está en el espacio.');
    const rolYo = p.getProperty('rol:' + yo.id) || yo.f.rol || 'editor';
    const tok = nuevoId_(40);
    p.setProperty('tok:' + huella_(tok), JSON.stringify({ p: yo.id, rol: rolYo, alta: Date.now() }));
    p.deleteProperty('inv:' + inv.codigo);
    return { token: tok, persona: yo.id, rol: rolYo, sid: sidDe_({ p: yo.id }), seq: seq_() };
  }
  const rol = ROLES.indexOf(inv.rol) >= 0 ? inv.rol : 'editor';
  const nombre = String(d.nombre || '').trim().slice(0, 40);
  if (!nombre) fallo_('datos', 'Falta tu nombre.');
  let color = String(d.color || '').toUpperCase();
  if (COLORES.indexOf(color) < 0) color = COLORES[0];
  if (pers.some(x => String(x.f.color || '').toUpperCase() === color)) color = COLORES.filter(c => !pers.some(x => String(x.f.color || '').toUpperCase() === c))[0] || color;
  const id = 'p' + nuevoId_(9);
  escribirScript_(filas, 'personas', id, Object.assign({ nombre: nombre, color: color, rol: rol, alta: Date.now() }, inv.viaje ? { viajes: [inv.viaje] } : {}), id);
  /* Invitación a un viaje concreto: solo ve ese viaje y se apunta como viajero */
  if (inv.viaje) {
    p.setProperty('via:' + id, JSON.stringify([inv.viaje]));
    const v = filas.filter(r => r.col === 'viajes' && r.id === inv.viaje)[0];
    if (v) { const q = (v.rec.f.quienes || []).slice(); if (q.indexOf(id) < 0) q.push(id); escribirScript_(filas, 'viajes', inv.viaje, { quienes: q }, id); }
  }
  if (inv.alta && d.espacio) escribirScript_(filas, 'espacio', 'espacio', { nombre: String(d.espacio.nombre || 'Nuestros viajes').trim().slice(0, 40) }, id);
  const token = nuevoId_(40);
  p.setProperty('tok:' + huella_(token), JSON.stringify({ p: id, rol: rol, alta: Date.now() }));
  p.deleteProperty('inv:' + inv.codigo);
  if (rol === 'admin') p.setProperty('HAY_ADMIN', '1');
  return { token: token, persona: id, rol: rol, sid: sidDe_({ p: id }), seq: seq_() };
}
/* Viajes que puede ver una persona (null = todos) */
function viasDe_(id) { const r = P_().getProperty('via:' + id); if (!r) return null; try { return JSON.parse(r); } catch (e) { return null; } }
/* El identificador de la copia cambia si cambian los viajes que ve: su móvil vuelve a bajarlo todo */
function sidDe_(yo) { return P_().getProperty('SID') + (yo && yo.p ? (P_().getProperty('sidp:' + yo.p) || '') : ''); }
function visible_(x, yo) {
  if (!yo || !yo.vias) return true;
  const f = x.rec.f || {};
  if (x.col === 'viajes') return yo.vias.indexOf(x.id) >= 0;
  if (f.viaje) return yo.vias.indexOf(f.viaje) >= 0;
  if (x.col === 'personas' || x.col === 'espacio' || x.col === 'categorias') return true;
  return x.por === yo.p;
}
function invitarYo_(yo) {
  const c = crearCodigo_({ rol: yo.rol, por: yo.p, persona: yo.p });
  return { codigo: formatoCodigo_(c.codigo), caduca: c.caduca };
}
function personaViajes_(id, viajes, yo) {
  const filas = leerTodo_(), pe = personasActivas_(filas).filter(x => x.id === id)[0];
  if (!pe) fallo_('datos', 'Esa persona ya no está en el espacio.');
  if (id === yo.p) fallo_('permiso', 'No puedes limitar tus propios viajes.');
  const p = P_();
  const lista = Array.isArray(viajes) ? viajes.map(String).filter(v => /^[A-Za-z0-9_-]{3,40}$/.test(v)) : null;
  if (lista) p.setProperty('via:' + id, JSON.stringify(lista)); else p.deleteProperty('via:' + id);
  p.setProperty('sidp:' + id, nuevoId_(6));
  escribirScript_(filas, 'personas', id, { viajes: lista || [] }, yo.p);
  return cambios_(0, yo);
}
function quienSoy_(t) {
  if (!t) fallo_('token', 'Este móvil no está conectado al espacio.');
  const raw = P_().getProperty('tok:' + huella_(t));
  if (!raw) fallo_('token', 'Este móvil ya no tiene acceso al espacio. Pide una invitación nueva.');
  const o = JSON.parse(raw);
  /* El papel vale el que tenga ahora la persona en la hoja (puede haber cambiado) */
  const raw2 = P_().getProperty('rol:' + o.p); if (raw2) o.rol = raw2;
  o.vias = viasDe_(o.p);
  return o;
}
function soloAdmin_(yo) { if (yo.rol !== 'admin') fallo_('permiso', 'Esto solo lo puede hacer quien administra el espacio.'); }
function puedeEditar_(yo) { if (yo.rol === 'lector') fallo_('permiso', 'Con tu papel solo puedes ver. Pide a quien administra que te haga editor.'); }
function invitar_(d, yo) {
  const rol = ROLES.indexOf(d.rol) >= 0 ? d.rol : 'editor';
  const datos = { rol: rol, por: yo.p };
  if (d.viaje) {
    const v = leerTodo_().filter(r => r.col === 'viajes' && r.id === String(d.viaje) && !r.rec.f._b)[0];
    if (!v) fallo_('datos', 'Ese viaje ya no está.');
    datos.viaje = v.id;
  }
  const c = crearCodigo_(datos);
  return { codigo: formatoCodigo_(c.codigo), caduca: c.caduca };
}
function cambiarRol_(id, rol, yo) {
  if (ROLES.indexOf(rol) < 0) fallo_('datos', 'Papel no válido.');
  const filas = leerTodo_(), pe = personasActivas_(filas).filter(x => x.id === id)[0];
  if (!pe) fallo_('datos', 'Esa persona ya no está en el espacio.');
  if (id === yo.p && rol !== 'admin' && personasActivas_(filas).filter(x => x.f.rol === 'admin').length < 2) fallo_('permiso', 'Tiene que quedar al menos una persona en administración.');
  escribirScript_(filas, 'personas', id, { rol: rol }, yo.p);
  P_().setProperty('rol:' + id, rol);
  return cambios_(0, yo);
}
function quitarPersona_(id, yo) {
  if (id === yo.p) fallo_('permiso', 'No puedes quitarte a ti. Pide a otra persona administradora que lo haga.');
  const filas = leerTodo_(), pe = personasActivas_(filas).filter(x => x.id === id)[0];
  if (!pe) fallo_('datos', 'Esa persona ya no está en el espacio.');
  const p = P_(), todas = p.getProperties();
  Object.keys(todas).forEach(k => { if (k.indexOf('tok:') === 0) { try { if (JSON.parse(todas[k]).p === id) p.deleteProperty(k); } catch (e) { } } });
  escribirScript_(filas, 'personas', id, { _b: 1 }, yo.p);
  P_().deleteProperty('via:' + id);
  return cambios_(0, yo);
}

/* ============================ DATOS ============================ */

function libro_() { if (!LIBRO_) { const id = P_().getProperty('HOJA_ID'); if (!id) fallo_('config', 'El script todavía no está configurado. Ejecuta «configurar».'); LIBRO_ = SpreadsheetApp.openById(id); } return LIBRO_; }
function hoja_() { if (!HOJA_) { HOJA_ = libro_().getSheetByName('datos'); if (!HOJA_) fallo_('config', 'Falta la pestaña «datos». Ejecuta «configurar» otra vez.'); } return HOJA_; }
function seq_() { return Number(P_().getProperty('SEQ') || 0); }
function leerTodo_() {
  const h = hoja_(), n = h.getLastRow();
  if (n < 2) return [];
  const v = h.getRange(2, 1, n - 1, ANCHO).getValues();
  paso_('leído ' + v.length);
  return v.map((r, i) => {
    let rec; try { rec = JSON.parse(r.slice(4).map(x => String(x || '')).join('') || '{}'); } catch (e) { rec = {}; }
    rec.f = rec.f || {}; rec.t = rec.t || {};
    return { fila: i + 2, id: String(r[0]), col: String(r[1]), rev: Number(r[2]) || 0, por: String(r[3]), rec: rec };
  }).filter(x => x.id);
}
function trocear_(s) {
  if (s.length > TROZO_CELDA * TROZOS_JSON) fallo_('datos', 'Un elemento es demasiado grande para guardarlo.');
  const out = []; for (let i = 0; i < TROZOS_JSON; i++) out.push(s.slice(i * TROZO_CELDA, (i + 1) * TROZO_CELDA)); return out;
}
/* Todo como texto y el JSON solo con caracteres básicos: Sheets no convierte nada y un trozo nunca parte una letra. */
function jsonBasico_(o) { return JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)); }
function filaDe_(x) { return [x.id, x.col, String(x.rev), x.por].concat(trocear_(jsonBasico_(x.rec))).map(v => v ? "'" + v : ''); }
function salida_(x) { return { id: x.id, col: x.col, rev: x.rev, por: x.por, f: x.rec.f, t: x.rec.t }; }
function cambios_(desde, yo) {
  const s = seq_(), sid = sidDe_(yo);
  if (desde >= s && desde > 0) return { seq: s, sid: sid, cambios: [] };
  return { seq: s, sid: sid, cambios: leerTodo_().filter(x => x.rev > desde && visible_(x, yo)).map(salida_) };
}
function valido_(op) { return op && /^[A-Za-z0-9_-]{3,40}$/.test(String(op.id || '')) && /^[a-z][a-z0-9-]{1,24}$/.test(String(op.col || '')) && op.f && typeof op.f === 'object'; }
/* Campo a campo: gana la fecha más reciente de cada campo. */
function aplicar_(x, f, t, ahora, prohibidos) {
  let cambia = false;
  Object.keys(f).forEach(k => {
    if (prohibidos && prohibidos.indexOf(k) >= 0) return;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(k)) return;
    const ts = Math.min(Number(t && t[k]) || ahora, ahora + 60000), viejo = Number(x.rec.t[k]) || 0;
    if (ts >= viejo && (JSON.stringify(x.rec.f[k]) !== JSON.stringify(f[k]) || viejo !== ts)) { x.rec.f[k] = f[k]; x.rec.t[k] = ts; cambia = true; }
  });
  return cambia;
}
function guardar_(ops, yo, desde) {
  if (!Array.isArray(ops)) fallo_('datos', 'Cambios no válidos.');
  if (ops.length > 300) fallo_('datos', 'Demasiados cambios a la vez.');
  const filas = leerTodo_(), idx = {};
  filas.forEach(x => { idx[x.col + '|' + x.id] = x; });
  let seq = seq_();
  const ahora = Date.now(), tocadas = [], nuevas = [], avisos = [];
  ops.forEach(op => {
    if (!valido_(op)) { avisos.push('no-valido'); return; }
    const col = String(op.col), id = String(op.id);
    /* Quien solo ve puede cambiar su nombre y color y apuntar feedback; nada más */
    if (yo.rol === 'lector' && !(col === 'personas' && id === yo.p) && col !== 'feedback') { avisos.push('permiso:' + id); return; }
    if (col === 'espacio' && yo.rol !== 'admin' && Object.keys(op.f).some(k => k !== 'mapsKey')) { avisos.push('permiso:' + id); return; }
    if (col === 'personas' && id !== yo.p && yo.rol !== 'admin') { avisos.push('permiso:' + id); return; }
    let x = idx[col + '|' + id];
    /* Quien solo tiene algunos viajes no toca nada de los demás ni crea viajes nuevos */
    if (yo.vias) {
      if (col === 'viajes' && yo.vias.indexOf(id) < 0) { avisos.push('permiso:' + id); return; }
      if (col === 'espacio') { avisos.push('permiso:' + id); return; }
      const vv = (x && x.rec.f.viaje) || op.f.viaje;
      if (vv && yo.vias.indexOf(vv) < 0) { avisos.push('permiso:' + id); return; }
      if (op.f.viaje && x && x.rec.f.viaje && op.f.viaje !== x.rec.f.viaje) { avisos.push('permiso:' + id); return; }
    }
    const esNueva = !x;
    if (esNueva) {
      if (col === 'personas') { avisos.push('no-existe:' + id); return; }
      x = { id: id, col: col, rev: 0, por: yo.p, rec: { f: {}, t: {} } };
    }
    const f = Object.assign({}, op.f);
    if (col === 'personas' && f.color !== undefined && COLORES.indexOf(String(f.color).toUpperCase()) < 0) delete f.color;
    if (aplicar_(x, f, op.t || {}, ahora, SOLO_SCRIPT[col])) {
      seq++; x.rev = seq; x.por = yo.p;
      if (esNueva) { idx[col + '|' + id] = x; nuevas.push(x); filas.push(x); } else if (tocadas.indexOf(x) < 0) tocadas.push(x);
    }
  });
  escribirFilas_(tocadas, nuevas);
  P_().setProperty('SEQ', String(seq));
  return { seq: seq, sid: sidDe_(yo), avisos: avisos, cambios: filas.filter(x => x.rev > desde && visible_(x, yo)).map(salida_) };
}
function escribirFilas_(tocadas, nuevas) {
  const h = hoja_();
  tocadas.forEach(x => h.getRange(x.fila, 1, 1, ANCHO).setValues([filaDe_(x)]));
  if (nuevas.length) {
    const desde = h.getLastRow() + 1, r = h.getRange(desde, 1, nuevas.length, ANCHO);
    r.setNumberFormat('@'); r.setValues(nuevas.map(filaDe_));
    nuevas.forEach((x, i) => { x.fila = desde + i; });
  }
}
function escribirScript_(filas, col, id, f, por) {
  let x = filas.filter(y => y.col === col && y.id === id)[0];
  const nueva = !x;
  if (nueva) { x = { id: id, col: col, rev: 0, por: por, rec: { f: {}, t: {} } }; filas.push(x); }
  if (aplicar_(x, f, {}, Date.now(), null)) {
    const s = seq_() + 1; x.rev = s; x.por = por;
    escribirFilas_(nueva ? [] : [x], nueva ? [x] : []);
    P_().setProperty('SEQ', String(s));
  }
}

/* ============================ ARCHIVOS ============================ */

function carpeta_() { try { return DriveApp.getFolderById(P_().getProperty('CARPETA_ID')); } catch (e) { fallo_('config', 'No encuentro la carpeta «Orbeo · archivos» en Drive. Ejecuta «configurar» otra vez.'); } }
function temporal_() { try { return DriveApp.getFolderById(P_().getProperty('TMP_ID')); } catch (e) { fallo_('config', 'No encuentro la carpeta temporal de Orbeo. Ejecuta «configurar» otra vez.'); } }
function crearArchivo_(b64, tipo, nombre) {
  const bytes = Utilities.base64Decode(b64);
  if (bytes.length > MAX_ARCHIVO) fallo_('archivo', 'El archivo pasa de 20 MB.');
  const nom = String(nombre || 'archivo').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'archivo';
  return carpeta_().createFile(Utilities.newBlob(bytes, String(tipo || 'application/octet-stream'), nom)).getId();
}
function subir_(d) {
  const sid = String(d.sid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40), n = Number(d.n), total = Number(d.total), data = String(d.data || '');
  if (!sid || !(total >= 1 && total <= 60) || !(n >= 0 && n < total)) fallo_('archivo', 'Trozo de archivo no válido.');
  if (total === 1) return { fid: crearArchivo_(data, d.tipo, d.nombre) };
  return { tid: temporal_().createFile(sid + '_' + n, data, 'text/plain').getId() };
}
function unirArchivo_(d) {
  const ids = Array.isArray(d.ids) ? d.ids.map(String) : [], total = Number(d.total);
  if (!ids.length || ids.length !== total || total > 80) fallo_('archivo', 'Partes de archivo no válidas.');
  const tmpId = P_().getProperty('TMP_ID');
  let b64 = ''; const usados = [];
  ids.forEach((id, i) => {
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) fallo_('archivo', 'Falta la parte ' + (i + 1) + ' de ' + total + '.');
    let fi; try { fi = DriveApp.getFileById(id); } catch (e) { fallo_('archivo', 'Falta la parte ' + (i + 1) + ' de ' + total + '. Vuelve a intentarlo.'); }
    let ok = false; const pad = fi.getParents(); while (pad.hasNext()) if (pad.next().getId() === tmpId) ok = true;
    if (!ok) fallo_('archivo', 'Parte de archivo no válida.');
    b64 += fi.getBlob().getDataAsString(); usados.push(fi);
  });
  const fid = crearArchivo_(b64, d.tipo, d.nombre);
  usados.forEach(fi => { try { fi.setTrashed(true); } catch (e) { } });
  return { fid: fid };
}
function archivoNuestro_(fid) {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(String(fid || ''))) fallo_('archivo', 'Archivo no válido.');
  let fi; try { fi = DriveApp.getFileById(fid); } catch (e) { fallo_('archivo', 'Ese archivo ya no está en Drive.'); }
  const car = P_().getProperty('CARPETA_ID'), pad = fi.getParents();
  let ok = false; while (pad.hasNext()) if (pad.next().getId() === car) ok = true;
  if (!ok || fi.isTrashed()) fallo_('archivo', 'Ese archivo ya no está en la carpeta de Orbeo.');
  return fi;
}
function leerArchivo_(d) {
  const fi = archivoNuestro_(d.fid), desde = Math.max(0, Number(d.desde) || 0);
  let largo = Math.min(Number(d.largo) || 3145728, 3145728); largo -= largo % 3;
  const tam = fi.getSize();
  if (tam > 8 * 1024 * 1024) {
    if (desde >= tam) return { data: '', total: tam, tipo: fi.getMimeType() };
    const fin = Math.min(tam, desde + largo) - 1;
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fi.getId()) + '?alt=media', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + desde + '-' + fin }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 206 && r.getResponseCode() !== 200) fallo_('archivo', 'Google no ha dejado leer el archivo (' + r.getResponseCode() + ').');
    let trozo = r.getContent(); if (r.getResponseCode() === 200) trozo = trozo.slice(desde, fin + 1);
    return { data: Utilities.base64Encode(trozo), total: tam, tipo: fi.getMimeType() };
  }
  const blob = fi.getBlob(), bytes = blob.getBytes();
  return { data: Utilities.base64Encode(bytes.slice(desde, desde + largo)), total: bytes.length, tipo: blob.getContentType() };
}
function sesionSubida_(d) {
  const bytes = Number(d.bytes);
  if (!(bytes > 0 && bytes <= MAX_DIRECTO)) fallo_('archivo', 'El archivo pasa de 100 MB.');
  const origen = String(d.origen || '');
  if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(origen) && !/^http:\/\/localhost(:\d+)?$/.test(origen)) fallo_('archivo', 'Origen no válido.');
  const tipo = String(d.tipo || 'application/octet-stream').slice(0, 100), nombre = String(d.nombre || 'archivo').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'archivo';
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': tipo, 'X-Upload-Content-Length': String(bytes), Origin: origen },
    payload: JSON.stringify({ name: nombre, mimeType: tipo, parents: [carpeta_().getId()] })
  });
  if (r.getResponseCode() !== 200) fallo_('archivo', 'Google no ha dejado preparar la subida (' + r.getResponseCode() + ').');
  const h = r.getHeaders(), url = h.Location || h.location;
  if (!url) fallo_('archivo', 'Google no ha dado el enlace de subida.');
  return { url: url };
}

/* ============================ GEMINI ============================ */

function clave_() { const k = P_().getProperty('GEMINI_API_KEY'); if (!k) fallo_('gemini', 'Falta la clave de Gemini. En el editor: Configuración del proyecto › Propiedades del script › GEMINI_API_KEY.'); return k.trim(); }
/* Como en Ronda: varios modelos por orden; «pensar» al mínimo y, si el modelo no lo acepta, sin esa opción. */
function gemini_(partes, esquema, maxTok) {
  const clave = clave_();
  const cuerpo = { contents: [{ role: 'user', parts: partes }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTok || 4096, responseMimeType: 'application/json', responseSchema: esquema } };
  const pedir = (modelo, pensar) => {
    if (pensar === 'budget') cuerpo.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    else if (pensar === 'level') cuerpo.generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
    else delete cuerpo.generationConfig.thinkingConfig;
    return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, payload: JSON.stringify(cuerpo), muteHttpExceptions: true });
  };
  let ultimo = ''; const inicio = Date.now();
  for (let i = 0; i < MODELOS.length; i++) {
    if (Date.now() - inicio > 40000) { ultimo = ultimo || 'tarda demasiado'; break; }
    let r;
    try {
      r = pedir(MODELOS[i], /^gemini-2\./.test(MODELOS[i]) ? 'budget' : 'level');
      if (r.getResponseCode() === 400) { const r2 = pedir(MODELOS[i], ''); if (r2.getResponseCode() === 200) r = r2; }
    } catch (e) { ultimo = MODELOS[i] + ': ' + e.message; continue; }
    const code = r.getResponseCode();
    paso_(MODELOS[i] + ' ' + code);
    if (code !== 200) { ultimo = MODELOS[i] + ' ' + code + ': ' + r.getContentText().replace(/\s+/g, ' ').slice(0, 200); console.log(ultimo); if (code === 401 || code === 403) break; continue; }
    try {
      const j = JSON.parse(r.getContentText()), c = j.candidates && j.candidates[0];
      const txt = c && c.content && c.content.parts && c.content.parts.map(p => p.text || '').join('');
      return { o: JSON.parse(txt), modelo: MODELOS[i] };
    } catch (e) { ultimo = MODELOS[i] + ': respuesta no válida'; }
  }
  fallo_('gemini', 'Gemini no ha podido leerlo (' + ultimo + ').');
}

/* «Pega una reserva»: texto del correo o PDF/captura › lista de reservas ordenadas */
function reserva_(d) {
  const texto = String(d.texto || '').slice(0, 20000);
  if (!texto && !d.archivo) fallo_('datos', 'No hay nada que leer.');
  const instr = 'Lee esta confirmación de viaje (correo, PDF o captura) para una app de viajes en castellano. Viaje a ' + String(d.destino || '') + ', zona horaria del destino ' + String(d.tz || '') + '. Hoy es ' + String(d.hoy || '') + '.\n' +
    'Devuelve cada reserva por separado (ida y vuelta son dos; cada hotel uno). tipo: vuelo, hotel, tren (tren o autobús), coche, entrada (museos, actividades, restaurantes), seguro u otro.\n' +
    'titulo corto: «Madrid → Tokio», «Hotel Kumo Shinjuku», «Museo Ghibli». fecha AAAA-MM-DD y hora HH:MM en hora LOCAL del sitio donde ocurre (la salida de un vuelo, la entrada de un hotel). horaFin si hay llegada o salida. codigo: el localizador o número de reserva. detalles: una línea con lo útil (asientos, terminal, habitaciones, teléfono). lugar: dirección o nombre del sitio; lat y lng solo si los sabes con seguridad.\n' +
    'No inventes nada: lo que no esté, vacío.';
  const partes = [{ text: instr + (texto ? '\n\nTexto:\n' + texto : '') }];
  if (d.archivo) {
    const tipo = String(d.tipoArchivo || 'application/pdf');
    if (!/^(application\/pdf|image\/(png|jpeg|webp|heic))$/.test(tipo)) fallo_('archivo', 'Solo PDF o imágenes.');
    if (String(d.archivo).length > 10 * 1024 * 1024) fallo_('archivo', 'El archivo es demasiado grande.');
    partes.push({ inlineData: { mimeType: tipo, data: String(d.archivo) } });
  }
  const esquema = { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    tipo: { type: 'STRING', enum: ['vuelo', 'hotel', 'tren', 'coche', 'entrada', 'seguro', 'otro'] }, titulo: { type: 'STRING' }, fecha: { type: 'STRING' }, hora: { type: 'STRING' }, horaFin: { type: 'STRING' },
    codigo: { type: 'STRING' }, detalles: { type: 'STRING' }, lugar: { type: 'STRING' }, lat: { type: 'NUMBER' }, lng: { type: 'NUMBER' } }, required: ['tipo', 'titulo'] } } }, required: ['items'] };
  const r = gemini_(partes, esquema, 4096);
  const items = (r.o.items || []).slice(0, 20).map(x => {
    const o = { tipo: x.tipo, titulo: String(x.titulo || '').trim().slice(0, 120) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.fecha || '')) o.fecha = x.fecha;
    if (/^\d{1,2}:\d{2}$/.test(x.hora || '')) o.hora = ('0' + x.hora).slice(-5);
    if (/^\d{1,2}:\d{2}$/.test(x.horaFin || '')) o.horaFin = ('0' + x.horaFin).slice(-5);
    if (x.codigo) o.codigo = String(x.codigo).replace(/\s+/g, '').slice(0, 30);
    if (x.detalles) o.detalles = String(x.detalles).slice(0, 300);
    if (x.lugar) o.lugar = String(x.lugar).slice(0, 200);
    if (typeof x.lat === 'number' && typeof x.lng === 'number' && Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180) { o.lat = x.lat; o.lng = x.lng; }
    /* Un localizador que no aparece en el texto no se acepta */
    if (o.codigo && texto && texto.toUpperCase().replace(/\s+/g, '').indexOf(o.codigo.toUpperCase()) < 0) delete o.codigo;
    return o;
  }).filter(x => x.titulo);
  return { items: items, modelo: r.modelo };
}

/* Ideas: título, autor e imagen de un enlace (TikTok, Instagram, Maps o cualquier web) */
function enlaceInfo_(url) {
  if (!/^https?:\/\//i.test(url)) fallo_('datos', 'Enlace no válido.');
  const out = { url: url };
  try {
    if (/tiktok\.com/i.test(url)) {
      const r = UrlFetchApp.fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) { const j = JSON.parse(r.getContentText()); out.titulo = j.title; out.autor = j.author_unique_id ? '@' + j.author_unique_id : j.author_name; out.img = j.thumbnail_url; out.ttid = j.embed_product_id || ((j.html || '').match(/data-video-id="(\d+)"/) || [])[1] || ''; }
    }
    if (!out.titulo || !out.img) {
      const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)', 'Accept-Language': 'es-ES,es;q=0.9' } });
      const html = r.getContentText().slice(0, 400000);
      const meta = n => { const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + n + '["\'][^>]*content=["\']([^"\']*)', 'i')) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + n + '["\']', 'i')); return m ? decodificar_(m[1]) : ''; };
      out.titulo = out.titulo || meta('og:title') || ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim();
      out.img = out.img || meta('og:image');
      if (!out.autor) { const a = meta('og:site_name'); if (a && !/instagram|tiktok|google/i.test(a)) out.autor = a; }
      const fin = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i) || [])[1] || meta('og:url');
      if (fin) out.final = fin;
      const ll = html.match(/@(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/) || html.match(/center=(-?\d+\.\d{3,})%2C(-?\d+\.\d{3,})/);
      if (/maps/i.test(url) && ll) { out.lat = Number(ll[1]); out.lng = Number(ll[2]); }
    }
    if (out.titulo) out.titulo = out.titulo.replace(/\s*[|·-]\s*(Instagram|TikTok|Google Maps).*$/i, '').replace(/ on Instagram:?/i, ':').trim().slice(0, 160);
    if (out.img) {
      const r = UrlFetchApp.fetch(out.img, { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() === 200 && r.getContent().length < 3 * 1024 * 1024) { out.imagen = Utilities.base64Encode(r.getContent()); out.tipoImagen = r.getHeaders()['Content-Type'] || 'image/jpeg'; }
    }
  } catch (e) { console.log('enlace-info: ' + e.message); }
  delete out.img;
  return out;
}
function decodificar_(s) { return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)); }

/* Portada con IA: una foto vertical y elegante del destino, sin texto. Se guarda en Drive. */
function portada_(d) {
  const clave = clave_();
  const destino = String(d.destino || d.nombre || '').slice(0, 80);
  if (!destino) fallo_('datos', 'Falta el destino.');
  const prompt = 'Fotografía editorial vertical (3:4) de ' + destino + (d.ruta ? ' (' + String(d.ruta).slice(0, 80) + ')' : '') + ', luz dorada suave al atardecer, composición limpia con mucho aire, colores cálidos y apagados, sensación de lujo tranquilo, estilo revista de viajes. Sin texto, sin letras, sin marcas de agua, sin personas en primer plano.';
  let ultimo = '';
  for (let i = 0; i < MODELOS_IMAGEN.length; i++) {
    try {
      const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELOS_IMAGEN[i] + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true,
        payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } } }) });
      paso_(MODELOS_IMAGEN[i] + ' ' + r.getResponseCode());
      if (r.getResponseCode() !== 200) { ultimo = MODELOS_IMAGEN[i] + ' ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 160); if (r.getResponseCode() === 401 || r.getResponseCode() === 403) break; continue; }
      const j = JSON.parse(r.getContentText());
      const parte = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).filter(p => p.inlineData || p.inline_data)[0];
      if (!parte) { ultimo = MODELOS_IMAGEN[i] + ': sin imagen'; continue; }
      const id = parte.inlineData || parte.inline_data;
      const tipo = id.mimeType || id.mime_type || 'image/png';
      const fid = crearArchivo_(id.data, tipo, 'portada ' + destino + (tipo === 'image/png' ? '.png' : '.jpg'));
      return { fid: fid, data: id.data, tipo: tipo, modelo: MODELOS_IMAGEN[i] };
    } catch (e) { ultimo = MODELOS_IMAGEN[i] + ': ' + e.message; }
  }
  fallo_('gemini', 'No se ha podido crear la portada (' + ultimo + ').');
}
