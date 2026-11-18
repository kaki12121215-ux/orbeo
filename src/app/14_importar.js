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
