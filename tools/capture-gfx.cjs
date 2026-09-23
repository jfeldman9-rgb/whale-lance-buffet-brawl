// Visual smoke test + screenshot capture for the graphics pass.
// Usage: node tools/capture-gfx.cjs [outDir]   (needs @napi-rs/canvas, like verify-hd.cjs)
// Renders the title, a staged mid-fight on every stage, the boss, Classic mode and
// the pause menu at 1920x1080, then checks a few picture properties that the art
// direction depends on (bright sky, see-through control plates, no opaque HUD bar).
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || null;
if (out) fs.mkdirSync(out, { recursive: true });
GlobalFonts.registerFromPath(root + '/assets/fonts/press-start-2p.ttf', 'Press Start 2P');

function boot(width, height, dpr, coarse) {
  const listeners = {}, clisteners = {}, dl = {}, canvas = createCanvas(640, 360);
  canvas.style = {}; canvas.classList = { toggle() {} };
  canvas.addEventListener = (k, fn) => { if (!clisteners[k]) clisteners[k] = fn; };
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: parseFloat(canvas.style.width), height: parseFloat(canvas.style.height) });
  const m = new Map();
  const context = { console, Math, Promise, performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, innerWidth: width, innerHeight: height, devicePixelRatio: dpr,
    matchMedia: q => ({ matches: q.includes('coarse') ? coarse : q.includes('fine') ? !coarse : false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (k, fn) => (listeners[k] ??= []).push(fn), navigator: { maxTouchPoints: coarse ? 5 : 0, getGamepads: () => [] },
    localStorage: { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }, location: { hash: '' }, requestAnimationFrame: fn => context.frame = fn,
    document: { getElementById: () => canvas, createElement: () => createCanvas(1, 1), addEventListener: (k, fn) => (dl[k] ??= []).push(fn), fonts: { load: () => Promise.resolve() } },
    Image: class { set src(src) { try { const im = new Image(); im.src = fs.readFileSync(root + '/' + src); this.width = im.width; this.height = im.height; this.onload?.(); } catch { this.onerror?.(); } } }
  };
  context.window = context; vm.createContext(context);
  for (const f of ['util', 'settings', 'assets', 'input', 'audio', 'voice', 'sprites', 'entities', 'levels', 'options', 'scenes', 'main']) vm.runInContext(fs.readFileSync(root + '/js/' + f + '.js', 'utf8'), context, { filename: f + '.js' });
  context.WL.assets.get = () => null;
  return { context, canvas, clisteners, WL: context.WL };
}

const env = boot(960, 540, 2, false);
const { WL, canvas } = env;
const ctx = canvas.getContext('2d');
const save = name => { if (out) fs.writeFileSync(path.join(out, name + '.png'), canvas.toBuffer('image/png')); };
const frame = draw => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); const rs = WL.display.renderScale; ctx.setTransform(rs, 0, 0, rs, 0, 0); draw(); };
/** Average RGB over a world-space rect. */
function avg(x, y, w, h) {
  const rs = WL.display.renderScale;
  const d = ctx.getImageData(Math.round(x * rs), Math.round(y * rs), Math.max(1, Math.round(w * rs)), Math.max(1, Math.round(h * rs))).data;
  let r = 0, g = 0, b = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  return [r / n, g / n, b / n];
}
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const failures = [];
const check = (ok, msg) => { if (!ok) { failures.push(msg); console.log('FAIL ' + msg); } };

/** A readable mid-fight moment: Lance mid-smash into a goon, a crowd around, debris in the air, a hot combo. */
function stageFight(i, opts = {}) {
  const s = new WL.scenes.Play(WL.game, i, { score: 48250, lives: 3, fart: 62 });
  s.enter(); s.phase = 'play'; s.bannerT = 0; s.cards = []; s.tutorialT = 0; WL.game.scene = s;
  const p = s.player;
  s.camX = opts.camX != null ? opts.camX : 180;
  p.x = s.camX + 250; p.y = 292; p.facing = 1;
  s.objects = s.objects.filter(o => o.x > s.camX - 40 && o.x < s.camX + 680);
  const types = opts.types || ['broccoli', 'sprout', 'carrot', 'sprout'];
  const spots = [[p.x + 58, p.y + 2], [p.x - 78, p.y - 36], [p.x + 130, p.y - 58], [p.x - 150, p.y + 22], [p.x + 210, p.y + 30]];
  types.forEach((t, k) => { const e = s.spawnEnemy(t, spots[k][0], spots[k][1], {}); e.setState('approach'); e.facing = e.x > p.x ? -1 : 1; e.t = k * 0.7; });
  s.cards = [];
  const target = s.enemies[0];
  if (target) { target.setState('hurt'); target.flash = 0; }
  p.setState('attack'); p.attack = WL.entities.ATTACKS.smash; p.stateT = p.attack.windUntil + 0.02; p.t = 1.3;
  p.comboCount = opts.combo || 12; p.comboDisplayT = 2; p.comboPop = 0.4; p.lastTool = 'smash'; p.lastToolT = 1;
  p.hasToolbox = true;
  for (let k = 0; k < 3; k++) s.fx.update(0);
  const hx = p.x + 46, hy = p.y - 50;
  s.fx.spark(hx, hy, true); s.fx.impactRing(hx, hy, true);
  s.fx.foodDebris(hx, hy, target ? target.type : 'broccoli'); s.fx.burst(hx, hy, target ? target.type : 'broccoli');
  s.fx.debris(p.x + 150, p.y - 30, 'plates');
  for (let k = 0; k < 9; k++) s.fx.update(1 / 60);
  s.fx.spark(hx + 4, hy - 6, true);
  for (const e of s.enemies) e.flash = 0;
  s.flashT = 0; s.shakeX = s.shakeY = 0; s.punchX = s.punchY = 0; s.lightingPulse = 0.25;
  return s;
}

