// Restart-persistence acceptance for the character rest pose; intentionally separate from the app bootstrap.
async function runCiRestPoseRestart(mode, { app, session, process, path, fs, characterHost }){
 const report={schemaVersion:1,mode,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("REST_POSE_RESTART_FAIL="+name,JSON.stringify(details))};
 const statePath=process.env.SAEED_CI_REST_POSE_STATE;
 const output=process.env.SAEED_CI_REST_POSE_REPORT||path.join(process.cwd(),"dist","ci-rest-pose-"+mode+".json");
 const near=(a,b,tolerance=0.02)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tolerance;
 const actualFor=async bone=>{const result=await characterHost.command({action:"status"});return result?.status?.actualBones?.[String(bone||"")]||null};
 try{
  if(!statePath)throw new Error("SAEED_CI_REST_POSE_STATE is required");
  const rig=await characterHost.command({action:"getRig"});
  const bones=Array.isArray(rig?.bones)?rig.bones.map(String):[];
  check("restart-character-rig-loaded",rig?.ok===true&&bones.length>0,{boneCount:bones.length,error:rig?.error||null});
  if(rig?.ok!==true||!bones.length)throw new Error("The packaged character rig is unavailable");
  if(mode==="save"){
   const mappedHead=rig.mapping?.head;
   const bone=String(typeof mappedHead==="string"&&mappedHead?mappedHead:bones.find(name=>/head/i.test(name))||bones[0]||"");
   if(!bone)throw new Error("No actual bone is available for restart acceptance");
   const before=await actualFor(bone);
   if(!before||!before.rotation||!before.position)throw new Error("The selected bone did not expose real rotation and position transforms");
   const expectedRotation={x:0.213,y:-0.119,z:0.077};
   const expectedPosition={x:Number(before.position.x)+0.013,y:Number(before.position.y)+0.017,z:Number(before.position.z)-0.011};
   const rotationSet=await characterHost.command({action:"setBoneRotation",bone,rotation:expectedRotation});
   const positionSet=await characterHost.command({action:"setBonePosition",bone,position:expectedPosition});
   const saved=await characterHost.command({action:"saveRestPose"});
   const after=await actualFor(bone);
   const rotationMatches=Boolean(after?.rotation)&&["x","y","z"].every(axis=>near(after.rotation[axis],expectedRotation[axis]));
   const positionMatches=Boolean(after?.position)&&["x","y","z"].every(axis=>near(after.position[axis],expectedPosition[axis],0.005));
   check("restart-real-bone-rotation-written",rotationSet?.ok===true&&rotationMatches,{bone,rotation:after?.rotation||null});
   check("restart-real-bone-position-written",positionSet?.ok===true&&positionMatches,{bone,position:after?.position||null});
   check("restart-rest-pose-persisted",saved?.ok===true&&saved?.persisted===true&&Boolean(saved?.restPose?.profileId),{persisted:Boolean(saved?.persisted),profileId:saved?.restPose?.profileId||null,error:saved?.restPose?.persistenceError||null});
   if(!rotationMatches||!positionMatches||saved?.persisted!==true)throw new Error("Could not verify the real bone transform and rest pose before process exit");
   fs.mkdirSync(path.dirname(statePath),{recursive:true});
   fs.writeFileSync(statePath,JSON.stringify({schemaVersion:1,bone,expectedRotation:after.rotation,expectedPosition:after.position,profileId:saved.restPose.profileId,createdAt:new Date().toISOString()},null,2)+"\n","utf8");
   check("restart-state-marker-written",fs.existsSync(statePath),{statePath,bone});
  }else if(mode==="verify"){
   const expected=JSON.parse(fs.readFileSync(statePath,"utf8"));
   const bone=String(expected?.bone||"");
   check("restart-state-marker-valid",expected?.schemaVersion===1&&bones.includes(bone)&&Boolean(expected?.expectedRotation)&&Boolean(expected?.expectedPosition),{bone,available:bones.includes(bone)});
   if(expected?.schemaVersion!==1||!bones.includes(bone))throw new Error("Restart marker is invalid or references a missing bone");
   const actual=await actualFor(bone);
   const rotationMatches=Boolean(actual?.rotation)&&["x","y","z"].every(axis=>near(actual.rotation[axis],expected.expectedRotation[axis]));
   const positionMatches=Boolean(actual?.position)&&["x","y","z"].every(axis=>near(actual.position[axis],expected.expectedPosition[axis],0.005));
   const baseline=await characterHost.command({action:"boneRotation",bone});
   const baselineMatches=baseline?.ok===true&&["x","y","z"].every(axis=>near(baseline?.rotation?.[axis],0,0.03));
   check("restart-rotation-survives-fresh-process",rotationMatches,{bone,expected:expected.expectedRotation,actual:actual?.rotation||null});
   check("restart-position-survives-fresh-process",positionMatches,{bone,expected:expected.expectedPosition,actual:actual?.position||null});
   check("restart-rest-pose-baseline-reapplied",baselineMatches,{bone,editorDelta:baseline?.rotation||null});
  }else throw new Error("Unsupported rest-pose restart mode: "+String(mode));
 }catch(error){report.error=String(error?.stack||error);check("restart-acceptance-exception",false,{error:report.error})}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write rest-pose restart report:",report.error)}
 console.log("REST_POSE_RESTART_"+String(mode).toUpperCase()+"="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(async()=>{try{await session.defaultSession.flushStorageData()}catch(error){console.error("CI storage flush failed:",error?.message||String(error))}app.exit(report.passed?0:1)},150);
}

module.exports = { runCiRestPoseRestart };
