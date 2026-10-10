const net=require("net"),tls=require("tls");

function escapeQuote(v){const value=String(v??"");if(/[\r\n\0]/.test(value))throw new Error("Email protocol argument contains a forbidden line break");return value.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}

function connect(config,{tlsMode=config.tls,isCurrent=config.isCurrent}={}){
  return new Promise((resolve,reject)=>{
    const opts={host:config.host,port:Number(config.port),servername:config.host,rejectUnauthorized:true};
    const socket=tlsMode?tls.connect(opts):net.connect(opts);
    const earlyChunks=[];
    const captureEarlyData=chunk=>earlyChunks.push(Buffer.from(chunk));
    socket.on("data",captureEarlyData);
    socket.__saeedEarlyData={chunks:earlyChunks,listener:captureEarlyData};
    let settled=false,connectTimer=null,cancelTimer=null;
    const cleanup=()=>{if(connectTimer)clearTimeout(connectTimer);if(cancelTimer)clearInterval(cancelTimer);connectTimer=null;cancelTimer=null};
    const fail=error=>{if(!settled){settled=true;cleanup();try{socket.destroy()}catch{}reject(error)}else{cleanup();try{socket.destroy()}catch{}}};
    const done=()=>{if(!settled){settled=true;if(connectTimer)clearTimeout(connectTimer);connectTimer=null;resolve(socket)}};
    connectTimer=setTimeout(()=>fail(new Error("Email connection timed out")),20000);
    if(typeof isCurrent==="function")cancelTimer=setInterval(()=>{let current=true;try{current=Boolean(isCurrent())}catch{current=false}if(!current)fail(new Error("Email operation cancelled"))},100);
    socket.once("connect",done);socket.once("secureConnect",done);socket.once("error",fail);socket.once("close",cleanup);
  });
}
function lineReader(socket){
  const early=socket.__saeedEarlyData;
  let buffer=early?.chunks?.length?Buffer.concat(early.chunks):Buffer.alloc(0),lines=[],waiters=[];
  if(early){socket.removeListener("data",early.listener);delete socket.__saeedEarlyData;}
  const drain=()=>{
    let i;
    while((i=buffer.indexOf("\r\n"))>=0){
      lines.push(buffer.subarray(0,i).toString("utf8"));
      buffer=buffer.subarray(i+2);
    }
    while(lines.length&&waiters.length)waiters.shift().resolve(lines.shift());
  };
  const next=()=>new Promise((resolve,reject)=>{waiters.push({resolve,reject});drain()});
  socket.on("data",d=>{buffer=Buffer.concat([buffer,Buffer.from(d)]);drain()});
  socket.on("error",e=>{for(const w of waiters.splice(0))w.reject(e)});
  socket.setTimeout(20000,()=>socket.destroy(new Error("Email connection timed out")));
  drain();
  return next;
}
function assertCurrent(config){if(typeof config?.isCurrent==="function"&&!config.isCurrent())throw new Error("Email operation cancelled")}
async function smtpVerify(config){
 let socket=await connect(config,{tlsMode:Boolean(config.tls)}),next=lineReader(socket);
 try{
  assertCurrent(config);let r=await next();assertCurrent(config);if(!/^2/.test(r))throw new Error(r);
  let eh=await smtpCommand(socket,next,"EHLO saeed",config);
  if(config.startTls&&!config.tls){
   if(!/^2/.test(eh))throw new Error(eh);
   r=await smtpCommand(socket,next,"STARTTLS",config);if(!/^2/.test(r))throw new Error(r);
   socket=tls.connect({socket,servername:config.host,rejectUnauthorized:true});next=lineReader(socket);await next();assertCurrent(config);eh=await smtpCommand(socket,next,"EHLO saeed",config);
  }
  if(!/^2/.test(eh))throw new Error(eh);
  if(config.accessToken){
   r=await smtpCommand(socket,next,"AUTH XOAUTH2 "+Buffer.from("user="+config.username+"\x01auth=Bearer "+config.accessToken+"\x01\x01").toString("base64"),config);
  }else if(config.username){
   r=await smtpCommand(socket,next,"AUTH LOGIN",config);if(!/^3/.test(r))throw new Error(r);
   r=await smtpCommand(socket,next,Buffer.from(config.username).toString("base64"),config);if(!/^3/.test(r))throw new Error(r);
   r=await smtpCommand(socket,next,Buffer.from(config.password||"").toString("base64"),config);
  }else throw new Error("SMTP authentication credentials are required");
  if(!/^2/.test(r))throw new Error(r);
  try{await smtpCommand(socket,next,"QUIT",config)}catch{}return true;
 }finally{try{socket.destroy()}catch{}}
}
async function smtpSend(config,msg){
 let socket=await connect(config,{tlsMode:Boolean(config.tls)}),next=lineReader(socket);
 try{
  assertCurrent(config);let r=await next();assertCurrent(config);if(!/^2/.test(r))throw new Error(r);
  let eh=await smtpCommand(socket,next,"EHLO saeed",config);
  if(config.startTls&&!config.tls){
   if(!/^2/.test(eh))throw new Error(eh);
   r=await smtpCommand(socket,next,"STARTTLS",config);if(!/^2/.test(r))throw new Error(r);
   socket=tls.connect({socket,servername:config.host,rejectUnauthorized:true});next=lineReader(socket);await next();assertCurrent(config);eh=await smtpCommand(socket,next,"EHLO saeed",config);
  }
  if(!/^2/.test(eh))throw new Error(eh);
  if(config.accessToken){
   r=await smtpCommand(socket,next,"AUTH XOAUTH2 "+Buffer.from("user="+config.username+"\x01auth=Bearer "+config.accessToken+"\x01\x01").toString("base64"),config);
  }else if(config.username){
   r=await smtpCommand(socket,next,"AUTH LOGIN",config);if(!/^3/.test(r))throw new Error(r);
   r=await smtpCommand(socket,next,Buffer.from(config.username).toString("base64"),config);if(!/^3/.test(r))throw new Error(r);
   r=await smtpCommand(socket,next,Buffer.from(config.password||"").toString("base64"),config);
  }else r="250";
  if(!/^2/.test(r))throw new Error(r);
  r=await smtpCommand(socket,next,"MAIL FROM:<"+config.from+">",config);if(!/^2/.test(r))throw new Error(r);
  for(const to of [].concat(config.to||[])){assertCurrent(config);r=await smtpCommand(socket,next,"RCPT TO:<"+to+">",config);if(!/^2/.test(r))throw new Error(r)}
  assertCurrent(config);r=await smtpCommand(socket,next,"DATA",config);if(!/^3/.test(r))throw new Error(r);
  assertCurrent(config);socket.write(String(msg).replace(/^\./gm,"..")+"\r\n.\r\n");r=await next();assertCurrent(config);
  if(!/^2/.test(r))throw new Error(r);
  try{await smtpCommand(socket,next,"QUIT",config)}catch{}return true;
 }finally{try{socket.destroy()}catch{}}
}
async function smtpCommand(socket,next,cmd,config){
 assertCurrent(config);socket.write(String(cmd)+"\r\n");const lines=[];
 while(true){const line=await next();assertCurrent(config);lines.push(line);if(/^\d{3} /.test(line))return line}
}

