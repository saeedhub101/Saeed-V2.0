const GLB_MAGIC=0x46546c67;
const JSON_CHUNK=0x4e4f534a;
function asBuffer(value){
 if(Buffer.isBuffer(value))return value;
 if(value instanceof ArrayBuffer)return Buffer.from(value);
 if(ArrayBuffer.isView(value))return Buffer.from(value.buffer,value.byteOffset,value.byteLength);
 if(Array.isArray(value))return Buffer.from(value);
 if(value&&Array.isArray(value.data)&&(value.type==="Buffer"||value.type==="Uint8Array"||value.type===undefined))return Buffer.from(value.data);
 throw new TypeError("Character candidate must be binary GLB data");
}
function validateGlbCandidate(value){
 const bytes=asBuffer(value);
 if(bytes.length<24)throw new Error("GLB candidate is too small to contain a JSON chunk");
 if(bytes.readUInt32LE(0)!==GLB_MAGIC)throw new Error("Character candidate is not a GLB binary (missing glTF magic)");
 const version=bytes.readUInt32LE(4);
 if(version!==2)throw new Error("Unsupported GLB container version: "+version);
 const declaredLength=bytes.readUInt32LE(8);
 if(declaredLength!==bytes.length)throw new Error("GLB declared length "+declaredLength+" does not match received bytes "+bytes.length);
 const jsonLength=bytes.readUInt32LE(12);
 const jsonType=bytes.readUInt32LE(16);
 if(jsonType!==JSON_CHUNK)throw new Error("GLB first chunk is not JSON");
 if(jsonLength<2||jsonLength%4!==0||20+jsonLength>bytes.length)throw new Error("GLB JSON chunk length is invalid or truncated");
 let document;
 try{document=JSON.parse(bytes.subarray(20,20+jsonLength).toString("utf8").replace(/[\u0000 ]+$/g,""))}
 catch(error){throw new Error("GLB JSON chunk is invalid: "+String(error?.message||error))}
 if(!document?.asset||String(document.asset.version)!=="2.0")throw new Error("GLB asset.version must be 2.0");
 if(!Array.isArray(document.nodes)||document.nodes.length===0)throw new Error("GLB character has no nodes");
 if(!Array.isArray(document.meshes)||document.meshes.length===0)throw new Error("GLB character has no meshes");
 if(!Array.isArray(document.scenes)||document.scenes.length===0)throw new Error("GLB character has no scene");
 if(document.scene!==undefined&&(!Number.isInteger(document.scene)||document.scene<0||document.scene>=document.scenes.length))throw new Error("GLB default scene index is invalid");
 const sceneIndex=Number.isInteger(document.scene)?document.scene:0,roots=document.scenes[sceneIndex]?.nodes;
 if(!Array.isArray(roots)||!roots.length)throw new Error("GLB active scene has no root nodes");
 const skins=Array.isArray(document.skins)?document.skins:[],visited=new Set(),stack=[...roots];let sceneMeshCount=0,sceneSkinnedMeshCount=0;
 while(stack.length){const index=stack.pop();if(!Number.isInteger(index)||index<0||index>=document.nodes.length)throw new Error("GLB active scene references an invalid node index");if(visited.has(index))continue;visited.add(index);const node=document.nodes[index];if(!node||typeof node!=="object")throw new Error("GLB node is invalid");if(node.mesh!==undefined){if(!Number.isInteger(node.mesh)||node.mesh<0||node.mesh>=document.meshes.length)throw new Error("GLB node references an invalid mesh index");sceneMeshCount++;if(node.skin!==undefined){if(!Number.isInteger(node.skin)||node.skin<0||node.skin>=skins.length)throw new Error("GLB skinned mesh references an invalid skin index");const joints=skins[node.skin]?.joints;if(!Array.isArray(joints)||!joints.length||joints.some(j=>!Number.isInteger(j)||j<0||j>=document.nodes.length))throw new Error("GLB skinned mesh has invalid or missing joint references");sceneSkinnedMeshCount++;}}if(node.children!==undefined&&!Array.isArray(node.children))throw new Error("GLB node children must be an array");if(Array.isArray(node.children))stack.push(...node.children)}
 if(sceneMeshCount<1)throw new Error("GLB active scene has no renderable mesh");
 return{ok:true,byteLength:bytes.length,version,nodeCount:document.nodes.length,meshCount:document.meshes.length,sceneMeshCount,sceneSkinnedMeshCount,hasSkeleton:sceneSkinnedMeshCount>0,skinCount:skins.length};
}
module.exports={validateGlbCandidate};
