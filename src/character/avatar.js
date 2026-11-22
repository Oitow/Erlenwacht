import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DodecahedronGeometry, DoubleSide,
  DynamicDrawUsage, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Object3D, Vector3,
} from 'three';
import { getClass } from '../game/classes.js';

const PALETTE = {
  iron: 0x606d72,
  edge: 0x989c8c,
  leather: 0x3e2d25,
  dark: 0x222627,
  cloth: 0x404d4d,
  hood: 0x596968,
  burgundy: 0x733d3e,
  brass: 0xb08b54,
  rune: 0x8bc5c4,
};

const CAST_POSES = {
  rune: { duration: 0.47, left: 1, right: 0.29, twist: 1, glow: 0.9, tint: 0x74dcff },
  seal: { duration: 0.65, left: 1, right: 0.67, twist: 0.45, glow: 1.6, tint: 0xf8ce86 },
  arc: { duration: 0.53, left: 0.29, right: 1, twist: -1, glow: 1.2, tint: 0xb5f191 },
  shield: { duration: 0.48, left: 0.91, right: 0.18, twist: 0.72, glow: 0.58, tint: 0xe3ad78 },
  guard: { duration: 0.62, left: 1, right: 0.44, twist: 0.28, glow: 1, tint: 0xffcb91 },
  bow: { duration: 0.38, left: 0.92, right: 0.62, twist: 1.14, glow: 0.43, tint: 0xe9dcaa },
  fan: { duration: 0.53, left: 0.97, right: 0.78, twist: 1.36, glow: 0.84, tint: 0xe9d9a0 },
  staff: { duration: 0.47, left: 0.3, right: 0.95, twist: -0.76, glow: 1.15, tint: 0x74dcff },
  ember: { duration: 0.60, left: 0.52, right: 1, twist: -0.52, glow: 1.4, tint: 0xff895a },
};

const CLASS_POSES = {
  bastion: { rune: 'shield', arc: 'guard' },
  waldlaeufer: { rune: 'bow', arc: 'fan' },
  runenweber: { rune: 'staff', arc: 'ember' },
};

const WEAPON_TINTS = {
  'trail-blade': 0x8b9695,
  'warden-blade': 0x9cbbcd,
  'seal-blade': 0xe4ba75,
};

