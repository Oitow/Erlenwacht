import * as THREE from 'three';

const kinds = [
  'pine', 'oak', 'birch', 'giant', 'snag', 'log', 'stump',
  'shrub', 'fern', 'grass', 'flower', 'mushroom', 'reed',
  'rock', 'boulder', 'crystal', 'standingStone', 'wall', 'arch', 'lantern',
];
export const ASSET_KINDS = Object.freeze(Object.fromEntries(kinds.map(kind => [kind, kind])));
export const ASSET_VARIANTS = 4;

const BARK = [0x49362d, 0x584137, 0x4d4033, 0x5e4a39];
const NEEDLES = [0x3a5540, 0x344f44, 0x475940, 0x375345];
const LEAVES = [0x58714a, 0x687848, 0x596840, 0x4d6b4d];
const STONE = [0x606668, 0x616966, 0x6a6467, 0x535e65];
const CRYSTAL = [0x73d9c8, 0xa19ded, 0x71abc9, 0xf3aa75];
const BLOOM = [0xf1d69e, 0xb197c8, 0xda896e, 0xe3e6cb];
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function randomFor(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createShapes() {
  const cache = new Map();
  return (shape, detail) => {
    const key = `${shape}/${detail}`;
    if (!cache.has(key)) {
      const geometry = shape === 'box' ? new THREE.BoxGeometry(1, 1, 1)
        : shape === 'ico' ? new THREE.IcosahedronGeometry(1, detail)
          : new THREE.CylinderGeometry(1, 1, 1, detail);
      const positions = geometry.index ? geometry.toNonIndexed() : geometry;
      cache.set(key, positions.getAttribute('position').array);
      if (positions !== geometry) positions.dispose();
      geometry.dispose();
    }
    return cache.get(key);
  };
}

function meshBuilder(shape) {
  const positions = [];
  const colors = [];
  const point = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();

  function triangle(a, b, c, color, shade = 1) {
    positions.push(...a, ...b, ...c);
    tint.setHex(color).multiplyScalar(shade);
    for (let vertex = 0; vertex < 3; vertex += 1) colors.push(tint.r, tint.g, tint.b);
  }

  function stamp(vertices, center, size, color, taper = 1, facet = 0.12) {
    origin.fromArray(center);
    scale.fromArray(size);
    matrix.compose(origin, orientation, scale);
    tint.setHex(color);
    for (let i = 0; i < vertices.length; i += 9) {
      const sideTone = 1 - facet * Math.abs(Math.sin(i * 4.9 + vertices[i] * 1.7));
      for (let j = i; j < i + 9; j += 3) {
        const radius = 1 + (taper - 1) * (vertices[j + 1] + 0.5);
        point.set(vertices[j] * radius, vertices[j + 1], vertices[j + 2] * radius).applyMatrix4(matrix);
        positions.push(point.x, point.y, point.z);
        colors.push(tint.r * sideTone, tint.g * sideTone, tint.b * sideTone);
      }
    }
  }

  function solid(kind, detail, center, size, color, rotation = [0, 0, 0], facet) {
    orientation.setFromEuler(euler.fromArray(rotation));
    stamp(shape(kind, detail), center, size, color, 1, facet);
  }

  function limb(start, end, radius, tip, sides, color) {
    direction.fromArray(end).sub(point.fromArray(start));
    const length = direction.length();
    orientation.setFromUnitVectors(Y_AXIS, direction.multiplyScalar(1 / length));
    stamp(shape('column', sides), start.map((value, i) => (value + end[i]) * 0.5),
      [radius, length, radius], color, tip / radius);
  }

  function ridge(base, top, radius, taper, sides, color, twist = 0, cap = true) {
    const baseRing = [];
    const topRing = [];
    const topY = top[1] - radius * 0.42;
    for (let i = 0; i < sides; i += 1) {
      const angle = twist + Math.PI * 2 * i / sides;
      const variation = 0.9 + 0.12 * Math.cos(angle * 3 + twist);
      baseRing.push([base[0] + Math.cos(angle) * radius, base[1], base[2] + Math.sin(angle) * radius]);
      topRing.push([top[0] + Math.cos(angle) * radius * taper * variation,
        topY + Math.sin(angle * 2 + twist) * radius * 0.23,
        top[2] + Math.sin(angle) * radius * taper * variation]);
    }
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const shade = 0.84 + 0.24 * Math.sin(i * 2.17 + twist) ** 2;
      triangle(baseRing[i], topRing[i], topRing[next], color, shade);
      triangle(baseRing[i], topRing[next], baseRing[next], color, shade * 0.91);
      triangle(topRing[i], top, topRing[next], color, shade * 1.09);
      if (cap) triangle(baseRing[i], baseRing[next], base, color, 0.67);
    }
  }

  function blade(start, bend, end, width, angle, color) {
    const lateralX = Math.cos(angle) * width;
    const lateralZ = Math.sin(angle) * width;
    const left = [bend[0] - lateralX, bend[1] - width * 0.3, bend[2] - lateralZ];
    const right = [bend[0] + lateralX, bend[1] - width * 0.3, bend[2] + lateralZ];
    triangle(start, left, bend, color, 0.8);
    triangle(start, bend, right, color, 0.93);
    triangle(left, end, bend, color, 0.91);
    triangle(bend, end, right, color, 1.12);
  }

  function finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  return { triangle, solid, limb, ridge, blade, finish };
}

