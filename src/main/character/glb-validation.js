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
 return{ok:true,byteLength:bytes.length,version,nodeCount:document.nodes.length,meshCount:document.meshes.length,skinCount:Array.isArray(document.skins)?document.skins.length:0};
}
module.exports={validateGlbCandidate};
