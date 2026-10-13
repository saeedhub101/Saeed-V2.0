const fs=require("fs"),path=require("path"),{spawn}=require("child_process");
function file(userData){return path.join(userData,"addons","mcp-servers.json")}
function read(userData){try{return JSON.parse(fs.readFileSync(file(userData),"utf8"))}catch{return{schemaVersion:2,servers:[]}}}
function write(userData,data){fs.mkdirSync(path.dirname(file(userData)),{recursive:true});fs.writeFileSync(file(userData),JSON.stringify(data,null,2),"utf8")}
function validate(s){if(!s?.id||!s?.transport)throw new Error("MCP server requires id and transport");if(!["stdio","streamable-http","sse"].includes(s.transport))throw new Error("Unsupported MCP transport");if(s.transport==="stdio"&&!s.command)throw new Error("stdio MCP server requires command");if(s.transport!=="stdio"&&!/^https:\/\//i.test(String(s.url||"")))throw new Error("Remote MCP servers require an HTTPS URL");return{...s,id:String(s.id),args:Array.isArray(s.args)?s.args.map(String):[],env:s.env&&typeof s.env==="object"&&!Array.isArray(s.env)?Object.fromEntries(Object.entries(s.env).filter(([key,value])=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)&&typeof value==="string")):{},enabled:s.enabled!==false,permissions:s.permissions||{}}}
function addServer(userData,server){const v=validate(server),d=read(userData);d.schemaVersion=2;d.servers=d.servers.filter(x=>x.id!==v.id);d.servers.push({...v,updatedAt:new Date().toISOString()});write(userData,d);return v}
function removeServer(userData,id){const d=read(userData);d.servers=d.servers.filter(x=>x.id!==String(id));write(userData,d);return true}
function listServers(userData){return read(userData).servers}
function describeServers(userData){return listServers(userData).map(server=>({id:server.id,name:String(server.name||server.id),transport:server.transport,enabled:server.enabled!==false,permissions:{tools:Array.isArray(server.permissions?.tools)?server.permissions.tools.slice(0,100):null,alwaysAsk:server.permissions?.alwaysAsk===true}}))}
async function rpcStdio(server,requests,options={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(server.command,server.args,{windowsHide:true,stdio:["pipe","pipe","pipe"],env:{...process.env,...(server.env||{})}});
  const signal=options.signal||null,timeoutMs=Math.max(1000,Number(options.timeoutMs)||30000);
  let buffer="",seq=0,settled=false,timer=null;
  const responses=new Map();
  const fail=error=>{
   if(settled)return;
   settled=true;if(timer)clearTimeout(timer);signal?.removeEventListener("abort",abort);
   for(const pending of responses.values())pending.rej(error);
   responses.clear();try{child.kill()}catch{}reject(error);
  };
  const succeed=value=>{
   if(settled)return;
   settled=true;if(timer)clearTimeout(timer);signal?.removeEventListener("abort",abort);
   try{child.kill()}catch{}resolve(value);
  };
  const abort=()=>fail(signal?.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
  if(signal?.aborted){abort();return}
  signal?.addEventListener("abort",abort,{once:true});
  timer=setTimeout(()=>fail(new Error("MCP stdio request timed out after "+timeoutMs+"ms")),timeoutMs);
  const request=(method,params,expectsResponse=true)=>new Promise((res,rej)=>{
   if(settled)return rej(new Error("MCP request is no longer active"));
   const id=++seq,message={jsonrpc:"2.0",...(expectsResponse?{id}:{}),method,params:params||{}};
   if(expectsResponse)responses.set(id,{res,rej});
   try{child.stdin.write(JSON.stringify(message)+"\n",error=>{if(error){if(expectsResponse)responses.delete(id);rej(error)}else if(!expectsResponse)res(null)})}
   catch(error){if(expectsResponse)responses.delete(id);rej(error)}
  });
  child.stdout.on("data",d=>{
   buffer+=String(d);let i;
   while((i=buffer.indexOf("\n"))>=0){
    const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;
    try{const msg=JSON.parse(line);if(msg.id!==undefined&&responses.has(msg.id)){const q=responses.get(msg.id);responses.delete(msg.id);msg.error?q.rej(new Error(msg.error.message||"MCP error")):q.res(msg.result)}}catch{}
   }
  });
  child.stderr.on("data",()=>{});
  child.on("error",fail);
  child.on("close",(code,signalName)=>{if(!settled)fail(new Error("MCP stdio process exited before completing requests (code="+code+", signal="+signalName+")"))});
  (async()=>{try{
   await request("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"Saeed AI",version:"4.2"}});
   if(signal?.aborted)throw new Error("MCP request cancelled");
   await request("notifications/initialized",{},false);
   let out=null;
   for(const item of requests){if(signal?.aborted)throw new Error("MCP request cancelled");out=await request(item.method,item.params)}
   succeed(out);
  }catch(error){fail(error)}})();
 });
}
function parseMcpPayload(text){
 const raw=String(text||"").trim();
 if(!raw)return null;
 const blocks=raw.split(/\r?\n\r?\n/);
 for(const block of blocks){
  const data=block.split(/\r?\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).replace(/^ /,"")).join("\n");
  const candidate=data||block.trim();
  if(!candidate||candidate.startsWith(":"))continue;
  let message;try{message=JSON.parse(candidate)}catch{continue}
  if(message?.error)throw new Error(message.error.message||"MCP error");
  if(message&&Object.prototype.hasOwnProperty.call(message,"result"))return message.result;
 }
 return null;
}
async function rpcHttp(server,method,params={},options={}){
 const externalSignal=options.signal||null,timeoutMs=Math.max(1000,Number(options.timeoutMs)||30000),controller=new AbortController();
 const abort=()=>controller.abort(externalSignal?.reason instanceof Error?externalSignal.reason:new Error("MCP request cancelled"));
 if(externalSignal?.aborted)abort();else externalSignal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new Error("MCP HTTP request timed out after "+timeoutMs+"ms")),timeoutMs),signal=controller.signal;
 try{
  const headers={"Content-Type":"application/json","Accept":"application/json, text/event-stream",...(server.headers||{})};
  const post=async(body,extra={})=>{
   if(signal.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
   const response=await fetch(server.url,{method:"POST",headers:{...headers,...extra},body:JSON.stringify(body),redirect:"error",signal});
   if(response.status===202)return{status:202,headers:response.headers,text:async()=>""};
   if(!response.ok)throw new Error("MCP HTTP "+response.status);
   return response;
  };
  const parse=async response=>{
   if(response.status===202)return null;
   const text=await response.text();
   const result=parseMcpPayload(text);
   if(result===null&&text.trim())throw new Error("MCP server returned an unrecognized JSON-RPC response");
   return result;
  };
  let id=Date.now(),session="",protocolVersion="2025-11-25";
  const initResponse=await post({jsonrpc:"2.0",id:++id,method:"initialize",params:{protocolVersion,capabilities:{},clientInfo:{name:"Saeed AI",version:"4.4"}}});
  session=initResponse.headers.get("mcp-session-id")||"";
  const init=await parse(initResponse);
  if(!init||typeof init!=="object"||!init.protocolVersion)throw new Error("MCP initialize response is missing protocolVersion");
  protocolVersion=String(init.protocolVersion);
  const sessionHeaders={...(session?{"MCP-Session-Id":session}:{}),"MCP-Protocol-Version":protocolVersion};
  const initialized=await post({jsonrpc:"2.0",method:"notifications/initialized",params:{}},sessionHeaders);
  if(initialized.status!==202&&initialized.status!==204){try{await initialized.text()}catch{}}
  if(signal.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
  return await parse(await post({jsonrpc:"2.0",id:++id,method,params},sessionHeaders));
 }finally{clearTimeout(timer);externalSignal?.removeEventListener("abort",abort)}
}
async function rpcSse(server,method,params={},options={}){
 const externalSignal=options.signal||null,timeoutMs=Math.max(1000,Number(options.timeoutMs)||30000),controller=new AbortController();
 const abort=()=>controller.abort(externalSignal?.reason instanceof Error?externalSignal.reason:new Error("MCP request cancelled"));
 if(externalSignal?.aborted)abort();else externalSignal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new Error("MCP SSE request timed out after "+timeoutMs+"ms")),timeoutMs),signal=controller.signal;
 let reader=null,postEndpoint=null,endpointResolve,endpointReject,streamFailure,streamDone=false;
 const endpointReady=new Promise((resolve,reject)=>{endpointResolve=resolve;endpointReject=reject});
 const pending=new Map();
 const failAll=error=>{if(streamDone)return;streamDone=true;endpointReject?.(error);for(const item of pending.values())item.reject(error);pending.clear()};
 try{
  const response=await fetch(server.url,{method:"GET",headers:{Accept:"text/event-stream",...(server.headers||{})},redirect:"error",signal});
  if(!response.ok)throw new Error("MCP SSE HTTP "+response.status);
  if(!/text\/event-stream/i.test(response.headers.get("content-type")||""))throw new Error("MCP SSE endpoint did not return text/event-stream");
  if(!response.body?.getReader)throw new Error("MCP SSE streaming is not supported by this runtime");
  reader=response.body.getReader();
  const decoder=new TextDecoder();
  (async()=>{
   let buffer="",eventName="message",data=[];
   try{
    while(!signal.aborted){
     const part=await reader.read();if(part.done)break;
     buffer+=decoder.decode(part.value,{stream:true});
     let newline;
     while((newline=buffer.indexOf("\n"))>=0){
      let line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(line.endsWith("\r"))line=line.slice(0,-1);
      if(!line){const payload=data.join("\n");if(eventName==="endpoint"&&payload){postEndpoint=new URL(payload,server.url).toString();const endpointUrl=new URL(postEndpoint),serverUrl=new URL(server.url);if(endpointUrl.origin!==serverUrl.origin||endpointUrl.protocol!=="https:")throw new Error("MCP SSE endpoint must use the configured HTTPS origin");endpointResolve(postEndpoint)}else if(payload){try{const message=JSON.parse(payload);if(message.id!==undefined&&pending.has(String(message.id))){const waiter=pending.get(String(message.id));pending.delete(String(message.id));if(message.error)waiter.reject(new Error(message.error.message||"MCP error"));else waiter.resolve(message.result)}}catch{}}eventName="message";data=[];continue}
      if(line.startsWith(":"))continue;
      const colon=line.indexOf(":"),field=colon<0?line:line.slice(0,colon),value=colon<0?"":line.slice(colon+1).replace(/^ /,"");
      if(field==="event")eventName=value;else if(field==="data")data.push(value);
     }
    }
    if(!signal.aborted)failAll(new Error("MCP SSE stream closed before the response arrived"));
   }catch(error){failAll(error)}
  })();
  const endpoint=await endpointReady;
  const post=async(body)=>{
   if(signal.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
   const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream",...(server.headers||{})},body:JSON.stringify(body),redirect:"error",signal});
   if(!r.ok&&r.status!==202)throw new Error("MCP SSE POST HTTP "+r.status);
   try{await r.body?.cancel?.()}catch{}
  };
  let id=Date.now();
  const request=async(rpcMethod,rpcParams={},expectsResponse=true)=>{
   const requestId=++id;
   const result=expectsResponse?new Promise((resolve,reject)=>pending.set(String(requestId),{resolve,reject})):Promise.resolve(null);
   try{await post({jsonrpc:"2.0",...(expectsResponse?{id:requestId}:{}),method:rpcMethod,params:rpcParams})}catch(error){pending.delete(String(requestId));throw error}
   return await result;
  };
  const initialized=await request("initialize",{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"Saeed AI",version:"4.4"}});
  if(!initialized||!initialized.protocolVersion)throw new Error("MCP SSE initialize response is missing protocolVersion");
  await request("notifications/initialized",{},false);
  if(signal.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));
  return await request(method,params,true);
 }finally{
  clearTimeout(timer);externalSignal?.removeEventListener("abort",abort);
  try{await reader?.cancel()}catch{}
  try{controller.abort()}catch{}
  if(!streamDone)failAll(new Error("MCP SSE request ended"));
 }
}
function getEnabledServer(userData,id){
 const server=listServers(userData).find(item=>item.id===String(id));
 if(!server||server.enabled===false)throw new Error("MCP server not available: "+id);
 return server;
}
async function requestServer(userData,id,method,params={},options={}){
 const server=getEnabledServer(userData,id);
 if(server.transport==="stdio")return rpcStdio(server,[{method,params}],options);
 if(server.transport==="sse")return rpcSse(server,method,params,options);
 return rpcHttp(server,method,params,options);
}
async function listTools(userData,id,options={}){return requestServer(userData,id,"tools/list",{},options)}
async function listResources(userData,id,options={}){return requestServer(userData,id,"resources/list",{},options)}
async function readResource(userData,id,uri,options={}){
 const value=String(uri||"").trim();if(!value||value.length>4096)throw new Error("A valid MCP resource URI is required");
 return requestServer(userData,id,"resources/read",{uri:value},options);
}
async function listPrompts(userData,id,options={}){return requestServer(userData,id,"prompts/list",{},options)}
async function getPrompt(userData,id,name,args={},options={}){
 const value=String(name||"").trim();if(!value||value.length>256)throw new Error("A valid MCP prompt name is required");
 return requestServer(userData,id,"prompts/get",{name:value,arguments:args&&typeof args==="object"&&!Array.isArray(args)?args:{}},options);
}
async function callTool(userData,id,name,args={},confirm=async()=>false,options={}){const s=listServers(userData).find(x=>x.id===String(id));if(!s||s.enabled===false)throw new Error("MCP server not available: "+id);const signal=options.signal||null;if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));const allowed=s.permissions?.tools;if(Array.isArray(allowed)&&!allowed.includes(name))throw new Error("MCP tool is not permitted: "+name);if(s.permissions?.alwaysAsk&&!await confirm("mcp",{name:"mcp_call_tool",args:{server:id,tool:name,arguments:args},signal}))throw new Error("MCP tool permission denied");if(signal?.aborted)throw(signal.reason instanceof Error?signal.reason:new Error("MCP request cancelled"));const p={name,arguments:args};return s.transport==="stdio"?rpcStdio(s,[{method:"tools/call",params:p}],options):s.transport==="sse"?rpcSse(s,"tools/call",p,options):rpcHttp(s,"tools/call",p,options)}
module.exports={file,addServer,removeServer,listServers,describeServers,listTools,listResources,readResource,listPrompts,getPrompt,callTool};