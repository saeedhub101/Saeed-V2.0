const assert=require("node:assert/strict");
const net=require("node:net");
const {pop3ListMessages,pop3Fetch,smtpSend}=require("../src/addons/email-client");

async function runSmtpTests(){
 const commands=[];let cancelAfterAuth=false,current=true;const bodies=[];
 const server=net.createServer(socket=>{
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
    else if(line===Buffer.from("smtp-password").toString("base64")){if(cancelAfterAuth)current=false;socket.write("235 authenticated\r\n");}
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
  assert.equal(await smtpSend(config,message),true,"SMTP send should complete the protocol transaction");
  assert.ok(commands.includes("MAIL FROM:<sender@example.com>"),"SMTP must send the envelope sender");
  assert.ok(commands.includes("RCPT TO:<recipient@example.com>"),"SMTP must send the recipient");
  assert.ok(bodies.some(body=>body.includes("..leading dot")),"SMTP DATA must dot-stuff message lines");
  assert.ok(commands.includes("QUIT"),"SMTP must close the successful session cleanly");
  const before=commands.length;cancelAfterAuth=true;current=true;
  await assert.rejects(()=>smtpSend({...config,isCurrent:()=>current},message),/cancelled/,"SMTP must stop a cancelled send before the MAIL FROM side effect");
  const cancelled=commands.slice(before);
  assert.ok(cancelled.includes("AUTH LOGIN"),"cancellation test must reach authentication");
  assert.equal(cancelled.some(line=>line.startsWith("MAIL FROM:")),false,"cancelled SMTP operation must not start the mail transaction");
 }finally{await new Promise(resolve=>server.close(()=>resolve()))}
}
async function main(){
 const commands=[];let cancelOnUser=false,current=true;
 const server=net.createServer(socket=>{
  socket.write("+OK Saeed POP3 test server ready\r\n");
  let buffer="";
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");
   let at;
   while((at=buffer.indexOf("\r\n"))>=0){
    const line=buffer.slice(0,at);buffer=buffer.slice(at+2);commands.push(line);
    if(line.startsWith("USER ")){if(cancelOnUser)current=false;socket.write("+OK user accepted\r\n")}
    else if(line.startsWith("PASS "))socket.write("+OK authenticated\r\n");
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
  const beforeCancel=commands.length;cancelOnUser=true;current=true;
  await assert.rejects(()=>pop3ListMessages({...config,isCurrent:()=>current}),/cancelled/,"POP3 operations must stop when the owning request is cancelled");
  assert.equal(commands.slice(beforeCancel).some(line=>line.startsWith("PASS ")),false,"cancelled POP3 authentication must not send the password");
  await runSmtpTests();
  console.log("EMAIL_PROTOCOL=PASS (POP3 listing/retrieval, SMTP send, dot-stuffing, validation, command-injection guard, cancellation)");
 }finally{
  await new Promise(resolve=>server.close(()=>resolve()));
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
