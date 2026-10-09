const assert=require("node:assert/strict");
const {validateGlbCandidate}=require("../src/main/character/glb-validation");
function makeGlb(document){
 const json=Buffer.from(JSON.stringify(document),"utf8");
 const paddedLength=Math.ceil(json.length/4)*4;
 const jsonChunk=Buffer.alloc(paddedLength,0x20);json.copy(jsonChunk);
 const total=20+jsonChunk.length;
 const out=Buffer.alloc(total);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);out.writeUInt32LE(jsonChunk.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(out,20);
 return out;
}
const valid={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{}}]}]};
assert.equal(validateGlbCandidate(makeGlb(valid)).ok,true,"valid GLB candidate");
const offset=Buffer.alloc(makeGlb(valid).length+9);makeGlb(valid).copy(offset,4);
assert.equal(validateGlbCandidate(new Uint8Array(offset.buffer,offset.byteOffset+4,makeGlb(valid).length)).ok,true,"typed-array view with nonzero offset");
for(const [label,mutate,pattern] of [
 ["magic",b=>b.writeUInt32LE(0,0),/missing glTF magic/],
 ["version",b=>b.writeUInt32LE(1,4),/Unsupported GLB container version/],
 ["declared length",b=>b.writeUInt32LE(b.length+1,8),/declared length/],
 ["JSON chunk type",b=>b.writeUInt32LE(0,16),/first chunk is not JSON/],
 ["truncated JSON",b=>b.writeUInt32LE(b.length,12),/JSON chunk length/]
]){
 const b=makeGlb(valid);mutate(b);assert.throws(()=>validateGlbCandidate(b),pattern,label);
}
assert.throws(()=>validateGlbCandidate(makeGlb({asset:{version:"2.0"},scenes:[{nodes:[0]}],nodes:[{mesh:0}]})),/no meshes/,"must reject a scene without a mesh");
assert.throws(()=>validateGlbCandidate(Buffer.alloc(10)),/too small/,"must reject truncated binary");
console.log("GLB_CANDIDATE_VALIDATION=PASS (9 assertions)");
