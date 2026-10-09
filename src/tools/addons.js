const schemas=()=>[
 {type:"function",function:{name:"memory_add",description:"Store text in Saeed local vector memory.",parameters:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}}},
 {type:"function",function:{name:"memory_search",description:"Search local memory by semantic similarity.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"number"}},required:["query"]}}},
 {type:"function",function:{name:"knowledge_add",description:"Add a document snippet to the local knowledge base.",parameters:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}}},
 {type:"function",function:{name:"mcp_list_servers",description:"List configured MCP servers.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"mcp_list_tools",description:"Discover tools exposed by an MCP server.",parameters:{type:"object",properties:{server:{type:"string"}},required:["server"]}}},
 {type:"function",function:{name:"mcp_call_tool",description:"Call an approved MCP tool after explicit confirmation.",parameters:{type:"object",properties:{server:{type:"string"},tool:{type:"string"},arguments:{type:"object"}},required:["server","tool"]}}},
 {type:"function",function:{name:"email_provider_info",description:"Return non-secret IMAP/SMTP/POP3 connection settings for a provider.",parameters:{type:"object",properties:{provider:{type:"string"}},required:["provider"]}}},
 {type:"function",function:{name:"email_test_connection",description:"Test an email service TCP endpoint.",parameters:{type:"object",properties:{host:{type:"string"},port:{type:"number"},tls:{type:"boolean"}},required:["host","port"]}}},
 {type:"function",function:{name:"email_send",description:"Send an email using a credential saved in Windows Credential Manager. Sending always requires explicit confirmation. Message is the email body, not raw SMTP headers.",parameters:{type:"object",properties:{provider:{type:"string"},account:{type:"string"},host:{type:"string"},port:{type:"number"},tls:{type:"boolean"},startTls:{type:"boolean"},from:{type:"string"},to:{type:"array",items:{type:"string"}},subject:{type:"string"},message:{type:"string"}},required:["provider","account","from","to","message"]}}},
 {type:"function",function:{name:"email_imap_folders",description:"List folders for an email account with credentials saved in Windows Credential Manager.",parameters:{type:"object",properties:{provider:{type:"string"},account:{type:"string"},host:{type:"string"},port:{type:"number"}},required:["provider","account"]}}},
 {type:"function",function:{name:"email_imap_search",description:"Search messages in an IMAP mailbox using a saved Windows Credential Manager account.",parameters:{type:"object",properties:{provider:{type:"string"},account:{type:"string"},host:{type:"string"},port:{type:"number"},mailbox:{type:"string"},criteria:{type:"string"},uid:{type:"boolean"}},required:["provider","account"]}}},
 {type:"function",function:{name:"email_imap_fetch",description:"Fetch an IMAP message or headers using a saved Windows Credential Manager account.",parameters:{type:"object",properties:{provider:{type:"string"},account:{type:"string"},host:{type:"string"},port:{type:"number"},mailbox:{type:"string"},sequence:{type:"string"},uid:{type:"boolean"},headersOnly:{type:"boolean"}},required:["provider","account","sequence"]}}}
];
function safeHeader(value,label){
 const text=String(value??"").trim();
 if(!text||/[\r\n\0]/.test(text))throw new Error("Invalid email "+label);
 return text;
}
async function emailConfig(args,protocol){
 const email=require("../addons/email"),credentials=require("../addons/credentials");
 const provider=String(args.provider||"").trim().toLowerCase(),account=String(args.account||"").trim();
 if(!provider||!account)throw new Error("Select an email provider and account first");
 const defaults=email.provider(provider)[protocol]||{};
 const host=String(args.host||defaults.host||"").trim(),port=Number(args.port||defaults.port);
 if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error("This provider needs a valid "+protocol.toUpperCase()+" host and port");
 const saved=await credentials.get(provider,account);
 return{...defaults,...args,host,port,username:saved.username,password:saved.password,tls:args.tls===undefined?Boolean(defaults.tls):Boolean(args.tls),startTls:args.startTls===undefined?Boolean(defaults.startTls):Boolean(args.startTls)};
}
async function call(name,args,ctx){
 const u=ctx.userDataPath;
 if(name==="memory_add"||name==="memory_search"||name==="knowledge_add"){const memory=require("../core/services/memory-service");if(name==="memory_add")return{ok:true,item:memory.add(u,args.text,args.metadata||{})};if(name==="memory_search")return{ok:true,items:memory.search(u,args.query,args.limit||5).map(x=>({id:x.id,text:x.text,score:x.score,metadata:x.metadata}))};return{ok:true,item:memory.addKnowledge(u,args.text,args.metadata||{})}}
 if(name==="mcp_list_servers"||name==="mcp_list_tools"||name==="mcp_call_tool"){const mcp=require("../addons/mcp");if(name==="mcp_list_servers")return{ok:true,servers:mcp.listServers(u)};if(name==="mcp_list_tools")return{ok:true,result:await mcp.listTools(u,args.server)};return{ok:true,result:await mcp.callTool(u,args.server,args.tool,args.arguments||{},ctx.requestPermission)}}
 if(name.startsWith("email_")){
  const email=require("../addons/email"),client=require("../addons/email-client");
  if(name==="email_provider_info")return{ok:true,provider:email.provider(args.provider),providers:email.PROVIDERS};
  if(name==="email_test_connection")return{ok:true,connected:await email.testTcp(args)};
  if(name==="email_send"){
   const config=await emailConfig(args,"smtp");
   const from=safeHeader(args.from,"sender"),to=[].concat(args.to||[]).map(x=>safeHeader(x,"recipient"));
   if(!to.length)throw new Error("At least one email recipient is required");
   const subject=String(args.subject||"(no subject)").replace(/[\r\n\0]/g," ").slice(0,300);
   const body=String(args.message||"");
   const message="From: "+from+"\r\nTo: "+to.join(", ")+"\r\nSubject: "+subject+"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"+body;
   return{ok:true,sent:await client.smtpSend(config,message),to,subject};
  }
  if(name==="email_imap_folders"){const config=await emailConfig(args,"imap");return{ok:true,folders:await client.imapListFolders(config)}}
  if(name==="email_imap_search"){
   const config=await emailConfig(args,"imap"),criteria=String(args.criteria||"ALL"),mailbox=safeHeader(args.mailbox||"INBOX","mailbox");
   if(/[\r\n\0]/.test(criteria)||criteria.length>300)throw new Error("Invalid IMAP search criteria");
   return{ok:true,results:await client.imapSearch(config,{...args,mailbox,criteria})};
  }
  if(name==="email_imap_fetch"){
   const config=await emailConfig(args,"imap"),mailbox=safeHeader(args.mailbox||"INBOX","mailbox"),sequence=String(args.sequence||"");
   if(!/^\d+(?::\d+)?$/.test(sequence))throw new Error("IMAP sequence must be a number or numeric range");
   return{ok:true,message:await client.imapFetch(config,{...args,mailbox,sequence})};
  }
 }
 return null;
}
module.exports={schemas,call};