function roots(mesh, radius, bark, variant, count, sides) {
  for (let i = 0; i < count; i += 1) {
    const angle = variant * 0.7 + i * Math.PI * 2 / count;
    const reach = radius * (0.9 + 0.19 * Math.sin(i * 2.7));
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    mesh.limb([x, -radius * 0.08, z], [x * 0.23, radius * 0.62, z * 0.23],
      radius * 0.08, radius * 0.22, sides, bark);
  }
}

function pine(mesh, lod, variant) {
  const bark = BARK[variant];
  const height = [12.6, 14.1, 11.5, 13.3][variant];
  const lean = (variant - 1.2) * 0.42;
  const sides = lod === 0 ? 6 : 4;
  mesh.limb([0, -0.08, 0], [lean, height * 0.83, 0.22], 0.53, 0.12, sides, bark);
  if (lod === 0) roots(mesh, 1.6, bark, variant, 4, 4);

  const bands = lod === 2 ? [0, 2, 4] : [0, 1, 2, 3, 4];
  bands.forEach(level => {
    const y = height * (0.3 + level * 0.13);
    const width = (3.05 - level * 0.41) * (variant === 2 ? 0.85 : 1);
    const crownX = lean * y / height;
    const color = NEEDLES[(variant + (level === 0 ? 1 : 0)) % 4];
    const tipY = level === 4 ? height : y + height * (lod === 2 ? 0.35 : 0.27);
    const count = lod === 0 ? 8 : 5;
    const crown = [crownX + 0.24, tipY, 0.26];
    const center = [crownX, y + 0.45, 0];
    const rim = Array.from({ length: count }, (_, index) => {
      const angle = level * 0.97 + variant * 0.7 + index * Math.PI * 2 / count;
      const length = width * (0.76 + 0.24 * (index % 2));
      return [crownX + Math.cos(angle) * length, y + 0.42 * Math.cos(index * 2.5), Math.sin(angle) * length];
    });
    if (lod === 0 && level < 3) {
      const branch = rim[(variant + level) % count];
      mesh.limb([crownX, y + 0.38, 0], branch, 0.14, 0.04, 4, bark);
    }
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count;
      const tone = 0.83 + 0.27 * (i % 3) / 2;
      mesh.triangle(rim[i], crown, rim[next], color, tone);
      mesh.triangle(rim[i], rim[next], center, color, tone * 0.69);
    }
  });
}

