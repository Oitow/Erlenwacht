import * as THREE from 'three';

const TILE_SIZE = 48;
const GRID = 16;
const STEP = TILE_SIZE / GRID;

export const WORLD_BOUNDS = { minX: -112, maxX: 112, minZ: -227, maxZ: 74 };

export function pathCenter(z) {
  if (z <= -137 || z >= 40) return 0;
  const distance = (40 - z) / 177;
  return 7 * Math.sin(distance * Math.PI * 3) * Math.sin(distance * Math.PI);
}

function sampleHeight(x, z) {
  const roadDistance = Math.abs(x - pathCenter(z));
  const hills = Math.min(1, roadDistance / 37);
  const courtyard = z < -145 && z > -218 && Math.abs(x) < 32
    ? Math.min(Math.abs(x) / 32, 1) * 0.12
    : 1;
  const ridge = Math.max(0, (Math.abs(x) - 82) / 45);
  return (
    Math.sin(z * 0.046) * 0.65
    + hills * courtyard * (Math.sin(x * 0.066 - z * 0.031) * 2.7
      + Math.cos(x * 0.145 + z * 0.074) * 0.9)
    + ridge * ridge * (3.1 + Math.sin(z * 0.063) * 2.4)
  );
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
  const offRoad = Math.abs(x - pathCenter(z));
  const clearing = z < -149 && z > -213 && Math.abs(x) < 25;
  const groundTone = 0.045 + noise * 0.013 + moss * 0.012;
  const roadTone = Math.max(0, 1 - offRoad / 9) * 0.036;
  const courtyardTone = clearing ? 0.027 : 0;
  out.setRGB(groundTone * 0.69 + roadTone + courtyardTone,
    groundTone * 1.27 + roadTone * 0.7 + courtyardTone * 0.85,
    groundTone * 0.98 + roadTone * 0.41 + courtyardTone * 0.65);
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
  for (let z = -336; z < 144; z += TILE_SIZE) {
    for (let x = -192; x < 192; x += TILE_SIZE) {
      scene.add(createTile(x, z, material));
    }
  }
}

export function addPath(scene) {
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  const strips = [-1, -0.81, -0.46, 0, 0.46, 0.81, 1];
  const stripColors = [0x364034, 0x565047, 0x74644e, 0x665943, 0x74644e, 0x565047, 0x364034];
  for (let z = -215; z <= 55; z++) {
    const center = pathCenter(z);
    const width = z < -151 ? 3.9 : 3.45 + Math.sin(z * 0.11) * 0.34;
    for (let i = 0; i < strips.length; i++) {
      const x = center + strips[i] * width;
      positions.push(x, heightAt(x, z) + 0.075, z);
      const grit = 1 + Math.sin((x + z) * 17.32) * 0.095;
      color.setHex(stripColors[i]).multiplyScalar(grit);
      colors.push(color.r, color.g, color.b);
      if (i < strips.length - 1 && z < 55) {
        const a = (z + 215) * strips.length + i;
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
  scene.add(new THREE.Mesh(geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}
