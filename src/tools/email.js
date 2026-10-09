const email=require("../addons/email");
const client=require("../addons/email-client");
const accounts=require("../addons/email-account-store");
const credentials=require("../addons/credentials");

function schemas(){return[
 {type:"function",function:{name:"email_provider_info",description:"Show supported email providers and protocol server defaults; does not access a mailbox.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]}},required:["provider"]}}},
 {type:"function",function:{name:"email_test_connection",description:"Authenticate against the configured email server without sending or modifying email.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},protocol:{type:"string",enum:["imap","pop3","smtp"]}},required:["provider","account","protocol"]}}},
 {type:"function",function:{name:"email_imap_folders",description:"List mailbox folders through the configured IMAP account.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"}},required:["provider","account"]}}},
 {type:"function",function:{name:"email_imap_search",description:"Search a configured IMAP mailbox. Supported criteria: ALL, UNSEEN, SEEN, FLAGGED, ANSWERED, or a simple FROM/SUBJECT/TO text search.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},mailbox:{type:"string"},criteria:{type:"string",enum:["ALL","UNSEEN","SEEN","FLAGGED","ANSWERED","FROM","SUBJECT","TO"]},value:{type:"string"},limit:{type:"integer"}},required:["provider","account","criteria"]}}},
 {type:"function",function:{name:"email_imap_fetch",description:"Fetch one configured IMAP message by sequence number or UID, returning a bounded raw message excerpt. Reading does not mark the message as read.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},mailbox:{type:"string"},sequence:{type:"string"},uid:{type:"boolean"},headersOnly:{type:"boolean"}},required:["provider","account","sequence"]}}},
 {type:"function",function:{name:"email_pop3_list",description:"List message numbers and sizes from a configured POP3 account without deleting messages.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},limit:{type:"integer"}},required:["provider","account"]}}},
 {type:"function",function:{name:"email_pop3_fetch",description:"Retrieve one message from a configured POP3 account without deleting it.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},index:{type:"integer"}},required:["provider","account","index"]}}},
 {type:"function",function:{name:"email_send",description:"Send an email through the configured SMTP account. This action always requires explicit user confirmation. Do not use for drafts or when the recipient/subject/body is unclear.",parameters:{type:"object",properties:{provider:{type:"string",enum:["gmail","yahoo","hotmail","custom"]},account:{type:"string"},to:{type:"array",items:{type:"string"},minItems:1},subject:{type:"string"},body:{type:"string"}},required:["provider","account","to","subject","body"]}}}
]}
function clean(value,label,max=254){const s=String(value??"").trim();if(!s||s.length>max||/[\r\n\0]/.test(s))throw new Error("Invalid email "+label);return s}
function validateAddress(value){const s=clean(value,"address",320);if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s))throw new Error("Invalid email address: "+s);return s}
function validateMailbox(value){const s=String(value||"INBOX");if(!s||s.length>200||/[\r\n\0]/.test(s))throw new Error("Invalid mailbox name");return s}
async function configFor(args,protocol,context){
 const provider=clean(args.provider,"provider",32).toLowerCase(),account=clean(args.account,"account",254);
 if(!["gmail","yahoo","hotmail","custom"].includes(provider))throw new Error("Unsupported email provider");
 const profile=accounts.get(context.userDataPath,provider,account),saved=profile?.servers?.[protocol]||{},defaults=email.provider(provider)[protocol]||{};
 const server={...defaults,...saved};
 if(!server.host||!server.port)throw new Error("Configure the "+protocol.toUpperCase()+" server in Performance → Email account settings first.");
 const secret=await credentials.get(provider,account);
 if(!secret||!String(secret.username||"").trim()||(!String(secret.password||"")&&!String(secret.accessToken||"")))throw new Error("Save the email account credential in Performance settings first.");
 return{provider,account,protocol,host:server.host,port:Number(server.port),tls:Boolean(server.tls),startTls:Boolean(server.startTls),username:secret.username,password:secret.password,accessToken:secret.accessToken,isCurrent:context.isCurrent};
}
function checkCurrent(context){if(typeof context.isCurrent==="function"&&!context.isCurrent())throw new Error("Email operation cancelled");}
function headers(subject,from,to){return["From: "+from,"To: "+to.join(", "),"Subject: "+subject,"MIME-Version: 1.0",'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit"].join("\r\n")}
async function call(name,args={},context={}){
 if(!name.startsWith("email_"))return null;
 if(name==="email_provider_info"){
  const p=email.provider(args.provider);return{ok:true,provider:String(args.provider),name:p.name,protocols:Object.fromEntries(["imap","pop3","smtp"].map(k=>[k,p[k]||null]))};
 }
 if(name==="email_test_connection"){
  const c=await configFor(args,args.protocol,context);checkCurrent(context);
  if(c.protocol==="imap")await client.imapLogin(c);else if(c.protocol==="pop3")await client.pop3ListMessages(c);else await client.smtpVerify(c);
  return{ok:true,authenticated:true,provider:c.provider,protocol:c.protocol,host:c.host,port:c.port};
 }
 if(name==="email_imap_folders"){
  const c=await configFor(args,"imap",context),folders=await client.imapListFolders(c);checkCurrent(context);return{ok:true,folders:folders.slice(0,200)};
 }
 if(name==="email_imap_search"){
  const c=await configFor(args,"imap",context),criteria=String(args.criteria||"ALL").toUpperCase(),limit=Math.max(1,Math.min(100,Number(args.limit)||25));
  const mailbox=validateMailbox(args.mailbox);
  let query=criteria;
  if(["FROM","SUBJECT","TO"].includes(criteria)){const value=clean(args.value,"search value",200).replace(/(["\\])/g,"\\$1");query=criteria+' "'+value+'"'}
  if(!["ALL","UNSEEN","SEEN","FLAGGED","ANSWERED","FROM","SUBJECT","TO"].includes(criteria))throw new Error("Unsupported IMAP search criterion");
  const ids=await client.imapSearch(c,{mailbox,criteria:query,uid:true});checkCurrent(context);return{ok:true,mailbox,criteria,count:ids.length,messageUids:ids.slice(-limit)};
 }
 if(name==="email_imap_fetch"){
  const c=await configFor(args,"imap",context),sequence=clean(args.sequence,"message sequence",100);
  if(!/^[0-9:* ,]+$/.test(sequence))throw new Error("Invalid IMAP sequence or UID");
  const raw=await client.imapFetch(c,{mailbox:validateMailbox(args.mailbox),sequence,uid:args.uid!==false,headersOnly:Boolean(args.headersOnly)});checkCurrent(context);
  return{ok:true,mailbox:validateMailbox(args.mailbox),message:raw.slice(0,16000),truncated:raw.length>16000,headersOnly:Boolean(args.headersOnly)};
 }
 if(name==="email_pop3_list"){
  const c=await configFor(args,"pop3",context),messages=await client.pop3ListMessages(c);checkCurrent(context);const limit=Math.max(1,Math.min(100,Number(args.limit)||25));return{ok:true,count:messages.length,messages:messages.slice(-limit)};
 }
 if(name==="email_pop3_fetch"){
  const c=await configFor(args,"pop3",context),index=Number(args.index);if(!Number.isSafeInteger(index)||index<1)throw new Error("POP3 message index must be a positive integer");
  const raw=await client.pop3Fetch(c,index);checkCurrent(context);return{ok:true,index,message:raw.slice(0,16000),truncated:raw.length>16000};
 }
 if(name==="email_send"){
  const c=await configFor(args,"smtp",context),to=[].concat(args.to||[]).map(validateAddress);
  if(!to.length||to.length>20)throw new Error("Provide between 1 and 20 recipients");
  const subject=clean(args.subject,"subject",250),body=String(args.body??"");if(!body.trim()||body.length>100000)throw new Error("Email body must contain 1–100000 characters");
  if(/[\r\n\0]/.test(subject))throw new Error("Email subject contains a forbidden line break");
  const from=validateAddress(c.account.includes("@")?c.account:c.username);c.from=from;
  const message=headers(subject,from,to)+"\r\n\r\n"+body.replace(/\r?\n/g,"\r\n");
  checkCurrent(context);await client.smtpSend(c,message);checkCurrent(context);
  return{ok:true,sent:true,from,to,subject,bodyOmitted:true};
 }
 return null;
}
module.exports={schemas,call};
