import * as THREE from 'three';
import {
  expeditionBiome, heightAt, MOOR_POOLS, pathCenter, poolRadius, trailDistance, WORLD_BOUNDS,
} from './terrain.js';
import { makeRandom } from './scenery.js';

export const EXPEDITION_LANDMARKS = {
  northGate: { x: 0, z: -215, name: 'Nordtor' },
  crossroads: { x: -3, z: -260, name: 'Wachtstein' },
  moor: { x: -71, z: -309, name: 'Schwarzes Moor' },
  quarry: { x: 66, z: -322, name: 'Mondbruch' },
  spire: { x: 1, z: -422, name: 'Krähenwarte' },
};

export const EXPEDITION_BOSS = {
  id: 'expedition-watchkeeper', x: 1, z: -431, archetype: 'brute', tier: 4,
  zone: 'expedition', optional: true,
};

const ENCOUNTERS = [
  ['north-hound', 7, -271, 'hunter', 2],
  ['wachtstein-guard', 11, -285, 'sentinel', 2],
  ['moor-runner', -49, -290, 'hunter', 2],
  ['moor-spitter', -79, -301, 'spitter', 2],
  ['moor-hollow', -88, -321, 'brute', 2],
  ['moor-bile', -73, -335, 'spitter', 3],
  ['quarry-wyrm', 42, -299, 'spitter', 2],
  ['quarry-guard', 67, -311, 'sentinel', 2],
  ['quarry-hauler', 85, -327, 'brute', 3],
  ['quarry-stalker', 103, -341, 'hunter', 3],
  ['spire-road-guard', -7, -360, 'sentinel', 3],
  ['spire-cliff-hunter', 5, -381, 'hunter', 3],
  ['spire-scree-spitter', -8, -404, 'spitter', 3],
];

export function createExpeditionEncounters() {
  return ENCOUNTERS.map(([id, x, z, archetype, tier]) => ({
    id, x, z, archetype, tier, zone: 'expedition', respawn: 55,
  }));
}

export function buildTrailCamp({ add }, collision) {
  const z = 30;
  const x = pathCenter(z) - 5.7;
  const y = heightAt(x, z);
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.72, 0.72]) {
      const postX = x + dx;
      const postZ = z + dz;
      const postY = heightAt(postX, postZ);
      add('column', 0x544136, postX, postY + 0.94, postZ, 0.12, 1.9, 0.12);
      collision.addCircle(postX, postZ, 0.15);
    }
  }
  for (const direction of [-1, 1]) {
    add('box', 0x61473a, x, y + 2.17, z + direction * 0.42,
      2.65, 0.15, 1.01, 0, direction * 0.34);
  }

  add('box', 0x574838, x - 0.25, y + 0.26, z, 1.35, 0.58, 1.26, 0.2);
  collision.addBox(x - 0.25, z, 1.45, 1.35);
  const campfireX = x + 1.1;
  const campfireZ = z - 4.1;
  for (let stone = 0; stone < 8; stone++) {
    const angle = stone * Math.PI / 4;
    const stoneX = campfireX + Math.cos(angle) * 0.68;
    const stoneZ = campfireZ + Math.sin(angle) * 0.68;
    add('stone', 0x64605a, stoneX, heightAt(stoneX, stoneZ) + 0.12, stoneZ,
      0.27, 0.22, 0.22, angle);
  }
  add('flame', 0xff9c52, campfireX, heightAt(campfireX, campfireZ) + 0.38, campfireZ,
    0.32, 0.68, 0.31);
}

function standingStone(add, collision, x, z, height, radius, color, yaw = 0) {
  add('column', color, x, heightAt(x, z) + height * 0.44, z,
    radius, height, radius * 0.79, yaw, 0.1);
  collision.addCircle(x, z, radius * 0.82);
}

