import { createRenderer } from '../engine/render.js';
import { startLoop } from '../engine/loop.js';
import { createWorld } from '../world/world.js';
import { createCharacter } from '../character/character.js';
import { createInput } from '../character/input.js';
import { createCamera } from '../character/camera.js';
import { createCombat } from '../combat/combat.js';
import { createInventory, INVENTORY_CAPACITY, ITEMS } from '../inventory/inventory.js';
import { mountInventory } from '../inventory/view.js';
import { createHud } from '../ui/hud.js';
import { createLoot } from './loot.js';
import { createWardenContract } from './warden-contract.js';
import { createProgression } from './progression.js';
import { createExpedition } from './expedition.js';
import { openSave } from './save.js';

const GUIDE_RANGE = 3.4;
const GATE_RANGE = 6;
const WEAPON_TINTS = { 'warden-blade': 0xe3c08a, 'seal-blade': 0xbda2ef, 'thorn-blade': 0x8fcb93 };
const CONTROLS = {
  spell: 'cast',
  'break-seal': 'breakSeal',
  'thorn-lance': 'arc',
  jump: 'jump',
  auto: 'auto',
  interact: 'interact',
  bag: 'inventory',
};

function distance(position, anchor) {
  return Math.hypot(position.x - anchor.x, position.z - anchor.z);
}

