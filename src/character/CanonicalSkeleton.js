import * as THREE from "../../node_modules/three/build/three.module.js";
export const CANONICAL_SLOTS=["hips","spine","chest","neck","head","leftShoulder","rightShoulder","leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot",...["left","right"].flatMap(side=>["Thumb","Index","Middle","Ring","Pinky"].flatMap(finger=>[1,2,3,4].map(segment=>side+"Hand"+finger+segment)))];
export function canonicalAxis(slot){return /^(left|right)/.test(slot)?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)}
export function buildCanonicalProfile(){return{version:"canonical-humanoid-v1",up:new THREE.Vector3(0,1,0),forward:new THREE.Vector3(0,0,1),slots:[...CANONICAL_SLOTS]}}
