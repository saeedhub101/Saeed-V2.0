const addonRuntime=()=>require("../../addons/runtime");
class ModelExecutor{
 async run({text,image=null,settings,history,registry,onEvent,dir,memoryContext,saveHistory,baseStepLimit,askForMoreSteps,providerDefaults}){
  const s=settings||{};
    const addonPreference=String(s.provider||"").startsWith("addon:")?String(s.provider).slice(6):null;
  const addonLlm=addonRuntime().find(dir,"llm",addonPreference);
  if(addonLlm){
   try{
    const provider=addonRuntime().load(dir,addonLlm.id);
    if(typeof provider.chat==="function"){
     onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN ADD-ON",message:"Using installed LLM add-on: "+addonLlm.name,meta:{id:addonLlm.id,provider:addonLlm.provider||addonLlm.id}});
     const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);
     const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Use the supplied tools when needed and do not claim success without evidence."+memoryContext()},...history.slice(-12),{role:"user",content:userContent}];
     const result=await provider.chat({messages,tools:registry.schemas(),settings:s,model:s.model||null});
     const content=String(result?.content||result?.text||"");
     const calls=Array.isArray(result?.tool_calls)?result.tool_calls:[];
     if(calls.length){
      for(const call of calls){
       let args={};try{args=typeof call.arguments==="string"?JSON.parse(call.arguments):call.arguments||{}}catch{}
       const name=String(call.name||call.function?.name||"");const out=await registry.call(name,args);
       messages.push({role:"assistant",content:"",tool_calls:[{id:call.id||"addon-call",type:"function",function:{name,arguments:JSON.stringify(args)}}]});
       messages.push({role:"tool",tool_call_id:call.id||"addon-call",content:JSON.stringify(out)});
      }
      const follow=await provider.chat({messages,tools:registry.schemas(),settings:s,model:s.model||null});
      const finalText=String(follow?.content||follow?.text||content);
      history.push({role:"user",content:String(text)},{role:"assistant",content:finalText});saveHistory();onEvent({type:"answer",text:finalText,source:"addon-llm"});return finalText;
     }
     history.push({role:"user",content:String(text)},{role:"assistant",content:content});saveHistory();onEvent({type:"answer",text:content,source:"addon-llm"});return content;
    }
   }catch(e){onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN ADD-ON",message:e.message});if(addonPreference)throw e;}
  }
  if(!s.apiKey&&s.provider!=="ollama"){
   onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT NOT READY",message:"LLM API key is missing"});
   const answer="This request needs the API brain. Please connect an API key in Settings.";
   history.push({role:"user",content:String(text)},{role:"assistant",content:answer});saveHistory();onEvent({type:"answer",text:answer,source:"api-missing"});return answer;
  }
  onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN API",message:"API brain selected: "+String(s.provider||"openai")+" / "+String(s.model||providerDefaults(s.provider).model||"unknown"),meta:{provider:String(s.provider||"openai"),model:String(s.model||providerDefaults(s.provider).model||"unknown"),endpoint:String(s.baseUrl||providerDefaults(s.provider).baseUrl||"")}});
  const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Accomplish the user's actual goal, inspect first when needed, use tools, observe results, verify important actions, recover from failures, and continue until the goal is complete. You can inspect Windows, screen, processes, files and web, and control mouse/keyboard. Prefer native structured document/office tools (inspect_document, extract_pdf_text, read_excel, write_excel) before GUI automation whenever the task involves PDFs, spreadsheets, or document content. Use GUI automation only when a native tool cannot complete the requested action. Never claim success without evidence. Each chat is an independent conversation. Do not infer or continue tasks from other chats. Only use the Global user memory below for stable facts/preferences; do not treat it as prior conversation context. Follow the Permissions settings exactly: Allow executes, Deny blocks, and Always ask requests approval. The router knows installed learned skills and available tools; prefer an exact learned skill when matched. If a tool reports unknown, unsupported, unavailable, or wrong-route failure, reassess and choose a different valid tool instead of returning that routing error to the user. Do not impose any hidden permission rules. For GUI tasks, use screenshot/active_window/list_windows to establish state, then act, then inspect again to verify the result. For simple application launch commands such as \"open my computer\", \"open Excel\", or \"open File Explorer\", call open_application directly and never call screenshot, OCR, inspect_image, or extract_image_table unless the user explicitly asks for visual inspection or text extraction from an image. If a tool fails, diagnose the failure and try a safe alternative instead of pretending it worked. Keep a concise plan in your reasoning and make progress each step. Stay focused."+memoryContext()},...history.slice(-12),{role:"user",content:userContent}];
  const sessionId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION START",message:"Tool session started",meta:{sessionId}});
  const isAnthropic=String(s.provider||"").toLowerCase()==="anthropic";
  const toolSchemas=registry.schemas();
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
  let stepBudget=baseStepLimit();
  for(let step=0;;step++){
   if(step>=stepBudget){
    const expanded=await askForMoreSteps(stepBudget,text);
    if(expanded<=stepBudget){
     onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION END",message:"Task stopped by user at the execution step limit",meta:{sessionId,stepLimit:stepBudget}});
     const answer="تم إيقاف المهمة عند حد خطوات التنفيذ الحالي. يمكنك زيادة الحد من Performance أو السماح بالمتابعة عند الطلب.";
     history.push({role:"user",content:String(text)},{role:"assistant",content:answer});saveHistory();onEvent({type:"answer",text:answer});return answer;
    }
    stepBudget=expanded;
   }
   onEvent({type:"thinking",step});
   const d=providerDefaults(s.provider),base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");
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
    onEvent({type:"diagnostic",level:"ERROR",stage:timedOut?"LLM REQUEST TIMEOUT":"LLM REQUEST FAILURE",message:timedOut?"LLM API request timed out":e.message});
    const answer="I could not reach the API brain. Please check the provider, API key, and connection.";
    onEvent({type:"answer",text:answer,source:"api-error"});return answer;
   }
   const responseText=await r.text();
   if(!r.ok){
    let detail="";try{const j=JSON.parse(responseText);detail=j?.error?.message||j?.error?.type||""}catch{}
    const transient=r.status===408||r.status===409||r.status===425||r.status===429||r.status>=500;
    const answer=r.status===401||r.status===403?"The API brain rejected the API key. Please check or connect your API key in Settings.":transient?"The API provider is temporarily unavailable. Please try again.":"The API brain returned an error. Please check your API connection in Settings.";
    onEvent({type:"diagnostic",level:"ERROR",stage:"LLM HTTP ERROR",message:"HTTP "+r.status+" from LLM provider"+(detail?": "+detail:"")});
    onEvent({type:"answer",text:answer,source:"api-http-error"});return answer
   }
   let parsed;try{parsed=JSON.parse(responseText)}catch(e){const answer="The API brain returned an invalid response. Please check your API settings.";onEvent({type:"diagnostic",level:"ERROR",stage:"LLM REQUEST FAILURE",message:e.message});onEvent({type:"answer",text:answer,source:"api-invalid-response"});return answer}
   const m=isAnthropic?{content:parsed?.content||[],tool_calls:(parsed?.content||[]).filter(x=>x?.type==="tool_use").map(x=>({id:x.id,function:{name:x.name,arguments:JSON.stringify(x.input||{})}}))}:{content:parsed?.choices?.[0]?.message?.content||"",tool_calls:parsed?.choices?.[0]?.message?.tool_calls||[]};
   if(!m||(!m.content&&!m.tool_calls?.length)){const answer="The API brain did not return an answer. Please check your API settings.";onEvent({type:"diagnostic",level:"ERROR",stage:"LLM REQUEST FAILURE",message:"No model response"});onEvent({type:"answer",text:answer,source:"api-no-response"});return answer}
   onEvent({type:"diagnostic",level:"INFO",stage:"LLM RESPONSE RECEIVED",message:"LLM response received",meta:{provider:s.provider,model:s.model,httpStatus:r.status}});
   const answerText=isAnthropic?(m.content||[]).filter(x=>x?.type==="text").map(x=>x.text||"").join(""):m.content;
   if(!m.tool_calls?.length){
    const answer=answerText||"";
    history.push({role:"user",content:String(text)},{role:"assistant",content:answer});saveHistory();onEvent({type:"answer",text:answer});return answer;
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
    const actionName=String(c.function.name||"");
    const actionText=actionName==="open_url"?"Okay, I’ll open that.":actionName==="open_application"?"Okay, I’ll open it.":actionName==="web_search"?"Okay, I’ll look that up.":actionName==="screenshot"?"Okay, I’ll check the screen.":actionName==="read_file"||actionName==="inspect_document"||actionName==="extract_pdf_text"||actionName==="read_excel"?"Okay, I’ll check that.":"Okay, I’ll do that.";
    onEvent({type:"speech-status",text:actionText});
    onEvent({type:"tool",name:c.function.name,args:a});
    let out;try{out=await registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}
    if(out?.ok===false&&["web_search","fetch_web_page","network_info","read_file","inspect_document","extract_pdf_text","read_excel"].includes(c.function.name)){onEvent({type:"diagnostic",level:"INFO",stage:"TOOL RETRY",message:"Retrying safe read/network tool after failure",meta:{tool:c.function.name}});try{const retry=await registry.call(c.function.name,a);if(retry?.ok!==false)out=retry}catch{}}
    if(out?.ok===false)onEvent({type:"tool_error",name:c.function.name,error:out.error||"Tool failed"});
    else onEvent({type:"tool_result",name:c.function.name,result:out});
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
  onEvent({type:"diagnostic",level:"ERROR",stage:"AGENT STEP LIMIT",message:"Agent reached the execution step limit",meta:{maxSteps:stepBudget}});
  const answer="I reached the safe execution limit before completing the task. The completed steps were preserved; you can ask me to continue.";onEvent({type:"diagnostic",level:"INFO",stage:"AGENT SESSION END",message:"Tool session reached its safe step limit",meta:{sessionId}});
  history.push({role:"user",content:String(text)},{role:"assistant",content:answer});saveHistory();return answer;
 }
}
module.exports={ModelExecutor};
