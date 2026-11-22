import { ITEMS } from '../inventory/inventory.js';

const PROFESSIONS = {
  wood: { name: 'Holzhandwerk', material: 'ashwood' },
  herb: { name: 'Kräuterkunde', material: 'silverleaf' },
  ore: { name: 'Schmiedekunst', material: 'iron-ore' },
};

const RANK_XP = [0, 24, 76, 160, 280];
const DEFAULT_YIELD = 2;
const DEFAULT_RESPAWN_MS = 35_000;

const RECIPES = [
  { id: 'ashwood-focus', profession: 'wood', rank: 1, quantity: 1, ingredients: [{ id: 'ashwood', quantity: 2 }] },
  { id: 'runebound-focus', profession: 'wood', rank: 2, quantity: 1, ingredients: [{ id: 'ashwood', quantity: 3 }, { id: 'rune-shard', quantity: 2 }] },
  { id: 'field-tonic', profession: 'herb', rank: 1, quantity: 2, ingredients: [{ id: 'silverleaf', quantity: 2 }] },
  { id: 'silver-tonic', profession: 'herb', rank: 2, quantity: 2, ingredients: [{ id: 'silverleaf', quantity: 3 }, { id: 'rune-shard', quantity: 1 }] },
  { id: 'riveted-vest', profession: 'ore', rank: 1, quantity: 1, ingredients: [{ id: 'iron-ore', quantity: 2 }] },
  { id: 'iron-jack', profession: 'ore', rank: 2, quantity: 1, ingredients: [{ id: 'iron-ore', quantity: 3 }, { id: 'ashwood', quantity: 1 }] },
];

const BY_ID = new Map(RECIPES.map(recipe => [recipe.id, recipe]));

function rankFor(xp) {
  return RANK_XP.findLastIndex(threshold => threshold <= xp) + 1;
}

function professionFor(kind) {
  return kind === 'herbs' ? 'herb' : kind;
}

function limit(value, min, max, fallback) {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function createProfessions(saved, inventory, nodes = [], now = Date.now) {
  const xp = Object.fromEntries(Object.keys(PROFESSIONS).map(id => [id,
    limit(saved?.xp?.[id] ?? (id === 'herb' ? saved?.xp?.herbs : undefined), 0, RANK_XP.at(-1), 0),
  ]));
  const resources = new Map();
  const startedAt = now();

  for (const node of nodes) {
    const id = node?.id;
    const profession = professionFor(node?.kind);
    if (typeof id !== 'string' || !id || !Object.hasOwn(PROFESSIONS, profession)) continue;
    const respawnMs = limit(node.respawnMs, 1000, 300_000, DEFAULT_RESPAWN_MS);
    const restored = saved?.readyAt?.[id];
    const readyAt = Number.isSafeInteger(restored) ? Math.min(restored, startedAt + respawnMs) : 0;
    resources.set(id, {
      profession,
      itemId: PROFESSIONS[profession].material,
      quantity: limit(node.quantity, 1, 30, DEFAULT_YIELD),
      respawnMs,
      readyAt,
    });
  }

  function award(profession, itemId, quantity, amount) {
    const previousRank = rankFor(xp[profession]);
    xp[profession] = Math.min(RANK_XP.at(-1), xp[profession] + amount);
    const rank = rankFor(xp[profession]);
    return { ok: true, profession, itemId, quantity, rank, rankUp: rank > previousRank };
  }

  function recipeGate(recipe) {
    if (rankFor(xp[recipe.profession]) < recipe.rank) return 'locked';
    if (ITEMS[recipe.id].kind === 'equipment' && inventory.count(recipe.id)) return 'owned';
    return null;
  }

  function view() {
    return {
      professions: Object.entries(PROFESSIONS).map(([id, definition]) => {
        const rank = rankFor(xp[id]);
        const floor = RANK_XP[rank - 1];
        return { id, name: definition.name, rank, xp: xp[id] - floor, nextXp: (RANK_XP[rank] ?? floor) - floor };
      }),
      recipes: RECIPES.map(recipe => {
        const { id, profession, rank, quantity } = recipe;
        const item = ITEMS[id];
        const reason = recipeGate(recipe) ?? inventory.exchange(recipe.ingredients, recipe, true);
        return {
          id, name: item.name, description: item.description, itemId: id, rarity: item.rarity,
          profession, rank, quantity, available: reason === null, reason,
          ingredients: recipe.ingredients.map(({ id, quantity }) => ({
            id, name: ITEMS[id].name, required: quantity, owned: inventory.count(id),
          })),
        };
      }),
    };
  }

  return {
    available(id) {
      const resource = resources.get(id);
      return Boolean(resource && resource.readyAt <= now());
    },
    remaining(id) {
      return Math.max(0, (resources.get(id)?.readyAt ?? 0) - now());
    },
    gather(id) {
      const resource = resources.get(id);
      if (!resource) return { ok: false, reason: 'unknown' };
      const time = now();
      if (resource.readyAt > time) return { ok: false, reason: 'depleted' };
      const { itemId, quantity, respawnMs, profession } = resource;
      const reason = inventory.exchange([], { id: itemId, quantity });
      if (reason) return { ok: false, reason };
      resource.readyAt = time + respawnMs;
      return award(profession, itemId, quantity, 11);
    },
    craft(id) {
      const recipe = BY_ID.get(id);
      if (!recipe) return { ok: false, reason: 'unknown' };
      const reason = recipeGate(recipe) ?? inventory.exchange(recipe.ingredients, recipe);
      if (reason) return { ok: false, reason };
      return award(recipe.profession, id, recipe.quantity, recipe.rank === 1 ? 15 : 24);
    },
    view,
    serialize() {
      const time = now();
      return {
        xp: { ...xp },
        readyAt: Object.fromEntries(Array.from(resources).filter(([, node]) => node.readyAt > time)
          .map(([id, node]) => [id, node.readyAt])),
      };
    },
  };
}
