const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let facingMode = "user"; // front camera

/* ---------------- CAMERA ---------------- */

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
  });
  video.srcObject = stream;
}
startCamera();

document.getElementById("switchCam").onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
  await startCamera();
};

/* ---------------- MEDIAPIPE ---------------- */

const hands = new Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 1280,
  height: 720,
});
camera.start();

/* ---------------- THREE.JS ---------------- */

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera3D = new THREE.OrthographicCamera(
  -1, 1, 1, -1, 0.1, 10
);
camera3D.position.z = 5;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 5);
scene.add(light);

let ring;

const loader = new THREE.GLTFLoader();
loader.load("ring.glb", gltf => {
  ring = gltf.scene;
  ring.scale.set(0.02, 0.02, 0.02);
  scene.add(ring);
});

/* ---------------- TRACKING ---------------- */

function onResults(results) {
  renderer.render(scene, camera3D);

  if (!results.multiHandLandmarks || !ring) return;

  const landmarks = results.multiHandLandmarks[0];

  // Index finger base (MCP joint)
  const finger = landmarks[5];

  // Convert normalized coords → screen coords
  const x = (finger.x - 0.5) * 2;
  const y = -(finger.y - 0.5) * 2;

  ring.position.set(x, y, 0);
}
