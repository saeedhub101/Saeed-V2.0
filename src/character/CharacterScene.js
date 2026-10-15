// Three.js scene setup matched to src/renderer/avatar.js in the original Saeed viewer.
import * as THREE from "../../node_modules/three/build/three.module.js";
import { GLTFLoader } from "../three/GLTFLoader.js";

export function createCharacterScene(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(1.5, 3, 3);
  scene.add(sun);

  const root = new THREE.Group();
  scene.add(root);
  const loader = new GLTFLoader();
  return { scene, camera, renderer, root, loader };
}
