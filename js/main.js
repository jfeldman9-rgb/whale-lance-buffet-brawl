/* Game bootstrap: canvas scaling, main loop, scene flow. */
'use strict';

(function () {
  const W = WL.W, H = WL.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Everything persistent (display mode, volume, music, overlay opacity,
  // remaps, accessibility) lives in WL.settings under the old key.
  function loadSettings() {
    const s = WL.settings.load();
    WL.display.mode = s.mode;
    WL.audio.setVolume(s.volume);
    if (s.muted && s.volume > 0) WL.audio.setMuted(true);
    WL.audio.setMusicLevel(s.music);
  }
  function saveSettings() {
    WL.settings.set({ mode: WL.display.mode, volume: WL.audio.volume, muted: WL.audio.muted, music: WL.audio.musicLevel });
  }
  loadSettings();
  WL.perf.coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function desktopLayout() {
    // Resolution must not change the input hints or camera lead.
    // A big window is a desktop (or a headless browser that doesn't report a
    // fine pointer). A phone reports a coarse pointer and a narrow window.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const big = window.innerWidth >= 800 && window.innerHeight >= 480;
    if (coarse && !fine) return false;
    return big && (fine || !coarse);
  }

  const game = WL.game = {
    scene: null, nextScene: null, fade: 0, fadeDir: 0,
    setScene(s) { this.nextScene = s; this.fadeDir = 1; },
    _swap() {
      if (this.scene && this.scene.exit) this.scene.exit();
      this.scene = this.nextScene; this.nextScene = null;
      if (this.scene.enter) this.scene.enter();
    },
    /* ---- flow ---- */
    toTitle() { WL.audio.stopMusic(); this.setScene(new WL.scenes.Title(this)); },
    startNewGame(withIntro) {
      if (withIntro) this.setScene(new WL.scenes.Cutscene(this, WL.OPENING, () => this.startLevel(0, {}), 'title'));
      else this.startLevel(0, {});
    },
    startLevel(idx, carry) {
      const L = WL.LEVELS[idx];
      const temps = [94, 88, 81, 75, 72];
      if (L.intro) {
        this.setScene(new WL.scenes.StoryBeat(this, {
          title: L.intro.title, lines: L.intro.lines, tempFrom: temps[idx], tempTo: temps[idx], palette: L.palette, pose: 'carry',
          onDone: () => this.setScene(new WL.scenes.Play(this, idx, carry))
        }));
      } else this.setScene(new WL.scenes.Play(this, idx, carry));
    },
    levelComplete(idx, player) {
      const L = WL.LEVELS[idx];
      const carry = { score: player.score, lives: player.lives, fart: player.fart };
      const temps = [94, 88, 81, 75, 72];
      if (L.boss) { WL.settings.clearRun(); this.showEnding(player.score); return; }
      WL.settings.saveRun({ level: idx + 1, wave: 0, score: player.score, fart: Math.round(player.fart) });
      this.setScene(new WL.scenes.StoryBeat(this, {
        title: 'A/C REPAIR LOG', lines: L.outro.lines, tempFrom: temps[idx], tempTo: temps[idx + 1], palette: L.palette, pose: 'victory',
        onDone: () => this.startLevel(idx + 1, carry)
      }));
    },
    showEnding(score) {
      const beats = WL.ENDING;
      let i = 0;
      const next = () => {
        if (i >= beats.length) { this.setScene(new WL.scenes.Victory(this, score)); return; }
        const b = beats[i++];
        this.setScene(new WL.scenes.StoryBeat(this, { title: i === 1 ? 'THE LAST VALVE' : 'EPILOGUE', lines: b.lines, tempFrom: i === 1 ? 75 : 72, tempTo: 72, palette: '#8fb6dc', pose: 'victory', thin: i > 1, onDone: next }));
      };
      WL.audio.playMusic('victory');
      next();
    },
    gameOver(levelIndex, score, wave) { this.setScene(new WL.scenes.GameOver(this, levelIndex, score, wave)); },
    /** Continue after a wipe: same stage, from `wave` (0 = stage start). Half score, 3 lives. */
    continueGame(levelIndex, score, wave) {
      this.resumeAt(levelIndex, wave | 0, { score: Math.floor(score / 2), lives: 3, fart: 0 });
    },
    resumeAt(levelIndex, wave, carry) {
      this.setScene(new WL.scenes.Play(this, levelIndex, Object.assign({}, carry, { resumeWave: wave })));
    },
    /** Title-screen Continue from the saved checkpoint. */
    continueRun(run) {
      if (!run) { this.startNewGame(true); return; }
      if (run.wave === 0) this.startLevel(run.level, { score: run.score, lives: 3, fart: run.fart });
      else this.resumeAt(run.level, run.wave, { score: run.score, lives: 3, fart: run.fart });
    },
    /* debug helpers (used by automated tests / cheats) */
    debug: {
      level(n) { game.startLevel(n, { score: 0, lives: 3, fart: 0 }); },
      play(n) { game.setScene(new WL.scenes.Play(game, n, { score: 0, lives: 3, fart: 0 })); },
      fillFart() { if (game.scene && game.scene.player) game.scene.player.fart = 100; },
      invuln(v) { if (game.scene) game.scene.cheatInvuln = v !== false; },
      boss() { const s = game.scene; if (!s || !s.level) return; s.waveIdx = s.level.waves.length - 1; s.player.x = s.level.waves[s.waveIdx].x - 10; s.camX = Math.max(0, s.player.x - W * 0.42); }
    }
  };

  /* ---- scaling ----
     The world stays 640x360. The backing store is the CSS box times
     devicePixelRatio, so the browser shows the bitmap 1:1 instead of
     stretching a small canvas (that stretch is what looked blurry on
     retina). Sprites are redrawn in vectors into that buffer, so Lance,
     the HUD, and the decks pick up the extra pixels. Classic mode keeps
     the old 640x360 nearest-neighbor picture. */
  function applyTransform() {
    const rs = WL.display.renderScale || 1;
    ctx.setTransform(rs, 0, 0, rs, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  function resize() {
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    const sharp = desktopLayout();
    WL.display.pc = sharp;
    const rawDpr = Math.max(1, window.devicePixelRatio || 1);
    WL.display.dpr = rawDpr;

    let cssW = vw;
    let cssH = Math.floor(cssW * H / W);
    if (cssH > vh) {
      cssH = vh;
      cssW = Math.floor(cssH * W / H);
    }
    cssW = Math.max(1, cssW);
    cssH = Math.max(1, cssH);

    const classic = WL.display.mode === 'classic';
    // Native device pixels on phones too. Sharp supersamples 1x screens;
    // both modes have a 4K / 8.3 MP ceiling to bound GPU memory and fill cost.
    // Keep an exact 16:9 buffer so circles and input coordinates stay aligned.
    const dpr = WL.display.mode === 'sharp' ? Math.max(2, rawDpr) : rawDpr;
    const bw = classic ? W : Math.min(3840, Math.max(W, Math.ceil(cssW * dpr / 16) * 16));
    const bh = bw * H / W;
    const renderScale = bw / W;
    WL.display.renderScale = renderScale;

    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.width = cssW + 'px';
    canvas.style.height = (cssW * H / W) + 'px';
    // Nearest-neighbor is only appropriate for the explicitly retro mode.
    canvas.style.imageRendering = classic ? 'pixelated' : 'auto';
    canvas.classList.toggle('pc', sharp);
    applyTransform();
  }
  WL.display.resize = resize;
  WL.display.save = saveSettings;
  WL.display.setMode = function (mode) {
    this.mode = mode;
    saveSettings();
    resize();
  };
  WL.display.cycleMode = function (dir) {
    const order = ['auto', 'sharp', 'classic'];
    const i = order.indexOf(this.mode);
    this.setMode(order[(i + (dir < 0 ? -1 : 1) + order.length) % order.length]);
    return this.mode;
  };
  WL.display.toggleFullscreen = function () {
    const el = document.getElementById('stage') || document.documentElement;
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };
  WL.display.modeLabel = function () {
    const s = this.renderScale || 1;
    const scale = (Math.abs(s - Math.round(s)) < 0.05 ? String(Math.round(s)) : s.toFixed(1)) + 'x';
    if (this.mode === 'classic') return 'CLASSIC';
    if (this.mode === 'sharp') return 'SHARP ' + scale;
    return 'AUTO ' + scale;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  // Moving the window onto a retina monitor doesn't always fire resize.
  let dprWatch = null;
  function bindDprWatch() {
    if (dprWatch) dprWatch.removeEventListener('change', onDprChange);
    dprWatch = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprWatch.addEventListener('change', onDprChange);
  }
  function onDprChange() { resize(); bindDprWatch(); }
  bindDprWatch();
  document.addEventListener('fullscreenchange', () => {
    WL.display.fullscreen = !!document.fullscreenElement;
    setTimeout(resize, 50);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    const s = game.scene;
    if (s && s instanceof WL.scenes.Play && s.phase === 'play' && !s.paused) {
      s.paused = true;
      s.pauseSel = 0;
    }
  });
  resize();
  function toCanvas(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / (r.width / W), y: (cy - r.top) / (r.height / H) };
  }
  WL.input.attach(canvas, toCanvas);

  // Unlock audio on first user gesture
  const unlock = () => {
    WL.audio.unlock();
    saveSettings();
    if (game.scene instanceof WL.scenes.Title) WL.audio.playMusic('title');
  };
  window.addEventListener('keydown', unlock, { once: true });
  canvas.addEventListener('pointerdown', unlock, { once: true });

  /* ---- loading ---- */
  let loading = true, progress = 0;
  // Wait briefly for the bundled typeface before caching HUD portraits/text.
  const fontReady = document.fonts ? Promise.race([
    document.fonts.load(`8px ${WL.FONT}`).catch(() => {}),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]) : Promise.resolve();
  Promise.all([WL.assets.load(p => { progress = p; }), fontReady]).then(() => {
    loading = false; game.setScene(new WL.scenes.Title(game));
  });

  /* ---- loop ---- */
  let last = performance.now();
  let fpsT = 0, frames = 0, fps = 0, slowSeconds = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; // tab switch protection
    frames++; fpsT += dt;
    if (fpsT >= 1) {
      fps = frames; frames = 0; fpsT = 0;
      // Three slow seconds in a live fight and AUTO effects drop to LITE.
      const s = game.scene;
      const fighting = s instanceof WL.scenes.Play && s.phase === 'play' && !s.paused && !document.hidden;
      slowSeconds = fighting && fps < 48 ? slowSeconds + 1 : 0;
      if (slowSeconds >= 3 && !WL.perf.runtimeLite) WL.perf.runtimeLite = true;
    }
    WL.input.beginFrame();
    if (WL.input.pressed.fullscreen) WL.display.toggleFullscreen();
    if (WL.input.pressed.mute && !(game.scene && game.scene.paused)) {
      WL.audio.toggleMute();
      saveSettings();
    }

    // scene fade transition
    if (game.fadeDir === 1) { game.fade = Math.min(1, game.fade + dt * 6); if (game.fade >= 1) { game._swap(); game.fadeDir = -1; } }
    else if (game.fadeDir === -1) { game.fade = Math.max(0, game.fade - dt * 6); if (game.fade <= 0) game.fadeDir = 0; }
    else if (game.nextScene && !game.scene) { game._swap(); }

    const rs = WL.display.renderScale || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    applyTransform();
    if (loading) drawLoading();
    else if (game.scene) {
      if (game.fadeDir !== 1) game.scene.update(dt, WL.input);
      game.scene.draw(ctx);
    }
    if (game.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${game.fade})`; ctx.fillRect(0, 0, W, H); }
    if (WL.audio.muted) WL.text.draw(ctx, 'MUTE', W - 6, H - 10, { size: 6, align: 'right', color: '#aaa' });
    if (window.location.hash === '#fps') {
      WL.text.draw(ctx, `${fps} FPS  ${rs}x`, 4, H - 10, { size: 6, color: '#0f0' });
    }
    requestAnimationFrame(frame);
  }
  function drawLoading() {
    ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, W, H);
    WL.text.draw(ctx, 'WHALE LANCE', W / 2, 120, { size: 20, align: 'center', gradient: ['#fff3a0', '#ffb300', '#e0301e'], stroke: '#000', strokeWidth: 5 });
    WL.text.draw(ctx, 'BUFFET BRAWL', W / 2, 150, { size: 26, align: 'center', gradient: ['#ffffff', '#ffd23f', '#ff4d00'], stroke: '#000', strokeWidth: 6 });
    WL.draw.bar(ctx, W / 2 - 100, 220, 200, 8, progress, '#ffe14a', '#333');
    WL.text.draw(ctx, 'PREHEATING THE BUFFET...', W / 2, 240, { size: 7, align: 'center', color: '#bcd' });
  }
  requestAnimationFrame(frame);
})();
