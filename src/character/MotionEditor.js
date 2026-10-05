function lerp(a,b,t){return a+(b-a)*t}
function interpolate(a,b,t){return{x:lerp(Number(a?.x)||0,Number(b?.x)||0,t),y:lerp(Number(a?.y)||0,Number(b?.y)||0,t),z:lerp(Number(a?.z)||0,Number(b?.z)||0,t)}}
export class MotionEditor{
 constructor(registry){this.registry=registry;this.custom=new Map();}
 define(def){if(!def?.id||!Array.isArray(def.keyframes)||!def.keyframes.length)throw new Error("Motion requires id and keyframes");const maxTime=Math.max(0.01,...def.keyframes.map(k=>Number(k.time)||0));const normalized={id:String(def.id),duration:Math.max(0.01,Number(def.duration)||maxTime),loop:Boolean(def.loop),layer:def.layer||"body",keyframes:def.keyframes.map(k=>({time:Math.max(0,Number(k.time)||0),pose:k.pose||{}})).sort((a,b)=>a.time-b.time)};this.custom.set(normalized.id,normalized);this.registry.register({id:normalized.id,duration:normalized.duration,loop:normalized.loop,layer:normalized.layer,update:({t})=>this.sample(normalized,t)});return normalized;}
 sample(def,t){const keys=def.keyframes;if(!keys.length)return{};let time=def.loop&&def.duration?t%def.duration:Math.max(0,Math.min(def.duration,t));if(time<=keys[0].time)return keys[0].pose;if(time>=keys[keys.length-1].time)return keys[keys.length-1].pose;let i=1;while(i<keys.length&&keys[i].time<time)i++;const a=keys[i-1],b=keys[i],q=(time-a.time)/Math.max(.0001,b.time-a.time),slots=new Set([...Object.keys(a.pose||{}),...Object.keys(b.pose||{})]),out={};for(const s of slots)out[s]=interpolate(a.pose?.[s],b.pose?.[s],q);return out;}
 remove(id){this.custom.delete(String(id));if(this.registry?.items instanceof Map)this.registry.items.delete(String(id));return true;}
 list(){return [...this.custom.values()].map(x=>JSON.parse(JSON.stringify(x)));}
 exportMotion(id){const x=this.custom.get(String(id));return x?JSON.parse(JSON.stringify(x)):null;}
 export(id){return this.exportMotion(id);}
}
