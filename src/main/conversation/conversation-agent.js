const fs=require("fs"),path=require("path"),{app}=require("electron");
const {Brain}=require("../brain/brain"),{createSettingsStore}=require("../services/settings-store");
const conversationArchive=require("./archive");
class ConversationAgent{
 constructor({registry,onEvent,requestStepIncrease}){
    this.registry=registry;this.onEvent=onEvent||(()=>{});this.requestGeneration=0;this.memoryService=null;this.getMemoryService=()=>this.memoryService||(this.memoryService=require("../services/memory-service"));this.requestStepIncrease=requestStepIncrease|| (async()=>false);this.dir=app.getPath("userData");this.settingsStore=createSettingsStore(this.dir);this.file=this.settingsStore.file;this.historyFile=path.join(this.dir,"conversation.json");this.chatsFile=path.join(this.dir,"conversations.json");this.memoryFile=path.join(this.dir,"global-memory.json");fs.mkdirSync(this.dir,{recursive:true});this._settings=this.settingsStore.load();this.loadConversations();this.globalMemory={facts:[]};this.currentConversationId=this.currentConversationId||null;this.history=[];if(this.currentConversationId)this.ensureConversationState();else this.newConversation();this.brain=new Brain({registry,getSettings:()=>this.settings,memoryContext:()=>this.memoryContext(),saveHistory:()=>this.saveHistory(),baseStepLimit:()=>this.baseStepLimit(),getDir:()=>this.dir,onEvent:e=>this.onEvent(e),requestStepIncrease:o=>this.askForMoreSteps(o.current,o.task),providerDefaults:n=>this.providerDefaults(n)})}
 ensureConversationState(){
  if(!Array.isArray(this.conversations)||!this.conversations.length){this.newConversation();return this.currentConversationId;}
  const selected=this.conversations.find(x=>x.id===this.currentConversationId);
  if(!selected){this.currentConversationId=this.conversations[0].id;}
  const chat=this.conversations.find(x=>x.id===this.currentConversationId)||this.conversations[0];
  if(chat){this.currentConversationId=chat.id;this.history=Array.isArray(chat.messages)?chat.messages.slice(-200):[];}
  return this.currentConversationId;
 }
 readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
 loadConversations(){const legacy=this.readJson(this.historyFile,[]),stored=this.readJson(this.chatsFile,{conversations:[]});this.conversations=Array.isArray(stored?.conversations)?stored.conversations:[];this.conversations=this.conversations.filter(x=>(Array.isArray(x?.messages)&&x.messages.length>0)||x?.title!=="New Chat");if(!this.conversations.length&&Array.isArray(legacy)&&legacy.length)this.conversations=[{id:this.newId(),title:"Previous conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:legacy.slice(-200)}];const selected=this.conversations.find(x=>x.id===stored?.currentConversationId)||this.conversations[0];this.currentConversationId=selected?.id||null;if(selected)this.history=Array.isArray(selected.messages)?selected.messages.slice(-200):[]}
 baseStepLimit(){return Math.max(1,Math.min(100,Number(this.settings?.maxSteps)||16))}
 async askForMoreSteps(current,task){const requested=current+12;this.onEvent({type:"step-limit-request",currentLimit:current,requestedLimit:requested,task:String(task||"")});if(this.settings?.agentExtraSteps==="allow")return requested;try{return Boolean(await this.requestStepIncrease({current,requested,task:String(task||"")}))?requested:current}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT STEP LIMIT",message:e.message});return current}}
 providerDefaults(name){return this.settingsStore.providerDefaults(name)}publicSettings(){return this.settingsStore.public(this._settings)}set settings(v){this._settings=this.settingsStore.apply(this._settings,v||{})}get settings(){return this._settings}persistSettings(){this.settingsStore.persist(this._settings)}
 newId(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
 writeJsonAtomic(file,value){
  const temp=file+".tmp-"+process.pid+"-"+Date.now();
  try{const serialized=JSON.stringify(value,null,2);fs.writeFileSync(temp,serialized,{encoding:"utf8",flag:"wx"});const staged=JSON.parse(fs.readFileSync(temp,"utf8"));if(!staged||typeof staged!=="object")throw new Error("Persistence read-back validation failed");fs.renameSync(temp,file);const persisted=JSON.parse(fs.readFileSync(file,"utf8"));if(!persisted||typeof persisted!=="object")throw new Error("Persistence verification failed");return true}
  catch(error){try{fs.unlinkSync(temp)}catch{}this.lastPersistenceError=String(error?.message||error);try{this.onEvent?.({type:"diagnostic",level:"ERROR",stage:"CONVERSATION PERSISTENCE",message:"Conversation data could not be written or verified",meta:{file:path.basename(file),error:this.lastPersistenceError}})}catch{}return false}
 }
 saveConversations(){return this.writeJsonAtomic(this.chatsFile,{currentConversationId:this.currentConversationId,conversations:this.conversations.map(x=>({...x,messages:(Array.isArray(x.messages)?x.messages:[]).slice(-200)}))})}
 exportConversationsArchive(){return conversationArchive.createArchive(this.conversations)}
 importConversationsArchive(input){
  const archive=conversationArchive.validateArchive(input),previous=this.conversations.slice(),ids=new Set(this.conversations.map(x=>String(x.id)));
  const imported=archive.conversations.map(item=>{let id=this.newId();while(ids.has(id))id=this.newId();ids.add(id);return{id,title:item.title,createdAt:item.createdAt,updatedAt:item.updatedAt,messages:item.messages.slice(-200)}});
  this.conversations=[...imported,...this.conversations];
  if(!this.saveConversations()){this.conversations=previous;throw new Error("Could not persist imported conversations: "+(this.lastPersistenceError||"unknown storage error"))}
  return{ok:true,imported:imported.length,conversations:this.listConversations()};
 }
 memoryContext(){const memory=this.getMemoryService();if(!this.globalMemory.facts.length)this.globalMemory.facts=memory.migrateLegacyFacts(this.dir,this.memoryFile);const facts=this.globalMemory?.facts||[];return facts.length?"\n\nGlobal user memory (stable facts/preferences only):\n"+facts.map(x=>"- "+x.text).join("\n"):""}
 rememberFromUserText(text){const s=String(text||"").trim();if(!s)return;const patterns=[/\bmy name is\s+(.{1,80})/i,/\bi live in\s+(.{1,80})/i,/\bi am from\s+(.{1,80})/i,/\bi prefer\s+(.{1,120})/i,/\bremember that\s+(.{1,180})/i,/\bplease remember\s+(.{1,180})/i,/تذكر(?:\s+أن)?\s+(.{1,180})/i,/احفظ(?:\s+أن)?\s+(.{1,180})/i,/أفضل\s+(.{1,120})/i,/اسمي\s+(.{1,80})/i,/أعيش في\s+(.{1,80})/i];for(const re of patterns){const m=s.match(re);if(m){const fact=String(m[1]||"").trim().replace(/[.!؟]+$/,"");if(fact){this.getMemoryService().addFact(this.dir,fact);this.globalMemory.facts=this.getMemoryService().listFacts(this.dir)}break}}}
 saveHistory(){const chat=this.conversations.find(x=>x.id===this.currentConversationId);let ok=true;if(chat){chat.messages=this.history.slice(-200);chat.updatedAt=new Date().toISOString();if(!chat.title||chat.title==="New Chat"){const first=this.history.find(x=>x.role==="user"&&typeof x.content==="string");if(first)chat.title=first.content.trim().slice(0,48)||"New Chat"}ok=this.saveConversations()&&ok}ok=this.writeJsonAtomic(this.historyFile,this.history.slice(-200))&&ok;return ok}
 clearHistory(){this.invalidateRequests();this.history=[];const chat=this.conversations.find(x=>x.id===this.currentConversationId);if(chat){chat.messages=[];chat.title="New Chat";chat.updatedAt=new Date().toISOString();this.saveConversations()}try{fs.writeFileSync(this.historyFile,"[]")}catch(e){}}
 invalidateRequests(){this.requestGeneration=(this.requestGeneration||0)+1;return this.requestGeneration}
 newConversation(){this.invalidateRequests();const now=new Date().toISOString(),chat={id:this.newId(),title:"New Chat",createdAt:now,updatedAt:now,messages:[]};this.conversations.unshift(chat);this.currentConversationId=chat.id;this.history=[];this.saveConversations();return this.chatMeta(chat)}
 selectConversation(id){const chat=this.conversations.find(x=>x.id===String(id));if(!chat)return null;this.invalidateRequests();this.currentConversationId=chat.id;this.history=Array.isArray(chat.messages)?chat.messages.slice(-200):[];this.saveHistory();return this.chatMeta(chat)}
 deleteConversation(id){const target=String(id||"");const index=this.conversations.findIndex(x=>x.id===target);if(index<0)return null;const wasCurrent=this.currentConversationId===target;if(wasCurrent)this.invalidateRequests();this.conversations.splice(index,1);if(!this.conversations.length){const chat=this.newConversation();return{chat,history:[],deleted:target}}if(wasCurrent){const next=this.conversations[Math.max(0,index-1)]||this.conversations[0];this.currentConversationId=next.id;this.history=Array.isArray(next.messages)?next.messages.slice(-200):[];this.saveHistory()}else this.saveConversations();return{chat:this.getCurrentConversation(),history:this.history.slice(-200),deleted:target}}
 chatMeta(chat){return{id:chat.id,title:chat.title||"New Chat",createdAt:chat.createdAt,updatedAt:chat.updatedAt,messageCount:Array.isArray(chat.messages)?chat.messages.length:0}}
 listConversations(){return this.conversations.map(x=>this.chatMeta(x))}getCurrentConversation(){const x=this.conversations.find(c=>c.id===this.currentConversationId);return x?this.chatMeta(x):null}getGlobalMemory(){return this.getMemoryService().listFacts(this.dir)}
 async run(text,image=null){
  const requestId=this.invalidateRequests(),conversationId=this.currentConversationId,history=this.history;
  const isCurrent=()=>this.requestGeneration===requestId&&this.currentConversationId===conversationId&&this.history===history;
  const result=await this.brain.run({text,image,history,isCurrent});
  if(!isCurrent()||result?.stale)return "";
  if(result?.event)this.onEvent(result.event);
  if(result?.handled){const answer=String(result.answer||"");this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:result.source});return answer}
  return String(result?.answer||"");
 }
 async runVoice(text,image=null){
  this.ensureConversationState();
  const input=String(text||"").trim();if(!input)return "";
  const requestId=this.invalidateRequests(),conversationId=this.currentConversationId,history=this.history;
  const isCurrent=()=>this.requestGeneration===requestId&&this.currentConversationId===conversationId&&this.history===history;
  const result=await this.brain.run({text:input,image,history,isCurrent});
  if(!isCurrent()||result?.stale)return "";
  if(result?.event)this.onEvent(result.event);
  if(result?.handled){const answer=String(result?.answer||"");this.history.push({role:"user",content:input},{role:"assistant",content:answer});this.saveHistory();return answer}
  return String(result?.answer||"");
 }
 recordConversationExchange(user,assistant){const input=String(user||"").trim(),answer=String(assistant||"").trim();if(!input||!answer)return false;this.invalidateRequests();this.history.push({role:"user",content:input},{role:"assistant",content:answer});this.saveHistory();return true}
 async dispose(){this.invalidateRequests();try{await this.brain?.dispose?.()}catch{}try{await this.registry?.dispose?.()}catch{}this.brain=null;this.registry=null;this.memoryService=null;this.onEvent=()=>{};return true}
}
module.exports={ConversationAgent};