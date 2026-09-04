/* Level data: Pride of America ship spaces, enemy waves, breakables, hazards,
   procedurally drawn parallax backgrounds and the between-stage story beats. */
'use strict';

(function () {
  const U = WL.util, D = WL.draw, T = WL.text;
  const W = WL.W, H = WL.H, FT = WL.FLOOR_TOP, FB = WL.FLOOR_BOTTOM;
  const WALL_BASE = FT - 22; // where the back wall meets the floor

  /* ---------------- background painters ---------------- */
  function skyOcean(ctx, camX, t, opts = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, opts.top || '#2e7bd6'); g.addColorStop(1, opts.bottom || '#9fd7f5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 130);
    // sun
    D.circle(ctx, 520 - camX * 0.05, 40, 22, '#fff3a0');
    ctx.save(); ctx.globalAlpha = 0.35; D.circle(ctx, 520 - camX * 0.05, 40, 34, '#fff3a0'); ctx.restore();
    // distant island (Diamond Head)
    ctx.fillStyle = '#5a7f5a';
    ctx.beginPath(); const ix = 60 - camX * 0.08; ctx.moveTo(ix - 120, 128); ctx.lineTo(ix, 96); ctx.lineTo(ix + 60, 88); ctx.lineTo(ix + 130, 100); ctx.lineTo(ix + 260, 128); ctx.closePath(); ctx.fill();
    // ocean
    const og = ctx.createLinearGradient(0, 126, 0, 180); og.addColorStop(0, '#1e6fc0'); og.addColorStop(1, '#0f4f96');
    ctx.fillStyle = og; ctx.fillRect(0, 126, W, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 26; i++) { const wx = ((i * 97 - camX * 0.15 + t * 12) % (W + 60)) - 30; const wy = 132 + (i * 13) % 44; ctx.fillRect(wx, wy, 14 + (i % 3) * 6, 1.5); }
  }

  function lidoBg(ctx, camX, t) {
    skyOcean(ctx, camX, t);
    // railing (mid parallax)
    const px = -(camX * 0.5) % 40;
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 150, W, 5); ctx.fillRect(0, 168, W, 3);
    for (let x = px; x < W + 40; x += 40) ctx.fillRect(x, 150, 4, 34);
    // deck back wall / superstructure with windows
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(0, 118, W, 0);
    // pool (mid)
    const poolX = 240 - camX * 0.5;
    D.fillRRect(ctx, poolX, 176, 220, 14, 4, '#39b6e8', '#dcdcdc');
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) ctx.fillRect(poolX + 10 + i * 34 + Math.sin(t * 2 + i) * 4, 180 + (i % 2) * 5, 16, 1.5);
    // deck chairs and umbrellas (mid)
    const rnd = U.seeded(7);
    for (let i = 0; i < 14; i++) {
      const cx = ((i * 260 + rnd() * 100) - camX * 0.5) % (W * 3) - W;
      if (cx < -60 || cx > W + 60) continue;
      const kind = i % 3;
      if (kind === 0) { // umbrella
        ctx.fillStyle = '#c8322a'; ctx.beginPath(); ctx.moveTo(cx - 26, 172); ctx.lineTo(cx, 152); ctx.lineTo(cx + 26, 172); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 9, 172); ctx.lineTo(cx, 152); ctx.lineTo(cx + 9, 172); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#555'; ctx.fillRect(cx - 1, 172, 2, 14);
      } else { // lounge chair
        D.fillRRect(ctx, cx - 18, 176, 36, 6, 2, kind === 1 ? '#3a78c8' : '#f0c040', '#333');
        ctx.fillStyle = '#333'; ctx.fillRect(cx - 16, 182, 2, 5); ctx.fillRect(cx + 14, 182, 2, 5);
      }
    }
    // buffet counter along the back (mid-front)
    const bx = 60 - camX * 0.8;
    for (let k = 0; k < 6; k++) {
      const x = bx + k * 700;
      if (x < -300 || x > W + 100) continue;
      D.fillRRect(ctx, x, 156, 260, 34, 3, '#8a5a2a', '#3a2410');
      ctx.fillStyle = '#c8322a'; ctx.fillRect(x, 150, 260, 8); ctx.fillStyle = '#fff'; for (let i = 0; i < 13; i++) ctx.fillRect(x + i * 20, 150, 10, 8);
      for (let i = 0; i < 6; i++) { D.ellipse(ctx, x + 24 + i * 40, 157, 14, 5, '#e0e4ea', '#555'); ctx.fillStyle = ['#e8c060', '#c8843a', '#a05a2a', '#e04040', '#f0e0a0', '#7ab040'][i]; ctx.beginPath(); ctx.ellipse(x + 24 + i * 40, 154, 10, 4, 0, Math.PI, 0); ctx.fill(); }
      T.draw(ctx, 'LIDO BUFFET', x + 130, 138, { size: 8, align: 'center', color: '#fff' });
    }
    // deck floor: planks
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H); fg.addColorStop(0, '#c99a5b'); fg.addColorStop(1, '#a5783f');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);
    ctx.strokeStyle = 'rgba(80,50,20,0.35)'; ctx.lineWidth = 1;
    for (let y = WALL_BASE + 8; y < H; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const ox = -(camX % 90);
    for (let x = ox; x < W; x += 90) for (let y = WALL_BASE; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(x + ((y / 14) % 2) * 45, y); ctx.lineTo(x + ((y / 14) % 2) * 45, y + 14); ctx.stroke(); }
    // edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, WALL_BASE, W, 6);
  }

  function plantBg(ctx, camX, t) {
    // dark engineering space
    ctx.fillStyle = '#1b2230'; ctx.fillRect(0, 0, W, H);
    // back wall panels
    const px = -(camX * 0.6) % 120;
    for (let x = px - 120; x < W + 120; x += 120) {
      ctx.fillStyle = '#26303f'; ctx.fillRect(x + 2, 40, 116, WALL_BASE - 40);
      ctx.fillStyle = '#1b2230'; ctx.fillRect(x + 2, 40, 116, 2);
      for (const [rx, ry] of [[8, 46], [108, 46], [8, WALL_BASE - 8], [108, WALL_BASE - 8]]) D.circle(ctx, x + rx, ry, 2, '#0e131b');
    }
    // big horizontal pipes
    const pipes = [[54, 18, '#5b6b7c'], [84, 10, '#7b5b3b'], [104, 14, '#4b5b6c']];
    for (const [py, ph, col] of pipes) {
      D.fillRRect(ctx, -10, py, W + 20, ph, ph / 2, col, '#0e131b');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, py + 2, W, 2);
      const bx = -(camX * 0.6) % 160;
      for (let x = bx; x < W + 160; x += 160) D.fillRRect(ctx, x, py - 3, 14, ph + 6, 2, '#3a4655', '#0e131b');
    }
    // vertical ducts and gauges
    const rnd = U.seeded(21);
    for (let i = 0; i < 20; i++) {
      const x = ((i * 240 + rnd() * 120) - camX * 0.6) % (W * 4) - W;
      if (x < -80 || x > W + 80) continue;
      if (i % 3 === 0) {
        D.fillRRect(ctx, x, 120, 28, WALL_BASE - 120, 2, '#66788c', '#0e131b');
        ctx.fillStyle = '#33404f'; for (let y = 128; y < WALL_BASE - 6; y += 10) ctx.fillRect(x + 4, y, 20, 3);
      } else if (i % 3 === 1) {
        D.circle(ctx, x, 140, 12, '#e8e8e8', '#0e131b'); ctx.strokeStyle = '#c33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x + Math.cos(t * 3 + i) * 8, 140 + Math.sin(t * 3 + i) * 8); ctx.stroke();
        D.fillRRect(ctx, x - 12, 154, 24, 8, 1, '#c8322a', '#0e131b');
      } else {
        D.fillRRect(ctx, x - 20, 126, 40, 44, 2, '#889', '#0e131b'); ctx.fillStyle = '#243'; ctx.fillRect(x - 16, 130, 32, 20); ctx.fillStyle = '#3f6'; ctx.fillRect(x - 14, 132 + (Math.sin(t * 4 + i) > 0 ? 0 : 6), 28, 3);
        T.draw(ctx, 'A/C', x, 154, { size: 6, align: 'center', color: '#fff' });
      }
    }
    // hanging lights
    const lx = -(camX * 0.8) % 260;
    for (let x = lx; x < W + 260; x += 260) {
      ctx.fillStyle = '#333'; ctx.fillRect(x - 1, 0, 2, 26); D.fillRRect(ctx, x - 16, 26, 32, 8, 2, '#6a6a6a', '#0e131b');
      ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.moveTo(x - 14, 34); ctx.lineTo(x + 14, 34); ctx.lineTo(x + 90, WALL_BASE + 60); ctx.lineTo(x - 90, WALL_BASE + 60); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // signs
    const sx = 300 - camX * 0.6;
    for (let k = 0; k < 4; k++) { const x = sx + k * 900; if (x > -200 && x < W + 50) { D.fillRRect(ctx, x, 118, 150, 28, 2, '#e8c000', '#0e131b'); T.draw(ctx, 'A/C PLANT - DECK 4', x + 75, 124, { size: 6, align: 'center', color: '#222', shadow: false }); T.draw(ctx, 'AUTHORIZED ONLY', x + 75, 134, { size: 6, align: 'center', color: '#222', shadow: false }); } }
    // grated metal floor
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H); fg.addColorStop(0, '#48525f'); fg.addColorStop(1, '#2f3741');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    const ox = -(camX % 24);
    for (let x = ox; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 30, H); ctx.stroke(); }
    for (let y = WALL_BASE + 10; y < H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#e8c000'; ctx.fillRect(0, WALL_BASE, W, 3); ctx.fillStyle = '#111'; for (let x = ox; x < W; x += 24) ctx.fillRect(x, WALL_BASE, 12, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, WALL_BASE + 3, W, 6);
  }

  function spaBg(ctx, camX, t) {
    // serene teal spa
    const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE); g.addColorStop(0, '#c9ece6'); g.addColorStop(1, '#8fcfc4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_BASE);
    // tile wall
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    const px = -(camX * 0.6) % 32;
    for (let x = px; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, WALL_BASE); ctx.stroke(); }
    for (let y = 70; y < WALL_BASE; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // bamboo + window with ocean
    const rnd = U.seeded(33);
    for (let i = 0; i < 18; i++) {
      const x = ((i * 300 + rnd() * 140) - camX * 0.6) % (W * 4) - W;
      if (x < -120 || x > W + 120) continue;
      const kind = i % 4;
      if (kind === 0) { // round window with ocean
        D.circle(ctx, x, 120, 34, '#3e9fe0', '#e6e6e6'); ctx.fillStyle = '#7fd0f8'; ctx.fillRect(x - 34, 86, 68, 26); ctx.save(); ctx.beginPath(); ctx.arc(x, 120, 34, 0, 7); ctx.clip(); ctx.fillStyle = '#7fd0f8'; ctx.fillRect(x - 40, 80, 80, 40); ctx.restore(); ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, 120, 34, 0, 7); ctx.stroke();
      } else if (kind === 1) { // bamboo
        for (let b = 0; b < 3; b++) { D.fillRRect(ctx, x + b * 9, 60 + b * 10, 6, WALL_BASE - 60 - b * 10, 3, '#7fb85a', '#456'); ctx.fillStyle = '#456'; for (let y = 90; y < WALL_BASE; y += 30) ctx.fillRect(x + b * 9, y + b * 5, 6, 2); }
      } else if (kind === 2) { // towel shelf
        D.fillRRect(ctx, x - 30, 130, 60, 40, 2, '#7a5a3a', '#345'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) D.fillRRect(ctx, x - 26 + c * 18, 134 + r * 11, 16, 9, 2, c === 1 ? '#f4f1ea' : '#e2dccd', '#999');
      } else { // spa sign
        D.fillRRect(ctx, x - 40, 100, 80, 26, 4, '#2a6b60', '#123'); T.draw(ctx, 'MANDARA SPA', x, 105, { size: 6, align: 'center', color: '#e8f8f0' }); T.draw(ctx, 'JUICE BAR ->', x, 115, { size: 6, align: 'center', color: '#ffe' });
      }
    }
    // juice bar counter (mid-front)
    const bx = 200 - camX * 0.8;
    for (let k = 0; k < 5; k++) {
      const x = bx + k * 760;
      if (x < -300 || x > W + 100) continue;
      D.fillRRect(ctx, x, 150, 240, 40, 4, '#c8a878', '#5a4a2a');
      ctx.fillStyle = '#4a9a8a'; ctx.fillRect(x, 150, 240, 8);
      // blenders and fruit
      for (let i = 0; i < 4; i++) { const jx = x + 30 + i * 56; D.fillRRect(ctx, jx - 8, 122, 16, 28, 2, ['#8bd44a', '#f08a1e', '#e8407a', '#f0d040'][i], '#345'); D.fillRRect(ctx, jx - 10, 118, 20, 5, 1, '#ddd', '#345'); }
      T.draw(ctx, 'JUICE BAR', x + 120, 158, { size: 7, align: 'center', color: '#fff' });
      T.draw(ctx, 'KALE SMOOTHIE $14', x + 120, 170, { size: 5, align: 'center', color: '#ffe' });
    }
    // hot tub steam
    const hx = 560 - camX * 0.8;
    for (let k = 0; k < 5; k++) { const x = hx + k * 760; if (x > -100 && x < W + 100) { D.fillRRect(ctx, x - 60, 168, 120, 22, 8, '#3e9fe0', '#dde'); ctx.save(); ctx.globalAlpha = 0.25; for (let i = 0; i < 5; i++) D.circle(ctx, x - 40 + i * 20, 160 - ((t * 20 + i * 17) % 40), 10 + (i % 3) * 3, '#fff'); ctx.restore(); } }
    // floor: teal tiles
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H); fg.addColorStop(0, '#6fb7ad'); fg.addColorStop(1, '#4a8f86');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    const ox = -(camX % 40);
    for (let y = WALL_BASE; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = ox; x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 24, H); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, WALL_BASE, W, 5);
  }

  function freezerBg(ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE); g.addColorStop(0, '#16203a'); g.addColorStop(1, '#2b4a78');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_BASE);
    // steel panels with frost
    const px = -(camX * 0.6) % 100;
    for (let x = px - 100; x < W + 100; x += 100) {
      D.fillRRect(ctx, x + 2, 50, 96, WALL_BASE - 50, 3, '#3a5a8a', '#101a2e');
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 6, 54, 88, 10);
      // frost crystals
      ctx.fillStyle = 'rgba(220,240,255,0.7)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 8 + i * 15, 56 + (i % 3) * 4, 3, 3);
    }
    // dessert station displays
    const rnd = U.seeded(44);
    for (let i = 0; i < 16; i++) {
      const x = ((i * 280 + rnd() * 100) - camX * 0.6) % (W * 4) - W;
      if (x < -120 || x > W + 120) continue;
      const kind = i % 4;
      if (kind === 0) { // soft-serve machine
        D.fillRRect(ctx, x - 24, 96, 48, 90, 4, '#cfd6e0', '#101a2e'); ctx.fillStyle = '#e85a8a'; ctx.fillRect(x - 20, 104, 40, 14); T.draw(ctx, 'FROYO', x, 107, { size: 6, align: 'center', color: '#fff', shadow: false }); D.fillRRect(ctx, x - 6, 130, 5, 20, 1, '#555', '#101a2e'); D.fillRRect(ctx, x + 2, 130, 5, 20, 1, '#555', '#101a2e');
      } else if (kind === 1) { // cake display
        D.fillRRect(ctx, x - 34, 120, 68, 60, 3, '#8ab0d8', '#101a2e'); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 30, 124, 60, 30);
        for (let c = 0; c < 3; c++) { D.fillRRect(ctx, x - 26 + c * 20, 136, 14, 10, 2, ['#f7a7c7', '#f0e0a0', '#7a4a2a'][c], '#101a2e'); }
      } else if (kind === 2) { // hanging icicles
        for (let k = 0; k < 6; k++) { ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.moveTo(x + k * 12, 48); ctx.lineTo(x + k * 12 + 8, 48); ctx.lineTo(x + k * 12 + 4, 60 + (k % 3) * 8); ctx.closePath(); ctx.fill(); }
      } else { // freezer sign
        D.fillRRect(ctx, x - 44, 100, 88, 24, 3, '#e8e8e8', '#101a2e'); T.draw(ctx, 'DESSERT STATION', x, 104, { size: 5, align: 'center', color: '#222', shadow: false }); T.draw(ctx, '-40F  KEEP CLOSED', x, 113, { size: 5, align: 'center', color: '#c22', shadow: false });
      }
    }
    // cold fog
    ctx.save(); ctx.globalAlpha = 0.12;
    for (let i = 0; i < 7; i++) D.ellipse(ctx, ((i * 140 + t * 10) % (W + 200)) - 100, WALL_BASE - 10 + (i % 2) * 10, 90, 16, '#dff');
    ctx.restore();
    // floor: frosty blue tiles
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H); fg.addColorStop(0, '#8fb6dc'); fg.addColorStop(1, '#5d86b4');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    const ox = -(camX % 48);
    for (let y = WALL_BASE; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = ox; x < W + 48; x += 48) { ctx.beginPath(); ctx.moveTo(x, WALL_BASE); ctx.lineTo(x - 30, H); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 30; i++) { const fx = ((i * 83 - camX) % (W + 40) + W + 40) % (W + 40) - 20; ctx.fillRect(fx, WALL_BASE + 10 + (i * 37) % (H - WALL_BASE - 12), 3, 2); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, WALL_BASE, W, 5);
  }

  /* ---------------- helpers for wave data ---------------- */
  const grp = (...list) => list; // [type, count, opts]
  const wave = (x, groups, extra = {}) => ({ x, groups, ...extra });

  const LEVELS = [
    {
      id: 1, name: 'LIDO DECK BUFFET', subtitle: 'POOL DECK 11 — 94°F', music: 'lido', bg: lidoBg, length: 2600, palette: '#c99a5b',
      intro: {
        title: 'STAGE 1: LIDO DECK',
        lines: ['The buffet has been overrun by the salad bar.', 'Ship temp: 94°F and climbing.', 'Lance: "First the A/C. Then a plate."']
      },
      outro: { lines: ['Lance finds the main intake clogged with kale.', 'Lance: "Who put a SALAD in the air handler?"', 'Duct tape applied. Temp: 94°F -> 88°F.'] },
      objects: [
        { kind: 'cart', x: 380, y: 300, contents: ['beans', 'burger'] },
        { kind: 'cooler', x: 1080, y: 250, contents: ['chili'] },
        { kind: 'cart', x: 1700, y: 320, contents: ['leftovers', 'chip'] },
        { kind: 'crate', x: 2300, y: 230, contents: ['turkey'] }
      ],
      pickups: [{ kind: 'beans', x: 720, y: 330 }, { kind: 'chip', x: 1350, y: 220 }],
      waves: [
        wave(260, [grp(['broccoli', 1, { side: 1 }])], { tutorial: 'ATTACK: J (3-hit tool combo)' }),
        wave(560, [grp(['broccoli', 1, { side: 1 }], ['sprout', 2, { side: -1 }])], { tutorial: 'Walk into a stunned/idle enemy + J = DUCT-TAPE GRAB. Back+J to throw.' }),
        wave(950, [grp(['celery', 1, { side: 1 }], ['broccoli', 1, { side: 1 }]), grp(['sprout', 3, { side: -1 }])], { tutorial: 'SPECIAL: L = refrigerant spray (freezes). BOX: I = throw toolbox.' }),
        wave(1450, [grp(['broccoli', 2, { side: 1 }], ['celery', 1, { side: -1 }]), grp(['sprout', 2, { side: 1 }], ['broccoli', 1, { side: -1 }])], { tutorial: 'Eat BEANS / CHILI / LEFTOVERS to fill the VOLCANO FART meter. F when full!' }),
        wave(2050, [grp(['celery', 2, { side: 1 }], ['broccoli', 2, { side: -1 }], ['sprout', 2, { side: 1 }])]),
        wave(2400, [grp(['broccoli', 1, { side: 1, elite: true }], ['celery', 1, { side: -1 }]), grp(['sprout', 4, { side: 1 }])])
      ]
    },
    {
      id: 2, name: 'A/C PLANT', subtitle: 'DECK 4 — PIPE CORRIDORS — 88°F', music: 'plant', bg: plantBg, length: 2800, palette: '#48525f',
      intro: { title: 'STAGE 2: A/C PLANT', lines: ['Deck 4. The compressor room.', 'The pipes are hot, the vents blow steam,', 'and the carrots know kung fu.'] },
      outro: { lines: ['Lance rewires the compressor with duct tape and spite.', 'Lance: "That\'ll hold till Maui."', 'Temp: 88°F -> 81°F. Refrigerant flowing.'] },
      hazards: [
        { kind: 'steam', x: 700, y: 260, period: 3.2, offset: 0 },
        { kind: 'steam', x: 1500, y: 300, period: 2.8, offset: 1.2 },
        { kind: 'steam', x: 1560, y: 230, period: 2.8, offset: 0.3 },
        { kind: 'steam', x: 2300, y: 270, period: 2.4, offset: 0.8 }
      ],
      objects: [
        { kind: 'barrel', x: 420, y: 320, contents: ['beans'] },
        { kind: 'crate', x: 980, y: 240, contents: ['burger', 'chip'] },
        { kind: 'barrel', x: 1800, y: 330, contents: ['chili'] },
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
      id: 3, name: 'SPA & JUICE BAR', subtitle: 'DECK 12 — ELITE GREENS — 81°F', music: 'spa', bg: spaBg, length: 2800, palette: '#6fb7ad',
      intro: { title: 'STAGE 3: SPA & JUICE BAR', lines: ['The coolant lines run under the spa.', 'The juice bar is guarded by the elite:', 'kale bruisers, and the yogurt Lance despises.'] },
      outro: { lines: ['The juice bar surrenders. Coolant flowing.', 'But the freezer reads -40°F and something is moving.', 'Temp: 81°F -> 75°F. Almost there.'] },
      objects: [
        { kind: 'vending', x: 500, y: 240, contents: ['beans', 'chili', 'chip'] },
        { kind: 'plant', x: 1150, y: 320, contents: ['leftovers'] },
        { kind: 'vending', x: 1900, y: 250, contents: ['turkey', 'beans'] },
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
      id: 4, name: 'FREEZER / DESSERT STATION', subtitle: 'DECK 3 — -40°F — FINAL', music: 'freezer', bg: freezerBg, length: 1900, palette: '#8fb6dc', boss: true,
      intro: { title: 'FINAL STAGE: THE FREEZER', lines: ['The last valve is behind the dessert station.', 'It\'s cold. It\'s quiet. It smells like strawberry.', 'Lance: "I hate frozen yogurt."'] },
      objects: [
        { kind: 'cooler', x: 380, y: 320, contents: ['chili', 'beans'] },
        { kind: 'crate', x: 900, y: 240, contents: ['turkey', 'chip'] },
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
    { img: 'cut1', title: 'HAWAII — UNDER THE SUN...', lines: ['Aboard the Pride of America, paradise is 94 degrees', 'and climbing. The A/C is OUT.'] },
    { img: 'cut2', title: 'THE CAPTAIN CALLS FOR HELP', lines: ['Captain Andersen: "Get me WHALE LANCE', 'AIR CONDITIONING AND HEATING. Now!"'] },
    { img: 'cut3', title: 'LANCE ARRIVES', lines: ['Captain: "Fix the A/C. And Lance...', 'STAY AWAY FROM THE BUFFET."', 'Lance: "...No promises."'] },
    { img: 'cut4', title: 'HEALTHY FOOD ATTACK!', lines: ['Deep in the ducts, the salad bar strikes back.', 'Lance: "I fix ship systems... NOT YOUR DIET!"'] }
  ];

  const ENDING = [
    { lines: ['The Giant Froyo Cone melts into a strawberry puddle.', 'Lance turns the last valve.', 'A hum. A breeze. 72°F.'] },
    { lines: ['Captain Andersen: "Lance... you look... SVELTE."', 'Lance: "Four decks of stairs, three hundred vegetables,', 'and one very committed fart. It\'s called cardio."'] },
    { lines: ['Captain: "Buffet\'s open. You\'ve earned it."', 'Lance: "Now we\'re talking."', 'WHALE LANCE AIR CONDITIONING AND HEATING — WE SPEAR THE COMPETITION.'] }
  ];

  WL.LEVELS = LEVELS;
  WL.OPENING = OPENING;
  WL.ENDING = ENDING;
  WL.WALL_BASE = WALL_BASE;
})();