async function pop3Auth(config){
  assertCurrent(config);
  for(const [label,value] of [["username",config.username],["password",config.password]])if(/[\r\n\0]/.test(String(value??"")))throw new Error("POP3 "+label+" contains a forbidden line break");
  const socket=await connect(config),next=lineReader(socket);
  try{
    assertCurrent(config);let r=await next();assertCurrent(config);if(!/^\+OK/.test(r))throw new Error(r);
    if(config.accessToken){
      assertCurrent(config);socket.write("AUTH XOAUTH2\r\n");r=await next();assertCurrent(config);if(!/^\+/.test(r))throw new Error(r);
      assertCurrent(config);socket.write(Buffer.from("user="+config.username+"\x01auth=Bearer "+config.accessToken+"\x01\x01").toString("base64")+"\r\n");r=await next();assertCurrent(config);
    }else{
      assertCurrent(config);socket.write("USER "+config.username+"\r\n");r=await next();assertCurrent(config);if(!/^\+OK/.test(r))throw new Error(r);
      assertCurrent(config);socket.write("PASS "+config.password+"\r\n");r=await next();assertCurrent(config);
    }
    if(!/^\+OK/.test(r))throw new Error(r);return{socket,next};
  }catch(error){socket.destroy();throw error}
}
async function pop3List(config){const c=await pop3Auth(config);try{assertCurrent(config);c.socket.write("STAT\r\n");const r=await c.next();assertCurrent(config);if(!/^\+OK/.test(r))throw new Error(r);return r}finally{try{c.socket.write("QUIT\r\n")}catch{}c.socket.destroy()}}
async function pop3ListMessages(config){const c=await pop3Auth(config);try{assertCurrent(config);c.socket.write("LIST\r\n");const status=await c.next();assertCurrent(config);if(!/^\+OK/.test(status))throw new Error(status);const lines=[];while(true){const line=await c.next();assertCurrent(config);if(line===".")break;lines.push(line.replace(/^\.\./,"."))}return lines.map(line=>{const m=line.match(/^(\d+)\s+(\d+)$/);return m?{index:Number(m[1]),size:Number(m[2])}:null}).filter(Boolean)}finally{try{c.socket.write("QUIT\r\n")}catch{}c.socket.destroy()}}
async function pop3Fetch(config,index){const n=Number(index);if(!Number.isSafeInteger(n)||n<1)throw new Error("POP3 message index must be a positive integer");assertCurrent(config);const c=await pop3Auth(config);try{assertCurrent(config);c.socket.write("RETR "+n+"\r\n");const status=await c.next();assertCurrent(config);if(!/^\+OK/.test(status))throw new Error(status);const lines=[];while(true){const line=await c.next();assertCurrent(config);if(line===".")break;lines.push(line.replace(/^\.\./,"."))}return lines.join("\r\n")}finally{try{c.socket.write("QUIT\r\n")}catch{}c.socket.destroy()}}

