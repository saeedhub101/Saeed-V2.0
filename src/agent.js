const fs=require("fs"),path=require("path"),{app}=require("electron"),{AgentRouter}=require("./core/brain/agent-router"),addonRuntime=require("./addons/runtime"),learning=require("./learning"),{createSettingsStore}=require("./core/services/settings-store");

class Agent{
 constructor({registry,onEvent,requestStepIncrease}){
  this.registry=registry;this.onEvent=onEvent;this.memoryService=require("./core/services/memory-service");this.requestStepIncrease=requestStepIncrease|| (async()=>false);this.apiBrain=new (require("./core/brain/api-brain").ApiBrain)();this.dir=app.getPath("userData");
  this.router=new AgentRouter({getSettings:()=>this.settings,getLocalBrain:()=>this.localBrain,getSkills:()=>learning.list(this.dir),getCapabilities:()=>this.registry?.schemas?.().map(x=>x?.function?.name).filter(Boolean)||[],onEvent:e=>this.onEvent(e),getRegistry:()=>this.registry,getApiBrain:()=>this.apiBrain,getDir:()=>this.dir});
  this.settingsStore=createSettingsStore(this.dir);
  this.file=this.settingsStore.file;
  this.historyFile=path.join(this.dir,"conversation.json");
  this.chatsFile=path.join(this.dir,"conversations.json");
  this.memoryFile=path.join(this.dir,"global-memory.json");
  fs.mkdirSync(this.dir,{recursive:true});
  this._settings=this.settingsStore.load();
  const legacy=this.readJson(this.historyFile,[]);
  const stored=this.readJson(this.chatsFile,{conversations:[]});
  this.conversations=Array.isArray(stored?.conversations)?stored.conversations:[];
  this.conversations=this.conversations.filter(x=>Array.isArray(x?.messages)&&x.messages.length>0||x?.title!=="New Chat");
  if(!this.conversations.length&&Array.isArray(legacy)&&legacy.length){
   this.conversations=[{id:this.newId(),title:"Previous conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:legacy.slice(-200)}];
   this.saveConversations();
  }
  this.globalMemory={facts:this.memoryService.migrateLegacyFacts(this.dir,this.memoryFile)};
  this.currentConversationId=null;
  this.history=[];
  this.newConversation();
 }
 readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
 baseStepLimit(){return Math.max(1,Math.min(100,Number(this.settings?.maxSteps)||16))}
 async askForMoreSteps(current,task){
  const requested=current+12;
  this.onEvent({type:"step-limit-request",currentLimit:current,requestedLimit:requested,task:String(task||"")});
  try{return Boolean(await this.requestStepIncrease({current,requested,task:String(task||"")}))?requested:current}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT STEP LIMIT",message:e.message});return current}
 }
 providerDefaults(name){return this.settingsStore.providerDefaults(name)}
 publicSettings(){return this.settingsStore.public(this._settings)}
 set settings(v){this._settings=this.settingsStore.apply(this._settings,v||{})}
 get settings(){return this._settings}
 persistSettings(){this.settingsStore.persist(this._settings)}
 newId(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
 saveConversations(){try{fs.writeFileSync(this.chatsFile,JSON.stringify({conversations:this.conversations.map(x=>({...x,messages:x.messages.slice(-200)}))},null,2))}catch(e){console.error("Conversations save failed:",e)}}
 saveMemory(){try{this.memoryService.writeFacts(this.dir,this.globalMemory.facts||[])}catch(e){console.error("Memory save failed:",e)}}
 memoryContext(){const facts=this.globalMemory?.facts||[];return facts.length?"\n\nGlobal user memory (stable facts/preferences only; do not treat this as previous chat context):\n"+facts.map(x=>"- "+x.text).join("\n"):""}
 rememberFromUserText(text){
  const s=String(text||"").trim();if(!s)return;
  const patterns=[/\bmy name is\s+(.{1,80})/i,/\bi live in\s+(.{1,80})/i,/\bi am from\s+(.{1,80})/i,/\bi prefer\s+(.{1,120})/i,/\bremember that\s+(.{1,180})/i,/\bplease remember\s+(.{1,180})/i,/تذكر(?:\s+أن)?\s+(.{1,180})/i,/احفظ(?:\s+أن)?\s+(.{1,180})/i,/أفضل\s+(.{1,120})/i,/اسمي\s+(.{1,80})/i,/أعيش في\s+(.{1,80})/i];
  for(const re of patterns){const m=s.match(re);if(!m)continue;const fact=String(m[1]||"").trim().replace(/[.!؟]+$/,"");if(!fact)continue;const key=fact.toLowerCase().replace(/\s+/g," ").slice(0,180);this.memoryService.addFact(this.dir,fact);this.globalMemory.facts=this.memoryService.listFacts(this.dir);break}
 }
 saveHistory(){
  const chat=this.conversations.find(x=>x.id===this.currentConversationId);
  if(chat){chat.messages=this.history.slice(-200);chat.updatedAt=new Date().toISOString();if(!chat.title||chat.title==="New Chat"){const first=this.history.find(x=>x.role==="user"&&typeof x.content==="string");if(first)chat.title=first.content.trim().slice(0,48)||"New Chat"}this.saveConversations()}
  try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-200),null,2))}catch(e){console.error("History save failed:",e)}
 }
 clearHistory(){this.history=[];const chat=this.conversations.find(x=>x.id===this.currentConversationId);if(chat){chat.messages=[];chat.title="New Chat";chat.updatedAt=new Date().toISOString();this.saveConversations()}try{fs.writeFileSync(this.historyFile,"[]")}catch(e){console.error("History clear failed:",e)}}
 newConversation(){const now=new Date().toISOString(),chat={id:this.newId(),title:"New Chat",createdAt:now,updatedAt:now,messages:[]};this.conversations.unshift(chat);this.currentConversationId=chat.id;this.history=[];this.saveConversations();return this.chatMeta(chat)}
 selectConversation(id){const chat=this.conversations.find(x=>x.id===String(id));if(!chat)return null;this.currentConversationId=chat.id;this.history=Array.isArray(chat.messages)?chat.messages.slice(-200):[];this.saveHistory();return this.chatMeta(chat)}
 chatMeta(chat){return{id:chat.id,title:chat.title||"New Chat",createdAt:chat.createdAt,updatedAt:chat.updatedAt,messageCount:Array.isArray(chat.messages)?chat.messages.length:0}}
 listConversations(){return this.conversations.map(x=>this.chatMeta(x))}
 getCurrentConversation(){const x=this.conversations.find(c=>c.id===this.currentConversationId);return x?this.chatMeta(x):null}
 getGlobalMemory(){return this.memoryService.listFacts(this.dir)}

 async run(text,image=null){
  this.router.history=this.history;
  this.router.memoryContext=()=>this.memoryContext();
  this.router.saveHistory=()=>this.saveHistory();
  this.router.baseStepLimit=()=>this.baseStepLimit();
  this.router.askForMoreSteps=(current,task)=>this.askForMoreSteps(current,task);
  this.router.providerDefaults=name=>this.providerDefaults(name);
  const result=await this.router.run({text,image});
  if(result?.event)this.onEvent(result.event);
  if(result?.handled){
   const answer=String(result.answer||"");
   this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});
   this.saveHistory();
   this.onEvent({type:"answer",text:answer,source:result.source});
   return answer;
  }
  return result?.answer||"";
}
}
module.exports={Agent};
// Build validation marker: latest Agent fixes.
