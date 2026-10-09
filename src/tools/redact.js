const SECRET_KEY=/(?:password|passphrase|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|authorization|credential|bearer|private[_-]?key)/i;
function redactValue(value,key,toolName){
 if(SECRET_KEY.test(String(key||"")))return"[REDACTED]";
 if(String(toolName||"").toLowerCase()==="email_send"&&/^(message|body|content)$/i.test(String(key||"")))return"[REDACTED]";
 if(Array.isArray(value))return value.map(item=>redactValue(item,"",toolName));
 if(value&&typeof value==="object"){const out={};for(const [k,v] of Object.entries(value))out[k]=redactValue(v,k,toolName);return out}
 if(typeof value==="string"&&/^(authorization|cookie)$/i.test(String(key||"")))return"[REDACTED]";
 return value;
}
function redactToolArgs(name,args){return redactValue(args&&typeof args==="object"?args:{}, "", name)}
module.exports={redactToolArgs};
