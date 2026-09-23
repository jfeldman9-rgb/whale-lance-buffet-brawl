/* Level data: Pride of America ship spaces, enemy waves, breakables, hazards,
   procedurally drawn parallax backgrounds and the between-stage story beats. */
'use strict';

(function () {
  const U = WL.util, D = WL.draw, T = WL.text;
  const W = WL.W, H = WL.H, FT = WL.FLOOR_TOP, FB = WL.FLOOR_BOTTOM;
  const WALL_BASE = FT - 22; // where the back wall meets the floor
  const tint = WL.sprites.tint;

  /* ---------------- background painters ---------------- */
  /* ================= LIDO DECK (concept pass) =================
     Layers, back to front, with their scroll rates:
       sky + sun + cumulus (0.02-0.04)   Diamond Head + Waikiki skyline (0.08)
       ocean + sailboats (0.15)          superstructure, glass rail, palms (0.3)
       pool deck, loungers, tourists (0.5)   buffet stations + signage (0.7)
       polished teak (1.0) with sun glare and HOT FOOD caution signs.
     Static art is cached per render scale in WL.gfx; far layers are cached
     softer on purpose so the fight plane stays the sharpest thing on screen. */
  const HOR = 124; // horizon line
  function wrapX(x, w) { return ((x % w) + w) % w; }

  function paintCloud(g, w, h, seed) {
    const r = U.seeded(seed);
    const puffs = [];
    const n = 9 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const cx = 24 + u * (w - 48) + (r() - 0.5) * 16;
      const rad = (12 + Math.sin(u * Math.PI) * 18) * (0.7 + r() * 0.5);
      puffs.push([cx, h - 14 - rad * 0.55 - Math.sin(u * Math.PI) * 10 * r(), rad]);
    }
    // silhouette, then shade the belly and light the crowns
    g.fillStyle = '#ffffff';
    for (const [x, y, rr] of puffs) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
    g.fillRect(24, h - 20, w - 48, 8);
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 8, 0, h);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(190,210,235,0.35)'); sh.addColorStop(1, 'rgba(140,165,205,0.75)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    for (const [x, y, rr] of puffs) {
      const hl = g.createRadialGradient(x + rr * 0.3, y - rr * 0.45, 1, x, y, rr);
      hl.addColorStop(0, 'rgba(255,253,240,0.95)'); hl.addColorStop(0.6, 'rgba(255,255,255,0.2)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  const CLOUDS = [[0, 210, 74, 11], [1, 150, 56, 23], [2, 260, 86, 37]];
  function cloudLayer(k) { const c = CLOUDS[k]; return WL.gfx.layer('lido-cloud' + k, c[1], c[2], 2, (g, w, h) => paintCloud(g, w, h, c[3])); }

  function paintFar(g, w) {
    // hazy range behind
    g.fillStyle = '#8fb1c6';
    g.beginPath(); g.moveTo(0, HOR);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, HOR - 10 - Math.sin(x * 0.011) * 6 - Math.sin(x * 0.031 + 1) * 3);
    g.lineTo(w, HOR); g.closePath(); g.fill();
    // Diamond Head: long seaward slope, jagged crater rim, steep landward face
    const ix = 40;
    const rim = [[0, 124], [34, 120], [74, 111], [112, 99], [146, 88], [168, 81], [182, 83], [196, 76], [210, 80], [224, 77], [240, 84], [262, 92], [288, 105], [318, 117], [352, 124]];
    g.beginPath(); g.moveTo(ix, HOR);
    for (const [x, y] of rim) g.lineTo(ix + x, y);
    g.closePath();
    const dg = g.createLinearGradient(ix + 60, 76, ix + 300, 124);
    dg.addColorStop(0, '#9aab6c'); dg.addColorStop(0.45, '#6d8a4e'); dg.addColorStop(1, '#46663c');
    g.fillStyle = dg; g.fill();
    g.save(); g.clip();
    // erosion ridges: sunlit and shaded flutes running down from the rim
    for (let i = 0; i < 26; i++) {
      const x = ix + 40 + i * 11;
      const top = 78 + Math.abs(x - ix - 200) * 0.22;
      g.strokeStyle = i % 2 ? 'rgba(60,70,40,0.35)' : 'rgba(215,205,150,0.28)';
      g.lineWidth = i % 2 ? 2.4 : 1.4;
      g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + 6, top + 18, x + 2 + (i % 3) * 3, HOR); g.stroke();
    }
    // green scrub on the lower slopes
    const r = U.seeded(7);
    for (let i = 0; i < 80; i++) { g.fillStyle = r() > 0.5 ? 'rgba(58,110,52,0.55)' : 'rgba(92,140,64,0.5)'; g.beginPath(); g.arc(ix + r() * 350, HOR - r() * 16, 1.5 + r() * 2.2, 0, 7); g.fill(); }
    g.restore();
    // Waikiki shoreline: hotel towers, palms, a strip of sand
    g.fillStyle = '#efe2b8'; g.fillRect(0, HOR - 2, w, 3);
    const rb = U.seeded(19);
    for (let x = 380; x < w - 20;) {
      const bw = 5 + rb() * 10, bh = 5 + rb() * (x > 520 && x < 900 ? 22 : 12);
      g.fillStyle = rb() > 0.3 ? '#f4f1ea' : '#e2d8c4';
      g.fillRect(x, HOR - 2 - bh, bw, bh);
      g.fillStyle = 'rgba(90,120,150,0.35)';
      for (let yy = HOR - bh; yy < HOR - 4; yy += 2.5) g.fillRect(x + 1, yy, bw - 2, 0.8);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + bw * 0.65, HOR - 2 - bh, bw * 0.35, bh);
      x += bw + 1 + rb() * 6;
    }
    for (let i = 0; i < 18; i++) {
      const px = 360 + rb() * (w - 380), ph = 6 + rb() * 5;
      g.strokeStyle = '#4b5a3a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(px, HOR - 1); g.lineTo(px + 1, HOR - ph); g.stroke();
      g.fillStyle = '#3f6e3a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(px + 1 + Math.cos(k * 1.6) * 2, HOR - ph, 2.6, 0.9, k * 0.8, 0, 7); g.fill(); }
    }
    // atmospheric haze sits over all of it
    const hz = g.createLinearGradient(0, 70, 0, HOR);
    hz.addColorStop(0, 'rgba(200,228,248,0.1)'); hz.addColorStop(1, 'rgba(210,235,250,0.42)');
    g.fillStyle = hz; g.fillRect(0, 60, w, HOR - 60);
  }

  function paintBoat(g, w, h, big) {
    const s = big ? 1.4 : 1;
    g.save(); g.scale(s, s);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(8, 1); g.lineTo(8, 17); g.lineTo(2, 17); g.closePath(); g.fill();
    g.fillStyle = '#eef4fa';
    g.beginPath(); g.moveTo(9, 3); g.lineTo(9, 17); g.lineTo(14, 17); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,150,190,0.5)'; g.fillRect(8, 1, 0.8, 17);
    g.fillStyle = '#f8f8fa'; g.beginPath(); g.moveTo(0, 18); g.lineTo(15, 18); g.lineTo(13, 20.5); g.lineTo(2, 20.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,60,110,0.5)'; g.fillRect(1, 20.5, 13, 0.8);
    g.restore();
  }

  function palm(g, x, base, hgt, lean, seed) {
    const r = U.seeded(seed);
    const tx = x + lean, ty = base - hgt;
    g.lineCap = 'round';
    g.strokeStyle = '#5a3d22'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * 0.2, base - hgt * 0.55, tx, ty); g.stroke();
    g.strokeStyle = '#8a6238'; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(x + 0.8, base); g.quadraticCurveTo(x + lean * 0.2 + 0.8, base - hgt * 0.55, tx + 0.8, ty); g.stroke();
    g.strokeStyle = 'rgba(40,24,10,0.55)'; g.lineWidth = 0.8;
    for (let k = 0.1; k < 1; k += 0.08) {
      const px = x + (tx - x) * k + lean * 0.2 * Math.sin(k * Math.PI) * 0.4, py = base - hgt * k;
      g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px + 3, py - 1); g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI + (r() - 0.5) * 0.3;
      const len = 26 + r() * 12;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.45 + len * 0.35;
      g.strokeStyle = i % 2 ? '#2f6a2c' : '#3f8a36'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + ex) / 2, ty - 10 + (i % 3) * 2, ex, ey); g.stroke();
      g.strokeStyle = 'rgba(190,230,120,0.5)'; g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = i % 2 ? '#2f6a2c' : '#3f8a36'; g.lineWidth = 1.2;
      for (let k = 0.25; k < 1; k += 0.15) {
        const qx = tx + (ex - tx) * k, qy = ty + (ey - ty) * k - Math.sin(k * Math.PI) * 6;
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a + 1.2) * 5, qy + 4); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a - 1.2) * 5, qy + 4); g.stroke();
      }
    }
    D.circle(g, tx, ty + 2, 3, '#6b4a1e'); D.circle(g, tx + 3, ty + 3, 2.4, '#7a5626');
  }

  function planter(g, x, base, w) {
    const pg = g.createLinearGradient(0, base - 16, 0, base);
    pg.addColorStop(0, '#b98552'); pg.addColorStop(1, '#6f4424');
    D.fillRRect(g, x - w / 2, base - 16, w, 16, 2, pg, '#3a2210');
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 4; i++) g.fillRect(x - w / 2 + i * w / 4, base - 15, 0.8, 14);
    g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(x - w / 2 + 1, base - 15.5, w - 2, 1.2);
  }

  function umbrella(g, x, top, r, a, b) {
    g.fillStyle = '#d8d8d8'; g.fillRect(x - 0.8, top, 1.6, 183 - top);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.beginPath(); g.moveTo(x, top - 7);
      g.lineTo(x - r + i * (r / 4), top + 3); g.lineTo(x - r + (i + 1) * (r / 4), top + 3); g.closePath(); g.fill();
    }
    const sh = g.createLinearGradient(x - r, 0, x + r, 0);
    sh.addColorStop(0, 'rgba(0,0,30,0.25)'); sh.addColorStop(0.6, 'rgba(255,255,255,0.05)'); sh.addColorStop(1, 'rgba(255,255,230,0.3)');
    g.fillStyle = sh; g.beginPath(); g.moveTo(x, top - 7); g.lineTo(x - r, top + 3); g.lineTo(x + r, top + 3); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(x - r + (i + 0.5) * (r / 4), top + 3, r / 8, 0, Math.PI); g.fill(); }
  }

  function paintRail(g, w) {
    // Ship superstructure: white steel, navy stripe, Pride of America livery.
    const sx = 50, sw = 380, top = 38;
    const wg = g.createLinearGradient(sx, 0, sx + sw, 0);
    wg.addColorStop(0, '#dfe6ee'); wg.addColorStop(0.5, '#f7f9fb'); wg.addColorStop(1, '#ffffff');
    g.fillStyle = wg;
    g.beginPath(); g.moveTo(sx, 183); g.lineTo(sx, top + 14); g.quadraticCurveTo(sx + 4, top, sx + 30, top); g.lineTo(sx + sw, top); g.lineTo(sx + sw, 183); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,100,130,0.5)'; g.lineWidth = 1; g.stroke();
    // bridge windows
    g.fillStyle = '#1d3f66';
    for (let i = 0; i < 16; i++) { D.rrect(g, sx + 26 + i * 22, top + 8, 16, 9, 2); g.fill(); }
    g.fillStyle = 'rgba(190,225,255,0.55)';
    for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(sx + 28 + i * 22, top + 16); g.lineTo(sx + 34 + i * 22, top + 9); g.lineTo(sx + 37 + i * 22, top + 9); g.lineTo(sx + 31 + i * 22, top + 16); g.closePath(); g.fill(); }
    // navy + red livery stripes
    g.fillStyle = '#16356b'; g.fillRect(sx, top + 24, sw, 5);
    g.fillStyle = '#c8322a'; g.fillRect(sx, top + 30, sw, 2);
    // name board
    T.draw(g, 'PRIDE of AMERICA', sx + 190, top + 36, { size: 12, align: 'center', color: '#1b4a8a', shadow: false });
    g.strokeStyle = '#1b4a8a'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(sx + 60, top + 52); g.bezierCurveTo(sx + 140, top + 46, sx + 240, top + 58, sx + 320, top + 50); g.stroke();
    T.draw(g, 'SAIL HAWAII   LIVE FULLY', sx + 190, top + 56, { size: 6, align: 'center', color: '#2a6ab0', shadow: false });
    // stylised hibiscus emblem
    g.save(); g.translate(sx + 34, top + 46);
    for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 0.4); g.fillStyle = '#e84a6a'; g.beginPath(); g.ellipse(0, -5, 3.4, 5, 0, 0, 7); g.fill(); }
    g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fill();
    g.restore();
    // orange lifeboat under davits
    for (const lx of [sx + 60, sx + 250]) {
      g.fillStyle = '#9aa4b0'; g.fillRect(lx - 2, top + 82, 2, 12); g.fillRect(lx + 72, top + 82, 2, 12);
      const lb = g.createLinearGradient(0, top + 92, 0, top + 106);
      lb.addColorStop(0, '#ffa040'); lb.addColorStop(1, '#d25a10');
      g.fillStyle = lb; D.rrect(g, lx - 4, top + 92, 82, 14, 7); g.fill();
      g.fillStyle = '#ffffff'; D.rrect(g, lx + 4, top + 88, 66, 6, 3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(lx - 2, top + 104, 78, 2);
    }
    // portholes
    g.fillStyle = '#2a5585';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(sx + 20 + i * 26, top + 120, 3, 0, 7); g.fill(); }
    // AO where the superstructure meets the deck
    const ao = g.createLinearGradient(0, 150, 0, 183);
    ao.addColorStop(0, 'rgba(40,60,90,0)'); ao.addColorStop(1, 'rgba(40,60,90,0.3)');
    g.fillStyle = ao; g.fillRect(sx, 150, sw, 33);
    // glass-panel rail the rest of the way round
    for (let x = sx + sw; x < w + sx; x += 38) {
      const px = x >= w ? x - w : x;
      if (px < sx + sw && px > sx) continue;
      g.fillStyle = 'rgba(205,235,255,0.22)'; g.fillRect(px, 150, 38, 30);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(px + 8, 180); g.lineTo(px + 20, 150); g.lineTo(px + 25, 150); g.lineTo(px + 13, 180); g.closePath(); g.fill();
      const pg = g.createLinearGradient(px, 0, px + 4, 0);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#b8c4d2');
      g.fillStyle = pg; g.fillRect(px, 147, 3.5, 36);
    }
    const rg = g.createLinearGradient(0, 146, 0, 151);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#aab6c6');
    g.fillStyle = rg;
    g.fillRect(sx + sw, 146, w - sw, 4.5); g.fillRect(0, 146, sx, 4.5);
    // palms in teak planters
    palm(g, 560, 176, 104, 16, 3); planter(g, 560, 183, 26);
    palm(g, 1040, 176, 92, -18, 5); planter(g, 1040, 183, 26);
    palm(g, 1180, 176, 80, 12, 9); planter(g, 1180, 183, 22);
    umbrella(g, 700, 116, 28, '#e23b3b', '#fdfdfd');
    umbrella(g, 880, 122, 24, '#1a8fb4', '#fdfdfd');
  }

  // One tourist, soft focus: lying | sit | stand
  function tourist(g, x, base, kind, skin, suit, hat) {
    if (kind === 'lying') {
      g.fillStyle = skin; g.beginPath(); g.ellipse(x, base - 9, 16, 3.6, -0.12, 0, 7); g.fill();
      g.fillStyle = suit; g.fillRect(x - 5, base - 12.5, 9, 6);
      g.fillStyle = skin; g.beginPath(); g.arc(x - 18, base - 13, 3.8, 0, 7); g.fill();
      if (hat) { g.fillStyle = hat; g.beginPath(); g.ellipse(x - 19, base - 16, 6.5, 2, -0.3, 0, 7); g.fill(); g.beginPath(); g.arc(x - 19, base - 17, 3, Math.PI, 0); g.fill(); }
      g.fillStyle = '#111'; g.fillRect(x - 21, base - 14, 4, 1.2);
    } else if (kind === 'sit') {
      g.fillStyle = skin; g.beginPath(); g.ellipse(x + 8, base - 8, 9, 3, 0, 0, 7); g.fill();
      g.fillStyle = suit; D.rrect(g, x - 4, base - 24, 9, 15, 3); g.fill();
      g.fillStyle = skin; g.beginPath(); g.arc(x, base - 28, 4, 0, 7); g.fill();
      if (hat) { g.fillStyle = hat; g.beginPath(); g.ellipse(x, base - 31, 7, 2, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, base - 31.5, 3.4, Math.PI, 0); g.fill(); }
      g.fillStyle = '#111'; g.fillRect(x - 1, base - 29, 4, 1.2);
      g.fillStyle = '#f4f0e0'; g.fillRect(x + 4, base - 20, 6, 5);
    } else {
      g.fillStyle = skin; g.fillRect(x - 3, base - 12, 2.4, 12); g.fillRect(x + 0.6, base - 12, 2.4, 12);
      g.fillStyle = suit; D.rrect(g, x - 4.5, base - 28, 9, 17, 3); g.fill();
      g.fillStyle = skin; g.beginPath(); g.arc(x, base - 32, 4, 0, 7); g.fill();
      if (hat) { g.fillStyle = hat; g.beginPath(); g.ellipse(x, base - 35, 7, 2, 0, 0, 7); g.fill(); }
    }
  }
  function lounger(g, x, base, col) {
    g.strokeStyle = '#c8ccd4'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x - 20, base); g.lineTo(x - 18, base - 7); g.moveTo(x + 18, base); g.lineTo(x + 16, base - 7); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x - 24, base - 7); g.lineTo(x + 14, base - 7); g.lineTo(x + 26, base - 20); g.lineTo(x + 22, base - 22); g.lineTo(x + 10, base - 10); g.lineTo(x - 24, base - 10); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 24, base - 10, 34, 1);
  }
  function paintPool(g, w) {
    // pool with a white tile coping and caustic ripples
    const px = 90, pw = 330;
    g.fillStyle = '#f4f6f8'; D.rrect(g, px - 4, 164, pw + 8, 21, 3); g.fill();
    const wg = g.createLinearGradient(0, 166, 0, 183);
    wg.addColorStop(0, '#5fd8f2'); wg.addColorStop(1, '#159cc8');
    g.fillStyle = wg; g.fillRect(px, 166, pw, 17);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8;
    const r = U.seeded(4);
    for (let i = 0; i < 26; i++) { const cx = px + r() * pw, cy = 168 + r() * 13; g.beginPath(); g.moveTo(cx - 5, cy); g.quadraticCurveTo(cx, cy - 1.5, cx + 5, cy); g.stroke(); }
    g.strokeStyle = '#d8dde4'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(px + 20, 160); g.lineTo(px + 20, 172); g.moveTo(px + 28, 160); g.lineTo(px + 28, 172); g.stroke();
    // swimmers
    tourist(g, px + 120, 176, 'lying', '#d9a47c', '#e2345a', null);
    g.fillStyle = '#b77a54'; g.beginPath(); g.arc(px + 230, 171, 3.6, 0, 7); g.fill();
    g.fillStyle = '#f2d24a'; g.beginPath(); g.ellipse(px + 230, 174, 9, 3, 0, 0, 7); g.fill();
    // loungers with sunbathers, towels in cruise stripes
    const L = [[470, '#f7f9fc', 'lying', '#e6b48c', '#2d6fd8', '#f1e3b0'], [540, '#8ad0f0', 'sit', '#9c6a48', '#f08a2e', '#ffffff'], [610, '#f7f9fc', 'lying', '#f0c8a0', '#15a38a', '#e84a6a'],
      [690, '#f7f9fc', 'sit', '#d9a47c', '#8a3fbf', '#f4e0a0'], [780, '#8ad0f0', 'lying', '#c28a60', '#e2345a', null], [860, '#f7f9fc', 'sit', '#f0c8a0', '#2d6fd8', '#ffffff'], [30, '#8ad0f0', 'lying', '#e6b48c', '#f2c230', '#e84a6a']];
    for (const [lx, col, kind, skin, suit, hat] of L) {
      lounger(g, lx, 183, col);
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(lx - 20, 173, 30, 2);
      tourist(g, lx + (kind === 'sit' ? 2 : 4), 176, kind, skin, suit, hat);
    }
    tourist(g, 440, 183, 'stand', '#d9a47c', '#f4f4f4', '#e8d8a0');
    tourist(g, 930, 183, 'stand', '#9c6a48', '#e23b3b', null);
  }

  function hanging(g, x, y, w, h, bg, col, lines, sz) {
    g.strokeStyle = '#8a7a60'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 8, y - 16); g.lineTo(x + 8, y); g.moveTo(x + w - 8, y - 16); g.lineTo(x + w - 8, y); g.stroke();
    const bgG = g.createLinearGradient(0, y, 0, y + h);
    bgG.addColorStop(0, '#ffffff'); bgG.addColorStop(1, bg);
    D.fillRRect(g, x, y, w, h, 3, bgG, '#b8a888');
    lines.forEach((l, i) => T.draw(g, l, x + w / 2, y + 4 + i * (sz + 3), { size: sz, align: 'center', color: col, shadow: false }));
    for (const fx of [x + 7, x + w - 7]) {
      g.save(); g.translate(fx, y + h / 2);
      for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 0.4); g.fillStyle = '#e8365a'; g.beginPath(); g.ellipse(0, -3.4, 2.4, 3.4, 0, 0, 7); g.fill(); }
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0, 0, 1.2, 0, 7); g.fill();
      g.restore();
    }
  }
  function aFrame(g, x, base) {
    g.strokeStyle = '#4a2e18'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 20, base); g.lineTo(x - 14, base - 66); g.moveTo(x + 20, base); g.lineTo(x + 14, base - 66); g.stroke();
    const wg = g.createLinearGradient(x - 20, 0, x + 20, 0);
    wg.addColorStop(0, '#8a5a30'); wg.addColorStop(0.5, '#b07a44'); wg.addColorStop(1, '#7a4c26');
    D.fillRRect(g, x - 20, base - 70, 40, 56, 2, wg, '#3a2210');
    g.strokeStyle = 'rgba(40,20,5,0.35)'; g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 19, base - 64 + i * 9); g.lineTo(x + 19, base - 63 + i * 9); g.stroke(); }
    ['FRESHER', 'HEALTHIER', 'HAPPIER', 'A COOLER', 'TOMORROW'].forEach((l, i) => T.draw(g, l, x, base - 64 + i * 9.5, { size: 3.6, align: 'center', color: i > 2 ? '#fff1c8' : '#2a1608', shadow: false }));
    g.save(); g.translate(x, base - 18);
    for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 0.4); g.fillStyle = '#e8365a'; g.beginPath(); g.ellipse(0, -2.6, 1.8, 2.6, 0, 0, 7); g.fill(); }
    g.restore();
  }
  function chalkboard(g, x, base) {
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 16, base); g.lineTo(x - 10, base - 58); g.moveTo(x + 16, base); g.lineTo(x + 10, base - 58); g.stroke();
    D.fillRRect(g, x - 19, base - 62, 38, 44, 2, '#8a5a30', '#3a2210');
    const bg = g.createLinearGradient(0, base - 60, 0, base - 20);
    bg.addColorStop(0, '#2c3a33'); bg.addColorStop(1, '#1b2521');
    g.fillStyle = bg; g.fillRect(x - 16, base - 59, 32, 38);
    ['FUEL', 'A BETTER', 'YOU!'].forEach((l, i) => T.draw(g, l, x, base - 55 + i * 8, { size: 4, align: 'center', color: i === 2 ? '#ffe98a' : '#f4f4ec', shadow: false }));
    g.fillStyle = '#7cd060'; g.beginPath(); g.arc(x - 6, base - 27, 3, 0, 7); g.arc(x - 3, base - 29, 3, 0, 7); g.fill();
    g.fillStyle = '#f07a3a'; g.beginPath(); g.moveTo(x + 4, base - 30); g.lineTo(x + 10, base - 29); g.lineTo(x + 5, base - 24); g.closePath(); g.fill();
  }
  function produce(g, dx, dy, kind) {
    if (kind === 'broccoli') { for (let i = 0; i < 5; i++) { D.circle(g, dx - 8 + i * 4, dy - 2 - (i % 2) * 2, 3.2, i % 2 ? '#3f8a2a' : '#56a83a'); } }
    else if (kind === 'salad') { for (let i = 0; i < 6; i++) D.circle(g, dx - 9 + i * 3.6, dy - 2 - (i % 3), 2.8, ['#8fd04a', '#e8403a', '#6ab83a', '#f6e27a'][i % 4]); }
    else if (kind === 'fruit') { D.circle(g, dx - 6, dy - 3, 3.4, '#f0a020'); D.circle(g, dx, dy - 4, 3.4, '#e83a3a'); D.circle(g, dx + 6, dy - 3, 3.4, '#7ac83a'); }
    else if (kind === 'carrot') { g.fillStyle = '#f08a1e'; for (let i = 0; i < 5; i++) { g.save(); g.translate(dx - 8 + i * 4, dy - 2); g.rotate(0.5); g.fillRect(-1.2, -4, 2.4, 8); g.restore(); } }
    else { g.fillStyle = '#e8b050'; g.beginPath(); g.ellipse(dx, dy - 2, 10, 3, 0, Math.PI, 0); g.fill(); }
  }
  const BUFFETS = [{ x: 0, w: 300, foods: ['broccoli', 'salad', 'fruit', 'carrot', 'roast'] }, { x: 820, w: 300, foods: ['fruit', 'roast', 'salad', 'broccoli', 'carrot'] }];
  const BUFFET_TILE = 1400;
  function paintBuffet(g, w) {
    for (const B of BUFFETS) {
      const x = B.x;
      // teak service counter with panel inlays and a marble top
      const cg = g.createLinearGradient(0, 150, 0, 186);
      cg.addColorStop(0, '#9a6232'); cg.addColorStop(1, '#5e3616');
      D.fillRRect(g, x, 150, B.w, 36, 3, cg, '#2d1808');
      for (let p = 0; p < 5; p++) {
        D.fillRRect(g, x + 10 + p * (B.w - 20) / 5, 158, (B.w - 20) / 5 - 8, 22, 2, 'rgba(60,30,10,0.35)', 'rgba(255,220,170,0.18)');
      }
      const mg = g.createLinearGradient(0, 144, 0, 151);
      mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, '#cfc6b8');
      D.fillRRect(g, x - 4, 144, B.w + 8, 7, 2, mg, '#8a8070');
      // sneeze guard
      g.fillStyle = 'rgba(210,240,255,0.25)';
      g.beginPath(); g.moveTo(x + 10, 144); g.lineTo(x + 20, 124); g.lineTo(x + B.w - 20, 124); g.lineTo(x + B.w - 10, 144); g.closePath(); g.fill();
      g.strokeStyle = '#d4af37'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x + 8, 144); g.lineTo(x + 18, 123); g.lineTo(x + B.w - 18, 123); g.lineTo(x + B.w - 8, 144); g.stroke();
      // chafing dishes piled with produce
      B.foods.forEach((f, i) => {
        const dx = x + 30 + i * (B.w - 60) / 4;
        const tg = g.createLinearGradient(0, 144, 0, 152);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8a92a0');
        g.fillStyle = tg; g.beginPath(); g.ellipse(dx, 147, 17, 5, 0, 0, 7); g.fill();
        produce(g, dx, 147, f);
      });
      // heat lamps
      for (let h = 0; h < 3; h++) {
        const hx = x + 50 + h * (B.w - 100) / 2;
        g.fillStyle = '#b8860b'; g.fillRect(hx - 0.8, 104, 1.6, 12);
        D.fillRRect(g, hx - 11, 114, 22, 6, 2, '#d4af37', '#6b4a08');
      }
      // banner
      hanging(g, x + B.w / 2 - 66, 88, 132, 16, '#f4ead4', '#1b4a8a', [x === 0 ? 'GOOD FOOD  BRIGHTER DAYS' : 'ALOHA LIDO BUFFET'], 5);
    }
    // the gap between counters: an A-frame, a hibiscus planter, a chalkboard easel
    aFrame(g, 370, 186);
    planter(g, 440, 186, 30);
    for (let i = 0; i < 14; i++) { const a = i * 0.45; g.fillStyle = i % 2 ? '#2f6a2c' : '#3f8a36'; g.beginPath(); g.ellipse(440 + Math.cos(a) * 12, 162 + Math.sin(a) * 6 - 4, 7, 3, a, 0, 7); g.fill(); }
    for (const [fx, fy] of [[432, 160], [446, 156], [452, 166], [428, 168]]) {
      g.save(); g.translate(fx, fy);
      for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 0.4); g.fillStyle = '#f0405a'; g.beginPath(); g.ellipse(0, -2.6, 2, 2.8, 0, 0, 7); g.fill(); }
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0, 0, 0.9, 0, 7); g.fill(); g.restore();
    }
    chalkboard(g, 1170, 186);
    planter(g, 1250, 186, 24);
    for (let i = 0; i < 10; i++) { const a = -Math.PI + i * 0.35; g.strokeStyle = '#3f8a36'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(1250, 170); g.quadraticCurveTo(1250 + Math.cos(a) * 10, 150, 1250 + Math.cos(a) * 20, 150 + Math.sin(a) * -8 + 10); g.stroke(); }
  }

  function paintTeak(g, w, h) {
    // Honey teak planks with black caulk seams; rows get taller toward the camera.
    const r = U.seeded(77);
    const tones = ['#c68c4c', '#bb8040', '#d19a5a', '#b47838', '#c99250', '#be8646'];
    let y = 0;
    while (y < h) {
      const rh = 4.2 + y * 0.075;
      let x = -r() * 140;
      while (x < w) {
        const len = 90 + r() * 90;
        const tone = tones[Math.floor(r() * tones.length)];
        for (const ox of [0, -w, w]) {
          const px = x + ox;
          if (px > w || px + len < 0) continue;
          const pg = g.createLinearGradient(0, y, 0, y + rh);
          pg.addColorStop(0, tone); pg.addColorStop(0.18, tone); pg.addColorStop(1, tint(tone, -0.16));
          g.fillStyle = pg; g.fillRect(px, y, len, rh);
          // grain
          g.strokeStyle = 'rgba(90,50,18,0.22)'; g.lineWidth = 0.35;
          const seed = x * 7 + y;
          for (let k = 1; k < 3; k++) {
            const gy = y + rh * (k / 3);
            g.beginPath(); g.moveTo(px, gy);
            for (let s = 0; s <= len; s += 18) g.lineTo(px + s, gy + Math.sin(seed + s * 0.09 + k) * rh * 0.12);
            g.stroke();
          }
          // bevel light on the plank's top edge
          g.fillStyle = 'rgba(255,230,180,0.28)'; g.fillRect(px, y + 0.5, len, 0.6);
          // butt joint
          g.fillStyle = '#2a1a10'; g.fillRect(px + len - 0.6, y, 0.8, rh);
          g.fillStyle = 'rgba(255,225,170,0.3)'; g.fillRect(px + len + 0.2, y, 0.5, rh);
        }
        x += len;
      }
      g.fillStyle = '#23150c'; g.fillRect(0, y, w, 0.75 + y * 0.004);
      y += rh;
    }
  }

  function cautionSign(g) {
    // yellow A-frame, as in the concept: HOT FOOD. HOT FIGHTS. COOLER TOMORROW.
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.2;
    const yg = g.createLinearGradient(0, 0, 44, 0);
    yg.addColorStop(0, '#ffd21a'); yg.addColorStop(0.6, '#ffe04a'); yg.addColorStop(1, '#e0a800');
    g.fillStyle = '#b88a00'; g.beginPath(); g.moveTo(30, 4); g.lineTo(40, 58); g.lineTo(34, 58); g.lineTo(26, 6); g.closePath(); g.fill();
    g.fillStyle = yg; g.beginPath(); g.moveTo(10, 2); g.lineTo(30, 2); g.lineTo(36, 58); g.lineTo(4, 58); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1a1a'; g.fillRect(6, 52, 29, 1.5);
    T.draw(g, 'HOT FOOD', 20, 8, { size: 3.8, align: 'center', color: '#1a1a1a', shadow: false });
    T.draw(g, 'HOT FIGHTS', 20, 14, { size: 3.4, align: 'center', color: '#1a1a1a', shadow: false });
    g.beginPath(); g.moveTo(20, 22); g.lineTo(29, 37); g.lineTo(11, 37); g.closePath(); g.fillStyle = '#1a1a1a'; g.fill();
    g.beginPath(); g.moveTo(20, 25); g.lineTo(26.5, 35.5); g.lineTo(13.5, 35.5); g.closePath(); g.fillStyle = '#ffe04a'; g.fill();
    g.fillStyle = '#e04010'; g.beginPath(); g.moveTo(20, 27); g.quadraticCurveTo(24, 31, 22, 34.5); g.lineTo(18, 34.5); g.quadraticCurveTo(16, 31, 20, 27); g.fill();
    T.draw(g, 'COOLER', 20, 40, { size: 3.6, align: 'center', color: '#1a1a1a', shadow: false });
    T.draw(g, 'TOMORROW', 20, 45, { size: 3.4, align: 'center', color: '#1a1a1a', shadow: false });
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(11, 3); g.lineTo(14, 3); g.lineTo(8, 57); g.lineTo(5, 57); g.closePath(); g.fill();
  }
  const CAUTION_AT = [470, 1330, 2240];

  /* ---- painted Lido (assets/art plates) ----
     sky + Diamond Head (0.04) | ocean + sailboats (0.1) | superstructure, pool
     crowd and sun deck plates (0.45) | polished teak (1.0) with the buffet line
     (0.78) and its reflection | deck props | a soft foreground (1.3). */
  const FAR_W = 880, FAR_SPLIT = 0.5, FAR_SHORE = 108;
  const MID_W = 420, MID_OVER = 26, MID_BASE = 192;
  const MID_SEQ = [['lido-mid-ship', 1], ['lido-mid-pool', 1], ['lido-mid-deck', 1], ['lido-mid-pool', -1], ['lido-mid-ship', 1]];
  const BUFFET_W = 224, BUFFET_AT = [420, 1330, 2060], BUFFET_BASE = WALL_BASE + 11;
  const DECK_PROPS = [['bush', 118, 0.95], ['bush', 905, 0.9], ['platesStack', 1180, 1.1], ['bush', 1640, 1], ['bush', 2330, 0.95]];
  const FG = [['bush', 360, 1.9], ['platesStack', 1210, 1.9], ['bush', 1980, 2.1], ['bush', 2900, 1.9]];
  function lidoPainted() {
    return !!(WL.art.plate('lido-far') && WL.art.plate('lido-mid-ship') && WL.art.plate('lido-mid-pool') && WL.art.plate('lido-mid-deck') && WL.art.plate('lido-floor'));
  }
  function farLayers() {
    const P = WL.ARTDATA.plates['lido-far'];
    const k = FAR_W / P.w, fh = P.h * k, split = fh * FAR_SPLIT;
    const sky = WL.art.plateLayer('lido-far', FAR_W, FAR_SHORE + 2, 2, 0, (g, img) => g.drawImage(img, 0, 0, P.w, P.h * FAR_SPLIT + 2 / k, 0, FAR_SHORE - split, FAR_W, split + 2));
    const sea = WL.art.plateLayer('lido-far', FAR_W, fh - split, 2, 0, (g, img) => g.drawImage(img, 0, P.h * FAR_SPLIT, P.w, P.h * (1 - FAR_SPLIT), 0, 0, FAR_W, fh - split));
    return { sky, sea };
  }
  function midLayer(name, dir) {
    const P = WL.ARTDATA.plates[name], mh = MID_W * P.h / P.w;
    return WL.art.plateLayer(name, MID_W, mh, 3, 0.3, (g, img, w, h) => {
      if (dir < 0) { g.translate(w, 0); g.scale(-1, 1); }
      g.drawImage(img, 0, 0, w, h);
    }, dir < 0 ? '-m' : '');
  }
  function buffetLayers() {
    const P = WL.ARTDATA.plates['lido-buffet'];
    if (!P || !WL.art.plate('lido-buffet')) return null;
    const bh = BUFFET_W * P.h / P.w;
    const body = WL.art.plateLayer('lido-buffet', BUFFET_W, bh, 3.2, 0);
    const rh = bh * 0.5;
    const refl = WL.art.plateLayer('lido-buffet', BUFFET_W, rh, 1.5, 0.8, (g, img, w, h) => {
      g.save(); g.translate(0, bh * 0.7); g.scale(1, -0.7); g.drawImage(img, 0, 0, w, bh); g.restore();
      g.globalCompositeOperation = 'destination-in';
      const fade = g.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0.9)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fade; g.fillRect(0, 0, w, h);
    }, '-refl');
    return { body, refl, bh };
  }
  function propLayer(f, blur, scale) {
    const F = WL.art.frame('props', f);
    if (!F || !WL.art.has('props')) return null;
    const k = WL.ARTDATA.props.k * scale, w = F[2] * k, h = F[3] * k;
    const e = WL.gfx.layer('fgprop-' + f + scale, w + 8, h + 8, 3, g => g.drawImage(WL.art.atlas('props'), F[0], F[1], F[2], F[3], 4, 4, w, h), blur);
    return { e, w, h };
  }
  function lidoPaintedBg(ctx, camX, t) {
    const G = WL.gfx, rich = !WL.perf.lite;
    const sunX = 566 - camX * 0.02;
    const far = farLayers();
    G.tile(ctx, far.sky, camX * 0.04 + 30, 0);
    G.tile(ctx, far.sea, camX * 0.1 + 30, FAR_SHORE);
    if (rich) {
      // sun glitter on the water, under the sun
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 22; i++) {
        const wy = FAR_SHORE + 4 + (i * 7) % 40;
        const wx = sunX - 60 + ((i * 37 + Math.floor(t * 4 + i) * 13) % 110) + (wy - FAR_SHORE) * 0.5;
        ctx.globalAlpha = 0.18 + 0.4 * Math.abs(Math.sin(t * 3 + i));
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(wx, wy, 4 + (i % 3) * 3, 0.8);
      }
      ctx.restore();
    }
    // superstructure, pool crowd and sun deck
    const mx = -camX * 0.45;
    MID_SEQ.forEach(([name, dir], i) => {
      const x = mx + i * (MID_W - MID_OVER);
      if (x > W || x + MID_W < 0) return;
      const e = midLayer(name, dir);
      if (e) G.blit(ctx, e, x, MID_BASE - e.h);
    });
    // polished teak
    const floor = WL.art.plateLayer('lido-floor', 560, H - WALL_BASE, 3, 0);
    G.tile(ctx, floor, camX, WALL_BASE);
    // far edge: the deck line and the sky's bounce in the lacquer
    const ao = ctx.createLinearGradient(0, WALL_BASE, 0, WALL_BASE + 12);
    ao.addColorStop(0, 'rgba(50,24,6,0.5)'); ao.addColorStop(1, 'rgba(50,24,6,0)');
    ctx.fillStyle = ao; ctx.fillRect(0, WALL_BASE, W, 12);
    // buffet line, standing on the deck, mirrored in the lacquer
    const B = buffetLayers();
    if (B) {
      const bx0 = -camX * 0.78;
      for (const at of BUFFET_AT) {
        const x = bx0 + at;
        if (x > W + 10 || x + BUFFET_W < -10) continue;
        if (rich) { ctx.save(); ctx.globalAlpha = 0.5; G.blit(ctx, B.refl, x, BUFFET_BASE - 1); ctx.restore(); }
        D.shadow(ctx, x + BUFFET_W / 2 - 14, BUFFET_BASE, BUFFET_W * 0.5, 6, 0);
        G.blit(ctx, B.body, x, BUFFET_BASE - B.bh);
        if (rich) {
          // steam off the chafing dishes
          ctx.save(); ctx.fillStyle = '#fff';
          for (let i = 0; i < 4; i++) {
            const k = (t * 0.8 + i * 0.29) % 1;
            ctx.globalAlpha = 0.26 * (1 - k);
            D.circle(ctx, x + BUFFET_W * (0.28 + i * 0.12) + Math.sin(t * 2 + i) * 3, BUFFET_BASE - B.bh * 0.66 - k * 20, 2.5 + k * 5);
          }
          ctx.restore();
        }
      }
    }
    if (rich) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gx = sunX - 90;
      const glare = ctx.createRadialGradient(gx, 250, 4, gx, 250, 170);
      glare.addColorStop(0, 'rgba(255,232,180,0.3)'); glare.addColorStop(0.45, 'rgba(255,215,150,0.1)'); glare.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = glare; ctx.fillRect(gx - 170, WALL_BASE, 340, H - WALL_BASE);
      ctx.restore();
    }
    // planters and the HOT FOOD caution signs along the back of the fight lane
    if (WL.art.has('props')) {
      for (const [f, wx, sc] of DECK_PROPS) {
        const x = wx - camX;
        if (x < -60 || x > W + 60) continue;
        D.shadow(ctx, x, WALL_BASE + 12, 26 * sc, 5, 0);
        WL.art.draw(ctx, 'props', f, x, WALL_BASE + 13, { sx: sc, sy: sc });
      }
      for (const wx of CAUTION_AT) {
        const x = wx - camX + 20;
        if (x < -40 || x > W + 40) continue;
        if (rich) WL.art.reflect(ctx, 'props', 'caution', x, WALL_BASE + 17, 0, { strength: 0.3 });
        D.shadow(ctx, x, WALL_BASE + 16, 20, 4, 0);
        WL.art.draw(ctx, 'props', 'caution', x, WALL_BASE + 17);
      }
    }
  }
  /* Out-of-focus foreground that slides past faster than the deck. */
  function lidoFg(ctx, camX) {
    if (!lidoPainted() || !WL.art.has('props')) return;
    for (const [f, wx, sc] of FG) {
      const P = propLayer(f, WL.perf.lite ? 0 : 1.4, sc);
      if (!P) continue;
      const x = wx - camX * 1.3 - P.w / 2;
      if (x > W + 20 || x + P.w < -20) continue;
      WL.gfx.blit(ctx, P.e, x - 4, H + 12 - P.h * 0.55);
    }
  }

  function lidoBg(ctx, camX, t) {
    if (lidoPainted()) { lidoPaintedBg(ctx, camX, t); return; }
    const G = WL.gfx, rich = !WL.perf.lite;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, HOR);
    sky.addColorStop(0, '#1d6fd0'); sky.addColorStop(0.55, '#5aaef0'); sky.addColorStop(1, '#cfeeff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HOR + 2);
    // sun, high and to the right: key light for the whole deck
    const sunX = 566 - camX * 0.02, sunY = 22;
    // Sun disc and bloom, confined to the sky band so it costs sky pixels only.
    const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 260);
    sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(0.06, 'rgba(255,250,215,0.95)'); sg.addColorStop(0.15, 'rgba(255,240,190,0.4)'); sg.addColorStop(0.45, 'rgba(255,236,190,0.14)'); sg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = sg; ctx.fillRect(sunX - 260, 0, 520, HOR + 2);
    // cumulus
    const cl = [[40, 16, 0, 0.03], [250, 4, 2, 0.035], [480, 48, 1, 0.04], [700, 20, 0, 0.03]];
    for (const [cx, cy, k, sp] of cl) {
      const e = cloudLayer(k);
      const x = wrapX(cx + t * 3 - camX * sp + 200, W + 400) - 200 - e.w / 2;
      G.blit(ctx, e, x, cy);
    }
    // Diamond Head + skyline
    const far = G.layer('lido-far', 1280, 72, 4, (g, w) => { g.translate(0, -60); paintFar(g, w); }, 0.45);
    G.tile(ctx, far, camX * 0.08 + 20, 60);
    // ocean
    const og = ctx.createLinearGradient(0, HOR, 0, 186);
    og.addColorStop(0, '#2a78c2'); og.addColorStop(0.3, '#1c79c8'); og.addColorStop(1, '#27a8dc');
    ctx.fillStyle = og; ctx.fillRect(0, HOR, W, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 34; i++) {
      const wy = HOR + 2 + (i * 13) % 50;
      const wx = wrapX(i * 89 - camX * 0.15 + t * (6 + wy * 0.05), W + 60) - 30;
      ctx.fillRect(wx, wy, 8 + (i % 4) * 5 + wy * 0.05, 0.9 + (wy - HOR) * 0.01);
    }
    if (rich) {
      // sun glitter path on the water
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const wy = HOR + 3 + (i * 7) % 44;
        const wx = sunX - 40 + ((i * 37 + Math.floor(t * 4 + i) * 13) % 80) + (wy - HOR) * 0.4;
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 3 + i));
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(wx, wy, 5 + (i % 3) * 3, 1);
      }
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      const big = i === 1;
      const e = G.layer('lido-boat' + (big ? 1 : 0), big ? 22 : 16, big ? 30 : 22, 3, (g, w, h) => paintBoat(g, w, h, big));
      const bx = wrapX(140 + i * 230 - camX * 0.15 - t * (1.5 + i * 0.4), W + 100) - 50;
      G.blit(ctx, e, bx, HOR - e.h + 5 + i * 5);
    }
    // superstructure + rail + palms (0.3)
    const rail = G.layer('lido-rail', 1280, 150, 4, (g, w) => { g.translate(0, -34); paintRail(g, w); });
    G.tile(ctx, rail, camX * 0.3 + 30, 34);
    // pool deck (0.5)
    const pool = G.layer('lido-pool', 960, 70, 4, (g, w) => { g.translate(0, -116); paintPool(g, w); }, 0.3);
    G.tile(ctx, pool, camX * 0.5, 116);
    if (rich) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const po = -wrapX(camX * 0.5, 960);
      for (const base of [po, po + 960]) {
        for (let i = 0; i < 8; i++) {
          const x = base + 100 + i * 40 + Math.sin(t * 2 + i) * 6;
          if (x > -10 && x < W + 10) ctx.fillRect(x, 170 + (i % 3) * 4, 10, 0.9);
        }
      }
    }
    // buffet stations (0.7)
    const buf = G.layer('lido-buffet', BUFFET_TILE, 110, 4, (g, w) => { g.translate(0, -78); paintBuffet(g, w); });
    G.tile(ctx, buf, camX * 0.7, 78);
    // heat-lamp glow and steam on the chafing dishes
    const bo = -wrapX(camX * 0.7, BUFFET_TILE);
    for (const base of [bo, bo + BUFFET_TILE]) {
      for (const B of BUFFETS) {
        const x0 = base + B.x;
        if (x0 > W + 20 || x0 + B.w < -20) continue;
        if (rich) {
          for (let h = 0; h < 3; h++) {
            const hx = x0 + 50 + h * (B.w - 100) / 2;
            const lg = ctx.createRadialGradient(hx, 122, 2, hx, 140, 30);
            lg.addColorStop(0, 'rgba(255,190,80,0.4)'); lg.addColorStop(1, 'rgba(255,190,80,0)');
            ctx.fillStyle = lg; ctx.fillRect(hx - 30, 118, 60, 32);
          }
        }
        ctx.save(); ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) {
          const dx = x0 + 30 + i * (B.w - 60) / 4;
          const k = ((t * 0.9 + i * 0.37) % 1);
          ctx.globalAlpha = 0.32 * (1 - k);
          D.circle(ctx, dx + Math.sin(t * 2 + i) * 3, 140 - k * 18, 2.5 + k * 4);
        }
        ctx.restore();
      }
    }

    // ---- polished teak deck ----
    const teak = G.layer('lido-teak', 512, H - WALL_BASE, 4, (g, w, h) => paintTeak(g, w, h));
    G.tile(ctx, teak, camX, WALL_BASE);
    // lacquer: sky bounce on the far planks, sun glare pooled under the sun
    const refl = ctx.createLinearGradient(0, WALL_BASE, 0, WALL_BASE + 60);
    refl.addColorStop(0, 'rgba(200,232,255,0.34)'); refl.addColorStop(1, 'rgba(200,232,255,0)');
    ctx.fillStyle = refl; ctx.fillRect(0, WALL_BASE, W, 60);
    if (rich) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gx = sunX - 70;
      const glare = ctx.createRadialGradient(gx, 250, 4, gx, 250, 150);
      glare.addColorStop(0, 'rgba(255,230,170,0.34)'); glare.addColorStop(0.45, 'rgba(255,215,150,0.12)'); glare.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = glare; ctx.fillRect(gx - 150, WALL_BASE, 300, H - WALL_BASE);
      // specular streaks along the seams nearest the glare
      ctx.fillStyle = 'rgba(255,245,215,0.3)';
      for (let i = 0; i < 9; i++) { const yy = WALL_BASE + 12 + i * 17 + i * i * 0.6; const len = 120 - i * 6; ctx.fillRect(gx - len / 2 - i * 8, yy, len, 0.8); }
      ctx.restore();
    }
    // contact shadow where the deck meets the buffet line
    const ao = ctx.createLinearGradient(0, WALL_BASE, 0, WALL_BASE + 10);
    ao.addColorStop(0, 'rgba(40,20,5,0.4)'); ao.addColorStop(1, 'rgba(40,20,5,0)');
    ctx.fillStyle = ao; ctx.fillRect(0, WALL_BASE, W, 10);
    // HOT FOOD caution signs on the deck (behind the fight lane)
    const cs = G.layer('lido-caution', 44, 60, 4, g => cautionSign(g));
    for (const wx of CAUTION_AT) {
      const x = wx - camX;
      if (x < -60 || x > W + 20) continue;
      D.shadow(ctx, x + 20, WALL_BASE + 16, 22, 4, 0);
      G.blit(ctx, cs, x, WALL_BASE - 44 + 1 + 16);
    }
  }

  /* Lacquered-floor pass for the indoor decks: a reflection band of the wall
     color at the far edge and additive light pools under the fixtures. */
  function floorGloss(ctx, camX, sky, pool, period, rate, offset) {
    const refl = ctx.createLinearGradient(0, WALL_BASE, 0, WALL_BASE + 64);
    refl.addColorStop(0, sky); refl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = refl; ctx.fillRect(0, WALL_BASE, W, 64);
    if (WL.perf.lite) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const x0 = -wrapX(camX * rate + (offset || 0), period);
    for (let x = x0; x < W + period; x += period) {
      ctx.save(); ctx.translate(x, 262); ctx.scale(1, 0.34);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 110);
      g.addColorStop(0, pool); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-110, -110, 220, 220);
      ctx.restore();
    }
    ctx.restore();
  }

  function plantBg(ctx, camX, t) {
    // ================= LAYER 0: Deep Machinery Corridors (scroll 0.2) =================
    ctx.fillStyle = '#141822'; ctx.fillRect(0, 0, W, H);
    // Distant cooling fans & exhaust louvers
    const farX = -(camX * 0.2) % 180;
    for (let x = farX - 180; x < W + 180; x += 180) {
      D.circle(ctx, x + 90, 80, 42, '#0c1018', '#222d3d');
      // rotating fan blades in shadow
      ctx.save(); ctx.translate(x + 90, 80); ctx.rotate(t * 3.5);
      ctx.fillStyle = '#1e2634';
      for (let b = 0; b < 4; b++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-4, -38, 8, 38); }
      ctx.restore();
      D.circle(ctx, x + 90, 80, 10, '#2e3b4e');
    }

    // ================= LAYER 1: Steam Pipes & Catwalks (scroll 0.45) =================
    // Back wall steel panels
    const px = -(camX * 0.45) % 110;
    for (let x = px - 110; x < W + 110; x += 110) {
      ctx.fillStyle = '#222a36'; ctx.fillRect(x + 2, 38, 106, WALL_BASE - 38);
      ctx.fillStyle = '#181e28'; ctx.fillRect(x + 2, 38, 106, 2);
      for (const [rx, ry] of [[8, 44], [98, 44], [8, WALL_BASE - 8], [98, WALL_BASE - 8]]) D.circle(ctx, x + rx, ry, 2, '#0e131b');
    }
    // Heavy overhead copper and insulated coolant pipes
    const pipes = [[52, 18, '#6b7b8c', '#3a4655'], [82, 12, '#9a6b3b', '#5c3e20'], [102, 16, '#4f687a', '#2d3e4c']];
    for (const [py, ph, col, colDark] of pipes) {
      D.fillRRect(ctx, -10, py, W + 20, ph, ph / 2, col, '#0e131b');
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, py + 2, W, 2);
      ctx.fillStyle = colDark; ctx.fillRect(0, py + ph - 3, W, 2);
      const bx = -(camX * 0.45) % 140;
      for (let x = bx - 140; x < W + 140; x += 140) {
        D.fillRRect(ctx, x, py - 3, 14, ph + 6, 2, '#3a4655', '#0e131b');
        // brass bolt
        D.circle(ctx, x + 7, py + ph / 2, 2, '#d4af37');
      }
    }

    // ================= LAYER 2: Control Consoles, Gauges, Volumetric Lights (scroll 0.72) =================
    const rnd = U.seeded(21);
    for (let i = 0; i < 20; i++) {
      const x = ((i * 240 + rnd() * 120) - camX * 0.72) % (W * 4) - W;
      if (x < -90 || x > W + 90) continue;
      if (i % 3 === 0) {
        // Vertical duct with ventilation slots
        D.fillRRect(ctx, x, 116, 32, WALL_BASE - 116, 2, '#55687d', '#0e131b');
        ctx.fillStyle = '#222d3a'; for (let y = 124; y < WALL_BASE - 6; y += 8) ctx.fillRect(x + 4, y, 24, 3);
      } else if (i % 3 === 1) {
        // Big brass pressure gauge with vibrating needle
        D.circle(ctx, x, 138, 14, '#f0f0f0', '#0e131b');
        D.circle(ctx, x, 138, 11, '#ffffff', '#999');
        ctx.strokeStyle = '#d33'; ctx.lineWidth = 2;
        const needleAngle = t * 4 + i;
        ctx.beginPath(); ctx.moveTo(x, 138); ctx.lineTo(x + Math.cos(needleAngle) * 9, 138 + Math.sin(needleAngle) * 9); ctx.stroke();
        D.circle(ctx, x, 138, 2, '#111');
        D.fillRRect(ctx, x - 14, 154, 28, 9, 1, '#c8322a', '#0e131b');
        T.draw(ctx, 'PSI', x, 156, { size: 5, align: 'center', color: '#fff', shadow: false });
      } else {
        // Mainframe console with blinking LEDs
        D.fillRRect(ctx, x - 22, 122, 44, 48, 2, '#384655', '#0e131b');
        ctx.fillStyle = '#141e28'; ctx.fillRect(x - 18, 126, 36, 22);
        // LED matrix
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            const on = Math.sin(t * 8 + i + r * 4 + c) > 0;
            ctx.fillStyle = on ? (c === 3 ? '#ff3b30' : '#34c759') : '#112211';
            ctx.fillRect(x - 14 + c * 8, 130 + r * 8, 5, 5);
          }
        }
        T.draw(ctx, 'COMPRESSOR', x, 154, { size: 4, align: 'center', color: '#ffd23f', shadow: false });
      }
    }

    // Hanging Industrial Cage Lights with Volumetric Beams
    const lx = -(camX * 0.72) % 240;
    for (let x = lx - 240; x < W + 240; x += 240) {
      ctx.fillStyle = '#222'; ctx.fillRect(x - 1, 0, 2, 28);
      D.fillRRect(ctx, x - 18, 28, 36, 10, 2, '#5a626a', '#0e131b');
      // warm volumetric light cone washing down
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 5 + x);
      const lightGrad = ctx.createLinearGradient(0, 38, 0, WALL_BASE + 70);
      lightGrad.addColorStop(0, '#fff4b8');
      lightGrad.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(x - 16, 38); ctx.lineTo(x + 16, 38); ctx.lineTo(x + 95, WALL_BASE + 70); ctx.lineTo(x - 95, WALL_BASE + 70);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Industrial Warning Signs
    const sx = 280 - camX * 0.72;
    for (let k = 0; k < 4; k++) {
      const x = sx + k * 880;
      if (x > -220 && x < W + 60) {
        D.fillRRect(ctx, x, 114, 180, 30, 2, '#e8b800', '#0e131b');
        ctx.fillStyle = '#111'; for (let s = 0; s < 180; s += 16) ctx.fillRect(x + s, 114, 8, 3);
        T.draw(ctx, 'A/C PLANT - DECK 4', x + 90, 121, { size: 6, align: 'center', color: '#111', shadow: false });
        T.draw(ctx, 'HIGH PRESSURE COMPRESSOR', x + 90, 131, { size: 5, align: 'center', color: '#a00', shadow: false });
      }
    }

    // ================= FLOOR: Diamond Plate Metal Grate with Hazard Warning Stripes =================
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H);
    fg.addColorStop(0, '#434d5b'); fg.addColorStop(0.5, '#343c47'); fg.addColorStop(1, '#252b33');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);

    // Diamond plate tread pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    const ox = -(camX % 20);
    for (let x = ox - 20; x < W + 20; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 34, H); ctx.stroke();
    }
    for (let y = WALL_BASE + 8; y < H; y += 12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Diamond treads highlights
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let x = ox; x < W; x += 24) {
      for (let y = WALL_BASE + 6; y < H; y += 16) {
        ctx.fillRect(x + ((y / 16) % 2) * 12, y, 4, 1.5);
      }
    }

    // Caution Hazard Strip (Yellow & Black diagonal warning stripe)
    ctx.fillStyle = '#e8b800'; ctx.fillRect(0, WALL_BASE, W, 5);
    ctx.fillStyle = '#111116';
    const hzX = -(camX % 16);
    for (let x = hzX - 16; x < W + 16; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x + 8, WALL_BASE); ctx.lineTo(x + 3, WALL_BASE + 5); ctx.lineTo(x - 5, WALL_BASE + 5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, WALL_BASE + 5, W, 6);
    floorGloss(ctx, camX, 'rgba(120,150,190,0.18)', 'rgba(255,214,120,0.2)', 240, 0.72, 0);
  }

  function spaBg(ctx, camX, t) {
    // ================= LAYER 0: Atrium Glass & Tropical Sky (scroll 0.22) =================
    const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE);
    g.addColorStop(0, '#bfe9e3'); g.addColorStop(1, '#7cc4b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_BASE);

    // Large panoramic arch windows overlooking palms (scroll 0.22)
    const winX = -(camX * 0.22) % 180;
    for (let x = winX - 180; x < W + 180; x += 180) {
      // Arched solarium window
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + 90, 75, 42, Math.PI, 0);
      ctx.lineTo(x + 132, WALL_BASE - 10); ctx.lineTo(x + 48, WALL_BASE - 10);
      ctx.closePath(); ctx.clip();
      // Tropical sky and palm silhouettes through window
      const skyGrad = ctx.createLinearGradient(0, 30, 0, 130);
      skyGrad.addColorStop(0, '#5cbfe8'); skyGrad.addColorStop(1, '#a8e6cf');
      ctx.fillStyle = skyGrad; ctx.fillRect(x + 40, 30, 100, 110);
      // Sun & palm fronds
      D.circle(ctx, x + 115, 60, 14, '#fff9cc');
      ctx.fillStyle = '#2e7d32';
      for (let p = 0; p < 5; p++) {
        const pa = -0.8 + p * 0.4;
        ctx.save(); ctx.translate(x + 75, 100); ctx.rotate(pa);
        D.ellipse(ctx, 16, 0, 18, 4, '#2e7d32');
        ctx.restore();
      }
      ctx.restore();
      // Window frame
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + 90, 75, 42, Math.PI, 0); ctx.lineTo(x + 132, WALL_BASE - 10); ctx.lineTo(x + 48, WALL_BASE - 10); ctx.closePath(); ctx.stroke();
    }

    // ================= LAYER 1: Bamboo Screens & Resort Shelves (scroll 0.50) =================
    // Turquoise ceramic tile wall
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    const px = -(camX * 0.5) % 28;
    for (let x = px; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, WALL_BASE); ctx.stroke(); }
    for (let y = 70; y < WALL_BASE; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const rnd = U.seeded(33);
    for (let i = 0; i < 18; i++) {
      const x = ((i * 300 + rnd() * 140) - camX * 0.5) % (W * 4) - W;
      if (x < -120 || x > W + 120) continue;
      const kind = i % 3;
      if (kind === 0) {
        // Bamboo privacy screen
        for (let b = 0; b < 4; b++) {
          D.fillRRect(ctx, x + b * 9, 55 + b * 8, 6, WALL_BASE - 55 - b * 8, 3, '#78b548', '#385820');
          ctx.fillStyle = '#385820';
          for (let y = 80; y < WALL_BASE; y += 24) ctx.fillRect(x + b * 9, y + b * 4, 6, 2);
        }
      } else if (kind === 1) {
        // Resort towel shelf
        D.fillRRect(ctx, x - 28, 124, 56, 44, 2, '#6f4a28', '#3c2410');
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            D.fillRRect(ctx, x - 24 + c * 17, 128 + r * 12, 14, 9, 2, c === 1 ? '#e8fbf6' : '#d2f2ea', '#88ada5');
          }
        }
      } else {
        // Mandara Spa sign
        D.fillRRect(ctx, x - 45, 96, 90, 28, 4, '#1b5b50', '#0a2822');
        D.fillRRect(ctx, x - 43, 98, 86, 24, 3, '#26796b');
        T.draw(ctx, 'MANDARA SPA', x, 101, { size: 6, align: 'center', color: '#f0fff8' });
        T.draw(ctx, 'ORGANIC JUICE BAR', x, 112, { size: 5, align: 'center', color: '#ffe14a' });
      }
    }

    // ================= LAYER 2: Organic Juice Bar & Steam Jacuzzi (scroll 0.75) =================
    const bx = -(camX * 0.75) % 580;
    for (let k = -1; k < 3; k++) {
      const x = bx + k * 580;
      if (x < -320 || x > W + 100) continue;

      // Juice Bar Counter (White Carrara marble top with mint green base)
      D.fillRRect(ctx, x, 148, 250, 42, 4, '#3b8678', '#1a443c');
      D.fillRRect(ctx, x - 3, 144, 256, 7, 2, '#f2f8f6', '#98b8b0'); // marble slab

      // Glowing Drink Dispensers with Bubbling Liquid
      const juices = ['#88db36', '#ff9224', '#ff3870', '#ffd633'];
      for (let i = 0; i < 4; i++) {
        const jx = x + 35 + i * 54;
        // Glass canister
        D.fillRRect(ctx, jx - 9, 118, 18, 30, 2, juices[i], '#1a443c');
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(jx - 7, 120, 4, 26);
        // Chrome lid & tap
        D.fillRRect(ctx, jx - 11, 114, 22, 5, 1, '#e0e8e6', '#334');
        D.fillRRect(ctx, jx - 2, 142, 4, 6, 1, '#ccc', '#333');
        // Bubbles in juice
        ctx.fillStyle = '#fff';
        D.circle(ctx, jx + Math.sin(t * 3 + i) * 3, 136 - ((t * 14 + i * 8) % 18), 1.5);
      }
      T.draw(ctx, 'JUICE BAR', x + 125, 156, { size: 7, align: 'center', color: '#ffffff' });
      T.draw(ctx, 'KALE DETOX $18  LANCE: "NO."', x + 125, 168, { size: 5, align: 'center', color: '#ffe14a' });

      // Jacuzzi with billowing steam
      const jzX = x + 340;
      if (jzX < W + 120) {
        D.fillRRect(ctx, jzX - 55, 162, 110, 26, 8, '#2db4e0', '#bee8f5');
        // Animated steam particles rising
        ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffffff';
        for (let s = 0; s < 6; s++) {
          const sx = jzX - 40 + s * 16 + Math.sin(t * 2 + s) * 5;
          const sy = 160 - ((t * 22 + s * 14) % 36);
          D.circle(ctx, sx, sy, 8 + (s % 3) * 3);
        }
        ctx.restore();
      }
    }

    // ================= FLOOR: Turquoise & Pearl Spa Checkered Tiles =================
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H);
    fg.addColorStop(0, '#5fa89c'); fg.addColorStop(0.5, '#458c80'); fg.addColorStop(1, '#326f65');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);

    // Diagonal checkered pattern with water reflection sheen
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    const tileX = -(camX % 36);
    for (let y = WALL_BASE; y < H; y += 18) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let x = tileX - 36; x < W + 36; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 28, H); ctx.stroke();
    }
    // Alternate checkered highlights
    ctx.fillStyle = 'rgba(230,255,250,0.12)';
    for (let x = tileX; x < W; x += 36) {
      for (let y = WALL_BASE; y < H; y += 36) {
        ctx.fillRect(x + ((y / 18) % 2) * 18, y, 16, 16);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, WALL_BASE, W, 5);
    floorGloss(ctx, camX, 'rgba(210,255,245,0.3)', 'rgba(220,255,240,0.16)', 180, 0.22, -90);
  }

  function freezerBg(ctx, camX, t) {
    // ================= LAYER 0: Sub-Zero Vapor & Frost Coils (scroll 0.22) =================
    const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE);
    g.addColorStop(0, '#10172e'); g.addColorStop(0.6, '#18274d'); g.addColorStop(1, '#253f73');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_BASE);

    // Heavy cooling coils running in background
    const coilX = -(camX * 0.22) % 60;
    ctx.strokeStyle = '#2b4478'; ctx.lineWidth = 3;
    for (let x = coilX - 60; x < W + 60; x += 60) {
      ctx.beginPath();
      for (let y = 30; y < WALL_BASE - 20; y += 16) {
        ctx.arc(x + 15, y, 8, -Math.PI / 2, Math.PI / 2, false);
        ctx.arc(x + 15, y + 8, 8, Math.PI / 2, -Math.PI / 2, false);
      }
      ctx.stroke();
    }

    // ================= LAYER 1: Dessert Station Carousels & Icicles (scroll 0.50) =================
    // Stainless steel freezer wall panels with thick frost borders
    const px = -(camX * 0.5) % 96;
    for (let x = px - 96; x < W + 96; x += 96) {
      D.fillRRect(ctx, x + 3, 44, 90, WALL_BASE - 44, 3, '#324e7e', '#0b1324');
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x + 6, 48, 84, 8);
      // Frost snowflake crystals
      ctx.fillStyle = 'rgba(220,245,255,0.75)';
      for (let i = 0; i < 7; i++) ctx.fillRect(x + 8 + i * 13, 50 + (i % 3) * 4, 3, 3);
    }

    // Hanging glistening icicles along ceiling
    const icX = -(camX * 0.5) % 36;
    ctx.fillStyle = '#e2f4ff';
    for (let x = icX - 36; x < W + 36; x += 36) {
      for (let k = 0; k < 3; k++) {
        const kx = x + k * 12;
        ctx.beginPath();
        ctx.moveTo(kx, 42); ctx.lineTo(kx + 7, 42); ctx.lineTo(kx + 3.5, 54 + (k % 2) * 10);
        ctx.closePath(); ctx.fill();
      }
    }

    // ================= LAYER 2: Dessert Station & Soft-Serve Bar (scroll 0.75) =================
    const rnd = U.seeded(44);
    for (let i = 0; i < 16; i++) {
      const x = ((i * 280 + rnd() * 100) - camX * 0.75) % (W * 4) - W;
      if (x < -130 || x > W + 130) continue;
      const kind = i % 4;
      if (kind === 0) {
        // Soft-serve froyo machine with triple levers
        D.fillRRect(ctx, x - 26, 90, 52, 96, 4, '#d8e0ec', '#0e172a');
        ctx.fillStyle = '#ff3b7c'; ctx.fillRect(x - 22, 96, 44, 16);
        T.draw(ctx, 'FROYO', x, 100, { size: 6, align: 'center', color: '#fff', shadow: false });
        // Dispensers
        D.fillRRect(ctx, x - 14, 126, 6, 24, 1, '#667', '#0e172a');
        D.fillRRect(ctx, x - 3, 126, 6, 24, 1, '#667', '#0e172a');
        D.fillRRect(ctx, x + 8, 126, 6, 24, 1, '#667', '#0e172a');
        // Swirl nozzles
        D.circle(ctx, x - 11, 154, 4, '#ff69b4');
        D.circle(ctx, x, 154, 4, '#fff');
        D.circle(ctx, x + 11, 154, 4, '#8a5020');
      } else if (kind === 1) {
        // Multi-tier revolving cake display
        D.fillRRect(ctx, x - 36, 114, 72, 66, 4, '#6a8cb8', '#0e172a');
        ctx.fillStyle = 'rgba(230,248,255,0.4)'; ctx.fillRect(x - 32, 118, 64, 34);
        for (let c = 0; c < 3; c++) {
          D.fillRRect(ctx, x - 26 + c * 20, 132, 16, 12, 2, ['#ff8da1', '#ffe57f', '#795548'][c], '#0e172a');
          // Cherry on top
          D.circle(ctx, x - 18 + c * 20, 130, 2.5, '#e02020');
        }
      } else if (kind === 2) {
        // Carved Swan Ice Sculpture
        D.fillRRect(ctx, x - 20, 136, 40, 44, 2, '#486898', '#0e172a');
        ctx.save(); ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#c8ebff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 14, 136); ctx.bezierCurveTo(x - 18, 110, x + 8, 104, x + 4, 118);
        ctx.bezierCurveTo(x + 18, 110, x + 16, 136, x - 14, 136);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else {
        // Dessert Bar Neon Sign
        D.fillRRect(ctx, x - 55, 96, 110, 26, 3, '#101e38', '#ff3b7c');
        T.draw(ctx, 'DESSERT STATION', x, 100, { size: 6, align: 'center', color: '#ffe14a', shadow: false });
        T.draw(ctx, '75°F AND DROPPING', x, 110, { size: 5, align: 'center', color: '#7fe3ff', shadow: false });
      }
    }

    // Drifting sub-zero cold vapor fog across floor
    ctx.save(); ctx.globalAlpha = 0.16;
    for (let i = 0; i < 8; i++) {
      const fx = ((i * 125 + t * 14) % (W + 200)) - 100;
      D.ellipse(ctx, fx, WALL_BASE - 8 + (i % 2) * 12, 95, 18, '#d4f2ff');
    }
    ctx.restore();

    // ================= FLOOR: Frost-slicked Blue Diamond Floor Tiles =================
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H);
    fg.addColorStop(0, '#86add5'); fg.addColorStop(0.5, '#5b83b3'); fg.addColorStop(1, '#3b618e');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);

    // Frost tile grid
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    const ox = -(camX % 44);
    for (let y = WALL_BASE; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let x = ox - 44; x < W + 44; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 30, H); ctx.stroke();
    }
    // Frost crystals sparkling on tiles
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 36; i++) {
      const fx = ((i * 79 - camX) % (W + 40) + W + 40) % (W + 40) - 20;
      ctx.fillRect(fx, WALL_BASE + 8 + (i * 31) % (H - WALL_BASE - 12), 3, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(0, WALL_BASE, W, 6);
    floorGloss(ctx, camX, 'rgba(190,230,255,0.3)', 'rgba(170,220,255,0.18)', 192, 0.5, -48);
  }

  /* ---------------- helpers for wave data ---------------- */
  const grp = (...list) => list; // [type, count, opts]
  const wave = (x, groups, extra = {}) => ({ x, groups, ...extra });

  const LEVELS = [
    {
      id: 1, name: 'LIDO DECK BUFFET', short: 'LIDO DECK', temp: 94, subtitle: 'POOL DECK 11 — 94°F', music: 'lido', bg: lidoBg, fg: lidoFg, length: 2600, palette: '#c99a5b',
      banner: ['LIDO DECK', 'THE SALAD BAR CLOCKED IN'],
      intro: {
        title: 'LIDO DECK',
        lines: ['The salad bar has a union now. Their demand is you.', 'Ship temp: 94°F. The ice sculpture is sweating.', 'Lance: "Compressor first. The plate is a bonus."']
      },
      outro: { lines: ['The intake is packed with kale. Kale. In the air handler.', 'Lance: "That is not a filter. That is a lifestyle."', 'Duct tape. Spite. 94°F → 88°F.'] },
      objects: [
        { kind: 'plates', x: 200, y: 250, contents: ['chip'] },
        { kind: 'cart', x: 380, y: 300, contents: ['beans', 'burger'] },
        { kind: 'chair', x: 500, y: 235, contents: [] },
        { kind: 'tray', x: 740, y: 320, contents: ['beans'] },
        { kind: 'cooler', x: 1080, y: 250, contents: ['chili'] },
        { kind: 'plates', x: 1250, y: 240, contents: ['leftovers'] },
        { kind: 'chair', x: 1420, y: 330, contents: [] },
        { kind: 'cart', x: 1700, y: 320, contents: ['leftovers', 'chip'] },
        { kind: 'tray', x: 1950, y: 250, contents: ['burger'] },
        { kind: 'plates', x: 2150, y: 310, contents: ['beans'] },
        { kind: 'crate', x: 2300, y: 230, contents: ['turkey'] },
        { kind: 'chair', x: 2480, y: 330, contents: [] }
      ],
      pickups: [{ kind: 'beans', x: 720, y: 330 }, { kind: 'chip', x: 1350, y: 220 }],
      waves: [
        wave(260, [grp(['broccoli', 1, { side: 1 }])], { tutorial: '{attack}: SCREWDRIVER, WRENCH, PIPE WRENCH. THREE TOOLS. ONE ARGUMENT.' }),
        wave(560, [grp(['broccoli', 1, { side: 1 }], ['sprout', 2, { side: -1 }])], { tutorial: 'WALK INTO THEM. DUCT TAPE. KNEE, OR THROW THEM AT THEIR FRIENDS.' }),
        wave(950, [grp(['celery', 1, { side: 1 }], ['broccoli', 1, { side: 1 }]), grp(['sprout', 3, { side: -1 }])], { tutorial: '{special}: REFRIGERANT. FREEZES GREENS, NICKS YOUR HP. {tool}: THE TOOLBOX.' }),
        wave(1450, [grp(['broccoli', 2, { side: 1 }], ['celery', 1, { side: -1 }]), grp(['sprout', 2, { side: 1 }], ['broccoli', 1, { side: -1 }])], { tutorial: 'BEANS, CHILI, LEFTOVERS. FILL THE GREEN METER, THEN PRESS {fart}. TIP: WAIT A BEAT BEFORE THE 3RD HIT FOR A WRENCH POP.' }),
        wave(2050, [grp(['celery', 2, { side: 1 }], ['broccoli', 2, { side: -1 }], ['sprout', 2, { side: 1 }])]),
        wave(2400, [grp(['broccoli', 1, { side: 1, elite: true }], ['celery', 1, { side: -1 }]), grp(['sprout', 4, { side: 1 }])])
      ]
    },
    {
      id: 2, name: 'A/C PLANT', short: 'A/C PLANT', temp: 88, subtitle: 'DECK 4 — PIPE CORRIDORS — 88°F', music: 'plant', bg: plantBg, length: 2800, palette: '#48525f',
      banner: ['A/C PLANT', 'CARROTS WITH A BLACK BELT'],
      intro: { title: 'DECK 4: THE A/C PLANT', lines: ['Pipes hot enough to braise a carrot. The carrots noticed.', 'They brought shurikens. Lance brought a pipe wrench.', 'Lance: "Kung fu is not on the work order."'] },
      outro: { lines: ['Compressor rewired with duct tape and one unkind word.', 'Lance: "She\'ll hold till Maui. Maybe Tuesday."', '88°F → 81°F. Refrigerant is flowing. The carrots are not.'] },
      hazards: [
        { kind: 'steam', x: 700, y: 260, period: 3.2, offset: 0 },
        { kind: 'steam', x: 1500, y: 300, period: 2.8, offset: 1.2 },
        { kind: 'steam', x: 1560, y: 230, period: 2.8, offset: 0.3 },
        { kind: 'steam', x: 2300, y: 270, period: 2.4, offset: 0.8 }
      ],
      objects: [
        { kind: 'chair', x: 240, y: 240, contents: [] },
        { kind: 'barrel', x: 420, y: 320, contents: ['beans'] },
        { kind: 'tray', x: 620, y: 245, contents: ['chip'] },
        { kind: 'crate', x: 980, y: 240, contents: ['burger', 'chip'] },
        { kind: 'plates', x: 1400, y: 310, contents: ['beans'] },
        { kind: 'barrel', x: 1800, y: 330, contents: ['chili'] },
        { kind: 'chair', x: 2100, y: 245, contents: [] },
        { kind: 'crate', x: 2450, y: 260, contents: ['turkey', 'leftovers'] }
      ],
      pickups: [{ kind: 'leftovers', x: 1200, y: 330 }, { kind: 'coffee', x: 2000, y: 220 }],
      waves: [
        wave(280, [grp(['carrot', 2, { side: 1 }])]),
        wave(640, [grp(['broccoli', 2, { side: 1 }], ['carrot', 1, { side: -1 }]), grp(['spinach', 1, { side: 1 }])]),
        wave(1100, [grp(['carrot', 2, { side: -1 }], ['sprout', 3, { side: 1 }]), grp(['spinach', 1, { side: -1 }], ['broccoli', 1, { side: 1 }])]),
        wave(1650, [grp(['spinach', 2, { side: 1 }]), grp(['carrot', 3, { side: -1 }])]),
        wave(2200, [grp(['carrot', 2, { side: 1 }], ['broccoli', 2, { side: -1 }]), grp(['spinach', 1, { side: 1, elite: true }], ['sprout', 3, { side: -1 }])]),
        wave(2600, [grp(['spinach', 2, { side: -1 }], ['carrot', 2, { side: 1 }]), grp(['broccoli', 2, { side: 1 }], ['carrot', 1, { side: -1 }])])
      ]
    },
    {
      id: 3, name: 'SPA & JUICE BAR', short: 'JUICE BAR', temp: 81, subtitle: 'DECK 12 — ELITE GREENS — 81°F', music: 'spa', bg: spaBg, length: 2800, palette: '#6fb7ad',
      banner: ['SPA & JUICE BAR', 'KALE HAS A MEMBERSHIP'],
      intro: { title: 'SPA & JUICE BAR', lines: ['Coolant lines run under the cucumber water.', 'The kale has a trainer. The froyo has opinions.', 'Lance: "I don\'t do green juice. I do green meters."'] },
      outro: { lines: ['Juice bar: surrendered. Coolant: moving.', 'The freezer blinks -40°F and smells like a dare.', '81°F → 75°F. Something strawberry is awake.'] },
      objects: [
        { kind: 'plates', x: 260, y: 240, contents: ['chip'] },
        { kind: 'vending', x: 500, y: 240, contents: ['beans', 'chili', 'chip'] },
        { kind: 'chair', x: 750, y: 320, contents: [] },
        { kind: 'tray', x: 920, y: 250, contents: ['burger'] },
        { kind: 'plant', x: 1150, y: 320, contents: ['leftovers'] },
        { kind: 'plates', x: 1500, y: 310, contents: ['beans'] },
        { kind: 'vending', x: 1900, y: 250, contents: ['turkey', 'beans'] },
        { kind: 'chair', x: 2200, y: 240, contents: [] },
        { kind: 'plant', x: 2500, y: 230, contents: ['burger'] }
      ],
      pickups: [{ kind: 'chili', x: 800, y: 330 }, { kind: 'chip', x: 1600, y: 220 }, { kind: 'burger', x: 2200, y: 330 }],
      waves: [
        wave(300, [grp(['kale', 1, { side: 1 }], ['celery', 1, { side: -1 }])]),
        wave(700, [grp(['froyo', 2, { side: 1 }], ['sprout', 2, { side: -1 }])]),
        wave(1150, [grp(['kale', 1, { side: -1 }], ['carrot', 2, { side: 1 }]), grp(['froyo', 1, { side: 1 }], ['celery', 2, { side: -1 }])]),
        wave(1650, [grp(['spinach', 1, { side: 1 }], ['kale', 1, { side: -1 }]), grp(['froyo', 2, { side: 1 }])]),
        wave(2150, [grp(['kale', 2, { side: 1 }]), grp(['carrot', 2, { side: -1 }], ['froyo', 1, { side: 1 }], ['celery', 1, { side: -1 }])]),
        wave(2600, [grp(['kale', 1, { side: 1, elite: true }], ['froyo', 2, { side: -1 }]), grp(['spinach', 1, { side: -1 }], ['kale', 1, { side: 1 }], ['sprout', 3, { side: 1 }])])
      ]
    },
    {
      id: 4, name: 'FREEZER / DESSERT STATION', short: 'THE FREEZER', temp: 75, subtitle: 'DECK 3 — -40°F — FINAL', music: 'freezer', bg: freezerBg, length: 1900, palette: '#8fb6dc', boss: true,
      banner: ['THE FREEZER', 'DESSERT HAS A GRIEVANCE'],
      intro: { title: 'THE FREEZER', lines: ['Last valve. Behind the dessert station. Of course.', 'It is cold. It is quiet. It is strawberry.', 'Lance: "I have never liked frozen yogurt. Filing that now."'] },
      objects: [
        { kind: 'plates', x: 220, y: 240, contents: ['chip'] },
        { kind: 'cooler', x: 380, y: 320, contents: ['chili', 'beans'] },
        { kind: 'tray', x: 550, y: 250, contents: ['beans'] },
        { kind: 'chair', x: 720, y: 330, contents: [] },
        { kind: 'crate', x: 900, y: 240, contents: ['turkey', 'chip'] },
        { kind: 'plates', x: 1100, y: 310, contents: ['burger'] },
        { kind: 'cooler', x: 1350, y: 330, contents: ['chili', 'burger'] }
      ],
      pickups: [{ kind: 'beans', x: 600, y: 330 }, { kind: 'leftovers', x: 1150, y: 220 }, { kind: 'beans', x: 1800, y: 330 }, { kind: 'turkey', x: 1880, y: 230 }, { kind: 'chili', x: 1340, y: 220 }],
      waves: [
        wave(280, [grp(['froyo', 2, { side: 1 }], ['sprout', 2, { side: -1 }])]),
        wave(700, [grp(['kale', 1, { side: 1 }], ['froyo', 1, { side: -1 }], ['carrot', 1, { side: 1 }])]),
        wave(1150, [grp(['froyo', 2, { side: -1 }], ['spinach', 1, { side: 1 }]), grp(['broccoli', 2, { side: 1 }], ['froyo', 1, { side: -1 }])]),
        wave(1560, [], { boss: true })
      ]
    }
  ];

  /* Opening cutscene captions — panel order matches the attached art */
  const OPENING = [
    { img: 'cut1', title: 'HAWAII — UNDER THE SUN...', lines: ['Aboard the Pride of America, paradise is 94°F', 'and the ice sculpture is losing. The A/C is OUT.'] },
    { img: 'cut2', title: 'THE CAPTAIN CALLS FOR HELP', lines: ['Captain Andersen: "Get me WHALE LANCE', 'AIR CONDITIONING AND HEATING. Now."'] },
    { img: 'cut3', title: 'LANCE ARRIVES', lines: ['Captain: "Fix the A/C. And Lance...', 'STAY AWAY FROM THE BUFFET."', 'Lance: "I\'ll need that in writing."'] },
    { img: 'cut4', title: 'THE SALAD BAR STRIKES', lines: ['Deep in the ducts, the greens clock in.', 'Lance: "I fix ducts. I do not fix your diet."'] }
  ];

  const ENDING = [
    { lines: ['The cone is a strawberry puddle with regrets.', 'Lance turns the last valve like he means it.', 'A hum. A breeze. 72°F. The ship exhales.'] },
    { lines: ['Captain Andersen: "Lance. You look... svelte."', 'Lance: "Four decks, one salad-bar uprising,', 'and a fart with a work order. That\'s cardio."'] },
    { lines: ['Captain: "Buffet\'s open. You earned the carving station."', 'Lance: "Now you\'re speaking my language."', 'WHALE LANCE A/C — WE SPEAR THE COMPETITION.'] }
  ];

  WL.LEVELS = LEVELS;
  WL.OPENING = OPENING;
  WL.ENDING = ENDING;
  WL.WALL_BASE = WALL_BASE;
})();