export function startGame({ onError }) {
  const byId = id => document.getElementById(id);
  const canvas = byId('viewport');
  const render = createRenderer(canvas);
  const world = createWorld(render.scene);
  const character = createCharacter(render.scene, world);
  const { position } = character;
  const camera = createCamera(render.camera, world);
  const input = createInput({ canvas, stick: byId('stick'), nub: byId('nub') });
  const save = openSave();
  const inventory = createInventory(save.data?.inventory);
  const combat = createCombat(render.scene, world, save.data?.defeated);
  const contract = createWardenContract(save.data?.wardenContract, world.relic.id);
  const expedition = createExpedition(save.data?.expedition, world);
  combat.setEncounterActive(world.relic.id, contract.encounterActive);
  combat.setEncounterActive(world.expeditionBoss.id, expedition.encounterActive);
  const loot = createLoot(render.scene, world, save.data?.loot);
  const defeat = byId('defeat');
  const legacyKills = Array.isArray(save.data?.defeated)
    ? new Set(save.data.defeated.filter(id => Number.isInteger(id) && id >= 0 && id < 14)).size
    : 0;
  const progression = createProgression(save.data?.progression, legacyKills * 22);

  let hp = progression.maxHealth;
  let auto = save.data?.auto === true;
  let quest = save.data?.quest === 'complete' ? 'complete'
    : save.data?.quest === 'enclave' ? 'enclave' : 'trail';
  let tutorial = save.data?.tutorial === 'path' ? 'path'
    : save.data?.tutorial === 'loot' || legacyKills > 0 ? 'loot' : 'fight';
  let dirty = false;
  let saveAvailable = true;
  let damageMultiplier = 1;
  let healthBonus = 0;

  const hud = createHud({
    onOpenChange: () => input.clear(),
    onUpgrade(id) {
      if (!progression.upgrade(id, contract.skillUnlocked)) return false;
      const state = updateProgression();
      report(state.skills.find(skill => skill.id === id).name + ' verbessert.');
      dirty = true;
      flushSave();
      return true;
    },
    onChat: sendChat,
    onBag: () => bag.toggle(),
    onToggleAuto: toggleAuto,
  });

  function flushSave() {
    if (!dirty) return;
    dirty = false;
    const written = save.write({
      quest, tutorial, auto,
      wardenContract: contract.stage,
      expedition: expedition.serialize(),
      progression: progression.serialize(),
      inventory: inventory.serialize(),
      defeated: combat.defeatedIds(),
      loot: loot.serialize(),
    });
    if (saveAvailable && !written) hud.notice('Der Browser konnte den Spielstand nicht speichern.', 6);
    saveAvailable = written;
  }

  function report(message, author = 'System', seconds = 4) {
    hud.notice(message, seconds);
    hud.chat(author, message, author === 'System' ? 'system' : 'npc');
  }

  function applyHealth(amount) {
    const maxHealth = progression.maxHealth + healthBonus;
    hp = Math.max(0, Math.min(maxHealth, hp + amount));
    hud.health(hp, maxHealth);
  }

  function updateProgression() {
    const state = progression.view(contract.skillUnlocked);
    hud.progress(state);
    return state;
  }

  function gainXp(amount) {
    if (progression.gain(amount)) {
      if (hp > 0) applyHealth(Infinity);
      report('Stufe ' + progression.level + ' erreicht. Im Fähigkeitenmenü kannst du einen Punkt vergeben.' +
        (progression.level === 2 ? ' Dornlanze gelernt.' : ''), 'System', 6);
    }
    updateProgression();
    dirty = true;
  }

  function toggleAuto() {
    auto = !auto;
    hud.auto(auto);
    dirty = true;
    flushSave();
  }

  function respawn() {
    const anchor = quest === 'trail' ? world.spawn : expedition.checkpoint ?? world.checkpoint;
    combat.resetEncounter(world.relic.id);
    combat.resetEncounter(world.expeditionBoss.id);
    character.reset(anchor.x, anchor.z);
    camera.reset(position);
    applyHealth(Infinity);
    input.clear();
    if (defeat.open) defeat.close();
  }

  const bag = mountInventory({
    dialog: byId('inventory'),
    inventory,
    onOpenChange: () => input.clear(),
    onUse(id) {
      if (hp === progression.maxHealth + healthBonus || !inventory.use(id)) return false;
      applyHealth(ITEMS[id].heal);
      flushSave();
      return true;
    },
  });

  function inventoryChanged() {
    const weapon = inventory.equipped();
    damageMultiplier = 1 + (ITEMS[weapon]?.spellPower ?? 0);
    healthBonus = ITEMS[inventory.equipped('amulet')]?.maxHealth ?? 0;
    character.setWeapon(weapon, WEAPON_TINTS[weapon]);
    applyHealth(0);
    hud.slots(inventory.slots().length, INVENTORY_CAPACITY);
    dirty = true;
  }

  function onDamage(amount) {
    if (hp === 0) return;
    applyHealth(-amount);
    character.playHit();
    if (hp > 0) {
      hud.notice('Getroffen · −' + amount + ' Leben');
    } else {
      input.clear();
      defeat.showModal();
    }
  }

  function onDefeat(drop) {
    loot.add(drop);
    for (const bonus of drop.bonusDrops ?? []) loot.add(bonus);
    if (quest === 'trail' && tutorial === 'fight') {
      tutorial = 'loot';
      report('Erster Gegner besiegt. Geh zum leuchtenden Fundstück und sammle es ein.');
    }
    gainXp(drop.xp);
    if (contract.defeat(drop.id)) {
      report('Reliktwächter gefallen. Kehre zur Torwache zurück.');
    }
    if (expedition.defeat(drop.id)) {
      report('Der Hüter der Krähenwarte ist gefallen. Melde dich bei der Torwache.');
    }
    dirty = true;
  }

  function speakToGuide() {
    if (quest === 'trail') return;
    if (quest === 'enclave') {
      if (!inventory.add('warden-blade')) {
        report('Mach Platz für deine Wächterklinge.', 'Torwache');
        return;
      }
      quest = 'complete';
      applyHealth(Infinity);
      gainXp(40);
      report('Leg die Wächterklinge im Beutel an. Sprich mich für deinen ersten Auftrag erneut an.', 'Torwache', 6);
      return;
    }
    if (contract.accept()) {
      combat.setEncounterActive(world.relic.id, true);
      updateProgression();
      report('Siegelbruch gelernt. Brich damit den Schild des Reliktwächters und greif mit der Rune an.', 'Torwache', 6);
      dirty = true;
      return;
    }
    if (contract.stage === 'return') {
      if (contract.claim(inventory)) {
        applyHealth(Infinity);
        gainXp(80);
        report('Gut gekämpft. Die Siegelklinge gehört dir. Sprich mich erneut auf die Nordmark an.', 'Torwache', 6);
      } else {
        report('Mach Platz für die Siegelklinge.', 'Torwache');
      }
      return;
    }
    if (contract.encounterActive) {
      report('Folge dem Pfeil zurück in die Ruinen.', 'Torwache');
      return;
    }
    if (expedition.accept()) {
      report('Nimm das Nordtor. Der Wachtstein liegt an der Kreuzung zum Moor und zum Steinbruch.', 'Torwache', 6);
      dirty = true;
    } else if (expedition.stage === 'return') {
      if (expedition.claim(inventory)) {
        gainXp(180);
        report('Das Amulett der Krähenwarte gehört dir. Leg es im Beutel an.', 'Torwache', 6);
      } else {
        report('Mach Platz für das Amulett der Krähenwarte.', 'Torwache');
      }
    } else {
      report(expedition.objective, 'Torwache');
    }
  }

  function interactWithWorld(drop, nearGuide) {
    if (drop) {
      const quantity = loot.collect(drop, inventory);
      if (quantity) {
        if (quest === 'trail' && tutorial === 'loot') tutorial = 'path';
        report('+' + quantity + ' ' + ITEMS[drop.itemId].name);
      } else {
        hud.notice('Dein Beutel ist voll.');
      }
    } else if (nearGuide) {
      speakToGuide();
    }
  }

  function currentObjective() {
    if (quest === 'trail') {
      if (tutorial === 'fight') {
        return ['Laufe zum Lager und triff einen Gegner aus der Nähe mit der Rune.', world.training];
      }
      if (tutorial === 'loot') {
        return ['Sammle leuchtende Beute ein oder folge den Laternen weiter zur Enklave.', world.gate];
      }
      return ['Folge den Laternen bis zum Tor. Der Beutel enthält deine Beute und Heiltränke.', world.gate];
    }
    if (quest === 'enclave') return ['Sprich mit der Torwache im Innenhof.', world.guide];
    if (contract.encounterActive) {
      return ['Brich den Schild des Reliktwächters mit Siegelbruch. Greif dann mit der Rune an.', world.relic];
    }
    if (contract.stage === 'return') return ['Melde den Sieg bei der Torwache.', world.guide];
    if (contract.stage === 'offer') return ['Hol dir einen Auftrag bei der Torwache.', world.guide];
    return [expedition.objective, expedition.target];
  }

  function sendChat(text) {
    const message = text.trim();
    if (!message) return;
    hud.chat('Du', message, 'local');
    switch (message.toLowerCase()) {
      case '/hilfe':
        hud.chat('System', '/quest · aktives Ziel | /ort · aktuelles Gebiet | /wache · Hinweis der Torwache');
        break;
      case '/quest':
        hud.chat('System', currentObjective()[0]);
        break;
      case '/ort':
        hud.chat('System', world.regionAt(position.x, position.z));
        break;
      case '/wache':
        hud.chat('Torwache', currentObjective()[0], 'npc');
        break;
      default:
        if (message.startsWith('/')) hud.chat('System', 'Unbekannter Befehl. Zeige mit /hilfe die Befehle an.');
        break;
    }
  }

  function update(dt) {
    const actions = input.sample();
    if (hp === 0) {
      flushSave();
      return;
    }
    if (bag.isOpen()) {
      if (actions.inventory) bag.close();
      flushSave();
      return;
    }
    if (hud.handleActions(actions) || hud.isOpen()) {
      flushSave();
      return;
    }
    if (actions.inventory) {
      bag.toggle();
      flushSave();
      return;
    }
    if (actions.auto) toggleAuto();
    camera.orientMovement(actions);
    character.update(dt, actions);
    camera.update(dt, position);
    world.update(dt, position);

    if (quest === 'trail' && distance(position, world.gate) < GATE_RANGE) {
      quest = 'enclave';
      applyHealth(Infinity);
      report('Rastpunkt erreicht · Enklave');
      dirty = true;
    }
    const discovery = expedition.scout(position);
    if (discovery) {
      combat.setEncounterActive(world.expeditionBoss.id, expedition.encounterActive);
      gainXp(28);
      report(discovery === world.landmarks.crossroads.name ? 'Rastpunkt erreicht · ' + discovery : discovery + ' entdeckt.');
    }
    const nearGuide = quest !== 'trail' && distance(position, world.guide) < GUIDE_RANGE;
    const drop = loot.closest(position);
    if (actions.interact) interactWithWorld(drop, nearGuide);

    combat.update(dt, {
      position, cast: actions.cast, breakSeal: contract.skillUnlocked && actions.breakSeal,
      arc: progression.arcUnlocked && actions.arc,
      burstRank: progression.rank('rune'), arcRank: progression.rank('arc'), sealRank: progression.rank('seal'),
      auto, damageMultiplier: damageMultiplier * (1 + (progression.level - 1) * 0.035),
      onDamage, onDefeat, onCast: character.playCast,
    });
    loot.update(dt, position);
    const [objectiveText, target] = currentObjective();
    const nextDrop = actions.interact ? loot.closest(position) : drop;
    const relic = combat.encounterStatus(world.relic.id, position);
    const watchkeeper = combat.encounterStatus(world.expeditionBoss.id, position);
    hud.update(dt, {
      region: world.regionAt(position.x, position.z),
      objectiveText,
      targetName: target?.name,
      targetDistance: target ? distance(position, target) : 0,
      bearing: target && camera.bearingTo(target.x - position.x, target.z - position.z),
      interaction: nextDrop ? ITEMS[nextDrop.itemId].name + ' aufnehmen' : nearGuide ? 'Mit Torwache sprechen' : '',
      cooldown: combat.cooldown,
      sealUnlocked: contract.skillUnlocked,
      sealCooldown: combat.sealCooldown,
      arcUnlocked: progression.arcUnlocked,
      arcCooldown: combat.arcCooldown,
      boss: relic ? { ...relic, name: 'Reliktwächter' }
        : watchkeeper && { ...watchkeeper, name: 'Hüter der Krähenwarte' },
    });
    flushSave();
  }

  for (const [id, action] of Object.entries(CONTROLS)) {
    byId(id).addEventListener('click', event => {
      input.trigger(action);
      if (event.detail && action !== 'inventory') event.currentTarget.blur();
    });
  }
  byId('respawn').addEventListener('click', respawn);
  defeat.addEventListener('cancel', event => event.preventDefault());
  window.addEventListener('pagehide', flushSave);
  inventory.subscribe(inventoryChanged);
  inventoryChanged();
  dirty = false;
  hud.auto(auto);
  updateProgression();
  hud.chat('System', 'Erlenwacht · Lokaler Chat. Tippe /hilfe für die Befehle.');
  respawn();

  startLoop({
    update, render: render.render, onError,
    performanceSample(fps) {
      render.adapt(fps);
      hud.performance(fps);
    },
  });
}
