import * as THREE from 'three';
import { ITEMS } from '../inventory/inventory.js';

const LOOT_RANGE = 2.6;
const VISIBLE_RANGE = 42;
const STACK_RANGE = 2.1;
const TINTS = {
  'rune-shard': 0x97dcf8,
  'health-tonic': 0xff956d,
  'amber-tonic': 0xffce62,
  'bog-iron': 0xa9c59a,
  'thorn-blade': 0xe4b1ff,
  'field-tonic': 0xf39771,
  'silver-tonic': 0xcbe5f4,
};
const RARITY_TINTS = { uncommon: 0xb9df95, rare: 0xd3a5ff };

function distanceSquared(position, drop) {
  const x = drop.x - position.x;
  const z = drop.z - position.z;
  return x * x + z * z;
}

export function createLoot(scene, world, saved) {
  const drops = [];
  const crystal = new THREE.OctahedronGeometry(0.31);
  const flask = new THREE.LatheGeometry([
    [0, -0.24], [0.19, -0.24], [0.25, -0.15], [0.25, 0.1], [0.11, 0.21],
    [0.1, 0.33], [0.14, 0.33], [0.14, 0.42], [0, 0.42],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  const blade = new THREE.CylinderGeometry(0.045, 0.17, 0.9, 4);
  const armor = new THREE.IcosahedronGeometry(0.36, 0);
  const beam = new THREE.CylinderGeometry(0.03, 0.14, 1.65, 6, 1, true);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: RARITY_TINTS.rare, transparent: true, opacity: 0.3, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const materials = new Map();
  let elapsed = 0;

  function updatePileSize(drop) {
    drop.mesh.scale.setScalar(1 + 0.12 * Math.min(3, Math.log2(drop.quantity)));
  }

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
      updatePileSize(pile);
      return;
    }
    const item = ITEMS[itemId];
    const y = world.heightAt(x, z);
    let material = materials.get(itemId);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: TINTS[itemId] ?? RARITY_TINTS[item.rarity] ?? 0xf0f4cf });
      materials.set(itemId, material);
    }

    let shape = crystal;
    if (item.kind === 'consumable') shape = flask;
    else if (item.equipmentSlot === 'weapon') shape = blade;
    else if (item.equipmentSlot === 'armor') shape = armor;
    const root = new THREE.Group();
    root.position.set(x, y, z);
    const mesh = new THREE.Mesh(shape, material);
    mesh.position.y = 0.57;
    mesh.rotation.z = shape === blade ? -0.45 : 0.18;
    root.add(mesh);
    if (item.rarity === 'rare') {
      const marker = new THREE.Mesh(beam, beamMaterial);
      marker.position.y = 0.89;
      root.add(marker);
    }
    scene.add(root);
    const drop = { x, z, itemId, quantity, root, mesh };
    drops.push(drop);
    updatePileSize(drop);
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
        scene.remove(drop.root);
      } else if (received) {
        updatePileSize(drop);
      }
      return received;
    },
    update(dt, position) {
      elapsed += dt;
      for (const drop of drops) {
        drop.root.visible = !position || distanceSquared(position, drop) < VISIBLE_RANGE ** 2;
        if (!drop.root.visible) continue;
        drop.mesh.rotation.y = elapsed * 1.6;
        drop.mesh.position.y = 0.57 + Math.sin(elapsed * 2.8 + drop.z) * 0.12;
      }
    },
    serialize() {
      return drops.map(({ x, z, itemId, quantity }) => ({ x, z, itemId, quantity }));
    },
  };
}