function imapSession(config){
  return connect(config,{tlsMode:config.tls!==false}).then(async socket=>{
    try{
      assertCurrent(config);const next=lineReader(socket),greeting=await next();assertCurrent(config);if(!/^\*/.test(greeting))throw new Error(greeting);
      let counter=0;
      const command=async(command,continuation)=>{
        assertCurrent(config);const tag="S"+(++counter).toString(36).toUpperCase();socket.write(tag+" "+command+"\r\n");
        const lines=[];
        while(true){
          const line=await next();assertCurrent(config);
          if(line.startsWith("+ ")||line==="+"){if(continuation){assertCurrent(config);socket.write(String(continuation)+"\r\n")}continue}
          lines.push(line);
          if(line.startsWith(tag+" ")){if(!/\bOK\b/i.test(line))throw new Error(line);return lines}
        }
      };
      return{socket,command,close:()=>socket.destroy()};
    }catch(error){socket.destroy();throw error}
  });
}
async function imapLoginSession(config){
  const s=await imapSession(config);
  try{
    assertCurrent(config);
    if(config.accessToken){
      await s.command("AUTHENTICATE XOAUTH2",Buffer.from("user="+config.username+"\x01auth=Bearer "+config.accessToken+"\x01\x01").toString("base64"));
    }else{
      await s.command('LOGIN "'+escapeQuote(config.username)+'" "'+escapeQuote(config.password||"")+'"');
    }
    assertCurrent(config);return s;
  }catch(error){s.close();throw error}
}
async function imapProbe(config){const s=await imapSession(config);try{const r=await s.command("CAPABILITY");return r.join("\n")}finally{s.close()}}
async function imapLogin(config){const s=await imapLoginSession(config);s.close();return true}
async function imapListFolders(config){
  const s=await imapLoginSession(config);try{return(await s.command('LIST "" "*"')).filter(x=>/^\* LIST /.test(x))}finally{s.close()}
}
async function imapSelect(config,mailbox="INBOX"){
  const s=await imapLoginSession(config);try{return(await s.command('SELECT "'+escapeQuote(mailbox)+'"')).filter(x=>/^\* /.test(x))}finally{s.close()}
}
async function imapSearch(config,{mailbox="INBOX",criteria="ALL",uid=true}={}){
  const s=await imapLoginSession(config);try{await s.command('SELECT "'+escapeQuote(mailbox)+'"');const r=await s.command((uid?"UID ":"")+"SEARCH "+criteria);return r.filter(x=>/^\* SEARCH/.test(x)).join(" ").replace(/^\* SEARCH\s*/,"").trim().split(/\s+/).filter(Boolean)}finally{s.close()}
}
async function imapFetch(config,{mailbox="INBOX",sequence=1,uid=true,headersOnly=false}={}){
  const s=await imapLoginSession(config);try{
    await s.command('SELECT "'+escapeQuote(mailbox)+'"');
    const item=String(sequence).replace(/[^0-9:* ,]/g,"");
    const what=headersOnly?"BODY.PEEK[HEADER]":"BODY.PEEK[]";
    const r=await s.command((uid?"UID ":"")+"FETCH "+item+" ("+what+")");
    const start=r.findIndex(x=>/^\* \d+ FETCH /.test(x));
    if(start<0)return"";
    return r.slice(start).filter(x=>!/^S[0-9A-Z]+ (?:OK|NO|BAD)\b/i.test(x)).join("\n");
  }finally{s.close()}
}
module.exports={smtpSend,smtpVerify,pop3List,pop3ListMessages,pop3Fetch,imapProbe,imapLogin,imapListFolders,imapSelect,imapSearch,imapFetch};
