const fs=require("fs"),path=require("path");
const CAPABILITIES=Object.freeze({
 brain:["llm"],stt:["speech-to-text"],tts:["text-to-speech"],vision:["vision"],multimodal:["multimodal"],ocr:["ocr"],embeddings:["embeddings"],vector:["vector-store"],rag:["rag"],memory:["memory","conversation-memory"],knowledge:["knowledge-base"],search:["search"],imagegen:["image-generation"],videogen:["video-generation"],audio:["audio-ai"],documents:["documents"],browser:["browser"],code:["code-runtime"],mcp:["mcp-client","mcp-tools"],email:["email","imap","smtp","pop3"],calendar:["calendar"],storage:["cloud-storage"],messaging:["messaging"],maps:["maps"],translation:["translation"],avatar:["avatar","animation"]
});
function registryPath(userData){return path.join(userData,"addons","registry.json")}
function readRegistry(userData){try{return JSON.parse(fs.readFileSync(registryPath(userData),"utf8"))}catch{return {schemaVersion:1,providers:{}}}}
function writeRegistry(userData,data){fs.mkdirSync(path.dirname(registryPath(userData)),{recursive:true});fs.writeFileSync(registryPath(userData),JSON.stringify(data,null,2),"utf8")}
function register(userData,manifest){if(!manifest?.id)return false;const r=readRegistry(userData);r.providers[manifest.id]={id:manifest.id,name:manifest.name,version:manifest.version,capabilities:manifest.capabilities||[],provider:manifest.provider||null,updatedAt:new Date().toISOString()};writeRegistry(userData,r);return true}
function unregister(userData,id){const r=readRegistry(userData);delete r.providers[id];writeRegistry(userData,r)}
function list(userData){return Object.values(readRegistry(userData).providers)}
function find(userData,capability){return list(userData).filter(p=>(p.capabilities||[]).includes(capability))}
module.exports={CAPABILITIES,register,unregister,list,find};
