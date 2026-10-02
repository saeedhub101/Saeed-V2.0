const fs=require("fs"),path=require("path"),{safeStorage,app}=require("electron"),{BrainLevelRouter}=require("./brain-levels");

class Agent{
 constructor({registry,onEvent,requestStepIncrease}){
  this.registry=registry;this.onEvent=onEvent;this.requestStepIncrease=requestStepIncrease|| (async()=>false);this.taskContext=null;this.disposed=false;this.brainLevels=new BrainLevelRouter({settings:()=>this.settings,getLocalBrain:()=>this.localBrain});this.dir=app.getPath("userData");
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
 beginTask(context={}){this.registry?.beginTask?.();this.taskContext={...context,startedAt:new Date().toISOString()};this.disposed=false;this.onEvent({type:"task:agent-start",taskId:context.id||null,route:context.route||null})}
 endTask(){const id=this.taskContext?.id||null;this.onEvent({type:"task:agent-end",taskId:id});this.taskContext=null;this.disposed=true}
 executionHints(text){return this.registry?.rankForTask?this.registry.rankForTask(String(text||"")):[]}

 async askForMoreSteps(current,task){
  const increment=Math.max(8,Math.ceil(current*0.5));const requested=Math.min(100,current+increment);
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