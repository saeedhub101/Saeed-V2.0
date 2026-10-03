import * as THREE from "../../node_modules/three/build/three.module.js";
export const CANONICAL_SLOTS=["hips","spine","chest","neck","head","leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot"];
export function canonicalAxis(slot){return /^(left|right)/.test(slot)?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)}
export function buildCanonicalProfile(){return{version:"canonical-humanoid-v1",up:new THREE.Vector3(0,1,0),forward:new THREE.Vector3(0,0,1),slots:[...CANONICAL_SLOTS]}}
