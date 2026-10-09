const {redactToolArgs,redactToolResult}=require("../../tools/redact");
const {OpenAIRealtime,GeminiLive}=require("../../realtime");
function createVoiceRuntime(deps={}){
 const getAgent=deps.getAgent||(()=>null), diagnostic=deps.diagnostic||(()=>{}), voiceBroadcast=deps.voiceBroadcast||(()=>{}), getToolSchemas=deps.getToolSchemas||(()=>[]), executeTool=deps.executeTool|| (async()=>({ok:false,error:"Tool execution gateway unavailable"}));
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
 const provider=String(s.realtimeProvider||"openai"),key=s.realtimeApiKey||s.apiKey||"";
 if(!key || (provider==="openai"&&s.provider==="ollama")){diagnostic("ERROR","REALTIME API KEY","Realtime API key is missing");voiceBroadcast("realtime:state","not-configured","Realtime API key is not configured.");return false}
 diagnostic("INFO","STT START","Starting Realtime STT");diagnostic("INFO","TTS START","Starting Realtime TTS");if(realtime) realtime.stop();
 const realtimeTools=getToolSchemas().map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 const RealtimeClass=provider==="gemini"?GeminiLive:OpenAIRealtime; realtime=new RealtimeClass({
  state:(state,message)=>{diagnostic("INFO","REALTIME "+String(state||"").toUpperCase(),message||"");if(state==="connected"){diagnostic("INFO","STT CONNECTED","Realtime STT connected");diagnostic("INFO","TTS CONNECTED","Realtime TTS connected")}if(state==="error")diagnostic("ERROR","REALTIME API",message||"Realtime API error");if(state==="disconnected")diagnostic("ERROR","REALTIME DISCONNECTED",message||"Realtime connection closed");voiceBroadcast("realtime:state",state,message)},
  event:async(event)=>{
   if(event.type==="input_audio_buffer.speech_started"){voiceBroadcast("agent:event",{type:"speech-start",source:"realtime"});}
   else if(event.type==="input_audio_buffer.speech_stopped" && realtimeBrainMode==="api"){
    voiceBroadcast("agent:event",{type:"speech-end",source:"realtime"});
    realtime?.requestResponse();
   }
   else if(provider==="gemini"&&event.serverContent?.modelTurn?.parts){for(const part of event.serverContent.modelTurn.parts){if(part.inlineData?.data)voiceBroadcast("realtime:audio",part.inlineData.data);if(part.text)voiceBroadcast("realtime:assistant-delta",part.text)}}else if(provider==="gemini"&&event.serverContent?.inputTranscription?.text){realtimeUserText=String(event.serverContent.inputTranscription.text||"").trim();voiceBroadcast("realtime:user-final",realtimeUserText)}else if(provider==="gemini"&&event.serverContent?.outputTranscription?.text){const answer=String(event.serverContent.outputTranscription.text||"").trim();if(answer)voiceBroadcast("realtime:assistant-final",answer)}else if((event.type==="response.output_audio.delta"||event.type==="response.audio.delta")&&event.delta){diagnostic("INFO","TTS AUDIO","Realtime audio received",{eventType:event.type});voiceBroadcast("realtime:audio",event.delta);}
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta){voiceBroadcast("agent:event",{type:"speech-start",source:"realtime"});voiceBroadcast("realtime:assistant-delta",event.delta);}
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript){voiceBroadcast("agent:event",{type:"speech-end",source:"realtime"});
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
    voiceBroadcast("agent:event",{type:"tool",name,args:redactToolArgs(name,args),source:"realtime"});
    let out;
    try{out=await executeTool(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)voiceBroadcast("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else voiceBroadcast("agent:event",{type:"tool_result",name,result:redactToolResult(name,out),source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="error")voiceBroadcast("realtime:error",event.error?.message||"Realtime API error");
  }
 });
 realtime.start(key,{model:s.realtimeModel||(provider==="gemini"?"gemini-3.8-live":"gpt-realtime-2.1"),voice:s.realtimeVoice||(provider==="gemini"?"Puck":"marin"),tools:realtimeTools});
 return true;
}

 return {start:startRealtime,stop:stopRealtime,getRealtime:()=>realtime,isActive:()=>Boolean(realtime)};
}
module.exports={createVoiceRuntime};