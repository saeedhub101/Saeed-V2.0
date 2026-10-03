export function clamp01(v){return Math.max(0,Math.min(1,Number(v)||0));}
export function smooth(v){v=clamp01(v);return v*v*(3-2*v)}
function lerp(a,b,t){return a+(b-a)*t}
function normalizePose(p={}){const o={};for(const [slot,r] of Object.entries(p||{}))o[slot]={x:Number(r?.x)||0,y:Number(r?.y)||0,z:Number(r?.z)||0};return o}
function blend(a,b,t){const o={};const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);for(const k of keys){const x=a?.[k]||{},y=b?.[k]||{};o[k]={x:lerp(Number(x.x)||0,Number(y.x)||0,t),y:lerp(Number(x.y)||0,Number(y.y)||0,t),z:lerp(Number(x.z)||0,Number(y.z)||0,t)}}return o}
export function sampleSequence(keyframes,p){
 const frames=(keyframes||[]).slice().sort((a,b)=>a.at-b.at);if(!frames.length)return {};
 if(p<=frames[0].at)return normalizePose(frames[0].pose);
 if(p>=frames[frames.length-1].at)return normalizePose(frames[frames.length-1].pose);
 for(let i=1;i<frames.length;i++){const b=frames[i],a=frames[i-1];if(p<=b.at){const t=smooth((p-a.at)/Math.max(.0001,b.at-a.at));return blend(normalizePose(a.pose),normalizePose(b.pose),t)}}
 return {};
}
export function sequence(id,duration,layer,keyframes,options={}){
 return {id,duration,layer,blend:options.blend??.22,update:({p})=>sampleSequence(keyframes,p)};
}

// Integrated full-body motion engine release marker
// CI assertion fix
