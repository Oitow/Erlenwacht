import * as THREE from 'three';
import { WORLD_BOUNDS, addPath, addTerrain, heightAt, pathCenter } from './terrain.js';
import { createCollision } from './collision.js';
import { buildForest, buildSettlement, createScenery } from './scenery.js';

const ENCOUNTER_LAYOUT = [
  [12, 2.4], [1, -3.6], [-11, -1.9], [-24, 3.5], [-33, -4.7],
  [-46, 2.7], [-55, -3], [-67, 3.1], [-73, -4.7], [-84, -0.5],
  [-96, 4.9], [-105, -2], [-119, 2.9], [-126, -4.1],
];

function createLanterns(scene, { add }) {
  const lanterns = [];
  function lantern(x, z, height = 2.25) {
    const y = heightAt(x, z);
    add('stone', 0x4a4f4e, x, y + 0.21, z, 0.41, 0.28, 0.41);
    add('column', 0x4b463e, x, y + height * 0.5, z, 0.23, height, 0.23);
    add('box', 0x302c29, x, y + height - 0.08, z, 0.47, 0.14, 0.47);
    add('flame', 0xffba63, x, y + height + 0.21, z, 0.28, 0.36, 0.28);
    add('cone', 0x3f3c37, x, y + height + 0.58, z, 0.43, 0.34, 0.43, Math.PI / 6);
    lanterns.push(new THREE.Vector3(x, y + height + 0.23, z));
  }

  for (let z = 35; z > -143; z -= 14) {
    const x = pathCenter(z);
    lantern(x - 4.9, z);
    lantern(x + 4.9, z);
  }
  for (const z of [-156, -171, -183, -199, -209]) {
    lantern(-6.7, z, 2.8);
    lantern(6.7, z, 2.8);
  }

  // Reuse only two lights regardless of how many lanterns are visible.
  const warmLights = [
    new THREE.PointLight(0xffa95e, 15, 14, 2),
    new THREE.PointLight(0xffa95e, 15, 14, 2),
  ];
  scene.add(...warmLights);
  let phase = 0;

  return (dt, position) => {
    phase += dt;
    let nearest = null;
    let second = null;
    let nearestDistance = Infinity;
    let secondDistance = Infinity;
    for (const lightPosition of lanterns) {
      const dx = position.x - lightPosition.x;
      const dz = position.z - lightPosition.z;
      const distance = dx * dx + dz * dz;
      if (distance < nearestDistance) {
        second = nearest;
        secondDistance = nearestDistance;
        nearest = lightPosition;
        nearestDistance = distance;
      } else if (distance < secondDistance) {
        second = lightPosition;
        secondDistance = distance;
      }
    }
    warmLights[0].position.copy(nearest);
    warmLights[1].position.copy(second);
    warmLights[0].intensity = 15 + Math.sin(phase * 3.5) * 1.2;
    warmLights[1].intensity = 15 + Math.sin(phase * 4.3 + 2) * 1.2;
  };
}

export function createWorld(scene, { seed = 813 } = {}) {
  const scenery = createScenery(scene);
  const collision = createCollision();
  const spawn = { x: 0, z: 39 };
  const gate = { x: 0, z: -147 };
  const checkpoint = { x: 0, z: -158 };
  const guide = { x: 4, z: -173 };
  const encounters = ENCOUNTER_LAYOUT.map(([z, offset], i) => ({
    x: pathCenter(z) + offset,
    z,
    archetype: i % 3 === 2 ? 'sentinel' : 'hunter',
  }));

  addTerrain(scene);
  addPath(scene);
  buildForest(scenery, collision, encounters, seed);
  buildSettlement(scenery, collision, gate, guide);
  const update = createLanterns(scene, scenery);
  scenery.assemble();
  update(0, spawn);

  function regionAt(x, z) {
    if (Math.abs(x) < 30 && z < gate.z - 2 && z > -216) return 'Enklave';
    if (z < -121) return 'Vor der Enklave';
    if (z < -65) return 'Alte Ruinen';
    return 'Dammerwald';
  }

  return {
    spawn,
    checkpoint,
    gate,
    guide,
    bounds: { ...WORLD_BOUNDS },
    encounters,
    heightAt,
    resolveMovement: collision.resolveMovement,
    regionAt,
    update,
  };
}
