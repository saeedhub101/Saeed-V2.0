const assert=require("node:assert/strict");
const {ToolRegistry}=require("../src/tools/registry");
const {createPermissionManager}=require("../src/main/application/permission-manager");

async function main(){
 const confirmations=[];
 const denied=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "deny",confirm:async request=>{confirmations.push(request);return true}});
 const names=denied.schemas().map(x=>x.function?.name).filter(Boolean);
 assert.equal(new Set(names).size,names.length,"tool schemas must not contain duplicate names");
 for(const name of ["memory_add","memory_search","knowledge_add","mcp_list_servers","mcp_list_tools","mcp_call_tool","email_send","email_imap_search","credential_store","credential_get"]){
  assert.ok(names.includes(name),"missing advertised capability schema: "+name);
  const result=await denied.call(name,{text:"test",query:"test",server:"test",tool:"test",host:"localhost",port:993,from:"a@example.com",to:["b@example.com"],message:"test",provider:"test",account:"test",username:"test",password:"test"});
  assert.equal(result.ok,false,"denied tool must not execute: "+name);
  assert.match(String(result.error||""),/Permission denied/,"declared capability must reach the canonical registry authorization: "+name);
 }
 assert.equal(confirmations.length,0,"Deny must not open confirmation or execute a tool");
 const allowedPolicy=new ToolRegistry({userDataPath:process.cwd(),permissionPolicy:()=> "allow",confirm:async request=>{confirmations.push(request);return false}});
 for(const name of ["email_send","mcp_call_tool","credential_store"]){
  const result=await allowedPolicy.call(name,{text:"test",query:"test",server:"test",tool:"test",host:"localhost",port:993,from:"a@example.com",to:["b@example.com"],message:"test",provider:"test",account:"test",username:"test",password:"test"});
  assert.equal(result.ok,false,"sensitive tool must require a fresh confirmation: "+name);
  assert.match(String(result.error||""),/Permission denied/,"sensitive tool must be denied when confirmation is rejected: "+name);
 }
 assert.equal(confirmations.length,3,"email, MCP execution, and credential storage must each ask explicitly");
 const noSurface=createPermissionManager({getAgent:()=>null,showChat:async()=>{},getChatWindow:()=>null,diagnostic:()=>{}});
 assert.equal(noSurface.permissionPolicy("unknown-capability"),"ask","unknown categories must fail closed");
 assert.equal(await noSurface.confirmPermission("files",{name:"write_file"}),false,"confirmation without a live chat surface must deny");
 console.log("INTELLIGENCE_SECURITY=PASS (schemas, central dispatch, deny policy, sensitive confirmation, fail-closed UI)");
}
main().catch(error=>{console.error(error);process.exitCode=1});
