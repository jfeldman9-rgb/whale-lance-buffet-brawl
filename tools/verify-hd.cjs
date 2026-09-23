const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = process.argv[2] || require('node:path').resolve(__dirname, '..');
GlobalFonts.registerFromPath(root + '/assets/fonts/press-start-2p.ttf', 'Press Start 2P');
function memStore(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m}}
function boot(width,height,dpr,coarse,storage){
  const listeners = {}, clisteners = {}, dl = {}, canvas = createCanvas(640,360);
  canvas.style={};canvas.classList={toggle(){}};
  canvas.addEventListener=(k,fn)=>{if(!clisteners[k])clisteners[k]=fn};
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:parseFloat(canvas.style.width),height:parseFloat(canvas.style.height)});
  const context={console,Math,Promise,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},innerWidth:width,innerHeight:height,devicePixelRatio:dpr,
    matchMedia:q=>({matches:q.includes('coarse')?coarse:q.includes('fine')?!coarse:false,addEventListener(){},removeEventListener(){}}),
    addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn),navigator:{maxTouchPoints:coarse?5:0,getGamepads:()=>[]},
    localStorage:storage||memStore(),location:{hash:''},requestAnimationFrame:fn=>context.frame=fn,
    document:{getElementById:()=>canvas,createElement:()=>createCanvas(1,1),addEventListener:(k,fn)=>(dl[k]??=[]).push(fn),fonts:{load:()=>Promise.resolve()}},
    Image:class{set src(src){try{const im=new Image();im.src=fs.readFileSync(root+'/'+src);this.width=im.width;this.height=im.height;this.onload?.()}catch{this.onerror?.()}}}
  };context.window=context;vm.createContext(context);
  for(const f of ['util','settings','assets','input','audio','voice','sprites','entities','levels','options','scenes','main'])vm.runInContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),context,{filename:f+'.js'});
  // Images above test loading/fallback, not cutscene raster composition.
  context.WL.assets.get=()=>null;
  return {context,canvas,listeners,clisteners,dl,WL:context.WL};
}
const cases=[[844,390,3,true,2080,1170],[390,844,3,true,1184,666],[1280,720,2,false,2560,1440],[3840,2160,1,false,3840,2160],[5120,2880,2,false,3840,2160]];
for(const [w,h,dpr,touch,bw,bh] of cases){
 const b=boot(w,h,dpr,touch),{WL,canvas}=b;
 assert.equal(canvas.width,bw);assert.equal(canvas.height,bh);assert.equal(canvas.style.imageRendering,'auto');
 assert.equal(WL.input.touchEnabled,touch);
 const layout=WL.display.pc;
 for(const mode of ['sharp','classic','auto']){WL.display.setMode(mode);assert.equal(WL.display.pc,layout);assert.equal(WL.input.touchEnabled,touch);if(mode==='classic'){assert.equal(canvas.width,640);assert.equal(canvas.height,360);assert.equal(canvas.style.imageRendering,'pixelated')}}
 console.log(`PASS ${w}x${h} @${dpr}: ${bw}x${bh}; all display modes preserve input type`);
}
const b=boot(844,390,3,true),{WL,canvas,listeners,clisteners,context}=b;
const key=(k,down)=>listeners[down?'keydown':'keyup'][0]({key:k,preventDefault(){}});
for(const [k,act] of Object.entries({e:'attack',j:'attack',z:'attack',' ':'jump',k:'jump',x:'jump',q:'special',l:'special',c:'special',r:'tool',i:'tool',v:'tool',f:'fart',b:'fart',Escape:'pause',p:'pause',Enter:'start',m:'mute','\\':'fullscreen'})){
 key(k,true);WL.input.beginFrame();assert.equal(WL.input.pressed[act],true,k);key(k,false);WL.input.beginFrame();assert.equal(WL.input.held[act],false,k);
}
key('d',true);assert.equal(WL.input.axis().x,1);key('d',false);
for(const button of WL.input.touch.buttons){const rect=canvas.getBoundingClientRect();const ev={pointerType:'touch',pointerId:1,clientX:button.x/640*rect.width,clientY:button.y/360*rect.height};clisteners.pointerdown(ev);WL.input.beginFrame();assert.equal(WL.input.pressed[button.id],true,button.id);clisteners.pointerup(ev);assert.equal(WL.input.held[button.id],false)}
const pad={connected:true,index:0,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};context.navigator.getGamepads=()=>[pad];
for(const [idx,act] of Object.entries({0:'jump',1:'fart',2:'attack',3:'special',4:'tool',5:'tool',8:'pause',9:'start'})){pad.buttons[idx].pressed=true;WL.input.beginFrame();assert.equal(WL.input.pressed[act],true);pad.buttons[idx].pressed=false;WL.input.beginFrame();assert.equal(WL.input.held[act],false)}
context.navigator.getGamepads=()=>[];WL.input.beginFrame();
console.log('PASS keyboard aliases, all touch targets and standard gamepad bindings');
for(let i=0;i<4;i++){
 const scene=new WL.scenes.Play(WL.game,i,{});scene.enter?.();scene.phase='play';scene.bannerT=0;scene.player.x=270;scene.player.y=275;
 scene.spawnEnemy(i===0?'broccoli':i===1?'carrot':i===2?'kale':'froyo',360,280,{});
 if(i===3)scene.spawnBoss();
 const ctx=canvas.getContext('2d');ctx.setTransform(WL.display.renderScale,0,0,WL.display.renderScale,0,0);scene.draw(ctx);
 if(process.env.WL_CAPTURE_DIR) fs.writeFileSync(process.env.WL_CAPTURE_DIR+'/wl-stage-'+i+'.png',canvas.toBuffer('image/png'));
 for(let f=0;f<120;f++)scene.update(1/60,WL.input);
 WL.game.scene=scene;scene.paused=false;context.document.hidden=true;b.dl.visibilitychange.forEach(fn=>fn());assert.equal(scene.paused,true);
 console.log(`PASS stage ${i+1}: render, 120 update frames, background auto-pause`);
}
const ctx=canvas.getContext('2d');new WL.scenes.Title(WL.game).draw(ctx);if(process.env.WL_CAPTURE_DIR) fs.writeFileSync(process.env.WL_CAPTURE_DIR+'/wl-title.png',canvas.toBuffer('image/png'));
const titleWidth=WL.text.width(ctx,'BUFFET BRAWL',34);assert.ok(240-titleWidth/2-4>0);console.log('PASS title fits without clipping');

