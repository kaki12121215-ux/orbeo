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
