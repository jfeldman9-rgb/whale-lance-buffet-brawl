/* Whale Lance: Buffet Brawl — shared helpers */
'use strict';

const WL = window.WL = window.WL || {};

WL.W = 640;
WL.H = 360;
WL.FLOOR_TOP = 205;     // highest walkable foot position (far)
WL.FLOOR_BOTTOM = 345;  // lowest walkable foot position (near)
WL.FONT = "'Press Start 2P', 'Courier New', monospace";

/* Display presentation. main.js fills renderScale / pc / dpr from the window.
   mode: 'auto' (device pixels on every screen, up to 4K),
   'sharp' (at least 2x device density, up to 4K), 'classic' (640x360, nearest-neighbor).
   renderScale is the world-to-backing-store scale, including devicePixelRatio. */
WL.display = {
  mode: 'auto',
  pc: false,
  renderScale: 1,
  dpr: 1,
  fullscreen: false,
  resize: null
};

/* World light for the current stage. side: +1 = key light from screen right.
   Sprites flip with ctx.scale(-1, 1), so they use side * facing locally.
   cast: opacity of the hard sun shadow (0 = overhead / soft only). */
WL.light = {
  side: 1, cast: 0.3, key: 'rgba(255,244,210,0.55)', rim: 'rgba(255,250,225,0.9)', shade: 'rgba(40,18,60,0.26)',
  set(o) { Object.assign(this, { side: 1, cast: 0.3, key: 'rgba(255,244,210,0.55)', rim: 'rgba(255,250,225,0.9)', shade: 'rgba(40,18,60,0.26)' }, o || {}); }
};

/* Offscreen layer cache. Static art (skyline, deck tiles, loungers) is
   painted once per render scale and blitted, instead of re-running hundreds
   of path ops per frame on a 4K backing store. maxScale caps resolution:
   distant layers are cached softer on purpose, which reads as depth of field. */
WL.gfx = {
  _c: {},
  scale(maxScale) {
    const rs = WL.display.mode === 'classic' ? 1 : (WL.display.renderScale || 1);
    return Math.max(1, Math.min(rs, maxScale || rs));
  },
  layer(key, w, h, maxScale, paint) {
    const s = this.scale(maxScale);
    let e = this._c[key];
    if (!e || e.s !== s) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * s)); c.height = Math.max(1, Math.ceil(h * s));
      const g = c.getContext('2d');
      g.setTransform(s, 0, 0, s, 0, 0);
      g.imageSmoothingEnabled = true;
      paint(g, w, h);
      e = this._c[key] = { c, s, w, h };
    }
    return e;
  },
  snap(v) {
    const rs = WL.display.mode === 'classic' ? 1 : (WL.display.renderScale || 1);
    return Math.round(v * rs) / rs;
  },
  blit(ctx, e, x, y) { ctx.drawImage(e.c, this.snap(x), this.snap(y), e.w, e.h); },
  /** Repeat a seamless tile horizontally; scroll = world offset in px. */
  tile(ctx, e, scroll, y) {
    let x = -(((scroll % e.w) + e.w) % e.w);
    // One device pixel of overlap hides seams from fractional placement.
    const ov = 1 / Math.max(1, WL.display.renderScale || 1);
    for (; x < WL.W; x += e.w) ctx.drawImage(e.c, this.snap(x), this.snap(y), e.w + ov, e.h);
  }
};

const U = WL.util = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
  approach(cur, target, step) {
    if (cur < target) return Math.min(cur + step, target);
    if (cur > target) return Math.max(cur - step, target);
    return cur;
  },
  chance(p) { return Math.random() < p; },
  pad(n, w) { let s = String(n); while (s.length < w) s = '0' + s; return s; },
  hex(h, a) {
    // '#rrggbb' + alpha -> rgba()
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },
  seeded(seed) {
    // tiny deterministic PRNG (mulberry32) for background detail placement
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
};

