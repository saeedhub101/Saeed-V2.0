const {spawn}=require("child_process");
function run(args){return new Promise((resolve,reject)=>{const p=spawn("cmdkey.exe",args,{windowsHide:true});let out="",err="";p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);p.on("error",reject);p.on("close",c=>c===0?resolve(out):reject(new Error(err||"Credential Manager operation failed")))})}
function target(provider,account){return "Saeed:"+String(provider)+":"+String(account)}
async function set(provider,account,username,password){if(process.platform!=="win32")throw new Error("Windows Credential Manager is only available on Windows");await run(["/generic:"+target(provider,account),"/user:"+String(username),"/pass:"+String(password)]);return{provider,account,username,stored:true}}
async function remove(provider,account){if(process.platform!=="win32")return false;try{await run(["/delete:"+target(provider,account)]);return true}catch{return false}}
async function exists(provider,account){if(process.platform!=="win32")return false;try{await run(["/list:"+target(provider,account)]);return true}catch{return false}}
module.exports={target,set,remove,exists};