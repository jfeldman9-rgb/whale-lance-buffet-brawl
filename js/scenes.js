/* Scenes: Title, Cutscene (opening panels), StoryBeat (between stages),
   Play (the beat-em-up), GameOver, Ending/Victory. */
'use strict';

(function () {
  const U = WL.util, D = WL.draw, T = WL.text, S = WL.sprites;
  const W = WL.W, H = WL.H, FT = WL.FLOOR_TOP, FB = WL.FLOOR_BOTTOM;
  const E = WL.entities;
  const A = WL.audio;

  const anyPress = (inp) => inp.pressed.start || inp.pressed.attack || inp.pressed.jump || inp.pressed.click;
  const confirmWord = () => (WL.input.touchEnabled ? 'TAP' : 'ENTER');

  const hudHead = { key: '', canvas: null };
  function drawHudHead(ctx, mood) {
    const rs = (WL.display && WL.display.renderScale) || 1;
    const key = mood + '@' + rs;
    if (hudHead.key !== key || !hudHead.canvas) {
      const w = 28, h = 32;
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * rs); c.height = Math.ceil(h * rs);
      const g = c.getContext('2d');
      g.setTransform(rs, 0, 0, rs, 0, 0);
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#3a78c8';
      g.fillRect(0, 0, w, h);
      S.lanceHead(g, 14, 18, 30, { mood });
      hudHead.key = key; hudHead.canvas = c;
    }
    ctx.drawImage(hudHead.canvas, 7, 6, 28, 32);
  }

  /* ================================================================== */
  /* Title                                                              */
  /* ================================================================== */
  class Title {
    constructor(game) { this.game = game; this.t = 0; this.sel = 0; this.items = ['START GAME', 'SKIP INTRO', 'HOW TO PLAY']; this.showHelp = false; }
    enter() { A.playMusic('title'); }
    update(dt, inp) {
      this.t += dt;
      if (this.showHelp) { if (anyPress(inp) || inp.pressed.pause) { this.showHelp = false; A.sfx.blip(); } return; }
      if (inp.pressed.down) { this.sel = (this.sel + 1) % this.items.length; A.sfx.blip(); }
      if (inp.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; A.sfx.blip(); }
      if (inp.pressed.click && inp.pointer && inp.pointer.type === 'mouse') {
        const y0 = 214;
        for (let i = 0; i < this.items.length; i++) {
          const y = y0 + i * 20;
          if (inp.pointer.y >= y - 3 && inp.pointer.y < y + 16 && Math.abs(inp.pointer.x - (W / 2 - 80)) < 130) {
            this.sel = i; this.choose(); return;
          }
        }
      }
      if (inp.pressed.click && WL.input.touchEnabled) {
        A.sfx.select(); this.game.startNewGame(true); return;
      }
      if (inp.pressed.start || inp.pressed.attack || inp.pressed.jump) this.choose();
    }
    choose() {
      A.sfx.select();
      if (this.sel === 0) this.game.startNewGame(true);
      else if (this.sel === 1) this.game.startNewGame(false);
      else this.showHelp = true;
    }
    draw(ctx) {
      const t = this.t;
      // sunset sky
      const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#1b1f5a'); g.addColorStop(0.5, '#c8407a'); g.addColorStop(1, '#ffb347');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
      D.circle(ctx, 500, 150, 40, '#ffe680');
      // ocean
      const og = ctx.createLinearGradient(0, 190, 0, H); og.addColorStop(0, '#2a4a9a'); og.addColorStop(1, '#0b1a3a');
      ctx.fillStyle = og; ctx.fillRect(0, 190, W, H - 190);
      ctx.fillStyle = 'rgba(255,220,150,0.35)'; for (let i = 0; i < 30; i++) { const wx = ((i * 71 + t * 20) % (W + 40)) - 20; ctx.fillRect(wx, 196 + (i * 17) % 150, 10 + (i % 4) * 8, 1.5); }
      // ship silhouette (Pride of America)
      ctx.save(); ctx.translate(((t * 12) % (W + 500)) - 250, 0);
      ctx.fillStyle = '#f4f4f8';
      ctx.beginPath(); ctx.moveTo(0, 190); ctx.lineTo(30, 160); ctx.lineTo(300, 160); ctx.lineTo(330, 190); ctx.closePath(); ctx.fill();
      ctx.fillRect(50, 130, 230, 30); ctx.fillRect(80, 110, 170, 20); D.fillRRect(ctx, 200, 90, 40, 22, 4, '#1b3f8a');
      // flag mural
      ctx.fillStyle = '#c8322a'; for (let i = 0; i < 4; i++) ctx.fillRect(40, 166 + i * 6, 120, 3);
      ctx.fillStyle = '#1b3f8a'; ctx.fillRect(40, 164, 40, 12); ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(44 + (i % 3) * 12, 166 + Math.floor(i / 3) * 6, 3, 3);
      ctx.fillStyle = '#1b3f8a'; for (let i = 0; i < 20; i++) ctx.fillRect(60 + i * 11, 136, 6, 6); for (let i = 0; i < 14; i++) ctx.fillRect(90 + i * 11, 114, 6, 5);
      ctx.restore();
      // logo
      const bounce = Math.sin(t * 2) * 3;
      T.draw(ctx, 'WHALE LANCE AIR CONDITIONING AND HEATING PRESENTS', W / 2, 14, { size: 7, align: 'center', color: '#ffe' });
      T.draw(ctx, 'WHALE LANCE', W / 2 - 80, 40 + bounce, { size: 26, align: 'center', gradient: ['#fff3a0', '#ffb300', '#e0301e'], stroke: '#2a0a0a', strokeWidth: 6 });
      T.draw(ctx, 'BUFFET BRAWL', W / 2 - 80, 78 + bounce, { size: 40, align: 'center', gradient: ['#ffffff', '#ffd23f', '#ff4d00'], stroke: '#2a0a0a', strokeWidth: 8 });
      // whale logo
      ctx.save(); ctx.translate(W / 2 - 80, 130); D.ellipse(ctx, 0, 0, 30, 14, '#fff', S.OUT); ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(44, -18); ctx.lineTo(42, 4); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); D.circle(ctx, -14, -3, 2, S.OUT);
      ctx.fillStyle = '#fff'; ctx.fillRect(-4, -20, 2, 8); ctx.fillRect(-8, -18, 2, 6); ctx.fillRect(0, -18, 2, 6); ctx.restore();
      T.draw(ctx, '"WE SPEAR THE COMPETITION"', W / 2 - 80, 148, { size: 7, align: 'center', color: '#ffe' });
      T.draw(ctx, 'THE SALAD BAR STARTED IT.', W / 2 - 80, 164, { size: 6, align: 'center', color: '#ffe9a0' });
      // Lance portrait
      const img = WL.assets.get('lancePortrait');
      if (img) { const s = 190 / img.height; ctx.drawImage(img, W - 30 - img.width * s, 40 + Math.sin(t * 2) * 2, img.width * s, img.height * s); }
      else S.drawLanceBust(ctx, W - 112, 150 + Math.sin(t * 2) * 2, 78, { mood: 'grin' });
      // menu
      if (!this.showHelp) {
        const y0 = 214;
        this.items.forEach((it, i) => {
          const seld = i === this.sel;
          T.draw(ctx, (seld ? '> ' : '  ') + it, W / 2 - 80, y0 + i * 20, { size: 11, align: 'center', color: seld ? (Math.floor(t * 6) % 2 ? '#ffe14a' : '#fff') : '#cfd' });
        });
        if (Math.floor(t * 2) % 2 === 0) T.draw(ctx, WL.input.touchEnabled ? 'TAP TO START' : 'PRESS ENTER OR CLICK', W / 2 - 80, 284, { size: 9, align: 'center', color: '#fff' });
        const keys = WL.input.gamepad.connected
          ? 'PAD: STICK MOVE   X ATK   A JUMP   Y SPRAY   RB BOX   B FART   START PAUSE'
          : 'WASD/ARROWS MOVE   E/J ATK   SPACE/K JUMP   Q/L SPRAY   R/I BOX   F FART';
        T.draw(ctx, keys, W / 2, 318, { size: 6, align: 'center', color: '#bcd' });
        T.draw(ctx, 'ESC PAUSE    M MUTE    \\ FULLSCREEN    CLICK A MENU ROW', W / 2, 332, { size: 6, align: 'center', color: '#9ab' });
        T.draw(ctx, '(c) 2026 WHALE LANCE A/C & HEATING. INSERT COIN. A FAMILY ROAST.', W / 2, 346, { size: 5, align: 'center', color: '#89a' });
        if (WL.display.pc) T.draw(ctx, WL.display.modeLabel(), 8, 6, { size: 6, color: '#cde' });
      } else this.drawHelp(ctx);
      D.scanlines(ctx, 0.08);
    }
    drawHelp(ctx) {
      D.fillRRect(ctx, 30, 24, W - 60, H - 48, 6, 'rgba(0,0,20,0.9)', '#ffe14a');
      const lines = [
        ['HOW TO PLAY', '#ffe14a'],
        ['MOVE      Arrows or WASD. Gamepad stick or d-pad. Touch stick on phones.', '#fff'],
        ['ATTACK    E, J or Z       screwdriver, then wrench, then pipe wrench', '#fff'],
        ['GRAB      Walk into an enemy = duct-tape grab', '#fff'],
        ['          ATTACK again = knee. Back+ATTACK or JUMP = throw', '#fff'],
        ['JUMP      Space, K or X    ATTACK in the air = flying boot', '#fff'],
        ['SPRAY     Q, L or C       Refrigerant spray. Freezes. Costs a little HP.', '#fff'],
        ['TOOLBOX   R, I or V       Throw the toolbox. Pick it back up!', '#fff'],
        ['FART      F or B          VOLCANO FART when the green meter is full', '#9f3'],
        ['PAD       X atk   A jump   Y spray   RB box   B fart   Start pause', '#bcd'],
        ['ESC pause    M mute    \\ fullscreen    Burgers heal. Froyo is 2x.', '#aaa'],
        ['Press any key to go back', '#aaa']
      ];
      lines.forEach(([l, c], i) => T.draw(ctx, l, 44, 36 + i * 22, { size: i === 0 ? 11 : 7, color: c }));
    }
  }

  /* ================================================================== */
  /* Cutscene: sequence of art panels with captions                     */
  /* ================================================================== */
  class Cutscene {
    constructor(game, panels, onDone, music) { this.game = game; this.panels = panels; this.onDone = onDone; this.idx = 0; this.t = 0; this.chars = 0; this.music = music; }
    enter() { if (this.music) A.playMusic(this.music); }
    get panel() { return this.panels[this.idx]; }
    fullText() { return this.panel.lines.join('\n'); }
    update(dt, inp) {
      this.t += dt; this.chars += dt * 38;
      const full = this.fullText().length;
      if (inp.pressed.pause) { A.sfx.select(); this.onDone(); return; }
      if (anyPress(inp)) {
        A.sfx.blip();
        if (this.chars < full) this.chars = full;
        else this.next();
      } else if (this.chars > full && this.t > 7.5) this.next();
    }
    next() { this.idx++; this.t = 0; this.chars = 0; if (this.idx >= this.panels.length) this.onDone(); }
    draw(ctx) {
      const p = this.panel; if (!p) return;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const img = WL.assets.get(p.img);
      const boxH = 74;
      if (img) {
        // backdrop: darkened blow-up of the same panel fills the side bars
        const cs = Math.max(W / img.width, H / img.height) * 1.1;
        ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(img, (W - img.width * cs) / 2, (H - img.height * cs) / 2, img.width * cs, img.height * cs); ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
        // the panel itself, fully visible above the caption box, with a slow Ken-Burns zoom
        const areaH = H - boxH + 2;
        const zoom = 1 + Math.min(this.t, 8) * 0.005;
        const s = Math.min(W / img.width, areaH / img.height) * zoom;
        const dw = img.width * s, dh = img.height * s;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, areaH); ctx.clip();
        ctx.drawImage(img, (W - dw) / 2, (areaH - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        // procedural stand-in panel
        const g = ctx.createLinearGradient(0, 0, 0, H - boxH); g.addColorStop(0, '#1b3f8a'); g.addColorStop(1, '#0b1a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H - boxH);
        T.draw(ctx, p.title, W / 2, 110, { size: 18, align: 'center', gradient: ['#fff3a0', '#ff4d00'], stroke: '#000', strokeWidth: 5 });
        S.drawLance(ctx, W / 2, 250, { pose: 'idle', t: this.t, facing: 1 });
      }
      // caption box
      D.fillRRect(ctx, 8, H - boxH + 4, W - 16, boxH - 10, 4, 'rgba(8,8,24,0.92)', '#ffe14a');
      T.draw(ctx, p.title, 18, H - boxH + 12, { size: 8, color: '#ffe14a' });
      const shown = this.fullText().slice(0, Math.floor(this.chars)).split('\n');
      shown.forEach((l, i) => T.draw(ctx, l, 18, H - boxH + 28 + i * 12, { size: 7, color: '#fff' }));
      T.draw(ctx, `${this.idx + 1}/${this.panels.length}`, W - 18, H - boxH + 12, { size: 7, align: 'right', color: '#aaa' });
      if (Math.floor(this.t * 2) % 2 === 0) T.draw(ctx, confirmWord(), W - 18, H - 18, { size: 7, align: 'right', color: '#aaa' });
      T.draw(ctx, 'P: SKIP', 18, H - 18, { size: 6, color: '#777' });
    }
  }

  /* ================================================================== */
  /* StoryBeat: between-stage repair scene with a thermometer           */
  /* ================================================================== */
  class StoryBeat {
    constructor(game, o) {
      // o: {title, lines, tempFrom, tempTo, palette, onDone, pose, thin}
      this.game = game; Object.assign(this, o); this.t = 0; this.chars = 0;
    }
    enter() { A.playMusic(this.music || 'title'); }
    fullText() { return this.lines.join('\n'); }
    update(dt, inp) {
      this.t += dt; this.chars += dt * 40;
      const full = this.fullText().length;
      if (anyPress(inp) || inp.pressed.pause) { A.sfx.blip(); if (this.chars < full) this.chars = full; else this.onDone(); }
      else if (this.chars > full && this.t > 7) this.onDone();
    }
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05050f'); g.addColorStop(1, this.palette || '#1b2230'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // floor line
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 262, W, H - 262);
      // ducts
      for (let i = 0; i < 4; i++) D.fillRRect(ctx, 20 + i * 160, 30 + (i % 2) * 14, 120, 16, 8, '#5b6b7c', S.OUT);
      // Lance working
      S.drawLance(ctx, 150, 262, { pose: this.pose || 'carry', t: this.t, facing: 1, thin: this.thin });
      // thermometer
      const tx = 470, ty = 50, th = 150;
      D.fillRRect(ctx, tx - 14, ty - 10, 28, th + 30, 12, '#eee', S.OUT);
      D.fillRRect(ctx, tx - 6, ty, 12, th, 6, '#bbb', S.OUT);
      const from = this.tempFrom, to = this.tempTo;
      const k = U.clamp((this.t - 0.6) / 2.5, 0, 1);
      const cur = U.lerp(from, to, k);
      const pct = U.clamp((cur - 60) / 40, 0, 1);
      const hcol = cur > 85 ? '#e03020' : cur > 76 ? '#f0a020' : '#30a0e0';
      ctx.fillStyle = hcol; ctx.fillRect(tx - 4, ty + th - th * pct, 8, th * pct);
      D.circle(ctx, tx, ty + th + 8, 12, hcol, S.OUT);
      for (let i = 0; i <= 4; i++) { ctx.fillStyle = '#333'; ctx.fillRect(tx + 10, ty + i * (th / 4), 8, 2); T.draw(ctx, `${100 - i * 10}`, tx + 22, ty + i * (th / 4) - 4, { size: 6, color: '#ddd' }); }
      T.draw(ctx, 'SHIP TEMP', tx, ty - 34, { size: 8, align: 'center', color: '#fff' });
      T.draw(ctx, `${Math.round(cur)}°F`, tx, ty + th + 34, { size: 14, align: 'center', color: hcol, stroke: '#000' });
      // text box
      D.fillRRect(ctx, 8, 274, W - 16, 78, 4, 'rgba(8,8,24,0.92)', '#ffe14a');
      T.draw(ctx, this.title, 18, 282, { size: 8, color: '#ffe14a' });
      const shown = this.fullText().slice(0, Math.floor(this.chars)).split('\n');
      shown.forEach((l, i) => T.draw(ctx, l, 18, 298 + i * 13, { size: 7, color: '#fff' }));
      if (Math.floor(this.t * 2) % 2 === 0) T.draw(ctx, confirmWord(), W - 18, H - 16, { size: 7, align: 'right', color: '#aaa' });
    }
  }

  /* ================================================================== */
  /* FX manager                                                         */
  /* ================================================================== */
  class FX {
    constructor() { this.list = []; }
    spark(x, y, big) { this.list.push({ kind: 'spark', x, y, t: 0, life: 0.22, big }); }
    dust(x, y, r) { for (let i = 0; i < 4; i++) this.list.push({ kind: 'dust', x: x + U.rand(-8, 8), y: y + U.rand(-3, 3), t: -i * 0.03, life: 0.5, r: (r || 6) * U.rand(0.6, 1) }); }
    text(x, y, str, color, life) { this.list.push({ kind: 'text', x, y, t: 0, life: life || 1.1, str, color: color || '#fff', vy: -30 }); }
    burst(x, y, type) {
      const V = S.VEG[type]; const cols = V ? [V.body || V.swirl, V.dark || V.cup, '#fff'] : ['#fff'];
      for (let i = 0; i < 10; i++) this.list.push({ kind: 'chunk', x, y, vx: U.rand(-160, 160), vy: U.rand(-260, -60), t: 0, life: 0.8, color: U.pick(cols), r: U.rand(2, 5) });
    }
    fartBurst(x, y) {
      const cols = ['#d8ff8a', '#7ad83a', '#5a8a2a', '#efe6c8', '#c8a15a'];
      for (let i = 0; i < 22; i++) this.list.push({ kind: 'chunk', x, y, vx: U.rand(-420, 420), vy: U.rand(-460, -40), t: 0, life: 0.85, color: U.pick(cols), r: U.rand(2, 6), square: i % 3 === 0 });
    }
    debris(x, y, kind) {
      const cols = kind === 'crate' ? ['#b07a3a', '#6a4218'] : kind === 'barrel' ? ['#4a8a3a', '#2a5a20'] : kind === 'vending' ? ['#2a8a5a', '#0a1a2a', '#d33'] : ['#d0d4dc', '#8a8f9a', '#c8322a'];
      for (let i = 0; i < 14; i++) this.list.push({ kind: 'chunk', x, y, vx: U.rand(-200, 200), vy: U.rand(-300, -80), t: 0, life: 0.9, color: U.pick(cols), r: U.rand(2, 6), square: true });
    }
    update(dt) {
      for (const f of this.list) {
        f.t += dt;
        if (f.kind === 'chunk') { f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
        if (f.kind === 'text') f.y += f.vy * dt;
      }
      this.list = this.list.filter(f => f.t < f.life);
    }
    draw(ctx, camX) {
      for (const f of this.list) {
        if (f.t < 0) continue;
        const sx = f.x - camX;
        switch (f.kind) {
          case 'spark': S.drawHitSpark(ctx, sx, f.y, f.t, f.big); break;
          case 'dust': S.drawDust(ctx, sx, f.y, f.t, f.r); break;
          case 'chunk': ctx.save(); ctx.globalAlpha = 1 - f.t / f.life; if (f.square) { ctx.fillStyle = f.color; ctx.fillRect(sx - f.r / 2, f.y - f.r / 2, f.r, f.r); } else D.circle(ctx, sx, f.y, f.r, f.color); ctx.restore(); break;
          case 'text': ctx.save(); ctx.globalAlpha = Math.min(1, (f.life - f.t) * 2); T.draw(ctx, f.str, sx, f.y, { size: 8, align: 'center', color: f.color, stroke: '#000', strokeWidth: 3 }); ctx.restore(); break;
        }
      }
    }
  }

  /* ================================================================== */
  /* Play                                                               */
  /* ================================================================== */
  class Play {
    constructor(game, levelIndex, carry) {
      this.game = game; this.levelIndex = levelIndex; this.level = WL.LEVELS[levelIndex];
      this.carry = carry || {};
      this.t = 0; this.camX = 0; this.locked = false; this.waveIdx = 0; this.groupIdx = 0;
      this.enemies = []; this.pickups = []; this.objects = []; this.projectiles = []; this.puddles = []; this.hazards = [];
      this.fx = new FX();
      this.hitstop = 0; this.shakeAmt = 0; this.shakeT = 0; this.shakeX = 0; this.shakeY = 0;
      this.punchX = 0; this.punchY = 0;
      this.paused = false; this.pauseSel = 0; this.pauseLatch = false;
      this.phase = 'intro'; this.phaseT = 0; // intro | play | clear | bossdead | dead
      this.banner = null; this.bannerT = 0;
      this.tutorial = null; this.tutorialT = 0;
      this.cards = []; this.seen = {}; this.barkCd = 0; this.comboRankT = 0; this.comboRank = '';
      this.fartT = -1; this.fartX = 0; this.fartY = 0; this.flashT = 0; this.flashColor = '#fff';
      this.kills = 0; this.boss = null;
      this.goArrowT = 0;
      this.puddleTick = 0;
      this.cheatInvuln = false;
    }
    enter() {
      const L = this.level;
      this.player = new E.Player(this, 80, (FT + FB) / 2);
      if (this.carry.score !== undefined) this.player.score = this.carry.score;
      if (this.carry.lives !== undefined) this.player.lives = this.carry.lives;
      if (this.carry.fart !== undefined) this.player.fart = this.carry.fart;
      for (const o of L.objects || []) this.objects.push(new E.Breakable(this, o.kind, o.x, o.y, o.contents));
      for (const p of L.pickups || []) this.pickups.push(new E.Pickup(this, p.kind, p.x, p.y, false));
      for (const h of L.hazards || []) this.hazards.push({ ...h, hit: new Set(), wasActive: false });
      A.playMusic(L.music);
      const b = L.banner || [`STAGE ${L.id}`, L.name];
      this.showBanner(b[0], b[1], 2.3);
    }
    /* ---- helpers used by entities ---- */
    playerBounds() {
      const max = this.locked ? this.camX + W - 14 : Math.min(this.camX + W - 14, this.level.length + 200);
      return { min: this.camX + 14, max };
    }
    attackers() { let n = 0; for (const e of this.enemies) if (!e.dead && ['windup', 'prime', 'attack', 'dash', 'charge'].includes(e.state)) n++; return n; }
    shake(a, d) { this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = Math.max(this.shakeT, d); }
    impact(dir, kind) {
      const table = {
        light: { stop: 0.05, punch: 5, y: -1, shake: 2.4, shakeT: 0.09 },
        heavy: { stop: 0.09, punch: 9, y: 3, shake: 5.5, shakeT: 0.16, flash: 0.045, flashColor: '#fff6d0' },
        boss: { stop: 0.1, punch: 11, y: 4, shake: 8, shakeT: 0.28 },
        fart: { stop: 0.18, punch: 3, y: -8, shake: 16, shakeT: 0.95 }
      };
      const s = table[kind] || table.light;
      this.hitstop = Math.max(this.hitstop, s.stop);
      this.punchX = U.clamp(this.punchX + (dir || 1) * s.punch, -16, 16);
      this.punchY = U.clamp(this.punchY + s.y, -12, 12);
      this.shake(s.shake, s.shakeT);
      if (s.flash) { this.flashT = Math.max(this.flashT, s.flash); this.flashColor = s.flashColor; }
      if (kind === 'heavy' || kind === 'boss') { if (WL.input.rumble) WL.input.rumble(kind === 'boss' ? 90 : 50, 0.55, 0.3); }
    }
    bark(id) {
      if (this.barkCd > 0 || !this.player) return;
      const line = WL.voice && WL.voice.bark(id);
      if (!line) return;
      this.fx.text(this.player.x, this.player.y - 116, line, '#fff4c2', 1.25);
      this.barkCd = 2.05;
    }
    onCombo(before, after) {
      const rank = WL.voice && WL.voice.comboCross(before, after);
      if (!rank) return;
      this.comboRank = rank; this.comboRankT = 1.55;
      if (after >= 8) this.hitstop = Math.max(this.hitstop, 0.07);
      if (after >= 12 && this.player) this.punchX = U.clamp(this.punchX + this.player.facing * 4, -16, 16);
    }
    noteEnemy(type) {
      if (this.seen[type]) return;
      this.seen[type] = true;
      const card = WL.voice && WL.voice.enemyIntro(type);
      if (card) this.cards.push({ name: card.name, line: card.line, t: 2.45 });
    }
    spawnEnemy(type, x, y, opts = {}) {
      const e = new E.Enemy(this, type, x, U.clamp(y, FT, FB), opts); e.setState('spawn'); this.enemies.push(e);
      this.noteEnemy(type);
      return e;
    }
    spawnPickup(kind, x, y, pop) { this.pickups.push(new E.Pickup(this, kind, x, y, pop)); }
    onEnemyKilled(e) { this.kills++; }
    showBanner(a, b, dur, big) { this.banner = { a, b, big: !!big }; this.bannerT = dur || 2; }
    showTutorial(txt) { this.tutorial = txt; this.tutorialT = 5.5; }
    onBossPhase(n) {
      if (n === 2) { this.showBanner('THE SWIRL CRACKS', 'TOPPINGS. FROM ABOVE.', 2.1); this.fx.text(this.boss.x, this.boss.y - 180, '"TOPPINGS ARE MANDATORY."', '#fff', 2); }
      if (n === 3) { this.showBanner('MELTDOWN', 'THE PUDDLE HAS OPINIONS.', 2.1); this.fx.text(this.boss.x, this.boss.y - 180, '"98% GRUDGE. 2% MILKFAT."', '#f9c', 2.2); A.sfx.bossRoar(); }
      A.sfx.bossRoar(); this.impact(this.boss && this.boss.facing || 1, 'boss');
      // the dessert station coughs up some real food between phases
      this.spawnPickup('burger', this.camX + 120, U.rand(FT + 20, FB - 20), true);
      this.spawnPickup(n === 2 ? 'chili' : 'beans', this.camX + W - 120, U.rand(FT + 20, FB - 20), true);
    }
    bossDefeated() {
      this.phase = 'bossdead'; this.phaseT = 0; this.player.won = true; this.player.setState('victory');
      A.stopMusic(); A.sfx.levelClear();
      this.showBanner('THE CONE MELTS', '72°F. YOU CAN BREATHE.', 4);
      for (const e of this.enemies) if (!e.dead && !e.isBoss) e.die(1);
    }
    playerDied() {
      const p = this.player;
      p.lives--;
      if (p.lives > 0) { p.respawn(this.camX + 80, (FT + FB) / 2); this.fx.text(p.x, p.y - 100, (WL.voice && WL.voice.bark('respawn')) || 'STILL ON THE CLOCK.', '#ffe14a', 2); A.sfx.oneUp(); }
      else { this.phase = 'dead'; this.phaseT = 0; A.stopMusic(); A.sfx.gameOver(); }
    }
    triggerFart() {
      const p = this.player;
      this.fartT = 0; this.fartX = p.x; this.fartY = p.y;
      this.flashT = 0.32; this.flashColor = '#e7ff9a';
      A.sfx.fart(); p.fart = 0;
      if (WL.input.rumble) WL.input.rumble(240, 1, 0.45);
      const sub = (WL.voice && WL.voice.fartLine()) || 'THE HVAC SPECIAL.';
      this.showBanner((WL.voice && WL.voice.fartTitle) || 'VOLCANO FART', sub, 1.7, true);
      this.fx.fartBurst(p.x, p.y - 20);
      let n = 0;
      for (const e of this.enemies) {
        if (e.dead || e.x < this.camX - 80 || e.x > this.camX + W + 80) continue;
        if (e.isBoss) { e.hurt(130, p.x, { fart: true }); n++; continue; }
        const dir = e.x < p.x ? -1 : 1;
        e.hp = 0; e.die(dir); e.vx = dir * U.rand(520, 760); e.vz = U.rand(380, 520); n++;
      }
      for (const o of this.objects) if (!o.dead && o.x > this.camX - 40 && o.x < this.camX + W + 40) o.hit(this, 9);
      for (const pr of this.projectiles) if (pr.owner === 'enemy') pr.remove = true;
      if (n) { p.registerHits(n); p.addScore(n * 150); }
      this.impact(p.facing, 'fart');
    }

    /* ---- wave logic ---- */
    currentWave() { return this.level.waves[this.waveIdx]; }
    aliveEnemies() { return this.enemies.filter(e => !e.dead).length; }
    spawnGroup(group) {
      for (const [type, count, opts] of group) {
        for (let i = 0; i < count; i++) {
          const side = (opts && opts.side) || (i % 2 ? -1 : 1);
          const x = side > 0 ? this.camX + W + 30 + i * 26 : this.camX - 30 - i * 26;
          const y = U.rand(FT + 10, FB - 10);
          this.spawnEnemy(type, x, y, { ...opts, side, hpMult: this.levelIndex >= 2 ? 1.1 : 1 });
        }
      }
    }
    spawnBoss() {
      this.boss = new E.Boss(this, this.camX + W - 110, (FT + FB) / 2);
      this.enemies.push(this.boss);
      A.playMusic('boss'); A.sfx.bossRoar(); this.impact(-1, 'boss');
      this.showBanner('BOSS CONE', 'GIANT FROYO. NO SAMPLES.', 2.8);
      this.fx.text(this.boss.x, this.boss.y - 180, '"YOU LOOK LIKE YOU WANT A SAMPLE."', '#f9c', 2.8);
    }

    update(dt, inp) {
      this.t += dt;
      if (inp.pressed.pause && this.phase === 'play') {
        if (this.paused) { this.paused = false; A.sfx.blip(); return; }
        this.paused = true; this.pauseSel = 0; this.pauseLatch = true; A.sfx.blip();
      } else if (inp.pressed.start && this.phase === 'play' && !this.paused) {
        // Gamepad Start and Enter open the pause menu. Latch so this same
        // press doesn't immediately confirm "RESUME".
        this.paused = true; this.pauseSel = 0; this.pauseLatch = true; A.sfx.blip();
      }
      if (this.paused) {
        if (this.pauseLatch) { this.pauseLatch = false; return; }
        this.updatePause(inp); return;
      }
      if (this.bannerT > 0) this.bannerT -= dt;
      if (this.tutorialT > 0) this.tutorialT -= dt;
      if (this.comboRankT > 0) this.comboRankT -= dt;
      if (this.barkCd > 0) this.barkCd -= dt;
      if (this.bannerT <= 0 && this.cards.length) { this.cards[0].t -= dt; if (this.cards[0].t <= 0) this.cards.shift(); }
      if (this.flashT > 0) this.flashT -= dt;
      if (this.fartT >= 0) { this.fartT += dt; if (this.fartT > 1.35) this.fartT = -1; }
      if (this.shakeT > 0) { this.shakeT -= dt; this.shakeX = U.rand(-1, 1) * this.shakeAmt; this.shakeY = U.rand(-1, 1) * this.shakeAmt * 0.6; if (this.shakeT <= 0) this.shakeAmt = 0; } else { this.shakeX = this.shakeY = 0; }
      this.fx.update(dt);
      this.phaseT += dt;
      if (this.phase === 'intro') { if (this.phaseT > 1.2) this.phase = 'play'; }
      if (this.phase === 'dead') { if (this.phaseT > 1.5) this.game.gameOver(this.levelIndex, this.player.score); return; }
      if (this.phase === 'bossdead') { this.player.t += dt; this.updateEntities(dt, inp, true); if (this.phaseT > 4.5) this.game.levelComplete(this.levelIndex, this.player); return; }
      if (this.phase === 'clear') { this.player.t += dt; this.updateEntities(dt, inp, true); if (this.phaseT > 3) this.game.levelComplete(this.levelIndex, this.player); return; }

      if (this.hitstop > 0) {
        // Hold the punch through the freeze, and don't eat the next tap.
        this.hitstop -= dt;
        if (inp.pressed.attack && this.player && this.player.state === 'attack') this.player.bufferAttack = true;
        if (inp.pressed.fart && this.player && this.player.fart >= this.player.fartMax) this.player.bufferFart = true;
        return;
      }
      const back = Math.pow(0.42, dt * 60);
      this.punchX *= back; this.punchY *= back;
      this.updateEntities(dt, inp, false);

      // camera + waves
      const p = this.player;
      const L = this.level;
      if (!this.locked) {
        // Desktop framing sits Lance a little further left so the next wave
        // is on screen before it arrives.
        const lead = WL.display.pc ? 0.33 : 0.42;
        const target = p.x - W * lead;
        this.camX = Math.max(this.camX, Math.min(target, L.length - W));
        const wv = this.currentWave();
        if (wv && p.x >= wv.x) {
          this.locked = true; this.groupIdx = 0;
          if (wv.boss) { this.spawnBoss(); }
          else { this.spawnGroup(wv.groups[0]); if (wv.tutorial) this.showTutorial(wv.tutorial); }
        }
        if (!wv && p.x >= L.length - 40 && this.phase === 'play' && !L.boss) {
          this.phase = 'clear'; this.phaseT = 0; p.setState('victory'); p.won = true; A.stopMusic(); A.sfx.levelClear(); this.showBanner('DECK SECURED', `TEMP'S DROPPING. +${1000 * L.id}`, 3); p.addScore(1000 * L.id);
        }
      } else {
        const wv = this.currentWave();
        const alive = this.aliveEnemies();
        if (wv && !wv.boss) {
          const lastGroup = this.groupIdx >= wv.groups.length - 1;
          if (!lastGroup && alive <= 1) { this.groupIdx++; this.spawnGroup(wv.groups[this.groupIdx]); }
          else if (lastGroup && alive === 0) { this.locked = false; this.waveIdx++; this.goArrowT = 3; A.sfx.select(); }
        }
      }
      if (this.goArrowT > 0) this.goArrowT -= dt;
      // hazards
      for (const h of this.hazards) {
        const cyc = ((this.t + h.offset) % h.period);
        const active = cyc < 0.9;
        h.active = active;
        if (active && !h.wasActive) { h.hit.clear(); if (Math.abs(h.x - this.camX - W / 2) < W) A.sfx.steam(); }
        h.wasActive = active;
        if (active && cyc > 0.15) {
          if (!h.hit.has(p) && Math.abs(p.x - h.x) < 24 && Math.abs(p.y - h.y) < 20 && p.z < 30) { h.hit.add(p); if (p.hurt(7, h.x + 1, true)) this.fx.text(p.x, p.y - 90, 'STEAM!', '#fff'); }
          for (const e of this.enemies) if (!h.hit.has(e) && e.hittable && !e.isBoss && Math.abs(e.x - h.x) < 24 && Math.abs(e.y - h.y) < 20) { h.hit.add(e); e.hurt(8, h.x + 1, { knockdown: true }); }
        }
      }
      // puddles
      let inPuddle = false;
      for (const pu of this.puddles) {
        pu.t += dt;
        if (pu.t <= (pu.arm || 0)) continue;
        if (Math.abs(p.x - pu.x) < pu.r && Math.abs(p.y - pu.y) < pu.r * 0.45 && p.z < 5) inPuddle = true;
      }
      this.puddles = this.puddles.filter(pu => pu.t < pu.life);
      p.speed = inPuddle ? 70 : 135;
      if (inPuddle) { this.puddleTick += dt; if (this.puddleTick > 0.5 && p.canBeHit) { this.puddleTick = 0; p.hp = Math.max(1, p.hp - 2); p.flash = 0.1; this.fx.text(p.x, p.y - 90, 'STICKY!', '#f9c', 0.5); } }
    }
    updateEntities(dt, inp, frozen) {
      if (!frozen) this.player.update(dt, inp);
      for (const e of this.enemies) if (!frozen || e.dead || e.isBoss) e.update(dt);
      for (const pr of this.projectiles) pr.update(dt);
      for (const pk of this.pickups) pk.update(dt);
      for (const o of this.objects) o.update(dt);
      this.enemies = this.enemies.filter(e => !e.remove);
      this.projectiles = this.projectiles.filter(p => !p.remove);
      this.pickups = this.pickups.filter(p => !p.remove);
      this.objects = this.objects.filter(o => !o.remove);
    }
    updatePause(inp) {
      const n = 5;
      if (inp.pressed.down) { this.pauseSel = (this.pauseSel + 1) % n; A.sfx.blip(); }
      if (inp.pressed.up) { this.pauseSel = (this.pauseSel + n - 1) % n; A.sfx.blip(); }
      const dir = inp.pressed.right ? 1 : inp.pressed.left ? -1 : 0;
      if (dir && this.pauseSel === 1) { A.cycleVolume(dir); A.sfx.blip(); if (WL.display.save) WL.display.save(); }
      else if (dir && this.pauseSel === 2) { WL.display.toggleFullscreen(); A.sfx.blip(); }
      else if (dir && this.pauseSel === 3) { WL.display.cycleMode(); A.sfx.blip(); }
      if (inp.pressed.mute) { A.toggleMute(); if (WL.display.save) WL.display.save(); }
      if (inp.pressed.click && inp.pointer && inp.pointer.type === 'mouse') {
        const y0 = 140;
        for (let i = 0; i < n; i++) {
          if (Math.abs(inp.pointer.y - (y0 + i * 20)) < 11 && Math.abs(inp.pointer.x - W / 2) < 160) {
            this.pauseSel = i; this.activatePause(); return;
          }
        }
      }
      if (inp.pressed.start || inp.pressed.attack || (inp.pressed.click && WL.input.touchEnabled && !inp.pressed.pause)) this.activatePause();
    }
    activatePause() {
      A.sfx.select();
      if (this.pauseSel === 0) this.paused = false;
      else if (this.pauseSel === 1) { A.cycleVolume(1); if (WL.display.save) WL.display.save(); }
      else if (this.pauseSel === 2) WL.display.toggleFullscreen();
      else if (this.pauseSel === 3) WL.display.cycleMode();
      else { A.stopMusic(); this.game.toTitle(); }
    }

    /* ---- drawing ---- */
    draw(ctx) {
      const L = this.level, p = this.player;
      ctx.save();
      ctx.translate(Math.round(this.shakeX + this.punchX), Math.round(this.shakeY + this.punchY));
      L.bg(ctx, this.camX, this.t);
      // hazards (steam vents)
      for (const h of this.hazards) {
        const sx = h.x - this.camX; if (sx < -60 || sx > W + 60) continue;
        D.fillRRect(ctx, sx - 22, h.y - 6, 44, 10, 3, '#5b6b7c', S.OUT); ctx.fillStyle = '#222'; for (let i = 0; i < 5; i++) ctx.fillRect(sx - 18 + i * 8, h.y - 3, 4, 4);
        const cyc = ((this.t + h.offset) % h.period);
        if (h.active) { ctx.save(); ctx.globalAlpha = 0.7; for (let i = 0; i < 8; i++) { const k = (cyc * 3 + i * 0.3) % 1; D.circle(ctx, sx + Math.sin(i * 2 + this.t * 8) * 12, h.y - 10 - k * 90, 8 + k * 14, `rgba(230,240,255,${0.8 - k * 0.7})`); } ctx.restore(); }
        else if (h.period - cyc < 0.6 || cyc > h.period - 0.6) { if (Math.floor(this.t * 12) % 2 === 0) ctx.fillStyle = '#f44', ctx.fillRect(sx - 20, h.y - 5, 40, 2); }
      }
      // puddles — a beat of pink warning before the stick
      for (const pu of this.puddles) {
        const sx = pu.x - this.camX;
        if (pu.arm && pu.t < pu.arm) {
          const k = pu.t / pu.arm;
          ctx.save();
          ctx.globalAlpha = 0.55 + 0.4 * Math.sin(this.t * 22);
          ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(sx, pu.y, pu.r * (0.45 + k * 0.55), pu.r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha = Math.min(1, (pu.life - pu.t)); S.drawPuddle(ctx, sx, pu.y, pu.r, pu.t); ctx.restore();
        }
      }
      this.drawTells(ctx, 'floor');
      // depth-sorted entities
      const draws = [];
      for (const o of this.objects) draws.push(o);
      for (const pk of this.pickups) draws.push(pk);
      for (const e of this.enemies) draws.push(e);
      draws.push(p);
      for (const pr of this.projectiles) draws.push(pr);
      const depth = d => d.y + (d.falling ? -1000 : 0) + (d.state === 'grabbed' ? 0.5 : 0);
      draws.sort((a, b) => depth(a) - depth(b));
      for (const d of draws) d.draw(ctx, this.camX);
      this.drawTells(ctx, 'label');
      if (this.fartT >= 0) S.drawFartCloud(ctx, this.fartX - this.camX, this.fartY, this.fartT, p.facing);
      this.fx.draw(ctx, this.camX);
      ctx.restore();
      if (this.fartT >= 0 && this.fartT < 1.05) {
        const k = Math.sin(Math.min(1, this.fartT / 0.1) * Math.PI / 2) * Math.min(1, (1.05 - this.fartT) / 0.28);
        const h = 26 * k;
        ctx.fillStyle = '#071007';
        ctx.fillRect(0, 44, W, h * 0.45);
        ctx.fillRect(0, H - h, W, h);
      }
      if (this.flashT > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.8, this.flashT * 2.5); ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      this.drawHUD(ctx);
      if (p.fart >= p.fartMax && (this.phase === 'play' || this.phase === 'intro')) this.drawFartReady(ctx);
      if (this.phase === 'intro' || this.phase === 'play') WL.input.drawTouch(ctx, { hintJoy: this.t < 6, fartReady: p.fart >= p.fartMax });
      if (this.paused) this.drawPause(ctx);
      D.scanlines(ctx, 0.07);
    }
    drawTells(ctx, pass) {
      for (const e of this.enemies) {
        if (!e || e.dead) continue;
        const sx = e.x - this.camX, sy = e.y;
        if (sx < -100 || sx > W + 100) continue;
        const telling = e.state === 'windup' || e.state === 'prime';
        if (pass === 'floor' && telling) {
          const dur = e.state === 'windup' ? e.def.windup : (e.primeDur || 0.28);
          const k = U.clamp(e.stateT / Math.max(0.05, dur), 0, 1);
          const reach = e.state === 'prime' ? (e.pending === 'charge' ? 130 : 108) : (e.def.reach + 20);
          const dir = e.facing || 1;
          ctx.save();
          ctx.globalAlpha = 0.32 + 0.5 * k;
          ctx.fillStyle = k > 0.72 ? '#ff2438' : '#ff9a1f';
          ctx.beginPath();
          ctx.ellipse(sx + dir * reach * 0.42, sy, Math.max(10, reach * 0.48 * (0.4 + 0.6 * k)), 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (pass === 'label' && telling) {
          const dur = e.state === 'windup' ? e.def.windup : (e.primeDur || 0.28);
          const k = U.clamp(e.stateT / Math.max(0.05, dur), 0, 1);
          T.draw(ctx, '!', sx, sy - e.z - e.height - 18, { size: 12, align: 'center', color: k > 0.72 ? '#fff' : '#ff4040', stroke: '#000', strokeWidth: 3 });
        }
        if (!e.isBoss) continue;
        if (pass === 'floor' && e.state === 'slamWind') {
          const k = U.clamp(e.stateT / 0.75, 0, 1);
          const dir = e.facing || 1;
          ctx.save();
          ctx.globalAlpha = 0.28 + 0.55 * k;
          ctx.fillStyle = k > 0.68 ? '#ff2048' : '#ffb020';
          ctx.beginPath();
          ctx.ellipse(sx + dir * 72, sy, 34 + k * 46, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (pass === 'floor' && (e.state === 'jumpWind' || e.state === 'jump') && e.jumpTargetX != null) {
          const tx = e.jumpTargetX - this.camX, ty = e.jumpTargetY;
          const k = e.state === 'jumpWind' ? U.clamp(e.stateT / 0.42, 0, 1) : U.clamp(e.z / 180, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(tx, ty, 18 + (1 - Math.min(1, e.state === 'jump' ? 1 - k : k)) * 22, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        if (pass === 'label' && e.state === 'slamWind') {
          const dir = e.facing || 1;
          T.draw(ctx, 'SPOON', sx + dir * 72, sy - 24, { size: 8, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 3 });
        }
        if (pass === 'label' && e.state === 'jumpWind' && e.jumpTargetX != null) T.draw(ctx, 'INCOMING', e.jumpTargetX - this.camX, e.jumpTargetY - 16, { size: 7, align: 'center', color: '#ffd0e0', stroke: '#000', strokeWidth: 3 });
        if (pass === 'label' && e.state === 'rainWind') T.draw(ctx, 'LOOK UP', sx, sy - 36, { size: 8, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
      }
    }
    drawFartReady(ctx) {
      if (Math.floor(this.t * 6) % 2 !== 0) return;
      ctx.save();
      ctx.strokeStyle = '#c6ff6a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      const m = 3, L = 14;
      ctx.beginPath();
      ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
      ctx.moveTo(W - m - L, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + L);
      ctx.moveTo(m, H - m - L); ctx.lineTo(m, H - m); ctx.lineTo(m + L, H - m);
      ctx.moveTo(W - m - L, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - L);
      ctx.stroke();
      ctx.restore();
    }
    drawHUD(ctx) {
      const p = this.player, L = this.level;
      // top bar
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 44);
      // lei-framed portrait — the cruise shirt should read in the scrum, not only the cutscene
      D.fillRRect(ctx, 4, 3, 34, 38, 3, '#6a2f9a', '#ffe14a');
      ctx.fillStyle = '#f7f2ff'; ctx.fillRect(6, 3, 3, 38); ctx.fillRect(33, 3, 3, 38);
      const hud = WL.assets.get('lanceHud');
      if (hud) ctx.drawImage(hud, 8, 7, 26, 30);
      else drawHudHead(ctx, p.hp < 30 ? 'hurt' : 'neutral');
      T.draw(ctx, 'LANCE', 42, 5, { size: 8, color: '#ffe14a' });
      T.draw(ctx, 'A/C', 96, 7, { size: 6, color: '#e7c6ff' });
      const hpPct = p.hp / p.maxHp;
      D.bar(ctx, 42, 17, 120, 8, hpPct, hpPct > 0.5 ? '#4cd94c' : hpPct > 0.25 ? '#f0c020' : '#e03020', '#3a0a0a');
      // lives
      for (let i = 0; i < Math.max(0, p.lives - 1); i++) { D.circle(ctx, 172 + i * 12, 21, 4.5, '#e0a878', S.OUT); ctx.fillStyle = '#eee'; ctx.fillRect(169 + i * 12, 22, 6, 1.5); }
      T.draw(ctx, `x${Math.max(0, p.lives - 1)}`, 172 + Math.max(0, p.lives - 1) * 12 + 2, 17, { size: 7, color: '#fff' });
      // fart meter
      const full = p.fart >= p.fartMax;
      const pulse = full ? 0.6 + Math.sin(this.t * 10) * 0.4 : 1;
      T.draw(ctx, 'VOLCANO FART', 42, 29, { size: 6, color: full ? `rgba(160,255,80,${pulse})` : '#9f3' });
      D.bar(ctx, 118, 30, 100, 6, p.fart / p.fartMax, full ? `rgba(160,255,80,${pulse})` : '#7ad83a', '#12300a');
      if (full && Math.floor(this.t * 5) % 2 === 0) {
        const hint = WL.input.touchEnabled ? 'TAP' : (WL.input.gamepad.connected ? 'B' : 'F');
        T.draw(ctx, hint, 222, 28, { size: 7, color: '#d8ff8a' });
      }
      // toolbox indicator
      if (p.hasToolbox) { S.tool(ctx, 'toolbox', 246, 20, 0); }
      // score
      T.draw(ctx, 'SCORE', W - 8, 6, { size: 7, align: 'right', color: '#ffe14a' });
      T.draw(ctx, U.pad(p.score, 7), W - 8, 16, { size: 10, align: 'right', color: '#fff' });
      const temp = L.temp != null ? L.temp : 72;
      const hot = temp >= 90 ? '#ff5a3a' : temp >= 80 ? '#ffb020' : '#8fd4ff';
      T.draw(ctx, `${L.short || L.name}  ${temp}°F`, W - 8, 31, { size: 6, align: 'right', color: hot });
      // stage progress
      const prog = U.clamp(this.camX / Math.max(1, L.length - W), 0, 1);
      D.bar(ctx, W / 2 - 60, 38, 120, 3, prog, '#ffe14a', '#333');
      // combo — ranks, not a generic "FIGHT"
      const comboY = this.boss ? 116 : 52;
      if (this.bannerT <= 0 && p.comboCount >= 2 && p.comboDisplayT > 0) {
        const pop = 1 + (p.comboPop || 0) * 0.28;
        const rank = (WL.voice && WL.voice.comboRank(p.comboCount)) || '';
        const tool = p.lastToolT > 0 && WL.voice ? WL.voice.toolName(p.lastTool) : '';
        ctx.save();
        ctx.translate(18, comboY);
        ctx.scale(pop, pop);
        const col = p.comboCount >= 12 ? '#ff7ad4' : p.comboCount >= 8 ? '#fff' : '#ffe14a';
        T.draw(ctx, `${p.comboCount} HITS`, 0, 0, { size: p.comboCount >= 10 ? 16 : 13, color: col, stroke: '#000', strokeWidth: 4 });
        if (rank) T.draw(ctx, rank, 0, 18, { size: 7, color: '#f9c', stroke: '#000', strokeWidth: 3 });
        else if (tool) T.draw(ctx, tool, 0, 16, { size: 6, color: '#fff', stroke: '#000', strokeWidth: 3 });
        ctx.restore();
      }
      if (this.bannerT <= 0 && this.cards.length) {
        const c = this.cards[0];
        const cy = this.boss ? 116 : 78;
        T.draw(ctx, c.name, W - 10, cy, { size: 7, align: 'right', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        T.draw(ctx, c.line, W - 10, cy + 12, { size: 6, align: 'right', color: '#fff', stroke: '#000', strokeWidth: 3 });
      }
      // ahead arrow
      if (!this.locked && this.aliveEnemies() === 0 && this.phase === 'play' && (this.currentWave() || !L.boss) && Math.floor(this.t * 3) % 2 === 0) {
        const go = L.boss ? 'THE CONE' : 'THE DUCT';
        T.draw(ctx, go, W - 36, 102, { size: 8, align: 'right', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W - 30, 100); ctx.lineTo(W - 10, 110); ctx.lineTo(W - 30, 120); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // boss bar sits under the HUD so thumbs keep the bottom of the screen
      if (this.boss && !this.boss.remove) {
        const b = this.boss;
        const bw = 268, bx = W / 2 - bw / 2, by = 58;
        const phaseName = b.phase === 1 ? 'SWIRL' : b.phase === 2 ? 'TOPPINGS' : 'MELT';
        T.draw(ctx, 'GIANT FROYO CONE', W / 2, by - 10, { size: 6, align: 'center', color: '#f9c', stroke: '#000', strokeWidth: 3 });
        D.bar(ctx, bx, by, bw, 8, b.hp / b.maxHp, b.phase === 3 ? '#e02040' : '#e85a8a', '#3a0a1a');
        if (b.armor > 0) { ctx.save(); ctx.globalAlpha = 0.85; D.bar(ctx, bx, by + 9, bw * b.armor, 3, 1, '#bfefff', '#123'); ctx.restore(); }
        T.draw(ctx, phaseName, bx - 4, by, { size: 6, align: 'right', color: '#fff', stroke: '#000', strokeWidth: 2 });
        if (b.armor > 0) T.draw(ctx, 'ARMOR', bx + bw + 4, by + 6, { size: 5, color: '#bff' });
      }
      // tutorial
      if (this.tutorialT > 0 && this.tutorial) {
        const lines = T.wrap(ctx, this.tutorial, 7, W - 80);
        const bh = 14 + lines.length * 11;
        const lift = WL.input.touchEnabled ? 78 : 8;
        D.fillRRect(ctx, 30, H - lift - bh, W - 60, bh, 4, 'rgba(0,0,30,0.85)', '#39f');
        lines.forEach((l, i) => T.draw(ctx, l, W / 2, H - lift - bh + 7 + i * 11, { size: 7, align: 'center', color: '#fff' }));
      }
      // banner
      if (this.bannerT > 0 && this.banner) {
        const big = !!this.banner.big;
        const k = Math.min(1, this.bannerT * 2);
        const y = big ? 108 : 74;
        const h = big ? 64 : 38;
        ctx.save(); ctx.globalAlpha = k;
        ctx.fillStyle = big ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, y, W, h);
        T.draw(ctx, this.banner.a, W / 2, y + (big ? 6 : 3), { size: big ? 16 : 12, align: 'center', gradient: ['#fff3a0', '#ffb300', '#e0301e'], stroke: '#000', strokeWidth: big ? 5 : 4 });
        T.draw(ctx, this.banner.b, W / 2, y + (big ? 32 : 20), { size: big ? 8 : 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 3 });
        ctx.restore();
      }
      if (this.phase === 'dead') { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); T.draw(ctx, 'LANCE HIT THE DECK', W / 2, 150, { size: 16, align: 'center', color: '#e03020', stroke: '#000', strokeWidth: 5 }); }
    }
    drawPause(ctx) {
      ctx.fillStyle = 'rgba(0,0,10,0.7)'; ctx.fillRect(0, 0, W, H);
      T.draw(ctx, 'PAUSED', W / 2, 70, { size: 22, align: 'center', gradient: ['#fff', '#ffe14a'], stroke: '#000', strokeWidth: 5 });
      const fs = WL.display.fullscreen || !!document.fullscreenElement;
      const items = [
        'RESUME',
        'SOUND: ' + A.volumeLabel() + '   < >',
        'FULLSCREEN: ' + (fs ? 'ON' : 'OFF') + '   < >',
        'DISPLAY: ' + WL.display.modeLabel() + '   < >',
        'QUIT TO TITLE'
      ];
      items.forEach((it, i) => T.draw(ctx, (i === this.pauseSel ? '> ' : '  ') + it, W / 2, 140 + i * 20, { size: 9, align: 'center', color: i === this.pauseSel ? '#ffe14a' : '#ddd' }));
      const keys = WL.input.gamepad.connected
        ? 'PAD  X ATK  A JUMP  Y SPRAY  RB BOX  B FART'
        : 'E/J ATK   SPACE/K JUMP   Q/L SPRAY   R/I BOX   F FART';
      T.draw(ctx, keys, W / 2, 256, { size: 7, align: 'center', color: '#bcd' });
      T.draw(ctx, 'Walk into an enemy = duct-tape grab. Attack = knee. Back+Attack or Jump = throw.', W / 2, 272, { size: 6, align: 'center', color: '#bcd' });
      T.draw(ctx, 'Left / right changes the highlighted setting. \\ toggles fullscreen.', W / 2, 286, { size: 6, align: 'center', color: '#9ab' });
      T.draw(ctx, `KILLS: ${this.kills}   HITS: ${this.player.hits}`, W / 2, 310, { size: 7, align: 'center', color: '#9ab' });
      if (WL.input.touchEnabled) WL.input.drawTouch(ctx, { buttons: false });
    }
  }

  /* ================================================================== */
  /* Game Over                                                          */
  /* ================================================================== */
  class GameOver {
    constructor(game, levelIndex, score) { this.game = game; this.levelIndex = levelIndex; this.score = score; this.t = 0; this.count = 9; }
    enter() {}
    update(dt, inp) {
      this.t += dt;
      const left = Math.max(0, 9 - Math.floor(this.t));
      if (left !== this.count) { this.count = left; if (left > 0) A.sfx.blip(); }
      if (anyPress(inp) && this.t > 0.5) { A.sfx.select(); this.game.continueGame(this.levelIndex, this.score); return; }
      if (this.t > 10.5) this.game.toTitle();
    }
    draw(ctx) {
      ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
      D.vignette(ctx, 0.7);
      S.drawLance(ctx, W / 2 - 60, 250, { pose: 'down', t: this.t, facing: 1 });
      // froyo taunting
      S.drawEnemy(ctx, W / 2 + 60, 250, { type: 'froyo', pose: 'idle', t: this.t, facing: -1 });
      T.draw(ctx, 'GAME OVER', W / 2, 60, { size: 28, align: 'center', gradient: ['#fff', '#e03020'], stroke: '#000', strokeWidth: 6 });
      T.draw(ctx, '"The buffet sends its regards."', W / 2, 104, { size: 7, align: 'center', color: '#f9c' });
      T.draw(ctx, `SCORE ${U.pad(this.score, 7)}`, W / 2, 128, { size: 10, align: 'center', color: '#ffe14a' });
      T.draw(ctx, `CONTINUE?  ${this.count}`, W / 2, 290, { size: 14, align: 'center', color: Math.floor(this.t * 4) % 2 ? '#fff' : '#ffe14a', stroke: '#000', strokeWidth: 4 });
      T.draw(ctx, WL.input.touchEnabled ? 'TAP TO INSERT COIN' : 'CLICK OR ENTER TO INSERT COIN', W / 2, 316, { size: 7, align: 'center', color: '#bcd' });
      D.scanlines(ctx, 0.1);
    }
  }

  /* ================================================================== */
  /* Victory: the weight-loss gag                                       */
  /* ================================================================== */
  class Victory {
    constructor(game, score) { this.game = game; this.score = score; this.t = 0; this.stage = 0; }
    enter() { A.playMusic('victory'); }
    update(dt, inp) {
      this.t += dt;
      if (anyPress(inp) && this.t > 1) { A.sfx.select(); if (this.stage === 0) { this.stage = 1; this.t = 0; } else this.game.toTitle(); }
    }
    draw(ctx) {
      const t = this.t;
      // cool blue restored A/C sky
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2e7bd6'); g.addColorStop(1, '#9fd7f5'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // snowflakes / cool air
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 40; i++) { const x = (i * 53 + Math.sin(t + i) * 20) % W; const y = (i * 37 + t * 30) % H; ctx.fillRect(x, y, 2, 2); }
      ctx.fillStyle = '#c99a5b'; ctx.fillRect(0, 262, W, H - 262);
      if (this.stage === 0) {
        T.draw(ctx, 'A/C RESTORED', W / 2, 20, { size: 22, align: 'center', gradient: ['#fff', '#bfefff', '#39f'], stroke: '#000', strokeWidth: 5 });
        T.draw(ctx, '72°F AND HOLDING', W / 2, 50, { size: 9, align: 'center', color: '#fff', stroke: '#000' });
        // BEFORE / AFTER
        ctx.save(); ctx.globalAlpha = 0.55; S.drawLance(ctx, 150, 250, { pose: 'idle', t, facing: 1 }); ctx.restore();
        T.draw(ctx, 'BEFORE', 150, 262, { size: 9, align: 'center', color: '#fff', stroke: '#000' });
        T.draw(ctx, '"Lance, before"', 150, 276, { size: 6, align: 'center', color: '#333', shadow: false });
        // arrow
        T.draw(ctx, '>>>', W / 2, 190, { size: 16, align: 'center', color: '#ffe14a', stroke: '#000' });
        T.draw(ctx, '4 DECKS. ONE SALAD-BAR UPRISING.', W / 2, 150, { size: 7, align: 'center', color: '#fff', stroke: '#000' });
        T.draw(ctx, 'ONE FART, ITEMIZED.', W / 2, 162, { size: 7, align: 'center', color: '#9f3', stroke: '#000' });
        const k = Math.min(1, t / 1.5);
        S.drawLance(ctx, W - 150, 250, { pose: t > 1.6 ? 'victory' : 'idle', t, facing: -1, thin: true });
        T.draw(ctx, 'AFTER', W - 150, 262, { size: 9, align: 'center', color: '#fff', stroke: '#000' });
        T.draw(ctx, '"Svelte Lance"', W - 150, 276, { size: 6, align: 'center', color: '#333', shadow: false });
        if (t > 2) T.draw(ctx, 'Captain: "Lance. You look... svelte."', W / 2, 296, { size: 7, align: 'center', color: '#fff', stroke: '#000' });
        if (t > 3.5) T.draw(ctx, 'Lance: "The invoice says cardio. Open the buffet."', W / 2, 310, { size: 7, align: 'center', color: '#ffe14a', stroke: '#000' });
        if (Math.floor(t * 2) % 2 === 0 && t > 1) T.draw(ctx, WL.input.touchEnabled ? 'TAP' : 'ENTER', W - 18, H - 16, { size: 7, align: 'right', color: '#fff' });
      } else {
        T.draw(ctx, 'THANKS FOR PLAYING', W / 2, 24, { size: 16, align: 'center', gradient: ['#fff3a0', '#ffb300', '#e0301e'], stroke: '#000', strokeWidth: 5 });
        T.draw(ctx, `FINAL SCORE ${U.pad(this.score, 7)}`, W / 2, 54, { size: 11, align: 'center', color: '#fff', stroke: '#000' });
        const img = WL.assets.get('lancePortrait');
        if (img) { const s = 150 / img.height; ctx.drawImage(img, W / 2 - img.width * s / 2, 80, img.width * s, img.height * s); }
        else S.drawLanceBust(ctx, W / 2, 130, 84, { mood: 'grin' });
        S.drawLance(ctx, 110, 250, { pose: 'victory', t, facing: 1, thin: true });
        S.drawEnemy(ctx, W - 130, 250, { type: 'broccoli', pose: 'down', t, facing: 1 });
        S.drawEnemy(ctx, W - 90, 262, { type: 'froyo', pose: 'down', t, facing: 1 });
        T.draw(ctx, 'WHALE LANCE AIR CONDITIONING AND HEATING', W / 2, 240, { size: 8, align: 'center', color: '#fff', stroke: '#000' });
        T.draw(ctx, '"WE SPEAR THE COMPETITION"', W / 2, 254, { size: 7, align: 'center', color: '#ffe14a', stroke: '#000' });
        T.draw(ctx, 'Starring LANCE as himself. No vegetables were harmed. Several were eaten.', W / 2, 290, { size: 6, align: 'center', color: '#fff', stroke: '#000' });
        T.draw(ctx, 'Happy cruising, Dad.', W / 2, 306, { size: 7, align: 'center', color: '#fff', stroke: '#000' });
        if (Math.floor(t * 2) % 2 === 0 && t > 1) T.draw(ctx, WL.input.touchEnabled ? 'TAP FOR TITLE' : 'ENTER FOR TITLE', W / 2, 336, { size: 7, align: 'center', color: '#fff' });
      }
      D.scanlines(ctx, 0.07);
    }
  }

  WL.scenes = { Title, Cutscene, StoryBeat, Play, GameOver, Victory };
})();
