"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateGlbCandidate}=require("../../src/main/character/glb-validation");
function makeGlb(document){
 const json=Buffer.from(JSON.stringify(document));
 const paddedLength=Math.ceil(json.length/4)*4,padded=Buffer.alloc(paddedLength,0x20);
 json.copy(padded);
 const total=12+8+paddedLength,header=Buffer.alloc(20);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
 header.writeUInt32LE(paddedLength,12);header.writeUInt32LE(0x4e4f534a,16);
 return Buffer.concat([header,padded]);
}
function document({skin=true,joints=[1]}={}){
 const doc={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0},{}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]};
 if(skin){doc.nodes[0].skin=0;doc.skins=[{joints}]}
 return doc;
}
test("GLB validation accepts a renderable character with an incomplete empty rig",()=>{
 const result=validateGlbCandidate(makeGlb(document({skin:true,joints:[]})));
 assert.equal(result.ok,true);assert.equal(result.sceneMeshCount,1);assert.equal(result.sceneSkinnedMeshCount,0);assert.equal(result.hasSkeleton,false);
});
test("GLB validation accepts a renderable static mesh without a rig",()=>{
 const result=validateGlbCandidate(makeGlb(document({skin:false})));
 assert.equal(result.ok,true);assert.equal(result.hasSkeleton,false);
});
test("GLB validation still rejects corrupt joint node references",()=>{
 assert.throws(()=>validateGlbCandidate(makeGlb(document({skin:true,joints:[99]}))),/invalid joint references/);
});

test("selected GLB is persisted only after binary read-back verification",t=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
 const {createCharacterStore}=require("../../src/main/character/character-store");
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-glb-store-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const diagnostics=[];
 const service=createCharacterStore({app:{getPath:()=>dir},path,fs,screen:{},getCharacterWindow:()=>null,fitCharacterToDisplay:()=>{},diagnostic:(...args)=>diagnostics.push(args)});
 const bytes=makeGlb(document({skin:true,joints:[]}));
 const saved=service.persistSelectedCharacter(bytes);
 assert.ok(saved);assert.deepEqual(fs.readFileSync(saved),bytes);
 const restored=service.readPersistedCharacter();
 assert.equal(restored.validation.ok,true);assert.deepEqual(Buffer.from(restored.data),bytes);
 assert.equal(service.persistSelectedCharacter(Buffer.from("not a GLB")),null);
 assert.deepEqual(fs.readFileSync(saved),bytes);
});
