import * as THREE from 'three';
import { ASSET_VARIANTS } from './assets.js';
import { CHUNK_SIZE, WORLD_SIZE } from './generation.js';

export const QUALITY = Object.freeze({
  low: Object.freeze({ label: 'Mobil', radius: 5, detail: 1, vegetation: 2, groundCover: 0.32, budget: 3, chunksPerFrame: 1 }),
  medium: Object.freeze({ label: 'Ausgewogen', radius: 7, detail: 2, vegetation: 3, groundCover: 0.56, budget: 4, chunksPerFrame: 2 }),
  high: Object.freeze({ label: 'Weitsicht', radius: 9, detail: 2, vegetation: 4, groundCover: 0.85, budget: 5, chunksPerFrame: 2 }),
});

const RESOLUTIONS = [32, 16, 8];
const EDGE_RESOLUTION = RESOLUTIONS[0];
const WORLD_MIN = -WORLD_SIZE / 2;
const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;
const PRIMARY_GRID = 10;
const DETAIL_GRID = 16;
const SOLIDS = {
  pine: 0.62, oak: 0.83, birch: 0.32, giant: 1.6, snag: 0.52, stump: 0.55,
  rock: 0.52, boulder: 1.58, crystal: 0.78, standingStone: 0.82,
};
const RESOURCES = new Set(['flower', 'mushroom', 'rock', 'crystal', 'log']);
const DISTANT_KINDS = new Set(['pine', 'oak', 'birch', 'giant', 'snag', 'boulder', 'crystal', 'standingStone']);

const VEGETATION = {
  meadow: {
    primary: ['oak', 'birch', 'birch', 'shrub', 'shrub', 'rock', 'boulder', 'log'],
    detail: ['grass', 'grass', 'grass', 'grass', 'flower', 'flower', 'fern', 'shrub'],
    density: 0.44,
  },
  forest: {
    primary: ['pine', 'pine', 'pine', 'pine', 'oak', 'birch', 'giant', 'snag', 'boulder', 'stump', 'log'],
    detail: ['fern', 'fern', 'fern', 'grass', 'shrub', 'mushroom', 'mushroom', 'flower'],
    density: 0.84,
  },
  marsh: {
    primary: ['snag', 'snag', 'birch', 'boulder', 'rock', 'stump', 'log', 'shrub', 'reed', 'reed'],
    detail: ['reed', 'reed', 'reed', 'grass', 'fern', 'fern', 'mushroom', 'shrub'],
    density: 0.62,
  },
  ridge: {
    primary: ['pine', 'pine', 'snag', 'boulder', 'boulder', 'rock', 'rock', 'standingStone'],
    detail: ['grass', 'grass', 'flower', 'rock', 'shrub'],
    density: 0.53,
  },
  crystal: {
    primary: ['crystal', 'crystal', 'crystal', 'boulder', 'boulder', 'rock', 'pine', 'snag'],
    detail: ['rock', 'crystal', 'grass', 'flower', 'mushroom'],
    density: 0.67,
  },
  coast: {
    primary: ['pine', 'birch', 'rock', 'rock', 'boulder', 'boulder', 'reed', 'log'],
    detail: ['reed', 'reed', 'grass', 'grass', 'flower', 'rock'],
    density: 0.44,
  },
};

