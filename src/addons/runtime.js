const path=require("path");
const manager=require("./manager");
const capabilities=require("./capabilities");
const active=new Map();
function context(userData,manifest){return Object.freeze({userData,manifest,addonPath:manager.addonDir(userData,manifest.id),getPath:(p="")=>path.join(manager.addonDir(userData,manifest.id),p)})}
function load(userData,id){const key=String(id);if(active.has(key))return active.get(key).provider;const manifest=manager.load(userData,key);if(!manifest.entry)return null;const mod=manifest.module||{};const ctx=context(userData,manifest);const provider=typeof mod.createProvider==="function"?mod.createProvider(ctx):mod.default||mod.provider||mod;if(!provider||typeof provider!=="object")throw new Error("Add-on "+key+" does not export a provider");if(typeof provider.activate==="function")provider.activate(ctx);active.set(key,{provider,manifest,ctx});return provider}
function unload(userData,id){const key=String(id),item=active.get(key);if(!item)return;try{if(typeof item.provider.deactivate==="function")item.provider.deactivate(item.ctx)}finally{active.delete(key)}}
function register(userData,manifest){capabilities.register(userData,manifest);return manifest}
function unregister(userData,id){unload(userData,id);capabilities.unregister(userData,id)}
function list(userData){return capabilities.list(userData)}
function find(userData,capability,preferred=null){const providers=capabilities.find(userData,capability);if(preferred){const p=providers.find(x=>x.id===preferred||x.provider===preferred);if(p)return p}return providers[0]||null}
function toolSchemas(userData){
 const out=[];
 for(const item of capabilities.list(userData)){
  try{
   const manifest=manager.describe(userData,item.id);
   for(const tool of (manifest.tools||[]))out.push({type:"function",function:{name:"addon_"+item.id+"_"+tool.name,description:tool.description+" [Add-on: "+item.name+"]",parameters:tool.parameters}});
  }catch{}
 }
 return out;
}
function resolveTool(userData,fullName){
 const value=String(fullName||"");
 if(!value.startsWith("addon_"))return null;
 const ids=capabilities.list(userData).map(item=>String(item.id||"")).filter(Boolean).sort((a,b)=>b.length-a.length);
 for(const id of ids){
  const prefix="addon_"+id+"_";
  if(!value.startsWith(prefix))continue;
  const name=value.slice(prefix.length);
  const manifest=manager.describe(userData,id);
  const tool=(manifest.tools||[]).find(x=>x.name===name);
  if(tool)return{id,name,tool};
 }
 return null;
}
async function callTool(userData,fullName,args={}){
 const resolved=resolveTool(userData,fullName);
 if(!resolved)throw new Error("Unknown add-on tool: "+fullName);
 const provider=load(userData,resolved.id);
 if(!provider)throw new Error("Add-on "+resolved.id+" has no runtime entry");
 if(typeof provider["tool_"+resolved.name]==="function")return provider["tool_"+resolved.name](args);
 if(typeof provider.callTool==="function")return provider.callTool(resolved.name,args);
 if(provider.tools&&typeof provider.tools[resolved.name]==="function")return provider.tools[resolved.name](args);
 throw new Error("Add-on "+resolved.id+" does not implement tool "+resolved.name);
}
async function call(userData,capability,method,args={},preferred=null){const info=find(userData,capability,preferred);if(!info)return null;const provider=load(userData,info.id);if(!provider||typeof provider[method]!=="function")throw new Error("Add-on "+info.id+" does not provide "+method+"()");return provider[method](args)}
module.exports={register,unregister,list,find,load,unload,call,toolSchemas,callTool,resolveTool};
