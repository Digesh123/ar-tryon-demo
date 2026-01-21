import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------- DOM ---------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");

/* ---------- THREE ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10
);
camera3D.position.z = 1;
scene.add(camera3D);

// light
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(0, 0, 2);
scene.add(light);

/* ---------- LOAD RING ---------- */
let ring = null;

new GLTFLoader().load("assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.scale.setScalar(0.03);
  scene.add(ring);
  statusEl.textContent = "Ring loaded – show hand";
});

/* ---------- MediaPipe ---------- */
const hands = new Hands({
  locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.8,
  minTrackingConfidence: 0.8
});

/* ---------- Landmark Mapping ---------- */
hands.onResults(results => {
  renderer.render(scene, camera3D);

  if (!results.multiHandLandmarks || !ring) return;

  statusEl.textContent = "Hand + Ring locked ✔";

  // Ring finger MCP
  const p = results.multiHandLandmarks[0][13];

  // Convert normalized → NDC
  const x = (p.x - 0.5) * 2;
  const y = -(p.y - 0.5) * 2;

  const v = new THREE.Vector3(x, y, 0.5);
  v.unproject(camera3D);

  ring.position.lerp(v, 0.6); // smoothing
});

/* ---------- Camera ---------- */
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

camera.start();
