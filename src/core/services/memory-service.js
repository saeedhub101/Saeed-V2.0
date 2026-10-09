// Compatibility facade: all first-party memory operations share the authoritative
// persistent service used by ConversationAgent. Do not create a second memory.json.
const service=()=>require("../../main/services/memory-service");
function add(userDataPath,text,metadata={}){return service().add(userDataPath,text,metadata)}
function search(userDataPath,query="",limit=50){
 const s=service(),q=String(query||"").trim();
 if(!q)return s.listFacts(userDataPath).slice(0,Math.max(1,Math.min(500,Number(limit)||50))).map(item=>({...item,score:0}));
 return s.rag(userDataPath,q,Math.max(1,Math.min(500,Number(limit)||50)));
}
function addFact(userDataPath,text){return service().addFact(userDataPath,text)}
function listFacts(userDataPath){return service().listFacts(userDataPath)}
function forget(userDataPath,query){return service().forget(userDataPath,query)}
function filePath(userDataPath){return service().factsFile(userDataPath)}
module.exports={add,search,forget,filePath,addFact,listFacts};
