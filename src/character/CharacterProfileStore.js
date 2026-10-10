const KEY="saeed.character.profiles.v1";
function read(){
 const raw=localStorage.getItem(KEY);if(raw==null||raw==="")return{};
 let data;try{data=JSON.parse(raw)}catch(error){throw new Error("Character profile storage is invalid JSON; refusing to overwrite saved poses ("+error.message+")")}
 if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Character profile storage has an invalid structure; refusing to overwrite saved poses");
 for(const [id,profile] of Object.entries(data))if(!id||!profile||typeof profile!=="object"||Array.isArray(profile))throw new Error("Character profile storage contains an invalid profile; refusing to overwrite saved poses");
 return data;
}
function write(x){const serialized=JSON.stringify(x);localStorage.setItem(KEY,serialized);const raw=localStorage.getItem(KEY);if(raw!==serialized)throw new Error("Character profile storage read-back does not match the saved data");}
export class CharacterProfileStore{
 idFor(names=[],extra=""){const text=[extra,...names].sort().join("|");let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return "char-"+(h>>>0).toString(16);}
 load(id){return read()[id]||null}
 save(id,data){const key=String(id||"").trim();if(!key)throw new Error("Character profile ID is required");const all=read();all[key]={...(all[key]||{}),...data,updatedAt:new Date().toISOString()};write(all);const persisted=read()[key];if(!persisted||persisted.updatedAt!==all[key].updatedAt)throw new Error("Character profile write could not be verified from persistent storage");return persisted}
 list(){return Object.entries(read()).map(([id,data])=>({id,...data}));}
}
