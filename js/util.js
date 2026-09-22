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
    ctx.fillStyle = '#06060c';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#222638';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg || '#1e080a';
    ctx.fillRect(x, y, w, h);
    if (ghostPct > 0) {
      const gw = Math.max(1, Math.round(w * ghostPct));
      ctx.fillStyle = ghostCol || '#ffaa33';
      ctx.fillRect(x, y, gw, h);
    }
    if (pct > 0) {
      const bw = Math.max(1, Math.round(w * pct));
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, bw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(x, y, bw, Math.max(1, Math.floor(h * 0.35)));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + Math.floor(h * 0.7), bw, Math.ceil(h * 0.3));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let p = 0.2; p < 0.99; p += 0.2) {
      const tx = Math.round(x + w * p);
      ctx.fillRect(tx, y, 1, h);
    }
  },
  stageLighting(ctx, stageId, pulse, t) {
    ctx.save();
    pulse = U.clamp(pulse || 0, 0, 1);
    const W = WL.W, H = WL.H;
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    if (stageId === 1) {
      vig.addColorStop(0, 'rgba(255,240,200,0)');
      vig.addColorStop(0.7, 'rgba(30,15,5,0.22)');
      vig.addColorStop(1, `rgba(15,8,3,${0.5 + pulse * 0.25})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      const sun = ctx.createLinearGradient(0, 0, 0, 95);
      sun.addColorStop(0, 'rgba(255,230,140,0.14)');
      sun.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, 95);
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
