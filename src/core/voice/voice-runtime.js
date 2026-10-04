const {OpenAIRealtime}=require("../../realtime");
function createVoiceRuntime(deps={}){
 const getAgent=deps.getAgent||(()=>null), diagnostic=deps.diagnostic||(()=>{}), voiceBroadcast=deps.voiceBroadcast||(()=>{});
 let realtime=null,realtimeUserText="";
function stopRealtime(){
 if(realtime){realtime.stop();realtime=null}
 diagnostic("INFO","STT DISCONNECTED","Realtime STT connection stopped");
 diagnostic("INFO","TTS DISCONNECTED","Realtime TTS connection stopped");
 voiceBroadcast("realtime:state","disconnected");
}
function startRealtime(options={}){
 const s=getAgent()?.settings||{};
 const realtimeBrainMode=["saeed","api","auto"].includes(String(s.realtimeBrainMode||"auto"))?String(s.realtimeBrainMode):"auto";
 const realtimeVoiceRouting=realtimeBrainMode==="api"?"direct":"controller";
 if(String(s.realtimeProvider||"openai")!=="openai"){diagnostic("INFO","REALTIME BLOCKED","The selected Realtime provider has no native speech-to-speech implementation in Saeed yet.");voiceBroadcast("realtime:state","blocked","Selected Realtime provider is not supported.");return false}const key=s.realtimeApiKey||s.apiKey||"";
 if(!key || s.provider==="ollama"){diagnostic("ERROR","STT API KEY","Realtime/OpenAI API key is missing");diagnostic("ERROR","TTS API KEY","Realtime/OpenAI API key is missing");voiceBroadcast("realtime:state","not-configured","OpenAI API key is not configured.");return false}
 diagnostic("INFO","STT START","Starting Realtime STT");diagnostic("INFO","TTS START","Starting Realtime TTS");if(realtime) realtime.stop();
 const registry=getAgent()?.registry;
 const realtimeTools=(registry?.schemas()||[]).map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 realtime=new OpenAIRealtime({
  state:(state,message)=>{diagnostic("INFO","REALTIME "+String(state||"").toUpperCase(),message||"");if(state==="connected"){diagnostic("INFO","STT CONNECTED","Realtime STT connected");diagnostic("INFO","TTS CONNECTED","Realtime TTS connected")}if(state==="error")diagnostic("ERROR","REALTIME API",message||"Realtime API error");if(state==="disconnected")diagnostic("ERROR","REALTIME DISCONNECTED",message||"Realtime connection closed");voiceBroadcast("realtime:state",state,message)},
  event:async(event)=>{
   if(event.type==="input_audio_buffer.speech_stopped" && realtimeBrainMode==="api"){
    realtime?.requestResponse();
   }
   else if((event.type==="response.output_audio.delta"||event.type==="response.audio.delta")&&event.delta){diagnostic("INFO","TTS AUDIO","Realtime audio received",{eventType:event.type});voiceBroadcast("realtime:audio",event.delta);}
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)voiceBroadcast("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript){
    const answer=String(event.transcript||"").trim();
    voiceBroadcast("realtime:assistant-final",answer);
    if(realtimeBrainMode==="api" && realtimeUserText && answer){
     getAgent()?.recordConversationExchange?.(realtimeUserText,answer);
     realtimeUserText="";
    }
   }
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript){
    realtimeUserText=String(event.transcript||"").trim();
    voiceBroadcast("realtime:user-final",realtimeUserText);
   }
   else if(event.type==="response.done" && realtimeBrainMode==="api")voiceBroadcast("realtime:response-done");
   else if(event.type==="response.function_call_arguments.done"&&event.call_id){
    const name=String(event.name||"");
    let args={};
    try{args=JSON.parse(event.arguments||"{}")}catch{args={}};
    voiceBroadcast("agent:event",{type:"speech-status",text:name==="open_url"?"Okay, I’ll open that.":name==="open_application"?"Okay, I’ll open it.":name==="web_search"?"Okay, I’ll look that up.":"Okay, I’ll do that.",source:"realtime"});
    voiceBroadcast("agent:event",{type:"tool",name,args,source:"realtime"});
    let out;
    try{out=await registry.call(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)voiceBroadcast("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else voiceBroadcast("agent:event",{type:"tool_result",name,result:out,source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="error")voiceBroadcast("realtime:error",event.error?.message||"Realtime API error");
  }
 });
 realtime.start(key,{model:s.realtimeModel||"gpt-realtime-2.1",voice:s.realtimeVoice||"marin",tools:realtimeTools,voiceRouting:realtimeVoiceRouting});
 return true;
}

 return {start:startRealtime,stop:stopRealtime,getRealtime:()=>realtime,isActive:()=>Boolean(realtime)};
}
module.exports={createVoiceRuntime};