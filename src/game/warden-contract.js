export const CONTRACT_REWARD = 'seal-blade';

const STAGES = new Set(['offer', 'hunt', 'return', 'complete']);

export function createWardenContract(savedStage, encounterId) {
  let stage = STAGES.has(savedStage) ? savedStage : 'offer';

  return {
    get stage() { return stage; },
    get skillUnlocked() { return stage !== 'offer'; },
    get encounterActive() { return stage === 'hunt'; },
    accept() {
      if (stage !== 'offer') return false;
      stage = 'hunt';
      return true;
    },
    defeat(id) {
      if (stage !== 'hunt' || id !== encounterId) return false;
      stage = 'return';
      return true;
    },
    claim(inventory) {
      if (stage !== 'return' || inventory.add(CONTRACT_REWARD, 1) !== 1) return false;
      stage = 'complete';
      return true;
    },
  };
}
