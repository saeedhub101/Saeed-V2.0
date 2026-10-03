const memory=require("../addons/memory-stack"),mcp=require("../addons/mcp"),email=require("../addons/email"),emailClient=require("../addons/email-client"),credentials=require("../addons/credentials");
function schemas(){return[
{name:"memory_add",description:"Store text in Saeed local vector memory.",inputSchema:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}},
{name:"memory_search",description:"Search local memory by semantic similarity.",inputSchema:{type:"object",properties:{query:{type:"string"},limit:{type:"number"}},required:["query"]}},
{name:"knowledge_add",description:"Add a document snippet to the local knowledge base.",inputSchema:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}},
{name:"mcp_list_servers",description:"List configured MCP servers.",inputSchema:{type:"object",properties:{}}},
{name:"mcp_list_tools",description:"Discover tools exposed by an MCP server.",inputSchema:{type:"object",properties:{server:{type:"string"}},required:["server"]}},
{name:"mcp_call_tool",description:"Call an approved MCP tool.",inputSchema:{type:"object",properties:{server:{type:"string"},tool:{type:"string"},arguments:{type:"object"}},required:["server","tool"]}},
{name:"email_provider_info",description:"Return real provider IMAP/SMTP/POP3 settings.",inputSchema:{type:"object",properties:{provider:{type:"string"}},required:["provider"]}},
{name:"email_test_connection",description:"Test an email service TCP endpoint.",inputSchema:{type:"object",properties:{host:{type:"string"},port:{type:"number"},tls:{type:"boolean"}},required:["host","port"]}},
{name:"email_send",description:"Send an email through SMTP.",inputSchema:{type:"object",properties:{host:{type:"string"},port:{type:"number"},tls:{type:"boolean"},username:{type:"string"},password:{type:"string"},from:{type:"string"},to:{type:"array"},message:{type:"string"}},required:["host","port","from","to","message"]}},
{name:"credential_store",description:"Store an email credential in Windows Credential Manager.",inputSchema:{type:"object",properties:{provider:{type:"string"},account:{type:"string"},username:{type:"string"},password:{type:"string"}},required:["provider","account","username","password"]}},{name:"credential_get",description:"Retrieve a previously stored Saeed credential from Windows Credential Manager.",inputSchema:{type:"object",properties:{provider:{type:"string"},account:{type:"string"}},required:["provider","account"]}}
]}
async function call(name,args,ctx){const u=ctx.userDataPath;
if(name==="memory_add")return{ok:true,item:memory.add(u,args.text,args.metadata||{})};
if(name==="memory_search")return{ok:true,items:memory.search(u,args.query,args.limit||5).map(x=>({id:x.id,text:x.text,score:x.score,metadata:x.metadata}))};
if(name==="knowledge_add")return{ok:true,item:memory.addKnowledge(u,args.text,args.metadata||{})};
if(name==="mcp_list_servers")return{ok:true,servers:mcp.listServers(u)};
if(name==="mcp_list_tools")return{ok:true,result:await mcp.listTools(u,args.server)};
if(name==="mcp_call_tool")return{ok:true,result:await mcp.callTool(u,args.server,args.tool,args.arguments||{},ctx.confirm)};
if(name==="email_provider_info")return{ok:true,provider:email.provider(args.provider),providers:email.PROVIDERS};
if(name==="email_test_connection")return{ok:true,connected:await email.testTcp(args)};
if(name==="email_send"){const msg=args.message||"From: "+args.from+"\r\nTo: "+[].concat(args.to||[]).join(", ")+"\r\n\r\n";return{ok:true,sent:await emailClient.smtpSend(args,msg)}}
if(name==="credential_store"){if(!(await ctx.confirm({name,args,permissionCategory:"credentials"})))return{ok:false,error:"Credential storage not approved"};return{ok:true,credential:await credentials.set(args.provider,args.account,args.username,args.password)}}
if(name==="credential_get"){if(!(await ctx.confirm({name,args,permissionCategory:"credentials"})))return{ok:false,error:"Credential retrieval not approved"};return{ok:true,credential:await credentials.get(args.provider,args.account)}}
return null}
module.exports={schemas,call};