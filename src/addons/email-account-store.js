const fs=require("node:fs"),path=require("node:path");
const {writeJsonAtomic}=require("../main/services/atomic-json-store");
const PROTOCOLS=new Set(["imap","pop3","smtp"]);
const PROVIDERS=new Set(["gmail","yahoo","hotmail","custom"]);
function accountId(provider,account){return String(provider||"").trim().toLowerCase()+":"+encodeURIComponent(String(account||"").trim().toLowerCase())}
function validateRecord(input={}){
 const provider=String(input.provider||"").trim().toLowerCase(),account=String(input.account||"").trim(),protocol=String(input.protocol||"").trim().toLowerCase();
 if(!PROVIDERS.has(provider))throw new Error("Unsupported email provider");
 if(!account||account.length>254||/[\r\n\0]/.test(account))throw new Error("Invalid email account key");
 if(!PROTOCOLS.has(protocol))throw new Error("Unsupported email protocol");
 const host=String(input.host||"").trim();
 if(!host||host.length>253||!/^[a-zA-Z0-9.:[\]-]+$/.test(host))throw new Error("Invalid email server host");
 const port=Number(input.port);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Invalid email server port");
 const tls=Boolean(input.tls),startTls=Boolean(input.startTls);
 if(protocol!=="smtp"&&startTls)throw new Error("STARTTLS is supported only for SMTP");
 if(protocol==="smtp"&&tls&&startTls)throw new Error("Choose direct TLS or STARTTLS, not both");
 return{provider,account,protocol,host,port,tls,startTls:protocol==="smtp"&&startTls};
}
function filePath(userDataPath){if(!userDataPath)throw new Error("User data path is required");return path.join(userDataPath,"email-accounts.json")}
function read(userDataPath){
 let raw;try{raw=fs.readFileSync(filePath(userDataPath),"utf8")}catch(error){if(error?.code==="ENOENT")return{};throw new Error("Email account settings could not be read")}
 let value;try{value=JSON.parse(raw)}catch(error){throw new Error("Email account settings are invalid JSON; refusing to overwrite existing settings ("+error.message+")")}
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Email account settings have an invalid structure; refusing to overwrite existing settings");
 for(const [id,record] of Object.entries(value))if(!id||!record||typeof record!=="object"||Array.isArray(record))throw new Error("Email account settings contain an invalid record; refusing to overwrite existing settings");
 return value;
}
function get(userDataPath,provider,account){const p=String(provider||"").trim().toLowerCase(),a=String(account||"").trim();if(!p||!a)return null;const record=read(userDataPath)[accountId(p,a)];return record&&typeof record==="object"?JSON.parse(JSON.stringify(record)):null}
function save(userDataPath,input){
 const valid=validateRecord(input),file=filePath(userDataPath),all=read(userDataPath),id=accountId(valid.provider,valid.account);
 const previous=all[id]&&typeof all[id]==="object"?all[id]:{provider:valid.provider,account:valid.account,servers:{}};
 const servers={...(previous.servers&&typeof previous.servers==="object"?previous.servers:{})};
 servers[valid.protocol]={host:valid.host,port:valid.port,tls:valid.tls,startTls:valid.startTls};
 all[id]={provider:valid.provider,account:valid.account,servers,updatedAt:new Date().toISOString()};
 const result=writeJsonAtomic(file,all);if(!result.ok)throw new Error("Email account settings persistence failed: "+result.error);
 const persisted=read(userDataPath)[id],stored=persisted?.servers?.[valid.protocol];
 if(!stored||stored.host!==valid.host||Number(stored.port)!==valid.port||Boolean(stored.tls)!==valid.tls||Boolean(stored.startTls)!==valid.startTls)throw new Error("Email account settings failed read-back verification");
 return JSON.parse(JSON.stringify(persisted));
}
module.exports={PROTOCOLS:[...PROTOCOLS],PROVIDERS:[...PROVIDERS],validateRecord,get,save};
