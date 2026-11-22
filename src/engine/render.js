import * as THREE from 'three';

function createSky(scene) {
  const uniforms = {
    horizon: { value: new THREE.Color() },
    zenith: { value: new THREE.Color() },
    sunlight: { value: new THREE.Color(0xffbd88) },
    sunDirection: { value: new THREE.Vector3(-0.22, 0.15, -0.96).normalize() },
    daylight: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        vec4 projected = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = projected.xyww;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 horizon;
      uniform vec3 zenith;
      uniform vec3 sunlight;
      uniform vec3 sunDirection;
      uniform float daylight;
      varying vec3 direction;
      void main() {
        vec3 ray = normalize(direction);
        vec3 skyColor = mix(horizon, zenith, smoothstep(0.0, 0.62, ray.y));
        float sunAngle = max(0.0, dot(ray, sunDirection));
        float glow = pow(sunAngle, 45.0) * 0.37;
        float sun = smoothstep(0.9991, 0.99976, sunAngle) * 0.91;
        gl_FragColor = vec4(skyColor + sunlight * daylight * (glow + sun), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), material);
  sky.frustumCulled = false;
  sky.renderOrder = 1000;
  scene.add(sky);
  return uniforms;
}

export function createRenderer(canvas) {
  const scene = new THREE.Scene();
  const forestAir = new THREE.Color(0x293943);
  const passAir = new THREE.Color(0x9d817a);
  const forestSky = new THREE.Color(0x253449);
  const passSky = new THREE.Color(0x53667d);
  const forestLight = new THREE.Color(0xd8e6f2);
  const passLight = new THREE.Color(0xffbb87);
  const forestAmbient = new THREE.Color(0xb1c8d7);
  const passAmbient = new THREE.Color(0xe4c9c3);
  const forestGround = new THREE.Color(0x343122);
  const passGround = new THREE.Color(0x645061);
  const forestDirection = new THREE.Vector3(-24, 36, -11);
  const passDirection = new THREE.Vector3(-32, 21, -28);
  scene.background = forestAir.clone();
  scene.fog = new THREE.FogExp2(forestAir, 0.009);
  const hemisphere = new THREE.HemisphereLight(forestAmbient, forestGround, 1.55);
  const sun = new THREE.DirectionalLight(forestLight, 1.85);
  scene.add(hemisphere, sun);
  const sky = createSky(scene);

  const camera = new THREE.PerspectiveCamera(61, 1, 0.1, 390);
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const minRatio = Math.min(maxRatio, 0.75);
  let ratio = maxRatio;
  let slowSamples = 0;
  let fastSamples = 0;
  let lastLight;

  function updateLight() {
    const daylight = THREE.MathUtils.smoothstep(camera.position.z, 49, 129);
    if (daylight === lastLight) return;
    lastLight = daylight;
    scene.fog.color.copy(forestAir).lerp(passAir, daylight);
    scene.fog.density = THREE.MathUtils.lerp(0.009, 0.0073, daylight);
    scene.background.copy(scene.fog.color);
    sky.horizon.value.copy(scene.fog.color);
    sky.zenith.value.copy(forestSky).lerp(passSky, daylight);
    sky.daylight.value = daylight;
    hemisphere.color.copy(forestAmbient).lerp(passAmbient, daylight);
    hemisphere.groundColor.copy(forestGround).lerp(passGround, daylight);
    sun.color.copy(forestLight).lerp(passLight, daylight);
    sun.position.copy(forestDirection).lerp(passDirection, daylight);
    sun.intensity = 1.85 + daylight * 0.24;
  }

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
  return {
    scene, camera, adapt,
    render() {
      updateLight();
      renderer.render(scene, camera);
    },
  };
}
