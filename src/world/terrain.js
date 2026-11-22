import * as THREE from 'three';

const TILE_SIZE = 48;
const GRID = 16;
const STEP = TILE_SIZE / GRID;

export const WORLD_BOUNDS = { minX: -192, maxX: 192, minZ: -474, maxZ: 74 };

const MAIN_ROUTE = { start: -455, end: 55, center: pathCenter, width: 3.65 };
export const TRAIL_BRANCHES = [
  { start: -327, end: -254, center: moorPath, width: 2.2 },
  { start: -347, end: -274, center: quarryPath, width: 2.3 },
];

export const MOOR_POOLS = [
  { x: -103, z: -304, width: 20, depth: 14 },
  { x: -114, z: -348, width: 26, depth: 15 },
  { x: -48, z: -341, width: 19, depth: 13 },
];

function unit(value) {
  return Math.max(0, Math.min(1, value));
}

function soft(value) {
  const t = unit(value);
  return t * t * (3 - 2 * t);
}

export function pathCenter(z) {
  if (z < -215) {
    const distance = (-215 - z) / 227;
    return 13 * Math.sin(distance * Math.PI * 2.6) * Math.sin(distance * Math.PI);
  }
  if (z <= -137 || z >= 40) return 0;
  const distance = (40 - z) / 177;
  return 7 * Math.sin(distance * Math.PI * 3) * Math.sin(distance * Math.PI);
}

function moorPath(z) {
  const distance = unit((-254 - z) / 73);
  return pathCenter(z) * (1 - distance) - 94 * distance;
}

function quarryPath(z) {
  const distance = unit((-274 - z) / 73);
  return pathCenter(z) * (1 - distance) + 108 * distance;
}

export function trailDistance(x, z) {
  let distance = Math.abs(x - pathCenter(z));
  for (const route of TRAIL_BRANCHES) {
    if (z <= route.end && z > route.start - 16) {
      const branchDistance = Math.abs(x - route.center(z)) * 0.66;
      distance += (Math.min(distance, branchDistance) - distance) * soft((z - route.start + 16) / 16);
    }
  }
  return distance;
}

export function expeditionBiome(x, z) {
  if (z <= -391) return 'spire';
  if (x < -23 && z <= -257) return 'moor';
  if (x > 24 && z <= -267) return 'quarry';
  return 'march';
}

export function poolRadius(pool, x, z) {
  return Math.hypot((x - pool.x) / pool.width, (z - pool.z) / pool.depth);
}

function sampleHeight(x, z) {
  const roadDistance = Math.abs(x - pathCenter(z));
  const hills = Math.min(1, roadDistance / 37);
  const courtyard = z < -145 && z > -218 && Math.abs(x) < 32
    ? Math.min(Math.abs(x) / 32, 1) * 0.12
    : 1;
  const ridge = Math.max(0, (Math.abs(x) - 82) / 45);
  const original = (
    Math.sin(z * 0.046) * 0.65
    + hills * courtyard * (Math.sin(x * 0.066 - z * 0.031) * 2.7
      + Math.cos(x * 0.145 + z * 0.074) * 0.9)
    + ridge * ridge * (3.1 + Math.sin(z * 0.063) * 2.4)
  );
  if (z >= -226) return original;

  const blend = soft((-226 - z) / 26);
  const trail = soft(trailDistance(x, z) / 36);
  const east = soft((x - 17) / 68);
  const west = soft((-x - 23) / 60);
  const north = soft((-z - 395) / 69);
  const mountains = Math.max(0, (Math.abs(x) - 122) / 58);
  let next = 1.4 + Math.sin(z * 0.036) * 1.2
    + trail * ((1 - west * 0.9) * (Math.sin(x * 0.064 - z * 0.055) * 2.75
      + Math.cos(x * 0.15 + z * 0.102) * 1.45) + east * 4.1 - west * 2)
    + mountains * mountains * (13 + Math.sin(z * 0.078) * 6)
    + north * (9 + trail * (3 + Math.sin(x * 0.09) * 4));
  if (x < -24 && z < -275 && z > -375) {
    for (const pool of MOOR_POOLS) {
      const rim = poolRadius(pool, x, z);
      if (rim < 1.22) next += (-1.43 + 0.6 * rim - next) * soft((1.22 - rim) / 0.3);
    }
  }
  return original + (next - original) * blend;
}

// Match the two triangles in each rendered terrain cell.
export function heightAt(x, z) {
  const left = Math.floor(x / STEP) * STEP;
  const top = Math.floor(z / STEP) * STEP;
  const u = (x - left) / STEP;
  const v = (z - top) / STEP;
  const topRight = sampleHeight(left + STEP, top);
  const bottomLeft = sampleHeight(left, top + STEP);
  if (u + v <= 1) {
    return (1 - u - v) * sampleHeight(left, top) + u * topRight + v * bottomLeft;
  }
  return (u + v - 1) * sampleHeight(left + STEP, top + STEP)
    + (1 - v) * topRight + (1 - u) * bottomLeft;
}

