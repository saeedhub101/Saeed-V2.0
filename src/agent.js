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
 beginTask(context={}){this.taskContext={...context,startedAt:new Date().toISOString()};this.disposed=false;this.onEvent({type:"task:agent-start",taskId:context.id||null,route:context.route||null})}
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

 async run(text,image=null,options={}){
  const s=this.settings;this.rememberFromUserText(text);if(!String(text).trim())return "اكتب لي المهمة التي تريد تنفيذها.";this.onEvent({type:"diagnostic",level:"INFO",stage:"LLM REQUEST START",message:"LLM request started"});
  const mode=["api","local","auto"].includes(String(s.brainMode||"auto"))?String(s.brainMode||"auto"):"auto";
  let selectedBrain=options?.brain&&["api","local"].includes(String(options.brain))?String(options.brain):mode;
  if(options?.brain&&["api","local"].includes(String(options.brain))){this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN CONTRACT",message:"TaskEngine selected brain: "+selectedBrain,meta:{selectedBrain,source:"task-engine"}})}
  if(selectedBrain==="auto"){
   const nextLevel=await this.brainLevels.classify(text);
   selectedBrain=nextLevel.name==="api"?"api":"local";
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTER",message:"Auto brain selected "+selectedBrain+" for this request",meta:{mode,selectedBrain,...nextLevel}});
  }else{
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTER",message:"Brain mode selected: "+selectedBrain,meta:{mode,selectedBrain}});
  }
  if(selectedBrain==="local"){
   if(this.localBrain){try{const brainMem=process.memoryUsage();const brainCpu=process.cpuUsage();const brainStart=Date.now();const handled=await this.localBrain.handle(text);const brainAfter=process.memoryUsage();const brainCpuAfter=process.cpuUsage(brainCpu);this.onEvent({type:"diagnostic",level:"INFO",stage:"RESOURCE LOCAL BRAIN",message:"Local brain resource sample",meta:{elapsedMs:Date.now()-brainStart,cpuUserMs:Math.round(brainCpuAfter.user/1000),cpuSystemMs:Math.round(brainCpuAfter.system/1000),heapDeltaMB:+((brainAfter.heapUsed-brainMem.heapUsed)/1048576).toFixed(2),rssMB:+(brainAfter.rss/1048576).toFixed(1)}});if(handled!==null){this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL",message:"Local brain handled the request"});this.history.push({role:"user",content:String(text)},{role:"assistant",content:handled});this.saveHistory();this.onEvent({type:"answer",text:handled,source:"local-brain"});return handled;}}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message});}}
   if(mode==="local"||options?.brain==="local"){
    this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL",message:"Local brain has no handler for this request"});
    const answer="I cannot complete this request with the selected Local brain.";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:"local-no-handler"});return answer;
   }
   selectedBrain="api";
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTER",message:"Local brain could not handle the request; Auto is escalating to API brain",meta:{mode,selectedBrain}});
  }
  if(!s.apiKey&&s.provider!=="ollama"){
   this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT NOT READY",message:"LLM API key is missing"});
   const answer="This request needs the API brain. Please connect an API key in Settings.";
   this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:"api-missing"});return answer;
  }
  this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN API",message:"API brain selected: "+String(s.provider||"openai")+" / "+String(s.model||this.providerDefaults(s.provider).model||"unknown"),meta:{provider:String(s.provider||"openai"),model:String(s.model||this.providerDefaults(s.provider).model||"unknown"),endpoint:String(s.baseUrl||this.providerDefaults(s.provider).baseUrl||"")}});
  const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);
  const toolHints=this.executionHints(text);const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Accomplish the user's actual goal, inspect first when needed, use tools, observe results, verify important actions, recover from failures, and continue until the goal is complete. You can inspect Windows, screen, processes, files and web, and control mouse/keyboard. Prefer native structured document/office tools (inspect_document, extract_pdf_text, read_excel, write_excel) before GUI automation whenever the task involves PDFs, spreadsheets, or document content. Use GUI automation only when a native tool cannot complete the requested action. Never claim success without evidence. Each chat is an independent conversation. Do not infer or continue tasks from other chats. Only use the Global user memory below for stable facts/preferences; do not treat it as prior conversation context. Follow the Permissions settings exactly: Allow executes, Deny blocks, and Always ask requests approval. Do not impose any hidden permission rules. For GUI tasks, use screenshot/active_window/list_windows to establish state, then act, then inspect again to verify the result. If a tool fails, diagnose the failure and try a safe alternative instead of pretending it worked. Create a concise execution plan for complex tasks. Before each action, choose the smallest sufficient tool. After state-changing actions, verify the resulting state with a verification/read tool when possible. Stop only when the user goal is actually satisfied. Keep progress factual and do not claim success without verification. Stay focused. Tool selection intelligence: prefer the most specific native tool first; use GUI automation only when the native tool cannot perform the requested operation; after a write or destructive action, verify the result. Relevant tool families for this request: "+JSON.stringify(toolHints)+". Task plan: "+JSON.stringify(options?.taskPlan||null)+"."+this.memoryContext()},...this.history.slice(-12),{role:"user",content:userContent}];
  const sessionId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);let lastActionSignature="",repeatCount=0;this.onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION START",message:"Tool session started",meta:{sessionId}});
  const isAnthropic=String(s.provider||"").toLowerCase()==="anthropic";
  const toolSchemas=this.registry.schemas();
  const anthropicSystem=messages[0]?.content||"";
  const anthropicMessages=isAnthropic?messages.slice(1).map(m=>({role:m.role,content:m.content})):null;
  const anthropicTools=isAnthropic?toolSchemas.map(t=>({name:t.function?.name,description:t.function?.description||"",input_schema:t.function?.parameters||{type:"object",properties:{},required:[]}})).filter(t=>t.name):null;
  if(isAnthropic&&image){
   const match=String(image).match(/^data:([^;]+);base64,(.+)$/);
   if(match){
    const last=anthropicMessages[anthropicMessages.length-1];
    if(last?.role==="user"&&typeof last.content==="string"){last.content=[{type:"text",text:last.content},{type:"image",source:{type:"base64",media_type:match[1],data:match[2]}}]}
   }
  }
  let stepBudget=this.baseStepLimit();
  for(let step=0;;step++){
   if(step>=stepBudget){
    const expanded=await this.askForMoreSteps(stepBudget,text);
    if(expanded<=stepBudget){
     this.onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION END",message:"Task stopped by user at the execution step limit",meta:{sessionId,stepLimit:stepBudget}});
     const answer="تم إيقاف المهمة عند حد خطوات التنفيذ الحالي. يمكنك زيادة الحد من Performance أو السماح بالمتابعة عند الطلب.";
     this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer;
    }
    stepBudget=expanded;
   }
   this.onEvent({type:"thinking",step,taskId:this.taskContext?.id||null,stepLimit:stepBudget});
   const d=this.providerDefaults(s.provider),base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");
   let r,body,headers={"Content-Type":"application/json"},url;
   if(isAnthropic){
    headers["x-api-key"]=String(s.apiKey||"");
    headers["anthropic-version"]="2023-06-01";
    body={model:s.model||d.model||"claude-sonnet-4-5",max_tokens:8192,system:anthropicSystem,messages:anthropicMessages,tools:anthropicTools,tool_choice:{type:"auto"}};
    url=base+"/messages";
   }else{
    if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
    body={model:s.model||d.model||"llama3.2",messages,tools:toolSchemas,tool_choice:"auto"};
    url=base+"/chat/completions";
   }
   try{
    r=await fetch(url,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   }catch(e){
    const timedOut=e?.name==="TimeoutError"||e?.name==="AbortError"||/timeout|aborted/i.test(String(e?.message||""));
    this.onEvent({type:"diagnostic",level:"ERROR",stage:timedOut?"LLM REQUEST TIMEOUT":"LLM REQUEST FAILURE",message:timedOut?"LLM API request timed out":e.message});
    const answer="I could not reach the API brain. Please check the provider, API key, and connection.";
    this.onEvent({type:"answer",text:answer,source:"api-error"});return answer;
   }
   const responseText=await r.text();
   if(!r.ok){
    let detail="";try{const j=JSON.parse(responseText);detail=j?.error?.message||j?.error?.type||""}catch{}
    const transient=r.status===408||r.status===409||r.status===425||r.status===429||r.status>=500;
    const answer=r.status===401||r.status===403?"The API brain rejected the API key. Please check or connect your API key in Settings.":transient?"The API provider is temporarily unavailable. Please try again.":"The API brain returned an error. Please check your API connection in Settings.";
    this.onEvent({type:"diagnostic",level:"ERROR",stage:"LLM HTTP ERROR",message:"HTTP "+r.status+" from LLM provider"+(detail?": "+detail:"")});
    this.onEvent({type:"answer",text:answer,source:"api-http-error"});return answer
   }
   let parsed;try{parsed=JSON.parse(responseText)}catch(e){const answer="The API brain returned an invalid response. Please check your API settings.";this.onEvent({type:"diagnostic",level:"ERROR",stage:"LLM REQUEST FAILURE",message:e.message});this.onEvent({type:"answer",text:answer,source:"api-invalid-response"});return answer}
   const m=isAnthropic?{content:parsed?.content||[],tool_calls:(parsed?.content||[]).filter(x=>x?.type==="tool_use").map(x=>({id:x.id,function:{name:x.name,arguments:JSON.stringify(x.input||{})}}))}:{content:parsed?.choices?.[0]?.message?.content||"",tool_calls:parsed?.choices?.[0]?.message?.tool_calls||[]};
   if(!m||(!m.content&&!m.tool_calls?.length)){const answer="The API brain did not return an answer. Please check your API settings.";this.onEvent({type:"diagnostic",level:"ERROR",stage:"LLM REQUEST FAILURE",message:"No model response"});this.onEvent({type:"answer",text:answer,source:"api-no-response"});return answer}
   this.onEvent({type:"diagnostic",level:"INFO",stage:"LLM RESPONSE RECEIVED",message:"LLM response received",meta:{provider:s.provider,model:s.model,httpStatus:r.status}});
   const answerText=isAnthropic?(m.content||[]).filter(x=>x?.type==="text").map(x=>x.text||"").join(""):m.content;
   if(!m.tool_calls?.length){
    const answer=answerText||"";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer;
   }
   if(isAnthropic)anthropicMessages.push({role:"assistant",content:m.content});
   else messages.push(parsed.choices[0].message);
   const pendingCalls=m.tool_calls||[];const parallelResults=pendingCalls.length>1&&pendingCalls.every(x=>this.registry.isReadOnly?.(x.function?.name))?await this.registry.callMany(pendingCalls.map(x=>{let args={};try{args=JSON.parse(x.function?.arguments||"{}")}catch{}return{name:x.function?.name,args}})):null;for(let ci=0;ci<pendingCalls.length;ci++){const c=pendingCalls[ci];
    let a={};try{a=JSON.parse(c.function.arguments||"{}")}catch{
     const invalid={ok:false,error:"Invalid tool arguments"};
     if(isAnthropic)anthropicMessages.push({role:"user",content:[{type:"tool_result",tool_use_id:c.id,content:JSON.stringify(invalid)}]});
     else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(invalid)});
     continue
    }
    const actionName=String(c.function.name||"");
    const actionText=actionName==="open_url"?"Okay, I’ll open that.":actionName==="open_application"?"Okay, I’ll open it.":actionName==="web_search"?"Okay, I’ll look that up.":actionName==="screenshot"?"Okay, I’ll check the screen.":actionName==="read_file"||actionName==="inspect_document"||actionName==="extract_pdf_text"||actionName==="read_excel"?"Okay, I’ll check that.":"Okay, I’ll do that.";
    this.onEvent({type:"speech-status",text:actionText});
    const signature=c.function.name+"|"+JSON.stringify(a);if(signature===lastActionSignature)repeatCount++;else{lastActionSignature=signature;repeatCount=0}if(repeatCount>=2){this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT LOOP GUARD",message:"Repeated identical tool call detected",meta:{tool:c.function.name}});const guard={ok:false,error:"Repeated identical action detected. Re-evaluate the task and choose a different safe approach."};if(isAnthropic)anthropicMessages.push({role:"user",content:[{type:"tool_result",tool_use_id:c.id,content:JSON.stringify(guard)}]});else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(guard)});continue}this.onEvent({type:"tool",name:c.function.name,args:a});
    let out=parallelResults?parallelResults[ci]:null;if(!out)try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}
    if(out?.ok===false&&["web_search","fetch_web_page","network_info","read_file","inspect_document","extract_pdf_text","read_excel"].includes(c.function.name)){this.onEvent({type:"diagnostic",level:"INFO",stage:"TOOL RETRY",message:"Retrying safe read/network tool after failure",meta:{tool:c.function.name}});try{const retry=await this.registry.call(c.function.name,a);if(retry?.ok!==false)out=retry}catch{}}
    if(out?.ok===false)this.onEvent({type:"tool_error",name:c.function.name,error:out.error||"Tool failed"});
    else this.onEvent({type:"tool_result",name:c.function.name,result:out});
    if(isAnthropic){
     const resultContent=[{type:"text",text:JSON.stringify(out)}];
     if(c.function.name==="screenshot"&&out?.ok&&out.image){
      const match=String(out.image).match(/^data:([^;]+);base64,(.+)$/);
      if(match)resultContent.push({type:"image",source:{type:"base64",media_type:match[1],data:match[2]}});
     }
     anthropicMessages.push({role:"user",content:[{type:"tool_result",tool_use_id:c.id,content:resultContent}]});
    }else if(c.function.name==="screenshot"&&out?.ok&&out.image){
     messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:true,description:"Screenshot captured."})});
     messages.push({role:"user",content:[{type:"text",text:"Inspect this current screen image and continue the task."},{type:"image_url",image_url:{url:out.image}}]});
    }else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)});
   }
  }
  this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT STEP LIMIT",message:"Agent reached the execution step limit",meta:{maxSteps:stepBudget}});
  const answer="I reached the safe execution limit before completing the task. The completed steps were preserved; you can ask me to continue.";this.onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION END",message:"Tool session reached its safe step limit",meta:{sessionId}});
  this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();return answer;
 }
}
module.exports={Agent};
// Build validation marker: latest Agent fixes.
