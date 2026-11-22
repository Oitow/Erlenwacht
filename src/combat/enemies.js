export const ARCHETYPES = Object.freeze({
  hunter: {
    hp: 2, speed: 3.35, radius: 0.51, aggro: 11, leash: 18, reach: 2.15,
    windup: 0.64, recovery: 0.78, damage: 10, tint: 0xf18848, xp: 22,
  },
  sentinel: {
    hp: 3, speed: 2.25, radius: 0.70, aggro: 10, leash: 15, reach: 3.15,
    windup: 0.96, recovery: 1.25, damage: 17, tint: 0xe06657, xp: 32,
  },
  spitter: {
    hp: 4, speed: 2.4, radius: 0.6, aggro: 16, leash: 22, reach: 12,
    windup: 0.90, recovery: 1.45, damage: 15, tint: 0xb5e670, xp: 36,
    attack: 'targeted', impactRadius: 2.7,
  },
  brute: {
    hp: 7, speed: 2.6, radius: 0.93, aggro: 13, leash: 19, reach: 5.35,
    windup: 1.15, recovery: 1.35, damage: 24, tint: 0xffa366, xp: 48,
    attack: 'slam', impactRadius: 4.1,
  },
  warden: {
    hp: 14, speed: 3, radius: 0.9, aggro: 13, leash: 17, reach: 4.5,
    windup: 1.05, recovery: 0.95, damage: 29, tint: 0xd97bff, xp: 100, warded: true,
  },
});

export function encounterStats(archetype, tier) {
  const stats = ARCHETYPES[archetype];
  if (tier === 1) return stats;
  const extra = tier - 1;
  return {
    ...stats,
    hp: Math.round(stats.hp * (1 + 0.6 * extra)),
    damage: Math.round(stats.damage * (1 + 0.2 * extra)),
    xp: Math.round(stats.xp * (1 + 0.3 * extra)),
  };
}

function rewardRoll(id, killCount) {
  const key = String(id);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ killCount, 2246822507);
  return ((hash ^ (hash >>> 13)) >>> 0) % 100;
}

export function encounterReward(enemy) {
  const { id, archetype, tier, stats, killCount, object: { position: { x, z } } } = enemy;
  const roll = rewardRoll(id, killCount);
  const bonusDrops = [];
  if (tier >= 2) {
    const itemId = (enemy.optional && archetype === 'brute') || roll < 7
      ? 'thorn-blade'
      : roll < 27 ? 'amber-tonic' : 'bog-iron';
    bonusDrops.push({ x: x + 0.7, z, itemId, quantity: itemId === 'bog-iron' && tier >= 3 ? 2 : 1 });
  }
  const itemId = tier === 1 && !stats.warded && (typeof id === 'number' ? id % 5 === 4 : roll < 20)
    ? 'health-tonic' : 'rune-shard';
  return { id, x, z, itemId, quantity: stats.warded ? 3 : tier, archetype, xp: stats.xp, bonusDrops };
}
