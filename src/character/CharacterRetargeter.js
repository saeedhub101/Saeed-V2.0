import * as THREE from "../../node_modules/three/build/three.module.js";
import { canonicalAxis } from "./CanonicalSkeleton.js";
const limbSlots=new Set(["leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot"]);
export class CharacterRetargeter{
 constructor(){this.bones={};this.rest=new Map();this.calibration=new Map();this.axisFixes=new Map();this.profile={root:"hips",sourceUp:"y",restPose:"unknown",height:0,orientation:"unknown",normalizedSpace:"canonical-humanoid-v2"};this.enabled=true;}
 bind(bones={},calibration={},axisFixes=null){this.bones={...bones};this.rest.clear();this.calibration.clear();for(const [slot,data] of Object.entries(calibration||{})){if(data?.x||data?.y||data?.z)this.calibration.set(slot,{x:Number(data.x)||0,y:Number(data.y)||0,z:Number(data.z)||0});}if(axisFixes!==null){this.axisFixes.clear();for(const [slot,fix] of Object.entries(axisFixes||{}))this.setAxisFix(slot,fix);}for(const [slot,bone] of Object.entries(this.bones)){if(!bone)continue;bone.updateWorldMatrix?.(true,false);const worldPos=bone.getWorldPosition(new THREE.Vector3()),parentWorldQuaternion=bone.parent?bone.parent.getWorldQuaternion(new THREE.Quaternion()):new THREE.Quaternion(),localDir=this.findChildDirection(bone),canonical=canonicalAxis(slot),align=localDir?new THREE.Quaternion().setFromUnitVectors(canonical,localDir):new THREE.Quaternion();this.rest.set(slot,{quaternion:bone.quaternion.clone(),position:bone.position.clone(),parent:bone.parent?.name||null,parentWorldQuaternion,worldPosition:worldPos,canonicalToLocal:align,localDirection:localDir});}this.profile=this.detectRestPose();return this.status();}
 findChildDirection(bone){const child=bone.children?.find(x=>x.isBone);if(!child)return null;bone.updateWorldMatrix?.(true,false);child.updateWorldMatrix?.(true,false);const p=bone.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3()),world=q.sub(p).normalize();return world.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();}
 detectRestPose(){const hips=this.bones.hips,head=this.bones.head,left=this.bones.leftUpperArm,right=this.bones.rightUpperArm;if(!hips||!head)return{restPose:"unknown",root:"hips",sourceUp:"y",height:0,orientation:"unknown"};const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);if(vertical<.45)return{restPose:"laydown",root:"hips",sourceUp:"y",height,orientation:"horizontal"};const armAngle=bone=>{const d=this.rest.get(Object.keys(this.bones).find(k=>this.bones[k]===bone))?.localDirection;return d?Math.abs(Math.asin(Math.max(-1,Math.min(1,d.y)))):null};const a=armAngle(left),b=armAngle(right);if(a!=null&&b!=null&&a<.25&&b<.25)return{restPose:"t-like",root:"hips",sourceUp:"y",height,orientation:"upright"};if((a!=null&&a>.35)||(b!=null&&b>.35))return{restPose:"a-like",root:"hips",sourceUp:"y",height,orientation:"upright"};return{restPose:"custom",root:"hips",sourceUp:"y",height,orientation:"upright"};}
 apply(slot,delta={}){
  const bone=this.bones[slot],rest=this.rest.get(slot);
  if(!bone||!rest||!this.enabled)return false;
  const correction=this.calibration.get(slot)||{x:0,y:0,z:0};
  const fix=this.axisFixes.get(slot)||{swz:[0,1,2],sign:[1,1,1],scale:1,offset:[0,0,0]};
  const input=[Number(delta.x)||0,Number(delta.y)||0,Number(delta.z)||0];
  const mapped=[0,1,2].map(i=>input[fix.swz[i]]*fix.sign[i]*fix.scale+fix.offset[i]);
  const rx=mapped[0]+(Number(correction.x)||0),ry=mapped[1]+(Number(correction.y)||0),rz=mapped[2]+(Number(correction.z)||0);
  const deltaQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,"XYZ"));
  // Motion values are authored in each logical joint's local frame. Apply the delta
  // relative to that joint's captured rest quaternion; using a cached parent-world
  // conjugation made child rotations depend on stale parent transforms during playback.
  bone.quaternion.copy(rest.quaternion).multiply(deltaQuaternion);
  bone.updateMatrix?.();
  bone.updateWorldMatrix?.(false,true);
  return true;
 }
 setAxisFix(slot,fix={}){if(!this.bones[slot])return false;const swz=Array.isArray(fix.swz)?fix.swz.map(Number):[0,1,2],sign=Array.isArray(fix.sign)?fix.sign.map(Number):[1,1,1],offset=Array.isArray(fix.offset)?fix.offset.map(Number):[0,0,0],scale=Number.isFinite(Number(fix.scale))?Number(fix.scale):1;if(swz.length!==3||new Set(swz).size!==3||swz.some(x=>![0,1,2].includes(x))||sign.length!==3||offset.length!==3||sign.some(x=>![-1,1].includes(x))||offset.some(x=>!Number.isFinite(x)))return false;this.axisFixes.set(slot,{swz,sign,scale,offset});return true;}
 resetAxisFix(slot){return this.axisFixes.delete(String(slot||""));}

 reset(slot){const bone=this.bones[slot],rest=this.rest.get(slot);if(bone&&rest)bone.quaternion.copy(rest.quaternion);}
 resetAll(){for(const slot of this.rest.keys())this.reset(slot);}
 setCalibration(slot,rotation={}){if(!this.bones[slot])return false;this.calibration.set(slot,{x:Number(rotation.x)||0,y:Number(rotation.y)||0,z:Number(rotation.z)||0});return true;}
 clearCalibration(slot){return this.calibration.delete(String(slot));}
 status(){return{enabled:this.enabled,...this.profile,boneCount:this.rest.size,calibration:Object.fromEntries(this.calibration),axisFixes:Object.fromEntries(this.axisFixes),bones:Object.fromEntries(Object.entries(this.bones).map(([k,v])=>[k,v?.name||""])),normalizedSpace:"canonical-humanoid-v2"}}
}