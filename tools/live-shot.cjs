#!/usr/bin/env node
/* Loads a deployed build (default: the live GitHub Pages URL) in headless Chrome
   with the HTTP cache disabled, reports which painted-art keys loaded, starts a
   Lido fight and screenshots it.
   Usage: node tools/live-shot.cjs [url] [out.png] */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');

const url = process.argv[2] || 'https://jfeldman9-rgb.github.io/whale-lance-buffet-brawl/?v=20260923-gfx2b';
const out = process.argv[3] || null;
const CDP = 9500 + Math.floor(Math.random() * 400);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = fs.mkdtempSync('/tmp/wl-live-');
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--mute-audio',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const done = code => { chrome.kill('SIGKILL'); process.exit(code); };

(async () => {
  let tabs;
  for (let i = 0; i < 100 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(100); } }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const waiting = new Map(), logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.loadingFailed') logs.push('net fail: ' + m.params.errorText + ' ' + m.params.requestId);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, m => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async expr => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 300 && !ready; i++) { ready = await js('return !!(window.WL && WL.assets && WL.assets.done && WL.game && WL.game.scene)').catch(() => false); if (!ready) await sleep(100); }
  const state = await js(`
    const keys = Object.keys(WL.ARTDATA || {}).filter(k => k !== 'plates').map(k => 'art:' + k).concat(Object.keys((WL.ARTDATA || {}).plates || {}).map(k => 'plate:' + k));
    return {
      stamp: (document.querySelector('script[src*="main.js"]').src.match(/v=([\\w-]+)/) || [])[1],
      loaded: keys.filter(k => WL.assets.has(k)), missing: keys.filter(k => !WL.assets.has(k)),
      lance: WL.art.has('lance'), lidoPlate: !!WL.art.plate('lido-far'),
      failed: WL.assets.failed ? WL.assets.failed() : null
    };`);
  console.log(JSON.stringify(state, null, 1));
  await js(`WL.game.debug.play(0);`);
  for (let i = 0; i < 100; i++) { if (await js('return WL.game.scene instanceof WL.scenes.Play && WL.game.fadeDir === 0')) break; await sleep(50); }
  await js(`
    const s = WL.game.scene; s.banner = null; s.bannerT = 0; s.tutorialT = 0; s.phase = 'play'; s.cheatInvuln = true;
    s.locked = true; const p = s.player; p.x = s.camX + 250; p.y = 285; p.facing = 1;
    p.state = 'attack'; p.attack = { pose: 'smash', dur: 0.32, windUntil: 0.05, reach: 52, dmg: 7 }; p.stateT = 0.14;
    p.comboCount = 12; p.comboDisplayT = 3; p.comboPop = 0.8;
    const b = s.spawnEnemy('broccoli', p.x + 60, p.y, { side: 1 }); b.setState('hurt'); b.stateT = 0.1; b.hp = 40;
    s.spawnEnemy('carrot', p.x + 170, p.y - 45, { side: 1 });
    s.spawnEnemy('sprout', p.x - 90, p.y + 25, { side: -1 });
    s.fx.spark(p.x + 50, p.y - 45, true); s.fx.foodDebris(p.x + 50, p.y - 45, 'broccoli');
    s.update = function () {};
  `);
  await sleep(400);
  if (out) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out, Buffer.from(s.data, 'base64')); console.log('saved ' + out); }
  if (logs.length) console.log(logs.join('\n'));
  ws.close();
  done(state.missing.length || !state.lance || !state.lidoPlate ? 1 : 0);
})().catch(e => { console.error(e); done(1); });
