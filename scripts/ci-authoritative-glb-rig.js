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
 assert.ok(Array.isArray(doc.scenes)&&doc.scenes.length>0,"authoritative GLB must contain a scene");
 const mapperPath=path.join(root,"src","character","AutoRigMapper.js");
 const temporary=path.join(os.tmpdir(),"saeed-rig-map-"+process.pid+"-"+Date.now()+".mjs");
 try{
  fs.writeFileSync(temporary,fs.readFileSync(mapperPath,"utf8"),"utf8");
  const {autoMapBones,requiredRigSlots,optionalRigSlots}=await import(pathToFileURL(temporary).href);
  const names=doc.nodes.map(n=>n?.name).filter(Boolean);
  const mapping=autoMapBones(names).mapping;
  const required=requiredRigSlots(),optional=optionalRigSlots();
  assert.deepEqual(required,[],"no logical joint may be mandatory for rendering");
  assert.ok(optional.length>0,"available logical joints must remain mappable");
  const singleBoneMapping=autoMapBones(["Hips"]).mapping;
  assert.equal(singleBoneMapping.hips,"Hips","a one-bone partial skeleton must map its available hips joint");
  assert.ok(Object.keys(singleBoneMapping).length>0,"partial rigs must expose their available mapped joints instead of being rejected");
  for(const [slot,name] of Object.entries(mapping))assert.ok(names.includes(name),"mapped "+slot+" must refer to an actual named bone");
  const meshNodes=doc.nodes.filter(n=>Number.isInteger(n.mesh));
  assert.ok(meshNodes.length>0,"authoritative GLB must expose a mesh node");
  console.log("AUTHORITATIVE_GLB_RIG=PASS ("+meshNodes.length+" mesh nodes; "+Object.keys(mapping).length+" optional joints mapped; partial rig supported)");
 }finally{try{fs.unlinkSync(temporary)}catch{}}
}
main().catch(error=>{console.error("AUTHORITATIVE_GLB_RIG=FAIL",error?.stack||error);process.exitCode=1});
