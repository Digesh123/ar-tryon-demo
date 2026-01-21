import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------------- DOM ---------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");
const statusEl = document.getElementById("status");

/* ---------------- STATE ---------------- */
let facingMode = "user";
let stream = null;
let mpCamera = null;
let ring = null;
let handVisible = false;

/* ---------------- THREE ---------------- */
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true
});
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

scene.add(new THREE.DirectionalLight(0xffffff, 2));

/* ---------------- LOAD RING ---------------- */
const loader = new GLTFLoader();
loader.load("assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.visible = false;
  ring.scale.setScalar(0.02);
  scene.add(ring);
  console.log("Ring loaded");
});

/* ---------------- SMOOTHING ---------------- */
const smoothPos = new THREE.Vector3();
let smoothScale = 0;

/* ---------------- MEDIAPIPE HANDS ---------------- */
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

hands.onResults(results => {
  renderer.render(scene, camera3D);

  if (!ring) return;

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    ring.visible = false;
    statusEl.textContent = "Waiting for hand…";
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // Index finger PIP & DIP joints
  const p1 = lm[6];
  const p2 = lm[7];

  const nx = (1 - (p1.x + p2.x) / 2 - 0.5) * 2;
  const ny = -((p1.y + p2.y) / 2 - 0.5) * 2;

  const pip = new THREE.Vector3(nx, ny, 0.4).unproject(camera3D);

  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const width = Math.sqrt(dx * dx + dy * dy);

  // Clamp ring scale (Phase 4 only)
  const targetScale = THREE.MathUtils.clamp(width * 1.4, 0.012, 0.03);

  smoothPos.lerp(pip, 0.35);
  smoothScale += (targetScale - smoothScale) * 0.25;

  ring.position.copy(smoothPos);
  ring.scale.setScalar(smoothScale);
  ring.visible = true;

  statusEl.textContent = "Hand + Ring locked ✓";
});

/* ---------------- CAMERA ---------------- */
async function startCamera() {
  try {
    if (mpCamera) {
      await mpCamera.stop();
      mpCamera = null;
    }

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    await new Promise(r => setTimeout(r, 250));

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode }
    });

    video.srcObject = stream;
    await video.play();

    mpCamera = new window.Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });

    mpCamera.start();
  } catch (err) {
    console.warn("Camera warning:", err.name);
  }
}

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

startCamera();

/* ---------------- RENDER LOOP ---------------- */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
