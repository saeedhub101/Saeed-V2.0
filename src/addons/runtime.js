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
async function call(userData,capability,method,args={},preferred=null){const info=find(userData,capability,preferred);if(!info)return null;const provider=load(userData,info.id);if(!provider||typeof provider[method]!=="function")throw new Error("Add-on "+info.id+" does not provide "+method+"()");return provider[method](args)}
module.exports={register,unregister,list,find,load,unload,call};