function terrainColor(out, x, z) {
  const noise = Math.sin(x * 0.78 + z * 0.53) * Math.cos(z * 0.99 - x * 0.28);
  const moss = Math.sin(x * 0.095 + z * 0.059) * Math.cos(z * 0.133);
  const offRoad = trailDistance(x, z);
  const clearing = z < -149 && z > -213 && Math.abs(x) < 25;
  const groundTone = 0.045 + noise * 0.013 + moss * 0.012;
  const roadTone = Math.max(0, 1 - offRoad / 9) * 0.036;
  const courtyardTone = clearing ? 0.027 : 0;
  const moor = soft((-x - 23) / 65) * soft((-z - 251) / 26);
  const quarry = soft((x - 25) / 55) * soft((-z - 263) / 24);
  const frost = soft((-z - 373) / 78);
  out.setRGB(groundTone * (0.69 + quarry * 1.05 + frost * 0.5) + roadTone + courtyardTone,
    groundTone * (1.27 - quarry * 0.22 + frost * 0.25) + roadTone * 0.7 + courtyardTone * 0.85,
    groundTone * (0.98 + moor * 0.74 + frost * 0.72) + roadTone * 0.41 + courtyardTone * 0.65);
}

function createTile(originX, originZ, material) {
  const positions = [];
  const colors = [];
  const normals = [];
  const indices = [];
  const color = new THREE.Color();
  const normal = new THREE.Vector3();

  for (let row = 0; row <= GRID; row++) {
    for (let column = 0; column <= GRID; column++) {
      const x = originX + column * STEP;
      const z = originZ + row * STEP;
      positions.push(x, sampleHeight(x, z), z);
      terrainColor(color, x, z);
      colors.push(color.r, color.g, color.b);
      normal.set(sampleHeight(x - 1, z) - sampleHeight(x + 1, z),
        2, sampleHeight(x, z - 1) - sampleHeight(x, z + 1)).normalize();
      normals.push(normal.x, normal.y, normal.z);

      if (row < GRID && column < GRID) {
        const a = row * (GRID + 1) + column;
        const b = a + 1;
        const c = a + GRID + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, material);
}

export function addTerrain(scene) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const loaded = new Map();
  const pending = [];
  const radius = 4;
  const minColumn = Math.floor(WORLD_BOUNDS.minX / TILE_SIZE) - 2;
  const maxColumn = Math.floor(WORLD_BOUNDS.maxX / TILE_SIZE) + 2;
  const minRow = Math.floor(WORLD_BOUNDS.minZ / TILE_SIZE) - 2;
  const maxRow = Math.floor(WORLD_BOUNDS.maxZ / TILE_SIZE) + 2;
  let centerColumn;
  let centerRow;

  function update(position, initial = false) {
    const column = Math.floor(position.x / TILE_SIZE);
    const row = Math.floor(position.z / TILE_SIZE);
    if (column !== centerColumn || row !== centerRow) {
      centerColumn = column;
      centerRow = row;
      pending.length = 0;
      for (const [key, tile] of loaded) {
        if (Math.abs(column - tile.column) <= radius && Math.abs(row - tile.row) <= radius) continue;
        scene.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        loaded.delete(key);
      }
      for (let ring = 0; ring <= radius; ring++) {
        for (let z = Math.max(minRow, row - ring); z <= Math.min(maxRow, row + ring); z++) {
          for (let x = Math.max(minColumn, column - ring); x <= Math.min(maxColumn, column + ring); x++) {
            if (Math.max(Math.abs(column - x), Math.abs(row - z)) !== ring) continue;
            const key = `${x}:${z}`;
            if (!loaded.has(key)) pending.push({ key, column: x, row: z });
          }
        }
      }
    }
    const budget = initial ? pending.length : 2;
    for (let i = 0; i < budget && pending.length; i++) {
      const tile = pending.shift();
      tile.mesh = createTile(tile.column * TILE_SIZE, tile.row * TILE_SIZE, material);
      loaded.set(tile.key, tile);
      scene.add(tile.mesh);
    }
  }

  return update;
}

export function addPath(scene) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  for (const route of [MAIN_ROUTE, ...TRAIL_BRANCHES]) addRoute(scene, material, route);
}

function addRoute(scene, material, route) {
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  const strips = [-1, -0.81, -0.46, 0, 0.46, 0.81, 1];
  const stripColors = [0x364034, 0x565047, 0x74644e, 0x665943, 0x74644e, 0x565047, 0x364034];
  for (let z = route.start; z <= route.end; z++) {
    const center = route.center(z);
    const width = route.width * (1 + Math.sin(z * 0.11) * 0.082);
    for (let i = 0; i < strips.length; i++) {
      const x = center + strips[i] * width;
      positions.push(x, heightAt(x, z) + 0.1, z);
      const grit = 1 + Math.sin((x + z) * 17.32) * 0.095;
      color.setHex(stripColors[i]).multiplyScalar(grit);
      colors.push(color.r, color.g, color.b);
      if (i < strips.length - 1 && z < route.end) {
        const a = (z - route.start) * strips.length + i;
        const b = a + 1;
        const c = a + strips.length;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  scene.add(new THREE.Mesh(geometry, material));
}
