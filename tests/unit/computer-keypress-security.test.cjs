"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {Computer}=require("../../src/main/automation/computer");
test("key press accepts only allowlisted key names and alphanumeric keys",async()=>{
 const computer=new Computer();let command=null;
 computer.powershell=async value=>{command=value;return{ok:true}};
 const result=await computer.keyPress("CTRL+SHIFT+S");
 assert.equal(result.ok,true);
 assert.match(command,/SendKeys\("\^\+S"\)/);
});
test("key press rejects PowerShell interpolation and command-injection characters",async()=>{
 const computer=new Computer();let calls=0;
 computer.powershell=async()=>{calls++;return{ok:true}};
 const keys=["$(Get-Process)","A"+String.fromCharCode(96)+"$(Get-Process)","A;Start-Process calc",'"A"',"A'B","A\\B","A B"];
 for(const key of keys) {
  const result=await computer.keyPress(key);
  assert.equal(result.ok,false,"must reject "+JSON.stringify(key));
 }
 assert.equal(calls,0,"rejected keys must never reach PowerShell");
});
test("key press bounds input length and supports named special keys",async()=>{
 const computer=new Computer();let command=null;
 computer.powershell=async value=>{command=value;return{ok:true}};
 assert.equal((await computer.keyPress("ENTER")).ok,true);
 assert.match(command,/\{ENTER\}/);
 assert.equal((await computer.keyPress("A".repeat(65))).ok,false);
});
