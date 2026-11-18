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
