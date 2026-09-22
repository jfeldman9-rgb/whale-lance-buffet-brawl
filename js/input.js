/* Unified keyboard + gamepad + touch input.
   Actions: attack, jump, special, tool, fart, start, pause, mute, fullscreen
   Movement: axis.x / axis.y in [-1, 1]. */
'use strict';

WL.input = (function () {
  // Two layouts on purpose:
  //   arcade (right hand on JKL) and PC (left hand on WASD, nearby Q/E/R/F/Space).
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
    e: 'attack', E: 'attack', j: 'attack', J: 'attack', z: 'attack', Z: 'attack',
    k: 'jump', K: 'jump', x: 'jump', X: 'jump',
    q: 'special', Q: 'special', l: 'special', L: 'special', c: 'special', C: 'special',
    r: 'tool', R: 'tool', i: 'tool', I: 'tool', v: 'tool', V: 'tool', u: 'tool', U: 'tool',
    f: 'fart', F: 'fart', b: 'fart', B: 'fart',
    ' ': 'jump',
    Enter: 'start', p: 'pause', P: 'pause', Escape: 'pause',
    m: 'mute', M: 'mute',
    '\\': 'fullscreen', F11: 'fullscreen'
  };

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
    const act = KEYMAP[e.key];
    if (!act) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
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

  function pointerDown(e) {
    const p = toCanvas(e.clientX, e.clientY);
    pointer.x = p.x; pointer.y = p.y; pointer.type = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      press('click');
      press('start');
      setTimeout(() => { release('start'); release('click'); }, 40);
      return;
    }
    touch.enabled = true;
    anyKey = true;
    queue.push('click');
    for (const b of touch.buttons) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8) {
        touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: b.id });
        press(b.id);
        return;
      }
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
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const info = touch.pointers.get(e.pointerId);
    if (!info) return;
    info.x = p.x; info.y = p.y;
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.x = p.x; touch.joy.y = p.y;
    } else if (info.button) {
      let over = null;
      for (const b of touch.buttons) if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8) over = b.id;
      if (over && over !== info.button) {
        release(info.button);
        info.button = over;
        press(over);
      }
    }
  }
  function pointerUp(e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') return;
    const info = touch.pointers.get(e.pointerId);
    if (info) {
      if (info.button) release(info.button);
      touch.pointers.delete(e.pointerId);
    }
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.active = false; touch.joy.id = null;
    }
  }

  // Standard mapping: A jump, B fart, X attack, Y spray, LB/RB toolbox, Start pause.
  // Triggers (6, 7) are analog and easy to brush, so they are not bound.
  // Back (8) pauses. Start (9) confirms menus and, during a fight, opens pause.
  const PAD_BUTTONS = {
    0: 'jump', 1: 'fart', 2: 'attack', 3: 'special',
    4: 'tool', 5: 'tool',
    8: 'pause', 9: 'start',
    12: 'up', 13: 'down', 14: 'left', 15: 'right'
  };

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
    window.addEventListener('blur', () => {
      for (const k in keyDown) keyDown[k] = false;
      for (const k in held) held[k] = false;
      for (const k in padDown) padDown[k] = false;
    });
    window.addEventListener('gamepadconnected', e => { gamepad.connected = true; gamepad.index = e.gamepad.index; anyKey = true; });
    window.addEventListener('gamepaddisconnected', () => { gamepad.connected = false; gamepad.index = null; });
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
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
  // picture; a connected pad swaps in the face buttons. Touch targets stay.
  const KEY_BADGE = { attack: 'E', jump: 'SPC', special: 'Q', tool: 'R', fart: 'F', pause: 'ESC' };
  const PAD_BADGE = { attack: 'X', jump: 'A', special: 'Y', tool: 'RB', fart: 'B', pause: 'START' };
  function badgeFor(id) { return (gamepad.connected ? PAD_BADGE : KEY_BADGE)[id] || ''; }
  function hexAlpha(h, a) {
    let hex = String(h).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawKeycap(ctx, x, y, label, down) {
    const w = Math.max(16, label.length * 7 + 8), h = 15;
    WL.draw.fillRRect(ctx, x - w / 2, y - h / 2, w, h, 3,
      down ? '#ffe14a' : 'rgba(10,14,28,0.94)',
      down ? '#fff6c8' : 'rgba(255,255,255,0.92)');
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
    WL.draw.circle(ctx, cx, cy, r, 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.88)');
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
    ctx.save();
    ctx.lineWidth = 1.5;

    // ---- move cluster, bottom left. Plates stay see-through so a goon
    // walking the rail is still visible behind the diagram. ----
    const mx = 8, my = H - 138, mw = 112, mh = 130;
    WL.draw.fillRRect(ctx, mx, my, mw, mh, 8, 'rgba(6,8,20,0.55)', 'rgba(255,255,255,0.8)');
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
      drawKeycap(ctx, mx + 56, my + 26, 'W', held.up);
      drawKeycap(ctx, mx + 34, my + 44, 'A', held.left);
      drawKeycap(ctx, mx + 56, my + 44, 'S', held.down);
      drawKeycap(ctx, mx + 78, my + 44, 'D', held.right);
      WL.text.draw(ctx, 'OR ARROWS', mx + mw / 2, my + 56, {
        size: 5, align: 'center', color: '#d5e6ff', stroke: '#000', strokeWidth: 2
      });
    }
    const stick = { x: mx + mw / 2, y: my + 98, r: 20 };
    drawStickGlyph(ctx, stick.x, stick.y, stick.r, null);

    // Live finger stick, wherever the thumb actually is.
    if (touch.joy.active) {
      const j = touch.joy;
      WL.draw.circle(ctx, j.ox, j.oy, 34, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.9)');
      let dx = j.x - j.ox, dy = j.y - j.oy;
      const len = Math.hypot(dx, dy);
      if (len > 34) { dx = dx / len * 34; dy = dy / len * 34; }
      WL.draw.circle(ctx, j.ox + dx, j.oy + dy, 16, 'rgba(255,255,255,0.92)', '#141428');
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
      WL.draw.fillRRect(ctx, plateX, plateY, plateW, plateH, 8, 'rgba(6,8,20,0.5)', 'rgba(255,255,255,0.8)');
      WL.text.draw(ctx, pad ? 'CONTROLLER' : 'KEYS', plateX + plateW / 2, plateY + 3, {
        size: 6, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3
      });
      for (const b of touch.buttons) {
        const down = !!held[b.id];
        const disabled = b.id === 'fart' && opts.fartReady === false;
        const armed = b.id === 'fart' && opts.fartReady;
        const fill = disabled ? 'rgba(58,58,68,0.85)' : (armed ? 'rgba(136,255,102,0.9)' : hexAlpha(b.color, down ? 0.95 : 0.72));
        WL.draw.circle(ctx, b.x, b.y, b.r, fill, down ? '#fff' : 'rgba(255,255,255,0.95)');
        if (down) {
          ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); ctx.stroke();
        }
        if (armed) {
          ctx.strokeStyle = '#f4ffe0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        const badge = badgeFor(b.id);
        if (b.id === 'pause') {
          WL.text.draw(ctx, b.label, b.x, b.y - 5, { size: 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 2 });
          WL.text.draw(ctx, badge, b.x + b.r + 4, b.y - 4, { size: 6, color: '#ffe14a', stroke: '#000', strokeWidth: 2 });
        } else {
          WL.text.draw(ctx, b.label, b.x, b.y - 10, { size: 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 3 });
          WL.text.draw(ctx, badge, b.x, b.y + 1, { size: 6, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        }
      }
    }
    ctx.restore();
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
    get touchEnabled() { return touch.enabled && !(WL.display && WL.display.pc); },
    set touchEnabled(v) { touch.enabled = v; }
  };
})();
