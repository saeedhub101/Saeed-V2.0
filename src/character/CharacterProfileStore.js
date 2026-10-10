const KEY="saeed.character.profiles.v1";
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}}
function write(x){localStorage.setItem(KEY,JSON.stringify(x));}
export class CharacterProfileStore{
 idFor(names=[],extra=""){const text=[extra,...names].sort().join("|");let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return "char-"+(h>>>0).toString(16);}
 load(id){return read()[id]||null}
 save(id,data){const key=String(id||"").trim();if(!key)throw new Error("Character profile ID is required");const all=read();all[key]={...(all[key]||{}),...data,updatedAt:new Date().toISOString()};write(all);const persisted=read()[key];if(!persisted||persisted.updatedAt!==all[key].updatedAt)throw new Error("Character profile write could not be verified from persistent storage");return persisted}
 list(){return Object.entries(read()).map(([id,data])=>({id,...data}));}
}