const shots = [];
// Title
const title = new WL.scenes.Title(WL.game); title.t = 1.2;
frame(() => title.draw(ctx)); save('01-title'); shots.push('01-title');
{
  // Title keeps the deck scene bright behind the logo.
  const sky = avg(0, 0, 640, 30); check(lum(sky) > 90, 'title sky is daylight, not a dark plate: ' + lum(sky).toFixed(0));
}
// Lido deck mid-fight
let s = stageFight(0);
frame(() => s.draw(ctx)); save('02-lido-midfight'); shots.push('02-lido-midfight');
{
  const sky = avg(160, 60, 300, 20);
  check(sky[2] > 150 && lum(sky) > 120, 'lido sky is bright blue: ' + sky.map(v => v | 0));
  // No opaque full-width bar across the top: sky shows between HUD pieces.
  const gap = avg(238, 30, 6, 8);
  check(lum(avg(432, 4, 14, 5)) > 70, 'sky shows between the logo and the tracker');
  check(lum(gap) > 70, 'top HUD is not an opaque plate: ' + lum(gap).toFixed(0));
  const deck = avg(0, 300, 640, 50);
  check(deck[0] > deck[2] + 25, 'deck reads as warm wood: ' + deck.map(v => v | 0));
}
s = stageFight(0, { camX: 1180, types: ['broccoli', 'celery', 'sprout', 'broccoli', 'sprout'], combo: 7 });
frame(() => s.draw(ctx)); save('03-lido-crowd'); shots.push('03-lido-crowd');
s = stageFight(1, { camX: 900, types: ['carrot', 'spinach', 'carrot', 'broccoli'] });
frame(() => s.draw(ctx)); save('04-acplant'); shots.push('04-acplant');
s = stageFight(2, { camX: 700, types: ['kale', 'froyo', 'celery', 'sprout'] });
frame(() => s.draw(ctx)); save('05-juicebar'); shots.push('05-juicebar');
// Boss
s = stageFight(3, { camX: 1260, types: ['froyo'] });
s.spawnBoss(); s.bannerT = 0; const b = s.boss; b.x = s.player.x + 150; b.y = 280; b.state = 'approach'; b.phase = 2; b.hp = b.maxHp * 0.55; b.armor = 0;
b.startTell('slamWind'); b.stateT = b.tellDur * 0.6;
frame(() => s.draw(ctx)); save('06-boss'); shots.push('06-boss');
// Sticky chrome is see-through: the same chrome over two different backdrops must differ inside the plates.
{
  const probe = color => { frame(() => { ctx.fillStyle = color; ctx.fillRect(0, 0, 640, 360); WL.input.drawTouch(ctx, { always: true, fartReady: false, hasToolbox: false }); }); return [avg(503, 290, 4, 4), avg(40, 245, 6, 6), avg(440, 222, 4, 4)]; };
  const red = probe('#ff0000'), blue = probe('#0000ff');
  for (let k = 0; k < 3; k++) check(red[k][0] - blue[k][0] > 60 && blue[k][2] - red[k][2] > 60, 'control plate ' + k + ' stays see-through');
  // PICK UP still shows when Lance has no toolbox.
  const drawn = []; const orig = WL.text.draw; WL.text.draw = (c, str, ...r) => { drawn.push(str); return orig(c, str, ...r); };
  WL.input.drawTouch(ctx, { always: true, fartReady: false, hasToolbox: false }); WL.text.draw = orig;
  check(drawn.includes('PICK UP'), 'BOX badge reads PICK UP without a toolbox');
}
// Pause menu over the fight
s = stageFight(0); s.paused = true; s.pauseSel = 4;
frame(() => s.draw(ctx)); save('07-pause'); shots.push('07-pause');
// Large HUD + colorblind-safe health, low HP
WL.settings.set({ bigHud: true, colorblind: true });
s = stageFight(0, { camX: 600 }); s.player.hp = 22; s.playerGhostHp = 40;
frame(() => s.draw(ctx)); save('10-large-hud-colorblind'); shots.push('10-large-hud-colorblind');
WL.settings.set({ bigHud: false, colorblind: false });
// Classic 640x360
WL.display.setMode('classic');
assert.equal(canvas.width, 640); assert.equal(canvas.style.imageRendering, 'pixelated');
s = stageFight(0);
frame(() => s.draw(ctx)); save('08-classic-640x360'); shots.push('08-classic-640x360');
WL.display.setMode('auto');
// Lite effects still render the whole picture.
WL.settings.set({ fx: 'lite' });
s = stageFight(0);
frame(() => s.draw(ctx)); save('09-lite'); shots.push('09-lite');
WL.settings.set({ fx: 'auto' });

if (failures.length) { console.log(failures.length + ' visual check(s) failed'); process.exit(1); }
console.log('PASS visual smoke: title, 4 stages mid-fight, boss tell, pause, classic, lite' + (out ? ' -> ' + out : ''));
