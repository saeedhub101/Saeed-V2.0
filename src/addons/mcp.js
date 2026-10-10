const fs=require("fs"),path=require("path"),{spawn}=require("child_process");
function file(userData){return path.join(userData,"addons","mcp-servers.json")}
function read(userData){try{return JSON.parse(fs.readFileSync(file(userData),"utf8"))}catch{return{schemaVersion:2,servers:[]}}}
function write(userData,data){fs.mkdirSync(path.dirname(file(userData)),{recursive:true});fs.writeFileSync(file(userData),JSON.stringify(data,null,2),"utf8")}
function validate(s){if(!s?.id||!s?.transport)throw new Error("MCP server requires id and transport");if(!["stdio","streamable-http","sse"].includes(s.transport))throw new Error("Unsupported MCP transport");if(s.transport==="stdio"&&!s.command)throw new Error("stdio MCP server requires command");if(s.transport!=="stdio"&&!/^https:\/\//i.test(String(s.url||"")))throw new Error("Remote MCP servers require an HTTPS URL");return{...s,id:String(s.id),args:Array.isArray(s.args)?s.args.map(String):[],enabled:s.enabled!==false,permissions:s.permissions||{}}}
function addServer(userData,server){const v=validate(server),d=read(userData);d.schemaVersion=2;d.servers=d.servers.filter(x=>x.id!==v.id);d.servers.push({...v,updatedAt:new Date().toISOString()});write(userData,d);return v}
function removeServer(userData,id){const d=read(userData);d.servers=d.servers.filter(x=>x.id!==String(id));write(userData,d);return true}
function listServers(userData){return read(userData).servers}
async function rpcStdio(server,requests,options={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(server.command,server.args,{windowsHide:true,stdio:["pipe","pipe","pipe"]});
  const signal=options.signal||null,timeoutMs=Math.max(1000,Number(options.timeoutMs)||30000);
  let buffer="",seq=0,settled=false;
  const responses=new Map();
  let timer=null;
  const fail=error=>{
   if(settled)return;
   settled=true;
   if(timer)clearTimeout(timer);
   signal?.removeEventListener("abort",abort);
   for(const pending of responses.values())pending.rej(error);
   responses.clear();
   try{child.kill()}catch{}
   reject(error);
  };
  const succeed=value=>{
   if(settled)return;
   settled=true;
   if(timer)clearTimeout(timer);
   signal?.removeEventListener("abort",abort);
   try{child.kill()}catch{}
   resolve(value);
  };
  const abort=()=>fail(signal?.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
  if(signal?.aborted){abort();return}
  signal?.addEventListener("abort",abort,{once:true});
  timer=setTimeout(()=>fail(new Error("MCP stdio request timed out after "+timeoutMs+"ms")),timeoutMs);
  const request=(method,params)=>new Promise((res,rej)=>{
   if(settled)return rej(new Error("MCP request is no longer active"));
   const id=++seq;responses.set(id,{res,rej});
   try{child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params:params||{}})+"\\n",error=>{if(error){responses.delete(id);rej(error)}})}
   catch(error){responses.delete(id);rej(error)}
  });
  child.stdout.on("data",d=>{
   buffer+=String(d);
   let i;
   while((i=buffer.indexOf("\\n"))>=0){
    const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);
    if(!line)continue;
    try{
     const msg=JSON.parse(line);
     if(msg.id!==undefined&&responses.has(msg.id)){
      const q=responses.get(msg.id);responses.delete(msg.id);
      msg.error?q.rej(new Error(msg.error.message||"MCP error")):q.res(msg.result);
     }
    }catch{}
   }
  });
  child.stderr.on("data",()=>{});
  child.on("error",fail);
  child.on("close",(code,signalName)=>{if(!settled)fail(new Error("MCP stdio process exited before completing requests (code="+code+", signal="+signalName+")"))});
  (async()=>{
   try{
    await request("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"Saeed AI",version:"4.2"}});
    if(signal?.aborted)throw new Error("MCP request cancelled");
    await request("notifications/initialized",{});
    let out=null;
    for(const item of requests){
     if(signal?.aborted)throw new Error("MCP request cancelled");
     out=await request(item.method,item.params);
    }
    succeed(out);
   }catch(error){fail(error)}
  })();
 });
}
async function rpcHttp(server,method,params={},options={}){
 const signal=options.signal||null;
 const headers={"Content-Type":"application/json","Accept":"application/json, text/event-stream",...(server.headers||{})};
 const post=async(body,extra={})=>{
  if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
  const r=await fetch(server.url,{method:"POST",headers:{...headers,...extra},body:JSON.stringify(body),signal:signal||undefined});
  if(!r.ok)throw new Error("MCP HTTP "+r.status);
  return r;
 };
 const parse=async r=>{
  const text=await r.text();const line=text.split(/\\r?\\n/).find(x=>x.startsWith("data:"))||text;const clean=line.replace(/^data:\\s*/,"").trim();
  if(!clean)return{};
  const msg=JSON.parse(clean);if(msg.error)throw new Error(msg.error.message||"MCP error");return msg.result;
 };
 let id=Date.now();
 const init=await post({jsonrpc:"2.0",id:++id,method:"initialize",params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"Saeed AI",version:"4.2"}}});
 const session=init.headers.get("mcp-session-id");
 await post({jsonrpc:"2.0",method:"notifications/initialized",params:{}},session?{"MCP-Session-Id":session}:{});
 if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
 return parse(await post({jsonrpc:"2.0",id:++id,method,params},session?{"MCP-Session-Id":session}:{}));
}
async function listTools(userData,id,options={}){const s=listServers(userData).find(x=>x.id===String(id));if(!s||s.enabled===false)throw new Error("MCP server not available: "+id);return s.transport==="stdio"?rpcStdio(s,[{method:"tools/list",params:{}}],options):rpcHttp(s,"tools/list",{},options)}
async function callTool(userData,id,name,args={},confirm=async()=>false,options={}){const s=listServers(userData).find(x=>x.id===String(id));if(!s||s.enabled===false)throw new Error("MCP server not available: "+id);const signal=options.signal||null;if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));const allowed=s.permissions?.tools;if(Array.isArray(allowed)&&!allowed.includes(name))throw new Error("MCP tool is not permitted: "+name);if(s.permissions?.alwaysAsk&&!await confirm({server:id,tool:name,args,signal}))throw new Error("MCP tool permission denied");if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));const p={name,arguments:args};return s.transport==="stdio"?rpcStdio(s,[{method:"tools/call",params:p}],options):rpcHttp(s,"tools/call",p,options)}
module.exports={file,addServer,removeServer,listServers,listTools,callTool};