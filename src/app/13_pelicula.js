/* ============================ PELÍCULA DEL DÍA ============================
   Con las fotos y vídeos del día se monta un vídeo vertical: portada con el día, cada foto con un
   movimiento lento y su parada, fundidos entre ellas, música suave generada en el móvil y un final.
   Se ve al momento y se puede guardar (MediaRecorder) para compartirlo. */
function clipsDelDia(v, dia) {
  const ps = paradasDe(v.id, dia);
  const out = [];
  ps.forEach(x => (x.fotos || []).forEach(f => out.push({ m: f, tipo: 'foto', parada: x })));
  lista('medios', m => m.viaje === v.id && m.dia === dia).sort((a, b) => (a.creado || 0) - (b.creado || 0)).forEach(m => {
    const x = m.parada ? dato('paradas', m.parada) : null;
    if (out.some(o => urlMedio(o.m) === urlMedio(m))) return;
    out.push({ m, tipo: m.tipo === 'video' ? 'video' : 'foto', parada: x });
  });
  return { clips: out.slice(0, 30), paradas: ps };
}
function tituloPeli(v, dia, ps) {
  const ns = ps.map(p => p.nombre);
  if (/inari/i.test(ns.join(' '))) return 'Mil puertas<br>rojas';
  if (ns.length >= 2) return esc(ns[0].split(' ').slice(-1)[0]) + ' y<br>' + esc(ns[ns.length - 1].replace(/^(Cena|Comida|Paseo) (en|por) /, ''));
  if (ns.length === 1) return esc(ns[0]);
  return esc(v.ciudad || v.nombre);
}
PANT.pelicula = {
  clase: 'o-oscura o-ppeli',
  render(p) {
    const v = dato('viajes', p.id); if (!v) return '';
    const { clips, paradas } = clipsDelDia(v, p.dia);
    const fotos = clips.filter(c => c.tipo === 'foto').length, videos = clips.length - fotos;
    const dur = Math.round(2.4 + clips.length * 2.8 + 2.6);
    const portada = clips[0] ? urlMedio(clips[0].m) : portadaUrl(v);
    p.titulo = tituloPeli(v, p.dia, paradas);
    return `<div class="o-peli-p">
      <div class="o-peli-fondo" data-e="foto" style="${portada ? `background-image:url('${portada}')` : ''}"></div>
      <canvas class="o-peli-cv" width="720" height="1280"></canvas>
      <div class="o-peli-velo"></div>
      <div class="o-peli-seg">${(clips.length ? [0].concat(clips.map(() => 0), [0]) : [0]).map(() => '<span><i></i></span>').join('')}</div>
      <div class="o-peli-bar"><button class="o-bt o-vido t t-s" data-a="atras">${ic('back', 20)}</button><span class="o-chip o-vido"><span class="o-punto"></span>Película del día</span><button class="o-bt o-vido t t-s" data-a="peliMas">${ic('more', 20, 2.4)}</button></div>
      <div class="o-peli-info">
        <div class="o-cap o-claro" data-e>${esc(cap(diaSemana(p.dia)))} ${fecha(p.dia).getUTCDate()} · ${esc(v.ciudad || v.nombre)}</div>
        <h1 class="o-peli-tit" data-e="titulo">${p.titulo}</h1>
        <div class="o-peli-dat" data-e>${[[paradas.length, 'lugares'], [fotos, 'fotos'], [videos, 'vídeos'], [clips.length ? Math.floor(dur / 60) + ':' + p2(dur % 60) : '0:00', 'minutos']].map(([n, l]) => `<div><span class="o-num tn">${n}</span><span class="o-cap">${l}</span></div>`).join('')}</div>
        <div class="o-peli-b" data-e>
          ${clips.length ? `<button class="o-pil o-blanca t t-g" data-a="ver">${ic('play', 15, 2)}<span>Ver la película</span></button>` : `<button class="o-pil o-blanca t t-g" data-a="anadir">${ic('plus', 16, 2)}Añadir fotos y vídeos</button>`}
          ${clips.length ? `<button class="o-bt o-vido t t-s" data-a="guardarPeli" style="width:54px;height:54px" aria-label="Guardar vídeo">${ic('download', 19)}</button><button class="o-bt o-vido t t-s${S.pref.sinMusica ? ' o-apagado' : ''}" data-a="musica" style="width:54px;height:54px" aria-label="Música">${ic('music', 19)}</button>` : ''}
        </div>
        ${clips.length ? `<button class="o-enlace o-claro t" data-a="anadir" data-e style="margin:14px auto 0;display:block">Añadir más fotos y vídeos</button>` : `<p class="o-nota o-claro" data-e style="margin-top:14px;text-align:center">Las fotos que pongáis en las paradas de este día también salen.</p>`}
      </div>
    </div>`;
  },
  alSalir(el, p) { if (p.peli) p.peli.parar(); },
  acciones: {
    ver: async (b, e, p, pa) => {
      const el = pa.el;
      if (p.peli && p.peli.corre) { p.peli.pausa(); return; }
      if (p.peli && p.peli.pausado) { p.peli.seguir(); return; }
      el.classList.add('o-viendo');
      cargando(b, true);
      const v = dato('viajes', p.id);
      p.peli = new Peli($('.o-peli-cv', el), clipsDelDia(v, p.dia).clips, { v, dia: p.dia, titulo: p.titulo.replace(/<br>/g, '\n').replace(/&amp;/g, '&') }, $$('.o-peli-seg i', el));
      await p.peli.cargar();
      cargando(b, false);
      b.innerHTML = ic('pause', 15, 2) + '<span>Pausar</span>';
      p.peli.alFin = () => { el.classList.remove('o-viendo'); b.innerHTML = ic('play', 15, 2) + '<span>Ver otra vez</span>'; p.peli = null; };
      p.peli.alPausa = on => { b.innerHTML = on ? ic('play', 15, 2) + '<span>Seguir</span>' : ic('pause', 15, 2) + '<span>Pausar</span>'; el.classList.toggle('o-viendo', !on); };
      p.peli.empezar(!S.pref.sinMusica);
    },
    musica: (b) => { S.pref.sinMusica = !S.pref.sinMusica; guardarPref(); b.classList.toggle('o-apagado', S.pref.sinMusica); Anim.salto(b); aviso(S.pref.sinMusica ? 'Sin música' : 'Con música'); },
    anadir: async (b, e, p) => {
      const fs = await elegirArchivos('image/*,video/*', true); if (!fs.length) return;
      if (!puedoEditar()) return aviso('Con tu papel solo puedes ver.');
      for (const f of fs) {
        const video = /^video/.test(f.type);
        const blob = video ? f : await reducir(f, 1800, .85);
        const mid = await Subidas.guardar(blob, f.name || (video ? 'video.mp4' : 'foto.jpg'));
        nuevo('medios', { viaje: p.id, dia: p.dia, tipo: video ? 'video' : 'foto', mid }, { callado: true });
      }
      Nav.refrescar(); aviso(fs.length === 1 ? 'Añadida a la película' : fs.length + ' añadidas a la película', { ic: 'check' });
    },
    guardarPeli: async (b, e, p, pa) => {
      if (!window.MediaRecorder) return aviso('Este navegador no puede guardar vídeos. Prueba con Safari actualizado o Chrome.');
      if (p.peli) p.peli.parar();
      const v = dato('viajes', p.id), el = pa.el;
      el.classList.add('o-viendo', 'o-grabando');
      const pr = Capa.hoja({ clase: 'o-hoja-peq', cerrable: false, html: `<div class="o-grab"><div class="o-t3" data-e>Montando la película…</div><p class="o-nota" data-e>Se graba a tiempo real. No cierres la app.</p><div class="o-barra" data-e><i id="g-bar"></i></div></div>` });
      try {
        const peli = new Peli($('.o-peli-cv', el), clipsDelDia(v, p.dia).clips, { v, dia: p.dia, titulo: p.titulo.replace(/<br>/g, '\n').replace(/&amp;/g, '&') }, $$('.o-peli-seg i', el));
        await peli.cargar();
        peli.alAvance = k => { const g = $('#g-bar'); if (g) g.style.transform = `scaleX(${k})`; };
        const blob = await peli.grabar(!S.pref.sinMusica);
        pr.cerrar(); el.classList.remove('o-viendo', 'o-grabando');
        entregarPeli(blob, v, p.dia);
      } catch (er) { pr.cerrar(); el.classList.remove('o-viendo', 'o-grabando'); aviso('No se ha podido grabar: ' + er.message); anotar('grabar', er); }
    },
    peliMas: (b, e, p) => Capa.menu(b, [
      { t: 'Elegir otro día', ic: 'plan', f: () => { const v = dato('viajes', p.id); const c = Capa.hoja({ html: `<div class="o-hcab"><div class="o-t2" data-e>¿Qué día?</div></div><div class="o-dsel" data-e>${diasDe(v).map(d => `<button class="o-dsel-b t t-s${d === p.dia ? ' o-on' : ''}" data-a="d" data-d="${d}"><span class="o-nota">${'DLMXJVS'[fecha(d).getUTCDay()]}</span><span class="tn">${fecha(d).getUTCDate()}</span></button>`).join('')}</div>`, acciones: { d: (bb) => { p.dia = bb.dataset.d; c.cerrar(); const pa = Nav.actual(); Nav.pintar(pa, false); Anim.entrar(pa.el); } } }); } },
      { t: 'Añadir fotos y vídeos', ic: 'camera', f: () => PANT.pelicula.acciones.anadir(null, null, p) }
    ])
  }
};
function entregarPeli(blob, v, dia) {
  const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
  const nombre = `Orbeo ${v.nombre} ${dia}.${ext}`;
  const url = URL.createObjectURL(blob);
  const file = new File([blob], nombre, { type: blob.type });
  const c = Capa.hoja({
    html: `<div class="o-hcab" data-e><div class="o-t2">Lista</div></div>
      <video class="o-grab-v" data-e="pop" src="${url}" playsinline controls autoplay muted loop></video>
      <div class="o-conf-b" data-e>${navigator.canShare && navigator.canShare({ files: [file] }) ? `<button class="o-pil t" data-a="comp">${ic('share', 17)}Compartir</button>` : ''}<a class="o-pil o-sec t" href="${url}" download="${esc(nombre)}">${ic('download', 17)}Descargar</a></div>
      ${puedoEditar() ? `<button class="o-enlace t" data-a="aViaje" data-e style="display:block;margin:16px auto 0">Guardar en el viaje para el grupo</button>` : ''}`,
    acciones: {
      comp: () => navigator.share({ files: [file], title: v.nombre }).catch(() => { }),
      aViaje: async (b) => { const mid = await Subidas.guardar(blob, nombre); nuevo('medios', { viaje: v.id, dia, tipo: 'pelicula', mid }, { callado: true }); b.textContent = 'Guardada en el viaje'; Anim.salto(b); }
    }
  });
}

