const fs=require("node:fs"),path=require("node:path");
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
 try{const value=JSON.parse(fs.readFileSync(filePath(userDataPath),"utf8"));return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch(error){if(error?.code==="ENOENT")return{};throw new Error("Email account settings could not be read")}
}
function get(userDataPath,provider,account){const p=String(provider||"").trim().toLowerCase(),a=String(account||"").trim();if(!p||!a)return null;const record=read(userDataPath)[accountId(p,a)];return record&&typeof record==="object"?JSON.parse(JSON.stringify(record)):null}
function save(userDataPath,input){
 const valid=validateRecord(input),file=filePath(userDataPath),all=read(userDataPath),id=accountId(valid.provider,valid.account);
 const previous=all[id]&&typeof all[id]==="object"?all[id]:{provider:valid.provider,account:valid.account,servers:{}};
 const servers={...(previous.servers&&typeof previous.servers==="object"?previous.servers:{})};
 servers[valid.protocol]={host:valid.host,port:valid.port,tls:valid.tls,startTls:valid.startTls};
 all[id]={provider:valid.provider,account:valid.account,servers,updatedAt:new Date().toISOString()};
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+"."+process.pid+".tmp";
 fs.writeFileSync(temporary,JSON.stringify(all,null,2)+"\n",{encoding:"utf8",mode:0o600});
 fs.renameSync(temporary,file);
 return JSON.parse(JSON.stringify(all[id]));
}
module.exports={PROTOCOLS:[...PROTOCOLS],PROVIDERS:[...PROVIDERS],validateRecord,get,save};
