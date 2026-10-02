const fs=require("fs");
const path=require("path");
const {safeStorage}=require("electron");

const DEFAULT_PERMISSIONS={files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow"};

class SettingsStore{
 constructor(file){this.file=file}
 read(fallback={}){try{return JSON.parse(fs.readFileSync(this.file,"utf8"))}catch{return fallback}}
 normalize(raw={}){
  return {
   ...raw,
   permissions:{...DEFAULT_PERMISSIONS,...(raw.permissions||{})},
   micMode:"off",
   brainMode:String(raw.brainMode||"auto"),
   streamingMode:"off",
   voiceControlVersion:3,
   apiKey:this.decryptKey(raw.apiKey),
   sttApiKey:this.decryptKey(raw.sttApiKey),
   ttsApiKey:this.decryptKey(raw.ttsApiKey),
   realtimeApiKey:this.decryptKey(raw.realtimeApiKey)
  };
 }
 encryptKey(key){try{return key&&safeStorage.isEncryptionAvailable()?safeStorage.encryptString(String(key)).toString("base64"):String(key||"")}catch{return String(key||"")}}
 decryptKey(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 save(settings){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({...settings,apiKey:this.encryptKey(settings.apiKey),sttApiKey:this.encryptKey(settings.sttApiKey),ttsApiKey:this.encryptKey(settings.ttsApiKey),realtimeApiKey:this.encryptKey(settings.realtimeApiKey)},null,2))}catch(e){console.error("Settings save failed:",e)}}
 public(settings){
  const out={...settings};
  delete out.alwaysListening;
  return {...out,apiKey:"",sttApiKey:"",ttsApiKey:"",realtimeApiKey:"",hasApiKey:Boolean(settings?.apiKey),hasSttApiKey:Boolean(settings?.sttApiKey),hasTtsApiKey:Boolean(settings?.ttsApiKey),hasRealtimeApiKey:Boolean(settings?.realtimeApiKey)};
 }
}
module.exports={SettingsStore,DEFAULT_PERMISSIONS};