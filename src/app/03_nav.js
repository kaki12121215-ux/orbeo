/* ============================ NAVEGACIÓN ============================
   Una pila de pantallas. Al avanzar, la nueva entra desde la derecha y la de debajo se retira un poco;
   al volver (botón o deslizando desde el borde izquierdo), al revés. Las hojas suben desde abajo y
   la pantalla de detrás se encoge como una tarjeta. */
const PANT = {};     /* id › { render(p, el), alEntrar(el, p, primera), acciones, clase } */
const ACC = {};      /* acciones comunes a todas las pantallas */

const Nav = {
  pila: [], refT: null, ocupado: false,
  actual() { return this.pila[this.pila.length - 1]; },
  crear(id, p) {
    const def = PANT[id];
    const el = document.createElement('section');
    el.className = 'o-pant' + (def.clase ? ' ' + def.clase : '');
    el.dataset.p = id;
    const pa = { id, p: p || {}, el, def };
    this.pintar(pa, true);
    el.addEventListener('click', e => this.click(e, pa));
    el.addEventListener('scroll', () => def.alDeslizar && def.alDeslizar(el, pa), { passive: true });
    return pa;
  },
  pintar(pa, primera) {
    const html = pa.def.render(pa.p, pa.el, pa);
    /* Al repintar con datos nuevos solo cambia lo distinto: ni parpadean las fotos ni salta el scroll */
    if (!primera && pa.el.firstChild) morph(pa.el, html); else pa.el.innerHTML = html;
    if (pa.def.alPintar) pa.def.alPintar(pa.el, pa.p, primera, pa);
  },
  click(e, pa) {
    const t = e.target.closest('[data-a]');
    if (!t || !pa.el.contains(t) || t.classList.contains('o-des')) return;
    const a = t.dataset.a;
    const f = (pa.def.acciones && pa.def.acciones[a]) || ACC[a];
    if (f) { e.preventDefault(); f(t, e, pa.p, pa); }
  },
  async ir(id, p, o) {
    o = o || {};
    if (this.ocupado) return;
    const vieja = this.actual();
    /* Dos toques seguidos no abren dos veces la misma pantalla */
    if (vieja && vieja.id === id && JSON.stringify(vieja.p.id) === JSON.stringify((p || {}).id)) return;
    this.ocupado = true;
    this.limpiar();
    const nueva = this.crear(id, p);
    /* Las fotos de arriba se preparan antes de enseñar la pantalla (como mucho 0,35 s) */
    const urls = $$('[style*="background-image"]', nueva.el).slice(0, 8).map(x => (x.getAttribute('style').match(/url\(['"]?([^'")]+)/) || [])[1]);
    if (o.vuela && o.vuela.imagen) urls.unshift(o.vuela.imagen);
    await Fotos.varias(urls, 350);
    nueva.el.style.zIndex = this.pila.length + 2;
    $('#app').appendChild(nueva.el);
    Anim.pildoras(nueva.el);
    this.pila.push(nueva);
    try { history.pushState({ n: this.pila.length }, ''); } catch (e) { }
    document.body.classList.add('o-moviendo');
    if (vieja) fijar(vieja.el);
    const ent = nueva.def.alEntrar ? () => nueva.def.alEntrar(nueva.el, nueva.p, nueva) : null;
    if (o.vuela) {
      /* La foto tocada viaja recta hasta su sitio y la pantalla nueva aparece debajo, sin círculos ni giros */
      const dest = $(o.vuela.hacia, nueva.el);
      if (vieja) animar(vieja.el, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.96)', opacity: .6 }], { duration: 560, easing: CURVA.entrar });
      const pr = animar(nueva.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
      Anim.vuela(o.vuela.desde, dest, { ms: 620, imagen: o.vuela.imagen, caja: o.vuela.caja });
      Anim.entrar(nueva.el, { retraso: 260, paso: 45 });
      ent && ent();
      await Promise.all([pr, espera(620)]);
      if (vieja) vieja.el.style.opacity = '';
    } else if (o.circulo) {
      if (vieja) animar(vieja.el, [{ transform: 'none' }, { transform: 'scale(.94)' }], { duration: 760, easing: CURVA.entrar });
      const pr = Anim.circulo(nueva.el, o.circulo.x, o.circulo.y, 760);
      Anim.entrar(nueva.el, { retraso: 330, paso: 45 });
      ent && ent();
      await pr;
    } else {
      if (vieja) { this.sombra(vieja.el, true); animar(vieja.el, [{ transform: 'none' }, { transform: 'translateX(-28%)' }], { duration: 600, easing: CURVA.entrar }); }
      const pr = animar(nueva.el, [{ transform: 'translateX(100%)', boxShadow: '0 0 0 rgba(0,0,0,0)' }, { transform: 'none', boxShadow: '-20px 0 50px rgba(0,0,0,.12)' }], { duration: 600, easing: CURVA.entrar });
      Anim.entrar(nueva.el, { retraso: 140 });
      ent && ent();
      await pr;
    }
    nueva.el.style.boxShadow = ''; nueva.el.style.clipPath = ''; nueva.el.style.opacity = '';
    if (vieja) { vieja.el.classList.add('o-detras'); vieja.el.style.visibility = 'hidden'; }
    document.body.classList.remove('o-moviendo');
    this.ocupado = false;
    Sync.programar();
  },
  /* Quita del documento cualquier pantalla que ya no esté en la pila (para que nunca asome una vieja) */
  limpiar() {
    const vivas = new Set(this.pila.map(x => x.el));
    $$('#app > .o-pant').forEach(el => { if (!vivas.has(el)) el.parentNode.removeChild(el); });
  },
  sombra(el, on) {
    let s = $('.o-somb', el);
    if (on) { if (!s) { s = document.createElement('div'); s.className = 'o-somb'; el.appendChild(s); } animar(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 }); }
    else if (s) animar(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }).then(() => s.remove());
  },
  atras() { if (this.pila.length > 1) { try { history.back(); } catch (e) { this.quitar(); } } },
  async quitar(desdeGesto) {
    if (this.pila.length < 2 || this.ocupado) return;
    this.ocupado = true;
    const vieja = this.pila.pop(), debajo = this.actual();
    debajo.el.classList.remove('o-detras'); debajo.el.style.visibility = '';
    if (vieja.def.alSalir) vieja.def.alSalir(vieja.el, vieja.p);
    document.body.classList.add('o-moviendo');
    if (this.refPend) { this.refPend = false; this.pintar(debajo, false); }
    const x = desdeGesto ? desdeGesto.x : 0;
    fijar(vieja.el); fijar(debajo.el);
    debajo.el.style.opacity = '';
    this.sombra(debajo.el, false);
    animar(debajo.el, [{ transform: desdeGesto ? `translateX(${-28 + x / innerWidth * 28}%)` : (debajo.el.style.transform.indexOf('scale') >= 0 ? 'scale(.94)' : 'translateX(-28%)') }, { transform: 'none' }], { duration: 420, easing: CURVA.entrar });
    await animar(vieja.el, [{ transform: `translateX(${x}px)` }, { transform: 'translateX(100%)' }], { duration: desdeGesto ? 300 : 420, easing: desdeGesto ? CURVA.entrar : 'cubic-bezier(.4,0,.2,1)' });
    vieja.el.remove();
    debajo.el.style.transform = '';
    soltarFijos(debajo.el);
    this.limpiar();
    document.body.classList.remove('o-moviendo');
    this.ocupado = false;
    if (debajo.def.alVolver) debajo.def.alVolver(debajo.el, debajo.p, debajo);
    Sync.programar();
  },
  async raiz(id, p) {
    Capa.cerrarTodo();
    const viejas = this.pila.slice();
    this.pila = [];
    const n = this.crear(id, p);
    n.el.style.zIndex = 2;
    $('#app').appendChild(n.el);
    Anim.pildoras(n.el);
    this.pila.push(n);
    try { history.replaceState({ n: 1 }, ''); } catch (e) { }
    viejas.forEach(v => animar(v.el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 360, easing: CURVA.salir }).then(() => v.el.remove()));
    animar(n.el, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: viejas.length ? 120 : 0 });
    Anim.entrar(n.el, { retraso: 160 });
    if (n.def.alEntrar) n.def.alEntrar(n.el, n.p, n);
    Sync.programar();
  },
  /* Vuelve a pintar la pantalla de arriba con datos nuevos (sin animaciones de entrada) */
  refrescar() {
    clearTimeout(this.refT);
    this.refT = setTimeout(() => {
      const pa = this.actual(); if (!pa) return;
      Capa.refrescar();
      const foco = document.activeElement;
      if (foco && pa.el.contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) { this.refPend = true; return; }
      if (this.ocupado) { this.refPend = true; return; }
      const st = pa.el.scrollTop;
      const sub = pa.def.scrollInterno ? pa.def.scrollInterno(pa.el) : null;
      this.pintar(pa, false);
      pa.el.scrollTop = st;
      if (sub && pa.def.restaurarScroll) pa.def.restaurarScroll(pa.el, sub);
      this.pila.slice(0, -1).forEach(x => { x.sucia = true; });
    }, 60);
  }
};
window.addEventListener('popstate', () => { if (Capa.abiertas.length) { Capa.cerrar(); try { history.pushState({ n: Nav.pila.length }, ''); } catch (e) { } return; } Nav.quitar(); });
ACC.atras = () => Nav.atras();

/* ---------- Volver deslizando desde el borde izquierdo */
(function () {
  let g = null;
  document.addEventListener('touchstart', e => {
    if (Nav.pila.length < 2 || Nav.ocupado || Capa.abiertas.length) return;
    const t = e.touches[0];
    if (t.clientX > 26) return;
    g = { x0: t.clientX, y0: t.clientY, x: 0, t0: Date.now(), on: false, arr: Nav.actual(), deb: Nav.pila[Nav.pila.length - 2] };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.on) { if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { g = null; return; } if (dx < 8) return; g.on = true; Nav.limpiar(); Nav.pila.forEach(x => { if (x !== g.arr && x !== g.deb) x.el.style.visibility = 'hidden'; }); fijar(g.arr.el); fijar(g.deb.el); g.deb.el.classList.remove('o-detras'); g.deb.el.style.visibility = ''; g.deb.el.style.opacity = ''; document.body.classList.add('o-moviendo'); }
    g.x = Math.max(0, dx);
    g.arr.el.style.transform = `translateX(${g.x}px)`;
    g.arr.el.style.boxShadow = '-20px 0 50px rgba(0,0,0,.12)';
    g.deb.el.style.transform = `translateX(${-28 + g.x / innerWidth * 28}%)`;
    const s = $('.o-somb', g.deb.el); if (s) s.style.opacity = 1 - g.x / innerWidth;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!g) return;
    const x = g, v = x.x / Math.max(1, Date.now() - x.t0);
    g = null;
    if (!x.on) return;
    if (x.x > innerWidth * .33 || v > .55) { x.arr.el.style.transform = ''; x.deb.el.style.transform = ''; history.back(); Nav.gesto = { x: x.x }; }
    else {
      animar(x.arr.el, [{ transform: `translateX(${x.x}px)` }, { transform: 'none' }], { duration: 300 }).then(() => { x.arr.el.style.boxShadow = ''; soltarFijos(x.arr.el); });
      animar(x.deb.el, [{ transform: x.deb.el.style.transform }, { transform: 'translateX(-28%)' }], { duration: 300 }).then(() => { x.deb.el.classList.add('o-detras'); x.deb.el.style.visibility = 'hidden'; document.body.classList.remove('o-moviendo'); });
      const s = $('.o-somb', x.deb.el); if (s) s.style.opacity = 1;
    }
  });
  /* El gesto usa la misma salida que el botón, pero desde donde está el dedo */
  const q = Nav.quitar.bind(Nav);
  Nav.quitar = function () { const gg = Nav.gesto; Nav.gesto = null; return q(gg); };
})();

