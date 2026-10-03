import { CharacterRig } from "./CharacterRig.js";
import { PoseController } from "./PoseController.js";
import { MotionRegistry } from "./MotionRegistry.js";
import { MotionSafety } from "./MotionSafety.js";
export class AnimationController{
 constructor(avatar){
  this.avatar=avatar;this.rig=new CharacterRig();this.pose=new PoseController();this.registry=new MotionRegistry();this.active=[];this.state="idle";this.idlePose={};this.safety=new MotionSafety();this.layers=new Map([["base",0],["body",10],["arms",20],["head",30],["face",40],["hands",50],["special",60]]);this.lastUpdate=0;
 }
 bindRig(bones,retargeter=null){this.rig.bind(bones,retargeter);return this.rig.snapshot();}
 register(def){return this.registry.register(def);}
 play(id,options={}){
  const m=this.registry.get(id);if(!m)return false;
  if(String(id)==="idle"&&Boolean(options.loop)){this.state="idle";const sample=m.update({t:0,p:0,dt:0,intensity:Number(options.intensity??1),rig:this.rig,pose:this.pose,state:"idle"});this.pose.clear();if(sample)this.pose.setMany(sample);this.pose.setMany(this.idlePose);this.avatar?.applyCharacterPose?.(this.safety.clampPose(this.pose.snapshot()),this.rig.retargeter);this.avatar?.wakeRender?.(300);return true;}
  const layer=options.layer||m.layer||"body",now=performance.now();
  const item={m,started:now,duration:Math.max(0,Number(options.duration??m.duration)||0),speed:Math.max(.05,Number(options.speed)||1),intensity:Number(options.intensity??1),layer,loop:Boolean(options.loop??m.loop),blend:Number(options.blend??m.blend??.15),priority:Number(options.priority??this.layers.get(layer)||0)};
  this.active=this.active.filter(x=>x.layer!==layer||item.priority<x.priority);
  this.active=this.active.filter(x=>!(x.layer===layer&&item.priority>=x.priority&&x.m.id!==id));
  this.active.push(item);this.state=String(id);this.avatar?.wakeRender?.(Math.max(300,item.duration||1200));return true;
 }
 stop(id){this.active=this.active.filter(x=>x.m.id!==id);if(!this.active.length)this.state="idle";this.avatar?.wakeRender?.(250);}
 stopLayer(layer){this.active=this.active.filter(x=>x.layer!==layer);if(!this.active.length)this.state="idle";this.avatar?.wakeRender?.(250);}
 stopAll(){this.active=[];this.state="idle";this.pose.clear();this.avatar?.resetCharacterPose?.();this.avatar?.wakeRender?.(150);}
 update(dt){
  this.pose.clear();
  if(Object.keys(this.idlePose).length)this.pose.setMany(this.idlePose);
  if(!this.active.length){this.avatar?.applyCharacterPose?.(this.safety.clampPose(this.pose.snapshot()),this.rig.retargeter);return;}
  const now=performance.now(),next=[],samples=[];
  for(const a of this.active){
   const elapsed=(now-a.started)*a.speed/1000;
   if(a.duration&&elapsed>=a.duration&&!a.loop)continue;
   const p=a.duration?Math.min(1,elapsed/a.duration):elapsed;
   const fadeIn=Math.min(1,elapsed/Math.max(.001,a.blend));
   const fadeOut=a.duration?Math.min(1,(a.duration-elapsed)/Math.max(.001,a.blend)):1;
   const weight=Math.max(.05,Math.min(1,fadeIn,fadeOut))*Math.max(.05,Math.min(1,a.intensity));
   const pose=a.m.update({t:elapsed,p,dt,intensity:a.intensity,rig:this.rig,pose:this.pose,state:this.state});
   if(pose)samples.push({pose,weight,priority:a.priority,layer:a.layer});
   next.push(a);
  }
  this.active=next;
  const slots=new Set(samples.flatMap(s=>Object.keys(s.pose||{})));
  for(const slot of slots){
   let x=0,y=0,z=0,w=0;
   for(const s of samples.filter(s=>s.pose?.[slot]).sort((a,b)=>a.priority-b.priority)){
    const v=s.pose[slot],ww=s.weight*(1+Math.max(0,s.priority)/100);
    x+=(Number(v.x)||0)*ww;y+=(Number(v.y)||0)*ww;z+=(Number(v.z)||0)*ww;w+=ww;
   }
   if(w)this.pose.set(slot,{x:x/w,y:y/w,z:z/w});
  }
  if(!this.active.length)this.state="idle";
  const safe=this.safety.clampPose(this.pose.snapshot());
  this.avatar?.applyCharacterPose?.(safe,this.rig.retargeter);
 }
 setIdlePose(pose={}){this.idlePose=JSON.parse(JSON.stringify(pose||{}));this.pose.setMany(this.idlePose);this.avatar?.applyCharacterPose?.(this.safety.clampPose(this.pose.snapshot()),this.rig.retargeter);this.avatar?.wakeRender?.(300);return this.idlePose;}
 setPose(pose={}){this.pose.setMany(pose);const safe=this.safety.clampPose(this.pose.snapshot());this.avatar?.applyCharacterPose?.(safe,this.rig.retargeter);this.avatar?.wakeRender?.(300);return safe;}
 setLimit(slot,limit){return this.safety.setLimit(slot,limit);}
 status(){return{state:this.state,motions:this.registry.list(),capabilities:this.rig.capabilities,active:this.active.map(x=>({id:x.m.id,layer:x.layer,priority:x.priority,blend:x.blend})),pose:this.pose.snapshot(),idlePose:this.idlePose,retargeting:this.rig.retargeter?.status?.()||null,limits:this.safety.status(),layers:Object.fromEntries(this.layers)});}
}