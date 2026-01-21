// import * as THREE from "three";
// import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// console.log("THREE OK:", THREE.REVISION);
// console.log("MediaPipe Camera:", window.Camera);
// console.log("MediaPipe Hands:", window.Hands);

// // DOM
// const video = document.getElementById("video");
// const canvas = document.getElementById("overlay");
// const switchBtn = document.getElementById("switchCam");

// // THREE
// const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
// renderer.setSize(window.innerWidth, window.innerHeight);

// const scene = new THREE.Scene();

// const camera3D = new THREE.PerspectiveCamera(
//   45,
//   window.innerWidth / window.innerHeight,
//   0.01,
//   100
// );
// camera3D.position.z = 2;

// scene.add(new THREE.DirectionalLight(0xffffff, 1));

// // Load ring
// let ring;
// new GLTFLoader().load("./assets/ring.glb", gltf => {
//   ring = gltf.scene;
//   ring.scale.set(0.01, 0.01, 0.01);
//   scene.add(ring);
//   console.log("Ring loaded");
// });

// // MediaPipe Hands (GLOBAL)
// const hands = new window.Hands({
//   locateFile: file =>
//     `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
// });

// hands.setOptions({
//   maxNumHands: 1,
//   minDetectionConfidence: 0.7,
//   minTrackingConfidence: 0.7
// });

// hands.onResults(results => {
//   renderer.render(scene, camera3D);

//   if (!results.multiHandLandmarks || !ring) return;

//   const p = results.multiHandLandmarks[0][5]; // index MCP

//   const x = (1 - p.x - 0.5) * 2;
//   const y = -(p.y - 0.5) * 2;

//   const v = new THREE.Vector3(x, y, 0.5).unproject(camera3D);
//   ring.position.lerp(v, 0.4);
// });

// // Camera
// let facingMode = "user";
// let stream;

// async function startCamera() {
//   if (stream) stream.getTracks().forEach(t => t.stop());

//   stream = await navigator.mediaDevices.getUserMedia({
//     video: { facingMode }
//   });

//   video.srcObject = stream;
//   await video.play();

//   mpCamera.start();
// }

// // MediaPipe Camera (GLOBAL)
// const mpCamera = new window.Camera(video, {
//   onFrame: async () => {
//     await hands.send({ image: video });
//   },
//   width: 640,
//   height: 480
// });

// switchBtn.onclick = async () => {
//   facingMode = facingMode === "user" ? "environment" : "user";
//   await startCamera();
// };

// startCamera();

/* =========================
   PHASE 2 – HAND DEBUG
   ========================= */

/* ---------- DOM ---------- */

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const debug = document.getElementById("debug");

/* ---------- CANVAS SIZE ---------- */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ---------- CAMERA ---------- */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  });

  video.srcObject = stream;
  await video.play();

  debug.innerText = "Camera started";
  console.log("Camera started");
}

startCamera();

/* ---------- MEDIAPIPE HANDS ---------- */
const hands = new window.Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

/* ---------- MEDIAPIPE CAMERA ---------- */
const mpCamera = new window.Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 1280,
  height: 720
});

mpCamera.start();

/* ---------- DRAW LANDMARKS ---------- */
function onResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiHandLandmarks) {
    debug.innerText = "No hand detected";
    return;
  }

  debug.innerText = "Hand detected ✔";

  const landmarks = results.multiHandLandmarks[0];

  // Draw all 21 landmarks
  landmarks.forEach((p, i) => {
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "lime";
    ctx.fill();

    // index number (for debugging)
    ctx.fillStyle = "white";
    ctx.font = "12px monospace";
    ctx.fillText(i, x + 8, y + 4);
  });
}