// Exercise actual BOX actions, not just whether an input event was queued.
for (const pointerType of ['mouse', 'pen', 'touch']) {
  const env = boot(844,390,3,pointerType === 'touch');
  const {WL,canvas,clisteners} = env;
  const scene = new WL.scenes.Play(WL.game,0,{}); scene.enter();
  scene.phase='play'; scene.bannerT=0; scene.objects=[]; scene.enemies=[];
  WL.game.scene=scene;
  const rect=canvas.getBoundingClientRect();
  const event=(id,x,y)=>({pointerId:id,pointerType,clientX:x/640*rect.width,clientY:y/360*rect.height});
  const box=event(3,580,326);
  if(pointerType==='touch') {
    clisteners.pointerdown(event(1,60,290));
    clisteners.pointermove(event(1,90,290));
    assert.ok(WL.input.axis().x>0,'joystick moves before BOX');
  }
  clisteners.pointerdown(box); WL.input.beginFrame();
  assert.equal(WL.input.pressed.tool,true);
  assert.equal(!!WL.input.pressed.start,false,'BOX must not pause');
  scene.player.update(1/60,WL.input);
  assert.equal(scene.player.state,'throw');
  clisteners.pointerup(box); WL.input.beginFrame();
  if(pointerType==='touch') {
    assert.ok(WL.input.axis().x>0,'releasing BOX leaves joystick active');
    clisteners.pointerup(event(1,90,290));
  }
  for(let i=0;i<24;i++) scene.player.update(1/60,WL.input);
  assert.equal(scene.projectiles.length,1);
  assert.equal(scene.projectiles[0].kind,'toolbox');
  assert.equal(scene.player.hasToolbox,false);
  const projectile=scene.projectiles[0];
  for(let i=0;i<120 && !projectile.remove;i++) projectile.update(1/60);
  const pickup=scene.pickups.find(p=>p.kind==='toolbox');
  assert.ok(pickup,'thrown toolbox returns as pickup');
  scene.player.collect(pickup);
  assert.equal(scene.player.hasToolbox,true);
  clisteners.pointerdown(box); WL.input.beginFrame(); scene.player.update(1/60,WL.input);
  assert.equal(scene.player.state,'throw','recovered toolbox can be thrown again');
  clisteners.pointercancel(box); assert.equal(WL.input.held.tool,false);
  console.log(`PASS ${pointerType}: BOX throw, recover, rethrow, cancel; no accidental pause`);
}
// Between BOX and ATK, the nearest padded target should win, not array order.
{
  const {WL,canvas,clisteners}=boot(844,390,3,true);
  const rect=canvas.getBoundingClientRect();
  const ev={pointerType:'touch',pointerId:7,clientX:556/640*rect.width,clientY:314/360*rect.height};
  clisteners.pointerdown(ev); WL.input.beginFrame();
  assert.equal(WL.input.pressed.tool,true,'nearest BOX target beats ATK padding');
  assert.equal(!!WL.input.pressed.attack,false);
  clisteners.pointerup(ev);
  // Releasing one finger does not release another finger's same action.
  clisteners.pointerdown({...ev,pointerId:8}); clisteners.pointerdown({...ev,pointerId:9});
  clisteners.pointerup({...ev,pointerId:8}); assert.equal(WL.input.held.tool,true);
  clisteners.lostpointercapture({...ev,pointerId:9}); assert.equal(WL.input.held.tool,false);
  console.log('PASS button-edge hit testing and multi-pointer release');
}

