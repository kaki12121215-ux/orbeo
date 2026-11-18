/* ============================ MOVIMIENTO ============================
   Tres curvas (entrar, muelle, salir). Todo lo que se toca responde; nada aparece de golpe.
   Con «Reducir movimiento» todo lo que se desliza o crece pasa a ser un fundido corto. */
const CURVA = { entrar: 'cubic-bezier(.2,0,0,1)', muelle: 'cubic-bezier(.3,1.2,.4,1)', salir: 'cubic-bezier(.4,0,1,1)', heroe: 'cubic-bezier(.16,.8,.2,1)', circulo: 'cubic-bezier(.3,0,.1,1)', bajar: 'cubic-bezier(.4,0,.8,1)' };
const mqReducir = matchMedia('(prefers-reduced-motion: reduce)');
const reducido = () => mqReducir.matches;

const NEUTRO = /^(opacity:1|transform:none|filter:(none|blur\(0(px)?\))|scale:1|translate:none|rotate:none|boxShadow:none)$/;
/* Web Animations con limpieza: al terminar se fijan los estilos y se cancela (para no pisar estilos posteriores) */
function animar(el, kf, o) {
  if (!el || !el.animate) return Promise.resolve();
  o = Object.assign({ duration: 400, easing: CURVA.entrar, fill: 'both' }, o || {});
  if (reducido() && !o.siempre) {
    const ult = kf[kf.length - 1] || {};
    const fin = {}; if ('opacity' in ult) fin.opacity = ult.opacity;
    kf = [{ opacity: 'opacity' in (kf[0] || {}) ? kf[0].opacity : 1 }, Object.assign({ opacity: 1 }, fin)];
    o.duration = Math.min(o.duration, 150); o.delay = Math.min(o.delay || 0, 60);
  }
  delete o.siempre;
  const a = el.animate(kf, o);
  /* Al terminar se escribe a mano el último fotograma y se cancela. No se usa commitStyles: en Safari del iPhone
     a veces fija el primer fotograma y deja palabras, campos y letras invisibles. */
  const fin = Object.assign({}, kf[kf.length - 1] || {});
  delete fin.offset; delete fin.easing; delete fin.composite;
  const fija = o.fill === 'both' || o.fill === 'forwards';
  return a.finished.then(() => {
    try {
      if (fija) for (const k in fin) {
        const v = String(fin[k]);
        /* Un valor neutro se borra en vez de escribirse: así no queda una capa transformada que emborrona el texto */
        el.style[k] = NEUTRO.test(k + ':' + v) ? '' : v;
      }
    } catch (e) { }
    try { a.cancel(); } catch (e) { }
  }, () => { });
}
const Anim = {
  /* Entrada escalonada de los bloques de una pantalla: [data-e] = sube | pop | heroe | izq | der | foto */
  entrar(root, o) {
    o = o || {};
    const els = $$('[data-e]', root).filter(e => !e.closest('.o-oculto'));
    let i = 0;
    els.forEach(el => {
      const tipo = el.dataset.e; const n = Math.min(i++, 8);
      const d = (o.retraso || 0) + n * (o.paso || 60) + (+el.dataset.d || 0);
      if (tipo === 'pop') animar(el, [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d, easing: CURVA.muelle });
      else if (tipo === 'heroe') animar(el, [{ opacity: 0, transform: 'translateY(40px) scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: d, easing: CURVA.heroe });
      else if (tipo === 'foto') animar(el, [{ opacity: 0, transform: 'scale(1.12)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 1100, delay: d, easing: CURVA.heroe });
      else if (tipo === 'izq') animar(el, [{ opacity: 0, transform: 'translateX(-22px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d });
      else if (tipo === 'der') animar(el, [{ opacity: 0, transform: 'translateX(28px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: d });
      else if (tipo === 'titulo') Anim.letras(el, d);
      else if (tipo === 'linea') animar(el, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: d, easing: CURVA.entrar });
      else animar(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: d });
    });
  },
  /* Títulos grandes: cada palabra sube desde detrás de una máscara */
  letras(el, d) {
    if (reducido()) return animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    if (!el.dataset.part) {
      el.dataset.part = '1';
      el.innerHTML = el.innerHTML.split(/(<br>|\s+)/).map(w => w === '<br>' ? w : /^\s+$/.test(w) ? ' ' : w ? `<span class="o-pal"><span>${w}</span></span>` : '').join('');
    }
    $$('.o-pal>span', el).forEach((s, i) => animar(s, [{ transform: 'translateY(105%) rotate(3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 820, delay: d + i * 70, easing: CURVA.heroe }));
  },
  /* Números que ruedan: el viejo sube y se va; el nuevo llega desde abajo */
  numero(el, nuevo) {
    if (!el) return;
    const viejo = el.dataset.v;
    nuevo = String(nuevo);
    if (viejo === nuevo) return;
    el.dataset.v = nuevo;
    if (viejo == null || reducido()) { el.textContent = nuevo; return; }
    const sube = parseFloat(String(nuevo).replace(/[^\d,-]/g, '').replace(',', '.')) >= parseFloat(String(viejo).replace(/[^\d,-]/g, '').replace(',', '.'));
    const w = el.getBoundingClientRect().width;
    el.style.minWidth = w + 'px';
    el.innerHTML = `<span class="o-rueda"><span class="o-rv">${esc(viejo)}</span><span class="o-rn">${esc(nuevo)}</span></span>`;
    const v = $('.o-rv', el), n = $('.o-rn', el);
    animar(v, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${sube ? -60 : 60}%)`, opacity: 0 }], { duration: 160, easing: CURVA.salir, siempre: true });
    animar(n, [{ transform: `translateY(${sube ? 60 : -60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, delay: 60, easing: CURVA.entrar, siempre: true }).then(() => { if (el.dataset.v === nuevo) { el.textContent = nuevo; el.style.minWidth = ''; } });
  },
  /* Cuenta hacia arriba desde 0 al entrar en pantalla */
  contar(el, hasta, ms) {
    if (!el) return;
    hasta = +hasta || 0;
    if (reducido() || hasta < 2) { el.textContent = hasta; return; }
    const t0 = performance.now(); ms = ms || 900;
    const f = t => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(hasta * e); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  },
  /* Elemento compartido: una copia de la imagen viaja de su sitio al destino */
  async vuela(desde, hacia, o) {
    o = o || {};
    if (!desde || !hacia || reducido()) return;
    const a = desde.getBoundingClientRect(), b = hacia.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const c = document.createElement('div');
    c.className = 'o-vuelo';
    const radA = getComputedStyle(desde).borderRadius, radB = getComputedStyle(hacia).borderRadius;
    c.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;border-radius:${radA};background-image:${o.imagen ? `url("${o.imagen}")` : getComputedStyle(desde).backgroundImage}`;
    document.body.appendChild(c);
    hacia.style.visibility = 'hidden';
    const giro = o.giro || 0;
    await animar(c, [
      { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: radA, transform: 'rotate(0deg)' },
      { offset: .55, transform: `rotate(${giro}deg)` },
      { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: radB, transform: 'rotate(0deg)' }
    ], { duration: o.ms || 700, easing: CURVA.entrar, fill: 'forwards' });
    hacia.style.visibility = '';
    animar(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, siempre: true }).then(() => c.remove());
  },
  /* Revela un elemento con un círculo que crece desde un punto */
  circulo(el, x, y, ms) {
    if (reducido()) return animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    return animar(el, [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }], { duration: ms || 760, easing: CURVA.circulo });
  },
  /* Píldora que se desliza entre opciones (pestañas, días, filtros) */
  pildora(cont, el, ms) {
    if (!cont || !el) return;
    const p = $('.o-pild', cont); if (!p) return;
    const a = cont.getBoundingClientRect(), b = el.getBoundingClientRect();
    const x = b.left - a.left + cont.scrollLeft, w = b.width;
    if (!p.dataset.ok || reducido()) { p.style.transition = 'none'; p.style.transform = `translateX(${x}px)`; p.style.width = w + 'px'; p.offsetWidth; p.style.transition = ''; p.dataset.ok = '1'; return; }
    p.style.transitionDuration = (ms || 420) + 'ms';
    p.style.transform = `translateX(${x}px)`; p.style.width = w + 'px';
  },
  /* Coloca las píldoras de una pantalla recién montada (sin animar) y centra la opción elegida */
  pildoras(root) {
    $$('.o-pild', root).forEach(p => {
      const cont = p.parentNode, on = Array.from(cont.children).find(x => x.classList.contains('o-on'));
      if (!on) return;
      p.dataset.ok = '';
      if (cont.scrollWidth > cont.clientWidth + 4) cont.scrollLeft = Math.max(0, on.offsetLeft - cont.clientWidth / 2 + on.offsetWidth / 2);
      Anim.pildora(cont, on);
    });
  },
  /* Destello en el sitio donde se ha tocado (para acciones importantes) */
  onda(el, ev) {
    if (reducido() || !el) return;
    const r = el.getBoundingClientRect();
    const x = (ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2) - r.left, y = (ev && ev.clientY != null ? ev.clientY : r.top + r.height / 2) - r.top;
    const o = document.createElement('span'); o.className = 'o-onda';
    const s = Math.max(r.width, r.height) * 2.2;
    o.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
    el.appendChild(o);
    animar(o, [{ transform: 'scale(0)', opacity: .35 }, { transform: 'scale(1)', opacity: 0 }], { duration: 650, easing: CURVA.entrar }).then(() => o.remove());
  },
  /* Sacude suavemente (campo con error) */
  no(el) { animar(el, [{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }); vibrar(20); },
  /* Lo que se va: escala y se funde */
  fuera(el, ms) { return animar(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: ms || 220, easing: CURVA.salir }); },
  /* Salto del favorito o de una casilla */
  salto(el) { animar(el, [{ transform: 'scale(1)' }, { transform: 'scale(.8)', offset: .25 }, { transform: 'scale(1.22)', offset: .6 }, { transform: 'scale(1)' }], { duration: 460, easing: 'ease-out' }); }
};

/* ---------- Respuesta al toque en todo lo que lleva .t
   Pulsar: escala 0,95 en 120 ms. Soltar: vuelve con muelle en 340 ms. La acción va al soltar (click). */
(function () {
  let actual = null, x0 = 0, y0 = 0;
  const soltar = () => { if (actual) { actual.classList.remove('pres'); actual = null; } };
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('.t');
    if (!t || t.disabled) return;
    actual = t; x0 = e.clientX; y0 = e.clientY;
    t.classList.add('pres');
  }, { passive: true });
  document.addEventListener('pointermove', e => { if (actual && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) soltar(); }, { passive: true });
  document.addEventListener('pointerup', soltar, { passive: true });
  document.addEventListener('pointercancel', soltar, { passive: true });
  document.addEventListener('scroll', soltar, { passive: true, capture: true });
})();

/* ---------- Iconos: un solo juego de línea, trazo redondo */
const ICONOS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  map: '<path d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  idea: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  doc: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19V5a1.5 1.5 0 011-1.5z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h4"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M16 14.1c2.4.1 4 1.7 4.5 4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10.5 21l2-6.5-2.5-2.5 1-4.5 3 2.5 3 1M10 7.5l-3 2-1 3.5M12.5 14.5l2.5 2.5 1 4"/>',
  bus: '<rect x="5" y="3.5" width="14" height="14" rx="3"/><path d="M5 11h14M8 17.5V20M16 17.5V20"/><circle cx="8.5" cy="14.3" r=".6"/><circle cx="15.5" cy="14.3" r=".6"/>',
  train: '<rect x="6" y="3.5" width="12" height="13" rx="3.5"/><path d="M6 10.5h12M9 20l1.5-3.5M15 20l-1.5-3.5"/><circle cx="9.5" cy="13.5" r=".6"/><circle cx="14.5" cy="13.5" r=".6"/>',
  plane: '<path d="M10.5 13.5L4 11l1.2-1.4 7 .9 4.3-4.6c.8-.8 2.2-.9 2.8-.3.6.6.5 2-.3 2.8l-4.6 4.3.9 7-1.4 1.2-2.5-6.5-3.2 3 .2 2.3-1.1 1.1-1.4-3.4-3.4-1.4 1.1-1.1 2.3.2z"/>',
  bed: '<path d="M3.5 18.5v-11M3.5 14.5h17v4M20.5 14.5v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11.3" r="1.8"/>',
  food: '<path d="M6.5 3.5v6a2 2 0 002 2v9M10.5 3.5v6a2 2 0 01-2 2M8.5 3.5v5M16.5 20.5v-17c-2 1-3 3.5-3 6.5 0 2 1 3 3 3"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2a2.5 2.5 0 000-5z"/><path d="M14 6v12" stroke-dasharray="1.6 2.2"/>',
  car: '<path d="M5 16.5V12l1.8-4.5A2 2 0 018.7 6h6.6a2 2 0 011.9 1.5L19 12v4.5M5 12h14"/><rect x="4" y="12" width="16" height="5" rx="1.5"/><path d="M6.5 17v2M17.5 17v2"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z"/><circle cx="12" cy="12.8" r="3.3"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  share: '<path d="M12 15V3.5M8 7.5l4-4 4 4M6.5 11H6a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 006 20h12a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0018 11h-.5"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  more: '<circle cx="5.5" cy="12" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="18.5" cy="12" r=".9"/>',
  edit: '<path d="M4.5 19.5l.8-3.7L15.7 5.4a1.8 1.8 0 012.6 0l.3.3a1.8 1.8 0 010 2.6L8.2 18.7z"/><path d="M13.5 7.5l3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5l1-12.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5l1.6 1-1.8 3.2-1.8-.6a7.5 7.5 0 01-2.3 1.4l-.3 1.9h-3.6l-.3-1.9a7.5 7.5 0 01-2.3-1.4l-1.8.6L4.9 14.5l1.6-1a7.6 7.6 0 010-3l-1.6-1 1.8-3.2 1.8.6a7.5 7.5 0 012.3-1.4l.3-1.9h3.6l.3 1.9a7.5 7.5 0 012.3 1.4l1.8-.6 1.8 3.2-1.6 1a7.6 7.6 0 010 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 019.5 4.5a7.5 7.5 0 1010 10z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 000-17z" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-4.5-4.5-8 8.5"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="3"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
  film: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.3 4.3 0 0112 6.6a4.3 4.3 0 017.5 2.9c0 5.4-7.5 10-7.5 10z"/>',
  spark: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  swap: '<path d="M7 4.5v15M3.5 8L7 4.5 10.5 8M17 19.5v-15M13.5 16l3.5 3.5 3.5-3.5"/>',
  paste: '<rect x="5.5" y="5" width="13" height="16" rx="2.5"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
  out: '<path d="M14 4.5h4A1.5 1.5 0 0119.5 6v12a1.5 1.5 0 01-1.5 1.5h-4M10 16.5L5.5 12 10 7.5M5.5 12H15"/>',
  ext: '<path d="M13.5 4.5h6v6M19.5 4.5L11 13M17.5 14v4A1.5 1.5 0 0116 19.5H6A1.5 1.5 0 014.5 18V8A1.5 1.5 0 016 6.5h4"/>',
  key: '<circle cx="8" cy="15" r="3.8"/><path d="M10.8 12.3L19.5 3.5M16 7l2.5 2.5M14 9l2 2"/>',
  bubble: '<path d="M5 18.5l1-3.5A7.5 7.5 0 1112 19.5a7.6 7.6 0 01-3.5-.9z"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
  tiktok: '<path d="M14 3.5v11.2a3.8 3.8 0 11-3.8-3.8"/><path d="M14 3.5c.4 2.6 2.2 4.3 5 4.5"/>',
  insta: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r=".7"/>',
  gmaps: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><path d="M9.7 10h4.6a2.3 2.3 0 11-.7-1.6"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15zM10 20.5h4"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 0113-5.1l2 2M19.5 4v5h-5M19.5 12a7.5 7.5 0 01-13 5.1l-2-2M4.5 20v-5h5"/>'
};
function ic(n, s, w) { return `<svg class="ic" width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`; }

/* El logo: un planeta de porcelana con cinco paradas en el borde y la cuarta encendida */
function logo(s, o) {
  o = o || {};
  const R = 30, cx = 50, cy = 54, ang = [-150, -118, -90, -62, -30];
  const pts = ang.map(a => [cx + R * Math.cos(a * Math.PI / 180), cy + R * Math.sin(a * Math.PI / 180)]);
  return `<svg class="o-logo${o.clase ? ' ' + o.clase : ''}" width="${s}" height="${s}" viewBox="0 0 100 100" aria-label="Orbeo">
  <defs><radialGradient id="lg-p" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="var(--logo-a,#FFFFFF)"/><stop offset="1" stop-color="var(--logo-b,#E4DDD2)"/></radialGradient>
  <radialGradient id="lg-g"><stop offset="0" stop-color="var(--acento)" stop-opacity=".7"/><stop offset="1" stop-color="var(--acento)" stop-opacity="0"/></radialGradient></defs>
  <circle class="o-lg-orbe" cx="${cx}" cy="${cy}" r="${R}" fill="url(#lg-p)" stroke="var(--logo-borde,rgba(21,20,19,.14))" stroke-width="1"/>
  <path class="o-lg-ruta" d="M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} A${R} ${R} 0 0 1 ${pts[4][0].toFixed(2)} ${pts[4][1].toFixed(2)}" fill="none" stroke="var(--tinta)" stroke-width="1.6" stroke-linecap="round" opacity=".55" pathLength="1"/>
  ${pts.map((p, i) => i === 3
    ? `<g class="o-lg-luz"><circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="11" fill="url(#lg-g)"/><circle class="o-lg-b" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="5.2" fill="var(--acento)"/></g>`
    : `<circle class="o-lg-b" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="4.4" fill="var(--tinta)"/>`).join('')}
  </svg>`;
}

/* ============================ REPINTAR SIN PARPADEOS ============================
   Cambia solo lo que es distinto entre lo que hay en pantalla y el HTML nuevo. Las fotos, los botones y el
   scroll se quedan donde están: nada desaparece para volver a aparecer. Los hijos con data-id se emparejan
   por su id; los que llevan data-fijo (mapas) no se tocan. */
function morph(raiz, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphHijos(raiz, t.content);
}
function claveNodo(n) { return n.nodeType === 1 ? (n.id ? '#' + n.id : n.dataset && n.dataset.id ? n.tagName + ':' + n.dataset.id + ':' + (n.dataset.a || '') : null) : null; }
function morphHijos(a, b) {
  const viejos = Array.from(a.childNodes), nuevos = Array.from(b.childNodes);
  const porClave = {};
  viejos.forEach(n => { const k = claveNodo(n); if (k && !porClave[k]) porClave[k] = n; });
  const usados = new Set();
  let i = 0;
  const orden = [];
  nuevos.forEach(nb => {
    const k = claveNodo(nb);
    let na = null;
    if (k && porClave[k] && !usados.has(porClave[k])) na = porClave[k];
    else if (!k) {
      while (i < viejos.length && (usados.has(viejos[i]) || claveNodo(viejos[i]))) i++;
      const c = viejos[i];
      if (c && c.nodeType === nb.nodeType && (c.nodeType !== 1 || c.tagName === nb.tagName)) { na = c; i++; }
    }
    if (na) { usados.add(na); morphNodo(na, nb); orden.push(na); }
    else orden.push(nb);
  });
  viejos.forEach(n => { if (!usados.has(n)) a.removeChild(n); });
  orden.forEach((n, j) => { if (a.childNodes[j] !== n) a.insertBefore(n, a.childNodes[j] || null); });
}
function morphNodo(a, b) {
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1) return;
  if (a.hasAttribute('data-fijo') && b.hasAttribute('data-fijo')) return;
  Array.from(a.attributes).forEach(at => { if (at.name !== 'style' && !b.hasAttribute(at.name)) a.removeAttribute(at.name); });
  Array.from(b.attributes).forEach(at => { if (at.name !== 'style' && a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); });
  /* el estilo del HTML solo se cambia si ha cambiado el HTML (no se pisa lo que deja una animación) */
  const st = b.getAttribute('style') || '';
  if (a._st === undefined) a._st = st ? (a.getAttribute('style') || '') : '';
  if (st !== a._st) { a.setAttribute('style', st); a._st = st; }
  if (a.tagName === 'INPUT') { const v = b.getAttribute('value') || ''; if (document.activeElement !== a && a.value !== v) a.value = v; return; }
  if (a.tagName === 'TEXTAREA') { if (document.activeElement !== a && a.value !== b.textContent) a.value = b.textContent; return; }
  if (a.dataset.part && a.dataset.e === 'titulo') {
    if (a.textContent.replace(/\s+/g, ' ').trim() === b.textContent.replace(/\s+/g, ' ').trim()) return;
    delete a.dataset.part; a.innerHTML = b.innerHTML; return;
  }
  morphHijos(a, b);
}

/* ---------- Fotos ya decodificadas antes de enseñarlas (no llegan tarde ni parpadean) */
const Fotos = {
  hechas: {}, guardadas: [],
  una(u) {
    if (!u) return Promise.resolve();
    if (this.hechas[u]) return this.hechas[u];
    const im = new Image(); im.decoding = 'async'; im.src = u;
    const pr = (im.decode ? im.decode() : new Promise(r => { im.onload = r; im.onerror = r; })).catch(() => { });
    this.hechas[u] = pr; this.guardadas.push(im); if (this.guardadas.length > 160) this.guardadas.shift();
    return pr;
  },
  /* Espera como mucho «ms»: si la red va lenta, no se bloquea la navegación */
  varias(us, ms) { const t = Promise.all((us || []).filter(Boolean).map(u => this.una(u))); return ms ? Promise.race([t, espera(ms)]) : t; }
};

/* ---------- Lo que va fijo en pantalla (barra de pestañas, botones de arriba) mientras la pantalla se mueve.
   Dentro de una pantalla que se mueve, «fixed» deja de ser fijo: se pasa un momento a «absolute» en su sitio. */
function fijar(el) {
  if (!el) return;
  const er = el.getBoundingClientRect();
  $$('.o-tabs,.o-pd-bar,.o-pd-mcab', el).forEach(f => {
    if (f.dataset.fijado) return;
    const r = f.getBoundingClientRect();
    f.dataset.fijado = '1';
    f.style.position = 'absolute'; f.style.top = (el.scrollTop + r.top - er.top) + 'px'; f.style.bottom = 'auto';
  });
}
function soltarFijos(el) {
  if (!el) return;
  $$('[data-fijado]', el).forEach(f => { delete f.dataset.fijado; f.style.position = ''; f.style.top = ''; f.style.bottom = ''; });
}

/* ---------- Listas que cambian (filtros): lo que se queda se desliza a su sitio nuevo, lo que se va se encoge
   y lo nuevo entra. Nada se queda en blanco. */
function cambiarLista(cont, html, sel) {
  const antes = {};
  const t = document.createElement('template'); t.innerHTML = html;
  const quedan = {}; Array.from(t.content.querySelectorAll(sel)).forEach(x => { quedan[x.dataset.id] = 1; });
  const cr = cont.getBoundingClientRect();
  const fuera = [];
  $$(sel, cont).forEach(x => {
    const r = x.getBoundingClientRect(); antes[x.dataset.id] = r;
    if (!quedan[x.dataset.id]) {
      const c = x.cloneNode(true);
      c.style.cssText += `;position:absolute;left:${r.left - cr.left}px;top:${r.top - cr.top}px;width:${r.width}px;margin:0;pointer-events:none;z-index:0`;
      fuera.push(c);
    }
  });
  morph(cont, html);
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
  fuera.forEach(c => { cont.appendChild(c); animar(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 240, easing: CURVA.salir, siempre: true }).then(() => { if (c.parentNode) c.parentNode.removeChild(c); }); });
  let n = 0;
  $$(sel, cont).forEach(x => {
    if (fuera.indexOf(x) >= 0) return;
    const a = antes[x.dataset.id], b = x.getBoundingClientRect();
    if (a) { const dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) animar(x, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 480, easing: CURVA.entrar }); }
    else animar(x, [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 120 + Math.min(n++, 6) * 50, easing: CURVA.entrar });
  });
}
