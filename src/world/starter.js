import * as THREE from 'three';
import { makeRandom } from './scenery.js';
import { REED_BASIN, REED_BRIDGE, STARTER } from './starter-layout.js';
import { bridgeDeck, heightAt, pathCenter, poolRadius, surfaceAt, trailDistance } from './terrain.js';

const BARK = 0x523a2e;
const PLANK = 0x856045;
const BRASS = 0xc79650;
const SLATE = 0x524d59;
const ASH = 0x79615a;

function marker(add, x, z, radius, color, id = null) {
  add('mark', color, x, surfaceAt(x, z) + 0.08, z,
    radius, radius, radius, 0, -Math.PI / 2, id);
}

function fire(add, x, z, radius, raised = 0) {
  const y = heightAt(x, z) + raised;
  for (let piece = 0; piece < 8; piece++) {
    const yaw = piece * Math.PI / 4;
    const stoneX = x + Math.cos(yaw) * radius;
    const stoneZ = z + Math.sin(yaw) * radius;
    add('stone', 0x68615d, stoneX, y + 0.12, stoneZ, 0.33, 0.25, 0.3, yaw);
  }
  add('box', BARK, x, y + 0.15, z, radius * 1.5, 0.24, 0.32, 0.66);
  add('box', BARK, x, y + 0.17, z, radius * 1.35, 0.24, 0.3, -0.78);
  add('flame', 0xff8851, x, y + 0.63, z, radius * 0.58, 0.74, radius * 0.48, 0.16);
  add('flame', 0xffca72, x - radius * 0.15, y + 0.92, z + radius * 0.22,
    radius * 0.33, 0.51, radius * 0.29, 0, 0.18);
}

function sign(add, collision, x, z, yaw, color) {
  const y = heightAt(x, z);
  add('column', BARK, x, y + 1.08, z, 0.1, 2.17, 0.1);
  add('box', color, x, y + 1.93, z, 1.16, 0.31, 0.13, yaw);
  add('box', 0xc29761, x, y + 1.93, z + 0.012, 0.81, 0.07, 0.17, yaw);
  collision.addCircle(x, z, 0.14);
}

function buildCamp(add, collision) {
  const { camp, workbench } = STARTER;
  const shelterX = -8.1;
  const shelterZ = 193;
  const shelterY = heightAt(shelterX, shelterZ);
  add('box', BARK, shelterX, shelterY + 1.43, shelterZ, 6.6, 3.1, 6.5);
  for (const side of [-1, 1]) {
    add('box', 0x674039, shelterX + side * 1.69, shelterY + 3.51, shelterZ,
      7.12, 0.18, 4, Math.PI / 2, side * 0.49);
    add('box', PLANK, shelterX + side * 2.65, shelterY + 1.3, shelterZ + 3.28,
      0.36, 2.55, 0.22);
    add('box', 0x9c734d, shelterX + side * 2.12, shelterY + 1.75, shelterZ - 3.29,
      0.68, 0.82, 0.16);
    add('flame', 0xffb15d, shelterX + side * 2.12, shelterY + 1.75, shelterZ - 3.39,
      0.28, 0.36, 0.05);
  }
  add('box', 0x362a2a, shelterX, shelterY + 1.1, shelterZ + 3.26, 1.4, 2.15, 0.24);
  add('box', ASH, shelterX, shelterY + 4.48, shelterZ, 0.3, 0.26, 7.3);
  collision.addBox(shelterX, shelterZ, 6.6, 6.5);

  fire(add, camp.x, camp.z, 0.72);
  collision.addCircle(camp.x, camp.z, 0.61);
  for (const side of [-1, 1]) {
    const x = camp.x + side * 2.8;
    const z = camp.z + 1.45;
    add('box', PLANK, x, heightAt(x, z) + 0.26, z, 1.02, 0.58, 1.8, side * 0.28);
    collision.addBox(x, z, 1.06, 1.8);
  }
  const flagX = 3.7;
  const flagZ = 192;
  const flagY = heightAt(flagX, flagZ);
  add('column', BARK, flagX, flagY + 2.8, flagZ, 0.13, 5.8, 0.13);
  add('box', 0x9e4939, flagX + 0.74, flagY + 4.1, flagZ, 1.45, 2.9, 0.08);
  add('box', BRASS, flagX + 0.75, flagY + 4.35, flagZ + 0.055, 0.75, 0.14, 0.08);
  add('box', BRASS, flagX + 0.75, flagY + 4.35, flagZ + 0.055, 0.16, 0.75, 0.08);
  collision.addCircle(flagX, flagZ, 0.16);

  const { x, z } = workbench;
  const y = heightAt(x, z);
  for (const dx of [-1.22, 1.22]) {
    for (const dz of [-0.53, 0.53]) {
      add('box', BARK, x + dx, heightAt(x + dx, z + dz) + 0.46, z + dz, 0.17, 1, 0.2);
    }
  }
  add('box', PLANK, x, y + 1.02, z, 2.87, 0.2, 1.33);
  add('box', SLATE, x - 0.72, y + 1.22, z, 0.7, 0.27, 0.44);
  add('stone', ASH, x + 0.54, y + 1.16, z - 0.21, 0.22, 0.12, 0.18);
  add('stone', ASH, x + 0.76, y + 1.15, z + 0.11, 0.16, 0.1, 0.17);
  collision.addBox(x, z, 2.87, 1.33);
  for (const dx of [-2, 2]) {
    add('column', BARK, x + dx, heightAt(x + dx, z - 1) + 1.54, z - 1, 0.11, 3.14, 0.11);
    collision.addCircle(x + dx, z - 1, 0.16);
  }
  add('box', 0x6e5553, x, y + 2.97, z - 0.55, 4.58, 0.18, 2.56, 0, 0.17);
  add('flame', 0xffac60, x - 1.83, y + 2.45, z - 0.97, 0.16, 0.24, 0.16);
  marker(add, x, z, 1.72, 0xd49d58);
}

