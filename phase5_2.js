import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* =========================
   BASIC DEBUG
========================= */
console.log("THREE version:", THREE.REVISION);
console.log("MediaPipe Hands:", window.Hands);
console.log("MediaPipe Camera:", window.Camera);

/* =========================
   DOM
========================= */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");

/* =========================
   THREE SETUP
========================= */
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
camera3D.position.z = 2;
scene.add(camera3D);

// Lighting (important for realism)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(0, 0, 2);
scene.add(dirLight);

/* =========================
   LOAD RING MODEL
========================= */
let ring = null;

const loader = new GLTFLoader();
loader.load(
  "./assets/ring.glb",
  gltf => {
    ring = gltf.scene;
    ring.visible = false;
    ring.scale.setScalar(0.045); // starting reference
    scene.add(ring);
    console.log("✅ Ring loaded");
  },
  undefined,
  err => console.error("❌ Ring load error", err)
);

/* =========================
   MEDIAPIPE HANDS
========================= */
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

/* =========================
   PHASE 5 CORE LOGIC
========================= */
hands.onResults(results => {
  if (!ring) return;

  /* -------- HARD SAFETY GUARD -------- */
  if (
    !results.multiHandLandmarks ||
    results.multiHandLandmarks.length === 0
  ) {
    ring.visible = false;
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // REQUIRED landmarks for ring finger
  if (!lm[13] || !lm[14] || !lm[15]) {
    ring.visible = false;
    return;
  }

  ring.visible = true;

  const mcp = lm[13]; // ring finger base
  const pip = lm[14];
  const dip = lm[15];

  /* -------- POSITION -------- */
  const x = (1 - mcp.x - 0.5) * 2;
  const y = -(mcp.y - 0.5) * 2;
  const z = -mcp.z * 2;

  const targetPos = new THREE.Vector3(x, y, z).unproject(camera3D);
  ring.position.lerp(targetPos, 0.35);

  /* -------- SCALE (finger thickness) -------- */
  const dx = pip.x - mcp.x;
  const dy = pip.y - mcp.y;
  const fingerLen = Math.sqrt(dx * dx + dy * dy);

  const scale = THREE.MathUtils.clamp(
    fingerLen * 3.2,
    0.038,
    0.052
  );

  ring.scale.lerp(
    new THREE.Vector3(scale, scale, scale),
    0.3
  );

  /* -------- ROTATION (align to finger) -------- */
  const dir = new THREE.Vector3(
    dip.x - mcp.x,
    dip.y - mcp.y,
    dip.z - mcp.z
  ).normalize();

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  ring.quaternion.slerp(quat, 0.25);

  /* -------- EMBED RING INTO FINGER -------- */
  ring.position.addScaledVector(dir, -scale * 0.55);
});

/* =========================
   CAMERA HANDLING
========================= */
let facingMode = "user";
let stream = null;
let mpCamera = null;

async function startCamera() {
  try {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode }
    });

    video.srcObject = stream;
    await video.play();

    if (mpCamera) mpCamera.stop();

    mpCamera = new window.Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });

    mpCamera.start();
    console.log("📷 Camera started:", facingMode);
  } catch (err) {
    console.error("❌ Camera error:", err);
    alert("Failed to acquire camera feed");
  }
}

/* =========================
   SWITCH CAMERA BUTTON
========================= */
switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

/* =========================
   RENDER LOOP
========================= */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

/* =========================
   INIT
========================= */
startCamera();
