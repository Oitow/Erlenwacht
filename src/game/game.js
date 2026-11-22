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
import { CLASSES, DEFAULT_CLASS_ID, getClass } from './classes.js';
import { createProfessions } from './professions.js';
import { createStarterJourney } from './starter-journey.js';
import { createWayfires } from './wayfires.js';
import { openSave } from './save.js';

const GUIDE_RANGE = 3.4;
const GATE_RANGE = 6;
const WORKBENCH_RANGE = 4.5;
const CLASS_RANGE = 7;
const RESOURCE_RANGE = 3;
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
  const starter = world.starter;
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

  let auto = save.data?.auto === true;
  let quest = save.data?.quest === 'complete' ? 'complete'
    : save.data?.quest === 'enclave' ? 'enclave' : 'trail';
  const journey = createStarterJourney(save.data, { reachedEnclave: quest !== 'trail', completedFight: legacyKills > 0 });
  const wayfires = createWayfires(world, save.data?.wayfires, {
    reachedEnclave: quest !== 'trail', reachedCrossroads: Boolean(expedition.checkpoint),
  });
  const professions = createProfessions(save.data?.professions, inventory, starter.nodes);
  const explored = new Set(Array.isArray(save.data?.explored)
    ? starter.landmarks.filter(landmark => save.data.explored.includes(landmark.id)).map(landmark => landmark.id)
    : []);
  const legacy = Boolean(save.data && !save.data.starterStage);
  let selectedClass = CLASSES.find(entry => entry.id === save.data?.classId)?.id ?? (legacy ? DEFAULT_CLASS_ID : null);
  let restId = wayfires.arrival(save.data?.restId) ? save.data.restId : null;
  let characterClass = getClass(selectedClass);
  let hp = progression.maxHealth + characterClass.maxHealthBonus;
  let dirty = false;
  let saveAvailable = true;
  let damageMultiplier = 1;
  let healthBonus = 0;
  let armor = 0;
  let panelProximity = '';
  let nextResourceRefresh = 0;
  let tutorialLoot = null;

  const hud = createHud({
    onOpenChange: () => input.clear(),
    onUpgrade(id) {
      if (!progression.upgrade(id, contract.skillUnlocked, Boolean(selectedClass))) return false;
      const state = updateProgression();
      report(state.skills.find(skill => skill.id === id).name + ' verbessert.');
      dirty = true;
      flushSave();
      return true;
    },
    onChat: sendChat,
    onBag: () => bag.toggle(),
    onToggleAuto: toggleAuto,
    onClass: chooseClass,
    onCraft: craft,
    onTravel: travelTo,
  });

  function flushSave() {
    if (!dirty) return;
    dirty = false;
    const written = save.write({
      quest, auto, classId: selectedClass,
      starterStage: journey.stage, wayfires: wayfires.serialize(), restId, explored: [...explored],
      professions: professions.serialize(),
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

  function maxHealth() {
    return progression.maxHealth + characterClass.maxHealthBonus + healthBonus;
  }

  function applyHealth(amount) {
    const limit = maxHealth();
    hp = Math.max(0, Math.min(limit, hp + amount));
    hud.health(hp, limit);
  }

  function updateProgression() {
    const state = progression.view(contract.skillUnlocked, Boolean(selectedClass), characterClass);
    hud.progress(state);
    return state;
  }

  function gainXp(amount) {
    if (progression.gain(amount)) {
      if (hp > 0) applyHealth(Infinity);
      report('Stufe ' + progression.level + ' erreicht. Im Fähigkeitenmenü kannst du einen Punkt vergeben.', 'System', 6);
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

  function canChooseClass() {
    return distance(position, starter.camp) < CLASS_RANGE
      || (quest !== 'trail' && distance(position, world.guide) < CLASS_RANGE);
  }

  function atWorkbench() {
    return distance(position, starter.workbench) < WORKBENCH_RANGE;
  }

  function refreshPanels() {
    const canChange = canChooseClass();
    hud.classes({
      selected: selectedClass, choices: CLASSES, canChange,
      reason: canChange ? '' : 'Wechsle deine Klasse im Glutlager oder bei der Torwache.',
    });
    hud.professions({ ...professions.view(), atWorkbench: atWorkbench() });
    hud.travel(wayfires.view(position));
  }

  function advanceTutorial(next) {
    if (journey.advance(next)) dirty = true;
  }

  function chooseClass(id) {
    const next = CLASSES.find(entry => entry.id === id);
    if (!next || !canChooseClass() || id === selectedClass) return false;
    selectedClass = id;
    characterClass = next;
    character.setClass(id);
    applyHealth(Infinity);
    advanceTutorial('gather');
    dirty = true;
    refreshPanels();
    updateProgression();
    report(next.name + ' gewählt. ' + next.primary.name + ' und ' + next.secondary.name + ' sind bereit.');
    flushSave();
    return true;
  }

  function craft(id) {
    if (!atWorkbench()) return false;
    const result = professions.craft(id);
    if (!result.ok) return false;
    const firstCraft = journey.stage === 'craft' || journey.stage === 'gather';
    if (firstCraft) {
      advanceTutorial('wayfire');
      gainXp(18);
    }
    report('Hergestellt: ' + ITEMS[result.itemId].name + (result.rankUp ? ' · Berufsaufstieg!' : ''));
    refreshPanels();
    dirty = true;
    flushSave();
    return true;
  }

  function moveTo(anchor) {
    character.reset(anchor.x, anchor.z);
    camera.reset(position);
    world.update(0, position);
    input.clear();
  }

  function travelTo(id) {
    const destination = wayfires.select(id, position);
    if (!destination) return false;
    moveTo(destination.arrival);
    restId = id;
    refreshPanels();
    report('Ankunft · ' + destination.name);
    dirty = true;
    flushSave();
    return true;
  }

  function updateStarter(dt) {
    if (world.setNodeAvailable) {
      nextResourceRefresh -= dt;
      if (nextResourceRefresh <= 0) {
        nextResourceRefresh = 1;
        for (const node of starter.nodes) world.setNodeAvailable(node.id, professions.available(node.id));
      }
    }
    if (position.z < starter.trail.z) return;
    for (const landmark of starter.landmarks) {
      if (landmark.id === 'glutlager' || landmark.id === 'wegfeuer' || explored.has(landmark.id)
        || distance(position, landmark) > 9) continue;
      explored.add(landmark.id);
      gainXp(12);
      report('Entdeckt · ' + landmark.name + ' · +12 EP');
    }
  }

  function respawn() {
    const initial = legacy && quest === 'trail' ? starter.trail : world.spawn;
    const anchor = wayfires.arrival(restId)
      ?? (quest === 'trail' ? initial : expedition.checkpoint ?? world.checkpoint);
    combat.resetEncounter(world.relic.id);
    combat.resetEncounter(world.expeditionBoss.id);
    moveTo(anchor);
    applyHealth(Infinity);
    if (defeat.open) defeat.close();
    refreshPanels();
  }

  const bag = mountInventory({
    dialog: byId('inventory'),
    inventory,
    onOpenChange: () => input.clear(),
    onUse(id) {
      if (hp === maxHealth() || !inventory.use(id)) return false;
      applyHealth(ITEMS[id].heal);
      flushSave();
      return true;
    },
  });

  function inventoryChanged() {
    const weapon = inventory.equipped();
    const bodyArmor = ITEMS[inventory.equipped('armor')];
    damageMultiplier = 1 + (ITEMS[weapon]?.spellPower ?? 0);
    healthBonus = (ITEMS[inventory.equipped('amulet')]?.maxHealth ?? 0) + (bodyArmor?.maxHealth ?? 0);
    armor = bodyArmor?.armor ?? 0;
    character.setWeapon(weapon, WEAPON_TINTS[weapon]);
    applyHealth(0);
    hud.slots(inventory.slots().length, INVENTORY_CAPACITY);
    dirty = true;
  }

  function onDamage(amount) {
    if (hp === 0) return;
    amount = Math.max(1, Math.round(amount * (1 - armor)));
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
    if (quest === 'trail' && journey.stage === 'fight') {
      tutorialLoot = { x: drop.x, z: drop.z, name: ITEMS[drop.itemId].name };
      advanceTutorial('loot');
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
      report('Siegelbruch gelernt. Öffne damit den Schild des Reliktwächters und setz mit deinem Angriff nach.', 'Torwache', 6);
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

  function interactionAt(wayfire) {
    const drop = loot.closest(position);
    if (drop) return { kind: 'loot', drop, label: ITEMS[drop.itemId].name
      + (drop.quantity > 1 ? ' ×' + drop.quantity : '') + ' aufnehmen' };
    if (quest !== 'trail' && distance(position, world.guide) < GUIDE_RANGE) {
      return { kind: 'guide', label: 'Mit Torwache sprechen' };
    }
    if (atWorkbench()) return { kind: 'professions', label: 'Werkbank benutzen' };
    if (journey.stage === 'class' && canChooseClass()) return { kind: 'classes', label: 'Klasse wählen' };
    const node = starter.nodes.find(candidate => distance(position, candidate) < RESOURCE_RANGE
      && professions.available(candidate.id));
    if (node) return { kind: 'gather', node, label: node.name + ' sammeln' };
    if (wayfire) return { kind: 'travel', label: wayfire.name + ' · Reisen' };
    return null;
  }

  function interactWithWorld(interaction) {
    if (!interaction) return;
    if (interaction.kind === 'loot') {
      const quantity = loot.collect(interaction.drop, inventory);
      if (!quantity) {
        hud.notice('Dein Beutel ist voll.');
        return;
      }
      if (journey.stage === 'loot') {
        tutorialLoot = null;
        advanceTutorial('gate');
      }
      report('+' + quantity + ' ' + ITEMS[interaction.drop.itemId].name);
      return;
    }
    if (interaction.kind === 'gather') {
      const result = professions.gather(interaction.node.id);
      if (result.ok) {
        if (journey.stage === 'gather') advanceTutorial('craft');
        world.setNodeAvailable?.(interaction.node.id, false);
        refreshPanels();
        report('+' + result.quantity + ' ' + ITEMS[result.itemId].name + (result.rankUp ? ' · Berufsaufstieg!' : ''));
      } else if (result.reason === 'full') {
        hud.notice('Dein Beutel ist voll.');
      }
      return;
    }
    if (interaction.kind === 'guide') {
      speakToGuide();
      return;
    }
    refreshPanels();
    hud.openPage(interaction.kind);
  }

  function currentObjective() {
    if (quest === 'trail') {
      switch (journey.stage) {
        case 'class':
          return ['Wähle im Glutlager deine Klasse. Jede bringt zwei eigene Fähigkeiten mit.', starter.camp];
        case 'gather': {
          const node = starter.nodes.find(candidate => professions.available(candidate.id));
          return ['Sammle Holz, Kräuter oder Erz an einem markierten Vorkommen.', node ?? starter.workbench];
        }
        case 'craft':
          return ['Kehre zur Werkbank zurück. Stelle aus deinem Fund ein erstes Ausrüstungsteil oder einen Trank her.', starter.workbench];
        case 'wayfire':
          return ['Steige zum Wegfeuer ab. Entdeckte Feuer verbinden die Regionen per Schnellreise.', starter.beacon];
        case 'fight':
          return ['Folge den Laternen zum ersten Schattenwesen. Setze deine Klassenfähigkeiten ein.', world.training];
        case 'loot':
          return ['Sammle einen leuchtenden Fund ein. Folge danach den Laternen zur Enklave.', tutorialLoot ?? world.training];
        default:
          return ['Folge den Laternen bis zum Tor der Enklave.', world.gate];
      }
    }
    if (quest === 'enclave') return ['Sprich mit der Torwache im Innenhof.', world.guide];
    if (contract.encounterActive) {
      return ['Brich den Schild des Reliktwächters mit Siegelbruch. Setze danach deine Angriffe ein.', world.relic];
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
    updateStarter(dt);

    if (quest === 'trail' && distance(position, world.gate) < GATE_RANGE) {
      quest = 'enclave';
      advanceTutorial('done');
      wayfires.discover('enclave');
      restId = 'enclave';
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
    const wayfire = wayfires.nearby(position);
    if (wayfire) {
      if (wayfires.discover(wayfire.id)) report('Wegfeuer entdeckt · ' + wayfire.name);
      if (restId !== wayfire.id) {
        restId = wayfire.id;
        dirty = true;
      }
      if (wayfire.id === 'pass' && journey.stage === 'wayfire') advanceTutorial('fight');
    }
    if (quest === 'trail' && position.z <= starter.trail.z) advanceTutorial('fight');
    const proximity = Number(canChooseClass()) + ':' + Number(atWorkbench()) + ':' + (wayfire?.id ?? '');
    if (proximity !== panelProximity) {
      panelProximity = proximity;
      refreshPanels();
    }
    const interaction = interactionAt(wayfire);
    if (actions.interact) interactWithWorld(interaction);

    combat.update(dt, {
      position, cast: actions.cast, breakSeal: contract.skillUnlocked && actions.breakSeal,
      facing: character.facing, classId: characterClass.id,
      arc: (selectedClass || progression.arcUnlocked) && actions.arc,
      burstRank: progression.rank('rune'), arcRank: progression.rank('arc'), sealRank: progression.rank('seal'),
      auto, damageMultiplier: damageMultiplier * (1 + (progression.level - 1) * 0.035),
      onDamage, onDefeat, onCast: character.playCast,
    });
    loot.update(dt, position);
    const [objectiveText, target] = currentObjective();
    const nextInteraction = actions.interact ? interactionAt(wayfire) : interaction;
    const relic = combat.encounterStatus(world.relic.id, position);
    const watchkeeper = combat.encounterStatus(world.expeditionBoss.id, position);
    hud.update(dt, {
      region: world.regionAt(position.x, position.z),
      objectiveText,
      tutorial: journey.label && { label: journey.label },
      targetName: target?.name,
      targetDistance: target ? distance(position, target) : 0,
      bearing: target && camera.bearingTo(target.x - position.x, target.z - position.z),
      interaction: nextInteraction?.label ?? '',
      cooldown: combat.cooldown,
      sealUnlocked: contract.skillUnlocked,
      sealCooldown: combat.sealCooldown,
      arcUnlocked: Boolean(selectedClass) || progression.arcUnlocked,
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
  character.setClass(characterClass.id);
  inventoryChanged();
  dirty = false;
  hud.auto(auto);
  updateProgression();
  hud.chat('System', 'Willkommen am Aschenpass. Tippe /hilfe für Spielbefehle.');
  respawn();

  startLoop({
    update, render: render.render, onError,
    performanceSample(fps) {
      render.adapt(fps);
      hud.performance(fps);
    },
  });
}
