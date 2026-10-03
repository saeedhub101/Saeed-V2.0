import { CharacterRig } from "./CharacterRig.js";
import { PoseController } from "./PoseController.js";
import { MotionRegistry } from "./MotionRegistry.js";

export class AnimationController {
  constructor(avatar) {
    this.avatar=avatar; this.rig=new CharacterRig(); this.pose=new PoseController();
    this.registry=new MotionRegistry(); this.active=[]; this.time=0; this.state="idle";
    this.base={}; this.overlays=new Map(); this.lastUpdate=0; this.idlePose={};
  }
  bindRig(bones, retargeter=null) { this.rig.bind(bones,retargeter); return this.rig.snapshot(); }
  register(def) { return this.registry.register(def); }
  play(id, options={}) {
    const m=this.registry.get(id); if(!m) return false;
    const now=performance.now();
    const item={m, started:now, duration:Math.max(0,Number(options.duration ?? m.duration)||0),
      speed:Math.max(.05,Number(options.speed)||1), intensity:Number(options.intensity ?? 1),
      layer:options.layer||m.layer||"body", loop:Boolean(options.loop ?? m.loop)};
    this.active=this.active.filter(x=>x.layer!==item.layer);
    this.active.push(item); this.state=String(id);
    this.avatar?.wakeRender?.(item.loop?Infinity:Math.max(250,item.duration));
    return true;
  }
  stop(id) { this.active=this.active.filter(x=>x.m.id!==id); if(!this.active.length)this.state="idle"; this.avatar?.wakeRender?.(250); }
  stopAll() { this.active=[]; this.state="idle"; this.pose.clear(); this.avatar?.resetCharacterPose?.(); this.avatar?.wakeRender?.(150); }
  update(dt) {
    if(!this.active.length)return;
    const now=performance.now(), next=[];
    this.pose.clear();
    if(this.state==="idle" && Object.keys(this.idlePose).length)this.pose.setMany(this.idlePose);
    for(const a of this.active){
      const elapsed=(now-a.started)*a.speed/1000;
      if(a.duration && elapsed>=a.duration && !a.loop)continue;
      const p=a.duration?Math.min(1,elapsed/a.duration):elapsed;
      const t=a.m.update({t:elapsed,p,dt,intensity:a.intensity,rig:this.rig,pose:this.pose,state:this.state});
      if(t) this.pose.setMany(t);
      next.push(a);
    }
    this.active=next;
    this.avatar?.applyCharacterPose?.(this.pose.snapshot(),this.rig.retargeter);
    if(!this.active.length)this.state="idle";
  }
  setIdlePose(pose={}) { this.idlePose=JSON.parse(JSON.stringify(pose||{})); this.pose.setMany(this.idlePose); this.avatar?.applyCharacterPose?.(this.pose.snapshot(),this.rig.retargeter); this.avatar?.wakeRender?.(300); return this.idlePose; }
  setPose(pose={}) {
    this.pose.setMany(pose);
    this.avatar?.applyCharacterPose?.(this.pose.snapshot(),this.rig.retargeter);
    this.avatar?.wakeRender?.(300);
    return this.pose.snapshot();
  }
  status() { return {state:this.state,motions:this.registry.list(),capabilities:this.rig.capabilities,active:this.active.map(x=>x.m.id),pose:this.pose.snapshot(),idlePose:this.idlePose,retargeting:this.rig.retargeter?.status?.()||null}; }
}
