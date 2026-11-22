import * as THREE from 'three';
import {
  WORLD_BOUNDS, TRAIL_BRANCHES, addPath, addTerrain, expeditionBiome, heightAt, pathCenter,
} from './terrain.js';
import { createCollision } from './collision.js';
import { buildForest, buildSettlement, createScenery } from './scenery.js';
import {
  buildExpedition, buildTrailCamp, createExpeditionEncounters, EXPEDITION_BOSS, EXPEDITION_LANDMARKS,
} from './expedition.js';

const ENCOUNTER_LAYOUT = [
  [12, 2.4], [1, -3.6], [-11, -1.9], [-24, 3.5], [-33, -4.7],
  [-46, 2.7], [-55, -3], [-67, 3.1], [-73, -4.7], [-84, -0.5],
  [-96, 4.9], [-105, -2], [-119, 2.9], [-126, -4.1],
];

function createLanterns(scene, { add }) {
  const lanterns = [];
  function lantern(x, z, height = 2.25, flame = 0xffba63) {
    const y = heightAt(x, z);
    add('stone', 0x4a4f4e, x, y + 0.21, z, 0.41, 0.28, 0.41);
    add('column', 0x4b463e, x, y + height * 0.5, z, 0.23, height, 0.23);
    add('box', 0x302c29, x, y + height - 0.08, z, 0.47, 0.14, 0.47);
    add('flame', flame, x, y + height + 0.21, z, 0.28, 0.36, 0.28);
    add('cone', 0x3f3c37, x, y + height + 0.58, z, 0.43, 0.34, 0.43, Math.PI / 6);
    lanterns.push({ position: new THREE.Vector3(x, y + height + 0.23, z), color: flame });
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
  for (let z = -225; z >= -435; z -= 15) {
    lantern(pathCenter(z) + (z % 30 === 0 ? 4.8 : -4.8), z, 2.45);
  }
  const flames = [0x9ad8c7, 0xe3b1f0];
  TRAIL_BRANCHES.forEach((route, index) => {
    const side = index === 0 ? -1 : 1;
    for (let z = route.end - 8; z > route.start; z -= 12) {
      lantern(route.center(z) + side * 4.2, z, 2.12, flames[index]);
    }
  });

  // Reuse only two lights regardless of how many lanterns are visible.
  const lights = [
    new THREE.PointLight(0xffa95e, 15, 14, 2),
    new THREE.PointLight(0xffa95e, 15, 14, 2),
  ];
  scene.add(...lights);
  let phase = 0;
  let nextSearch = 0;

  return (dt, position) => {
    phase += dt;
    if (phase >= nextSearch) {
      nextSearch = phase + 0.12;
      let nearest = null;
      let second = null;
      let nearestDistance = Infinity;
      let secondDistance = Infinity;
      for (const lantern of lanterns) {
        const dx = position.x - lantern.position.x;
        const dz = position.z - lantern.position.z;
        const distance = dx * dx + dz * dz;
        if (distance < nearestDistance) {
          second = nearest;
          secondDistance = nearestDistance;
          nearest = lantern;
          nearestDistance = distance;
        } else if (distance < secondDistance) {
          second = lantern;
          secondDistance = distance;
        }
      }
      lights[0].position.copy(nearest.position);
      lights[0].color.setHex(nearest.color);
      lights[1].position.copy(second.position);
      lights[1].color.setHex(second.color);
    }
    lights[0].intensity = 15 + Math.sin(phase * 3.5) * 1.2;
    lights[1].intensity = 15 + Math.sin(phase * 4.3 + 2) * 1.2;
  };
}

export function createWorld(scene, { seed = 813 } = {}) {
  const scenery = createScenery(scene);
  const collision = createCollision();
  const spawn = { x: 0, z: 39 };
  const gate = { x: 0, z: -147 };
  const checkpoint = { x: 0, z: -158 };
  const expeditionCheckpoint = { x: pathCenter(-249), z: -249 };
  const guide = { x: 4, z: -173 };
  const relic = { id: 'relic-warden', x: pathCenter(-111) - 3.1, z: -111 };
  const trailEncounters = ENCOUNTER_LAYOUT.map(([z, offset], i) => ({
    x: pathCenter(z) + offset,
    z,
    archetype: i % 3 === 2 ? 'sentinel' : 'hunter',
  }));
  const training = { ...trailEncounters[0], id: 0 };
  trailEncounters.push({ ...relic, archetype: 'warden', optional: true });
  const expeditionBoss = { ...EXPEDITION_BOSS };
  const expeditionEncounters = [...createExpeditionEncounters(), expeditionBoss];
  const landmarks = EXPEDITION_LANDMARKS;
  const updateTerrain = addTerrain(scene);
  addPath(scene);
  buildForest(scenery, collision, trailEncounters, seed);
  buildTrailCamp(scenery, collision);
  buildSettlement(scenery, collision, gate, guide);
  buildExpedition(scene, scenery, collision, expeditionEncounters, landmarks, seed);
  for (const offset of [-2.9, 2.9]) {
    const x = relic.x - 1.1;
    const z = relic.z + offset;
    const y = heightAt(x, z);
    scenery.add('column', 0x56514e, x, y + 1.1, z, 0.55, 2.2, 0.55);
    scenery.add('flame', 0xcca8ff, x, y + 2.35, z, 0.42, 0.58, 0.42);
    collision.addCircle(x, z, 0.45);
  }
  const updateLanterns = createLanterns(scene, scenery);
  scenery.assemble();
  updateTerrain(spawn, true);
  updateLanterns(0, spawn);
  scenery.update(spawn);

  function update(dt, position) {
    updateTerrain(position);
    scenery.update(position);
    updateLanterns(dt, position);
  }

  function regionAt(x, z) {
    if (Math.abs(x) < 30 && z < gate.z - 2 && z > -216) return 'Enklave';
    if (z < -232) {
      const biome = expeditionBiome(x, z);
      if (biome === 'moor') return landmarks.moor.name;
      if (biome === 'quarry') return landmarks.quarry.name;
      if (biome === 'spire') return landmarks.spire.name;
      return 'Wachtpfad';
    }
    if (z < -121) return 'Vor der Enklave';
    if (z < -65) return 'Alte Ruinen';
    return 'Dammerwald';
  }

  return {
    spawn,
    checkpoint,
    expeditionCheckpoint,
    gate,
    guide,
    relic,
    training,
    landmarks,
    expeditionBoss,
    bounds: { ...WORLD_BOUNDS },
    encounters: [...trailEncounters, ...expeditionEncounters],
    heightAt,
    resolveMovement: collision.resolveMovement,
    regionAt,
    update,
  };
}
