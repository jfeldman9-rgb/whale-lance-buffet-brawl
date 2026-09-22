/* Level data: Pride of America ship spaces, enemy waves, breakables, hazards,
   procedurally drawn parallax backgrounds and the between-stage story beats. */
'use strict';

(function () {
  const U = WL.util, D = WL.draw, T = WL.text;
  const W = WL.W, H = WL.H, FT = WL.FLOOR_TOP, FB = WL.FLOOR_BOTTOM;
  const WALL_BASE = FT - 22; // where the back wall meets the floor

  /* ---------------- background painters ---------------- */
  function skyOcean(ctx, camX, t, opts = {}) {
    // Layer 0: Sky, Sun with rays, Clouds, Island, Ocean
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, opts.top || '#1a5fb4'); g.addColorStop(0.65, opts.mid || '#4a9fe8'); g.addColorStop(1, opts.bottom || '#bde4f8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 130);
    // sun rays & sun
    const sunX = 520 - camX * 0.05, sunY = 40;
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + t * 0.15;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(a) * 160, sunY + Math.sin(a) * 160);
      ctx.lineTo(sunX + Math.cos(a + 0.18) * 160, sunY + Math.sin(a + 0.18) * 160);
      ctx.closePath();
      ctx.fillStyle = '#fff6b0'; ctx.fill();
    }
    ctx.restore();
    D.circle(ctx, sunX, sunY, 22, '#fff3a0');
    ctx.save(); ctx.globalAlpha = 0.4; D.circle(ctx, sunX, sunY, 36, '#fff8c8'); ctx.restore();

    // distant drifting clouds (scroll 0.04)
    ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 180 + t * 6 - camX * 0.04) % (W + 200)) - 80;
      const cy = 25 + (i * 17) % 35;
      D.ellipse(ctx, cx, cy, 32 + (i % 2) * 10, 11, '#ffffff');
      D.ellipse(ctx, cx - 12, cy + 2, 22, 9, '#f0f6ff');
      D.ellipse(ctx, cx + 14, cy + 1, 24, 8, '#f0f6ff');
    }
    ctx.restore();

    // distant island (Diamond Head) (scroll 0.08)
    ctx.fillStyle = '#486e48';
    ctx.beginPath(); const ix = 60 - camX * 0.08; ctx.moveTo(ix - 140, 128); ctx.lineTo(ix, 92); ctx.lineTo(ix + 65, 84); ctx.lineTo(ix + 140, 98); ctx.lineTo(ix + 280, 128); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a593a';
    ctx.beginPath(); ctx.moveTo(ix - 40, 128); ctx.lineTo(ix + 65, 84); ctx.lineTo(ix + 140, 98); ctx.lineTo(ix + 190, 128); ctx.closePath(); ctx.fill();

    // distant cruise ship on horizon (scroll 0.12)
    const hx = ((800 - camX * 0.12 + t * 4) % (W + 400)) - 150;
    if (hx > -80 && hx < W + 80) {
      ctx.fillStyle = 'rgba(235,242,250,0.85)';
      ctx.fillRect(hx, 118, 55, 6); ctx.fillRect(hx + 10, 114, 35, 4); ctx.fillRect(hx + 20, 110, 15, 4);
      ctx.fillStyle = '#c8322a'; ctx.fillRect(hx + 24, 107, 7, 3);
      ctx.fillStyle = 'rgba(25,75,140,0.7)'; ctx.fillRect(hx + 4, 122, 47, 2);
    }

    // ocean (scroll 0.15)
    const og = ctx.createLinearGradient(0, 126, 0, 180); og.addColorStop(0, '#1967b5'); og.addColorStop(0.5, '#12549a'); og.addColorStop(1, '#0c3d78');
    ctx.fillStyle = og; ctx.fillRect(0, 126, W, 60);
    // ocean waves and glistening facets
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 32; i++) {
      const wx = ((i * 89 - camX * 0.15 + t * 15) % (W + 60)) - 30;
      const wy = 129 + (i * 13) % 46;
      ctx.fillRect(wx, wy, 16 + (i % 4) * 6, 1.5);
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(255,250,210,0.8)';
        ctx.fillRect(wx + 4, wy - 1, 3, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
      }
    }
  }

  function lidoBg(ctx, camX, t) {
    skyOcean(ctx, camX, t);

    // ================= LAYER 1: Promenade Windows & Railing (mid-far, scroll 0.35) =================
    // Upper deck promenade glass wall & white stanchions
    const rx = -(camX * 0.35) % 48;
    ctx.fillStyle = 'rgba(230,240,250,0.4)';
    ctx.fillRect(0, 142, W, 32);
    // Glass reflection diagonal sheen
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = rx - 48; x < W + 48; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x + 12, 174); ctx.lineTo(x + 28, 142); ctx.lineTo(x + 36, 142); ctx.lineTo(x + 20, 174);
      ctx.closePath(); ctx.fill();
    }
    // Railing posts & horizontal chrome bars
    ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 142, W, 5); ctx.fillRect(0, 160, W, 3); ctx.fillRect(0, 174, W, 3);
    ctx.fillStyle = '#d8dde6'; ctx.fillRect(0, 147, W, 2);
    for (let x = rx - 48; x < W + 48; x += 48) {
      ctx.fillStyle = '#eef1f5'; ctx.fillRect(x, 142, 5, 33);
      ctx.fillStyle = '#c5ccd6'; ctx.fillRect(x + 4, 142, 1, 33);
      // brass cap
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 1, 140, 7, 3);
    }
    // Striped sun awnings along upper promenade
    const awX = -(camX * 0.35) % 36;
    for (let x = awX - 36; x < W + 36; x += 36) {
      ctx.fillStyle = (Math.floor(x / 36) % 2 === 0) ? '#1b4a9a' : '#f8f8f8';
      ctx.beginPath();
      ctx.moveTo(x, 120); ctx.lineTo(x + 36, 120); ctx.lineTo(x + 30, 136); ctx.lineTo(x - 6, 136);
      ctx.closePath(); ctx.fill();
    }

    // Lifebuoy on the rail
    const buoy = ((420 - camX * 0.35) % (W * 2) + W * 2) % (W * 2) - 100;
    if (buoy > -30 && buoy < W + 30) {
      D.circle(ctx, buoy, 156, 12, '#e23b2f', '#fff');
      D.circle(ctx, buoy, 156, 5, '#f4f4f8', '#c8322a');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(buoy - 9, 156); ctx.lineTo(buoy + 9, 156); ctx.moveTo(buoy, 147); ctx.lineTo(buoy, 165); ctx.stroke();
      T.draw(ctx, 'PRIDE', buoy, 148, { size: 4, align: 'center', color: '#fff', shadow: false });
    }

    // Deck pool with sun glitter (scroll 0.35)
    const poolX = ((240 - camX * 0.35) % (W * 2.5) + W * 2.5) % (W * 2.5) - 200;
    if (poolX > -240 && poolX < W + 40) {
      D.fillRRect(ctx, poolX, 168, 200, 15, 4, '#2db4e8', '#dcdcdc');
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 7; i++) ctx.fillRect(poolX + 12 + i * 26 + Math.sin(t * 2.5 + i) * 4, 172 + (i % 2) * 5, 14, 1.5);
    }

    // ================= LAYER 2: Grand Buffet Stations & Dining Room (mid, scroll 0.65) =================
    // Buffet counters, carved ice sculptures, heat lamps, and dining tables
    const bx = -(camX * 0.65) % 520;
    for (let k = -1; k < 3; k++) {
      const x = bx + k * 520;
      if (x < -360 || x > W + 80) continue;

      // Buffet Grand Service Bar
      D.fillRRect(ctx, x, 148, 280, 40, 4, '#7c4c22', '#2d1808');
      // Mahogany paneling inlays
      ctx.fillStyle = '#5c3514';
      for (let p = 0; p < 5; p++) D.fillRRect(ctx, x + 10 + p * 54, 158, 46, 26, 2, '#5c3514', '#3c200a');
      // Marble buffet countertop
      D.fillRRect(ctx, x - 4, 145, 288, 7, 2, '#f4ede2', '#a09080');

      // Sneeze Guard Glass & Brass Frame
      ctx.fillStyle = 'rgba(210,240,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(x + 10, 145); ctx.lineTo(x + 20, 126); ctx.lineTo(x + 260, 126); ctx.lineTo(x + 270, 145);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; // brass frame
      ctx.beginPath();
      ctx.moveTo(x + 8, 145); ctx.lineTo(x + 18, 125); ctx.lineTo(x + 262, 125); ctx.lineTo(x + 272, 145);
      ctx.stroke();

      // Amber Heat Lamps with Warm Glow Cones
      for (let h = 0; h < 3; h++) {
        const hx = x + 40 + h * 90;
        // Hanging brass lamp fixture
        ctx.fillStyle = '#b8860b'; ctx.fillRect(hx - 1, 114, 2, 12);
        D.fillRRect(ctx, hx - 12, 124, 24, 7, 2, '#d4af37', '#6b4a08');
        // Warm amber glow cone washing onto food dishes
        ctx.save();
        const lampGlow = ctx.createRadialGradient(hx, 128, 4, hx, 146, 32);
        lampGlow.addColorStop(0, 'rgba(255,190,70,0.35)');
        lampGlow.addColorStop(1, 'rgba(255,190,70,0)');
        ctx.fillStyle = lampGlow;
        ctx.beginPath();
        ctx.moveTo(hx - 10, 128); ctx.lineTo(hx + 10, 128); ctx.lineTo(hx + 30, 155); ctx.lineTo(hx - 30, 155);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Steaming Chafing Dishes with Food Inside
      const foods = ['#e8a838', '#c03a20', '#6aa828', '#f2d878', '#a84c20'];
      for (let i = 0; i < 5; i++) {
        const dx = x + 24 + i * 50;
        // Metal tray
        D.ellipse(ctx, dx, 150, 16, 5, '#e0e4ec', '#4a5060');
        // Food inside
        ctx.fillStyle = foods[i % foods.length];
        ctx.beginPath(); ctx.ellipse(dx, 148, 12, 4, 0, Math.PI, 0); ctx.fill();
        // Steam puffs
        ctx.save(); ctx.globalAlpha = 0.28 + 0.15 * Math.sin(t * 3 + i);
        ctx.fillStyle = '#fff';
        D.circle(ctx, dx + Math.sin(t * 2 + i) * 3, 140 - ((t * 18 + i * 11) % 16), 3.5);
        ctx.restore();
      }

      // Marquee Banner on Buffet Center
      D.fillRRect(ctx, x + 70, 110, 140, 16, 3, '#10285a', '#d4af37');
      T.draw(ctx, 'PRIDE OF AMERICA', x + 140, 112, { size: 5, align: 'center', color: '#ffe14a' });
      T.draw(ctx, 'ALOHA LIDO BUFFET', x + 140, 118, { size: 6, align: 'center', color: '#ffffff' });

      // Dining Table alongside (with white linen tablecloth & chairs)
      const tx = x + 330;
      if (tx < W + 60) {
        // Banquet Chairs behind table
        for (const cx of [-22, 22]) {
          D.fillRRect(ctx, tx + cx - 8, 140, 16, 20, 2, '#8a1f28', '#400c10'); // burgundy upholstery
          ctx.fillStyle = '#d4af37'; ctx.fillRect(tx + cx - 7, 138, 14, 2); // gold trim
        }
        // Round dining table with draped tablecloth
        D.ellipse(ctx, tx, 158, 30, 9, '#f8f9fa', '#ced4da');
        // Table skirt
        ctx.fillStyle = '#eef0f4';
        ctx.beginPath(); ctx.moveTo(tx - 30, 158); ctx.lineTo(tx + 30, 158); ctx.lineTo(tx + 24, 178); ctx.lineTo(tx - 24, 178); ctx.closePath(); ctx.fill();
        // Burgundy table runner & centerpiece
        ctx.fillStyle = '#8a1f28'; ctx.fillRect(tx - 6, 152, 12, 14);
        // Fruit bowl / condiments
        D.ellipse(ctx, tx, 153, 7, 3, '#d4af37', '#555');
        D.circle(ctx, tx - 2, 150, 3, '#e83030'); // apple
        D.circle(ctx, tx + 2, 150, 3, '#f0a820'); // orange
      }
    }

    // ================= FLOOR: Cruise Ship Teak Planks & Ornate Dining Carpet Runner =================
    // Teak floor base
    const fg = ctx.createLinearGradient(0, WALL_BASE, 0, H);
    fg.addColorStop(0, '#caa066'); fg.addColorStop(0.5, '#b4854c'); fg.addColorStop(1, '#966732');
    ctx.fillStyle = fg; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);

    // Teak plank seams
    ctx.strokeStyle = 'rgba(70,40,15,0.32)'; ctx.lineWidth = 1;
    for (let y = WALL_BASE + 6; y < H; y += 13) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    const plankX = -(camX % 80);
    for (let x = plankX; x < W; x += 80) {
      for (let y = WALL_BASE; y < H; y += 26) {
        ctx.beginPath();
        const off = ((y / 13) % 2) * 40;
        ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + 13); ctx.stroke();
      }
    }

    // Grand Pride of America Center Carpet Runner (Cruise ship luxury dining feel!)
    const runnerTop = WALL_BASE + 20, runnerBot = H - 18;
    // Outer navy trim with gold border
    ctx.fillStyle = '#142548'; ctx.fillRect(0, runnerTop, W, runnerBot - runnerTop);
    ctx.fillStyle = '#d4af37'; ctx.fillRect(0, runnerTop, W, 2); ctx.fillRect(0, runnerBot - 2, W, 2);
    // Rich royal crimson center
    ctx.fillStyle = '#881b24'; ctx.fillRect(0, runnerTop + 6, W, (runnerBot - runnerTop) - 12);
    // Hawaiian gold floral / diamond pattern on carpet (scrolls with camX)
    const patX = -(camX % 44);
    ctx.fillStyle = 'rgba(240,210,120,0.38)';
    for (let px = patX - 44; px < W + 44; px += 44) {
      const cy = (runnerTop + runnerBot) / 2;
      // Diamond medallion
      ctx.beginPath();
      ctx.moveTo(px, cy - 14); ctx.lineTo(px + 12, cy); ctx.lineTo(px, cy + 14); ctx.lineTo(px - 12, cy);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(px - 2, cy - 2, 4, 4);
    }

    // Shadow where wall meets floor
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, WALL_BASE, W, 6);
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
  }

  /* ---------------- helpers for wave data ---------------- */
  const grp = (...list) => list; // [type, count, opts]
  const wave = (x, groups, extra = {}) => ({ x, groups, ...extra });

  const LEVELS = [
    {
      id: 1, name: 'LIDO DECK BUFFET', short: 'LIDO DECK', temp: 94, subtitle: 'POOL DECK 11 — 94°F', music: 'lido', bg: lidoBg, length: 2600, palette: '#c99a5b',
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
        wave(260, [grp(['broccoli', 1, { side: 1 }])], { tutorial: 'E OR J: SCREWDRIVER, WRENCH, PIPE WRENCH. THREE TOOLS. ONE ARGUMENT.' }),
        wave(560, [grp(['broccoli', 1, { side: 1 }], ['sprout', 2, { side: -1 }])], { tutorial: 'WALK INTO THEM. DUCT TAPE. KNEE, OR THROW THEM AT THEIR FRIENDS.' }),
        wave(950, [grp(['celery', 1, { side: 1 }], ['broccoli', 1, { side: 1 }]), grp(['sprout', 3, { side: -1 }])], { tutorial: 'Q: REFRIGERANT. FREEZES GREENS, NICKS YOUR HP. R: THE TOOLBOX.' }),
        wave(1450, [grp(['broccoli', 2, { side: 1 }], ['celery', 1, { side: -1 }]), grp(['sprout', 2, { side: 1 }], ['broccoli', 1, { side: -1 }])], { tutorial: 'BEANS, CHILI, LEFTOVERS. FILL THE GREEN METER. THEN APOLOGIZE.' }),
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
