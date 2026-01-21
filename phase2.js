const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* ---------- MediaPipe Hands ---------- */

const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.8,
  minTrackingConfidence: 0.8
});

/* ---------- Results ---------- */

hands.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 🔴 NO HAND
  if (
    !results.multiHandLandmarks ||
    results.multiHandLandmarks.length === 0
  ) {
    statusEl.textContent = "No hand detected";
    statusEl.style.color = "red";
    return;
  }

  // 🟢 HAND CONFIRMED
  statusEl.textContent = "Hand detected ✔";
  statusEl.style.color = "lime";

  const landmarks = results.multiHandLandmarks[0];

  // Draw green dots
  ctx.fillStyle = "#00ff00";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(
      p.x * canvas.width,
      p.y * canvas.height,
      6,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
});

/* ---------- Camera ---------- */

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

camera.start().then(() => {
  statusEl.textContent = "Camera started";
});