/* ============================ CAPAS: hojas, menús, avisos ============================ */
const Capa = {
  abiertas: [],
  detras(on) {
    const app = $('#app');
    const n = this.abiertas.filter(c => c.tipo === 'hoja').length;
    app.classList.toggle('o-encogida', n > 0 && !ESCRITORIO());
    this.abiertas.forEach((c, i) => { if (c.tipo === 'hoja') c.el.classList.toggle('o-debajo', i < this.abiertas.length - 1); });
  },
  /* Hoja que sube desde abajo. o: { html(), clase, alAbrir(el), acciones, alCerrar, ancho } */
  hoja(o) {
    const c = { tipo: 'hoja', o };
    const el = document.createElement('div');
    el.className = 'o-capa';
    el.innerHTML = `<div class="o-velo"></div><div class="o-hoja ${o.clase || ''}" role="dialog"><div class="o-asa"><span></span></div><div class="o-hoja-c">${typeof o.html === 'function' ? o.html() : o.html}</div></div>`;
    c.el = el; c.hoja = $('.o-hoja', el);
    $('#capas').appendChild(el);
    this.abiertas.push(c);
    this.detras();
    animar($('.o-velo', el), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    animar(c.hoja, [{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 560, easing: CURVA.entrar });
    Anim.entrar(c.hoja, { retraso: 90, paso: 28 });
    $('.o-velo', el).addEventListener('click', () => { if (o.cerrable !== false) this.cerrar(c); });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-a]'); if (!t || t.classList.contains('o-des')) return;
      const a = t.dataset.a;
      if (a === 'cerrar') { e.preventDefault(); this.cerrar(c); return; }
      const f = (o.acciones && o.acciones[a]) || ACC[a];
      if (f) { e.preventDefault(); f(t, e, c); }
    });
    this.arrastre(c);
    if (o.alAbrir) o.alAbrir(c.hoja, c);
    c.cerrar = (forzar) => this.cerrar(c, 0, forzar === true);
    c.repintar = () => { morph($('.o-hoja-c', el), typeof o.html === 'function' ? o.html() : o.html); if (o.alAbrir) o.alAbrir(c.hoja, c, true); };
    return c;
  },
  arrastre(c) {
    let g = null;
    const zona = c.hoja;
    zona.addEventListener('touchstart', e => {
      const sc = e.target.closest('.o-hoja-c');
      if (sc && sc.scrollTop > 0 && !e.target.closest('.o-asa,.o-hcab')) return;
      if (e.target.closest('input,textarea,.o-nodrag')) return;
      g = { y0: e.touches[0].clientY, y: 0, t0: Date.now(), on: false };
    }, { passive: true });
    zona.addEventListener('touchmove', e => {
      if (!g) return;
      const dy = e.touches[0].clientY - g.y0;
      if (!g.on && dy < 6) return;
      g.on = true; g.y = Math.max(0, dy);
      c.hoja.style.transform = `translateY(${g.y}px)`;
      $('.o-velo', c.el).style.opacity = Math.max(0, 1 - g.y / 500);
    }, { passive: true });
    zona.addEventListener('touchend', () => {
      if (!g || !g.on) { g = null; return; }
      const v = g.y / Math.max(1, Date.now() - g.t0), y = g.y; g = null;
      if ((y > 130 || v > .6) && c.o.cerrable !== false) this.cerrar(c, y);
      else { animar(c.hoja, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], { duration: 380, easing: CURVA.muelle }); $('.o-velo', c.el).style.opacity = 1; }
    });
  },
  async cerrar(c, desde, forzar) {
    c = c || this.abiertas[this.abiertas.length - 1];
    if (!c || c.cerrando) return;
    /* Una hoja puede preguntar antes de irse (p. ej. guardar como borrador) */
    if (!forzar && c.o && c.o.antesCerrar) {
      if (c.preguntando) return;
      c.preguntando = true;
      let ok = true; try { ok = await c.o.antesCerrar(c); } catch (e) { }
      c.preguntando = false;
      if (!ok) { if (desde) { animar(c.hoja, [{ transform: `translateY(${desde}px)` }, { transform: 'none' }], { duration: 420, easing: CURVA.muelle }); $('.o-velo', c.el).style.opacity = 1; } return; }
    }
    c.cerrando = true;
    this.abiertas = this.abiertas.filter(x => x !== c);
    this.detras();
    if (c.tipo === 'menu') { await animar(c.panel, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 160, easing: CURVA.salir }); c.el.remove(); return; }
    animar($('.o-velo', c.el), [{ opacity: getComputedStyle($('.o-velo', c.el)).opacity }, { opacity: 0 }], { duration: 380 });
    await animar(c.hoja, [{ transform: `translateY(${desde || 0}px)` }, { transform: 'translateY(105%)' }], { duration: 420, easing: CURVA.bajar });
    c.el.remove();
    if (c.o.alCerrar) c.o.alCerrar();
  },
  cerrarTodo() { this.abiertas.slice().forEach(c => this.cerrar(c)); },
  refrescar() { this.abiertas.forEach(c => { if (c.o && c.o.vivo) { const f = document.activeElement; if (!(f && c.el.contains(f) && /INPUT|TEXTAREA/.test(f.tagName))) c.repintar(); } }); },
  /* Menú flotante junto a un botón. ops: [{ t, ic, f, peligro }] */
  menu(boton, ops) {
    const r = boton.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'o-menu-capa';
    const der = r.left + r.width / 2 > innerWidth / 2, abajo = r.top < innerHeight * .6;
    el.innerHTML = `<div class="o-menu o-vid" style="${der ? `right:${Math.max(12, innerWidth - r.right)}px` : `left:${Math.max(12, r.left)}px`};${abajo ? `top:${r.bottom + 8}px` : `bottom:${innerHeight - r.top + 8}px`};transform-origin:${der ? 'right' : 'left'} ${abajo ? 'top' : 'bottom'}">
      ${ops.map((o, i) => o === '-' ? '<div class="o-menu-sep"></div>' : `<button class="o-menu-f t${o.peligro ? ' o-mal' : ''}" data-i="${i}">${esc(o.t)}<span>${ic(o.ic, 19)}</span></button>`).join('')}</div>`;
    $('#capas').appendChild(el);
    const c = { tipo: 'menu', el, panel: $('.o-menu', el), o: {} };
    this.abiertas.push(c);
    animar(c.panel, [{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: CURVA.muelle });
    $$('.o-menu-f', el).forEach((b, i) => animar(b, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 22 }));
    el.addEventListener('click', e => {
      const b = e.target.closest('.o-menu-f');
      this.cerrar(c);
      if (b) { const o = ops[+b.dataset.i]; setTimeout(() => o.f && o.f(), 120); }
    });
  },
  /* Pregunta con varias salidas. o.ops = [{ k, t, clase }]. Devuelve la k elegida o null */
  preguntar(o) {
    return new Promise(ok => {
      let r = null;
      const c = this.hoja({
        clase: 'o-hoja-peq',
        html: `<div class="o-conf"><div class="o-t3" data-e>${esc(o.titulo)}</div>${o.texto ? `<p class="o-txt" data-e style="margin-top:8px">${esc(o.texto)}</p>` : ''}
          <div class="o-conf-v">${o.ops.map(x => `<button class="o-pil t ${x.clase || ''}" data-a="op" data-k="${x.k}" data-e>${x.ic ? ic(x.ic, 18) : ''}${esc(x.t)}</button>`).join('')}</div></div>`,
        acciones: { op: (b) => { r = b.dataset.k; c.cerrar(); } },
        alCerrar: () => ok(r)
      });
    });
  },
  confirmar(o) {
    return new Promise(ok => {
      let r = false;
      const c = this.hoja({
        clase: 'o-hoja-peq',
        html: `<div class="o-conf"><div class="o-t3" data-e>${esc(o.titulo)}</div>${o.texto ? `<p class="o-txt" data-e style="margin-top:8px">${esc(o.texto)}</p>` : ''}
          <div class="o-conf-b" data-e><button class="o-pil o-sec t" data-a="cerrar">${esc(o.no || 'Cancelar')}</button><button class="o-pil t ${o.peligro ? 'o-pmal' : ''}" data-a="si">${esc(o.si || 'Aceptar')}</button></div></div>`,
        acciones: { si: () => { r = true; c.cerrar(); } },
        alCerrar: () => ok(r)
      });
    });
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (Capa.abiertas.length) Capa.cerrar(); else Nav.atras(); } });

