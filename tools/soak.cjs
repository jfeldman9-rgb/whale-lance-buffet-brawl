// Offline bot soak: a steady masher plays every stage for up to 4 minutes of game time.
// Usage: node tools/soak.cjs [repoRoot] [seed]   (needs @napi-rs/canvas, like verify-hd.cjs)
const fs=require('fs'),vm=require('vm');
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=process.argv[2]||require('path').resolve(__dirname,'..');
function boot(){
  const canvas=createCanvas(640,360);canvas.style={};canvas.classList={toggle(){}};canvas.addEventListener=()=>{};
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720});
  const m=new Map();
  const ctx={console,Math,Promise,performance:{now:()=>0},setTimeout:(f)=>{f();return 0},clearTimeout(){},setInterval:()=>0,clearInterval(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    matchMedia:q=>({matches:q.includes('fine'),addEventListener(){},removeEventListener(){}}),addEventListener(){},navigator:{maxTouchPoints:0,getGamepads:()=>[]},
    localStorage:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)},location:{hash:''},requestAnimationFrame(){},
    document:{getElementById:()=>canvas,createElement:()=>createCanvas(1,1),addEventListener(){},fonts:{load:()=>Promise.resolve()}},Image:class{set src(s){this.onerror&&this.onerror()}}};
  ctx.window=ctx;vm.createContext(ctx);
  const files=fs.existsSync(root+'/js/settings.js')?['util','settings','assets','input','audio','voice','sprites','entities','levels','options','scenes','main']:['util','assets','input','audio','voice','sprites','entities','levels','scenes','main'];
  for(const f of files)vm.runInContext(fs.readFileSync(root+'/js/'+f+'.js','utf8'),ctx,{filename:f});
  return ctx.WL;
}
let seed=+(process.argv[3]||12345);Math.random=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
const WL=boot();
const results=[];
for(let lvl=0;lvl<4;lvl++){
  const s=new WL.scenes.Play(WL.game,lvl,{score:0,lives:99,fart:0});s.enter();WL.game.scene=s;
  let dmg=0,hits=0,t=0,frame=0;const hitTimes=[];const p=s.player;let lastHp=p.hp;
  const held={};const inp={pressed:{},held,axis:()=>{
    // walk right when clear, else square up to the nearest enemy's lane
    const e=s.enemies.filter(e=>!e.dead).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
    if(!e)return{x:1,y:0};
    const dx=e.x-p.x,dy=e.y-p.y;
    return{x:Math.abs(dx)>40?Math.sign(dx):0,y:Math.abs(dy)>6?Math.sign(dy)*0.8:0};
  }};
  for(;t<240&&s.phase!=='clear'&&s.phase!=='bossdead';frame++){
    const dt=1/60;t+=dt;
    inp.pressed={};
    if(frame%9===0)inp.pressed.attack=true;              // steady masher
    if(p.fart>=p.fartMax&&frame%60===0)inp.pressed.fart=true;
    s.update(dt,inp);
    if(p.hp<lastHp){dmg+=lastHp-p.hp;hits++;hitTimes.push(t);}
    if(p.state==='idle'&&p.hp<40)p.hp=100;             // top up so the run continues
    lastHp=p.hp;
  }
  let lock=0;for(let i=0;i<hitTimes.length;i++){let n=0;for(let j=i;j<hitTimes.length&&hitTimes[j]-hitTimes[i]<=1.5;j++)n++;lock=Math.max(lock,n);}
  results.push({lock,stage:lvl+1,seconds:t.toFixed(0),cleared:s.phase,kills:s.kills,dmgTaken:dmg,timesHit:hits,dmgPerMin:(dmg/(t/60)).toFixed(1),maxCombo:p.hits});
}
console.log(JSON.stringify(results,null,0));
