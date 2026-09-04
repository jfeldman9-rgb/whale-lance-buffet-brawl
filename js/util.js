/* Whale Lance: Buffet Brawl — shared helpers */
'use strict';

const WL = window.WL = window.WL || {};

WL.W = 640;
WL.H = 360;
WL.FLOOR_TOP = 205;     // highest walkable foot position (far)
WL.FLOOR_BOTTOM = 345;  // lowest walkable foot position (near)
WL.FONT = "'Press Start 2P', 'Courier New', monospace";

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
  shadow(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry || rx * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
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
  scanlines(ctx, alpha) {
    ctx.fillStyle = `rgba(0,0,0,${alpha || 0.12})`;
    for (let y = 0; y < WL.H; y += 3) ctx.fillRect(0, y, WL.W, 1);
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
