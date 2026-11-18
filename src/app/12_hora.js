/* ============================ HORA Y MONEDA ============================ */
const Cambio = {
  async tasas() {
    if (!S.tasas) S.tasas = await DB.get('tasas');
    if (S.tasas && Date.now() - S.tasas.t < 6 * 3600000) return S.tasas;
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/EUR'); const j = await r.json();
      if (j.result === 'success') { S.tasas = { t: Date.now(), act: (j.time_last_update_unix || 0) * 1000, r: j.rates }; DB.set('tasas', S.tasas); }
    } catch (e) { anotar('cambio', e); }
    return S.tasas;
  },
  convertir(v, de, a) { const t = S.tasas && S.tasas.r; if (!t || !t[de] || !t[a]) return null; return v / t[de] * t[a]; }
};
function dinero(v, mon) {
  if (v == null || isNaN(v)) return '—';
  const dec = ['JPY', 'KRW', 'ISK', 'VND', 'IDR', 'CLP', 'COP', 'HUF'].indexOf(mon) >= 0 ? 0 : (v >= 1000 ? 0 : 2);
  return nf(v, dec);
}
PANT.hora = {
  render(p) {
    const v = dato('viajes', p.id) || {}, casa = TZ_CASA(), tz = v.tz || casa;
    const a = enZona(tz), b = enZona(casa);
    const monA = v.moneda || 'EUR', monB = S.pref.monedaCasa || 'EUR';
    p.de = p.de || monA; p.a = p.a || (p.de === monA ? monB : monA);
    p.cant = p.cant != null ? p.cant : (p.de === 'JPY' ? 1000 : p.de === 'KRW' ? 10000 : 10);
    const hora0 = Math.floor(a.min / 60);
    return `<div class="o-cont o-hora">
      <div class="o-cab" data-e><button class="o-bt o-borde t t-s" data-a="atras">${ic('back')}</button><span class="o-nota">${esc(v.nombre || '')}</span><span style="width:46px"></span></div>
      <h1 class="o-t1" data-e="titulo" style="margin-top:14px">Hora y moneda</h1>
      <div class="o-relojes" data-e>
        <div class="o-reloj"><span class="o-cap">${esc(nombreZona(tz))} · allí</span><span class="o-reloj-h tn" data-reloj="${esc(tz)}">${a.hora}</span><span class="o-nota">${esc(fechaLarga(a.dia))}</span></div>
        <div class="o-reloj-dif"><span class="o-chip o-sup tn">${esc(difHoras(tz, casa))}</span></div>
        <div class="o-reloj o-reloj-b"><span class="o-cap">${esc(nombreZona(casa))} · en casa</span><span class="o-reloj-h tn" data-reloj="${esc(casa)}">${b.hora}</span><span class="o-nota">${esc(fechaLarga(b.dia))}</span></div>
      </div>
      <div class="o-sec" data-e><span class="o-cap">Las 24 horas</span><span class="o-nota">Arriba ${esc(nombreZona(tz))}, abajo ${esc(nombreZona(casa))}</span></div>
      <div class="o-horas o-nodrag" data-e><span class="o-pild"></span>${Array.from({ length: 24 }, (_, h) => { const c = cambiarZona(a.dia, p2(h) + ':00', tz, casa); const noche = h < 7 || h >= 23, cn = +c.hora.slice(0, 2) < 7 || +c.hora.slice(0, 2) >= 23; return `<button class="o-hr t t-s${h === hora0 ? ' o-on' : ''}" data-a="hr"><span class="tn${noche ? ' o-noche' : ''}">${p2(h)}</span><span class="tn${cn ? ' o-noche' : ''}">${c.hora.slice(0, 2)}</span></button>`; }).join('')}</div>
      <div class="o-sec" data-e><span class="o-cap">Conversor</span><span class="o-nota" id="h-act"></span></div>
      <div class="o-conv" data-e>
        <label class="o-conv-f"><span class="o-conv-m">${esc(p.de)}</span><input id="f-cant" class="o-conv-in tn" inputmode="decimal" value="${esc(nf(p.cant, 2).replace(/\./g, ''))}"><span class="o-conv-s">${esc(SIMBOLO[p.de] || p.de)}</span></label>
        <button class="o-conv-sw t t-s" data-a="girar">${ic('swap', 20)}</button>
        <div class="o-conv-f o-conv-r"><span class="o-conv-m">${esc(p.a)}</span><span class="o-conv-out tn" id="h-res">—</span><span class="o-conv-s">${esc(SIMBOLO[p.a] || p.a)}</span></div>
      </div>
      <div class="o-rapidas" data-e>${(p.de === 'JPY' || p.de === 'KRW' || p.de === 'ISK' ? [500, 1000, 5000, 10000, 30000] : [5, 10, 20, 50, 100]).map(n => `<button class="o-chip o-sup t t-s" data-a="rapida" data-n="${n}">${nf(n, 0)} ${esc(SIMBOLO[p.de] || p.de)}</button>`).join('')}</div>
      <div class="o-nota" data-e style="margin-top:16px;text-align:center" id="h-tasa"></div>
    </div>`;
  },
  alPintar(el, p) {
    const hs = $('.o-horas', el); Anim.pildora(hs, $('.o-hr.o-on', hs)); const on = $('.o-hr.o-on', hs); if (on) hs.scrollLeft = on.offsetLeft - hs.clientWidth / 2 + 24;
    const inp = $('#f-cant', el);
    const calc = () => {
      p.cant = parseFloat(inp.value.replace(/\./g, '').replace(',', '.')) || 0;
      const r = Cambio.convertir(p.cant, p.de, p.a);
      Anim.numero($('#h-res', el), dinero(r, p.a));
      const t1 = Cambio.convertir(1, p.a, p.de);
      $('#h-tasa', el).textContent = t1 ? `1 ${SIMBOLO[p.a] || p.a} = ${nf(t1, t1 > 100 ? 0 : 2)} ${SIMBOLO[p.de] || p.de}` : 'Sin cambio guardado todavía. Hace falta conexión una vez.';
      if (S.tasas) $('#h-act', el).textContent = 'Actualizado ' + haceCuanto(S.tasas.act || S.tasas.t);
    };
    inp.addEventListener('input', calc);
    inp.addEventListener('focus', () => inp.select());
    Cambio.tasas().then(calc); calc();
    p.calc = calc;
  },
  acciones: {
    girar: (b, e, p, pa) => {
      animar(b, [{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 520, easing: CURVA.muelle });
      const r = Cambio.convertir(p.cant, p.de, p.a);
      [p.de, p.a] = [p.a, p.de]; p.cant = r ? Math.round(r * 100) / 100 : p.cant;
      const fs = $$('.o-conv-f', pa.el);
      fs.forEach((f, i) => animar(f, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${i ? -16 : 16}px)` }], { duration: 180, easing: CURVA.salir }));
      setTimeout(() => { Nav.pintar(pa, false); $$('.o-conv-f', pa.el).forEach((f, i) => animar(f, [{ opacity: 0, transform: `translateY(${i ? 16 : -16}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 })); }, 190);
    },
    rapida: (b, e, p, pa) => { const i = $('#f-cant', pa.el); i.value = nf(+b.dataset.n, 0).replace(/\./g, ''); Anim.salto(b); p.calc(); },
    hr: (b) => { Anim.pildora(b.parentNode, b); $$('.o-hr', b.parentNode).forEach(x => x.classList.toggle('o-on', x === b)); }
  }
};
