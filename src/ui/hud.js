import { mountAdventureMenu } from './adventure-menu.js';

const OBJECTIVES = {
  trail: 'Folge den Laternen bis zum Tor.',
  enclave: 'Sprich mit der Torwache im Innenhof.',
  offer: 'Hol dir einen Auftrag bei der Torwache.',
  hunt: 'Brich den Schild des Reliktwächters mit Siegelbruch. Greif dann mit der Rune an.',
  return: 'Melde den Sieg bei der Torwache.',
  complete: 'Der Weg durch den Dammerwald ist gesichert.',
};

export function createHud(callbacks = {}) {
  const byId = id => document.getElementById(id);
  const menu = mountAdventureMenu(byId, callbacks);
  const region = byId('region');
  const objective = byId('objective');
  const interact = byId('interact');
  const performance = byId('performance');
  const spell = byId('spell');
  const seal = byId('break-seal');
  const arc = byId('thorn-lance');
  const boss = byId('boss');
  const bossName = byId('boss-name');
  const bossHealth = byId('boss-health');
  const bossStatus = byId('boss-status');
  const waypoint = byId('waypoint');
  const arrow = byId('waypoint-arrow');
  const range = byId('waypoint-range');
  const destination = byId('waypoint-destination');
  const life = byId('life');
  const health = byId('health');
  const level = byId('level');
  const experience = byId('experience');
  const skillPoints = byId('skill-points');
  const skillsButton = byId('skills-button');
  const notice = byId('notice');
  const auto = byId('auto');
  const bagCount = byId('bag-count');
  let noticeTime = 0;
  function showCooldown(button, value) {
    const fill = Math.ceil(Math.max(0, Math.min(1, value ?? 0)) * 100) + '%';
    if (button.style.getPropertyValue('--cooldown') !== fill) {
      button.style.setProperty('--cooldown', fill);
    }
  }

  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  return {
    isOpen: menu.isOpen,
    handleActions: menu.handleActions,
    chat: menu.chat,
    onlineStatus: menu.onlineStatus,
    onlineCount: menu.onlineCount,
    progress(state) {
      const { level: playerLevel, xp, nextXp, points } = state;
      setText(level, 'Stufe ' + playerLevel);
      setText(skillPoints, points + ' FP');
      skillPoints.hidden = points === 0;
      skillsButton.setAttribute('aria-label', 'Fähigkeiten · Stufe ' + playerLevel + ' · ' + points + ' freie Punkte');
      experience.max = Math.max(1, nextXp);
      experience.value = nextXp > 0 ? xp : experience.max;
      experience.setAttribute('aria-label', nextXp > 0 ? 'Erfahrung zur nächsten Stufe' : 'Höchststufe erreicht');
      menu.progress(state);
    },
    health(value, max = health.max) {
      if (health.max !== max) {
        health.max = max;
        health.low = Math.round(max * 0.3);
        health.optimum = max;
      }
      health.value = value;
      setText(life, Math.ceil(value) + ' / ' + max);
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
      menu.auto(active);
    },
    update(dt, state) {
      if (noticeTime > 0) {
        noticeTime -= dt;
        if (noticeTime <= 0) notice.textContent = '';
      }
      setText(region, state.region);
      setText(objective, state.objectiveText ?? OBJECTIVES[state.objective] ?? '');
      setText(interact, state.interaction);
      interact.hidden = !state.interaction;
      showCooldown(spell, state.cooldown);
      seal.hidden = !state.sealUnlocked;
      if (state.sealUnlocked) showCooldown(seal, state.sealCooldown);
      arc.hidden = !state.arcUnlocked;
      if (state.arcUnlocked) showCooldown(arc, state.arcCooldown);

      waypoint.hidden = !(state.targetDistance >= 4);
      if (!waypoint.hidden) {
        const angle = Math.round(state.bearing * 180 / Math.PI / 5) * 5;
        const transform = 'rotate(' + (angle % 360) + 'deg)';
        if (arrow.style.transform !== transform) arrow.style.transform = transform;
        destination.hidden = !state.targetName;
        setText(destination, state.targetName ?? '');
        setText(range, Math.round(state.targetDistance) + ' m');
      }

      boss.hidden = !state.boss;
      if (state.boss) {
        const name = state.boss.name ?? 'Reliktwächter';
        const label = 'Leben · ' + name;
        setText(bossName, name);
        if (bossHealth.getAttribute('aria-label') !== label) bossHealth.setAttribute('aria-label', label);
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
