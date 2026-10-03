const capabilities=require("./capabilities"),memory=require("./memory"),memoryStack=require("./memory-stack"),mcp=require("./mcp"),email=require("./email"),emailClient=require("./email-client"),http=require("./http-providers"),runtime=require("./runtime");
const BUILTIN={
 "memory-stack":{id:"memory-stack",capabilities:["memory","embeddings","vector-store","rag","conversation-memory","knowledge-base"],load:()=>memoryStack},
 "mcp-client":{id:"mcp-client",capabilities:["mcp-client","mcp-tools"],load:()=>mcp},
 "email":{id:"email",capabilities:["email","imap","smtp","pop3"],load:()=>({ ...email, ...emailClient })},
 "http-providers":{id:"http-providers",capabilities:["llm","embeddings","speech-to-text","text-to-speech","vision","multimodal"],load:()=>http}
};
function registerInstalled(userData,manifest){return runtime.register(userData,manifest)}
function unregisterInstalled(userData,id){return runtime.unregister(userData,id)}
function find(userData,capability,preferred){const built=Object.values(BUILTIN).find(x=>x.capabilities.includes(capability)&&(!preferred||preferred===x.id));if(built)return built;return runtime.find(userData,capability,preferred)}
function load(userData,id){if(BUILTIN[id])return BUILTIN[id].load();return runtime.load(userData,id)}
function listBuiltins(){return Object.values(BUILTIN).map(x=>({id:x.id,capabilities:x.capabilities,builtin:true}))}
module.exports={capabilities,memory,memoryStack,mcp,email,emailClient,http,runtime,registerInstalled,unregisterInstalled,find,load,listBuiltins};