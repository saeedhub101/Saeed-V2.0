const {shell}=require("electron");
const dns=require("node:dns").promises;
const net=require("node:net");
const MAX_REDIRECTS=5,MAX_BODY_BYTES=2*1024*1024,REQUEST_TIMEOUT_MS=15000;
function schemas(){return[
 {type:"function",function:{name:"open_url",description:"Open an HTTP/HTTPS URL in the default browser.",parameters:{type:"object",properties:{url:{type:"string",minLength:1,maxLength:4096}},required:["url"],additionalProperties:false}}},
 {type:"function",function:{name:"web_search",description:"Search the web for current information.",parameters:{type:"object",properties:{query:{type:"string",minLength:1,maxLength:2000}},required:["query"],additionalProperties:false}}},
 {type:"function",function:{name:"fetch_web_page",description:"Fetch readable content from a public HTTP/HTTPS web page when its contents are needed.",parameters:{type:"object",properties:{url:{type:"string",minLength:1,maxLength:4096}},required:["url"],additionalProperties:false}}}
]}
function isPublicAddress(address){
 const family=net.isIP(address);if(family===4){
  const p=address.split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [a,b]=p;
  if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===0||b===168)||a===198&&(b===18||b===19||b===51)||a===203&&b===0||a===100&&b>=64&&b<=127)return false;
  if(a===192&&b===0&&p[2]===2||a===198&&b===51&&p[2]===100||a===203&&b===0&&p[2]===113)return false;
  return true;
 }
 if(family===6){
  const value=address.toLowerCase().split("%")[0];
  if(value.startsWith("::ffff:"))return isPublicAddress(value.slice(7));
  // Public global-unicast IPv6 is 2000::/3. This excludes loopback,
  // unspecified, ULA, link-local, multicast and other special-use ranges.
  const first=parseInt(value.split(":")[0]||"0",16);
  return Number.isFinite(first)&&first>=0x2000&&first<=0x3fff;
 }
 return false;
}
async function assertPublicHttpUrl(value){
 let url;try{url=new URL(String(value||""))}catch{throw new Error("Invalid web URL")}
 if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw new Error("Only credential-free HTTP/HTTPS URLs are allowed");
 const host=url.hostname.toLowerCase().replace(/\.$/,"");
 if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))throw new Error("Local and internal network destinations are blocked");
 const family=net.isIP(host);
 if(family){if(!isPublicAddress(host))throw new Error("Private, local, or reserved network destinations are blocked");return url}
 let records;try{records=await dns.lookup(host,{all:true,verbatim:true})}catch{throw new Error("Could not resolve the public web host")}
 if(!records.length||records.some(record=>!isPublicAddress(record.address)))throw new Error("Web host resolves to a private, local, or reserved network address");
 return url;
}
async function readLimitedText(response,maxBytes=MAX_BODY_BYTES){
 const declared=Number(response.headers?.get?.("content-length")||0);
 if(declared>maxBytes){try{await response.body?.cancel?.()}catch{}throw new Error("Web response exceeds the "+maxBytes+" byte limit")}
 if(!response.body?.getReader){const text=await response.text();if(Buffer.byteLength(text,"utf8")>maxBytes)throw new Error("Web response exceeds the "+maxBytes+" byte limit");return text}
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text="";
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error("Web response exceeds the "+maxBytes+" byte limit")}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();return text}catch(error){try{await reader.cancel()}catch{}throw error}
}
async function fetchPublic(value,{signal,timeoutMs=REQUEST_TIMEOUT_MS,maxBytes=MAX_BODY_BYTES,headers={}}={}){
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason||new Error("Web request cancelled"));
 if(signal?.aborted)abort();else signal?.addEventListener?.("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new Error("Web request timed out")),timeoutMs);
 try{
  let url=await assertPublicHttpUrl(value);
  for(let hop=0;hop<=MAX_REDIRECTS;hop++){
   if(controller.signal.aborted)throw new Error("Web request cancelled or timed out");
   const response=await fetch(url,{headers:{"User-Agent":"SaeedAI/1.0","Accept":"text/html,text/plain,application/xhtml+xml,*/*;q=0.5",...headers},redirect:"manual",signal:controller.signal});
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get("location");try{await response.body?.cancel?.()}catch{}
    if(!location)throw new Error("Web redirect did not provide a destination");
    if(hop===MAX_REDIRECTS)throw new Error("Web page exceeded the redirect limit");
    url=await assertPublicHttpUrl(new URL(location,url).toString());continue;
   }
   if(!response.ok)throw new Error("HTTP "+response.status);
   return{url:url.toString(),status:response.status,contentType:response.headers.get("content-type")||"",text:await readLimitedText(response,maxBytes)};
  }
  throw new Error("Web page exceeded the redirect limit");
 }finally{clearTimeout(timer);signal?.removeEventListener?.("abort",abort)}
}
function readableText(html){return String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim().slice(0,200000)}
async function call(name,a={},c={}){
 if(typeof c.isCurrent==="function"&&!c.isCurrent())return{ok:false,stale:true,error:"Stale web request cancelled"};
 if(name==="open_url"){let url;try{url=new URL(String(a.url||""))}catch{return{ok:false,error:"Invalid URL"}}if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return{ok:false,error:"Only credential-free HTTP/HTTPS URLs are allowed"};await shell.openExternal(url.toString());return{ok:true,url:url.toString()}}
 if(name==="web_search"){
  const query=String(a.query||"").trim();if(!query)return{ok:false,error:"Search query is empty"};
  const response=await fetchPublic("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query),{signal:c.signal,maxBytes:MAX_BODY_BYTES});
  if(typeof c.isCurrent==="function"&&!c.isCurrent())return{ok:false,stale:true,error:"Stale web request cancelled"};
  const results=[...response.text.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0,8).map(match=>({url:match[1],title:match[2].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").trim()}));
  return{ok:true,results};
 }
 if(name==="fetch_web_page"){
  const response=await fetchPublic(a.url,{signal:c.signal,maxBytes:MAX_BODY_BYTES});
  if(typeof c.isCurrent==="function"&&!c.isCurrent())return{ok:false,stale:true,error:"Stale web request cancelled"};
  return{ok:true,url:response.url,text:readableText(response.text)};
 }
 return null;
}
module.exports={schemas,call,isPublicAddress,assertPublicHttpUrl,fetchPublic,readableText};
