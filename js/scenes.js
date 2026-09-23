/* Scenes: Title, Cutscene (opening panels), StoryBeat (between stages),
   Play (the beat-em-up), GameOver, Ending/Victory. */
'use strict';

(function () {
  const U = WL.util, D = WL.draw, T = WL.text, S = WL.sprites;
  const W = WL.W, H = WL.H, FT = WL.FLOOR_TOP, FB = WL.FLOOR_BOTTOM;
  const E = WL.entities;
  const A = WL.audio;

  const anyPress = (inp) => inp.pressed.start || inp.pressed.attack || inp.pressed.jump || inp.pressed.click;
  // In-place removal: no fresh array per list per frame.
  function compact(arr) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].remove) arr[j++] = arr[i];
    arr.length = j;
    return arr;
  }
  /** Health colors: classic green/yellow/red, or blue/yellow/vermilion (Okabe-Ito). */
  function hpColor(pct) {
    if (WL.settings.data.colorblind) return pct > 0.5 ? '#56b4e9' : pct > 0.25 ? '#f0e442' : '#d55e00';
    return pct > 0.5 ? '#3cdb3c' : pct > 0.25 ? '#f0c020' : '#e03020';
  }
  function tellColor(late) {
    if (WL.settings.data.colorblind) return late ? '#d55e00' : '#f0e442';
    return late ? '#ff2438' : '#ff9a1f';
  }
  const confirmWord = () => (WL.input.touchEnabled ? 'TAP' : 'ENTER');

  const hudHead = { key: '', canvas: null };
  function drawHudHead(ctx, mood) {
    const rs = (WL.display && WL.display.renderScale) || 1;
    const key = mood + '@' + rs.toFixed(3);
    if (hudHead.key !== key || !hudHead.canvas) {
      const w = 28, h = 32;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * rs));
      c.height = Math.max(1, Math.round(h * rs));
      const g = c.getContext('2d');
      g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#3a78c8';
      g.fillRect(0, 0, w, h);
      S.lanceHead(g, 14, 18, 30, { mood });
      hudHead.key = key; hudHead.canvas = c;
    }
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = WL.display.mode !== 'classic';
    ctx.drawImage(hudHead.canvas, 7, 6, 28, 32);
    ctx.imageSmoothingEnabled = smooth;
  }

  /* ================================================================== */
  /* Title                                                              */
  /* ================================================================== */
  const TITLE_Y0 = 198, TITLE_STEP = 18;
  class Title {
    constructor(game) {
      this.game = game; this.t = 0; this.sel = 0; this.showHelp = false; this.sub = null;
      this.run = WL.settings.loadRun();
      this.buildItems();
    }
    buildItems() {
      this.items = this.run
        ? [{ id: 'continue', label: 'CONTINUE' }, { id: 'new', label: 'NEW GAME' }, { id: 'skip', label: 'SKIP INTRO' }, { id: 'settings', label: 'SETTINGS' }, { id: 'help', label: 'HOW TO PLAY' }]
        : [{ id: 'new', label: 'START GAME' }, { id: 'skip', label: 'SKIP INTRO' }, { id: 'settings', label: 'SETTINGS' }, { id: 'help', label: 'HOW TO PLAY' }];
    }
    enter() { A.playMusic('title'); }
    rowAt(pt) {
      for (let i = 0; i < this.items.length; i++) {
        const y = TITLE_Y0 + i * TITLE_STEP;
        if (pt.y >= y - 3 && pt.y < y + TITLE_STEP - 3 && Math.abs(pt.x - (W / 2 - 80)) < 130) return i;
      }
      return -1;
    }
    update(dt, inp) {
      this.t += dt;
      if (this.sub) {
        const r = this.sub.update(inp, dt);
        if (r === 'settings') this.sub = new WL.OptionsPanel('options', { full: true });
        else if (r === 'controls') this.sub = new WL.OptionsPanel('controls');
        else if (r === 'back') this.sub = this.sub instanceof SettingsHub ? null : this.hub;
        return;
      }
      if (this.showHelp) { if (anyPress(inp) || inp.pressed.pause) { this.showHelp = false; A.sfx.blip(); } return; }
      if (inp.pressed.down) { this.sel = (this.sel + 1) % this.items.length; A.sfx.blip(); }
      if (inp.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; A.sfx.blip(); }
      if (inp.pressed.click && inp.pointer) {
        const i = this.rowAt(inp.pointer);
        if (i >= 0) { this.sel = i; this.choose(); return; }
        // A tap anywhere else still starts (the old phone behavior); a stray mouse click doesn't.
        if (WL.input.touchEnabled) { this.choose(); return; }
        return;
      }
      if (inp.pressed.start || inp.pressed.attack || inp.pressed.jump) this.choose();
    }
    choose() {
      A.sfx.select();
      const id = this.items[this.sel].id;
      if (id === 'continue') this.game.continueRun(this.run);
      else if (id === 'new') { WL.settings.clearRun(); this.game.startNewGame(true); }
      else if (id === 'skip') { WL.settings.clearRun(); this.game.startNewGame(false); }
      else if (id === 'settings') this.sub = this.hub = new SettingsHub();
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
      T.draw(ctx, 'BUFFET BRAWL', W / 2 - 80, 78 + bounce, { size: 34, align: 'center', gradient: ['#ffffff', '#ffd23f', '#ff4d00'], stroke: '#2a0a0a', strokeWidth: 8 });
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
      if (this.sub) { this.sub.draw(ctx); D.scanlines(ctx, 0.08); return; }
      if (!this.showHelp) {
        if (this.run) {
          const L = WL.LEVELS[this.run.level];
          T.draw(ctx, `SAVED: STAGE ${L.id} WAVE ${this.run.wave + 1}/${L.waves.length}  ${U.pad(this.run.score, 7)}`, W / 2 - 80, 180, { size: 6, align: 'center', color: '#8ff' });
        }
        this.items.forEach((it, i) => {
          const seld = i === this.sel;
          T.draw(ctx, (seld ? '> ' : '  ') + it.label, W / 2 - 80, TITLE_Y0 + i * TITLE_STEP, { size: 10, align: 'center', color: seld ? (Math.floor(t * 6) % 2 ? '#ffe14a' : '#fff') : '#cfd' });
        });
        if (Math.floor(t * 2) % 2 === 0) T.draw(ctx, WL.input.touchEnabled ? 'TAP A ROW TO START' : 'PRESS ENTER OR CLICK', W / 2 - 80, 292, { size: 8, align: 'center', color: '#fff' });
        T.draw(ctx, WL.input.legend(), W / 2, 318, { size: 6, align: 'center', color: '#bcd' });
        T.draw(ctx, `${WL.input.hint('pause', 1)} PAUSE    M MUTE    \\ FULLSCREEN    CLICK A MENU ROW`, W / 2, 332, { size: 6, align: 'center', color: '#9ab' });
        T.draw(ctx, '(c) 2026 WHALE LANCE A/C & HEATING. INSERT COIN. A FAMILY ROAST.', W / 2, 346, { size: 5, align: 'center', color: '#89a' });
        if (WL.display.pc) T.draw(ctx, WL.display.modeLabel(), 8, 6, { size: 6, color: '#cde' });
      } else this.drawHelp(ctx);
      D.scanlines(ctx, 0.08);
    }
    drawHelp(ctx) {
      D.fillRRect(ctx, 30, 24, W - 60, H - 48, 6, 'rgba(0,0,20,0.9)', '#ffe14a');
      const k = (a, n) => WL.settings.keysFor(a, n || 3).join(', ').padEnd(14, ' ');
      const I = WL.input;
      const lines = [
        ['HOW TO PLAY', '#ffe14a'],
        [`MOVE      ${I.moveHint(true)}. Gamepad stick or d-pad. Touch stick on phones.`, '#fff'],
        [`ATTACK    ${k('attack')}screwdriver, wrench, pipe wrench`, '#fff'],
        ['COMBO     Mash = sweep knockdown. Wait a beat before the 3rd hit = WRENCH POP', '#bff'],
        ['          launcher; hit it again in the air (up to 3) or flying-boot it.', '#bff'],
        ['GRAB      Walk into an enemy = duct-tape grab. ATTACK = knee. Back+ATTACK = throw', '#fff'],
        [`JUMP      ${k('jump')}ATTACK in the air = flying boot`, '#fff'],
        [`SPRAY     ${k('special')}Refrigerant. Freezes. Costs a little HP.`, '#fff'],
        [`TOOLBOX   ${k('tool')}Throw the toolbox. Pick it back up!`, '#fff'],
        [`FART      ${k('fart', 2)}VOLCANO FART when the green meter is full`, '#9f3'],
        [`PAD       ${WL.settings.padFor('attack')} atk  ${WL.settings.padFor('jump')} jump  ${WL.settings.padFor('special')} spray  ${WL.settings.padFor('tool')} box  ${WL.settings.padFor('fart')} fart`, '#bcd'],
        ['SETTINGS  Remap keys / pad, overlay opacity, large HUD, colorblind health.', '#bcd'],
        ['Press any key to go back', '#aaa']
      ];
      lines.forEach(([l, c], i) => T.draw(ctx, l, 44, 34 + i * 20, { size: i === 0 ? 11 : 6, color: c }));
    }
  }

  /* Title-screen settings hub: Options or Controls. */
  class SettingsHub {
    constructor() { this.sel = 0; this.items = ['OPTIONS: SOUND, DISPLAY, HUD, COLORS', 'CONTROLS: REMAP KEYS + PAD', 'BACK']; }
    update(inp) {
      if (inp.pressed.pause) { A.sfx.blip(); return 'back'; }
      const n = this.items.length;
      if (inp.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx.blip(); }
      if (inp.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx.blip(); }
      let go = inp.pressed.start || inp.pressed.attack;
      if (inp.pressed.click && inp.pointer) {
        const i = Math.floor((inp.pointer.y - 146) / 24);
        if (i >= 0 && i < n && Math.abs(inp.pointer.x - W / 2) < 200) { this.sel = i; go = true; } else if (inp.pointer.type === 'mouse') go = false;
      }
      if (!go) return null;
      A.sfx.select();
      return ['settings', 'controls', 'back'][this.sel];
    }
    draw(ctx) {
      D.fillRRect(ctx, 60, 90, W - 120, 170, 6, 'rgba(4,6,22,0.95)', '#ffe14a');
      T.draw(ctx, 'SETTINGS', W / 2, 104, { size: 14, align: 'center', gradient: ['#fff', '#ffe14a'], stroke: '#000', strokeWidth: 4 });
      this.items.forEach((it, i) => T.draw(ctx, (i === this.sel ? '> ' : '  ') + it, W / 2, 150 + i * 24, { size: 8, align: 'center', color: i === this.sel ? '#ffe14a' : '#ddd' }));
      T.draw(ctx, 'Everything here is saved on this device.', W / 2, 236, { size: 6, align: 'center', color: '#9ab' });
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
  /* Particles are pooled: dead ones go back on a free list instead of
     becoming garbage, and the live list is compacted in place. WL.perf sets
     the concurrent cap (smaller on coarse pointers, smaller still in LITE)
     and scales burst sizes. Sparks and callout text are never dropped. */
  class FX {
    constructor() { this.list = []; this.pool = []; }
    _p(kind, x, y, life, force) {
      if (!force && this.list.length >= WL.perf.fxCap) return null;
      const f = this.pool.pop() || {};
      f.kind = kind; f.x = x; f.y = y; f.t = 0; f.life = life;
      f.vx = 0; f.vy = 0; f.r = 0; f.big = false; f.color = '#fff';
      f.square = false; f.shard = false; f.str = '';
      this.list.push(f);
      return f;
    }
    _n(count) { return Math.max(1, Math.round(count * WL.perf.fxScale)); }
    _chunk(x, y, vx, vy, life, color, r, square, shard) {
      const f = this._p('chunk', x, y, life);
      if (!f) return false;
      f.vx = vx; f.vy = vy; f.color = color; f.r = r; f.square = !!square; f.shard = !!shard;
      return true;
    }
    spark(x, y, big) { const f = this._p('spark', x, y, 0.22, true); f.big = !!big; }
    dust(x, y, r) {
      const n = WL.perf.lite ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const f = this._p('dust', x + U.rand(-8, 8), y + U.rand(-3, 3), 0.5);
        if (!f) return;
        f.t = -i * 0.03; f.r = (r || 6) * U.rand(0.6, 1);
      }
    }
    text(x, y, str, color, life) {
      const f = this._p('text', x, y, life || 1.1, true);
      f.str = str; f.color = color || '#fff'; f.vy = -30;
    }
    burst(x, y, type) {
      const V = S.VEG[type]; const cols = V ? [V.body || V.swirl, V.dark || V.cup, '#fff'] : ['#fff'];
      for (let i = 0, n = this._n(10); i < n; i++) if (!this._chunk(x, y, U.rand(-160, 160), U.rand(-260, -60), 0.8, U.pick(cols), U.rand(2, 5))) return;
    }
    foodDebris(x, y, type) {
      const V = S.VEG[type];
      const cols = V ? [V.body || V.swirl, V.dark || V.cup, '#ffe14a', '#ffffff'] : ['#55d840', '#f08a1e', '#ffffff'];
      for (let i = 0, n = this._n(7); i < n; i++) {
        if (!this._chunk(x, y, U.rand(-140, 140), U.rand(-200, -50), U.rand(0.4, 0.7), U.pick(cols), U.rand(1.5, 3.5), i % 2 === 0)) return;
      }
    }
    impactRing(x, y, big) {
      const f = this._p('ring', x, y, 0.24);
      if (f) f.big = !!big;
    }
    fartBurst(x, y) {
      const cols = ['#d8ff8a', '#7ad83a', '#5a8a2a', '#efe6c8', '#c8a15a'];
      for (let i = 0, n = this._n(22); i < n; i++) if (!this._chunk(x, y, U.rand(-420, 420), U.rand(-460, -40), 0.85, U.pick(cols), U.rand(2, 6), i % 3 === 0)) return;
    }
    debris(x, y, kind) {
      let cols = ['#d0d4dc', '#8a8f9a', '#c8322a'];
      let count = 14;
      if (kind === 'plates') {
        cols = ['#ffffff', '#f4f8fb', '#e2e8f0', '#d4af37'];
        count = 18;
      } else if (kind === 'tray') {
        cols = ['#e0e4ec', '#a4afbf', '#748094', '#ffaa33'];
        count = 16;
      } else if (kind === 'chair') {
        cols = ['#5c2f15', '#881b24', '#d4af37', '#7a421c'];
        count = 16;
      } else if (kind === 'crate') {
        cols = ['#b07a3a', '#6a4218'];
      } else if (kind === 'barrel') {
        cols = ['#4a8a3a', '#2a5a20'];
      } else if (kind === 'vending') {
        cols = ['#2a8a5a', '#0a1a2a', '#d33'];
      }
      for (let i = 0, n = this._n(count); i < n; i++) {
        if (!this._chunk(x, y, U.rand(-220, 220), U.rand(-320, -90), U.rand(0.7, 1.1), U.pick(cols), U.rand(2, 6), kind !== 'plates', kind === 'plates')) return;
      }
    }
    update(dt) {
      const list = this.list;
      let j = 0;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        f.t += dt;
        if (f.kind === 'chunk') { f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
        else if (f.kind === 'text') f.y += f.vy * dt;
        if (f.t < f.life) list[j++] = f;
        else this.pool.push(f);
      }
      list.length = j;
    }
    draw(ctx, camX) {
      const textSize = WL.settings.data.bigHud ? 10 : 8;
      for (const f of this.list) {
        if (f.t < 0) continue;
        const sx = f.x - camX;
        switch (f.kind) {
          case 'spark': S.drawHitSpark(ctx, sx, f.y, f.t, f.big); break;
          case 'dust': S.drawDust(ctx, sx, f.y, f.t, f.r); break;
          case 'ring': {
            ctx.save();
            const k = f.t / f.life;
            ctx.globalAlpha = Math.max(0, 1 - k);
            const r = (f.big ? 28 : 16) + k * (f.big ? 40 : 26);
            ctx.strokeStyle = f.big ? '#ffe14a' : '#ffffff';
            ctx.lineWidth = Math.max(1, (1 - k) * 3);
            ctx.beginPath();
            ctx.ellipse(sx, f.y, r, r * 0.42, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'chunk': {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
            if (f.shard) {
              ctx.fillStyle = f.color;
              ctx.beginPath();
              ctx.moveTo(sx - f.r, f.y + f.r);
              ctx.lineTo(sx + f.r, f.y);
              ctx.lineTo(sx, f.y - f.r);
              ctx.closePath();
              ctx.fill();
            } else if (f.square) {
              ctx.fillStyle = f.color; ctx.fillRect(sx - f.r / 2, f.y - f.r / 2, f.r, f.r);
            } else {
              D.circle(ctx, sx, f.y, f.r, f.color);
            }
            ctx.restore();
            break;
          }
          case 'text': ctx.save(); ctx.globalAlpha = Math.min(1, (f.life - f.t) * 2); T.draw(ctx, f.str, sx, f.y, { size: textSize, align: 'center', color: f.color, stroke: '#000', strokeWidth: 3 }); ctx.restore(); break;
        }
      }
    }
  }

  /* ================================================================== */
  /* Play                                                               */
  /* ================================================================== */
  const PAUSE_Y0 = 96, PAUSE_STEP = 18;
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
      this.lightingPulse = 0;
      this.slowmoT = 0;
      this.playerGhostHp = 100;
      this.sub = null;           // options / controls panel open inside pause
      this.lastAttackT = -10;    // AI director: last time an enemy started an attack
      this.aiT = 0;
    }
    enter() {
      const L = this.level;
      this.player = new E.Player(this, 80, (FT + FB) / 2);
      if (this.carry.score !== undefined) this.player.score = this.carry.score;
      if (this.carry.lives !== undefined) this.player.lives = this.carry.lives;
      if (this.carry.fart !== undefined) this.player.fart = this.carry.fart;
      this.playerGhostHp = this.player.hp;
      for (const o of L.objects || []) this.objects.push(new E.Breakable(this, o.kind, o.x, o.y, o.contents));
      for (const p of L.pickups || []) this.pickups.push(new E.Pickup(this, p.kind, p.x, p.y, false));
      for (const h of L.hazards || []) this.hazards.push({ ...h, hit: new Set(), wasActive: false });
      A.playMusic(L.music);
      const rw = this.carry.resumeWave | 0;
      if (rw > 0 && rw < L.waves.length) {
        // Continue: start where the last cleared wave was fought.
        this.waveIdx = rw;
        this.player.x = L.waves[rw - 1].x + 40;
        const lead = WL.display.pc ? 0.33 : 0.42;
        this.camX = U.clamp(this.player.x - W * lead, 0, L.length - W);
        this.objects = this.objects.filter(o => o.x > this.camX + 24);
        this.pickups = this.pickups.filter(p => p.x > this.camX + 24);
        this.showBanner('CONTINUE', `STAGE ${L.id}  WAVE ${rw + 1}/${L.waves.length}`, 2.3);
      } else {
        const b = L.banner || [`STAGE ${L.id}`, L.name];
        this.showBanner(b[0], b[1], 2.3);
      }
      this.checkpoint();
    }
    /** Light save for Continue: stage, next wave, score, meter. */
    checkpoint() {
      const p = this.player;
      WL.settings.saveRun({ level: this.levelIndex, wave: this.waveIdx, score: p.score, fart: Math.round(p.fart) });
    }
    /* ---- AI director ---- */
    // Two attackers max, never from both sides at once, and a beat between
    // attack starts, so every hit that lands had a readable tell.
    canStartAttack(e) {
      const p = this.player;
      if (!p || p.open) return false;
      if (this.t - this.lastAttackT < 0.3) return false;
      const side = Math.sign(e.x - p.x) || 1;
      let n = 0;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.isBoss || !E.ATTACKING.includes(o.state)) continue;
        n++;
        if ((Math.sign(o.x - p.x) || 1) !== side) return false;
      }
      return n < 2;
    }
    noteAttackStart() { this.lastAttackT = this.t; }
    directAI() {
      const p = this.player;
      if (!p) return;
      const melee = this.enemies.filter(e => !e.dead && !e.isBoss && !e.def.keepAway && (e.state === 'approach' || e.state === 'wait') && Math.abs(e.x - p.x) < W * 0.6);
      if (melee.length < 2) return;
      let left = 0, right = 0;
      for (const e of melee) {
        const s = e.flankT > 0 && e.flankSide ? e.flankSide : (Math.sign(e.x - p.x) || 1);
        if (s < 0) left++; else right++;
      }
      if (left && right) return;
      const open = left ? 1 : -1;
      const room = open < 0 ? p.x - this.camX : this.camX + W - p.x;
      if (room < 70) return;
      // Send the farthest goon around to the open flank.
      let pick = null, far = -1;
      for (const e of melee) { const d = Math.abs(e.x - p.x); if (d > far && !(e.flankT > 0)) { far = d; pick = e; } }
      if (pick) { pick.flankSide = open; pick.flankT = 3.5; }
    }
    /* ---- helpers used by entities ---- */
    playerBounds() {
      const max = this.locked ? this.camX + W - 14 : Math.min(this.camX + W - 14, this.level.length + 200);
      return { min: this.camX + 14, max };
    }
    attackers() { let n = 0; for (const e of this.enemies) if (!e.dead && ['windup', 'prime', 'attack', 'dash', 'charge'].includes(e.state)) n++; return n; }
    get reducedMotion() { return WL.settings.data.shake === 'reduced'; }
    shake(a, d) { a *= this.reducedMotion ? 0.35 : 1; this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = Math.max(this.shakeT, d); }
    triggerHitFlash(dur) {
      this.flashT = Math.max(this.flashT, (dur || 0.035) * (this.reducedMotion ? 0.4 : 1));
      this.flashColor = '#ffffff';
    }
    impact(dir, kind) {
      const table = {
        light: { stop: 0.05, punch: 5, y: -1, shake: 2.4, shakeT: 0.09 },
        heavy: { stop: 0.09, punch: 9, y: 3, shake: 5.5, shakeT: 0.16, flash: 0.045, flashColor: '#fff6d0' },
        boss: { stop: 0.1, punch: 11, y: 4, shake: 8, shakeT: 0.28 },
        fart: { stop: 0.18, punch: 3, y: -8, shake: 16, shakeT: 0.95 }
      };
      const s = table[kind] || table.light;
      const motion = this.reducedMotion ? 0.35 : 1;
      this.hitstop = Math.max(this.hitstop, s.stop);
      this.punchX = U.clamp(this.punchX + (dir || 1) * s.punch * motion, -16, 16);
      this.punchY = U.clamp(this.punchY + s.y * motion, -12, 12);
      this.shake(s.shake, s.shakeT);
      if (s.flash) { this.flashT = Math.max(this.flashT, s.flash * (this.reducedMotion ? 0.4 : 1)); this.flashColor = s.flashColor; }
      this.lightingPulse = Math.min(1, this.lightingPulse + (kind === 'fart' ? 1.0 : kind === 'boss' ? 0.75 : kind === 'heavy' ? 0.5 : 0.2) * motion);
      if (kind === 'heavy' || kind === 'boss') { if (WL.input.rumble) WL.input.rumble(kind === 'boss' ? 90 : 50, 0.55, 0.3); }
      // Music gets out of the way of the big ones.
      if (kind === 'heavy') A.duck(0.62, 0.06, 0.3);
      else if (kind === 'boss') A.duck(0.42, 0.16, 0.55);
      else if (kind === 'fart') A.duck(0.15, 1.0, 0.9);
    }
    bark(id) {
      if (this.barkCd > 0 || !this.player) return;
      const line = WL.voice && WL.voice.bark(id);
      if (!line) return;
      this.fx.text(this.player.x, this.player.y - 116, line, '#fff4c2', 1.25);
      this.barkCd = 2.05;
      A.sfx.voice();
      A.duck(0.55, 0.9, 0.5);
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
      if (card) { this.cards.push({ name: card.name, line: card.line, t: 2.45 }); A.duck(0.72, 0.8, 0.5); }
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
      // Banner only. A floating quote was landing on the cone's face.
      // The sub-line names what's new and the shape each move draws on the floor.
      if (n === 2) this.showBanner('PHASE 2: TOPPINGS', 'NEW: BELLY FLOP = RING + CROSS.  RAIN = DASHED DROPS.', 2.6);
      if (n === 3) this.showBanner('PHASE 3: MELTDOWN', 'FASTER SPOON. PUDDLES FLASH PINK FIRST.', 2.6);
      this.phaseCard = { n, t: 2.6 };
      A.duck(0.3, 1.2, 0.8);
      A.sfx.bossRoar(); this.impact(this.boss && this.boss.facing || 1, 'boss');
      // the dessert station coughs up some real food between phases
      this.spawnPickup('burger', this.camX + 120, U.rand(FT + 20, FB - 20), true);
      this.spawnPickup(n === 2 ? 'chili' : 'beans', this.camX + W - 120, U.rand(FT + 20, FB - 20), true);
    }
    bossDefeated() {
      this.phase = 'bossdead'; this.phaseT = 0; this.player.won = true; this.player.setState('victory');
      WL.settings.clearRun();
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
      this.showBanner('BOSS CONE', 'YOU WANT A SAMPLE?', 2.8);
    }

    update(dt, inp) {
      this.t += dt;
      let actDt = dt;
      if (this.slowmoT > 0) {
        this.slowmoT -= dt;
        actDt = dt * 0.38;
      }
      if (this.lightingPulse > 0) this.lightingPulse = Math.max(0, this.lightingPulse - dt * 3.5);
      if (this.player) {
        if (this.playerGhostHp > this.player.hp) {
          this.playerGhostHp = Math.max(this.player.hp, this.playerGhostHp - dt * 45);
        } else {
          this.playerGhostHp = this.player.hp;
        }
      }
      if (this.paused && this.sub) {
        if (this.sub.update(inp, dt) === 'back') { this.sub = null; this.pauseLatch = true; }
        return;
      }
      if (inp.pressed.pause && this.phase === 'play') {
        if (this.paused) { this.paused = false; A.sfx.blip(); return; }
        this.paused = true; this.pauseSel = 0; this.pauseLatch = true; A.sfx.blip();
      } else if (inp.pressed.start && this.phase === 'play' && !this.paused) {
        this.paused = true; this.pauseSel = 0; this.pauseLatch = true; A.sfx.blip();
      }
      if (this.paused) {
        if (this.pauseLatch) { this.pauseLatch = false; return; }
        this.updatePause(inp); return;
      }
      if (this.bannerT > 0) this.bannerT -= dt;
      if (this.phaseCard) { this.phaseCard.t -= dt; if (this.phaseCard.t <= 0) this.phaseCard = null; }
      if (this.tutorialT > 0) this.tutorialT -= dt;
      if (this.comboRankT > 0) this.comboRankT -= dt;
      if (this.barkCd > 0) this.barkCd -= dt;
      if (this.bannerT <= 0 && this.cards.length) { this.cards[0].t -= dt; if (this.cards[0].t <= 0) this.cards.shift(); }
      if (this.flashT > 0) this.flashT -= dt;
      if (this.fartT >= 0) { this.fartT += dt; if (this.fartT > 1.35) this.fartT = -1; }
      if (this.shakeT > 0) { this.shakeT -= dt; this.shakeX = U.rand(-1, 1) * this.shakeAmt; this.shakeY = U.rand(-1, 1) * this.shakeAmt * 0.6; if (this.shakeT <= 0) this.shakeAmt = 0; } else { this.shakeX = this.shakeY = 0; }
      this.fx.update(actDt);
      this.phaseT += dt;
      if (this.phase === 'intro') { if (this.phaseT > 1.2) this.phase = 'play'; }
      if (this.phase === 'dead') { if (this.phaseT > 1.5 && !this.gameOverSent) { this.gameOverSent = true; this.game.gameOver(this.levelIndex, this.player.score, this.waveIdx); } return; }
      if (this.phase === 'bossdead') { this.player.t += actDt; this.updateEntities(actDt, inp, true); if (this.phaseT > 4.5) this.game.levelComplete(this.levelIndex, this.player); return; }
      if (this.phase === 'clear') { this.player.t += actDt; this.updateEntities(actDt, inp, true); if (this.phaseT > 3) this.game.levelComplete(this.levelIndex, this.player); return; }

      if (this.hitstop > 0) {
        this.hitstop -= dt;
        if (inp.pressed.attack && this.player && this.player.state === 'attack') this.player.bufferAttack = true;
        if (inp.pressed.fart && this.player && this.player.fart >= this.player.fartMax) this.player.bufferFart = true;
        return;
      }
      const back = Math.pow(0.42, dt * 60);
      this.punchX *= back; this.punchY *= back;
      this.aiT -= dt;
      if (this.aiT <= 0) { this.aiT = 0.4; this.directAI(); }
      this.updateEntities(actDt, inp, false);

      // camera + waves
      const p = this.player;
      const L = this.level;
      if (!this.locked) {
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
          this.phase = 'clear'; this.phaseT = 0; p.setState('victory'); p.won = true; A.stopMusic(); A.sfx.levelClear(); this.showBanner('DECK SECURED!', `TEMP'S DROPPING. +${1000 * L.id}`, 3.2, true); p.addScore(1000 * L.id);
        }
      } else {
        const wv = this.currentWave();
        const alive = this.aliveEnemies();
        if (wv && !wv.boss) {
          const lastGroup = this.groupIdx >= wv.groups.length - 1;
          if (!lastGroup && alive <= 1) { this.groupIdx++; this.spawnGroup(wv.groups[this.groupIdx]); }
          else if (lastGroup && alive === 0) {
            this.locked = false;
            this.waveIdx++;
            this.goArrowT = 3.5;
            this.showBanner('WAVE CLEAR!', `BONUS +${300 * this.waveIdx} PTS`, 2.2);
            A.sfx.waveClear();
            if (this.waveIdx < L.waves.length) this.checkpoint();
            if (this.player && this.player.state === 'idle') {
              this.player.setState('victory');
              this.player.stateT = 0;
            }
          }
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
      compact(this.enemies); compact(this.projectiles); compact(this.pickups); compact(this.objects);
    }
    pauseItems() {
      const fs = WL.display.fullscreen || !!document.fullscreenElement;
      return [
        { id: 'resume', label: 'RESUME' },
        { id: 'sound', label: 'SOUND: ' + A.volumeLabel(), adj: true },
        { id: 'music', label: 'MUSIC: ' + A.musicLabel(), adj: true },
        { id: 'fullscreen', label: 'FULLSCREEN: ' + (fs ? 'ON' : 'OFF'), adj: true },
        { id: 'display', label: 'DISPLAY: ' + WL.display.modeLabel(), adj: true },
        { id: 'options', label: 'OPTIONS: OVERLAY, HUD, COLORS >' },
        { id: 'controls', label: 'CONTROLS: REMAP KEYS + PAD >' },
        { id: 'quit', label: 'QUIT TO TITLE' }
      ];
    }
    adjustPause(id, dir) {
      if (id === 'sound') { A.cycleVolume(dir); if (WL.display.save) WL.display.save(); }
      else if (id === 'music') { A.cycleMusic(dir); if (WL.display.save) WL.display.save(); }
      else if (id === 'fullscreen') WL.display.toggleFullscreen();
      else if (id === 'display') WL.display.cycleMode(dir);
      else return false;
      return true;
    }
    updatePause(inp) {
      const items = this.pauseItems();
      const n = items.length;
      if (inp.pressed.down) { this.pauseSel = (this.pauseSel + 1) % n; A.sfx.blip(); }
      if (inp.pressed.up) { this.pauseSel = (this.pauseSel + n - 1) % n; A.sfx.blip(); }
      const dir = inp.pressed.right ? 1 : inp.pressed.left ? -1 : 0;
      if (dir && this.adjustPause(items[this.pauseSel].id, dir)) A.sfx.blip();
      if (inp.pressed.mute) { A.toggleMute(); if (WL.display.save) WL.display.save(); }
      if (inp.pressed.click && inp.pointer) {
        const y0 = PAUSE_Y0;
        for (let i = 0; i < n; i++) {
          if (Math.abs(inp.pointer.y - (y0 + i * PAUSE_STEP) - 4) < PAUSE_STEP / 2 && Math.abs(inp.pointer.x - W / 2) < 170) {
            this.pauseSel = i; this.activatePause(); return;
          }
        }
        if (inp.pointer.type === 'mouse') return;
      }
      if (inp.pressed.start || inp.pressed.attack) this.activatePause();
    }
    activatePause() {
      A.sfx.select();
      const id = this.pauseItems()[this.pauseSel].id;
      if (id === 'resume') this.paused = false;
      else if (id === 'options') this.sub = new WL.OptionsPanel('options');
      else if (id === 'controls') this.sub = new WL.OptionsPanel('controls');
      else if (id === 'quit') { A.stopMusic(); this.game.toTitle(); }
      else this.adjustPause(id, 1);
    }

    /* ---- drawing ---- */
    draw(ctx) {
      const L = this.level, p = this.player;
      ctx.save();
      const snap = WL.display.mode === 'classic' ? 1 : WL.display.renderScale;
      ctx.translate(Math.round((this.shakeX + this.punchX) * snap) / snap, Math.round((this.shakeY + this.punchY) * snap) / snap);
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
        const h = 36 * k;
        ctx.fillStyle = '#071007';
        ctx.fillRect(0, 44, W, Math.max(10, h * 0.62));
        ctx.fillRect(0, H - h, W, h);
      }
      if (this.flashT > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.8, this.flashT * 2.5); ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      WL.draw.stageLighting(ctx, L.id, this.lightingPulse, this.t);
      this.drawHUD(ctx);
      // Control picture stays for the whole stage — intro, fight, clear —
      // on a phone and on a desktop. It is not tied to the tutorial timer.
      WL.input.drawTouch(ctx, { always: true, fartReady: p.fart >= p.fartMax, hasToolbox: p.hasToolbox || p.state === 'grab' });
      if (p.fart >= p.fartMax && (this.phase === 'play' || this.phase === 'intro')) this.drawFartReady(ctx);
      if (this.paused) this.drawPause(ctx);
      D.scanlines(ctx, 0.07);
    }
    drawTells(ctx, pass) {
      const cb = WL.settings.data.colorblind;
      for (const e of this.enemies) {
        if (!e || e.dead) continue;
        const sx = e.x - this.camX, sy = e.y;
        if (sx < -100 || sx > W + 100) continue;
        const telling = e.state === 'windup' || e.state === 'prime';
        if (pass === 'floor' && telling) {
          const dur = e.state === 'windup' ? e.def.windup : (e.primeDur || 0.28);
          const k = U.clamp(e.stateT / Math.max(0.05, dur), 0, 1);
          const late = k > 0.72;
          const dir = e.facing || 1;
          ctx.save();
          if (e.state === 'windup' && e.meleeBox) {
            // The exact box the swing tests: outline = where, fill = when.
            const b = e.meleeBox();
            const x0 = sx - dir * b.back, len = b.back + b.front;
            const left = dir > 0 ? x0 : x0 - len;
            ctx.globalAlpha = 0.28 + 0.45 * k;
            ctx.fillStyle = tellColor(late);
            const fw = len * (0.25 + 0.75 * k);
            ctx.beginPath(); ctx.ellipse(dir > 0 ? x0 + fw / 2 : x0 - fw / 2, sy, fw / 2, b.depth, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.lineWidth = late ? 2.5 : 1.5;
            ctx.strokeStyle = late ? '#ffffff' : '#1a0808';
            if (!late || cb) ctx.setLineDash(late ? [5, 3] : [3, 3]);
            ctx.beginPath(); ctx.ellipse(left + len / 2, sy, len / 2, b.depth, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
          } else {
            const reach = e.pending === 'charge' ? 130 : 108;
            ctx.globalAlpha = 0.32 + 0.5 * k;
            ctx.fillStyle = tellColor(late);
            ctx.beginPath();
            ctx.ellipse(sx + dir * reach * 0.42, sy, Math.max(10, reach * 0.48 * (0.4 + 0.6 * k)), 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = late ? '#ffffff' : '#1a0808'; ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
        if (pass === 'label' && telling) {
          const dur = e.state === 'windup' ? e.def.windup : (e.primeDur || 0.28);
          const k = U.clamp(e.stateT / Math.max(0.05, dur), 0, 1);
          T.draw(ctx, k > 0.72 ? '!!' : '!', sx, sy - e.z - e.height - 18, { size: 12, align: 'center', color: k > 0.72 ? '#fff' : (cb ? '#f0e442' : '#ff4040'), stroke: '#000', strokeWidth: 3 });
        }
        if (!e.isBoss) continue;
        this.drawBossTells(ctx, e, pass, sx, sy);
      }
    }
    /* Boss tell language. Each move has its own floor shape, a phase color,
       a countdown clock under the cone, and the same "last call" in the final
       0.2 s: the outline goes solid white and a click plays.
         SPOON (slam)      rectangle = exact hit box, fill sweeps outward
         BELLY FLOP (jump) ring + cross = exact landing radius, outer ring closes in
         RAIN / BACKUP     dashed rings per drop / arrows at the spawn edges */
    drawBossTells(ctx, e, pass, sx, sy) {
      const F = E.FAIR;
      const phaseCol = e.phase === 1 ? '#bfefff' : e.phase === 2 ? '#ffe14a' : '#ff6fa8';
      const winding = e.state === 'slamWind' || e.state === 'jumpWind' || e.state === 'rainWind';
      const tp = winding && e.tellProgress ? e.tellProgress() : null;
      const blink = Math.floor(this.t * 16) % 2 === 0;
      if (pass === 'floor' && tp) {
        // Countdown clock: a pie that fills clockwise under the boss.
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(sx, sy + 2, 44, 14, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = tp.last ? '#ffffff' : phaseCol; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(sx, sy + 2, 44, 14, 0, -Math.PI / 2, -Math.PI / 2 + tp.k * Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (pass === 'floor' && e.state === 'slamWind') {
        const dir = e.facing || 1;
        const x0 = sx - dir * 10, len = F.slamReach + 10;
        const left = dir > 0 ? x0 : x0 - len;
        ctx.save();
        ctx.globalAlpha = 0.22 + 0.3 * tp.k;
        ctx.fillStyle = tellColor(tp.last);
        const fw = len * tp.k;
        ctx.fillRect(dir > 0 ? x0 : x0 - fw, sy - F.slamDepth, fw, F.slamDepth * 2);
        // chevrons point the way the spoon comes down
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const cx = x0 + dir * (30 + i * 36);
          ctx.beginPath(); ctx.moveTo(cx - dir * 6, sy - 8); ctx.lineTo(cx + dir * 4, sy); ctx.lineTo(cx - dir * 6, sy + 8); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = tp.last ? 3.5 : 2;
        ctx.strokeStyle = tp.last ? (blink ? '#ffffff' : '#ff2048') : phaseCol;
        if (!tp.last) ctx.setLineDash([6, 4]);
        D.rrect(ctx, left, sy - F.slamDepth, len, F.slamDepth * 2, 6); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (pass === 'floor' && (e.state === 'jumpWind' || e.state === 'jump') && e.jumpTargetX != null) {
        const tx = e.jumpTargetX - this.camX, ty = e.jumpTargetY;
        const rx = F.flopRadius, ry = F.flopRadius / 1.6;
        let k, last;
        if (e.state === 'jumpWind') { k = tp.k * 0.35; last = false; }
        else {
          const G = 900, remain = (e.vz + Math.sqrt(Math.max(0, e.vz * e.vz + 2 * G * e.z))) / G;
          k = 0.35 + 0.65 * U.clamp(1 - remain / (2 * 460 / G), 0, 1);
          last = remain <= 0.2;
          if (last && !e.flopCalled) { e.flopCalled = true; A.sfx.lastCall(); }
        }
        if (e.state === 'jumpWind') e.flopCalled = false;
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.25 * k;
        ctx.fillStyle = tellColor(last);
        ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = last ? 3.5 : 2.5;
        ctx.strokeStyle = last ? (blink ? '#ffffff' : '#ff2048') : phaseCol;
        ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        // outer ring closes onto the true radius as touchdown approaches
        const grow = 1 + (1 - k) * 0.7;
        ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.ellipse(tx, ty, rx * grow, ry * grow, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx - rx * 0.5, ty); ctx.lineTo(tx + rx * 0.5, ty); ctx.moveTo(tx, ty - ry * 0.5); ctx.lineTo(tx, ty + ry * 0.5); ctx.stroke();
        ctx.restore();
      }
      if (pass === 'label' && e.state === 'slamWind') {
        const dir = e.facing || 1;
        T.draw(ctx, 'SPOON', sx + dir * 72, sy - F.slamDepth - 14, { size: 8, align: 'center', color: tp.last ? '#fff' : phaseCol, stroke: '#000', strokeWidth: 3 });
      }
      if (pass === 'label' && e.state === 'jumpWind' && e.jumpTargetX != null) T.draw(ctx, 'BELLY FLOP', e.jumpTargetX - this.camX, e.jumpTargetY - F.flopRadius / 1.6 - 14, { size: 7, align: 'center', color: phaseCol, stroke: '#000', strokeWidth: 3 });
      if (pass === 'label' && e.state === 'rainWind') {
        const backup = !!e.summonNext;
        T.draw(ctx, backup ? 'BACKUP CUPS' : 'LOOK UP', sx, sy - 190, { size: 9, align: 'center', color: tp && tp.last ? '#fff' : phaseCol, stroke: '#000', strokeWidth: 3 });
        ctx.save();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
        if (backup) {
          // arrows at the two edges where the cups will walk in
          for (const side of [-1, 1]) {
            const ex = side < 0 ? 18 : W - 18, ey = (FT + FB) / 2;
            for (let i = 0; i < 2; i++) {
              const ax = ex - side * (i * 10) + side * (blink ? 2 : 0);
              ctx.beginPath(); ctx.moveTo(ax + side * 6, ey - 10); ctx.lineTo(ax - side * 4, ey); ctx.lineTo(ax + side * 6, ey + 10); ctx.stroke();
            }
          }
        } else {
          // three falling-drop dashes above the swirl
          for (let i = -1; i <= 1; i++) {
            const dx = sx + i * 26, dy = sy - 176 + ((this.t * 60 + i * 9) % 18);
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx, dy + 12); ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        ctx.restore();
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
      const big = WL.settings.data.bigHud;
      const cb = WL.settings.data.colorblind;
      // LARGE scales the left (Lance) and right (score) blocks from their
      // corners; the stage/wave line moves into the gap between them.
      const s = big ? 1.25 : 1;
      const hb = Math.round(44 * s);
      this.hudBottom = hb;
      // top bar with metallic gold border
      ctx.fillStyle = 'rgba(8,10,22,0.82)'; ctx.fillRect(0, 0, W, hb);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(0, hb, W, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, 1);

      ctx.save();
      ctx.scale(s, s);
      // lei-framed portrait — the cruise shirt should read in the scrum, not only the cutscene
      D.fillRRect(ctx, 4, 3, 34, 38, 3, '#6a2f9a', '#ffe14a');
      ctx.fillStyle = '#f7f2ff'; ctx.fillRect(6, 3, 3, 38); ctx.fillRect(33, 3, 3, 38);
      const hud = WL.assets.get('lanceHud');
      if (hud) ctx.drawImage(hud, 8, 7, 26, 30);
      else drawHudHead(ctx, p.hp < 30 ? 'hurt' : 'neutral');
      T.draw(ctx, 'LANCE', 42, 5, { size: 8, color: '#ffe14a' });
      T.draw(ctx, 'A/C', 96, 7, { size: 6, color: '#e7c6ff' });
      const hpPct = p.hp / p.maxHp;
      D.arcadeBar(ctx, 42, 17, 122, 9, hpPct, this.playerGhostHp / p.maxHp, hpColor(hpPct), cb ? '#ffffff' : '#ff9922', '#22080a');
      // Low health is marked by stripes as well as color.
      if (hpPct <= 0.25 && hpPct > 0) D.hatch(ctx, 42, 17, Math.max(1, Math.round(122 * hpPct)), 9);
      if (cb || big) T.draw(ctx, `HP ${Math.ceil(p.hp)}`, 164, 8, { size: 6, align: 'right', color: hpPct <= 0.25 ? '#fff' : '#dde', shadow: false });
      // lives
      for (let i = 0; i < Math.max(0, p.lives - 1); i++) { D.circle(ctx, 174 + i * 12, 21, 4.5, '#e0a878', S.OUT); ctx.fillStyle = '#eee'; ctx.fillRect(171 + i * 12, 22, 6, 1.5); }
      T.draw(ctx, `x${Math.max(0, p.lives - 1)}`, 174 + Math.max(0, p.lives - 1) * 12 + 2, 17, { size: 7, color: '#fff' });
      // fart meter
      const full = p.fart >= p.fartMax;
      const pulse = full ? 0.6 + Math.sin(this.t * 10) * 0.4 : 1;
      T.draw(ctx, 'VOLCANO FART', 42, 29, { size: 6, color: full ? `rgba(160,255,80,${pulse})` : '#9f3' });
      D.bar(ctx, 124, 29, 94, 7, p.fart / p.fartMax, full ? `rgba(160,255,80,${pulse})` : '#7ad83a', '#12300a');
      if (full) {
        if (Math.floor(this.t * 6) % 2 === 0) {
          D.fillRRect(ctx, 222, 28, 28, 9, 2, '#ffe14a', '#12300a');
          T.draw(ctx, 'MAX', 236, 29, { size: 6, align: 'center', color: '#111', shadow: false });
        }
      }
      // toolbox indicator
      if (p.hasToolbox) { S.tool(ctx, 'toolbox', 256, 20, 0); }
      ctx.restore();

      ctx.save();
      ctx.translate(W, 0); ctx.scale(s, s); ctx.translate(-W, 0);
      // score
      T.draw(ctx, 'SCORE', W - 8, 6, { size: 7, align: 'right', color: '#ffe14a' });
      T.draw(ctx, U.pad(p.score, 7), W - 8, 16, { size: 10, align: 'right', color: '#fff' });
      const temp = L.temp != null ? L.temp : 72;
      const hot = temp >= 90 ? '#ff5a3a' : temp >= 80 ? '#ffb020' : '#8fd4ff';
      T.draw(ctx, `${L.short || L.name}  ${temp}°F`, W - 8, 31, { size: 6, align: 'right', color: hot });
      ctx.restore();
      // stage progress & coin-op wave indicator. LARGE has no room between
      // the scaled blocks (the pause button lives there), so it tucks the
      // line under the score, clear of the centered boss bar.
      const prog = U.clamp(this.camX / Math.max(1, L.length - W), 0, 1);
      const totalWaves = L.waves ? L.waves.length : 1;
      const currentWaveNum = Math.min(this.waveIdx + 1, totalWaves);
      const stageLine = `STAGE ${L.id} • WAVE ${currentWaveNum}/${totalWaves}`;
      if (big) {
        const tw = T.width(ctx, stageLine, 7);
        D.fillRRect(ctx, W - 14 - Math.max(tw, 120), hb + 3, Math.max(tw, 120) + 8, 20, 3, 'rgba(8,10,22,0.72)', null);
        T.draw(ctx, stageLine, W - 8, hb + 5, { size: 7, align: 'right', color: '#ffe14a', stroke: '#000', strokeWidth: 2 });
        D.bar(ctx, W - 8 - 120, hb + 16, 120, 3, prog, '#ffe14a', '#333');
      } else {
        D.bar(ctx, W / 2 - 60, 36, 120, 3, prog, '#ffe14a', '#333');
        T.draw(ctx, stageLine, W / 2, 25, { size: 6, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 2 });
      }
      const dy = hb - 44;

      // combo — ranks, not a generic "FIGHT"
      const comboY = (this.boss ? 124 : 52) + dy;
      if (this.bannerT <= 0 && p.comboCount >= 2 && p.comboDisplayT > 0) {
        const pop = 1 + (p.comboPop || 0) * 0.35;
        const rank = (WL.voice && WL.voice.comboRank(p.comboCount)) || '';
        const tool = p.lastToolT > 0 && WL.voice ? (p.lastTool === 'uppercut' ? 'WRENCH POP' : WL.voice.toolName(p.lastTool)) : '';
        ctx.save();
        ctx.translate(18, comboY);
        ctx.scale(pop, pop);
        ctx.fillStyle = 'rgba(255,80,180,0.25)';
        ctx.fillRect(-2, -2, 90, 24);
        const col = p.comboCount >= 12 ? '#ff6ed2' : p.comboCount >= 8 ? '#fff680' : '#ffe14a';
        T.draw(ctx, `${p.comboCount} HITS!`, 0, 0, { size: p.comboCount >= 10 ? 17 : 14, color: col, stroke: '#000', strokeWidth: 5 });
        if (rank) {
          D.fillRRect(ctx, 0, 18, T.width(ctx, rank, 7) + 8, 12, 2, 'rgba(0,0,0,0.7)', '#ff7ad4');
          T.draw(ctx, rank, 4, 20, { size: 7, color: '#ffb3e6', shadow: false });
        }
        if (tool) T.draw(ctx, tool, 0, rank ? 32 : 18, { size: 6, color: '#ffffff', stroke: '#000', strokeWidth: 3 });
        if (p.juggleCount > 0) T.draw(ctx, `JUGGLE x${p.juggleCount}`, 0, (rank ? 32 : 18) + (tool ? 10 : 0), { size: 6, color: '#bff4ff', stroke: '#000', strokeWidth: 3 });
        ctx.restore();
      }
      if (this.bannerT <= 0 && this.cards.length) {
        const c = this.cards[0];
        const cy = (this.boss ? 124 : 78) + dy + (big ? 14 : 0);
        T.draw(ctx, c.name, W - 10, cy, { size: 7, align: 'right', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        T.draw(ctx, c.line, W - 10, cy + 12, { size: 6, align: 'right', color: '#fff', stroke: '#000', strokeWidth: 3 });
      }
      // ahead arrow
      if (!this.locked && this.aliveEnemies() === 0 && this.phase === 'play' && (this.currentWave() || !L.boss) && Math.floor(this.t * 3) % 2 === 0) {
        const go = L.boss ? 'THE CONE' : 'THE DUCT';
        T.draw(ctx, go, W - 36, 102 + dy, { size: 8, align: 'right', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W - 30, 100 + dy); ctx.lineTo(W - 10, 110 + dy); ctx.lineTo(W - 30, 120 + dy); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // boss bar sits under the HUD so thumbs keep the bottom of the screen
      if (this.boss && !this.boss.remove) {
        const b = this.boss;
        const bw = 268, bx = W / 2 - bw / 2, by = 58 + dy;
        const phaseName = b.phase === 1 ? 'SWIRL' : b.phase === 2 ? 'TOPPINGS' : 'MELT';
        const phaseCol = b.phase === 1 ? '#bfefff' : b.phase === 2 ? '#ffe14a' : '#ff6fa8';
        T.draw(ctx, 'GIANT FROYO CONE', W / 2, by - 10, { size: 6, align: 'center', color: '#f9c', stroke: '#000', strokeWidth: 3 });
        D.bar(ctx, bx, by, bw, 8, b.hp / b.maxHp, b.phase === 3 ? '#e02040' : '#e85a8a', '#3a0a1a');
        // Notches where the next phases begin: you can see a change coming.
        ctx.fillStyle = '#ffffff';
        for (const at of [1 / 3, 2 / 3]) { const nx = Math.round(bx + bw * at); ctx.fillRect(nx - 1, by - 3, 2, 14); }
        if (b.armor > 0) { ctx.save(); ctx.globalAlpha = 0.85; D.bar(ctx, bx, by + 9, bw * b.armor, 3, 1, '#bfefff', '#123'); ctx.restore(); }
        D.fillRRect(ctx, bx - 4 - T.width(ctx, phaseName, 6) - 6, by - 1, T.width(ctx, phaseName, 6) + 6, 10, 2, 'rgba(0,0,0,0.6)', phaseCol);
        T.draw(ctx, phaseName, bx - 7, by + 1, { size: 6, align: 'right', color: phaseCol, shadow: false });
        if (b.armor > 0) T.draw(ctx, 'ARMOR', bx + bw + 4, by + 6, { size: 5, color: '#bff' });
        this.drawBossMoves(ctx, b, W / 2, by + 16, phaseCol);
      }
      // tutorial
      if (this.tutorialT > 0 && this.tutorial) {
        const ts = big ? 9 : 7;
        const lines = T.wrap(ctx, WL.input.fillKeys(this.tutorial), ts, W - 80);
        const bh = 14 + lines.length * (ts + 4);
        const lift = 158;
        D.fillRRect(ctx, 30, H - lift - bh, W - 60, bh, 4, 'rgba(0,0,30,0.85)', '#39f');
        lines.forEach((l, i) => T.draw(ctx, l, W / 2, H - lift - bh + 7 + i * (ts + 4), { size: ts, align: 'center', color: '#fff' }));
      }
      // banner
      if (this.bannerT > 0 && this.banner) {
        const big = !!this.banner.big;
        const k = Math.min(1, this.bannerT * 2);
        const y = big ? 104 : 70;
        const h = big ? 68 : 42;
        ctx.save(); ctx.globalAlpha = k;
        ctx.fillStyle = big ? 'rgba(10,5,0,0.86)' : 'rgba(8,12,24,0.84)';
        ctx.fillRect(0, y, W, h);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, y, W, 3);
        ctx.fillRect(0, y + h - 3, W, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        for (let bx = 0; bx < W; bx += 18) {
          ctx.beginPath();
          ctx.moveTo(bx, y); ctx.lineTo(bx + 8, y); ctx.lineTo(bx + 4, y + 3); ctx.lineTo(bx - 4, y + 3);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(bx, y + h - 3); ctx.lineTo(bx + 8, y + h - 3); ctx.lineTo(bx + 4, y + h); ctx.lineTo(bx - 4, y + h);
          ctx.closePath(); ctx.fill();
        }
        T.draw(ctx, this.banner.a, W / 2, y + (big ? 8 : 4), { size: big ? 18 : 13, align: 'center', gradient: ['#ffffff', '#ffd23f', '#ff4d00'], stroke: '#000', strokeWidth: big ? 6 : 4 });
        T.draw(ctx, this.banner.b, W / 2, y + (big ? 36 : 22), { size: big ? 9 : 7, align: 'center', color: '#fff9e0', stroke: '#000', strokeWidth: 3 });
        ctx.restore();
      }
      if (this.phase === 'dead') { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); T.draw(ctx, 'LANCE HIT THE DECK', W / 2, 150, { size: 16, align: 'center', color: '#e03020', stroke: '#000', strokeWidth: 5 }); }
    }
    /* Move legend under the boss bar: each move with the floor shape it draws.
       Moves unlocked in later phases are listed dim so the next phase isn't a surprise. */
    drawBossMoves(ctx, b, cx, y, phaseCol) {
      const moves = [
        { name: 'SPOON', icon: 'rect', from: 1 },
        { name: 'FLOP', icon: 'ring', from: 2 },
        { name: 'RAIN', icon: 'drops', from: 2 },
        { name: 'PUDDLES', icon: 'puddle', from: 3 }
      ];
      const itemW = 70, x0 = cx - (moves.length * itemW) / 2;
      ctx.save();
      moves.forEach((m, i) => {
        const x = x0 + i * itemW + 8, on = b.phase >= m.from;
        ctx.globalAlpha = on ? 1 : 0.4;
        ctx.strokeStyle = on ? phaseCol : '#889'; ctx.lineWidth = 1.5;
        if (m.icon === 'rect') { ctx.strokeRect(x, y + 1, 12, 7); }
        else if (m.icon === 'ring') { ctx.beginPath(); ctx.ellipse(x + 6, y + 4.5, 6, 4, 0, 0, Math.PI * 2); ctx.moveTo(x + 2, y + 4.5); ctx.lineTo(x + 10, y + 4.5); ctx.moveTo(x + 6, y + 1.5); ctx.lineTo(x + 6, y + 7.5); ctx.stroke(); }
        else if (m.icon === 'drops') { ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.ellipse(x + 6, y + 4.5, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = on ? 'rgba(247,167,199,0.8)' : '#556'; ctx.beginPath(); ctx.ellipse(x + 6, y + 4.5, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
        T.draw(ctx, on ? m.name : `P${m.from}`, x + 16, y + 1, { size: 5, color: on ? '#fff' : '#99a', stroke: '#000', strokeWidth: 2 });
      });
      ctx.restore();
    }
    drawPause(ctx) {
      ctx.fillStyle = 'rgba(0,0,10,0.7)'; ctx.fillRect(0, 0, W, H);
      if (this.sub) { this.sub.draw(ctx); return; }
      T.draw(ctx, 'PAUSED', W / 2, 58, { size: 22, align: 'center', gradient: ['#fff', '#ffe14a'], stroke: '#000', strokeWidth: 5 });
      this.pauseItems().forEach((it, i) => {
        const sel = i === this.pauseSel;
        T.draw(ctx, (sel ? '> ' : '  ') + it.label + (it.adj ? '   < >' : ''), W / 2, PAUSE_Y0 + i * PAUSE_STEP, { size: 9, align: 'center', color: sel ? '#ffe14a' : '#ddd' });
      });
      // Legend comes from the live bindings, so it stays honest after a remap.
      T.draw(ctx, WL.input.legend(), W / 2, 256, { size: 6, align: 'center', color: '#bcd' });
      T.draw(ctx, 'Walk into an enemy = duct-tape grab. Attack = knee. Back+Attack or Jump = throw.', W / 2, 270, { size: 6, align: 'center', color: '#bcd' });
      T.draw(ctx, 'COMBO: ATK ATK ... (beat) ATK = WRENCH POP launcher. Juggle with ATK or the flying boot.', W / 2, 284, { size: 6, align: 'center', color: '#bff' });
      T.draw(ctx, 'Left / right changes the highlighted setting. \\ toggles fullscreen.', W / 2, 298, { size: 6, align: 'center', color: '#9ab' });
      T.draw(ctx, `KILLS: ${this.kills}   HITS: ${this.player.hits}   STAGE ${this.level.id} WAVE ${Math.min(this.waveIdx + 1, this.level.waves.length)}`, W / 2, 318, { size: 7, align: 'center', color: '#9ab' });
      if (WL.input.touchEnabled) WL.input.drawTouch(ctx, { buttons: false });
    }
  }

  /* ================================================================== */
  /* Game Over                                                          */
  /* ================================================================== */
  class GameOver {
    constructor(game, levelIndex, score, waveIdx) {
      this.game = game; this.levelIndex = levelIndex; this.score = score; this.t = 0; this.count = 9;
      const L = WL.LEVELS[levelIndex];
      this.wave = Math.max(0, Math.min((L.waves.length || 1) - 1, waveIdx | 0));
      this.sel = 0;
      this.items = [
        { id: 'continue', label: `CONTINUE  STAGE ${L.id}  WAVE ${this.wave + 1}/${L.waves.length}` },
        { id: 'restart', label: `RESTART STAGE ${L.id}` },
        { id: 'title', label: 'QUIT TO TITLE' }
      ];
    }
    enter() {
      // Keep the checkpoint on disk so Continue also works after a reload.
      WL.settings.saveRun({ level: this.levelIndex, wave: this.wave, score: Math.floor(this.score / 2), fart: 0 });
    }
    rowAt(pt) {
      for (let i = 0; i < this.items.length; i++) {
        const y = 246 + i * 18;
        if (pt.y >= y - 3 && pt.y < y + 15 && Math.abs(pt.x - W / 2) < 170) return i;
      }
      return -1;
    }
    update(dt, inp) {
      this.t += dt;
      const left = Math.max(0, 9 - Math.floor(this.t));
      if (left !== this.count) { this.count = left; if (left > 0) A.sfx.blip(); }
      if (this.t > 10.5) { this.game.toTitle(); return; }
      if (this.t <= 0.5) return;
      if (inp.pressed.down) { this.sel = (this.sel + 1) % this.items.length; A.sfx.blip(); this.t = Math.min(this.t, 5); }
      if (inp.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; A.sfx.blip(); this.t = Math.min(this.t, 5); }
      if (inp.pressed.click && inp.pointer) {
        const i = this.rowAt(inp.pointer);
        if (i >= 0) { this.sel = i; this.choose(); return; }
        if (inp.pointer.type === 'mouse') return;
      }
      if (inp.pressed.start || inp.pressed.attack || inp.pressed.jump || inp.pressed.click) this.choose();
    }
    choose() {
      A.sfx.select();
      const id = this.items[this.sel].id;
      if (id === 'continue') this.game.continueGame(this.levelIndex, this.score, this.wave);
      else if (id === 'restart') this.game.continueGame(this.levelIndex, this.score, 0);
      else this.game.toTitle();
    }
    draw(ctx) {
      ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
      D.vignette(ctx, 0.7);
      S.drawLance(ctx, W / 2 - 60, 194, { pose: 'down', t: this.t, facing: 1 });
      // froyo taunting
      S.drawEnemy(ctx, W / 2 + 60, 194, { type: 'froyo', pose: 'idle', t: this.t, facing: -1 });
      T.draw(ctx, 'GAME OVER', W / 2, 44, { size: 28, align: 'center', gradient: ['#fff', '#e03020'], stroke: '#000', strokeWidth: 6 });
      T.draw(ctx, '"The buffet sends its regards."', W / 2, 86, { size: 7, align: 'center', color: '#f9c' });
      T.draw(ctx, `SCORE ${U.pad(this.score, 7)}`, W / 2, 104, { size: 10, align: 'center', color: '#ffe14a' });
      T.draw(ctx, `CONTINUE?  ${this.count}`, W / 2, 222, { size: 14, align: 'center', color: Math.floor(this.t * 4) % 2 ? '#fff' : '#ffe14a', stroke: '#000', strokeWidth: 4 });
      this.items.forEach((it, i) => {
        const sel = i === this.sel;
        T.draw(ctx, (sel ? '> ' : '  ') + it.label, W / 2, 246 + i * 18, { size: 8, align: 'center', color: sel ? '#ffe14a' : '#ccd' });
      });
      T.draw(ctx, 'CONTINUE KEEPS YOUR STAGE AND WAVE. HALF SCORE, 3 LIVES.', W / 2, 310, { size: 6, align: 'center', color: '#9ab' });
      T.draw(ctx, WL.input.touchEnabled ? 'TAP A ROW TO INSERT COIN' : 'CLICK OR ENTER TO INSERT COIN', W / 2, 326, { size: 7, align: 'center', color: '#bcd' });
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
