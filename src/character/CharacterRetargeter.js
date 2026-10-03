import * as THREE from "../../node_modules/three/build/three.module.js";
const limbSlots=new Set(["leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot"]);
const canonicalAxisFor=slot=>limbSlots.has(slot)?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
export class CharacterRetargeter{
 constructor(){this.bones={};this.rest=new Map();this.profile={root:"hips",sourceUp:"y",restPose:"unknown",height:0,orientation:"upright"};this.enabled=true;}
 bind(bones={}){
  this.bones={...bones};this.rest.clear();
  for(const [slot,bone] of Object.entries(this.bones)){if(!bone)continue;
   bone.updateWorldMatrix?.(true,false);
   const worldPos=bone.getWorldPosition(new THREE.Vector3()), parentQ=bone.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
   const localDir=this.findChildDirection(bone);
   const canonical=canonicalAxisFor(slot), align=localDir?new THREE.Quaternion().setFromUnitVectors(canonical,localDir):new THREE.Quaternion();
   this.rest.set(slot,{quaternion:bone.quaternion.clone(),position:bone.position.clone(),parent:bone.parent?.name||null,worldPosition:worldPos,canonicalToLocal:align,localDirection:localDir});
  }
  this.profile=this.detectRestPose();
  return this.status();
 }
 findChildDirection(bone){
  const child=bone.children?.find(x=>x.isBone);if(!child)return null;
  bone.updateWorldMatrix?.(true,false);child.updateWorldMatrix?.(true,false);
  const p=bone.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3()),world=q.sub(p).normalize();
  const inv=bone.getWorldQuaternion(new THREE.Quaternion()).invert();return world.applyQuaternion(inv).normalize();
 }
 detectRestPose(){
  const hips=this.bones.hips,head=this.bones.head,left=this.bones.leftUpperArm,right=this.bones.rightUpperArm;
  if(!hips||!head)return{restPose:"unknown",root:"hips",sourceUp:"y",height:0,orientation:"unknown"};
  const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);
  if(vertical<.45)return{restPose:"laydown",root:"hips",sourceUp:"y",height,orientation:"horizontal"};
  const armAngle=(bone)=>{if(!bone)return 0;const d=this.rest.get(Object.keys(this.bones).find(k=>this.bones[k]===bone))?.localDirection;if(!d)return 0;return Math.abs(Math.asin(Math.max(-1,Math.min(1,d.y))))};
  const a=armAngle(left),b=armAngle(right);
  if(a<.25&&b<.25)return{restPose:"t-like",root:"hips",sourceUp:"y",height,orientation:"upright"};
  if(a>.35||b>.35)return{restPose:"a-like",root:"hips",sourceUp:"y",height,orientation:"upright"};
  return{restPose:"custom",root:"hips",sourceUp:"y",height,orientation:"upright"};
 }
 apply(slot,delta={}){
  const bone=this.bones[slot],rest=this.rest.get(slot);if(!bone||!rest||!this.enabled)return false;
  const qCanon=new THREE.Quaternion().setFromEuler(new THREE.Euler(Number(delta.x)||0,Number(delta.y)||0,Number(delta.z)||0,"XYZ"));
  const basis=rest.canonicalToLocal||new THREE.Quaternion();
  const qLocal=basis.clone().multiply(qCanon).multiply(basis.clone().invert());
  bone.quaternion.copy(rest.quaternion).multiply(qLocal);
  return true;
 }
 reset(slot){const bone=this.bones[slot],rest=this.rest.get(slot);if(bone&&rest)bone.quaternion.copy(rest.quaternion);}
 resetAll(){for(const slot of this.rest.keys())this.reset(slot);}
 status(){return{enabled:this.enabled,...this.profile,boneCount:this.rest.size,bones:Object.fromEntries(Object.entries(this.bones).map(([k,v])=>[k,v?.name||""])),normalizedSpace:"canonical-humanoid-v1"}}
 snapshotRest(){const out={};for(const [slot,r] of this.rest)out[slot]={x:r.quaternion.x,y:r.quaternion.y,z:r.quaternion.z,w:r.quaternion.w};return out;}
}