import * as THREE from 'three';

const LIGHT = {
  dawn: { sky: 0x408795, air: 0xb3ac8b, ground: 0x70654d, sun: 0xffc184, intensity: 2.2, fill: 1.25, height: .24 },
  day: { sky: 0x3a80ad, air: 0xb2c7b8, ground: 0x746c53, sun: 0xffeac5, intensity: 2.55, fill: 1.65, height: .80 },
  dusk: { sky: 0x373964, air: 0xbd937c, ground: 0x52443d, sun: 0xffa168, intensity: 1.9, fill: .95, height: .15 },
  night: { sky: 0x0c1b33, air: 0x43596b, ground: 0x353b41, sun: 0xa1bcf1, intensity: .8, fill: .85, height: .4 },
};
const WEATHER = {
  clear: { fog: 1, cloud: .37 },
  mist: { fog: .49, cloud: .57 },
  storm: { fog: .69, cloud: .9 },
};
const VISIBILITY = { low: 595, medium: 820, high: 1060 };

export function createAtmosphere(scene) {
  const fog = new THREE.Fog(0xb3ac8b, 45, 780);
  scene.fog = fog;
  const skyLight = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  scene.add(skyLight, sun);

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      air: { value: new THREE.Color() },
      sky: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
      cloudCover: { value: .37 },
      clock: { value: 0 },
    },
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 air, sky, sunColor, sunDir;
      uniform float cloudCover, clock;
      varying vec3 skyDirection;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(skyDirection);
        float elevation = max(0.0, d.y);
        vec3 color = mix(air, sky, pow(elevation, .46));
        float facing = max(dot(d, sunDir), 0.0);
        color += sunColor * (pow(facing, 15.0) * .11 + smoothstep(.99923, .99978, facing) * .73);
        vec2 p = d.xz * 6.5 / (elevation + .21) + vec2(clock * .012, clock * .003);
        float field = .7 * noise(p) + .23 * noise(p * 2.13) + .07 * noise(p * 5.1);
        float clouds = smoothstep(.75 - cloudCover * .41, .91 - cloudCover * .36, field)
          * smoothstep(.03, .23, elevation);
        color = mix(color, mix(air * .83, sunColor * .68, .21 + pow(facing, 8.0) * .25), clouds * .66);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1180, 24, 16), skyMaterial);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const rainVertices = new Float32Array(150 * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainVertices, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({
    color: 0xbbdbe2, transparent: true, opacity: .27, depthWrite: false,
  }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const drops = Array.from({ length: 150 }, () => [Math.random() * 30 - 15, Math.random() * 16, Math.random() * 30 - 15]);
  const tint = new THREE.Color();
  const stormTint = new THREE.Color(0x7b9092);
  let chosenLight = 'dawn';
  let weather = 'clear';
  let quality = 'medium';
  let hour = 0;
  let cycleScene = '';
  let elapsed = 0;

  function apply() {
    const next = chosenLight === 'cycle' ? ['dawn', 'day', 'dusk', 'night'][Math.floor(hour / 45) % 4] : chosenLight;
    cycleScene = next;
    const light = LIGHT[next];
    const climate = WEATHER[weather];
    const haze = weather === 'storm' ? .42 : weather === 'mist' ? .16 : 0;
    tint.setHex(light.air).lerp(stormTint, haze);
    fog.color.copy(tint);
    fog.far = VISIBILITY[quality] * climate.fog;
    fog.near = weather === 'mist' ? 24 : fog.far * .13;
    skyMaterial.uniforms.air.value.copy(fog.color);
    skyMaterial.uniforms.sky.value.setHex(light.sky).lerp(stormTint, haze);
    skyMaterial.uniforms.cloudCover.value = climate.cloud;
    sun.position.set(next === 'dusk' ? .72 : -.53, light.height, -.42).normalize().multiplyScalar(100);
    skyMaterial.uniforms.sunDir.value.copy(sun.position).normalize();
    sun.color.setHex(light.sun);
    sun.intensity = light.intensity * (1 - haze);
    skyMaterial.uniforms.sunColor.value.setHex(light.sun).multiplyScalar(1 - haze * 1.9);
    skyLight.color.setHex(light.air);
    skyLight.groundColor.setHex(light.ground);
    skyLight.intensity = light.fill;
    rain.visible = weather === 'storm';
  }

  function update(dt, camera, player) {
    elapsed += dt;
    if (chosenLight === 'cycle') {
      hour += dt;
      if (cycleScene !== ['dawn', 'day', 'dusk', 'night'][Math.floor(hour / 45) % 4]) apply();
    }
    dome.position.copy(camera.position);
    skyMaterial.uniforms.clock.value = elapsed;
    if (!rain.visible) return;
    rain.position.set(player.x, player.y + 1, player.z);
    for (const [index, [x, phase, z]] of drops.entries()) {
      const y = (phase + 16 - (elapsed * 15 % 16)) % 16 - 2;
      const offset = index * 6;
      rainVertices[offset] = x;
      rainVertices[offset + 1] = y;
      rainVertices[offset + 2] = z;
      rainVertices[offset + 3] = x - .15;
      rainVertices[offset + 4] = y + .7;
      rainVertices[offset + 5] = z + .05;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  apply();
  return {
    update,
    setLight(key) { chosenLight = key; hour = 0; apply(); },
    setWeather(key) { weather = key; apply(); },
    setQuality(key) { quality = key; apply(); },
  };
}
