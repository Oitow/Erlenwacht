const MAX_LEVEL = 20;
const MAX_RANK = 3;

const SKILLS = [
  { id: 'rune', name: 'Runenstoß', description: 'Mehr Schaden im Nahbereich.', requirement: '' },
  { id: 'arc', name: 'Dornlanze', description: 'Ein durchdringender Fernangriff. Höhere Ränge verbessern Schaden, Reichweite und Breite.', requirement: 'Ab Stufe 2' },
  { id: 'seal', name: 'Siegelbruch', description: 'Unterbricht Angriffe und hält gebrochene Schilde länger offen.', requirement: 'Auftrag der Torwache annehmen' },
];

function threshold(level) {
  return 60 + (level - 1) * 24;
}

export function createProgression(saved, legacyXp = 0) {
  const maxXp = Array.from({ length: MAX_LEVEL - 1 }, (_, index) => threshold(index + 1))
    .reduce((sum, xp) => sum + xp, 0);
  const initialXp = Number.isSafeInteger(saved?.totalXp) ? saved.totalXp : legacyXp;
  let totalXp = Math.max(0, Math.min(initialXp, maxXp));
  let level = 1;
  let xp = totalXp;

  function recalculate() {
    level = 1;
    xp = totalXp;
    while (level < MAX_LEVEL && xp >= threshold(level)) {
      xp -= threshold(level);
      level++;
    }
  }

  recalculate();
  const ranks = {};
  let spent = 0;
  for (const { id } of SKILLS) {
    const rank = saved?.ranks?.[id];
    const upgrades = Number.isInteger(rank)
      ? Math.max(0, Math.min(rank - 1, MAX_RANK - 1, level - 1 - spent))
      : 0;
    ranks[id] = 1 + upgrades;
    spent += upgrades;
  }

  function unlocked(id, hasSeal, hasClass) {
    return id === 'rune' || (id === 'arc' && (hasClass || level >= 2)) || (id === 'seal' && hasSeal);
  }

  return {
    get level() { return level; },
    get maxHealth() { return 100 + (level - 1) * 6; },
    get arcUnlocked() { return unlocked('arc'); },
    rank(id) { return ranks[id]; },
    gain(amount) {
      if (!Number.isSafeInteger(amount) || amount < 1) return false;
      const previousLevel = level;
      totalXp = Math.min(maxXp, totalXp + amount);
      recalculate();
      return level > previousLevel;
    },
    upgrade(id, hasSeal, hasClass) {
      if (!unlocked(id, hasSeal, hasClass) || ranks[id] >= MAX_RANK || spent >= level - 1) return false;
      ranks[id]++;
      spent++;
      return true;
    },
    view(hasSeal, hasClass, characterClass) {
      return {
        level, xp, nextXp: level < MAX_LEVEL ? threshold(level) : 0,
        points: level - 1 - spent,
        skills: SKILLS.map(skill => {
          const ability = skill.id === 'rune' ? characterClass?.primary
            : skill.id === 'arc' ? characterClass?.secondary : null;
          return {
            ...skill, ...ability,
            rank: ranks[skill.id], maxRank: MAX_RANK,
            requirement: skill.id === 'arc' ? 'Wähle eine Klasse oder erreiche Stufe 2.' : skill.requirement,
            unlocked: unlocked(skill.id, hasSeal, hasClass),
          };
        }),
      };
    },
    serialize() { return { totalXp, ranks: { ...ranks } }; },
  };
}
