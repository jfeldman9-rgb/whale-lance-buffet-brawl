/* Cinematic story player. A reel is a list of beats (WL.STORY in js/levels.js):
   a painted plate under a camera move, a location card, name cards pinned to the
   characters, hit accents, a slam title, typed dialogue with a speaker portrait
   and a VO chirp, and a wipe / flash / fade into the next beat. The opening
   Cutscene and the between-stage / ending StoryBeat are both reels. */
'use strict';

WL.cinema = (function () {
  const U = WL.util, D = WL.draw, T = WL.text, A = WL.audio, S = WL.sprites;
  const W = WL.W, H = WL.H;
  const BAR = 22;            // letterbox bar height
  const BOX_H = 50;          // dialogue box
  const BOX_Y = H - BAR - BOX_H + 12;
  const TYPE_CPS = 44;       // typed characters per second
  const FIRST_LINE = 0.9;    // dialogue starts once the location card and first name card have landed
  const LINE_GAP = 0.3;
  const TRANS = 0.55;        // transition length
  const TAG_LIFE = 3.4;
  const PLATE_WAIT = 4;      // longest wait for a background plate before the drawn fallback plays

  const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
  const easeInOut = t => 0.5 - Math.cos(Math.PI * clamp01(t)) / 2;
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const backOut = t => { const c = 1.7; t = clamp01(t) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

  const SPEAKERS = {
    lance: { name: 'WHALE LANCE', color: '#d8321f', side: -1, img: () => WL.art.plate('lance-portrait') || WL.assets.get('lancePortrait') },
    captain: { name: 'CAPTAIN ANDERSEN', color: '#2462c4', side: 1, img: () => WL.assets.get('story:captain-portrait') }
  };

  const lineHold = text => 1.25 + text.length * 0.03;
  /** Line start / typed / end times and the beat length. */
  function timeline(b) {
    let t = FIRST_LINE;
    const lines = (b.lines || []).map(([who, text]) => {
      const start = t, typed = start + text.length / TYPE_CPS, end = typed + lineHold(text);
      t = end + LINE_GAP;
      return { who, text, start, typed, end };
    });
    const slamEnd = b.slam && b.slam.end;
    const dur = Math.max(t + (slamEnd ? 2.4 : 0.2), 4.2);
    return { lines, dur, slamAt: b.slam ? (slamEnd ? t - LINE_GAP + 0.15 : b.slam.at) : -1 };
  }

  /* ---------------- cached bits ---------------- */
  function vignette() {
    return WL.gfx.layer('cine-vignette', W, H, 2, g => {
      const r = g.createRadialGradient(W / 2, H * 0.48, H * 0.35, W / 2, H * 0.5, W * 0.62);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(8,4,16,0.5)');
      g.fillStyle = r; g.fillRect(0, 0, W, H);
    });
  }
  function dot(color) {
    return WL.gfx.layer('cine-dot-' + color, 32, 32, 3, g => {
      const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      r.addColorStop(0, color); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    });
  }
  function medallion(who, r) {
    const sp = SPEAKERS[who], img = sp && sp.img();
    const size = r * 2 + 8;
    return WL.gfx.layer('cine-medal-' + who + '-' + r + (img ? '' : '-drawn'), size, size, undefined, g => {
      const c = size / 2;
      g.save();
      g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.clip();
      const bg = g.createLinearGradient(0, 0, 0, size);
      bg.addColorStop(0, '#8fd0ff'); bg.addColorStop(1, '#2a6fc0');
      g.fillStyle = bg; g.fillRect(0, 0, size, size);
      g.imageSmoothingQuality = 'high';
      if (img) {
        const z = who === 'captain' ? 1.16 : 1.1;
        const d = r * 2 * z;
        g.drawImage(img, c - d / 2, c - d / 2 + (who === 'captain' ? r * 0.14 : r * 0.04), d, d);
      } else {
        S.lanceHead(g, c, c + 2, r * 1.4, { mood: 'idle' });
      }
      const sh = g.createLinearGradient(0, c - r, 0, c + r);
      sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = sh; g.fillRect(0, 0, size, size);
      g.restore();
      g.beginPath(); g.arc(c, c, r + 1.5, 0, Math.PI * 2);
      g.strokeStyle = '#140c02'; g.lineWidth = 4; g.stroke();
      const gg = g.createLinearGradient(0, c - r, 0, c + r);
      gg.addColorStop(0, '#fff4b8'); gg.addColorStop(0.4, '#e2b23a'); gg.addColorStop(0.7, '#8a5c10'); gg.addColorStop(1, '#d8a834');
      g.strokeStyle = gg; g.lineWidth = 2.4; g.stroke();
    });
  }
  /** Skewed card (SoR4-style slant). */
  function slab(ctx, x, y, w, h, fill, edge) {
    const k = h * 0.35;
    ctx.beginPath();
    ctx.moveTo(x + k, y); ctx.lineTo(x + w + k, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x - k, y + h); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
  }

  /* ---------------- ambient overlays (stateless, driven by time) ---------------- */
  function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function ambient(ctx, fx, t, view) {
    if (!fx) return;
    const lite = WL.perf.lite;
    const n = lite ? 0.5 : 1;
    const at = (px, py) => [(px - view.x) / view.w * W, (py - view.y) / view.h * H];
    ctx.save();
    if (fx === 'heat' || fx === 'sparkle') {
      ctx.globalCompositeOperation = 'lighter';
      const e = dot(fx === 'heat' ? 'rgba(255,190,90,0.9)' : 'rgba(255,240,180,0.95)');
      for (let i = 0; i < 26 * n; i++) {
        const k = (t * (0.05 + hash(i) * 0.08) + hash(i + 9)) % 1;
        const x = hash(i + 3) * W + Math.sin(t * 1.3 + i) * 6, y = fx === 'heat' ? H - k * (H - BAR) : BAR + hash(i + 5) * (H - 2 * BAR);
        const a = Math.sin(k * Math.PI) * (fx === 'heat' ? 0.5 : 0.35 + 0.35 * Math.sin(t * 5 + i * 2));
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        const r = fx === 'heat' ? 3 + hash(i + 7) * 4 : 2 + hash(i + 7) * 3;
        ctx.drawImage(e.c, x - r, y - r, r * 2, r * 2);
      }
      if (fx === 'heat') {
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        const warm = ctx.createLinearGradient(0, 0, 0, H);
        warm.addColorStop(0, 'rgba(255,170,60,0.12)'); warm.addColorStop(0.6, 'rgba(255,120,30,0.04)'); warm.addColorStop(1, 'rgba(255,90,20,0.1)');
        ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
      }
    } else if (fx === 'alarm') {
      const a = 0.08 + 0.1 * Math.max(0, Math.sin(t * 7));
      ctx.fillStyle = `rgba(255,20,10,${a.toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    } else if (fx === 'steam') {
      const e = dot('rgba(240,240,235,0.55)');
      for (let i = 0; i < 12 * n; i++) {
        const k = (t * (0.07 + hash(i) * 0.05) + hash(i + 2)) % 1;
        const r = 30 + k * 60;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.5;
        ctx.drawImage(e.c, hash(i + 4) * W - r + Math.sin(t + i) * 10, H * 0.9 - k * H * 0.8 - r, r * 2, r * 2);
      }
    } else if (fx === 'cool' || fx === 'frost') {
      const e = dot('rgba(220,245,255,0.95)');
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 34 * n; i++) {
        const k = (t * (0.08 + hash(i) * 0.1) + hash(i + 1)) % 1;
        const x = fx === 'cool' ? (hash(i + 2) * W * 1.4 - W * 0.2) + k * 120 : hash(i + 2) * W + Math.sin(t * 0.8 + i) * 12;
        const y = fx === 'cool' ? BAR + hash(i + 6) * (H - 2 * BAR) - k * 40 : BAR + k * (H - 2 * BAR);
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
        const r = 1.5 + hash(i + 8) * 2.5;
        ctx.drawImage(e.c, x - r, y - r, r * 2, r * 2);
      }
      if (fx === 'cool') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(210,240,255,0.25)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 7 * n; i++) {
          const k = (t * 0.35 + hash(i + 20)) % 1, y = BAR + 20 + hash(i + 21) * (H - 2 * BAR - 60);
          ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.beginPath(); ctx.moveTo(-60 + k * (W + 120), y); ctx.quadraticCurveTo(-20 + k * (W + 120), y - 8, 30 + k * (W + 120), y - 3); ctx.stroke();
        }
      } else {
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(120,180,255,0.08)'; ctx.fillRect(0, 0, W, H);
      }
    } else if (fx === 'pink') {
      const [x, y] = at(0.65, 0.3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.4);
      const e = dot('rgba(255,90,170,0.9)');
      ctx.drawImage(e.c, x - 110, y - 110, 220, 220);
    } else if (fx === 'confetti') {
      const cols = ['#ff4a6a', '#ffd23f', '#3cc0ff', '#7bff6a', '#ffffff', '#b070ff'];
      for (let i = 0; i < 40 * n; i++) {
        const k = (t * (0.12 + hash(i) * 0.1) + hash(i + 3)) % 1;
        const x = hash(i + 4) * W + Math.sin(t * 2 + i) * 14, y = BAR - 10 + k * (H - BAR);
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * (2 + hash(i) * 4) + i);
        ctx.globalAlpha = 0.9; ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-2.5, -1.2, 5, 2.4 * Math.abs(Math.cos(t * 6 + i)) + 0.4);
        ctx.restore();
      }
    } else if (fx === 'debris' && WL.art.has('props')) {
      const bits = ['floret', 'floret2', 'lettuce'];
      for (let i = 0; i < 12 * n; i++) {
        const k = (t * (0.35 + hash(i) * 0.3) + hash(i + 5)) % 1;
        const [ox, oy] = at(0.66, 0.45);
        const ang = hash(i + 6) * Math.PI * 2, sp = 180 + hash(i + 7) * 260;
        const x = ox + Math.cos(ang) * sp * k, y = oy + Math.sin(ang) * sp * k * 0.7 + 160 * k * k;
        const f = bits[i % bits.length];
        if (!WL.art.frame('props', f)) continue;
        ctx.globalAlpha = 1 - k * 0.6;
        WL.art.draw(ctx, 'props', f, x, y, { rot: t * 6 + i, sx: 0.8 + hash(i) * 0.6, sy: 0.8 + hash(i) * 0.6 });
      }
    }
    ctx.restore();
  }

  /* ---------------- the reel ---------------- */
  class Reel {
    /** beats: WL.STORY entries. o: { music, onDone, game } */
    constructor(game, beats, o) {
      this.game = game;
      this.beats = beats.filter(Boolean);
      this.onDone = o.onDone; this.music = o.music;
      this.i = 0; this.clock = 0; this.done = false;
      this.hits = []; this.shake = 0; this.flash = 0; this.punch = 0;
      this.trans = null;
      this.start(0);
    }
    get beat() { return this.beats[this.i]; }
    plateKey(b) { return b && b.plate ? 'story:' + b.plate : null; }
    start(i) {
      this.i = i; this.t = 0; this.fired = new Set(); this.lastTyped = -1; this.lastLine = -1;
      this.tl = timeline(this.beat);
      const key = this.plateKey(this.beat);
      this.waiting = !!key && !WL.assets.settled(key);
      this.waitT = 0;
      if (this.waiting) WL.assets.ready([key]);
    }
    enter() {
      if (this.music) A.playMusic(this.music);
      WL.assets.ready(this.beats.map(b => this.plateKey(b)).filter(Boolean));
      this.onBeatStart();
    }
    onBeatStart() {
      const b = this.beat;
      if (b.music) A.playMusic(b.music);
    }
    finish() {
      if (this.done) return;
      this.done = true;
      this.onDone && this.onDone();
    }
    next() {
      if (this.i + 1 >= this.beats.length) { this.finish(); return; }
      const prev = { b: this.beat, tl: this.tl, t: this.t, i: this.i };
      this.start(this.i + 1);
      this.trans = { prev, t: 0, via: this.beat.via || 'wipe' };
      if (this.trans.via === 'flash') A.sfx.impact(); else A.sfx.wipe();
      this.onBeatStart();
    }
    /** Press: finish typing, then the next line, then the next beat. */
    advance() {
      const t = this.t, L = this.tl.lines;
      const cur = this.currentLine();
      if (cur >= 0 && t < L[cur].typed) { this.jump(L[cur].typed); return; }
      const nxt = L.findIndex(l => l.start > t + 1e-3);
      if (nxt >= 0) this.jump(L[nxt].start);
      else this.next();
    }
    jump(to) { this.quietUntil = to; this.events(this.t, to); this.t = to; }
    currentLine() {
      const L = this.tl.lines;
      let k = -1;
      for (let j = 0; j < L.length; j++) if (L[j].start <= this.t) k = j;
      return k;
    }
    update(dt, inp) {
      this.clock += dt;
      if (this.done) return;
      if (inp.pressed.click && inp.pointer && inp.pointer.x > W - 92 && inp.pointer.y < BAR + 14) { A.sfx.select(); this.finish(); return; }
      if (inp.pressed.pause) { A.sfx.select(); this.finish(); return; }
      if (this.trans) {
        this.trans.t += dt;
        if (this.trans.t >= TRANS) this.trans = null;
      }
      if (this.waiting) {
        this.waitT += dt;
        if (WL.assets.settled(this.plateKey(this.beat)) || this.waitT > PLATE_WAIT) this.waiting = false;
        return;
      }
      const press = inp.pressed.start || inp.pressed.attack || inp.pressed.jump || inp.pressed.click;
      if (press && this.t > 0.25) { A.sfx.blip(); this.advance(); if (this.done) return; }
      const t0 = this.t;
      this.t += dt;
      this.events(t0, this.t);
      this.voice();
      this.shake = Math.max(0, this.shake - dt * 22);
      this.flash = Math.max(0, this.flash - dt * 3.2);
      this.punch = Math.max(0, this.punch - dt * 0.18);
      for (const h of this.hits) h.t += dt;
      this.hits = this.hits.filter(h => h.t < 1.1);
      if (this.t >= this.tl.dur) this.next();
    }
    /** Fire everything scheduled in (a, b]. A skip-ahead fires the visuals but keeps one stinger at most. */
    events(a, b) {
      const beat = this.beat, fire = (id, at) => at > a - 1e-6 && at <= b && !this.fired.has(id) && (this.fired.add(id), true);
      const quiet = this.quietUntil && b <= this.quietUntil && b - a > 0.2;
      if (fire('sting', 0) && beat.sting) A.sfx.stinger(beat.sting);
      if (beat.slam && fire('slam', this.tl.slamAt)) this.accent({ shake: 6 }, quiet);
      (beat.hits || []).forEach((h, k) => { if (fire('hit' + k, h.at)) this.accent(h, quiet); });
      (beat.tags || []).forEach((g, k) => { if (fire('tag' + k, g.at) && !quiet) A.sfx.tag(); });
      this.tl.lines.forEach((l, k) => { if (fire('line' + k, l.start)) { A.sfx.voLine(l.who); this.lastTyped = 0; } });
    }
    accent(h, quiet) {
      this.shake = Math.max(this.shake, (h.shake || 5) * (WL.settings.data.shake === 'reduced' ? 0.4 : 1));
      this.flash = Math.max(this.flash, WL.settings.data.shake === 'reduced' ? 0.25 : 0.6);
      this.punch = Math.max(this.punch, 0.03);
      if (h.text) this.hits.push({ text: h.text, x: h.x, y: h.y, t: 0 });
      if (!quiet) A.sfx.impact();
    }
    /** VO placeholder: a babble syllable every few typed letters. */
    voice() {
      const k = this.currentLine();
      if (k < 0) return;
      const l = this.tl.lines[k];
      const n = Math.min(l.text.length, Math.floor((this.t - l.start) * TYPE_CPS));
      if (k !== this.lastLine) { this.lastLine = k; this.lastTyped = 0; }
      if (n > this.lastTyped) {
        for (let j = this.lastTyped; j < n; j++) if (j % 3 === 0 && /[A-Za-z]/.test(l.text[j])) { A.sfx.babble(l.who); break; }
        this.lastTyped = n;
      }
    }

    /* ---------- drawing ---------- */
    view(b, tl, t) {
      const c = b.cam || [0.5, 0.5, 1.06, 0.5, 0.5, 1.0];
      const k = easeInOut(t / tl.dur);
      const z = U.lerp(c[2], c[5], k) * (1 + this.punch);
      const w = 1 / z, h = 1 / z;
      const cx = U.clamp(U.lerp(c[0], c[3], k), w / 2, 1 - w / 2), cy = U.clamp(U.lerp(c[1], c[4], k), h / 2, 1 - h / 2);
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    drawPlate(ctx, b, tl, t) {
      const v = this.view(b, tl, t);
      const img = WL.assets.get(this.plateKey(b));
      if (img) {
        const iw = img.width, ih = img.height;
        ctx.drawImage(img, v.x * iw, v.y * ih, v.w * iw, v.h * ih, -2, -2, W + 4, H + 4);
        if (b.fx === 'heat' && !WL.perf.lite && WL.display.mode !== 'classic') {
          // Heat haze over the horizon band: thin strips nudged sideways.
          const y0 = 0.3, y1 = 0.58, n = 18;
          for (let s = 0; s < n; s++) {
            const a = y0 + (y1 - y0) * s / n, bh = (y1 - y0) / n;
            const dx = Math.sin(this.clock * 3.1 + s * 0.9) * 0.9 * Math.sin(Math.PI * s / n);
            ctx.drawImage(img, v.x * iw, (v.y + a * v.h) * ih, v.w * iw, bh * v.h * ih, -2 + dx, a * H, W + 4, bh * H + 0.6);
          }
        }
      } else this.drawFallback(ctx, b, t);
      ambient(ctx, b.fx, this.clock, v);
      return v;
    }
    drawFallback(ctx, b, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#15305e'); g.addColorStop(0.62, b.tint || '#c9824a'); g.addColorStop(1, '#3a2012');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(200, 300); ctx.scale(2.2, 2.2);
      S.drawLance(ctx, 0, 0, { pose: 'idle', t, facing: 1 });
      ctx.restore();
    }
    drawTags(ctx, b, t, v) {
      (b.tags || []).forEach(g => {
        const age = t - g.at;
        if (age < 0 || age > TAG_LIFE) return;
        const inK = easeOut(age / 0.32), outK = age > TAG_LIFE - 0.35 ? (TAG_LIFE - age) / 0.35 : 1;
        const px = (g.x - v.x) / v.w * W, py = (g.y - v.y) / v.h * H;
        const side = g.side || 1;
        ctx.save();
        ctx.globalAlpha *= clamp01(outK);
        const nw = T.width(ctx, g.name, 9), sw = g.sub ? T.width(ctx, g.sub, 6.5, { ui: true, weight: 800 }) : 0;
        const w = Math.max(nw, sw) + 18, h = g.sub ? 29 : 18;
        let cx = side > 0 ? px + 26 : px - 26 - w, cy = py - h - 8;
        cx = U.clamp(cx, 14, W - 14 - w); cy = U.clamp(cy, BAR + 26, BOX_Y - h - 10);
        // Keep clear of a slam title that's on screen.
        if (this.slamVisible(b, t)) { const sy = this.slamY(b); if (cy < sy + 40 && cy + h > sy - 14) cy = sy + 40; }
        const slide = (1 - inK) * 40 * side;
        // leader line + pulsing ring on the character
        ctx.strokeStyle = 'rgba(255,225,80,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(side > 0 ? cx + slide : cx + w + slide, cy + h * 0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 3 + Math.sin(this.clock * 8) * 0.8, 0, Math.PI * 2); ctx.fillStyle = '#ffe14a'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 7 + (age % 0.8) * 10, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,225,80,${(0.8 - (age % 0.8)).toFixed(2)})`; ctx.stroke();
        ctx.translate(slide, 0);
        slab(ctx, cx + 3, cy + 3, w, h, 'rgba(0,0,0,0.45)');
        slab(ctx, cx, cy, w, h, 'rgba(10,16,40,0.9)', 'rgba(255,225,80,0.8)');
        slab(ctx, cx - 4, cy, 5, h, '#ffd23f');
        T.draw(ctx, g.name, cx + 10, cy + 5, { size: 9, gradient: ['#ffffff', '#ffe14a', '#ffb020'], stroke: '#140a00', strokeWidth: 3, shadow: false });
        if (g.sub) T.draw(ctx, g.sub, cx + 10, cy + 17, { size: 6.5, ui: true, weight: 800, color: '#d8ecff', shadow: false });
        ctx.restore();
      });
    }
    slamY(b) { return b.slam.y != null ? b.slam.y : b.slam.end ? 118 : 72; }
    slamVisible(b, t) { return !!b.slam && t >= this.tl.slamAt && (b.slam.end || t <= this.tl.slamAt + 2.6); }
    drawSlam(ctx, b, t) {
      if (!b.slam) return;
      const at = this.tl.slamAt, age = t - at;
      const life = b.slam.end ? 99 : 2.6;
      if (age < 0 || age > life) return;
      const k = backOut(age / 0.34), out = age > life - 0.4 ? (life - age) / 0.4 : 1;
      const text = b.slam.text, size = Math.min(24, 560 / text.length);
      const y = this.slamY(b);
      ctx.save();
      ctx.globalAlpha *= clamp01(out) * clamp01(age / 0.08);
      // dark band behind the title
      const band = ctx.createLinearGradient(0, y - 18, 0, y + size + 22);
      band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.5, 'rgba(10,0,20,0.55)'); band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = band; ctx.fillRect(0, y - 18, W, size + 40);
      if (b.slam.end && WL.art.plate('logo')) {
        const P = WL.ARTDATA.plates.logo, lw = 250, lh = lw * P.h / P.w;
        ctx.drawImage(WL.art.plate('logo'), W / 2 - lw / 2, y - lh - 14, lw, lh);
      }
      ctx.translate(W / 2, y + size / 2);
      const s = 1 + (1 - k) * 1.4;
      ctx.scale(s, s);
      ctx.transform(1, 0, -0.16, 1, 0, 0);
      for (let d = 3; d >= 1; d--) T.draw(ctx, text, d * 0.6, -size / 2 + d, { size, align: 'center', color: '#3a0600', stroke: '#3a0600', strokeWidth: size * 0.34, shadow: false });
      T.draw(ctx, text, 0, -size / 2, { size, align: 'center', color: '#160300', stroke: '#160300', strokeWidth: size * 0.4, shadow: false });
      T.draw(ctx, text, 0, -size / 2, { size, align: 'center', gradient: ['#fffde8', '#ffe03a', '#ff8a10', '#e02400'], stroke: '#fff1b0', strokeWidth: size * 0.09, shadow: false });
      ctx.restore();
    }
    drawHits(ctx, v) {
      for (const h of this.hits) {
        const px = (h.x - v.x) / v.w * W, py = (h.y - v.y) / v.h * H - h.t * 14;
        const s = backOut(h.t / 0.22) * (h.t > 0.8 ? 1 - (h.t - 0.8) / 0.3 : 1);
        if (s <= 0) continue;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(-0.14); ctx.scale(s, s);
        // comic burst
        ctx.beginPath();
        for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 22 : 38; ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.8); }
        ctx.closePath(); ctx.fillStyle = 'rgba(255,245,200,0.92)'; ctx.fill(); ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 2; ctx.stroke();
        T.draw(ctx, h.text, 0, -8, { size: 14, align: 'center', gradient: ['#ffffff', '#ffd23f', '#ff5a00'], stroke: '#1a0800', strokeWidth: 5, shadow: false });
        ctx.restore();
      }
    }
    drawKicker(ctx, b, t) {
      if (!b.kicker) return;
      const k = backOut((t - 0.1) / 0.4);
      if (k <= 0) return;
      const tw = T.width(ctx, b.kicker, 7), w = tw + 30, x = -12 - (1 - k) * (w + 20), y = BAR + 8;
      slab(ctx, x + 3, y + 3, w, 17, 'rgba(0,0,0,0.45)');
      slab(ctx, x, y, w, 17, 'rgba(160,20,16,0.92)');
      slab(ctx, x, y + 17, w - 6, 2.5, '#ffd23f');
      T.draw(ctx, b.kicker, x + 20, y + 5, { size: 7, color: '#fff8e0', stroke: '#300400', strokeWidth: 2.5, shadow: false });
    }
    drawTemp(ctx, b, t) {
      if (!b.temp) return;
      const [from, to] = b.temp;
      const k = easeInOut((t - 1.3) / 2.2), cur = U.lerp(from, to, k);
      const inK = easeOut((t - 0.3) / 0.4);
      if (inK <= 0) return;
      const w = 112, h = 32, x = W - 14 - w + (1 - inK) * (w + 20), y = BAR + 8;
      const col = cur > 85 ? '#ff4a2a' : cur > 76 ? '#ffb020' : '#46c0ff';
      D.fillRRect(ctx, x + 2, y + 2, w, h, 6, 'rgba(0,0,0,0.4)');
      D.fillRRect(ctx, x, y, w, h, 6, 'rgba(8,14,34,0.88)', 'rgba(255,255,255,0.5)');
      T.draw(ctx, 'SHIP TEMP', x + 8, y + 5, { size: 5, color: '#b8cde6', shadow: false });
      T.draw(ctx, `${Math.round(cur)}°F`, x + 8, y + 14, { size: 12, color: col, stroke: '#000', strokeWidth: 3, shadow: false });
      // glass tube
      D.fillRRect(ctx, x + w - 28, y + 5, 8, h - 10, 4, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.5)');
      const f = clamp01((cur - 60) / 40);
      D.fillRRect(ctx, x + w - 26.5, y + 6.5 + (h - 13) * (1 - f), 5, (h - 13) * f, 2.5, col);
      if (to < from && k > 0.02) {
        const d = Math.round(from - cur);
        if (d > 0) {
          const ax = x + 66, ay = y + 17;
          ctx.fillStyle = '#8fe0ff';
          ctx.beginPath(); ctx.moveTo(ax - 3.5, ay); ctx.lineTo(ax + 3.5, ay); ctx.lineTo(ax, ay + 5); ctx.closePath(); ctx.fill();
          T.draw(ctx, `${d}°`, ax + 5, ay - 1, { size: 7, ui: true, weight: 800, color: '#8fe0ff', shadow: false });
        }
      }
    }
    drawDialogue(ctx, t) {
      const k = this.currentLine();
      if (k < 0) return;
      const l = this.tl.lines[k];
      const sp = SPEAKERS[l.who];
      const age = t - l.start;
      const up = easeOut(age / 0.22);
      const n = Math.min(l.text.length, Math.max(0, Math.floor(age * TYPE_CPS)));
      const typed = l.text.slice(0, n);
      ctx.save();
      ctx.translate(0, (1 - up) * 18);
      ctx.globalAlpha *= up;
      if (!sp) {
        // Narrator: a centered caption strip, no portrait.
        const w = 470, x = (W - w) / 2;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, 'rgba(6,8,20,0)'); g.addColorStop(0.12, 'rgba(6,8,20,0.82)'); g.addColorStop(0.88, 'rgba(6,8,20,0.82)'); g.addColorStop(1, 'rgba(6,8,20,0)');
        ctx.fillStyle = g; ctx.fillRect(x, BOX_Y + 4, w, BOX_H - 14);
        ctx.fillStyle = 'rgba(255,210,63,0.8)'; ctx.fillRect(x + 50, BOX_Y + 4, w - 100, 1);
        const lines = T.wrap(ctx, l.text, 11, w - 70, { ui: true });
        let shown = n;
        lines.forEach((ln, j) => {
          const part = ln.slice(0, Math.max(0, shown)); shown -= ln.length + 1;
          const lw = T.width(ctx, ln, 11, { ui: true, weight: 700 });
          T.draw(ctx, part, W / 2 - lw / 2, BOX_Y + 10 + j * 14 + (lines.length === 1 ? 6 : 0), { size: 11, ui: true, weight: 700, color: '#fff3c4', shadowColor: 'rgba(0,0,0,0.9)', shadowOffset: 1 });
        });
      } else {
        const left = sp.side < 0;
        const x = left ? 64 : 16, w = W - 80;
        D.fillRRect(ctx, x + 2, BOX_Y + 2, w, BOX_H - 10, 7, 'rgba(0,0,0,0.4)');
        const g = ctx.createLinearGradient(0, BOX_Y, 0, BOX_Y + BOX_H);
        g.addColorStop(0, 'rgba(18,24,56,0.94)'); g.addColorStop(1, 'rgba(6,8,22,0.94)');
        D.fillRRect(ctx, x, BOX_Y, w, BOX_H - 10, 7, g, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = sp.color; ctx.fillRect(left ? x + 1 : x + w - 4, BOX_Y + 5, 3, BOX_H - 20);
        // name tab
        const nw = T.width(ctx, sp.name, 7) + 22, nx = left ? x + 18 : x + w - 18 - nw;
        slab(ctx, nx, BOX_Y - 10, nw, 13, sp.color, 'rgba(255,255,255,0.7)');
        T.draw(ctx, sp.name, nx + 11, BOX_Y - 7, { size: 7, color: '#ffffff', stroke: '#0a0a1a', strokeWidth: 2.5, shadow: false });
        const tx = left ? x + 20 : x + 16;
        const lines = T.wrap(ctx, l.text, 11, w - 40, { ui: true });
        let shown = n;
        lines.forEach((ln, j) => {
          const part = ln.slice(0, Math.max(0, shown)); shown -= ln.length + 1;
          T.draw(ctx, part, tx, BOX_Y + 9 + j * 14 + (lines.length === 1 ? 5 : 0), { size: 11, ui: true, weight: 700, color: '#ffffff', shadowColor: 'rgba(0,0,0,0.9)', shadowOffset: 1 });
        });
        // portrait medallion, popping in with the line
        const r = 27, pop = backOut(age / 0.28), mx = left ? 40 : W - 40, my = BOX_Y + 10;
        const e = medallion(l.who, r);
        ctx.save(); ctx.translate(mx, my); ctx.scale(pop, pop);
        WL.gfx.blit(ctx, e, -e.w / 2, -e.h / 2);
        ctx.restore();
      }
      if (typed.length >= l.text.length && Math.floor(this.clock * 3) % 2 === 0) {
        const ax = sp ? (sp.side < 0 ? W - 30 : W - 76) : W / 2 + 220, ay = BOX_Y + BOX_H - 20;
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath(); ctx.moveTo(ax - 4, ay); ctx.lineTo(ax + 4, ay); ctx.lineTo(ax, ay + 4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    drawBars(ctx) {
      const k = easeOut(this.clock / 0.5);
      const bh = BAR * k;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
      if (k < 1) return;
      // skip chip (clickable) and progress pips
      const sx = W - 88;
      D.fillRRect(ctx, sx, 5, 80, 12, 6, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.35)');
      T.draw(ctx, WL.input.touchEnabled ? 'SKIP ▶▶' : `${WL.input.hint('pause', 1)}  SKIP ▶▶`, sx + 40, 8, { size: 5, align: 'center', color: '#dfe8f4', shadow: false });
      const n = this.beats.length;
      for (let j = 0; j < n; j++) {
        const x = W / 2 - (n - 1) * 6 + j * 12;
        D.circle(ctx, x, H - BAR / 2, j === this.i ? 3 : 2, j === this.i ? '#ffd23f' : j < this.i ? '#b89a40' : 'rgba(255,255,255,0.3)');
      }
      T.draw(ctx, WL.input.touchEnabled ? 'TAP: NEXT' : 'ENTER / ATTACK: NEXT', W - 10, H - BAR / 2 - 3, { size: 5, align: 'right', color: '#9aabbd', shadow: false });
    }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const b = this.beat;
      if (this.waiting) {
        this.drawBars(ctx);
        const a = 0.5 + 0.5 * Math.sin(this.clock * 4);
        T.draw(ctx, 'CUE THE STEEL DRUMS...', W / 2, H / 2 - 4, { size: 7, align: 'center', color: `rgba(255,225,120,${a.toFixed(2)})`, shadow: false });
        return;
      }
      const t = this.t;
      const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
      ctx.save();
      ctx.translate(sx, sy);
      let v;
      const tr = this.trans;
      if (tr) {
        const p = tr.t / TRANS;
        if (tr.via === 'flash') {
          if (p < 0.4) this.drawPlate(ctx, tr.prev.b, tr.prev.tl, tr.prev.t);
          else v = this.drawPlate(ctx, b, this.tl, t);
          ctx.fillStyle = `rgba(255,255,255,${(p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20);
        } else if (tr.via === 'fade') {
          this.drawPlate(ctx, tr.prev.b, tr.prev.tl, tr.prev.t);
          ctx.save(); ctx.globalAlpha = easeInOut(p); v = this.drawPlate(ctx, b, this.tl, t); ctx.restore();
        } else {
          // Slanted wipe with a gold leading edge.
          this.drawPlate(ctx, tr.prev.b, tr.prev.tl, tr.prev.t);
          const e = easeInOut(p) * (W + 160) - 80, sk = 70;
          ctx.save();
          ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(e + sk, -10); ctx.lineTo(e - sk, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip();
          v = this.drawPlate(ctx, b, this.tl, t);
          ctx.restore();
          ctx.beginPath(); ctx.moveTo(e + sk, -10); ctx.lineTo(e + sk + 7, -10); ctx.lineTo(e - sk + 7, H + 10); ctx.lineTo(e - sk, H + 10); ctx.closePath();
          ctx.fillStyle = '#ffd23f'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(e + sk + 7, -10); ctx.lineTo(e + sk + 9, -10); ctx.lineTo(e - sk + 9, H + 10); ctx.lineTo(e - sk + 7, H + 10); ctx.closePath();
          ctx.fillStyle = '#b8200e'; ctx.fill();
        }
      } else v = this.drawPlate(ctx, b, this.tl, t);
      v = v || this.view(b, this.tl, t);
      this.drawHits(ctx, v);
      ctx.restore();
      if (WL.display.mode !== 'classic') WL.gfx.blit(ctx, vignette(), 0, 0);
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,248,230,${(this.flash * 0.7).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
      const settled = !tr || tr.t / TRANS > 0.5;
      if (settled) {
        this.drawTags(ctx, b, t, v);
        this.drawSlam(ctx, b, t);
      }
      this.drawBars(ctx);
      if (settled) {
        this.drawKicker(ctx, b, t);
        this.drawTemp(ctx, b, t);
        this.drawDialogue(ctx, t);
      }
    }
  }

  /** Opening: beats in order, then onDone. */
  class Cutscene extends Reel {
    constructor(game, beats, onDone, music) { super(game, beats, { onDone, music: music || 'story' }); }
  }
  /** Between stages and the ending. o: { beats, music, onDone }. Plain { title, lines } still works. */
  class StoryBeat extends Reel {
    constructor(game, o) {
      const beats = o.beats || [{ kicker: o.title, lines: (o.lines || []).map(s => ['narrator', s]), temp: o.tempFrom != null ? [o.tempFrom, o.tempTo] : null, tint: o.palette }];
      super(game, beats, { onDone: o.onDone, music: o.music || 'story' });
    }
  }

  return { Reel, Cutscene, StoryBeat, timeline, SPEAKERS };
})();
