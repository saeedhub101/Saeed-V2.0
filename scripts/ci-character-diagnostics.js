// Non-gating character diagnostics. Reports failures but never fails CI.
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const root=process.cwd();
let failures=0;
const report=(name,ok,detail="")=>{
  console.log(`[CHARACTER-DIAG] ${ok?"PASS":"FAIL"} ${name}${detail?": "+detail:""}`);
  if(!ok) failures++;
};
const load=relativePath=>import(pathToFileURL(path.resolve(root,relativePath)).href);

async function run(){
  const read=p=>fs.readFileSync(path.join(root,p),"utf8");

  try{
    const {AnimationController}=await load("src/character/AnimationController.js");
    const {registerCoreMotions}=await load("src/character/motions.js");
    const mock={wakeRender(){},applyCharacterPose(){},resetCharacterPose(){}};
    const animation=new AnimationController(mock);
    registerCoreMotions(animation);
    const motions=animation.registry.list();
    const expected=["nod","shake","wave","think","jump","clap","dance","talkGesture","lookCloser","sitKnee","standUp","stretch","yawn","crackBack","crackFingers","turnBody","walk","sleep","wake","adhanOpening"];
    report("animation registry",motions.length>=10,`motions=${motions.length}`);
    report("motion coverage",expected.every(id=>motions.some(m=>m.id===id)),`expected=${expected.length},registered=${motions.length}`);
    let played=0;
    for(const motion of motions){
      const id=motion.id;
      if(animation.play(id,{duration:.2})) played++;
      animation.update(1/60);
      animation.stop(id);
    }
    report("full motion play/update",played===motions.length,"played="+played+"/"+motions.length);
    report("animation controller lifecycle",animation.status().motions.length>=expected.length);
  }catch(error){report("animation runtime",false,error?.stack||error);}

  try{
    const avatar=read("src/avatar.js");
    const controllerSource=read("src/character/CharacterController.js");
    report("T-pose detection",avatar.includes("normalizeHumanoidRestPose")&&avatar.includes('detected:"t-pose"'));
    report("T-pose normalization hook",avatar.includes("normalizeHumanoidRestPose();")&&avatar.includes("resetCharacterPose();"));
    report("no GLB animation dependency",!avatar.includes("gltf.animations")&&!avatar.includes("AnimationMixer"));
    report("default idle after character load",controllerSource.includes("onCharacterLoaded()")&&controllerSource.includes("setIdlePose(this.animation.idlePose||{})"));
    report("zero character padding",avatar.includes("canvasPadding:0"));
  }catch(error){report("T-pose/GLB behavior diagnostics",false,error?.stack||error);}

  try{
    const controller=read("src/character/CharacterController.js");
    report("idle scheduler present",controller.includes("startIdleScheduler")&&controller.includes("runIdle"));
    report("idle not a permanent render loop",!controller.includes("setInterval"));
    report("idle behavior switch",controller.includes("behavior.idle"));
    const poolMatch=controller.match(/this\.idlePool=\[([\\s\\S]*?)\];/);
    report("idle motion pool",!!poolMatch,`pool=${poolMatch?"detected":"missing"}`);
  }catch(error){report("idle diagnostics",false,error?.message||error);}

  try{
    const faceSource=read("src/character/FaceController.js");
    const {FaceController}=await load("src/character/FaceController.js");
    const calls=[];
    const face=new FaceController({setCharacterExpression:(name,value)=>{calls.push([name,value]);return true;}});
    const expressions=face.status().availableExpressions||[];
    for(const name of ["happy","sad","angry","surprised","confused","sleepy","thinking"])face.expression(name,.8);
    report("emotional profiles",expressions.length>=8,`profiles=${expressions.join(",")}`);
    report("emotional application",calls.length>0,`morphCalls=${calls.length}`);
    report("expression intensity",face.status().intensity===.8);
    report("expression source",faceSource.includes("EXPRESSIONS"));
  }catch(error){report("emotional diagnostics",false,error?.stack||error);}

  try{
    const rig=read("src/character/AutoRigMapper.js");
    const {autoMapBones,requiredRigSlots}=await load("src/character/AutoRigMapper.js");
    const bones=["Hips","Head","LeftUpperArm","RightUpperArm","LeftThigh","RightThigh","LeftForeArm","RightForeArm","LeftHand","RightHand"];
    const mapped=autoMapBones(bones).mapping;
    const required=requiredRigSlots();
    report("PascalCase rig mapping",required.every(slot=>mapped[slot]),JSON.stringify(mapped));
    report("minimum required rig",required.length===6,`required=${required.join(",")}`);
    report("PascalCase aliases",rig.includes("LeftUpperArm")&&rig.includes("RightUpperArm")&&rig.includes("LeftThigh")&&rig.includes("RightThigh"));
  }catch(error){report("rig diagnostics",false,error?.stack||error);}

  console.log(`[CHARACTER-DIAG] SUMMARY failures=${failures}`);
  console.log("[CHARACTER-DIAG] NON_GATING=true");
}
run().catch(error=>{console.error("[CHARACTER-DIAG] FATAL",error);console.log("[CHARACTER-DIAG] NON_GATING=true");});