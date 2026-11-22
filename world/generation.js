export const WORLD_SIZE = 8192;
export const CHUNK_SIZE = 128;

export const BIOMES = Object.freeze({
  meadow: { name: 'Laternenheide', color: '#8a9b54' },
  forest: { name: 'Erlenforst', color: '#50683e' },
  marsh: { name: 'Schwarzmoor', color: '#637552' },
  ridge: { name: 'Krähenkamm', color: '#828984' },
  crystal: { name: 'Mondbruch', color: '#676889' },
  coast: { name: 'Aschenküste', color: '#a18b6b' },
});

const HALF_WORLD = WORLD_SIZE / 2;
const WATER_LEVEL = 0;
const SPAWN = Object.freeze({ x: 0, z: 0 });
const AUTHOR_CELL = 256;

const SITES = [
  ['camp', 'Laternenrast', 'camp', 0, 0, 31, 21, 'Ein Rastplatz am Anfang der alten Handelsstraße.'],
  ['watchstone', 'Wachtstein', 'watch', 0, -100, 38, 16, 'Vom Wachtstein führen zwei Wege in den Erlenforst.'],
  ['enclave', 'Grenzenklave', 'enclave', 185, -250, 61, 33, 'Ein befestigter Umschlagplatz über dem Tal.'],
  ['ruin', 'Tor der Erlen', 'ruin', -245, -320, 63, 24, 'Ein Torbogen aus der Zeit vor der Enklave.'],
  ['moonquarry', 'Mondbruch', 'crystal', 470, -650, 112, 31, 'Blaue Kristalle leuchten in den Rissen des alten Steinbruchs.'],
  ['summit', 'Krähenwarte', 'summit', -810, -1530, 276, 33, 'Ein Aussichtspunkt hoch über dem westlichen Gebirge.'],
  ['fen', 'Schwarzer Steg', 'marsh', -530, 246, 5, 18, 'Ein alter Steg am Rand der überfluteten Heide.'],
  ['dock', 'Spiegelsee', 'dock', 120, -7, 5, 17, 'Ein kleiner Anleger im Windschatten der Heide.'],
  ['coast', 'Fahlfeuer', 'watch', 1890, 2060, 20, 25, 'Hier weisen die letzten Feuer den Weg zur Aschenküste.'],
  ['hollow', 'Versunkener Ring', 'ruin', 1380, -1900, 116, 25, 'Wind und Eis haben einen Ring aus Steinen freigelegt.'],
];

const ROUTES = [
  ['camp', [-10, -38, 33], [2, -68, 35], 'watchstone'],
  ['watchstone', [48, -139, 45], [102, -147, 50], [146, -185, 56], 'enclave'],
  ['watchstone', [-58, -117, 43], [-112, -188, 54], [-170, -241, 65], 'ruin'],
  ['enclave', [222, -333, 69], [328, -379, 82], [340, -492, 102], [432, -559, 111], 'moonquarry'],
  ['ruin', [-457, -497, 91], [-552, -743, 107], [-436, -1020, 147], [-621, -1172, 188], [-701, -1380, 240], 'summit'],
  ['camp', [-29, 56, 30], [-119, 134, 25], [-219, 117, 12], [-368, 177, 9], 'fen'],
  ['camp', [41, 22, 24], [77, -12, 13], 'dock'],
  ['moonquarry', [617, -905, 126], [796, -1138, 185], [978, -1410, 167], [1162, -1599, 147], 'hollow'],
  ['enclave', [335, -173, 67], [522, 76, 74], [647, 494, 65], [890, 753, 62], [1100, 1138, 50], [1570, 1582, 33], 'coast'],
];

// Anisotropic envelopes place ridgelines and basins. Seeded fields shape their sides.
const MASSIFS = [
  [-803, -1465, 525, 935, -0.48, 352],
  [837, -1150, 550, 885, 0.36, 247],
  [-1730, 910, 580, 745, 0.58, 275],
  [1640, 800, 610, 970, -0.56, 192],
  [130, -2380, 770, 618, -0.14, 192],
].map(([x, z, width, depth, angle, height]) => ({
  x, z, width, depth, height, cos: Math.cos(angle), sin: Math.sin(angle),
}));

