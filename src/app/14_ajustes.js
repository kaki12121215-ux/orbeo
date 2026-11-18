/* ============================ AJUSTES Y FEEDBACK ============================ */
function aplicarTema() {
  const t = S.pref.tema || 'auto';
  const o = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = o ? 'oscuro' : 'claro';
  const tc = $('#tc'); if (tc) tc.content = o ? '#0B0B0C' : '#F7F4EF';
  try { localStorage.setItem('orbeo-tema', t); } catch (e) { }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((S.pref.tema || 'auto') === 'auto') { aplicarTema(); Nav.refrescar(); } });
const MONEDAS = ['EUR', 'USD', 'GBP', 'CHF', 'MXN', 'ARS', 'COP', 'CLP', 'JPY'];

PANT.ajustes = {
  render() {
    const me = dato('personas', yo()), demo = S.cfg && S.cfg.demo;
    const tema = S.pref.tema || 'auto';
    const zonas = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : CIUDADES.map(c => c.tz)).filter((z, i, a) => a.indexOf(z) === i);
    const casa = TZ_CASA();
    if (zonas.indexOf(casa) < 0) zonas.unshift(casa);
    const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<div class="o-cont o-ajus">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button></div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:14px">Ajustes</h1>
      ${me ? `<div class="o-yo" data-e><button class="o-yo-av t t-s" data-a="fotoYo" aria-label="Cambiar tu foto">${avatar(me, 64)}<span class="o-yo-cam">${ic('camera', 13, 2)}</span></button><div><div class="o-t2">${esc(me.nombre)}</div><div class="o-nota">${esc(ROLES[me.rol] || 'Editor')} · ${esc((dato('espacio', 'espacio') || {}).nombre || '')}</div></div><button class="o-bt o-borde t t-s" data-a="editarYo">${ic('edit', 19)}</button></div>` : ''}
      ${demo ? `<div class="o-demo" data-e><div class="o-t3">Es el ejemplo de prueba</div><p class="o-nota">Tres viajes inventados. Lo que cambies se queda en este móvil. Cuando quieras, conecta vuestro espacio de verdad.</p><button class="o-pil o-peq t" data-a="salirDemo">Conectar nuestro espacio</button></div>` : ''}
      <div class="o-grupo-a" data-e><div class="o-cap">Aspecto</div>
        <div class="o-seg"><span class="o-pild"></span>${[['auto', 'Automático', 'auto'], ['claro', 'Porcelana', 'sun'], ['oscuro', 'Grafito', 'moon']].map(([k, n, i]) => `<button class="o-seg-b t${tema === k ? ' o-on' : ''}" data-a="tema" data-k="${k}">${ic(i, 17)}<span>${n}</span></button>`).join('')}</div>
        <p class="o-nota" style="margin-top:8px">Automático cambia solo con el modo del iPhone.</p></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Tu casa</div>
        <label class="o-aj-f"><span>Hora de casa</span><select class="o-sel" id="f-tz">${zonas.map(z => `<option value="${esc(z)}"${z === casa ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></label>
        <label class="o-aj-f"><span>Moneda de casa</span><select class="o-sel" id="f-mon">${MONEDAS.map(m => `<option${m === (S.pref.monedaCasa || 'EUR') ? ' selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Google Maps</div>
        <label class="o-aj-f o-aj-col"><span>Clave de la API</span><input id="f-maps" class="o-in" placeholder="AIza…" value="${esc(S.pref.mapsKey || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="o-nota">${claveMaps() ? 'Mapa de Google y buscador de sitios activos.' : 'Sin clave se usa un mapa abierto (OpenStreetMap) y fotos de Wikipedia.'} ${soyAdmin() && !demo ? 'Al guardarla, la usará todo el grupo.' : ''}</p>
        <button class="o-pil o-sec o-peq t" data-a="guardarMaps" style="margin-top:10px">Guardar la clave</button></div>
      <div class="o-grupo-a" data-e><div class="o-cap">Conexión</div>
        <div class="o-aj-f"><span>Estado</span><span class="o-nota">${demo ? 'Viaje de ejemplo · sin script' : S.red.ok ? 'Conectado' + (S.red.ultimo ? ' · ' + haceCuanto(S.red.ultimo) : '') : 'Sin conexión con el script'}</span></div>
        <div class="o-aj-f"><span>Pendiente de enviar</span><span class="o-nota tn">${Sync.pendientes()} cambios</span></div>
        <div class="o-fila" style="margin-top:10px;gap:8px"><button class="o-pil o-sec o-peq t" data-a="sync">${ic('rotate', 16)}Sincronizar</button><button class="o-pil o-sec o-peq t" data-a="comprobar">${ic('check', 16)}Comprobar todo</button></div>
        <div id="a-comp"></div></div>
      ${!demo ? `<div class="o-grupo-a" data-e><div class="o-cap">Tus dispositivos</div>
        <p class="o-nota">Para abrir tu espacio también en el ordenador o en otro móvil, como tú y sin duplicarte en el grupo.</p>
        <button class="o-pil o-peq t" data-a="otroDisp" style="margin-top:10px">${ic('desktop', 16)}Conectar otro dispositivo mío</button></div>` : ''}
      ${!instalada ? `<div class="o-grupo-a" data-e><div class="o-cap">En el iPhone</div><p class="o-txt">Abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Así se abre a pantalla completa y sin conexión.</p></div>` : ''}
      <div class="o-grupo-a" data-e><div class="o-cap">Feedback</div>
        <p class="o-nota">Apunta lo que falle o lo que se te ocurra, con capturas. Luego lo exportas en un zip.</p>
        <div class="o-fila" style="margin-top:10px;gap:8px"><button class="o-pil o-peq t" data-a="feedback">${ic('bubble', 16)}Apuntar algo</button>${lista('feedback').length ? `<button class="o-pil o-sec o-peq t" data-a="zip">${ic('download', 16)}Exportar zip (${lista('feedback').length})</button>` : ''}</div>
        ${lista('feedback').sort((a, b) => b.creado - a.creado).slice(0, 5).map(f => `<div class="o-fb" data-e><span class="o-nota tn">${esc(haceCuanto(f.creado))}${f.fotos && f.fotos.length ? ' · ' + f.fotos.length + ' fotos' : ''}</span><span class="o-1l">${esc(f.txt)}</span></div>`).join('')}</div>
      <div class="o-grupo-a" data-e>
        <button class="o-pil o-sec o-pmal-t t" data-a="salir">${ic('out', 17)}${demo ? 'Salir del ejemplo' : 'Desconectar este móvil'}</button>
        <p class="o-nota" style="text-align:center;margin-top:16px">Orbeo ${VERSION}${S.sv ? ' · script ' + esc(S.sv) : ''}</p></div>
    </div>`;
  },
  alPintar(el) {
    const s = $('.o-seg', el); Anim.pildora(s, $('.o-on', s));
    $('#f-tz', el).addEventListener('change', e => { S.pref.tzCasa = e.target.value; guardarPref(); aviso('Hora de casa: ' + nombreZona(e.target.value)); });
    $('#f-mon', el).addEventListener('change', e => { S.pref.monedaCasa = e.target.value; guardarPref(); });
  },
  acciones: {
    tema: (b) => { S.pref.tema = b.dataset.k; guardarPref(); $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); setTimeout(() => { aplicarTema(); Nav.pila.forEach(pa => { pa.sucia = true; }); }, 380); },
    guardarMaps: (b, e, p, pa) => {
      const k = $('#f-maps', pa.el).value.trim();
      S.pref.mapsKey = k; guardarPref();
      if (soyAdmin() && S.cfg && !S.cfg.demo) poner('espacio', 'espacio', { mapsKey: k }, { callado: true });
      GM.prom = null;
      aviso(k ? 'Clave guardada. El mapa de Google sale al abrir un viaje.' : 'Clave quitada');
      Anim.salto(b);
    },
    sync: async (b) => { if (!Sync.activo()) return aviso('No hay script conectado.'); cargando(b, true); await Sync.ya(); cargando(b, false); aviso(S.red.ok ? 'Todo al día' : S.red.error.message); Nav.refrescar(); },
    comprobar: async (b, e, p, pa) => {
      cargando(b, true);
      const box = $('#a-comp', pa.el); box.innerHTML = '<div class="o-comp"></div>';
      const lst = $('.o-comp', box);
      const fila = (ok, t, d) => { const f = document.createElement('div'); f.className = 'o-comp-f'; f.innerHTML = `<span class="o-comp-i ${ok ? 'o-ok' : 'o-mal'}">${ic(ok ? 'check' : 'close', 13, 2.6)}</span><span><span>${esc(t)}</span>${d ? `<span class="o-nota">${esc(d)}</span>` : ''}</span>`; lst.appendChild(f); animar(f, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380 }); };
      fila(DB.modo !== 'memoria', 'Guardado en el móvil', DB.modo === 'idb' ? 'IndexedDB' : DB.modo === 'local' ? 'localStorage' : 'Solo en memoria: se perderá al cerrar');
      fila(navigator.onLine, 'Conexión a internet');
      if (Sync.activo()) { try { const r = await api('estado'); fila(true, 'Script de Google', 'Versión ' + r.sv + ' · ' + ROLES[r.rol]); fila(!!r.gemini, 'Clave de Gemini', r.gemini ? 'Lista para leer reservas y crear portadas' : 'Falta GEMINI_API_KEY en las propiedades del script'); } catch (er) { fila(false, 'Script de Google', er.message); } }
      else fila(false, 'Script de Google', 'No hay espacio conectado');
      if (claveMaps()) { try { await GM.cargar(); fila(true, 'Google Maps'); } catch (er) { fila(false, 'Google Maps', er.message); } } else fila(true, 'Mapa abierto', 'Sin clave de Google');
      const t = await Cambio.tasas(); fila(!!t, 'Cambio de moneda', t ? 'Actualizado ' + haceCuanto(t.act || t.t) : 'No se ha podido descargar');
      fila('serviceWorker' in navigator && !!navigator.serviceWorker.controller, 'Funciona sin conexión', navigator.serviceWorker && navigator.serviceWorker.controller ? 'Listo' : 'Se activa al volver a abrir');
      cargando(b, false);
    },
    fotoYo: () => cambiarFotoPersona(yo()),
    otroDisp: () => invitar(null, { yoMismo: true }),
    editarYo: () => {
      const me = dato('personas', yo()); let color = me.color;
      const c = Capa.hoja({
        html: `<div class="o-hcab" data-e><div class="o-t2">Tú</div></div>
          <div class="o-yo-foto" data-e>${avatar(me, 88)}<div class="o-fila" style="gap:8px"><button class="o-pil o-sec o-peq t" data-a="fotoYoH">${ic('camera', 16)}${me.foto ? 'Cambiar foto' : 'Poner foto'}</button>${me.foto ? `<button class="o-pil o-sec o-peq t" data-a="sinFoto">Quitar</button>` : ''}</div></div>
          ${campo('yn', 'Nombre', '', me.nombre)}
          <div class="o-campo" data-e><div class="o-etq">Color</div><div class="o-colores">${COLORES.map(k => `<button class="o-color t t-s${k === me.color ? ' o-on' : ''}" data-a="col" data-c="${k}" style="background:${k}"><span>${ic('check', 16, 2.2)}</span></button>`).join('')}</div></div>
          <button class="o-pil t t-g" data-a="ok" data-e style="margin-top:18px">Guardar</button>`,
        acciones: {
          fotoYoH: async () => { await cambiarFotoPersona(yo()); c.cerrar(); },
          sinFoto: () => { poner('personas', yo(), { foto: null }); c.cerrar(); },
          col: (b) => { color = b.dataset.c; $$('.o-color', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.salto(b); },
          ok: () => { const n = $('#f-yn', c.hoja).value.trim(); if (n) poner('personas', yo(), { nombre: n, color }); c.cerrar(); }
        }
      });
    },
    feedback: () => feedback(),
    zip: async (b) => { cargando(b, true); try { await exportarFeedback(); } catch (e) { aviso(e.message); } cargando(b, false); },
    salirDemo: async () => { S.cfg = null; await DB.del('cfg'); S.recs = {}; S.cola = {}; guardarLocal(true); Nav.raiz('bienvenida'); },
    salir: async () => {
      const demo = S.cfg && S.cfg.demo;
      if (!(await Capa.confirmar({ titulo: demo ? '¿Salir del ejemplo?' : '¿Desconectar este móvil?', texto: demo ? '' : 'Se borra la copia de este móvil. Los datos siguen en la hoja de Google y en los móviles del grupo.' + (Sync.pendientes() ? ' Hay ' + Sync.pendientes() + ' cambios sin enviar que se perderán.' : ''), si: demo ? 'Salir' : 'Desconectar', peligro: !demo }))) return;
      S.cfg = null; await DB.del('cfg'); S.recs = {}; S.cola = {}; S.seq = 0; guardarLocal(true); Nav.raiz('bienvenida');
    }
  }
};

function feedback() {
  const fotos = [];
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Apuntar algo</div></div>
      <textarea id="f-fb" class="o-in o-area o-area-g" data-e rows="6" placeholder="Qué ha pasado, en qué pantalla, qué esperabas…"></textarea>
      <div class="o-fotos" id="fb-f" data-e><button class="o-foto o-foto-mas t" data-a="fbfoto">${ic('camera', 22, 1.6)}<span class="o-nota">Captura</span></button></div>
      <button class="o-pil t t-g" data-a="fbok" data-e style="margin-top:18px">Guardar</button>`,
    acciones: {
      fbfoto: async () => {
        const fs = await elegirArchivos('image/*', true);
        for (const f of fs) { const b = await reducir(f, 1600, .85); const mid = await Subidas.guardar(b, 'captura.jpg'); fotos.push({ id: mid }); const el = document.createElement('div'); el.className = 'o-foto'; el.style.backgroundImage = `url('${S.imgs[mid]}')`; $('#fb-f', c.hoja).prepend(el); animar(el, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: CURVA.muelle }); }
      },
      fbok: () => {
        const t = $('#f-fb', c.hoja).value.trim(); if (!t && !fotos.length) return Anim.no($('#f-fb', c.hoja));
        const pa = Nav.pila.map(x => x.id).join(' › ');
        nuevo('feedback', { txt: t, fotos, version: VERSION, pantalla: pa, ancho: innerWidth + '×' + innerHeight, tema: document.documentElement.dataset.tema, agente: navigator.userAgent });
        c.cerrar(); aviso('Apuntado. Gracias.', { ic: 'check' });
      }
    }
  });
}

