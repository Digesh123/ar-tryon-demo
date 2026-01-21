/* ---------------- DOM ---------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const switchButton = document.getElementById("switchCam");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* ---------------- STATE ---------------- */
let facingMode = "user";
let stream = null;
let mediapipeCamera = null;
let ring = null;

/* ---------------- CAMERA ---------------- */

async function startCamera() {
  // stop old stream
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  // allow camera hardware reset
  await new Promise(r => setTimeout(r, 300));

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  video.srcObject = stream;
  await video.play();

  // mirror front camera
  video.style.transform =
    facingMode === "user" ? "scaleX(-1)" : "scaleX(1)";

  // restart mediapipe camera
  if (mediapipeCamera) mediapipeCamera.stop();

  mediapipeCamera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 1280,
    height: 720,
  });

  mediapipeCamera.start();
}

switchButton.onclick = async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
};

startCamera();

/* ---------------- MEDIAPIPE HANDS ---------------- */

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

/* ---------------- THREE.JS ---------------- */

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera3D.position.z = 2;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 5);
scene.add(light);

// load ring
const loader = new THREE.GLTFLoader();
loader.load("ring.glb", gltf => {
  ring = gltf.scene;
  ring.scale.set(0.005, 0.005, 0.005);
  scene.add(ring);
});

/* ---------------- TRACKING ---------------- */

function onResults(results) {
  renderer.render(scene, camera3D);

  if (!results.multiHandLandmarks || !ring) return;

  const landmarks = results.multiHandLandmarks[0];

  // index finger base joint (MCP)
  const finger = landmarks[5];

  // handle mirroring
  const fx =
    facingMode === "user" ? 1 - finger.x : finger.x;

  // normalized device coords
  const x = (fx - 0.5) * 2;
  const y = -(finger.y - 0.5) * 2;

  const vector = new THREE.Vector3(x, y, 0.5);
  vector.unproject(camera3D);

  ring.position.lerp(vector, 0.6);
}