function broadleaf(mesh, lod, variant, kind) {
  const birch = kind === 'birch';
  const giant = kind === 'giant';
  const height = (giant ? 20 : birch ? 9.7 : 8.7) * (0.9 + variant * 0.057);
  const span = giant ? 7.8 : birch ? 2.55 : 4.15;
  const baseRadius = giant ? 1.55 : birch ? 0.27 : 0.76;
  const sides = lod === 0 ? 6 : 4;
  const bark = birch ? 0xaa9e89 : BARK[variant];
  const fork = [(variant - 1.5) * baseRadius * 0.73, height * 0.42, baseRadius * 0.35];
  const trunkEnd = [fork[0] * 1.5, height * 0.82, -baseRadius * 0.58];
  mesh.limb([0, -0.07, 0], fork, baseRadius, baseRadius * 0.7, sides, bark);
  mesh.limb(fork, trunkEnd, baseRadius * 0.71, baseRadius * 0.24, sides, bark);
  if (!birch && lod < 2) roots(mesh, baseRadius * (giant ? 3.4 : 2.9), bark, variant, lod === 0 ? 5 : 3, 4);

  if (birch && lod === 0) {
    for (let i = 1; i < 7; i += 1) {
      const ratio = i / 7;
      const angle = (i + variant) * 2.4;
      const radius = baseRadius * (1 - ratio * 0.3);
      const center = [fork[0] * ratio + Math.cos(angle) * radius, fork[1] * ratio, fork[2] * ratio + Math.sin(angle) * radius];
      mesh.solid('box', 0, center, [0.15, 0.046 + i * 0.005, 0.04], 0x3c3731, [0, Math.PI / 2 - angle, 0.07]);
    }
  }

  const count = lod === 0 ? 6 : lod === 1 ? 4 : 3;
  for (let i = 0; i < count; i += 1) {
    const angle = variant * 0.95 + i * Math.PI * 2 / count;
    const x = Math.cos(angle) * span * (0.69 + 0.22 * Math.sin(i * 1.9 + variant));
    const z = Math.sin(angle) * span * (0.7 + 0.15 * Math.cos(i * 2.7));
    const y = height * (0.72 + 0.105 * Math.sin(angle + 0.67));
    const branchEnd = [x, y, z];
    if (lod < 2 || i < 2) mesh.limb(fork, branchEnd, baseRadius * (0.37 - i * 0.02), baseRadius * 0.091, 4, bark);
    const leafColor = birch && variant === 3 ? 0x958346 : LEAVES[(i + variant) % 4];
    mesh.solid('ico', giant && lod === 0 ? 1 : 0, [x, y, z],
      [span * 0.74, height * (birch ? 0.21 : 0.18), span * 0.65], leafColor, [0.1, angle, 0.07], 0.28);
    if (lod === 0 && i % 2 === 0) {
      mesh.solid('ico', 0, [x * 1.21, y + height * 0.079, z * 0.93],
        [span * 0.45, height * 0.13, span * 0.45], LEAVES[(i + variant + 1) % 4], [0.13, angle + 0.2, 0.07], 0.21);
    }
  }
  mesh.solid('ico', lod === 0 ? 1 : 0, [trunkEnd[0], height * 0.88, trunkEnd[2]],
    [span * 0.78, height * 0.19, span * 0.73], LEAVES[variant], [0, variant, 0], 0.25);
}

function deadwood(mesh, lod, variant, kind) {
  const sides = lod === 0 ? 6 : 4;
  const bark = BARK[variant];
  const cut = [0x886548, 0x785e48, 0x9a7954, 0x906e4c][variant];
  if (kind === 'log') {
    const tip = [1.52, 0.47, 0.13];
    mesh.limb([-1.74, 0.46, -0.09], tip, 0.53, 0.36, sides, bark);
    mesh.limb([1.49, 0.47, 0.13], [1.55, 0.47, 0.13], 0.35, 0.34, sides, cut);
    if (lod < 2) mesh.limb([-0.28, 0.51, -0.12], [-0.59, 1.03, -0.58], 0.22, 0.13, 4, bark);
    return;
  }
  if (kind === 'stump') {
    mesh.limb([0, -0.08, 0], [0.11, 0.73, 0], 0.57, 0.42, sides, bark);
    mesh.limb([0.11, 0.72, 0], [0.11, 0.75, 0], 0.41, 0.4, sides, cut);
    if (lod < 2) roots(mesh, 1.1, bark, variant, 4, 4);
    return;
  }
  const height = 6.7 + 0.68 * variant;
  const fork = [-0.27, height * 0.52, 0.17];
  mesh.limb([0, -0.1, 0], fork, 0.58, 0.36, sides, bark);
  mesh.limb(fork, [0.75, height, 0.63], 0.36, 0.035, sides, bark);
  for (let i = 0; i < (lod === 2 ? 2 : 4); i += 1) {
    const angle = variant + 2.4 * i;
    const span = 2.32 - i * 0.29;
    const start = [fork[0] + i * 0.12, fork[1] * (0.8 + i * 0.16), fork[2]];
    const elbow = [Math.cos(angle) * span * 0.63, start[1] + 0.52, Math.sin(angle) * span * 0.63];
    mesh.limb(start, elbow, 0.27 - i * 0.028, 0.12, 4, bark);
    mesh.limb(elbow, [Math.cos(angle + 0.22) * span, start[1] + 1.59, Math.sin(angle + 0.22) * span], 0.12, 0.028, 4, bark);
  }
  if (lod === 0) roots(mesh, 1.75, bark, variant, 4, 4);
}

