/* Game bootstrap: canvas scaling, main loop, scene flow. */
'use strict';

(function () {
  const W = WL.W, H = WL.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

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

  /* ---- scaling ---- */
  let scale = 1, offX = 0, offY = 0;
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H);
    // crisp integer scaling when close to it
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    const r = canvas.getBoundingClientRect(); offX = r.left; offY = r.top;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();
  function toCanvas(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / (r.width / W), y: (cy - r.top) / (r.height / H) };
  }
  WL.input.attach(canvas, toCanvas);

  // Unlock audio on first user gesture
  const unlock = () => { WL.audio.unlock(); if (game.scene instanceof WL.scenes.Title) WL.audio.playMusic('title'); };
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
    if (WL.input.pressed.mute && !(game.scene && game.scene.paused)) WL.audio.toggleMute();

    // scene fade transition
    if (game.fadeDir === 1) { game.fade = Math.min(1, game.fade + dt * 6); if (game.fade >= 1) { game._swap(); game.fadeDir = -1; } }
    else if (game.fadeDir === -1) { game.fade = Math.max(0, game.fade - dt * 6); if (game.fade <= 0) game.fadeDir = 0; }
    else if (game.nextScene && !game.scene) { game._swap(); }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (loading) drawLoading();
    else if (game.scene) {
      if (game.fadeDir !== 1) game.scene.update(dt, WL.input);
      game.scene.draw(ctx);
    }
    if (game.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${game.fade})`; ctx.fillRect(0, 0, W, H); }
    if (WL.audio.muted) WL.text.draw(ctx, 'MUTE', W - 6, H - 10, { size: 6, align: 'right', color: '#aaa' });
    if (window.location.hash === '#fps') WL.text.draw(ctx, `${fps} FPS`, 4, H - 10, { size: 6, color: '#0f0' });
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
