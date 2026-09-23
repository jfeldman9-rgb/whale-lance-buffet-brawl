#!/usr/bin/env node
/* Story presentation capture in real Chrome (software raster, 1920x1080):
   opening card 1, a between-stage StoryBeat and an ending beat, taken at a fixed
   time into each beat. With --video it also records a live-feel clip of the
   opening and the first StoryBeat through the CDP screencast (needs ffmpeg).
   Usage: node tools/story-shots.cjs outDir [--video] [--at=2.6] */
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/story-shots.cjs outDir [--video]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const VIDEO = process.argv.includes('--video');
const ALL = process.argv.includes('--all');
const AT = parseFloat((process.argv.find(a => a.startsWith('--at=')) || '--at=2.6').slice(5));
const HTTP = 9165 + Math.floor(Math.random() * 400), CDP = HTTP + 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = spawn('python3', ['-m', 'http.server', String(HTTP), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const profile = fs.mkdtempSync('/tmp/wl-story-');
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const done = code => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); process.exit(code); };

(async () => {
  let tabs;
  for (let i = 0; i < 100 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(100); } }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const waiting = new Map(), frames = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Page.screencastFrame') {
      frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
      send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, m => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async expr => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(s.data, 'base64')); console.log('shot ' + name); };
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${HTTP}/index.html` });
  for (let i = 0; i < 200; i++) { if (await js('return !!(window.WL && WL.game && WL.game.scene instanceof WL.scenes.Title)').catch(() => false)) break; await sleep(100); }
  await js('window.__errors = []; window.addEventListener("error", e => window.__errors.push(String(e.message)));');
  // Background story plates (when the build has them) finish before the timed shots.
  await js('if (WL.assets.ready) await WL.assets.ready(["story"]);');
  const settle = async () => { for (let i = 0; i < 100; i++) { if (await js('return WL.game.fadeDir === 0 && !WL.game.nextScene')) break; await sleep(30); } };
  /* Wall-clock time inside the current scene, so both old and new scene classes work. */
  const sceneTime = () => js('return (performance.now() - WL.game.sceneAt) / 1000');
  const waitScene = async secs => { while (await sceneTime() < secs) await sleep(30); };

  if (VIDEO) await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await js('WL.game.startNewGame(true)');
  await settle();
  await waitScene(AT);
  await shot('opening-1');
  if (VIDEO) {
    // Let beat 1 play out and carry into beat 2 on its own.
    await sleep(7000);
  }
  if (ALL) {
    // Every remaining beat of the opening reel, at the same time into the beat.
    for (let k = 2; await js('return WL.game.scene.i + 1 < WL.game.scene.beats.length'); k++) {
      await js('const s = WL.game.scene; s.next(); s.trans = null;');
      while (await js('return WL.game.scene.waiting || WL.game.scene.t < ' + AT)) await sleep(30);
      await shot('opening-' + k);
    }
  }
  await js('WL.game.levelComplete(0, { score: 48250, lives: 3, fart: 40 })');
  await sleep(250); await settle();
  await waitScene(AT);
  await shot('storybeat-lido-outro');
  if (VIDEO) {
    await sleep(4500);
    await send('Page.stopScreencast');
  }
  await js('WL.game.showEnding(98765)');
  await sleep(250); await settle();
  await waitScene(AT);
  await shot('ending-1');
  const errs = await js('return window.__errors');
  if (errs.length) console.log('page errors: ' + errs.join(' | '));

  if (VIDEO && frames.length) {
    const dir = fs.mkdtempSync('/tmp/wl-frames-');
    // Resample the screencast (variable rate) onto a constant 30 fps timeline.
    const t0 = frames[0].t, t1 = frames[frames.length - 1].t, n = Math.floor((t1 - t0) * 30);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = t0 + k / 30;
      while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
      fs.writeFileSync(path.join(dir, String(k).padStart(5, '0') + '.jpg'), Buffer.from(frames[j].data, 'base64'));
    }
    const mp4 = path.join(out, 'story-live-feel.mp4');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4]);
    console.log(r.status === 0 ? `video ${mp4} (${frames.length} frames over ${(t1 - t0).toFixed(1)} s)` : 'ffmpeg failed: ' + r.stderr);
  }
  ws.close();
  done(errs.length ? 1 : 0);
})().catch(e => { console.error(e); done(1); });
