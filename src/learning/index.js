const fs=require("fs"),path=require("path"),crypto=require("crypto");
const ROOT_NAME="skills";
function root(userData){return path.join(userData,ROOT_NAME)}
function ensure(userData){fs.mkdirSync(root(userData),{recursive:true});return root(userData)}
function safeId(id){const v=String(id||"").trim();if(!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(v))throw new Error("Invalid skill id");return v}
function fileFor(userData,id){return path.join(root(userData),safeId(id)+".json")}
function normalize(s){return String(s||"").toLowerCase().normalize("NFKC").replace(/[?!.,،؛:]/g," ").replace(/\s+/g," ").trim()}
function validate(skill){
 if(!skill||typeof skill!=="object")throw new Error("Invalid skill");
 const id=safeId(skill.id||crypto.createHash("sha256").update(String(skill.name||Date.now())).digest("hex").slice(0,12));
 const phrases=Array.isArray(skill.trigger?.phrases)?skill.trigger.phrases.map(normalize).filter(Boolean):[];
 if(!phrases.length)throw new Error("At least one trigger phrase is required");
 if(!Array.isArray(skill.steps)||!skill.steps.length)throw new Error("At least one step is required");
 for(const step of skill.steps){if(!step||typeof step.tool!=="string"||!/^[a-z0-9_.-]+$/i.test(step.tool))throw new Error("Invalid skill tool");if(step.args!=null&&typeof step.args!=="object")throw new Error("Skill step args must be an object")}
 return {version:1,id,name:String(skill.name||id),description:String(skill.description||""),trigger:{phrases},steps:skill.steps.map(s=>({tool:String(s.tool),args:s.args||{}})),createdAt:skill.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),enabled:skill.enabled!==false}
}
function list(userData){ensure(userData);return fs.readdirSync(root(userData),{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(".json")).flatMap(x=>{try{return[JSON.parse(fs.readFileSync(path.join(root(userData),x.name),"utf8"))]}catch{return[]}})}
function get(userData,id){const f=fileFor(userData,id);if(!fs.existsSync(f))return null;return validate(JSON.parse(fs.readFileSync(f,"utf8")))}
function save(userData,skill){const v=validate(skill);ensure(userData);fs.writeFileSync(fileFor(userData,v.id),JSON.stringify(v,null,2),"utf8");return v}
function remove(userData,id){const f=fileFor(userData,id);if(!fs.existsSync(f))return false;fs.unlinkSync(f);return true}
function setEnabled(userData,id,enabled){const s=get(userData,id);if(!s)throw new Error("Skill not found: "+id);s.enabled=Boolean(enabled);s.updatedAt=new Date().toISOString();return save(userData,s)}
function match(userData,text){const n=normalize(text);if(!n)return null;return list(userData).find(s=>s.enabled!==false&&(s.trigger?.phrases||[]).some(p=>normalize(p)===n))||null}
function exportSkill(userData,id){const s=get(userData,id);if(!s)throw new Error("Skill not found: "+id);return JSON.stringify(s,null,2)}
function importSkill(userData,data){const value=typeof data==="string"?JSON.parse(data):data;return save(userData,value)}
async function run(userData,registry,skill){const results=[];for(const step of skill.steps){const out=await registry.call(step.tool,step.args||{});results.push({tool:step.tool,args:step.args||{},result:out});if(out?.ok===false)throw new Error("Learned skill failed at "+step.tool+": "+(out.error||"unknown error"))}return{ok:true,skill:skill.id,results}}
module.exports={root,ensure,list,get,save,remove,setEnabled,match,run,exportSkill,importSkill,normalize};
