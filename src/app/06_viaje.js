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
    { t: 'Grupo e invitaciones', ic: 'users', f: () => Nav.ir('grupo', { id: v.id }) },
    '-',
    puedoEditar() ? { t: 'Editar el viaje', ic: 'edit', f: () => editarViaje(v) } : null,
    { t: 'Ajustes', ic: 'settings', f: () => Nav.ir('ajustes') }
  ].filter(Boolean));
};
PANT.viaje.acciones.hora = (b, e, p) => Nav.ir('hora', { id: p.id });
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
      <div class="o-cap o-claro" data-e>${esc(rango(v.desde, v.hasta))} · ${diasDe(v).length} días</div>
      <h1 class="o-vcab-n" data-e="titulo">${esc(v.nombre)}</h1>
      <div class="o-fila o-vcab-pie" data-e><span>${esc(v.lugar || v.ciudad || '')}</span><button class="o-avs t" data-a="grupo">${ps.slice(0, 5).map(x => avatar(x, 28)).join('')}</button></div>
    </div>
  </header>`;
}

/* ============================ PESTAÑA PLAN ============================ */
TABS.plan = {
  render(v, p) {
    const dias = diasDe(v), hoy = hoyEn(v);
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
      </div>
      <div class="o-linea-t" data-dia="${p.dia}">
        ${ps.length ? ps.map((x, i) => filaParada(x, i, ps, ah, v)).join('') : `<div class="o-vacio-dia" data-e="pop"><div class="o-vacio-dia-o">${ic('plan', 26, 1.5)}</div><div class="o-t3">Día libre</div><p class="o-nota">${puedoEditar() ? 'Añade la primera parada o pasa una idea guardada.' : 'Todavía no hay nada planeado.'}</p></div>`}
      </div>
      ${puedoEditar() ? `<div class="o-plan-b" data-e><button class="o-pil o-sec t t-g" data-a="nuevaParada">${ic('plus', 18, 2)}Añadir parada</button>${lista('ideas', i => i.viaje === v.id && !i.parada).length ? `<button class="o-pil o-sec t t-g" data-a="deIdea">${ic('idea', 17)}De una idea</button>` : ''}</div>` : ''}
      <button class="o-peli t t-g" data-a="peli" data-e>
        <span class="o-peli-fs">${(lista('medios', m => m.viaje === v.id && m.dia === p.dia).slice(0, 3).map(m => `<span style="background-image:url('${urlMedio(m)}')"></span>`).join('')) || `<span class="o-peli-v">${ic('film', 22, 1.5)}</span>`}</span>
        <span class="o-peli-t"><span class="o-t3">Película del día</span><span class="o-nota">${fotosDia ? fotosDia + (fotosDia === 1 ? ' foto' : ' fotos') + ', se monta sola' : 'Añade fotos y se monta sola'}</span></span>
        <span class="o-bt o-lleno">${ic('play', 16, 2)}</span>
      </button>
      </div>`;
    if (ESCRITORIO()) return `<div class="o-esc"><div class="o-esc-plan">${plan}</div><div class="o-esc-mapa"><div class="o-mapa" id="mapa-esc" data-fijo></div></div></div>`;
    return plan;
  },
  alPintar(el, v, p, primera, pa) {
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
    f.style.transform = y > 0 ? `translateY(${Math.min(y, 500) * .25}px)` : `scale(${1 + Math.min(-y, 200) * .0015})`;
    const tx = $('.o-vcab-txt', el); if (tx) tx.style.opacity = Math.max(0, 1 - y / 300);
  }
};
function filaParada(x, i, ps, ah, v) {
  const foto = fotoParada(x), tp = TIPOS[x.tipo] || TIPOS.visita;
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
      <div class="o-ahora-c o-vid t t-g" data-a="parada" data-id="${x.id}">
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
    <button class="o-par-c t" data-a="parada" data-id="${x.id}">
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
    const lt = $('.o-linea-t', el), dc = $('.o-dcab', el), pb = $('.o-plan-b', el), pe = $('.o-peli', el);
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
    await animar($('.o-linea-t', vt), [{ opacity: 0, transform: `translateX(${atras ? -18 : 18}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 });
    pa.cambiando = false;
  },
  parada: (b, e, p) => {
    const f = $('.o-par-f,.o-ahora-f,.o-carr-f', b) || b;
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
