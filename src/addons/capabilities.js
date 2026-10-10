const fs=require("fs"),path=require("path"),crypto=require("crypto");
const CAPABILITIES=Object.freeze({
 brain:["llm"],stt:["speech-to-text"],tts:["text-to-speech"],vision:["vision"],multimodal:["multimodal"],ocr:["ocr"],embeddings:["embeddings"],vector:["vector-store"],rag:["rag"],memory:["memory","conversation-memory"],knowledge:["knowledge-base"],search:["search"],imagegen:["image-generation"],videogen:["video-generation"],audio:["audio-ai"],documents:["documents"],browser:["browser"],code:["code-runtime"],mcp:["mcp-client","mcp-tools"],email:["email","imap","smtp","pop3"],calendar:["calendar"],storage:["cloud-storage"],messaging:["messaging"],maps:["maps"],translation:["translation"],avatar:["avatar","animation"]
});
function registryPath(userData){return path.join(userData,"addons","registry.json")}
function emptyRegistry(){return{schemaVersion:1,providers:{}}}
function readRegistry(userData){
 const file=registryPath(userData);let raw;
 try{raw=fs.readFileSync(file,"utf8")}catch(error){if(error?.code==="ENOENT")return emptyRegistry();throw error}
 let data;try{data=JSON.parse(raw)}catch(error){throw new Error("Add-on capability registry is invalid JSON; refusing to overwrite existing registry ("+error.message+")")}
 if(!data||typeof data!=="object"||data.schemaVersion!==1||!data.providers||typeof data.providers!=="object"||Array.isArray(data.providers))throw new Error("Add-on capability registry has an unsupported or invalid structure; refusing to overwrite it");
 return data;
}
function writeRegistry(userData,data){
 const file=registryPath(userData),dir=path.dirname(file);fs.mkdirSync(dir,{recursive:true});
 const temp=file+"."+process.pid+"."+crypto.randomBytes(6).toString("hex")+".tmp";
 try{
  fs.writeFileSync(temp,JSON.stringify(data,null,2)+"\n",{encoding:"utf8",flag:"wx"});
  fs.renameSync(temp,file);
 }catch(error){try{fs.unlinkSync(temp)}catch{}throw error}
}
function safeId(id){const value=String(id||"").trim();return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)?value:null}
function normalizeProvider(manifest){
 const id=safeId(manifest?.id);if(!id)return null;
 const name=String(manifest?.name||id).trim().slice(0,160);const version=String(manifest?.version||"0.0.0").trim().slice(0,64);
 const raw=Array.isArray(manifest?.capabilities)?manifest.capabilities:[];
 const capabilities=[...new Set(raw.filter(x=>typeof x==="string").map(x=>x.trim()).filter(x=>/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(x)))];
 const provider=typeof manifest?.provider==="string"&&manifest.provider.trim()?manifest.provider.trim().slice(0,128):null;
 return{id,name:name||id,version:version||"0.0.0",capabilities,provider,updatedAt:new Date().toISOString()};
}
function register(userData,manifest){
 const provider=normalizeProvider(manifest);if(!provider)return false;
 const r=readRegistry(userData);r.providers[provider.id]=provider;writeRegistry(userData,r);return true;
}
function unregister(userData,id){
 const key=safeId(id);if(!key)return false;
 const r=readRegistry(userData);if(!Object.prototype.hasOwnProperty.call(r.providers,key))return false;
 delete r.providers[key];writeRegistry(userData,r);return true;
}
function list(userData){return Object.values(readRegistry(userData).providers).filter(x=>x&&typeof x==="object"&&safeId(x.id)&&Array.isArray(x.capabilities))}
function find(userData,capability){const key=String(capability||"").trim();if(!key)return[];return list(userData).filter(p=>p.capabilities.includes(key))}
module.exports={CAPABILITIES,register,unregister,list,find};
