document.addEventListener("DOMContentLoaded", () => {
  const viewer = document.getElementById("arViewer");
  const btn = document.getElementById("tryNowBtn");

  if (!viewer || !btn) return;

  btn.addEventListener("click", () => {
    // Required: user gesture to start AR
    if (viewer.activateAR) {
      viewer.activateAR();
    } else {
      alert("AR is not supported on this device.");
    }
  });
});
