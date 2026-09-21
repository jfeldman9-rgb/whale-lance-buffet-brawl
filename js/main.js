/* Game bootstrap: canvas scaling, main loop, scene flow. */
'use strict';

(function () {
  const W = WL.W, H = WL.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = false;

  const SETTINGS_KEY = 'wl-settings';
  function loadSettings() {
    try {
      const p = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (p.mode === 'auto' || p.mode === 'sharp' || p.mode === 'classic') WL.display.mode = p.mode;
      if (typeof p.volume === 'number') WL.audio.setVolume(p.volume);
    } catch (e) { /* private mode */ }
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode: WL.display.mode, volume: WL.audio.volume }));
    } catch (e) { /* private mode */ }
  }
  loadSettings();

  function wantsSharp() {
    if (WL.display.mode === 'classic') return false;
    if (WL.display.mode === 'sharp') return true;
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
      if (L.boss) { this.showEnding(player.score); return; }
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
    gameOver(levelIndex, score) { this.setScene(new WL.scenes.GameOver(this, levelIndex, score)); },
    continueGame(levelIndex, score) { this.startLevel(levelIndex, { score: Math.floor(score / 2), lives: 3, fart: 0 }); },
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
     Phone / classic: 640x360 backing store, CSS-stretched with nearest-neighbor.
     Desktop sharp: draw the same 640x360 world into a 2x or 3x backing store so
     the procedural sprites rasterize at monitor resolution, then display that
     buffer 1:1 (or smoothly downscaled if the window isn't an integer fit). */
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fit = Math.min(vw / W, vh / H);
    const sharp = wantsSharp();
    WL.display.pc = sharp;
    let renderScale = 1;
    let cssW, cssH, smoothing;
    if (sharp && fit >= 2) {
      renderScale = Math.min(3, Math.floor(fit));
      cssW = W * renderScale;
      cssH = H * renderScale;
      smoothing = 'pixelated';
    } else if (sharp && fit >= 1.15) {
      // Supersample at 2x and let the browser scale down into the window.
      renderScale = 2;
      cssW = Math.max(1, Math.floor(W * fit));
      cssH = Math.max(1, Math.floor(H * fit));
      smoothing = 'auto';
    } else {
      renderScale = 1;
      cssW = Math.max(1, Math.floor(W * Math.max(fit, 0.01)));
      cssH = Math.max(1, Math.floor(H * Math.max(fit, 0.01)));
      smoothing = 'pixelated';
    }
    WL.display.renderScale = renderScale;
    if (canvas.width !== W * renderScale || canvas.height !== H * renderScale) {
      canvas.width = W * renderScale;
      canvas.height = H * renderScale;
    }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.imageRendering = smoothing;
    canvas.classList.toggle('pc', sharp);
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  WL.display.resize = resize;
  WL.display.save = saveSettings;
  WL.display.setMode = function (mode) {
    this.mode = mode;
    saveSettings();
    resize();
  };
  WL.display.cycleMode = function () {
    const order = ['auto', 'sharp', 'classic'];
    const i = order.indexOf(this.mode);
    this.setMode(order[(i + 1) % order.length]);
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
    const scale = this.renderScale + 'x';
    if (this.mode === 'classic') return 'CLASSIC';
    if (this.mode === 'sharp') return 'SHARP ' + scale;
    return 'AUTO ' + (this.pc ? 'SHARP ' + scale : 'CLASSIC');
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  document.addEventListener('fullscreenchange', () => {
    WL.display.fullscreen = !!document.fullscreenElement;
    setTimeout(resize, 50);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !WL.display.pc) return;
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
  WL.assets.load(p => { progress = p; }).then(() => { loading = false; game.setScene(new WL.scenes.Title(game)); });

  /* ---- loop ---- */
  let last = performance.now();
  let fpsT = 0, frames = 0, fps = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; // tab switch protection
    frames++; fpsT += dt; if (fpsT >= 1) { fps = frames; frames = 0; fpsT = 0; }
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
    ctx.setTransform(rs, 0, 0, rs, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
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
