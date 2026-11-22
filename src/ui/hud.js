const OBJECTIVES = {
  trail: 'Folge den Laternen bis zum Tor.',
  enclave: 'Sprich mit der Torwache im Innenhof.',
  complete: 'Der Dammerwald ist bezwungen. Erkunde die Enklave.',
};

export function createHud() {
  const byId = id => document.getElementById(id);
  const region = byId('region');
  const objective = byId('objective');
  const interact = byId('interact');
  const performance = byId('performance');
  const spell = byId('spell');
  const life = byId('life');
  const health = byId('health');
  const notice = byId('notice');
  const auto = byId('auto');
  const bagCount = byId('bag-count');
  let noticeTime = 0;
  let shownCooldown = -1;

  return {
    health(value) {
      health.value = value;
      life.textContent = Math.ceil(value) + ' / ' + health.max;
    },
    slots(filled, capacity) {
      bagCount.textContent = filled + '/' + capacity;
    },
    notice(message, seconds = 3.4) {
      notice.textContent = message;
      noticeTime = seconds;
    },
    auto(active) {
      auto.setAttribute('aria-pressed', String(active));
    },
    update(dt, state) {
      if (noticeTime > 0) {
        noticeTime -= dt;
        if (noticeTime <= 0) notice.textContent = '';
      }
      if (region.textContent !== state.region) region.textContent = state.region;
      if (objective.textContent !== OBJECTIVES[state.quest]) objective.textContent = OBJECTIVES[state.quest];
      if (interact.textContent !== state.interaction) interact.textContent = state.interaction;
      interact.hidden = !state.interaction;
      const cooldown = Math.round(state.cooldown * 100);
      if (shownCooldown !== cooldown) {
        shownCooldown = cooldown;
        spell.style.setProperty('--cooldown', cooldown + '%');
      }
    },
    performance(fps) {
      performance.textContent = Math.round(fps) + ' FPS';
    },
  };
}
