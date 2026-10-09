const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

async function run(){
 const source=path.join(__dirname,"..","src","character","glb-bytes.js");
 const temporary=path.join(os.tmpdir(),"saeed-glb-bytes-"+process.pid+"-"+Date.now()+".mjs");
 try{
  fs.writeFileSync(temporary,fs.readFileSync(source,"utf8"),"utf8");
  const {normalizeGlbArrayBuffer}=await import(pathToFileURL(temporary).href);
  function makeGlb(length=24){
   const bytes=new Uint8Array(length);
   bytes.set([0x67,0x6c,0x54,0x46,2,0,0,0],0);
   bytes[8]=length&255;bytes[9]=(length>>>8)&255;bytes[10]=(length>>>16)&255;bytes[11]=(length>>>24)&255;
   return bytes;
  }
  const expected=makeGlb();
  assert.equal(normalizeGlbArrayBuffer(expected.buffer).byteLength,expected.byteLength,"ArrayBuffer input");
  assert.deepEqual([...new Uint8Array(normalizeGlbArrayBuffer(expected))],[...expected],"Uint8Array input");
  const backing=new Uint8Array(expected.length+11);backing.set(expected,5);
  assert.deepEqual([...new Uint8Array(normalizeGlbArrayBuffer(new Uint8Array(backing.buffer,5,expected.length)))],[...expected],"offset Uint8Array must not include adjacent bytes");
  assert.deepEqual([...new Uint8Array(normalizeGlbArrayBuffer({type:"Buffer",data:[...expected]}))],[...expected],"serialized Node Buffer input");
  assert.throws(()=>normalizeGlbArrayBuffer(new Uint8Array(64)),/missing glTF magic/,"reject non-GLB bytes");
  assert.throws(()=>normalizeGlbArrayBuffer(new Uint8Array(19)),/too small/,"reject truncated header/chunk");
  const badLength=makeGlb();badLength[8]=25;
  assert.throws(()=>normalizeGlbArrayBuffer(badLength),/does not match received bytes/,"reject mismatched declared length");
  console.log("GLB_BYTE_NORMALIZATION=PASS (7 assertions)");
 }finally{try{fs.unlinkSync(temporary)}catch{}}
}
run().catch(error=>{console.error("GLB_BYTE_NORMALIZATION=FAIL",error?.stack||error);process.exitCode=1});
