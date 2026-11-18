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
        <div class="o-recs">${pas.map(tarjetaRecuerdo).join('')}</div>` : ''}
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
    ajustes: () => Nav.ir('ajustes')
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
  return `<button class="o-heroe t t-g" data-a="abrir" data-id="${v.id}" data-e="heroe">
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
  return `<button class="o-filav t" data-a="abrir" data-id="${v.id}" data-e>
    <span class="o-filav-f" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : esc((v.nombre || '?')[0])}</span>
    <span class="o-filav-t"><span class="o-t3">${esc(v.nombre)}</span><span class="o-nota">${esc(rango(v.desde, v.hasta))} · ${esc(v.ciudad || v.lugar || '')}</span></span>
    <span class="o-filav-d"><span class="o-num tn">${e.e === 'curso' ? e.dia : e.faltan}</span><span class="o-cap">${e.e === 'curso' ? 'día' : 'días'}</span></span>
  </button>`;
}
function tarjetaRecuerdo(v) {
  const url = portadaUrl(v);
  return `<button class="o-rec t" data-a="abrir" data-id="${v.id}" data-e="pop">
    <span class="o-rec-f" style="${url ? `background-image:url('${url}')` : ''}"></span>
    <span class="o-rec-t"><span>${esc(v.nombre)}</span><span class="o-nota">${esc(MESES[fecha(v.desde).getUTCMonth()])} ${fecha(v.desde).getUTCFullYear()}</span></span>
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
      <label class="o-campo" data-e><span class="o-etq">Destino</span><input id="f-vd" class="o-in" placeholder="Ciudad o región" value="${esc(f.ciudad || '')}" autocomplete="off"><div class="o-sugs" id="v-sugs"></div></label>
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
        if (!(await Capa.confirmar({ titulo: '¿Borrar «' + v.nombre + '»?', texto: 'Se borra para todo el grupo, con sus paradas, ideas y documentos.', si: 'Borrar', peligro: true }))) return;
        borrar('viajes', v.id); c.cerrar(); Nav.raiz('inicio'); aviso('Viaje borrado');
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
    box.innerHTML = ls.map(s => `<button class="o-sug t" data-a="sug" data-j='${esc(JSON.stringify(s))}'>${ic('pin', 18)}<span><span>${esc(s.n)}</span><span class="o-nota">${esc(s.sub || '')}</span></span></button>`).join('');
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
