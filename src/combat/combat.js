import * as THREE from 'three';
import { ARCHETYPES, encounterReward, encounterStats } from './enemies.js';
import { RUNIC_BURST, SEAL_BREAK, THORN_LANCE } from './skills.js';
import { createEnemyModels, createGroundEffect, createLanceEffect } from './visuals.js';
import { getClass } from '../game/classes.js';

const CELL_SIZE = 28;
const CELL_RADIUS = 3;
const VIEW_RADIUS = 55;
const HURT_COOLDOWN = 0.35;
const LEGACY_PRIMARY = { ...RUNIC_BURST, shape: 'circle', power: 1 };
const LEGACY_SECONDARY = { ...THORN_LANCE, shape: 'line', interrupt: true };

function withinRange(target, position, radius) {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  return dx * dx + dz * dz <= radius * radius;
}

function cell(value) {
  return Math.floor(value / CELL_SIZE);
}

function key(x, z) {
  return x + ':' + z;
}

function rankBonus(rank) {
  return Number.isFinite(rank) ? Math.min(2, Math.max(0, Math.floor(rank) - 1)) : 0;
}

export function createCombat(scene, world, defeatedIds = []) {
  const group = new THREE.Group();
  scene.add(group);
  const makeModel = createEnemyModels();
  const primarySlot = makeAbilitySlot();
  const secondarySlot = makeAbilitySlot();
  const seal = createGroundEffect(group, world, SEAL_BREAK.tint, true);
  const impactCenter = { x: 0, z: 0 };
  const markPool = [];
  const secureZ = world.gate.z + 5;
  const expeditionBoundary = world.expeditionBoundary ?? -232;
  const byId = new Map();
  const cells = new Map();

  world.encounters.forEach((anchor, index) => {
    const { x, z, id = index, optional = false } = anchor;
    const expedition = anchor.zone === 'expedition';
    if (expedition ? z > expeditionBoundary : z < secureZ) return;
    const archetype = Object.hasOwn(ARCHETYPES, anchor.archetype)
      ? anchor.archetype
      : index % 3 === 2 ? 'sentinel' : 'hunter';
    const tier = Number.isInteger(anchor.tier) ? Math.min(4, Math.max(1, anchor.tier)) : 1;
    const stats = encounterStats(archetype, tier);
    const enemy = {
      id, index, x, z, archetype, tier, stats, optional, expedition, enabled: !optional,
      respawnDelay: expedition && !optional && anchor.respawn > 0
        ? Math.max(10, anchor.respawn) : 0,
      object: null, model: null, mark: null, state: 'idle',
      strike: { x, z, radius: stats.reach },
      timer: 0, flash: 0, hp: stats.hp, phase: index * 1.7,
      wardOpening: 0, slowed: 0, respawnAt: 0, killCount: 0,
    };
    byId.set(id, enemy);
    const cellKey = key(cell(x), cell(z));
    const bucket = cells.get(cellKey);
    if (bucket) bucket.push(enemy);
    else cells.set(cellKey, [enemy]);
  });

  const initialDefeats = Array.isArray(defeatedIds)
    ? defeatedIds.filter(id => byId.has(id) && !byId.get(id).respawnDelay)
    : [];
  const defeated = new Set();
  let nearby = new Set();
  let previousCell = '';
  let clock = 0;
  let kills = 0;
  let activeClass;
  let sealCooldown = 0;
  let damageCooldown = 0;
  let guard = 0;
  let sealElapsed = SEAL_BREAK.duration;

  function makeAbilitySlot() {
    return { ground: null, lane: null, active: null, remaining: 0, cycle: 1, elapsed: 0, duration: 0 };
  }

  function resetAbilitySlot(slot) {
    slot.active?.hide();
    slot.active = null;
    slot.remaining = 0;
  }

  function tickAbilitySlot(slot, dt) {
    slot.remaining = Math.max(0, slot.remaining - dt);
    if (!slot.active) return;
    slot.elapsed = advanceEffect(slot.active, slot.elapsed, dt, slot.duration);
    if (slot.elapsed === slot.duration) slot.active = null;
  }

  function isActive(enemy) {
    return enemy?.enabled && !enemy.respawnAt && !defeated.has(enemy.id);
  }

  function inCombatArea(enemy, position) {
    return enemy.expedition ? position.z <= expeditionBoundary : position.z >= secureZ;
  }

  function isWarded(enemy) {
    return enemy.stats.warded && enemy.wardOpening === 0;
  }

  function hideMark(enemy) {
    if (!enemy.mark) return;
    enemy.mark.hide();
    markPool.push(enemy.mark);
    enemy.mark = null;
  }

  function resetEnemy(enemy) {
    hideMark(enemy);
    enemy.hp = enemy.stats.hp;
    enemy.state = 'idle';
    enemy.timer = enemy.flash = enemy.wardOpening = enemy.slowed = 0;
    enemy.phase = enemy.index * 1.7;
    if (!enemy.object) return;
    enemy.object.position.set(enemy.x, world.heightAt(enemy.x, enemy.z), enemy.z);
    enemy.object.rotation.y = 0;
    enemy.object.visible = false;
    enemy.model.animate(enemy.phase, 0, 0, false, enemy.stats.warded);
  }

  function materialize(enemy) {
    if (enemy.object) return;
    enemy.object = new THREE.Group();
    enemy.model = makeModel(enemy.archetype, enemy.object, enemy.optional);
    group.add(enemy.object);
    resetEnemy(enemy);
  }

  function refreshNearby(position) {
    const centerX = cell(position.x);
    const centerZ = cell(position.z);
    const current = key(centerX, centerZ);
    if (current === previousCell) return;
    previousCell = current;
    const next = new Set();
    for (let z = centerZ - CELL_RADIUS; z <= centerZ + CELL_RADIUS; z++) {
      for (let x = centerX - CELL_RADIUS; x <= centerX + CELL_RADIUS; x++) {
        const bucket = cells.get(key(x, z));
        if (bucket) for (const enemy of bucket) next.add(enemy);
      }
    }
    for (const enemy of nearby) {
      if (enemy.object && !next.has(enemy)) resetEnemy(enemy);
    }
    nearby = next;
  }

  function reset() {
    defeated.clear();
    for (const id of initialDefeats) defeated.add(id);
    kills = defeated.size;
    clock = sealCooldown = damageCooldown = guard = 0;
    sealElapsed = SEAL_BREAK.duration;
    resetAbilitySlot(primarySlot);
    resetAbilitySlot(secondarySlot);
    seal.hide();
    for (const enemy of byId.values()) {
      enemy.respawnAt = enemy.killCount = 0;
      resetEnemy(enemy);
    }
  }

  function setEncounterActive(id, enabled) {
    const enemy = byId.get(id);
    if (!enemy?.optional || enemy.enabled === enabled) return;
    enemy.enabled = enabled;
    resetEnemy(enemy);
  }

  function resetEncounter(id) {
    const enemy = byId.get(id);
    if (isActive(enemy)) resetEnemy(enemy);
  }

  function stepTowards(enemy, dx, dz, distance, dt) {
    if (distance <= 0.001) return;
    const { position } = enemy.object;
    const speed = enemy.stats.speed * (enemy.slowed > 0 ? 0.52 : 1);
    const step = Math.min(distance, speed * dt);
    const targetX = position.x + dx / distance * step;
    const nextZ = position.z + dz / distance * step;
    const targetZ = enemy.expedition ? Math.min(expeditionBoundary, nextZ) : Math.max(secureZ, nextZ);
    const next = world.resolveMovement(position.x, position.z, targetX, targetZ, enemy.stats.radius);
    position.set(next.x, world.heightAt(next.x, next.z), next.z);
  }

  function enemyInRange(enemy, position, radius) {
    return isActive(enemy) && enemy.object && inCombatArea(enemy, position)
      && withinRange(enemy.object.position, position, radius);
  }

  function hurtEnemy(enemy, damage, onDefeat) {
    if (isWarded(enemy)) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.flash = 0.15;
    if (enemy.hp > 0) return;
    if (enemy.respawnDelay) enemy.respawnAt = clock + enemy.respawnDelay;
    else defeated.add(enemy.id);
    enemy.object.visible = false;
    hideMark(enemy);
    const reward = encounterReward(enemy);
    kills++;
    enemy.killCount++;
    onDefeat(reward);
  }

  function interrupt(enemy) {
    if (enemy.state !== 'windup') return;
    enemy.state = 'recover';
    enemy.timer = enemy.stats.recovery;
    hideMark(enemy);
  }

  function startSealBreak(position, rank) {
    sealCooldown = SEAL_BREAK.cooldown;
    sealElapsed = 0;
    const radius = SEAL_BREAK.radius + rank * 0.45;
    seal.show(position.x, position.z, radius);
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, radius)) continue;
      enemy.wardOpening = SEAL_BREAK.wardOpening + rank * 0.6;
      enemy.flash = 0.15;
      interrupt(enemy);
    }
  }

  function findAimTarget(position, facing, range) {
    let selected;
    let aimScore = Infinity;
    const facingLength = Math.hypot(facing?.x ?? 0, facing?.z ?? 0);
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, range) || isWarded(enemy)) continue;
      const target = enemy.object.position;
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      const alignment = facingLength > 0.001 && distance > 0.05
        ? (dx * facing.x + dz * facing.z) / (distance * facingLength) : 1;
      if (alignment < 0.33) continue;
      const score = distance + (1 - alignment) * 5;
      if (score < aimScore) {
        aimScore = score;
        selected = target;
      }
    }
    return selected;
  }

  function applyHit(enemy, ability, power, rank, onDefeat) {
    if (isWarded(enemy)) return;
    if (ability.interrupt) interrupt(enemy);
    if (ability.slow) enemy.slowed = Math.max(enemy.slowed, ability.slow + rank * 0.24);
    hurtEnemy(enemy, power, onDefeat);
  }

  function useAbility(slot, ability, position, facing, damageMultiplier, rank, onDefeat) {
    const primary = slot === primarySlot;
    const radius = (ability.radius ?? 0) + rank * 0.45;
    const range = (ability.range ?? 0) + rank * 0.8;
    const width = (ability.width ?? 0) + rank * 0.12;
    const angle = ability.angle ? ability.angle + rank * 0.045 : 0;
    const power = damageMultiplier * (ability.power + rank * (primary ? 0.35 : 0.55));
    const target = ability.shape === 'circle' ? undefined : findAimTarget(position, facing, range);
    const dx = target ? target.x - position.x : facing?.x ?? 0;
    const dz = target ? target.z - position.z : facing?.z ?? -1;
    const length = Math.hypot(dx, dz);
    const aimX = length > 0.001 ? dx / length : 0;
    const aimZ = length > 0.001 ? dz / length : -1;

    slot.cycle = ability.cooldown - (primary ? 0 : rank * 0.35);
    slot.remaining = slot.cycle;
    slot.duration = ability.duration;
    slot.elapsed = 0;
    slot.active?.hide();
    if (ability.guard) guard = ability.guard + rank * 0.24;

    if (ability.shape === 'circle' || ability.shape === 'target') {
      const centerDistance = ability.shape === 'target' ? range * 0.64 : 0;
      impactCenter.x = target?.x ?? position.x + aimX * centerDistance;
      impactCenter.z = target?.z ?? position.z + aimZ * centerDistance;
      slot.ground ??= createGroundEffect(group, world, ability.tint, true);
      slot.active = slot.ground;
      slot.active.setTint(ability.tint);
      slot.active.show(impactCenter.x, impactCenter.z, radius);
      for (const enemy of nearby) {
        if (!enemyInRange(enemy, position, range + radius)
            || !withinRange(enemy.object.position, impactCenter, radius)) continue;
        applyHit(enemy, ability, power, rank, onDefeat);
      }
      return;
    }

    slot.lane ??= createLanceEffect(group, world, ability.tint);
    slot.active = slot.lane;
    slot.active.setTint(ability.tint);
    slot.active.show(position.x, position.z, aimX, aimZ, range, width, angle);
    const coneLimit = Math.cos(angle);
    let first;
    let firstDistance = Infinity;
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, range + 1) || isWarded(enemy)) continue;
      const tx = enemy.object.position.x - position.x;
      const tz = enemy.object.position.z - position.z;
      const forward = tx * aimX + tz * aimZ;
      if (angle) {
        const distance = Math.hypot(tx, tz);
        if (distance > range + enemy.stats.radius || forward < distance * coneLimit - enemy.stats.radius) continue;
      } else {
        const across = tx * aimZ - tz * aimX;
        if (forward < -enemy.stats.radius || forward > range + enemy.stats.radius
            || Math.abs(across) > width + enemy.stats.radius) continue;
      }
      if (ability.single) {
        if (forward < firstDistance) {
          firstDistance = forward;
          first = enemy;
        }
      } else {
        applyHit(enemy, ability, power, rank, onDefeat);
      }
    }
    if (first) applyHit(first, ability, power, rank, onDefeat);
  }

  function hasPrimaryTarget(position, ability, rank) {
    const range = ability.shape === 'circle'
      ? ability.radius + rank * 0.45 : ability.range + rank * 0.8;
    for (const enemy of nearby) {
      if (enemyInRange(enemy, position, range) && !isWarded(enemy)) return true;
    }
    return false;
  }

  function advanceEffect(effect, elapsed, dt, duration) {
    if (elapsed >= duration) return duration;
    const next = Math.min(duration, elapsed + dt);
    if (next === duration) effect.hide();
    else effect.update(next / duration);
    return next;
  }

  function beginAttack(enemy, target, dx, dz, distance) {
    const { position } = enemy.object;
    const { stats, strike } = enemy;
    const thrust = stats.attack === 'slam' && distance > 0.01 ? 1.8 / distance : 0;
    strike.x = stats.attack === 'targeted' ? target.x : position.x + dx * thrust;
    strike.z = stats.attack === 'targeted' ? target.z : position.z + dz * thrust;
    strike.radius = stats.impactRadius ?? stats.reach;
    enemy.state = 'windup';
    enemy.timer = stats.windup;
    enemy.mark = markPool.pop() ?? createGroundEffect(group, world, stats.tint);
    enemy.mark.setTint(stats.tint);
    enemy.mark.show(strike.x, strike.z, strike.radius);
  }

  function updateEnemy(enemy, dt, target, jumpHeight, onDamage) {
    const { position } = enemy.object;
    const { stats } = enemy;
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    enemy.object.visible = distanceSquared < VIEW_RADIUS * VIEW_RADIUS;
    if (!enemy.object.visible && enemy.state === 'idle') return;
    const distance = Math.sqrt(distanceSquared);
    const homeX = enemy.x - position.x;
    const homeZ = enemy.z - position.z;
    const homeDistance = Math.hypot(homeX, homeZ);
    const canChase = inCombatArea(enemy, target) && distance <= stats.aggro
      && withinRange(target, enemy, stats.leash);
    enemy.wardOpening = Math.max(0, enemy.wardOpening - dt);
    enemy.slowed = Math.max(0, enemy.slowed - dt);
    enemy.timer = Math.max(0, enemy.timer - dt);
    enemy.flash = Math.max(0, enemy.flash - dt);
    let moving = false;
    let windup = 0;

    switch (enemy.state) {
      case 'windup':
        windup = 1 - enemy.timer / stats.windup;
        enemy.mark.update(windup);
        if (enemy.timer === 0) {
          interrupt(enemy);
          if (jumpHeight < 0.72 && damageCooldown === 0 && inCombatArea(enemy, target)
              && withinRange(enemy.strike, target, enemy.strike.radius)) {
            damageCooldown = HURT_COOLDOWN;
            onDamage(Math.max(1, Math.round(stats.damage * (activeClass?.incomingMultiplier ?? 1) * (guard > 0 ? 0.5 : 1))));
          }
        }
        break;
      case 'recover':
        if (enemy.timer === 0) enemy.state = 'idle';
        break;
      default:
        if (canChase && enemy.state !== 'return') {
          if (distance > 0.01) enemy.object.rotation.y = Math.atan2(dx, dz);
          const attackRange = stats.attack === 'targeted' ? stats.reach : stats.reach * 0.77;
          if (distance <= attackRange) {
            beginAttack(enemy, target, dx, dz, distance);
          } else {
            stepTowards(enemy, dx, dz, distance, dt);
            enemy.state = 'chase';
            moving = true;
          }
        } else if (homeDistance > 0.28) {
          enemy.object.rotation.y = Math.atan2(homeX, homeZ);
          stepTowards(enemy, homeX, homeZ, homeDistance, dt);
          enemy.state = 'return';
          moving = true;
        } else {
          if (enemy.state === 'return' && enemy.expedition) enemy.hp = stats.hp;
          enemy.state = 'idle';
        }
    }
    if (!enemy.object.visible) return;
    enemy.phase += dt * (moving ? 13 : 3);
    enemy.model.animate(enemy.phase, moving ? 0.12 : 0.035, windup, enemy.flash > 0, isWarded(enemy));
  }

  function update(dt, {
    position, facing, cast, breakSeal, arc, auto, classId, damageMultiplier = 1,
    burstRank = 1, sealRank = 1, arcRank = 1, onDamage, onDefeat, onCast,
  }) {
    const playerClass = classId == null ? undefined : getClass(classId);
    if (playerClass !== activeClass) {
      activeClass = playerClass;
      guard = 0;
      resetAbilitySlot(primarySlot);
      resetAbilitySlot(secondarySlot);
    }
    const primary = activeClass?.primary ?? LEGACY_PRIMARY;
    const secondary = activeClass?.secondary ?? LEGACY_SECONDARY;

    clock += dt;
    guard = Math.max(0, guard - dt);
    sealCooldown = Math.max(0, sealCooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);
    tickAbilitySlot(primarySlot, dt);
    tickAbilitySlot(secondarySlot, dt);
    sealElapsed = advanceEffect(seal, sealElapsed, dt, SEAL_BREAK.duration);

    refreshNearby(position);
    for (const enemy of nearby) {
      if (!enemy.enabled || defeated.has(enemy.id)) continue;
      if (enemy.respawnAt > 0 && clock >= enemy.respawnAt
          && !withinRange(enemy, position, Math.max(7, enemy.stats.aggro * 0.8))) {
        enemy.respawnAt = 0;
        resetEnemy(enemy);
      }
      if (isActive(enemy) && !enemy.object && withinRange(enemy, position, VIEW_RADIUS)) materialize(enemy);
    }
    let castStyle;
    let castTint;
    if (breakSeal && sealCooldown === 0) {
      startSealBreak(position, rankBonus(sealRank));
      castStyle = 'seal';
      castTint = SEAL_BREAK.tint;
    }
    if (arc && secondarySlot.remaining === 0) {
      const rank = rankBonus(arcRank);
      useAbility(secondarySlot, secondary, position, facing, damageMultiplier, rank, onDefeat);
      castStyle = 'arc';
      castTint = secondary.tint;
    }

    const primaryRank = rankBonus(burstRank);
    if (primarySlot.remaining === 0 && (cast || auto && hasPrimaryTarget(position, primary, primaryRank))) {
      useAbility(primarySlot, primary, position, cast ? facing : undefined, damageMultiplier, primaryRank, onDefeat);
      if (!castStyle) {
        castStyle = 'rune';
        castTint = primary.tint;
      }
    }
    if (castStyle) onCast?.(castStyle, castTint);
    const jumpHeight = position.y - world.heightAt(position.x, position.z);
    for (const enemy of nearby) {
      if (isActive(enemy) && enemy.object) updateEnemy(enemy, dt, position, jumpHeight, onDamage);
    }
  }

  function encounterStatus(id, position) {
    const enemy = byId.get(id);
    if (!enemyInRange(enemy, position, 19)) return null;
    return { hp: enemy.hp, max: enemy.stats.hp, warded: Boolean(isWarded(enemy)) };
  }

  reset();
  return {
    update,
    reset,
    setEncounterActive,
    resetEncounter,
    encounterStatus,
    defeatedIds: () => Array.from(defeated),
    get cooldown() { return primarySlot.remaining / primarySlot.cycle; },
    get sealCooldown() { return sealCooldown / SEAL_BREAK.cooldown; },
    get arcCooldown() { return secondarySlot.remaining / secondarySlot.cycle; },
    get kills() { return kills; },
  };
}
