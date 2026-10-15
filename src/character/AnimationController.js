import { CharacterRig } from "./CharacterRig.js";
import { PoseController } from "./PoseController.js";
import { MotionRegistry } from "./MotionRegistry.js";
import { MotionSafety } from "./MotionSafety.js";

export class AnimationController {
 constructor(avatar){this.avatar=avatar;this.rig=new CharacterRig();this.pose=new PoseController();this.registry=new MotionRegistry();this.active=[];this.state="idle";this.idlePose={};this.safety=new MotionSafety();this.motionAxisFixes={};this.layers=new Map([["base",0],["body",10],["arms",20],["head",30],["face",40],["hands",50],["special",60]]);}
 bindRig(bones={},retargeter=null){this.rig.bind(bones,retargeter);return this.rig.snapshot();}
 register(def){return this.registry.register(def);}
 setMotionEnabled(id,enabled=true){return this.registry.setEnabled(id,enabled);}
 play(id,options={}){
  const m=this.registry.get(id);if(!m||m.enabled===false)return false;const required=m.requiredCapabilities||[];if(required.some(cap=>!this.rig.capabilities?.[cap]))return false;
  const layer=options.layer||m.layer||"body",priority=Number(options.priority??this.layers.get(layer)??0);
  const item={m,elapsed:0,duration:Math.max(0,Number(options.duration??m.duration)||0),speed:Math.max(.05,Number(options.speed)||1),intensity:Number(options.intensity??1),layer,loop:Boolean(options.loop??m.loop),blend:Math.max(0,Number(options.blend??m.blend??.15)),priority};
  this.active=this.active.filter(x=>x.layer!==layer||x.priority>priority);
  this.active=this.active.filter(x=>!(x.layer===layer&&x.priority<=priority&&x.m.id!==id));
  this.active.push(item);this.state=String(id);this.avatar?.wakeRender?.();return true;
 }
 stop(id){const before=this.active.length;this.active=this.active.filter(x=>x.m.id!==id);if(!this.active.length)this.state="idle";this.avatar?.wakeRender?.();return this.active.length!==before;}
 stopLayer(layer){const before=this.active.length;this.active=this.active.filter(x=>x.layer!==layer);if(!this.active.length)this.state="idle";this.avatar?.wakeRender?.();return this.active.length!==before;}
 stopAll({reset=true}={}){this.active=[];this.state="idle";this.pose.clear();if(reset)this.avatar?.resetCharacterPose?.();this.avatar?.wakeRender?.();return true;}
 setMotionAxisFixes(fixes={}){this.motionAxisFixes=fixes&&typeof fixes==="object"?JSON.parse(JSON.stringify(fixes)):{};return true;}
 applyMotionAxisFixes(id,pose={}){const fixes=this.motionAxisFixes?.[String(id)]||{},out={...pose};for(const [slot,fix] of Object.entries(fixes)){const value=pose?.[slot];if(!value)continue;const source=[Number(value.x)||0,Number(value.y)||0,Number(value.z)||0],swz=Array.isArray(fix.swz)?fix.swz:[0,1,2],sign=Array.isArray(fix.sign)?fix.sign:[1,1,1],scale=Math.max(0,Math.min(4,Number(fix.scale??1)||0)),offset=Array.isArray(fix.offset)?fix.offset:[0,0,0];out[slot]={...value,x:source[Math.max(0,Math.min(2,Number(swz[0])||0))]*(Number(sign[0])<0?-1:1)*scale+(Number(offset[0])||0),y:source[Math.max(0,Math.min(2,Number(swz[1]??1)))]*(Number(sign[1])<0?-1:1)*scale+(Number(offset[1])||0),z:source[Math.max(0,Math.min(2,Number(swz[2]??2)))]*(Number(sign[2])<0?-1:1)*scale+(Number(offset[2])||0)}}return out;}
 update(dt=.0166666667){
  const delta=Math.max(0,Math.min(.25,Number(dt)||0));this.pose.clear();if(Object.keys(this.idlePose).length)this.pose.setMany(this.idlePose);
  if(!this.active.length){const safe=this.safety.clampPose(this.pose.snapshot());this.avatar?.applyCharacterPose?.(safe,this.rig.retargeter);return safe;}
  const next=[],samples=[];
  for(const a of this.active){
   a.elapsed+=delta*a.speed;if(a.duration&&a.elapsed>=a.duration&&!a.loop)continue;
   const t=a.duration?(a.loop?a.elapsed%a.duration:a.elapsed):a.elapsed,p=a.duration?Math.max(0,Math.min(1,t/a.duration)):0;
   const fadeIn=a.blend?Math.min(1,t/a.blend):1,fadeOut=a.duration&&a.blend&&!a.loop?Math.min(1,(a.duration-t)/a.blend):1;
   const weight=Math.max(.05,Math.min(1,fadeIn,fadeOut))*Math.max(.05,Math.min(1,a.intensity));
   const rawPose=a.m.update({t,p,dt:delta,intensity:a.intensity,rig:this.rig,pose:this.pose,state:this.state})||{};const pose=this.applyMotionAxisFixes(a.m.id,rawPose);
   samples.push({pose,weight,priority:a.priority,layer:a.layer});next.push(a);
  }
  this.active=next;
  const slots=new Set(samples.flatMap(s=>Object.keys(s.pose||{})));
  for(const slot of slots){
   const candidates=samples.filter(s=>s.pose?.[slot]).sort((a,b)=>a.priority-b.priority);if(!candidates.length)continue;
   const maxPriority=candidates[candidates.length-1].priority,selected=candidates.filter(s=>s.priority===maxPriority);
    let x=0,y=0,z=0,w=0,px=0,py=0,pz=0,pw=0;for(const s of selected){const v=s.pose[slot],ww=s.weight;x+=(Number(v.x)||0)*ww;y+=(Number(v.y)||0)*ww;z+=(Number(v.z)||0)*ww;w+=ww;if(v.position){px+=(Number(v.position.x)||0)*ww;py+=(Number(v.position.y)||0)*ww;pz+=(Number(v.position.z)||0)*ww;pw+=ww;}}
    if(w){const blended={x:x/w,y:y/w,z:z/w};if(pw)blended.position={x:px/pw,y:py/pw,z:pz/pw};this.pose.set(slot,blended)}

  }
  if(!this.active.length)this.state="idle";const safe=this.safety.clampPose(this.pose.snapshot());this.avatar?.applyCharacterPose?.(safe,this.rig.retargeter);return safe;
 }
 setIdlePose(pose={}){this.idlePose=JSON.parse(JSON.stringify(pose||{}));this.pose.setMany(this.idlePose);this.avatar?.applyCharacterPose?.(this.safety.clampPose(this.pose.snapshot()),this.rig.retargeter);this.avatar?.wakeRender?.();return this.idlePose;}
 setPose(pose={}){this.pose.setMany(pose);const safe=this.safety.clampPose(this.pose.snapshot());this.avatar?.applyCharacterPose?.(safe,this.rig.retargeter);this.avatar?.wakeRender?.();return safe;}
 setLimit(slot,limit){return this.safety.setLimit(slot,limit);}
 status(){return{state:this.state,motions:this.registry.definitions(),capabilities:this.rig.capabilities,active:this.active.map(x=>({id:x.m.id,layer:x.layer,priority:x.priority,blend:x.blend,elapsed:x.elapsed,duration:x.duration})),pose:this.pose.snapshot(),idlePose:this.idlePose,retargeting:this.rig.retargeter?.status?.()||null,limits:this.safety.status(),layers:Object.fromEntries(this.layers)}}
}
