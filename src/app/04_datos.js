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
function viajes() { return lista('viajes').sort((a, b) => (a.desde || '').localeCompare(b.desde || '')); }
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
function fotoParada(p) { return p && p.fotos && p.fotos[0] ? urlMedio(p.fotos[0]) : ''; }
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
