import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------- DOM ---------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");
const statusEl = document.getElementById("status");

/* ---------- STATE ---------- */
let facingMode = "user";
let stream = null;
let mpCamera = null;
let ring = null;

/* ---------- THREE ---------- */
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

/* ---------- LOAD RING ---------- */
const loader = new GLTFLoader();
loader.load("assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.visible = false;

  // IMPORTANT: face ring sideways (typical GLB rings face camera)
  ring.rotation.x = Math.PI / 2;

  ring.scale.setScalar(0.018);
  scene.add(ring);

  console.log("Phase 5 ring loaded");
});

/* ---------- SMOOTHING ---------- */
const smoothPos = new THREE.Vector3();
const smoothQuat = new THREE.Quaternion();
let smoothScale = 0;

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

hands.onResults(results => {
  renderer.render(scene, camera3D);
  if (!ring) return;

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    ring.visible = false;
    statusEl.textContent = "Waiting for hand…";
    return;
  }

  statusEl.textContent = "Ring worn ✓";

  const lm = results.multiHandLandmarks[0];

  /**
   * Finger joints:
   * 5 = index MCP
   * 6 = index PIP
   * 7 = index DIP
   */
  const mcp = lm[5];
  const pip = lm[6];
  const dip = lm[7];

  // ---------- POSITION ----------
  const cx = (pip.x + dip.x) / 2;
  const cy = (pip.y + dip.y) / 2;

  const nx = (1 - cx - 0.5) * 2;
  const ny = -(cy - 0.5) * 2;

  const pos = new THREE.Vector3(nx, ny, 0.35).unproject(camera3D);

  // Push slightly INTO finger (illusion of wear)
  pos.z -= 0.05;

  smoothPos.lerp(pos, 0.35);
  ring.position.copy(smoothPos);

  // ---------- SCALE ----------
  const dx = pip.x - dip.x;
  const dy = pip.y - dip.y;
  const width = Math.sqrt(dx * dx + dy * dy);

  const targetScale = THREE.MathUtils.clamp(width * 1.3, 0.012, 0.022);
  smoothScale += (targetScale - smoothScale) * 0.3;
  ring.scale.setScalar(smoothScale);

  // ---------- ROTATION (THE KEY PART) ----------
  // Finger direction vector
  const fingerDir = new THREE.Vector3(
    pip.x - mcp.x,
    pip.y - mcp.y,
    0
  ).normalize();

  // Convert to world direction
  fingerDir.y *= -1;

  // Create quaternion that aligns ring with finger
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, fingerDir);

  smoothQuat.slerp(quat, 0.35);
  ring.quaternion.copy(smoothQuat);

  ring.visible = true;
});

/* ---------- CAMERA ---------- */
async function startCamera() {
  try {
    if (mpCamera) await mpCamera.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());

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
    console.warn("Camera error:", err.name);
  }
}

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

startCamera();

/* ---------- RENDER LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
