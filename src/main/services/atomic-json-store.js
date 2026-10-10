"use strict";
const fs=require("node:fs");
let sequence=0;
function writeJsonAtomic(file,value,fsImpl=fs){
 const target=String(file||"");if(!target)return{ok:false,error:"A target path is required"};
 const temp=target+".tmp-"+process.pid+"-"+Date.now()+"-"+(++sequence);
 let serialized;
 try{
  serialized=JSON.stringify(value,null,2);
  if(typeof serialized!=="string")throw new Error("Value is not JSON serializable");
  fsImpl.writeFileSync(temp,serialized,{encoding:"utf8",flag:"wx"});
  const staged=JSON.parse(fsImpl.readFileSync(temp,"utf8"));
  if(JSON.stringify(staged)!==JSON.stringify(JSON.parse(serialized)))throw new Error("Temporary file verification failed");
  fsImpl.renameSync(temp,target);
  const persisted=JSON.parse(fsImpl.readFileSync(target,"utf8"));
  if(JSON.stringify(persisted)!==JSON.stringify(staged))throw new Error("Persisted JSON read-back does not match the written value");
  return{ok:true,bytes:Buffer.byteLength(serialized,"utf8")};
 }catch(error){try{fsImpl.unlinkSync(temp)}catch{}return{ok:false,error:String(error?.message||error)}}
}
module.exports={writeJsonAtomic};