function groundcover(mesh, lod, variant, kind, random) {
  const green = LEAVES[variant];
  if (kind === 'shrub') {
    const count = lod === 0 ? 6 : lod === 1 ? 4 : 2;
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.4 + variant;
      const x = Math.cos(angle) * 0.63;
      const z = Math.sin(angle) * 0.52;
      const y = 0.52 + 0.25 * random();
      if (lod === 0) mesh.limb([0, 0, 0], [x, y, z], 0.085, 0.034, 4, BARK[variant]);
      mesh.solid('ico', 0, [x, y, z], [0.62, 0.44, 0.56], LEAVES[(variant + i) % 4], [0, angle, 0], 0.3);
      if (lod === 0 && variant % 2 === 1) {
        mesh.solid('ico', 0, [x * 1.33, y, z * 1.5], [0.057, 0.057, 0.057], BLOOM[variant]);
      }
    }
    return;
  }

  const grass = kind === 'grass';
  const reed = kind === 'reed';
  if (grass || reed) {
    const count = lod === 0 ? 8 : lod === 1 ? 4 : 3;
    const length = reed ? 1.55 : 0.59;
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.4 + variant;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const height = length * (0.59 + random() * 0.53);
      const lean = reed ? 0.46 : 0.57;
      const end = [lean * x, height, lean * z];
      mesh.blade([0.12 * x, -0.035, 0.12 * z], [0.23 * x, height * 0.73, 0.23 * z], end,
        reed ? 0.044 : 0.075, angle + Math.PI / 2, LEAVES[(variant + i) % 4]);
      if (reed && i % 2 === 0 && lod < 2) {
        mesh.limb([end[0] * 0.91, height - 0.27, end[2] * 0.91], end, 0.062, 0.04, 4, 0x705940);
      }
    }
    return;
  }

  if (kind === 'fern') {
    const count = lod === 0 ? 6 : lod === 1 ? 4 : 3;
    for (let i = 0; i < count; i += 1) {
      const angle = i * Math.PI * 2 / count + variant;
      const length = 0.78 + random() * 0.46;
      const x = Math.cos(angle) * length;
      const z = Math.sin(angle) * length;
      const height = length * 0.6;
      mesh.blade([0, 0, 0], [x * 0.51, height, z * 0.51], [x, height * 0.73, z],
        lod === 2 ? 0.17 : 0.11, angle + Math.PI / 2, green);
      if (lod === 2) continue;
      const leaflets = lod === 0 ? 4 : 2;
      for (let j = 0; j < leaflets; j += 1) {
        const along = 0.22 + j * 0.15;
        const y = height * Math.sin(along * Math.PI * 0.74);
        const breadth = (0.29 - 0.037 * j) / length;
        for (const side of [-1, 1]) {
          mesh.blade([x * along, y, z * along],
            [x * (along + 0.075) - z * breadth * side * 0.6, y + 0.03, z * (along + 0.075) + x * breadth * side * 0.6],
            [x * (along + 0.18) - z * breadth * side, y - 0.012, z * (along + 0.18) + x * breadth * side],
            0.045, angle, LEAVES[(variant + j) % 4]);
        }
      }
    }
    return;
  }

  const count = lod === 0 ? 3 : lod === 1 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const angle = variant + i * 2.4;
    const x = Math.cos(angle) * i * 0.21;
    const z = Math.sin(angle) * i * 0.21;
    const height = 0.35 + random() * 0.3;
    const top = [x + 0.08, height, z - 0.035];
    if (kind === 'mushroom') {
      const size = 0.21 + (2 - i) * 0.075;
      mesh.limb([x, -0.02, z], top, 0.067, 0.041, 4, 0xa4997a);
      mesh.solid('ico', 0, [top[0], top[1] + 0.043, top[2]], [size, size * 0.45, size],
        [0xad7654, 0x927270, 0x997f51, 0xc2916b][variant], [0, angle, 0.08], 0.27);
      if (lod === 0 && variant === 0) {
        mesh.solid('ico', 0, [top[0] + 0.07, top[1] + size * 0.44, top[2] + 0.08], [0.045, 0.025, 0.035], 0xe7d3af);
      }
      continue;
    }
    mesh.limb([x, -0.02, z], top, 0.026, 0.014, 3, green);
    mesh.blade([x, height * 0.22, z], [x - 0.15, height * 0.4, z + 0.05],
      [x - 0.21, height * 0.48, z + 0.12], 0.048, angle, green);
    const petals = lod === 0 ? 6 : 4;
    for (let j = 0; j < petals; j += 1) {
      const direction = j * Math.PI * 2 / petals + angle;
      const dx = Math.cos(direction);
      const dz = Math.sin(direction);
      const stem = [top[0], top[1] - 0.013, top[2]];
      mesh.blade(stem, [top[0] + dx * 0.12, top[1] + 0.047, top[2] + dz * 0.12],
        [top[0] + dx * 0.185, top[1] + 0.064, top[2] + dz * 0.185], 0.058, direction + Math.PI / 2, BLOOM[variant]);
    }
    mesh.solid('ico', 0, top, [0.085, 0.049, 0.085], 0xd4a85b);
  }
}

