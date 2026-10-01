const fs=require("fs"),path=require("path"),{safeStorage,app}=require("electron"),{BrainLevelRouter}=require("./brain-levels");

class Agent{
 constructor({registry,onEvent}){
  this.registry=registry;this.onEvent=onEvent;this.brainLevels=new BrainLevelRouter({settings:()=>this.settings,getLocalBrain:()=>this.localBrain});this.dir=app.getPath("userData");
  this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");
  fs.mkdirSync(this.dir,{recursive:true});
  const raw=this.readJson(this.file,{provider:"openai",baseUrl:"https://api.openai.com/v1",model:"gpt-5",apiKey:"",maxSteps:32,micMode:"off",brainMode:"auto",sttProvider:"whisper",sttModel:"base-q5_1",sttLanguage:"auto",streamingMode:"off",voiceControlVersion:3,ttsProvider:"local",ttsModel:"gpt-4o-mini-tts",ttsVoice:"alloy",voiceProfile:"saeed",showSpeechText:false,language:"en",permissions:{files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow"},realtimeModel:"gpt-realtime-2.1",realtimeVoice:"marin",realtimeEnabled:true,voiceRouting:"controller",micPath:"realtime",voiceMuted:false});
  this._settings={...raw,permissions:{files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow",...(raw.permissions||{})},
   micMode:"off",
   brainMode:"auto",
   streamingMode:"off",
   voiceControlVersion:3,
   ...(Number(raw.voiceControlVersion||0)<2?{}:{}),
   apiKey:this.decryptKey(raw.apiKey),
   sttApiKey:this.decryptKey(raw.sttApiKey),
   ttsApiKey:this.decryptKey(raw.ttsApiKey),
   realtimeApiKey:this.decryptKey(raw.realtimeApiKey)
  };
  this.history=this.readJson(this.historyFile,[]);
  if(!Array.isArray(this.history))this.history=[];
 }
 readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
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
  this._settings={...previous,...input,permissions:{...previous.permissions,...(input.permissions||{})},brainMode:"auto"};
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
 saveHistory(){try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-200),null,2))}catch(e){console.error("History save failed:",e)}}
 clearHistory(){this.history=[];try{fs.writeFileSync(this.historyFile,"[]")}catch(e){console.error("History clear failed:",e)}}