function buildArch(add, collision) {
  const [, arch] = STARTER.landmarks;
  const { x, z } = arch;
  const top = heightAt(x, z) + 9.8;
  for (const side of [-1, 1]) {
    const dx = side * 5.25;
    const y = heightAt(x + dx, z);
    add('box', SLATE, x + dx, (y + top) * 0.5, z, 2.25, top - y + 0.18, 2.65);
    add('box', ASH, x + dx, y + 1.45, z, 2.83, 2.95, 3.05);
    add('box', 0x81706a, x + dx, top - 0.25, z, 2.75, 0.45, 3.03);
    add('column', SLATE, x + side * 10.5, y + 2.6, z - 3.1, 1.27, 5.45, 1.4, side * 0.2, side * 0.11);
    collision.addBox(x + dx, z, 2.83, 3.05);
    collision.addCircle(x + side * 10.5, z - 3.1, 1.22);
  }
  add('box', SLATE, x, top - 0.29, z, 9.8, 1.44, 2.65);
  add('box', ASH, x, top + 0.35, z, 11.18, 0.52, 2.75);
  add('flame', 0xf9bb76, x, top + 0.96, z, 0.5, 0.89, 0.5);
  sign(add, collision, x - 7.5, z - 4.7, 0.21, 0x62514d);
  sign(add, collision, pathCenter(178) + 4, 178, -0.26, 0x795146);
}

function buildBeacon(add, collision) {
  const { x, z } = STARTER.beacon;
  const y = heightAt(x, z);
  add('column', SLATE, x, y + 0.23, z, 1.4, 0.48, 1.39, Math.PI / 6);
  add('column', ASH, x, y + 0.83, z, 0.96, 1, 0.96, Math.PI / 6);
  add('stone', SLATE, x, y + 1.38, z, 1.12, 0.25, 1.08);
  fire(add, x, z, 0.65, 1.4);
  marker(add, x, z, 1.65, 0xe2a660);
  collision.addCircle(x, z, 1.18);
}

