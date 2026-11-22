const STAGES = new Set(['offer', 'scout', 'boss', 'return', 'complete']);
const DISCOVERY_RANGE_SQUARED = 20 ** 2;

export function createExpedition(saved, world) {
  const { crossroads, moor, quarry } = world.landmarks;
  let stage = STAGES.has(saved?.stage) ? saved.stage : 'offer';
  let moorVisited = saved?.moorVisited === true;
  let quarryVisited = saved?.quarryVisited === true;
  let atCrossroads = saved?.atCrossroads === true;

  function closeTo(position, landmark) {
    const dx = position.x - landmark.x;
    const dz = position.z - landmark.z;
    return dx * dx + dz * dz < DISCOVERY_RANGE_SQUARED;
  }

  return {
    get stage() { return stage; },
    get encounterActive() { return stage === 'boss'; },
    get checkpoint() { return atCrossroads ? world.expeditionCheckpoint : null; },
    get target() {
      if (stage === 'scout') {
        if (!atCrossroads) return crossroads;
        return moorVisited ? quarry : moor;
      }
      if (stage === 'boss') return world.expeditionBoss;
      if (stage === 'return' || stage === 'offer') return world.guide;
      return null;
    },
    get objective() {
      if (stage === 'scout') {
        if (!atCrossroads) return 'Verlasse die Enklave am Nordtor und finde den Wachtstein.';
        if (!moorVisited && !quarryVisited) return 'Erkunde das Schwarze Moor und den Mondbruch.';
        return moorVisited ? 'Erkunde den Mondbruch.' : 'Erkunde das Schwarze Moor.';
      }
      if (stage === 'boss') return 'Bezwinge den Hüter an der Krähenwarte.';
      if (stage === 'return') return 'Melde den Sieg bei der Torwache.';
      if (stage === 'complete') return 'Die Nordmark ist offen. Erkunde ihre Pfade und sammle Ausrüstung.';
      return 'Sprich mit der Torwache über die Nordmark.';
    },
    accept() {
      if (stage !== 'offer') return false;
      stage = 'scout';
      return true;
    },
    scout(position) {
      if (stage !== 'scout') return null;
      if (!atCrossroads && closeTo(position, crossroads)) {
        atCrossroads = true;
        return crossroads.name;
      }
      if (!moorVisited && closeTo(position, moor)) {
        moorVisited = true;
        if (quarryVisited) stage = 'boss';
        return moor.name;
      }
      if (!quarryVisited && closeTo(position, quarry)) {
        quarryVisited = true;
        if (moorVisited) stage = 'boss';
        return quarry.name;
      }
      if (moorVisited && quarryVisited) {
        stage = 'boss';
        return 'Krähenwarte';
      }
      return null;
    },
    defeat(id) {
      if (stage !== 'boss' || id !== world.expeditionBoss.id) return false;
      stage = 'return';
      return true;
    },
    claim(inventory) {
      if (stage !== 'return' || !inventory.add('watch-amulet')) return false;
      stage = 'complete';
      return true;
    },
    serialize() { return { stage, moorVisited, quarryVisited, atCrossroads }; },
  };
}
