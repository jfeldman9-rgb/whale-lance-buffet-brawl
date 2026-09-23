/* Settings panels shared by the title screen and the pause menu.
   'options': audio (title only), display (title only), control overlay
   opacity, HUD size, health colors, effects budget, screen shake.
   'controls': keyboard + gamepad remapping with live capture. */
'use strict';

(function () {
  const W = WL.W, H = WL.H;
  const D = WL.draw, T = WL.text, A = WL.audio, ST = WL.settings;

  const persistAudio = () => { if (WL.display.save) WL.display.save(); };

  function optionRows(full) {
    const s = ST.data;
    const rows = [];
    if (full) {
      rows.push({ id: 'sound', label: () => 'SOUND: ' + A.volumeLabel(), adj: dir => { A.cycleVolume(dir); persistAudio(); }, desc: 'Master volume. M mutes any time.' });
      rows.push({ id: 'music', label: () => 'MUSIC: ' + A.musicLabel(), adj: dir => { A.cycleMusic(dir); persistAudio(); }, desc: 'Music level. It also ducks under big hits and barks.' });
      rows.push({ id: 'display', label: () => 'DISPLAY: ' + WL.display.modeLabel(), adj: dir => WL.display.cycleMode(dir), desc: 'AUTO = device pixels. SHARP = 2x+. CLASSIC = 640x360 pixels + scanlines.' });
    }
    rows.push(
      { id: 'overlay', label: () => 'CONTROL OVERLAY: ' + Math.round(s.overlay * 100) + '%', adj: dir => ST.cycle('overlay', ST.OVERLAY_STEPS, dir), desc: 'How strong the on-screen control picture is. It always stays up.' },
      { id: 'hud', label: () => 'HUD SIZE: ' + (s.bigHud ? 'LARGE' : 'NORMAL'), adj: () => ST.set({ bigHud: !s.bigHud }), desc: 'Larger health, meter, score and callout text.' },
      { id: 'colors', label: () => 'HEALTH COLORS: ' + (s.colorblind ? 'COLORBLIND-SAFE' : 'CLASSIC'), adj: () => ST.set({ colorblind: !s.colorblind }), desc: 'Blue / yellow / vermilion health, HP number, and pattern-marked tells.' },
      { id: 'fx', label: () => 'EFFECTS: ' + s.fx.toUpperCase() + (s.fx === 'auto' ? (WL.perf.lite ? ' (LITE)' : ' (FULL)') : ''), adj: dir => { const o = ['auto', 'full', 'lite']; ST.set({ fx: o[(o.indexOf(s.fx) + (dir || 1) + 3) % 3] }); }, desc: 'LITE halves particles and debris. AUTO picks LITE on slow phones.' },
      { id: 'shake', label: () => 'SCREEN SHAKE: ' + (s.shake === 'full' ? 'FULL' : 'REDUCED'), adj: () => ST.set({ shake: s.shake === 'full' ? 'reduced' : 'full' }), desc: 'REDUCED also softens the white hit flashes.' },
      { id: 'back', label: () => 'BACK', back: true, desc: '' }
    );
    return rows;
  }

  function controlRows() {
    const rows = ST.ACTIONS.map(a => ({ id: a, bind: true }));
    rows.push({ id: 'reset', label: () => 'RESET TO DEFAULTS', desc: 'Restores WASD / arrows / E J Z ... and the standard pad layout.' });
    rows.push({ id: 'back', label: () => 'BACK', back: true, desc: '' });
    return rows;
  }

  class OptionsPanel {
    constructor(kind, opts = {}) {
      this.kind = kind;
      this.full = !!opts.full;
      this.sel = 0;
      this.col = WL.input.gamepad.connected ? 1 : 0;
      this.msg = ''; this.msgT = 0;
      this.listening = null;
      this.rows = kind === 'controls' ? controlRows() : optionRows(this.full);
      this.y0 = kind === 'controls' ? 64 : 66;
      this.step = kind === 'controls' ? 15 : 19;
    }
    rowAt(p) {
      if (!p) return -1;
      for (let i = 0; i < this.rows.length; i++) {
        const y = this.y0 + i * this.step;
        if (p.y >= y - 4 && p.y < y + this.step - 4 && p.x > 36 && p.x < W - 36) return i;
      }
      return -1;
    }
    flash(msg) { this.msg = msg; this.msgT = 2.2; }
    update(inp, dt) {
      if (this.msgT > 0) this.msgT -= dt || 1 / 60;
      if (this.listening) {
        if (!WL.input.capturing) this.listening = null;
        else if (inp.pressed.click) { WL.input.cancelCapture(); this.listening = null; this.flash('CANCELLED'); }
        return null;
      }
      if (inp.pressed.pause) { A.sfx.blip(); return 'back'; }
      const n = this.rows.length;
      if (inp.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx.blip(); }
      if (inp.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx.blip(); }
      const dir = inp.pressed.right ? 1 : inp.pressed.left ? -1 : 0;
      const row = this.rows[this.sel];
      if (dir) {
        if (row.bind) { this.col = dir > 0 ? 1 : 0; A.sfx.blip(); }
        else if (row.adj) { row.adj(dir); A.sfx.blip(); }
      }
      if (inp.pressed.click && inp.pointer) {
        const i = this.rowAt(inp.pointer);
        if (i < 0) return null;
        this.sel = i;
        if (this.rows[i].bind) this.col = inp.pointer.x >= 440 ? 1 : 0;
        return this.activate();
      }
      if (inp.pressed.start || inp.pressed.attack) return this.activate();
      return null;
    }
    activate() {
      const row = this.rows[this.sel];
      A.sfx.select();
      if (row.back) return 'back';
      if (row.id === 'reset') { ST.resetControls(); this.flash('CONTROLS RESET'); return null; }
      if (row.bind) {
        const action = row.id;
        const pad = this.col === 1;
        if (pad && !ST.PAD_ACTIONS.includes(action)) { this.flash('MOVEMENT USES THE STICK / D-PAD'); return null; }
        this.listening = { action, pad };
        WL.input.beginCapture(pad ? 'pad' : 'key', value => {
          this.listening = null;
          if (value == null) { this.flash('CANCELLED'); return; }
          const res = pad ? ST.setPad(action, value) : ST.setKey(action, value);
          if (res.ok) {
            const label = pad ? ST.padLabel(value) : ST.keyLabel(ST.norm(value));
            this.flash(`${ST.ACTION_NAMES[action]} = ${label}`);
            A.sfx.pickup();
          } else { this.flash(res.reason); A.sfx.hurt(); }
        });
        return null;
      }
      if (row.adj) row.adj(1);
      return null;
    }
    draw(ctx) {
      D.fillRRect(ctx, 28, 22, W - 56, H - 44, 6, 'rgba(4,6,22,0.95)', '#ffe14a');
      const title = this.kind === 'controls' ? 'CONTROLS' : 'OPTIONS';
      T.draw(ctx, title, W / 2, 32, { size: 14, align: 'center', gradient: ['#fff', '#ffe14a'], stroke: '#000', strokeWidth: 4 });
      if (this.kind === 'controls') this.drawControls(ctx);
      else this.drawOptions(ctx);
      const row = this.rows[this.sel];
      const foot = this.msgT > 0 ? this.msg : (row && row.desc) || '';
      if (foot) T.draw(ctx, foot, W / 2, H - 50, { size: 6, align: 'center', color: this.msgT > 0 ? '#9f3' : '#bcd' });
      const back = WL.input.touchEnabled ? 'TAP A ROW. TAP BACK TO RETURN.' : `UP/DOWN PICK   LEFT/RIGHT CHANGE   ${WL.input.hint('pause', 1)} BACK`;
      T.draw(ctx, back, W / 2, H - 36, { size: 6, align: 'center', color: '#89a' });
    }
    drawOptions(ctx) {
      this.rows.forEach((r, i) => {
        const y = this.y0 + i * this.step;
        const sel = i === this.sel;
        const label = r.label() + (r.adj && sel ? '   < >' : '');
        T.draw(ctx, (sel ? '> ' : '  ') + label, 60, y, { size: 8, color: sel ? '#ffe14a' : '#ddd' });
      });
      const s = ST.data;
      const row = this.rows[this.sel];
      // Live previews so a setting shows what it does before you leave.
      if (row.id === 'overlay') {
        ctx.save(); ctx.globalAlpha = s.overlay;
        D.circle(ctx, W - 92, 120, 22, 'rgba(238,51,51,0.18)', 'rgba(255,255,255,0.6)');
        T.draw(ctx, 'ATK', W - 92, 110, { size: 7, align: 'center', color: '#fff', stroke: '#000', strokeWidth: 3 });
        T.draw(ctx, WL.input.badgeFor('attack'), W - 92, 121, { size: 6, align: 'center', color: '#ffe14a', stroke: '#000', strokeWidth: 3 });
        ctx.restore();
      } else if (row.id === 'colors' || row.id === 'hud') {
        const bw = s.bigHud ? 120 : 96, bh = s.bigHud ? 11 : 9;
        const cols = s.colorblind ? ['#56b4e9', '#f0e442', '#d55e00'] : ['#3cdb3c', '#f0c020', '#e03020'];
        [0.9, 0.45, 0.18].forEach((pct, i) => {
          const y = 96 + i * 26;
          D.arcadeBar(ctx, W - 60 - bw, y, bw, bh, pct, pct, cols[i], '#ff9922', '#22080a');
          if (pct <= 0.25) D.hatch(ctx, W - 60 - bw, y, Math.round(bw * pct), bh);
          if (s.colorblind || s.bigHud) T.draw(ctx, `${Math.round(pct * 100)}`, W - 56, y + (bh - 7) / 2, { size: 7, color: '#fff' });
        });
      }
    }
    drawControls(ctx) {
      const kx = 360, px = 500;
      T.draw(ctx, 'KEYBOARD', kx, 50, { size: 7, align: 'center', color: this.col === 0 ? '#ffe14a' : '#9ab' });
      T.draw(ctx, WL.input.gamepad.connected ? 'GAMEPAD' : 'GAMEPAD (NONE)', px, 50, { size: 7, align: 'center', color: this.col === 1 ? '#ffe14a' : '#9ab' });
      this.rows.forEach((r, i) => {
        const y = this.y0 + i * this.step;
        const sel = i === this.sel;
        if (!r.bind) {
          T.draw(ctx, (sel ? '> ' : '  ') + r.label(), 60, y, { size: 7, color: sel ? '#ffe14a' : '#ddd' });
          return;
        }
        T.draw(ctx, (sel ? '> ' : '  ') + ST.ACTION_NAMES[r.id], 60, y, { size: 7, color: sel ? '#ffe14a' : '#ddd' });
        const keys = ST.keysFor(r.id, 3);
        const keyText = keys.length ? keys[0] + (keys.length > 1 ? '  (' + keys.slice(1).join(' ') + ')' : '') : '--';
        const listenK = this.listening && this.listening.action === r.id && !this.listening.pad;
        const listenP = this.listening && this.listening.action === r.id && this.listening.pad;
        const blink = Math.floor(performance.now() / 250) % 2 === 0;
        if (sel && this.col === 0) D.fillRRect(ctx, kx - 70, y - 3, 140, 13, 3, 'rgba(255,225,74,0.16)', '#ffe14a');
        if (sel && this.col === 1) D.fillRRect(ctx, px - 50, y - 3, 100, 13, 3, 'rgba(255,225,74,0.16)', '#ffe14a');
        T.draw(ctx, listenK ? (blink ? 'PRESS A KEY' : '') : keyText, kx, y, { size: 7, align: 'center', color: listenK ? '#9f3' : '#fff' });
        T.draw(ctx, listenP ? (blink ? 'PRESS BUTTON' : '') : ST.padFor(r.id), px, y, { size: 7, align: 'center', color: listenP ? '#9f3' : (ST.PAD_ACTIONS.includes(r.id) ? '#fff' : '#789') });
      });
      if (this.listening) {
        const how = this.listening.pad ? 'START OR A TAP CANCELS' : 'ESC OR A CLICK CANCELS';
        T.draw(ctx, `REMAPPING ${ST.ACTION_NAMES[this.listening.action]}.  ${how}.`, W / 2, H - 64, { size: 6, align: 'center', color: '#9f3' });
      } else {
        T.draw(ctx, 'ENTER / START / MENU KEYS AND M, \\ STAY FIXED SO YOU CAN ALWAYS GET BACK.', W / 2, H - 64, { size: 5, align: 'center', color: '#789' });
      }
    }
  }

  WL.OptionsPanel = OptionsPanel;
})();
