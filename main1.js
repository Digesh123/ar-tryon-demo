/* ================= IMPORTS ================= */

// ❗ FULL URL IMPORTS — NO "three"
import * as THREE from "https://unpkg.com/three@0.152.2/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js";

import { Hands } from "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

/* ================= DEBUG ================= */

console.log("THREE loaded:", THREE);
console.log("GLTFLoader loaded:", GLTFLoader);

/* ================= DOM ================= */

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");

/* ================= THREE ================= */

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const cam3d = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
cam3d.position.z = 2;

scene.add(new THREE.DirectionalLight(0xffffff, 1));

let ring = null;

const loader = new GLTFLoader();
loader.load(
  "./ring.glb",
  (gltf) => {
    ring = gltf.scene;
    ring.scale.set(0.02, 0.02, 0.02);
    scene.add(ring);
    console.log("✅ Ring loaded");
  },
  undefined,
  (err) => console.error("❌ Ring load error", err)
);

/* ================= MEDIAPIPE ================= */

const hands = new Hands({
  locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});

hands.setOptions({
  maxNumHands: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

let landmarks = null;

hands.onResults(res => {
  if (res.multiHandLandmarks?.length) {
    landmarks = res.multiHandLandmarks[0];
  }
});

/* ================= CAMERA ================= */

let facingMode = "user";
let mediaCam;

async function startCamera() {
  mediaCam = new Camera(video, {
    facingMode,
    onFrame: async () => {
      await hands.send({ image: video });
    },
  });
  mediaCam.start();
}

switchBtn.onclick = () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  mediaCam.stop();
  startCamera();
};

startCamera();

/* ================= LOOP ================= */

function animate() {
  requestAnimationFrame(animate);

  if (ring && landmarks) {
    const p = landmarks[5]; // base of index finger
    const x = (p.x - 0.5) * 2;
    const y = -(p.y - 0.5) * 2;

    ring.position.set(x, y, -1);
  }

  renderer.render(scene, cam3d);
}

animate();
