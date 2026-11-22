import * as THREE from 'three';
import { heightAt, pathCenter } from './terrain.js';

const BOX = 'box';
const COLUMN = 'column';
const CONE = 'cone';
const STONE = 'stone';
const FLAME = 'flame';
const MARK = 'mark';
const CELL_SIZE = 60;

export function createScenery(scene) {
  const geometries = {
    [BOX]: new THREE.BoxGeometry(1, 1, 1),
    [COLUMN]: new THREE.CylinderGeometry(0.64, 0.94, 1, 6, 1),
    [CONE]: new THREE.ConeGeometry(1, 1, 6),
    [STONE]: new THREE.DodecahedronGeometry(1, 0),
    [FLAME]: new THREE.OctahedronGeometry(1),
    [MARK]: new THREE.TorusGeometry(1, 0.06, 4, 24),
  };
  const matte = new THREE.MeshStandardMaterial({ roughness: 0.96 });
  const glowing = new THREE.MeshBasicMaterial();
  const buckets = new Map();
  const chunks = new Map();
  const tracked = new Map();
  const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -2048, 0);
  let active = new Set();
  let lastColumn;
  let lastRow;

  function add(shape, color, x, y, z, sx, sy, sz, yaw = 0, tilt = 0, trackedId = null) {
    const cell = Math.floor(x / CELL_SIZE) + ':' + Math.floor(z / CELL_SIZE);
    const key = shape + ':' + cell;
    if (!buckets.has(key)) buckets.set(key, { shape, cell, placements: [] });
    buckets.get(key).placements.push({ x, y, z, sx, sy, sz, yaw, tilt, color, trackedId });
  }

  function assemble() {
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    for (const { shape, cell, placements } of buckets.values()) {
      const material = shape === FLAME || shape === MARK ? glowing : matte;
      const mesh = new THREE.InstancedMesh(geometries[shape], material, placements.length);
      placements.forEach((p, i) => {
        transform.position.set(p.x, p.y, p.z);
        transform.scale.set(p.sx, p.sy, p.sz);
        transform.rotation.set(p.tilt, p.yaw, 0, 'YXZ');
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        mesh.setColorAt(i, color.setHex(p.color));
        if (p.trackedId) {
          if (!tracked.has(p.trackedId)) tracked.set(p.trackedId, { visible: true, instances: [] });
          tracked.get(p.trackedId).instances.push({ mesh, index: i, matrix: transform.matrix.clone() });
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (!chunks.has(cell)) {
        const chunk = new THREE.Group();
        chunk.visible = false;
        chunks.set(cell, chunk);
        scene.add(chunk);
      }
      chunks.get(cell).add(mesh);
    }
    buckets.clear();
  }

  function update(position) {
    const column = Math.floor(position.x / CELL_SIZE);
    const row = Math.floor(position.z / CELL_SIZE);
    if (column === lastColumn && row === lastRow) return;
    lastColumn = column;
    lastRow = row;
    const nearby = new Set();
    for (let z = row - 3; z <= row + 3; z++) {
      for (let x = column - 3; x <= column + 3; x++) {
        const chunk = chunks.get(`${x}:${z}`);
        if (!chunk) continue;
        chunk.visible = true;
        nearby.add(chunk);
      }
    }
    for (const chunk of active) {
      if (!nearby.has(chunk)) chunk.visible = false;
    }
    active = nearby;
  }

  function setTrackedVisible(id, visible) {
    const entry = tracked.get(id);
    if (!entry || entry.visible === visible) return;
    entry.visible = visible;
    for (const { mesh, index, matrix } of entry.instances) {
      mesh.setMatrixAt(index, visible ? matrix : hiddenMatrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { add, assemble, update, setTrackedVisible };
}

export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function buildForest({ add }, collision, encounters, seed) {
  const random = makeRandom(seed);
  const bark = [0x312a29, 0x3d312a, 0x474038];
  const leaves = [0x15392f, 0x204435, 0x294736, 0x253e3c, 0x1a3032];
  const rocks = [0x3b4440, 0x53564f, 0x384847];
  function openArea(x, z) {
    return Math.abs(x - pathCenter(Math.min(z, 54))) > 7 && (z > -141 || Math.abs(x) > 38)
      && !encounters.some((foe) => Math.hypot(x - foe.x, z - foe.z) < 3.3);
  }

  function tree(x, z, hero = false) {
    const y = heightAt(x, z);
    const height = hero ? 34 + random() * 9 : 7 + random() * 18;
    const width = hero ? 2.5 : 0.47 + height * 0.045;
    const twist = random() * Math.PI;
    const trunkColor = bark[Math.floor(random() * bark.length)];
    const pineColor = Math.floor(random() * leaves.length);
    if (z < -240 || z > 76) return;
    add(COLUMN, trunkColor, x, y + height * 0.46, z, width, height, width, twist);
    const branches = hero ? 4 : 2;
    for (let branch = 0; branch < branches; branch++) {
      const angle = twist + branch * 2.4;
      const length = width * (hero ? 2.2 : 1.45);
      add(COLUMN, trunkColor, x + Math.sin(angle) * width * 0.55, y + 0.45,
        z + Math.cos(angle) * width * 0.55, width * 0.5, length, width * 0.5, angle, 1.14);
    }
    for (let layer = 0; layer < 3; layer++) {
      const crown = width * (3.45 - layer * 0.53);
      add(CONE, leaves[(pineColor + layer) % leaves.length], x, y + height * (0.66 + layer * 0.15),
        z, crown, height * 0.46, crown * 0.92, twist + layer * 0.45);
    }
    if (z > -239 && z < 75) collision.addCircle(x, z, width * 0.83);
  }

  for (let row = -280; row < 97; row += 8) {
    for (let column = -173; column < 174; column += 9) {
      const x = column + random() * 8;
      const z = row + random() * 7;
      const thicket = 0.48 + Math.sin(z * 0.031 + x * 0.014) * 0.19;
      if (openArea(x, z) && random() < thicket) tree(x, z);
    }
  }

  for (const [z, side] of [[23, -1], [-18, 1], [-54, -1], [-91, 1], [-126, -1]]) {
    tree(pathCenter(z) + side * 10.5, z, true);
  }

  for (let i = 0; i < 220; i++) {
    const x = (random() - 0.5) * 205;
    const z = 68 - random() * 291;
    if (!openArea(x, z)) continue;
    const size = 0.4 + random() * 2.15;
    const rockHeight = size * (0.42 + random() * 0.24);
    add(STONE, rocks[i % rocks.length], x, heightAt(x, z) + rockHeight * 0.45, z,
      size, rockHeight, size * 0.82, random() * 6, 0.18);
    if (size > 1.25) collision.addCircle(x, z, size * 0.73);
  }

  for (let i = 0; i < 220; i++) {
    const z = 47 - random() * 191;
    const side = i % 2 ? 1 : -1;
    const x = pathCenter(z) + side * (3.7 + random() * 5.9);
    const height = 0.18 + random() * 0.46;
    add(CONE, leaves[i % leaves.length], x, heightAt(x, z) + height * 0.32, z,
      0.13, height, 0.16, i * 0.75, side * 0.28);
  }

  for (let i = 0; i < 95; i++) {
    const z = 54 - random() * 261;
    const x = pathCenter(z) + (random() - 0.5) * 5.8;
    const width = 0.15 + random() * 0.38;
    add(BOX, rocks[i % rocks.length], x, heightAt(x, z) + 0.105, z,
      width, 0.068, width * 0.7, random() * 6);
  }
}

function addMasonry(add, x, z, width, depth, height, color) {
  const y = heightAt(x, z);
  add(BOX, color, x, y + height * 0.49, z, width, height * 1.04, depth);
  add(BOX, 0x61605a, x, y + height, z, width + 0.24, 0.3, depth + 0.24);
}

function buildRuins(add, collision) {
  for (const [z, side] of [[-78, -1], [-96, 1], [-114, -1]]) {
    const x = pathCenter(z) + side * 9.8;
    addMasonry(add, x, z, 1.7, 1.7, 5.4, 0x4b5351);
    addMasonry(add, x + side * 3.6, z - 0.5, 1.8, 1.7, 3.4, 0x414b49);
    addMasonry(add, x + side * 5.3, z - 0.4, 3.5, 1.6, 1.8, 0x51574e);
    collision.addBox(x, z, 1.7, 1.7);
    collision.addBox(x + side * 3.6, z - 0.5, 1.8, 1.7);
    collision.addBox(x + side * 5.3, z - 0.4, 3.5, 1.6);
    for (const scale of [0.6, 0.88, 1.12]) {
      const debrisX = x - side * (1.3 + scale);
      const debrisZ = z + scale * 1.95;
      add(STONE, 0x51534a, debrisX, heightAt(debrisX, debrisZ) + 0.3, debrisZ,
        scale, 0.47, scale * 0.5, scale * 5);
    }
  }
}

export function buildSettlement({ add }, collision, gate, guide) {
  const wall = 0x4c5150;
  const footing = 0x3a4446;
  const roof = 0x292f3c;
  const cloth = 0x7d4230;
  const brass = 0xb08743;
  const wallTop = 7.1;
  const backZ = -215;
  const wallX = 30;

  buildRuins(add, collision);
  for (const side of [-1, 1]) {
    const towerX = side * 8.7;
    addMasonry(add, towerX, gate.z, 6.2, 7.1, 11.4, footing);
    const towerY = heightAt(towerX, gate.z);
    add(CONE, roof, towerX, towerY + 14.6, gate.z, 4.95, 7, 4.95, Math.PI / 6);
    add(BOX, cloth, towerX, towerY + 7.7, gate.z + 3.65, 1.5, 3.8, 0.15);
    add(BOX, brass, towerX, towerY + 8.05, gate.z + 3.75, 0.15, 2.1, 0.12);
    add(BOX, brass, towerX, towerY + 8.45, gate.z + 3.75, 1.0, 0.15, 0.12);
    collision.addBox(towerX, gate.z, 6.2, 7.1);

    const wingX = side * 19.5;
    addMasonry(add, wingX, gate.z, 21, 2.2, wallTop, wall);
    collision.addBox(wingX, gate.z, 21, 2.2);
    for (let step = 12; step < 30; step += 2.5) {
      const x = side * step;
      add(BOX, wall, x, heightAt(wingX, gate.z) + wallTop + 0.65,
        gate.z, 1.2, 1.3, 2.1);
    }

    addMasonry(add, side * wallX, -181, 2.1, 68, wallTop, footing);
    collision.addBox(side * wallX, -181, 2.1, 68);
    for (const z of [-153, -181, -210]) {
      const x = side * wallX;
      addMasonry(add, x, z, 4.6, 4.6, 9.1, wall);
      add(CONE, roof, x, heightAt(x, z) + 10.95, z, 3.55, 4.2, 3.55);
      collision.addBox(x, z, 4.6, 4.6);
    }
  }

  for (const side of [-1, 1]) {
    addMasonry(add, side * 18, backZ, 25, 2.4, wallTop, footing);
    collision.addBox(side * 18, backZ, 25, 2.4);
    addMasonry(add, side * 5.8, backZ, 2, 3.2, 8.2, wall);
    collision.addBox(side * 5.8, backZ, 2, 3.2);
    add(FLAME, 0xffa96a, side * 5.8, heightAt(side * 5.8, backZ) + 5.2, backZ - 1.7,
      0.2, 0.38, 0.19);
  }
  add(BOX, wall, 0, heightAt(0, backZ) + 7.85, backZ, 12.6, 2.4, 2.8);

  const gateY = heightAt(0, gate.z);
  add(BOX, footing, 0, gateY + 7.9, gate.z, 13, 3, 3);
  add(BOX, 0x626460, 0, gateY + 9.6, gate.z, 13.2, 0.45, 3.1);
  for (const side of [-1, 1]) {
    addMasonry(add, side * 4.9, gate.z, 1.65, 2.25, 6.8, wall);
    collision.addBox(side * 4.9, gate.z, 1.65, 2.25);
  }

  for (const [x, z, width, depth] of [[-16, -163, 10, 7], [17, -163, 11, 8],
    [-16, -185, 13, 7], [16, -191, 10, 9], [-13, -203, 8, 9], [13, -205, 9, 8]]) {
    const y = heightAt(x, z);
    add(BOX, 0x59514a, x, y + 2.4, z, width, 5, depth);
    add(BOX, 0x625c53, x, y + 0.32, z, width + 0.5, 0.75, depth + 0.5);
    const rise = 2.15;
    const roofSlope = Math.atan2(rise, depth / 2);
    const pitchLength = Math.hypot(rise, depth / 2) + 0.5;
    for (const side of [-1, 1]) {
      add(BOX, roof, x, y + 5 + rise / 2, z + side * depth / 4,
        width + 0.9, 0.25, pitchLength, 0, side * roofSlope);
      add(BOX, cloth, x, y + 1.38, z + side * (depth / 2 + 0.03), 1.5, 2.75, 0.13);
      for (const windowX of [x - width * 0.29, x + width * 0.29]) {
        add(BOX, footing, windowX, y + 2.95, z + side * (depth / 2 + 0.05), 1.45, 1.6, 0.18);
        add(FLAME, 0xe59f55, windowX, y + 3, z + side * (depth / 2 + 0.15), 0.52, 0.65, 0.08);
      }
    }
    add(BOX, roof, x, y + 5 + rise, z, width + 1, 0.25, 0.35);
    add(BOX, footing, x + width * 0.29, y + 6.8, z + depth * 0.22, 0.75, 3.2, 0.9);
    collision.addBox(x, z, width, depth);
  }

  const y = heightAt(guide.x, guide.z);
  const x = guide.x;
  const z = guide.z;
  add(COLUMN, 0x56694e, x, y + 0.75, z, 0.48, 1.36, 0.39, 0.15);
  add(COLUMN, 0x7d8b68, x, y + 1.35, z, 0.33, 0.55, 0.35, 0.15);
  add(STONE, 0xaaa186, x, y + 1.65, z + 0.07, 0.19, 0.25, 0.21, 0.15);
  add(CONE, 0x536149, x, y + 1.89, z, 0.24, 0.29, 0.24);
  add(COLUMN, 0x584138, x + 0.51, y + 0.93, z + 0.04, 0.05, 1.9, 0.05);
  add(FLAME, 0xf6ba62, x + 0.51, y + 1.96, z + 0.04, 0.15, 0.22, 0.15);
  add(MARK, 0x99743e, x, y + 0.09, z, 0.7, 0.7, 0.7, 0, -Math.PI / 2);
  collision.addCircle(x, z, 0.34);

  const keepX = -23;
  const keepZ = -198;
  const keepY = heightAt(keepX, keepZ);
  addMasonry(add, keepX, keepZ, 7.2, 7.6, 16.8, footing);
  add(BOX, wall, keepX, keepY + 17.1, keepZ, 8.2, 1.3, 8.6);
  add(CONE, roof, keepX, keepY + 21.05, keepZ, 5.65, 7.2, 5.65, Math.PI / 6);
  for (const face of [-1, 1]) {
    const slit = keepZ + face * 3.83;
    add(FLAME, 0xc78343, keepX + 1.45, keepY + 14, slit, 0.33, 0.92, 0.06);
    add(FLAME, 0xc78343, keepX - 1.45, keepY + 14, slit, 0.33, 0.92, 0.06);
  }
  collision.addBox(keepX, keepZ, 7.2, 7.6);

  const beaconX = -5.4;
  const beaconZ = -196;
  const beaconY = heightAt(beaconX, beaconZ);
  add(COLUMN, footing, beaconX, beaconY + 0.24, beaconZ, 2.45, 0.55, 2.45);
  add(COLUMN, wall, beaconX, beaconY + 1.35, beaconZ, 0.68, 2.2, 0.68);
  add(STONE, roof, beaconX, beaconY + 2.26, beaconZ, 1.06, 0.45, 1.06);
  add(FLAME, 0xffa44d, beaconX, beaconY + 2.82, beaconZ, 0.38, 0.63, 0.38);
  add(FLAME, 0xffd976, beaconX + 0.18, beaconY + 2.72, beaconZ + 0.15, 0.25, 0.43, 0.26);
  collision.addCircle(beaconX, beaconZ, 2.2);
}
