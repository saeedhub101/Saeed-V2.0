const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {redactToolArgs}=require("../src/tools/redact");
const {ToolRegistry}=require("../src/tools/registry");
const {createPermissionManager}=require("../src/main/application/permission-manager");

async function main(){
 const confirmations=[];
 const denied=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "deny",confirm:async request=>{confirmations.push(request);return true}});
 const names=denied.schemas().map(x=>x.function?.name).filter(Boolean);
 assert.equal(new Set(names).size,names.length,"tool schemas must not contain duplicate names");
 for(const name of ["memory_add","memory_search","knowledge_add","mcp_list_servers","mcp_list_tools","mcp_call_tool","email_send","email_imap_search"]){
  assert.ok(names.includes(name),"missing advertised capability schema: "+name);
  const result=await denied.call(name,{text:"test",query:"test",server:"test",tool:"test",host:"localhost",port:993,from:"a@example.com",to:["b@example.com"],message:"test",provider:"test",account:"test",username:"test",password:"test"});
  assert.equal(result.ok,false,"denied tool must not execute: "+name);
  assert.match(String(result.error||""),/Permission denied/,"declared capability must reach the canonical registry authorization: "+name);
 }
 assert.equal(confirmations.length,0,"Deny must not open confirmation or execute a tool");
 const allowedPolicy=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "allow",confirm:async request=>{confirmations.push(request);return false}});
 for(const name of ["email_send","mcp_call_tool"]){
  const result=await allowedPolicy.call(name,{text:"test",query:"test",server:"test",tool:"test",host:"localhost",port:993,from:"a@example.com",to:["b@example.com"],message:"test",provider:"test",account:"test",username:"test",password:"test"});
  assert.equal(result.ok,false,"sensitive tool must require a fresh confirmation: "+name);
  assert.match(String(result.error||""),/Permission denied/,"sensitive tool must be denied when confirmation is rejected: "+name);
 }
 assert.equal(confirmations.length,2,"email and MCP execution must each ask explicitly");
 assert.equal(names.includes("credential_store"),false,"credential storage must not expose passwords to the model");
 assert.equal(names.includes("credential_get"),false,"credential retrieval must not expose secrets to the model");
 const safe=redactToolArgs("email_send",{to:["person@example.com"],message:"private body",password:"hidden",accessToken:"hidden",headers:{authorization:"Bearer hidden"}});
 assert.equal(safe.message,"[REDACTED]","email body must be redacted from tool events");
 assert.equal(safe.password,"[REDACTED]","password must be redacted");
 assert.equal(safe.accessToken,"[REDACTED]","access token must be redacted");
 assert.equal(safe.headers.authorization,"[REDACTED]","nested authorization headers must be redacted");
 const emailTools=require("../src/tools/addons").schemas();
 const sendSchema=emailTools.find(x=>x.function?.name==="email_send").function.parameters;
 assert.equal(Object.hasOwn(sendSchema.properties,"password"),false,"email schema must not expose passwords");
 assert.equal(Object.hasOwn(sendSchema.properties,"accessToken"),false,"email schema must not expose access tokens");
 assert.equal(emailTools.some(x=>["credential_store","credential_get"].includes(x.function?.name)),false,"credential management must not be model-callable");
 const credentialsSource=fs.readFileSync(path.join(__dirname,"..","src","addons","credentials.js"),"utf8");
 assert.equal(credentialsSource.includes('"/pass:"'),false,"credential storage must not put passwords in process arguments");
 assert.ok(credentialsSource.includes("child.stdin.end(JSON.stringify({target:target(provider,account)"),"credential secrets must be sent through stdin, not command-line arguments");
 assert.ok(credentialsSource.includes("public UInt32 Flags;public UInt32 Type;public string TargetName;public string Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 BlobSize;public IntPtr Blob;"),"Credential Manager CREDENTIAL layout must match the native Windows structure field order and DWORD widths");
 const noSurface=createPermissionManager({getAgent:()=>null,showChat:async()=>{},getChatWindow:()=>null,diagnostic:()=>{}});
 assert.equal(noSurface.permissionPolicy("unknown-capability"),"ask","unknown categories must fail closed");
 assert.equal(await noSurface.confirmPermission("files",{name:"write_file"}),false,"confirmation without a live chat surface must deny");
 const learning=require("../src/learning");
 let current=true,executed=0;
 const learned=await learning.run(process.cwd(),{call:async()=>{executed++;current=false;return{ok:true}}},{id:"cancel-test",steps:[{tool:"first"},{tool:"second"},{tool:"third"}]},{isCurrent:()=>current});
 assert.equal(learned.stale,true,"learned skill should stop when its conversation is invalidated");
 assert.equal(executed,1,"stale learned skills must not execute subsequent side-effecting steps");
 console.log("INTELLIGENCE_SECURITY=PASS (schemas, central dispatch, cancellation, deny policy, sensitive confirmation, fail-closed UI)");
}
main().catch(error=>{console.error(error);process.exitCode=1});
