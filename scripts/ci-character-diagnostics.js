const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process"),{pathToFileURL}=require("node:url");
const root=process.cwd();let failures=0;
const report=(name,ok,detail="")=>{console.log(`[CHARACTER-DIAG] ${ok?"PASS":"FAIL"} ${name}${detail?": "+detail:""}`);if(!ok)failures++;};
const fsCopy=(src,dst)=>fs.copyFileSync(path.resolve(root,src),dst);
async function loadCharacterModules(){
 const dir=fs.mkdtempSync(path.join(root,".character-diag-"));
 const files=["AnimationController.js","CharacterRig.js","PoseController.js","MotionRegistry.js","MotionSafety.js","MotionSequence.js","motions.js","FaceController.js","AutoRigMapper.js"];
 for(const file of files){
  let source=fs.readFileSync(path.join(root,"src/character",file),"utf8");
  source=source.replaceAll(".js\"",".mjs\"").replaceAll(".js'",".mjs'");
  fs.writeFileSync(path.join(dir,file.replace(/\.js$/,".mjs")),source);
 }
 const imports={};
 for(const file of files)imports[file]=pathToFileURL(path.join(dir,file.replace(/\.js$/,".mjs"))).href;
 return imports;
}
const syntax=p=>{const r=spawnSync(process.execPath,["--check",path.join(root,p)],{encoding:"utf8"});return r.status===0?"":(r.stderr||r.stdout||"syntax error").trim();};
const magnitude=p=>Object.values(p||{}).reduce((n,r)=>n+Math.abs(Number(r?.x)||0)+Math.abs(Number(r?.y)||0)+Math.abs(Number(r?.z)||0),0);
async function run(){
 let modules;
 try{modules=await loadCharacterModules()}catch(e){report("module preparation",false,e?.stack||e)}
 for(const p of ["src/character/AnimationController.js","src/character/MotionRegistry.js","src/character/MotionSequence.js","src/character/MotionSafety.js","src/character/motions.js","src/character/CharacterController.js"])report("syntax "+p,!syntax(p),syntax(p));
 try{
  const {AnimationController}=await import(modules["AnimationController.js"]),{registerCoreMotions}=await import(modules["motions.js"]);
  let last={};const mock={wakeRender(){},resetCharacterPose(){},applyCharacterPose(p){last=JSON.parse(JSON.stringify(p||{}));}};
  const a=new AnimationController(mock);registerCoreMotions(a);a.bindRig(Object.fromEntries(["hips","head","neck","spine","chest","jaw","leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot","leftEye","rightEye","leftThumb","leftIndex","leftMiddle","leftRing","leftPinky","rightThumb","rightIndex","rightMiddle","rightRing","rightPinky"].map((name)=>[name,{name}])));const ids=a.registry.list();
  const expected=["nod","shake","wave","think","jump","clap","dance","talkGesture","lookCloser","sitKnee","standUp","stretch","yawn","crackBack","crackFingers","turnBody","walk","sleep","wake","adhanOpening"];
  report("all core motions registered",expected.every(id=>ids.includes(id)),`registered=${ids.length}/${expected.length}`);
  let played=0,moved=0;
  for(const id of ids){last={};if(!a.play(id,{duration:.6})){continue;}played++;let max=0;for(let i=0;i<4;i++){a.update(.1);max=Math.max(max,magnitude(last));}if(max>0)moved++;a.stop(id);}
  report("all registered motions play",played===ids.length,`played=${played}/${ids.length}`);
  report("all registered motions produce poses",moved===ids.length,`moved=${moved}/${ids.length}`);
  let finite=true,withinLimits=true,shapeSamples=0;
  for(const id of ids){
   a.play(id,{duration:1});
   for(let i=0;i<12;i++){
    const pose=a.update(1/60)||{}; shapeSamples++;
    for(const v of Object.values(pose)){ if(!Number.isFinite(v?.x)||!Number.isFinite(v?.y)||!Number.isFinite(v?.z)) finite=false; }
    const limits=a.status().limits||{};
    for(const [slot,v] of Object.entries(pose)){const l=limits[slot];if(l&&((Math.abs(v.x)>l.x+.001)||(Math.abs(v.y)>l.y+.001)||(Math.abs(v.z)>l.z+.001)))withinLimits=false;}
   }
   a.stop(id);
  }
  report("motion shape samples finite",finite,`samples=${shapeSamples}`);
  report("motion shape samples within safety limits",withinLimits);
  report("controller returns to idle",a.status().state==="idle"&&!a.status().active.length);
 }catch(e){report("animation runtime",false,e?.stack||e);}
 try{
  const avatar=fs.readFileSync(path.join(root,"src/character/CharacterEngine.js"),"utf8"),controller=fs.readFileSync(path.join(root,"src/character/CharacterController.js"),"utf8");
  report("T-pose correction",avatar.includes('detected:"t-pose"')&&avatar.includes("stillTPose"));
  report("correction before first render",avatar.indexOf("onCharacterLoaded?.()")<avatar.indexOf("render();",avatar.indexOf("function display")));
  report("no GLB animation dependency",!avatar.includes("gltf.animations")&&!avatar.includes("AnimationMixer"));
  report("idle after character load",controller.includes("onCharacterLoaded()")&&controller.includes("setIdlePose(this.animation.idlePose||{})"));
  report("zero character padding",avatar.includes("canvasPadding:0"));
 }catch(e){report("character contract",false,e?.stack||e);}
 try{
  const c=fs.readFileSync(path.join(root,"src/character/CharacterController.js"),"utf8");
  report("idle scheduler",c.includes("startIdleScheduler")&&c.includes("runIdle")&&!c.includes("setInterval"));
  report("full semantic motion control",["dance","jump","walk","turnbody","adhan"].every(x=>c.includes(x)));
  report("idle pool",/this\.idlePool=\[([\s\S]*?)\];/.test(c));
 }catch(e){report("idle diagnostics",false,e?.stack||e);}
 try{
  const {FaceController}=await import(modules["FaceController.js"]),calls=[],face=new FaceController({setCharacterExpression:(n,v)=>{calls.push([n,v]);return true;}});
  const names=face.status().availableExpressions||[];for(const n of ["happy","sad","angry","surprised","confused","sleepy","thinking"])face.expression(n,.8);
  report("all emotional profiles",names.length>=8,`profiles=${names.length}`);report("emotional application",calls.length>0,`calls=${calls.length}`);
 }catch(e){report("emotion runtime",false,e?.stack||e);}
 try{
  const {autoMapBones,requiredRigSlots}=await import(modules["AutoRigMapper.js"]),names=["Root","Body"],m=autoMapBones(names).mapping,r=requiredRigSlots();
  report("custom GLB fallback mapping",Boolean(Object.keys(m).length&&Object.values(m).every(Boolean)),JSON.stringify(m));report("no fixed required rig",r.length===0,r.join(","));
 }catch(e){report("rig runtime",false,e?.stack||e);}
 console.log(`[CHARACTER-DIAG] SUMMARY failures=${failures}`);console.log("[CHARACTER-DIAG] NON_GATING=true");
}
run().catch(e=>{report("diagnostics fatal",false,e?.stack||e);console.log("[CHARACTER-DIAG] NON_GATING=true");});