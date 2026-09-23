/* Persistent player settings: audio, display, control overlay, accessibility,
   keyboard / gamepad remaps, plus the light stage/wave checkpoint used by
   Continue. Settings keep the `wl-settings` key main.js always used, so an
   older save still restores its display mode and volume. */
'use strict';

WL.settings = (function () {
  const KEY = 'wl-settings';
  const RUN_KEY = 'wl-run';

  // First entry is the primary binding: it is what the on-screen badges and
  // legends show. Later entries are the arcade / arrow aliases.
  const DEFAULT_KEYS = {
    up: ['w', 'ArrowUp'], down: ['s', 'ArrowDown'], left: ['a', 'ArrowLeft'], right: ['d', 'ArrowRight'],
    attack: ['e', 'j', 'z'], jump: [' ', 'k', 'x'], special: ['q', 'l', 'c'],
    tool: ['r', 'i', 'v', 'u'], fart: ['f', 'b'], pause: ['Escape', 'p']
  };
  // Standard mapping: A jump, B fart, X attack, Y spray, RB/LB toolbox, Back pause.
  const DEFAULT_PAD = { attack: [2], jump: [0], special: [3], tool: [5, 4], fart: [1], pause: [8] };
  // Enter confirms menus, M mutes, backslash / F11 go fullscreen. Start and the
  // d-pad always work so a bad remap can't lock anyone out of the menus.
  const FIXED_KEYS = { Enter: 'start', m: 'mute', '\\': 'fullscreen', F11: 'fullscreen' };
  const FIXED_PAD = { 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const RESERVED_KEYS = ['Enter', 'm', '\\', 'F11', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ContextMenu', 'OS', 'Dead', 'Unidentified'];
  const RESERVED_PAD = [9, 12, 13, 14, 15];

  const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'jump', 'special', 'tool', 'fart', 'pause'];
  const PAD_ACTIONS = ['attack', 'jump', 'special', 'tool', 'fart', 'pause'];
  const ACTION_NAMES = {
    up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
    attack: 'ATTACK', jump: 'JUMP', special: 'SPRAY', tool: 'TOOLBOX', fart: 'FART', pause: 'PAUSE'
  };

  const OVERLAY_STEPS = [0.25, 0.4, 0.55, 0.7, 0.85];
  const MUSIC_STEPS = [1, 0.7, 0.4, 0];

  const clone = o => JSON.parse(JSON.stringify(o));
  const defaults = () => ({
    mode: 'auto', volume: 1, muted: false, music: 1,
    overlay: 0.55, bigHud: false, colorblind: false, fx: 'auto', shake: 'full',
    keys: clone(DEFAULT_KEYS), pad: clone(DEFAULT_PAD)
  });
  const data = defaults();
  const keyMap = {};
  const padMap = {};

  function norm(k) { return typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k; }

  function rebuild() {
    for (const k in keyMap) delete keyMap[k];
    for (const k in padMap) delete padMap[k];
    // Aliases first, then primaries, so a primary always wins a collision.
    for (let pass = 1; pass >= 0; pass--) {
      for (const a of ACTIONS) {
        const list = data.keys[a] || [];
        if (pass === 1) { for (let i = list.length - 1; i >= 1; i--) keyMap[list[i]] = a; }
        else if (list[0] != null) keyMap[list[0]] = a;
      }
    }
    Object.assign(keyMap, FIXED_KEYS);
    for (const a of PAD_ACTIONS) for (const i of (data.pad[a] || [])) padMap[i] = a;
    Object.assign(padMap, FIXED_PAD);
  }

  function validList(v, ok) { return Array.isArray(v) && v.every(ok); }

  function load() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { p = {}; }
    if (p.mode === 'auto' || p.mode === 'sharp' || p.mode === 'classic') data.mode = p.mode;
    if (typeof p.volume === 'number') data.volume = Math.max(0, Math.min(1, p.volume));
    if (typeof p.muted === 'boolean') data.muted = p.muted;
    if (typeof p.music === 'number') data.music = Math.max(0, Math.min(1, p.music));
    if (typeof p.overlay === 'number') data.overlay = Math.max(OVERLAY_STEPS[0], Math.min(OVERLAY_STEPS[OVERLAY_STEPS.length - 1], p.overlay));
    if (typeof p.bigHud === 'boolean') data.bigHud = p.bigHud;
    if (typeof p.colorblind === 'boolean') data.colorblind = p.colorblind;
    if (p.fx === 'auto' || p.fx === 'full' || p.fx === 'lite') data.fx = p.fx;
    if (p.shake === 'full' || p.shake === 'reduced') data.shake = p.shake;
    if (p.keys && typeof p.keys === 'object') {
      for (const a of ACTIONS) if (validList(p.keys[a], k => typeof k === 'string' && !RESERVED_KEYS.includes(k))) data.keys[a] = p.keys[a].map(norm);
    }
    if (p.pad && typeof p.pad === 'object') {
      for (const a of PAD_ACTIONS) if (validList(p.pad[a], i => Number.isInteger(i) && i >= 0 && i < 20 && !RESERVED_PAD.includes(i))) data.pad[a] = p.pad[a].slice();
    }
    rebuild();
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function set(patch) {
    Object.assign(data, patch);
    save();
    return data;
  }

  function cycle(field, steps, dir) {
    let i = 0, best = Infinity;
    steps.forEach((s, n) => { const d = Math.abs(s - data[field]); if (d < best) { best = d; i = n; } });
    i = (i + (dir || 1) + steps.length) % steps.length;
    return set({ [field]: steps[i] })[field];
  }

  /* ---- remapping ---- */
  // Binding a key that belongs to another action swaps: the other action
  // inherits this action's old primary so nothing is left unbound.
  function bindIn(table, action, value, same) {
    const list = table[action] || [];
    const oldPrimary = list[0];
    if (oldPrimary != null && same(oldPrimary, value)) return;
    for (const other in table) {
      if (other === action) continue;
      const ol = table[other];
      const at = ol.findIndex(v => same(v, value));
      if (at < 0) continue;
      if (at === 0 && oldPrimary != null) ol[0] = oldPrimary;
      else ol.splice(at, 1);
    }
    table[action] = [value].concat(list.slice(1).filter(v => !same(v, value)));
  }
  function setKey(action, key) {
    key = norm(key);
    if (!ACTIONS.includes(action)) return { ok: false, reason: 'UNKNOWN ACTION' };
    if (!key || RESERVED_KEYS.includes(key)) return { ok: false, reason: 'RESERVED KEY' };
    bindIn(data.keys, action, key, (a, b) => a === b);
    rebuild(); save();
    return { ok: true };
  }
  function setPad(action, index) {
    if (!PAD_ACTIONS.includes(action)) return { ok: false, reason: 'NOT REMAPPABLE' };
    if (!Number.isInteger(index) || RESERVED_PAD.includes(index)) return { ok: false, reason: 'RESERVED BUTTON' };
    bindIn(data.pad, action, index, (a, b) => a === b);
    rebuild(); save();
    return { ok: true };
  }
  function resetControls() {
    data.keys = clone(DEFAULT_KEYS);
    data.pad = clone(DEFAULT_PAD);
    rebuild(); save();
  }

  /* ---- labels (badges, legends, tutorial text) ---- */
  const KEY_NAMES = {
    ' ': 'SPC', Escape: 'ESC', ArrowUp: 'UP', ArrowDown: 'DN', ArrowLeft: 'LF', ArrowRight: 'RT',
    Backspace: 'BKSP', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN'
  };
  const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'LS', 'RS', 'UP', 'DN', 'LF', 'RT', 'HOME'];
  function keyLabel(k) {
    if (k == null) return '--';
    if (KEY_NAMES[k]) return KEY_NAMES[k];
    if (k.length === 1) return k.toUpperCase();
    return k.toUpperCase().slice(0, 4);
  }
  function padLabel(i) { return i == null ? '--' : (PAD_NAMES[i] || ('B' + i)); }
  function keysFor(action, n) { return (data.keys[action] || []).slice(0, n || 1).map(keyLabel); }
  function padFor(action) {
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') return 'D-PAD';
    return padLabel((data.pad[action] || [])[0]);
  }

  /* ---- light checkpoint for Continue ---- */
  function saveRun(run) {
    try { localStorage.setItem(RUN_KEY, JSON.stringify(Object.assign({ v: 1, at: Date.now() }, run))); } catch (e) { /* private mode */ }
  }
  function loadRun() {
    try {
      const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
      if (!r || r.v !== 1 || !Number.isInteger(r.level) || !WL.LEVELS || !WL.LEVELS[r.level]) return null;
      const waves = WL.LEVELS[r.level].waves.length;
      r.wave = Math.max(0, Math.min(waves - 1, r.wave | 0));
      r.score = Math.max(0, r.score | 0);
      r.fart = Math.max(0, Math.min(100, r.fart | 0));
      return r;
    } catch (e) { return null; }
  }
  function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* private mode */ } }

  rebuild();

  return {
    data, keyMap, padMap, load, save, set, cycle,
    setKey, setPad, resetControls, norm,
    keyLabel, padLabel, keysFor, padFor,
    saveRun, loadRun, clearRun,
    ACTIONS, PAD_ACTIONS, ACTION_NAMES, OVERLAY_STEPS, MUSIC_STEPS, RESERVED_KEYS, RESERVED_PAD,
    DEFAULT_KEYS, DEFAULT_PAD
  };
})();

/* Frame budget. Coarse pointers get a smaller particle budget; `lite` halves
   burst sizes and is switched on automatically when a phone can't hold ~50fps. */
WL.perf = {
  coarse: false,
  runtimeLite: false,
  get lite() {
    const fx = WL.settings.data.fx;
    if (fx === 'lite') return true;
    if (fx === 'full') return false;
    return this.runtimeLite || (this.coarse && (WL.display.dpr || 1) < 2);
  },
  get fxCap() { return this.lite ? 110 : (this.coarse && WL.settings.data.fx !== 'full') ? 180 : 320; },
  get fxScale() { return this.lite ? 0.5 : (this.coarse && WL.settings.data.fx !== 'full') ? 0.75 : 1; }
};