 async run(text,image=null){
  const s=this.settings;if(!String(text).trim())return "اكتب لي المهمة التي تريد تنفيذها.";this.onEvent({type:"diagnostic",level:"INFO",stage:"LLM REQUEST START",message:"LLM request started"});
  const mode=String(s.brainMode||"auto");
  if(mode==="realtime"){
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN REALTIME",message:"Realtime mode is selected; voice streaming handles the conversation."});
   return "Realtime mode is active. Use the microphone for the live conversation.";
  }
  if(mode!=="api"){
   if(this.localBrain){try{const brainMem=process.memoryUsage();const brainCpu=process.cpuUsage();const brainStart=Date.now();const handled=await this.localBrain.handle(text);const brainAfter=process.memoryUsage();const brainCpuAfter=process.cpuUsage(brainCpu);this.onEvent({type:"diagnostic",level:"INFO",stage:"RESOURCE LOCAL BRAIN",message:"Local brain resource sample",meta:{elapsedMs:Date.now()-brainStart,cpuUserMs:Math.round(brainCpuAfter.user/1000),cpuSystemMs:Math.round(brainCpuAfter.system/1000),heapDeltaMB:+((brainAfter.heapUsed-brainMem.heapUsed)/1048576).toFixed(2),rssMB:+(brainAfter.rss/1048576).toFixed(1)}});if(handled!==null){this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL","message":"Offline computer brain handled the request"});this.history.push({role:"user",content:String(text)},{role:"assistant",content:handled});this.saveHistory();this.onEvent({type:"answer",text:handled,source:"local-brain"});return handled;}}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message});}}
   const nextLevel=await this.brainLevels.classify(text);
   this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LEVEL",message:"Conversation brain selected level "+nextLevel.level+" ("+nextLevel.name+")",meta:nextLevel});
   if(mode==="local"){
    this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LOCAL",message:"Offline computer brain has no handler for this request"});
    const answer="I can handle common Windows computer tasks offline, but this request needs the API brain. Please connect an API key in Settings.";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:"local-fallback"});return answer;
   }
  }
  if(!s.apiKey&&s.provider!=="ollama"){
   this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT NOT READY",message:"LLM API key is missing"});
   const answer="This request needs the API brain. Please connect an API key in Settings.";
   this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer,source:"api-missing"});return answer;
  }
  this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN API",message:"API brain selected: "+String(s.provider||"openai")+" / "+String(s.model||this.providerDefaults(s.provider).model||"unknown"),meta:{provider:String(s.provider||"openai"),model:String(s.model||this.providerDefaults(s.provider).model||"unknown"),endpoint:String(s.baseUrl||this.providerDefaults(s.provider).baseUrl||"")}});
  const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Accomplish the user's actual goal, inspect first when needed, use tools, observe results, verify important actions, recover from failures, and continue until the goal is complete. You can inspect Windows, screen, processes, files and web, and control mouse/keyboard. Prefer native structured document/office tools (inspect_document, extract_pdf_text, read_excel, write_excel) before GUI automation whenever the task involves PDFs, spreadsheets, or document content. Use GUI automation only when a native tool cannot complete the requested action. Never claim success without evidence. Follow the Permissions settings exactly: Allow executes, Deny blocks, and Always ask requests approval. Do not impose any hidden permission rules. For GUI tasks, use screenshot/active_window/list_windows to establish state, then act, then inspect again to verify the result. If a tool fails, diagnose the failure and try a safe alternative instead of pretending it worked. Keep a concise plan in your reasoning and make progress each step. Stay focused."},...this.history.slice(-30),{role:"user",content:userContent}];
  const sessionId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);this.onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION START",message:"Tool session started",meta:{sessionId}});
  const isAnthropic=String(s.provider||"").toLowerCase()==="anthropic";
  const anthropicSystem=messages[0]?.content||"";
  const anthropicMessages=isAnthropic?messages.slice(1).map(m=>({role:m.role,content:m.content})):null;
  const anthropicTools=isAnthropic?this.registry.schemas().map(t=>({name:t.function?.name,description:t.function?.description||"",input_schema:t.function?.parameters||{type:"object",properties:{},required:[]}})).filter(t=>t.name):null;
  if(isAnthropic&&image){
   const match=String(image).match(/^data:([^;]+);base64,(.+)$/);
   if(match){
    const last=anthropicMessages[anthropicMessages.length-1];
    if(last?.role==="user"&&typeof last.content==="string"){last.content=[{type:"text",text:last.content},{type:"image",source:{type:"base64",media_type:match[1],data:match[2]}}]}
   }
  }
  for(let step=0;step<(Math.min(100,Math.max(1,Number(s.maxSteps)||32)));step++){
   this.onEvent({type:"thinking",step});
   const d=this.providerDefaults(s.provider),base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");
   let r,body,headers={"Content-Type":"application/json"},url;
   if(isAnthropic){
    headers["x-api-key"]=String(s.apiKey||"");
    headers["anthropic-version"]="2023-06-01";
    body={model:s.model||d.model||"claude-sonnet-4-5",max_tokens:8192,system:anthropicSystem,messages:anthropicMessages,tools:anthropicTools,tool_choice:{type:"auto"}};
    url=base+"/messages";
   }else{
    if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
    body={model:s.model||d.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto"};
    url=base+"/chat/completions";
   }
   try{r=await fetch(url,{method:"POST",headers,body:JSON.stringify(body)})}
   catch(e){const answer="I could not reach the API brain. Please check your API key and connection in Settings.";this.onEvent({type:"diagnostic",level:"ERROR",stage:"LLM REQUEST FAILURE",message:e.message});this.onEvent({type:"answer",text:answer,source:"api-error"});return answer}
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
   for(const c of m.tool_calls||[]){
    let a={};try{a=JSON.parse(c.function.arguments||"{}")}catch{
     const invalid={ok:false,error:"Invalid tool arguments"};
     if(isAnthropic)anthropicMessages.push({role:"user",content:[{type:"tool_result",tool_use_id:c.id,content:JSON.stringify(invalid)}]});
     else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(invalid)});
     continue
    }
    this.onEvent({type:"tool",name:c.function.name,args:a});
    let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}
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
  this.onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT STEP LIMIT",message:"Agent reached the safe execution step limit",meta:{maxSteps:Number(s.maxSteps)||32}});
  const answer="I reached the safe execution limit before completing the task. The completed steps were preserved; you can ask me to continue.";this.onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION END",message:"Tool session reached its safe step limit",meta:{sessionId}});
  this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();return answer;
 }
}
module.exports={Agent};