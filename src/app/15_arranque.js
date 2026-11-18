/* ============================ ARRANQUE ============================ */
function splash() {
  const el = document.createElement('div'); el.className = 'o-splash';
  el.innerHTML = `<div class="o-splash-c">${logo(132, { clase: 'o-logo-sp' })}<div class="o-splash-m">${'orbeo'.split('').map(l => `<span>${l}</span>`).join('')}</div></div>`;
  document.body.appendChild(el);
  if (reducido()) return { fuera: () => animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).then(() => el.remove()) };
  const orbe = $('.o-lg-orbe', el), ruta = $('.o-lg-ruta', el), bs = $$('.o-lg-b', el), luz = $('.o-lg-luz', el), ls = $$('.o-splash-m span', el);
  animar(orbe, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 640, easing: CURVA.heroe, siempre: true });
  orbe.style.transformOrigin = '50px 54px'; orbe.style.transformBox = 'view-box';
  animar(ruta, [{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }], { duration: 700, delay: 180, easing: CURVA.entrar, siempre: true });
  bs.forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'center'; animar(b, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 220 + i * 110, easing: CURVA.muelle, siempre: true }); });
  luz.style.transformBox = 'fill-box'; luz.style.transformOrigin = 'center';
  animar($('circle', luz), [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.25)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 640, easing: 'ease-out', siempre: true });
  ls.forEach((s, i) => animar(s, [{ opacity: 0, transform: 'translateY(70%)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 520 + i * 50, easing: CURVA.heroe, siempre: true }));
  const listo = espera(1150);
  return {
    fuera: async () => {
      await listo;
      animar($('.o-splash-c', el), [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.12) translateY(-10px)', opacity: 0 }], { duration: 460, easing: CURVA.salir, siempre: true });
      await animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 120, siempre: true });
      el.remove();
    }
  };
}

async function arrancar() {
  const sp = splash();
  await DB.abrir();
  S.pref = (await DB.get('pref')) || {};
  aplicarTema();
  S.cfg = (await DB.get('cfg')) || null;
  const d = await DB.get('datos');
  if (d) { S.recs = d.recs || {}; S.seq = d.seq || 0; S.sid = d.sid || ''; }
  S.cola = (await DB.get('cola')) || {};
  const q = new URLSearchParams(location.search);
  if (q.get('demo') === '1' && !S.cfg) { S.cfg = { demo: true, persona: 'p1', rol: 'admin' }; await DB.set('cfg', S.cfg); crearDemo(); guardarLocal(true); }
  if (q.get('tema')) { S.pref.tema = q.get('tema'); aplicarTema(); }
  if (S.cfg && S.cfg.demo && !lista('viajes').length) crearDemo();
  const inv = (location.hash.match(/inv=(ORBEO1-[A-Za-z0-9_-]+)/) || [])[1];
  const fuera = sp.fuera();
  await espera(reducido() ? 0 : 820);
  if (inv && (!S.cfg || S.cfg.demo)) { history.replaceState(null, '', location.pathname + location.search); Nav.raiz('bienvenida'); setTimeout(() => Nav.ir('conectar', { modo: 'unirse', inv }), 500); }
  else if (S.cfg) Nav.raiz('inicio');
  else Nav.raiz('bienvenida');
  await fuera;
  Red.pintar(); Reloj.arrancar(); Reloj.tic();
  if (Sync.activo()) Sync.ya();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => anotar('sw', e));
  Cambio.tasas();
}
/* En el ordenador se repinta al cruzar el ancho de dos columnas */
let anchoEsc = ESCRITORIO();
window.addEventListener('resize', () => { const e = ESCRITORIO(); if (e !== anchoEsc) { anchoEsc = e; const pa = Nav.actual(); if (pa) { Mapa.desmontar(pa.el); Nav.pintar(pa, false); } } });
arrancar();
