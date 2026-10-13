"use strict";
const fs=require("fs");
const path=require("path");
const {writeJsonAtomic}=require("../main/services/atomic-json-store");
const FILE="learning-experiences.json";
const MAX_RECORDS=120;
function normalize(value){return String(value||"").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s_-]/gu," ").replace(/\s+/g," ").trim().slice(0,300)}
function tokens(value){return [...new Set(normalize(value).split(/[\s_-]+/).filter(x=>x.length>2&&!new Set(["the","and","for","with","from","please","that","this","then","now","من","على","الى","إلى","هذا","هذه","ثم","من فضلك"]).has(x)))];}
function fileFor(userData){return path.join(userData,FILE)}
function load(userData){try{const value=JSON.parse(fs.readFileSync(fileFor(userData),"utf8"));return Array.isArray(value)?value.filter(x=>x&&typeof x==="object"&&typeof x.goal==="string"&&Array.isArray(x.tools)):[]}catch{return[]}}
function save(userData,items){fs.mkdirSync(userData,{recursive:true});const result=writeJsonAtomic(fileFor(userData),items.slice(-MAX_RECORDS));if(!result.ok)throw new Error("Learning experience persistence failed: "+result.error);const persisted=load(userData);if(persisted.length!==Math.min(items.length,MAX_RECORDS))throw new Error("Learning experience persistence verification failed");}
function record(userData,{goal,tools=[],steps=[],outcome="success",failureTool="",verified=false,app="",verification="",notes=""}={}){
 const cleanGoal=String(goal||"").trim().replace(/[\r\n\t]+/g," ").slice(0,240);
 const names=[...tools].map(x=>String(x||"").trim()).filter(x=>/^[a-z][a-z0-9_.-]{0,79}$/i.test(x)).filter(x=>x!=="task_plan").slice(0,24);
 if(cleanGoal.length<8||names.length<2)return{saved:false,reason:"insufficient-experience"};
 const items=load(userData),key=normalize(cleanGoal),existing=items.find(x=>normalize(x.goal)===key);
 const row=existing||{id:require("crypto").createHash("sha256").update(key).digest("hex").slice(0,12),goal:cleanGoal,tools:[],steps:[],successes:0,failures:0,createdAt:new Date().toISOString()};
 if(outcome==="success"&&verified){row.successes++;row.tools=names;row.steps=steps.filter(step=>step&&typeof step.name==="string"&&/^[a-z][a-z0-9_.-]{0,79}$/i.test(step.name)).slice(0,24).map(step=>({name:step.name,fields:[...new Set((Array.isArray(step.fields)?step.fields:[]).map(x=>String(x||"").trim()).filter(x=>/^[a-z][a-z0-9_-]{0,49}$/i.test(x)))].slice(0,10)}));row.lastOutcome="success";row.verified=true;row.failureTool="";row.verification=String(verification||row.verification||"").replace(/[\r\n\t]+/g," ").slice(0,500);row.notes=String(notes||row.notes||"").replace(/[\r\n\t]+/g," ").slice(0,700);if(String(app||"").trim())row.app=String(app).trim().slice(0,120);}
 else{row.failures++;row.lastOutcome="failure";row.verified=false;row.failureTool=String(failureTool||"").slice(0,80);row.notes=String(notes||row.notes||"").replace(/[\r\n\t]+/g," ").slice(0,700);if(String(app||"").trim())row.app=String(app).trim().slice(0,120);}
 row.updatedAt=new Date().toISOString();
 const index=items.findIndex(x=>x.id===row.id);if(index>=0)items[index]=row;else items.push(row);
 save(userData,items);
 return{saved:true,id:row.id,outcome:row.lastOutcome,count:items.length};
}
function recall(userData,query,limit=4){
 const q=tokens(query);if(!q.length)return[];
 return load(userData).map(item=>{
  const goal=tokens(item.goal),context=tokens([item.app,item.verification,item.notes,...(item.tools||[])].filter(Boolean).join(" "));
  const goalHits=q.filter(word=>goal.some(candidate=>candidate===word||candidate.includes(word)||word.includes(candidate))).length;
  const contextHits=q.filter(word=>context.some(candidate=>candidate===word||candidate.includes(word)||word.includes(candidate))).length;
  const goalScore=goalHits/Math.max(1,Math.min(q.length,goal.length));
  const contextScore=contextHits/Math.max(1,q.length);
  const phraseBonus=normalize(item.goal)===normalize(query)?0.35:0;
  const historyCount=Number(item.successes||0)+Number(item.failures||0);
  const quality=historyCount?((Number(item.successes||0)-Number(item.failures||0))/historyCount)*0.12:0;
  const score=Math.max(0,Math.min(1,goalScore*0.78+contextScore*0.22+phraseBonus+quality));
  return{item,score,goalScore};
 }).filter(x=>x.goalScore>=0.25||x.score>=0.38)
 .sort((a,b)=>b.score-a.score)
 .slice(0,Math.max(1,Math.min(10,Number(limit)||4)))
 .map(x=>({...x.item,matchScore:Number(x.score.toFixed(2))}));
}
function promptText(userData,query){
 const hits=recall(userData,query,3);if(!hits.length)return"";
 return"\n\nRelevant experience learned from previous tasks (guidance only; never blindly replay an old action sequence):\n"+hits.map(item=>{
  const reliable=item.successes>item.failures&&item.verified;
  return"- Similar task: "+item.goal+(item.app?"\n  App/context: "+item.app:"")+"\n  Outcome history: "+item.successes+" verified success(es), "+item.failures+" failure(s).\n  "+(reliable?"Previously verified tool sequence: "+(item.steps?.length?item.steps.map(step=>step.name+(step.fields?.length?" ("+step.fields.join(", ")+")":"")).join(" → "):item.tools.join(" → "))+". Adapt it to the current screen, inspect state before acting, and verify the final result.":"This experience is not reliably successful. Treat it as a caution, inspect current state, and choose a safer approach.")+(item.verification?"\n  Verification used: "+item.verification:"")+(item.notes?"\n  Learned notes: "+item.notes:"")+(item.failureTool?"\n  Last failed tool: "+item.failureTool+"; diagnose before retrying.":"");
 }).join("\n").slice(0,3200);
}
module.exports={fileFor,load,record,recall,promptText,normalize};
