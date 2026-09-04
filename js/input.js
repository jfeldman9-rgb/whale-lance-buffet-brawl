/* Unified keyboard + touch input.
   Actions: attack, jump, special, tool, fart, start, pause, mute
   Movement: axis.x / axis.y in [-1, 1]. */
'use strict';

WL.input = (function () {
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
    j: 'attack', J: 'attack', z: 'attack', Z: 'attack',
    k: 'jump', K: 'jump', x: 'jump', X: 'jump',
    l: 'special', L: 'special', c: 'special', C: 'special',
    i: 'tool', I: 'tool', v: 'tool', V: 'tool', u: 'tool', U: 'tool',
    f: 'fart', F: 'fart', b: 'fart', B: 'fart',
    ' ': 'jump',
    Enter: 'start', p: 'pause', P: 'pause', Escape: 'pause',
    m: 'mute', M: 'mute'
  };

  const held = {};
  const pressed = {};
  const queue = [];   // edge events queued between frames
  let anyKey = false;

  // ---- touch state ----
  const touch = {
    enabled: false,
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false },
    buttons: [],
    pointers: new Map() // pointerId -> {x,y,button}
  };

  // Button layout in canvas space (right side)
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

  function press(action) {
    if (!held[action]) queue.push(action);
    held[action] = true;
    anyKey = true;
  }
  function release(action) { held[action] = false; }

  function onKey(e, down) {
    const act = KEYMAP[e.key];
    if (!act) return;
    // Prevent page scroll for game keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    if (down) { if (!e.repeat) press(act); else held[act] = true; }
    else release(act);
  }

  // Canvas coordinate mapping (set by main)
  let toCanvas = (cx, cy) => ({ x: cx, y: cy });

  function pointerDown(e) {
    if (e.pointerType === 'mouse') {
      // Mouse clicks count as "start"/any-key for menus
      press('start'); queue.push('click');
      setTimeout(() => release('start'), 50);
      return;
    }
    touch.enabled = true;
    const p = toCanvas(e.clientX, e.clientY);
    anyKey = true;
    queue.push('click');
    // Buttons?
    for (const b of touch.buttons) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8) {
        touch.pointers.set(e.pointerId, { x: p.x, y: p.y, button: b.id });
        press(b.id);
        return;
      }
    }
    // Left 55% of screen = joystick
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
    if (e.pointerType === 'mouse') return;
    const p = toCanvas(e.clientX, e.clientY);
    const info = touch.pointers.get(e.pointerId);
    if (!info) return;
    info.x = p.x; info.y = p.y;
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.x = p.x; touch.joy.y = p.y;
    } else if (info.button) {
      // Sliding off/onto buttons: allow dragging between attack/jump etc.
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
    if (e.pointerType === 'mouse') return;
    const info = touch.pointers.get(e.pointerId);
    if (info) {
      if (info.button) release(info.button);
      touch.pointers.delete(e.pointerId);
    }
    if (touch.joy.active && touch.joy.id === e.pointerId) {
      touch.joy.active = false; touch.joy.id = null;
    }
  }

  function attach(canvas, mapFn) {
    toCanvas = mapFn;
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));
    window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      // Show touch controls right away on touch-capable devices without a fine pointer
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) touch.enabled = true;
    }
  }

  // Called once per frame by the game loop, before update
  function beginFrame() {
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
    if (touch.joy.active) {
      const dx = touch.joy.x - touch.joy.ox, dy = touch.joy.y - touch.joy.oy;
      const dead = 8, max = 34;
      const len = Math.hypot(dx, dy);
      if (len > dead) {
        const s = Math.min(1, (len - dead) / (max - dead));
        x = (dx / len) * s; y = (dy / len) * s;
        // snap to 8-way-ish feel
        if (Math.abs(x) < 0.3) x = 0;
        if (Math.abs(y) < 0.3) y = 0;
        x = Math.sign(x) * Math.min(1, Math.abs(x) * 1.6);
        y = Math.sign(y) * Math.min(1, Math.abs(y) * 1.6);
      }
    }
    return { x, y };
  }

  function consumeAny() {
    const a = anyKey; anyKey = false; return a;
  }

  function drawTouch(ctx, opts = {}) {
    if (!touch.enabled) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    // joystick
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
        WL.draw.circle(ctx, b.x, b.y, b.r, disabled ? '#333' : b.color, 'rgba(255,255,255,0.8)');
        ctx.globalAlpha = 0.95;
        WL.text.draw(ctx, b.label, b.x, b.y - 4, { size: 8, align: 'center', color: '#fff' });
      }
    }
    ctx.restore();
  }

  return {
    attach, beginFrame, axis, drawTouch, consumeAny, layoutButtons,
    held, pressed, touch,
    get touchEnabled() { return touch.enabled; },
    set touchEnabled(v) { touch.enabled = v; }
  };
})();