const WATER_BASINS = [
  [125, 85, 68, 90, -8, 0.23],
  [-569, 350, 212, 135, -13, 0.38],
  [1060, 435, 214, 116, -21, 0.30],
  [-1160, -768, 157, 255, -11, 0.31],
];

const PALETTE = Object.freeze({
  meadow: ['#535e33', '#939950'],
  forest: ['#354529', '#657548'],
  marsh: ['#343e31', '#75774a'],
  ridge: ['#4f5352', '#9f9e92'],
  crystal: ['#454252', '#867f99'],
  coast: ['#675d4c', '#b8a588'],
  trail: ['#6f6049', '#a89370'],
  shore: ['#524f41', '#8e8063'],
  snow: ['#a8b6b7', '#e0e6e5'],
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, weight) => a + (b - a) * weight;

function smooth(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function seedKey(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  if (typeof seed !== 'string' || !seed.trim()) return 813;
  if (/^[+-]?\d+$/.test(seed.trim())) return Number(seed) >>> 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function lattice(x, z, seed) {
  let hash = seed ^ Math.imul(x, 0x92877765) ^ Math.imul(z, 0x9e3779b9);
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  return ((hash ^ (hash >>> 15)) >>> 0) / 2147483648 - 1;
}

function noise(x, z, spacing, salt) {
  const u = x / spacing;
  const v = z / spacing;
  const col = Math.floor(u);
  const row = Math.floor(v);
  const ax = u - col;
  const az = v - row;
  const tx = ax * ax * (3 - 2 * ax);
  const tz = az * az * (3 - 2 * az);
  return mix(
    mix(lattice(col, row, salt), lattice(col + 1, row, salt), tx),
    mix(lattice(col, row + 1, salt), lattice(col + 1, row + 1, salt), tx),
    tz,
  );
}

function toLinear(hex) {
  const color = Number.parseInt(hex.slice(1), 16);
  const component = shift => {
    const srgb = ((color >>> shift) & 255) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return { r: component(16), g: component(8), b: component(0) };
}

const LINEAR_COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([key, pair]) => [key, pair.map(toLinear)]),
);

function blendPalette(color, key, variation, influence) {
  if (influence <= 0) return;
  const [dark, light] = LINEAR_COLORS[key];
  color.r = mix(color.r, mix(dark.r, light.r, variation), influence);
  color.g = mix(color.g, mix(dark.g, light.g, variation), influence);
  color.b = mix(color.b, mix(dark.b, light.b, variation), influence);
}

function cellKey(x, z) {
  return x + z * 1024;
}

function makeAuthoredTerrain() {
  const sites = SITES.map(([id, name, kind, x, z, height, radius, description]) =>
    Object.freeze({ id, name, kind, x, z, height, radius, description }));
  const byId = Object.fromEntries(sites.map(site => [site.id, [site.x, site.z, site.height]]));
  const cells = new Map();

  function register(item, minX, minZ, maxX, maxZ) {
    for (let x = Math.floor(minX / AUTHOR_CELL); x <= Math.floor(maxX / AUTHOR_CELL); x++) {
      for (let z = Math.floor(minZ / AUTHOR_CELL); z <= Math.floor(maxZ / AUTHOR_CELL); z++) {
        const key = cellKey(x, z);
        const entries = cells.get(key) ?? [];
        entries.push(item);
        cells.set(key, entries);
      }
    }
  }

  for (const route of ROUTES) {
    const waypoints = route.map(point => typeof point === 'string' ? byId[point] : point);
    for (let i = 1; i < waypoints.length; i++) {
      const [x, z, height] = waypoints[i - 1];
      const [endX, endZ, endHeight] = waypoints[i];
      const dx = endX - x;
      const dz = endZ - z;
      const length2 = dx * dx + dz * dz;
      const margin = Math.max(height, endHeight) > 120 ? 67 : 34;
      register({ x, z, height, endHeight, dx, dz, length2, margin },
        Math.min(x, endX) - margin, Math.min(z, endZ) - margin,
        Math.max(x, endX) + margin, Math.max(z, endZ) + margin);
    }
  }

  for (const site of sites) {
    const margin = site.radius * 2.3;
    register({ ...site, margin }, site.x - margin, site.z - margin, site.x + margin, site.z + margin);
  }
  return { sites: Object.freeze(sites), cells };
}

const AUTHORED = makeAuthoredTerrain();
const EMPTY_CELL = Object.freeze([]);

function authorAt(x, z, naturalHeight) {
  const entries = AUTHORED.cells.get(cellKey(Math.floor(x / AUTHOR_CELL), Math.floor(z / AUTHOR_CELL))) ?? EMPTY_CELL;
  let trail = 0;
  let nearestTrail = Infinity;
  let trailInfluence = 0;
  let trailHeightSum = 0;
  let trailWeightSum = 0;
  let siteHeight = naturalHeight;
  let siteInfluence = 0;
  for (const entry of entries) {
    const dx = x - entry.x;
    const dz = z - entry.z;
    if (entry.radius) {
      const distance = Math.hypot(dx, dz);
      if (distance < entry.margin) {
        const influence = 1 - smooth(entry.radius * 0.72, entry.margin, distance);
        if (influence > siteInfluence) {
          siteInfluence = influence;
          siteHeight = entry.height;
        }
      }
      continue;
    }
    const along = clamp((dx * entry.dx + dz * entry.dz) / entry.length2);
    const distance = Math.hypot(dx - along * entry.dx, dz - along * entry.dz);
    if (distance < entry.margin) {
      const influence = 1 - smooth(5, entry.margin, distance);
      const weight = influence / (1 + distance * distance * 0.04);
      trailHeightSum += mix(entry.height, entry.endHeight, along) * weight;
      trailWeightSum += weight;
      trailInfluence = Math.max(trailInfluence, influence);
      nearestTrail = Math.min(nearestTrail, distance);
    }
  }
  let height = naturalHeight;
  if (trailWeightSum > 0) {
    trail = 1 - smooth(3.1, 8.3, nearestTrail);
    height = mix(height, trailHeightSum / trailWeightSum, trailInfluence);
  }
  return { height: mix(height, siteHeight, siteInfluence), trail };
}

export function createWorldModel(seed = 813) {
  const key = seedKey(seed);
  const macroSeed = key ^ 0x1ae23d70;
  const hillSeed = key ^ 0xc2b2ae35;
  const detailSeed = key ^ 0x84cf78dd;
  const moistureSeed = key ^ 0x32d062b7;

  function landAt(x, z) {
    const broad = noise(x, z, 620, macroSeed);
    const hills = noise(x, z, 176, hillSeed);
    const detail = noise(x, z, 51, detailSeed);
    const ridgeNoise = 1 - Math.abs(noise(x + broad * 110, z + hills * 58, 340, detailSeed));
    const continentalEdge = Math.hypot(x / 3380, z / 3210) + broad * 0.105 + hills * 0.042;
    const ocean = smooth(0.78, 1.15, continentalEdge);
    const calm = smooth(130, 640, Math.hypot(x, z));

    let height = 37 + broad * mix(12, 62, calm) + hills * mix(8, 24, calm) + detail * mix(2.7, 8, calm);
    for (const ridge of MASSIFS) {
      const dx = x - ridge.x;
      const dz = z - ridge.z;
      const u = (dx * ridge.cos - dz * ridge.sin) / ridge.width;
      const v = (dx * ridge.sin + dz * ridge.cos) / ridge.depth;
      const shape = u * u + v * v;
      if (shape < 4) {
        const envelope = Math.exp(-shape * 1.24) * (1 - smooth(2.6, 4, shape));
        height += ridge.height * envelope * (0.45 + ridgeNoise * ridgeNoise * 0.55);
      }
    }

    height = mix(height, -72 + hills * 11, ocean);
    for (const [bx, bz, width, depth, bed, shore] of WATER_BASINS) {
      const u = (x - bx) / width;
      const v = (z - bz) / depth;
      const distance = Math.sqrt(u * u + v * v) + detail * 0.13;
      const flood = 1 - smooth(0.61, 1 + shore, distance);
      if (flood > 0) height = mix(height, bed + hills * 2.7, flood);
    }

    const authored = authorAt(x, z, height);
    return { height: authored.height, trail: authored.trail, continentalEdge, hills, detail };
  }

  function coverAt(x, z, land) {
    const moisture = noise(x, z, 365, moistureSeed) * 0.73 + land.hills * 0.27;
    const fen = (1 - smooth(155, 405, Math.hypot(x + 550, (z - 330) * 1.24)))
      * (1 - smooth(15, 49, land.height));
    const crystal = (1 - smooth(165, 445, Math.hypot((x - 540) * 1.11, z + 670)))
      * smooth(25, 59, land.height);
    const forest = smooth(-0.29, 0.29,
      moisture + Math.sin((x + z) / 280) * 0.18 + smooth(59, 254, Math.hypot(x, z)) * 0.53 - 0.3);
    const coast = Math.max(smooth(0.76, 0.99, land.continentalEdge), (1 - smooth(-12, 4, land.height)) * 0.6);
    const ridge = smooth(112 + land.hills * 31, 201, land.height);
    const snow = smooth(225 + land.hills * 13, 315, land.height);
    let biome = 'meadow';
    if (coast > 0.53 && fen < 0.36) biome = 'coast';
    else if (ridge > 0.63 && crystal < 0.64) biome = 'ridge';
    else if (crystal > 0.52) biome = 'crystal';
    else if (fen > 0.39) biome = 'marsh';
    else if (forest > 0.50) biome = 'forest';
    return { biome, forest, fen, crystal, coast, ridge, snow };
  }

  function surface(land, cover) {
    const patch = clamp(0.53 + land.hills * 0.20 + land.detail * 0.28);
    const color = { r: 0, g: 0, b: 0 };
    blendPalette(color, 'meadow', patch, 1);
    blendPalette(color, 'forest', patch, cover.forest * 0.78);
    blendPalette(color, 'marsh', patch, cover.fen);
    blendPalette(color, 'crystal', patch, cover.crystal);
    blendPalette(color, 'ridge', patch, cover.ridge * (1 - cover.crystal * 0.75));
    blendPalette(color, 'snow', patch, cover.snow);
    blendPalette(color, 'coast', patch, cover.coast * 0.91);
    const shore = (1 - smooth(0.7, 4, Math.abs(land.height + 0.4))) * (1 - cover.coast * 0.35);
    blendPalette(color, 'shore', patch, shore);
    blendPalette(color, 'trail', patch, land.trail * 0.83);
    return color;
  }

  function heightAt(x, z) {
    return landAt(x, z).height;
  }

  function sampleAt(x, z) {
    const land = landAt(x, z);
    const cover = coverAt(x, z, land);
    return { height: land.height, biome: cover.biome, surface: surface(land, cover), trail: land.trail };
  }

  return {
    seed: key,
    spawn: SPAWN,
    waterLevel: WATER_LEVEL,
    landmarks: AUTHORED.sites,
    heightAt,
    sampleAt,
    biomeAt: (x, z) => coverAt(x, z, landAt(x, z)).biome,
    surfaceAt: (x, z) => sampleAt(x, z).surface,
    pathAt: (x, z) => authorAt(x, z, 0).trail,
    isWet: (x, z) => heightAt(x, z) < WATER_LEVEL,
  };
}
