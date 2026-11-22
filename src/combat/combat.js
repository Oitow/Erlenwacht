import * as THREE from 'three';
import { ARCHETYPES, encounterReward, encounterStats } from './enemies.js';
import { RUNIC_BURST, SEAL_BREAK, THORN_LANCE } from './skills.js';
import { createEnemyModels, createGroundEffect, createLanceEffect } from './visuals.js';

const CELL_SIZE = 28;
const CELL_RADIUS = 3;
const VIEW_RADIUS = 55;
const HURT_COOLDOWN = 0.35;

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
  const burst = createGroundEffect(group, world, RUNIC_BURST.tint, true);
  const seal = createGroundEffect(group, world, SEAL_BREAK.tint, true);
  const lance = createLanceEffect(group, world, THORN_LANCE.tint);
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
      wardOpening: 0, respawnAt: 0, killCount: 0,
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
  let cooldown = 0;
  let sealCooldown = 0;
  let arcCooldown = 0;
  let arcCycle = THORN_LANCE.cooldown;
  let damageCooldown = 0;
  let burstElapsed = RUNIC_BURST.duration;
  let sealElapsed = SEAL_BREAK.duration;
  let arcElapsed = THORN_LANCE.duration;

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
    enemy.timer = enemy.flash = enemy.wardOpening = 0;
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
    clock = cooldown = sealCooldown = arcCooldown = damageCooldown = 0;
    arcCycle = THORN_LANCE.cooldown;
    burstElapsed = RUNIC_BURST.duration;
    sealElapsed = SEAL_BREAK.duration;
    arcElapsed = THORN_LANCE.duration;
    burst.hide();
    seal.hide();
    lance.hide();
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
    const step = Math.min(distance, enemy.stats.speed * dt);
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

  function startBurst(position, damageMultiplier, rank, onDefeat) {
    cooldown = RUNIC_BURST.cooldown;
    burstElapsed = 0;
    const radius = RUNIC_BURST.radius + rank * 0.45;
    burst.show(position.x, position.z, radius);
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, radius)) continue;
      hurtEnemy(enemy, damageMultiplier * (1 + rank * 0.35), onDefeat);
    }
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

  function startLance(position, facing, damageMultiplier, rank, onDefeat) {
    const range = THORN_LANCE.range + rank * 0.8;
    const width = THORN_LANCE.width + rank * 0.12;
    const facingLength = Math.hypot(facing?.x ?? 0, facing?.z ?? 0);
    let aimX = facingLength > 0.001 ? facing.x / facingLength : 0;
    let aimZ = facingLength > 0.001 ? facing.z / facingLength : -1;
    let aimScore = Infinity;
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, range) || isWarded(enemy)) continue;
      const target = enemy.object.position;
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.05) continue;
      const alignment = facingLength > 0.001 ? (dx * facing.x + dz * facing.z) / (distance * facingLength) : 1;
      if (alignment < 0.33) continue;
      const score = distance + (1 - alignment) * 5;
      if (score >= aimScore) continue;
      aimScore = score;
      aimX = dx / distance;
      aimZ = dz / distance;
    }

    arcCycle = THORN_LANCE.cooldown - rank * 0.35;
    arcCooldown = arcCycle;
    arcElapsed = 0;
    lance.show(position.x, position.z, aimX, aimZ, range, width);
    for (const enemy of nearby) {
      if (!enemyInRange(enemy, position, range + 1) || isWarded(enemy)) continue;
      const dx = enemy.object.position.x - position.x;
      const dz = enemy.object.position.z - position.z;
      const forward = dx * aimX + dz * aimZ;
      const across = dx * aimZ - dz * aimX;
      if (forward < -enemy.stats.radius || forward > range + enemy.stats.radius) continue;
      if (Math.abs(across) > width + enemy.stats.radius) continue;
      interrupt(enemy);
      hurtEnemy(enemy, damageMultiplier * (THORN_LANCE.power + rank * 0.55), onDefeat);
    }
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
            onDamage(stats.damage);
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
    position, facing, cast, breakSeal, arc, auto, damageMultiplier = 1,
    burstRank = 1, sealRank = 1, arcRank = 1, onDamage, onDefeat, onCast,
  }) {
    clock += dt;
    cooldown = Math.max(0, cooldown - dt);
    sealCooldown = Math.max(0, sealCooldown - dt);
    arcCooldown = Math.max(0, arcCooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);
    burstElapsed = advanceEffect(burst, burstElapsed, dt, RUNIC_BURST.duration);
    sealElapsed = advanceEffect(seal, sealElapsed, dt, SEAL_BREAK.duration);
    arcElapsed = advanceEffect(lance, arcElapsed, dt, THORN_LANCE.duration);

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
    if (breakSeal && sealCooldown === 0) {
      startSealBreak(position, rankBonus(sealRank));
      castStyle = 'seal';
    }
    if (arc && arcCooldown === 0) {
      startLance(position, facing, damageMultiplier, rankBonus(arcRank), onDefeat);
      castStyle = 'arc';
    }

    const burstBonus = rankBonus(burstRank);
    if (cooldown === 0 && (cast || auto && hasBurstTarget(position, burstBonus))) {
      startBurst(position, damageMultiplier, burstBonus, onDefeat);
      castStyle ??= 'rune';
    }
    if (castStyle) onCast?.(castStyle);
    const jumpHeight = position.y - world.heightAt(position.x, position.z);
    for (const enemy of nearby) {
      if (isActive(enemy) && enemy.object) updateEnemy(enemy, dt, position, jumpHeight, onDamage);
    }
  }

  function hasBurstTarget(position, bonus) {
    const radius = RUNIC_BURST.radius + bonus * 0.45;
    for (const enemy of nearby) {
      if (enemyInRange(enemy, position, radius) && !isWarded(enemy)) return true;
    }
    return false;
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
    get cooldown() { return cooldown / RUNIC_BURST.cooldown; },
    get sealCooldown() { return sealCooldown / SEAL_BREAK.cooldown; },
    get arcCooldown() { return arcCooldown / arcCycle; },
    get kills() { return kills; },
  };
}
