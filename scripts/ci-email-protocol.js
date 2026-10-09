const assert=require("node:assert/strict");
const net=require("node:net");
const {pop3ListMessages,pop3Fetch}=require("../src/addons/email-client");

async function main(){
 const commands=[];
 const server=net.createServer(socket=>{
  socket.write("+OK Saeed POP3 test server ready\r\n");
  let buffer="";
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");
   let at;
   while((at=buffer.indexOf("\r\n"))>=0){
    const line=buffer.slice(0,at);buffer=buffer.slice(at+2);commands.push(line);
    if(line.startsWith("USER "))socket.write("+OK user accepted\r\n");
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
  console.log("EMAIL_PROTOCOL=PASS (POP3 listing, retrieval, dot-stuffing, index validation, credential command-injection guard)");
 }finally{
  await new Promise(resolve=>server.close(()=>resolve()));
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
