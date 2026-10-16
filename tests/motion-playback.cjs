const assert = require('node:assert/strict');
(async () => {
 let Component, pending, now=0;
 global.performance = {now:()=>now};
 global.HTMLElement = class {};
 global.customElements = {get:()=>null,define:(name,cls)=>Component=cls};
 global.matchMedia = ()=>({matches:false});
 global.requestAnimationFrame = fn => {pending=fn;return 1};
 global.cancelAnimationFrame = ()=>{pending=null};
 global.Image = class {decode(){return Promise.resolve()}};
 await import('../js/ui/onboarding-motion.js');
 const create = (scene,bottom=false)=>{
  const el = new Component();
  Object.assign(el,{dataset:{motion:scene,character:'diego'},isConnected:true,querySelectorAll:()=>Array.from({length:4},()=>({decode:()=>Promise.resolve()})),classList:{contains:()=>bottom,add:()=>{}},style:{setProperty:()=>{}}});
  el.connectedCallback();return el;
 };
 const settle=()=>new Promise(r=>setImmediate(r));
 const football=create('soccer');await settle();
 assert(pending); now=6100;pending(now);const first=football.dataset.frame;
 now=6700;pending(now);assert.notEqual(football.dataset.frame,first,'football continues after six seconds');
 football.isConnected=false;football.disconnectedCallback();assert.equal(pending,null);
 const bottom=create('dogwalk',true);await settle();now+=5500;const tick=pending;pending=null;tick(now);
 assert.equal(bottom.dataset.frame,'0');assert.equal(pending,null,'bottom scene stops after five seconds');
 global.matchMedia=()=>({matches:true});
 const reduced=create('soccer');await settle();assert.equal(reduced.dataset.frame,'0');assert.equal(pending,null);
 console.log('PASS: football loops beyond six seconds, disconnect cancels, bottom duration and reduced motion preserved.');
})().catch(e=>{console.error(e);process.exit(1)});