function buildLandmarks(add, collision, landmarks) {
  const { crossroads, moor, quarry, spire } = landmarks;
  const dark = 0x4c5155;
  const weathered = 0x65665f;
  standingStone(add, collision, crossroads.x, crossroads.z, 4.9, 0.86, dark);
  add('flame', 0xe4ad6c, crossroads.x, heightAt(crossroads.x, crossroads.z) + 4.83,
    crossroads.z, 0.28, 0.43, 0.28);
  for (const side of [-1, 1]) {
    const x = crossroads.x + side * 3.6;
    standingStone(add, collision, x, crossroads.z + 1.4, 2.45, 0.46, weathered);
    add('box', 0x84503d, x, heightAt(x, crossroads.z + 1.4) + 2.4, crossroads.z + 1.45,
      1, 0.19, 0.28, side * 0.35);
  }

  for (const [dx, dz, h] of [[-3.6, 0, 6.7], [3.3, 0, 4.9], [-6.6, -3.8, 2.4], [5, -5, 3.3]]) {
    const x = moor.x + dx;
    const z = moor.z + dz;
    standingStone(add, collision, x, z, h, 0.87, 0x42605a, dx * 0.35);
  }
  for (let i = 0; i < 10; i++) {
    const x = moor.x + (i - 4.5) * 1.48;
    const z = moor.z - 1.8;
    add('box', 0x506962, x, heightAt(x, z) + 0.08, z, 1.36, 0.17, 2.2, i * 0.09);
  }

  for (const [dx, dz, h] of [[-4.6, -2, 5.9], [5.4, -2.5, 6.7], [-7, -5.5, 3.8], [8.1, -7, 9.4]]) {
    const x = quarry.x + dx;
    const z = quarry.z + dz;
    standingStone(add, collision, x, z, h, 1.45, 0x57494e, dx * 0.2);
    add('flame', 0xce9edf, x, heightAt(x, z) + h * 0.85, z - 0.19,
      0.41, 0.94, 0.36, dx * 0.6);
  }

  for (const side of [-1, 1]) {
    const x = spire.x + side * 10.5;
    const y = heightAt(x, spire.z);
    add('box', dark, x, y + 5.8, spire.z, 5.6, 12.4, 6.2);
    add('column', 0x343543, x, y + 14.1, spire.z, 3.5, 3.8, 3.5, Math.PI / 6);
    add('cone', 0x242734, x, y + 19, spire.z, 3.8, 7.4, 3.8, Math.PI / 6);
    add('box', 0x9d4d3e, x, y + 7.4, spire.z + 3.14, 1.28, 4.5, 0.12);
    collision.addBox(x, spire.z, 5.6, 6.2);
    for (const z of [spire.z - 12, spire.z - 23]) {
      standingStone(add, collision, x + side * 0.8, z, 6.2, 0.85, weathered);
    }
  }
  const archY = heightAt(spire.x, spire.z);
  add('box', weathered, spire.x, archY + 9.9, spire.z, 16, 1.7, 2.3);
  add('box', dark, spire.x, archY + 11.15, spire.z, 17.1, 1.3, 2.6);
  add('flame', 0xe67b69, spire.x, archY + 12.7, spire.z, 0.74, 1.62, 0.74);
}

function buildPools(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x263f46, roughness: 0.32, metalness: 0.08,
  });
  const geometry = new THREE.CircleGeometry(1, 24);
  for (const pool of MOOR_POOLS) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pool.x, -0.77, pool.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(pool.width * 0.98, pool.depth * 0.98, 1);
    scene.add(mesh);
  }
}

function generateScenery(add, collision, encounters, landmarks, seed) {
  const random = makeRandom(seed ^ 0x8a7c930b);
  const points = Object.values(landmarks);

  for (let row = -510; row < -240; row += 11) {
    for (let column = -208; column < 208; column += 11) {
      const x = column + 1 + random() * 9;
      const z = row + 1 + random() * 9;
      const biome = expeditionBiome(x, z);
      if (trailDistance(x, z) < 6.8
        || points.some(point => (x - point.x) ** 2 + (z - point.z) ** 2 < 175)
        || encounters.some(enemy => (x - enemy.x) ** 2 + (z - enemy.z) ** 2 < 29)
        || MOOR_POOLS.some(pool => poolRadius(pool, x, z) < 1.18)) continue;

      const sample = random();
      const y = heightAt(x, z);
      const yaw = random() * Math.PI * 2;
      const solid = x > WORLD_BOUNDS.minX && x < WORLD_BOUNDS.maxX && z > WORLD_BOUNDS.minZ;
      if ((biome === 'march' && sample < 0.62) || (biome === 'moor' && sample < 0.32)) {
        const height = biome === 'moor' ? 4.4 + random() * 5.7 : 9.2 + random() * 14.5;
        const width = height * 0.07;
        const bark = biome === 'moor' ? 0x423d38 : 0x36302e;
        add('column', bark, x, y + height * 0.45, z, width, height, width, yaw);
        if (biome === 'moor') {
          for (const side of [-1, 1]) {
            const arm = width * 1.9;
            add('column', bark, x + Math.cos(yaw) * arm * side, y + height * 0.68,
              z + Math.sin(yaw) * arm * side, width * 0.31, height * 0.42, width * 0.31,
              -yaw + side * Math.PI / 2, 0.86);
          }
        } else {
          for (let layer = 0; layer < 3; layer++) {
            const crown = width * (3.6 - layer * 0.72);
            add('cone', [0x263f3d, 0x314b47, 0x395450][layer], x,
              y + height * (0.6 + layer * 0.16), z, crown, height * 0.45, crown,
              yaw + layer * 0.28);
          }
        }
        if (solid) collision.addCircle(x, z, width * 0.81);
      } else if (sample < 0.74) {
        const size = 0.5 + random() * (biome === 'quarry' ? 4.1 : 2.5);
        const tall = biome === 'quarry' && sample < 0.40;
        const color = biome === 'quarry' ? 0x5a515d : biome === 'spire' ? 0x515564 : 0x3a514d;
        add(tall ? 'column' : 'stone', color, x, y + size * (tall ? 1.1 : 0.32), z,
          size, size * (tall ? 2.7 : 0.75), size * 0.76, yaw, 0.18);
        if (tall && sample < 0.13) {
          add('flame', 0xab7da4, x + 0.23, y + size * 2.36, z, size * 0.17, size * 0.5,
            size * 0.16, yaw, 0.12);
        }
        if (solid && size > 1.28) collision.addCircle(x, z, size * 0.69);
      }
    }
  }
}

export function buildExpedition(scene, { add }, collision, encounters, landmarks, seed) {
  buildPools(scene);
  generateScenery(add, collision, encounters, landmarks, seed);
  buildLandmarks(add, collision, landmarks);
}