function minerals(mesh, lod, variant, kind) {
  const stone = STONE[variant];
  if (kind === 'crystal') {
    mesh.solid('ico', 0, [0, 0.28, 0], [0.86, 0.4, 0.74], stone, [0, variant, 0.05], 0.26);
    const count = lod === 0 ? 5 : lod === 1 ? 3 : 2;
    const main = 1.92 + 0.17 * variant;
    mesh.ridge([0, 0.3, 0], [0.29, main, -0.17], 0.38, 0.88, lod === 0 ? 6 : 5, CRYSTAL[variant], variant, false);
    for (let i = 1; i < count; i += 1) {
      const angle = i * 2.39 + variant;
      const x = Math.cos(angle) * 0.52;
      const z = Math.sin(angle) * 0.52;
      mesh.ridge([x * 0.64, 0.25, z * 0.64], [x * 1.65, 1.46 - i * 0.19, z * 1.65],
        0.23 - i * 0.022, 0.82, 4, CRYSTAL[(variant + (i % 2)) % 4], angle, false);
    }
    return;
  }

  const standing = kind === 'standingStone';
  if (standing) {
    mesh.ridge([0, -0.04, 0], [0.31 - 0.18 * variant, 3.55 + variant * 0.28, 0.23],
      0.85, 0.68, lod === 0 ? 6 : 5, stone, variant * 0.49, false);
    if (lod < 2) mesh.solid('ico', 0, [0.18, 0.44, -0.05], [1.1, 0.61, 0.88], stone, [0, variant, 0.1], 0.24);
    return;
  }

  const large = kind === 'boulder';
  const size = large ? 1.74 : 0.56;
  const tall = [0.63, 0.78, 0.88, 0.59][variant];
  mesh.solid('ico', large && lod === 0 ? 1 : 0, [0, size * 0.47, 0],
    [size, size * tall, size * 0.79], stone, [0.12, variant * 1.7, 0.18], 0.34);
  if (lod === 0 && large) {
    mesh.solid('ico', 0, [-0.83, 0.47, -0.68], [1.03, 0.51, 0.87], STONE[(variant + 1) % 4], [0.22, variant, 0.08], 0.29);
    mesh.solid('ico', 0, [0.03, size * tall + 0.43, -0.04],
      [size * 0.68, 0.32, size * 0.56], 0x515e42, [0.22, variant, 0.08], 0.32);
  }
}

