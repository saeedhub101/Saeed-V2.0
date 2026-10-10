const runtime=window.saeedCharacterRuntime={
 glbTrace:[],
 engine:{get3DStatus:()=>({overall:{state:"error",detail:"Rest Pose Editor character engine has not loaded"},components:{},lastUpdated:new Date().toISOString()})},
 controller:null,load:null,pendingLoad:null
};
window.saeed3DBootstrap={moduleLoaded:false,error:null,rejection:null};
window.saeedAvatar={
 get3DStatus:()=>runtime.engine?.get3DStatus?.()||null,
 getCharacterPoseStatus:()=>runtime.engine?.getCharacterPoseStatus?.()||{loaded:false},
 getAvailableBoneNames:()=>runtime.engine?.getAvailableBoneNames?.()||[],
 setEditorRotation:(x,y,z)=>runtime.engine?.setEditorRotation?.(x,y,z),
 getEditorRotation:()=>runtime.engine?.getEditorRotation?.()||{x:0,y:0,z:0},
 setBoneRotation:(name,value)=>runtime.engine?.setBoneRotation?.(name,value),
 setBonePosition:(name,value)=>runtime.engine?.setBonePosition?.(name,value)
};
let lastCharacterGeneration=0;
function trace(stage,detail={}){try{runtime.glbTrace.push({at:new Date().toISOString(),stage,...detail});if(runtime.glbTrace.length>100)runtime.glbTrace.splice(0,runtime.glbTrace.length-100)}catch{}}
function report(stage,error){const message=String(error?.stack||error?.message||error||stage);window.saeed3DBootstrap.error=message;trace(stage,{error:message});try{window.saeed?.system?.reportDiagnostic?.("ERROR","REST POSE ENGINE",message,{stage})}catch{}}
function deliverCharacter(data,generation){
 const g=Number(generation)||lastCharacterGeneration+1;
 if(g<lastCharacterGeneration)return Promise.resolve({ok:false,stale:true,generation:g});
 if(g===lastCharacterGeneration&&lastCharacterGeneration>0)return Promise.resolve({ok:true,duplicate:true,generation:g});
 lastCharacterGeneration=g;
 trace("character-selected-received",{generation:g,byteLength:data?.byteLength??data?.length??null});
 if(typeof runtime.load==="function"){
  return Promise.resolve(runtime.load(data,g)).then(result=>{if(!result?.ok)trace("character-load-not-ok",{generation:g,result});return result}).catch(error=>{report("character-load-error",error);throw error});
 }
 if(runtime.pendingLoad?.reject)runtime.pendingLoad.reject(new Error("Pending Rest Pose GLB load superseded"));
 return new Promise((resolve,reject)=>{runtime.pendingLoad={data,generation:g,resolve,reject};trace("character-selected-queued",{generation:g})});
}
window.saeed?.character?.onCharacterSelected?.(deliverCharacter);
window.saeed?.character?.getPendingCharacter?.().then(p=>{if(p?.data)void deliverCharacter(p.data,p.generation).catch(()=>{})}).catch(error=>report("pending-character-error",error));
window.addEventListener("error",event=>report("renderer-error",event.error||event.message));
window.addEventListener("unhandledrejection",event=>report("renderer-rejection",event.reason));
import("./character/CharacterEngine.js").then(()=>{
 try{runtime.controller?.setAnimationEnabled?.(false);runtime.controller?.setBehavior?.({idle:false,autonomousMovement:false});runtime.controller?.stopAll?.()}catch(error){report("controller-setup-error",error)}
 trace("module-loaded");
}).catch(error=>report("module-load-error",error));