/* ---------- Avisos: bajan desde arriba con un pequeño rebote y se van solos */
function aviso(txt, o) {
  o = o || {};
  const el = document.createElement('div');
  el.className = 'o-aviso';
  el.innerHTML = `${o.ic ? ic(o.ic, 18) : '<span class="o-punto"></span>'}<span>${esc(txt)}</span>${o.accion ? `<button class="o-enlace t">${esc(o.accion.t)}</button>` : ''}`;
  const cont = $('#avisos');
  while (cont.children.length > 1) cont.firstChild.remove();
  cont.appendChild(el);
  animar(el, [{ opacity: 0, transform: 'translateY(60%) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: CURVA.muelle });
  const fuera = () => { if (!el.isConnected) return; animar(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40%) scale(.96)' }], { duration: 240, easing: CURVA.salir }).then(() => el.remove()); };
  if (o.accion) $('button', el).onclick = () => { fuera(); o.accion.f(); };
  el.addEventListener('click', e => { if (!e.target.closest('button')) fuera(); });
  setTimeout(fuera, o.ms || (o.accion ? 4200 : 2200));
}

/* ---------- Reloj: los relojes de la cabecera cambian cada minuto (el número rueda) */
const Reloj = {
  t: null, ult: '',
  arrancar() { clearInterval(this.t); this.t = setInterval(() => this.tic(), 15000); },
  tic() {
    $$('[data-reloj]').forEach(el => Anim.numero(el, enZona(el.dataset.reloj).hora));
    const m = enZona(TZ_CASA()).hora;
    if (m !== this.ult) { const viejo = this.ult; this.ult = m; if (viejo) { const pa = Nav.actual(); if (pa && pa.def.alMinuto) pa.def.alMinuto(pa.el, pa.p, pa); } }
  }
};
