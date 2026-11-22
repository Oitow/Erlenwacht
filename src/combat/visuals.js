import * as THREE from 'three';

const vertexShader = `
  varying vec2 runeUv;
  void main() {
    runeUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 runeUv;
  uniform vec3 tint;
  uniform float progress;
  uniform float burst;
  void main() {
    float radius = length(runeUv);
    float rim = 1.0 - smoothstep(0.015, 0.06, abs(radius - 0.94));
    float outline = 1.0 - smoothstep(0.94, 1.0, radius);
    float wave = 1.0 - smoothstep(0.018, 0.085, abs(radius - progress * 0.95));
    float angle = atan(runeUv.y, runeUv.x + 0.00001);
    float marks = smoothstep(0.91, 0.99, cos(angle * 12.0));
    float alpha = mix(
      rim * (0.46 + progress * 0.34) + outline * 0.13 + wave * 0.28,
      (wave * 0.80 + rim * (0.22 + marks * 0.24) + outline * 0.06) * (1.0 - progress),
      burst
    );
    gl_FragColor = vec4(tint, alpha * outline);
    #include <colorspace_fragment>
  }
`;

export function createGroundEffect(group, world, tint, burst = false) {
  const geometry = new THREE.RingGeometry(0.01, 1, 32, 5);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const original = positions.array.slice();
  const progress = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(tint) }, progress, burst: { value: Number(burst) } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = burst ? 3 : 2;
  group.add(mesh);

  return {
    show(x, z, radius) {
      const ground = world.heightAt(x, z);
      mesh.position.set(x, ground + 0.09, z);
      for (let i = 0; i < positions.count; i++) {
        const offsetX = original[i * 3] * radius;
        const offsetZ = original[i * 3 + 2] * radius;
        positions.setXYZ(i, offsetX, world.heightAt(x + offsetX, z + offsetZ) - ground, offsetZ);
      }
      positions.needsUpdate = true;
      geometry.computeBoundingSphere();
      progress.value = 0;
      mesh.visible = true;
    },
    update(value) {
      progress.value = Math.min(1, Math.max(0, value));
    },
    hide() {
      mesh.visible = false;
    },
  };
}

export function createEnemyModels() {
  const body = new THREE.IcosahedronGeometry(1, 0);
  const hood = new THREE.DodecahedronGeometry(1, 0);
  const halo = new THREE.TorusGeometry(1.13, 0.045, 5, 24);
  const spike = new THREE.ConeGeometry(1, 1, 4);
  const materials = {
    hunter: new THREE.MeshStandardMaterial({ color: 0x332633, roughness: 0.87 }),
    sentinel: new THREE.MeshStandardMaterial({ color: 0x252d3d, roughness: 0.85 }),
    warden: new THREE.MeshStandardMaterial({ color: 0x58485d, roughness: 0.66 }),
    ward: new THREE.MeshBasicMaterial({ color: 0xd7a2ff }),
    edge: new THREE.MeshStandardMaterial({ color: 0x545448, roughness: 0.69 }),
    eyes: new THREE.MeshBasicMaterial({ color: 0xff9c63 }),
    flash: new THREE.MeshBasicMaterial({ color: 0xdaefff }),
  };

  function part(group, geometry, material, position, scale) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  }

  return function makeEnemyModel(archetype, group) {
    const silhouette = new THREE.Group();
    group.add(silhouette);
    const surface = materials[archetype];
    const isWarden = archetype === 'warden';
    const isSentinel = archetype !== 'hunter';
    const torso = part(silhouette, body, surface, [0, isSentinel ? 1.04 : 0.64, 0], isSentinel ? [0.82, 1.23, 0.61] : [0.76, 0.68, 1.01]);
    const head = part(silhouette, hood, surface, [0, isSentinel ? 1.91 : 0.68, isSentinel ? 0.14 : 0.73], isSentinel ? [0.5, 0.55, 0.49] : [0.5, 0.48, 0.55]);

    for (const side of [-1, 1]) {
      const horn = part(silhouette, spike, materials.edge, [side * (isSentinel ? 0.63 : 0.49), isSentinel ? 1.62 : 1.06, isSentinel ? 0.09 : 0.41], isSentinel ? [0.29, 0.75, 0.29] : [0.19, 0.61, 0.21]);
      horn.rotation.z = -side * 0.58;
      part(silhouette, body, materials.eyes, [side * 0.21, isSentinel ? 1.95 : 0.73, isSentinel ? 0.55 : 1.22], [0.11, 0.075, 0.08]);
    }

    const barrier = isWarden ? part(silhouette, halo, materials.ward, [0, 1.12, 0], [1, 1, 1]) : null;
    if (isWarden) silhouette.scale.setScalar(1.55);

    return {
      animate(phase, bob, windup, flash, warded) {
        silhouette.position.y = 0.04 + Math.sin(phase) * bob;
        silhouette.rotation.x = -windup * 0.14;
        torso.material = head.material = flash ? materials.flash : surface;
        if (barrier) {
          barrier.visible = warded;
          barrier.rotation.set(Math.PI / 2 + Math.sin(phase * 0.4) * 0.27, phase * 0.13, 0);
        }
      },
    };
  };
}
