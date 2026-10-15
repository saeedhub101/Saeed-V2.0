
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const out=path.resolve(process.argv[2]||path.join(process.cwd(),"dist","ci-static-humanoid.glb"));
const meshes=[
 ["hips",[0,.98,0],[.19,.18,.12]],
 ["torso",[0,1.27,0],[.21,.32,.13]],
 ["neck",[0,1.56,0],[.055,.09,.055]],
 ["head",[0,1.74,0],[.12,.14,.11]],
 ["leftShoulder",[.10,1.51,0],[.10,.095,.09]],
 ["rightShoulder",[-.10,1.51,0],[.10,.095,.09]],
 ["leftUpperArm",[.28,1.51,0],[.18,.07,.07]],
 ["rightUpperArm",[-.28,1.51,0],[.18,.07,.07]],
 ["leftForeArm",[.60,1.50,0],[.17,.06,.06]],
 ["rightForeArm",[-.60,1.50,0],[.17,.06,.06]],
 ["leftHand",[.85,1.49,0],[.075,.06,.055]],
 ["rightHand",[-.85,1.49,0],[.075,.06,.055]],
 ["leftThigh",[.10,.78,0],[.085,.22,.08]],
 ["rightThigh",[-.10,.78,0],[.085,.22,.08]],
 ["leftShin",[.10,.36,0],[.065,.22,.065]],
 ["rightShin",[-.10,.36,0],[.065,.22,.065]],
 ["leftFoot",[.10,.075,.035],[.07,.06,.12]],
 ["rightFoot",[-.10,.075,.035],[.07,.06,.12]]
];
const lat=10,lon=16,positions=[],normals=[],indices=[];
for(let y=0;y<=lat;y++){const phi=Math.PI*y/lat;for(let x=0;x<=lon;x++){const theta=2*Math.PI*x/lon;const nx=Math.sin(phi)*Math.cos(theta),ny=Math.cos(phi),nz=Math.sin(phi)*Math.sin(theta);positions.push(nx,ny,nz);normals.push(nx,ny,nz)}}
for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;indices.push(a,b,a+1,b,b+1,a+1)}
const binaryParts=[],bufferViews=[],accessors=[],meshDefs=[],nodes=[];
let byteOffset=0;
function append(typed,target,index,componentType,type,count,min,max){const pad=(4-byteOffset%4)%4;if(pad){binaryParts.push(Buffer.alloc(pad));byteOffset+=pad}const data=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength);bufferViews.push({buffer:0,byteOffset,byteLength:data.length,target});binaryParts.push(data);const accessor={bufferView:bufferViews.length-1,componentType,count,type};if(min)accessor.min=min;if(max)accessor.max=max;accessors.push(accessor);byteOffset+=data.length;return accessors.length-1}
const pArr=new Float32Array(positions),nArr=new Float32Array(normals),iArr=new Uint16Array(indices);
const pMin=[Infinity,Infinity,Infinity],pMax=[-Infinity,-Infinity,-Infinity];for(let i=0;i<pArr.length;i+=3)for(let a=0;a<3;a++){pMin[a]=Math.min(pMin[a],pArr[i+a]);pMax[a]=Math.max(pMax[a],pArr[i+a])}
const posAccessor=append(pArr,34962,0,5126,"VEC3",positions.length/3,pMin,pMax);
const normalAccessor=append(nArr,34962,0,5126,"VEC3",normals.length/3);
const indexAccessor=append(iArr,34963,0,5123,"SCALAR",indices.length);
for(const [name,translation,scale] of meshes){meshDefs.push({name,primitives:[{attributes:{POSITION:posAccessor,NORMAL:normalAccessor},indices:indexAccessor,material:0,mode:4}]});nodes.push({name,mesh:meshDefs.length-1,translation,scale})}
// Include a real animation channel so packaged acceptance can exercise the live GLB intent-to-clip path.
const animationTimeAccessor=append(new Float32Array([0,.5,1]),undefined,0,5126,"SCALAR",3,[0],[1]);
const animationTranslationAccessor=append(new Float32Array([0,1.74,0,0,1.94,0,0,1.74,0]),undefined,0,5126,"VEC3",3,[0,1.74,0],[0,1.94,0]);
const bin=Buffer.concat(binaryParts);const gltf={asset:{version:"2.0",generator:"Saeed CI static humanoid fixture"},scene:0,scenes:[{name:"Static humanoid fixture",nodes:nodes.map((_,i)=>i)}],nodes,meshes:meshDefs,materials:[{name:"Matte test mannequin",pbrMetallicRoughness:{baseColorFactor:[.55,.65,.78,1],metallicFactor:0,roughnessFactor:.82}}],animations:[{name:"CI-GLB-Intent-Wave",samplers:[{input:animationTimeAccessor,output:animationTranslationAccessor,interpolation:"LINEAR"}],channels:[{sampler:0,target:{node:3,path:"translation"}}]}],buffers:[{byteLength:bin.length}],bufferViews,accessors};
const json=Buffer.from(JSON.stringify(gltf));const jsonPad=(4-json.length%4)%4,binPad=(4-bin.length%4)%4;const jsonChunk=Buffer.concat([json,Buffer.alloc(jsonPad,0x20)]),binChunk=Buffer.concat([bin,Buffer.alloc(binPad)]);
const total=12+8+jsonChunk.length+8+binChunk.length;const header=Buffer.alloc(12);header.write("glTF",0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonChunk.length,0);jh.writeUInt32LE(0x4E4F534A,4);const bh=Buffer.alloc(8);bh.writeUInt32LE(binChunk.length,0);bh.writeUInt32LE(0x004E4942,4);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([header,jh,jsonChunk,bh,binChunk]));console.log(JSON.stringify({fixture:out,bytes:fs.statSync(out).size,meshes:meshes.length,verticesPerMesh:positions.length/3,vertices:meshes.length*positions.length/3},null,2));
