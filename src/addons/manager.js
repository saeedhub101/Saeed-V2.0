const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const https=require("https");
const {spawn}=require("child_process");
const capabilities=require("./capabilities");

const DEFAULT_CATALOG_URL="https://raw.githubusercontent.com/saeedhub101/Saeed-V2.0/main/src/addons/catalog.json";

function safeId(id){const value=String(id||"").trim();if(!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value))throw new Error("Invalid add-on id");return value}
function rootFor(userData){return path.join(userData,"addons")}
function addonDir(userData,id){return path.join(rootFor(userData),safeId(id))}
function installedManifest(userData,id){return path.join(addonDir(userData,id),"manifest.json")}
function ensureRoot(userData){fs.mkdirSync(rootFor(userData),{recursive:true});return rootFor(userData)}
function sha256(file){return new Promise((resolve,reject)=>{const h=crypto.createHash("sha256");const s=fs.createReadStream(file);s.on("data",d=>h.update(d));s.on("error",reject);s.on("end",()=>resolve(h.digest("hex")))})}
function download(url,target,onProgress){
 return new Promise((resolve,reject)=>{
  const follow=(value,depth)=>{
   if(depth>5)return reject(new Error("Too many redirects"));
   let u;try{u=new URL(value)}catch{return reject(new Error("Invalid download URL"))}
   if(u.protocol!=="https:")return reject(new Error("Add-on downloads must use HTTPS"));
   const req=https.get(u,res=>{
    if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();return follow(new URL(res.headers.location,u).toString(),depth+1)}
    if(res.statusCode!==200){res.resume();return reject(new Error("Download failed: HTTP "+res.statusCode))}
    const total=Number(res.headers["content-length"]||0);let done=0;
    fs.mkdirSync(path.dirname(target),{recursive:true});const out=fs.createWriteStream(target);
    res.on("data",chunk=>{done+=chunk.length;onProgress?.(total?Math.round(done*100/total):null,done,total)});
    res.on("error",e=>{out.destroy();reject(e)});out.on("error",reject);
    out.on("finish",()=>out.close(()=>resolve(target)));res.pipe(out);
   });
   req.setTimeout(120000,()=>req.destroy(new Error("Download timed out")));req.on("error",reject);
  };
  follow(String(url||""),0);
 });
}
function extractZip(zip,destination){return new Promise((resolve,reject)=>{if(!zip||!destination)return reject(new Error("Add-on archive or destination path is empty"));if(!fs.existsSync(zip))return reject(new Error("Downloaded add-on archive was not found: "+zip));fs.mkdirSync(destination,{recursive:true});const q=v=>"\x27"+String(v).replace(/\x27/g,"\x27\x27")+"\x27";const command=`$zip=${q(zip)}; $dest=${q(destination)}; Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force`;const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-Command",command],{windowsHide:true});let err="";child.stderr.on("data",d=>err+=String(d));child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(err.trim()||"Could not extract add-on archive")))})}
function validateToolDefinition(tool){
 if(!tool||typeof tool!=="object")throw new Error("Invalid add-on tool definition");
 const name=String(tool.name||"").trim();
 if(!/^[a-zA-Z0-9._-]{1,80}$/.test(name))throw new Error("Invalid add-on tool name");
 const description=String(tool.description||"").trim();
 if(!description)throw new Error("Add-on tool description is required: "+name);
 const parameters=tool.parameters&&typeof tool.parameters==="object"?tool.parameters:{type:"object",properties:{},required:[]};
 if(parameters.type!=="object")throw new Error("Add-on tool parameters must be an object schema: "+name);
 return {name,description,parameters};
}
function validateManifest(manifest){
 if(!manifest||manifest.schemaVersion!==1)throw new Error("Unsupported add-on manifest schema");
 const id=safeId(manifest.id);if(!manifest.name)throw new Error("Add-on name is required");if(!manifest.version)throw new Error("Add-on version is required");
 if(manifest.entry){const entry=String(manifest.entry);if(!/^([a-zA-Z0-9._-]+[\\/])*[a-zA-Z0-9._-]+\.js$/.test(entry)||path.isAbsolute(entry)||entry.split(/[\\/]+/).some(part=>part===".."))throw new Error("Invalid add-on entry");}
 const tools=Array.isArray(manifest.tools)?manifest.tools.map(validateToolDefinition):[];
 const seen=new Set();for(const tool of tools){if(seen.has(tool.name))throw new Error("Duplicate add-on tool: "+tool.name);seen.add(tool.name)}
 return {...manifest,id,tools};
}
function validateCatalogEntry(addon){
 if(!addon||!addon.id||!addon.name||!addon.version)throw new Error("Invalid add-on catalog entry");
 const id=safeId(addon.id);if(addon.downloadUrl){const u=new URL(addon.downloadUrl);if(u.protocol!=="https:")throw new Error("Add-on download URL must use HTTPS")}
 return {...addon,id};
}
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"))}
function dependencyStatus(userData,manifest){const deps=manifest.dependencies&&typeof manifest.dependencies==="object"?manifest.dependencies:{};const missing=[];for(const [id,range] of Object.entries(deps)){if(!has(userData,id))missing.push({id,range})}return{ok:missing.length===0,missing}}
function listInstalled(userData){ensureRoot(userData);return fs.readdirSync(rootFor(userData),{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith(".tmp-")&&!x.name.startsWith(".backup-")).flatMap(x=>{const dir=path.join(rootFor(userData),x.name);const manifestFile=path.join(dir,"manifest.json");if(!fs.existsSync(manifestFile))return[];try{const m=validateManifest(readJson(manifestFile));m.dependencyStatus=dependencyStatus(userData,m);m.installed=true;if(m.enabled!==false)registerInstalled(userData,m);return[m]}catch(error){try{const raw=readJson(manifestFile);const id=safeId(raw?.id||x.name);return[{id,name:String(raw?.name||id),version:String(raw?.version||"unknown"),enabled:raw?.enabled!==false,installed:true,manifestError:String(error?.message||error),dependencyStatus:{ok:false,missing:[]}}]}catch{return[]}}})}
async function fetchCatalog(url=DEFAULT_CATALOG_URL){return new Promise((resolve,reject)=>{let u;try{u=new URL(url)}catch{return reject(new Error("Invalid catalog URL"))}if(u.protocol!=="https:")return reject(new Error("Catalog must use HTTPS"));https.get(u,res=>{let body="";res.on("data",d=>body+=d);res.on("end",()=>{if(res.statusCode!==200)return reject(new Error("Catalog HTTP "+res.statusCode));try{const data=JSON.parse(body);if(data?.schemaVersion!==2||!Array.isArray(data.addons))throw new Error("Invalid add-on catalog schema");resolve(data)}catch(e){reject(new Error(e.message||"Invalid add-on catalog"))}})}).on("error",reject)})}
function swapIntoPlace(staging,target){const backup=target+".backup-"+Date.now();let movedOld=false;try{if(fs.existsSync(target)){fs.renameSync(target,backup);movedOld=true}fs.renameSync(staging,target);if(movedOld)fs.rmSync(backup,{recursive:true,force:true})}catch(e){try{if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});if(movedOld&&fs.existsSync(backup))fs.renameSync(backup,target)}catch{}throw e}}
async function install(userData,addon,onProgress){
 const catalogEntry=validateCatalogEntry(addon);
 if(catalogEntry.installable!==true)throw new Error("This add-on is not downloadable.");
 if(catalogEntry.installType!=="bundle")throw new Error("This add-on is not packaged as a downloadable bundle.");
 if(!catalogEntry.downloadUrl)throw new Error("This add-on has no downloadable package.");
 const deps=catalogEntry.dependencies||[];
 for(const dep of deps){
  const depId=typeof dep==="string"?dep:dep.id;
  if(depId&&!has(userData,depId))throw new Error("Missing add-on dependency: "+depId);
 }
 const tempRoot=path.join(rootFor(userData),".tmp-"+catalogEntry.id+"-"+Date.now());
 const zip=path.join(tempRoot,"package.zip");
 const staging=path.join(tempRoot,"package");
 const target=addonDir(userData,catalogEntry.id);
 let actualManifest=null;
 try{
  fs.mkdirSync(tempRoot,{recursive:true});
  onProgress?.({state:"downloading",percent:0});
  await download(catalogEntry.downloadUrl,zip,(percent,done,total)=>onProgress?.({state:"downloading",percent,done,total}));
  if(catalogEntry.sha256){
   const digest=await sha256(zip);
   if(digest.toLowerCase()!==String(catalogEntry.sha256).toLowerCase())throw new Error("Add-on checksum verification failed");
  }
  onProgress?.({state:"extracting",percent:100});
  await extractZip(zip,staging);
  const candidates=[
   path.join(staging,"manifest.json"),
   path.join(staging,catalogEntry.id,"manifest.json")
  ];
  const actual=candidates.find(fs.existsSync);
  if(!actual)throw new Error("Downloaded add-on has no manifest.json");
  actualManifest=validateManifest({...readJson(actual),enabled:true,installedAt:new Date().toISOString()});
  if(actualManifest.id!==catalogEntry.id||actualManifest.version!==catalogEntry.version)throw new Error("Downloaded add-on manifest does not match catalog");
  const sourceRoot=path.dirname(actual);
  if(sourceRoot!==staging){
   const normalized=path.join(tempRoot,"normalized");
   fs.cpSync(sourceRoot,normalized,{recursive:true});
   fs.rmSync(staging,{recursive:true,force:true});
   fs.renameSync(normalized,staging);
  }
  swapIntoPlace(staging,target);
  registerInstalled(userData,actualManifest);
  onProgress?.({state:"registered",percent:100});
  onProgress?.({state:"installed",percent:100});
  return actualManifest;
 }finally{
  fs.rmSync(tempRoot,{recursive:true,force:true});
 }
}
function uninstall(userData,id){const dir=addonDir(userData,id);if(!fs.existsSync(dir))return false;unregisterInstalled(userData,id);fs.rmSync(dir,{recursive:true,force:true});return true}
function describe(userData,id){const manifest=validateManifest(readJson(installedManifest(userData,id)));if(manifest.enabled===false)throw new Error("Add-on disabled: "+id);const ds=dependencyStatus(userData,manifest);if(!ds.ok)throw new Error("Missing add-on dependencies: "+ds.missing.map(x=>x.id).join(", "));return manifest}
function resolveEntryPath(userData,id,relative){const root=path.resolve(addonDir(userData,id)),entry=path.resolve(root,String(relative||""));const inside=(base,candidate)=>{const rel=path.relative(base,candidate);return rel===""||(rel!==".."&&!rel.startsWith(".."+path.sep)&&!path.isAbsolute(rel))};if(!inside(root,entry))throw new Error("Add-on entry escapes its installation directory");let realRoot;try{realRoot=fs.realpathSync(root)}catch(error){throw new Error("Add-on installation directory cannot be resolved: "+error.message)}let realEntry;try{realEntry=fs.realpathSync(entry)}catch(error){throw new Error("Add-on entry cannot be resolved: "+error.message)}if(!inside(realRoot,realEntry))throw new Error("Add-on entry escapes its installation directory through a symlink");return realEntry}
function load(userData,id){const manifest=validateManifest(readJson(installedManifest(userData,id)));if(manifest.enabled===false)throw new Error("Add-on disabled: "+id);const ds=dependencyStatus(userData,manifest);if(!ds.ok)throw new Error("Missing add-on dependencies: "+ds.missing.map(x=>x.id).join(", "));if(!manifest.entry)return manifest;const entry=resolveEntryPath(userData,id,manifest.entry);return {...manifest,module:require(entry)}}
function has(userData,id){return fs.existsSync(installedManifest(userData,id))}
function getPackagePath(userData,id,relative){return path.join(addonDir(userData,id),relative||"")}
function requirePackage(userData,id,packageName){const root=addonDir(userData,id);if(!has(userData,id))throw new Error("Add-on is not installed: "+id);try{return require(require.resolve(packageName,{paths:[root]}))}catch(e){throw new Error(`Add-on ${id} is installed but package ${packageName} could not be loaded: ${e.message}`)}}
function registerInstalled(userData,manifest){return capabilities.register(userData,manifest)}
function unregisterInstalled(userData,id){require("./runtime").unregister(userData,id)}
function setEnabled(userData,id,enabled){const file=installedManifest(userData,id);if(!fs.existsSync(file))throw new Error("Add-on not installed: "+id);const manifest=validateManifest(readJson(file));manifest.enabled=Boolean(enabled);fs.writeFileSync(file,JSON.stringify(manifest,null,2),"utf8");if(manifest.enabled)registerInstalled(userData,manifest);else unregisterInstalled(userData,id);return manifest}
module.exports={DEFAULT_CATALOG_URL,ensureRoot,listInstalled,fetchCatalog,install,uninstall,describe,load,has,getPackagePath,requirePackage,addonDir,registerInstalled,unregisterInstalled,setEnabled,dependencyStatus,validateManifest,resolveEntryPath};