function joint(parent, x, y, z) {
  const group = new Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

// Bake the fixed details on each moving joint into a single vertex-colored mesh.
function bakeParts(parts, surface) {
  const positions = [];
  const colors = [];
  const indices = [];
  const transform = new Object3D();
  const color = new Color();
  const vertex = new Vector3();
  for (const [geometry, tint, x, y, z, width, height, depth, tilt = 0] of parts) {
    const start = positions.length / 3;
    transform.position.set(x, y, z);
    transform.scale.set(width, height, depth);
    transform.rotation.z = tilt;
    transform.updateMatrix();
    color.setHex(tint);
    const source = geometry.getAttribute('position');
    for (let i = 0; i < source.count; i++) {
      vertex.fromBufferAttribute(source, i).applyMatrix4(transform.matrix);
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(color.r, color.g, color.b);
    }
    const index = geometry.getIndex();
    for (let i = 0; i < (index?.count ?? source.count); i++) {
      indices.push(start + (index ? index.getX(i) : i));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, surface);
}

function createCloak(parent) {
  const folds = [0, 0.04, -0.029, 0.051, -0.018, 0.049, 0];
  const shadings = [0x9e5f45, 0x633538, 0x4c292c, 0x754044, 0x543136, 0x60373b, 0x895242];
  const foldLight = [0.92, 0.82, 0.69, 0.95, 0.72, 0.85, 0.92];
  const columns = folds.length;
  const rows = [
    [0, 0.27, 0.16],
    [-0.28, 0.36, 0.24],
    [-0.61, 0.39, 0.28],
    [-0.96, 0.43, 0.35],
    [-1.13, 0.41, 0.37],
  ];
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new Color();
  rows.forEach(([y, width, depth], row) => {
    for (let column = 0; column < columns; column++) {
      const across = column / (columns - 1) * 2 - 1;
      const hem = row === rows.length - 1 ? Math.abs(across) * 0.12 + (column % 2) * 0.047 : 0;
      positions.push(across * width, y + hem, depth + folds[column]);
      color.setHex(shadings[column]);
      color.multiplyScalar(1 - row * 0.055);
      colors.push(color.r, color.g, color.b);
      if (row && column) {
        const bottom = row * columns + column;
        const top = bottom - columns;
        indices.push(top - 1, bottom - 1, top, top, bottom - 1, bottom);
      }
    }
  });
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute(positions, 3);
  position.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  const vertexColors = new Float32BufferAttribute(colors, 3);
  geometry.setAttribute('color', vertexColors);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.22;
  const material = new MeshStandardMaterial({
    roughness: 0.95, vertexColors: true, side: DoubleSide, flatShading: true,
  });
  parent.add(new Mesh(geometry, material));

  function animate(age, stridePhase, gait, air) {
    for (let i = columns; i < position.count; i++) {
      const base = i * 3;
      const trail = Math.floor(i / columns) / (rows.length - 1);
      const flex = trail * trail;
      const flutter = Math.sin(age * 5.6 - trail * 3 + i % columns * 0.76);
      const stride = Math.sin(stridePhase - trail * 2);
      position.setX(i, positions[base] + flex * stride * gait * 0.055);
      position.setZ(i, positions[base + 2] + flex * (flutter * (0.021 + gait * 0.047) + air * 0.07));
    }
    position.needsUpdate = true;
  }

  function setColors(mantle, trim) {
    for (let i = 0; i < vertexColors.count; i++) {
      const column = i % columns;
      const edge = column === 0 || column === columns - 1;
      color.setHex(edge ? trim : mantle);
      color.multiplyScalar(foldLight[column] * (1 - Math.floor(i / columns) * 0.055));
      vertexColors.setXYZ(i, color.r, color.g, color.b);
    }
    vertexColors.needsUpdate = true;
  }

  return { animate, setColors };
}

export function createAvatar() {
  const root = new Group();
  const body = joint(root, 0, 0, 0);
  const box = new BoxGeometry(1, 1, 1);
  const tapered = new CylinderGeometry(0.75, 1, 1, 6);
  const facet = new DodecahedronGeometry(1);
  const bladeShape = new CylinderGeometry(0, 1, 1, 4, 1);
  const surface = new MeshStandardMaterial({
    roughness: 0.77, metalness: 0.13, vertexColors: true, flatShading: true,
  });
  const { iron, edge, leather, dark, cloth, hood, burgundy, brass, rune } = PALETTE;
  const attach = (parent, parts) => parent.add(bakeParts(parts, surface));

  attach(body, [
    [tapered, cloth, 0, 1.18, 0, 0.295, 0.61, 0.21],
    [tapered, burgundy, 0, 0.962, 0, 0.29, 0.28, 0.205],
    [facet, iron, 0, 1.36, -0.085, 0.32, 0.29, 0.23],
    [facet, brass, -0.066, 1.46, -0.27, 0.073, 0.071, 0.033],
    [box, leather, 0.032, 1.27, -0.227, 0.083, 0.52, 0.04, -0.63],
    [box, leather, 0, 1.025, 0, 0.546, 0.103, 0.42],
    [box, brass, 0.035, 1.025, -0.228, 0.105, 0.079, 0.045],
    [box, leather, -0.255, 0.976, 0.055, 0.20, 0.25, 0.19, -0.09],
    [box, brass, -0.275, 1.002, -0.047, 0.056, 0.05, 0.032],
    [facet, burgundy, 0, 1.56, 0.02, 0.29, 0.12, 0.25],
    [facet, brass, 0, 1.55, 0.232, 0.071, 0.059, 0.047],
  ]);

  const head = joint(body, 0, 1.72, 0);
  attach(head, [
    [facet, hood, 0, 0.065, 0.055, 0.248, 0.284, 0.248],
    [facet, dark, 0, 0.01, -0.122, 0.186, 0.183, 0.158],
    [facet, iron, 0, -0.04, -0.178, 0.153, 0.13, 0.092],
    [box, dark, 0, 0.059, -0.259, 0.243, 0.047, 0.025],
    [box, rune, -0.068, 0.067, -0.272, 0.063, 0.014, 0.015, -0.075],
    [box, rune, 0.068, 0.067, -0.272, 0.063, 0.014, 0.015, 0.075],
    [box, edge, 0, 0.002, -0.273, 0.035, 0.145, 0.025],
  ]);

  const cape = joint(body, 0, 1.51, 0);
  const cloak = createCloak(cape);
  const limbs = [];
  for (const side of [-1, 1]) {
    const shoulder = joint(body, side * 0.34, 1.45, 0);
    const armored = side === 1;
    attach(shoulder, [
      [facet, armored ? iron : burgundy, side * 0.041, 0.024, 0, armored ? 0.205 : 0.159, 0.134, 0.205],
      [facet, armored ? edge : brass, side * 0.13, 0.013, -0.013, 0.069, 0.071, 0.139],
      [tapered, leather, 0, -0.142, 0, 0.104, 0.339, 0.102],
    ]);

    const elbow = joint(shoulder, 0, -0.292, 0);
    attach(elbow, [
      [tapered, iron, 0, -0.078, 0, 0.112, 0.181, 0.09],
      [box, brass, 0, -0.121, -0.09, 0.106, 0.037, 0.042],
      [box, dark, 0, -0.205, -0.021, 0.13, 0.13, 0.133],
    ]);

    const hip = joint(body, side * 0.143, 0.907, 0);
    attach(hip, [
      [tapered, cloth, 0, -0.19, 0, 0.123, 0.394, 0.119],
      [facet, leather, side * 0.048, -0.124, 0.003, 0.102, 0.208, 0.109],
    ]);

    const knee = joint(hip, 0, -0.408, 0);
    attach(knee, [
      [facet, iron, 0, -0.008, -0.066, 0.111, 0.132, 0.112],
      [tapered, leather, 0, -0.203, 0, 0.104, 0.383, 0.1],
      [box, iron, 0, -0.202, -0.09, 0.108, 0.253, 0.065],
      [box, brass, 0, -0.104, -0.124, 0.089, 0.035, 0.038],
    ]);

    const ankle = joint(knee, 0, -0.381, 0);
    attach(ankle, [
      [box, leather, 0, -0.048, -0.059, 0.193, 0.14, 0.319],
      [box, dark, 0, -0.102, -0.069, 0.207, 0.038, 0.33],
      [facet, iron, 0, -0.038, -0.162, 0.109, 0.071, 0.091],
    ]);
    limbs.push({ side, shoulder, elbow, hip, knee, ankle });
  }

  const weapon = joint(limbs[1].elbow, 0, -0.206, -0.098);
  weapon.rotation.set(-Math.PI / 3, 0, -0.13);
  attach(weapon, [
    [tapered, leather, 0, -0.016, 0, 0.039, 0.20, 0.039],
    [facet, brass, 0, -0.146, 0, 0.05, 0.056, 0.045],
    [box, brass, 0, 0.101, 0, 0.249, 0.053, 0.072],
  ]);
  const steel = new MeshStandardMaterial({
    color: WEAPON_TINTS['trail-blade'],
    emissive: 0x83c4df,
    emissiveIntensity: 0,
    roughness: 0.48,
    metalness: 0.28,
    flatShading: true,
  });
  const blade = new Mesh(bladeShape, steel);
  blade.position.y = 0.407;
  blade.scale.set(0.095, 0.59, 0.044);
  weapon.add(blade);

  const gearSurface = new MeshStandardMaterial({
    roughness: 0.67, metalness: 0.13, vertexColors: true, flatShading: true,
  });
  const neutralGearTint = new Color(0xffffff);
  function makeGear(limb, x, y, z, parts) {
    const gear = bakeParts(parts, gearSurface);
    gear.position.set(x, y, z);
    gear.visible = false;
    limb.add(gear);
    return gear;
  }

  const classGear = {
    bastion: makeGear(limbs[0].elbow, -0.18, -0.13, -0.10, [
      [facet, edge, 0, 0, 0, 0.388, 0.490, 0.151],
      [facet, 0x7b4742, 0, 0, -0.081, 0.343, 0.438, 0.104],
      [box, brass, 0, 0, -0.175, 0.071, 0.561, 0.04],
      [facet, edge, 0, 0.021, -0.188, 0.106, 0.107, 0.053],
      [box, leather, 0, -0.026, 0.108, 0.13, 0.28, 0.05],
    ]),
    waldlaeufer: makeGear(limbs[0].elbow, -0.035, -0.20, -0.132, [
      [tapered, leather, 0, 0, 0, 0.040, 0.25, 0.041],
      [tapered, 0xaa7749, -0.018, 0.19, 0, 0.029, 0.27, 0.029, 0.19],
      [tapered, 0xaa7749, -0.084, 0.42, 0, 0.026, 0.243, 0.027, 0.39],
      [tapered, 0xc79158, -0.162, 0.56, 0, 0.020, 0.115, 0.021, 0.72],
      [tapered, 0xaa7749, -0.018, -0.19, 0, 0.029, 0.27, 0.029, -0.19],
      [tapered, 0xaa7749, -0.084, -0.42, 0, 0.026, 0.243, 0.027, -0.39],
      [tapered, 0xc79158, -0.162, -0.56, 0, 0.020, 0.115, 0.021, -0.72],
      [box, 0xcfc1aa, -0.198, 0, 0, 0.009, 1.18, 0.009],
    ]),
    runenweber: makeGear(limbs[1].elbow, 0.046, -0.22, -0.124, [
      [tapered, 0x61524c, 0, 0.20, 0, 0.037, 1.23, 0.038],
      [tapered, brass, 0, 0.73, 0, 0.073, 0.24, 0.073],
      [facet, 0xb69de9, 0, 0.91, 0, 0.139, 0.188, 0.138],
      [tapered, brass, -0.119, 0.866, 0, 0.028, 0.193, 0.031, 0.42],
      [tapered, brass, 0.119, 0.866, 0, 0.028, 0.193, 0.031, -0.42],
    ]),
    dornhueter: makeGear(limbs[1].elbow, 0.065, -0.22, -0.15, [
      [tapered, 0x635a47, 0, 0.21, 0, 0.040, 1.30, 0.042],
      [tapered, 0x9cb87d, 0, 0.86, 0, 0.104, 0.40, 0.064],
      [tapered, 0x769263, -0.141, 0.755, 0, 0.047, 0.35, 0.043, 0.63],
      [tapered, 0x769263, 0.123, 0.79, 0, 0.045, 0.37, 0.044, -0.55],
      [facet, brass, 0, 0.583, 0, 0.067, 0.098, 0.067],
    ]),
  };
  classGear.bastion.rotation.set(0.11, -0.34, 0.19);
  classGear.waldlaeufer.rotation.set(-0.60, 0.10, 0.26);
  classGear.runenweber.rotation.set(-0.30, 0, -0.16);
  classGear.dornhueter.rotation.set(-0.79, 0, -0.22);

  box.dispose();
  tapered.dispose();
  facet.dispose();

  let stridePhase = 0;
  let age = 0;
  let gait = 0;
  let run = 0;
  let air = 0;
  let land = 0;
  let wasGrounded = true;
  let castTime = Infinity;
  let castPose = CAST_POSES.rune;
  let hit = 0;
  let selectedClass;
  let hasWeapon = true;

  function animate(dt, speed, grounded, verticalSpeed = 0, turnRate = 0) {
    const blend = 1 - Math.exp(-dt * 11);
    age += dt;
    castTime += dt;
    stridePhase += dt * speed * 2.25 * (grounded ? 1 : 0.25);
    gait += (Math.min(speed / 4.3, 1) - gait) * blend;
    run += (Math.max(0, Math.min((speed - 4) / 4.1, 1)) - run) * blend;
    air += ((grounded ? 0 : 1) - air) * blend;
    land = grounded && !wasGrounded ? 1 : land * Math.exp(-dt * 9);
    hit *= Math.exp(-dt * 13);
    wasGrounded = grounded;

    const castPhase = Math.min(castTime / castPose.duration, 1);
    const windup = Math.max(0, 1 - castPhase / 0.26);
    const release = castPhase < 1 ? Math.sin(Math.PI * Math.max(0, (castPhase - 0.15) / 0.85)) : 0;
    const swing = Math.sin(stridePhase);
    const counterSwing = Math.cos(stridePhase);
    const twisting = Math.max(-1, Math.min(turnRate / 8, 1));
    const groundedGait = gait * (1 - air * 0.87);
    const tuck = verticalSpeed > 0 ? 0.72 : 0.43;

    body.position.y = Math.abs(swing) * 0.042 * groundedGait - land * 0.08
      + Math.sin(age * 2.45) * 0.015 * (1 - gait);
    body.rotation.set(
      -(0.037 + run * 0.09) * gait - release * 0.08 + hit * 0.15,
      -swing * groundedGait * 0.073 + (windup * 0.43 - release * 0.34) * castPose.twist,
      swing * groundedGait * 0.043 + twisting * gait * 0.13 + hit * 0.11,
    );
    head.rotation.set(
      gait * 0.072 + Math.sin(age * 2) * 0.022 + land * 0.09,
      -body.rotation.y * 0.59,
      -body.rotation.z * 0.45,
    );
    cape.rotation.x = -gait * (0.13 + run * 0.15) - air * 0.20 + land * 0.06;
    cape.rotation.z = swing * gait * 0.066 - twisting * gait * 0.11;
    cloak.animate(age, stridePhase, gait, air);
    steel.emissiveIntensity = windup * 0.27 + release * castPose.glow;
    gearSurface.emissiveIntensity = steel.emissiveIntensity * 0.42;

    for (const { side, shoulder, elbow, hip, knee, ankle } of limbs) {
      const stride = swing * side * groundedGait;
      const lift = Math.max(0, -counterSwing * side) * groundedGait;
      const castArm = side === -1 ? castPose.left : castPose.right;
      shoulder.rotation.set(
        stride * (0.39 + run * 0.13) + air * 0.28 - windup * castArm * 0.42 + release * castArm * 1.13,
        -side * release * castArm * 0.19,
        side * (0.118 + air * 0.21 + release * castArm * 0.3),
      );
      elbow.rotation.x = 0.086 + Math.max(-stride, 0) * 0.33 + air * 0.27
        + windup * castArm * 1.04 + release * castArm * 0.35;
      hip.rotation.x = -stride * (0.50 + run * 0.20)
        + air * (side === -1 ? tuck : -0.13) + land * 0.22;
      knee.rotation.x = -lift * (0.57 + run * 0.44) - air * (side === -1 ? 0.78 : 0.53) - land * 0.41;
      ankle.rotation.x = -hip.rotation.x * 0.39 - knee.rotation.x * 0.42 + lift * 0.13;
    }
  }

  function reset() {
    stridePhase = age = gait = run = air = land = hit = 0;
    wasGrounded = true;
    castTime = Infinity;
    animate(0, 0, true);
  }

  return {
    root,
    animate,
    reset,
    playCast(style, tint) {
      castTime = 0;
      const pose = CLASS_POSES[selectedClass]?.[style] ?? style;
      castPose = Object.hasOwn(CAST_POSES, pose) ? CAST_POSES[pose] : CAST_POSES.rune;
      steel.emissive.setHex(tint ?? castPose.tint);
      gearSurface.emissive.copy(steel.emissive);
    },
    playHit() {
      hit = 1;
    },
    setClass(classId) {
      const playerClass = getClass(classId);
      selectedClass = playerClass.id;
      for (const [id, gear] of Object.entries(classGear)) gear.visible = id === selectedClass;
      root.scale.x = playerClass.avatar.width;
      cloak.setColors(playerClass.avatar.mantle, playerClass.avatar.trim);
      weapon.visible = hasWeapon && selectedClass === 'bastion';
    },
    setWeapon(itemId, tint) {
      hasWeapon = Boolean(itemId);
      weapon.visible = hasWeapon && (!selectedClass || selectedClass === 'bastion');
      steel.color.setHex(tint ?? WEAPON_TINTS[itemId] ?? WEAPON_TINTS['trail-blade']);
      gearSurface.color.lerpColors(neutralGearTint, steel.color, 0.21);
    },
  };
}