class Peli {
  constructor(cv, clips, info, barras) {
    this.cv = cv; this.x = cv.getContext('2d'); this.clips = clips; this.info = info; this.barras = barras || [];
    this.segs = [{ tipo: 'intro', dur: 2.4 }].concat(clips.map(c => ({ tipo: c.tipo, c, dur: 2.8 })), [{ tipo: 'fin', dur: 2.6 }]);
    this.total = this.segs.reduce((a, s) => a + s.dur, 0);
    this.t = 0; this.corre = false; this.pausado = false;
    const st = getComputedStyle(document.documentElement);
    this.acento = '#D9C3A1'; this.st = st;
  }
  async cargar() {
    await Promise.all([document.fonts.load('200 120px Inter'), document.fonts.load('500 30px Inter')]).catch(() => { });
    await Promise.all(this.segs.filter(s => s.c).map(async s => {
      const u = urlMedio(s.c.m) || (await blobMedio(s.c.m).then(b => b ? URL.createObjectURL(b) : '').catch(() => ''));
      if (!u) { s.malo = true; return; }
      if (s.tipo === 'video') {
        const vd = document.createElement('video'); vd.src = u; vd.muted = true; vd.playsInline = true; vd.crossOrigin = 'anonymous'; vd.preload = 'auto';
        await new Promise(ok => { vd.onloadeddata = ok; vd.onerror = ok; setTimeout(ok, 6000); });
        s.el = vd; s.dur = Math.min(4.5, Math.max(2, vd.duration || 3));
      } else {
        const im = new Image(); if (/^https?:/.test(u) && u.indexOf(location.origin) !== 0) im.crossOrigin = 'anonymous';
        await new Promise(ok => { im.onload = ok; im.onerror = () => { s.malo = true; ok(); }; im.src = u; });
        s.el = im;
      }
    }));
    this.segs = this.segs.filter(s => !s.malo);
    this.total = this.segs.reduce((a, s) => a + s.dur, 0);
    this.fondo = (this.segs.find(s => s.el && s.tipo === 'foto') || {}).el;
  }
  empezar(musica) {
    this.corre = true; this.t0 = performance.now(); this.t = 0;
    if (musica) this.musica = Musica.iniciar(this.total);
    const f = now => { if (!this.corre) return; this.t = (now - this.t0) / 1000; if (this.t >= this.total) { this.pintar(this.total - .001); this.fin(); return; } this.pintar(this.t); this.raf = requestAnimationFrame(f); };
    this.raf = requestAnimationFrame(f);
  }
  pausa() { this.corre = false; this.pausado = true; cancelAnimationFrame(this.raf); this.segs.forEach(s => s.el && s.el.pause && s.el.pause()); this.musica && this.musica.pausa(); this.alPausa && this.alPausa(true); }
  seguir() { this.pausado = false; this.corre = true; this.t0 = performance.now() - this.t * 1000; this.musica && this.musica.seguir(); this.alPausa && this.alPausa(false); const f = now => { if (!this.corre) return; this.t = (now - this.t0) / 1000; if (this.t >= this.total) { this.fin(); return; } this.pintar(this.t); this.raf = requestAnimationFrame(f); }; this.raf = requestAnimationFrame(f); }
  parar() { this.corre = false; cancelAnimationFrame(this.raf); this.musica && this.musica.parar(); this.segs.forEach(s => s.el && s.el.pause && s.el.pause()); }
  fin() { this.parar(); this.alFin && this.alFin(); }
  async grabar(musica) {
    const tipos = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const tipo = tipos.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const vs = this.cv.captureStream(30);
    let pistas = vs.getVideoTracks();
    if (musica) { this.musica = Musica.iniciar(this.total, true); if (this.musica && this.musica.stream) pistas = pistas.concat(this.musica.stream.getAudioTracks()); }
    const rec = new MediaRecorder(new MediaStream(pistas), tipo ? { mimeType: tipo, videoBitsPerSecond: 6000000 } : {});
    const trozos = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
    const listo = new Promise(ok => { rec.onstop = () => ok(new Blob(trozos, { type: rec.mimeType || tipo || 'video/webm' })); });
    rec.start(500);
    this.corre = true; this.t0 = performance.now();
    await new Promise(ok => {
      const f = now => { this.t = (now - this.t0) / 1000; this.alAvance && this.alAvance(Math.min(1, this.t / this.total)); if (this.t >= this.total) { this.pintar(this.total - .001); ok(); return; } this.pintar(this.t); requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    await espera(300);
    rec.stop(); this.parar();
    return listo;
  }
  cubrir(el, k, dir, alpha) {
    const x = this.x, W = 720, H = 1280;
    const iw = el.videoWidth || el.naturalWidth || W, ih = el.videoHeight || el.naturalHeight || H;
    const s = Math.max(W / iw, H / ih) * (1 + .1 * k);
    const w = iw * s, h = ih * s;
    const px = (W - w) / 2 + (dir % 2 ? 1 : -1) * 26 * (k - .5), py = (H - h) / 2 + (dir % 3 ? -1 : 1) * 30 * (k - .5);
    x.globalAlpha = alpha; x.drawImage(el, px, py, w, h); x.globalAlpha = 1;
  }
  seg(t) { let a = 0; for (let i = 0; i < this.segs.length; i++) { if (t < a + this.segs[i].dur) return [i, t - a]; a += this.segs[i].dur; } return [this.segs.length - 1, this.segs[this.segs.length - 1].dur]; }
  pintar(t) {
    const x = this.x, W = 720, H = 1280, [i, lt] = this.seg(t), s = this.segs[i], FUND = .6;
    x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, W, H);
    this.dibujar(s, i, lt / s.dur, 1);
    const sig = this.segs[i + 1];
    if (sig && lt > s.dur - FUND) { const k = (lt - (s.dur - FUND)) / FUND; this.dibujar(sig, i + 1, 0, k * k * (3 - 2 * k)); }
    this.barras.forEach((b, j) => { b.style.transform = `scaleX(${j < i ? 1 : j > i ? 0 : lt / s.dur})`; });
  }
  dibujar(s, i, k, alpha) {
    const x = this.x, W = 720, H = 1280;
    if (s.tipo === 'intro' || s.tipo === 'fin') {
      if (this.fondo) { x.save(); x.filter = 'blur(28px) brightness(.5)'; this.cubrir(this.fondo, s.tipo === 'fin' ? 1 - k : k, 1, alpha); x.restore(); }
      x.globalAlpha = alpha;
      const sube = (1 - Math.min(1, k * 2.2)) * 40;
      x.fillStyle = 'rgba(243,238,231,.7)'; x.font = '600 22px Inter'; x.textAlign = 'left';
      const d = this.info.dia, v = this.info.v;
      if (s.tipo === 'intro') {
        espaciado(x, (cap(diaSemana(d)) + ' ' + fecha(d).getUTCDate() + ' · ' + (v.ciudad || v.nombre)).toUpperCase(), 56, 780 + sube, 4);
        x.fillStyle = '#F3EEE7'; x.font = '200 112px Inter';
        this.info.titulo.split('\n').forEach((l, j) => x.fillText(l, 50, 900 + j * 112 + sube));
      } else {
        x.textAlign = 'center'; x.fillStyle = '#F3EEE7'; x.font = '200 150px Inter';
        x.fillText(String(fecha(d).getUTCDate()), W / 2, 600 + sube);
        x.font = '600 22px Inter'; x.fillStyle = 'rgba(243,238,231,.7)';
        espaciado(x, ('Día ' + (difDias(v.desde, d) + 1) + ' · ' + v.nombre).toUpperCase(), W / 2, 660 + sube, 4, true);
        const R = 46, cx = W / 2, cy = 840;
        [-150, -118, -90, -62, -30].forEach((a, j) => { const px = cx + R * Math.cos(a * Math.PI / 180), py = cy + R * Math.sin(a * Math.PI / 180); x.beginPath(); x.arc(px, py, j === 3 ? 7 : 5.5, 0, Math.PI * 2); x.fillStyle = j === 3 ? this.acento : 'rgba(243,238,231,.85)'; if (j === 3) { x.shadowColor = this.acento; x.shadowBlur = 24; } x.fill(); x.shadowBlur = 0; });
        x.font = '300 34px Inter'; x.fillStyle = '#F3EEE7'; x.fillText('orbeo', W / 2, 950);
      }
      x.globalAlpha = 1; x.textAlign = 'left';
      return;
    }
    if (s.el) {
      if (s.tipo === 'video') { if (alpha > .05 && s.el.paused && this.corre) { try { s.el.currentTime = 0; s.el.play(); } catch (e) { } } }
      this.cubrir(s.el, k, i, alpha);
      const g = x.createLinearGradient(0, H * .62, 0, H);
      g.addColorStop(0, 'rgba(8,8,9,0)'); g.addColorStop(1, 'rgba(8,8,9,.75)');
      x.globalAlpha = alpha; x.fillStyle = g; x.fillRect(0, H * .6, W, H * .4);
      if (s.c.parada) {
        const sube = (1 - Math.min(1, k * 3)) * 24;
        x.fillStyle = 'rgba(243,238,231,.7)'; x.font = '600 20px Inter';
        espaciado(x, (s.c.parada.hora || '').toUpperCase(), 50, H - 170 + sube, 4);
        x.fillStyle = '#F3EEE7'; x.font = '250 56px Inter';
        x.fillText(s.c.parada.nombre, 50, H - 110 + sube);
      }
      x.globalAlpha = 1;
    }
  }
}
function espaciado(x, txt, px, py, esp, centrar) {
  if (centrar) { let w = 0; for (const c of txt) w += x.measureText(c).width + esp; px -= w / 2; }
  for (const c of txt) { x.fillText(c, px, py); px += x.measureText(c).width + esp; }
}

/* Música suave hecha en el móvil: acordes largos con un arpegio encima. Nada de archivos. */
const Musica = {
  iniciar(total, grabar) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = new AC(), out = ac.createGain(), filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 2400; filtro.connect(out);
    out.gain.setValueAtTime(0, ac.currentTime); out.gain.linearRampToValueAtTime(.5, ac.currentTime + 1.2);
    out.gain.setValueAtTime(.5, ac.currentTime + Math.max(1.3, total - 1.6)); out.gain.linearRampToValueAtTime(0, ac.currentTime + total);
    out.connect(ac.destination);
    let dest = null; if (grabar && ac.createMediaStreamDestination) { dest = ac.createMediaStreamDestination(); out.connect(dest); }
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    const acordes = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]];
    const t0 = ac.currentTime + .05, compas = 2.4;
    for (let c = 0; c * compas < total; c++) {
      const ac4 = acordes[c % 4], tc = t0 + c * compas;
      ac4.forEach(n => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = (Math.random() - .5) * 8;
        g.gain.setValueAtTime(0, tc); g.gain.linearRampToValueAtTime(.06, tc + .8); g.gain.linearRampToValueAtTime(0, tc + compas + .6);
        o.connect(g); g.connect(filtro); o.start(tc); o.stop(tc + compas + .7);
      });
      [0, 1, 2, 3, 2, 1].forEach((j, k) => {
        const tn = tc + k * compas / 6, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = hz(ac4[j] + 12);
        g.gain.setValueAtTime(0, tn); g.gain.linearRampToValueAtTime(.05, tn + .02); g.gain.exponentialRampToValueAtTime(.0005, tn + .9);
        o.connect(g); g.connect(filtro); o.start(tn); o.stop(tn + 1);
      });
    }
    return { stream: dest && dest.stream, parar: () => { try { ac.close(); } catch (e) { } }, pausa: () => ac.suspend(), seguir: () => ac.resume() };
  }
};
