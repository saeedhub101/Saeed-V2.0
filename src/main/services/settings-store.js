const fs=require("fs"),path=require("path"),{safeStorage}=require("electron");
const {writeJsonAtomic}=require("./atomic-json-store");
const DEFAULT_PERMISSIONS={files:"ask",applications:"ask",system:"allow",network:"ask",screen:"ask",mouseKeyboard:"ask",microphone:"ask",tasksMemory:"ask",credentials:"ask",destructive:"ask",execution:"ask",mcp:"ask",addons:"ask"};
const DEFAULTS={provider:"openai",baseUrl:"https://api.openai.com/v1",model:"gpt-5",apiKey:"",fallbackEnabled:false,fallbackProvider:"",updateMode:"manual",fallbackBaseUrl:"",fallbackModel:"",fallbackApiKey:"",maxSteps:16,agentExtraSteps:"ask",brainMode:"auto",sttProvider:"whisper",sttModel:"base-q5_1",sttLanguage:"auto",streamingMode:"off",voiceControlVersion:3,ttsProvider:"local",ttsModel:"gpt-4o-mini-tts",ttsVoice:"alloy",sttBaseUrl:"",ttsBaseUrl:"",voiceProfile:"saeed",showSpeechText:false,language:"en",permissions:DEFAULT_PERMISSIONS,realtimeProvider:"openai",realtimeModel:"gpt-realtime-2.1",realtimeVoice:"marin",realtimeApiKey:"",micSpeechRms:0.02,micInterruptRms:0.09,voiceMuted:false,apiServices:{brain:true,stt:true,tts:true},realtimeBrainMode:"auto",characterSize:"small",characterBehavior:{breathing:true,blinking:true,expressions:true,speechFace:true,idle:true,walking:true,dancing:true,greeting:true,events:true,random:true,frequency:"normal",eventCooldownSec:30,autonomousMovement:true,idleThoughts:true,sleep:true,eyeTracking:true,sleepAfterMin:20,renderWakeMs:1200}};
class SettingsStore{
 constructor(dir){this.dir=dir;this.file=path.join(dir,"settings.json");fs.mkdirSync(dir,{recursive:true})}
 read(){try{return JSON.parse(fs.readFileSync(this.file,"utf8"))}catch{return{}}}
 decrypt(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 encrypt(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.encryptString(String(v)).toString("base64"):String(v||"")}catch{return String(v||"")}}
 load(){
  const raw=this.read(),value={...DEFAULTS,...raw,permissions:{...DEFAULT_PERMISSIONS,...(raw.permissions||{})},characterBehavior:{...DEFAULTS.characterBehavior,...(raw.characterBehavior||{})},apiServices:{brain:true,stt:true,tts:true,...(raw.apiServices||{})},micMode:"off",brainMode:["api","local","auto"].includes(String(raw.brainMode||""))?String(raw.brainMode):"auto",apiKey:this.decrypt(raw.apiKey),fallbackApiKey:this.decrypt(raw.fallbackApiKey),sttApiKey:this.decrypt(raw.sttApiKey),ttsApiKey:this.decrypt(raw.ttsApiKey),realtimeApiKey:this.decrypt(raw.realtimeApiKey)};
  const allowedProviders=["openai","anthropic","gemini","groq","ollama","openai-compatible"];
  if(!allowedProviders.includes(String(value.provider)))value.provider=DEFAULTS.provider;
  if(!allowedProviders.includes(String(value.fallbackProvider)))value.fallbackProvider="";
  if(!["manual","notify","automatic"].includes(String(value.updateMode)))value.updateMode=DEFAULTS.updateMode;
  if(!["saeed","api","auto"].includes(String(value.realtimeBrainMode)))value.realtimeBrainMode=DEFAULTS.realtimeBrainMode;
  value.maxSteps=Number.isFinite(Number(value.maxSteps))?Math.max(1,Math.min(100,Math.trunc(Number(value.maxSteps)))):DEFAULTS.maxSteps;
  const clamp=(v,f,min,max)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?f:Math.max(min,Math.min(max,Number(v)));
  value.micSpeechRms=clamp(value.micSpeechRms,DEFAULTS.micSpeechRms,0.001,0.5);
  value.micInterruptRms=clamp(value.micInterruptRms,DEFAULTS.micInterruptRms,value.micSpeechRms,1);
  for(const key of Object.keys(DEFAULT_PERMISSIONS))if(!["allow","ask","deny"].includes(value.permissions[key]))value.permissions[key]=DEFAULT_PERMISSIONS[key];
  for(const key of ["breathing","blinking","expressions","speechFace","idle","walking","dancing","greeting","events","random","autonomousMovement","idleThoughts","sleep","eyeTracking"])if(typeof value.characterBehavior[key]!=="boolean")value.characterBehavior[key]=DEFAULTS.characterBehavior[key];
  value.characterBehavior.frequency=["low","normal","high"].includes(String(value.characterBehavior.frequency))?String(value.characterBehavior.frequency):"normal";
  value.characterBehavior.eventCooldownSec=clamp(value.characterBehavior.eventCooldownSec,30,5,300);
  value.characterBehavior.sleepAfterMin=clamp(value.characterBehavior.sleepAfterMin,20,1,1440);
  value.characterBehavior.renderWakeMs=clamp(value.characterBehavior.renderWakeMs,1200,100,10000);
  for(const key of ["brain","stt","tts"])value.apiServices[key]=value.apiServices[key]!==false;
  value.fallbackEnabled=value.fallbackEnabled===true&&Boolean(value.fallbackProvider)&&value.fallbackProvider!==value.provider;
  return value;
 }
 providerDefaults(name){return{openai:{baseUrl:"https://api.openai.com/v1",model:"gpt-5"},anthropic:{baseUrl:"https://api.anthropic.com/v1",model:"claude-sonnet-4-5"},gemini:{baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai",model:"gemini-2.5-pro"},groq:{baseUrl:"https://api.groq.com/openai/v1",model:"openai/gpt-oss-120b"},ollama:{baseUrl:"http://localhost:11434/v1",model:"llama3.2"},"openai-compatible":{baseUrl:"",model:""}}[name]||{}}
 apply(previous,input){const next={...previous,...(input||{}),permissions:{...previous.permissions,...(input?.permissions||{})},characterBehavior:{...previous.characterBehavior,...(input?.characterBehavior||{})}};const providers=["openai","anthropic","gemini","groq","ollama","openai-compatible"];if(!providers.includes(String(next.provider)))next.provider=providers.includes(String(previous.provider))?previous.provider:DEFAULTS.provider;if(!["","openai","anthropic","gemini","groq","ollama","openai-compatible"].includes(String(next.fallbackProvider||"")))next.fallbackProvider="";if(!["whisper","openai","groq","elevenlabs"].includes(String(next.sttProvider)))next.sttProvider=DEFAULTS.sttProvider;if(!["local","openai","groq","elevenlabs","hakim"].includes(String(next.ttsProvider)))next.ttsProvider=DEFAULTS.ttsProvider;if(!["openai","local","auto"].includes(String(next.realtimeProvider)))next.realtimeProvider=DEFAULTS.realtimeProvider;next.brainMode=["api","local","auto"].includes(String(next.brainMode||""))?String(next.brainMode):String(previous.brainMode||"auto");next.apiServices={brain:next.apiServices?.brain!==false,stt:next.apiServices?.stt!==false,tts:next.apiServices?.tts!==false};next.realtimeBrainMode=["saeed","api","auto"].includes(String(next.realtimeBrainMode||""))?String(next.realtimeBrainMode):"auto";next.maxSteps=Math.max(1,Math.min(100,Number(next.maxSteps)||16));
  for(const key of Object.keys(DEFAULT_PERMISSIONS))if(!["allow","ask","deny"].includes(next.permissions?.[key]))next.permissions[key]=DEFAULT_PERMISSIONS[key];
  const finiteClamp=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
  next.micSpeechRms=finiteClamp(next.micSpeechRms,DEFAULTS.micSpeechRms,0.001,0.5);
  next.micInterruptRms=finiteClamp(next.micInterruptRms,DEFAULTS.micInterruptRms,next.micSpeechRms,1);
  const behavior=next.characterBehavior||{};
  for(const key of ["breathing","blinking","expressions","speechFace","idle","walking","dancing","greeting","events","random","autonomousMovement","idleThoughts","sleep","eyeTracking"])if(typeof behavior[key]!=="boolean")behavior[key]=DEFAULTS.characterBehavior[key];
  behavior.frequency=["low","normal","high"].includes(String(behavior.frequency))?String(behavior.frequency):"normal";
  behavior.eventCooldownSec=finiteClamp(behavior.eventCooldownSec,30,5,300);
  behavior.sleepAfterMin=finiteClamp(behavior.sleepAfterMin,20,1,1440);
  behavior.renderWakeMs=finiteClamp(behavior.renderWakeMs,1200,100,10000);
  next.characterBehavior=behavior;
  next.updateMode=["manual","notify","automatic"].includes(String(next.updateMode||""))?String(next.updateMode):"manual";next.fallbackEnabled=next.fallbackEnabled===true;next.fallbackProvider=["","openai","anthropic","gemini","groq","ollama","openai-compatible"].includes(String(next.fallbackProvider||""))?String(next.fallbackProvider):"";if(!next.fallbackProvider||next.fallbackProvider===next.provider)next.fallbackEnabled=false;next.agentExtraSteps=next.agentExtraSteps==="allow"?"allow":"ask";delete next.alwaysListening;if(input?.clearLlmKey){next.apiKey="";delete next.clearLlmKey}if(input?.clearAllApiKeys){next.apiKey="";next.sttApiKey="";next.ttsApiKey="";next.realtimeApiKey="";next.fallbackApiKey="";if(next.fallbackProvider!=="ollama")next.fallbackEnabled=false;delete next.clearAllApiKeys}const explicitClear=new Set(Array.isArray(input?.clearKeys)?input.clearKeys:[]);for(const k of ["apiKey","sttApiKey","ttsApiKey","realtimeApiKey","fallbackApiKey"])if(input&&input[k]===""&&!explicitClear.has(k))next[k]=previous[k]||"";for(const k of explicitClear)if(["apiKey","sttApiKey","ttsApiKey","realtimeApiKey","fallbackApiKey"].includes(k))next[k]="";if(input?.provider&&input.provider!==previous.provider){const p=this.providerDefaults(input.provider);if(input.baseUrl===undefined||input.baseUrl===previous.baseUrl)next.baseUrl=p.baseUrl;if(input.model===undefined||input.model===previous.model)next.model=p.model}const p=this.providerDefaults(next.provider);if(!next.sttBaseUrl)next.sttBaseUrl="";if(!next.ttsBaseUrl)next.ttsBaseUrl="";if(!next.baseUrl)next.baseUrl=p.baseUrl;if(!next.model)next.model=p.model;if(!this.persist(next))throw new Error("Settings could not be saved; the previous settings were preserved.");return next}
 persist(s){
  const payload={...s,apiKey:this.encrypt(s.apiKey),sttApiKey:this.encrypt(s.sttApiKey),ttsApiKey:this.encrypt(s.ttsApiKey),realtimeApiKey:this.encrypt(s.realtimeApiKey),fallbackApiKey:this.encrypt(s.fallbackApiKey)};
  const result=writeJsonAtomic(this.file,payload);
  if(!result.ok)console.error("Settings save failed; the previous settings file was preserved:",result.error);
  return result.ok;
 }
 public(s){const out={...s};delete out.alwaysListening;return{...out,apiKey:"",sttApiKey:"",ttsApiKey:"",realtimeApiKey:"",fallbackApiKey:"",hasFallbackApiKey:Boolean(s.fallbackApiKey),hasApiKey:Boolean(s.apiKey),hasSttApiKey:Boolean(s.sttApiKey),hasTtsApiKey:Boolean(s.ttsApiKey),hasRealtimeApiKey:Boolean(s.realtimeApiKey)}}
}
function createSettingsStore(dir){return new SettingsStore(dir)}
module.exports={SettingsStore,createSettingsStore};
