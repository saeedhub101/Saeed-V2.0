const {redactToolArgs,redactToolResult}=require("../tools/redact");
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const {writeJsonAtomic}=require("../main/services/atomic-json-store");
const ROOT_NAME="skills",MAX_STEPS=100;
function root(userData){return path.join(userData,ROOT_NAME)}
function ensure(userData){fs.mkdirSync(root(userData),{recursive:true});return root(userData)}
function safeId(id){const v=String(id||"").trim();if(!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(v))throw new Error("Invalid skill id");return v}
function fileFor(userData,id){return path.join(root(userData),safeId(id)+".json")}
function normalize(s){return String(s||"").toLowerCase().normalize("NFKC").replace(/[?!.,،؛:]/g," ").replace(/\s+/g," ").trim()}
function validate(skill){if(!skill||typeof skill!=="object")throw new Error("Invalid skill");const id=safeId(skill.id||crypto.createHash("sha256").update(String(skill.name||Date.now())).digest("hex").slice(0,12));const phrases=Array.isArray(skill.trigger?.phrases)?skill.trigger.phrases.map(normalize).filter(Boolean):[];if(!phrases.length)throw new Error("At least one trigger phrase is required");if(!Array.isArray(skill.steps)||!skill.steps.length||skill.steps.length>MAX_STEPS)throw new Error("Skill must contain 1-"+MAX_STEPS+" steps");for(const step of skill.steps){if(!step||typeof step.tool!=="string"||!/^[a-z0-9_.-]+$/i.test(step.tool))throw new Error("Invalid skill tool");if(step.args!=null&&(typeof step.args!=="object"||Array.isArray(step.args)))throw new Error("Skill step args must be an object")}const parameters=(Array.isArray(skill.parameters)?skill.parameters:[]).slice(0,30).map(p=>{const name=String(p?.name||"").trim();if(!/^[a-z][a-z0-9_]{0,39}$/i.test(name))throw new Error("Invalid skill parameter name");return{name,description:String(p.description||name).slice(0,180),aliases:[...new Set([name.replace(/([a-z0-9])([A-Z])/g,"$1 $2"),...(Array.isArray(p.aliases)?p.aliases:[])].map(x=>String(x||"").trim()).filter(Boolean))].slice(0,20),required:p.required!==false}});return{schemaVersion:3,version:Number(skill.version)||1,id,name:String(skill.name||id),description:String(skill.description||""),trigger:{phrases},parameters,steps:skill.steps.map(s=>({tool:String(s.tool),args:s.args||{}})),createdAt:skill.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),enabled:skill.enabled!==false,approval:skill.approval||"per-tool",metadata:skill.metadata||{}}}
function list(userData){ensure(userData);return fs.readdirSync(root(userData),{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(".json")).flatMap(x=>{try{return[validate(JSON.parse(fs.readFileSync(path.join(root(userData),x.name),"utf8")))]}catch{return[]}})}
function get(userData,id){const f=fileFor(userData,id);if(!fs.existsSync(f))return null;return validate(JSON.parse(fs.readFileSync(f,"utf8")))}
function save(userData,skill){const v=validate(skill);ensure(userData);const f=fileFor(userData,v.id),result=writeJsonAtomic(f,v);if(!result.ok)throw new Error("Learned skill persistence failed: "+result.error);const persisted=get(userData,v.id);if(!persisted||persisted.id!==v.id||persisted.steps.length!==v.steps.length)throw new Error("Learned skill persistence verification failed");return persisted}
function remove(userData,id){const f=fileFor(userData,id);if(!fs.existsSync(f))return false;fs.unlinkSync(f);return true}
function setEnabled(userData,id,enabled){const s=get(userData,id);if(!s)throw new Error("Skill not found: "+id);s.enabled=Boolean(enabled);s.updatedAt=new Date().toISOString();return save(userData,s)}
function extractParameters(skill,text){
 const source=String(text||""),values={};
 const parameters=Array.isArray(skill?.parameters)?skill.parameters:[];
 for(const parameter of parameters){
  const aliases=[parameter.name,...(parameter.aliases||[])].filter(Boolean).sort((a,b)=>String(b).length-String(a).length);
  for(const alias of aliases){
   const escaped=String(alias).replace(/[\.\*\+\?\^\$\{\}\(\)\|\[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
   let matchValue=null;
   try{matchValue=source.match(new RegExp("(?:^|[\\s,;،])"+escaped+"\\s*(?:(?:is|=|:|هو|هي)\\s*)?([^,;\\n]+)","i"))}catch{}
   if(matchValue?.[1]){
    const value=String(matchValue[1]).trim().replace(/^[\s"'“”]+|[\s"'“”]+$/g,"").replace(/[.؟?!]+$/g,"").trim();
    if(value){values[parameter.name]=value;break}
   }
  }
 }
 return values;
}
function resolveTemplate(value,variables){
 if(typeof value==="string")return value.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi,(_,name)=>{if(!Object.prototype.hasOwnProperty.call(variables||{},name))throw new Error("Missing skill parameter: "+name);return String(variables[name])});
 if(Array.isArray(value))return value.map(item=>resolveTemplate(item,variables));
 if(value&&typeof value==="object"){const out={};for(const [key,item] of Object.entries(value))out[key]=resolveTemplate(item,variables);return out}
 return value;
}
function match(userData,text){
 const n=normalize(text);if(!n)return null;
 const skills=list(userData).filter(skill=>skill.enabled!==false);
 const exact=skills.find(skill=>(skill.trigger?.phrases||[]).some(phrase=>normalize(phrase)===n));
 if(exact)return exact;
 const stop=new Set(["a","an","the","please","my","this","that","for","to","of","in","on","at","with","and","then","now","me","من","في","على","الى","إلى","هذه","هذا","ذلك","تلك","من فضلك","رجاء","الآن","لي","ثم"]);
 const tokens=value=>new Set(normalize(value).split(/\s+/).filter(token=>token.length>1&&!stop.has(token)));
 const query=tokens(n);if(query.size<2)return null;
 const ranked=[];
 for(const skill of skills){
  let best=0;
  for(const phrase of skill.trigger?.phrases||[]){
   const trigger=tokens(phrase);if(trigger.size<2)continue;
   let overlap=0;for(const token of trigger)if(query.has(token))overlap++;
   const recall=overlap/trigger.size,precision=overlap/query.size;
   const score=0.75*recall+0.25*precision;
   if(score>best)best=score;
  }
  if(best>=0.78)ranked.push({skill,score:best});
 }
 ranked.sort((a,b)=>b.score-a.score);
 if(!ranked.length||ranked.length>1&&ranked[0].score-ranked[1].score<0.15)return null;
 return Object.assign({},ranked[0].skill,{matchScore:Number(ranked[0].score.toFixed(3)),matchType:"fuzzy"});
}
function exportSkill(userData,id){const s=get(userData,id);if(!s)throw new Error("Skill not found: "+id);return JSON.stringify(s,null,2)}
function importSkill(userData,data){return save(userData,typeof data==="string"?JSON.parse(data):data)}
function beginRecording(userData,name,phrases=[]){ensure(userData);const id=String(name||"skill").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"skill-"+Date.now();return{recording:true,skill:{schemaVersion:2,version:1,id,name:String(name||id),trigger:{phrases:Array.isArray(phrases)?phrases.map(normalize).filter(Boolean):[]},parameters:[],steps:[],approval:"per-tool"}}}
function parameterNameFromControl(label,automationId){
 let raw=String(label||"").trim();
 if(!raw||["name","id","date","number","type","value","code","text","email","address"].includes(raw.toLowerCase()))raw=String(automationId||raw).trim();
 raw=raw.replace(/^(?:txt|text|input|field|edit|cmb|combo|ddl)[_-]?/i,"").replace(/(?:textBox|textbox|input|edit|comboBox|combo|field)$/i,"");
 const words=raw.replace(/([a-z0-9])([A-Z])/g,"$1 $2").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]+/gi)||[];
 if(!words.length)return null;
 const name=words.map((word,index)=>index===0?word.toLowerCase():word[0].toUpperCase()+word.slice(1).toLowerCase()).join("");
 if(!/^[a-z][a-z0-9_]{0,39}$/i.test(name)||["edit","text","textbox","input","field","combobox"].includes(name.toLowerCase()))return null;
 return name;
}
function recordStep(session,tool,args){
 if(!session?.recording)throw new Error("Recorder is not running");
 if(session.skill.steps.length>=MAX_STEPS)throw new Error("Recorder step limit reached");
 const input=args&&typeof args==="object"&&!Array.isArray(args)?{...args}:{};
 const windowInfo=input._window&&typeof input._window==="object"?input._window:{};
 delete input._window;
 session.skill.parameters=Array.isArray(session.skill.parameters)?session.skill.parameters:[];
 let selectedTool=String(tool),selectedArgs=input;
 const controlType=String(windowInfo.controlType||""),label=String(windowInfo.control||"").trim(),automationId=String(windowInfo.automationId||"").trim();
 if(selectedTool==="mouse_click"&&input.button!=="right"&&Number.isInteger(Number(windowInfo.elementIndex))&&Number(windowInfo.elementIndex)>=0&&(label||automationId||windowInfo.bounds)){
  let action=null;
  if(/\.Button$/i.test(controlType)||/\.Hyperlink$/i.test(controlType)||/\.MenuItem$/i.test(controlType))action="invoke";
  else if(/\.Edit$/i.test(controlType)||/\.Document$/i.test(controlType))action="focus";
  else if(/\.ComboBox$/i.test(controlType))action="expand";
  else if(/\.CheckBox$/i.test(controlType))action="toggle";
  else if(/\.RadioButton$|\.ListItem$|\.TabItem$|\.TreeItem$/i.test(controlType))action="select";
  if(action){selectedTool="interact_ui_element";selectedArgs={pid:Number(windowInfo.pid)||0,windowTitle:String(windowInfo.title||""),elementIndex:Number(windowInfo.elementIndex),action,expectedName:label,automationId,controlType,expectedBounds:windowInfo.bounds||undefined}}
 }
 if(selectedTool==="type_text"&&typeof input.text==="string"&&input.text.length){
  const isField=/\.(?:Edit|ComboBox|Document)$/i.test(controlType);
  const parameterName=isField?parameterNameFromControl(label,automationId):null;
  if(parameterName){
   let name=parameterName,number=2;const identityAlias=(automationId||label).toLowerCase();
   while(session.skill.parameters.some(parameter=>parameter.name===name)&&!(session.skill.parameters.find(parameter=>parameter.name===name)?.aliases||[]).some(alias=>String(alias).toLowerCase()===identityAlias))name=parameterName+number++;
   let parameter=session.skill.parameters.find(item=>item.name===name);
   if(!parameter){parameter={name,description:(label&&!["name","id","date","number","type","value","code","text","email","address"].includes(label.toLowerCase()))?label:automationId||label,aliases:[],required:true};session.skill.parameters.push(parameter)}
   for(const alias of [label,automationId].filter(Boolean))if(!parameter.aliases.some(item=>String(item).toLowerCase()===alias.toLowerCase()))parameter.aliases.push(alias);
   selectedArgs={...input,text:"{{"+name+"}}"};
  }
 }
 session.skill.steps.push({tool:selectedTool,args:selectedArgs});
 return session.skill;
}
function finishRecording(userData,session){if(!session?.recording)throw new Error("Recorder is not running");session.recording=false;if(!session.skill.trigger.phrases.length)session.skill.trigger.phrases=[normalize(session.skill.name)];return save(userData,session.skill)}
async function run(userData,registry,skill,{isCurrent=()=>true,onEvent=()=>{},variables={}}={}){
 const current=()=>{try{return typeof isCurrent==="function"?Boolean(isCurrent()):true}catch{return false}};
 const emit=typeof onEvent==="function"?onEvent:()=>{},results=[],resolvedSteps=[];
 const missing=(skill.parameters||[]).filter(parameter=>parameter.required!==false&&!String(variables?.[parameter.name]??"").trim()).map(parameter=>parameter.name);
 if(missing.length)return{ok:false,skill:skill.id,missingParameters:missing};
 for(const step of skill.steps){try{resolvedSteps.push({...step,args:resolveTemplate(step.args||{},variables||{})})}catch(error){return{ok:false,skill:skill.id,missingParameters:[String(error.message||error).replace(/^Missing skill parameter:\s*/,"")]}}}
 for(const step of resolvedSteps){
  if(!current())return{ok:false,stale:true,skill:skill.id,results};
  const args=step.args||{};
  emit({type:"tool",name:step.tool,args:redactToolArgs(step.tool,args)});
  const out=await registry.call(step.tool,args,{isCurrent:current});
  if(!current())return{ok:false,stale:true,skill:skill.id,results};
  results.push({tool:step.tool,result:redactToolResult(step.tool,out)});
  if(out===null||out===undefined||out?.ok===false){emit({type:"tool_error",name:step.tool,error:out?.error||"Tool returned no verifiable result"});throw new Error("Learned skill failed at "+step.tool+": "+(out?.error||"tool returned no verifiable result"))}
  emit({type:"tool_result",name:step.tool,result:redactToolResult(step.tool,out)});
 }
 return{ok:true,skill:skill.id,results};
}
module.exports={root,ensure,list,get,save,remove,setEnabled,match,run,extractParameters,resolveTemplate,exportSkill,importSkill,beginRecording,recordStep,finishRecording,normalize};