/* ---- Upgrade pass: settings, remaps, continue, fairness, combo, FX, boss ---- */
const freshPlay=(WL,i,carry)=>{const s=new WL.scenes.Play(WL.game,i,carry||{});s.enter();s.phase='play';s.bannerT=0;WL.game.scene=s;return s};
// 10. Settings persistence + 4. remaps survive reload and drive badges.
{
  const store=memStore();
  let env=boot(1280,720,2,false,store);
  let {WL}=env;
  WL.settings.set({overlay:0.85,bigHud:true,colorblind:true,fx:'lite',shake:'reduced'});
  WL.display.setMode('classic'); WL.audio.setVolume(0.35); WL.audio.setMusicLevel(0.4); WL.display.save();
  assert.equal(WL.settings.setKey('attack','h').ok,true);
  assert.equal(WL.settings.setKey('jump','e').ok,true,'old attack primary is free to reuse');
  assert.equal(WL.settings.setPad('attack',1).ok,true);
  assert.equal(JSON.stringify(WL.settings.data.pad.fart),'[2]','stolen pad button swaps, nothing left unbound');
  assert.equal(WL.settings.setKey('attack','Enter').ok,false,'Enter stays reserved');
  env=boot(1280,720,2,false,store); WL=env.WL;
  const s=WL.settings.data;
  assert.equal(s.overlay,0.85); assert.equal(s.bigHud,true); assert.equal(s.colorblind,true); assert.equal(s.fx,'lite'); assert.equal(s.shake,'reduced');
  assert.equal(WL.display.mode,'classic'); assert.equal(env.canvas.width,640,'classic survives reload');
  assert.equal(WL.audio.volume,0.35); assert.equal(WL.audio.musicLevel,0.4);
  const key=(k,down)=>env.listeners[down?'keydown':'keyup'][0]({key:k,preventDefault(){}});
  key('h',true);WL.input.beginFrame();assert.equal(WL.input.pressed.attack,true,'remapped key attacks');key('h',false);
  key('e',true);WL.input.beginFrame();assert.equal(WL.input.pressed.jump,true);assert.equal(!!WL.input.pressed.attack,false);key('e',false);
  key('j',true);WL.input.beginFrame();assert.equal(WL.input.pressed.attack,true,'arcade alias kept');key('j',false);WL.input.beginFrame();
  assert.equal(WL.input.badgeFor('attack'),'H'); assert.equal(WL.input.badgeFor('jump'),'E');
  assert.ok(WL.input.fillKeys('{attack}: GO').startsWith('H/J'),'tutorial copy follows remaps');
  // Badges drawn in the sticky chrome match the remap, and the chrome still draws PICK UP.
  const drawn=[];const orig=WL.text.draw;WL.text.draw=(c,str,...r)=>{drawn.push(str);return orig(c,str,...r)};
  const ctx=env.canvas.getContext('2d');WL.input.drawTouch(ctx,{always:true,fartReady:false,hasToolbox:false});WL.text.draw=orig;
  assert.ok(drawn.includes('H')&&drawn.includes('PICK UP'),'chrome shows remapped badge and PICK UP');
  // Pad remap drives actions.
  const pad={connected:true,index:0,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};env.context.navigator.getGamepads=()=>[pad];
  pad.buttons[1].pressed=true;WL.input.beginFrame();assert.equal(WL.input.pressed.attack,true,'pad remap');pad.buttons[1].pressed=false;WL.input.beginFrame();
  assert.equal(WL.input.badgeFor('attack'),'B');
  // Capture flow: next key goes to the callback, not the game.
  let got=null;WL.input.beginCapture('key',v=>got=v);key('g',true);WL.input.beginFrame();assert.equal(got,'g');assert.equal(!!WL.input.pressed.attack,false);key('g',false);
  WL.settings.resetControls();assert.equal(WL.input.badgeFor('jump'),'A');env.context.navigator.getGamepads=()=>[];WL.input.beginFrame();assert.equal(WL.input.badgeFor('jump'),'SPC');
  console.log('PASS settings persist (display, audio, overlay, HUD, colors, FX, shake, remaps); badges + capture honest');
}
// 3. Continue from stage/wave.
{
  const store=memStore();const env=boot(1280,720,2,false,store);const {WL}=env;
  const scene=freshPlay(WL,1,{score:5000,lives:3,fart:0});
  let run=WL.settings.loadRun();assert.equal(run.level,1);assert.equal(run.wave,0);
  scene.locked=true;scene.waveIdx=2;scene.groupIdx=scene.level.waves[2].groups.length-1;scene.enemies=[];scene.update(1/60,WL.input);
  run=WL.settings.loadRun();assert.equal(run.wave,3,'wave clear writes checkpoint');
  scene.player.setState('idle');scene.player.lives=1;scene.player.hp=1;scene.cheatInvuln=false;scene.player.invuln=0;scene.player.hurt(50,scene.player.x+5,true);
  for(let i=0;i<400&&!(WL.game.nextScene instanceof WL.scenes.GameOver);i++)scene.update(1/60,WL.input);
  const go=WL.game.nextScene;assert.ok(go instanceof WL.scenes.GameOver);assert.equal(go.wave,3);
  WL.game._swap();go.t=1;go.sel=0;go.choose();
  const resumed=WL.game.nextScene;assert.ok(resumed instanceof WL.scenes.Play);WL.game._swap();
  assert.equal(resumed.waveIdx,3);assert.ok(resumed.player.x>resumed.level.waves[2].x,'player placed at the checkpoint');assert.equal(resumed.player.lives,3);
  const t2=new WL.scenes.Title(WL.game);assert.equal(t2.items[0].id,'continue','title offers Continue after reload');
  console.log('PASS continue: checkpoint on wave clear, game over resumes same stage + wave, title Continue');
}
// 1. Fair iframes / anti stun-lock, and 9. AI sandwich rule.
{
  const {WL}=boot(1280,720,2,false);const E=WL.entities;
  const scene=freshPlay(WL,0);const p=scene.player;scene.enemies=[];
  assert.equal(p.hurt(5,p.x+10,false),true);assert.equal(p.hurt(5,p.x+10,false),false,'iframes after a light hit');
  assert.ok(p.invuln>=E.FAIR.lightStun,'iframes cover the whole stun');
  p.invuln=0;p.setState('idle');p.hurt(5,p.x+10,false);p.invuln=0;p.setState('idle');p.hurt(5,p.x+10,false);assert.equal(p.state,'down','third light hit in a streak knocks down (release)');
  p.setState('idle');p.invuln=0;p.hitStreak=0;p.wakeT=0;
  const a=scene.spawnEnemy('broccoli',p.x+30,p.y,{});const b=scene.spawnEnemy('broccoli',p.x-30,p.y,{});a.setState('windup');
  scene.t=10;scene.lastAttackT=0;
  assert.equal(scene.canStartAttack(b),false,'no attacks from both sides at once');
  const c=scene.spawnEnemy('sprout',p.x+50,p.y,{});assert.equal(scene.canStartAttack(c),true,'same-side partner may attack');
  p.setState('hurt');assert.equal(scene.canStartAttack(c),false,'enemies respect a reeling Lance');
  // Enemy melee box matches the drawn tell and misses when Lance side-steps.
  p.setState('idle');p.invuln=0;scene.enemies=[];const e=scene.spawnEnemy('broccoli',p.x+40,p.y+E.FAIR.hurtDepth+2,{});e.facing=-1;e.setState('attack');e.stateT=0.09;e.hitDone=false;const hp=p.hp;e.update(1/60);assert.equal(p.hp,hp,'lane side-step escapes');
  // Enemies get up with brief iframes; light-hit lock limit.
  const g=scene.spawnEnemy('kale',p.x+30,p.y,{});g.setState('getup');assert.equal(g.hittable,false);g.setState('approach');
  for(let i=0;i<E.FAIR.enemyStreakLimit;i++){if(g.state!=='down'){g.setState('approach');g.hurt(1,p.x,{})}}
  assert.equal(g.state,'down','fifth light hit tumbles the enemy');
  console.log('PASS fairness: light-hit iframes, streak knockdown, no sandwiches, openings respected, side-step escapes, getup iframes');
}
// 5. Wrench Pop launcher + juggle; mash keeps the sweep.
{
  const env=boot(1280,720,2,false);const {WL}=env;const E=WL.entities;
  const scene=freshPlay(WL,0);const p=scene.player;scene.enemies=[];scene.objects=[];
  const inp={pressed:{},axis:()=>({x:0,y:0})};
  p.nextCombo='sweep';p.comboTimer=0.42-0.02;p.setState('idle');
  inp.pressed={attack:true};p.update(1/60,inp);assert.equal(p.attack,E.ATTACKS.sweep,'quick press = sweep');
  p.setState('idle');p.nextCombo='sweep';p.comboTimer=0.42-0.15;
  const e=scene.spawnEnemy('broccoli',p.x+36,p.y,{});e.setState('approach');p.facing=1;
  inp.pressed={attack:true};p.update(1/60,inp);assert.equal(p.attack,E.ATTACKS.pop,'a beat later = Wrench Pop');
  inp.pressed={};for(let i=0;i<10;i++)p.update(1/60,inp);
  assert.equal(e.state,'juggle','launcher pops the enemy');
  for(let i=0;i<8;i++)e.update(1/60);
  const before=e.juggleLeft;e.hurt(5,p.x,{});assert.equal(e.juggleLeft,before-1,'follow-up juggles');assert.equal(e.state,'juggle');
  e.juggleLeft=0;e.hurt(5,p.x,{});assert.equal(e.state,'down','juggle budget ends in a knockdown');
  console.log('PASS combo: mash = sweep, timed beat = Wrench Pop launcher, juggle budget');
}
// 7. FX pool + caps.
{
  const {WL}=boot(844,390,1,true);const scene=freshPlay(WL,0);
  WL.settings.set({fx:'auto'});WL.perf.coarse=true;
  for(let i=0;i<200;i++)scene.fx.debris(300,250,'plates');
  assert.ok(scene.fx.list.length<=WL.perf.fxCap,'coarse-pointer cap holds: '+scene.fx.list.length);
  for(let i=0;i<120;i++)scene.fx.update(1/60);
  const pooled=scene.fx.pool.length;assert.ok(pooled>0,'dead particles return to the pool');
  scene.fx.burst(300,250,'broccoli');assert.ok(scene.fx.pool.length<pooled,'new particles reuse pooled objects');
  scene.fx.spark(1,1,true);scene.fx.text(1,1,'X');assert.ok(scene.fx.list.some(f=>f.kind==='text'),'callouts never dropped');
  assert.equal(WL.perf.lite,true,'coarse + 1x DPR runs LITE in auto');
  console.log(`PASS FX pool: cap ${WL.perf.fxCap}, ${pooled} pooled, lite on coarse low-DPR`);
}
// 2. Boss tells: timings, exact belly-flop landing, draw every tell without throwing.
{
  const env=boot(1280,720,2,false);const {WL}=env;const E=WL.entities;
  const scene=freshPlay(WL,3);scene.camX=1400;scene.locked=true;scene.spawnBoss();const b=scene.boss;scene.player.x=1500;scene.player.y=300;
  b.state='approach';b.phase=2;b.hp=b.maxHp*0.5;b.x=1800;b.y=250;
  b.jumpTargetX=1520;b.jumpTargetY=300;b.startTell('jumpWind');assert.equal(b.tellDur,E.BOSS_TELLS.jumpWind[1]);
  const ctx=env.canvas.getContext('2d');
  scene.cheatInvuln=true;
  for(let i=0;i<200&&b.state!=='land';i++){b.update(1/60);if(i%10===0)scene.draw(ctx)}
  assert.equal(b.state,'land');assert.ok(Math.abs(b.x-1520)<6&&Math.abs(b.y-300)<6,`lands on the ring (${b.x.toFixed(1)},${b.y.toFixed(1)})`);
  for(const st of ['slamWind','rainWind']){b.setState('approach');b.startTell(st);for(let i=0;i<42;i++){b.update(1/60);}scene.draw(ctx);assert.ok(b.lastCalled||b.state!==st);}
  b.phase=3;b.hp=b.maxHp*0.2;b.setState('approach');b.startTell('slamWind');assert.ok(b.tellDur>=0.6,'phase 3 tell never below reaction floor');
  if(process.env.WL_CAPTURE_DIR){b.stateT=b.tellDur-0.1;scene.draw(ctx);fs.writeFileSync(process.env.WL_CAPTURE_DIR+'/wl-boss-tell.png',env.canvas.toBuffer('image/png'))}
  console.log('PASS boss tells: per-phase timings, last call, belly flop lands on its ring');
}
// 8. Large HUD / colorblind + pause menus render; options panel changes persist.
{
  const store=memStore();const env=boot(1280,720,2,false,store);const {WL}=env;const ctx=env.canvas.getContext('2d');
  const scene=freshPlay(WL,0);scene.player.hp=20;
  WL.settings.set({bigHud:true,colorblind:true});scene.draw(ctx);assert.equal(scene.hudBottom,55);
  scene.paused=true;scene.pauseSel=5;scene.activatePause();assert.ok(scene.sub instanceof WL.OptionsPanel);scene.draw(ctx);
  const opt=scene.sub;opt.sel=opt.rows.findIndex(r=>r.id==='overlay');opt.activate();assert.notEqual(WL.settings.data.overlay,0.55);
  scene.sub=null;scene.pauseSel=6;scene.activatePause();assert.equal(scene.sub.kind,'controls');scene.draw(ctx);
  const t=new WL.scenes.Title(WL.game);t.sel=t.items.findIndex(i=>i.id==='settings');t.choose();t.draw(ctx);
  assert.ok(JSON.parse(store.getItem('wl-settings')).overlay!==0.55,'overlay change saved');
  console.log('PASS large HUD + colorblind render; pause Options/Controls panels; title Settings');
}
