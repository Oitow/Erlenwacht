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
import { openSave } from './save.js';

const MAX_HEALTH = 100;
const REWARD = 'warden-blade';
const GUIDE_RANGE = 3.4;
const GATE_RANGE = 6;
const CONTROLS = {
  spell: 'cast',
  'break-seal': 'breakSeal',
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
  const hud = createHud();
  const input = createInput({ canvas, stick: byId('stick'), nub: byId('nub') });
  const save = openSave();
  const inventory = createInventory(save.data?.inventory);
  const combat = createCombat(render.scene, world, save.data?.defeated);
  const contract = createWardenContract(save.data?.wardenContract, world.relic.id);
  combat.setEncounterActive(world.relic.id, contract.encounterActive);
  const loot = createLoot(render.scene, world, save.data?.loot);
  const defeat = byId('defeat');

  let hp = MAX_HEALTH;
  let auto = save.data?.auto === true;
  let quest = save.data?.quest === 'complete' ? 'complete'
    : save.data?.quest === 'enclave' ? 'enclave' : 'trail';
  let dirty = false;
  let saveAvailable = true;
  let damageMultiplier = 1;

  function flushSave() {
    if (!dirty) return;
    dirty = false;
    const written = save.write({
      quest, auto,
      wardenContract: contract.stage,
      inventory: inventory.serialize(),
      defeated: combat.defeatedIds(),
      loot: loot.serialize(),
    });
    if (saveAvailable && !written) {
      hud.notice('Der Browser konnte den Spielstand nicht speichern.', 6);
    }
    saveAvailable = written;
  }

  function applyHealth(amount) {
    hp = Math.max(0, Math.min(MAX_HEALTH, hp + amount));
    hud.health(hp);
  }

  function respawn() {
    const anchor = quest === 'trail' ? world.spawn : world.checkpoint;
    combat.resetEncounter(world.relic.id);
    character.reset(anchor.x, anchor.z);
    camera.reset(position);
    hp = MAX_HEALTH;
    hud.health(hp);
    input.clear();
    if (defeat.open) defeat.close();
  }

  const bag = mountInventory({
    dialog: byId('inventory'),
    inventory,
    onOpenChange: () => input.clear(),
    onUse(id) {
      if (hp === MAX_HEALTH || !inventory.use(id)) return false;
      applyHealth(ITEMS[id].heal);
      flushSave();
      return true;
    },
  });

  function inventoryChanged() {
    damageMultiplier = 1 + (ITEMS[inventory.equipped()]?.spellPower ?? 0);
    hud.slots(inventory.slots().length, INVENTORY_CAPACITY);
    dirty = true;
  }

  function onDamage(amount) {
    if (hp === 0) return;
    applyHealth(-amount);
    if (hp > 0) {
      hud.notice('Getroffen · −' + amount + ' Leben');
    } else {
      input.clear();
      defeat.showModal();
    }
  }

  function onDefeat(drop) {
    loot.add(drop);
    if (contract.defeat(drop.id)) {
      hud.notice('Reliktwächter gefallen. Kehre zur Torwache zurück.', 5);
    }
    dirty = true;
  }

  function speakToGuide() {
    if (quest !== 'complete') {
      if (!inventory.add(REWARD, 1)) {
        hud.notice('Torwache · Mach Platz für deine Belohnung.');
        return;
      }
      quest = 'complete';
      applyHealth(MAX_HEALTH);
      hud.notice('Torwache · Leg die Wächterklinge im Beutel an. Sprich mich für einen Auftrag erneut an.', 6);
      return;
    }

    if (contract.accept()) {
      combat.setEncounterActive(world.relic.id, true);
      hud.notice('Siegelbruch gelernt. Brich damit den Schild und greif mit der Rune an.', 6);
      dirty = true;
      return;
    }
    if (contract.stage === 'return') {
      if (contract.claim(inventory)) {
        applyHealth(MAX_HEALTH);
        hud.notice('Auftrag abgeschlossen · Siegelklinge erhalten.', 5);
      } else {
        hud.notice('Torwache · Mach Platz für die Siegelklinge.');
      }
      return;
    }
    hud.notice(contract.encounterActive
      ? 'Torwache · Folge dem Pfeil zurück in die Ruinen.'
      : 'Torwache · Die Ruinen sind wieder sicher.');
  }

  function interactWithWorld(drop, nearGuide) {
    if (drop) {
      const quantity = loot.collect(drop, inventory);
      hud.notice(quantity ? '+' + quantity + ' ' + ITEMS[drop.itemId].name : 'Dein Beutel ist voll.');
    } else if (nearGuide) {
      speakToGuide();
    }
  }

  function currentObjective() {
    if (quest === 'trail') return ['trail', world.gate];
    if (quest === 'enclave') return ['enclave', world.guide];
    if (contract.encounterActive) return ['hunt', world.relic];
    return [contract.stage, contract.stage === 'complete' ? null : world.guide];
  }

  function update(dt) {
    const actions = input.sample();
    if (hp === 0) {
      flushSave();
      return;
    }
    if (actions.inventory) {
      bag.toggle();
      return;
    }
    if (bag.isOpen()) {
      flushSave();
      return;
    }

    if (actions.auto) {
      auto = !auto;
      hud.auto(auto);
      dirty = true;
    }
    camera.orientMovement(actions);
    character.update(dt, actions);
    camera.update(dt, position);
    world.update(dt, position);

    if (quest === 'trail' && distance(position, world.gate) < GATE_RANGE) {
      quest = 'enclave';
      applyHealth(MAX_HEALTH);
      hud.notice('Rastpunkt erreicht · Enklave');
      dirty = true;
    }
    const nearGuide = distance(position, world.guide) < GUIDE_RANGE;
    const drop = loot.closest(position);
    if (actions.interact) interactWithWorld(drop, nearGuide);

    combat.update(dt, {
      position, cast: actions.cast, breakSeal: contract.skillUnlocked && actions.breakSeal,
      auto, damageMultiplier, onDamage, onDefeat,
    });
    loot.update(dt);
    const [objective, target] = currentObjective();
    const nextDrop = actions.interact ? loot.closest(position) : drop;
    const targetDistance = target ? distance(position, target) : 0;
    hud.update(dt, {
      region: world.regionAt(position.x, position.z),
      objective,
      targetDistance,
      bearing: target && camera.bearingTo(target.x - position.x, target.z - position.z),
      interaction: nextDrop ? ITEMS[nextDrop.itemId].name + ' aufnehmen' : nearGuide ? 'Mit Torwache sprechen' : '',
      cooldown: combat.cooldown,
      sealUnlocked: contract.skillUnlocked,
      sealCooldown: combat.sealCooldown,
      boss: combat.encounterStatus(world.relic.id, position),
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
  respawn();

  startLoop({
    update, render: render.render, onError,
    performanceSample(fps) {
      render.adapt(fps);
      hud.performance(fps);
    },
  });
}
