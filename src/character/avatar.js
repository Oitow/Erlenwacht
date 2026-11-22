import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DodecahedronGeometry,
  Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, DoubleSide,
} from 'three';

function material(color, roughness = 0.86, metalness = 0) {
  return new MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function capeGeometry() {
  const vertices = [];
  const faces = [];
  const rows = [
    { y: 0, width: 0.28, z: 0.16 },
    { y: -0.41, width: 0.36, z: 0.24 },
    { y: -0.9, width: 0.39, z: 0.31 },
  ];
  const folds = [0, 0.045, -0.05, 0.055, 0];
  rows.forEach((row, rowIndex) => {
    folds.forEach((fold, column) => {
      const unevenHem = rowIndex === rows.length - 1 ? Math.abs(column - 2) * 0.035 : 0;
      vertices.push((column - 2) * row.width / 2, row.y + unevenHem, row.z + fold);
      if (rowIndex > 0 && column > 0) {
        const bottom = rowIndex * folds.length + column;
        const top = bottom - folds.length;
        faces.push(top - 1, bottom - 1, top, top, bottom - 1, bottom);
      }
    });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

export function createAvatar() {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const box = new BoxGeometry(1, 1, 1);
  const tapered = new CylinderGeometry(0.78, 1, 1, 6);
  const facet = new DodecahedronGeometry(1);
  const iron = material(0x727e80, 0.57, 0.34);
  const edge = material(0x9a9c8b, 0.5, 0.24);
  const leather = material(0x3b3028);
  const cloth = material(0x445052);
  const hoodCloth = material(0x536269);
  const crimson = material(0x733e3d);
  const brass = material(0xb18a54, 0.5, 0.29);
  const visor = material(0x171923);
  const capeCloth = material(0x583535);
  capeCloth.side = DoubleSide;

  function pivot(parent, x, y, z) {
    const group = new Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  function part(parent, geometry, surface, x, y, z, width, height, depth) {
    const mesh = new Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    parent.add(mesh);
    return mesh;
  }

  part(body, tapered, cloth, 0, 1.16, 0, 0.27, 0.57, 0.19);
  part(body, box, leather, 0, 1.01, 0, 0.51, 0.11, 0.34);
  part(body, box, brass, 0, 1.01, -0.18, 0.13, 0.085, 0.055);
  part(body, facet, iron, 0, 1.39, -0.072, 0.31, 0.29, 0.22);
  part(body, box, crimson, 0, 1.17, -0.182, 0.13, 0.30, 0.036);
  part(body, facet, brass, 0, 1.45, -0.27, 0.073, 0.073, 0.025);

  const head = pivot(body, 0, 1.75, 0);
  part(head, facet, hoodCloth, 0, 0.055, 0.037, 0.24, 0.285, 0.23);
  part(head, facet, iron, 0, 0.015, -0.115, 0.188, 0.198, 0.122);
  part(head, box, visor, 0, 0.053, -0.22, 0.237, 0.039, 0.023);
  part(head, box, edge, 0, -0.005, -0.236, 0.035, 0.147, 0.025);

  const cape = pivot(body, 0, 1.52, 0);
  part(cape, capeGeometry(), capeCloth, 0, 0, 0, 1, 1, 1);

  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = pivot(body, side * 0.36, 1.46, 0);
    part(arm, facet, iron, side * 0.028, 0.016, 0, 0.167, 0.148, 0.205);
    part(arm, tapered, leather, 0, -0.15, 0, 0.095, 0.35, 0.10);
    const elbow = pivot(arm, 0, -0.29, 0);
    part(elbow, tapered, edge, 0, -0.075, 0, 0.102, 0.20, 0.084);
    part(elbow, box, leather, 0, -0.20, -0.022, 0.131, 0.139, 0.123);
    arms.push({ arm, elbow });

    const hip = pivot(body, side * 0.15, 0.92, 0);
    part(hip, tapered, cloth, 0, -0.19, 0, 0.124, 0.39, 0.124);
    const knee = pivot(hip, 0, -0.42, 0);
    part(knee, facet, iron, 0, -0.035, -0.052, 0.125, 0.144, 0.128);
    part(knee, tapered, leather, 0, -0.224, 0, 0.105, 0.40, 0.104);
    part(knee, box, leather, 0, -0.421, -0.067, 0.205, 0.157, 0.34);
    legs.push({ hip, knee });
  }

  part(body, box, leather, -0.24, 0.97, 0.063, 0.18, 0.25, 0.18);
  part(body, box, brass, -0.29, 0.99, -0.025, 0.068, 0.057, 0.035);

  let phase = 0;
  let age = 0;
  let gait = 0;
  let airborne = 0;

  function animate(dt, speed, grounded) {
    const smoothing = 1 - Math.exp(-dt * 12);
    age += dt;
    phase += dt * Math.min(14, 1 + speed * 1.65);
    gait += (Math.min(speed / 5.4, 1) - gait) * smoothing;
    airborne += ((grounded ? 0 : 1) - airborne) * smoothing;

    const stride = Math.sin(phase);
    body.position.y = Math.abs(stride) * 0.043 * gait + Math.sin(age * 3) * 0.016 * (1 - gait);
    body.rotation.x = gait * -0.09;
    body.rotation.z = stride * gait * 0.053;
    head.rotation.x = gait * 0.07 + Math.sin(age * 2) * 0.022;
    cape.rotation.x = gait * 0.21 + airborne * 0.27 + Math.sin(age * 4 + phase * 0.5) * 0.055;
    cape.rotation.z = stride * gait * 0.076;

    arms.forEach(({ arm, elbow }, index) => {
      const swing = (index === 0 ? stride : -stride) * gait;
      arm.rotation.x = swing * 0.49 - airborne * 0.42;
      arm.rotation.z = (index === 0 ? -1 : 1) * (0.11 + airborne * 0.27);
      elbow.rotation.x = -0.10 - Math.max(swing, 0) * 0.39 - airborne * 0.14;
    });
    legs.forEach(({ hip, knee }, index) => {
      const swing = (index === 0 ? stride : -stride) * gait;
      hip.rotation.x = swing * (1 - airborne * 0.8) * 0.63 + airborne * (index === 0 ? -0.44 : 0.24);
      knee.rotation.x = Math.max(0, -swing) * 0.90 + airborne * (index === 0 ? 0.62 : 0.32);
    });
  }

  function reset() {
    phase = 0;
    age = 0;
    gait = 0;
    airborne = 0;
    animate(0, 0, true);
  }

  return { root, animate, reset };
}
