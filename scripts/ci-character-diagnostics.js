// Non-gating character diagnostics. Every check reports PASS/FAIL but never sets a failing exit code.
const fs=require("node:fs");
const path=require("node:path");

const root=process.cwd();
let failures=0;
const report=(name,ok,detail="")=>{
  console.log(`[CHARACTER-DIAG] ${ok?"PASS":"FAIL"} ${name}${detail?": "+detail:""}`);
  if(!ok) failures++;
};

async function run(){
  const read=p=>fs.readFileSync(path.join(root,p),"utf8");

  try{
    const {AnimationController}=await import(path.join(root,"src/character/AnimationController.js"));
    const {registerCoreMotions}=await import(path.join(root,"src/character/motions.js"));
    const mock={wakeRender(){},applyCharacterPose(){},resetCharacterPose(){}};
    const animation=new AnimationController(mock);
    registerCoreMotions(animation);
    report("animation registry",animation.registry.list().length>=10,`motions=${animation.registry.list().length}`);
    report("animation play/update",animation.play("nod",{duration:.2})===true);
    animation.update(1/60);
    report("animation active state",animation.state==="nod"||animation.active.length===0);
  }catch(error){report("animation runtime",false,error?.stack||error);}

  try{
    const controller=read("src/character/CharacterController.js");
    report("idle scheduler present",controller.includes("startIdleScheduler")&&controller.includes("runIdle"));
    report("idle not a permanent render loop",!controller.includes("setInterval"));
    report("idle behavior switch",controller.includes("behavior.idle"));
  }catch(error){report("idle diagnostics",false,error?.message||error);}

  try{
    const faceSource=read("src/character/FaceController.js");
    const {FaceController}=await import(path.join(root,"src/character/FaceController.js"));
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
    const {autoMapBones,requiredRigSlots}=await import(path.join(root,"src/character/AutoRigMapper.js"));
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
