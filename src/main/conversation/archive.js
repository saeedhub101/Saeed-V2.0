"use strict";
const MAX_ARCHIVE_BYTES=10*1024*1024,MAX_CONVERSATIONS=1000,MAX_MESSAGES_PER_CONVERSATION=200,MAX_MESSAGE_LENGTH=50000,ROLES=new Set(["user","assistant"]);
function fail(message){throw new Error("Invalid conversation archive: "+message)}
function normalizeDate(value,fallback){const d=new Date(value);return Number.isNaN(d.getTime())?fallback:d.toISOString()}
function validateArchive(input){
 let parsed=input;
 if(typeof input==="string"){if(Buffer.byteLength(input,"utf8")>MAX_ARCHIVE_BYTES)fail("file exceeds the 10 MB limit");try{parsed=JSON.parse(input)}catch{fail("file is not valid JSON")}}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))fail("root must be an object");
 if(parsed.format!=="saeed-conversations"||parsed.version!==1)fail("unsupported format or version");
 if(!Array.isArray(parsed.conversations))fail("conversations must be an array");
 if(parsed.conversations.length>MAX_CONVERSATIONS)fail("too many conversations");
 const now=new Date().toISOString(),seen=new Set(),conversations=[];
 for(let i=0;i<parsed.conversations.length;i++){
  const item=parsed.conversations[i];if(!item||typeof item!=="object"||Array.isArray(item))fail("conversation "+i+" must be an object");
  if(typeof item.title!=="string"||!item.title.trim()||item.title.length>160)fail("conversation "+i+" has an invalid title");const title=item.title.trim();
  if(!Array.isArray(item.messages)||item.messages.length>MAX_MESSAGES_PER_CONVERSATION)fail("conversation "+i+" has an invalid message list");
  const messages=item.messages.map((message,j)=>{if(!message||typeof message!=="object"||Array.isArray(message)||!ROLES.has(message.role))fail("message "+i+":"+j+" has an unsupported role");if(typeof message.content!=="string"||message.content.length>MAX_MESSAGE_LENGTH)fail("message "+i+":"+j+" has invalid content");return{role:message.role,content:message.content}});
  const sourceId=String(item.id||"").slice(0,120);if(sourceId&&seen.has(sourceId))fail("duplicate conversation id");if(sourceId)seen.add(sourceId);
  conversations.push({id:sourceId,title,createdAt:normalizeDate(item.createdAt,now),updatedAt:normalizeDate(item.updatedAt,now),messages});
 }
 const result={format:"saeed-conversations",version:1,exportedAt:normalizeDate(parsed.exportedAt,now),conversations};
 if(Buffer.byteLength(JSON.stringify(result),"utf8")>MAX_ARCHIVE_BYTES)fail("normalized archive exceeds the 10 MB limit");
 return result;
}
function createArchive(conversations){
 const safe=(Array.isArray(conversations)?conversations:[]).map(chat=>({id:String(chat?.id||"").slice(0,120),title:String(chat?.title||"New Chat").slice(0,160),createdAt:chat?.createdAt,updatedAt:chat?.updatedAt,messages:(Array.isArray(chat?.messages)?chat.messages:[]).slice(-MAX_MESSAGES_PER_CONVERSATION).filter(m=>m&&ROLES.has(m.role)&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,MAX_MESSAGE_LENGTH)}))}));
 return validateArchive({format:"saeed-conversations",version:1,exportedAt:new Date().toISOString(),conversations:safe});
}
module.exports={MAX_ARCHIVE_BYTES,MAX_CONVERSATIONS,MAX_MESSAGES_PER_CONVERSATION,MAX_MESSAGE_LENGTH,createArchive,validateArchive};
