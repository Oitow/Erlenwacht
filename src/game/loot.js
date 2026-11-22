import * as THREE from 'three';
import { ITEMS } from '../inventory/inventory.js';

const LOOT_RANGE = 2.6;
const VISIBLE_RANGE = 42;
const STACK_RANGE = 1.2;
const TINTS = {
  'rune-shard': 0x97dcf8,
  'health-tonic': 0xff956d,
  'amber-tonic': 0xffce62,
  'bog-iron': 0xa9c59a,
  'thorn-blade': 0xe4b1ff,
};

function distanceSquared(position, drop) {
  const x = drop.x - position.x;
  const z = drop.z - position.z;
  return x * x + z * z;
}

export function createLoot(scene, world, saved) {
  const drops = [];
  const shape = new THREE.OctahedronGeometry(0.31);
  const materials = new Map();
  let elapsed = 0;

  function add(data) {
    if (
      !data || !Object.hasOwn(ITEMS, data.itemId) ||
      !Number.isFinite(data.x) || Math.abs(data.x) > 1000 ||
      !Number.isFinite(data.z) || Math.abs(data.z) > 1000 ||
      !Number.isSafeInteger(data.quantity) || data.quantity < 1
    ) return;
    const { x, z, itemId, quantity } = data;
    const pile = drops.find(drop => drop.itemId === itemId && distanceSquared(drop, data) < STACK_RANGE ** 2);
    if (pile && Number.isSafeInteger(pile.quantity + quantity)) {
      pile.quantity += quantity;
      return;
    }
    const y = world.heightAt(x, z) + 0.48;
    let material = materials.get(itemId);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: TINTS[itemId] ?? 0xf0f4cf });
      materials.set(itemId, material);
    }
    const mesh = new THREE.Mesh(shape, material);
    if (ITEMS[itemId].kind === 'equipment') mesh.scale.set(1.05, 1.7, 1.05);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    drops.push({ x, y, z, itemId, quantity, mesh });
  }

  if (Array.isArray(saved)) saved.slice(0, 256).forEach(add);

  return {
    add,
    closest(position) {
      let best;
      let range = LOOT_RANGE * LOOT_RANGE;
      for (const drop of drops) {
        const distance = distanceSquared(position, drop);
        if (distance < range) {
          range = distance;
          best = drop;
        }
      }
      return best;
    },
    collect(drop, inventory) {
      const index = drops.indexOf(drop);
      if (index < 0) return 0;
      const received = inventory.add(drop.itemId, drop.quantity);
      drop.quantity -= received;
      if (drop.quantity === 0) {
        drops.splice(index, 1);
        scene.remove(drop.mesh);
      }
      return received;
    },
    update(dt, position) {
      elapsed += dt;
      for (const drop of drops) {
        drop.mesh.visible = !position || distanceSquared(position, drop) < VISIBLE_RANGE ** 2;
        if (!drop.mesh.visible) continue;
        drop.mesh.rotation.y = elapsed * 1.6;
        drop.mesh.position.y = drop.y + Math.sin(elapsed * 2.8 + drop.z) * 0.12;
      }
    },
    serialize() {
      return drops.map(({ x, z, itemId, quantity }) => ({ x, z, itemId, quantity }));
    },
  };
}