/* ---- canvas text helpers ---- */
WL.text = {
  draw(ctx, str, x, y, opts = {}) {
    const size = opts.size || 8;
    ctx.save();
    ctx.font = `${size}px ${WL.FONT}`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    if (opts.shadow !== false) {
      ctx.fillStyle = opts.shadowColor || 'rgba(0,0,0,0.85)';
      const o = opts.shadowOffset || Math.max(1, Math.round(size / 8));
      ctx.fillText(str, x + o, y + o);
    }
    if (opts.stroke) {
      ctx.lineWidth = opts.strokeWidth || Math.max(2, size / 4);
      ctx.strokeStyle = opts.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    if (opts.gradient) {
      const g = ctx.createLinearGradient(0, y, 0, y + size);
      opts.gradient.forEach((c, i) => g.addColorStop(i / (opts.gradient.length - 1), c));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = opts.color || '#fff';
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  },
  width(ctx, str, size) {
    ctx.save();
    ctx.font = `${size}px ${WL.FONT}`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  },
  // Word-wrap into lines that fit maxWidth
  wrap(ctx, str, size, maxWidth) {
    ctx.save();
    ctx.font = `${size}px ${WL.FONT}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }
};

/* ---- drawing helpers ---- */
WL.draw = {
  rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  fillRRect(ctx, x, y, w, h, r, color, stroke) {
    WL.draw.rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  },
  ellipse(ctx, x, y, rx, ry, color, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  },
  circle(ctx, x, y, r, color, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  },
  line(ctx, x1, y1, x2, y2, color, w) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w || 1;
    ctx.stroke();
  },
  shadow(ctx, x, y, rx, ry, z) {
    const s = Math.max(0.25, 1 - (z || 0) / 160);
    const srx = rx * s;
    const sry = (ry || rx * 0.35) * s;
    const a = Math.min(0.5, 0.42 * s);
    // One cached radial sprite, stretched per entity, instead of a new
    // gradient object for every body every frame.
    const spr = WL.draw._shadowSprite();
    if (spr) {
      const a0 = ctx.globalAlpha;
      const L = WL.light;
      // Hard-edged cast shadow thrown away from the sun, under the soft contact blob.
      if (L.cast > 0 && !WL.perf.lite) {
        const hard = WL.draw._hardShadowSprite();
        if (hard) {
          const len = (1.2 + (z || 0) / 90) * srx;
          const cx = x - L.side * len * 0.55 + (z || 0) * -L.side * 0.2;
          ctx.globalAlpha = a0 * L.cast * s;
          ctx.drawImage(hard, cx - len, y - sry * 0.9, len * 2, sry * 1.8);
        }
      }
      ctx.globalAlpha = a0 * a;
      ctx.drawImage(spr, x - srx, y - sry, srx * 2, sry * 2);
      ctx.globalAlpha = a0;
      return;
    }
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, srx));
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.65, `rgba(0,0,0,${a * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, srx, sry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  _shadowSprite() {
    if (this._shadow !== undefined) return this._shadow;
    this._shadow = null;
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this._shadow = c;
    } catch (e) { this._shadow = null; }
    return this._shadow;
  },
  _hardShadowSprite() {
    if (this._hard !== undefined) return this._hard;
    this._hard = null;
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 16, 0, 32, 16, 32);
      grad.addColorStop(0, 'rgba(20,10,30,1)');
      grad.addColorStop(0.78, 'rgba(20,10,30,0.92)');
      grad.addColorStop(0.92, 'rgba(20,10,30,0.35)');
      grad.addColorStop(1, 'rgba(20,10,30,0)');
      g.setTransform(1, 0, 0, 0.5, 0, 0);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this._hard = c;
    } catch (e) { this._hard = null; }
    return this._hard;
  },
  /** Diagonal stripes: a shape cue for "low" that doesn't rely on hue. */
  hatch(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color || 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1, h * 0.28);
    ctx.beginPath();
    for (let i = -h; i < w + h; i += Math.max(3, h * 0.8)) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
    ctx.stroke();
    ctx.restore();
  },
  // arcade-style bar
  bar(ctx, x, y, w, h, pct, fg, bg, border) {
    ctx.fillStyle = border || '#000';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg || '#3a0a0a';
    ctx.fillRect(x, y, w, h);
    if (pct > 0) {
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, Math.max(1, Math.round(w * U.clamp(pct, 0, 1))), h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, Math.max(1, Math.round(w * U.clamp(pct, 0, 1))), Math.max(1, h >> 2));
    }
  },
  arcadeBar(ctx, x, y, w, h, pct, ghostPct, fg, ghostCol, bg) {
    pct = U.clamp(pct, 0, 1);
    ghostPct = U.clamp(ghostPct !== undefined ? ghostPct : pct, pct, 1);
    const r = Math.min(h / 2 + 2, 6);
    // Brushed-metal bezel, then a recessed glass track.
    const bez = ctx.createLinearGradient(0, y - 3, 0, y + h + 3);
    bez.addColorStop(0, '#f3f5f8'); bez.addColorStop(0.45, '#8f97a6'); bez.addColorStop(1, '#3b4150');
    WL.draw.rrect(ctx, x - 3, y - 3, w + 6, h + 6, r + 2); ctx.fillStyle = '#0b0d16'; ctx.fill();
    WL.draw.rrect(ctx, x - 2, y - 2, w + 4, h + 4, r + 1); ctx.fillStyle = bez; ctx.fill();
    ctx.save();
    WL.draw.rrect(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = bg || '#1e080a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, w, Math.max(1, h * 0.3));
    if (ghostPct > 0) {
      ctx.fillStyle = ghostCol || '#ffaa33';
      ctx.fillRect(x, y, Math.max(1, Math.round(w * ghostPct)), h);
    }
    if (pct > 0) {
      const bw = Math.max(1, Math.round(w * pct));
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, bw, h);
      const gl = ctx.createLinearGradient(0, y, 0, y + h);
      gl.addColorStop(0, 'rgba(255,255,255,0.62)');
      gl.addColorStop(0.42, 'rgba(255,255,255,0.12)');
      gl.addColorStop(0.55, 'rgba(0,0,0,0.05)');
      gl.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = gl; ctx.fillRect(x, y, bw, h);
      // Hot leading edge.
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + bw - 1.5, y + 1, 1.5, h - 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let p = 0.1; p < 0.99; p += 0.1) ctx.fillRect(Math.round(x + w * p), y + h * 0.5, 1, h * 0.5);
    ctx.restore();
  },
  stageLighting(ctx, stageId, pulse, t) {
    ctx.save();
    pulse = U.clamp(pulse || 0, 0, 1);
    const W = WL.W, H = WL.H;
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    if (stageId === 1) {
      // Bright midday: a light edge falloff, not a dark tunnel.
      vig.addColorStop(0, 'rgba(255,240,200,0)');
      vig.addColorStop(0.75, 'rgba(40,20,10,0.08)');
      vig.addColorStop(1, `rgba(30,14,6,${0.26 + pulse * 0.2})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      if (!WL.perf.lite) {
        // Sun bloom from the upper right, added on top so it lifts rather than tints.
        ctx.globalCompositeOperation = 'lighter';
        const bloom = ctx.createRadialGradient(W * 0.86, 20, 0, W * 0.86, 20, W * 0.62);
        bloom.addColorStop(0, 'rgba(255,236,170,0.34)');
        bloom.addColorStop(0.35, 'rgba(255,210,130,0.10)');
        bloom.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);
        // Faint god rays slanting down-left across the deck.
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#fff4d0';
        for (let i = 0; i < 5; i++) {
          const x0 = W * 0.96 - i * 70 + Math.sin((t || 0) * 0.3 + i) * 6;
          ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 26 + i * 4, 0); ctx.lineTo(x0 - 230 - i * 20, H); ctx.lineTo(x0 - 290 - i * 20, H); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (stageId === 2) {
      vig.addColorStop(0, 'rgba(0,20,30,0)');
      vig.addColorStop(0.7, 'rgba(5,15,22,0.32)');
      vig.addColorStop(1, `rgba(2,8,14,${0.62 + pulse * 0.25})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      if (Math.sin((t || 0) * 2) > 0) {
        ctx.fillStyle = 'rgba(255,140,20,0.03)';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (stageId === 3) {
      vig.addColorStop(0, 'rgba(200,255,245,0)');
      vig.addColorStop(0.7, 'rgba(10,35,30,0.22)');
      vig.addColorStop(1, `rgba(4,18,16,${0.52 + pulse * 0.25})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(60,200,180,0.035)';
      ctx.fillRect(0, 0, W, H);
    } else if (stageId === 4) {
      vig.addColorStop(0, 'rgba(210,240,255,0)');
      vig.addColorStop(0.7, 'rgba(10,20,45,0.32)');
      vig.addColorStop(1, `rgba(4,10,28,${0.65 + pulse * 0.25})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(140,210,255,0.05)';
      ctx.fillRect(0, 0, W, H);
    }
    if (pulse > 0) {
      ctx.fillStyle = `rgba(255,255,220,${pulse * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  },
  scanlines(ctx, alpha) {
    // CRT stripes intentionally belong to Classic, never the HD presentation.
    if (WL.display.mode !== 'classic') return;
    // One path instead of a fillRect per stripe. The stripe is one device
    // pixel so a retina backing store doesn't turn the CRT mask into thick
    // bars that soften Lance and the HUD.
    const rs = Math.max(1, (WL.display && WL.display.renderScale) || 1);
    ctx.save();
    ctx.globalAlpha = alpha || 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    const thick = 1 / rs;
    for (let y = 0; y < WL.H; y += 3) ctx.rect(0, y, WL.W, thick);
    ctx.fill();
    ctx.restore();
  },
  vignette(ctx, strength) {
    const g = ctx.createRadialGradient(WL.W / 2, WL.H / 2, WL.H * 0.45, WL.W / 2, WL.H / 2, WL.W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength || 0.5})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WL.W, WL.H);
  },
  // Draw an image scaled to fit inside a box, centered, preserving aspect
  fitImage(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
  }
};
