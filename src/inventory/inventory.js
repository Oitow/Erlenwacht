export const INVENTORY_CAPACITY = 12;

export const ITEMS = Object.freeze({
  'rune-shard': Object.freeze({
    id: 'rune-shard',
    name: 'Runensplitter',
    description: 'Ein Bruchstück der Waldmagie.',
    kind: 'material',
    maxStack: 25,
    glyph: '◆',
  }),
  'health-tonic': Object.freeze({
    id: 'health-tonic',
    name: 'Heiltrank',
    description: 'Stellt bis zu 35 Leben wieder her.',
    kind: 'consumable',
    maxStack: 5,
    glyph: '✚',
    heal: 35,
  }),
  'trail-blade': Object.freeze({
    id: 'trail-blade',
    name: 'Pfadklinge',
    description: 'Die abgenutzte Klinge der Waldläufer.',
    kind: 'equipment',
    equipmentSlot: 'weapon',
    maxStack: 1,
    glyph: '╱',
    spellPower: 0,
  }),
  'warden-blade': Object.freeze({
    id: 'warden-blade',
    name: 'Wächterklinge',
    description: '+1 Schaden für den Runenstoß.',
    kind: 'equipment',
    equipmentSlot: 'weapon',
    maxStack: 1,
    glyph: '✦',
    spellPower: 1,
  }),
  'seal-blade': Object.freeze({
    id: 'seal-blade',
    name: 'Siegelklinge',
    description: '+2 Schaden für den Runenstoß.',
    kind: 'equipment',
    equipmentSlot: 'weapon',
    maxStack: 1,
    glyph: '✦',
    spellPower: 2,
    rarity: 'rare',
  }),
  'amber-tonic': Object.freeze({
    id: 'amber-tonic',
    name: 'Bernsteintrank',
    description: 'Stellt bis zu 60 Leben wieder her.',
    kind: 'consumable',
    maxStack: 5,
    glyph: '✚',
    heal: 60,
    rarity: 'uncommon',
  }),
  'bog-iron': Object.freeze({
    id: 'bog-iron',
    name: 'Mooreisen',
    description: 'Ein verhärtetes Erzstück aus der Nordmark.',
    kind: 'material',
    maxStack: 25,
    glyph: '⬢',
    rarity: 'uncommon',
  }),
  'thorn-blade': Object.freeze({
    id: 'thorn-blade',
    name: 'Dornklinge',
    description: 'Verstärkt Runenstoß und Dornlanze.',
    kind: 'equipment',
    equipmentSlot: 'weapon',
    maxStack: 1,
    glyph: '✦',
    spellPower: 2.35,
    rarity: 'rare',
  }),
  'watch-amulet': Object.freeze({
    id: 'watch-amulet',
    name: 'Amulett der Krähenwarte',
    description: '+24 maximales Leben.',
    kind: 'equipment',
    equipmentSlot: 'amulet',
    maxStack: 1,
    glyph: '◈',
    maxHealth: 24,
    rarity: 'rare',
  }),
});

function getItem(id) {
  return typeof id === 'string' && Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
}

export function createInventory(saved) {
  const stacks = [];
  const equipment = new Map();
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  function insert(item, quantity) {
    let remainder = quantity;
    for (const stack of stacks) {
      if (stack.id !== item.id) continue;
      const moved = Math.min(item.maxStack - stack.quantity, remainder);
      stack.quantity += moved;
      remainder -= moved;
      if (remainder === 0) return quantity;
    }
    while (remainder > 0 && stacks.length < INVENTORY_CAPACITY) {
      const moved = Math.min(item.maxStack, remainder);
      stacks.push({ id: item.id, quantity: moved });
      remainder -= moved;
    }
    return quantity - remainder;
  }

  function count(id) {
    return stacks.reduce((quantity, stack) => quantity + (stack.id === id ? stack.quantity : 0), 0);
  }

  function equipItem(item) {
    if (item?.kind !== 'equipment' || !count(item.id)) return false;
    equipment.set(item.equipmentSlot, item.id);
    return true;
  }

  if (Array.isArray(saved?.slots)) {
    for (const stack of saved.slots) {
      const item = getItem(stack?.id);
      if (!item || !Number.isSafeInteger(stack.quantity) || stack.quantity < 1) continue;
      insert(item, Math.min(stack.quantity, item.maxStack));
    }
    for (const [slot, id] of Object.entries(saved.equipment ?? {})) {
      const item = getItem(id);
      if (item?.equipmentSlot === slot) equipItem(item);
    }
  } else {
    insert(ITEMS['trail-blade'], 1);
    insert(ITEMS['health-tonic'], 2);
    equipItem(ITEMS['trail-blade']);
  }

  return {
    add(id, quantity = 1) {
      const item = getItem(id);
      if (!item || !Number.isSafeInteger(quantity) || quantity < 1) return 0;
      const accepted = insert(item, quantity);
      if (accepted) notify();
      return accepted;
    },
    count,
    use(id) {
      if (getItem(id)?.kind !== 'consumable') return false;
      const index = stacks.findIndex(stack => stack.id === id);
      if (index < 0) return false;
      if (--stacks[index].quantity === 0) stacks.splice(index, 1);
      notify();
      return true;
    },
    discard(index) {
      const stack = stacks[index];
      if (!stack || (equipment.get(ITEMS[stack.id].equipmentSlot) === stack.id && count(stack.id) === stack.quantity)) {
        return false;
      }
      stacks.splice(index, 1);
      notify();
      return true;
    },
    equip(id) {
      const item = getItem(id);
      if (!item || equipment.get(item.equipmentSlot) === id || !equipItem(item)) return false;
      notify();
      return true;
    },
    equipped(slot = 'weapon') {
      return equipment.get(slot) ?? null;
    },
    serialize() {
      return {
        slots: stacks.map(stack => ({ ...stack })),
        equipment: Object.fromEntries(equipment),
      };
    },
    slots() {
      const shownEquipment = new Set();
      return stacks.map(stack => {
        const item = ITEMS[stack.id];
        const equipped = equipment.get(item.equipmentSlot) === item.id && !shownEquipment.has(item.id);
        if (equipped) shownEquipment.add(item.id);
        return { item, quantity: stack.quantity, equipped };
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
