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
  return `<button class="o-doc t t-g" data-a="doc" data-id="${d.id}" data-e>
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
