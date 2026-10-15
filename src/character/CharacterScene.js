// Owns Three.js scene primitives and renderer configuration; model/rig lifecycle stays in CharacterEngine.
import * as THREE from "../../node_modules/three/build/three.module.js";
import { GLTFLoader } from "../three/GLTFLoader.js";

export function createCharacterScene(canvas) {
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.01,100);
  
  const renderer=new THREE.WebGLRenderer({
   canvas,alpha:true,antialias:true,powerPreference:"low-power"
  });
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.setPixelRatio(Math.min(Math.max(1,devicePixelRatio||1),1.25));
  
  scene.add(new THREE.HemisphereLight(0xffffff,0x26313d,1.8));
  const key=new THREE.DirectionalLight(0xffffff,2.8);
  key.position.set(2.5,4.5,4);
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,1.15);
  fill.position.set(-3,2,2);
  scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,.9);
  rim.position.set(0,3,-4);
  scene.add(rim);
  
  const root=new THREE.Group();
  scene.add(root);
  const loader=new GLTFLoader();
    return { scene, camera, renderer, root, loader };
}
