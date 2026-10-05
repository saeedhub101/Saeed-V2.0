function createApiHealth(deps={}){
 const getAgent=deps.getAgent||(()=>null);
 async function testApiConnection(service){
  const agent=getAgent(),s=agent?.settings||{};
 const result={service,connected:false,provider:"Not configured",model:"—",endpoint:"—",latencyMs:0,detail:"Not tested"};
 const started=Date.now();
 const finish=(x)=>({...result,...x,latencyMs:Date.now()-started});
 let url="",headers={},method="GET";
 try{
  if(service==="brain"){
   const provider=String(s.provider||"openai"), d=agent?.providerDefaults?.(provider)||{};
   result.provider=provider==="openai"?"OpenAI / GPT":provider==="anthropic"?"Anthropic / Claude":provider==="gemini"?"Google / Gemini":provider==="groq"?"Groq":provider==="ollama"?"Ollama":"OpenAI-compatible";
   result.model=String(s.model||d.model||"—"); result.endpoint=String(s.baseUrl||d.baseUrl||"—");
   if(provider==="ollama"){url=result.endpoint.replace(/\/$/,"")+"/models"}
   else if(provider==="anthropic"){url="https://api.anthropic.com/v1/models";headers={"x-api-key":String(s.apiKey||""),"anthropic-version":"2023-06-01"}}
   else if(provider==="gemini"){url=result.endpoint.replace(/\/$/,"")+"/models"; if(s.apiKey)url+="?key="+encodeURIComponent(s.apiKey)}
   else {url=result.endpoint.replace(/\/$/,"")+"/models";if(s.apiKey)headers.Authorization="Bearer "+s.apiKey}
  }else if(service==="stt"){
   result.provider=s.sttProvider==="openai"?"OpenAI Speech-to-Text":s.sttProvider==="groq"?"Groq Speech-to-Text":s.sttProvider==="elevenlabs"?"ElevenLabs Speech-to-Text":"Whisper — Local / Offline";result.model=s.sttModel||"whisper-local";result.endpoint=s.sttProvider==="openai"?"https://api.openai.com/v1/audio/transcriptions":s.sttProvider==="groq"?"https://api.groq.com/openai/v1/audio/transcriptions":s.sttProvider==="elevenlabs"?"https://api.elevenlabs.io/v1/speech-to-text":"Local Whisper runtime";
   if(s.sttProvider==="whisper")return finish({connected:true,detail:"Local Whisper configured; no API connection required"});
    const base=(s.sttBaseUrl|| (s.sttProvider==="groq"?"https://api.groq.com/openai/v1":s.sttProvider==="elevenlabs"?"https://api.elevenlabs.io/v1":"https://api.openai.com/v1")).replace(/\/$/,"");url=base+"/models";const key=s.sttApiKey||(s.sttProvider==="openai"?s.apiKey:"");if(key)headers=s.sttProvider==="elevenlabs"?{"xi-api-key":key}:{Authorization:"Bearer "+key};
  }else if(service==="tts"){
   result.provider=s.ttsProvider==="openai"?"OpenAI TTS":s.ttsProvider==="groq"?"Groq TTS":s.ttsProvider==="elevenlabs"?"ElevenLabs TTS":"Local Browser TTS";result.model=s.ttsModel||"browser-speech";result.endpoint=s.ttsProvider==="openai"?"https://api.openai.com/v1/audio/speech":s.ttsProvider==="groq"?"https://api.groq.com/openai/v1/audio/speech":s.ttsProvider==="elevenlabs"?"https://api.elevenlabs.io/v1/text-to-speech":"Local Browser SpeechSynthesis";
   if(s.ttsProvider==="local")return finish({connected:true,detail:"Local Browser TTS configured; no API connection required"});
    const base=(s.ttsBaseUrl|| (s.ttsProvider==="groq"?"https://api.groq.com/openai/v1":s.ttsProvider==="elevenlabs"?"https://api.elevenlabs.io/v1":"https://api.openai.com/v1")).replace(/\/$/,"");url=base+"/models";const key=s.ttsApiKey||(s.ttsProvider==="openai"?s.apiKey:"");if(key)headers=s.ttsProvider==="elevenlabs"?{"xi-api-key":key}:{Authorization:"Bearer "+key};
  }else if(service==="realtime"){
   result.provider=s.realtimeProvider==="openai"?"OpenAI Realtime":"Realtime disabled";result.model=s.realtimeModel||"gpt-realtime-2.1";result.endpoint="wss://api.openai.com/v1/realtime";
   url="https://api.openai.com/v1/models";if(s.realtimeApiKey||s.apiKey)headers.Authorization="Bearer "+(s.realtimeApiKey||s.apiKey);
  }else return finish({detail:"Unknown API service"});
  if(!s.apiKey&&service==="brain"&&s.provider!=="ollama")return finish({detail:"Brain API key is missing"});
  if(service==="stt"&&s.sttProvider!=="whisper"&&!s.sttApiKey&&!((s.sttProvider==="openai")&&s.apiKey))return finish({detail:"STT API key is missing"});
  if(service==="tts"&&s.ttsProvider!=="local"&&!s.ttsApiKey&&!((s.ttsProvider==="openai")&&s.apiKey))return finish({detail:"TTS API key is missing"});
  if(service==="realtime"&&s.realtimeProvider!=="openai")return finish({connected:false,detail:"No native Realtime audio provider is configured"});if(service==="realtime"&&!s.realtimeApiKey&&!s.apiKey)return finish({detail:"Realtime API key is missing"});
  const r=await fetch(url,{method,headers,signal:AbortSignal.timeout(8000)});const body=await r.text().catch(()=>"");
  if(!r.ok)return finish({detail:"HTTP "+r.status+(body?": "+body.slice(0,180):"")});
  let modelAvailable=true;try{const j=JSON.parse(body),ids=[...(j.data||[]).map(x=>x.id).filter(Boolean),...(j.models||[]).map(x=>x.name||x.id).filter(Boolean)];if(ids.length&&service==="brain")modelAvailable=ids.includes(result.model)||result.model==="—"}catch{}
  return finish({connected:modelAvailable,detail:modelAvailable?"Provider authenticated and reachable"+(service==="realtime"?" (Realtime credentials verified via API authentication)":""): "Provider reachable but configured model was not found"});
 }catch(e){return finish({detail:e?.message||String(e)})}
 }
 async function testAllApiConnections(){return Promise.all(["brain","tts","stt","realtime"].map(testApiConnection))}
 return {test:testApiConnection,testAll:testAllApiConnections};
}
module.exports={createApiHealth};