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

/* ---------- viaje de ejemplo: el mismo de las maquetas, con fechas alrededor de hoy */
function crearDemo() {
  S.recs = {}; S.cola = {};
  const pon = (col, id, f) => { S.recs[col] = S.recs[col] || {}; S.recs[col][id] = { f: Object.assign({ creado: Date.now() }, f), t: {}, rev: 1, por: f.por || 'p1' }; };
  pon('espacio', 'espacio', { nombre: 'Viajes con amigos' });
  [['p1', 'Ane Ortiz', COLORES[0], 'admin'], ['p2', 'Jon Aguirre', COLORES[1], 'editor'], ['p3', 'Lucía Ferrer', COLORES[2], 'editor'], ['p4', 'Pablo Ibarra', COLORES[4], 'lector']]
    .forEach(([id, nombre, color, rol]) => pon('personas', id, { nombre, color, rol }));
  const hoyK = enZona('Asia/Tokyo').dia, d0 = sumaDias(hoyK, -4), D = n => sumaDias(d0, n);
  const hoyC = enZona(TZ_CASA()).dia;
  pon('viajes', 'vjp', { nombre: 'Japón', lugar: 'Tokio, Hakone y Kioto', ciudad: 'Kioto', pais: 'JP', tz: 'Asia/Tokyo', moneda: 'JPY', lat: 35.0116, lng: 135.7681, desde: d0, hasta: D(12), portada: { demo: 'kioto' }, quienes: ['p1', 'p2', 'p3', 'p4'] });
  pon('viajes', 'vis', { nombre: 'Islandia', lugar: 'La vuelta a la isla', ciudad: 'Reikiavik', pais: 'IS', tz: 'Atlantic/Reykjavik', moneda: 'ISK', lat: 64.1466, lng: -21.9426, desde: sumaDias(hoyC, 74), hasta: sumaDias(hoyC, 82), portada: { demo: 'islandia' }, quienes: ['p1', 'p2'] });
  pon('viajes', 'vny', { nombre: 'Nueva York', lugar: 'Manhattan y Brooklyn', ciudad: 'Nueva York', pais: 'US', tz: 'America/New_York', moneda: 'USD', lat: 40.7128, lng: -74.006, desde: sumaDias(hoyC, 151), hasta: sumaDias(hoyC, 157), portada: { demo: 'nyc' }, quienes: ['p1', 'p3', 'p4'] });
  pon('viajes', 'vli', { nombre: 'Lisboa', lugar: 'Alfama, Belém y Sintra', ciudad: 'Lisboa', pais: 'PT', tz: 'Europe/Lisbon', moneda: 'EUR', lat: 38.7223, lng: -9.1393, desde: sumaDias(hoyC, -128), hasta: sumaDias(hoyC, -124), portada: { demo: 'lisboa' }, quienes: ['p1', 'p2', 'p3'] });
  const P = (id, dia, hora, nombre, tipo, lat, lng, extra) => pon('paradas', id, Object.assign({ viaje: 'vjp', dia, hora, nombre, tipo, lugar: { lat, lng } }, extra || {}));
  P('a1', D(0), '15:40', 'Llegada a Haneda', 'vuelo', 35.5494, 139.7798, { nota: 'Vuelo IB 281 desde Madrid. Recoger los JR Pass en la terminal 3.', por: 'p2' });
  P('a2', D(0), '18:00', 'Hotel Kumo Shinjuku', 'hotel', 35.6938, 139.7034, { nota: 'Entrada desde las 15:00. Reserva a nombre de Jon.' });
  P('a3', D(0), '20:00', 'Cena en Omoide Yokocho', 'comida', 35.6929, 139.6995, { por: 'p3' });
  P('b1', D(1), '09:00', 'Templo Senso-ji', 'visita', 35.7148, 139.7967, { nota: 'Ir pronto, antes de que lleguen los grupos.' });
  P('b2', D(1), '12:30', 'Santuario Meiji', 'visita', 35.6764, 139.6993);
  P('b3', D(1), '17:30', 'Shibuya Sky al atardecer', 'actividad', 35.6585, 139.7022, { nota: 'Entradas compradas para las 17:40.', por: 'p3' });
  P('c1', D(2), '08:10', 'Romancecar a Hakone', 'transporte', 35.6896, 139.7006, { fin: '09:40' });
  P('c2', D(2), '11:00', 'Owakudani', 'visita', 35.2441, 139.0198);
  P('c3', D(2), '16:00', 'Ryokan con onsen', 'hotel', 35.249, 139.0465, { fotos: [{ demo: 'ryokan' }] });
  P('d1', D(3), '09:30', 'Shinkansen a Kioto', 'transporte', 35.2561, 139.1555, { fin: '11:45' });
  P('d2', D(3), '14:00', 'Bosque de bambú de Arashiyama', 'visita', 35.017, 135.6713);
  P('e1', D(4), '07:30', 'Fushimi Inari', 'visita', 34.9671, 135.7727, { hecho: true, fotos: [{ demo: 'inari' }], nota: 'Subir hasta el mirador de Yotsutsuji: una hora y media ida y vuelta.' });
  P('e2', D(4), '10:15', 'Kiyomizu-dera', 'visita', 34.9949, 135.785, { fotos: [{ demo: 'templo' }], nota: 'La terraza de madera es lo más bonito. Después bajar por Sannenzaka.', enlaces: ['https://www.kiyomizudera.or.jp/en/'] });
  P('e3', D(4), '13:00', 'Mercado de Nishiki', 'comida', 35.005, 135.7649, { fotos: [{ demo: 'nishiki' }], nota: 'Probar el tamagoyaki y los pinchos de pulpo.', por: 'p3' });
  P('e4', D(4), '16:30', 'Paseo por Gion', 'visita', 35.0037, 135.7788, { fotos: [{ demo: 'gion' }] });
  P('e5', D(4), '19:30', 'Cena en Pontocho', 'comida', 35.005, 135.7708, { fotos: [{ demo: 'ryokan' }], nota: 'Mesa para 4 a las 19:30.', por: 'p2' });
  P('f1', D(5), '09:00', 'Ciervos y Todai-ji en Nara', 'visita', 34.689, 135.8398);
  const I = (id, titulo, fuente, url, img, extra) => pon('ideas', id, Object.assign({ viaje: 'vjp', titulo, fuente, url, imagen: img ? { demo: img } : null }, extra || {}));
  I('i1', 'Los 5 mejores ramen de Kioto', 'tiktok', 'https://www.tiktok.com/@ejemplo/video/1', 'nishiki', { autor: '@comeconjapon', por: 'p3' });
  I('i2', 'Atardecer en la pagoda Yasaka', 'instagram', 'https://www.instagram.com/p/ejemplo/', 'gion', { autor: '@kyoto.light', por: 'p2' });
  I('i3', 'Arabica Higashiyama', 'maps', 'https://maps.google.com/?q=34.9983,135.7807', 'templo', { lugar: { lat: 34.9983, lng: 135.7807 }, nota: 'El café de la foto famosa, junto al río.' });
  I('i4', 'Guía de onsen en Hakone', 'web', 'https://www.ejemplo.com/hakone', 'ryokan', { nota: 'Para elegir el ryokan del día 3.' });
  I('i5', 'Templo dorado al abrir', 'tiktok', 'https://www.tiktok.com/@ejemplo/video/2', 'kioto', { autor: '@viajaconmapa' });
  I('i6', 'Paseo del Filósofo', 'maps', 'https://maps.google.com/?q=35.0269,135.7948', 'viajera', { lugar: { lat: 35.0269, lng: 135.7948 } });
  const Dd = (id, tipo, titulo, cuando, extra) => pon('docs', id, Object.assign({ viaje: 'vjp', tipo, titulo, cuando }, extra || {}));
  Dd('o1', 'vuelo', 'Madrid → Tokio Haneda', D(0) + ' 15:40', { codigo: 'K7Q2LM', detalles: 'IB 281 · Salida 12:05 · 4 pasajeros', por: 'p2' });
  Dd('o2', 'hotel', 'Hotel Kumo Shinjuku', D(0) + ' 15:00', { codigo: '88213907', detalles: '2 habitaciones dobles · 2 noches' });
  Dd('o3', 'tren', 'JR Pass · 7 días', D(1), { codigo: 'JR-4471', detalles: 'Activar en la terminal 3 de Haneda' });
  Dd('o4', 'hotel', 'Ryokan Gora Kadan', D(2) + ' 15:00', { codigo: 'GK-2093', detalles: 'Cena kaiseki incluida' });
  Dd('o5', 'entrada', 'Shibuya Sky', D(1) + ' 17:40', { codigo: 'SS1740-4', detalles: '4 entradas' });
  Dd('o6', 'seguro', 'Seguro de viaje', '', { codigo: 'PL-55120', detalles: 'Asistencia 24 h: +34 900 000 000' });
  ['inari', 'templo', 'nishiki', 'gion', 'ryokan', 'kioto', 'viajera'].forEach((f, i) => pon('medios', 'md' + i, { viaje: 'vjp', dia: D(4), tipo: 'foto', demo: f, por: i % 2 ? 'p2' : 'p1' }));
  [['p3', 'ha añadido Cena en Pontocho', 30], ['p2', 'ha subido la reserva del vuelo', 140], ['p1', 'ha marcado Fushimi Inari como hecho', 200], ['p3', 'ha guardado una idea de TikTok', 400]]
    .forEach(([por, txt, min], i) => pon('actividad', 'ac' + i, { viaje: 'vjp', txt, por, cuando: Date.now() - min * 60000 }));
  S.seq = 1;
}
