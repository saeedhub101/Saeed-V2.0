const fs=require("node:fs");
const path=require("node:path");

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const controller=read("src/character-animation-controller.js");
const avatar=read("src/avatar.js");
const motions=read("src/character/motions.js");

const requiredController=[
  "function chooseBehavior",
  "function schedule",
  "function setVisible",
  "stateName==="+""sleeping"",
  "recentBehaviors",
  "priority",
  "window.saeedAnimationController"
];
for(const token of requiredController){
  if(!controller.includes(token)) throw new Error("Animation controller check failed: missing "+token);
}

if(/\\b(?:setInterval|requestAnimationFrame)\\b/.test(controller)){
  throw new Error("Animation controller must remain timer/event driven; continuous loop detected.");
}

const requiredMotions=["id:"idle"","id:"nod"","id:"shake"","id:"wave"","id:"think"","id:"jump"","id:"clap"","id:"dance"","id:"talkGesture""];
for(const token of requiredMotions){
  if(!motions.includes(token)) throw new Error("Core motion registry check failed: missing "+token);
}

for(const token of ["play(name,options)","hasAnimation(name)","getAnimations()","wakeRender"]){
  if(!avatar.includes(token)) throw new Error("Avatar animation API check failed: missing "+token);
}

const planNames=[...controller.matchAll(/pick\\(\\[([^\\]]+)\\]/g)]
  .flatMap(m=>[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]));
console.log("Animation health: controller API OK");
console.log("Animation health: core motion registry OK ("+requiredMotions.length+" motions)");
console.log("Animation health: referenced animation candidates "+new Set(planNames).size);
console.log("Animation health: no continuous loop in autonomous controller");
console.log("Animation health: Hide/Sleep/Priority/Behavior-memory checks OK");
console.log("RAM note: runtime RAM is measured later by the Windows packaged-app resource report; this test does not fake a RAM value.");