function hash(seed, x, z, index) {
  let value = seed ^ Math.imul(x, 0x632be5ab) ^ Math.imul(z, 0x85157af5) ^ Math.imul(index, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function randomPart(seed, x, z, index) {
  return hash(seed, x, z, index) / 0x100000000;
}

function chunkCoordinate(position) {
  return Math.max(0, Math.min(CHUNKS_PER_SIDE - 1, Math.floor((position - WORLD_MIN) / CHUNK_SIZE)));
}

function buildTerrain(model, originX, originZ, lod) {
  const positions = [];
  const colors = [];
  const indices = [];
  const edgeVertices = [];
  const coordinateStride = 2 * EDGE_RESOLUTION + 1;
  const vertexByCoordinate = new Int16Array(coordinateStride ** 2).fill(-1);
  const resolution = RESOLUTIONS[lod];
  const step = EDGE_RESOLUTION / resolution;
  const unit = CHUNK_SIZE / EDGE_RESOLUTION;
  let minHeight = Infinity;

  function getVertex(u, v) {
    // Coordinates use the finest grid. A cell center can lie on a half-grid line.
    const key = 2 * u + coordinateStride * (2 * v);
    const existing = vertexByCoordinate[key];
    if (existing >= 0) return existing;

    const x = u * unit;
    const z = v * unit;
    const { height, surface } = model.sampleAt(originX + x, originZ + z);
    const vertex = positions.length / 3;
    positions.push(x, height, z);
    colors.push(surface.r, surface.g, surface.b);
    minHeight = Math.min(minHeight, height);
    vertexByCoordinate[key] = vertex;
    if (u === 0 || v === 0 || u === EDGE_RESOLUTION || v === EDGE_RESOLUTION) {
      edgeVertices.push(vertex);
    }
    return vertex;
  }

  for (let v = 0; v < EDGE_RESOLUTION; v += step) {
    for (let u = 0; u < EDGE_RESOLUTION; u += step) {
      const right = u + step;
      const bottom = v + step;
      const topLeft = getVertex(u, v);
      const bottomLeft = getVertex(u, bottom);
      const bottomRight = getVertex(right, bottom);
      const topRight = getVertex(right, v);
      const edge = u === 0 || v === 0 || right === EDGE_RESOLUTION || bottom === EDGE_RESOLUTION;

      if (!edge || step === 1) {
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
        continue;
      }

      // All chunk borders share the same vertex positions, colors and normals.
      // Fan out the coarse border cells to meet the finer border tessellation.
      const center = getVertex((u + right) / 2, (v + bottom) / 2);
      const ring = [topLeft];
      if (u === 0) for (let j = v + 1; j < bottom; j++) ring.push(getVertex(u, j));
      ring.push(bottomLeft);
      if (bottom === EDGE_RESOLUTION) for (let i = u + 1; i < right; i++) ring.push(getVertex(i, bottom));
      ring.push(bottomRight);
      if (right === EDGE_RESOLUTION) for (let j = bottom - 1; j > v; j--) ring.push(getVertex(right, j));
      ring.push(topRight);
      if (v === 0) for (let i = right - 1; i > u; i--) ring.push(getVertex(i, v));
      for (let i = 0; i < ring.length; i++) {
        indices.push(center, ring[i], ring[(i + 1) % ring.length]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (const index of edgeVertices) {
    const x = originX + positions[index * 3];
    const z = originZ + positions[index * 3 + 2];
    const nx = model.heightAt(x - unit, z) - model.heightAt(x + unit, z);
    const nz = model.heightAt(x, z - unit) - model.heightAt(x, z + unit);
    const length = Math.hypot(nx, 2 * unit, nz);
    normals.setXYZ(index, nx / length, 2 * unit / length, nz / length);
  }
  geometry.computeBoundingSphere();
  return { geometry, minHeight, triangles: indices.length / 3 };
}

function scatter(model, chunk, removedResources) {
  const { ix, iz, key, originX, originZ, vegetationLod, groundCover } = chunk;
  const seed = model.seed;
  const variantOffset = hash(seed, ix, iz, 3953) % ASSET_VARIANTS;
  const props = [];

  function fill(grid, detail) {
    for (let cell = 0; cell < grid * grid; cell++) {
      const sequence = (detail ? 2048 : 0) + cell * 7;
      const sample = (channel) => randomPart(seed, ix, iz, sequence + channel);
      const selector = sample(2);
      if (vegetationLod === 2 && selector > 0.23) continue;
      if (detail && selector > Math.max(groundCover, 0.52)) continue;
      const x = originX + (cell % grid + 0.12 + sample(0) * 0.76) * CHUNK_SIZE / grid;
      const z = originZ + (Math.floor(cell / grid) + 0.12 + sample(1) * 0.76) * CHUNK_SIZE / grid;
      const { biome: biomeKey, height: y, trail } = model.sampleAt(x, z);
      const biome = VEGETATION[biomeKey] ?? VEGETATION.meadow;
      if (!detail && selector > biome.density) continue;
      const kinds = detail ? biome.detail : biome.primary;
      const kind = kinds[Math.floor(sample(3) * kinds.length)];
      const resource = RESOURCES.has(kind);
      if (detail && selector > (resource ? 0.52 : groundCover)) continue;
      if (vegetationLod === 2 && !DISTANT_KINDS.has(kind)) continue;

      const id = key + '/' + (detail ? 'detail' : 'primary') + cell;
      if (resource && removedResources.has(id)) continue;
      if (y < model.waterLevel + (kind === 'reed' ? -0.38 : 0.10) || trail > 0.18) continue;
      if ((x - model.spawn.x) ** 2 + (z - model.spawn.z) ** 2 < 45) continue;
      if (model.landmarks.some((mark) => {
        const clearance = (mark.radius ?? 10) * (mark.kind === 'enclave' ? 1 : 0.76);
        return (x - mark.x) ** 2 + (z - mark.z) ** 2 < clearance ** 2;
      })) continue;
      const scale = (detail ? 0.62 : 0.78) + sample(4) * (detail ? 0.65 : 0.62);
      const radius = (SOLIDS[kind] ?? 0) * scale;
      if (radius > 0 && (
        Math.abs(y - model.heightAt(x + 2, z)) > 1.8
        || Math.abs(y - model.heightAt(x, z + 2)) > 1.8
      )) continue;
      props.push({
        id, kind, x, y, z, scale, radius, resource,
        yaw: sample(5) * Math.PI * 2,
        variant: (variantOffset + (vegetationLod === 0 ? Math.floor(sample(6) * 2) : 0)) % ASSET_VARIANTS,
      });
    }
  }

  fill(PRIMARY_GRID, false);
  if (vegetationLod === 0) fill(DETAIL_GRID, true);
  return props;
}

function buildInstances(group, chunk, props, assets) {
  const groups = new Map();
  const transform = new THREE.Object3D();
  const visuals = new Map();
  let triangles = 0;

  for (const prop of props) {
    const key = prop.kind + '/' + prop.variant;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(prop);
  }
  for (const batch of groups.values()) {
    const { kind, variant } = batch[0];
    const { geometry, material } = assets.get(kind, chunk.vegetationLod, variant);
    const mesh = new THREE.InstancedMesh(geometry, material, batch.length);
    for (let i = 0; i < batch.length; i++) {
      const prop = batch[i];
      transform.position.set(prop.x - chunk.originX, prop.y, prop.z - chunk.originZ);
      transform.rotation.y = prop.yaw;
      transform.scale.setScalar(prop.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      if (prop.resource) visuals.set(prop.id, { mesh, index: i });
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    triangles += batch.length * (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  }

  return { visuals, triangles };
}

export function createWorldStream(scene, model, assets, initialQuality = 'medium') {
  const root = new THREE.Group();
  root.name = 'World Lab chunks';
  scene.add(root);
  const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const waterGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.translate(CHUNK_SIZE / 2, 0, CHUNK_SIZE / 2);
  const waterTime = { value: 0 };
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x315e63, specular: 0x6a999c, shininess: 34, transparent: true, opacity: 0.82, depthWrite: false,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.worldWaterTime = waterTime;
    shader.vertexShader = 'varying vec2 worldWaterPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      worldWaterPosition = (modelMatrix * vec4(position, 1.0)).xz;
    `);
    shader.fragmentShader = 'varying vec2 worldWaterPosition;\nuniform float worldWaterTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float swell = sin(dot(worldWaterPosition, vec2(.08, .17)) - worldWaterTime)
        * sin(dot(worldWaterPosition, vec2(.31, -.29)) + .6 * worldWaterTime);
      diffuseColor.rgb *= 1.0 + .12 * swell;
    `);
  };

  const active = new Map();
  const removedResources = new Set();
  const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -100000, 0);
  let queue = [];
  let queueIndex = 0;
  let currentKey = '';
  let quality = Object.hasOwn(QUALITY, initialQuality) ? initialQuality : 'medium';
  let disposed = false;

  function drop(key) {
    const chunk = active.get(key);
    if (!chunk) return;
    root.remove(chunk.group);
    chunk.group.traverse((child) => {
      if (child.isInstancedMesh) child.dispose();
    });
    chunk.terrain.dispose();
    active.delete(key);
  }

  function load(chunk) {
    const group = new THREE.Group();
    group.position.set(chunk.originX, 0, chunk.originZ);
    const terrain = buildTerrain(model, chunk.originX, chunk.originZ, chunk.lod);
    group.add(new THREE.Mesh(terrain.geometry, terrainMaterial));
    if (terrain.minHeight < model.waterLevel) {
      const water = new THREE.Mesh(waterGeometry, waterMaterial);
      water.position.y = model.waterLevel;
      group.add(water);
    }
    const props = chunk.vegetationLod >= 0 ? scatter(model, chunk, removedResources) : [];
    const { visuals, triangles } = buildInstances(group, chunk, props, assets);
    drop(chunk.key);
    root.add(group);
    active.set(chunk.key, {
      ...chunk, group, props, visuals,
      terrain: terrain.geometry,
      terrainTriangles: terrain.triangles,
      assetTriangles: triangles,
      instances: props.length,
    });
  }

  function reconcile(cx, cz) {
    currentKey = cx + ':' + cz;
    const { radius, detail, vegetation } = QUALITY[quality];
    const wanted = new Set();
    queue = [];
    queueIndex = 0;
    for (let iz = Math.max(0, cz - radius); iz <= Math.min(CHUNKS_PER_SIDE - 1, cz + radius); iz++) {
      for (let ix = Math.max(0, cx - radius); ix <= Math.min(CHUNKS_PER_SIDE - 1, cx + radius); ix++) {
        const dx = ix - cx;
        const dz = iz - cz;
        const distance = dx * dx + dz * dz;
        if (distance > radius * radius) continue;
        const near = distance <= detail * detail + 1;
        const lod = distance <= 2 ? 0 : distance <= vegetation * vegetation + 1 ? 1 : 2;
        const vegetationLod = near ? 0 : distance <= vegetation * vegetation ? 1 : distance <= (vegetation + 1) ** 2 ? 2 : -1;
        const key = ix + ':' + iz;
        const desired = {
          ix, iz, key, distance, lod, vegetationLod,
          groundCover: vegetationLod === 0 ? QUALITY[quality].groundCover : 0,
          originX: WORLD_MIN + ix * CHUNK_SIZE, originZ: WORLD_MIN + iz * CHUNK_SIZE,
        };
        wanted.add(key);
        const chunk = active.get(key);
        if (!chunk || chunk.lod !== lod || chunk.vegetationLod !== vegetationLod || chunk.groundCover !== desired.groundCover) {
          queue.push(desired);
        }
      }
    }
    for (const key of active.keys()) {
      if (!wanted.has(key)) drop(key);
    }
    queue.sort((a, b) => a.distance - b.distance || a.iz - b.iz || a.ix - b.ix);
  }

  function update(x, z) {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const now = performance.now();
    waterTime.value = now * 0.001;
    const cx = chunkCoordinate(x);
    const cz = chunkCoordinate(z);
    if (currentKey !== cx + ':' + cz) reconcile(cx, cz);

    // The current chunk is at the front of the queue. Guarantee progress even
    // on a slow frame, then respect the time and count caps for further work.
    const profile = QUALITY[quality];
    for (let count = 0; queueIndex < queue.length && count < profile.chunksPerFrame; count++) {
      if (count > 0 && performance.now() - now >= profile.budget) break;
      load(queue[queueIndex++]);
    }
  }

  function query(x, z, radius, resources) {
    const matches = [];
    if (disposed || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return matches;
    const search = radius + (resources ? 0 : 2.3);
    for (let iz = chunkCoordinate(z - search); iz <= chunkCoordinate(z + search); iz++) {
      for (let ix = chunkCoordinate(x - search); ix <= chunkCoordinate(x + search); ix++) {
        const chunk = active.get(ix + ':' + iz);
        if (!chunk) continue;
        for (const prop of chunk.props) {
          if ((resources ? !prop.resource : !prop.radius) || removedResources.has(prop.id)) continue;
          const reach = radius + (resources ? 0 : prop.radius);
          if ((x - prop.x) ** 2 + (z - prop.z) ** 2 <= reach ** 2) matches.push(prop);
        }
      }
    }
    if (resources) matches.sort((a, b) => ((x - a.x) ** 2 + (z - a.z) ** 2) - ((x - b.x) ** 2 + (z - b.z) ** 2));
    return matches;
  }

  return {
    update,
    setQuality(key) {
      if (disposed || !Object.hasOwn(QUALITY, key) || key === quality) return;
      quality = key;
      currentKey = '';
    },
    nearbySolids: (x, z, radius = 2) => query(x, z, radius, false),
    nearbyResources: (x, z, radius = 3) => query(x, z, radius, true),
    removeResource(id) {
      if (disposed || typeof id !== 'string' || removedResources.has(id)) return false;
      removedResources.add(id);
      const chunk = active.get(id.split('/', 1)[0]);
      const visual = chunk?.visuals.get(id);
      if (visual) {
        visual.mesh.setMatrixAt(visual.index, hiddenMatrix);
        visual.mesh.instanceMatrix.needsUpdate = true;
        chunk.instances--;
      }
      return true;
    },
    getStats() {
      let terrainTriangles = 0;
      let assetTriangles = 0;
      let instances = 0;
      for (const chunk of active.values()) {
        terrainTriangles += chunk.terrainTriangles;
        assetTriangles += chunk.assetTriangles;
        instances += chunk.instances;
      }
      return { chunks: active.size, pending: queue.length - queueIndex, instances, terrainTriangles, assetTriangles, quality };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const key of active.keys()) drop(key);
      scene.remove(root);
      terrainMaterial.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      queue = [];
      queueIndex = 0;
      removedResources.clear();
      currentKey = '';
    },
  };
}
