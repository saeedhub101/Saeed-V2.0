const fs=require("fs"),path=require("path"),{app,safeStorage}=require("electron");
const {ImapFlow}=require("imapflow");
const nodemailer=require("nodemailer");
const Pop3Command=require("node-pop3");
const {simpleParser}=require("mailparser");

const PROVIDERS={
 gmail:{label:"Gmail",domains:["gmail.com","googlemail.com"],imap:{host:"imap.gmail.com",port:993,secure:true},pop3:{host:"pop.gmail.com",port:995,tls:true},smtp:{host:"smtp.gmail.com",port:465,secure:true}},
 yahoo:{label:"Yahoo",domains:["yahoo.com","yahoo.co.uk","ymail.com","rocketmail.com"],imap:{host:"imap.mail.yahoo.com",port:993,secure:true},pop3:{host:"pop.mail.yahoo.com",port:995,tls:true},smtp:{host:"smtp.mail.yahoo.com",port:465,secure:true}},
 hotmail:{label:"Hotmail / Outlook",domains:["hotmail.com","outlook.com","live.com","msn.com"],imap:{host:"outlook.office365.com",port:993,secure:true},pop3:{host:"outlook.office365.com",port:995,tls:true},smtp:{host:"smtp-mail.outlook.com",port:587,secure:false,requireTLS:true}}
};