/* ---------- ZIP sin compresión (formato «store»): basta para texto y fotos ya comprimidas */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function hacerZip(archivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  archivos.forEach(a => {
    const nom = enc.encode(a.nombre), d = a.datos instanceof Uint8Array ? a.datos : enc.encode(String(a.datos)), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nom.length, true);
    partes.push(new Uint8Array(h.buffer), nom, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nom.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nom);
    off += 30 + nom.length + d.length;
  });
  const tam = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, archivos.length, true); e.setUint16(10, archivos.length, true); e.setUint32(12, tam, true); e.setUint32(16, off, true);
  return new Blob(partes.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
}
async function exportarFeedback() {
  const fb = lista('feedback').sort((a, b) => a.creado - b.creado);
  const arch = [];
  let txt = 'ORBEO · feedback · ' + new Date().toLocaleString('es-ES') + '\nVersión ' + VERSION + (S.sv ? ' · script ' + S.sv : '') + '\n\n';
  for (let i = 0; i < fb.length; i++) {
    const f = fb[i], n = p2(i + 1);
    txt += `#${n} · ${new Date(f.creado).toLocaleString('es-ES')} · ${nombreDe(f.por || f._por)}\nPantalla: ${f.pantalla || '-'} · ${f.ancho || ''} · ${f.tema || ''}\n${f.txt}\n`;
    for (let j = 0; j < (f.fotos || []).length; j++) {
      try { const b = await blobMedio(f.fotos[j]); if (b) { arch.push({ nombre: `capturas/${n}_${j + 1}.jpg`, datos: new Uint8Array(await b.arrayBuffer()) }); txt += `  captura: capturas/${n}_${j + 1}.jpg\n`; } } catch (e) { txt += '  (captura no disponible en este móvil)\n'; }
    }
    txt += '\n';
  }
  arch.unshift({ nombre: 'feedback.txt', datos: txt }, { nombre: 'feedback.json', datos: JSON.stringify(fb, null, 2) }, { nombre: 'registro.txt', datos: REG.map(r => new Date(r.t).toISOString() + ' · ' + r.donde + ' · ' + r.m).join('\n') });
  const zip = hacerZip(arch);
  const nombre = 'orbeo_feedback_' + enZona(TZ_CASA()).dia + '.zip';
  const file = new File([zip], nombre, { type: 'application/zip' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Feedback de Orbeo' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
}
