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

/* ---------- DEBUG DOTS ---------- */
const debugDots = [];
const dotGeo = new THREE.SphereGeometry(0.005);
const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

for (let i = 0; i < 21; i++) {
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.visible = false;
  scene.add(dot);
  debugDots.push(dot);
}

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
let stream;

const mpCamera = new window.Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode }
  });

  video.srcObject = stream;
  await video.play();
  mpCamera.start();
}

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  startCamera();
};

startCamera();

/* ---------- HELPERS ---------- */
function toWorld(lm) {
  const x = (lm.x - 0.5) * 2;
  const y = -(lm.y - 0.5) * 2;
  return new THREE.Vector3(x, y, 0.5).unproject(camera3D);
}

/* ---------- MAIN LOGIC (PHASE 4) ---------- */
function onResults(results) {
  if (!ring) return;

  if (!results.multiHandLandmarks) {
    ring.visible = false;
    debugDots.forEach(d => d.visible = false);
    statusEl.innerText = "No hand";
    return;
  }

  const lm = results.multiHandLandmarks[0];

  statusEl.innerText = "Hand + Ring locked ✓";

  // show debug dots
  lm.forEach((p, i) => {
    debugDots[i].position.copy(toWorld(p));
    debugDots[i].visible = true;
  });

  // Ring finger joints
  const mcp = toWorld(lm[13]);
  const pip = toWorld(lm[14]);
  const pinky = toWorld(lm[17]);

  // Position
  ring.position.lerp(pip, 0.7);

  // Rotation
  const dir = new THREE.Vector3().subVectors(pip, mcp).normalize();
  ring.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );

  // Scale (finger width)
  const width = mcp.distanceTo(pinky);
  const scale = THREE.MathUtils.clamp(width * 2.4, 0.015, 0.05);
  ring.scale.setScalar(scale);

  ring.visible = true;

  renderer.render(scene, camera3D);
}

/* ---------- RENDER LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
