/* Painted art: sprite atlases and background plates baked by tools/bake_art.py.
   Everything here is optional. When an atlas or plate hasn't loaded (or the
   file is missing), callers fall back to the procedural Canvas 2D drawing. */
'use strict';

WL.art = (function () {
  const DATA = WL.ARTDATA || {};
  const PLATES = DATA.plates || {};
  const cache = new Map();

  function atlas(name) { return WL.assets.get('art:' + name); }
  function plate(name) { return PLATES[name] ? WL.assets.get('plate:' + name) : null; }
  function has(name) { return !!(DATA[name] && DATA[name].f && atlas(name)); }
  function frame(name, f) { const A = DATA[name]; return A && A.f[f] ? A.f[f] : null; }
  function rs() { return WL.display.mode === 'classic' ? 1 : (WL.display.renderScale || 1); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  /* A frame resampled once to the live render scale, so the per-frame draw is a
     near 1:1 copy instead of a big downscale of the atlas. When the screen needs
     more pixels than the atlas has, the atlas itself is drawn. */
  function scaled(name, f) {
    const A = DATA[name], F = A.f[f], k = A.k, s = rs();
    if (s >= 1 / k * 0.9) return { c: atlas(name), sx: F[0], sy: F[1], sw: F[2], sh: F[3], k };
    const key = name + ':' + f + ':' + s;
    let e = cache.get(key);
    if (!e) {
      const c = canvas(F[2] * k * s, F[3] * k * s);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(atlas(name), F[0], F[1], F[2], F[3], 0, 0, c.width, c.height);
      e = { c, sx: 0, sy: 0, sw: c.width, sh: c.height, k: F[2] * k / c.width };
      cache.set(key, e);
    }
    return e;
  }

  /* Black silhouette (cast shadow) or a faded, vertically flipped copy (deck
     reflection) of a frame, at a fixed low resolution: both are soft anyway. */
  function derived(name, f, kind) {
    const key = kind + ':' + name + ':' + f;
    let e = cache.get(key);
    if (e) return e;
    const A = DATA[name], F = A.f[f], k = A.k, q = 1.5; // px per world px
    const c = canvas(F[2] * k * q + 4, F[3] * k * q + 4);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    const blur = 'filter' in g && kind === 'shadow';
    if (blur) g.filter = 'blur(1px)';
    g.drawImage(atlas(name), F[0], F[1], F[2], F[3], 2, 2, c.width - 4, c.height - 4);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-in';
    if (kind === 'shadow') { g.fillStyle = '#1a0c20'; g.fillRect(0, 0, c.width, c.height); }
    else {
      // Keep the colours, fade from the feet down.
      g.globalCompositeOperation = 'destination-in';
      const fade = g.createLinearGradient(0, c.height, 0, c.height * 0.35);
      fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fade; g.fillRect(0, 0, c.width, c.height);
    }
    g.globalCompositeOperation = 'source-over';
    e = { c, q };
    cache.set(key, e);
    return e;
  }

  /**
   * draw(ctx, atlasName, frameName, x, y, o)
   * x, y: the feet in world px. o.facing (+1 right), o.sx / o.sy squash, o.rot
   * (radians, about o.pivot px above the feet), o.alpha, o.lift (extra px up).
   */
  function draw(ctx, name, f, x, y, o) {
    o = o || {};
    const A = DATA[name], F = A && A.f[f];
    if (!F || !atlas(name)) return false;
    const k = A.k;
    const painted = F[7] || 1;
    const mirror = (o.facing || 1) * painted < 0;
    const e = scaled(name, f);
    const w = F[2] * k, h = F[3] * k, ax = F[4] * k, ay = F[5] * k;
    ctx.save();
    ctx.translate(x, y - (o.lift || 0));
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.rot) { const p = o.pivot || h * 0.4; ctx.translate(0, -p); ctx.rotate(mirror ? -o.rot : o.rot); ctx.translate(0, p); }
    if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
    const smooth = ctx.imageSmoothingEnabled, q = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = e.c === atlas(name) ? 'high' : 'low';
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(e.c, e.sx, e.sy, e.sw, e.sh, -ax, -ay, w, h);
    const T = mirror && A.f[f + '~t'];
    if (T) {
      // Printed lettering reads the right way round on a mirrored figure.
      ctx.scale(-1, 1);
      const px = T[4] * k - ax, py = T[5] * k - ay, pw = T[2] * k, ph = T[3] * k;
      ctx.drawImage(atlas(name), T[0], T[1], T[2], T[3], -(px + pw), py, pw, ph);
    }
    ctx.imageSmoothingEnabled = smooth; ctx.imageSmoothingQuality = q;
    ctx.restore();
    return true;
  }

  /* Hard sun shadow: the silhouette laid down on the deck away from the key light. */
  function castShadow(ctx, name, f, x, floorY, z, o) {
    const A = DATA[name], F = A && A.f[f];
    if (!F || !atlas(name) || WL.perf.lite || WL.display.mode === 'classic') return;
    const L = WL.light;
    if (!(L.cast > 0)) return;
    const e = derived(name, f, 'shadow');
    const k = A.k, painted = F[7] || 1, mirror = (o.facing || 1) * painted < 0;
    const w = F[2] * k, h = F[3] * k, ax = F[4] * k, ay = F[5] * k;
    const lying = f === 'down';
    ctx.save();
    ctx.globalAlpha *= L.cast * 1.25 * Math.max(0.3, 1 - (z || 0) / 120) * (o.alpha !== undefined ? o.alpha : 1);
    ctx.translate(x - L.side * (z || 0) * 0.5, floorY);
    // Upright pixels (y < 0) fall back and away from the sun: x += -side * 0.62 * height, y squashed.
    ctx.transform(1, 0, L.side * 0.62, lying ? 0.5 : 0.3, 0, 0);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(e.c, -ax - 2 / e.q, -ay - 2 / e.q, w + 4 / e.q, h + 4 / e.q);
    ctx.restore();
  }

  /* Lacquered-deck reflection: the frame mirrored under the feet, fading out. */
  function reflect(ctx, name, f, x, floorY, z, o) {
    const A = DATA[name], F = A && A.f[f];
    if (!F || !atlas(name) || WL.perf.lite) return;
    const e = derived(name, f, 'reflect');
    const k = A.k, painted = F[7] || 1, mirror = (o.facing || 1) * painted < 0;
    const w = F[2] * k, h = F[3] * k, ax = F[4] * k, ay = F[5] * k;
    ctx.save();
    ctx.globalAlpha *= (o.strength || 0.22) * (o.alpha !== undefined ? o.alpha : 1);
    ctx.translate(x, floorY + (z || 0));
    ctx.scale(mirror ? -1 : 1, -0.8);
    ctx.drawImage(e.c, -ax - 2 / e.q, -ay - 2 / e.q, w + 4 / e.q, h + 4 / e.q);
    ctx.restore();
  }

  /* A plate painted into a WL.gfx layer (cached per render scale). */
  function plateLayer(name, w, h, maxScale, blur, paint, tag) {
    const img = plate(name);
    if (!img) return null;
    return WL.gfx.layer('plate-' + name + (tag || '') + '-' + w + 'x' + h, w, h, maxScale, (g, lw, lh) => {
      g.imageSmoothingQuality = 'high';
      if (paint) paint(g, img, lw, lh); else g.drawImage(img, 0, 0, lw, lh);
    }, blur);
  }

  function clear() { cache.clear(); }

  return { DATA, has, frame, atlas, plate, draw, castShadow, reflect, plateLayer, clear };
})();
