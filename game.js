/* ============================================================================
   CATZLE · Un puzle de gatitos con pestañas
   Canvas 2D + JavaScript ES6+ · Sin dependencias · Móvil vertical / escritorio
   ----------------------------------------------------------------------------
   Regalo de Navidad para Sagrario.
   ----------------------------------------------------------------------------
   Estructura:
     1. Configuración (fotos, niveles, ajustes)
     2. Utilidades y estado
     3. Ilustración de gatitos (fallback dibujado)
     4. Carga y reparto de fotos
     5. Geometría del puzle (pestañas y huecos)
     6. Construcción del nivel y layout
     7. Render
     8. Entrada (pointer events)
     9. Estados y UI
    10. Bucle principal
   ========================================================================== */

(() => {
  'use strict';

  /* ======================================================================== *
   *  1 · CONFIGURACIÓN                                                       *
   * ------------------------------------------------------------------------ */

  /* Fotos de gatitos. Con un servidor local, el juego lee automáticamente
     los archivos de assets/cats/ para saber cuántos niveles hay.
     CAT_PHOTOS es la lista de respaldo para cuando el navegador no puede
     listar la carpeta (por ejemplo, abriendo index.html con file://). */
  const PHOTO_DIR = 'assets/cats/';
  const PHOTO_MANIFEST = `${PHOTO_DIR}photos.json`;
  const PHOTO_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

  const CAT_PHOTOS = [
    'assets/cats/bmo-1.jpg',
    'assets/cats/bmo-2.jpg',
    'assets/cats/tina-1 (1).jpg',
    'assets/cats/tina-2.jpg',
    'assets/cats/tina-3.jpg',
  ];

  /* Niveles base, de fácil a difícil. El juego usa tantos niveles como fotos
     haya en la carpeta: para menos fotos elige una progresión de esta lista
     (manteniendo el 5×5 como final) y para más fotos añade niveles extra. */
  const LEVELS_CONFIG = [
    { name: 'Primer ronroneo', rows: 2, cols: 2, snap: 0.46, guide: 0.42, clear: '¡Qué bien encaja todo!' },
    { name: 'Siestecita',      rows: 2, cols: 3, snap: 0.42, guide: 0.38, clear: 'Un ronroneo de satisfacción' },
    { name: 'Bigotes',         rows: 3, cols: 3, snap: 0.38, guide: 0.34, clear: 'Bigotes en su sitio' },
    { name: 'Ovillo de lana',  rows: 3, cols: 4, snap: 0.35, guide: 0.31, clear: 'Otra siesta completada' },
    { name: 'Salto de tejado', rows: 4, cols: 4, snap: 0.32, guide: 0.28, clear: 'Casi en el tejado' },
    { name: 'Reina de la casa',rows: 5, cols: 5, snap: 0.30, guide: 0.25, clear: 'La reina está en casa' },
  ];
  const LEVEL_LADDER = LEVELS_CONFIG.map((cfg) => ({ ...cfg }));

  const EXTRA_LEVELS = [
    { name: 'Tejado infinito',  rows: 5, cols: 6, snap: 0.29, guide: 0.23 },
    { name: 'Siesta compartida',rows: 6, cols: 6, snap: 0.28, guide: 0.21 },
    { name: 'La gran casa',     rows: 6, cols: 7, snap: 0.27, guide: 0.20 },
    { name: 'Reino gatuno',     rows: 7, cols: 7, snap: 0.26, guide: 0.18 },
  ];

  const CLEAR_LINES = [
    '¡Qué bien encaja todo!',
    'Un ronroneo de satisfacción',
    'Bigotes en su sitio',
    'Otra siesta completada',
    'Casi en el tejado',
    'La reina está en casa',
  ];

  const TUNING = {
    maxDPR: 3,
    pieceDPR: 2.5,
    stageMax: 540,
    maxBoard: 438,
    minBoard: 140,
    boardHeightRatio: 0.54,
    pieceOverscan: 0.26,
    snapAnim: 0.20,
    snapMin: 17,
    snapMax: 58,
    liftTouch: 0.058,
    liftMouse: 7,
    dragScale: 1.055,
    clearDelay: 0.72,
    victoryDelay: 1.15,
  };

  const COLORS = {
    sparkle: ['#d9a441', '#c9705f', '#9db096', '#fff4e2', '#e8b17a'],
    ring: 'rgba(217, 164, 65,',
  };

  const TAU = Math.PI * 2;

  /* ======================================================================== *
   *  2 · UTILIDADES Y ESTADO                                                 *
   * ------------------------------------------------------------------------ */

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const clampAxis = (v, min, max) => (max < min ? (min + max) / 2 : clamp(v, min, max));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
  const randInt = (n) => Math.floor(Math.random() * n);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function roundedRect(c, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  const STATE = Object.freeze({
    START: 'START',
    PLAYING: 'PLAYING',
    LEVEL_CLEAR: 'LEVEL_CLEAR',
    VICTORY: 'VICTORY',
  });

  /* DOM */
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hud = $('hud');
  const hudLevel = $('hud-level');
  const hudName = $('hud-name');
  const progress = $('progress');
  const progressFill = $('progress-fill');
  const progressLabel = $('progress-label');
  const btnGuide = $('btn-guide');
  const btnTidy = $('btn-tidy');
  const btnSound = $('btn-sound');
  const overlay = $('overlay');
  const ovEyebrow = $('ov-eyebrow');
  const ovTitle = $('ov-title');
  const ovArt = $('ov-art');
  const ovText = $('ov-text');
  const ovNote = $('ov-note');
  const ovPrimary = $('ov-primary');
  const ovFoot = $('ov-foot');
  const sheet = $('sheet');
  const sheetEyebrow = $('sheet-eyebrow');
  const sheetTitle = $('sheet-title');
  const sheetMeta = $('sheet-meta');
  const sheetThumb = $('sheet-thumb');
  const sheetNext = $('sheet-next');
  const live = $('live');

  /* Estado global */
  let state = STATE.START;
  let dpr = 1;
  let view = { w: 1, h: 1 };
  let layout = null;
  let level = null;
  let run = null;
  let photoDeck = null;
  let photosReady = Promise.resolve();
  let drag = null;
  let zCounter = 10;
  let guideOn = true;
  let overlayMode = 'start';
  let starting = false;
  let startVariant = 0;
  let victoryVariant = 0;
  let lastTime = 0;
  let resizeTimer = 0;
  let sheetTimer = 0;
  let overlayTimer = 0;
  let boardFlash = 0;

  let bgCanvas = null;
  let ambient = [];
  let sparkles = [];
  let rings = [];

  const hitCtx = document.createElement('canvas').getContext('2d');
  const fallbackCache = new Map();

  /* ======================================================================== *
   *  2b · AUDIO PROCEDURAL (Web Audio API, sin archivos)                     *
   * ------------------------------------------------------------------------ */

  const AUDIO_KEY = 'catzle:sound-muted';
  const MASTER_LEVEL = 0.5;

  let muted = false;
  try {
    muted = localStorage.getItem(AUDIO_KEY) === '1';
  } catch (_) {
    /* almacenamiento no disponible */
  }

  const audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    reverbSend: null,
    noise: null,
    ready: false,
  };

  function syncSoundButton() {
    if (!btnSound) return;
    btnSound.classList.toggle('is-muted', muted);
    btnSound.setAttribute('aria-pressed', String(!muted));
    btnSound.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
    btnSound.title = muted ? 'Activar sonido (M)' : 'Silenciar sonido (M)';
  }

  function saveMuted() {
    try {
      localStorage.setItem(AUDIO_KEY, muted ? '1' : '0');
    } catch (_) {
      /* almacenamiento no disponible */
    }
  }

  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        const fadeIn = 1 - Math.exp(-i / (rate * 0.01));
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * fadeIn;
      }
    }
    return buffer;
  }

  function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return audio.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    let ctx;
    try {
      ctx = new AC();
    } catch (_) {
      return null;
    }

    const master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : MASTER_LEVEL;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 10500;
    lowpass.Q.value = 0.5;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 3.2;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.28;

    master.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.5, 2.4);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.32;
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.2;
    reverbSend.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.12;
    sfxBus.connect(sfxSend);
    sfxSend.connect(reverbSend);

    const musicBus = ctx.createGain();
    musicBus.gain.value = 1;
    musicBus.connect(master);
    musicBus.connect(reverbSend);

    const noiseLength = Math.floor(ctx.sampleRate * 0.12);
    const noise = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const noiseData = noise.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLength, 3);
    }

    audio.ctx = ctx;
    audio.master = master;
    audio.sfxBus = sfxBus;
    audio.musicBus = musicBus;
    audio.reverbSend = reverbSend;
    audio.noise = noise;
    audio.ready = true;

    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /* Se llama desde cualquier gesto real (pointerdown, click, tecla). */
  function unlockAudio() {
    const ctx = ensureAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setMuted(next, feedback) {
    const wasMuted = muted;
    muted = Boolean(next);
    saveMuted();
    syncSoundButton();

    if (audio.ctx) {
      const t = audio.ctx.currentTime;
      const g = audio.master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(muted ? 0.0001 : MASTER_LEVEL, t + 0.06);
    }

    if (!muted && feedback && wasMuted) {
      unlockAudio();
      setTimeout(() => playPick(0.05), 70);
    }
  }

  function soundOn() {
    return Boolean(audio.ctx) && !muted;
  }

  function audioNow() {
    return audio.ctx ? audio.ctx.currentTime : 0;
  }

  /* Campanilla cálida con parciales suaves. */
  function playBell(freq, when, dur, level, opts = {}) {
    if (!soundOn()) return;
    const ctx = audio.ctx;
    const t = Math.max(when, audioNow() + 0.002);
    const out = ctx.createGain();
    out.connect(opts.music ? audio.musicBus : audio.sfxBus);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0003, level), t + (opts.attack || 0.008));
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const partials = opts.partials || [
      { m: 1, g: 1, type: 'sine' },
      { m: 2.005, g: 0.18, type: 'sine' },
      { m: 3.01, g: 0.05, type: 'triangle' },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.m, t);
      osc.detune.value = (Math.random() * 2 - 1) * 3;
      const g = ctx.createGain();
      g.gain.value = p.g;
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.04);
    }
  }

  /* Un chasquido muy corto para el "clic" de encajar. */
  function playClick(when, level) {
    if (!soundOn() || !audio.noise) return;
    const ctx = audio.ctx;
    const t = Math.max(when, audioNow() + 0.002);
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1700 + Math.random() * 700;
    band.Q.value = 1.05;
    const out = ctx.createGain();
    out.gain.setValueAtTime(Math.max(0.0002, level), t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    src.connect(band);
    band.connect(out);
    out.connect(audio.sfxBus);
    src.start(t);
    src.stop(t + 0.06);
  }

  function playPad(freqs, when, dur, level) {
    if (!soundOn()) return;
    const ctx = audio.ctx;
    const t = Math.max(when, audioNow() + 0.002);
    const out = ctx.createGain();
    out.connect(audio.musicBus);
    const attack = Math.min(0.5, dur * 0.28);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + attack);
    out.gain.setValueAtTime(level, t + dur * 0.62);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 680;
    lowpass.Q.value = 0.4;
    lowpass.connect(out);

    for (const freq of freqs) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.5 / freqs.length;
        osc.connect(g);
        g.connect(lowpass);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }

  /* Burbuja suave al coger una pieza. */
  function playPick(level = 0.065) {
    if (!soundOn()) return;
    const ctx = audio.ctx;
    const t = audioNow() + 0.004;
    const base = 520 + Math.random() * 90;
    const out = ctx.createGain();
    out.connect(audio.sfxBus);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.55, t + 0.07);
    osc.connect(out);
    osc.start(t);
    osc.stop(t + 0.19);

    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(base * 2.02, t);
    shimmer.frequency.exponentialRampToValueAtTime(base * 2.42, t + 0.06);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(level * 0.22, t + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    shimmer.connect(sg);
    sg.connect(audio.sfxBus);
    shimmer.start(t);
    shimmer.stop(t + 0.13);
  }

  /* Golpecito casi imperceptible al soltar sin encajar. */
  function playDrop() {
    if (!soundOn()) return;
    const ctx = audio.ctx;
    const t = audioNow() + 0.003;
    const out = ctx.createGain();
    out.connect(audio.sfxBus);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.022, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(115, t + 0.09);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 600;
    osc.connect(lowpass);
    lowpass.connect(out);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /* Al encajar: nota pentatónica que sube suavemente con el progreso. */
  function playSnap(placed, total) {
    if (!soundOn()) return;
    const progress = total > 1 ? clamp((placed - 1) / (total - 1), 0, 1) : 0;
    const scale = [0, 2, 4, 7, 9, 12];
    const index = Math.min(scale.length - 1, Math.floor(progress * scale.length));
    const freq = 523.25 * Math.pow(2, scale[index] / 12);
    const t = audioNow() + 0.004;
    playBell(freq, t, 0.55, 0.072, { attack: 0.006 });
    playClick(t, 0.04);
  }

  function startMusic() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const g = audio.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
  }

  function fadeMusic(duration = 0.25) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const g = audio.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(0.0001, t + duration);
  }

  /* Acorde/arpegio dulce al cerrar un nivel. */
  function playLevelClear() {
    if (!soundOn()) return;
    startMusic();
    const t = audioNow() + 0.05;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      playBell(
        freq,
        t + i * 0.115,
        i === notes.length - 1 ? 1.15 : 0.85,
        0.064,
        { music: true }
      );
    });
    playPad([130.81, 196, 261.63], t, 2.8, 0.024);
  }

  /* Melodía de cascabeles muy suave para la pantalla final. */
  function playVictoryMelody() {
    if (!soundOn()) return;
    startMusic();
    const t = audioNow() + 0.06;
    const E5 = 659.25;
    const G5 = 783.99;
    const C5 = 523.25;
    const D5 = 587.33;
    const C6 = 1046.5;
    const melody = [
      [E5, 0.0], [E5, 0.28], [E5, 0.56],
      [E5, 0.84], [E5, 1.12], [E5, 1.4],
      [E5, 1.68], [G5, 1.96], [C5, 2.24], [D5, 2.52], [E5, 2.8],
      [C5, 3.35], [E5, 3.63], [G5, 3.91], [C6, 4.19],
    ];
    melody.forEach(([freq, offset], i) => {
      const last = i === melody.length - 1;
      playBell(freq, t + offset, last ? 1.6 : 0.8, 0.055, { music: true });
      if (last) playBell(freq * 2, t + offset, 1.4, 0.018, { music: true });
    });
    playPad([130.81, 196, 261.63], t, 5.4, 0.022);
    playPad([261.63, 329.63, 392], t + 3.35, 2.3, 0.016);
  }

  function handleKeydown(e) {
    unlockAudio();
    if (e.repeat || !e.key) return;
    if (e.key.toLowerCase() !== 'm') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
    setMuted(!muted, muted);
  }

  /* ======================================================================== *
   *  3 · ILUSTRACIÓN DE GATITOS                                              *
   * ------------------------------------------------------------------------ */

  const CAT_PALETTES = [
    {
      bg1: '#f7e5d1', bg2: '#edc3a6', fur: '#dfa067', furDark: '#b97b45', furLight: '#f3d3ad',
      cream: '#fff5e5', inner: '#e49a90', nose: '#d47d72', eye: '#3d2c24',
      scarf: '#7f9b7a', scarfDark: '#637d5f', accent: '#cf9f4b',
    },
    {
      bg1: '#e5ede4', bg2: '#c9dccd', fur: '#aaa8a2', furDark: '#7e7c76', furLight: '#d6d2c9',
      cream: '#f8f3e8', inner: '#d8a49e', nose: '#c98077', eye: '#3b3a36',
      scarf: '#c0705e', scarfDark: '#9e5546', accent: '#c9a24b',
    },
    {
      bg1: '#f4e6d7', bg2: '#e4cdb7', fur: '#efd4b4', furDark: '#c9a77e', furLight: '#f9e8d2',
      cream: '#fffaf0', inner: '#e0a49c', nose: '#cf8178', eye: '#46352b',
      scarf: '#b45d50', scarfDark: '#8f4539', accent: '#c9a24b',
    },
    {
      bg1: '#f6dfd0', bg2: '#eabfa6', fur: '#4f4b49', furDark: '#34312f', furLight: '#6e6964',
      cream: '#fbf4e8', inner: '#cf9a92', nose: '#d18a80', eye: '#2b2522',
      scarf: '#d9a441', scarfDark: '#b5852d', accent: '#b45d50',
    },
    {
      bg1: '#ebe5d8', bg2: '#d3d9c6', fur: '#8d6a50', furDark: '#6a4c38', furLight: '#b1896a',
      cream: '#f9ecdb', inner: '#cf9e92', nose: '#c67d70', eye: '#33261f',
      scarf: '#a7584c', scarfDark: '#834136', accent: '#cf9f4b',
    },
    {
      bg1: '#ecdfe9', bg2: '#d7c0d1', fur: '#e3c6b0', furDark: '#b98d74', furLight: '#f6e0cd',
      cream: '#fff8ee', inner: '#dfa49c', nose: '#c9776e', eye: '#443229',
      scarf: '#6f8a6c', scarfDark: '#566f53', accent: '#c99a45',
    },
  ];

  function sparkleShape(c, x, y, r, rot = 0) {
    c.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = rot + (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r : r * 0.32;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }

  function heartShape(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.72);
    c.bezierCurveTo(x - s * 1.25, y - s * 0.1, x - s * 0.55, y - s * 0.95, x, y - s * 0.35);
    c.bezierCurveTo(x + s * 0.55, y - s * 0.95, x + s * 1.25, y - s * 0.1, x, y + s * 0.72);
    c.closePath();
  }

  function drawCatArt(c, size, opts = {}) {
    const variant = Math.abs((opts.variant | 0) % CAT_PALETTES.length);
    const P = CAT_PALETTES[variant];
    const rnd = mulberry32(9173 + (opts.variant | 0) * 131 + (opts.seed | 0));
    const k = size / 100;

    c.save();
    c.clearRect(0, 0, size, size);
    c.scale(k, k);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    /* Fondo */
    const bg = c.createLinearGradient(0, 0, 0, 100);
    bg.addColorStop(0, P.bg1);
    bg.addColorStop(1, P.bg2);
    c.fillStyle = bg;
    c.fillRect(0, 0, 100, 100);

    const halo = c.createRadialGradient(50, 42, 3, 50, 52, 58);
    halo.addColorStop(0, 'rgba(255,249,238,0.78)');
    halo.addColorStop(0.55, 'rgba(255,249,238,0.28)');
    halo.addColorStop(1, 'rgba(255,249,238,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, 100, 100);

    for (let i = 0; i < 10; i += 1) {
      const bx = 5 + rnd() * 90;
      const by = 4 + rnd() * 58;
      const br = 1.8 + rnd() * 5.5;
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.20)' : 'rgba(255,235,210,0.24)';
      c.beginPath();
      c.arc(bx, by, br, 0, TAU);
      c.fill();
    }

    if (opts.garland) {
      c.strokeStyle = 'rgba(98,66,46,0.34)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(4, 6);
      c.quadraticCurveTo(50, 17, 96, 6);
      c.stroke();
      const bulbColors = ['#c9705f', '#d9a441', '#7f9b7a', '#c9705f', '#d9a441'];
      for (let i = 0; i < 5; i += 1) {
        const t = (i + 0.5) / 5;
        const bx = 4 + t * 92;
        const by = 6 + Math.sin(t * Math.PI) * 9.2;
        c.fillStyle = 'rgba(255,244,220,0.5)';
        c.beginPath();
        c.arc(bx, by + 0.6, 2.6, 0, TAU);
        c.fill();
        c.fillStyle = bulbColors[i];
        c.beginPath();
        c.arc(bx, by, 1.65, 0, TAU);
        c.fill();
      }
    }

    /* Sombra en el suelo */
    c.fillStyle = 'rgba(92,58,40,0.13)';
    c.beginPath();
    c.ellipse(50, 95.5, 33, 7, 0, 0, TAU);
    c.fill();

    /* Cola */
    c.strokeStyle = P.fur;
    c.lineWidth = 8.4;
    c.beginPath();
    c.moveTo(29, 90);
    c.bezierCurveTo(12, 92, 6, 75, 15, 67);
    c.stroke();
    c.strokeStyle = P.furDark;
    c.globalAlpha = 0.34;
    c.lineWidth = 2.1;
    c.beginPath();
    c.moveTo(10.5, 81.5);
    c.lineTo(18.5, 80.5);
    c.moveTo(12.5, 75.5);
    c.lineTo(19.5, 74.2);
    c.stroke();
    c.globalAlpha = 1;

    /* Cuerpo */
    c.fillStyle = P.fur;
    c.beginPath();
    c.ellipse(50, 79, 23.5, 21.5, 0, 0, TAU);
    c.fill();

    /* Pecho */
    c.fillStyle = P.cream;
    c.beginPath();
    c.ellipse(50, 84.5, 11.6, 15, 0, 0, TAU);
    c.fill();

    /* Orejas */
    function ear(sign) {
      c.fillStyle = P.fur;
      c.strokeStyle = P.fur;
      c.lineWidth = 3.6;
      c.beginPath();
      c.moveTo(50 + sign * 21, 35);
      c.lineTo(50 + sign * 25, 14);
      c.lineTo(50 + sign * 6, 27);
      c.closePath();
      c.stroke();
      c.fill();
      c.fillStyle = P.inner;
      c.globalAlpha = 0.88;
      c.beginPath();
      c.moveTo(50 + sign * 19, 31.5);
      c.lineTo(50 + sign * 21.6, 20);
      c.lineTo(50 + sign * 9.6, 27.2);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
    }
    ear(-1);
    ear(1);

    /* Cabeza */
    c.fillStyle = P.fur;
    c.beginPath();
    c.ellipse(50, 45, 25, 21.5, 0, 0, TAU);
    c.fill();

    /* Muzzle */
    c.fillStyle = P.cream;
    c.beginPath();
    c.ellipse(50, 58.2, 12.3, 8, 0, 0, TAU);
    c.fill();

    /* Rayas de la frente */
    c.strokeStyle = P.furDark;
    c.globalAlpha = 0.5;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(44.5, 32.5);
    c.quadraticCurveTo(45.6, 35.4, 46, 38.2);
    c.moveTo(50, 31.2);
    c.quadraticCurveTo(50.4, 34.2, 50.4, 37.4);
    c.moveTo(55.5, 32.5);
    c.quadraticCurveTo(54.4, 35.4, 54, 38.2);
    c.stroke();
    c.globalAlpha = 1;

    /* Ojos */
    const eyeStyle = opts.closedEyes ? 'closed' : 'open';
    for (const ex of [40, 60]) {
      if (eyeStyle === 'closed') {
        c.strokeStyle = P.eye;
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(ex, 45.2, 4.8, Math.PI * 0.14, Math.PI * 0.86);
        c.stroke();
      } else {
        c.fillStyle = P.eye;
        c.beginPath();
        c.ellipse(ex, 45.2, 4.15, 5.15, 0, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(255,250,240,0.92)';
        c.beginPath();
        c.arc(ex - 1.35, 43.1, 1.35, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(255,250,240,0.62)';
        c.beginPath();
        c.arc(ex + 1.4, 47.2, 0.7, 0, TAU);
        c.fill();
      }
    }

    /* Nariz */
    c.fillStyle = P.nose;
    c.beginPath();
    c.moveTo(47.7, 54.9);
    c.quadraticCurveTo(50, 53.8, 52.3, 54.9);
    c.quadraticCurveTo(51.4, 57.6, 50, 58.3);
    c.quadraticCurveTo(48.6, 57.6, 47.7, 54.9);
    c.closePath();
    c.fill();

    /* Boquita */
    c.strokeStyle = 'rgba(72,48,34,0.66)';
    c.lineWidth = 0.85;
    c.beginPath();
    c.moveTo(50, 58.5);
    c.lineTo(50, 60.2);
    c.moveTo(50, 60.2);
    c.quadraticCurveTo(47.4, 63, 45.6, 60.8);
    c.moveTo(50, 60.2);
    c.quadraticCurveTo(52.6, 63, 54.4, 60.8);
    c.stroke();

    /* Bigotes */
    c.strokeStyle = P.furDark;
    c.globalAlpha = 0.42;
    c.lineWidth = 0.72;
    for (const side of [-1, 1]) {
      const sx = 50 + side * 8;
      for (let i = 0; i < 3; i += 1) {
        const sy = 56.4 + i * 2.5;
        c.beginPath();
        c.moveTo(sx, sy);
        c.quadraticCurveTo(50 + side * 17, sy - 1.2, 50 + side * 25, sy - 2.4 + i * 1.4);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    /* Bufanda */
    if (opts.scarf !== false) {
      c.fillStyle = P.scarf;
      roundedRect(c, 30.5, 65.3, 39, 8.4, 4.2);
      c.fill();
      c.fillStyle = P.scarfDark;
      c.globalAlpha = 0.55;
      c.fillRect(31.5, 71.4, 37, 1.2);
      c.globalAlpha = 1;
      c.fillStyle = P.scarf;
      c.beginPath();
      c.moveTo(60.5, 70.5);
      c.quadraticCurveTo(67, 76, 65.2, 87.5);
      c.quadraticCurveTo(63.2, 90.2, 59.8, 88.6);
      c.quadraticCurveTo(60.2, 78, 56.5, 72.6);
      c.closePath();
      c.fill();
      c.strokeStyle = P.scarfDark;
      c.globalAlpha = 0.6;
      c.lineWidth = 1.1;
      for (let i = 0; i < 3; i += 1) {
        c.beginPath();
        c.moveTo(60.4 + i * 1.6, 86.5);
        c.lineTo(60.9 + i * 1.6, 90.1);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = P.accent;
      c.beginPath();
      c.arc(50, 69.6, 2.5, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,250,240,0.55)';
      c.beginPath();
      c.arc(49.2, 68.8, 0.75, 0, TAU);
      c.fill();
    }

    /* Patitas */
    for (const px of [39.5, 60.5]) {
      c.fillStyle = P.cream;
      c.beginPath();
      c.ellipse(px, 92.8, 6.6, 4.8, 0, 0, TAU);
      c.fill();
      c.strokeStyle = P.furDark;
      c.globalAlpha = 0.24;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(px - 1.9, 92.4);
      c.lineTo(px - 1.9, 95.4);
      c.moveTo(px + 1.9, 92.4);
      c.lineTo(px + 1.9, 95.4);
      c.stroke();
      c.globalAlpha = 1;
    }

    /* Gorro de Papá Noel */
    if (opts.hat) {
      c.save();
      c.translate(50, 30);
      c.rotate(-0.055);
      c.translate(-50, -30);

      c.fillStyle = '#c75a4d';
      c.beginPath();
      c.moveTo(29.5, 31);
      c.bezierCurveTo(31, 16, 47, 4.5, 63, 7.5);
      c.bezierCurveTo(67.5, 13.5, 70.5, 24, 70.5, 31.5);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(120,45,38,0.28)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(35.5, 28);
      c.bezierCurveTo(37, 18, 48, 9.5, 60, 10);
      c.stroke();

      c.fillStyle = '#fff7ee';
      roundedRect(c, 27, 28.6, 46.5, 9.2, 4.6);
      c.fill();

      c.fillStyle = '#fff7ee';
      c.beginPath();
      c.arc(64.5, 7.6, 5.2, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.arc(63, 6, 1.7, 0, TAU);
      c.fill();
      c.restore();
    }

    /* Nieve y corazones */
    if (opts.snow) {
      for (let i = 0; i < 16; i += 1) {
        const sx = rnd() * 100;
        const sy = rnd() * 88;
        c.fillStyle = `rgba(255,250,240,${0.28 + rnd() * 0.45})`;
        c.beginPath();
        c.arc(sx, sy, 0.7 + rnd() * 1.35, 0, TAU);
        c.fill();
      }
    }

    if (opts.hearts) {
      c.fillStyle = 'rgba(201,112,95,0.55)';
      heartShape(c, 82, 25, 3.1);
      c.fill();
      c.fillStyle = 'rgba(217,164,65,0.5)';
      heartShape(c, 17.5, 24, 2.4);
      c.fill();
    }

    c.restore();
  }

  function fallbackFor(index) {
    const key = index | 0;
    if (!fallbackCache.has(key)) {
      const cv = document.createElement('canvas');
      cv.width = 800;
      cv.height = 800;
      drawCatArt(cv.getContext('2d'), 800, {
        variant: key,
        seed: key * 37,
        scarf: true,
        hearts: key % 2 === 0,
      });
      fallbackCache.set(key, cv);
    }
    return fallbackCache.get(key);
  }

  /* ======================================================================== *
   *  4 · FOTOS                                                               *
   * ------------------------------------------------------------------------ */

  /* Cada foto se hornea una sola vez a un cuadrado de 1000 px (recorte
     central). Así no guardamos en memoria las fotos originales a tamaño
     completo y el puzle siempre usa una imagen ya preparada. */
  const PHOTO_MASTER_SIZE = 1000;

  function buildPhotoMaster(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) throw new Error('Imagen vacía');
    const side = Math.min(iw, ih);
    const cv = document.createElement('canvas');
    cv.width = PHOTO_MASTER_SIZE;
    cv.height = PHOTO_MASTER_SIZE;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(
      img,
      (iw - side) / 2,
      (ih - side) / 2,
      side,
      side,
      0,
      0,
      PHOTO_MASTER_SIZE,
      PHOTO_MASTER_SIZE
    );
    return cv;
  }

  class PhotoDeck {
    constructor(paths) {
      this.entries = paths.map((src, index) => ({
        src,
        index,
        img: null,
        ready: false,
        failed: false,
      }));
      this.bag = [];
      this.last = null;
      this.started = false;
      this.pending = this.entries.length;
      this.waiters = [];
      this.onChange = null;
    }

    preload() {
      if (this.started) return;
      this.started = true;
      if (!this.entries.length) {
        this.pending = 0;
        this.flush();
        return;
      }
      this.entries.forEach((entry) => {
        const img = new Image();
        img.decoding = 'async';
        entry.img = img;
        img.onload = () => {
          try {
            entry.master = buildPhotoMaster(img);
            entry.ready = true;
          } catch (_) {
            entry.failed = true;
          }
          entry.img = null;
          img.onload = null;
          img.onerror = null;
          img.src = '';
          this.settleOne();
        };
        img.onerror = () => {
          entry.failed = true;
          entry.img = null;
          this.settleOne();
        };
        img.src = entry.src;
      });
    }

    settleOne() {
      this.pending = Math.max(0, this.pending - 1);
      if (this.pending === 0) this.flush();
      if (typeof this.onChange === 'function') this.onChange();
    }

    flush() {
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((fn) => fn());
    }

    settled(timeout = 1200) {
      if (this.pending === 0) return Promise.resolve();
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        if (timeout > 0) setTimeout(finish, timeout);
        this.waiters.push(finish);
      });
    }

    get readyCount() {
      return this.entries.reduce((n, e) => n + (e.ready ? 1 : 0), 0);
    }

    reset() {
      this.bag = [];
    }

    next() {
      if (!this.bag.length) {
        const settledEntries = this.entries.filter((e) => e.ready || e.failed);
        const pool = settledEntries.length ? settledEntries : this.entries;
        this.bag = shuffleInPlace(pool.slice());
        if (this.bag.length > 1 && this.bag[0] === this.last) {
          const j = 1 + Math.floor(Math.random() * (this.bag.length - 1));
          [this.bag[0], this.bag[j]] = [this.bag[j], this.bag[0]];
        }
      }
      const entry = this.bag.shift();
      this.last = entry || null;
      return (
        entry || { src: '', index: 0, ready: false, failed: true, img: null }
      );
    }
  }

  /* ---------------------------------------------------------------------- *
   *  Niveles según las fotos disponibles + descubrimiento de la carpeta      *
   * ---------------------------------------------------------------------- */

  const LEVEL_PICKS = {
    1: [0],
    2: [0, 2],
    3: [0, 2, 4],
    4: [0, 2, 4, 5],
    5: [0, 2, 3, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  };

  function buildLevelsForCount(count) {
    const n = Math.max(1, count | 0);
    LEVELS_CONFIG.length = 0;

    if (n <= 6) {
      const picks = LEVEL_PICKS[n] || [0];
      for (const i of picks) LEVELS_CONFIG.push(LEVEL_LADDER[i]);
      return;
    }

    for (const cfg of LEVEL_LADDER) LEVELS_CONFIG.push(cfg);
    for (let i = 6; i < n; i += 1) {
      const step = i - 6;
      const base = EXTRA_LEVELS[Math.min(step, EXTRA_LEVELS.length - 1)];
      LEVELS_CONFIG.push(
        step < EXTRA_LEVELS.length ? base : { ...base, name: `Nivel ${i + 1}` }
      );
    }
  }

  async function fetchText(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.text();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function photosFromListing(html) {
    /* Evita confundir una página SPA de respaldo con un listado real. */
    if (!/directory listing|index of/i.test(html)) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const names = [];
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      let href = (anchor.getAttribute('href') || '').split('?')[0].split('#')[0];
      try {
        href = decodeURIComponent(href);
      } catch (_) {
        /* se queda con el href tal cual */
      }
      if (!PHOTO_EXT.test(href)) return;
      if (href.includes('/') || href.includes('\\') || href.startsWith('.')) return;
      if (!names.includes(href)) names.push(href);
    });
    return names.map((name) => PHOTO_DIR + name);
  }

  async function discoverPhotos() {
    /* 1. Listado real de la carpeta (funciona con python -m http.server). */
    const html = await fetchText(PHOTO_DIR, 900);
    if (html) {
      const found = photosFromListing(html);
      if (found.length) return found;
    }

    /* 2. Manifiesto para sitios estáticos sin listado de directorios. */
    const manifest = await fetchText(PHOTO_MANIFEST, 800);
    if (manifest) {
      try {
        const data = JSON.parse(manifest);
        if (Array.isArray(data)) {
          const found = data
            .map((item) => (typeof item === 'string' ? item : item && item.file))
            .filter((name) => typeof name === 'string' && name.trim())
            .filter((name) => PHOTO_EXT.test(name))
            .map((name) => {
              const clean = name.trim();
              if (
                /^(https?:)?\/\//i.test(clean) ||
                clean.startsWith('assets/') ||
                clean.startsWith(PHOTO_DIR)
              ) {
                return clean;
              }
              return PHOTO_DIR + clean;
            })
            .filter((name, i, arr) => arr.indexOf(name) === i);
          if (found.length) return found;
        }
      } catch (_) {
        /* manifiesto inválido: se usa el respaldo */
      }
    }

    /* 3. Respaldo configurable (file://, servidores sin listado...). */
    return CAT_PHOTOS.slice();
  }

  async function preparePhotos() {
    let paths = CAT_PHOTOS.slice();
    try {
      const found = await discoverPhotos();
      if (found.length) paths = found;
    } catch (_) {
      /* se usa CAT_PHOTOS */
    }
    if (!paths.length) paths = CAT_PHOTOS.slice();

    photoDeck = new PhotoDeck(paths);
    photoDeck.onChange = updateStartNote;
    buildLevelsForCount(paths.length);
    photoDeck.preload();
    photoDeck.settled(1600).then(updateStartNote);
    updateStartNote();
    return paths;
  }

  function makePhotoCrop(entry) {
    const index = entry ? entry.index : 0;
    const master =
      entry && entry.ready && entry.master ? entry.master : fallbackFor(index);
    return {
      canvas: master,
      size: master.width || 800,
      source: master,
    };
  }

  /* ======================================================================== *
   *  5 · GEOMETRÍA DEL PUZLE                                                 *
   * ------------------------------------------------------------------------ */

  /* Una arista con pestaña, en coordenadas normalizadas:
     u: 0..1 a lo largo de la arista, v: hacia fuera de la pieza canónica.
     La misma arista se recorre en sentido inverso por la pieza vecina:
     sólo se invierte u (1-u), no v, de modo que ambas piezas comparten
     exactamente la misma frontera y el hueco encaja a la perfección. */
  function makeEdgeShape(rng) {
    const dir = rng() < 0.5 ? 1 : -1;
    const c = 0.5 + (rng() - 0.5) * 0.022;
    const hh = 0.183 + (rng() - 0.5) * 0.016;
    const headW = 0.111 + (rng() - 0.5) * 0.011;
    const neckW = 0.051 + (rng() - 0.5) * 0.006;
    const spread = 0.139 + (rng() - 0.5) * 0.008;
    const v = hh / 0.183;

    return {
      dir,
      cmds: [
        { t: 'L', p: [c - spread, 0] },
        {
          t: 'C',
          c1: [c - spread + 0.027, 0],
          c2: [c - neckW + 0.009, 0.014 * v],
          p: [c - neckW, 0.056 * v],
        },
        {
          t: 'C',
          c1: [c - neckW - 0.002, 0.100 * v],
          c2: [c - headW + 0.007, 0.098 * v],
          p: [c - headW, 0.134 * v],
        },
        {
          t: 'C',
          c1: [c - headW - 0.002, 0.168 * v],
          c2: [c - 0.035, 0.183 * v],
          p: [c, 0.183 * v],
        },
        {
          t: 'C',
          c1: [c + 0.035, 0.183 * v],
          c2: [c + headW + 0.002, 0.168 * v],
          p: [c + headW, 0.134 * v],
        },
        {
          t: 'C',
          c1: [c + headW - 0.007, 0.098 * v],
          c2: [c + neckW + 0.002, 0.100 * v],
          p: [c + neckW, 0.056 * v],
        },
        {
          t: 'C',
          c1: [c + neckW - 0.009, 0.014 * v],
          c2: [c + spread - 0.027, 0],
          p: [c + spread, 0],
        },
        { t: 'L', p: [1, 0] },
      ],
    };
  }

  function traceEdge(path, shape, start, dir, normal, len, reversed) {
    const map = (u, v) => {
      const uu = reversed ? 1 - u : u;
      const vv = shape.dir * v;
      return [
        start.x + uu * len * dir.x + vv * len * normal.x,
        start.y + uu * len * dir.y + vv * len * normal.y,
      ];
    };
    for (const cmd of shape.cmds) {
      if (cmd.t === 'L') {
        const [x, y] = map(cmd.p[0], cmd.p[1]);
        path.lineTo(x, y);
      } else {
        const [c1x, c1y] = map(cmd.c1[0], cmd.c1[1]);
        const [c2x, c2y] = map(cmd.c2[0], cmd.c2[1]);
        const [x, y] = map(cmd.p[0], cmd.p[1]);
        path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
      }
    }
  }

  function buildPiecePath(r, c, rows, cols, pw, ph, edgesH, edgesV) {
    const path = new Path2D();
    path.moveTo(0, 0);

    /* Arriba: izquierda -> derecha */
    if (r === 0) {
      path.lineTo(pw, 0);
    } else {
      traceEdge(
        path,
        edgesH[r - 1][c],
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        pw,
        false
      );
    }

    /* Derecha: arriba -> abajo */
    if (c === cols - 1) {
      path.lineTo(pw, ph);
    } else {
      traceEdge(
        path,
        edgesV[r][c],
        { x: pw, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        ph,
        false
      );
    }

    /* Abajo: derecha -> izquierda (arista canónica al revés) */
    if (r === rows - 1) {
      path.lineTo(0, ph);
    } else {
      traceEdge(
        path,
        edgesH[r][c],
        { x: 0, y: ph },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        pw,
        true
      );
    }

    /* Izquierda: abajo -> arriba (arista canónica al revés) */
    if (c === 0) {
      path.lineTo(0, 0);
    } else {
      traceEdge(
        path,
        edgesV[r][c - 1],
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        ph,
        true
      );
    }

    path.closePath();
    return path;
  }

  /* ======================================================================== *
   *  6 · LAYOUT, CONSTRUCCIÓN DEL NIVEL Y FOTO                               *
   * ------------------------------------------------------------------------ */

  function readSafeInsets() {
    const probe = document.getElementById('safe-probe');
    if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(probe);
    const read = (name) => {
      const n = parseFloat(cs[name]);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      top: read('paddingTop'),
      right: read('paddingRight'),
      bottom: read('paddingBottom'),
      left: read('paddingLeft'),
    };
  }

  function computeLayout() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const safe = readSafeInsets();
    const stageW = Math.min(w, TUNING.stageMax);
    const side = Math.max(14, safe.left, safe.right) + 4;
    const hudBottom = hud.hidden
      ? safe.top + 12
      : hud.getBoundingClientRect().bottom || safe.top + 72;
    const topGap = hudBottom + 8;
    const bottomGap = Math.max(16, safe.bottom + 6);
    const availH = Math.max(200, h - topGap - bottomGap);
    const maxW = Math.max(TUNING.minBoard, Math.min(stageW - side * 2, TUNING.maxBoard));

    /* El tablero se ajusta para que la bandeja quede cómoda: el área de
       todas las piezas es board², y buscamos que ocupe ~72 % de la bandeja. */
    const trayW = Math.max(60, stageW - side * 2);
    const traySpaceH = Math.max(80, availH - 14);
    const k = 0.72 * trayW;
    const densityCap = (-k + Math.sqrt(k * k + 4 * k * traySpaceH)) / 2;

    let board = Math.min(maxW, availH * TUNING.boardHeightRatio, densityCap);
    board = Math.max(TUNING.minBoard, board);
    board = Math.min(board, maxW);

    const bx = (w - board) / 2;
    const by = topGap;
    const trayTop = by + board + 14;
    const trayBottom = h - bottomGap;
    const tray = {
      x: (w - stageW) / 2 + side,
      y: trayTop,
      w: Math.max(40, stageW - side * 2),
      h: Math.max(60, trayBottom - trayTop),
    };

    return {
      w,
      h,
      safe,
      stageW,
      stageX: (w - stageW) / 2,
      hudBottom,
      board: { x: bx, y: by, size: board },
      tray,
    };
  }

  function buildLevel(index, entry, opts = {}) {
    const cfg = LEVELS_CONFIG[index];
    const seed = opts.seed !== undefined ? opts.seed : randInt(0xffffffff);
    const placed = opts.placed || new Set();
    const rng = mulberry32(seed);
    const rows = cfg.rows;
    const cols = cfg.cols;
    const b = layout.board;
    const pw = b.size / cols;
    const ph = b.size / rows;
    const margin = Math.max(pw, ph) * TUNING.pieceOverscan + 8;
    const pd = Math.min(dpr, TUNING.pieceDPR);

    level = {
      index,
      cfg,
      seed,
      rows,
      cols,
      boardSize: b.size,
      bx: b.x,
      by: b.y,
      pw,
      ph,
      margin,
      pieces: [],
      placed: 0,
      total: rows * cols,
      complete: false,
      finishTimer: 0,
      finishedHandled: false,
      photoEntry: entry,
      photo: null,
      guide: null,
      startedAt: performance.now(),
      finishedAt: 0,
    };

    level.photo = makePhotoCrop(entry);

    const edgesH = [];
    for (let r = 0; r < rows - 1; r += 1) {
      edgesH[r] = [];
      for (let c = 0; c < cols; c += 1) edgesH[r][c] = makeEdgeShape(rng);
    }
    const edgesV = [];
    for (let r = 0; r < rows; r += 1) {
      edgesV[r] = [];
      for (let c = 0; c < cols - 1; c += 1) edgesV[r][c] = makeEdgeShape(rng);
    }

    const holders = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const path = buildPiecePath(r, c, rows, cols, pw, ph, edgesH, edgesV);
        const drawW = pw + margin * 2;
        const drawH = ph + margin * 2;

        const pieceCanvas = document.createElement('canvas');
        pieceCanvas.width = Math.max(1, Math.round(drawW * pd));
        pieceCanvas.height = Math.max(1, Math.round(drawH * pd));
        const g = pieceCanvas.getContext('2d');

        /* Sombra cálida + borde de la pieza, horneados */
        g.save();
        g.scale(pd, pd);
        g.translate(margin, margin);
        g.shadowColor = 'rgba(60, 38, 24, 0.26)';
        g.shadowBlur = 5.2 * pd;
        g.fillStyle = '#6b4b37';
        g.fill(path);
        g.restore();

        /* Imagen recortada */
        g.save();
        g.scale(pd, pd);
        g.translate(margin, margin);
        g.clip(path);
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(level.photo.canvas, -c * pw, -r * ph, b.size, b.size);
        g.strokeStyle = 'rgba(255, 248, 235, 0.13)';
        g.lineWidth = 1.5;
        g.stroke(path);
        g.restore();

        const homeX = b.x + c * pw;
        const homeY = b.y + r * ph;
        const key = `${r},${c}`;
        const isPlaced = placed.has(key);

        holders.push({
          r,
          c,
          path,
          canvas: pieceCanvas,
          margin,
          w: pw,
          h: ph,
          drawW,
          drawH,
          homeX,
          homeY,
          x: homeX,
          y: homeY,
          z: isPlaced ? -1 : (r * cols + c),
          locked: isPlaced,
          snapping: false,
          snapT: 0,
          snapFrom: { x: homeX, y: homeY },
          visualScale: 1,
          tween: null,
        });
      }
    }

    level.pieces = holders;
    shuffleInPlace(holders);
    holders.forEach((p) => {
      p.z = p.locked ? -1 : (zCounter += 1);
    });

    /* Colocar las libres en la bandeja */
    const free = level.pieces.filter((p) => !p.locked);
    const slots = makeScatterPositions(free.length);
    free.forEach((p, i) => {
      if (slots[i]) {
        p.x = slots[i].x;
        p.y = slots[i].y;
      }
    });

    level.placed = level.pieces.filter((p) => p.locked).length;
    buildGuideCache();
    return level;
  }

  function makeScatterPositions(count) {
    if (!count || !layout) return [];
    const t = layout.tray;
    const inset = 7;
    const availW = Math.max(24, t.w - inset * 2);
    const availH = Math.max(24, t.h - inset * 2);
    const levelPw = level ? level.pw : 80;
    const levelPh = level ? level.ph : 80;

    let cols = Math.max(
      1,
      Math.round(Math.sqrt(count * (availW / availH) * (levelPh / levelPw)))
    );
    cols = Math.min(cols, count);
    const rows = Math.max(1, Math.ceil(count / cols));
    const cw = availW / cols;
    const ch = availH / rows;
    const jx = Math.min(levelPw * 0.16, cw * 0.24);
    const jy = Math.min(levelPh * 0.16, ch * 0.24);
    const tabPad = Math.max(levelPw, levelPh) * 0.19 + 3;
    const safeBottom = layout && layout.safe ? layout.safe.bottom : 0;
    const maxY = Math.min(
      t.y + t.h - levelPh - 2,
      view.h - levelPh - 6 - safeBottom - tabPad
    );
    const slots = [];

    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, count - row * cols);
      const rowOffset = ((cols - inRow) * cw) / 2;
      const cx =
        t.x + inset + rowOffset + (col + 0.5) * cw + (Math.random() * 2 - 1) * jx;
      const cy = t.y + inset + (row + 0.5) * ch + (Math.random() * 2 - 1) * jy;
      let x = cx - levelPw / 2;
      let y = cy - levelPh / 2;
      x = clampAxis(x, t.x + 2, t.x + t.w - levelPw - 2);
      y = clampAxis(y, t.y + 2, maxY);
      slots.push({ x, y });
    }

    shuffleInPlace(slots);
    return slots;
  }

  function buildGuideCache() {
    if (!level) return;
    const S = level.boardSize;
    const mat = 9;
    const pad = 30;
    const total = S + (mat + pad) * 2;
    const scale = Math.min(dpr, 2.4);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(total * scale));
    cv.height = Math.max(1, Math.round(total * scale));
    const g = cv.getContext('2d');
    g.scale(scale, scale);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const ox = pad + mat;
    const oy = pad + mat;

    /* Marco de foto */
    g.save();
    g.shadowColor = 'rgba(74, 45, 28, 0.24)';
    g.shadowBlur = 16 * scale;
    g.shadowOffsetY = 6 * scale;
    g.fillStyle = '#fffcf6';
    roundedRect(g, ox - mat, oy - mat, S + mat * 2, S + mat * 2, 15);
    g.fill();
    g.restore();

    /* Foto-guía */
    g.save();
    roundedRect(g, ox, oy, S, S, 5);
    g.clip();
    g.fillStyle = '#efe4d4';
    g.fillRect(ox, oy, S, S);

    if (guideOn) {
      g.globalAlpha = level.cfg.guide;
      g.drawImage(level.photo.canvas, ox, oy, S, S);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255, 249, 238, 0.03)';
      g.fillRect(ox, oy, S, S);
    }

    g.strokeStyle = guideOn ? 'rgba(74, 52, 40, 0.11)' : 'rgba(74, 52, 40, 0.16)';
    g.lineWidth = 1;
    for (const p of level.pieces) {
      g.save();
      g.translate(ox + p.c * level.pw, oy + p.r * level.ph);
      g.stroke(p.path);
      g.restore();
    }
    g.restore();

    g.strokeStyle = 'rgba(120, 88, 62, 0.22)';
    g.lineWidth = 1;
    roundedRect(g, ox, oy, S, S, 5);
    g.stroke();

    g.strokeStyle = 'rgba(120, 88, 62, 0.10)';
    roundedRect(g, ox - mat + 1, oy - mat + 1, S + mat * 2 - 2, S + mat * 2 - 2, 14);
    g.stroke();

    level.guide = {
      canvas: cv,
      x: level.bx - pad - mat,
      y: level.by - pad - mat,
      w: total,
      h: total,
    };
  }

  /* ======================================================================== *
   *  7 · FONDO, AMBIENTE Y RENDER                                            *
   * ------------------------------------------------------------------------ */

  function buildBackground(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);

    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#fdf7ee');
    base.addColorStop(0.55, '#f7e7d5');
    base.addColorStop(1, '#f1dcc7');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    const blobs = [
      { x: w * 0.88, y: h * 0.04, r: w * 0.62, c: '255, 228, 203', a: 0.5 },
      { x: w * 0.06, y: h * 0.98, r: w * 0.66, c: '221, 226, 205', a: 0.38 },
      { x: w * 0.52, y: h * 0.42, r: w * 0.55, c: '255, 246, 232', a: 0.38 },
    ];
    for (const b of blobs) {
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, `rgba(${b.c}, ${b.a})`);
      rg.addColorStop(1, `rgba(${b.c}, 0)`);
      g.fillStyle = rg;
      g.fillRect(0, 0, w, h);
    }

    /* Grano de papel muy suave */
    const tile = document.createElement('canvas');
    tile.width = 180;
    tile.height = 180;
    const tg = tile.getContext('2d');
    const img = tg.createImageData(180, 180);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const on = Math.random() < 0.42;
      d[i] = 96;
      d[i + 1] = 70;
      d[i + 2] = 52;
      d[i + 3] = on ? 13 : 0;
    }
    tg.putImageData(img, 0, 0);
    const pattern = g.createPattern(tile, 'repeat');
    if (pattern) {
      g.globalAlpha = 0.55;
      g.fillStyle = pattern;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }

    /* Viñeta inferior */
    const vg = g.createLinearGradient(0, h * 0.72, 0, h);
    vg.addColorStop(0, 'rgba(120, 84, 56, 0)');
    vg.addColorStop(1, 'rgba(120, 84, 56, 0.06)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);

    bgCanvas = cv;
  }

  function initAmbient(w, h) {
    ambient = [];
    const n = Math.round(clamp((w * h) / 24000, 12, 30));
    for (let i = 0; i < n; i += 1) {
      ambient.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 1.9,
        vx: -7 + Math.random() * 14,
        vy: -2 - Math.random() * 7,
        a: 0.05 + Math.random() * 0.09,
        tw: Math.random() * TAU,
        tws: 0.5 + Math.random() * 0.9,
        star: Math.random() < 0.16,
        rot: Math.random() * TAU,
        color: Math.random() < 0.6 ? '#c9a06f' : '#c9836d',
      });
    }
  }

  function updateAmbient(dt, time) {
    if (!ambient.length) initAmbient(view.w, view.h);
    for (const p of ambient) {
      p.x += (p.vx + Math.sin(time * 0.5 + p.tw) * 2.4) * dt;
      p.y += p.vy * dt;
      if (p.y < -12) {
        p.y = view.h + 12;
        p.x = Math.random() * view.w;
      }
      if (p.x < -12) p.x = view.w + 12;
      if (p.x > view.w + 12) p.x = -12;
      if (p.y > view.h + 12) p.y = -12;
    }
  }

  function drawAmbient(time) {
    for (const p of ambient) {
      const tw = 0.55 + 0.45 * Math.sin(time * p.tws + p.tw);
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = p.color;
      if (p.star) {
        sparkleShape(ctx, p.x, p.y, p.r * 2.5, p.rot + time * 0.15);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTray() {
    if (!layout) return;
    const t = layout.tray;
    if (t.h < 30 || t.w < 30) return;
    ctx.save();
    roundedRect(ctx, t.x, t.y, t.w, t.h, 22);
    ctx.fillStyle = 'rgba(147, 169, 141, 0.085)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(93, 122, 91, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#4a3529';
    drawPaw(ctx, t.x + t.w - 48, t.y + t.h - 34, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPaw(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.ellipse(0, 6, 13, 11, 0, 0, TAU);
    c.fill();
    const toes = [
      [-13, -4, 4.5, 6, -0.3],
      [-5, -10, 4.6, 6.2, 0.1],
      [4, -10, 4.6, 6.2, 0.3],
      [12, -4, 4.5, 6, -0.3],
    ];
    for (const [dx, dy, rx, ry, rot] of toes) {
      c.beginPath();
      c.ellipse(dx, dy, rx, ry, rot, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  function drawBoardBackdrop() {
    if (!level || !level.guide) return;
    const gd = level.guide;
    ctx.drawImage(gd.canvas, gd.x, gd.y, gd.w, gd.h);
  }

  function drawSnapPreview(time) {
    if (!drag || !level) return;
    const p = drag.piece;
    const tol = snapTolerance();
    const dist = Math.hypot(p.x - p.homeX, p.y - p.homeY);
    const range = tol * 2.8;
    if (dist > range) return;
    const near = 1 - clamp(dist / range, 0, 1);
    const a = 0.10 + 0.5 * near;

    ctx.save();
    ctx.translate(p.homeX, p.homeY);
    ctx.fillStyle = `rgba(255, 251, 242, ${0.06 + 0.14 * near})`;
    ctx.fill(p.path);
    ctx.strokeStyle = `rgba(93, 122, 91, ${0.25 + 0.55 * a})`;
    ctx.lineWidth = 1.7;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -time * 14;
    ctx.stroke(p.path);
    ctx.restore();
  }

  function drawLiftShadow(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h * 0.95;
    const r = Math.max(p.w, p.h) * 0.66;
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    grd.addColorStop(0, 'rgba(70, 44, 28, 0.22)');
    grd.addColorStop(1, 'rgba(70, 44, 28, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPieces() {
    if (!level) return;
    const list = level.pieces.slice().sort((a, b) => a.z - b.z);
    const dragged = drag ? drag.piece : null;

    for (const p of list) {
      let scale = p.visualScale || 1;
      if (p === dragged) scale = drag.scale;

      if (p === dragged) drawLiftShadow(p);

      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      ctx.save();
      if (Math.abs(scale - 1) > 0.002) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }
      ctx.drawImage(p.canvas, p.x - p.margin, p.y - p.margin, p.drawW, p.drawH);
      ctx.restore();
    }
  }

  function drawSparkles() {
    for (const s of sparkles) {
      const t = s.life / s.dur;
      const a = 1 - t;
      const size = s.size * (0.5 + 0.5 * a);
      ctx.globalAlpha = clamp(a, 0, 1) * 0.95;
      ctx.fillStyle = s.color;
      if (s.star) {
        sparkleShape(ctx, s.x, s.y, size * 1.8, s.rot);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const r of rings) {
      const t = r.life / r.dur;
      const rad = lerp(r.r0, r.r1, easeOutCubic(t));
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.6 + (1 - t) * 2.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBoardGlow() {
    if (!level || boardFlash <= 0) return;
    const S = level.boardSize;
    const a = clamp(boardFlash, 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(217, 164, 65, ${0.5 * a})`;
    ctx.lineWidth = 1.5 + 7 * a;
    ctx.shadowColor = `rgba(217, 164, 65, ${0.55 * a})`;
    ctx.shadowBlur = 30 * a;
    roundedRect(ctx, level.bx - 2, level.by - 2, S + 4, S + 4, 9);
    ctx.stroke();
    ctx.restore();
  }

  function render(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, view.w, view.h);
    drawAmbient(time);

    if (
      level &&
      (state === STATE.PLAYING ||
        state === STATE.LEVEL_CLEAR ||
        state === STATE.VICTORY)
    ) {
      drawTray();
      drawBoardBackdrop();
      if (state === STATE.PLAYING) drawSnapPreview(time);
      drawPieces();
      drawBoardGlow();
      drawSparkles();
    } else {
      drawSparkles();
    }
  }

  /* ======================================================================== *
   *  8 · ENTRADA                                                             *
   * ------------------------------------------------------------------------ */

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function snapTolerance() {
    if (!level) return 24;
    const side = Math.min(level.pw, level.ph);
    return clamp(side * level.cfg.snap, TUNING.snapMin, TUNING.snapMax);
  }

  function pieceAt(x, y) {
    if (!level) return null;
    const sorted = level.pieces.slice().sort((a, b) => b.z - a.z);
    for (const p of sorted) {
      if (p.locked || p.snapping) continue;
      if (hitCtx.isPointInPath(p.path, x - p.x, y - p.y)) return p;
    }
    return null;
  }

  function dragBounds(p) {
    const safe = layout ? layout.safe : { left: 0, right: 0, bottom: 0 };
    const minX = 4 + Math.max(0, safe.left - 4);
    const maxX = view.w - p.w - 4 - Math.max(0, safe.right - 4);
    const minY = (layout ? layout.hudBottom : 0) + 4;
    const maxY = view.h - p.h - 6 - Math.max(0, safe.bottom - 4);
    return {
      minX,
      maxX: Math.max(minX, maxX),
      minY,
      maxY: Math.max(minY, maxY),
    };
  }

  function applyDragPosition(d) {
    const p = d.piece;
    const b = dragBounds(p);
    p.x = clampAxis(d.px - d.offX, b.minX, b.maxX);
    p.y = clampAxis(d.py - d.offY - d.lift, b.minY, b.maxY);
  }

  function onPointerDown(e) {
    if (state !== STATE.PLAYING || !level || level.complete) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag) return;
    const pt = pointerPos(e);
    const p = pieceAt(pt.x, pt.y);
    if (!p) return;

    e.preventDefault();
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const liftTarget = isTouch
      ? clamp(view.h * TUNING.liftTouch, 34, 58)
      : TUNING.liftMouse;

    drag = {
      piece: p,
      pointerId: e.pointerId,
      offX: pt.x - p.x,
      offY: pt.y - p.y,
      px: pt.x,
      py: pt.y,
      downX: pt.x,
      downY: pt.y,
      moved: false,
      lift: 0,
      liftTarget,
      scale: 1,
      scaleTarget: TUNING.dragScale,
    };
    p.z = zCounter += 1;
    p.tween = null;
    p.visualScale = 1;
    canvas.style.cursor = 'grabbing';
    playPick();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* noop */
    }
  }

  function onPointerMove(e) {
    if (drag && e.pointerId === drag.pointerId) {
      const pt = pointerPos(e);
      drag.px = pt.x;
      drag.py = pt.y;
      if (
        !drag.moved &&
        Math.hypot(pt.x - drag.downX, pt.y - drag.downY) > 8
      ) {
        drag.moved = true;
      }
      e.preventDefault();
      return;
    }
    if (e.pointerType === 'mouse' && state === STATE.PLAYING) {
      const pt = pointerPos(e);
      canvas.style.cursor = pieceAt(pt.x, pt.y) ? 'grab' : 'default';
    }
  }

  function finishDrag(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* noop */
    }
    canvas.style.cursor = e.pointerType === 'mouse' ? 'grab' : 'default';
    if (state !== STATE.PLAYING || !level || level.complete) return;

    applyDragPosition(d);
    const p = d.piece;
    if (Math.hypot(p.x - p.homeX, p.y - p.homeY) <= snapTolerance()) {
      startSnap(p);
    } else if (d.moved) {
      playDrop();
    }
  }

  function onPointerCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    applyDragPosition(d);
    canvas.style.cursor = 'default';
  }

  /* ======================================================================== *
   *  8b · ANIMACIONES DE PIEZAS                                              *
   * ------------------------------------------------------------------------ */

  function startSnap(p) {
    p.snapping = true;
    p.snapT = 0;
    p.snapFrom.x = p.x;
    p.snapFrom.y = p.y;
    p.visualScale = 1.06;
    p.z = zCounter += 1;
  }

  function finishSnap(p) {
    p.snapping = false;
    p.locked = true;
    p.x = p.homeX;
    p.y = p.homeY;
    p.visualScale = 1;
    p.z = -1;
    level.placed += 1;
    level.finishedAt = performance.now();
    updateProgressHud();
    playSnap(level.placed, level.total);

    const cx = p.homeX + p.w / 2;
    const cy = p.homeY + p.h / 2;
    addSparkles(cx, cy, 10, Math.min(p.w, p.h) * 0.9);
    rings.push({
      x: cx,
      y: cy,
      r0: Math.min(p.w, p.h) * 0.18,
      r1: Math.min(p.w, p.h) * 0.72,
      life: 0,
      dur: 0.5,
      color: COLORS.ring + '0.55)',
    });

    if (level.placed >= level.total) onLevelComplete();
  }

  function onLevelComplete() {
    if (!level || level.complete) return;
    const isLast = level.index === LEVELS_CONFIG.length - 1;
    level.complete = true;
    level.finishedAt = performance.now();
    level.finishTimer = isLast ? TUNING.victoryDelay : TUNING.clearDelay;
    level.finishedHandled = false;
    state = STATE.LEVEL_CLEAR;
    boardFlash = 1;

    const S = level.boardSize;
    addSparkles(
      level.bx + S / 2,
      level.by + S / 2,
      34,
      Math.max(S * 0.55, 60)
    );
    for (let i = 0; i < 4; i += 1) {
      rings.push({
        x: level.bx + rand(S * 0.85, S * 0.15),
        y: level.by + rand(S * 0.85, S * 0.15),
        r0: 4,
        r1: rand(S * 0.22, S * 0.1),
        life: -i * 0.08,
        dur: 0.9,
        color: COLORS.ring + '0.4)',
      });
    }
    if (!isLast) playLevelClear();
  }

  function addSparkles(x, y, count, spread) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const sp = rand(spread * 1.35, spread * 0.25);
      sparkles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(30, 5),
        life: 0,
        dur: rand(0.85, 0.45),
        size: rand(3.6, 1.4),
        color: COLORS.sparkle[randInt(COLORS.sparkle.length)],
        rot: Math.random() * TAU,
        spin: rand(5, -5),
        star: Math.random() < 0.55,
      });
    }
    if (sparkles.length > 220) sparkles.splice(0, sparkles.length - 220);
  }

  function updateSparkles(dt) {
    for (let i = sparkles.length - 1; i >= 0; i -= 1) {
      const s = sparkles[i];
      s.life += dt;
      if (s.life >= s.dur) {
        sparkles.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 62 * dt;
      s.vx *= 0.985;
      s.rot += s.spin * dt;
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.life += dt;
      if (r.life >= r.dur) rings.splice(i, 1);
    }
  }

  function tidyPieces() {
    if (!level) return;
    const free = level.pieces.filter(
      (p) => !p.locked && !p.snapping && (!drag || drag.piece !== p)
    );
    if (!free.length) return;
    const slots = makeScatterPositions(free.length);
    free.forEach((p, i) => {
      const slot = slots[i];
      if (!slot) return;
      p.tween = {
        fromX: p.x,
        fromY: p.y,
        toX: slot.x,
        toY: slot.y,
        t: -i * 0.018,
        dur: 0.46,
      };
      p.z = zCounter += 1;
    });
    live.textContent = 'Piezas ordenadas en la bandeja.';
  }

  /* ======================================================================== *
   *  9 · UI, ESTADOS Y TRANSICIONES                                          *
   * ------------------------------------------------------------------------ */

  function revealOverlay() {
    clearTimeout(overlayTimer);
    overlay.hidden = false;
    overlay.classList.remove('is-open');
    void overlay.offsetWidth;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    });
  }

  function hideOverlay() {
    overlay.classList.remove('is-open');
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      overlay.hidden = true;
    }, 320);
  }

  function revealSheet() {
    clearTimeout(sheetTimer);
    sheet.hidden = false;
    sheet.classList.remove('is-open');
    void sheet.offsetWidth;
    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
    });
  }

  function hideSheet() {
    sheet.classList.remove('is-open');
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(() => {
      sheet.hidden = true;
    }, 460);
  }

  function paintCanvas(canvasEl, painter) {
    if (!canvasEl || canvasEl.hidden) return;
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width < 4) return;
    const d = Math.min(dpr, 3);
    const size = Math.max(1, Math.round(rect.width * d));
    if (canvasEl.width !== size) canvasEl.width = size;
    if (canvasEl.height !== size) canvasEl.height = size;
    const g = canvasEl.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    painter(g, size);
  }

  function paintOverlayArt() {
    if (overlayMode === 'start') {
      paintCanvas(ovArt, (g, size) =>
        drawCatArt(g, size, {
          variant: startVariant,
          seed: 11,
          scarf: true,
          hearts: true,
        })
      );
    } else if (overlayMode === 'victory') {
      paintCanvas(ovArt, (g, size) =>
        drawCatArt(g, size, {
          variant: victoryVariant,
          seed: 29,
          scarf: true,
          hat: true,
          garland: true,
          snow: true,
        })
      );
    }
  }

  function updateStartNote() {
    if (state !== STATE.START) return;
    if (!photoDeck) return;
    if (photoDeck.readyCount === 0 && photoDeck.pending === 0) {
      ovNote.hidden = false;
      ovNote.textContent =
        'Mientras llegan las fotos, te acompañan unos gatitos dibujados con cariño.';
    } else {
      ovNote.hidden = true;
      ovNote.textContent = '';
    }
  }

  function showStart() {
    state = STATE.START;
    level = null;
    hud.hidden = true;
    hideSheet();
    startVariant = randInt(CAT_PALETTES.length);
    overlayMode = 'start';
    ovEyebrow.textContent = 'Un regalo para Sagrario';
    ovTitle.textContent = 'Catzle';
    ovTitle.classList.add('is-brand');
    ovText.textContent =
      'Un puzle de gatitos para estos días de mantita. Arrastra cada pieza hasta su sitio: cuando esté cerca, se colocará sola.';
    ovFoot.textContent = `Navidad ${new Date().getFullYear()} · hecho con muchísimo cariño`;
    ovPrimary.textContent = 'Empezar a jugar';
    ovPrimary.disabled = false;
    starting = false;
    revealOverlay();
    requestAnimationFrame(() => {
      paintOverlayArt();
      updateStartNote();
      try {
        ovPrimary.focus({ preventScroll: true });
      } catch (_) {
        /* noop */
      }
    });
  }

  function showVictory() {
    state = STATE.VICTORY;
    hud.hidden = true;
    hideSheet();
    overlayMode = 'victory';
    victoryVariant = (startVariant + 2 + randInt(3)) % CAT_PALETTES.length;

    const pieces = LEVELS_CONFIG.reduce((n, l) => n + l.rows * l.cols, 0);
    const elapsed = run ? (performance.now() - run.startedAt) / 1000 : 0;

    ovEyebrow.textContent = `Navidad ${new Date().getFullYear()}`;
    ovTitle.textContent = '¡Feliz Navidad, Sagrario!';
    ovTitle.classList.remove('is-brand');
    ovText.textContent =
      'Has completado todos los puzles, con sus bigotes, sus siestas y sus pestañas. Que estas fiestas te traigan mantitas calentitas, tardes sin prisa, chocolate con churros y muchísimos ronroneos.';
    ovNote.hidden = false;
    ovNote.textContent = `${pieces} piezas · ${formatTime(elapsed)} de puzle y calma`;
    ovFoot.textContent = 'Gracias por estar ahí. Con cariño, para ti.';
    ovPrimary.textContent = 'Jugar otra vez';
    ovPrimary.disabled = false;
    revealOverlay();
    playVictoryMelody();
    live.textContent =
      '¡Felicidades! Has completado todos los puzles de Catzle. Feliz Navidad, Sagrario.';

    requestAnimationFrame(() => {
      paintOverlayArt();
      try {
        ovPrimary.focus({ preventScroll: true });
      } catch (_) {
        /* noop */
      }
    });
  }

  function startRun() {
    if (!photoDeck) return;
    photoDeck.reset();
    run = { startedAt: performance.now() };
    hideOverlay();
    hud.hidden = false;
    startLevel(0, photoDeck.next());
  }

  async function handleStart() {
    if (starting) return;
    starting = true;
    ovPrimary.disabled = true;
    const original = ovPrimary.textContent;
    ovPrimary.textContent = 'Preparando gatitos…';

    try {
      await photosReady;
      if (!photoDeck) {
        photoDeck = new PhotoDeck(CAT_PHOTOS);
        photoDeck.onChange = updateStartNote;
        buildLevelsForCount(CAT_PHOTOS.length);
        photoDeck.preload();
      }
      await photoDeck.settled(1400);
    } catch (_) {
      /* arrancamos con lo que haya */
    }

    starting = false;
    if (state !== STATE.START) {
      ovPrimary.disabled = false;
      ovPrimary.textContent = original;
      return;
    }
    if (!photoDeck) return;
    startRun();
  }

  function handlePlayAgain() {
    if (starting) return;
    hideOverlay();
    hud.hidden = false;
    photoDeck.reset();
    run = { startedAt: performance.now() };
    startLevel(0, photoDeck.next());
  }

  function startLevel(index, entry) {
    const cfg = LEVELS_CONFIG[index];
    if (!cfg) return;
    fadeMusic();
    hud.hidden = false;
    hudLevel.textContent = `Nivel ${index + 1} de ${LEVELS_CONFIG.length}`;
    hudName.textContent = cfg.name;
    layout = computeLayout();
    state = STATE.PLAYING;
    buildLevel(index, entry, { seed: randInt(0xffffffff) });
    updateProgressHud();
    live.textContent = `Nivel ${index + 1}: ${cfg.name}. ${level.total} piezas.`;
  }

  function showClearSheet() {
    if (!level) return;
    const idx = level.index;
    const elapsed = (performance.now() - level.startedAt) / 1000;
    sheetEyebrow.textContent = `Nivel ${idx + 1} · ${level.cfg.name}`;
    sheetTitle.textContent =
      level.cfg.clear || CLEAR_LINES[idx % CLEAR_LINES.length];
    sheetMeta.textContent = `${level.total} piezas · ${formatTime(elapsed)}`;
    sheetNext.textContent = 'Siguiente gatito';
    revealSheet();
    requestAnimationFrame(paintSheetThumb);
    live.textContent = `Nivel completado. ${level.total} piezas colocadas.`;
    try {
      sheetNext.focus({ preventScroll: true });
    } catch (_) {
      /* noop */
    }
  }

  function paintSheetThumb() {
    if (!level) return;
    paintCanvas(sheetThumb, (g, size) => {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(level.photo.canvas, 0, 0, size, size);
    });
  }

  function handleNextLevel() {
    if (state !== STATE.LEVEL_CLEAR || !level) return;
    hideSheet();
    const nextIdx = level.index + 1;
    if (nextIdx >= LEVELS_CONFIG.length) {
      showVictory();
      return;
    }
    startLevel(nextIdx, photoDeck.next());
  }

  function updateProgressHud() {
    if (!level) return;
    const pct = level.total
      ? Math.round((level.placed / level.total) * 100)
      : 0;
    progressFill.style.width = `${pct}%`;
    progress.setAttribute('aria-valuenow', String(pct));
    progress.setAttribute(
      'aria-valuetext',
      `${level.placed} de ${level.total} piezas colocadas`
    );
    progressLabel.textContent = `${level.placed} / ${level.total}`;
  }

  function bindUI() {
    ovPrimary.addEventListener('click', () => {
      if (overlayMode === 'start') handleStart();
      else if (overlayMode === 'victory') handlePlayAgain();
    });
    sheetNext.addEventListener('click', handleNextLevel);

    btnGuide.addEventListener('click', () => {
      guideOn = !guideOn;
      btnGuide.classList.toggle('is-off', !guideOn);
      btnGuide.setAttribute('aria-pressed', String(guideOn));
      if (level) buildGuideCache();
    });

    btnTidy.addEventListener('click', () => {
      if (state === STATE.PLAYING) tidyPieces();
    });

    if (btnSound) {
      btnSound.addEventListener('click', () => {
        unlockAudio();
        setMuted(!muted, muted);
      });
    }

    /* Desbloqueo del audio en el primer gesto real del usuario. */
    document.addEventListener('pointerdown', unlockAudio, {
      capture: true,
      passive: true,
    });
    document.addEventListener('click', unlockAudio, {
      capture: true,
      passive: true,
    });
    document.addEventListener('keydown', handleKeydown, { capture: true });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dragstart', (e) => e.preventDefault());

    overlay.addEventListener('touchmove', (e) => {
      /* Permite el scroll interno del panel, bloquea el resto. */
      if (e.target === overlay) e.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      lastTime = 0;
      if (document.hidden && drag) {
        drag = null;
        canvas.style.cursor = 'default';
      }
    });
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyResize, 130);
  }

  function resizeCanvas() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, TUNING.maxDPR);
    dpr = nextDpr;
    view = {
      w: Math.max(1, window.innerWidth),
      h: Math.max(1, window.innerHeight),
    };
    canvas.width = Math.max(1, Math.round(view.w * dpr));
    canvas.height = Math.max(1, Math.round(view.h * dpr));
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    buildBackground(view.w, view.h);
    initAmbient(view.w, view.h);
  }

  function applyResize() {
    const prevBoard = layout ? layout.board : null;
    const prevDpr = dpr;
    resizeCanvas();
    layout = computeLayout();

    if (overlayMode && !overlay.hidden) paintOverlayArt();

    if (state === STATE.PLAYING || state === STATE.LEVEL_CLEAR) {
      if (level) {
        const b = layout.board;
        const moved =
          !prevBoard ||
          Math.abs(b.x - prevBoard.x) > 2 ||
          Math.abs(b.y - prevBoard.y) > 2 ||
          Math.abs(b.size - prevBoard.size) > 2 ||
          Math.abs(dpr - prevDpr) > 0.01;
        if (moved) {
          if (drag) {
            drag = null;
            canvas.style.cursor = 'default';
          }
          const placed = new Set(
            level.pieces.filter((p) => p.locked).map((p) => `${p.r},${p.c}`)
          );
          const wasComplete = level.complete;
          buildLevel(level.index, level.photoEntry, {
            seed: level.seed,
            placed,
          });
          if (wasComplete) {
            level.complete = true;
            level.placed = level.total;
            updateProgressHud();
          }
        } else {
          buildGuideCache();
        }
      }
    }

    if ((state === STATE.LEVEL_CLEAR || state === STATE.VICTORY) && !sheet.hidden) {
      paintSheetThumb();
    }
  }

  /* ======================================================================== *
   * 10 · BUCLE                                                               *
   * ------------------------------------------------------------------------ */

  function update(dt, time) {
    updateAmbient(dt, time);
    updateSparkles(dt);
    boardFlash = Math.max(0, boardFlash - dt * 0.75);

    if (drag) {
      drag.lift += (drag.liftTarget - drag.lift) * Math.min(1, dt * 18);
      drag.scale += (drag.scaleTarget - drag.scale) * Math.min(1, dt * 18);
      applyDragPosition(drag);
    }

    if (!level) return;

    for (const p of level.pieces) {
      if (p.tween && (!drag || drag.piece !== p)) {
        p.tween.t += dt;
        if (p.tween.t >= 0) {
          const t = clamp(p.tween.t / p.tween.dur, 0, 1);
          const e = easeOutCubic(t);
          p.x = lerp(p.tween.fromX, p.tween.toX, e);
          p.y = lerp(p.tween.fromY, p.tween.toY, e);
          if (t >= 1) p.tween = null;
        }
      }

      if (p.snapping) {
        p.snapT += dt / TUNING.snapAnim;
        const t = clamp(p.snapT, 0, 1);
        const e = easeOutCubic(t);
        p.x = lerp(p.snapFrom.x, p.homeX, e);
        p.y = lerp(p.snapFrom.y, p.homeY, e);
        p.visualScale = lerp(1.06, 1, e);
        if (t >= 1) finishSnap(p);
      }
    }

    if (level.complete && !level.finishedHandled) {
      level.finishTimer -= dt;
      if (level.finishTimer <= 0) {
        level.finishedHandled = true;
        if (level.index === LEVELS_CONFIG.length - 1) showVictory();
        else showClearSheet();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
    lastTime = now;
    const time = now / 1000;
    update(dt, time);
    render(time);
  }

  /* ======================================================================== *
   *  ARRANQUE                                                                *
   * ------------------------------------------------------------------------ */

  function boot() {
    syncSoundButton();
    bindUI();
    resizeCanvas();
    layout = computeLayout();
    showStart();

    photosReady = preparePhotos().catch(() => {
      if (!photoDeck) {
        photoDeck = new PhotoDeck(CAT_PHOTOS);
        photoDeck.onChange = updateStartNote;
        buildLevelsForCount(CAT_PHOTOS.length);
        photoDeck.preload();
      }
    });

    requestAnimationFrame((now) => {
      lastTime = now;
      requestAnimationFrame(frame);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
