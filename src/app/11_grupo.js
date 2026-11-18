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
        ${avatar(x, 44)}<span class="o-per-t"><span class="o-t3">${esc(x.nombre)}${x.id === yo() ? ' <span class="o-nota">· tú</span>' : ''}</span><span class="o-nota">${v && v.quienes && v.quienes.indexOf(x.id) < 0 ? 'No va a este viaje' : (lista('paradas', q => (q.por || q._por) === x.id && (!p.id || q.viaje === p.id)).length + ' paradas añadidas')}</span></span>
        <span class="o-chip o-sup o-rol-${x.rol || 'editor'}">${ROLES[x.rol] || 'Editor'}</span></button>`).join('')}</div>
      ${act.length ? `<div class="o-sec" data-e><span class="o-cap">Lo último${v ? ' en ' + esc(v.nombre) : ''}</span></div>
      <div class="o-act">${act.map(a => { const pe = dato('personas', a.por || a._por); return `<div class="o-act-f" data-e>${avatar(pe, 30)}<span><b>${esc(pe ? pe.nombre.split(' ')[0] : 'Alguien')}</b> ${esc(a.txt)}</span><span class="o-nota tn">${haceCuanto(a.cuando)}</span></div>`; }).join('')}</div>` : ''}
    </div>`;
  },
  alEntrar(el) { $$('.o-grupo-avs>span', el).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateX(-30px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 200 + i * 80, easing: CURVA.muelle })); },
  acciones: {
    invitar: () => invitar(),
    per: (b) => {
      const x = dato('personas', b.dataset.id);
      if (!soyAdmin() || x.id === yo()) { if (x.id === yo()) Nav.ir('ajustes'); return; }
      const cambiar = async rol => {
        if (S.cfg.demo) { poner('personas', x.id, { rol }); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); return; }
        try { const r = await api('persona-rol', { id: x.id, rol }); recibir(r); Sync.ya(); aviso(x.nombre.split(' ')[0] + ' ahora es ' + ROLES[rol].toLowerCase()); } catch (e) { aviso(e.message); }
      };
      Capa.menu($('.o-chip', b), [
        { t: 'Administración', ic: x.rol === 'admin' ? 'check' : 'key', f: () => cambiar('admin') },
        { t: 'Editor', ic: x.rol === 'editor' || !x.rol ? 'check' : 'edit', f: () => cambiar('editor') },
        { t: 'Solo ver', ic: x.rol === 'lector' ? 'check' : 'info', f: () => cambiar('lector') },
        '-',
        { t: 'Quitar del espacio', ic: 'out', peligro: true, f: async () => {
          if (!(await Capa.confirmar({ titulo: '¿Quitar a ' + x.nombre + '?', texto: 'Su móvil deja de tener acceso. Lo que ha añadido se queda.', si: 'Quitar', peligro: true }))) return;
          if (S.cfg.demo) { borrar('personas', x.id); return; }
          try { const r = await api('persona-quitar', { id: x.id }); recibir(r); Sync.ya(); aviso('Quitado del espacio'); } catch (e) { aviso(e.message); }
        } }
      ]);
    }
  }
};
function invitar() {
  let rol = 'editor';
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Invitar al grupo</div></div>
      <p class="o-txt" data-e>Crea una invitación y mándala por WhatsApp o por donde quieras. Sirve una vez y dura 12 horas.</p>
      <div class="o-campo" data-e><span class="o-etq">Qué podrá hacer</span><div class="o-seg"><span class="o-pild"></span>${Object.keys(ROLES).map(k => `<button class="o-seg-b t${k === rol ? ' o-on' : ''}" data-a="rol" data-r="${k}">${ROLES[k]}</button>`).join('')}</div>
      <div class="o-nota" id="i-rol" style="margin-top:8px">Puede añadir y cambiar paradas, ideas y documentos.</div></div>
      <div id="i-res"></div>
      <button class="o-pil t t-g" data-a="crearInv" data-e style="margin-top:20px">Crear invitación</button>`,
    alAbrir: h => { const s = $('.o-seg', h); Anim.pildora(s, $('.o-on', s)); },
    acciones: {
      rol: (b) => { rol = b.dataset.r; $$('.o-seg-b', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); Anim.pildora(b.parentNode, b); const t = $('#i-rol', c.hoja); t.textContent = { admin: 'Puede hacerlo todo, también invitar y cambiar papeles.', editor: 'Puede añadir y cambiar paradas, ideas y documentos.', lector: 'Ve todo el viaje, pero no cambia nada.' }[rol]; animar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); },
      crearInv: async (b) => {
        if (S.cfg.demo) { aviso('En el viaje de ejemplo no se puede invitar. Conecta tu espacio en Ajustes.'); return; }
        cargando(b, true);
        try {
          const r = await api('invitar', { rol });
          const paq = crearPaquete(r.codigo), enlace = location.origin + location.pathname + '#inv=' + paq;
          c.enlace = enlace; c.paq = paq;
          const box = $('#i-res', c.hoja);
          box.innerHTML = `<div class="o-inv"><span class="o-cap">Código</span><div class="o-inv-c tn">${r.codigo.split('').map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div><span class="o-nota">Caduca a las ${esc(enZona(TZ_CASA(), r.caduca).hora)}</span>
            <div class="o-conf-b">${navigator.share ? `<button class="o-pil t" data-a="compartirInv">${ic('share', 17)}Enviar</button>` : ''}<button class="o-pil o-sec t" data-a="copiarInv">${ic('copy', 17)}Copiar</button></div></div>`;
          b.remove();
          $$('.o-inv-c span', box).forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateY(60%) rotate(8deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: i * 45, easing: CURVA.muelle }));
          animar(box, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: CURVA.muelle });
        } catch (e) { aviso(e.message); cargando(b, false); }
      },
      compartirInv: () => navigator.share({ title: 'Orbeo', text: 'Únete a nuestros viajes en Orbeo. Abre el enlace en el móvil:', url: c.enlace }).catch(() => { }),
      copiarInv: (b) => copiar('Únete a nuestros viajes en Orbeo: ' + c.enlace + '\n\nSi te pide la invitación: ' + c.paq).then(() => { b.innerHTML = ic('check', 17, 2) + 'Copiado'; Anim.salto(b); })
    }
  });
}
