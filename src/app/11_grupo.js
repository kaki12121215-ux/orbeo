/* ============================ GRUPO E INVITACIONES ============================
   Tres papeles: administración (todo, invita y cambia papeles), editor (cambia el plan) y lector (solo ve). */
const ROLES = { admin: 'Administración', editor: 'Editor', lector: 'Solo ver' };
function haceCuanto(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}
PANT.grupo = {
  render(p) {
    const ps = lista('personas').sort((a, b) => (a.nombre.split(' ').slice(1).join(' ') || a.nombre).localeCompare(b.nombre.split(' ').slice(1).join(' ') || b.nombre, 'es'));
    const esp = dato('espacio', 'espacio') || {};
    const act = lista('actividad', a => !p.id || a.viaje === p.id).sort((a, b) => b.cuando - a.cuando).slice(0, 25);
    const v = p.id ? dato('viajes', p.id) : null;
    return `<div class="o-cont">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button>${soyAdmin() ? `<button class="o-pil o-peq t" data-a="invitar">${ic('plus', 16, 2)}Invitar</button>` : ''}</div>
      <div class="o-cap" data-e style="margin-top:14px">${esc(esp.nombre || 'Vuestro espacio')}</div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:6px">El grupo</h1>
      <div class="o-grupo-avs" data-e>${ps.map((x, i) => `<span style="--i:${i}">${avatar(x, 58)}</span>`).join('')}</div>
      <div class="o-filas o-grupo">${ps.map(x => `<button class="o-per t" data-a="per" data-id="${x.id}" data-e>
        ${avatar(x, 44)}<span class="o-per-t"><span class="o-t3">${esc(x.nombre)}${x.id === yo() ? ' <span class="o-nota">· tú</span>' : ''}</span><span class="o-nota">${x.viajes && x.viajes.length ? (x.viajes.length === 1 ? 'Solo ve ' + esc((dato('viajes', x.viajes[0]) || { nombre: 'un viaje' }).nombre) : 'Ve ' + x.viajes.length + ' viajes') : v && v.quienes && v.quienes.indexOf(x.id) < 0 ? 'No va a este viaje' : (lista('paradas', q => (q.por || q._por) === x.id && (!p.id || q.viaje === p.id)).length + ' paradas añadidas')}</span></span>
        <span class="o-chip o-sup o-rol-${x.rol || 'editor'}">${ROLES[x.rol] || 'Editor'}</span></button>`).join('')}</div>
      ${act.length ? `<div class="o-sec" data-e><span class="o-cap">Lo último${v ? ' en ' + esc(v.nombre) : ''}</span></div>
      <div class="o-act">${act.map(a => { const pe = dato('personas', a.por || a._por); return `<div class="o-act-f" data-e>${avatar(pe, 30)}<span><b>${esc(pe ? pe.nombre.split(' ')[0] : 'Alguien')}</b> ${esc(a.txt)}</span><span class="o-nota tn">${haceCuanto(a.cuando)}</span></div>`; }).join('')}</div>` : ''}
    </div>`;
  },
  alEntrar(el) { $$('.o-grupo-avs>span', el).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateX(-30px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 200 + i * 80, easing: CURVA.muelle })); },
  acciones: {
    invitar: (b, e, p) => invitar(p.id),
    per: (b) => {
      const x = dato('personas', b.dataset.id);
      if (x.id === yo()) { Capa.menu($('.o-chip', b), [{ t: 'Cambiar mi foto', ic: 'camera', f: () => cambiarFotoPersona(x.id) }, { t: 'Ajustes', ic: 'settings', f: () => Nav.ir('ajustes') }]); return; }
      if (!soyAdmin()) return;
      const cambiar = async rol => {
        if (S.cfg.demo) { poner('personas', x.id, { rol }); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); return; }
        try { const r = await api('persona-rol', { id: x.id, rol }); recibir(r); Sync.ya(); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); } catch (e) { aviso(e.message); }
      };
      Capa.menu($('.o-chip', b), [
        { t: 'Administración', ic: x.rol === 'admin' ? 'check' : 'key', f: () => cambiar('admin') },
        { t: 'Editor', ic: x.rol === 'editor' || !x.rol ? 'check' : 'edit', f: () => cambiar('editor') },
        { t: 'Solo ver', ic: x.rol === 'lector' ? 'check' : 'info', f: () => cambiar('lector') },
        '-',
        { t: 'Qué viajes ve', ic: 'plan', f: () => viajesDePersona(x) },
        { t: x.foto ? 'Cambiar su foto' : 'Ponerle foto', ic: 'camera', f: () => cambiarFotoPersona(x.id) },
        x.foto ? { t: 'Quitar su foto', ic: 'close', f: () => poner('personas', x.id, { foto: null }) } : null,
        '-',
        { t: 'Quitar del espacio', ic: 'out', peligro: true, f: async () => {
          if (!(await Capa.confirmar({ titulo: '¿Quitar a ' + x.nombre + '?', texto: 'Su móvil deja de tener acceso. Lo que ha añadido se queda.', si: 'Quitar', peligro: true }))) return;
          if (S.cfg.demo) { borrar('personas', x.id); return; }
          try { const r = await api('persona-quitar', { id: x.id }); recibir(r); Sync.ya(); aviso('Quitado del espacio'); } catch (e) { aviso(e.message); }
        } }
      ].filter(Boolean));
    }
  }
};
function invitar(vid, o) {
  o = o || {};
  let rol = 'editor', alcance = vid ? 'viaje' : 'todo';
  const v = vid ? dato('viajes', vid) : null;
  const yoMismo = !!o.yoMismo;
  const c = Capa.hoja({
    html: yoMismo ? `<div class="o-hcab" data-e><div class="o-t2">Otro dispositivo tuyo</div></div>
      <p class="o-txt" data-e>Crea un código y ábrelo en el ordenador u otro móvil. Entrarás como tú, con tu papel y tus viajes, sin aparecer dos veces en el grupo. Sirve una vez y dura 12 horas.</p>
      <div id="i-res"></div>
      <button class="o-pil t t-g" data-a="crearInv" data-e style="margin-top:20px">Crear código</button>`
    : `<div class="o-hcab" data-e><div class="o-t2">${v && o.soloViaje ? 'Compartir «' + esc(v.nombre) + '»' : 'Invitar'}</div></div>
      <p class="o-txt" data-e>Crea una invitación y mándala por WhatsApp o por donde quieras. Sirve una vez y dura 12 horas.</p>
      ${v && !o.soloViaje ? `<div class="o-campo" data-e><span class="o-etq">A qué</span><div class="o-seg o-seg-al"><span class="o-pild"></span><button class="o-seg-b t o-on" data-a="alc" data-k="viaje">Solo este viaje</button><button class="o-seg-b t" data-a="alc" data-k="todo">Todo el espacio</button></div>
      <div class="o-nota" id="i-alc" style="margin-top:8px">Solo verá «${esc(v.nombre)}». El resto de tus viajes no.</div></div>` : ''}
      <div class="o-campo" data-e><span class="o-etq">Qué podrá hacer</span><div class="o-seg o-seg-rol"><span class="o-pild"></span>${Object.keys(ROLES).filter(k => !(alcance === 'viaje' && k === 'admin')).map(k => `<button class="o-seg-b t${k === rol ? ' o-on' : ''}" data-a="rol" data-r="${k}">${k === 'admin' && alcance === 'viaje' ? '' : ROLES[k]}</button>`).join('')}</div>
      <div class="o-nota" id="i-rol" style="margin-top:8px">Puede añadir y cambiar paradas, ideas y documentos.</div></div>
      <div id="i-res"></div>
      <button class="o-pil t t-g" data-a="crearInv" data-e style="margin-top:20px">Crear invitación</button>`,
    alAbrir: h => { $$('.o-seg', h).forEach(s => Anim.pildora(s, $('.o-on', s))); },
    acciones: {
      alc: (b) => {
        alcance = b.dataset.k; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b);
        const t = $('#i-alc', c.hoja); t.textContent = alcance === 'viaje' ? 'Solo verá «' + v.nombre + '». El resto de tus viajes no.' : 'Verá todos los viajes del espacio, también los que creéis después.';
        animar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        /* Administración solo tiene sentido para todo el espacio */
        const seg = $('.o-seg-rol', c.hoja), ad = $('[data-r="admin"]', seg);
        if (alcance === 'viaje' && ad) { ad.remove(); if (rol === 'admin') { rol = 'editor'; $('[data-r="editor"]', seg).classList.add('o-on'); } Anim.pildora(seg, $('.o-on', seg)); }
        if (alcance === 'todo' && !ad) { const n = document.createElement('button'); n.className = 'o-seg-b t'; n.dataset.a = 'rol'; n.dataset.r = 'admin'; n.textContent = ROLES.admin; seg.insertBefore(n, seg.children[1]); Anim.pildora(seg, $('.o-on', seg)); }
      },
      rol: (b) => { rol = b.dataset.r; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); const t = $('#i-rol', c.hoja); t.textContent = { admin: 'Puede hacerlo todo, también invitar y cambiar papeles.', editor: 'Puede añadir y cambiar paradas, ideas y documentos.', lector: 'Ve todo, pero no cambia nada.' }[rol]; animar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); },
      crearInv: async (b) => {
        if (S.cfg.demo) { aviso('En el ejemplo de prueba no se pueden crear invitaciones. Conecta tu espacio en Ajustes.'); return; }
        cargando(b, true);
        try {
          const r = yoMismo ? await api('invitar-yo', {}) : await api('invitar', { rol, viaje: alcance === 'viaje' && v ? v.id : '' });
          const paq = crearPaquete(r.codigo), enlace = location.origin + location.pathname + '#inv=' + paq;
          c.enlace = enlace; c.paq = paq;
          c.texto = yoMismo ? 'Abre esto en tu otro dispositivo para entrar en Orbeo como tú: ' : alcance === 'viaje' && v ? 'Te invito a «' + v.nombre + '» en Orbeo: ' : 'Únete a nuestros viajes en Orbeo: ';
          const box = $('#i-res', c.hoja);
          box.innerHTML = `<div class="o-inv"><span class="o-cap">Código</span><div class="o-inv-c tn">${r.codigo.split('').map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div><span class="o-nota">Caduca a las ${esc(enZona(TZ_CASA(), r.caduca).hora)}</span>
            <div class="o-conf-b">${navigator.share ? `<button class="o-pil t" data-a="compartirInv">${ic('share', 17)}Enviar</button>` : ''}<button class="o-pil o-sec t" data-a="copiarInv">${ic('copy', 17)}Copiar</button></div></div>`;
          b.remove();
          $$('.o-inv-c span', box).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateY(60%) rotate(8deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: i * 45, easing: CURVA.muelle }));
          animar(box, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: CURVA.muelle });
        } catch (e) { aviso(e.message); cargando(b, false); }
      },
      compartirInv: () => navigator.share({ title: 'Orbeo', text: c.texto, url: c.enlace }).catch(() => { }),
      copiarInv: (b) => copiar(c.texto + c.enlace + '\n\nSi te pide la invitación: ' + c.paq).then(() => { b.innerHTML = ic('check', 17, 2) + 'Copiado'; Anim.salto(b); })
    }
  });
}
/* Elegir qué viajes ve una persona */
function viajesDePersona(x) {
  const vs = viajes(); let sel = (x.viajes && x.viajes.length) ? x.viajes.slice() : null;
  const pintar = () => `<div class="o-hcab" data-e><div class="o-t2">Qué ve ${esc(x.nombre.split(' ')[0])}</div></div>
    <button class="o-vsel t${!sel ? ' o-on' : ''}" data-a="todos" data-e><span class="o-casilla">${ic('check', 14, 2.6)}</span><span><span class="o-t3">Todo el espacio</span><span class="o-nota">También los viajes que creéis después</span></span></button>
    <div class="o-sec" data-e><span class="o-cap">O solo estos viajes</span></div>
    ${vs.map(v => `<button class="o-vsel t${sel && sel.indexOf(v.id) >= 0 ? ' o-on' : ''}" data-a="uno" data-id="${v.id}" data-e><span class="o-casilla">${ic('check', 14, 2.6)}</span><span class="o-vsel-f" style="${portadaUrl(v) ? `background-image:url('${portadaUrl(v)}')` : ''}"></span><span><span class="o-t3">${esc(v.nombre)}</span><span class="o-nota">${esc(rango(v.desde, v.hasta))}</span></span></button>`).join('')}
    <button class="o-pil t t-g" data-a="ok" data-e style="margin-top:20px">Guardar</button>`;
  const c = Capa.hoja({
    clase: 'o-hoja-alta', html: () => `<div class="o-hoja-scroll">${pintar()}</div>`,
    acciones: {
      todos: () => { sel = null; c.repintar(); },
      uno: (b) => { sel = sel || []; const i = sel.indexOf(b.dataset.id); if (i >= 0) sel.splice(i, 1); else sel.push(b.dataset.id); if (!sel.length) sel = null; c.repintar(); Anim.salto($('.o-casilla', $(`[data-id="${b.dataset.id}"]`, c.hoja))); },
      ok: async (b) => {
        if (S.cfg.demo) { poner('personas', x.id, { viajes: sel || [] }); c.cerrar(); aviso('Guardado'); return; }
        cargando(b, true);
        try { const r = await api('persona-viajes', { id: x.id, viajes: sel }); recibir(r); Sync.ya(); c.cerrar(); aviso(sel ? x.nombre.split(' ')[0] + ' ve ' + sel.length + (sel.length === 1 ? ' viaje' : ' viajes') : x.nombre.split(' ')[0] + ' ve todo el espacio'); }
        catch (e) { aviso(e.message); cargando(b, false); }
      }
    }
  });
}
/* Foto de una persona: la tuya o, si administras, la de cualquiera */
async function cambiarFotoPersona(id) {
  const [file] = await elegirArchivos('image/*'); if (!file) return;
  const blob = await reducir(file, 600, .86);
  const mid = await Subidas.guardar(blob, 'cara.jpg');
  poner('personas', id, { foto: { id: mid } });
  aviso('Foto cambiada', { ic: 'check' });
}