function ruins(mesh, lod, variant, kind, random) {
  if (kind === 'lantern') {
    const side = lod === 0 ? 6 : 4;
    mesh.solid('ico', 0, [0, 0.16, 0], [0.46, 0.27, 0.46], STONE[variant]);
    mesh.limb([0, 0, 0], [0, 1.5, 0], 0.129, 0.105, side, BARK[variant]);
    mesh.solid('box', 0, [0, 1.48, 0], [0.46, 0.12, 0.46], 0x53453a);
    mesh.solid('ico', 0, [0, 1.71, 0], [0.133, 0.27, 0.133], 0xffbd6d);
    mesh.ridge([0, 1.94, 0], [0, 2.22, 0], 0.36, 0.27, 4, 0x574b43, Math.PI / 4);
    if (lod < 2) {
      for (const x of [-0.19, 0.19]) {
        for (const z of [-0.19, 0.19]) mesh.solid('box', 0, [x, 1.73, z], [0.043, 0.51, 0.043], 0x4b3d37);
      }
    }
    return;
  }

  if (kind === 'wall') {
    for (let row = 0; row < 3; row += 1) {
      const count = 4 - Math.floor(row * 0.76);
      for (let i = 0; i < count; i += 1) {
        const x = i * 1.11 - 1.73 + row * 0.23;
        const y = 0.32 + row * 0.67;
        const z = (random() - 0.5) * 0.16;
        mesh.solid('box', 0, [x, y, z], [1.09, 0.63 + 0.09 * random(), 0.91 - row * 0.11],
          STONE[(variant + row + i) % 4], [0, (random() - 0.5) * 0.16, (random() - 0.5) * 0.16], 0.22);
      }
    }
    if (lod === 0) {
      mesh.solid('ico', 0, [-1.96, 0.23, 0.6], [0.54, 0.34, 0.41], STONE[variant], [0.1, variant, 0.07]);
      mesh.solid('ico', 0, [1.7, 0.26, -0.6], [0.56, 0.38, 0.48], STONE[(variant + 1) % 4], [0.27, 1.2, 0.07]);
    }
    return;
  }

  for (const side of [-1, 1]) {
    const x = 2.3 * side;
    mesh.solid('box', 0, [x, 0.15, 0], [1.62, 0.42, 1.37], STONE[variant], [0, 0, 0], 0.19);
    for (let row = 0; row < 4; row += 1) {
      mesh.solid('box', 0, [x + (random() - 0.5) * 0.16, 0.56 + row * 0.65, 0],
        [1.18, 0.64, 0.94], STONE[(variant + row) % 4], [0, (random() - 0.5) * 0.1, 0.02], 0.2);
    }
    if (lod === 0) {
      mesh.solid('ico', 0, [x * 1.17, 0.29, 0.65], [0.68, 0.41, 0.48], STONE[variant], [0.27, variant, 0.23]);
    }
  }
  const voussoirs = 9;
  for (let i = 0; i < voussoirs; i += 1) {
    const angle = i * Math.PI / (voussoirs - 1);
    const center = [2.29 * Math.cos(angle), 2.66 + 2.29 * Math.sin(angle), 0];
    mesh.solid('box', 0, center, [1.05, i === 4 ? 1.24 : 0.93, 0.99],
      STONE[(variant + i) % 4], [0, (random() - 0.5) * 0.07, angle - Math.PI / 2], 0.22);
  }
}

const thinPlants = new Set(['fern', 'grass', 'flower', 'reed']);
const broadleafKinds = new Set(['oak', 'birch', 'giant']);
const deadwoodKinds = new Set(['snag', 'log', 'stump']);
const mineralKinds = new Set(['rock', 'boulder', 'crystal', 'standingStone']);
const ruinKinds = new Set(['arch', 'wall', 'lantern']);

export function createAssetLibrary() {
  const getShape = createShapes();
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  const foliage = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const models = new Map();

  function get(kind, lod = 0, variant = 0) {
    if (!Object.hasOwn(ASSET_KINDS, kind)) throw new RangeError(`Unknown world asset: ${kind}`);
    const detail = Math.max(0, Math.min(2, Math.trunc(lod) || 0));
    const index = ((Math.trunc(variant) || 0) % ASSET_VARIANTS + ASSET_VARIANTS) % ASSET_VARIANTS || 0;
    const key = `${kind}/${detail}/${index}`;
    if (models.has(key)) return models.get(key);

    const mesh = meshBuilder(getShape);
    const random = randomFor(kinds.indexOf(kind) * 173 + index * 1327);
    if (kind === 'pine') pine(mesh, detail, index);
    else if (broadleafKinds.has(kind)) broadleaf(mesh, detail, index, kind);
    else if (deadwoodKinds.has(kind)) deadwood(mesh, detail, index, kind);
    else if (mineralKinds.has(kind)) minerals(mesh, detail, index, kind);
    else if (ruinKinds.has(kind)) ruins(mesh, detail, index, kind, random);
    else groundcover(mesh, detail, index, kind, random);

    const asset = { geometry: mesh.finish(), material: thinPlants.has(kind) ? foliage : solid };
    models.set(key, asset);
    return asset;
  }

  function dispose() {
    for (const { geometry } of models.values()) geometry.dispose();
    models.clear();
    solid.dispose();
    foliage.dispose();
  }

  return { get, dispose };
}
