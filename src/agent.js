const fs=require("fs"),path=require("path"),{safeStorage,app}=require("electron"),{BrainLevelRouter}=require("./brain-levels"),addonRuntime=require("./addons/runtime"),learning=require("./learning");

class Agent{
 constructor({registry,onEvent,requestStepIncrease}){
  this.registry=registry;this.onEvent=onEvent;this.requestStepIncrease=requestStepIncrease|| (async()=>false);this.brainLevels=new BrainLevelRouter({settings:()=>this.settings,getLocalBrain:()=>this.localBrain,getSkills:()=>learning.list(this.dir),getCapabilities:()=>this.registry.schemas().map(x=>x?.function?.name).filter(Boolean)});this.dir=app.getPath("userData");
  this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");this.chatsFile=path.join(this.dir,"conversations.json");this.memoryFile=path.join(this.dir,"global-memory.json");
  fs.mkdirSync(this.dir,{recursive:true});
  const raw=this.readJson(this.file,{provider:"openai",baseUrl:"https://api.openai.com/v1",model:"gpt-5",apiKey:"",maxSteps:16,micMode:"off",brainMode:"auto",sttProvider:"whisper",sttModel:"base-q5_1",sttLanguage:"auto",streamingMode:"off",voiceControlVersion:3,ttsProvider:"local",ttsModel:"gpt-4o-mini-tts",ttsVoice:"alloy",voiceProfile:"saeed",showSpeechText:false,language:"en",permissions:{files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow"},realtimeProvider:"openai",realtimeModel:"gpt-realtime-2.1",realtimeVoice:"marin",realtimeEnabled:true,voiceRouting:"controller",micPath:"realtime",voiceMuted:false,characterSize:"small"});
  this._settings={...raw,permissions:{files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow",...(raw.permissions||{})},

   micMode:"off",
   brainMode:String(raw.brainMode||"auto"),
   streamingMode:"off",
   voiceControlVersion:3,
   ...(Number(raw.voiceControlVersion||0)<2?{}:{}),
   apiKey:this.decryptKey(raw.apiKey),
   sttApiKey:this.decryptKey(raw.sttApiKey),
   ttsApiKey:this.decryptKey(raw.ttsApiKey),
   realtimeApiKey:this.decryptKey(raw.realtimeApiKey)
  };
  const legacy=this.readJson(this.historyFile,[]);
  const stored=this.readJson(this.chatsFile,{conversations:[]});
  this.conversations=Array.isArray(stored?.conversations)?stored.conversations:[];
  this.conversations=this.conversations.filter(x=>Array.isArray(x?.messages)&&x.messages.length>0||x?.title!=="New Chat");
  if(!this.conversations.length&&Array.isArray(legacy)&&legacy.length){
   this.conversations=[{id:this.newId(),title:"Previous conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:legacy.slice(-200)}];
   this.saveConversations();
  }
  this.globalMemory=this.readJson(this.memoryFile,{facts:[]});
  if(!Array.isArray(this.globalMemory.facts))this.globalMemory={facts:[]};
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
 providerDefaults(name){
  return {
   openai:{baseUrl:"https://api.openai.com/v1",model:"gpt-5"},
   anthropic:{baseUrl:"https://api.anthropic.com/v1",model:"claude-sonnet-4-5"},
   gemini:{baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai",model:"gemini-2.5-pro"},
   groq:{baseUrl:"https://api.groq.com/openai/v1",model:"openai/gpt-oss-120b"},
   "openai-compatible":{baseUrl:"",model:""}
  }[name]||{};
 }
 encryptKey(key){try{return key&&safeStorage.isEncryptionAvailable()?safeStorage.encryptString(String(key)).toString("base64"):String(key||"")}catch{return String(key||"")}}
 decryptKey(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 publicSettings(){const out={...this._settings};delete out.alwaysListening;return{...out,apiKey:"",sttApiKey:"",ttsApiKey:"",realtimeApiKey:"",
   hasApiKey:Boolean(this._settings.apiKey),hasSttApiKey:Boolean(this._settings.sttApiKey),
   hasTtsApiKey:Boolean(this._settings.ttsApiKey),hasRealtimeApiKey:Boolean(this._settings.realtimeApiKey)}}
 set settings(v){
  const previous=this._settings||{},input=v||{},providerChanged=input.provider&&input.provider!==previous.provider;
  this._settings={...previous,...input,permissions:{...previous.permissions,...(input.permissions||{})},brainMode:["api","local","auto"].includes(String(input.brainMode||""))?String(input.brainMode):String(previous.brainMode||"auto")};
  this._settings.maxSteps=Math.max(1,Math.min(100,Number(this._settings.maxSteps)||16));
  if(this._settings.micMode==="always"||this._settings.micMode==="ptt")this._settings.micMode="on";
  if(this._settings.micMode!=="on")this._settings.micMode="off";
  delete this._settings.alwaysListening;
  if(input.clearLlmKey){this._settings.apiKey="";delete this._settings.clearLlmKey}
  if(input.clearAllApiKeys){this._settings.apiKey="";this._settings.sttApiKey="";this._settings.ttsApiKey="";this._settings.realtimeApiKey="";delete this._settings.clearAllApiKeys}
  if(input.apiKey==="")this._settings.apiKey=previous.apiKey||"";
  if(input.sttApiKey==="")this._settings.sttApiKey=previous.sttApiKey||"";
  if(input.ttsApiKey==="")this._settings.ttsApiKey=previous.ttsApiKey||"";
  if(input.realtimeApiKey==="")this._settings.realtimeApiKey=previous.realtimeApiKey||"";
  const p=this.providerDefaults(this._settings.provider);
  if(providerChanged){
   if(input.baseUrl===undefined||input.baseUrl===previous.baseUrl)this._settings.baseUrl=p.baseUrl;
   if(input.model===undefined||input.model===previous.model)this._settings.model=p.model;
  }
  if(!this._settings.baseUrl)this._settings.baseUrl=p.baseUrl;
  if(!this._settings.model)this._settings.model=p.model;
  this.persistSettings();
 }
 get settings(){return this._settings}
 persistSettings(){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({...this._settings,
   apiKey:this.encryptKey(this._settings.apiKey),
   sttApiKey:this.encryptKey(this._settings.sttApiKey),
   ttsApiKey:this.encryptKey(this._settings.ttsApiKey),
   realtimeApiKey:this.encryptKey(this._settings.realtimeApiKey)
  },null,2))}catch(e){console.error("Settings save failed:",e)}}
 newId(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
 saveConversations(){try{fs.writeFileSync(this.chatsFile,JSON.stringify({conversations:this.conversations.map(x=>({...x,messages:x.messages.slice(-200)}))},null,2))}catch(e){console.error("Conversations save failed:",e)}}
 saveMemory(){try{fs.writeFileSync(this.memoryFile,JSON.stringify(this.globalMemory,null,2))}catch(e){console.error("Global memory save failed:",e)}}
 memoryContext(){const facts=this.globalMemory?.facts||[];return facts.length?"\n\nGlobal user memory (stable facts/preferences only; do not treat this as previous chat context):\n"+facts.map(x=>"- "+x.text).join("\n"):""}
 rememberFromUserText(text){
  const s=String(text||"").trim();if(!s)return;
  const patterns=[/\bmy name is\s+(.{1,80})/i,/\bi live in\s+(.{1,80})/i,/\bi am from\s+(.{1,80})/i,/\bi prefer\s+(.{1,120})/i,/\bremember that\s+(.{1,180})/i,/\bplease remember\s+(.{1,180})/i,/تذكر(?:\s+أن)?\s+(.{1,180})/i,/احفظ(?:\s+أن)?\s+(.{1,180})/i,/أفضل\s+(.{1,120})/i,/اسمي\s+(.{1,80})/i,/أعيش في\s+(.{1,80})/i];
  for(const re of patterns){const m=s.match(re);if(!m)continue;const fact=String(m[1]||"").trim().replace(/[.!؟]+$/,"");if(!fact)continue;const key=fact.toLowerCase().replace(/\s+/g," ").slice(0,180);const existing=this.globalMemory.facts.find(x=>x.key===key);if(existing){existing.text=fact;existing.updatedAt=new Date().toISOString()}else this.globalMemory.facts.push({key,text:fact,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});if(this.globalMemory.facts.length>100)this.globalMemory.facts=this.globalMemory.facts.slice(-100);this.saveMemory();break}
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
 getGlobalMemory(){return this.globalMemory.facts||[]}

 async run(text,image=null){
  const s=this.settings;this.rememberFromUserText(text);if(!String(text).trim())return "اكتب لي المهمة التي تريد تنفيذها.";this.onEvent({type:"diagnostic",level:"INFO",stage:"LLM REQUEST START",message:"LLM request started"});
  const learned=learning.match(this.dir,text);if(learned){try{const result=await learning.run(this.dir,this.registry,learned);const answer="Done — I followed the learned skill: "+learned.name+".";this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"learned-skill",skill:learned.id,name:learned.name,result});this.onEvent({type:"answer",text:answer,source:"learned-skill"});return answer}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"LEARNED SKILL",message:e.message,meta:{skill:learned.id}});}}
  const mode=String(s.brainMode||"auto");

  // Computer-information intents are information requests, never application names.
  const directComputerInfo=String(text||"").trim().replace(/[.?!؟،]+$/,"").trim();
  if(/^(?:please\s+)?(?:give\s+me\s+|show\s+me\s+|tell\s+me\s+)?(?:my\s+)?(?:computer|pc|system)\s+(?:info|information|specs|specifications)$/i.test(directComputerInfo)){
   try{
    const out=await this.registry.call("system_info",{});
    const answer=out?.ok===false?"I could not complete that: "+out.error:"Windows system information: "+String(out?.arch||"unknown")+", "+String(out?.cpu||"unknown")+" CPU threads, "+(Number(out?.totalMemory||0)/1073741824).toFixed(1)+" GB RAM.";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();
    this.onEvent({type:"answer",text:answer,source:"local-direct-system-info"});return answer;
   }catch(e){const answer="I could not complete that: "+e.message;this.onEvent({type:"answer",text:answer,source:"local-direct-system-info"});return answer;}
  }

  // Core Windows launch intents must never be routed through vision/OCR.
  // This is intentionally handled before learned skills and every LLM provider.
  const directOpenComputer=String(text||"").trim().replace(/[.?!؟،]+$/,"").trim();
  if(/^(?:please\s+)?(?:open|launch|start|show|run)\s+(?:my\s+)?(?:computer|this\s+pc|file\s+explorer)$/i.test(directOpenComputer)){
   try{
    const out=await this.registry.call("open_application",{application:"my computer"});
    const answer=out?.ok===false?"I could not complete that: "+out.error:"Opened My Computer.";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();
    this.onEvent({type:"answer",text:answer,source:"local-direct-open"});
    return answer;
   }catch(e){
    const answer="I could not complete that: "+e.message;
    this.onEvent({type:"answer",text:answer,source:"local-direct-open"});
    return answer;
   }
  }

  if(mode==="realtime"){
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN REALTIME",message:"Realtime mode is selected; voice streaming handles the conversation."});
   return "Realtime mode is active. Use the microphone for the live conversation.";
  }
  // Deterministic local intents always get first refusal-free routing, even in Direct API mode.
  // This prevents commands such as "open excel" from being handed to an unrelated tool (for example OCR).
  if(this.localBrain){
   try{
    const brainMem=process.memoryUsage(),brainCpu=process.cpuUsage(),brainStart=Date.now();
    const handled=await this.localBrain.handle(text);
    const brainAfter=process.memoryUsage(),brainCpuAfter=process.cpuUsage(brainCpu);
    this.onEvent({type:"diagnostic",level:"INFO",stage:"RESOURCE LOCAL BRAIN",message:"Local brain resource sample",meta:{elapsedMs:Date.now()-brainStart,cpuUserMs:Math.round(brainCpuAfter.user/1000),cpuSystemMs:Math.round(brainCpuAfter.system/1000),heapDeltaMB:+((brainAfter.heapUsed-brainMem.heapUsed)/1048576).toFixed(2),rssMB:+(brainAfter.rss/1048576).toFixed(1)}});
    if(handled!==null){
     this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL",message:"Offline deterministic intent handled the request"});
     this.history.push({role:"user",content:String(text)},{role:"assistant",content:handled});this.saveHistory();
     this.onEvent({type:"answer",text:handled,source:"local-brain"});return handled;
    }
   }catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message});}
  }
  const nextLevel=await this.brainLevels.classify(text);
  if(nextLevel.name==="learned-skill")this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN SKILL ROUTE",message:"Matched installed learned skill before general routing",meta:{skill:nextLevel.skill,name:nextLevel.skillName}});

  this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LEVEL",message:"Conversation brain selected level "+nextLevel.level+" ("+nextLevel.name+")",meta:nextLevel});
  if(mode==="local"){
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL",message:"Offline computer brain has no handler for this request"});
   const answer="I can handle common Windows computer tasks offline, but this request needs the API brain. Please connect an API key in Settings.";
   this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:"local-fallback"});return answer;
  }
  const {ApiBrain}=require("./core/api-brain");
  return this.apiBrain.run({text,image,settings:s,history:this.history,registry:this.registry,onEvent:this.onEvent,dir:this.dir,route:nextLevel,memoryContext:()=>this.memoryContext(),saveHistory:()=>this.saveHistory(),baseStepLimit:()=>this.baseStepLimit(),askForMoreSteps:(current,task)=>this.askForMoreSteps(current,task),providerDefaults:(name)=>this.providerDefaults(name)});

 }
}
module.exports={Agent};
// Build validation marker: latest Agent fixes.
