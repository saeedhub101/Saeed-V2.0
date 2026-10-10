const assert=require("node:assert/strict");
const net=require("node:net"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {pop3ListMessages,pop3Fetch,smtpSend,smtpVerify,imapLogin,imapListFolders,imapSearch,imapFetch}=require("../src/addons/email-client");
const emailAccounts=require("../src/addons/email-account-store");

async function runSmtpTests(){
 const commands=[];let cancelAfterAuth=false,rejectAuth=false,current=true;const bodies=[];
 const server=net.createServer(socket=>{
  socket.on("error",()=>{});
  socket.write("220 Saeed SMTP test server ready\r\n");let buffer="",dataMode=false;
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");
   while(true){
    if(dataMode){
     const end=buffer.indexOf("\r\n.\r\n");if(end<0)return;
     bodies.push(buffer.slice(0,end));buffer=buffer.slice(end+5);dataMode=false;socket.write("250 queued\r\n");continue;
    }
    const at=buffer.indexOf("\r\n");if(at<0)return;
    const line=buffer.slice(0,at);buffer=buffer.slice(at+2);commands.push(line);
    if(line==="EHLO saeed")socket.write("250-test\r\n250 AUTH LOGIN\r\n");
    else if(line==="AUTH LOGIN")socket.write("334 username\r\n");
    else if(line===Buffer.from("smtp-user").toString("base64"))socket.write("334 password\r\n");
    else if(line===Buffer.from("smtp-password").toString("base64")){if(rejectAuth)socket.write("535 authentication failed\r\n");else{if(cancelAfterAuth)current=false;socket.write("235 authenticated\r\n")}}
    else if(line.startsWith("MAIL FROM:"))socket.write("250 sender accepted\r\n");
    else if(line.startsWith("RCPT TO:"))socket.write("250 recipient accepted\r\n");
    else if(line==="DATA"){dataMode=true;socket.write("354 send data\r\n");}
    else if(line==="QUIT")socket.end("221 bye\r\n");
    else socket.write("500 unexpected command\r\n");
   }
  });
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const config={host:"127.0.0.1",port:server.address().port,tls:false,startTls:false,username:"smtp-user",password:"smtp-password",from:"sender@example.com",to:["recipient@example.com"]};
 try{
  const message="From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: protocol test\r\n\r\nhello\r\n.leading dot";
  const beforeVerify=commands.length;
  assert.equal(await smtpVerify(config),true,"SMTP authentication test should complete without sending mail");
  const verifyCommands=commands.slice(beforeVerify);
  assert.ok(verifyCommands.includes("AUTH LOGIN"),"SMTP verification must authenticate the saved account");
  assert.ok(verifyCommands.includes("QUIT"),"SMTP verification must close the session cleanly");
  assert.equal(verifyCommands.some(line=>line.startsWith("MAIL FROM:")),false,"SMTP verification must not start a mail transaction");
  assert.equal(await smtpSend(config,message),true,"SMTP send should complete the protocol transaction");
  assert.ok(commands.includes("MAIL FROM:<sender@example.com>"),"SMTP must send the envelope sender");
  assert.ok(commands.includes("RCPT TO:<recipient@example.com>"),"SMTP must send the recipient");
  assert.ok(bodies.some(body=>body.includes("..leading dot")),"SMTP DATA must dot-stuff message lines");
  assert.ok(commands.includes("QUIT"),"SMTP must close the successful session cleanly");
  const authFailureStart=commands.length;rejectAuth=true;
  await assert.rejects(()=>smtpVerify(config),/535|authentication failed/i,"SMTP authentication failures must be surfaced without beginning a send");
  const authFailureCommands=commands.slice(authFailureStart);
  assert.equal(authFailureCommands.some(line=>line.startsWith("MAIL FROM:")),false,"SMTP auth failure must never begin the message transaction");
  rejectAuth=false;
  const closedSmtpPort=await closedPort();
  await assert.rejects(()=>smtpVerify({...config,port:closedSmtpPort}),/ECONNREFUSED|connect|timed out/i,"SMTP connection failures must reject deterministically");
  const before=commands.length;cancelAfterAuth=true;current=true;
  await assert.rejects(()=>smtpSend({...config,isCurrent:()=>current},message),/cancelled/,"SMTP must stop a cancelled send before the MAIL FROM side effect");
  const cancelled=commands.slice(before);
  assert.ok(cancelled.includes("AUTH LOGIN"),"cancellation test must reach authentication");
  assert.equal(cancelled.some(line=>line.startsWith("MAIL FROM:")),false,"cancelled SMTP operation must not start the mail transaction");
 }finally{await new Promise(resolve=>server.close(()=>resolve()))}
}
async function closedPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});const port=server.address().port;await new Promise(resolve=>server.close(()=>resolve()));return port}
async function runImapTests(){
 const commands=[];let rejectAuth=false,cancelOnLogin=false,current=true;
 const server=net.createServer(socket=>{socket.on("error",()=>{});socket.write("* OK Saeed IMAP test server ready\\r\\n");let buffer="";socket.on("data",chunk=>{buffer+=chunk.toString("utf8");let at;while((at=buffer.indexOf("\\r\\n"))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+2);const split=line.indexOf(" ");if(split<0)continue;const tag=line.slice(0,split),command=line.slice(split+1);commands.push(command);if(command.startsWith("LOGIN ")){if(rejectAuth)socket.write(tag+" NO Authentication failed\\r\\n");else{if(cancelOnLogin)current=false;socket.write(tag+" OK logged in\\r\\n")}}else if(command.startsWith("LIST "))socket.write("* LIST (\\\\HasNoChildren) \"/\" \"INBOX\"\\r\\n"+tag+" OK list complete\\r\\n");else if(command.startsWith("SELECT "))socket.write("* 2 EXISTS\\r\\n"+tag+" OK selected\\r\\n");else if(command.startsWith("UID SEARCH "))socket.write("* SEARCH 4 9\\r\\n"+tag+" OK search complete\\r\\n");else if(command.startsWith("UID FETCH ")){const message="Subject: IMAP test\\r\\nFrom: sender@example.com\\r\\n\\r\\nHello from IMAP";socket.write("* 4 FETCH (UID 4 BODY.PEEK[] {"+Buffer.byteLength(message,"utf8")+"}\\r\\n"+message+"\\r\\n)\\r\\n"+tag+" OK fetch complete\\r\\n")}else if(command==="CAPABILITY")socket.write("* CAPABILITY IMAP4rev1\\r\\n"+tag+" OK capability\\r\\n");else socket.write(tag+" OK command complete\\r\\n")}})});
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const config={host:"127.0.0.1",port:server.address().port,tls:false,username:"imap-user",password:"imap-password",isCurrent:()=>current};
 try{
  assert.equal(await imapLogin(config),true,"IMAP login should authenticate");
  const folders=await imapListFolders(config);assert.ok(folders.some(line=>line.includes("INBOX")),"IMAP must list mailbox folders");
  const ids=await imapSearch(config,{mailbox:"INBOX",criteria:"ALL",uid:true});assert.deepEqual(ids,["4","9"],"IMAP search must return message UIDs");
  const message=await imapFetch(config,{mailbox:"INBOX",sequence:"4",uid:true});assert.match(message,/Subject: IMAP test/);assert.match(message,/Hello from IMAP/,"IMAP FETCH must include the literal message body, not just the FETCH descriptor");
  const authStart=commands.length;rejectAuth=true;await assert.rejects(()=>imapLogin(config),/Authentication failed/i);assert.equal(commands.slice(authStart).some(line=>line.startsWith("LIST ")||line.startsWith("SELECT ")||line.startsWith("UID SEARCH")),false,"failed IMAP authentication must not continue to mailbox commands");rejectAuth=false;
  const cancelStart=commands.length;cancelOnLogin=true;current=true;await assert.rejects(()=>imapListFolders(config),/cancelled/i,"IMAP operations must stop when their conversation is cancelled");assert.equal(commands.slice(cancelStart).some(line=>line.startsWith("LIST ")),false,"cancelled IMAP login must not list folders");cancelOnLogin=false;current=true;
  const closedImapPort=await closedPort();await assert.rejects(()=>imapLogin({...config,port:closedImapPort,isCurrent:()=>true}),/ECONNREFUSED|connect|timed out/i,"IMAP connection failures must reject deterministically");
 }finally{await new Promise(resolve=>server.close(()=>resolve()))}
}
function testEmailAccountStore(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-email-profile-"));
 try{
  emailAccounts.save(dir,{provider:"custom",account:"demo@example.com",protocol:"imap",host:"imap.demo.example",port:993,tls:true});
  emailAccounts.save(dir,{provider:"custom",account:"demo@example.com",protocol:"smtp",host:"smtp.demo.example",port:587,tls:false,startTls:true});
  const account=emailAccounts.get(dir,"custom","demo@example.com");
  assert.equal(account.servers.imap.host,"imap.demo.example","IMAP settings must persist per account");
  assert.equal(account.servers.smtp.startTls,true,"SMTP STARTTLS settings must persist independently");
  assert.equal(Object.hasOwn(account,"password"),false,"email server profile must never contain account credentials");
  assert.throws(()=>emailAccounts.save(dir,{provider:"custom",account:"demo@example.com",protocol:"pop3",host:"bad.example\r\nQUIT",port:995,tls:true}),/host/,"server host must reject line breaks");
  assert.throws(()=>emailAccounts.save(dir,{provider:"custom",account:"demo@example.com",protocol:"pop3",host:"pop.demo.example",port:70000,tls:true}),/port/,"server port must be validated");
  const corrupt=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-email-corrupt-profile-"));try{const file=path.join(corrupt,"email-accounts.json");fs.writeFileSync(file,"[]","utf8");assert.throws(()=>emailAccounts.save(corrupt,{provider:"custom",account:"demo@example.com",protocol:"imap",host:"imap.demo.example",port:993,tls:true}),/invalid structure/);assert.equal(fs.readFileSync(file,"utf8"),"[]","corrupt email account settings must not be silently overwritten")}finally{fs.rmSync(corrupt,{recursive:true,force:true})}
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
async function main(){
 const commands=[];let cancelOnUser=false,rejectPopAuth=false,current=true;
 const server=net.createServer(socket=>{
  socket.on("error",()=>{});
  socket.write("+OK Saeed POP3 test server ready\r\n");
  let buffer="";
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");
   let at;
   while((at=buffer.indexOf("\r\n"))>=0){
    const line=buffer.slice(0,at);buffer=buffer.slice(at+2);commands.push(line);
    if(line.startsWith("USER ")){if(cancelOnUser)current=false;socket.write("+OK user accepted\r\n")}
    else if(line.startsWith("PASS "))socket.write(rejectPopAuth?"-ERR authentication failed\r\n":"+OK authenticated\r\n");
    else if(line==="STAT")socket.write("+OK 2 123\r\n");
    else if(line==="LIST")socket.write("+OK scan listing follows\r\n1 80\r\n2 43\r\n.\r\n");
    else if(line==="RETR 2")socket.write("+OK 43 octets\r\nSubject: demo\r\n\r\nfirst line\r\n..dot-stuffed line\r\n.\r\n");
    else if(line==="QUIT"){socket.end("+OK bye\r\n");}
    else socket.write("-ERR unsupported test command\r\n");
   }
  });
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const config={host:"127.0.0.1",port:server.address().port,tls:false,username:"test-user",password:"test-password"};
 try{
  const messages=await pop3ListMessages(config);
  assert.deepEqual(messages,[{index:1,size:80},{index:2,size:43}],"POP3 LIST must return parsed message indexes and byte sizes");
  const message=await pop3Fetch(config,2);
  assert.equal(message,"Subject: demo\r\n\r\nfirst line\r\n.dot-stuffed line","POP3 RETR must return the complete message and unescape dot-stuffing");
  assert.ok(commands.includes("LIST"),"POP3 listing must issue LIST");
  assert.ok(commands.includes("RETR 2"),"POP3 fetch must issue RETR for the selected message");
  await assert.rejects(()=>pop3Fetch(config,0),/positive integer/,"invalid POP3 indexes must be rejected before network access");
  await assert.rejects(()=>pop3ListMessages({...config,username:"bad\r\nQUIT"}),/forbidden line break/,"POP3 credentials must not permit command injection");
  const authFailureStart=commands.length;rejectPopAuth=true;await assert.rejects(()=>pop3ListMessages(config),/authentication failed/i,"POP3 authentication failures must be surfaced");assert.equal(commands.slice(authFailureStart).some(line=>line==="LIST"||line==="STAT"||line.startsWith("RETR ")),false,"POP3 auth failure must not continue to mailbox commands");rejectPopAuth=false;
  const closedPopPort=await closedPort();await assert.rejects(()=>pop3ListMessages({...config,port:closedPopPort}),/ECONNREFUSED|connect|timed out/i,"POP3 connection failures must reject deterministically");
  const beforeCancel=commands.length;cancelOnUser=true;current=true;
  await assert.rejects(()=>pop3ListMessages({...config,isCurrent:()=>current}),/cancelled/,"POP3 operations must stop when the owning request is cancelled");
  assert.equal(commands.slice(beforeCancel).some(line=>line.startsWith("PASS ")),false,"cancelled POP3 authentication must not send the password");
  await runSmtpTests();
  await runImapTests();
  testEmailAccountStore();
  console.log("EMAIL_PROTOCOL=PASS (IMAP/POP3 listing and retrieval, SMTP authentication/send, auth/connection failures, persistence, cancellation)");
 }finally{
  await new Promise(resolve=>server.close(()=>resolve()));
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
