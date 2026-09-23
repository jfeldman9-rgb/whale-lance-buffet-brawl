/* Procedural WebAudio: chiptune-ish SFX and a tiny step-sequencer for music.
   No audio files required. */
'use strict';

WL.audio = (function () {
  let ctx = null, master = null, musicGain = null, duckGain = null, sfxGain = null, comp = null;
  let muted = false;
  let unlocked = false;
  let volume = 1; // 0..1, multiplied into the master gain
  let musicLevel = 1; // 0..1, the music bus only
  const MUSIC_BASE = 0.32;
  let duckUntil = 0, duckDepth = 1;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8 * volume; master.connect(ctx.destination);
      // Music: level -> duck -> master. The duck stage dips under big hits and barks.
      duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = MUSIC_BASE * musicLevel; musicGain.connect(duckGain);
      // SFX get a fast compressor so stacked hits punch instead of clipping.
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1.05;
      if (ctx.createDynamicsCompressor) {
        comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4.5;
        comp.attack.value = 0.002; comp.release.value = 0.14;
        sfxGain.connect(comp); comp.connect(master);
      } else sfxGain.connect(master);
    } catch (e) { ctx = null; }
  }

  /** Dip the music bus: depth is the gain to fall to (0..1). */
  function duck(depth, hold, release) {
    if (!ctx || !duckGain) return;
    const now = ctx.currentTime;
    depth = Math.max(0.05, Math.min(1, depth == null ? 0.5 : depth));
    hold = hold == null ? 0.18 : hold;
    release = release == null ? 0.45 : release;
    // A shallower duck never cuts a deeper one short.
    if (now < duckUntil && depth > duckDepth) return;
    const g = duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(depth, now + 0.025);
    g.setValueAtTime(depth, now + 0.025 + hold);
    g.linearRampToValueAtTime(1, now + 0.025 + hold + release);
    duckUntil = now + 0.025 + hold; duckDepth = depth;
  }
  function setMusicLevel(v) {
    musicLevel = v < 0 ? 0 : v > 1 ? 1 : v;
    if (musicGain) musicGain.gain.value = MUSIC_BASE * musicLevel;
    return musicLevel;
  }
  const MUSIC_STEPS = [1, 0.7, 0.4, 0];
  function cycleMusic(dir) {
    let i = 0, best = 99;
    MUSIC_STEPS.forEach((s, n) => { const d = Math.abs(s - musicLevel); if (d < best) { best = d; i = n; } });
    i = (i + (dir || 1) + MUSIC_STEPS.length) % MUSIC_STEPS.length;
    return setMusicLevel(MUSIC_STEPS[i]);
  }
  function musicLabel() { return musicLevel <= 0 ? 'OFF' : Math.round(musicLevel * 100) + '%'; }

  // The same cue fired twice inside one frame just stacks volume; drop it.
  const lastFired = {};
  function gate(name, ms) {
    if (!ctx) return false;
    const now = ctx.currentTime * 1000;
    if (lastFired[name] != null && now - lastFired[name] < (ms || 28)) return false;
    lastFired[name] = now;
    return true;
  }
  const vary = (f, amt) => f * (1 + (Math.random() * 2 - 1) * (amt || 0.05));

  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  function applyMaster() {
    if (master) master.gain.value = muted || volume <= 0 ? 0 : 0.8 * volume;
  }
  function setMuted(m) {
    muted = m;
    applyMaster();
  }
  function toggleMute() { setMuted(!muted); return muted; }
  function setVolume(v) {
    volume = v < 0 ? 0 : v > 1 ? 1 : v;
    if (volume <= 0) muted = true;
    else if (muted && volume > 0) muted = false;
    applyMaster();
    return volume;
  }
  const VOLUME_STEPS = [1, 0.65, 0.35, 0];
  function cycleVolume(dir) {
    let i = 0, best = 99;
    VOLUME_STEPS.forEach((s, n) => { const d = Math.abs(s - (muted ? 0 : volume)); if (d < best) { best = d; i = n; } });
    i = (i + (dir || 1) + VOLUME_STEPS.length) % VOLUME_STEPS.length;
    setVolume(VOLUME_STEPS[i]);
    return VOLUME_STEPS[i];
  }
  function volumeLabel() {
    if (muted || volume <= 0) return 'OFF';
    return Math.round(volume * 100) + '%';
  }

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
    swing() { if (!gate('swing', 40)) return; noise({ f0: vary(1900), f1: 380, dur: 0.08, vol: 0.13, filter: 'bandpass', q: 0.9 }); },
    hit(heavy) {
      if (!gate(heavy ? 'hitH' : 'hitL', 30)) return;
      // Transient click, body crunch, then a sub thump for the heavy hits.
      tone({ f0: vary(3400), f1: 900, dur: 0.018, vol: heavy ? 0.26 : 0.2, type: 'square' });
      noise({ f0: vary(heavy ? 520 : 950), f1: 120, dur: heavy ? 0.15 : 0.09, vol: heavy ? 0.52 : 0.38 });
      tone({ f0: vary(heavy ? 150 : 230), f1: 55, dur: heavy ? 0.14 : 0.08, vol: 0.38, type: 'triangle' });
      if (heavy) tone({ f0: 88, f1: 36, dur: 0.2, vol: 0.55, type: 'sine' });
    },
    clank() { if (!gate('clank', 30)) return; tone({ f0: vary(1800), f1: 900, dur: 0.12, vol: 0.18, type: 'square' }); tone({ f0: 3600, f1: 1400, dur: 0.02, vol: 0.14, type: 'square' }); noise({ f0: 3000, f1: 800, dur: 0.08, vol: 0.15, filter: 'highpass' }); tone({ f0: 180, f1: 70, dur: 0.08, vol: 0.28, type: 'triangle' }); },
    hurt() { if (!gate('hurt', 60)) return; tone({ f0: 300, f1: 90, dur: 0.22, vol: 0.35, type: 'sawtooth' }); noise({ f0: 700, f1: 200, dur: 0.15, vol: 0.25 }); tone({ f0: 110, f1: 45, dur: 0.16, vol: 0.4, type: 'sine' }); },
    thud() { if (!gate('thud', 50)) return; tone({ f0: 120, f1: 40, dur: 0.25, vol: 0.5, type: 'sine' }); noise({ f0: 400, f1: 80, dur: 0.2, vol: 0.4 }); },
    // Launcher pop: rising whip so the juggle reads by ear.
    pop() { tone({ f0: 240, f1: 980, dur: 0.12, vol: 0.26, type: 'square' }); noise({ f0: 900, f1: 2600, dur: 0.1, vol: 0.2, filter: 'bandpass', q: 1.4 }); },
    juggle() { if (!gate('juggle', 40)) return; tone({ f0: vary(740, 0.03), f1: 1180, dur: 0.07, vol: 0.18, type: 'triangle' }); },
    // Radio-chirp under a Lance bark. The words are on screen; this says "he spoke".
    voice() { if (!gate('voice', 400)) return; [520, 660, 440].forEach((f, i) => tone({ f0: vary(f, 0.04), dur: 0.035, delay: i * 0.045, vol: 0.07, type: 'square' })); },
    /* Boss tells: one sound per move, plus a shared "last call" click right before impact. */
    tellSlam() { tone({ f0: 196, dur: 0.07, vol: 0.3, type: 'square' }); tone({ f0: 147, dur: 0.09, delay: 0.12, vol: 0.3, type: 'square' }); },
    tellJump() { tone({ f0: 320, f1: 1250, dur: 0.42, vol: 0.2, type: 'sine' }); tone({ f0: 330, f1: 1260, dur: 0.42, vol: 0.08, type: 'triangle', delay: 0.02 }); },
    tellRain() { [1319, 1568, 1760, 2093, 1760].forEach((n, i) => tone({ f0: n, dur: 0.07, delay: i * 0.06, vol: 0.13, type: 'triangle' })); },
    tellSummon() { tone({ f0: 880, dur: 0.1, vol: 0.2, type: 'square' }); tone({ f0: 660, dur: 0.14, delay: 0.12, vol: 0.2, type: 'square' }); },
    lastCall() { if (!gate('lastCall', 90)) return; tone({ f0: 2600, f1: 2000, dur: 0.03, vol: 0.22, type: 'square' }); noise({ f0: 5000, f1: 3000, dur: 0.03, vol: 0.14, filter: 'highpass' }); },
    jump() { tone({ f0: 300, f1: 700, dur: 0.15, vol: 0.2, type: 'square' }); },
    pickup() { tone({ f0: 660, f1: 660, dur: 0.07, vol: 0.2 }); tone({ f0: 880, dur: 0.08, delay: 0.07, vol: 0.2 }); tone({ f0: 1320, dur: 0.12, delay: 0.14, vol: 0.2 }); },
    heal() { for (let i = 0; i < 4; i++) tone({ f0: 523 * Math.pow(1.25, i), dur: 0.12, delay: i * 0.06, vol: 0.18, type: 'triangle' }); },
    chomp() { noise({ f0: 900, f1: 200, dur: 0.12, vol: 0.3 }); tone({ f0: 200, f1: 120, dur: 0.1, vol: 0.2, type: 'square' }); },
    spray() { noise({ f0: 4000, f1: 2500, dur: 0.55, vol: 0.35, filter: 'highpass', attack: 0.02 }); tone({ f0: 2400, f1: 1800, dur: 0.5, vol: 0.05, type: 'sine' }); },
    throwSfx() { noise({ f0: 1200, f1: 3000, dur: 0.2, vol: 0.2, filter: 'bandpass' }); },
    grab() { noise({ f0: 2500, f1: 600, dur: 0.18, vol: 0.25, filter: 'bandpass', q: 2 }); tone({ f0: 400, f1: 500, dur: 0.1, vol: 0.15 }); },
    tape() { noise({ f0: 3500, f1: 1500, dur: 0.25, vol: 0.3, filter: 'bandpass', q: 3 }); },
    enemyDie() { if (!gate('enemyDie', 45)) return; tone({ f0: 500, f1: 80, dur: 0.3, vol: 0.3, type: 'sawtooth' }); noise({ f0: 1500, f1: 200, dur: 0.3, vol: 0.3 }); },
    shuriken() { if (!gate('shuriken', 40)) return; tone({ f0: 1500, f1: 700, dur: 0.15, vol: 0.15, type: 'triangle' }); },
    steam() { if (!gate('steam', 200)) return; noise({ f0: 3000, f1: 1200, dur: 0.6, vol: 0.25, filter: 'highpass', attack: 0.05 }); },
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
    splat() { if (!gate('splat', 40)) return; noise({ f0: 1200, f1: 200, dur: 0.25, vol: 0.35, q: 2 }); tone({ f0: 300, f1: 80, dur: 0.2, vol: 0.2, type: 'triangle' }); },
    levelClear() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((n, i) => tone({ f0: n, dur: 0.18, delay: i * 0.11, vol: 0.22, type: 'square' }));
    },
    gameOver() { [440, 415, 392, 370, 349, 330, 220].forEach((n, i) => tone({ f0: n, dur: 0.3, delay: i * 0.22, vol: 0.25, type: 'triangle' })); },
    oneUp() { [660, 880, 1100, 1320].forEach((n, i) => tone({ f0: n, dur: 0.14, delay: i * 0.08, vol: 0.2 })); },
    break() { if (!gate('break', 40)) return; noise({ f0: 2500, f1: 300, dur: 0.3, vol: 0.4 }); tone({ f0: 800, f1: 200, dur: 0.15, vol: 0.2, type: 'square' }); },
    shatter() { if (!gate('shatter', 40)) return; noise({ f0: 3800, f1: 600, dur: 0.28, vol: 0.45, filter: 'highpass' }); tone({ f0: 1600, f1: 400, dur: 0.12, vol: 0.22, type: 'square' }); },
    clatter() { if (!gate('clatter', 40)) return; noise({ f0: 2000, f1: 400, dur: 0.22, vol: 0.35, filter: 'bandpass' }); tone({ f0: 520, f1: 180, dur: 0.15, vol: 0.25, type: 'triangle' }); },
    whoosh() { noise({ f0: 1200, f1: 180, dur: 0.28, vol: 0.28, filter: 'lowpass', attack: 0.04 }); },
    waveClear() {
      [659, 880, 1046, 1318].forEach((n, i) => tone({ f0: n, dur: 0.14, delay: i * 0.07, vol: 0.28, type: 'square' }));
    },
    /* ---- Story presentation: transitions, stingers, VO placeholders ---- */
    wipe() { noise({ f0: 400, f1: 3200, dur: 0.32, vol: 0.2, filter: 'bandpass', q: 0.8, attack: 0.08 }); tone({ f0: 180, f1: 90, dur: 0.2, vol: 0.12, type: 'sine', delay: 0.18 }); },
    tag() { noise({ f0: 900, f1: 4200, dur: 0.12, vol: 0.14, filter: 'bandpass', q: 1.2 }); tone({ f0: 1175, dur: 0.05, vol: 0.1, type: 'triangle', delay: 0.09 }); },
    impact() {
      // Cinematic hit accent: sub drop, crunch and a short bright tail. A slam and a hit on the same beat play once.
      if (!gate('impact', 120)) return;
      tone({ f0: 70, f1: 30, dur: 0.5, vol: 0.6, type: 'sine' });
      noise({ f0: 2400, f1: 160, dur: 0.35, vol: 0.45 });
      brass([98, 147, 196], 0.35, 0.16);
      duck(0.35, 0.15, 0.5);
    },
    stinger(kind) {
      const k = STINGERS[kind] || STINGERS.stage;
      k();
      duck(0.45, 0.35, 0.8);
    },
    /** Speech babble for one syllable of a typed line. who: lance | captain | narrator. */
    babble(who) {
      if (!gate('babble', 52)) return;
      const v = VOICES[who] || VOICES.narrator;
      if (v.tick) { noise({ f0: 5200, f1: 2600, dur: 0.018, vol: 0.05, filter: 'highpass' }); return; }
      formant(vary(v.f0, 0.12), v.formant, 0.065, v.vol, v.type);
    },
    /** Line-start VO chirp: a short wordless grunt in the speaker's register. */
    voLine(who) {
      const v = VOICES[who] || VOICES.narrator;
      if (v.tick) { tone({ f0: 1568, dur: 0.05, vol: 0.06, type: 'triangle' }); tone({ f0: 2093, dur: 0.07, vol: 0.05, type: 'triangle', delay: 0.05 }); return; }
      v.grunt.forEach(([f0, f1, d, at]) => formant(f0, v.formant, d, v.vol * 1.4, v.type, f1, at));
      duck(0.7, 0.3, 0.4);
    }
  };

  /* A band-passed buzz reads as a voice more than a bare oscillator does. */
  function formant(f0, center, dur, vol, type, f1, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type || 'sawtooth';
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    bp.type = 'bandpass'; bp.frequency.value = center; bp.Q.value = 2.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(bp); bp.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  /* Detuned saws through an opening low-pass: a synth-brass stab. */
  function brass(freqs, dur, vol, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(500, t0); lp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.06); lp.frequency.exponentialRampToValueAtTime(900, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.setValueAtTime(vol, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(g); g.connect(sfxGain);
    for (const f of freqs) for (const d of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    }
  }
  const VOICES = {
    lance: { f0: 118, formant: 620, vol: 0.2, type: 'sawtooth', grunt: [[150, 104, 0.2, 0]] },
    captain: { f0: 196, formant: 1050, vol: 0.16, type: 'square', grunt: [[220, 262, 0.1, 0], [262, 208, 0.14, 0.11]] },
    narrator: { tick: true }
  };
  const STINGERS = {
    alarm() { for (let i = 0; i < 4; i++) tone({ f0: i % 2 ? 660 : 880, dur: 0.2, delay: i * 0.21, vol: 0.13, type: 'square' }); tone({ f0: 80, f1: 40, dur: 0.5, vol: 0.45, type: 'sine' }); },
    phone() { for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { tone({ f0: 440, dur: 0.028, delay: r * 0.55 + i * 0.05, vol: 0.09, type: 'square' }); tone({ f0: 480, dur: 0.028, delay: r * 0.55 + i * 0.05 + 0.025, vol: 0.09, type: 'square' }); } },
    arrive() { brass([131, 165, 196], 0.28, 0.16); brass([175, 220, 262], 0.7, 0.18, 0.26); tone({ f0: 150, f1: 40, dur: 0.14, vol: 0.4, type: 'sine', delay: 0.26 }); },
    crash() { noise({ f0: 6000, f1: 1500, dur: 0.6, vol: 0.4, filter: 'highpass' }); brass([73, 110, 147, 175], 0.6, 0.2); tone({ f0: 60, f1: 28, dur: 0.6, vol: 0.6, type: 'sine' }); },
    stage() { noise({ f0: 300, f1: 2800, dur: 0.3, vol: 0.2, filter: 'bandpass', attack: 0.1 }); brass([147, 220, 294], 0.5, 0.17, 0.26); tone({ f0: 140, f1: 45, dur: 0.18, vol: 0.45, type: 'sine', delay: 0.26 }); },
    fixed() { tone({ f0: 110, f1: 440, dur: 0.9, vol: 0.12, type: 'sine' }); noise({ f0: 900, f1: 3500, dur: 1.1, vol: 0.14, filter: 'bandpass', attack: 0.3 }); [1319, 1760].forEach((n, i) => tone({ f0: n, dur: 0.5, delay: 0.75 + i * 0.1, vol: 0.12, type: 'triangle' })); },
    reveal() { brass([65, 78, 98], 1.1, 0.18); tone({ f0: 52, f1: 40, dur: 1.2, vol: 0.4, type: 'sine' }); [494, 466].forEach((n, i) => tone({ f0: n, dur: 0.4, delay: 0.5 + i * 0.4, vol: 0.07, type: 'triangle' })); },
    boss() { sfx.bossRoar(); brass([58, 69, 87], 0.9, 0.2, 0.15); },
    fanfare() { [523, 659, 784].forEach((n, i) => tone({ f0: n, dur: 0.14, delay: i * 0.09, vol: 0.15, type: 'square' })); brass([262, 330, 392, 523], 0.9, 0.16, 0.28); },
    chill() { noise({ f0: 5000, f1: 1200, dur: 0.8, vol: 0.18, filter: 'highpass', attack: 0.15 }); [2093, 2637, 3136].forEach((n, i) => tone({ f0: n, dur: 0.25, delay: 0.2 + i * 0.08, vol: 0.06, type: 'sine' })); }
  };

  /* Every cue is traced (name + context time) so a test can tell a silent story from a scored one. */
  const trace = [];
  for (const name of Object.keys(sfx)) {
    const fn = sfx[name];
    sfx[name] = function () {
      trace.push({ name: name === 'stinger' ? 'stinger:' + arguments[0] : name, t: ctx ? ctx.currentTime : 0 });
      if (trace.length > 400) trace.splice(0, 100);
      return fn.apply(this, arguments);
    };
  }
  let meter = null, meterBuf = null;
  /** Peak level on the master bus right now (0..1), after mute/volume. */
  function level() {
    if (!ctx || !master) return 0;
    if (!meter) { meter = ctx.createAnalyser(); meter.fftSize = 1024; master.connect(meter); meterBuf = new Float32Array(meter.fftSize); }
    meter.getFloatTimeDomainData(meterBuf);
    let p = 0;
    for (let i = 0; i < meterBuf.length; i++) { const v = Math.abs(meterBuf[i]); if (v > p) p = v; }
    return p;
  }

  /* ---------- Music: step sequencer ---------- */
  // Songs: { bpm, bass: [midi or 0 ...16 steps], lead: [...], arp: root notes per bar }
  const SONGS = {
    title: { bpm: 112, bass: [36, 0, 36, 0, 43, 0, 36, 0, 41, 0, 41, 0, 43, 0, 46, 0], lead: [60, 0, 63, 0, 67, 0, 70, 67, 0, 65, 0, 63, 0, 60, 0, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
    lido: { bpm: 126, bass: [38, 38, 0, 38, 45, 0, 38, 0, 41, 41, 0, 41, 43, 0, 45, 0], lead: [62, 0, 65, 69, 0, 67, 0, 65, 0, 62, 0, 65, 67, 0, 69, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
    plant: { bpm: 132, bass: [33, 33, 0, 33, 33, 0, 36, 0, 31, 31, 0, 31, 31, 0, 35, 36], lead: [57, 0, 0, 60, 0, 57, 0, 0, 55, 0, 0, 59, 0, 60, 0, 62], kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0] },
    spa: { bpm: 120, bass: [40, 0, 0, 40, 0, 47, 0, 0, 38, 0, 0, 38, 0, 45, 0, 0], lead: [64, 67, 0, 71, 0, 0, 67, 0, 62, 66, 0, 69, 0, 0, 66, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
    freezer: { bpm: 138, bass: [31, 31, 0, 31, 0, 31, 34, 0, 30, 30, 0, 30, 0, 30, 33, 0], lead: [55, 0, 58, 0, 62, 0, 58, 55, 54, 0, 57, 0, 61, 0, 57, 54], kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
    boss: { bpm: 150, bass: [29, 29, 29, 0, 32, 0, 29, 0, 27, 27, 27, 0, 30, 0, 28, 0], lead: [53, 0, 56, 60, 0, 56, 53, 0, 51, 0, 54, 58, 0, 54, 51, 0], kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1] },
    // Story bed: slower, half-time drums so VO chirps and stingers sit on top.
    story: { bpm: 92, bass: [33, 0, 0, 33, 0, 0, 40, 0, 38, 0, 0, 38, 0, 0, 36, 35], lead: [69, 0, 0, 0, 72, 0, 71, 0, 67, 0, 0, 0, 64, 0, 0, 0], kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
    victory: { bpm: 100, bass: [36, 0, 43, 0, 41, 0, 43, 0, 36, 0, 43, 0, 45, 0, 43, 0], lead: [67, 0, 72, 0, 76, 0, 74, 72, 67, 0, 72, 0, 77, 0, 76, 74], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] }
  };

  let song = null, songName = null, step = 0, nextTime = 0, timer = null, requested = null;
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
    requested = name;
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
    timer = null; song = null; songName = null; requested = null;
  }

  return {
    init, unlock, sfx, playMusic, stopMusic, toggleMute, setMuted, setVolume, cycleVolume, volumeLabel,
    duck, setMusicLevel, cycleMusic, musicLabel, level, trace,
    get muted() { return muted; }, get unlocked() { return unlocked; }, get volume() { return volume; },
    get musicLevel() { return musicLevel; },
    /** The song the game asked for (set even when WebAudio is unavailable). */
    get song() { return requested; },
    get playing() { return !!timer && !!song; }
  };
})();
