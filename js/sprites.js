/* Procedural arcade sprites. Everything is drawn with canvas primitives so the
   game has zero binary sprite dependencies; Lance's head uses the photo-derived
   portrait when available. All draw functions take the FEET position as origin
   and draw facing +x; callers flip with ctx.scale(-1,1) for facing left. */
'use strict';

WL.sprites = (function () {
  const D = WL.draw;
  const OUT = '#141428'; // outline color

  function outlineStyle(ctx, w) { ctx.strokeStyle = OUT; ctx.lineWidth = w || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

  /* Thick limb: line from (x1,y1) to (x2,y2) with an outline and fill */
  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
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
    ctx.lineWidth = 2;
    if (endColor) D.circle(ctx, x2, y2, endR || w * 0.75, endColor, OUT);
  }

  function angryEyes(ctx, x, y, spread, size, color) {
    // furrowed brow eyes
    color = color || '#fff';
    D.ellipse(ctx, x - spread, y, size, size * 0.8, color, OUT);
    D.ellipse(ctx, x + spread, y, size, size * 0.8, color, OUT);
    D.circle(ctx, x - spread + 1, y, size * 0.45, OUT);
    D.circle(ctx, x + spread + 1, y, size * 0.45, OUT);
    ctx.lineWidth = 2; ctx.strokeStyle = OUT;
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
    shorts: '#5c6169', shortsDark: '#454a52',
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
    ctx.fillStyle = LANCE.skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
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
    ctx.strokeStyle = LANCE.hair; ctx.lineWidth = 0.055;
    const browLift = mood === 'hurt' ? -0.04 : mood === 'strain' ? 0.03 : 0;
    ctx.beginPath(); ctx.moveTo(-0.30, -0.14 + browLift); ctx.quadraticCurveTo(-0.18, -0.20, -0.07, -0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.07, -0.15); ctx.quadraticCurveTo(0.18, -0.20, 0.30, -0.14 + browLift); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.012;
    ctx.beginPath(); ctx.moveTo(-0.30, -0.115 + browLift); ctx.quadraticCurveTo(-0.18, -0.17, -0.07, -0.125); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.07, -0.125); ctx.quadraticCurveTo(0.18, -0.17, 0.30, -0.115 + browLift); ctx.stroke();
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
    else { ctx.beginPath(); ctx.moveTo(-0.10, 0.33); ctx.quadraticCurveTo(0, 0.37, 0.10, 0.33); ctx.stroke(); }
    // the mustache: big, white, full
    ctx.fillStyle = LANCE.hair; ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0.20);
    ctx.bezierCurveTo(0.10, 0.16, 0.24, 0.17, 0.29, 0.25);
    ctx.bezierCurveTo(0.26, 0.31, 0.14, 0.32, 0, 0.27);
    ctx.bezierCurveTo(-0.14, 0.32, -0.26, 0.31, -0.29, 0.25);
    ctx.bezierCurveTo(-0.24, 0.17, -0.10, 0.16, 0, 0.20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = LANCE.hairShade; ctx.lineWidth = 0.012;
    for (let i = -2; i <= 2; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(i * 0.06, 0.20); ctx.lineTo(i * 0.09, 0.28); ctx.stroke(); }
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
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n);
      const px = cx + Math.cos(a) * rx * -1, py = cy + Math.sin(a) * ry;
      const c = i % 3 === 1 ? LANCE.leiB : (i % 3 === 2 ? LANCE.leiC : LANCE.leiA);
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, r * 0.35); ctx.stroke();
      if (i % 3 === 1) { ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(px, py, r * 0.3, 0, 7); ctx.fill(); }
    }
  }

  function tool(ctx, kind, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    outlineStyle(ctx, 2);
    if (kind === 'screwdriver') {
      D.fillRRect(ctx, -6, -3, 12, 6, 2, '#e8c000', OUT);
      D.fillRRect(ctx, 6, -1.5, 16, 3, 1, '#b8bcc8', OUT);
    } else if (kind === 'wrench') {
      D.fillRRect(ctx, -4, -3, 26, 6, 3, '#a8b0c0', OUT);
      ctx.beginPath(); ctx.arc(24, 0, 8, 0.6, Math.PI * 2 - 0.6); ctx.closePath(); ctx.fillStyle = '#a8b0c0'; ctx.fill(); ctx.stroke();
    } else if (kind === 'pipewrench') {
      D.fillRRect(ctx, -6, -4, 34, 8, 3, '#c8322a', OUT);
      D.fillRRect(ctx, 24, -12, 10, 20, 2, '#8a9098', OUT);
      D.fillRRect(ctx, 20, -12, 8, 6, 1, '#8a9098', OUT);
    } else if (kind === 'canister') {
      D.fillRRect(ctx, -5, -8, 10, 16, 2, '#3fc0e8', OUT);
      ctx.fillStyle = '#fff'; ctx.fillRect(-4, -4, 8, 6);
      D.fillRRect(ctx, -2, -12, 4, 5, 1, '#888', OUT);
    } else if (kind === 'toolbox') {
      D.fillRRect(ctx, -10, -7, 20, 14, 2, '#c8322a', OUT);
      ctx.fillStyle = '#7a1c16'; ctx.fillRect(-10, -1, 20, 2);
      D.fillRRect(ctx, -4, -10, 8, 4, 1, '#333', OUT);
    } else if (kind === 'tape') {
      D.circle(ctx, 0, 0, 7, '#999', OUT); D.circle(ctx, 0, 0, 3, '#444', OUT);
    }
    ctx.restore();
  }

  /**
   * drawLance(ctx, x, y, o)
   * o.pose: idle|walk|jab|smash|smashWind|sweep|spray|throw|grab|grabHit|jump|jumpkick|hurt|down|fart|fartCharge|victory|dead|carry
   * o.t: animation time (seconds), o.flash: white flash, o.thin: slim ending version, o.alpha
   */
  function drawLance(ctx, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const pose = o.pose || 'idle';
    const thin = !!o.thin;
    ctx.save();
    ctx.translate(x, y);
    if (o.facing < 0) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    const bob = (pose === 'idle') ? Math.sin(t * 4) * 1.2 : (pose === 'walk' ? Math.abs(Math.sin(t * 10)) * -2 : 0);
    let lean = 0; // torso lean forward (px at shoulders)
    let crouch = 0;
    const bodyW = thin ? 26 : 46;   // torso width
    const bellyR = thin ? 2 : 24;
    const hipY = -34;
    const shoulderY = -70;
    const headY = -92;

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

    if (o.flash) { ctx.filter = 'brightness(3)'; }

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
    const mood = o.mood || (['hurt', 'down', 'dead'].includes(o.pose) ? 'hurt' : (o.pose === 'fart' || o.pose === 'fartCharge') ? 'strain' : (o.pose === 'victory' ? 'grin' : 'neutral'));
    // back arm first (behind body): short red sleeve, bare tan forearm
    limb2(ctx, bh.x + lean * 0.5, bh.y + cy + bob, be.x, be.y + cy + bob, bh2.x, bh2.y + cy + bob, armW, LANCE.shirt, skin, 6, skin);
    // legs: gray cargo shorts on the thigh, bare calves
    const hipL = { x: -8 + lean * 0.2, y: hipY + cy + bob }, hipR = { x: 8 + lean * 0.2, y: hipY + cy + bob };
    const legW = thin ? 9 : 11;
    limb2(ctx, hipL.x, hipL.y, (hipL.x + lf.x) / 2 - 2, (hipL.y + lf.y) / 2, lf.x, lf.y - 3, legW, LANCE.shorts, null, 0, skin);
    limb2(ctx, hipR.x, hipR.y, (hipR.x + rf.x) / 2 + 2, (hipR.y + rf.y) / 2, rf.x, rf.y - 3, legW, LANCE.shorts, null, 0, skin);
    // sneakers: black with white sole
    for (const f of [lf, rf]) {
      D.fillRRect(ctx, f.x - 7, f.y - 8, 17, 9, 3, LANCE.boot, OUT);
      ctx.fillStyle = LANCE.sole; ctx.fillRect(f.x - 6, f.y - 2, 15, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 2, f.y - 7, 3, 1.5);
    }
    // torso: untucked red polo over a big round belly
    const torsoTop = shoulderY + cy + bob;
    const torsoBot = hipY + 8 + cy + bob;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2 + 6 + lean * 0.6, torsoTop);
    ctx.lineTo(bodyW / 2 - 6 + lean * 0.6, torsoTop);
    ctx.quadraticCurveTo(bodyW / 2 + bellyR * 0.7 + lean, (torsoTop + torsoBot) / 2 + 8, bodyW / 2 - 2 + lean * 0.2, torsoBot);
    ctx.lineTo(-bodyW / 2 + 2 + lean * 0.2, torsoBot);
    ctx.quadraticCurveTo(-bodyW / 2 - bellyR * 0.25 + lean * 0.4, (torsoTop + torsoBot) / 2 + 8, -bodyW / 2 + 6 + lean * 0.6, torsoTop);
    ctx.closePath();
    ctx.fillStyle = LANCE.shirt; ctx.fill(); outlineStyle(ctx, 2); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(-bodyW / 2 - 12, torsoTop, bodyW * 0.33, torsoBot - torsoTop);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(bodyW * 0.18 + lean * 0.6, (torsoTop + torsoBot) / 2 + 8, bodyW * 0.3, 13, 0, 0, Math.PI * 2); ctx.fill();
    // shorts waistband peeking under the untucked hem
    ctx.fillStyle = LANCE.shortsDark; ctx.fillRect(-bodyW / 2, torsoBot - 3, bodyW + 10, 3);
    ctx.restore();
    // polo collar + placket with buttons
    const cx0 = lean * 0.6;
    ctx.fillStyle = LANCE.shirtLight; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx0 - 9, torsoTop - 1); ctx.lineTo(cx0, torsoTop + 9); ctx.lineTo(cx0 - 5, torsoTop - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx0 + 9, torsoTop - 1); ctx.lineTo(cx0, torsoTop + 9); ctx.lineTo(cx0 + 5, torsoTop - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LANCE.shirtDark; ctx.fillRect(cx0 - 1, torsoTop + 8, 2, 8);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx0 - 1, torsoTop + 10, 2, 1.5); ctx.fillRect(cx0 - 1, torsoTop + 14, 2, 1.5);
    // Whale Lance name patch on the chest
    ctx.save(); ctx.translate(-bodyW * 0.24 + lean * 0.6, torsoTop + 13);
    D.fillRRect(ctx, -6, -3, 12, 6, 1, '#f4f1ea', OUT);
    D.ellipse(ctx, -1, 0, 3, 1.6, '#2b5aa8'); ctx.beginPath(); ctx.moveTo(2, -0.5); ctx.lineTo(4.5, -2.5); ctx.lineTo(4.5, 1); ctx.closePath(); ctx.fillStyle = '#2b5aa8'; ctx.fill();
    ctx.restore();
    // mechanic's tool belt with pouches
    if (!thin) {
      ctx.fillStyle = LANCE.belt; ctx.fillRect(-bodyW / 2 + 3 + lean * 0.2, torsoBot - 7, bodyW - 6, 5);
      ctx.fillStyle = LANCE.buckle; ctx.fillRect(lean * 0.2 - 3, torsoBot - 7, 6, 5);
      D.fillRRect(ctx, -bodyW / 2 + 2 + lean * 0.2, torsoBot - 4, 9, 9, 2, LANCE.pouch, OUT);
      D.fillRRect(ctx, bodyW / 2 - 11 + lean * 0.2, torsoBot - 4, 9, 9, 2, LANCE.pouch, OUT);
      ctx.fillStyle = '#b8bcc8'; ctx.fillRect(bodyW / 2 - 8 + lean * 0.2, torsoBot - 8, 2, 5); ctx.fillStyle = '#e8c000'; ctx.fillRect(bodyW / 2 - 5 + lean * 0.2, torsoBot - 8, 2, 4);
    } else {
      ctx.fillStyle = LANCE.belt; ctx.fillRect(-bodyW / 2 + 3 + lean * 0.2, torsoBot - 6, bodyW - 6, 4);
      ctx.fillStyle = LANCE.buckle; ctx.fillRect(lean * 0.2 - 2, torsoBot - 6, 4, 4);
    }
    // neck
    ctx.fillStyle = LANCE.skinDark; ctx.fillRect(cx0 - 6 + lean * 0.3, torsoTop - 8, 12, 9);
    // lei: purple & white, hanging over the chest
    lei(ctx, cx0, torsoTop - 2, thin ? 11 : 15, thin ? 22 : 26, 2.6);
    // head
    ctx.save();
    ctx.translate(lean * 0.9, headY + cy + bob + 2);
    ctx.rotate(headTilt);
    lanceHead(ctx, 0, 0, 34, { mood, noPhoto: o.noPhoto });
    ctx.restore();
    // front arm (in front of body)
    limb2(ctx, sh.x + lean * 0.6, sh.y + cy + bob, fe.x, fe.y + cy + bob, fh.x, fh.y + cy + bob, armW, LANCE.shirt, skin, 6, skin);
    if (toolKind && toolAtFront !== false) tool(ctx, toolKind, fh.x, fh.y + cy + bob, toolAng);
    if (toolKind && toolAtFront === false) tool(ctx, toolKind, bh2.x, bh2.y + cy + bob, toolAng);
  }

  /* ================= ENEMIES ================= */
  // Palette per type
  const VEG = {
    broccoli: { body: '#4d8f2a', dark: '#2f6318', stalk: '#b9d98a', limb: '#3c7a20', glove: '#e8e8e8', boot: '#2a2a2a', h: 66 },
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
      case 'down': case 'dead': case 'thrown': r.lying = true; break;
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
      const V = VEG.broccoli, hipY = -26, shoulderY = -46;
      drawLimbs(ctx, r, V, hipY, shoulderY, 7, (cy, lean) => {
        // stalk torso
        ctx.beginPath(); ctx.moveTo(-10 + lean * 0.6, shoulderY + cy); ctx.lineTo(10 + lean * 0.6, shoulderY + cy); ctx.lineTo(9, hipY + 6 + cy); ctx.lineTo(-9, hipY + 6 + cy); ctx.closePath();
        ctx.fillStyle = V.stalk; ctx.fill(); outlineStyle(ctx, 2); ctx.stroke();
        // tank top
        ctx.fillStyle = '#222'; ctx.fillRect(-7 + lean * 0.4, shoulderY + cy + 4, 14, 14);
        // florets head
        const hx = lean * 0.9, hy = shoulderY - 14 + cy;
        const bumps = [[-14, 2, 9], [14, 2, 9], [-8, -8, 9], [8, -8, 9], [0, -12, 10], [0, 0, 11]];
        for (const [bx, by, br] of bumps) D.circle(ctx, hx + bx, hy + by, br, V.body, OUT);
        for (const [bx, by, br] of bumps) { ctx.fillStyle = V.dark; for (let i = 0; i < 4; i++) { const a = i * 1.7 + bx; ctx.beginPath(); ctx.arc(hx + bx + Math.cos(a) * br * 0.5, hy + by + Math.sin(a) * br * 0.5, 1.6, 0, 7); ctx.fill(); } }
        face(ctx, hx, hy + 2, e.pose, 3.2);
      });
    },
    sprout(ctx, e, r) {
      const V = VEG.sprout, hipY = -14, shoulderY = -26;
      if (e.pose === 'roll') {
        ctx.save(); ctx.rotate(e.t * 20);
        D.circle(ctx, 0, -14, 14, V.body, OUT);
        ctx.fillStyle = V.dark; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.26) * 8, -14 + Math.sin(i * 1.26) * 8, 3, 0, 7); ctx.fill(); }
        ctx.restore(); return;
      }
      drawLimbs(ctx, r, V, hipY, shoulderY, 5, (cy, lean) => {
        const hx = lean * 0.6, hy = shoulderY - 6 + cy;
        D.circle(ctx, hx, hy, 15, V.body, OUT);
        // leaf layers
        ctx.strokeStyle = V.dark; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hx - 4, hy - 4, 9, 2.6, 5.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(hx + 6, hy - 2, 7, 3.8, 6.0); ctx.stroke();
        face(ctx, hx, hy + 2, e.pose, 2.6);
      });
    },
    celery(ctx, e, r) {
      const V = VEG.celery, hipY = -34, shoulderY = -62;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        // tall ribbed stalk
        D.fillRRect(ctx, -9 + lean * 0.4, shoulderY - 12 + cy, 18, 52, 5, V.body, OUT);
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5 + lean * 0.4, shoulderY - 8 + cy); ctx.lineTo(i * 5 + lean * 0.3, hipY + 4 + cy); ctx.stroke(); }
        // leaves on top
        for (const [lx, ly] of [[-8, -22], [0, -28], [8, -22]]) { D.ellipse(ctx, lx + lean * 0.6, shoulderY + ly + cy, 5, 8, '#5aa83a', OUT); }
        face(ctx, lean * 0.6, shoulderY - 2 + cy, e.pose, 3);
      });
    },
    carrot(ctx, e, r) {
      const V = VEG.carrot, hipY = -26, shoulderY = -46;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        // tapered body (wide top, pointed bottom -> upside down carrot body with head on top)
        ctx.beginPath(); ctx.moveTo(-13 + lean * 0.6, shoulderY - 18 + cy); ctx.lineTo(13 + lean * 0.6, shoulderY - 18 + cy);
        ctx.quadraticCurveTo(12, hipY + cy, 0, hipY + 10 + cy); ctx.quadraticCurveTo(-12, hipY + cy, -13 + lean * 0.6, shoulderY - 18 + cy); ctx.closePath();
        ctx.fillStyle = V.body; ctx.fill(); outlineStyle(ctx, 2); ctx.stroke();
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 + lean * 0.5, shoulderY - 6 + i * 10 + cy); ctx.lineTo(6 + lean * 0.5, shoulderY - 4 + i * 10 + cy); ctx.stroke(); }
        // ninja headband
        ctx.fillStyle = V.band; ctx.fillRect(-13 + lean * 0.6, shoulderY - 12 + cy, 26, 5);
        ctx.beginPath(); ctx.moveTo(-13 + lean * 0.6, shoulderY - 10 + cy); ctx.lineTo(-24 + lean * 0.6, shoulderY - 4 + cy + Math.sin(e.t * 12) * 2); ctx.lineTo(-22 + lean * 0.6, shoulderY - 12 + cy); ctx.closePath(); ctx.fill();
        // leaf hair
        for (const [lx, ly, a] of [[-6, -24, -0.4], [0, -28, 0], [6, -24, 0.4]]) { ctx.save(); ctx.translate(lx + lean * 0.6, shoulderY + ly + cy); ctx.rotate(a); D.ellipse(ctx, 0, 0, 3, 8, V.leaf, OUT); ctx.restore(); }
        face(ctx, lean * 0.6, shoulderY - 2 + cy, e.pose, 2.8);
      });
    },
    spinach(ctx, e, r) {
      const V = VEG.spinach, hipY = -28, shoulderY = -50;
      drawLimbs(ctx, r, V, hipY, shoulderY, 9, (cy, lean) => {
        // leafy bulky torso
        ctx.beginPath(); ctx.moveTo(-18 + lean * 0.6, shoulderY - 2 + cy);
        for (let i = 0; i <= 8; i++) { const a = Math.PI + i * (Math.PI / 8); ctx.lineTo(Math.cos(a) * -20 + lean * 0.4, shoulderY + 14 + cy + Math.sin(a) * -14 + (i % 2) * 3); }
        ctx.lineTo(16, hipY + 8 + cy); ctx.lineTo(-16, hipY + 8 + cy); ctx.closePath();
        ctx.fillStyle = V.body; ctx.fill(); outlineStyle(ctx, 2); ctx.stroke();
        // veins
        ctx.strokeStyle = V.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lean * 0.5, shoulderY + cy); ctx.lineTo(lean * 0.2, hipY + 6 + cy); ctx.stroke();
        // SPIN belt
        ctx.fillStyle = '#e8c04a'; ctx.fillRect(-14, hipY + 2 + cy, 28, 6);
        WL.text.draw(ctx, 'SPIN', 0, hipY + 2 + cy, { size: 5, align: 'center', color: '#3a2a00', shadow: false });
        // head: round leaf with bandana
        const hx = lean * 0.8, hy = shoulderY - 12 + cy;
        D.ellipse(ctx, hx, hy, 15, 13, V.body, OUT);
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
        ctx.fillStyle = V.body; ctx.fill(); outlineStyle(ctx, 2.5); ctx.stroke();
        ctx.strokeStyle = V.frill; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-12 + i * 8 + lean * 0.5, shoulderY + 6 + cy, 6, Math.PI, Math.PI * 2); ctx.stroke(); }
        // spiked collar/chain
        ctx.fillStyle = '#c0c0c0'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 8 - 2 + lean * 0.6, shoulderY - 4 + cy, 4, 4);
        // head: curly kale
        const hx = lean * 0.9, hy = shoulderY - 16 + cy;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; D.circle(ctx, hx + Math.cos(a) * 11, hy + Math.sin(a) * 9, 7, V.frill, OUT); }
        D.ellipse(ctx, hx, hy, 14, 12, V.body, OUT);
        face(ctx, hx, hy + 1, e.pose, 3.4, '#ffe0a0');
      });
    },
    froyo(ctx, e, r) {
      const V = VEG.froyo, hipY = -22, shoulderY = -44;
      drawLimbs(ctx, r, V, hipY, shoulderY, 6, (cy, lean) => {
        // cup
        ctx.beginPath(); ctx.moveTo(-16 + lean * 0.6, shoulderY - 2 + cy); ctx.lineTo(16 + lean * 0.6, shoulderY - 2 + cy); ctx.lineTo(12, hipY + 8 + cy); ctx.lineTo(-12, hipY + 8 + cy); ctx.closePath();
        ctx.fillStyle = V.cup; ctx.fill(); outlineStyle(ctx, 2); ctx.stroke();
        ctx.fillStyle = '#e85a8a'; ctx.fillRect(-13 + lean * 0.5, shoulderY + 6 + cy, 26, 8);
        WL.text.draw(ctx, 'FROYO', lean * 0.5, shoulderY + 7 + cy, { size: 5, align: 'center', color: '#fff', shadow: false });
        face(ctx, lean * 0.6, shoulderY + 20 + cy - 6, e.pose, 2.6);
        // swirl
        const sx = lean * 0.8, sy = shoulderY - 4 + cy;
        D.ellipse(ctx, sx, sy - 2, 17, 6, V.swirl, OUT);
        D.ellipse(ctx, sx, sy - 10, 12, 6, V.swirl, OUT);
        D.ellipse(ctx, sx, sy - 17, 7, 5, V.swirl, OUT);
        D.circle(ctx, sx + 1, sy - 24, 3.5, V.swirl, OUT);
        ctx.fillStyle = V.swirlDark; ctx.fillRect(sx - 8, sy - 12, 4, 1.5); ctx.fillRect(sx + 2, sy - 6, 5, 1.5);
        // sprinkles
        const cols = ['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88'];
        for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(sx - 10 + i * 4, sy - 20 + (i % 3) * 5, 3, 1.5); }
        // strawberry
        D.circle(ctx, sx - 8, sy - 6, 3.5, '#e82a3a', OUT);
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
    ctx.save();
    ctx.translate(x, y);
    if (e.facing < 0) ctx.scale(-1, 1);
    if (e.alpha !== undefined) ctx.globalAlpha = e.alpha;
    if (e.flash) ctx.filter = 'brightness(3)';
    else if (e.stunTint) ctx.filter = 'hue-rotate(160deg) saturate(0.5)';
    const hipY = -V.h * 0.4, shoulderY = -V.h * 0.72;
    const r = rig(e.pose, e.t || 0, hipY, shoulderY, V.h * 0.12);
    if (r.lying) {
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(-Math.PI / 2 + (e.pose === 'thrown' ? (e.t || 0) * 12 : 0.1));
      const rr = rig('hurt', 0, hipY, shoulderY, V.h * 0.12);
      enemyDrawers[e.type](ctx, e, rr);
      ctx.restore();
      if (e.pose === 'down') for (let i = 0; i < 3; i++) { const a = (e.t || 0) * 5 + i * 2.1; D.circle(ctx, -V.h * 0.45 + Math.cos(a) * 10, -12 + Math.sin(a) * 3, 2.2, '#ffe14a', OUT); }
    } else {
      enemyDrawers[e.type](ctx, e, r);
      if (e.pose === 'stunned') {
        ctx.filter = 'none';
        for (let i = 0; i < 4; i++) { const a = (e.t || 0) * 6 + i * 1.57; D.circle(ctx, Math.cos(a) * 14, -V.h - 6 + Math.sin(a) * 4, 2.2, '#8ff', OUT); }
      }
    }
    if (e.taped) {
      // duct tape wrap around torso
      ctx.filter = 'none';
      ctx.fillStyle = '#9a9a9a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.rect(-V.h * 0.22, -V.h * 0.62 + i * 8, V.h * 0.44, 5); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }

  /* ================= BOSS: Giant Froyo Cone ================= */
  /**
   * drawBoss(ctx, x, y, b) b: {pose, t, facing, flash, armor(0..1), phase, melt}
   * poses: idle, walk, slamWind, slam, jump, land, rainWind, hurt, stagger, dead
   */
  function drawBoss(ctx, x, y, b) {
    ctx.save();
    ctx.translate(x, y);
    if (b.facing < 0) ctx.scale(-1, 1);
    if (b.flash) ctx.filter = 'brightness(3)';
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
    ctx.fillStyle = '#d9993f'; ctx.fill(); outlineStyle(ctx, 3); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = '#a86a22'; ctx.lineWidth = 2;
    for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 12 - 30 + lean * 0.8, shoulderY - 4); ctx.lineTo(i * 12 + 10, hipY + 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 12 + 30 + lean * 0.8, shoulderY - 4); ctx.lineTo(i * 12 - 10, hipY + 12); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-60, shoulderY - 10, 32, 90);
    ctx.restore();
    // drips
    for (let i = -2; i <= 2; i++) { const dl = 8 + Math.abs(i) * 4 + meltT * 20 + Math.sin(t * 2 + i) * 2; D.fillRRect(ctx, i * 18 - 5 + lean * 0.8, shoulderY - 6, 10, dl, 5, '#f7a7c7', OUT); }
    // swirl head (tiers)
    const hx = lean * 1.1, hy = shoulderY - 6;
    const tiers = [[46, 16, 0], [38, 14, -22], [28, 12, -42], [18, 10, -58], [9, 7, -70]];
    const sw = b.phase >= 3 ? '#f28aa8' : '#f7a7c7';
    for (const [rx, ry, oy] of tiers) { D.ellipse(ctx, hx, hy + oy - 4, rx, ry, sw, OUT); ctx.fillStyle = '#fbd6e4'; ctx.beginPath(); ctx.ellipse(hx - rx * 0.3, hy + oy - 8, rx * 0.35, ry * 0.35, 0, 0, 7); ctx.fill(); }
    D.circle(ctx, hx + 2, hy - 80, 5, sw, OUT);
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
    D.fillRRect(ctx, -4, -60, 8, 62, 3, '#c8ccd8', OUT);
    D.ellipse(ctx, 0, -68, 14, 18, '#dfe3ee', OUT);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-4, -72, 4, 8, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ================= PICKUPS ================= */
  function drawPickup(ctx, x, y, kind, t) {
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
    const dmg = hp <= 1;
    switch (kind) {
      case 'cart': // buffet cart with chafing dishes
        D.fillRRect(ctx, -26, -34, 52, 30, 3, '#d0d4dc', OUT);
        ctx.fillStyle = '#8a8f9a'; ctx.fillRect(-26, -22, 52, 3);
        D.circle(ctx, -18, -2, 4, '#333', OUT); D.circle(ctx, 18, -2, 4, '#333', OUT);
        D.ellipse(ctx, -12, -36, 10, 4, '#e8eaf0', OUT); D.ellipse(ctx, 12, -36, 10, 4, '#e8eaf0', OUT);
        ctx.beginPath(); ctx.ellipse(-12, -40, 8, 5, 0, Math.PI, 0); ctx.fillStyle = '#b8bcc8'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(12, -40, 8, 5, 0, Math.PI, 0); ctx.fillStyle = '#b8bcc8'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c8322a'; ctx.fillRect(-24, -32, 48, 8);
        WL.text.draw(ctx, 'BUFFET', 0, -31, { size: 5, align: 'center', color: '#fff', shadow: false });
        break;
      case 'crate':
        D.fillRRect(ctx, -18, -34, 36, 34, 2, '#b07a3a', OUT);
        ctx.strokeStyle = '#6a4218'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(18, 0); ctx.moveTo(18, -34); ctx.lineTo(-18, 0); ctx.stroke();
        ctx.strokeStyle = OUT; ctx.strokeRect(-18, -34, 36, 34);
        WL.text.draw(ctx, 'NCL', 0, -20, { size: 5, align: 'center', color: '#3a2a10', shadow: false });
        break;
      case 'cooler':
        D.fillRRect(ctx, -20, -28, 40, 28, 3, '#3a78c8', OUT);
        D.fillRRect(ctx, -21, -32, 42, 8, 3, '#f0f0f0', OUT);
        ctx.fillStyle = '#204a88'; ctx.fillRect(-16, -20, 32, 3);
        break;
      case 'barrel':
        D.fillRRect(ctx, -14, -38, 28, 38, 5, '#4a8a3a', OUT);
        ctx.fillStyle = '#2a5a20'; ctx.fillRect(-14, -30, 28, 3); ctx.fillRect(-14, -12, 28, 3);
        WL.text.draw(ctx, 'R-410A', 0, -24, { size: 4, align: 'center', color: '#dfffd0', shadow: false });
        break;
      case 'vending':
        D.fillRRect(ctx, -22, -70, 44, 70, 3, '#2a8a5a', OUT);
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
    const L = len || 90;
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(180,240,255,0.85)'); g.addColorStop(1, 'rgba(180,240,255,0)');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -26); ctx.lineTo(L + 8, 0); ctx.lineTo(L, 26); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 12; i++) { const fx = ((t * 260 + i * 37) % L); const fy = Math.sin(i * 2.1 + t * 20) * fx * 0.25; ctx.fillRect(fx, fy - 1.5, 3, 3); }
    ctx.restore();
  }

  function drawHitSpark(ctx, x, y, t, big) {
    ctx.save(); ctx.translate(x, y);
    const s = (big ? 1.6 : 1) * (1 + t * 2);
    ctx.scale(s, s); ctx.rotate(t * 3);
    ctx.fillStyle = big ? '#ffe14a' : '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5 / s;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r = i % 2 ? 4 : 11; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawDust(ctx, x, y, t, r) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 2);
    D.circle(ctx, x, y, (r || 6) * (1 + t * 3), 'rgba(220,210,190,0.7)');
    ctx.restore();
  }

  /* Volcano Fart cloud — expanding green rings + brown puffs + text */
  function drawFartCloud(ctx, x, y, t, facing) {
    ctx.save();
    const T = Math.min(1, t / 1.15);
    const R = 40 + T * 520;
    // rings
    for (let i = 0; i < 4; i++) {
      const rr = R * (1 - i * 0.18);
      if (rr <= 0) continue;
      ctx.globalAlpha = Math.max(0, 0.55 - T * 0.5 - i * 0.05);
      ctx.beginPath(); ctx.ellipse(x, y - 20, rr, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#7ad83a' : '#a7f04a'; ctx.fill();
    }
    // puffs
    for (let i = 0; i < 26; i++) {
      const a = i * 0.7 + t * 1.5, d = 20 + (i % 7) * 12 + T * 260;
      const px = x + Math.cos(a) * d * (i % 2 ? 1 : 0.7), py = y - 30 + Math.sin(a) * d * 0.35 - T * 40 * (i % 3);
      ctx.globalAlpha = Math.max(0, 0.85 - T);
      D.circle(ctx, px, py, 8 + (i % 5) * 4 + T * 12, i % 3 === 0 ? '#5a8a2a' : (i % 3 === 1 ? '#8bd04a' : '#6b4a2a'));
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

  return { drawLance, lanceHead, drawLanceBust, drawEnemy, drawBoss, drawPickup, drawObject, drawProjectile, drawSprayCone, drawHitSpark, drawDust, drawFartCloud, drawPuddle, tool, VEG, OUT };
})();
