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
function installNpmPackage(target,manifest,onProgress){return new Promise((resolve,reject)=>{fs.mkdirSync(target,{recursive:true});const npm=process.platform==="win32"?"npm.cmd":"npm";const child=spawn(npm,["install","--prefix",target,`${manifest.packageName||manifest.id}@${manifest.version}`,"--omit=dev","--ignore-scripts"],{windowsHide:true});let err="";child.stderr.on("data",d=>err+=String(d));child.stdout.on("data",d=>{const s=String(d);if(/added|up to date|changed/i.test(s))onProgress?.({state:"installing",percent:null})});child.on("error",e=>reject(new Error("npm is required for this add-on on this build: "+e.message)));child.on("close",code=>code===0?resolve():reject(new Error(err.trim()||("npm install failed with code "+code))));})}
function extractZip(zip,destination){return new Promise((resolve,reject)=>{fs.mkdirSync(destination,{recursive:true});const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-Command","Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",zip,destination],{windowsHide:true});let err="";child.stderr.on("data",d=>err+=String(d));child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(err.trim()||"Could not extract add-on archive")))})}
function validateManifest(manifest){
 if(!manifest||manifest.schemaVersion!==1)throw new Error("Unsupported add-on manifest schema");
 const id=safeId(manifest.id);if(!manifest.name)throw new Error("Add-on name is required");if(!manifest.version)throw new Error("Add-on version is required");
 if(manifest.entry&&!/^([a-zA-Z0-9._-]+[\\/])*[a-zA-Z0-9._-]+\.js$/.test(String(manifest.entry)))throw new Error("Invalid add-on entry");
 return {...manifest,id};
}
function validateCatalogEntry(addon){
 if(!addon||!addon.id||!addon.name||!addon.version)throw new Error("Invalid add-on catalog entry");
 const id=safeId(addon.id);if(addon.downloadUrl){const u=new URL(addon.downloadUrl);if(u.protocol!=="https:")throw new Error("Add-on download URL must use HTTPS")}
 return {...addon,id};
}
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"))}
function listInstalled(userData){ensureRoot(userData);return fs.readdirSync(rootFor(userData),{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith(".tmp-")&&!x.name.startsWith(".backup-")).flatMap(x=>{try{const m=validateManifest(readJson(path.join(rootFor(userData),x.name,"manifest.json")));if(m.enabled!==false)registerInstalled(userData,m);return[m]}catch{return[]}})}
async function fetchCatalog(url=DEFAULT_CATALOG_URL){return new Promise((resolve,reject)=>{let u;try{u=new URL(url)}catch{return reject(new Error("Invalid catalog URL"))}if(u.protocol!=="https:")return reject(new Error("Catalog must use HTTPS"));https.get(u,res=>{let body="";res.on("data",d=>body+=d);res.on("end",()=>{if(res.statusCode!==200)return reject(new Error("Catalog HTTP "+res.statusCode));try{const data=JSON.parse(body);if(data?.schemaVersion!==2||!Array.isArray(data.addons))throw new Error("Invalid add-on catalog schema");resolve(data)}catch(e){reject(new Error(e.message||"Invalid add-on catalog"))}})}).on("error",reject)})}
function swapIntoPlace(staging,target){const backup=target+".backup-"+Date.now();let movedOld=false;try{if(fs.existsSync(target)){fs.renameSync(target,backup);movedOld=true}fs.renameSync(staging,target);if(movedOld)fs.rmSync(backup,{recursive:true,force:true})}catch(e){try{if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});if(movedOld&&fs.existsSync(backup))fs.renameSync(backup,target)}catch{}throw e}}
async function install(userData,addon,onProgress){
 const catalogEntry=validateCatalogEntry(addon);if(!catalogEntry.downloadUrl)throw new Error("This add-on has no downloadable package yet");
 const tempRoot=path.join(rootFor(userData),".tmp-"+catalogEntry.id+"-"+Date.now());const zip=path.join(tempRoot,"package.zip"),staging=path.join(tempRoot,"package"),target=addonDir(userData,catalogEntry.id);let actualManifest=null;
 try{
  fs.mkdirSync(tempRoot,{recursive:true});onProgress?.({state:"downloading",percent:0});
  await download(catalogEntry.downloadUrl,zip,(percent,done,total)=>onProgress?.({state:"downloading",percent,done,total}));
  if(catalogEntry.sha256){const digest=await sha256(zip);if(digest.toLowerCase()!==String(catalogEntry.sha256).toLowerCase())throw new Error("Add-on checksum verification failed")}
  if(catalogEntry.installType==="npm-package"){
   onProgress?.({state:"installing",percent:null});
   await installNpmPackage(staging,catalogEntry,onProgress);
   actualManifest=validateManifest({...catalogEntry,schemaVersion:1,installedAt:new Date().toISOString()});
   fs.writeFileSync(path.join(staging,"manifest.json"),JSON.stringify(actualManifest,null,2),"utf8");
  }else{
   onProgress?.({state:"extracting",percent:100});await extractZip(zip,staging);
   const candidates=[path.join(staging,"manifest.json"),path.join(staging,catalogEntry.id,"manifest.json")];const actual=candidates.find(fs.existsSync);if(!actual)throw new Error("Downloaded add-on has no manifest.json");
   actualManifest=validateManifest(readJson(actual));if(actualManifest.id!==catalogEntry.id||actualManifest.version!==catalogEntry.version)throw new Error("Downloaded add-on manifest does not match catalog");
   const sourceRoot=path.dirname(actual);if(sourceRoot!==staging){const normalized=path.join(tempRoot,"normalized");fs.cpSync(sourceRoot,normalized,{recursive:true});fs.rmSync(staging,{recursive:true,force:true});fs.renameSync(normalized,staging)}
  }
  swapIntoPlace(staging,target);registerInstalled(userData,actualManifest);onProgress?.({state:"registered",percent:100});onProgress?.({state:"installed",percent:100});return actualManifest;
 }finally{fs.rmSync(tempRoot,{recursive:true,force:true})}
}
function uninstall(userData,id){const dir=addonDir(userData,id);if(!fs.existsSync(dir))return false;unregisterInstalled(userData,id);fs.rmSync(dir,{recursive:true,force:true});return true}
function load(userData,id){const manifest=validateManifest(readJson(installedManifest(userData,id)));if(manifest.enabled===false)throw new Error("Add-on disabled: "+id);if(!manifest.entry)return manifest;const entry=path.join(addonDir(userData,id),manifest.entry);if(!fs.existsSync(entry))throw new Error("Add-on entry not found: "+manifest.entry);return {...manifest,module:require(entry)}}
function has(userData,id){return fs.existsSync(installedManifest(userData,id))}
function getPackagePath(userData,id,relative){return path.join(addonDir(userData,id),relative||"")}
function requirePackage(userData,id,packageName){const root=addonDir(userData,id);if(!has(userData,id))throw new Error("Add-on is not installed: "+id);try{return require(require.resolve(packageName,{paths:[root]}))}catch(e){throw new Error(`Add-on ${id} is installed but package ${packageName} could not be loaded: ${e.message}`)}}
function registerInstalled(userData,manifest){return capabilities.register(userData,manifest)}
function unregisterInstalled(userData,id){require("./runtime").unregister(userData,id)}
module.exports={DEFAULT_CATALOG_URL,ensureRoot,listInstalled,fetchCatalog,install,uninstall,load,has,getPackagePath,requirePackage,addonDir,registerInstalled,unregisterInstalled};
