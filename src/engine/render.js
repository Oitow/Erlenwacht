import * as THREE from 'three';

export function createRenderer(canvas) {
  const scene = new THREE.Scene();
  const air = 0x293943;
  scene.background = new THREE.Color(air);
  scene.fog = new THREE.FogExp2(air, 0.009);
  scene.add(new THREE.HemisphereLight(0xb1c8d7, 0x343122, 1.55));
  const moon = new THREE.DirectionalLight(0xd8e6f2, 1.85);
  moon.position.set(-24, 36, -11);
  scene.add(moon);

  const camera = new THREE.PerspectiveCamera(61, 1, 0.1, 390);
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const minRatio = Math.min(maxRatio, 0.75);
  let ratio = maxRatio;
  let slowSamples = 0;
  let fastSamples = 0;

  function resize() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setDrawingBufferSize(width, height, ratio);
  }

  function adapt(fps) {
    slowSamples = fps < 43 ? slowSamples + 1 : 0;
    fastSamples = fps >= 58 ? fastSamples + 1 : 0;
    const nextRatio = slowSamples >= 3
      ? Math.max(minRatio, ratio - 0.15)
      : fastSamples >= 8
        ? Math.min(maxRatio, ratio + 0.1)
        : ratio;
    if (nextRatio !== ratio) {
      ratio = nextRatio;
      slowSamples = fastSamples = 0;
      resize();
    }
  }

  window.addEventListener('resize', resize);
  resize();
  return { scene, camera, adapt, render: () => renderer.render(scene, camera) };
}
