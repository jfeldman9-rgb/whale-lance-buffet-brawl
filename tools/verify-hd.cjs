const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = process.argv[2] || require('node:path').resolve(__dirname, '..');
GlobalFonts.registerFromPath(root + '/assets/fonts/press-start-2p.ttf', 'Press Start 2P');
function boot(width,height,dpr,coarse){
  const listeners = {}, clisteners = {}, dl = {}, canvas = createCanvas(640,360);
  canvas.style={};canvas.classList={toggle(){}};
  canvas.addEventListener=(k,fn)=>{if(!clisteners[k])clisteners[k]=fn};
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:parseFloat(canvas.style.width),height:parseFloat(canvas.style.height)});
  const context={console,Math,Promise,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},innerWidth:width,innerHeight:height,devicePixelRatio:dpr,
    matchMedia:q=>({matches:q.includes('coarse')?coarse:q.includes('fine')?!coarse:false,addEventListener(){},removeEventListener(){}}),
    addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn),navigator:{maxTouchPoints:coarse?5:0,getGamepads:()=>[]},
    localStorage:{getItem:()=>null,setItem(){}},location:{hash:''},requestAnimationFrame:fn=>context.frame=fn,
    document:{getElementById:()=>canvas,createElement:()=>createCanvas(1,1),addEventListener:(k,fn)=>(dl[k]??=[]).push(fn),fonts:{load:()=>Promise.resolve()}},
    Image:class{set src(src){try{const im=new Image();im.src=fs.readFileSync(root+'/'+src);this.width=im.width;this.height=im.height;this.onload?.()}catch{this.onerror?.()}}}
  };context.window=context;vm.createContext(context);
  for(const f of ['util','assets','input','audio','voice','sprites','entities','levels','scenes','main'])vm.runInContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),context,{filename:f+'.js'});
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
