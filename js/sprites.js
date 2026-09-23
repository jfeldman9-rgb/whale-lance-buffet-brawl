/* Procedural arcade sprites. Everything is drawn with canvas primitives so the
   game has zero binary sprite dependencies; Lance's head uses the photo-derived
   portrait when available. All draw functions take the FEET position as origin
   and draw facing +x; callers flip with ctx.scale(-1,1) for facing left. */
'use strict';

WL.sprites = (function () {
  const D = WL.draw, T = WL.text;
  const OUT = '#141428'; // outline color

  function outlineStyle(ctx, w) { ctx.strokeStyle = OUT; ctx.lineWidth = w || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

  /* ---- lighting helpers ----
     LS is the local x-direction toward the key light for the sprite being
     drawn (world light side times facing). Every shaded primitive reads it. */
  let LS = 1;
  let FLIP = false; // the sprite being drawn is mirrored (facing left)
  /** Text printed on a sprite (tank tops, labels) reads correctly even when the sprite is flipped. */
  function label(ctx, str, x, y, opts) {
    if (!FLIP) { T.draw(ctx, str, x, y, opts); return; }
    ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
    T.draw(ctx, str, 0, y, opts);
    ctx.restore();
  }
  const rich = () => !WL.perf.lite && WL.display.mode !== 'classic';
  const tintCache = new Map();
  /** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
  function tint(hex, amt) {
    const k = hex + amt;
    let v = tintCache.get(k);
    if (v) return v;
    const n = parseInt(hex.slice(1, 7), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    v = `rgb(${r | 0},${g | 0},${b | 0})`;
    tintCache.set(k, v);
    return v;
  }
  /** Re-fill the current path with a side-lit gradient: rim + key on the lit
     side, cool occlusion on the far side. Call after the base fill. */
  function volume(ctx, cx, half, strength) {
    if (!rich()) return;
    const s = strength == null ? 1 : strength;
    const g = ctx.createLinearGradient(cx + LS * half, 0, cx - LS * half, 0);
    g.addColorStop(0, `rgba(255,248,225,${0.5 * s})`);
    g.addColorStop(0.1, `rgba(255,240,205,${0.22 * s})`);
    g.addColorStop(0.45, 'rgba(255,240,205,0)');
    g.addColorStop(0.72, 'rgba(30,10,45,0.08)');
    g.addColorStop(1, `rgba(30,10,45,${0.42 * s})`);
    ctx.fillStyle = g; ctx.fill();
  }
  /** Top-down falloff for tall shapes (sun overhead, bounce light below). */
  function topLight(ctx, y0, y1, s) {
    if (!rich()) return;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(255,250,230,${0.28 * (s || 1)})`);
    g.addColorStop(0.5, 'rgba(255,250,230,0)');
    g.addColorStop(1, `rgba(20,8,30,${0.28 * (s || 1)})`);
    ctx.fillStyle = g; ctx.fill();
  }
  /** Lit sphere: radial gradient offset toward the light, dark outline. */
  function ball(ctx, x, y, r, color, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (rich()) {
      const g = ctx.createRadialGradient(x + LS * r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.02);
      g.addColorStop(0, tint(color, 0.42));
      g.addColorStop(0.45, color);
      g.addColorStop(1, tint(color, -0.42));
      ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    ctx.fill();
    if (stroke !== false) { ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, Math.min(2, r * 0.2)); ctx.stroke(); }
  }
  function oval(ctx, x, y, rx, ry, color, stroke) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    ball(ctx, 0, 0, rx, color, false);
    ctx.restore();
    if (stroke !== false) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke(); }
  }
  /** Stroke highlight + shade along a stroked segment, offset toward/away from the light. */
  function segLight(ctx, x1, y1, x2, y2, w) {
    let nx = -(y2 - y1), ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if (nx * LS * 0.7 - ny * 0.7 < 0) { nx = -nx; ny = -ny; }
    const o = w * 0.24;
    ctx.beginPath(); ctx.moveTo(x1 + nx * o, y1 + ny * o); ctx.lineTo(x2 + nx * o, y2 + ny * o);
    ctx.strokeStyle = 'rgba(255,248,225,0.36)'; ctx.lineWidth = w * 0.34; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 - nx * o * 1.1, y1 - ny * o * 1.1); ctx.lineTo(x2 - nx * o * 1.1, y2 - ny * o * 1.1);
    ctx.strokeStyle = 'rgba(25,8,40,0.3)'; ctx.lineWidth = w * 0.3; ctx.stroke();
  }

  /* Thick limb: line from (x1,y1) to (x2,y2) with an outline and fill */
  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    if (rich()) segLight(ctx, x1, y1, x2, y2, w);
    ctx.lineWidth = 2; // restore the default outline width for following shapes
  }
  /* two-segment limb with a joint; color2 = lower segment (e.g. bare forearm) */
  function limb2(ctx, x1, y1, jx, jy, x2, y2, w, color, endColor, endR, color2) {
    // outline pass for both segments first so the joint has no seam
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(jx, jy); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(jx, jy);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color2 || color; ctx.lineWidth = w; ctx.stroke();
    if (rich()) { segLight(ctx, x1, y1, jx, jy, w); segLight(ctx, jx, jy, x2, y2, w); }
    ctx.lineWidth = 2;
    if (endColor) ball(ctx, x2, y2, endR || w * 0.75, endColor);
  }
  /** Five-petal hibiscus for shirt prints, logo and deck dressing. */
  function hibiscus(ctx, x, y, r, petal, center, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i++) {
      ctx.rotate(Math.PI * 2 / 5);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (center) { ctx.fillStyle = center; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function angryEyes(ctx, x, y, spread, size, color) {
    // furrowed brow eyes
    color = color || '#fff';
    D.ellipse(ctx, x - spread, y, size, size * 0.8, color, OUT);
    D.ellipse(ctx, x + spread, y, size, size * 0.8, color, OUT);
    D.circle(ctx, x - spread + 1, y, size * 0.45, OUT);
    D.circle(ctx, x + spread + 1, y, size * 0.45, OUT);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - spread + 1 - size * 0.2, y - size * 0.3, size * 0.22, size * 0.22);
    ctx.fillRect(x + spread + 1 - size * 0.2, y - size * 0.3, size * 0.22, size * 0.22);
    ctx.lineWidth = Math.max(2, size * 0.7); ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.moveTo(x - spread - size, y - size - 1); ctx.lineTo(x - spread + size, y - size + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + spread - size, y - size + 2); ctx.lineTo(x + spread + size, y - size - 1); ctx.stroke();
  }
  function angryMouth(ctx, x, y, w, teeth) {
    D.rrect(ctx, x - w / 2, y, w, w * 0.45, 2); ctx.fillStyle = '#3a0a10'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    if (teeth) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + 2 + i * (w - 4) / 3, y + 1, (w - 4) / 3 - 1, 3); }
  }
  function dizzyEyes(ctx, x, y, spread) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    for (const sx of [-spread, spread]) {
      ctx.beginPath(); ctx.moveTo(x + sx - 3, y - 3); ctx.lineTo(x + sx + 3, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + sx + 3, y - 3); ctx.lineTo(x + sx - 3, y + 3); ctx.stroke();
    }
  }

  /* ================= LANCE ================= */
  /* Lance's cruise look, matched to the reference photos: white thinning hair,
     prominent white mustache, tan/ruddy skin, red polo with a purple & white
     lei, gray cargo shorts, black sneakers, plus a mechanic's tool belt. */
  const LANCE = {
    shirt: '#c8322a', shirtDark: '#8e1f18', shirtLight: '#e0483c',
    shorts: '#6e716b', shortsDark: '#50534e',
    skin: '#dca27a', skinDark: '#b8825a', skinLight: '#ead0b0',
    hair: '#efefef', hairShade: '#c9c9cf',
    boot: '#1e1e22', sole: '#f0f0f0',
    belt: '#6b4a2a', buckle: '#d8c060', pouch: '#7a5a34',
    leiA: '#8a3fbf', leiB: '#f7f2ff', leiC: '#c97be0'
  };

  /**
   * lanceHead(ctx, x, y, h, opts) — x,y = head center, h = head height.
   * If a real photo crop is present at assets/lance/lance-head.png it is used
   * (inside an oval mask); otherwise the head is drawn from the photo spec.
   */
  function lanceHead(ctx, x, y, h, opts) {
    opts = opts || {};
    const img = WL.assets.get('lanceHead');
    if (img && !opts.noPhoto) {
      const w = h * (img.width / img.height);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, h * 0.04); ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h, h); // work in head-height units: top -0.5 .. chin +0.5
    const lw = 0.045;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const mood = opts.mood || 'neutral'; // neutral | grin | hurt | strain
    // neck
    ctx.fillStyle = LANCE.skinDark; ctx.fillRect(-0.19, 0.3, 0.38, 0.3);
    // ears
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.42, 0.04, 0.075, 0.11, 0, 0, 7); ctx.fillStyle = LANCE.skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke(); }
    // white hair on the sides/back, hugging the skull behind the temples and ears
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.35, -0.02, 0.10, 0.25, s * 0.15, 0, 7); ctx.fillStyle = LANCE.hairShade; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke(); }
    // face: round, full cheeks, soft jowls
    ctx.beginPath();
    ctx.moveTo(-0.40, -0.08);
    ctx.bezierCurveTo(-0.42, -0.40, -0.22, -0.50, 0, -0.50);
    ctx.bezierCurveTo(0.22, -0.50, 0.42, -0.40, 0.40, -0.08);
    ctx.bezierCurveTo(0.42, 0.18, 0.30, 0.44, 0, 0.47);
    ctx.bezierCurveTo(-0.30, 0.44, -0.42, 0.18, -0.40, -0.08);
    ctx.closePath();
    ctx.fillStyle = LANCE.skin; ctx.fill();
    if (rich()) {
      const fg = ctx.createLinearGradient(LS * 0.46, -0.42, -LS * 0.46, 0.35);
      fg.addColorStop(0, 'rgba(255,236,205,0.55)');
      fg.addColorStop(0.35, 'rgba(255,220,180,0.08)');
      fg.addColorStop(0.7, 'rgba(120,50,30,0.12)');
      fg.addColorStop(1, 'rgba(90,30,30,0.38)');
      ctx.fillStyle = fg; ctx.fill();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
    // ruddy cheeks + forehead shine
    ctx.fillStyle = 'rgba(210,90,70,0.28)';
    ctx.beginPath(); ctx.ellipse(-0.22, 0.12, 0.10, 0.07, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.22, 0.12, 0.10, 0.07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-0.06, -0.34, 0.14, 0.07, 0, 0, 7); ctx.fill();
    // thinning white hair: a translucent cap over the crown (scalp shows through)
    // with fine strands combed back, fuller at the temples
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-0.40, -0.08);
    ctx.bezierCurveTo(-0.42, -0.40, -0.22, -0.50, 0, -0.50);
    ctx.bezierCurveTo(0.22, -0.50, 0.42, -0.40, 0.40, -0.08);
    ctx.bezierCurveTo(0.42, 0.18, 0.30, 0.44, 0, 0.47);
    ctx.bezierCurveTo(-0.30, 0.44, -0.42, 0.18, -0.40, -0.08);
    ctx.closePath(); ctx.clip();
    const hg = ctx.createLinearGradient(0, -0.50, 0, -0.22);
    hg.addColorStop(0, 'rgba(240,240,242,0.75)'); hg.addColorStop(0.6, 'rgba(240,240,242,0.35)'); hg.addColorStop(1, 'rgba(240,240,242,0)');
    ctx.fillStyle = hg; ctx.fillRect(-0.5, -0.55, 1, 0.35);
    // temples: fuller hair
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.33, -0.22, 0.10, 0.16, 0, 0, 7); ctx.fillStyle = 'rgba(236,236,240,0.9)'; ctx.fill(); }
    // strands following the skull curve
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
    for (let i = -4; i <= 4; i++) {
      const sx = i * 0.075;
      ctx.beginPath(); ctx.moveTo(sx - 0.02, -0.47 + Math.abs(sx) * 0.35); ctx.quadraticCurveTo(sx + 0.05, -0.44 + Math.abs(sx) * 0.3, sx + 0.10, -0.34 + Math.abs(sx) * 0.2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180,180,190,0.6)'; ctx.lineWidth = 0.012;
    for (let i = -3; i <= 3; i++) { const sx = i * 0.09 + 0.03; ctx.beginPath(); ctx.moveTo(sx, -0.45 + Math.abs(sx) * 0.3); ctx.quadraticCurveTo(sx + 0.06, -0.40, sx + 0.11, -0.33 + Math.abs(sx) * 0.2); ctx.stroke(); }
    ctx.restore();
    // bushy white eyebrows
    const fight = mood === 'fight';
    const browLift = mood === 'hurt' ? -0.04 : mood === 'strain' ? 0.03 : 0;
    const inner = fight ? 0.05 : 0; // fight: inner ends pulled down into a scowl
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.075;
    ctx.beginPath(); ctx.moveTo(-0.31, -0.15 + browLift - inner * 0.6); ctx.quadraticCurveTo(-0.18, -0.21, -0.06, -0.15 + inner); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.06, -0.15 + inner); ctx.quadraticCurveTo(0.18, -0.21, 0.31, -0.15 + browLift - inner * 0.6); ctx.stroke();
    ctx.strokeStyle = LANCE.hair; ctx.lineWidth = 0.055;
    ctx.beginPath(); ctx.moveTo(-0.30, -0.155 + browLift - inner * 0.6); ctx.quadraticCurveTo(-0.18, -0.215, -0.07, -0.155 + inner); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.07, -0.155 + inner); ctx.quadraticCurveTo(0.18, -0.215, 0.30, -0.155 + browLift - inner * 0.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.018;
    ctx.beginPath(); ctx.moveTo(-0.27, -0.175); ctx.quadraticCurveTo(-0.18, -0.215, -0.10, -0.17 + inner * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.10, -0.17 + inner * 0.8); ctx.quadraticCurveTo(0.18, -0.215, 0.27, -0.175); ctx.stroke();
    if (fight) {
      // brow furrow
      ctx.strokeStyle = 'rgba(110,50,30,0.55)'; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.moveTo(-0.03, -0.22); ctx.lineTo(-0.01, -0.13); ctx.moveTo(0.03, -0.22); ctx.lineTo(0.01, -0.13); ctx.stroke();
    }
    // eyes: slightly hooded, warm brown, crow's feet
    for (const s of [-1, 1]) {
      if (mood === 'strain') { ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(s * 0.10, -0.04); ctx.lineTo(s * 0.24, -0.05); ctx.stroke(); continue; }
      ctx.beginPath(); ctx.ellipse(s * 0.17, -0.04, 0.075, 0.045, 0, 0, 7); ctx.fillStyle = '#fbf6f0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.02; ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.165, -0.035, 0.032, 0, 7); ctx.fillStyle = '#4a2e1c'; ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.165, -0.035, 0.014, 0, 7); ctx.fillStyle = '#111'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.15, -0.05, 0.008, 0, 7); ctx.fill();
      // hooded upper lid
      ctx.strokeStyle = LANCE.skinDark; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(s * 0.09, -0.085); ctx.quadraticCurveTo(s * 0.17, -0.11, s * 0.25, -0.08); ctx.stroke();
      // crow's feet
      ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(s * 0.26, -0.03); ctx.lineTo(s * 0.32, -0.05); ctx.moveTo(s * 0.26, -0.01); ctx.lineTo(s * 0.32, 0.01); ctx.stroke();
    }
    // nose: rounded, a little wide
    ctx.beginPath(); ctx.ellipse(0, 0.11, 0.085, 0.065, 0, 0, 7); ctx.fillStyle = '#d0906a'; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.arc(0, 0.10, 0.085, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-0.02, 0.09, 0.03, 0.02, 0, 0, 7); ctx.fill();
    // mouth (under the mustache)
    ctx.strokeStyle = '#5a2a20'; ctx.lineWidth = 0.025;
    if (mood === 'grin') { ctx.beginPath(); ctx.ellipse(0, 0.32, 0.12, 0.05, 0, 0, Math.PI); ctx.fillStyle = '#4a1a18'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-0.09, 0.32, 0.18, 0.02); }
    else if (mood === 'hurt') { ctx.beginPath(); ctx.ellipse(0, 0.34, 0.07, 0.05, 0, 0, 7); ctx.fillStyle = '#4a1a18'; ctx.fill(); }
    else if (fight) {
      // gritted teeth under the mustache
      D.rrect(ctx, -0.13, 0.285, 0.26, 0.085, 0.03); ctx.fillStyle = '#3a1210'; ctx.fill();
      ctx.fillStyle = '#fbf6ea'; ctx.fillRect(-0.115, 0.295, 0.23, 0.06);
      ctx.strokeStyle = 'rgba(80,40,30,0.7)'; ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(-0.115, 0.325); ctx.lineTo(0.115, 0.325);
      for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 0.045, 0.295); ctx.lineTo(i * 0.045, 0.355); }
      ctx.stroke();
    }
    else { ctx.beginPath(); ctx.moveTo(-0.10, 0.33); ctx.quadraticCurveTo(0, 0.37, 0.10, 0.33); ctx.stroke(); }
    // the mustache: big, white, full — a walrus sweep with volume
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0.195);
    ctx.bezierCurveTo(0.11, 0.15, 0.26, 0.16, 0.31, 0.27);
    ctx.bezierCurveTo(0.27, 0.33, 0.14, 0.33, 0, 0.275);
    ctx.bezierCurveTo(-0.14, 0.33, -0.27, 0.33, -0.31, 0.27);
    ctx.bezierCurveTo(-0.26, 0.16, -0.11, 0.15, 0, 0.195);
    ctx.closePath();
    if (rich()) {
      const mg = ctx.createLinearGradient(0, 0.15, 0, 0.33);
      mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.55, '#eceef2'); mg.addColorStop(1, '#b9bcc6');
      ctx.fillStyle = mg;
    } else ctx.fillStyle = LANCE.hair;
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = LANCE.hairShade; ctx.lineWidth = 0.012;
    for (let i = -3; i <= 3; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(i * 0.045, 0.2 + Math.abs(i) * 0.005); ctx.quadraticCurveTo(i * 0.06, 0.25, i * 0.075, 0.29); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 0.016;
    ctx.beginPath(); ctx.moveTo(LS * 0.04, 0.19); ctx.quadraticCurveTo(LS * 0.16, 0.175, LS * 0.24, 0.22); ctx.stroke();
    // chin / jowl shading
    ctx.strokeStyle = 'rgba(120,70,40,0.35)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(-0.16, 0.40); ctx.quadraticCurveTo(0, 0.46, 0.16, 0.40); ctx.stroke();
    ctx.restore();
  }

  /** Head-and-shoulders bust for the title / ending screens. h = head height. */
  function drawLanceBust(ctx, x, y, h, opts) {
    opts = opts || {};
    ctx.save(); ctx.translate(x, y);
    const s = h / 34; // body proportions relative to the in-game head
    // shoulders / chest in red polo
    ctx.save(); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-42, 60); ctx.lineTo(-40, 30); ctx.quadraticCurveTo(-36, 16, -18, 14); ctx.lineTo(18, 14); ctx.quadraticCurveTo(36, 16, 40, 30); ctx.lineTo(42, 60); ctx.closePath();
    ctx.fillStyle = LANCE.shirt; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-60, 14, 26, 60); ctx.restore();
    // collar + placket
    ctx.fillStyle = LANCE.shirtLight; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(0, 30); ctx.lineTo(-8, 14); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(0, 30); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(0, 30); ctx.lineTo(14, 14); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 36, 1.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, 43, 1.6, 0, 7); ctx.fill();
    // neck
    ctx.fillStyle = LANCE.skinDark; ctx.fillRect(-8, 6, 16, 12);
    // lei
    lei(ctx, 0, 16, 22, 34, 3.4);
    ctx.restore();
    lanceHead(ctx, 0, 0, h, { mood: opts.mood || 'grin' });
    ctx.restore();
  }

  /* purple & white lei hanging from the neck: ellipse loop, lower half */
  function lei(ctx, cx, cy, rx, ry, r) {
    const n = 15;
    const flowers = rich();
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n);
      const px = cx + Math.cos(a) * rx * -1, py = cy + Math.sin(a) * ry;
      const c = i % 3 === 1 ? LANCE.leiB : (i % 3 === 2 ? LANCE.leiC : LANCE.leiA);
      // dark backing disc keeps the silhouette readable on the red shirt
      ctx.beginPath(); ctx.arc(px, py, r * 1.08, 0, 7); ctx.fillStyle = OUT; ctx.fill();
      if (flowers) {
        hibiscus(ctx, px, py, r * 1.12, c, null, i * 0.9);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(px + LS * r * 0.25, py - r * 0.3, r * 0.35, 0, 7); ctx.fill();
        ctx.fillStyle = i % 3 === 1 ? '#f2c230' : '#ffe98a'; ctx.beginPath(); ctx.arc(px, py, r * 0.28, 0, 7); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fillStyle = c; ctx.fill();
        if (i % 3 === 1) { ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(px, py, r * 0.3, 0, 7); ctx.fill(); }
      }
    }
  }
  function chrome(ctx, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9cfd9'); g.addColorStop(0.55, '#7d8594'); g.addColorStop(0.8, '#b7bfcc'); g.addColorStop(1, '#5d6472');
    return g;
  }
  function enamel(ctx, y0, y1, base) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, tint(base, 0.45)); g.addColorStop(0.3, base); g.addColorStop(1, tint(base, -0.45));
    return g;
  }

  function tool(ctx, kind, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    outlineStyle(ctx, 2);
    const hi = rich();
    if (kind === 'screwdriver') {
      D.fillRRect(ctx, -6, -3, 12, 6, 2, hi ? enamel(ctx, -3, 3, '#e8c000') : '#e8c000', OUT);
      D.fillRRect(ctx, 6, -1.5, 16, 3, 1, hi ? chrome(ctx, -1.5, 1.5) : '#b8bcc8', OUT);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-3, -3, 1, 6); ctx.fillRect(1, -3, 1, 6);
    } else if (kind === 'wrench') {
      const m = hi ? chrome(ctx, -8, 8) : '#a8b0c0';
      D.fillRRect(ctx, -4, -3, 26, 6, 3, m, OUT);
      ctx.beginPath(); ctx.arc(24, 0, 8, 0.6, Math.PI * 2 - 0.6); ctx.closePath(); ctx.fillStyle = m; ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(0, -2, 18, 1);
    } else if (kind === 'pipewrench') {
      // Heavy red-enamel handle, knurled adjuster and a toothed steel hook jaw.
      D.fillRRect(ctx, -8, -4.5, 36, 9, 3, hi ? enamel(ctx, -4.5, 4.5, '#d0302a') : '#c8322a', OUT);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-5, -3.2, 28, 1.3);
      ctx.fillStyle = '#5a1410'; ctx.fillRect(-7, -1, 3, 2);
      const st = hi ? chrome(ctx, -14, 9) : '#8a9098';
      D.fillRRect(ctx, 24, -13, 11, 22, 2, st, OUT);
      D.fillRRect(ctx, 19, -14, 12, 7, 2, st, OUT);
      ctx.fillStyle = '#3a3f4a';
      for (let i = 0; i < 4; i++) ctx.fillRect(20 + i * 3, -7.2, 1.6, 1.6);
      D.fillRRect(ctx, 25, -2, 9, 5, 1.5, hi ? enamel(ctx, -2, 3, '#caa24a') : '#caa24a', OUT);
      ctx.strokeStyle = 'rgba(60,40,10,0.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(26.5 + i * 2, -2); ctx.lineTo(26.5 + i * 2, 3); } ctx.stroke();
    } else if (kind === 'canister') {
      D.fillRRect(ctx, -5, -8, 10, 16, 2, hi ? enamel(ctx, -8, 8, '#3fc0e8') : '#3fc0e8', OUT);
      ctx.fillStyle = '#fff'; ctx.fillRect(-4, -4, 8, 6);
      ctx.fillStyle = '#1d6fa0'; ctx.fillRect(-3, -2.5, 6, 1.2);
      D.fillRRect(ctx, -2, -12, 4, 5, 1, hi ? chrome(ctx, -12, -7) : '#888', OUT);
    } else if (kind === 'toolbox') {
      // Red steel toolbox: cantilever lid, chrome latches and handle, specular edge.
      D.fillRRect(ctx, -11, -7, 22, 15, 2.5, hi ? enamel(ctx, -7, 8, '#d42e24') : '#c8322a', OUT);
      D.fillRRect(ctx, -11.5, -8, 23, 5, 2, hi ? enamel(ctx, -8, -3, '#e8463a') : '#e0483c', OUT);
      ctx.fillStyle = '#7a1c16'; ctx.fillRect(-10, -2.5, 20, 1.2);
      ctx.fillStyle = hi ? chrome(ctx, -4, 1) : '#ccc';
      ctx.fillRect(-8, -4, 3, 4); ctx.fillRect(5, -4, 3, 4);
      ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(-8, -4, 3, 4); ctx.strokeRect(5, -4, 3, 4);
      ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(-5, -12); ctx.lineTo(5, -12); ctx.lineTo(5, -8);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = hi ? '#d8dde6' : '#999'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-9, -7, 12, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-9, 1, 1.2, 5);
    } else if (kind === 'tape') {
      D.circle(ctx, 0, 0, 7, '#999', OUT); D.circle(ctx, 0, 0, 3, '#444', OUT);
    }
    ctx.restore();
  }

  /* Hit-flash without ctx.filter. Filters force a full-frame offscreen pass and
     get expensive once the desktop backing store is 2–3x. Draw the sprite into
     a small buffer, punch it to white, and blit it back. */
  let flashCanvas = null, flashRS = 0;
  const FLASH_W = 320, FLASH_H = 300;
  function drawFlashed(ctx, x, y, ox, oy, drawFn) {
    const rs = Math.max(1, (WL.display && WL.display.renderScale) || 1);
    if (!flashCanvas || flashRS !== rs) {
      flashCanvas = document.createElement('canvas');
      flashCanvas.width = FLASH_W * rs;
      flashCanvas.height = FLASH_H * rs;
      flashRS = rs;
    }
    const f = flashCanvas.getContext('2d');
    f.setTransform(rs, 0, 0, rs, 0, 0);
    f.clearRect(0, 0, FLASH_W, FLASH_H);
    f.imageSmoothingEnabled = WL.display.mode !== 'classic';
    drawFn(f);
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-atop';
    f.fillStyle = '#fff';
    f.fillRect(0, 0, flashCanvas.width, flashCanvas.height);
    f.globalCompositeOperation = 'source-over';
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = WL.display.mode !== 'classic';
    ctx.drawImage(flashCanvas, x - ox, y - oy, FLASH_W, FLASH_H);
    ctx.imageSmoothingEnabled = smooth;
  }

  /**
   * drawLance(ctx, x, y, o)
   * o.pose: idle|walk|jab|smash|smashWind|sweep|spray|throw|grab|grabHit|jump|jumpkick|hurt|down|fart|fartCharge|victory|dead|carry
   * o.t: animation time (seconds), o.flash: white flash, o.thin: slim ending version, o.alpha
   */
  /* ---- painted sprites (assets/art, see tools/bake_art.py) ----
     Poses map onto baked frames; the little motion between frames (breathing,
     walk bob, recoil, wobble) is added here. o.floorY (the deck under a jumping
     body) turns on the silhouette cast shadow and the deck reflection. */
  const LANCE_FRAME = { idle: 'idle', walk: 'walk0', jab: 'jab', smashWind: 'smashWind', smash: 'smash', sweepWind: 'sweepWind', sweep: 'sweep', popWind: 'popWind', uppercut: 'uppercut', spray: 'spray', throw: 'throw', grab: 'grab', grabHit: 'grabHit', jump: 'jump', jumpkick: 'jumpkick', hurt: 'hurt', down: 'down', dead: 'down', fartCharge: 'fartCharge', fart: 'fart', victory: 'victory', carry: 'carry' };
  function underBody(ctx, name, f, x, y, o) {
    if (o.floorY == null) return;
    const z = Math.max(0, o.floorY - y);
    if (WL.light.gloss) WL.art.reflect(ctx, name, f, x, o.floorY, z, { facing: o.facing, alpha: o.alpha, strength: WL.light.gloss });
    WL.art.castShadow(ctx, name, f, x, o.floorY, z, { facing: o.facing, alpha: o.alpha });
  }
  function paintedLance(ctx, x, y, o) {
    const pose = o.pose || 'idle', t = o.t || 0;
    let f = LANCE_FRAME[pose] || 'idle';
    const m = { facing: o.facing, alpha: o.alpha };
    switch (pose) {
      case 'idle': m.sy = 1 + Math.sin(t * 4) * 0.012; m.sx = 1 - Math.sin(t * 4) * 0.006; break;
      case 'walk': f = Math.floor(t * 7) % 2 ? 'walk1' : 'walk0'; m.lift = Math.abs(Math.sin(t * Math.PI * 7)) * 1.4; break;
      case 'hurt': m.rot = -0.08; break;
      case 'fartCharge': x += Math.sin(t * 70) * 0.7; m.sy = 0.985 + Math.sin(t * 30) * 0.01; break;
      case 'fart': m.sx = 1.04; m.sy = 0.97; break;
      case 'victory': m.lift = Math.abs(Math.sin(t * 5)) * 2; break;
      case 'dead': m.alpha = (o.alpha !== undefined ? o.alpha : 1); break;
    }
    underBody(ctx, 'lance', f, x, y, o);
    if (o.flash) {
      drawFlashed(ctx, x, y, 150, 250, (g) => paintedLance(g, 150, 250, Object.assign({}, o, { flash: false, floorY: null })));
      return true;
    }
    WL.art.draw(ctx, 'lance', f, x, y, m);
    if (pose === 'down' && !o.noStars) {
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; D.circle(ctx, x + (o.facing < 0 ? 30 : -30) + Math.cos(a) * 12, y - 24 + Math.sin(a) * 4, 2.5, '#ffe14a', OUT); }
    }
    return true;
  }

  const PAINT_H = { broccoli: 80, carrot: 74, sprout: 44, celery: 92 };
  function enemyFrame(type, pose, t) {
    switch (pose) {
      case 'walk': return Math.floor(t * 6) % 2 ? 'walk1' : 'walk0';
      case 'windup': return 'windup';
      case 'attack': case 'spit': return 'attack';
      case 'kick': return type === 'carrot' ? 'kick' : 'attack';
      case 'dash': return type === 'sprout' ? 'dash' : 'walk0';
      case 'roll': return type === 'sprout' ? 'hurt' : 'walk1';
      case 'hurt': case 'grabbed': case 'knockdown': return 'hurt';
      case 'down': case 'dead': case 'thrown': return 'down';
    }
    return 'idle';
  }
  /** Painted enemy body; returns the painted height (for overlays) or 0 when there is no art. */
  function paintedEnemy(ctx, x, y, e) {
    if (!PAINT_H[e.type] || !WL.art.has(e.type)) return 0;
    const t = e.t || 0, pose = e.pose || 'idle';
    const f = enemyFrame(e.type, pose, t);
    const m = { facing: e.facing, alpha: e.alpha };
    const h = PAINT_H[e.type];
    switch (pose) {
      case 'idle': m.sy = 1 + Math.sin(t * 5) * 0.015; break;
      case 'walk': m.lift = Math.abs(Math.sin(t * Math.PI * 6)) * 1.2; break;
      case 'windup': x += Math.sin(t * 50) * 0.6; break;
      case 'stunned': m.rot = Math.sin(t * 12) * 0.06; break;
      case 'dash': m.rot = e.type === 'sprout' ? 0 : 0.14; break;
      case 'roll': m.rot = t * 14; m.pivot = h * 0.5; m.lift = -h * 0.2; break;
      case 'knockdown': m.rot = -0.5 - Math.sin(t * 8) * 0.3; m.pivot = h * 0.5; break;
      case 'thrown': m.rot = t * 14; m.pivot = h * 0.25; break;
      case 'hurt': m.rot = -0.05; break;
    }
    underBody(ctx, e.type, f, x, y, e);
    if (e.flash) {
      drawFlashed(ctx, x, y, 150, 250, (g) => paintedEnemy(g, 150, 250, Object.assign({}, e, { flash: false, floorY: null })));
      return h;
    }
    WL.art.draw(ctx, e.type, f, x, y, m);
    return h;
  }

  function drawLance(ctx, x, y, o) {
    o = o || {};
    if (!o.thin && WL.art.has('lance') && paintedLance(ctx, x, y, o)) return;
    if (o.flash) {
      drawFlashed(ctx, x, y, 150, 250, (f) => drawLance(f, 150, 250, Object.assign({}, o, { flash: false })));
      return;
    }
    const t = o.t || 0;
    const pose = o.pose || 'idle';
    const thin = !!o.thin;
    ctx.save();
    ctx.translate(x, y);
    if (o.facing < 0) ctx.scale(-1, 1);
    LS = WL.light.side * (o.facing < 0 ? -1 : 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    const bob = (pose === 'idle') ? Math.sin(t * 4) * 1.2 : (pose === 'walk' ? Math.abs(Math.sin(t * 10)) * -2 : 0);
    let lean = 0; // torso lean forward (px at shoulders)
    let crouch = 0;
    const bodyW = thin ? 26 : 46;   // torso width
    const bellyR = thin ? 2 : 24;
    const hipY = -34;
    const shoulderY = -70;
    const headY = -92;

    // Faint contrast backing for busy backgrounds; the outline and rim light do most of the work now.
    if (pose !== 'down' && pose !== 'dead') {
      ctx.save();
      ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * (rich() ? 0.12 : 0.32);
      D.ellipse(ctx, lean * 0.4, -48, bodyW * 0.62 + 3, 38, 'rgba(10,12,22,0.85)');
      D.circle(ctx, lean * 0.6, headY + 12, 19, 'rgba(10,12,22,0.85)');
      ctx.restore();
    }

    // leg positions (feet)
    let lf = { x: -8, y: 0 }, rf = { x: 8, y: 0 };
    let lk, rk; // knees
    // arms: shoulder -> elbow -> hand (shoulders sit a little below the torso top)
    const sh = { x: 8, y: shoulderY + 6 }; // front shoulder
    const bh = { x: -10, y: shoulderY + 6 }; // back shoulder
    let fe = { x: 12, y: -50 }, fh = { x: 14, y: -38 };  // front elbow/hand
    let be = { x: -12, y: -50 }, bh2 = { x: -10, y: -38 }; // back elbow/hand
    let toolKind = null, toolAng = 0, toolAtFront = true;
    let headTilt = 0;
    let lying = false;
    let z = 0; // vertical offset for jump handled by caller via y

    switch (pose) {
      case 'walk': {
        const s = Math.sin(t * 10), c = Math.cos(t * 10);
        lf = { x: -8 + s * 9, y: Math.min(0, -c * 4) }; rf = { x: 8 - s * 9, y: Math.min(0, c * 4) };
        fe = { x: 10 - s * 6, y: -50 }; fh = { x: 14 - s * 10, y: -40 };
        be = { x: -12 + s * 6, y: -50 }; bh2 = { x: -12 + s * 10, y: -40 };
        break;
      }
      case 'jab':
        lean = 5; lf = { x: -12, y: 0 }; rf = { x: 12, y: 0 };
        fe = { x: 20, y: -56 }; fh = { x: 36, y: -54 }; toolKind = 'screwdriver'; toolAng = 0;
        be = { x: -14, y: -52 }; bh2 = { x: -6, y: -46 };
        break;
      case 'smashWind':
        lean = -3; fe = { x: 4, y: -78 }; fh = { x: -6, y: -92 }; toolKind = 'wrench'; toolAng = -2.2;
        be = { x: -14, y: -50 }; bh2 = { x: -4, y: -46 };
        break;
      case 'smash':
        lean = 6; crouch = 3; lf = { x: -12, y: 0 }; rf = { x: 14, y: 0 };
        fe = { x: 22, y: -56 }; fh = { x: 34, y: -44 }; toolKind = 'wrench'; toolAng = 0.55;
        be = { x: -14, y: -50 }; bh2 = { x: -2, y: -44 };
        break;
      case 'sweep':
        lean = 8; crouch = 4; lf = { x: -14, y: 0 }; rf = { x: 16, y: 0 };
        fe = { x: 20, y: -52 }; fh = { x: 30, y: -46 }; toolKind = 'pipewrench'; toolAng = -0.15;
        be = { x: 4, y: -54 }; bh2 = { x: 24, y: -48 };
        break;
      case 'popWind':
        crouch = 7; lean = 3; lf = { x: -14, y: 0 }; rf = { x: 14, y: 0 };
        fe = { x: 14, y: -44 }; fh = { x: 24, y: -30 }; toolKind = 'wrench'; toolAng = 1.3;
        be = { x: -14, y: -48 }; bh2 = { x: -6, y: -40 };
        break;
      case 'uppercut':
        lean = 2; lf = { x: -10, y: 0 }; rf = { x: 12, y: -3 };
        fe = { x: 18, y: -74 }; fh = { x: 24, y: -94 }; toolKind = 'wrench'; toolAng = -1.35;
        be = { x: -14, y: -54 }; bh2 = { x: -4, y: -48 };
        break;
      case 'sweepWind':
        lean = -4; lf = { x: -10, y: 0 }; rf = { x: 10, y: 0 };
        fe = { x: -12, y: -60 }; fh = { x: -30, y: -58 }; toolKind = 'pipewrench'; toolAng = Math.PI + 0.3;
        be = { x: -16, y: -56 }; bh2 = { x: -28, y: -56 };
        break;
      case 'spray':
        lean = 3; fe = { x: 18, y: -56 }; fh = { x: 30, y: -56 }; toolKind = 'canister'; toolAng = Math.PI / 2;
        be = { x: -14, y: -52 }; bh2 = { x: -8, y: -44 };
        break;
      case 'throw':
        lean = 8; lf = { x: -14, y: 0 }; rf = { x: 12, y: 0 };
        fe = { x: 22, y: -62 }; fh = { x: 38, y: -66 };
        be = { x: -14, y: -50 }; bh2 = { x: -6, y: -44 };
        break;
      case 'grab':
        lean = 4; fe = { x: 18, y: -56 }; fh = { x: 30, y: -50 }; be = { x: 12, y: -58 }; bh2 = { x: 28, y: -58 }; toolKind = 'tape'; toolAtFront = false;
        break;
      case 'grabHit':
        lean = 10; crouch = 4; fe = { x: 18, y: -56 }; fh = { x: 30, y: -50 }; be = { x: 12, y: -58 }; bh2 = { x: 28, y: -58 };
        rf = { x: 26, y: -22 }; // knee up
        break;
      case 'jump':
        lf = { x: -10, y: -14 }; rf = { x: 8, y: -10 };
        fe = { x: 14, y: -74 }; fh = { x: 10, y: -88 }; be = { x: -14, y: -72 }; bh2 = { x: -12, y: -86 };
        break;
      case 'jumpkick':
        lean = 6; lf = { x: -12, y: -12 }; rf = { x: 30, y: -30 };
        fe = { x: 14, y: -68 }; fh = { x: 20, y: -80 }; be = { x: -14, y: -60 }; bh2 = { x: -24, y: -56 };
        break;
      case 'hurt':
        lean = -8; headTilt = -0.3; fe = { x: 14, y: -70 }; fh = { x: 20, y: -82 }; be = { x: -14, y: -66 }; bh2 = { x: -24, y: -76 };
        lf = { x: -14, y: 0 }; rf = { x: 6, y: 0 };
        break;
      case 'down': case 'dead':
        lying = true; break;
      case 'fartCharge':
        crouch = 8; lean = 2; headTilt = 0.15; lf = { x: -14, y: 0 }; rf = { x: 14, y: 0 };
        fe = { x: 14, y: -50 }; fh = { x: 8, y: -40 }; be = { x: -16, y: -50 }; bh2 = { x: -10, y: -40 };
        break;
      case 'fart':
        crouch = 10; lean = 10; headTilt = -0.25; lf = { x: -16, y: 0 }; rf = { x: 16, y: 0 };
        fe = { x: 16, y: -54 }; fh = { x: 8, y: -66 }; be = { x: -18, y: -54 }; bh2 = { x: -10, y: -66 };
        break;
      case 'victory': {
        const s = Math.sin(t * 6);
        fe = { x: 14, y: -76 }; fh = { x: 18, y: -94 + s * 2 }; be = { x: -14, y: -76 }; bh2 = { x: -18, y: -94 - s * 2 };
        toolKind = 'wrench'; toolAng = -1.3;
        break;
      }
      case 'carry':
        fe = { x: 16, y: -54 }; fh = { x: 20, y: -46 }; toolKind = 'toolbox'; toolAng = 0;
        break;
    }

    if (lying) {
      // knocked down: draw rotated body lying on back
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(-Math.PI / 2 + 0.05);
      ctx.translate(0, 0);
      // simplified: reuse standing pieces with arms spread
      drawLanceBody(ctx, { lf: { x: -8, y: 0 }, rf: { x: 8, y: 0 }, sh, bh, fe: { x: 16, y: -60 }, fh: { x: 26, y: -50 }, be: { x: -16, y: -60 }, bh2: { x: -26, y: -50 }, lean: 0, crouch: 0, bodyW, bellyR, hipY, shoulderY, headY, headTilt: 0, thin, t, toolKind: null, o });
      ctx.restore();
      if (pose === 'down' && !o.noStars) {
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + i * 2.1;
          D.circle(ctx, -30 + Math.cos(a) * 12, -14 + Math.sin(a) * 4, 2.5, '#ffe14a', OUT);
        }
      }
      ctx.restore();
      return;
    }

    drawLanceBody(ctx, { lf, rf, sh, bh, fe, fh, be, bh2, lean, crouch, bob, bodyW, bellyR, hipY, shoulderY, headY, headTilt, thin, t, toolKind, toolAng, toolAtFront, o });
    ctx.restore();
  }

  const FIGHT_POSES = ['jab', 'smash', 'smashWind', 'sweep', 'sweepWind', 'popWind', 'uppercut', 'throw', 'jumpkick', 'grab', 'grabHit', 'spray'];
  // [x offset from torso center, y below torso top, radius, rotation]
  const SHIRT_PRINT = [[-14, 9, 4.4, 0.2], [9, 5, 3.6, 1.1], [17, 21, 4.6, 0.5], [-5, 25, 4, 2.2], [-19, 31, 3.4, 1.6], [5, 39, 3.8, 0.9], [21, 38, 3.2, 2.8], [-11, 44, 3, 0.4]];
  /** Flared short-sleeve cuff near the elbow, with a print blossom. */
  function sleeveCuff(ctx, s, e, w) {
    const ax = s.x + (e.x - s.x) * 0.58, ay = s.y + (e.y - s.y) * 0.58;
    const bx = s.x + (e.x - s.x) * 0.95, by = s.y + (e.y - s.y) * 0.95;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 5; ctx.stroke();
    ctx.strokeStyle = LANCE.shirt; ctx.lineWidth = w + 2.2; ctx.stroke();
    if (rich()) {
      segLight(ctx, ax, ay, bx, by, w + 2.2);
      hibiscus(ctx, s.x + (e.x - s.x) * 0.35, s.y + (e.y - s.y) * 0.35, 2.4, 'rgba(255,214,196,0.3)', null, 0.7);
    }
    ctx.lineCap = 'round'; ctx.lineWidth = 2;
  }

  function drawLanceBody(ctx, p) {
    const { lf, rf, sh, bh, lean, crouch, bodyW, bellyR, hipY, shoulderY, headY, headTilt, thin, t, toolKind, toolAng, toolAtFront, o } = p;
    // pose tables were authored with the shoulder at -62; shift arm points to the taller rig
    const AY = shoulderY + 66;
    const fe = { x: p.fe.x, y: p.fe.y + AY }, fh = { x: p.fh.x, y: p.fh.y + AY };
    const be = { x: p.be.x, y: p.be.y + AY }, bh2 = { x: p.bh2.x, y: p.bh2.y + AY };
    const bob = p.bob || 0;
    const cy = crouch; // crouch lowers torso
    const armW = thin ? 7 : 9;
    const skin = LANCE.skin;
    const mood = o.mood || (['hurt', 'down', 'dead'].includes(o.pose) ? 'hurt' : (o.pose === 'fart' || o.pose === 'fartCharge') ? 'strain' : (o.pose === 'victory' ? 'grin' : FIGHT_POSES.includes(o.pose) ? 'fight' : 'neutral'));
    const hi = rich();
    // back arm first (behind body): short red sleeve, bare tan forearm
    const bs = { x: bh.x + lean * 0.5, y: bh.y + cy + bob }, bel = { x: be.x, y: be.y + cy + bob };
    limb2(ctx, bs.x, bs.y, bel.x, bel.y, bh2.x, bh2.y + cy + bob, armW, LANCE.shirt, skin, 6, skin);
    sleeveCuff(ctx, bs, bel, armW);
    // legs: gray cargo shorts on the thigh, bare calves
    const hipL = { x: -8 + lean * 0.2, y: hipY + cy + bob }, hipR = { x: 8 + lean * 0.2, y: hipY + cy + bob };
    const kneeL = { x: (hipL.x + lf.x) / 2 - 2, y: (hipL.y + lf.y) / 2 }, kneeR = { x: (hipR.x + rf.x) / 2 + 2, y: (hipR.y + rf.y) / 2 };
    const legW = thin ? 9 : 11;
    limb2(ctx, hipL.x, hipL.y, kneeL.x, kneeL.y, lf.x, lf.y - 3, legW, LANCE.shorts, null, 0, skin);
    limb2(ctx, hipR.x, hipR.y, kneeR.x, kneeR.y, rf.x, rf.y - 3, legW, LANCE.shorts, null, 0, skin);
    // cargo hems and thigh pockets
    for (const [h, k] of [[hipL, kneeL], [hipR, kneeR]]) {
      const hx = h.x + (k.x - h.x) * 0.7, hy = h.y + (k.y - h.y) * 0.7;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(k.x, k.y);
      ctx.strokeStyle = OUT; ctx.lineWidth = legW + 4.5; ctx.stroke();
      ctx.strokeStyle = LANCE.shortsDark; ctx.lineWidth = legW + 1.5; ctx.stroke();
      ctx.lineCap = 'round';
      if (!thin) {
        const px = h.x + (k.x - h.x) * 0.42, py = h.y + (k.y - h.y) * 0.42;
        ctx.lineWidth = 1;
        D.fillRRect(ctx, px - 3.5, py - 2.5, 7, 7, 1.5, hi ? enamel(ctx, py - 2.5, py + 4.5, '#7a7c74') : LANCE.shortsDark, OUT);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px - 3.5, py - 0.3, 7, 0.8);
      }
    }
    // sneakers: black leather with a white sole
    for (const f of [lf, rf]) {
      ctx.lineWidth = 2;
      D.fillRRect(ctx, f.x - 7, f.y - 8, 17, 9, 3, hi ? enamel(ctx, f.y - 8, f.y + 1, '#34343c') : LANCE.boot, OUT);
      ctx.fillStyle = LANCE.sole; ctx.fillRect(f.x - 6.5, f.y - 2.4, 16, 2.4);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(f.x - 6.5, f.y - 0.8, 16, 0.8);
      ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 2, f.y - 7, 3, 1.5);
      if (hi) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(f.x - 5, f.y - 7.6, 9, 0.9); }
    }
    // torso: untucked red Hawaiian shirt over a big round belly
    const torsoTop = shoulderY + cy + bob;
    const torsoBot = hipY + 8 + cy + bob;
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-bodyW / 2 + 6 + lean * 0.6, torsoTop);
      ctx.lineTo(bodyW / 2 - 6 + lean * 0.6, torsoTop);
      ctx.quadraticCurveTo(bodyW / 2 + bellyR * 0.7 + lean, (torsoTop + torsoBot) / 2 + 8, bodyW / 2 - 2 + lean * 0.2, torsoBot);
      ctx.lineTo(-bodyW / 2 + 2 + lean * 0.2, torsoBot);
      ctx.quadraticCurveTo(-bodyW / 2 - bellyR * 0.25 + lean * 0.4, (torsoTop + torsoBot) / 2 + 8, -bodyW / 2 + 6 + lean * 0.6, torsoTop);
      ctx.closePath();
    };
    torso();
    ctx.fillStyle = LANCE.shirt; ctx.fill();
    ctx.save(); ctx.clip();
    if (hi) {
      // tone-on-tone hibiscus print
      const pcx = lean * 0.5;
      for (const [fx, fy, fr, rot] of SHIRT_PRINT) {
        hibiscus(ctx, pcx + fx * (bodyW / 46), torsoTop + fy, fr, 'rgba(255,214,196,0.24)', 'rgba(255,230,140,0.5)', rot);
        ctx.fillStyle = 'rgba(60,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(pcx + fx * (bodyW / 46) + fr * 0.9, torsoTop + fy + fr * 0.8, fr * 0.7, fr * 0.28, rot + 0.6, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(-bodyW / 2 - 12, torsoTop, bodyW * 0.33, torsoBot - torsoTop);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(bodyW * 0.18 + lean * 0.6, (torsoTop + torsoBot) / 2 + 8, bodyW * 0.3, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
    // shorts waistband peeking under the untucked hem
    ctx.fillStyle = LANCE.shortsDark; ctx.fillRect(-bodyW / 2, torsoBot - 3, bodyW + 10, 3);
    ctx.restore();
    torso();
    volume(ctx, lean * 0.6 + LS * 3, bodyW / 2 + bellyR * 0.45, 1);
    topLight(ctx, torsoTop, torsoBot, 0.8);
    outlineStyle(ctx, 2); ctx.stroke();
    // open camp collar, button placket
    const cx0 = lean * 0.6;
    ctx.fillStyle = LANCE.skinDark;
    ctx.beginPath(); ctx.moveTo(cx0 - 7, torsoTop - 1); ctx.lineTo(cx0, torsoTop + 12); ctx.lineTo(cx0 + 7, torsoTop - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = LANCE.shirtLight; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx0 - 7, torsoTop - 1.5); ctx.lineTo(cx0 - 16, torsoTop + 2); ctx.lineTo(cx0 - 1, torsoTop + 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx0 + 7, torsoTop - 1.5); ctx.lineTo(cx0 + 16, torsoTop + 2); ctx.lineTo(cx0 + 1, torsoTop + 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = LANCE.shirtDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx0 + 0.5, torsoTop + 13); ctx.lineTo(cx0 + 1 + lean * 0.1, torsoBot - 8); ctx.stroke();
    for (let i = 0; i < 3; i++) { const by = torsoTop + 17 + i * 8; D.circle(ctx, cx0 + 2 + lean * 0.05 * i, by, 1.2, '#f4ede0'); }
    // Whale Lance name patch on the chest
    ctx.save(); ctx.translate(-bodyW * 0.24 + lean * 0.6, torsoTop + 13);
    ctx.lineWidth = 1.5;
    D.fillRRect(ctx, -6, -3, 12, 6, 1, '#f4f1ea', OUT);
    D.ellipse(ctx, -1, 0, 3, 1.6, '#2b5aa8'); ctx.beginPath(); ctx.moveTo(2, -0.5); ctx.lineTo(4.5, -2.5); ctx.lineTo(4.5, 1); ctx.closePath(); ctx.fillStyle = '#2b5aa8'; ctx.fill();
    ctx.restore();
    // mechanic's leather tool belt: stitching, chrome buckle, pouches, hammer loop
    if (!thin) {
      const bx0 = -bodyW / 2 + 3 + lean * 0.2, bw = bodyW - 6, by = torsoBot - 7;
      // hammer hangs behind the left pouch
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx0 + 3, by + 4); ctx.lineTo(bx0 - 1, by + 19); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#b88a4a'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.lineWidth = 1.2; D.fillRRect(ctx, bx0 - 5, by + 17, 9, 4, 1, hi ? chrome(ctx, by + 17, by + 21) : '#999', OUT);
      ctx.fillStyle = hi ? enamel(ctx, by, by + 5, '#7a5230') : LANCE.belt; ctx.fillRect(bx0, by, bw, 5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(bx0, by, bw, 5);
      if (hi) {
        ctx.strokeStyle = 'rgba(240,210,150,0.6)'; ctx.lineWidth = 0.6; ctx.setLineDash([1.4, 1.2]);
        ctx.beginPath(); ctx.moveTo(bx0 + 1, by + 1.1); ctx.lineTo(bx0 + bw - 1, by + 1.1); ctx.moveTo(bx0 + 1, by + 3.9); ctx.lineTo(bx0 + bw - 1, by + 3.9); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1.2;
      D.fillRRect(ctx, lean * 0.2 - 3.5, by - 0.6, 7, 6.2, 1, hi ? chrome(ctx, by - 0.6, by + 5.6) : LANCE.buckle, OUT);
      ctx.fillStyle = '#3a2410'; ctx.fillRect(lean * 0.2 - 1.8, by + 1, 3.6, 3);
      for (const px of [bx0 - 1, bodyW / 2 - 12 + lean * 0.2]) {
        D.fillRRect(ctx, px, by + 2, 10, 10, 2, hi ? enamel(ctx, by + 2, by + 12, '#8a6238') : LANCE.pouch, OUT);
        D.fillRRect(ctx, px - 0.5, by + 1.5, 11, 4, 1.5, hi ? enamel(ctx, by + 1.5, by + 5.5, '#6a4624') : LANCE.belt, OUT);
        ctx.fillStyle = hi ? '#e8d8a0' : '#caa'; ctx.beginPath(); ctx.arc(px + 5, by + 4.4, 0.9, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#b8bcc8'; ctx.fillRect(bodyW / 2 - 8 + lean * 0.2, by - 1, 2, 5); ctx.fillStyle = '#e8c000'; ctx.fillRect(bodyW / 2 - 5 + lean * 0.2, by - 1, 2, 4);
    } else {
      ctx.fillStyle = LANCE.belt; ctx.fillRect(-bodyW / 2 + 3 + lean * 0.2, torsoBot - 6, bodyW - 6, 4);
      ctx.fillStyle = LANCE.buckle; ctx.fillRect(lean * 0.2 - 2, torsoBot - 6, 4, 4);
    }
    // neck
    ctx.fillStyle = LANCE.skinDark; ctx.fillRect(cx0 - 6 + lean * 0.3, torsoTop - 8, 12, 9);
    // lei: purple & white plumeria, hanging over the chest
    lei(ctx, cx0, torsoTop - 2, thin ? 11 : 15, thin ? 22 : 26, 2.6);
    // head
    ctx.save();
    ctx.translate(lean * 0.9, headY + cy + bob + 2);
    ctx.rotate(headTilt);
    lanceHead(ctx, 0, 0, 38, { mood, noPhoto: o.noPhoto });
    ctx.restore();
    // front arm (in front of body)
    const fs = { x: sh.x + lean * 0.6, y: sh.y + cy + bob }, fel = { x: fe.x, y: fe.y + cy + bob };
    limb2(ctx, fs.x, fs.y, fel.x, fel.y, fh.x, fh.y + cy + bob, armW, LANCE.shirt, skin, 6, skin);
    sleeveCuff(ctx, fs, fel, armW);
    if (toolKind && toolAtFront !== false) tool(ctx, toolKind, fh.x, fh.y + cy + bob, toolAng);
    if (toolKind && toolAtFront === false) tool(ctx, toolKind, bh2.x, bh2.y + cy + bob, toolAng);
  }

  /* ================= ENEMIES ================= */
  // Palette per type
  const VEG = {
    broccoli: { body: '#4f9a2c', dark: '#2f6318', stalk: '#a9d67a', limb: '#5aa53a', glove: '#3f8424', boot: '#2a2a2a', h: 66 },
    sprout: { body: '#7bbf3a', dark: '#4e8a22', limb: '#5a9a2a', glove: '#fff', boot: '#333', h: 40 },
    celery: { body: '#a6d46a', dark: '#6da03a', limb: '#8cc050', glove: '#ddd', boot: '#333', h: 84 },
    carrot: { body: '#f08a1e', dark: '#c05e0a', leaf: '#3f9b2f', limb: '#e07818', glove: '#222', boot: '#222', band: '#d81818', h: 62 },
    spinach: { body: '#2f6b2a', dark: '#1e4a1a', limb: '#2a5a26', glove: '#e0e0e0', boot: '#222', band: '#2848c8', h: 70 },
    kale: { body: '#1f4d3a', dark: '#12302a', frill: '#3e8a5e', limb: '#1a4232', glove: '#c8c8c8', boot: '#1a1a1a', h: 84 },
    froyo: { cup: '#f6f2ea', cupDark: '#d8d0c0', swirl: '#f7a7c7', swirlDark: '#d87aa0', limb: '#e8e2d6', glove: '#fff', boot: '#c8c0b0', h: 60 }
  };

  /* generic limb rig; returns positions given pose */
  function rig(pose, t, hipY, shoulderY, spread) {
    const s = Math.sin(t * 9), c = Math.cos(t * 9);
    const r = {
      lf: { x: -spread, y: 0 }, rf: { x: spread, y: 0 },
      fe: { x: spread + 6, y: shoulderY + 12 }, fh: { x: spread + 8, y: shoulderY + 22 },
      be: { x: -spread - 6, y: shoulderY + 12 }, bh2: { x: -spread - 8, y: shoulderY + 22 },
      lean: 0, crouch: 0, bob: 0, lying: false
    };
    switch (pose) {
      case 'idle': r.bob = Math.sin(t * 4) * 1.2; r.fh.x += 6; r.fh.y -= 4; r.bh2.x -= 2; break;
      case 'walk':
        r.lf = { x: -spread + s * 8, y: Math.min(0, -c * 4) }; r.rf = { x: spread - s * 8, y: Math.min(0, c * 4) };
        r.fe.x -= s * 4; r.fh.x -= s * 8; r.be.x += s * 4; r.bh2.x += s * 8; break;
      case 'windup': r.lean = -5; r.fe = { x: -2, y: shoulderY - 6 }; r.fh = { x: -14, y: shoulderY - 12 }; break;
      case 'attack': r.lean = 8; r.crouch = 2; r.lf.x -= 6; r.rf.x += 8; r.fe = { x: spread + 14, y: shoulderY + 4 }; r.fh = { x: spread + 30, y: shoulderY + 2 }; break;
      case 'kick': r.lean = 4; r.rf = { x: spread + 26, y: -hipY * 0.6 }; r.fe = { x: spread + 6, y: shoulderY }; r.fh = { x: spread - 2, y: shoulderY - 10 }; break;
      case 'hurt': r.lean = -8; r.fe = { x: spread + 6, y: shoulderY - 6 }; r.fh = { x: spread + 10, y: shoulderY - 16 }; r.be = { x: -spread - 6, y: shoulderY - 6 }; r.bh2 = { x: -spread - 12, y: shoulderY - 14 }; break;
      case 'down': case 'dead': case 'thrown': case 'knockdown': r.lying = true; break;
      case 'grabbed': r.lean = 2; r.fe = { x: spread + 4, y: shoulderY + 10 }; r.fh = { x: spread - 2, y: shoulderY + 2 }; r.be = { x: -spread - 4, y: shoulderY + 10 }; r.bh2 = { x: -spread + 2, y: shoulderY + 2 }; break;
      case 'stunned': r.lean = -3; r.bob = Math.sin(t * 12) * 1.5; r.fh.y += 6; r.bh2.y += 6; break;
      case 'dash': r.lean = 12; r.crouch = 6; r.lf.x -= 12; r.rf.x += 12; r.fe = { x: -spread - 8, y: shoulderY + 6 }; r.fh = { x: -spread - 18, y: shoulderY + 14 }; r.be = { x: spread + 8, y: shoulderY + 6 }; r.bh2 = { x: spread + 20, y: shoulderY + 10 }; break;
      case 'roll': r.lying = false; break;
      case 'spit': r.lean = -3; r.fe = { x: spread + 8, y: shoulderY + 6 }; r.fh = { x: spread + 6, y: shoulderY + 20 }; break;
    }
    return r;
  }

  function drawLimbs(ctx, r, V, hipY, shoulderY, thickness, drawBody) {
    const w = thickness || 6;
    const cy = r.crouch + r.bob;
    // back arm
    limb2(ctx, -6 + r.lean * 0.5, shoulderY + cy, r.be.x, r.be.y + cy, r.bh2.x, r.bh2.y + cy, w, V.limb, V.glove, w * 0.8);
    // legs
    limb2(ctx, -5 + r.lean * 0.2, hipY + cy, (r.lf.x - 5) / 2 - 2, (hipY + cy + r.lf.y) / 2, r.lf.x, r.lf.y - 2, w, V.limb);
    limb2(ctx, 5 + r.lean * 0.2, hipY + cy, (r.rf.x + 5) / 2 + 2, (hipY + cy + r.rf.y) / 2, r.rf.x, r.rf.y - 2, w, V.limb);
    D.fillRRect(ctx, r.lf.x - 6, r.lf.y - 6, 13, 7, 3, V.boot, OUT);
    D.fillRRect(ctx, r.rf.x - 6, r.rf.y - 6, 13, 7, 3, V.boot, OUT);
    drawBody(cy, r.lean);
    // front arm
    limb2(ctx, 6 + r.lean * 0.6, shoulderY + cy, r.fe.x, r.fe.y + cy, r.fh.x, r.fh.y + cy, w, V.limb, V.glove, w * 0.8);
  }

  function face(ctx, x, y, pose, size, eyeColor) {
    if (pose === 'stunned' || pose === 'down' || pose === 'dead' || pose === 'thrown') dizzyEyes(ctx, x, y, size * 1.2);
    else angryEyes(ctx, x, y, size * 1.2, size, eyeColor);
    if (pose === 'hurt' || pose === 'grabbed') { D.ellipse(ctx, x, y + size * 2.2, size * 0.9, size * 0.9, '#3a0a10', OUT); }
    else angryMouth(ctx, x, y + size * 1.8, size * 2.6, pose === 'attack' || pose === 'windup');
  }

  const enemyDrawers = {
    broccoli(ctx, e, r) {
      // Muscle-bound floret in a KALE RAGE tank and floral board shorts.
      const V = VEG.broccoli, hipY = -26, shoulderY = -46;
      drawLimbs(ctx, r, V, hipY, shoulderY, 9, (cy, lean) => {
        const lx = lean * 0.6;
        // board shorts over the hips
        ctx.beginPath(); ctx.moveTo(-11 + lean * 0.2, hipY - 3 + cy); ctx.lineTo(11 + lean * 0.2, hipY - 3 + cy); ctx.lineTo(13, hipY + 9 + cy); ctx.lineTo(1.5, hipY + 9 + cy); ctx.lineTo(0, hipY + 4 + cy); ctx.lineTo(-1.5, hipY + 9 + cy); ctx.lineTo(-13, hipY + 9 + cy); ctx.closePath();
        ctx.fillStyle = '#138a9a'; ctx.fill();
        if (rich()) {
          ctx.save(); ctx.clip();
          for (const [fx, fy, fr] of [[-8, 1, 3.2], [4, -1, 2.8], [9, 6, 3], [-3, 6, 2.4]]) hibiscus(ctx, fx + lean * 0.2, hipY + fy + cy, fr, '#ff7aa8', '#ffe070', fx);
          ctx.restore();
          ctx.beginPath(); ctx.moveTo(-11 + lean * 0.2, hipY - 3 + cy); ctx.lineTo(11 + lean * 0.2, hipY - 3 + cy); ctx.lineTo(13, hipY + 9 + cy); ctx.lineTo(1.5, hipY + 9 + cy); ctx.lineTo(0, hipY + 4 + cy); ctx.lineTo(-1.5, hipY + 9 + cy); ctx.lineTo(-13, hipY + 9 + cy); ctx.closePath();
          volume(ctx, lean * 0.2, 13, 0.8);
        }
        outlineStyle(ctx, 1.8); ctx.stroke();
        // V-taper stalk torso
        const torso = () => { ctx.beginPath(); ctx.moveTo(-14 + lx, shoulderY + cy); ctx.lineTo(14 + lx, shoulderY + cy); ctx.quadraticCurveTo(13 + lx, shoulderY + 12 + cy, 8, hipY - 1 + cy); ctx.lineTo(-8, hipY - 1 + cy); ctx.quadraticCurveTo(-13 + lx, shoulderY + 12 + cy, -14 + lx, shoulderY + cy); ctx.closePath(); };
        torso(); ctx.fillStyle = V.stalk; ctx.fill();
        // tank top
        ctx.save(); ctx.clip();
        ctx.beginPath(); ctx.moveTo(-10 + lx, shoulderY - 1 + cy); ctx.lineTo(-6 + lx, shoulderY - 1 + cy); ctx.quadraticCurveTo(lx, shoulderY + 6 + cy, 6 + lx, shoulderY - 1 + cy); ctx.lineTo(10 + lx, shoulderY - 1 + cy); ctx.lineTo(16 + lx, hipY + 2 + cy); ctx.lineTo(-16 + lx, hipY + 2 + cy); ctx.closePath();
        ctx.fillStyle = '#f6f4ec'; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-16 + lx, hipY - 4 + cy, 32, 6);
        ctx.restore();
        label(ctx, 'KALE', lx + 0.5, shoulderY + 6 + cy, { size: 3.4, align: 'center', color: '#1a5a14', shadow: false });
        label(ctx, 'RAGE', lx + 0.5, shoulderY + 10.5 + cy, { size: 3.4, align: 'center', color: '#d8282a', shadow: false });
        torso(); volume(ctx, lx, 14, 1); outlineStyle(ctx, 2); ctx.stroke();
        // pec line + deltoids
        ctx.strokeStyle = 'rgba(40,70,20,0.45)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(lx, shoulderY + 3 + cy); ctx.lineTo(lx, shoulderY + 14 + cy); ctx.stroke();
        ball(ctx, -12 + lx, shoulderY + 2 + cy, 5, V.limb); ball(ctx, 12 + lx, shoulderY + 2 + cy, 5, V.limb);
        // florets head, lit from the sun side
        const hx = lean * 0.9, hy = shoulderY - 14 + cy;
        ctx.fillStyle = V.stalk; ctx.fillRect(hx - 5, hy + 6, 10, 8);
        const bumps = [[-14, 2, 9], [14, 2, 9], [-8, -8, 9], [8, -8, 9], [0, -12, 10], [0, 0, 11]];
        for (const [bx, by, br] of bumps) ball(ctx, hx + bx, hy + by, br, V.body);
        if (rich()) {
          for (const [bx, by, br] of bumps) for (let i = 0; i < 5; i++) { const a = i * 1.3 + bx; const d = br * (0.35 + (i % 2) * 0.25); ctx.fillStyle = i % 2 ? 'rgba(20,60,10,0.4)' : 'rgba(190,240,140,0.45)'; ctx.beginPath(); ctx.arc(hx + bx + Math.cos(a) * d, hy + by + Math.sin(a) * d, 1.4, 0, 7); ctx.fill(); }
        } else for (const [bx, by, br] of bumps) { ctx.fillStyle = V.dark; for (let i = 0; i < 4; i++) { const a = i * 1.7 + bx; ctx.beginPath(); ctx.arc(hx + bx + Math.cos(a) * br * 0.5, hy + by + Math.sin(a) * br * 0.5, 1.6, 0, 7); ctx.fill(); } }
        face(ctx, hx, hy + 2, e.pose, 3.2);
      });
    },
    sprout(ctx, e, r) {
      const V = VEG.sprout, hipY = -14, shoulderY = -26;
      if (e.pose === 'roll') {
        ctx.save(); ctx.rotate(e.t * 20);
        ball(ctx, 0, -14, 14, V.body);
        ctx.fillStyle = V.dark; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.26) * 8, -14 + Math.sin(i * 1.26) * 8, 3, 0, 7); ctx.fill(); }
        ctx.restore(); return;
      }
      drawLimbs(ctx, r, V, hipY, shoulderY, 5, (cy, lean) => {
        const hx = lean * 0.6, hy = shoulderY - 6 + cy;
        ball(ctx, hx, hy, 15, V.body, false);
        // wrapped leaves, like a real sprout: two side leaves and a cap leaf
        ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 15, 0, Math.PI * 2); ctx.clip();
        const leaves = [[-11, 5, 11, 15, -0.5, '#95d650'], [11, 6, 11, 15, 0.5, '#86c844'], [0, -13, 15, 8, 0, '#a2de5c']];
        for (const [lx, ly, rx, ry, rot, col] of leaves) {
          ctx.beginPath(); ctx.ellipse(hx + lx, hy + ly, rx, ry, rot, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill(); volume(ctx, hx + lx, rx, 0.7);
          ctx.strokeStyle = 'rgba(40,90,20,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.strokeStyle = 'rgba(230,255,190,0.6)'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(hx + lx * 0.4, hy + ly * 0.4); ctx.lineTo(hx + lx * 1.2, hy + ly * 1.2 + (ly < 0 ? 0 : 6)); ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(hx, hy, 15, 0, Math.PI * 2); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        // stem nub + tuft
        ctx.fillStyle = '#c8e890'; ctx.beginPath(); ctx.ellipse(hx, hy + 14.5, 3, 1.6, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(hx + 2, hy - 14); ctx.rotate(0.35);
        D.ellipse(ctx, 0, -3, 2.4, 5, '#6ab83a', OUT); ctx.restore();
        face(ctx, hx, hy + 2, e.pose, 2.6);
      });
    },
    celery(ctx, e, r) {
      const V = VEG.celery, hipY = -34, shoulderY = -62;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        // tall ribbed stalk
        D.fillRRect(ctx, -9 + lean * 0.4, shoulderY - 12 + cy, 18, 52, 5, V.body, OUT); volume(ctx, lean * 0.4, 9, 0.9); outlineStyle(ctx, 2); ctx.stroke();
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5 + lean * 0.4, shoulderY - 8 + cy); ctx.lineTo(i * 5 + lean * 0.3, hipY + 4 + cy); ctx.stroke(); }
        // leaves on top
        for (const [lx, ly] of [[-8, -22], [0, -28], [8, -22]]) { oval(ctx, lx + lean * 0.6, shoulderY + ly + cy, 5, 8, '#5aa83a'); }
        face(ctx, lean * 0.6, shoulderY - 2 + cy, e.pose, 3);
        // the long reach has to be visible before it lands
        const rib = (e.pose === 'kick' || e.pose === 'attack') ? 58 : (e.pose === 'windup' ? 16 : 42);
        ctx.save();
        ctx.translate(8 + lean * 0.4, shoulderY + 8 + cy);
        ctx.rotate(e.pose === 'windup' ? -1.2 : (e.pose === 'kick' || e.pose === 'attack') ? 0.15 : -0.4);
        D.fillRRect(ctx, 0, -2.5, rib, 5, 2, '#e7f6b0', OUT);
        D.circle(ctx, rib, 0, 3.2, '#c6e86a', OUT);
        ctx.restore();
      });
    },
    carrot(ctx, e, r) {
      // CRUNCH CREW ninja: tapered root in a black tank, red headband.
      const V = VEG.carrot, hipY = -26, shoulderY = -46;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        const lx = lean * 0.6;
        const body = () => { ctx.beginPath(); ctx.moveTo(-13 + lx, shoulderY - 18 + cy); ctx.lineTo(13 + lx, shoulderY - 18 + cy); ctx.quadraticCurveTo(12, hipY + cy, 0, hipY + 10 + cy); ctx.quadraticCurveTo(-12, hipY + cy, -13 + lx, shoulderY - 18 + cy); ctx.closePath(); };
        body(); ctx.fillStyle = V.body; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 + lean * 0.5, shoulderY - 6 + i * 10 + cy); ctx.lineTo(6 + lean * 0.5, shoulderY - 4 + i * 10 + cy); ctx.stroke(); }
        // black tank with scoop neck
        ctx.beginPath(); ctx.moveTo(-14 + lx, shoulderY + 1 + cy); ctx.lineTo(-7 + lx, shoulderY + 1 + cy); ctx.quadraticCurveTo(lx, shoulderY + 6 + cy, 7 + lx, shoulderY + 1 + cy); ctx.lineTo(14 + lx, shoulderY + 1 + cy); ctx.lineTo(14, hipY + 2 + cy); ctx.lineTo(-14, hipY + 2 + cy); ctx.closePath();
        ctx.fillStyle = '#23232a'; ctx.fill();
        ctx.restore();
        label(ctx, 'CRUNCH', lx * 0.9, shoulderY + 7 + cy, { size: 3, align: 'center', color: '#ffffff', shadow: false });
        label(ctx, 'CREW', lx * 0.9, shoulderY + 11 + cy, { size: 3, align: 'center', color: '#f08a1e', shadow: false });
        body(); volume(ctx, lx, 13, 1); topLight(ctx, shoulderY - 18 + cy, hipY + 10 + cy, 0.6);
        outlineStyle(ctx, 2); ctx.stroke();
        // ninja headband with trailing tails
        ctx.fillStyle = V.band; ctx.fillRect(-13 + lx, shoulderY - 12 + cy, 26, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-13 + lx, shoulderY - 12 + cy, 26, 1.2);
        ctx.fillStyle = V.band;
        ctx.beginPath(); ctx.moveTo(-13 + lx, shoulderY - 10 + cy); ctx.lineTo(-24 + lx, shoulderY - 4 + cy + Math.sin(e.t * 12) * 2); ctx.lineTo(-22 + lx, shoulderY - 12 + cy); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-13 + lx, shoulderY - 9 + cy); ctx.lineTo(-22 + lx, shoulderY + 1 + cy + Math.sin(e.t * 12 + 1) * 2); ctx.lineTo(-19 + lx, shoulderY - 9 + cy); ctx.closePath(); ctx.fill();
        // leaf hair
        for (const [lx2, ly, a] of [[-6, -24, -0.4], [0, -28, 0], [6, -24, 0.4]]) { ctx.save(); ctx.translate(lx2 + lx, shoulderY + ly + cy); ctx.rotate(a); oval(ctx, 0, 0, 3, 8, V.leaf); ctx.restore(); }
        face(ctx, lx, shoulderY - 2 + cy, e.pose, 2.8);
        if (e.pose === 'windup' || e.pose === 'spit' || e.pose === 'attack' || e.pose === 'dash') {
          ctx.save();
          ctx.translate(r.fh.x + 10, r.fh.y + cy);
          ctx.fillStyle = rich() ? chrome(ctx, -8, 8) : '#e8eef8';
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2.2, -2); ctx.lineTo(0, -8); ctx.lineTo(-2.2, -2); ctx.closePath();
            ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
          }
          ctx.restore();
        }
      });
    },
    spinach(ctx, e, r) {
      const V = VEG.spinach, hipY = -28, shoulderY = -50;
      drawLimbs(ctx, r, V, hipY, shoulderY, 9, (cy, lean) => {
        // leafy bulky torso
        ctx.beginPath(); ctx.moveTo(-18 + lean * 0.6, shoulderY - 2 + cy);
        for (let i = 0; i <= 8; i++) { const a = Math.PI + i * (Math.PI / 8); ctx.lineTo(Math.cos(a) * -20 + lean * 0.4, shoulderY + 14 + cy + Math.sin(a) * -14 + (i % 2) * 3); }
        ctx.lineTo(16, hipY + 8 + cy); ctx.lineTo(-16, hipY + 8 + cy); ctx.closePath();
        ctx.fillStyle = V.body; ctx.fill(); volume(ctx, lean * 0.4, 20, 1); topLight(ctx, shoulderY + cy, hipY + 8 + cy); outlineStyle(ctx, 2); ctx.stroke();
        // veins
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lean * 0.5, shoulderY + cy); ctx.lineTo(lean * 0.2, hipY + 6 + cy); ctx.stroke();
        // SPIN belt
        ctx.fillStyle = '#e8c04a'; ctx.fillRect(-14, hipY + 2 + cy, 28, 6);
        label(ctx, 'SPIN', 0, hipY + 2 + cy, { size: 5, align: 'center', color: '#3a2a00', shadow: false });
        // head: round leaf with bandana
        const hx = lean * 0.8, hy = shoulderY - 12 + cy;
        oval(ctx, hx, hy, 15, 13, V.body);
        ctx.fillStyle = V.band; ctx.beginPath(); ctx.ellipse(hx, hy - 8, 15, 5, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(hx - 15, hy - 8, 30, 3);
        face(ctx, hx, hy + 1, e.pose, 3.2);
      });
    },
    kale(ctx, e, r) {
      const V = VEG.kale, hipY = -34, shoulderY = -62;
      drawLimbs(ctx, r, V, hipY, shoulderY, 11, (cy, lean) => {
        // massive frilly torso
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const a = Math.PI + i * (Math.PI / 14); const rad = 26 + (i % 2) * 5; ctx.lineTo(Math.cos(a) * rad + lean * 0.5, shoulderY + 12 + cy + Math.sin(a) * rad * 0.8); }
        ctx.lineTo(20, hipY + 8 + cy); ctx.lineTo(-20, hipY + 8 + cy); ctx.closePath();
        ctx.fillStyle = V.body; ctx.fill(); volume(ctx, lean * 0.5, 28, 1); topLight(ctx, shoulderY - 14 + cy, hipY + 8 + cy); outlineStyle(ctx, 2.5); ctx.stroke();
        ctx.strokeStyle = V.frill; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-12 + i * 8 + lean * 0.5, shoulderY + 6 + cy, 6, Math.PI, Math.PI * 2); ctx.stroke(); }
        // spiked collar/chain
        ctx.fillStyle = '#c0c0c0'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 8 - 2 + lean * 0.6, shoulderY - 4 + cy, 4, 4);
        // head: curly kale
        const hx = lean * 0.9, hy = shoulderY - 16 + cy;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ball(ctx, hx + Math.cos(a) * 11, hy + Math.sin(a) * 9, 7, V.frill); }
        oval(ctx, hx, hy, 14, 12, V.body);
        ball(ctx, r.fh.x, r.fh.y + cy, 7, '#c8322a');
        ball(ctx, r.bh2.x, r.bh2.y + cy, 7, '#c8322a');
        face(ctx, hx, hy + 1, e.pose, 3.4, '#ffe0a0');
      });
    },
    froyo(ctx, e, r) {
      const V = VEG.froyo, hipY = -22, shoulderY = -44;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        // cup
        ctx.beginPath(); ctx.moveTo(-16 + lean * 0.6, shoulderY - 2 + cy); ctx.lineTo(16 + lean * 0.6, shoulderY - 2 + cy); ctx.lineTo(12, hipY + 8 + cy); ctx.lineTo(-12, hipY + 8 + cy); ctx.closePath();
        ctx.fillStyle = V.cup; ctx.fill(); volume(ctx, lean * 0.6, 16, 1); outlineStyle(ctx, 2); ctx.stroke();
        ctx.fillStyle = '#e85a8a'; ctx.fillRect(-13 + lean * 0.5, shoulderY + 6 + cy, 26, 8);
        label(ctx, 'FROYO', lean * 0.5, shoulderY + 7 + cy, { size: 5, align: 'center', color: '#fff', shadow: false });
        face(ctx, lean * 0.6, shoulderY + 20 + cy - 6, e.pose, 2.6);
        // swirl
        const sx = lean * 0.8, sy = shoulderY - 4 + cy;
        oval(ctx, sx, sy - 2, 17, 6, V.swirl);
        oval(ctx, sx, sy - 10, 12, 6, V.swirl);
        oval(ctx, sx, sy - 17, 7, 5, V.swirl);
        ball(ctx, sx + 1, sy - 24, 3.5, V.swirl);
        ctx.fillStyle = V.swirlDark; ctx.fillRect(sx - 8, sy - 12, 4, 1.5); ctx.fillRect(sx + 2, sy - 6, 5, 1.5);
        // sprinkles
        const cols = ['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88'];
        for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(sx - 10 + i * 4, sy - 20 + (i % 3) * 5, 3, 1.5); }
        // strawberry
        ball(ctx, sx - 8, sy - 6, 3.5, '#e82a3a');
        // spoon in front hand later? draw spoon in hand
        ctx.save(); ctx.translate(r.fh.x, r.fh.y + cy); ctx.rotate(-0.8);
        D.fillRRect(ctx, -1.5, -14, 3, 16, 1, '#d8d8e0', OUT); D.ellipse(ctx, 0, -17, 4, 5, '#e8e8f0', OUT);
        ctx.restore();
      });
    }
  };

  /**
   * drawEnemy(ctx, x, y, e) — e: {type, pose, t, facing, flash, alpha, taped}
   */
  function drawEnemy(ctx, x, y, e) {
    const V = VEG[e.type];
    if (!V) return;
    const ph = paintedEnemy(ctx, x, y, e);
    if (ph) { enemyOverlays(ctx, x, y, e, ph); return; }
    if (e.flash) {
      drawFlashed(ctx, x, y, 150, 250, (f) => drawEnemy(f, 150, 250, Object.assign({}, e, { flash: false })));
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (e.facing < 0) ctx.scale(-1, 1);
    LS = WL.light.side * (e.facing < 0 ? -1 : 1);
    FLIP = e.facing < 0;
    if (e.alpha !== undefined) ctx.globalAlpha = e.alpha;
    const hipY = -V.h * 0.4, shoulderY = -V.h * 0.72;
    const r = rig(e.pose, e.t || 0, hipY, shoulderY, V.h * 0.12);
    // Soft contrast silhouette backing for enemy readability
    if (!r.lying && e.pose !== 'down' && e.pose !== 'dead') {
      ctx.save();
      ctx.globalAlpha = (e.alpha !== undefined ? e.alpha : 1) * (rich() ? 0.1 : 0.32);
      D.ellipse(ctx, 0, -V.h * 0.48, V.h * 0.32, V.h * 0.46, 'rgba(10,12,22,0.85)');
      ctx.restore();
    }
    if (r.lying) {
      ctx.save();
      ctx.translate(0, -8);
      let rot = -Math.PI / 2 + 0.1;
      if (e.pose === 'thrown') rot = -Math.PI / 2 + (e.t || 0) * 14;
      else if (e.pose === 'knockdown') rot = -0.7 - Math.sin((e.t || 0) * 8) * 0.5;
      ctx.rotate(rot);
      const rr = rig('hurt', 0, hipY, shoulderY, V.h * 0.12);
      enemyDrawers[e.type](ctx, e, rr);
      ctx.restore();
      if (e.pose === 'down') for (let i = 0; i < 3; i++) { const a = (e.t || 0) * 5 + i * 2.1; D.circle(ctx, -V.h * 0.45 + Math.cos(a) * 10, -12 + Math.sin(a) * 3, 2.2, '#ffe14a', OUT); }
    } else {
      enemyDrawers[e.type](ctx, e, r);
      if (e.pose === 'stunned') {
        for (let i = 0; i < 4; i++) { const a = (e.t || 0) * 6 + i * 1.57; D.circle(ctx, Math.cos(a) * 14, -V.h - 6 + Math.sin(a) * 4, 2.2, '#8ff', OUT); }
      }
    }
    if (e.stunTint) {
      // Frost shell. Replaces a hue-rotate filter, which re-rasterizes the
      // whole frame on desktop resolutions.
      ctx.save();
      ctx.strokeStyle = '#d7f4ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -V.h * 0.48, V.h * 0.34, V.h * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(-V.h * 0.12, -V.h * 0.78); ctx.lineTo(V.h * 0.04, -V.h * 0.46); ctx.lineTo(-V.h * 0.06, -V.h * 0.18);
      ctx.moveTo(V.h * 0.16, -V.h * 0.7); ctx.lineTo(0, -V.h * 0.5); ctx.lineTo(V.h * 0.1, -V.h * 0.28);
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,235,255,0.35)';
      ctx.beginPath(); ctx.ellipse(0, -V.h * 0.48, V.h * 0.22, V.h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (e.taped) {
      ctx.fillStyle = '#9a9a9a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.rect(-V.h * 0.22, -V.h * 0.62 + i * 8, V.h * 0.44, 5); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
    FLIP = false;
  }

  /** Status overlays on a painted enemy: KO stars, dizzy stars, frost shell, duct tape. */
  function enemyOverlays(ctx, x, y, e, h) {
    const t = e.t || 0, pose = e.pose;
    ctx.save();
    ctx.translate(x, y);
    if (e.alpha !== undefined) ctx.globalAlpha = e.alpha;
    const back = e.facing < 0 ? 1 : -1;
    if (pose === 'down') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; D.circle(ctx, back * h * 0.45 + Math.cos(a) * 10, -h * 0.28 + Math.sin(a) * 3, 2.2, '#ffe14a', OUT); }
    if (pose === 'stunned') for (let i = 0; i < 4; i++) { const a = t * 6 + i * 1.57; D.circle(ctx, Math.cos(a) * 14, -h - 4 + Math.sin(a) * 4, 2.2, '#8ff', OUT); }
    if (e.stunTint) {
      ctx.fillStyle = 'rgba(170,225,255,0.34)';
      ctx.beginPath(); ctx.ellipse(0, -h * 0.5, h * 0.36, h * 0.52, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e4f7ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(-h * 0.12, -h * 0.82); ctx.lineTo(h * 0.04, -h * 0.5); ctx.lineTo(-h * 0.06, -h * 0.2);
      ctx.moveTo(h * 0.16, -h * 0.74); ctx.lineTo(0, -h * 0.52); ctx.lineTo(h * 0.1, -h * 0.3);
      ctx.stroke();
    }
    if (e.taped) {
      for (let i = 0; i < 3; i++) {
        const g = ctx.createLinearGradient(0, -h * 0.6 + i * 8, 0, -h * 0.6 + i * 8 + 5);
        g.addColorStop(0, '#e2e4e8'); g.addColorStop(0.5, '#9a9ea8'); g.addColorStop(1, '#6a6e78');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(20,20,40,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(-h * 0.24, -h * 0.6 + i * 8, h * 0.48, 5); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================= BOSS: Giant Froyo Cone ================= */
  /**
   * drawBoss(ctx, x, y, b) b: {pose, t, facing, flash, armor(0..1), phase, melt}
   * poses: idle, walk, slamWind, slam, jump, land, rainWind, hurt, stagger, dead
   */
  function drawBoss(ctx, x, y, b) {
    if (b.flash) {
      drawFlashed(ctx, x, y, 160, 270, (f) => drawBoss(f, 160, 270, Object.assign({}, b, { flash: false })));
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (b.facing < 0) ctx.scale(-1, 1);
    LS = WL.light.side * (b.facing < 0 ? -1 : 1);
    const t = b.t || 0;
    const H = 150;
    let lean = 0, crouch = 0, bob = Math.sin(t * 3) * 1.5;
    let lf = { x: -22, y: 0 }, rf = { x: 22, y: 0 };
    let fe = { x: 44, y: -96 }, fh = { x: 58, y: -78 };
    let be = { x: -44, y: -96 }, bh2 = { x: -56, y: -78 };
    let spoonAng = -0.6;
    switch (b.pose) {
      case 'walk': { const s = Math.sin(t * 7), c = Math.cos(t * 7); lf = { x: -22 + s * 14, y: Math.min(0, -c * 6) }; rf = { x: 22 - s * 14, y: Math.min(0, c * 6) }; fh.x -= s * 8; bh2.x += s * 8; break; }
      case 'slamWind': lean = -8; fe = { x: 30, y: -140 }; fh = { x: 10, y: -170 }; spoonAng = -2.4; break;
      case 'jumpWind': crouch = 10; lean = -4; lf = { x: -28, y: 0 }; rf = { x: 28, y: 0 }; fe = { x: 36, y: -130 }; fh = { x: 20, y: -158 }; be = { x: -36, y: -120 }; bh2 = { x: -20, y: -150 }; spoonAng = -2.1; bob = Math.sin(t * 16) * 1.5; break;
      case 'slam': lean = 14; crouch = 10; fe = { x: 52, y: -80 }; fh = { x: 78, y: -30 }; spoonAng = 0.9; lf = { x: -30, y: 0 }; rf = { x: 30, y: 0 }; break;
      case 'jump': lf = { x: -20, y: -20 }; rf = { x: 20, y: -16 }; fe = { x: 48, y: -120 }; fh = { x: 50, y: -150 }; be = { x: -48, y: -120 }; bh2 = { x: -50, y: -150 }; spoonAng = -1.6; break;
      case 'land': crouch = 12; lf = { x: -34, y: 0 }; rf = { x: 34, y: 0 }; fe = { x: 50, y: -70 }; fh = { x: 66, y: -40 }; be = { x: -50, y: -70 }; bh2 = { x: -66, y: -40 }; break;
      case 'rainWind': lean = -4; fe = { x: 40, y: -130 }; fh = { x: 30, y: -165 }; be = { x: -40, y: -130 }; bh2 = { x: -30, y: -165 }; spoonAng = -1.8; bob = Math.sin(t * 20) * 2; break;
      case 'hurt': lean = -10; fh = { x: 60, y: -110 }; bh2 = { x: -60, y: -110 }; break;
      case 'stagger': lean = -16; crouch = 6; bob = Math.sin(t * 14) * 3; fh = { x: 66, y: -100 }; bh2 = { x: -62, y: -100 }; break;
      case 'dead': crouch = 30; lean = 6; fh = { x: 50, y: -20 }; bh2 = { x: -50, y: -20 }; break;
    }
    const cy = crouch + bob;
    const hipY = -46 + cy, shoulderY = -100 + cy;
    const meltT = b.melt || 0;
    // back arm
    limb2(ctx, -30 + lean * 0.5, shoulderY, be.x, be.y + cy, bh2.x, bh2.y + cy, 14, '#e8d8b8', '#fff', 12);
    // legs (waffle cone legs)
    limb2(ctx, -14 + lean * 0.2, hipY, (lf.x - 14) / 2, (hipY + lf.y) / 2, lf.x, lf.y - 4, 14, '#c88a3a');
    limb2(ctx, 14 + lean * 0.2, hipY, (rf.x + 14) / 2, (hipY + rf.y) / 2, rf.x, rf.y - 4, 14, '#c88a3a');
    D.fillRRect(ctx, lf.x - 14, lf.y - 12, 30, 13, 5, '#5a2c14', OUT);
    D.fillRRect(ctx, rf.x - 14, rf.y - 12, 30, 13, 5, '#5a2c14', OUT);
    // cone body (inverted: wide at top)
    ctx.beginPath();
    ctx.moveTo(-44 + lean * 0.8, shoulderY - 4);
    ctx.lineTo(44 + lean * 0.8, shoulderY - 4);
    ctx.lineTo(18 + lean * 0.2, hipY + 12);
    ctx.lineTo(-18 + lean * 0.2, hipY + 12);
    ctx.closePath();
    ctx.fillStyle = '#d9993f'; ctx.fill(); volume(ctx, lean * 0.6, 44, 1.1); outlineStyle(ctx, 3); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = '#a86a22'; ctx.lineWidth = 2;
    for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 12 - 30 + lean * 0.8, shoulderY - 4); ctx.lineTo(i * 12 + 10, hipY + 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 12 + 30 + lean * 0.8, shoulderY - 4); ctx.lineTo(i * 12 - 10, hipY + 12); ctx.stroke(); }
    if (!rich()) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-60, shoulderY - 10, 32, 90); }
    else { ctx.fillStyle = 'rgba(255,220,150,0.35)'; for (let i = -4; i <= 4; i++) ctx.fillRect(i * 12 + lean * 0.5 - 1, shoulderY + 2 + Math.abs(i) * 2, 2, 2); }
    ctx.restore();
    // drips
    for (let i = -2; i <= 2; i++) { const dl = 8 + Math.abs(i) * 4 + meltT * 20 + Math.sin(t * 2 + i) * 2; D.fillRRect(ctx, i * 18 - 5 + lean * 0.8, shoulderY - 6, 10, dl, 5, '#f7a7c7', OUT); }
    // swirl head (tiers)
    const hx = lean * 1.1, hy = shoulderY - 6;
    const tiers = [[46, 16, 0], [38, 14, -22], [28, 12, -42], [18, 10, -58], [9, 7, -70]];
    const sw = b.phase >= 3 ? '#f28aa8' : '#f7a7c7';
    for (const [rx, ry, oy] of tiers) { oval(ctx, hx, hy + oy - 4, rx, ry, sw); ctx.fillStyle = 'rgba(255,240,246,0.7)'; ctx.beginPath(); ctx.ellipse(hx + LS * rx * 0.3, hy + oy - 8, rx * 0.35, ry * 0.3, 0, 0, 7); ctx.fill(); }
    ball(ctx, hx + 2, hy - 80, 5, sw);
    // sprinkles
    const cols = ['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88', '#ff8ae0'];
    for (let i = 0; i < 18; i++) { const a = i * 2.4; const rr = 10 + (i % 5) * 7; ctx.save(); ctx.translate(hx + Math.cos(a) * rr, hy - 20 - (i % 4) * 14 + Math.sin(a) * 4); ctx.rotate(a); ctx.fillStyle = cols[i % 5]; ctx.fillRect(-3, -1, 6, 2.5); ctx.restore(); }
    // face on the swirl (second tier)
    const fx = hx + 6, fy = hy - 26;
    if (b.pose === 'stagger' || b.pose === 'dead') dizzyEyes(ctx, fx, fy, 11);
    else {
      D.ellipse(ctx, fx - 11, fy, 7, 6, '#fff', OUT); D.ellipse(ctx, fx + 11, fy, 7, 6, '#fff', OUT);
      const px = b.pose === 'hurt' ? -2 : 2;
      D.circle(ctx, fx - 11 + px, fy, 3.2, b.phase >= 3 ? '#e02020' : OUT); D.circle(ctx, fx + 11 + px, fy, 3.2, b.phase >= 3 ? '#e02020' : OUT);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx - 19, fy - 9); ctx.lineTo(fx - 4, fy - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 4, fy - 5); ctx.lineTo(fx + 19, fy - 9); ctx.stroke();
    }
    // mouth
    D.rrect(ctx, fx - 14, fy + 8, 28, b.pose === 'slamWind' || b.pose === 'rainWind' ? 16 : 10, 4); ctx.fillStyle = '#5a0a1a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(fx - 12 + i * 6.5, fy + 9, 5, 4);
    // strawberry crown
    D.ellipse(ctx, hx - 20, hy - 46, 7, 8, '#e82a3a', OUT); D.ellipse(ctx, hx - 20, hy - 53, 5, 2.5, '#3a9b2a', OUT);
    D.circle(ctx, hx + 20, hy - 50, 5, '#4040c0', OUT);
    // armor shine
    if (b.armor > 0) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6);
      for (const [rx, ry, oy] of tiers) { ctx.beginPath(); ctx.ellipse(hx, hy + oy - 4, rx + 3, ry + 3, 0, 0, 7); ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
      // ice crystals
      ctx.fillStyle = 'rgba(200,240,255,0.9)';
      for (let i = 0; i < 6; i++) { const a = t * 2 + i; ctx.fillRect(hx + Math.cos(a) * 40, hy - 40 + Math.sin(a * 1.3) * 30, 3, 3); }
    }
    // front arm + spoon
    limb2(ctx, 30 + lean * 0.6, shoulderY, fe.x, fe.y + cy, fh.x, fh.y + cy, 14, '#e8d8b8', '#fff', 12);
    ctx.save(); ctx.translate(fh.x, fh.y + cy); ctx.rotate(spoonAng);
    D.fillRRect(ctx, -4, -60, 8, 62, 3, rich() ? chrome(ctx, -60, 2) : '#c8ccd8', OUT);
    oval(ctx, 0, -68, 14, 18, '#dfe3ee');
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-4, -72, 4, 8, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ================= PICKUPS ================= */
  function drawPickup(ctx, x, y, kind, t) {
    drawGlow(ctx, x, y - 14 + Math.sin(t * 4) * 2, 18, 0.22 + 0.08 * Math.sin(t * 5));
    ctx.save(); ctx.translate(x, y - 6 + Math.sin(t * 4) * 2);
    outlineStyle(ctx, 2);
    switch (kind) {
      case 'beans':
        D.fillRRect(ctx, -8, -20, 16, 20, 2, '#d8d8d8', OUT);
        ctx.fillStyle = '#c8322a'; ctx.fillRect(-8, -15, 16, 9);
        WL.text.draw(ctx, 'BEANS', 0, -13, { size: 4, align: 'center', color: '#fff', shadow: false });
        break;
      case 'chili':
        D.ellipse(ctx, 0, -6, 12, 6, '#7a4a22', OUT);
        ctx.beginPath(); ctx.ellipse(0, -10, 11, 5, 0, Math.PI, Math.PI * 2); ctx.fillStyle = '#b8281e'; ctx.fill(); ctx.stroke();
        D.circle(ctx, -4, -12, 2, '#7a1010'); D.circle(ctx, 4, -11, 2, '#7a1010');
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -16); ctx.quadraticCurveTo(i * 5 + 2, -20, i * 5, -24 - Math.sin(t * 5 + i) * 2); ctx.stroke(); }
        break;
      case 'leftovers':
        D.ellipse(ctx, 0, -4, 14, 5, '#f0f0f0', OUT);
        D.ellipse(ctx, -3, -8, 6, 4, '#c8843a', OUT); D.ellipse(ctx, 5, -9, 5, 4, '#e8c060', OUT); D.ellipse(ctx, 0, -12, 5, 3, '#a05a2a', OUT);
        break;
      case 'burger':
        D.ellipse(ctx, 0, -14, 11, 5, '#e0a050', OUT);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-10, -12, 20, 4); ctx.fillStyle = '#f0c030'; ctx.fillRect(-11, -9, 22, 2); ctx.fillStyle = '#4ac040'; ctx.fillRect(-11, -8, 22, 2);
        D.fillRRect(ctx, -11, -6, 22, 5, 2, '#e0a050', OUT);
        ctx.fillStyle = '#fff'; ctx.fillRect(-4, -16, 1.5, 1.5); ctx.fillRect(2, -15, 1.5, 1.5);
        break;
      case 'turkey':
        ctx.save(); ctx.rotate(-0.5);
        D.ellipse(ctx, 0, -12, 11, 8, '#c8762a', OUT);
        D.fillRRect(ctx, 6, -14, 14, 5, 2, '#f0e8d8', OUT); D.circle(ctx, 20, -12, 3.5, '#f0e8d8', OUT);
        ctx.restore();
        break;
      case 'chip':
        D.circle(ctx, 0, -8, 9, '#c8322a', OUT); D.circle(ctx, 0, -8, 5, '#f0e0a0', OUT);
        WL.text.draw(ctx, '$', 0, -11, { size: 6, align: 'center', color: '#5a1010', shadow: false });
        break;
      case 'toolbox':
        tool(ctx, 'toolbox', 0, -7, 0);
        break;
      case 'coffee':
        D.fillRRect(ctx, -6, -16, 12, 14, 2, '#f0f0f0', OUT); ctx.fillStyle = '#4a2a10'; ctx.fillRect(-5, -15, 10, 3);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(8, -9, 4, -1.4, 1.4); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /* ================= BREAKABLE OBJECTS ================= */
  function drawObject(ctx, x, y, kind, hp, t) {
    ctx.save(); ctx.translate(x, y);
    outlineStyle(ctx, 2);
    LS = WL.light.side;
    const dmg = hp <= 1;
    const hi = rich();
    switch (kind) {
      case 'cart': // buffet cart with chafing dishes
        D.fillRRect(ctx, -26, -34, 52, 30, 3, hi ? chrome(ctx, -34, -4) : '#d0d4dc', OUT);
        ctx.fillStyle = '#8a8f9a'; ctx.fillRect(-26, -22, 52, 3);
        D.circle(ctx, -18, -2, 4, '#333', OUT); D.circle(ctx, 18, -2, 4, '#333', OUT);
        D.ellipse(ctx, -12, -36, 10, 4, '#e8eaf0', OUT); D.ellipse(ctx, 12, -36, 10, 4, '#e8eaf0', OUT);
        ctx.beginPath(); ctx.ellipse(-12, -40, 8, 5, 0, Math.PI, 0); ctx.fillStyle = hi ? chrome(ctx, -45, -40) : '#b8bcc8'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(12, -40, 8, 5, 0, Math.PI, 0); ctx.fillStyle = hi ? chrome(ctx, -45, -40) : '#b8bcc8'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c8322a'; ctx.fillRect(-24, -32, 48, 8);
        WL.text.draw(ctx, 'BUFFET', 0, -31, { size: 5, align: 'center', color: '#fff', shadow: false });
        break;
      case 'crate':
        D.fillRRect(ctx, -18, -34, 36, 34, 2, hi ? enamel(ctx, -34, 0, '#b07a3a') : '#b07a3a', OUT);
        if (hi) volume(ctx, 0, 18, 0.8);
        ctx.strokeStyle = '#6a4218'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(18, 0); ctx.moveTo(18, -34); ctx.lineTo(-18, 0); ctx.stroke();
        ctx.strokeStyle = OUT; ctx.strokeRect(-18, -34, 36, 34);
        WL.text.draw(ctx, 'NCL', 0, -20, { size: 5, align: 'center', color: '#3a2a10', shadow: false });
        break;
      case 'cooler':
        D.fillRRect(ctx, -20, -28, 40, 28, 3, hi ? enamel(ctx, -28, 0, '#3a78c8') : '#3a78c8', OUT);
        if (hi) volume(ctx, 0, 20, 0.8);
        D.fillRRect(ctx, -21, -32, 42, 8, 3, hi ? enamel(ctx, -32, -24, '#f0f0f0') : '#f0f0f0', OUT);
        ctx.fillStyle = '#204a88'; ctx.fillRect(-16, -20, 32, 3);
        break;
      case 'barrel':
        D.fillRRect(ctx, -14, -38, 28, 38, 5, '#4a8a3a', OUT);
        if (hi) volume(ctx, 0, 14, 1.1);
        ctx.fillStyle = '#2a5a20'; ctx.fillRect(-14, -30, 28, 3); ctx.fillRect(-14, -12, 28, 3);
        WL.text.draw(ctx, 'R-410A', 0, -24, { size: 4, align: 'center', color: '#dfffd0', shadow: false });
        break;
      case 'vending':
        D.fillRRect(ctx, -22, -70, 44, 70, 3, '#2a8a5a', OUT);
        if (hi) volume(ctx, 0, 22, 0.9);
        D.fillRRect(ctx, -17, -64, 26, 40, 2, '#0a1a2a', OUT);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = ['#d33', '#3d3', '#dd3'][(i + j) % 3]; ctx.fillRect(-14 + j * 8, -60 + i * 12, 6, 9); }
        D.fillRRect(ctx, 11, -64, 8, 40, 1, '#1a5a3a', OUT);
        ctx.fillStyle = '#000'; ctx.fillRect(-16, -18, 32, 10);
        WL.text.draw(ctx, 'JUICE', 0, -69, { size: 5, align: 'center', color: '#fff', shadow: false });
        break;
      case 'plant':
        D.fillRRect(ctx, -12, -20, 24, 20, 3, '#a05a2a', OUT);
        for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -20); ctx.rotate(-1 + i * 0.5); D.ellipse(ctx, 0, -16, 5, 16, '#3a9a3a', OUT); ctx.restore(); }
        break;
      case 'plates': // Stack of ceramic buffet plates with gold rim
        D.ellipse(ctx, 0, -2, 16, 5, '#1e2430', OUT); // stand base
        D.fillRRect(ctx, -2, -26, 4, 24, 1, '#94a0b4', OUT); // chrome rod holder
        for (let p = 0; p < 6; p++) {
          const py = -6 - p * 3.5;
          D.ellipse(ctx, 0, py, 15, 4.5, '#ffffff', '#222');
          ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(0, py, 13.5, 3.8, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(-6, py - 1, 12, 1);
        }
        break;
      case 'tray': // Buffet chafing dish with stainless steel dome lid & burner
        D.fillRRect(ctx, -18, -8, 36, 8, 2, '#485060', OUT);
        ctx.fillStyle = Math.sin(t * 12) > 0 ? '#ff8c1a' : '#3399ff';
        D.ellipse(ctx, 0, -5, 5, 3, ctx.fillStyle);
        D.fillRRect(ctx, -24, -20, 48, 14, 3, '#cdd3de', OUT);
        ctx.fillStyle = '#8f98a8'; ctx.fillRect(-24, -13, 48, 2);
        ctx.beginPath(); ctx.arc(0, -18, 18, Math.PI, 0); ctx.closePath();
        ctx.fillStyle = hi ? chrome(ctx, -36, -18) : '#e4e8f0'; ctx.fill(); if (hi) volume(ctx, 0, 18, 0.7); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        D.fillRRect(ctx, -6, -38, 12, 4, 1, '#d4af37', OUT);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(0, -18, 14, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
        break;
      case 'chair': // Cruise ship dining chair (mahogany with burgundy velvet cushion)
        ctx.fillStyle = '#4a2612'; ctx.fillRect(-10, -22, 3, 22); ctx.fillRect(7, -22, 3, 22);
        D.fillRRect(ctx, -13, -16, 26, 8, 3, '#881b24', OUT);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(-12, -16, 24, 1.5);
        ctx.fillStyle = '#6a3818'; ctx.fillRect(-12, -9, 3.5, 9); ctx.fillRect(8.5, -9, 3.5, 9);
        D.fillRRect(ctx, -10, -42, 20, 24, 3, '#5c2f15', OUT);
        D.fillRRect(ctx, -7, -39, 14, 18, 2, '#881b24', '#3c1014');
        break;
    }
    if (dmg) { ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(0, -18); ctx.lineTo(-4, -8); ctx.stroke(); }
    ctx.restore();
  }

  /* ================= PROJECTILES / FX ================= */
  function drawProjectile(ctx, x, y, p) {
    ctx.save(); ctx.translate(x, y);
    outlineStyle(ctx, 2);
    switch (p.kind) {
      case 'shuriken':
        ctx.rotate(p.t * 18);
        ctx.fillStyle = '#f08a1e';
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -4); ctx.lineTo(0, -12); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        D.circle(ctx, 0, 0, 2.5, '#3f9b2f', OUT);
        break;
      case 'sprinkle':
        ctx.rotate(p.t * 10);
        D.fillRRect(ctx, -6, -2.5, 12, 5, 2.5, p.color || '#ff4a4a', OUT);
        break;
      case 'toolbox':
        // Weighty motion blur ghost trail
        const tvx = p.vx || 320;
        const trailDir = Math.sign(tvx) || 1;
        ctx.save();
        for (let t = 1; t <= 3; t++) {
          ctx.save();
          ctx.translate(-trailDir * t * 14, t * 4);
          ctx.rotate((p.t - t * 0.03) * 12);
          ctx.globalAlpha = 0.35 - t * 0.1;
          tool(ctx, 'toolbox', 0, 0, 0);
          ctx.restore();
        }
        ctx.restore();
        ctx.rotate(p.t * 12);
        tool(ctx, 'toolbox', 0, 0, 0);
        break;
      case 'bigsprinkle':
        ctx.rotate(p.rot || 0);
        D.fillRRect(ctx, -12, -5, 24, 10, 5, p.color || '#ff4a4a', OUT);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-8, -3, 10, 2);
        break;
      case 'spoon':
        ctx.rotate(p.t * 8);
        D.fillRRect(ctx, -2, -12, 4, 20, 1, '#d8d8e0', OUT); D.ellipse(ctx, 0, -15, 5, 6, '#e8e8f0', OUT);
        break;
    }
    ctx.restore();
  }

  function drawSprayCone(ctx, x, y, facing, t, len) {
    ctx.save(); ctx.translate(x, y); if (facing < 0) ctx.scale(-1, 1);
    const L = len || 95;
    // Layered swirling refrigerant vapor vortex
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(210,250,255,0.95)');
    g.addColorStop(0.4, 'rgba(120,230,255,0.65)');
    g.addColorStop(1, 'rgba(80,190,255,0)');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -28); ctx.lineTo(L + 12, 0); ctx.lineTo(L, 28); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    // Swirling ice vortex arc streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const swX = (t * 180 + s * 30) % L;
      const swR = 8 + swX * 0.22;
      ctx.beginPath();
      ctx.arc(swX, 0, swR, -Math.PI * 0.6 + s, Math.PI * 0.6 + s);
      ctx.stroke();
    }

    // Ice crystal flakes
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const fx = ((t * 280 + i * 31) % L);
      const fy = Math.sin(i * 2.3 + t * 24) * fx * 0.28;
      ctx.fillRect(fx, fy - 1.5, 3, 3);
    }
    ctx.restore();
  }

  let glowCanvas = null;
  function glowSprite() {
    if (glowCanvas) return glowCanvas;
    glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 96;
    const g = glowCanvas.getContext('2d');
    const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, 'rgba(255,248,200,0.95)');
    gr.addColorStop(0.42, 'rgba(255,170,60,0.45)'); gr.addColorStop(0.7, 'rgba(255,90,20,0.12)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    return glowCanvas;
  }
  /** Additive glow, for sparks, muzzle flashes and pickups. r in world px. */
  function drawGlow(ctx, x, y, r, alpha) {
    if (!rich() || alpha <= 0) return;
    const op = ctx.globalCompositeOperation, a0 = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * Math.min(1, alpha);
    ctx.drawImage(glowSprite(), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = a0;
  }

  /* Debris atlas: food chaos and kitchenware, one cached bitmap per shape+color. */
  const debrisCache = new Map();
  const DEBRIS_SIZE = 16;
  function paintDebris(g, shape, color) {
    const c = DEBRIS_SIZE / 2;
    g.translate(c, c);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const prevLS = LS; LS = 1;
    switch (shape) {
      case 'floret':
        g.fillStyle = '#b9d98a'; g.fillRect(-1.5, 0, 3, 6); g.strokeStyle = OUT; g.lineWidth = 0.8; g.strokeRect(-1.5, 0, 3, 6);
        ball(g, -3, -1, 3.4, color); ball(g, 3, -1, 3.4, color); ball(g, 0, -4, 3.8, color);
        break;
      case 'leaf':
        g.beginPath(); g.moveTo(-7, 2); g.quadraticCurveTo(-2, -7, 7, -3); g.quadraticCurveTo(2, 6, -7, 2); g.closePath();
        g.fillStyle = color; g.fill(); volume(g, 0, 7, 0.8); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke();
        g.strokeStyle = 'rgba(230,255,190,0.8)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6, 1.5); g.quadraticCurveTo(0, -1, 6, -2.5); g.stroke();
        break;
      case 'tomato':
        g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fillStyle = '#d8281e'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke();
        g.beginPath(); g.arc(0, 0, 4.2, 0, 7); g.fillStyle = '#f0503a'; g.fill();
        g.fillStyle = '#ffd07a'; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.ellipse(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.9, 0.5, a, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-3, -3.5, 2.5, 1);
        break;
      case 'coin':
        ball(g, 0, 0, 5, '#f08a1e'); g.strokeStyle = '#c05e0a'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 2.6, 0, 7); g.stroke();
        break;
      case 'shard':
        g.beginPath(); g.moveTo(-6, 4); g.lineTo(5, -5); g.lineTo(6, 2); g.closePath();
        g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#6a7080'; g.lineWidth = 0.7; g.stroke();
        g.strokeStyle = '#d4af37'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(5, -5); g.lineTo(6, 2); g.stroke();
        break;
      case 'fork':
        g.rotate(-0.6);
        g.fillStyle = chrome(g, -1, 1); g.fillRect(-7, -0.8, 9, 1.6);
        g.fillRect(2, -2.4, 1.6, 4.8);
        for (let i = 0; i < 3; i++) g.fillRect(3.4, -2.2 + i * 1.8, 4, 0.8);
        break;
      case 'spoon':
        g.rotate(0.5);
        g.fillStyle = chrome(g, -1, 1); g.fillRect(-7, -0.7, 8, 1.4);
        g.beginPath(); g.ellipse(4, 0, 3.4, 2.3, 0, 0, 7); g.fillStyle = chrome(g, -2.3, 2.3); g.fill(); g.strokeStyle = '#5d6472'; g.lineWidth = 0.5; g.stroke();
        break;
      case 'splinter':
        g.rotate(0.3);
        g.fillStyle = color; g.beginPath(); g.moveTo(-7, -1.2); g.lineTo(6, -2); g.lineTo(7, 0); g.lineTo(-6, 2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.5; g.stroke();
        break;
      default:
        ball(g, 0, 0, 4.5, color);
    }
    LS = prevLS;
  }
  function debrisSprite(shape, color) {
    const key = shape + color;
    let e = debrisCache.get(key);
    const s = WL.gfx.scale(4);
    if (!e || e.s !== s) {
      e = WL.gfx.layer('debris-' + key, DEBRIS_SIZE, DEBRIS_SIZE, 4, g => paintDebris(g, shape, color));
      debrisCache.set(key, e);
    }
    return e;
  }
  function drawDebris(ctx, x, y, shape, color, r, rot) {
    const e = debrisSprite(shape, color);
    const sz = r * 2.8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.drawImage(e.c, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }

  function drawHitSpark(ctx, x, y, t, big) {
    ctx.save(); ctx.translate(x, y);
    if (rich()) {
      const k = Math.min(1, t / 0.22);
      drawGlow(ctx, 0, 0, (big ? 50 : 30) * (0.7 + k * 0.8), (1 - k) * (big ? 1 : 0.8));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, 1 - k * 1.05);
      ctx.lineCap = 'round';
      const n = big ? 12 : 8, seed = (x * 0.37 + y * 0.11) % 6.28;
      for (let i = 0; i < n; i++) {
        const a = seed + i * (Math.PI * 2 / n) + (i % 3) * 0.13;
        const r0 = 5 + k * 12, r1 = ((i % 2) ? 18 : 32) * (big ? 1.5 : 1) * (0.55 + k * 0.7);
        ctx.strokeStyle = i % 2 ? '#ffb040' : '#fff6d0';
        ctx.lineWidth = ((i % 2) ? 1.4 : 2.6) * (1 - k * 0.6);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const s = (big ? 1.7 : 1.1) * (1 + t * 2.5);
    ctx.scale(s, s); ctx.rotate(t * 4);
    ctx.fillStyle = big ? '#ffe14a' : '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5 / s;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r = i % 2 ? 4 : 12; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Inner brilliant core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a + 0.4) * 2, Math.sin(a + 0.4) * 2); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDust(ctx, x, y, t, r) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 2);
    D.circle(ctx, x, y, (r || 6) * (1 + t * 3), 'rgba(220,210,190,0.7)');
    ctx.restore();
  }

  /* Volcano Fart — shock rings (strokes, not full-screen fills) plus a dirty core. */
  function drawFartCloud(ctx, x, y, t, facing) {
    ctx.save();
    const T = Math.min(1, t / 1.05);
    // Expanding green/gold energy shock rings
    for (let i = 0; i < 4; i++) {
      const lt = t - i * 0.05;
      if (lt <= 0) continue;
      const R = 28 + lt * 540;
      ctx.globalAlpha = Math.max(0, 0.95 - lt * 0.75);
      ctx.strokeStyle = i === 0 ? '#ffffff' : (i === 1 ? '#c6ff4a' : (i === 2 ? '#ffea4a' : '#5f8f22'));
      ctx.lineWidth = Math.max(2, 14 - lt * 9);
      ctx.beginPath();
      ctx.ellipse(x, y - 16, R, R * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Radiant burst rays
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.75 - t * 1.2);
    ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4 + t * 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * 20, y - 24 + Math.sin(ang) * 12);
      ctx.lineTo(x + Math.cos(ang) * (60 + t * 120), y - 24 + Math.sin(ang) * (36 + t * 70));
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = Math.max(0, 0.9 - t * 1.5);
    D.circle(ctx, x - (facing || 1) * 8, y - 26, 18 + t * 40, '#e8ff9a');
    ctx.globalAlpha = Math.max(0, 0.6 - t * 0.7);
    D.circle(ctx, x - (facing || 1) * 14, y - 18, 12 + t * 24, '#c8a15a');
    for (let i = 0; i < 18; i++) {
      const a = i * 0.85 + t * 2.2, d = 16 + (i % 5) * 14 + T * 250;
      const px = x + Math.cos(a) * d, py = y - 28 + Math.sin(a) * d * 0.32 - T * 30;
      ctx.globalAlpha = Math.max(0, 0.8 - T);
      D.circle(ctx, px, py, 6 + (i % 4) * 3, i % 3 === 0 ? '#6b4a2a' : (i % 3 === 1 ? '#8bd04a' : '#d8ff8a'));
    }
    ctx.restore();
  }

  function drawSlash(ctx, x, y, facing, pose, u) {
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.globalAlpha = Math.max(0, 1 - u) * 0.95;
    const heavy = pose === 'sweep';
    const mid = pose === 'smash';
    const jab = pose === 'jab';
    const kick = pose === 'jumpkick';

    if (pose === 'pop') {
      // Wrench Pop: a vertical crescent rising in front of Lance.
      const r = 34, a = Math.PI * 0.55 - u * Math.PI * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(22, 10, r, a, a + 0.9);
      ctx.strokeStyle = 'rgba(120,220,255,0.4)'; ctx.lineWidth = 14; ctx.stroke();
      ctx.beginPath();
      ctx.arc(22, 10, r, a + 0.1, a + 0.8);
      ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath();
      ctx.arc(22, 10, r, a + 0.2, a + 0.7);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      return;
    }
    if (jab) {
      // Screwdriver rapid precision thrust streak: multi-line neon cyan/white speed lines
      const len = 42 + u * 28;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#5de6ff';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(10 + len, 0);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(10 + len + 6, 0);
      ctx.moveTo(12, -7); ctx.lineTo(12 + len * 0.75, -7);
      ctx.moveTo(12, 7); ctx.lineTo(12 + len * 0.75, 7);
      ctx.stroke();
    } else if (kick) {
      // Jumpkick horizontal heavy impact wake
      const len = 48;
      ctx.fillStyle = 'rgba(255,220,100,0.45)';
      ctx.beginPath();
      ctx.moveTo(6, -14); ctx.lineTo(6 + len, 0); ctx.lineTo(6, 14);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(16, -5); ctx.lineTo(16 + len, -5);
      ctx.moveTo(12, 5); ctx.lineTo(12 + len, 5);
      ctx.stroke();
    } else {
      // Slash arc (smash or sweep)
      const a0 = heavy ? -0.35 : -1.25;
      const sweep = heavy ? 1.55 : 1.45;
      const a = a0 + sweep * u;
      const r = heavy ? 56 : 40;
      const width = heavy ? 14 : 9;

      // Outer wide soft glow arc
      ctx.beginPath();
      ctx.arc(14, 0, r, a - 0.95, a + 0.15);
      ctx.strokeStyle = heavy ? 'rgba(255,100,20,0.35)' : 'rgba(255,210,60,0.3)';
      ctx.lineWidth = width + 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Main vibrant energy crescent ribbon
      ctx.beginPath();
      ctx.arc(14, 0, r + width * 0.5, a - 0.85, a + 0.15, false);
      ctx.arc(14, 0, r - width * 0.5, a + 0.15, a - 0.85, true);
      ctx.closePath();
      const slashGrad = ctx.createRadialGradient(14, 0, r - width, 14, 0, r + width);
      if (heavy) {
        slashGrad.addColorStop(0, 'rgba(255,60,10,0)');
        slashGrad.addColorStop(0.5, '#ffaa00');
        slashGrad.addColorStop(1, '#ffffff');
      } else {
        slashGrad.addColorStop(0, 'rgba(255,180,30,0)');
        slashGrad.addColorStop(0.5, '#ffe14a');
        slashGrad.addColorStop(1, '#ffffff');
      }
      ctx.fillStyle = slashGrad;
      ctx.fill();

      // Brilliant sharp white core streak
      ctx.beginPath();
      ctx.arc(14, 0, r, a - 0.65, a + 0.12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = heavy ? 4 : 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Trailing sparks off the blade tip
      if (heavy) {
        const tipX = 14 + Math.cos(a + 0.1) * r;
        const tipY = Math.sin(a + 0.1) * r;
        ctx.fillStyle = '#fffae0';
        ctx.fillRect(tipX - 1.5, tipY - 1.5, 3, 3);
        ctx.fillStyle = '#ff7711';
        ctx.fillRect(tipX - Math.cos(a) * 6, tipY - Math.sin(a) * 6, 2.5, 2.5);
      }
    }
    ctx.restore();
  }

  function drawPuddle(ctx, x, y, r, t) {
    ctx.save(); ctx.globalAlpha = 0.8;
    D.ellipse(ctx, x, y, r, r * 0.35, '#f7a7c7', OUT);
    D.ellipse(ctx, x - r * 0.3, y - 2, r * 0.3, r * 0.1, '#fbd6e4');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88'][i]; ctx.fillRect(x - r * 0.5 + i * r * 0.3, y - 2 + Math.sin(t + i) * 2, 4, 2); }
    ctx.restore();
  }

  return { drawLance, lanceHead, drawLanceBust, drawEnemy, drawBoss, drawPickup, drawObject, drawProjectile, drawSprayCone, drawHitSpark, drawDust, drawFartCloud, drawSlash, drawPuddle, tool, VEG, OUT, tint, hibiscus, drawGlow, drawDebris, ball, volume, setLight(side) { LS = side; } };
})();
