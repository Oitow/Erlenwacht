import * as THREE from 'three';
import { ITEMS } from '../inventory/inventory.js';

const LOOT_RANGE = 2.6;

export function createLoot(scene, world, saved) {
  const drops = [];
  const shape = new THREE.OctahedronGeometry(0.31);
  const rune = new THREE.MeshBasicMaterial({ color: 0x97dcf8 });
  const tonic = new THREE.MeshBasicMaterial({ color: 0xff956d });
  let elapsed = 0;

  function add(data) {
    if (
      !data || !Object.hasOwn(ITEMS, data.itemId) ||
      !Number.isFinite(data.x) || Math.abs(data.x) > 1000 ||
      !Number.isFinite(data.z) || Math.abs(data.z) > 1000 ||
      !Number.isSafeInteger(data.quantity) || data.quantity < 1
    ) return;
    const { x, z, itemId, quantity } = data;
    const y = world.heightAt(x, z) + 0.48;
    const mesh = new THREE.Mesh(shape, itemId === 'health-tonic' ? tonic : rune);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    drops.push({ x, y, z, itemId, quantity, mesh });
  }

  if (Array.isArray(saved)) saved.slice(0, 256).forEach(add);

  return {
    add,
    closest(position) {
      let best;
      let range = LOOT_RANGE;
      for (const drop of drops) {
        const distance = Math.hypot(drop.x - position.x, drop.z - position.z);
        if (distance < range) {
          range = distance;
          best = drop;
        }
      }
      return best;
    },
    collect(drop, inventory) {
      const received = inventory.add(drop.itemId, drop.quantity);
      drop.quantity -= received;
      if (drop.quantity === 0) {
        drops.splice(drops.indexOf(drop), 1);
        scene.remove(drop.mesh);
      }
      return received;
    },
    update(dt) {
      elapsed += dt;
      for (const drop of drops) {
        drop.mesh.rotation.y += dt * 1.6;
        drop.mesh.position.y = drop.y + Math.sin(elapsed * 2.8 + drop.z) * 0.12;
      }
    },
    serialize() {
      return drops.map(({ x, z, itemId, quantity }) => ({ x, z, itemId, quantity }));
    },
  };
}
