const net=require("net"),tls=require("tls");

function escapeQuote(v){return String(v??"").replace(/\\/g,"\\\\").replace(/"/g,'\\"')}

function connect(config,{tlsMode=config.tls}={}){
  return new Promise((resolve,reject)=>{
    const opts={host:config.host,port:Number(config.port),servername:config.host,rejectUnauthorized:true};
    const socket=tlsMode?tls.connect(opts):net.connect(opts);
    let settled=false;
    const done=()=>{if(!settled){settled=true;resolve(socket)}};
    socket.once("connect",done);socket.once("secureConnect",done);socket.once("error",reject);
  });
}

function lineReader(socket){
  let buffer=Buffer.alloc(0),waiters=[];
  const next=()=>new Promise((resolve,reject)=>waiters.push({resolve,reject}));
  socket.on("data",d=>{
    buffer=Buffer.concat([buffer,Buffer.from(d)]);
    let i;
    while((i=buffer.indexOf("\r\n"))>=0){
      const line=buffer.subarray(0,i).toString("utf8");buffer=buffer.subarray(i+2);
      const w=waiters.shift();if(w)w.resolve(line);
    }
  });
  socket.on("error",e=>{for(const w of waiters.splice(0))w.reject(e)});
  socket.setTimeout(20000,()=>socket.destroy(new Error("Email connection timed out")));
  return next;
}

async function smtpSend(config,msg){
  let socket=await connect(config,{tlsMode:Boolean(config.tls)}),next=lineReader(socket),r=await next();
  if(!/^2/.test(r))throw new Error(r);
  let eh=await smtpCommand(socket,next,"EHLO saeed");
  if(config.startTls&&!config.tls){
    if(!/^2/.test(eh))throw new Error(eh);
    r=await smtpCommand(socket,next,"STARTTLS");if(!/^2/.test(r))throw new Error(r);
    socket=tls.connect({socket,servername:config.host,rejectUnauthorized:true});next=lineReader(socket);await next();eh=await smtpCommand(socket,next,"EHLO saeed");
  }
  if(!/^2/.test(eh))throw new Error(eh);
  if(config.accessToken){
    r=await smtpCommand(socket,next,"AUTH XOAUTH2 "+Buffer.from("user="+config.username+"\\x01auth=Bearer "+config.accessToken+"\\x01\\x01").toString("base64"));
  }else if(config.username){
    r=await smtpCommand(socket,next,"AUTH LOGIN");if(!/^3/.test(r))throw new Error(r);
    r=await smtpCommand(socket,next,Buffer.from(config.username).toString("base64"));if(!/^3/.test(r))throw new Error(r);
    r=await smtpCommand(socket,next,Buffer.from(config.password||"").toString("base64"));
  }else r="250";
  if(!/^2/.test(r))throw new Error(r);
  r=await smtpCommand(socket,next,"MAIL FROM:<"+config.from+">");if(!/^2/.test(r))throw new Error(r);
  for(const to of [].concat(config.to||[])){r=await smtpCommand(socket,next,"RCPT TO:<"+to+">");if(!/^2/.test(r))throw new Error(r)}
  r=await smtpCommand(socket,next,"DATA");if(!/^3/.test(r))throw new Error(r);
  socket.write(String(msg).replace(/^\./gm,"..")+"\r\n.\r\n");r=await next();
  try{await smtpCommand(socket,next,"QUIT")}catch{}socket.destroy();if(!/^2/.test(r))throw new Error(r);return true;
}
async function smtpCommand(socket,next,cmd){socket.write(String(cmd)+"\r\n");let lines=[];while(true){const line=await next();lines.push(line);if(/^\d{3} /.test(line))return line}}

async function pop3Auth(config){
  const socket=await connect(config),next=lineReader(socket);let r=await next();if(!/^\+OK/.test(r))throw new Error(r);
  if(config.accessToken){
    socket.write("AUTH XOAUTH2\r\n");r=await next();if(!/^\+/.test(r))throw new Error(r);
    socket.write(Buffer.from("user="+config.username+"\\x01auth=Bearer "+config.accessToken+"\\x01\\x01").toString("base64")+"\r\n");r=await next();
  }else{
    socket.write("USER "+config.username+"\r\n");r=await next();if(!/^\+OK/.test(r))throw new Error(r);
    socket.write("PASS "+config.password+"\r\n");r=await next();
  }
  if(!/^\+OK/.test(r)){socket.destroy();throw new Error(r)}return{socket,next};
}
async function pop3List(config){const c=await pop3Auth(config);c.socket.write("STAT\r\n");const r=await c.next();try{c.socket.write("QUIT\r\n")}catch{}c.socket.destroy();return r}
async function pop3Fetch(config,index){const c=await pop3Auth(config);c.socket.write("RETR "+Number(index)+"\r\n");let lines=[];while(true){const line=await c.next();if(line===".")break;lines.push(line.replace(/^\.\./,"."))}try{c.socket.write("QUIT\r\n")}catch{}c.socket.destroy();return lines.join("\r\n")}

function imapSession(config){
  return connect(config,{tlsMode:true}).then(async socket=>{
    const next=lineReader(socket),greeting=await next();if(!/^\*/.test(greeting))throw new Error(greeting);
    let counter=0;
    const command=async(command,continuation)=>{
      const tag="S"+(++counter).toString(36).toUpperCase();
      socket.write(tag+" "+command+"\r\n");
      const lines=[];
      while(true){
        const line=await next();
        if(line.startsWith("+ ")||line==="+"){
          if(continuation)socket.write(String(continuation)+"\r\n");
          continue;
        }
        lines.push(line);
        if(line.startsWith(tag+" ")){
          if(!/\bOK\b/i.test(line))throw new Error(line);
          return lines;
        }
      }
    };
    return{socket,command,close:()=>socket.destroy()};
  });
}
async function imapLoginSession(config){
  const s=await imapSession(config);
  if(config.accessToken){
    await s.command("AUTHENTICATE XOAUTH2",Buffer.from("user="+config.username+"\\x01auth=Bearer "+config.accessToken+"\\x01\\x01").toString("base64"));
  }else{
    await s.command('LOGIN "'+escapeQuote(config.username)+'" "'+escapeQuote(config.password||"")+'"');
  }
  return s;
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
    return r.filter(x=>/^\* \d+ FETCH /.test(x)).join("\n");
  }finally{s.close()}
}
module.exports={smtpSend,pop3List,pop3Fetch,imapProbe,imapLogin,imapListFolders,imapSelect,imapSearch,imapFetch};
