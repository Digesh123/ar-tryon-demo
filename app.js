import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

console.log("THREE OK:", THREE.REVISION);
console.log("MediaPipe Camera:", window.Camera);
console.log("MediaPipe Hands:", window.Hands);

// DOM
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");

// THREE
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera3D.position.z = 2;

scene.add(new THREE.DirectionalLight(0xffffff, 1));

// Load ring
let ring;
new GLTFLoader().load("./assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.scale.set(0.01, 0.01, 0.01);
  scene.add(ring);
  console.log("Ring loaded");
});

// MediaPipe Hands (GLOBAL)
const hands = new window.Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(results => {
  renderer.render(scene, camera3D);

  if (!results.multiHandLandmarks || !ring) return;

  const p = results.multiHandLandmarks[0][5]; // index MCP

  const x = (1 - p.x - 0.5) * 2;
  const y = -(p.y - 0.5) * 2;

  const v = new THREE.Vector3(x, y, 0.5).unproject(camera3D);
  ring.position.lerp(v, 0.4);
});

// Camera
let facingMode = "user";
let stream;

async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode }
  });

  video.srcObject = stream;
  await video.play();

  mpCamera.start();
}

// MediaPipe Camera (GLOBAL)
const mpCamera = new window.Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

startCamera();
