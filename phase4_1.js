import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------- DOM ---------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const switchBtn = document.getElementById("switchCam");

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
camera3D.position.z = 1.3;
scene.add(camera3D);

scene.add(new THREE.DirectionalLight(0xffffff, 2));

/* ---------- LOAD RING ---------- */
let ring = null;

new GLTFLoader().load(
  "assets/ring.glb",
  gltf => {
    ring = gltf.scene;
    ring.visible = false;
    ring.scale.setScalar(0.02);
    scene.add(ring);
    console.log("Ring loaded");
  }
);

/* ---------- MEDIAPIPE HANDS ---------- */
const hands = new window.Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

/* ---------- CAMERA ---------- */
let facingMode = "user";
let stream = null;
let mpCamera = null;

async function startCamera() {
  // Stop old camera
  if (mpCamera) mpCamera.stop();
  if (stream) stream.getTracks().forEach(t => t.stop());

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
}

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  statusEl.innerText = "Switching camera…";
  await startCamera();
};

startCamera();

/* ---------- HELPERS ---------- */
function toWorld(lm) {
  const x = (lm.x - 0.5) * 2;
  const y = -(lm.y - 0.5) * 2;
  return new THREE.Vector3(x, y, 0.5).unproject(camera3D);
}

/* ---------- MAIN LOGIC ---------- */
function onResults(results) {
  if (!ring) return;

  // HARD GUARD (fixes crash)
  if (
    !results ||
    !results.multiHandLandmarks ||
    results.multiHandLandmarks.length === 0
  ) {
    ring.visible = false;
    statusEl.innerText = "No hand";
    renderer.render(scene, camera3D);
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // Safety: landmark length check
  if (!lm || lm.length < 21) return;

  statusEl.innerText = "Hand + Ring locked ✓";

  // Ring finger joints
  const mcp = toWorld(lm[13]);
  const pip = toWorld(lm[14]);
  const pinky = toWorld(lm[17]);

  // Position
  ring.position.lerp(pip, 0.6);

  // Rotation
  const dir = new THREE.Vector3().subVectors(pip, mcp).normalize();
  ring.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );

  // Scale based on finger width
  const width = mcp.distanceTo(pinky);
  const scale = THREE.MathUtils.clamp(width * 2.2, 0.015, 0.045);
  ring.scale.setScalar(scale);

  ring.visible = true;

  renderer.render(scene, camera3D);
}

/* ---------- LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
