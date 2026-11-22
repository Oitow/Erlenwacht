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
    description: 'Verdoppelt den Fähigkeitsschaden gegenüber der Pfadklinge.',
    kind: 'equipment',
    equipmentSlot: 'weapon',
    maxStack: 1,
    glyph: '✦',
    spellPower: 1,
  }),
  'seal-blade': Object.freeze({
    id: 'seal-blade',
    name: 'Siegelklinge',
    description: 'Verdreifacht den Fähigkeitsschaden gegenüber der Pfadklinge.',
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
    description: 'Eine seltene Klinge mit höherem Fähigkeitsschaden als die Siegelklinge.',
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
  ashwood: Object.freeze({
    id: 'ashwood', name: 'Eschenholz', description: 'Zähes Holz für Griffe und Runenfoki.',
    kind: 'material', maxStack: 30, glyph: '╳',
  }),
  silverleaf: Object.freeze({
    id: 'silverleaf', name: 'Silberblatt', description: 'Heilkraut für Tränke am Lager.',
    kind: 'material', maxStack: 30, glyph: '✿',
  }),
  'iron-ore': Object.freeze({
    id: 'iron-ore', name: 'Eisenerz', description: 'Rohstoff für einfache Schutzkleidung.',
    kind: 'material', maxStack: 30, glyph: '⬢',
  }),
  'ashwood-focus': Object.freeze({
    id: 'ashwood-focus', name: 'Eschenfokus', description: '+45 % Zauberschaden gegenüber der Pfadklinge.',
    kind: 'equipment', equipmentSlot: 'weapon', maxStack: 1, glyph: '✦', spellPower: 0.45,
    rarity: 'uncommon',
  }),
  'runebound-focus': Object.freeze({
    id: 'runebound-focus', name: 'Runenfokus', description: '+125 % Zauberschaden gegenüber der Pfadklinge.',
    kind: 'equipment', equipmentSlot: 'weapon', maxStack: 1, glyph: '✶', spellPower: 1.25,
    rarity: 'rare',
  }),
  'field-tonic': Object.freeze({
    id: 'field-tonic', name: 'Feldtrank', description: 'Stellt bis zu 45 Leben wieder her.',
    kind: 'consumable', maxStack: 5, glyph: '✚', heal: 45,
    rarity: 'uncommon',
  }),
  'silver-tonic': Object.freeze({
    id: 'silver-tonic', name: 'Silberblatt-Elixier', description: 'Stellt bis zu 75 Leben wieder her.',
    kind: 'consumable', maxStack: 5, glyph: '✚', heal: 75,
    rarity: 'rare',
  }),
  'riveted-vest': Object.freeze({
    id: 'riveted-vest', name: 'Nietweste', description: '+12 maximales Leben, 7 % weniger erlittener Schaden.',
    kind: 'equipment', equipmentSlot: 'armor', maxStack: 1, glyph: '⬟', maxHealth: 12, armor: 0.07,
    rarity: 'uncommon',
  }),
  'iron-jack': Object.freeze({
    id: 'iron-jack', name: 'Eisenwams', description: '+24 maximales Leben, 14 % weniger erlittener Schaden.',
    kind: 'equipment', equipmentSlot: 'armor', maxStack: 1, glyph: '⬟', maxHealth: 24, armor: 0.14,
    rarity: 'rare',
  }),
});

function getItem(id) {
  return typeof id === 'string' && Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
}

function validQuantity(quantity) {
  return Number.isSafeInteger(quantity) && quantity > 0;
}

function insert(stacks, item, quantity) {
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

function consumeMaterial(stacks, id, quantity) {
  for (let index = stacks.length - 1; index >= 0 && quantity > 0; index--) {
    const stack = stacks[index];
    if (stack.id !== id) continue;
    const used = Math.min(quantity, stack.quantity);
    stack.quantity -= used;
    quantity -= used;
    if (stack.quantity === 0) stacks.splice(index, 1);
  }
  return quantity === 0;
}

export function createInventory(saved) {
  const stacks = [];
  const equipment = new Map();
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  function exchange(ingredients, product, preview = false) {
    const item = getItem(product?.id);
    if (!item || !validQuantity(product.quantity)) return 'unknown';
    const draft = stacks.map(stack => ({ ...stack }));
    for (const ingredient of ingredients) {
      if (getItem(ingredient?.id)?.kind !== 'material' || !validQuantity(ingredient.quantity)) return 'unknown';
      if (!consumeMaterial(draft, ingredient.id, ingredient.quantity)) return 'materials';
    }
    if (insert(draft, item, product.quantity) !== product.quantity) return 'full';
    if (!preview) {
      stacks.splice(0, stacks.length, ...draft);
      notify();
    }
    return null;
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
      if (!item || !validQuantity(stack.quantity)) continue;
      insert(stacks, item, Math.min(stack.quantity, item.maxStack));
    }
    for (const [slot, id] of Object.entries(saved.equipment ?? {})) {
      const item = getItem(id);
      if (item?.equipmentSlot === slot) equipItem(item);
    }
  } else {
    insert(stacks, ITEMS['trail-blade'], 1);
    insert(stacks, ITEMS['health-tonic'], 2);
    equipItem(ITEMS['trail-blade']);
  }

  return {
    add(id, quantity = 1) {
      const item = getItem(id);
      if (!item || !validQuantity(quantity)) return 0;
      const accepted = insert(stacks, item, quantity);
      if (accepted) notify();
      return accepted;
    },
    count,
    exchange,
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
