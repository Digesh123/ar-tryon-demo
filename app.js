/* ---------------- IMPORTS (THIS FIXES EVERYTHING) ---------------- */
import * as THREE from "https://unpkg.com/three@0.152.2/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js";

import { Hands } from "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

/* ---------------- DEBUG ---------------- */
console.log("THREE version:", THREE.REVISION);
console.log("GLTFLoader:", GLTFLoader);

/* ---------------- DOM ---------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchButton = document.getElementById("switchCam");

/* ---------------- STATE ---------------- */
let facingMode = "user";
let stream = null;
let mediapipeCamera = null;
let ring = null;
let lastLandmarks = null;

/* ---------------- THREE.JS ---------------- */
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera3D.position.z = 2;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 5);
scene.add(light);

/* ---------------- LOAD RING ---------------- */
const loader = new GLTFLoader();
loader.load(
  "./ring.glb",
  (gltf) => {
    console.log("✅ Ring loaded");
    ring = gltf.scene;

    ring.scale.set(0.02, 0.02, 0.02);
    ring.position.set(0, 0, -1); // force visible

    scene.add(ring);
  },
  undefined,
  (err) => console.error("❌ GLB load failed", err)
);

/* ---------------- MEDIAPIPE ---------------- */
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((results) => {
  if (results.multiHandLandmarks?.length) {
    lastLandmarks = results.multiHandLandmarks[0];
  }
});

/* ---------------- CAMERA ---------------- */
async function startCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
  });

  video.srcObject = stream;
  await video.play();

  video.style.transform =
    facingMode === "user" ? "scaleX(-1)" : "scaleX(1)";

  if (mediapipeCamera) mediapipeCamera.stop();

  mediapipeCamera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
  });

  mediapipeCamera.start();
}

switchButton.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

startCamera();

/* ---------------- RENDER LOOP ---------------- */
function animate() {
  requestAnimationFrame(animate);

  if (ring && lastLandmarks) {
    const finger = lastLandmarks[5];
    const fx =
      facingMode === "user" ? 1 - finger.x : finger.x;

    const x = (fx - 0.5) * 2;
    const y = -(finger.y - 0.5) * 2;

    const v = new THREE.Vector3(x, y, 0.5);
    v.unproject(camera3D);

    ring.position.lerp(v, 0.3);
  }

  renderer.render(scene, camera3D);
}

animate();
