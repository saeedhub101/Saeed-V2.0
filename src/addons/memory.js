const fs=require("fs"),path=require("path"),crypto=require("crypto");
function root(userData){return path.join(userData,"memory")}
function ensure(userData){fs.mkdirSync(root(userData),{recursive:true});fs.mkdirSync(path.join(root(userData),"knowledge"),{recursive:true});fs.mkdirSync(path.join(root(userData),"conversations"),{recursive:true});return root(userData)}
function key(text){return crypto.createHash("sha256").update(String(text||"")).digest("hex")}
function remember(userData,text,meta={}){ensure(userData);const item={id:key(text+Date.now()),text:String(text||""),metadata:meta,createdAt:new Date().toISOString()};fs.appendFileSync(path.join(root(userData),"conversations","memory.jsonl"),JSON.stringify(item)+"\n");return item}
function addKnowledge(userData,title,text,metadata={}){ensure(userData);const item={id:key(title+text),title,text,metadata,updatedAt:new Date().toISOString()};fs.writeFileSync(path.join(root(userData),"knowledge",item.id+".json"),JSON.stringify(item,null,2));return item}
function listKnowledge(userData){ensure(userData);return fs.readdirSync(path.join(root(userData),"knowledge")).filter(x=>x.endsWith(".json")).map(x=>JSON.parse(fs.readFileSync(path.join(root(userData),"knowledge",x),"utf8")))}
module.exports={ensure,remember,addKnowledge,listKnowledge};
