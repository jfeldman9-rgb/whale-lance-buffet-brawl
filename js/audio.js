/* Procedural WebAudio: chiptune-ish SFX and a tiny step-sequencer for music.
   No audio files required. */
'use strict';

WL.audio = (function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false;
  let unlocked = false;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    } catch (e) { ctx = null; }
  }

  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.8;
  }
  function toggleMute() { setMuted(!muted); return muted; }

  /* ---------- SFX primitives ---------- */
  function tone(opts) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.f0 || 440, t0);
    if (opts.f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + (opts.dur || 0.1));
    const v = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.1));
    o.connect(g); g.connect(opts.dest || sfxGain);
    o.start(t0); o.stop(t0 + (opts.dur || 0.1) + 0.02);
  }

  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noise(opts) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const filt = ctx.createBiquadFilter();
    filt.type = opts.filter || 'lowpass';
    filt.frequency.setValueAtTime(opts.f0 || 1000, t0);
    if (opts.f1 !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(30, opts.f1), t0 + (opts.dur || 0.2));
    filt.Q.value = opts.q || 1;
    const g = ctx.createGain();
    const v = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.2));
    src.connect(filt); filt.connect(g); g.connect(opts.dest || sfxGain);
    src.start(t0); src.stop(t0 + (opts.dur || 0.2) + 0.02);
  }

  const sfx = {
    blip() { tone({ f0: 880, f1: 1200, dur: 0.06, vol: 0.2 }); },
    select() { tone({ f0: 660, f1: 990, dur: 0.08, vol: 0.25 }); tone({ f0: 990, f1: 1320, dur: 0.1, delay: 0.07, vol: 0.25 }); },
    swing() { noise({ f0: 1800, f1: 400, dur: 0.09, vol: 0.12, filter: 'bandpass', q: 0.8 }); },
    hit(heavy) {
      noise({ f0: heavy ? 500 : 900, f1: 120, dur: heavy ? 0.16 : 0.1, vol: heavy ? 0.5 : 0.35 });
      tone({ f0: heavy ? 160 : 220, f1: 60, dur: heavy ? 0.14 : 0.08, vol: 0.35, type: 'triangle' });
    },
    clank() { tone({ f0: 1800, f1: 900, dur: 0.12, vol: 0.18, type: 'square' }); noise({ f0: 3000, f1: 800, dur: 0.08, vol: 0.15, filter: 'highpass' }); },
    hurt() { tone({ f0: 300, f1: 90, dur: 0.22, vol: 0.35, type: 'sawtooth' }); noise({ f0: 700, f1: 200, dur: 0.15, vol: 0.25 }); },
    thud() { tone({ f0: 120, f1: 40, dur: 0.25, vol: 0.5, type: 'sine' }); noise({ f0: 400, f1: 80, dur: 0.2, vol: 0.4 }); },
    jump() { tone({ f0: 300, f1: 700, dur: 0.15, vol: 0.2, type: 'square' }); },
    pickup() { tone({ f0: 660, f1: 660, dur: 0.07, vol: 0.2 }); tone({ f0: 880, dur: 0.08, delay: 0.07, vol: 0.2 }); tone({ f0: 1320, dur: 0.12, delay: 0.14, vol: 0.2 }); },
    heal() { for (let i = 0; i < 4; i++) tone({ f0: 523 * Math.pow(1.25, i), dur: 0.12, delay: i * 0.06, vol: 0.18, type: 'triangle' }); },
    chomp() { noise({ f0: 900, f1: 200, dur: 0.12, vol: 0.3 }); tone({ f0: 200, f1: 120, dur: 0.1, vol: 0.2, type: 'square' }); },
    spray() { noise({ f0: 4000, f1: 2500, dur: 0.55, vol: 0.35, filter: 'highpass', attack: 0.02 }); tone({ f0: 2400, f1: 1800, dur: 0.5, vol: 0.05, type: 'sine' }); },
    throwSfx() { noise({ f0: 1200, f1: 3000, dur: 0.2, vol: 0.2, filter: 'bandpass' }); },
    grab() { noise({ f0: 2500, f1: 600, dur: 0.18, vol: 0.25, filter: 'bandpass', q: 2 }); tone({ f0: 400, f1: 500, dur: 0.1, vol: 0.15 }); },
    tape() { noise({ f0: 3500, f1: 1500, dur: 0.25, vol: 0.3, filter: 'bandpass', q: 3 }); },
    enemyDie() { tone({ f0: 500, f1: 80, dur: 0.3, vol: 0.3, type: 'sawtooth' }); noise({ f0: 1500, f1: 200, dur: 0.3, vol: 0.3 }); },
    shuriken() { tone({ f0: 1500, f1: 700, dur: 0.15, vol: 0.15, type: 'triangle' }); },
    steam() { noise({ f0: 3000, f1: 1200, dur: 0.6, vol: 0.25, filter: 'highpass', attack: 0.05 }); },
    fart() {
      if (!ctx || muted) return;
      // the star of the show: low sawtooth with vibrato, pitch drop, gritty noise
      const t0 = ctx.currentTime;
      const dur = 1.4;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(55, t0 + dur * 0.6);
      o.frequency.exponentialRampToValueAtTime(38, t0 + dur);
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 28;
      const lfoG = ctx.createGain(); lfoG.gain.value = 22;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0); f.frequency.exponentialRampToValueAtTime(250, t0 + dur); f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.7, t0 + 0.05); g.gain.setValueAtTime(0.7, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
      noise({ f0: 600, f1: 150, dur: dur, vol: 0.35, q: 2 });
      tone({ f0: 60, f1: 30, dur: 0.6, vol: 0.6, type: 'sine' });
    },
    bossRoar() { tone({ f0: 90, f1: 45, dur: 0.9, vol: 0.5, type: 'sawtooth' }); noise({ f0: 500, f1: 100, dur: 0.9, vol: 0.4 }); },
    slam() { tone({ f0: 80, f1: 30, dur: 0.4, vol: 0.7, type: 'sine' }); noise({ f0: 600, f1: 60, dur: 0.4, vol: 0.5 }); },
    splat() { noise({ f0: 1200, f1: 200, dur: 0.25, vol: 0.35, q: 2 }); tone({ f0: 300, f1: 80, dur: 0.2, vol: 0.2, type: 'triangle' }); },
    levelClear() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((n, i) => tone({ f0: n, dur: 0.18, delay: i * 0.11, vol: 0.22, type: 'square' }));
    },
    gameOver() { [440, 415, 392, 370, 349, 330, 220].forEach((n, i) => tone({ f0: n, dur: 0.3, delay: i * 0.22, vol: 0.25, type: 'triangle' })); },
    oneUp() { [660, 880, 1100, 1320].forEach((n, i) => tone({ f0: n, dur: 0.14, delay: i * 0.08, vol: 0.2 })); },
    break() { noise({ f0: 2500, f1: 300, dur: 0.3, vol: 0.4 }); tone({ f0: 800, f1: 200, dur: 0.15, vol: 0.2, type: 'square' }); }
  };

  /* ---------- Music: step sequencer ---------- */
  // Songs: { bpm, bass: [midi or 0 ...16 steps], lead: [...], arp: root notes per bar }
  const SONGS = {
    title: { bpm: 112, bass: [36, 0, 36, 0, 43, 0, 36, 0, 41, 0, 41, 0, 43, 0, 46, 0], lead: [60, 0, 63, 0, 67, 0, 70, 67, 0, 65, 0, 63, 0, 60, 0, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
    lido: { bpm: 126, bass: [38, 38, 0, 38, 45, 0, 38, 0, 41, 41, 0, 41, 43, 0, 45, 0], lead: [62, 0, 65, 69, 0, 67, 0, 65, 0, 62, 0, 65, 67, 0, 69, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
    plant: { bpm: 132, bass: [33, 33, 0, 33, 33, 0, 36, 0, 31, 31, 0, 31, 31, 0, 35, 36], lead: [57, 0, 0, 60, 0, 57, 0, 0, 55, 0, 0, 59, 0, 60, 0, 62], kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0] },
    spa: { bpm: 120, bass: [40, 0, 0, 40, 0, 47, 0, 0, 38, 0, 0, 38, 0, 45, 0, 0], lead: [64, 67, 0, 71, 0, 0, 67, 0, 62, 66, 0, 69, 0, 0, 66, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
    freezer: { bpm: 138, bass: [31, 31, 0, 31, 0, 31, 34, 0, 30, 30, 0, 30, 0, 30, 33, 0], lead: [55, 0, 58, 0, 62, 0, 58, 55, 54, 0, 57, 0, 61, 0, 57, 54], kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
    boss: { bpm: 150, bass: [29, 29, 29, 0, 32, 0, 29, 0, 27, 27, 27, 0, 30, 0, 28, 0], lead: [53, 0, 56, 60, 0, 56, 53, 0, 51, 0, 54, 58, 0, 54, 51, 0], kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1] },
    victory: { bpm: 100, bass: [36, 0, 43, 0, 41, 0, 43, 0, 36, 0, 43, 0, 45, 0, 43, 0], lead: [67, 0, 72, 0, 76, 0, 74, 72, 67, 0, 72, 0, 77, 0, 76, 74], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] }
  };

  let song = null, songName = null, step = 0, nextTime = 0, timer = null;
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  function scheduleStep(t) {
    const s = song;
    const stepDur = 60 / s.bpm / 4;
    const b = s.bass[step % 16];
    if (b) tone({ f0: midi(b), dur: stepDur * 0.9, vol: 0.25, type: 'triangle', delay: t - ctx.currentTime, dest: musicGain });
    const l = s.lead[step % 16];
    if (l) tone({ f0: midi(l), dur: stepDur * 0.8, vol: 0.09, type: 'square', delay: t - ctx.currentTime, dest: musicGain });
    if (s.kick[step % 16]) tone({ f0: 150, f1: 40, dur: 0.12, vol: 0.4, type: 'sine', delay: t - ctx.currentTime, dest: musicGain });
    if (s.snare[step % 16]) noise({ f0: 1800, f1: 900, dur: 0.09, vol: 0.18, filter: 'bandpass', delay: t - ctx.currentTime, dest: musicGain });
    // hats
    if (step % 2 === 1) noise({ f0: 8000, f1: 6000, dur: 0.03, vol: 0.05, filter: 'highpass', delay: t - ctx.currentTime, dest: musicGain });
  }

  function tick() {
    if (!song || !ctx) return;
    const stepDur = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(nextTime);
      nextTime += stepDur;
      step++;
    }
  }

  function playMusic(name) {
    init();
    if (!ctx) return;
    if (songName === name && timer) return;
    stopMusic();
    song = SONGS[name]; songName = name; step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(tick, 50);
  }
  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null; song = null; songName = null;
  }

  return { init, unlock, sfx, playMusic, stopMusic, toggleMute, setMuted, get muted() { return muted; }, get unlocked() { return unlocked; } };
})();
