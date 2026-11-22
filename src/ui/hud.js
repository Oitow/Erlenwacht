const OBJECTIVES = {
  trail: 'Folge den Laternen bis zum Tor.',
  enclave: 'Sprich mit der Torwache im Innenhof.',
  offer: 'Hol dir einen Auftrag bei der Torwache.',
  hunt: 'Brich den Schild des Reliktwächters mit Siegelbruch. Greif dann mit der Rune an.',
  return: 'Melde den Sieg bei der Torwache.',
  complete: 'Der Weg durch den Dammerwald ist gesichert.',
};

export function createHud() {
  const byId = id => document.getElementById(id);
  const region = byId('region');
  const objective = byId('objective');
  const interact = byId('interact');
  const performance = byId('performance');
  const spell = byId('spell');
  const seal = byId('break-seal');
  const boss = byId('boss');
  const bossHealth = byId('boss-health');
  const bossStatus = byId('boss-status');
  const waypoint = byId('waypoint');
  const arrow = byId('waypoint-arrow');
  const range = byId('waypoint-range');
  const life = byId('life');
  const health = byId('health');
  const notice = byId('notice');
  const auto = byId('auto');
  const bagCount = byId('bag-count');
  let noticeTime = 0;
  function showCooldown(button, value) {
    const fill = Math.ceil(value * 100) + '%';
    if (button.style.getPropertyValue('--cooldown') !== fill) {
      button.style.setProperty('--cooldown', fill);
    }
  }

  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

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
      setText(region, state.region);
      setText(objective, OBJECTIVES[state.objective]);
      setText(interact, state.interaction);
      interact.hidden = !state.interaction;
      showCooldown(spell, state.cooldown);
      seal.hidden = !state.sealUnlocked;
      if (state.sealUnlocked) showCooldown(seal, state.sealCooldown);

      waypoint.hidden = state.targetDistance < 4;
      if (!waypoint.hidden) {
        const angle = Math.round(state.bearing * 180 / Math.PI / 5) * 5;
        const transform = 'rotate(' + (angle % 360) + 'deg)';
        if (arrow.style.transform !== transform) arrow.style.transform = transform;
        setText(range, Math.round(state.targetDistance) + ' m');
      }

      boss.hidden = !state.boss;
      if (state.boss) {
        if (bossHealth.max !== state.boss.max) bossHealth.max = state.boss.max;
        if (bossHealth.value !== state.boss.hp) bossHealth.value = state.boss.hp;
        setText(bossStatus, state.boss.warded ? 'Schild aktiv' : 'Verwundbar');
      }
    },
    performance(fps) {
      performance.textContent = Math.round(fps) + ' FPS';
    },
  };
}
