const fs=require("fs"),path=require("path");
function filePath(userDataPath){return path.join(String(userDataPath||process.cwd()),"memory.json")}
function read(userDataPath){
 const file=filePath(userDataPath);
 try{const value=JSON.parse(fs.readFileSync(file,"utf8"));return Array.isArray(value)?value:[]}
 catch{return[]}
}
function write(userDataPath,items){
 const dir=String(userDataPath||process.cwd());
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(filePath(dir),JSON.stringify(items,null,2),"utf8");
}
function tokens(value){return String(value||"").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)}
function score(text,query){
 const q=tokens(query),t=tokens(text);
 if(!q.length)return 0;
 const set=new Set(t);
 return q.reduce((n,x)=>n+(set.has(x)?1:0),0)/q.length;
}
function add(userDataPath,text,metadata={}){
 const value=String(text||"").trim();
 if(!value)return{ok:false,error:"Memory text is empty"};
 const items=read(userDataPath);
 const item={id:Date.now().toString()+"-"+Math.random().toString(36).slice(2,8),text:value,metadata,createdAt:new Date().toISOString()};
 items.push(item);write(userDataPath,items);
 return item;
}
function search(userDataPath,query="",limit=50){
 const items=read(userDataPath),q=String(query||"").trim(),max=Math.max(1,Math.min(500,Number(limit)||50));
 if(!q)return items.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,max).map(x=>({...x,score:0}));
 return items.map(x=>({...x,score:score(x.text,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,max);
}
function forget(userDataPath,query){
 const q=String(query||"").trim().toLowerCase();if(!q)return{ok:false,removed:0};
 const items=read(userDataPath),kept=[],removed=[];
 for(const item of items){const hit=String(item.id).toLowerCase()===q||String(item.text).toLowerCase().includes(q);(hit?removed:kept).push(item)}
 write(userDataPath,kept);return{ok:true,removed:removed.length,ids:removed.map(x=>x.id)};
}
module.exports={add,search,forget,filePath};
