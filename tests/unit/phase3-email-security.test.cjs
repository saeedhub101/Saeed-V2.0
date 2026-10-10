"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {sanitizeEmailError}=require("../../src/tools/email");
const source=require("node:fs").readFileSync(require("node:path").join(__dirname,"../../src/tools/email.js"),"utf8");

test("email protocol errors redact raw credentials, base64 credentials, and private message content",()=>{
 const secret={username:"person@example.com",password:"mail-password-42",accessToken:"oauth-token-secret-77"};
 const sasl=Buffer.from("user="+secret.username+"\x01auth=Bearer "+secret.accessToken+"\x01\x01").toString("base64");
 const error=new Error("535 rejected "+secret.username+" "+secret.password+" "+secret.accessToken+" "+Buffer.from(secret.password).toString("base64")+" "+sasl+" private body contents\r\nsecond line");
 const safe=sanitizeEmailError(error,{account:secret.username,body:"private body contents"},secret);
 for(const value of [secret.username,secret.password,secret.accessToken,Buffer.from(secret.password).toString("base64"),sasl,"private body contents"])assert.equal(safe.message.includes(value),false,"sanitized error must not contain "+value);
 assert.equal(safe.message.includes("\r"),false);
 assert.equal(safe.message.includes("\n"),false);
 assert.ok(safe.message.length<=600);
});

test("email capability wraps protocol failures in the redaction boundary",()=>{
 assert.ok(source.includes("async function call(name,args={},context={})"));
 assert.ok(source.includes("throw sanitizeEmailError(error,args,secret)"));
});

test("email send schema never exposes account credentials to the model",()=>{
 const email=require("../../src/tools/email");
 const schema=email.schemas().find(item=>item.function.name==="email_send").function.parameters;
 assert.equal(Object.hasOwn(schema.properties,"password"),false);
 assert.equal(Object.hasOwn(schema.properties,"accessToken"),false);
});
