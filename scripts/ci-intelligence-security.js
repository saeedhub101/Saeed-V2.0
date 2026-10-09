const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {redactToolArgs,redactToolResult}=require("../src/tools/redact");
const {ToolRegistry}=require("../src/tools/registry");
const {createPermissionManager}=require("../src/main/application/permission-manager");

async function main(){
 const confirmations=[];
 const validArgs=name=>{
  if(name==="memory_add")return{text:"test"};
  if(name==="memory_search")return{query:"test"};
  if(name==="knowledge_add")return{text:"test"};
  if(name==="mcp_list_servers")return{};
  if(name==="mcp_list_tools")return{server:"test"};
  if(name==="mcp_call_tool")return{server:"test",tool:"test",arguments:{}};
  if(name==="email_send")return{provider:"gmail",account:"person@gmail.com",to:["recipient@example.com"],subject:"Test",body:"Test body"};
  if(name==="email_imap_search")return{provider:"gmail",account:"person@gmail.com",criteria:"ALL"};
  if(name==="email_pop3_list"||name==="email_pop3_fetch")return{provider:"gmail",account:"person@gmail.com",index:1};
  return{};
 };
 const denied=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "deny",confirm:async request=>{confirmations.push(request);return true}});
 const names=denied.schemas().map(x=>x.function?.name).filter(Boolean);
 assert.equal(new Set(names).size,names.length,"tool schemas must not contain duplicate names");
 for(const name of ["memory_add","memory_search","knowledge_add","mcp_list_servers","mcp_list_tools","mcp_call_tool","email_send","email_imap_search","email_pop3_list","email_pop3_fetch"]){
  assert.ok(names.includes(name),"missing advertised capability schema: "+name);
  const result=await denied.call(name,validArgs(name));
  assert.equal(result.ok,false,"denied tool must not execute: "+name);
  assert.match(String(result.error||""),/Permission denied/,"declared capability must reach the canonical registry authorization: "+name);
 }
 assert.equal(confirmations.length,0,"Deny must not open confirmation or execute a tool");
 const allowedPolicy=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "allow",confirm:async request=>{confirmations.push(request);return false}});
 for(const name of ["email_send","mcp_call_tool"]){
  const result=await allowedPolicy.call(name,validArgs(name));
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
 const safeEmailResult=redactToolResult("email_imap_fetch",{body:"private email body",text:"private plain text",subject:"Allowed subject",headers:{authorization:"Bearer hidden"}});
 const safePop3Result=redactToolResult("email_pop3_fetch",{message:"private POP3 message",subject:"Allowed subject"});
 assert.equal(safePop3Result.message,"[REDACTED]","POP3 message content must be redacted from events");
 assert.equal(safePop3Result.subject,"Allowed subject","POP3 metadata should remain visible");
 assert.equal(safeEmailResult.body,"[REDACTED]","fetched email body must be redacted from events");
 assert.equal(safeEmailResult.text,"[REDACTED]","fetched email text must be redacted from events");
 assert.equal(safeEmailResult.subject,"Allowed subject","non-secret email metadata should remain visible");
 assert.equal(safeEmailResult.headers.authorization,"[REDACTED]","result authorization headers must be redacted");
 const emailTools=require("../src/tools/email").schemas();
 const sendSchema=emailTools.find(x=>x.function?.name==="email_send").function.parameters;
 assert.equal(Object.hasOwn(sendSchema.properties,"password"),false,"email schema must not expose passwords");
 assert.equal(Object.hasOwn(sendSchema.properties,"accessToken"),false,"email schema must not expose access tokens");
 assert.equal(emailTools.some(x=>["credential_store","credential_get"].includes(x.function?.name)),false,"credential management must not be model-callable");
 const credentialsSource=fs.readFileSync(path.join(__dirname,"..","src","addons","credentials.js"),"utf8");
 const emailClientSource=fs.readFileSync(path.join(__dirname,"..","src","addons","email-client.js"),"utf8");
 assert.ok(emailClientSource.includes(String.raw`\x01auth=Bearer `),"SMTP/IMAP/POP3 OAuth SASL payloads must contain actual JavaScript control-byte escapes");
 assert.equal(emailClientSource.includes(String.raw`\\x01auth=Bearer `),false,"OAuth SASL separators must not be double-escaped as literal backslash text");
 assert.equal(credentialsSource.includes('"/pass:"'),false,"credential storage must not put passwords in process arguments");
 assert.ok(credentialsSource.includes("child.stdin.end(JSON.stringify({target:target(provider,account)"),"credential secrets must be sent through stdin, not command-line arguments");
 assert.ok(credentialsSource.includes("public UInt32 Flags;public UInt32 Type;public string TargetName;public string Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 BlobSize;public IntPtr Blob;"),"Credential Manager CREDENTIAL layout must match the native Windows structure field order and DWORD widths");
 assert.ok(credentialsSource.includes("$credentialType=[type]'CredNative+C';$c=[Runtime.InteropServices.Marshal]::PtrToStructure($p,$credentialType)"),"Credential Manager read must resolve the nested native type explicitly");
 assert.ok(credentialsSource.includes("$d=[Console]::In.ReadToEnd()|ConvertFrom-Json;$t=[string]$d.target;"),"Credential target must be passed to PowerShell through stdin, not interpolated into source");
 assert.ok(credentialsSource.includes("ps.stdin.end(JSON.stringify({target:t}))")&&!credentialsSource.includes("CredRead('$t'"),"Credential reads must not interpolate account-controlled text into PowerShell");
 const noSurface=createPermissionManager({getAgent:()=>null,showChat:async()=>{},getChatWindow:()=>null,diagnostic:()=>{}});
 assert.equal(noSurface.permissionPolicy("unknown-capability"),"ask","unknown categories must fail closed");
 assert.equal(await noSurface.confirmPermission("files",{name:"write_file"}),false,"confirmation without a live chat surface must deny");
 let permissionActive=true,releasePermission;const waitingPolicy=new Promise(resolve=>{releasePermission=resolve});let cancelledDispatches=0;
 const cancellationRegistry=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:async()=>{await waitingPolicy;return"allow"},recordHook:()=>cancelledDispatches++});
 const pendingCall=cancellationRegistry.call("memory_add",{text:"must not be stored"},{isCurrent:()=>permissionActive});
 permissionActive=false;releasePermission();const cancelledCall=await pendingCall;
 assert.equal(cancelledCall.stale,true,"a conversation cancelled during a permission wait must not execute the tool");
 assert.equal(cancelledDispatches,0,"cancelled tool calls must not reach execution or learning records");
 const learning=require("../src/learning");
 let current=true,executed=0;
 const learned=await learning.run(process.cwd(),{call:async()=>{executed++;current=false;return{ok:true}}},{id:"cancel-test",steps:[{tool:"first"},{tool:"second"},{tool:"third"}]},{isCurrent:()=>current});
 assert.equal(learned.stale,true,"learned skill should stop when its conversation is invalidated");
 assert.equal(executed,1,"stale learned skills must not execute subsequent side-effecting steps");
 console.log("INTELLIGENCE_SECURITY=PASS (schemas, central dispatch, cancellation, deny policy, sensitive confirmation, fail-closed UI)");
}
main().catch(error=>{console.error(error);process.exitCode=1});
