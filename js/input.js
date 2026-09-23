/* Unified keyboard + gamepad + touch input.
   Actions: attack, jump, special, tool, fart, start, pause, mute, fullscreen
   Movement: axis.x / axis.y in [-1, 1]. */
'use strict';

WL.input = (function () {
  // Two layouts on purpose:
  //   arcade (right hand on JKL) and PC (left hand on WASD, nearby Q/E/R/F/Space).
  // The live tables (and any player remaps) live in WL.settings.
  const ST = WL.settings;
  const KEYMAP = ST.keyMap;
  const PAD_BUTTONS = ST.padMap;

  // Remap capture: the next key / pad button goes to `cb` instead of the game.
  let capture = null;
  let padHold = false;

  const held = {};
  const keyDown = {};
  const padDown = {};
  const pressed = {};
  const queue = [];
  let anyKey = false;

  const pointer = { x: 0, y: 0, type: '' };

  const gamepad = {
    connected: false,
    index: null,
    x: 0,
    y: 0,
    stickX: 0,
    stickY: 0
  };

  // ---- touch state ----
  const touch = {
    enabled: false,
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false },
    buttons: [],
    pointers: new Map()
  };

  function layoutButtons() {
    const W = WL.W, H = WL.H;
    touch.buttons = [
      { id: 'attack', label: 'ATK', x: W - 118, y: H - 62, r: 30, color: '#e33' },
      { id: 'jump', label: 'JMP', x: W - 48, y: H - 96, r: 24, color: '#39f' },
      { id: 'special', label: 'SPR', x: W - 178, y: H - 106, r: 22, color: '#3cf' },
      { id: 'tool', label: 'BOX', x: W - 60, y: H - 34, r: 22, color: '#fc3' },
      { id: 'fart', label: 'FART', x: W - 178, y: H - 50, r: 24, color: '#5d3' },
      { id: 'pause', label: 'II', x: W / 2 + 96, y: 34, r: 12, color: '#aaa' }
    ];
  }
  layoutButtons();

  function syncHeld(action) {
    const on = !!(keyDown[action] || padDown[action] || (touch.joy && false));
    // touch buttons write `held` directly; don't clear those here
    if (keyDown[action] || padDown[action]) {
      if (!held[action]) queue.push(action);
      held[action] = true;
      anyKey = true;
    } else if (!touchOwns(action)) {
      held[action] = false;
    }
    return on;
  }
  function touchOwns(action) {
    if (touch.joy.active && (action === 'left' || action === 'right' || action === 'up' || action === 'down')) return false;
    for (const info of touch.pointers.values()) if (info.button === action) return true;
    return false;
  }

  function press(action) {
    if (!held[action]) queue.push(action);
    held[action] = true;
    anyKey = true;
  }
  function release(action) { held[action] = false; }

  function onKey(e, down) {
    if (e.key === 'F11' || e.code === 'F11') {
      if (down && !e.repeat) {
        e.preventDefault();
        queue.push('fullscreen');
        anyKey = true;
      }
      return;
    }
    const k = ST.norm(e.key);
    if (capture && capture.kind === 'key') {
      if (!down || e.repeat) return;
      e.preventDefault();
      const c = capture; capture = null;
      c.cb(k === 'Escape' && c.cancelOnEscape !== false ? null : k);
      return;
    }
    if (capture && capture.kind === 'pad') {
      if (down && !e.repeat && k === 'Escape') { e.preventDefault(); const c = capture; capture = null; c.cb(null); }
      return;
    }
    const act = KEYMAP[k];
    if (!act) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', '/', "'"].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    if (down) {
      if (e.repeat) { held[act] = true; return; }
      keyDown[act] = true;
      syncHeld(act);
    } else {
      keyDown[act] = false;
      syncHeld(act);
    }
  }

  let toCanvas = (cx, cy) => ({ x: cx, y: cy });

  function buttonAt(p) {
    // A visible button always wins over a neighbour's enlarged hit target.
    for (const padding of [0, 8]) {
      let nearest = null, distance = Infinity;
      for (const b of touch.buttons) {
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d <= b.r + padding && d < distance) { nearest = b; distance = d; }
      }
      if (nearest) return nearest;
    }
    return null;
  }

  function pointerDown(e) {
    const p = toCanvas(e.clientX, e.clientY);
    pointer.x = p.x; pointer.y = p.y; pointer.type = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const scene = WL.game && WL.game.scene;
      const b = scene && scene instanceof WL.scenes.Play && !scene.paused && scene.phase === 'play' && buttonAt(p);
      if (b) {
        touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: b.id });
        if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        press(b.id);
        return;
      }
      press('click');
      press('start');
      setTimeout(() => { release('start'); release('click'); }, 40);
      return;
    }
    touch.enabled = true;
    // Keep receiving release/cancel when a thumb leaves the canvas.
    if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    anyKey = true;
    queue.push('click');
    const b = buttonAt(p);
    if (b) {
      touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: b.id });
      press(b.id);
      return;
    }
    if (p.x < WL.W * 0.55 && !touch.joy.active) {
      touch.joy.active = true;
      touch.joy.id = e.pointerId;
      touch.joy.ox = p.x; touch.joy.oy = p.y;
      touch.joy.x = p.x; touch.joy.y = p.y;
      touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: null });
      return;
    }
    touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: null });
  }
  function pointerMove(e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const p = toCanvas(e.clientX, e.clientY);
      pointer.x = p.x; pointer.y = p.y; pointer.type = e.pointerType || 'mouse';
      if (!touch.pointers.has(e.pointerId)) return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const info = touch.pointers.get(e.pointerId);
    if (!info) return;
    info.x = p.x; info.y = p.y;
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.x = p.x; touch.joy.y = p.y;
    } else if (info.button) {
      const hit = buttonAt(p);
      const over = hit && hit.id;
      if (over && over !== info.button) {
        const previous = info.button;
        info.button = over;
        syncHeld(previous);
        press(over);
      }
    }
  }
  function pointerUp(e) {
    const info = touch.pointers.get(e.pointerId);
    if (info) {
      touch.pointers.delete(e.pointerId);
      if (info.button) syncHeld(info.button);
    }
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.active = false; touch.joy.id = null;
    }
  }

  // Default mapping lives in WL.settings: A jump, B fart, X attack, Y spray,
  // LB/RB toolbox, Back pause. Triggers (6, 7) are analog and easy to brush,
  // so they are only bound if the player remaps onto them.
  // Start (9) confirms menus and, during a fight, opens pause.

  function setPad(action, on) {
    const was = !!padDown[action];
    if (on === was) return;
    padDown[action] = on;
    syncHeld(action);
  }

  function pollGamepad() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; }
    catch (e) { return; }
    let pad = null;
    if (gamepad.index != null && pads[gamepad.index] && pads[gamepad.index].connected) pad = pads[gamepad.index];
    if (!pad) {
      for (const p of pads) {
        if (p && p.connected) { pad = p; break; }
      }
    }
    gamepad.connected = !!pad;
    if (!pad) {
      gamepad.index = null; gamepad.x = 0; gamepad.y = 0; gamepad.stickX = 0; gamepad.stickY = 0;
      for (const k in padDown) if (padDown[k]) setPad(k, false);
      return;
    }
    gamepad.index = pad.index;
    const b = pad.buttons;
    if (capture && capture.kind === 'pad') {
      for (const k in padDown) if (padDown[k]) setPad(k, false);
      const down = [];
      for (let i = 0; i < b.length; i++) if (b[i] && (b[i].pressed || b[i].value > 0.55)) down.push(i);
      // Wait for the button that opened the prompt to come back up first.
      if (!capture.armed) { if (!down.length) capture.armed = true; return; }
      const hit = down.find(i => !ST.RESERVED_PAD.includes(i) || i === 9);
      if (hit != null) { const c = capture; capture = null; padHold = true; c.cb(hit === 9 ? null : hit); }
      return;
    }
    if (padHold) {
      if (b.some(btn => btn && (btn.pressed || btn.value > 0.55))) return;
      padHold = false;
    }
    const seen = {};
    for (const i in PAD_BUTTONS) {
      const action = PAD_BUTTONS[i];
      const on = !!(b[i] && (b[i].pressed || b[i].value > 0.55));
      if (on) seen[action] = true;
    }
    for (const i in PAD_BUTTONS) {
      const action = PAD_BUTTONS[i];
      // tool is on both LB and RB; don't release if the other is held
      if (seen[action]) setPad(action, true);
    }
    for (const k in padDown) if (padDown[k] && !seen[k]) setPad(k, false);

    let ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const dead = 0.28;
    const len = Math.hypot(ax, ay);
    if (len < dead) { ax = 0; ay = 0; }
    else {
      const s = Math.min(1, (len - dead) / (1 - dead));
      ax = (ax / len) * s; ay = (ay / len) * s;
    }
    gamepad.x = ax; gamepad.y = ay;
    // Digital edges from the stick so menus move without the d-pad.
    const sx = ax < -0.55 ? -1 : ax > 0.55 ? 1 : 0;
    const sy = ay < -0.55 ? -1 : ay > 0.55 ? 1 : 0;
    if (!seen.left && !seen.right) {
      setPad('left', sx < 0);
      setPad('right', sx > 0);
    }
    if (!seen.up && !seen.down) {
      setPad('up', sy < 0);
      setPad('down', sy > 0);
    }
    gamepad.stickX = sx; gamepad.stickY = sy;
    if (b.some(btn => btn && (btn.pressed || btn.value > 0.5)) || ax || ay) anyKey = true;
  }

  function rumble(ms, strong, weak) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = gamepad.index != null ? pads[gamepad.index] : null;
    const act = pad && (pad.vibrationActuator || pad.hapticActuators && pad.hapticActuators[0]);
    if (!act) return;
    const dur = ms || 70;
    try {
      if (act.playEffect) act.playEffect('dual-rumble', { duration: dur, strongMagnitude: strong || 0.4, weakMagnitude: weak || 0.2 });
      else if (act.pulse) act.pulse(strong || 0.4, dur);
    } catch (e) { /* desktop pads without haptics */ }
  }

  function attach(canvas, mapFn) {
    toCanvas = mapFn;
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));
    function clearInput() {
      for (const k in keyDown) keyDown[k] = false;
      for (const k in held) held[k] = false;
      for (const k in padDown) padDown[k] = false;
      for (const k in pressed) pressed[k] = false;
      queue.length = 0;
      touch.pointers.clear();
      touch.joy.active = false; touch.joy.id = null;
    }
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
    window.addEventListener('gamepadconnected', e => { gamepad.connected = true; gamepad.index = e.gamepad.index; anyKey = true; });
    window.addEventListener('gamepaddisconnected', () => { gamepad.connected = false; gamepad.index = null; });
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('lostpointercapture', pointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) touch.enabled = true;
    }
  }

  function beginFrame() {
    pollGamepad();
    for (const k in pressed) pressed[k] = false;
    for (const a of queue) pressed[a] = true;
    queue.length = 0;
  }

  function axis() {
    let x = 0, y = 0;
    if (held.left) x -= 1;
    if (held.right) x += 1;
    if (held.up) y -= 1;
    if (held.down) y += 1;
    // Analog stick only fills an axis the keyboard / d-pad isn't already driving.
    if (!held.left && !held.right && gamepad.x) x = gamepad.x;
    if (!held.up && !held.down && gamepad.y) y = gamepad.y;
    if (touch.joy.active) {
      const dx = touch.joy.x - touch.joy.ox, dy = touch.joy.y - touch.joy.oy;
      const dead = 8, max = 34;
      const len = Math.hypot(dx, dy);
      if (len > dead) {
        const s = Math.min(1, (len - dead) / (max - dead));
        x = (dx / len) * s; y = (dy / len) * s;
        if (Math.abs(x) < 0.22) x = 0;
        if (Math.abs(y) < 0.22) y = 0;
        x = Math.sign(x) * Math.min(1, Math.abs(x) * 1.6);
        y = Math.sign(y) * Math.min(1, Math.abs(y) * 1.6);
      }
    }
    return { x, y };
  }

  function consumeAny() {
    const a = anyKey; anyKey = false; return a;
  }

  // What the corner chrome calls each action. Keyboard is the desktop
  // picture; a connected pad swaps in the face buttons. Both follow remaps.
  // Touch targets stay where they are.
  function badgeFor(id) {
    if (gamepad.connected) return id === 'pause' ? 'START' : ST.padFor(id);
    return ST.keysFor(id, 1)[0] || '';
  }
  const TOUCH_LABEL = { attack: 'ATK', jump: 'JMP', special: 'SPR', tool: 'BOX', fart: 'FART', pause: 'II' };
  /** Short control name for prompts: "E/J" on keyboard, "X" on a pad, "ATK" on touch. */
  function hint(id, n) {
    if (touch.enabled && !(WL.display && WL.display.pc) && !gamepad.connected) return TOUCH_LABEL[id] || id.toUpperCase();
    if (gamepad.connected) return id === 'pause' ? 'START' : ST.padFor(id);
    return ST.keysFor(id, n || 2).join('/') || '--';
  }
  /** Replace {attack}, {jump}, ... in tutorial copy with the live bindings. */
  function fillKeys(str) {
    return String(str).replace(/\{(\w+)\}/g, (m, id) => hint(id, 2));
  }
  function moveHint(keysOnly) {
    if (gamepad.connected && !keysOnly) return 'STICK/D-PAD';
    const labels = ['up', 'left', 'down', 'right'].map(a => ST.keysFor(a, 1)[0]);
    const arrows = arrowsIntact();
    const prim = labels.every(l => l.length === 1) ? labels.join('') : labels.join(' ');
    if (prim === 'UP LF DN RT') return 'ARROWS';
    return arrows ? prim + '/ARROWS' : prim;
  }
  function arrowsIntact() {
    return KEYMAP.ArrowUp === 'up' && KEYMAP.ArrowDown === 'down' && KEYMAP.ArrowLeft === 'left' && KEYMAP.ArrowRight === 'right';
  }
  // Legends list the physical bindings even on a touch device (a phone with
  // a keyboard or pad attached should still see the truth).
  function legend() {
    if (gamepad.connected) {
      const p = id => ST.padFor(id);
      return `PAD: STICK MOVE   ${p('attack')} ATK   ${p('jump')} JUMP   ${p('special')} SPRAY   ${p('tool')} BOX   ${p('fart')} FART   START PAUSE`;
    }
    const k = (id, n) => ST.keysFor(id, n || 2).join('/') || '--';
    return `${moveHint()} MOVE   ${k('attack')} ATK   ${k('jump')} JUMP   ${k('special')} SPRAY   ${k('tool')} BOX   ${k('fart', 1)} FART`;
  }
  function beginCapture(kind, cb) {
    capture = { kind, cb, armed: false };
    for (const k in keyDown) keyDown[k] = false;
    for (const k in held) held[k] = false;
    queue.length = 0;
  }
  function cancelCapture() { capture = null; }
  function hexAlpha(h, a) {
    let hex = String(h).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawKeycap(ctx, x, y, label, down) {
    const w = Math.max(16, label.length * 7 + 8), h = 15;
    // Glossy keycap: a raised face over a darker skirt, highlight on the top edge.
    WL.draw.fillRRect(ctx, x - w / 2, y - h / 2 + 1.5, w, h, 3, down ? '#8a6a00' : 'rgba(2,4,12,0.9)');
    WL.draw.fillRRect(ctx, x - w / 2, y - h / 2, w, h, 3, down ? '#ffd23a' : 'rgba(18,24,44,0.95)', down ? '#fff6c8' : 'rgba(255,255,255,0.85)');
    ctx.fillStyle = down ? 'rgba(255,255,255,0.5)' : 'rgba(120,140,190,0.45)'; ctx.fillRect(x - w / 2 + 2, y - h / 2 + 1, w - 4, h * 0.4);
    WL.text.draw(ctx, label, x, y - 5, {
      size: label.length > 2 ? 5 : 7, align: 'center',
      color: down ? '#1a1204' : '#fff', shadow: false
    });
  }

  function drawArrow(ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir);
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4.5, 3.5); ctx.lineTo(-4.5, 3.5);
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#141428';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawStickGlyph(ctx, cx, cy, r, live) {
    WL.draw.circle(ctx, cx, cy, r, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.88)');
    drawArrow(ctx, cx, cy - r + 1, 0);
    drawArrow(ctx, cx, cy + r - 1, Math.PI);
    drawArrow(ctx, cx - r + 1, cy, -Math.PI / 2);
    drawArrow(ctx, cx + r - 1, cy, Math.PI / 2);
    const knob = live || { x: cx, y: cy };
    let dx = knob.x - cx, dy = knob.y - cy;
    const len = Math.hypot(dx, dy);
    const reach = r * 0.62;
    if (len > reach) { dx = dx / len * reach; dy = dy / len * reach; }
    WL.draw.circle(ctx, cx + dx, cy + dy, Math.max(8, r * 0.42), live ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)', '#141428');
  }

  /* Persistent control picture. Stays for the whole stage on phones and
     desktops: touch targets, plus a keyboard cluster or a pad diagram.
     Nothing in here is on a timer. */
  function drawControlChrome(ctx, opts) {
    const pad = !!gamepad.connected;
    const H = WL.H;
    // Player-chosen overlay strength, capped so the plates never go opaque.
    const base = Math.max(0.2, Math.min(0.85, opts.opacity != null ? opts.opacity : ST.data.overlay));
    ctx.save();
    ctx.globalAlpha = base;
    ctx.lineWidth = 1.5;

    // ---- move cluster, bottom left. Plates stay see-through so a goon
    // walking the rail is still visible behind the diagram. ----
    const mx = 8, my = H - 138, mw = 112, mh = 130;
    glassPlate(ctx, mx, my, mw, mh);
    WL.text.draw(ctx, pad ? 'PAD' : 'MOVE', mx + mw / 2, my + 4, {
      size: 7, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3
    });
    if (pad) {
      drawKeycap(ctx, mx + 56, my + 28, '^', held.up);
      drawKeycap(ctx, mx + 36, my + 46, '<', held.left);
      drawKeycap(ctx, mx + 56, my + 46, 'v', held.down);
      drawKeycap(ctx, mx + 76, my + 46, '>', held.right);
      WL.text.draw(ctx, 'STICK OR PAD', mx + mw / 2, my + 58, {
        size: 5, align: 'center', color: '#d5e6ff', stroke: '#000', strokeWidth: 2
      });
    } else {
      const cap = a => ST.keysFor(a, 1)[0];
      const wide = ['up', 'left', 'down', 'right'].some(a => cap(a).length > 1);
      const gap = wide ? 30 : 22;
      drawKeycap(ctx, mx + 56, my + 26, cap('up'), held.up);
      drawKeycap(ctx, mx + 56 - gap, my + 44, cap('left'), held.left);
      drawKeycap(ctx, mx + 56, my + 44, cap('down'), held.down);
      drawKeycap(ctx, mx + 56 + gap, my + 44, cap('right'), held.right);
      WL.text.draw(ctx, arrowsIntact() && cap('up') !== 'UP' ? 'OR ARROWS' : 'REMAPPED', mx + mw / 2, my + 56, {
        size: 5, align: 'center', color: '#d5e6ff', stroke: '#000', strokeWidth: 2
      });
    }
    const stick = { x: mx + mw / 2, y: my + 98, r: 20 };
    drawStickGlyph(ctx, stick.x, stick.y, stick.r, null);

    // Live finger stick, wherever the thumb actually is.
    if (touch.joy.active) {
      ctx.save(); ctx.globalAlpha = 0.85;
      const j = touch.joy;
      WL.draw.circle(ctx, j.ox, j.oy, 34, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.9)');
      let dx = j.x - j.ox, dy = j.y - j.oy;
      const len = Math.hypot(dx, dy);
      if (len > 34) { dx = dx / len * 34; dy = dy / len * 34; }
      WL.draw.circle(ctx, j.ox + dx, j.oy + dy, 16, 'rgba(255,255,255,0.92)', '#141428');
      ctx.restore();
    }

    // ---- fight cluster, bottom right ----
    if (opts.buttons !== false) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of touch.buttons) {
        if (b.id === 'pause') continue;
        x0 = Math.min(x0, b.x - b.r); y0 = Math.min(y0, b.y - b.r);
        x1 = Math.max(x1, b.x + b.r); y1 = Math.max(y1, b.y + b.r);
      }
      const plateX = x0 - 10, plateY = y0 - 16, plateW = (x1 - x0) + 20, plateH = (y1 - y0) + 26;
      glassPlate(ctx, plateX, plateY, plateW, plateH);
      WL.text.draw(ctx, pad ? 'CONTROLLER' : 'KEYS', plateX + plateW / 2, plateY + 3, {
        size: 6, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3
      });
      for (const b of touch.buttons) {
        const down = !!held[b.id];
        ctx.globalAlpha = down ? 1 : base;
        const boxMissing = b.id === 'tool' && opts.hasToolbox === false;
        const disabled = (b.id === 'fart' && opts.fartReady === false) || boxMissing;
        const armed = b.id === 'fart' && opts.fartReady;
        const col = armed ? '#88ff66' : b.color;
        // Glass button: tinted see-through core, colored rim, gloss on top.
        WL.draw.circle(ctx, b.x, b.y, b.r, disabled ? 'rgba(90,90,100,0.16)' : hexAlpha(col, down ? 0.55 : 0.2), 'rgba(0,0,0,0.55)');
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = disabled ? 'rgba(200,200,210,0.45)' : (down ? '#ffffff' : hexAlpha(col, 0.95)); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(b.x, b.y - b.r * 0.45, b.r * 0.62, b.r * 0.3, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
        ctx.lineWidth = 1.5;
        if (down) {
          ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); ctx.stroke();
        }
        if (armed) {
          ctx.strokeStyle = '#f4ffe0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        const badge = boxMissing ? 'PICK UP' : badgeFor(b.id);
        if (b.id === 'pause') {
          WL.text.draw(ctx, b.label, b.x, b.y - 5, { size: 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 2 });
          WL.text.draw(ctx, badge, b.x + b.r + 4, b.y - 4, { size: 6, color: '#ffe14a', stroke: '#000', strokeWidth: 2 });
        } else {
          WL.text.draw(ctx, b.label, b.x, b.y - 10, { size: 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 3 });
          // Key / pad badge on a colored chip, like a console glyph.
          const bs = boxMissing ? 5 : 6;
          const cw = Math.max(12, WL.text.width(ctx, badge, bs) + 7), ch = bs + 5;
          WL.draw.fillRRect(ctx, b.x - cw / 2, b.y - 1.5, cw, ch, ch / 2, boxMissing ? 'rgba(120,70,0,0.75)' : 'rgba(6,8,20,0.7)', disabled && !boxMissing ? 'rgba(200,200,210,0.5)' : hexAlpha(col, 0.95));
          WL.text.draw(ctx, badge, b.x, b.y + 1, { size: bs, align: 'center', color: boxMissing ? '#ffe9a0' : '#ffe14a', stroke: '#000', strokeWidth: 2 });
        }
      }
    }
    ctx.restore();
  }

  function glassPlate(ctx, x, y, w, h) {
    WL.draw.fillRRect(ctx, x, y, w, h, 9, 'rgba(8,12,30,0.08)', 'rgba(255,255,255,0.32)');
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 8, y + 1, w - 16, 1);
  }

  function drawTouch(ctx, opts = {}) {
    // `always` is the in-stage picture: it does not wait for a finger and it
    // does not go away on a desktop. Other callers (the pause menu) keep the
    // old "only while a thumb is down" behavior.
    if (opts.always) {
      drawControlChrome(ctx, opts);
      return;
    }
    if (!touch.enabled) return;
    const pc = WL.display && WL.display.pc;
    if (pc && !touch.joy.active && touch.pointers.size === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (touch.joy.active) {
      const j = touch.joy;
      WL.draw.circle(ctx, j.ox, j.oy, 34, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.6)');
      let dx = j.x - j.ox, dy = j.y - j.oy;
      const len = Math.hypot(dx, dy);
      if (len > 34) { dx = dx / len * 34; dy = dy / len * 34; }
      WL.draw.circle(ctx, j.ox + dx, j.oy + dy, 16, 'rgba(255,255,255,0.7)');
    } else if (opts.hintJoy) {
      WL.draw.circle(ctx, 70, WL.H - 70, 34, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)');
      WL.text.draw(ctx, 'MOVE', 70, WL.H - 74, { size: 8, align: 'center', color: 'rgba(255,255,255,0.7)' });
    }
    if (opts.buttons !== false) {
      for (const b of touch.buttons) {
        if (b.id === 'pause' && opts.pause === false) continue;
        const down = held[b.id];
        ctx.globalAlpha = down ? 0.9 : 0.5;
        const disabled = b.id === 'fart' && opts.fartReady === false;
        const armed = b.id === 'fart' && opts.fartReady;
        WL.draw.circle(ctx, b.x, b.y, b.r, disabled ? '#333' : (armed ? '#8f6' : b.color), 'rgba(255,255,255,0.8)');
        if (armed) {
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#f4ffe0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 0.95;
        WL.text.draw(ctx, b.label, b.x, b.y - 4, { size: 8, align: 'center', color: '#fff' });
      }
    }
    ctx.restore();
  }

  return {
    attach, beginFrame, axis, drawTouch, consumeAny, layoutButtons, rumble,
    held, pressed, touch, pointer, gamepad,
    badgeFor, hint, fillKeys, legend, moveHint, beginCapture, cancelCapture,
    get capturing() { return capture ? capture.kind : null; },
    get touchEnabled() { return touch.enabled && !(WL.display && WL.display.pc); },
    set touchEnabled(v) { touch.enabled = v; }
  };
})();
