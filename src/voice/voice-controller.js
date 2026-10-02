class VoiceController{
 static normalizeMicMode(mode){return String(mode||"off")==="on"?"on":"off"}
 static canUseRealtime(settings={}){
  return settings.realtimeEnabled!==false&&settings.micPath==="realtime"&&String(settings.realtimeProvider||"openai")==="openai"&&Boolean(settings.realtimeApiKey||settings.apiKey)&&String(settings.provider||"")!=="ollama"
 }
 static route(settings={},mode="off"){
  const mic=this.normalizeMicMode(mode);
  if(mic==="off")return{mic,stt:"disabled",tts:"independent",realtime:"stopped"};
  if(this.canUseRealtime(settings))return{mic,stt:"realtime",tts:"realtime",realtime:"start"};
  return{mic,stt:String(settings.sttProvider||"whisper"),tts:String(settings.ttsProvider||"local"),realtime:"stopped"};
 }
}
module.exports={VoiceController};