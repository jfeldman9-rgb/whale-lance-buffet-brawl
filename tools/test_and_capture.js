const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/opt/cursor/artifacts';

async function main() {
  const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
  const tab = tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: `(() => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      console.error('Eval Exception:', res.exceptionDetails);
    }
    return res.result ? res.result.value : res;
  }

  async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  console.log('Connecting to game...');
  await send('Page.enable');

  // Wait until assets are loaded
  while (true) {
    const ready = await evalJs('return !!(window.WL && window.WL.assets && window.WL.assets.done && window.WL.game);');
    if (ready) break;
    await sleep(100);
  }
  await sleep(300);

  // Transition into Play scene cleanly
  async function transitionToPlay() {
    await evalJs('WL.game.debug.play(0);');
    while (true) {
      const res = await evalJs('return { isPlay: WL.game.scene instanceof WL.scenes.Play, fadeDir: WL.game.fadeDir };');
      if (res && res.isPlay && res.fadeDir === 0) break;
      await sleep(50);
    }
  }

  // ==========================================
  // Test 1: Desktop Retina mid-fight (1280x720, dpr=2)
  // ==========================================
  console.log('Setting up Desktop Retina (1280x720, dpr=2)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 2,
    mobile: false
  });
  await evalJs('WL.input.touchEnabled = false; WL.display.mode = "auto"; window.dispatchEvent(new Event("resize")); WL.display.resize();');
  await sleep(200);

  await transitionToPlay();
  await sleep(200);

  // Configure exact mid-fight punch frame
  await evalJs(`
    const scene = WL.game.scene;
    scene.banner = null;
    scene.bannerT = 0;
    scene.phase = 'play';
    scene.camX = 15;
    scene.locked = true;

    const p = scene.player;
    p.x = 270;
    p.y = 275;
    p.facing = 1;
    p.invuln = 0;
    p.state = 'attack';
    p.attack = { pose: 'smash', dur: 0.32, windUntil: 0.05, reach: 52, dmg: 7 };
    p.stateT = 0.14;
    p.comboCount = 8;
    p.comboDisplayT = 2.0;
    p.comboPop = 0.85;
    p.hp = 82;
    scene.playerGhostHp = 96;
    p.fart = 70;
    p.score = 4250;
    scene.lightingPulse = 0.35;

    scene.enemies = [];
    const broc = scene.spawnEnemy('broccoli', 335, 275, { side: 1 });
    broc.setState('hurt');
    broc.stateT = 0.12;
    broc.flash = 0.1;
    broc.hp = 12;

    const sprout = scene.spawnEnemy('sprout', 435, 240, { side: 1 });
    sprout.setState('approach');
    sprout.stateT = 0.5;

    scene.objects = [
      new WL.entities.Breakable(scene, 'plates', 185, 255),
      new WL.entities.Breakable(scene, 'tray', 225, 315),
      new WL.entities.Breakable(scene, 'cart', 390, 305),
      new WL.entities.Breakable(scene, 'chair', 490, 235)
    ];

    scene.fx.list = [];
    scene.fx.spark(325, 235, true);
    scene.fx.foodDebris(325, 235, 'broccoli');
    scene.fx.impactRing(325, 235, true);

    scene.update = function() {};
  `);
  await sleep(250);

  const desktopShot = await send('Page.captureScreenshot', { format: 'png' });
  const desktopPath = path.join(ARTIFACTS_DIR, 'screenshot_desktop_retina_midfight.png');
  fs.writeFileSync(desktopPath, Buffer.from(desktopShot.data, 'base64'));
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'screenshot_midfight_controls.png'), Buffer.from(desktopShot.data, 'base64'));
  console.log('Saved:', desktopPath);

  // ==========================================
  // Test 2: Phone Viewport (844x390 landscape, dpr=3)
  // ==========================================
  console.log('Setting up Phone Landscape (844x390, dpr=3, mobile)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 3,
    mobile: true
  });
  await evalJs('WL.input.touchEnabled = true; WL.display.mode = "auto"; window.dispatchEvent(new Event("resize")); WL.display.resize();');
  await sleep(200);

  await transitionToPlay();
  await sleep(200);

  await evalJs(`
    const scene = WL.game.scene;
    scene.banner = null;
    scene.bannerT = 0;
    scene.phase = 'play';
    scene.camX = 15;
    scene.locked = true;

    const p = scene.player;
    p.x = 265;
    p.y = 275;
    p.facing = 1;
    p.invuln = 0;
    p.state = 'attack';
    p.attack = { pose: 'sweep', dur: 0.36, windUntil: 0.08, reach: 58, dmg: 11 };
    p.stateT = 0.20;
    p.comboCount = 12;
    p.comboDisplayT = 2.0;
    p.comboPop = 1.0;
    p.hp = 74;
    scene.playerGhostHp = 90;
    p.fart = 100; // MAX fart ready!
    p.score = 6800;
    scene.lightingPulse = 0.45;

    scene.enemies = [];
    const broc = scene.spawnEnemy('broccoli', 335, 275, { side: 1 });
    broc.setState('down');
    broc.z = 25;
    broc.stateT = 0.15;
    broc.flash = 0.1;
    broc.hp = 5;

    const sprout = scene.spawnEnemy('sprout', 430, 245, { side: 1 });
    sprout.setState('approach');
    sprout.stateT = 0.5;

    scene.objects = [
      new WL.entities.Breakable(scene, 'plates', 185, 250),
      new WL.entities.Breakable(scene, 'tray', 225, 315),
      new WL.entities.Breakable(scene, 'cart', 390, 305)
    ];

    scene.fx.list = [];
    scene.fx.spark(325, 230, true);
    scene.fx.foodDebris(325, 230, 'broccoli');
    scene.fx.impactRing(325, 230, true);

    scene.update = function() {};
  `);
  await sleep(250);

  const phoneShot = await send('Page.captureScreenshot', { format: 'png' });
  const phonePath = path.join(ARTIFACTS_DIR, 'screenshot_phone_landscape_midfight.png');
  fs.writeFileSync(phonePath, Buffer.from(phoneShot.data, 'base64'));
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'screenshot_phone_controls.png'), Buffer.from(phoneShot.data, 'base64'));
  console.log('Saved:', phonePath);

  // ==========================================
  // Test 3: Wave Clear Presentation & Shattering Debris
  // ==========================================
  console.log('Testing wave clear presentation and prop shatter...');
  await evalJs(`
    const scene = WL.game.scene;
    scene.player.state = 'victory';
    scene.player.stateT = 0.5;
    scene.fx.debris(320, 270, 'plates');
    scene.showBanner('WAVE CLEAR!', 'BONUS +600 PTS', 2.0);
  `);
  await sleep(250);

  const waveClearShot = await send('Page.captureScreenshot', { format: 'png' });
  const waveClearPath = path.join(ARTIFACTS_DIR, 'screenshot_wave_clear_banner.png');
  fs.writeFileSync(waveClearPath, Buffer.from(waveClearShot.data, 'base64'));
  console.log('Saved:', waveClearPath);

  // ==========================================
  // Test 4: Classic 640x360 mode verification
  // ==========================================
  console.log('Testing Classic mode toggle...');
  await evalJs(`
    WL.display.setMode('classic');
  `);
  await sleep(200);
  const classicMode = await evalJs('return WL.display.mode;');
  const classicScale = await evalJs('return WL.display.renderScale;');
  console.log('Display mode:', classicMode, 'renderScale:', classicScale);

  const classicShot = await send('Page.captureScreenshot', { format: 'png' });
  const classicPath = path.join(ARTIFACTS_DIR, 'screenshot_classic_mode.png');
  fs.writeFileSync(classicPath, Buffer.from(classicShot.data, 'base64'));
  console.log('Saved:', classicPath);

  // Restore auto mode
  await evalJs(`
    WL.display.setMode('auto');
  `);

  ws.close();
  console.log('All tests and captures completed successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
