// Animation engine validation. The CharacterController owns motion; client.js is the only renderer-side behavior facade.
const fs=require("node:fs"),path=require("node:path"),root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const controller=read("src/character/client.js"),avatar=read("src/avatar.js"),motions=read("src/character/motions.js"),sequence=read("src/character/MotionSequence.js"),animation=read("src/character/AnimationController.js"),prayer=read("src/prayer-times.js");
for(const token of ["window.saeedAnimationController","getRenderWakeMs","setVisible","speech-start","tool_result"])if(!controller.includes(token))throw new Error("Character client check failed: missing "+token);
if(/\bsetInterval\b/.test(controller))throw new Error("Character client must not create a continuous animation timer.");
for(const token of ['id:"idle"','id:"nod"','id:"shake"','id:"wave"','id:"think"','id:"jump"','id:"clap"','id:"dance"','id:"talkGesture",'sequence("lookCloser"','sequence("sitKnee"','sequence("standUp"','sequence("stretch"','sequence("yawn"','sequence("crackBack"','sequence("crackFingers"','sequence("turnBody"','sequence("walk"','sequence("sleep"','sequence("wake"','id:"adhanOpening"'])if(!motions.includes(token))throw new Error("Core motion registry check failed: missing "+token);
for(const token of ["play(name,options)","hasAnimation(name)","getAnimations()","wakeRender"])if(!avatar.includes(token))throw new Error("Avatar animation API check failed: missing "+token);
if(!sequence.includes("sampleSequence")||!sequence.includes("function sequence"))throw new Error("Motion sequence engine check failed");
if(!animation.includes("fadeIn")||!animation.includes("fadeOut")||!animation.includes("weight")||!animation.includes("priority"))throw new Error("Weighted animation blending check failed");
if(!prayer.includes("calendarByCity")||!prayer.includes("localStorage")||!prayer.includes("setTimeout"))throw new Error("Prayer scheduler/cache/audio hooks check failed");
console.log("Animation health: single CharacterController/client owner OK");
console.log("Animation health: no continuous behavior loop in client");
console.log("Animation health: core motion registry, sequences, blending and prayer hooks OK");