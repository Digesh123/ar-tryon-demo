import * as THREE from "https://unpkg.com/three@0.152.2/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js";

import Hands from "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

// ---------- DOM ----------
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchBtn = document.getElementById("switchCam");

// ---------- THREE ----------
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

// ---------- Load Ring ----------
let ring;
new GLTFLoader().load("./assets/ring.glb", gltf => {
  ring = gltf.scene;
  ring.scale.set(0.01, 0.01, 0.01);
  scene.add(ring);
});

// ---------- Camera ----------
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

switchBtn.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

// ---------- MediaPipe ----------
const hands = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});

hands.setOptions({
  maxNumHands: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(results => {
  renderer.render(scene, camera3D);

  if (!results.multiHandLandmarks || !ring) return;

  const finger = results.multiHandLandmarks[0][5]; // index MCP

  const x = (1 - finger.x - 0.5) * 2;
  const y = -(finger.y - 0.5) * 2;

  const pos = new THREE.Vector3(x, y, 0.5);
  pos.unproject(camera3D);

  ring.position.lerp(pos, 0.5);
});

const mpCamera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

startCamera();
