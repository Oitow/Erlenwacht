import { WORLD_SIZE } from './generation.js';

export const RESOURCES = {
  log: { item: 'wood', name: 'Totholz' },
  rock: { item: 'stone', name: 'Stein' },
  crystal: { item: 'crystal', name: 'Mondkristall' },
  flower: { item: 'flower', name: 'Wildblume' },
  mushroom: { item: 'mushroom', name: 'Waldpilz' },
};

const ITEMS = { wood: 'Holz', stone: 'Stein', crystal: 'Mondkristall', flower: 'Wildblume', mushroom: 'Waldpilz' };
const COST = { wood: 3, stone: 2 };
const RESOURCE_LIMIT = 10_000;
const ENTRY = 'erlenwacht.world-lab.v1';

function safeRead(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* playable with storage disabled */ }
}

export function createJourney(model, stream, scenery) {
  const key = ENTRY + '.' + model.seed;
  const saved = safeRead(key);
  const siteIds = new Set(model.landmarks.map(site => site.id));
  const found = new Set(Array.isArray(saved?.found) ? saved.found.filter(id => siteIds.has(id)) : []);
  const stock = Object.fromEntries(Object.keys(ITEMS).map(id => [
    id,
    Number.isSafeInteger(saved?.stock?.[id]) ? Math.max(0, saved.stock[id]) : 0,
  ]));
  const taken = new Set(Array.isArray(saved?.taken)
    ? saved.taken.filter(id => typeof id === 'string' && id.length < 96).slice(-RESOURCE_LIMIT)
    : []);
  const half = WORLD_SIZE / 2 - 1;
  const point = saved?.beacon;
  let beacon = point && Number.isFinite(point.x) && Number.isFinite(point.z)
      && Math.abs(point.x) <= half && Math.abs(point.z) <= half && !model.isWet(point.x, point.z)
    ? { x: point.x, z: point.z } : null;
  for (const id of taken) stream.removeResource(id);
  scenery.setBeacon(beacon);

  function save() {
    safeWrite(key, { stock, found: [...found], taken: [...taken].slice(-RESOURCE_LIMIT), beacon });
  }

  function gather(resource) {
    if (!resource || taken.has(resource.id) || !RESOURCES[resource.kind]) return false;
    const { item } = RESOURCES[resource.kind];
    taken.add(resource.id);
    stock[item]++;
    stream.removeResource(resource.id);
    save();
    return true;
  }

  function discover(site) {
    if (!site || found.has(site.id)) return false;
    found.add(site.id);
    save();
    return true;
  }

  function canBuild() {
    return stock.wood >= COST.wood && stock.stone >= COST.stone;
  }

  function build(position) {
    const ground = model.heightAt(position.x, position.z);
    if (!canBuild() || model.isWet(position.x, position.z) || Math.abs(position.y - ground) > 2) return false;
    stock.wood -= COST.wood;
    stock.stone -= COST.stone;
    beacon = { x: position.x, z: position.z };
    scenery.setBeacon(beacon);
    save();
    return true;
  }

  return {
    stock,
    found,
    gather,
    discover,
    canBuild,
    build,
    get beacon() { return beacon; },
    get items() { return Object.entries(ITEMS).map(([id, name]) => [name, stock[id]]); },
  };
}

export function readPreferences() {
  return safeRead(ENTRY + '.preferences');
}

export function writePreferences(preferences) {
  safeWrite(ENTRY + '.preferences', preferences);
}