class EmailService{
 constructor({onEvent}={}){
  this.onEvent=typeof onEvent==="function"?onEvent:()=>{};
  this.file=path.join(app.getPath("userData"),"email-accounts.json");
  this.calendarFile=path.join(app.getPath("userData"),"email-calendar.json");
  this.accounts=this.read(this.file,{accounts:[]});
  if(!Array.isArray(this.accounts.accounts))this.accounts={accounts:[]};
  this.calendar=this.read(this.calendarFile,{events:[],contacts:[]});
  this.reminderTimer=null;this.lastReminderDay="";
 }
 read(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
 write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),"utf8")}
 providerFor(email){const domain=String(email||"").toLowerCase().split("@").pop();for(const [id,p] of Object.entries(PROVIDERS))if(p.domains.includes(domain))return id;return "others"}
 config(provider,email){if(provider!=="others")return PROVIDERS[provider];const a=this.accounts.accounts.find(x=>x.email===email);return a?.config||null}
 encrypt(v){try{return safeStorage.isEncryptionAvailable()?safeStorage.encryptString(String(v||"")).toString("base64"):String(v||"")}catch{return String(v||"")}}
 decrypt(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 publicAccounts(){return this.accounts.accounts.map(a=>({id:a.id,email:a.email,provider:a.provider,label:a.label,protocol:a.protocol||"imap",connected:a.connected===true,lastSync:a.lastSync||null,calendarEvents:a.calendarEvents||0,contacts:a.contacts||0}))}
 find(email){return this.accounts.accounts.find(a=>a.email.toLowerCase()===String(email||"").toLowerCase())}
 save(){this.write(this.file,this.accounts)}
 async verifyImap(cfg,email,password){if(!cfg?.imap)throw new Error("IMAP settings are missing.");const c=new ImapFlow({host:cfg.imap.host,port:cfg.imap.port,secure:cfg.imap.secure,auth:{user:email,pass:password},logger:false});await c.connect();const mb=await c.mailboxOpen("INBOX",{readOnly:true});const count=Number(mb?.exists||0);await c.logout();return{count}}
 async verifyPop(cfg,email,password){if(!cfg?.pop3)throw new Error("POP3 settings are missing.");const p=new Pop3Command({user:email,password,host:cfg.pop3.host,port:cfg.pop3.port,tls:cfg.pop3.tls});await p.connect();await p.command("USER",email);await p.command("PASS",password);const [stat]=await p.command("STAT");await p.command("QUIT");return{stat:String(stat||"")}}
 async verifySmtp(cfg,email,password){if(!cfg?.smtp)throw new Error("SMTP settings are missing.");const t=nodemailer.createTransport({host:cfg.smtp.host,port:cfg.smtp.port,secure:cfg.smtp.secure,requireTLS:!!cfg.smtp.requireTLS,auth:{user:email,pass:password}});await t.verify();t.close();return true}
 async connect(input){
  const email=String(input.email||"").trim().toLowerCase(),password=String(input.password||"");
  if(!email||!password)throw new Error("Email and password are required.");
  const provider=String(input.provider||this.providerFor(email));let cfg=PROVIDERS[provider]||input.config;
  if(provider==="others"){cfg={imap:{host:String(input.imapHost||""),port:Number(input.imapPort||993),secure:true},pop3:{host:String(input.popHost||""),port:Number(input.popPort||995),tls:true},smtp:{host:String(input.smtpHost||""),port:Number(input.smtpPort||587),secure:Number(input.smtpPort||587)===465,requireTLS:Number(input.smtpPort||587)===587}};if(!cfg.imap.host||!cfg.smtp.host)throw new Error("Other provider requires IMAP and SMTP host settings.")}
  const protocol=input.protocol==="pop3"?"pop3":"imap";
  if(protocol==="imap")await this.verifyImap(cfg,email,password);else await this.verifyPop(cfg,email,password);
  await this.verifySmtp(cfg,email,password);
  const existing=this.find(email),account={...(existing||{}),id:existing?.id||Date.now().toString(36),email,provider,label:PROVIDERS[provider]?.label||"Other",protocol,config:cfg,password:this.encrypt(password),connected:true,lastConnected:new Date().toISOString(),calendarEvents:existing?.calendarEvents||0,contacts:existing?.contacts||0};
  this.accounts.accounts=this.accounts.accounts.filter(a=>a.email!==email);this.accounts.accounts.push(account);this.save();this.onEvent({type:"email-connected",email,provider});return{email,provider,label:account.label,protocol,connected:true};
 }
 async syncAccount(email){
  const a=this.find(email);if(!a)throw new Error("Email account is not connected.");const password=this.decrypt(a.password);if(!password)throw new Error("Saved email credential is unavailable.");
  if(a.protocol==="pop3")return this.syncPop(a,password);
  const client=new ImapFlow({host:a.config.imap.host,port:a.config.imap.port,secure:a.config.imap.secure,auth:{user:a.email,pass:password},logger:false});
  const events=[],contacts=[],messages=[];
  try{await client.connect();await client.mailboxOpen("INBOX",{readOnly:true});const ids=await client.search({all:true});const recent=ids.slice(-20);
   for(const id of recent){const m=await client.fetchOne(id,{envelope:true,source:true},{uid:true});messages.push({id,subject:m.envelope?.subject||"",from:m.envelope?.from?.[0]?.address||"",date:m.envelope?.date||null});
    if(m.source)try{const parsed=await simpleParser(m.source);for(const att of parsed.attachments||[]){const name=String(att.filename||"").toLowerCase();if(name.endsWith(".ics"))events.push(...this.parseIcs(att.content.toString("utf8"),a.email));if(name.endsWith(".vcf")||name.endsWith(".vcard"))contacts.push(...this.parseVcf(att.content.toString("utf8"),a.email));}}catch{}
   }await client.logout();
  }catch(e){try{await client.logout()}catch{}throw e}
  this.mergeCalendar(a.email,events);this.mergeContacts(a.email,contacts);a.lastSync=new Date().toISOString();a.calendarEvents=this.calendar.events.filter(x=>x.account===a.email).length;a.contacts=this.calendar.contacts.filter(x=>x.account===a.email).length;this.save();return{messages,events:a.calendarEvents,contacts:a.contacts};
 }
 async syncPop(a,password){const p=new Pop3Command({user:a.email,password,host:a.config.pop3.host,port:a.config.pop3.port,tls:a.config.pop3.tls});await p.connect();await p.command("USER",a.email);await p.command("PASS",password);const [stat]=await p.command("STAT");await p.command("QUIT");a.lastSync=new Date().toISOString();this.save();return{messages:[],events:a.calendarEvents||0,contacts:a.contacts||0,pop3:String(stat||"")}}
 parseIcs(raw,email){const out=[];const blocks=String(raw||"").split(/BEGIN:VEVENT/i).slice(1);for(const b of blocks){const summary=(b.match(/SUMMARY(?:;[^:]*)?:([^\r\n]+)/i)||[])[1];const dt=(b.match(/DTSTART(?:;[^:]*)?:(\d{8})(?:T(\d{6})Z?)?/i)||[]);if(!dt[1])continue;const y=dt[1].slice(0,4),mo=dt[1].slice(4,6),d=dt[1].slice(6,8);out.push({id:email+":"+dt[1]+":"+(summary||""),account:email,title:String(summary||"Calendar event").trim(),date:y+"-"+mo+"-"+d,source:"ics",reminded:false})}return out}
 parseVcf(raw,email){return String(raw||"").split(/BEGIN:VCARD/i).slice(1).map(b=>({account:email,name:(b.match(/FN:([^\r\n]+)/i)||[])[1]||"Unknown",email:(b.match(/EMAIL[^:]*:([^\r\n]+)/i)||[])[1]||"",birthday:(b.match(/BDAY:([^\r\n]+)/i)||[])[1]||"",source:"vcard"})).filter(x=>x.name!=="Unknown"||x.email)}
 mergeCalendar(email,items){const keep=this.calendar.events.filter(x=>x.account!==email);const map=new Map([...keep,...items].map(x=>[x.id,x]));this.calendar.events=[...map.values()];this.write(this.calendarFile,this.calendar)}
 mergeContacts(email,items){const keep=this.calendar.contacts.filter(x=>x.account!==email);this.calendar.contacts=[...keep,...items];this.write(this.calendarFile,this.calendar)}
 startReminders(show){if(this.reminderTimer)return;this.reminderTimer=setInterval(()=>this.checkReminders(show),60000);this.reminderTimer.unref?.();this.checkReminders(show)}
 checkReminders(show){const today=new Date().toISOString().slice(0,10);if(this.lastReminderDay===today)return;const due=this.calendar.events.filter(e=>e.date===today&&!e.reminded);for(const e of due){e.reminded=true;try{show({title:"Saeed reminder",message:"Today: "+e.title})}catch{}}if(due.length){this.write(this.calendarFile,this.calendar);this.lastReminderDay=today}}
 stop(){if(this.reminderTimer)clearInterval(this.reminderTimer);this.reminderTimer=null}
}
module.exports={EmailService,PROVIDERS};
