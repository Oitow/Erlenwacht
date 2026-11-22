const STEPS = ['class', 'gather', 'craft', 'wayfire', 'fight', 'loot', 'gate', 'done'];

export function createStarterJourney(saved, { reachedEnclave, completedFight }) {
  let stage = STEPS.includes(saved?.starterStage) ? saved.starterStage : 'class';
  if (reachedEnclave) stage = 'done';
  else if (!saved?.starterStage && saved?.tutorial === 'path') stage = 'gate';
  else if (!saved?.starterStage && (completedFight || saved?.tutorial === 'loot')) stage = 'loot';
  else if (!saved?.starterStage && saved?.tutorial === 'fight') stage = 'fight';

  return {
    get stage() { return stage; },
    get label() {
      return stage === 'done' ? '' : 'Tutorial · ' + (STEPS.indexOf(stage) + 1) + '/' + (STEPS.length - 1);
    },
    advance(next) {
      const index = STEPS.indexOf(next);
      if (index <= STEPS.indexOf(stage)) return false;
      stage = next;
      return true;
    },
  };
}
