const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
const root=path.join(__dirname,".."),sourceRoot=path.join(root,"src"),failures=[];
let htmlCount=0,scriptCount=0,externalCount=0;
function checkCode(code,extension,label){
 const temp=path.join(tempDir,"syntax-"+(++scriptCount)+extension);
 fs.writeFileSync(temp,code,"utf8");
 const result=spawnSync(process.execPath,["--check",temp],{encoding:"utf8",windowsHide:true});
 if(result.error||result.status!==0)failures.push({file:label,error:String(result.error?.message||result.stderr||result.stdout||"node --check failed").trim()});
}
function checkExternalScript(file,src,type){
 const clean=src.split(/[?#]/)[0];
 if(!clean||/^(?:https?:)?\/\//i.test(clean)||/^data:/i.test(clean))return;
 const target=path.resolve(path.dirname(file),decodeURIComponent(clean));
 if(target!==root&&!target.startsWith(root+path.sep)){failures.push({file:path.relative(root,file),error:"script source escapes repository root: "+src});return}
 if(!fs.existsSync(target)){failures.push({file:path.relative(root,file),error:"missing local script source: "+src});return}
 if(!fs.statSync(target).isFile())return;
 externalCount++;
 checkCode(fs.readFileSync(target,"utf8"),type==="module"?".mjs":".js",path.relative(root,target));
}
function checkHtml(file){
 htmlCount++;
 const html=fs.readFileSync(file,"utf8");
 const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
 for(let i=0;i<blocks.length;i++){
  const attrs=blocks[i][1]||"",code=blocks[i][2]||"",type=(attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]||"").toLowerCase(),src=(attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]||"").trim();
  if(type==="importmap"||type==="application/json"||type==="application/ld+json")continue;
  if(src)checkExternalScript(file,src,type);
  if(!code.trim())continue;
  if(type&&!["module","text/javascript","application/javascript","text/ecmascript","application/ecmascript"].includes(type))continue;
  checkCode(code,type==="module"?".mjs":".js",path.relative(root,file)+" inline script #"+(i+1));
 }
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=="node_modules"&&entry.name!=="dist")walk(file)}else if(entry.isFile()&&entry.name.toLowerCase().endsWith(".html"))checkHtml(file)}}
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-html-script-check-"));
try{
 walk(sourceRoot);
 if(failures.length){for(const f of failures)console.error("HTML_SCRIPT_SYNTAX=FAIL",JSON.stringify(f));console.error("HTML_SCRIPT_SYNTAX_SUMMARY=FAIL",JSON.stringify({htmlCount,scriptCount,externalCount,failures:failures.length}));process.exitCode=1}
 else console.log("HTML_SCRIPT_SYNTAX=PASS",JSON.stringify({htmlCount,scriptCount,externalCount}));
}finally{try{fs.rmSync(tempDir,{recursive:true,force:true})}catch{}}
