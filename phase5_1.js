import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------- DOM ---------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
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
camera3D.position.z = 1.5;

/* ---------- LIGHTING (CRITICAL) ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(0.5, 1, 2);
scene.add(dirLight);

/* ---------- RING ---------- */
let ring = null;

new GLTFLoader().load("assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.traverse(m => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(ring);
  console.log("Ring loaded");
});

/* ---------- MEDIAPIPE HANDS ---------- */
const hands = new window.Hands({
  locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(results => {
  if (!ring) return;

  if (!results.multiHandLandmarks) {
    ring.visible = false;
    return;
  }

  ring.visible = true;

  const lm = results.multiHandLandmarks[0];

  // Ring finger joints
  const mcp = lm[13]; // base
  const pip = lm[14];
  const dip = lm[15];

  /* ---------- POSITION ---------- */
  const x = (1 - mcp.x - 0.5) * 2;
  const y = -(mcp.y - 0.5) * 2;
  const z = -mcp.z * 2;

  const pos = new THREE.Vector3(x, y, z).unproject(camera3D);
  ring.position.lerp(pos, 0.5);

  /* ---------- SCALE (finger thickness) ---------- */
  const dx = pip.x - mcp.x;
  const dy = pip.y - mcp.y;
  const fingerLength = Math.sqrt(dx * dx + dy * dy);

  const scale = THREE.MathUtils.clamp(
    fingerLength * 3.5,
    0.04,
    0.065
  );
  ring.scale.setScalar(scale);

  /* ---------- ROTATION (REALISM CORE) ---------- */
  const dir = new THREE.Vector3(
    dip.x - mcp.x,
    dip.y - mcp.y,
    dip.z - mcp.z
  ).normalize();

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  ring.quaternion.slerp(quat, 0.4);

  /* ---------- DEPTH PUSH (embed in finger) ---------- */
  ring.position.addScaledVector(dir, -scale * 0.6);
});

/* ---------- CAMERA ---------- */
let facingMode = "user";
let stream;
let mpCamera;

async function startCamera() {
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

/* ---------- SWITCH CAMERA ---------- */
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