function buildBasin(scene, add, collision, random) {
  const pool = REED_BASIN;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 30),
    new THREE.MeshStandardMaterial({ color: 0x345c5e, roughness: 0.42, metalness: 0.07 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(pool.x, pool.waterY, pool.z);
  water.scale.set(pool.width * 1.18, pool.depth * 1.18, 1);
  scene.add(water);

  const { minX, maxX, z, width } = REED_BRIDGE;
  for (let x = minX + 0.5; x < maxX; x++) {
    const y = bridgeDeck(x);
    const tilt = Math.atan2(bridgeDeck(x - 0.5) - bridgeDeck(x + 0.5), 1);
    add('box', Math.round(x - minX) % 2 ? PLANK : 0x775841,
      x, y - 0.075, z, width, 0.15, 0.98, Math.PI / 2, tilt);
  }
  for (const side of [-1, 1]) {
    const railZ = z + side * width * 0.48;
    for (let x = minX + 7; x <= maxX - 7; x += 4.9) {
      const y = Math.max(bridgeDeck(x), heightAt(x, railZ));
      add('column', BARK, x, y + 0.37, railZ, 0.13, 1.2, 0.13);
    }
    add('box', BARK, (minX + maxX) * 0.5, REED_BRIDGE.y + 0.72, railZ,
      maxX - minX - 15, 0.15, 0.15);
    collision.addBox((minX + maxX) * 0.5, railZ, maxX - minX - 15, 0.15);
  }
  sign(add, collision, maxX + 1.5, z + 2.95, 0.2, 0x48625a);
  for (let tuft = 0; tuft < 67; tuft++) {
    const angle = random() * Math.PI * 2;
    const shore = 0.94 + random() * 0.36;
    const x = pool.x + Math.cos(angle) * pool.width * shore;
    const reedZ = pool.z + Math.sin(angle) * pool.depth * shore;
    if (Math.abs(reedZ - z) < 2.5) continue;
    for (let blade = 0; blade < 3; blade++) {
      const y = Math.max(heightAt(x, reedZ), pool.waterY - 0.13);
      add('cone', blade === 1 ? 0x61724d : 0x596945, x + (blade - 1) * 0.21, y + 0.38,
        reedZ, 0.105, 0.83 + random() * 0.32, 0.14, angle + blade, (blade - 1) * 0.24);
    }
  }
}

function buildRidge(add, collision) {
  const { x, z } = STARTER.landmarks[3];
  for (const [dx, dz, height, width] of [[3, -1.2, 5.6, 1.1], [6, -3, 7.3, 1.54], [8.1, -6.1, 4.5, 1.39]]) {
    const px = x + dx;
    const pz = z + dz;
    const y = heightAt(px, pz);
    add('column', SLATE, px, y + height * 0.45, pz, width, height, width, dx, 0.11);
    add('box', ASH, px, y + height * 0.94, pz, width * 1.85, 0.24, width * 1.85, dx * 0.4);
    collision.addCircle(px, pz, width * 0.8);
  }
  const y = heightAt(x, z);
  add('column', BARK, x, y + 2.8, z, 0.12, 5.6, 0.12);
  add('box', 0x94524b, x + 0.75, y + 4.51, z, 1.5, 1.84, 0.06);
  add('box', BRASS, x + 0.78, y + 4.58, z + 0.052, 0.66, 0.12, 0.08);
  collision.addCircle(x, z, 0.19);
  marker(add, x, z, 1.45, 0xc19769);
  sign(add, collision, 16.5, 171, -0.33, 0x907178);
}

function buildNodes(add) {
  for (const { x, z, kind, id } of STARTER.nodes) {
    const y = surfaceAt(x, z);
    marker(add, x, z, 0.79, kind === 'wood' ? 0xc69363
      : kind === 'ore' ? 0xd5acdb : 0x9cc789, id);
    if (kind === 'wood') {
      for (const [offset, angle] of [[-0.51, -0.6], [0.23, -0.62], [0.57, -0.35]]) {
        add('column', BARK, x + offset, y + 0.26, z, 0.3, 1.11, 0.3, angle, Math.PI / 2, id);
        add('column', 0x886642, x + offset + Math.sin(angle) * 0.42, y + 0.25,
          z + Math.cos(angle) * 0.47, 0.22, 0.15, 0.22, angle, Math.PI / 2, id);
      }
    } else if (kind === 'ore') {
      add('stone', SLATE, x, y + 0.3, z, 0.97, 0.54, 0.79, 0.43, 0.09, id);
      for (let vein = 0; vein < 3; vein++) {
        add('flame', vein === 1 ? 0xc6a9c6 : 0xa680a5, x + (vein - 1) * 0.46,
          y + 0.48 + (vein === 1 ? 0.13 : 0), z + 0.14, 0.185, 0.32, 0.17, vein, 0.14, id);
      }
    } else {
      for (let stem = 0; stem < 6; stem++) {
        const angle = stem * 1.04;
        const px = x + Math.sin(angle) * 0.34;
        const pz = z + Math.cos(angle) * 0.32;
        add('cone', 0x78895a, px, y + 0.3, pz, 0.1, 0.66, 0.13, angle, 0.23, id);
        if (stem % 2 === 0) {
          add('flame', 0xc5c58d, px, y + 0.63, pz, 0.08, 0.11, 0.08, angle, 0.23, id);
        }
      }
    }
  }
}

function scatterStarter(add, collision, random) {
  const clear = Object.values(STARTER)
    .flatMap(entry => Array.isArray(entry) ? entry : [entry]);
  for (let row = 76; row < 277; row += 12) {
    for (let column = -194; column < 194; column += 12) {
      const x = column + random() * 10;
      const z = row + random() * 10;
      if (trailDistance(x, z) < 6.4 || poolRadius(REED_BASIN, x, z) < 1.25
        || clear.some(point => (x - point.x) ** 2 + (z - point.z) ** 2 < (z > 166 ? 50 : 36))) continue;
      const choice = random();
      const y = heightAt(x, z);
      const yaw = random() * Math.PI * 2;
      if (choice < 0.34) {
        const size = 0.65 + random() * (Math.abs(x) > 26 ? 4.25 : 2);
        add('stone', choice < 0.16 ? SLATE : ASH, x, y + size * 0.53, z,
          size, size * (0.63 + random() * 0.76), size * 0.83, yaw, 0.22);
        if (size > 1.4) collision.addCircle(x, z, size * 0.72);
      } else if (choice < (z < 103 ? 0.72 : 0.48)) {
        const height = 5 + random() * 11;
        const width = 0.39 + height * 0.056;
        add('column', 0x4b3933, x, y + height * 0.47, z, width, height, width, yaw, 0.055);
        if (choice < 0.39 && z > 105) {
          add('column', 0x57433b, x + Math.sin(yaw) * width, y + height * 0.7,
            z + Math.cos(yaw) * width, width * 0.34, height * 0.61, width * 0.34, yaw, 0.62);
        } else {
          add('cone', 0x465747, x, y + height * 0.84, z, width * 3.33, height * 0.63, width * 3.1, yaw);
          add('cone', 0x4b5b4e, x, y + height * 1.05, z, width * 2.4, height * 0.46, width * 2.45, yaw + 0.43);
        }
        collision.addCircle(x, z, width * 0.82);
      }
    }
  }

  for (let patch = 0; patch < 132; patch++) {
    const z = 64 + random() * 155;
    const x = pathCenter(z) + (patch % 2 ? 1 : -1) * (4.3 + random() * 8.1);
    const y = heightAt(x, z);
    const size = 0.16 + random() * 0.42;
    add('cone', patch % 3 ? 0x616044 : 0x8a734f, x, y + size * 0.3, z,
      0.15, size, 0.17, patch * 0.65, 0.29);
  }
}

export function buildStarter(scene, { add }, collision, seed) {
  const random = makeRandom(seed ^ 0x814be611);
  scatterStarter(add, collision, random);
  buildCamp(add, collision);
  buildArch(add, collision);
  buildBasin(scene, add, collision, random);
  buildRidge(add, collision);
  buildBeacon(add, collision);
  buildNodes(add);
  sign(add, collision, -4, STARTER.trail.z, -0.27, 0x6e5945);
}

export function buildEnclaveWayfire({ add }, collision, checkpoint) {
  const x = checkpoint.x - 4.1;
  const z = checkpoint.z - 1.6;
  fire(add, x, z, 0.74);
  collision.addCircle(x, z, 0.64);
}
