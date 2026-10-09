const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {pathToFileURL}=require("node:url");
async function main(){
 const root=path.join(__dirname,"..");
 const glbPath=path.join(root,"assets","Saeed_AI-3D.glb");
 const bytes=fs.readFileSync(glbPath);
 assert.equal(bytes.toString("ascii",0,4),"glTF","authoritative character must be a binary GLB");
 assert.equal(bytes.readUInt32LE(4),2,"authoritative character must use GLB version 2");
 assert.equal(bytes.readUInt32LE(8),bytes.length,"authoritative GLB declared length must match the file");
 const jsonLength=bytes.readUInt32LE(12);
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a,"authoritative GLB first chunk must be JSON");
 const doc=JSON.parse(bytes.toString("utf8",20,20+jsonLength).trim());
 assert.ok(Array.isArray(doc.nodes)&&doc.nodes.length>0,"authoritative GLB must expose nodes");
 assert.ok(Array.isArray(doc.meshes)&&doc.meshes.length>0,"authoritative GLB must contain meshes");
 assert.ok(Array.isArray(doc.skins)&&doc.skins.some(s=>Array.isArray(s.joints)&&s.joints.length>0),"authoritative GLB must contain a skinned skeleton");
 const mapperPath=path.join(root,"src","character","AutoRigMapper.js");
 const temporary=path.join(os.tmpdir(),"saeed-rig-map-"+process.pid+"-"+Date.now()+".mjs");
 try{
  fs.writeFileSync(temporary,fs.readFileSync(mapperPath,"utf8"),"utf8");
  const {autoMapBones,requiredRigSlots,optionalRigSlots}=await import(pathToFileURL(temporary).href);
  const names=doc.nodes.map(n=>n?.name).filter(Boolean);
  const mapping=autoMapBones(names).mapping;
  const required=requiredRigSlots();
  assert.deepEqual(required,["hips","head","leftUpperArm","rightUpperArm","leftThigh","rightThigh"],"six required humanoid joints must be declared");
  assert.deepEqual(required.filter(slot=>optionalRigSlots().includes(slot)),[],"required humanoid joints must not also be reported as optional");
  const missing=required.filter(slot=>!mapping[slot]||!names.includes(mapping[slot]));
  assert.deepEqual(missing,[],"authoritative GLB must automatically map all required real bones: "+JSON.stringify({mapping,missing,names}));
  console.log("AUTHORITATIVE_GLB_RIG=PASS ("+names.length+" named nodes; "+required.length+" required joints mapped to real bones)");
 }finally{try{fs.unlinkSync(temporary)}catch{}}
}
main().catch(error=>{console.error("AUTHORITATIVE_GLB_RIG=FAIL",error?.stack||error);process.exitCode=1});
