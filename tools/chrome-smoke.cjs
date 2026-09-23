#!/usr/bin/env node
/* Chrome smoke on the software raster path: real mouse clicks on ATK and BOX,
   BOX turns into PICK UP while the toolbox is out and back once it's picked up,
   the same in Classic 640x360, then a busy Lido fight timed at 1280x720 DPR 1.
   Usage: node tools/chrome-smoke.cjs [shotDir]   (needs google-chrome and python3) */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shots = process.argv[2] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const HTTP = 8765 + Math.floor(Math.random() * 400), CDP = HTTP + 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (ok, what, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + what + (extra ? '  ' + extra : '')); if (!ok) failed++; };

const server = spawn('python3', ['-m', 'http.server', String(HTTP), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const profile = fs.mkdtempSync('/tmp/wl-chrome-');
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const done = code => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); process.exit(code); };

(async () => {
  let tabs;
  for (let i = 0; i < 100 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(100); } }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, m => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async expr => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async name => { if (!shots) return; const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(s.data, 'base64')); };
  const viewport = (width, height, dpr) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
  // World (640x360) point to a CSS pixel on the canvas.
  const at = (wx, wy) => js(`const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${wx} * r.width / WL.W, r.top + ${wy} * r.height / WL.H];`);
  const click = async (wx, wy) => {
    const [x, y] = await at(wx, wy);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(90);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  await viewport(1280, 720, 1);
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${HTTP}/index.html` });
  for (let i = 0; i < 200; i++) { if (await js('return !!(window.WL && WL.game && WL.game.scene instanceof WL.scenes.Title)').catch(() => false)) break; await sleep(100); }
  check(await js('return WL.game.scene instanceof WL.scenes.Title'), 'boots to the title');
  check(await js(`return !!WL.art.plate('lido-far') && WL.art.has('lance')`), 'painted atlases and plates load over HTTP');
  const stamp = await js(`return [...document.scripts].map(s => (s.src.match(/v=([\\w-]+)/) || [])[1]).filter(Boolean)`);
  check(stamp.length > 5 && stamp.every(v => v === '20260923-gfx2'), 'every script served with ?v=20260923-gfx2');

  // Watch what the touch/mouse layer draws so the BOX badge can be checked.
  await js(`
    const orig = WL.input.drawTouch;
    WL.input.drawTouch = function (ctx, o) { window.__touchOpts = o; return orig.apply(this, arguments); };
    window.__errors = [];
    window.addEventListener('error', e => window.__errors.push(String(e.message)));
  `);
  const toPlay = async () => {
    await js('WL.game.debug.play(0); WL.game.debug.invuln(true);');
    for (let i = 0; i < 100; i++) { if (await js('return WL.game.scene instanceof WL.scenes.Play && WL.game.fadeDir === 0')) break; await sleep(50); }
    await js(`const s = WL.game.scene; s.banner = null; s.bannerT = 0; s.tutorialT = 0; s.phase = 'play';`);
    await sleep(300);
  };
  const BTN = { attack: [640 - 118, 360 - 62], tool: [640 - 60, 360 - 34] };

  async function controls(label) {
    await toPlay();
    check(await js('return !!(window.__touchOpts && window.__touchOpts.always)'), `${label}: whole-fight controls are drawn`);
    // ATK by mouse
    await js(`const p = WL.game.scene.player; p.setState('idle'); window.__atk = 0; const o = p.setState.bind(p); p.setState = (st, ...a) => { if (st === 'attack') window.__atk++; return o(st, ...a); };`);
    await click(...BTN.attack);
    await sleep(200);
    check(await js('return window.__atk > 0 || WL.game.scene.player.state === "attack"'), `${label}: mouse click on ATK attacks`);
    await sleep(500);
    // BOX by mouse: the toolbox flies, the badge turns into PICK UP
    await js(`const p = WL.game.scene.player; p.setState('idle'); p.hasToolbox = true;`);
    await click(...BTN.tool);
    await sleep(700);
    const thrown = await js('const s = WL.game.scene; return { has: s.player.hasToolbox, flying: s.projectiles.some(p => p.kind === "toolbox"), pickup: s.pickups.some(p => p.kind === "toolbox") }');
    check(!thrown.has && (thrown.flying || thrown.pickup), `${label}: mouse click on BOX throws the toolbox`, JSON.stringify(thrown));
    await sleep(900);
    check(await js('return window.__touchOpts && window.__touchOpts.hasToolbox === false'), `${label}: BOX reads PICK UP while the toolbox is out`);
    await shot(label.toLowerCase().replace(/\W+/g, '-') + '-pick-up');
    // walk Lance onto the dropped box
    await js(`const s = WL.game.scene, b = s.pickups.find(p => p.kind === 'toolbox'); if (b) { s.player.x = b.x - 8; s.player.y = b.y; }`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(400);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(200);
    check(await js('return WL.game.scene.player.hasToolbox && window.__touchOpts.hasToolbox !== false'), `${label}: walking over the box recovers it, BOX is back`);
  }

  await js(`WL.display.setMode('auto')`);
  await controls('Auto 1280x720');
  await js(`WL.display.setMode('classic')`);
  await sleep(200);
  const cls = await js('const c = document.querySelector("canvas"); return [c.width, c.height, WL.display.mode]');
  check(cls[0] === 640 && cls[1] === 360, 'Classic backs the canvas at 640x360', cls.join('x'));
  await controls('Classic');
  await js(`WL.display.setMode('auto')`);

  // Frame budget: a crowded Lido fight on the software path, rAF-paced.
  await viewport(1280, 720, 1);
  await sleep(300);
  await toPlay();
  await js(`
    const s = WL.game.scene; WL.perf.runtimeLite = false;
    s.locked = true; s.player.x = s.camX + 260; s.player.y = 280;
    for (const [t, dx, dy] of [['broccoli', 80, -10], ['carrot', 150, -40], ['sprout', -90, 20], ['sprout', 190, 30], ['celery', -150, -30], ['sprout', 40, 50]]) s.spawnEnemy(t, s.player.x + dx, s.player.y + dy, { side: dx > 0 ? 1 : -1 });
  `);
  const perf = await js(`
    const s = WL.game.scene, P = WL.scenes.Play.prototype, od = s.draw;
    let work = [];
    s.draw = function (ctx) { const t0 = performance.now(); od.call(this, ctx); work.push(performance.now() - t0); };
    const beat = setInterval(() => { s.fx.spark(s.player.x + 30, s.player.y - 40, true); s.fx.foodDebris(s.player.x + 30, s.player.y - 40, 'broccoli'); }, 250);
    let frames = 0, run = true;
    const tick = () => { frames++; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, 1000)); frames = 0; work = [];
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, 5000));
    run = false; clearInterval(beat);
    const secs = (performance.now() - t0) / 1000;
    work.sort((a, b) => a - b);
    return { fps: frames / secs, drawMs: work.reduce((a, b) => a + b, 0) / work.length, p95: work[Math.floor(work.length * 0.95)], lite: WL.perf.runtimeLite || WL.perf.lite, scale: WL.display.renderScale, fx: s.fx.list.length };
  `);
  check(perf.fps >= 55 && !perf.lite, 'Lido fight at 1280x720 on the software path holds ~60 fps', `${perf.fps.toFixed(1)} fps, draw ${perf.drawMs.toFixed(2)} ms avg / ${perf.p95.toFixed(2)} ms p95, ${perf.fx} fx, ${perf.scale}x`);
  await shot('perf-1280x720');
  const errs = await js('return window.__errors');
  check(!errs.length, 'no page errors', errs.join(' | '));
  console.log(failed ? `${failed} check(s) failed` : 'Chrome smoke: all checks passed');
  ws.close();
  done(failed ? 1 : 0);
})().catch(e => { console.error(e); done(1); });
