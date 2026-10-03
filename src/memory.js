const memory=require("./core/memory-service");
class Memory{
 constructor(){this.userData=require("electron").app.getPath("userData");memory.ensure(this.userData)}
 add(text,tags=[]){return memory.add(this.userData,text,{tags})}
 search(q){return memory.search(this.userData,q)}
 list(limit=50){return memory.search(this.userData,"").slice(0,Math.max(1,Math.min(200,Number(limit)||50)))}
 forget(query){const q=String(query||"").trim().toLowerCase();if(!q)return{removed:0};const all=memory.listFacts(this.userData);const kept=all.filter(x=>String(x.key||"").toLowerCase()!==q&&!String(x.text||"").toLowerCase().includes(q));memory.writeFacts(this.userData,kept);return{removed:all.length-kept.length}}
 clear(){const all=memory.listFacts(this.userData);memory.writeFacts(this.userData,[]);return{removed:all.length}}
}
module.exports={Memory};
