"use strict";
const fs=require("fs");
const path=require("path");
const FILE="learning-experiences.json";
const MAX_RECORDS=120;
function normalize(value){return String(value||"").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s_-]/gu," ").replace(/\s+/g," ").trim().slice(0,300)}
function tokens(value){return [...new Set(normalize(value).split(/[\s_-]+/).filter(x=>x.length>2&&!new Set(["the","and","for","with","from","please","that","this","then","now","من","على","الى","إلى","هذا","هذه","ثم","من فضلك"]).has(x)))];}
function fileFor(userData){return path.join(userData,FILE)}
function load(userData){try{const value=JSON.parse(fs.readFileSync(fileFor(userData),"utf8"));return Array.isArray(value)?value.filter(x=>x&&typeof x==="object"&&typeof x.goal==="string"&&Array.isArray(x.tools)):[]}catch{return[]}}
function save(userData,items){fs.mkdirSync(userData,{recursive:true});const file=fileFor(userData),tmp=file+"."+process.pid+".tmp";fs.writeFileSync(tmp,JSON.stringify(items.slice(-MAX_RECORDS),null,2),"utf8");fs.renameSync(tmp,file)}
function record(userData,{goal,tools=[],outcome="success",failureTool="",verified=false}={}){
 const cleanGoal=String(goal||"").trim().replace(/[\r\n\t]+/g," ").slice(0,240);
 const names=[...tools].map(x=>String(x||"").trim()).filter(x=>/^[a-z][a-z0-9_.-]{0,79}$/i.test(x)).filter(x=>x!=="task_plan").slice(0,24);
 if(cleanGoal.length<8||names.length<2)return{saved:false,reason:"insufficient-experience"};
 const items=load(userData),key=normalize(cleanGoal),existing=items.find(x=>normalize(x.goal)===key);
 const row=existing||{id:require("crypto").createHash("sha256").update(key).digest("hex").slice(0,12),goal:cleanGoal,tools:[],successes:0,failures:0,createdAt:new Date().toISOString()};
 if(outcome==="success"&&verified){row.successes++;row.tools=names;row.lastOutcome="success";row.verified=true;row.failureTool="";}
 else{row.failures++;row.lastOutcome="failure";row.verified=false;row.failureTool=String(failureTool||"").slice(0,80);}
 row.updatedAt=new Date().toISOString();
 const index=items.findIndex(x=>x.id===row.id);if(index>=0)items[index]=row;else items.push(row);
 save(userData,items);
 return{saved:true,id:row.id,outcome:row.lastOutcome,count:items.length};
}
function recall(userData,query,limit=4){
 const q=tokens(query);if(!q.length)return[];
 return load(userData).map(item=>{const words=tokens(item.goal);let overlap=0;for(const word of q)if(words.some(candidate=>candidate===word||candidate.includes(word)||word.includes(candidate)))overlap++;const score=overlap/Math.max(1,Math.min(q.length,words.length));return{item,score}}).filter(x=>x.score>=0.34).sort((a,b)=>(b.score+(b.item.successes>=b.item.failures?0.08:0))-(a.score+(a.item.successes>=a.item.failures?0.08:0))).slice(0,limit).map(x=>({...x.item,matchScore:Number(x.score.toFixed(2))}));
}
function promptText(userData,query){
 const hits=recall(userData,query,3);if(!hits.length)return"";
 return"\n\nRelevant experience learned from previous tasks (guidance only; never blindly replay an old action sequence):\n"+hits.map(item=>{
  const reliable=item.successes>item.failures&&item.verified;
  return"- Similar task: "+item.goal+"\n  Outcome history: "+item.successes+" verified success(es), "+item.failures+" failure(s).\n  "+(reliable?"Previously verified tool sequence: "+item.tools.join(" → ")+". Adapt it to the current screen, inspect state before acting, and verify the final result.":"This experience is not reliably successful. Treat it as a caution, inspect current state, and choose a safer approach.")+(item.failureTool?"\n  Last failed tool: "+item.failureTool+"; diagnose before retrying.":"");
 }).join("\n").slice(0,3200);
}
module.exports={fileFor,load,record,recall,promptText,normalize};
