import * as THREE from 'three';
import { createEnemyModels, createGroundEffect } from './visuals.js';

import { RUNIC_BURST, SEAL_BREAK } from './skills.js';
const ARCHETYPES = {
  hunter: { hp: 2, speed: 3.35, radius: 0.51, aggro: 11, leash: 18, reach: 2.15, windup: 0.64, recovery: 0.78, damage: 10, tint: 0xf18848 },
  sentinel: { hp: 3, speed: 2.25, radius: 0.70, aggro: 10, leash: 15, reach: 3.15, windup: 0.96, recovery: 1.25, damage: 17, tint: 0xe06657 },
  warden: { hp: 14, speed: 3, radius: 0.9, aggro: 13, leash: 17, reach: 4.5, windup: 1.05, recovery: 0.95, damage: 29, tint: 0xd97bff, warded: true },
};
const HURT_COOLDOWN = 0.35;

function withinRange(target, position, radius) {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  return dx * dx + dz * dz <= radius ** 2;
}

export function createCombat(scene, world, defeatedIds = []) {
  const group = new THREE.Group();
  scene.add(group);
  const makeModel = createEnemyModels();
  const burst = createGroundEffect(group, world, RUNIC_BURST.tint, true);
  const seal = createGroundEffect(group, world, SEAL_BREAK.tint, true);
  const secureZ = world.gate.z + 5;
  const enemies = world.encounters.map((anchor, index) => {
    if (anchor.z < secureZ) return null;
    const { x, z, id = index, optional = false } = anchor;
    const archetype = Object.hasOwn(ARCHETYPES, anchor.archetype)
      ? anchor.archetype
      : index % 3 === 2 ? 'sentinel' : 'hunter';
    const stats = ARCHETYPES[archetype];
    const object = new THREE.Group();
    object.position.set(x, world.heightAt(x, z), z);
    group.add(object);
    return {
      id, index, x, z, stats, object, optional, enabled: !optional,
      model: makeModel(archetype, object),
      mark: createGroundEffect(group, world, stats.tint),
      state: 'idle',
      timer: 0,
      flash: 0,
      hp: stats.hp,
      phase: index * 1.7,
      wardOpening: 0,
    };
  });
  const byId = new Map(enemies.filter(Boolean).map(enemy => [enemy.id, enemy]));
  const initialDefeats = Array.isArray(defeatedIds) ? defeatedIds.filter(id => byId.has(id)) : [];
  const defeated = new Set();
  let cooldown = 0;
  let sealCooldown = 0;
  let damageCooldown = 0;
  let burstElapsed = RUNIC_BURST.duration;
  let sealElapsed = SEAL_BREAK.duration;

  function isActive(enemy) {
    return enemy?.enabled && !defeated.has(enemy.id);
  }

  function resetEnemy(enemy) {
    enemy.hp = enemy.stats.hp;
    enemy.state = 'idle';
    enemy.timer = enemy.flash = enemy.wardOpening = 0;
    enemy.phase = enemy.index * 1.7;
    enemy.object.position.set(enemy.x, world.heightAt(enemy.x, enemy.z), enemy.z);
    enemy.object.rotation.y = 0;
    enemy.object.visible = isActive(enemy);
    enemy.model.animate(enemy.phase, 0, 0, false, enemy.stats.warded);
    enemy.mark.hide();
  }

  function reset() {
    defeated.clear();
    for (const id of initialDefeats) defeated.add(id);
    cooldown = sealCooldown = damageCooldown = 0;
    burstElapsed = RUNIC_BURST.duration;
    sealElapsed = SEAL_BREAK.duration;
    burst.hide();
    seal.hide();
    for (const enemy of byId.values()) resetEnemy(enemy);
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

  function isWarded(enemy) {
    return enemy.stats.warded && enemy.wardOpening === 0;
  }

  function stepTowards(enemy, dx, dz, distance, dt) {
    const { position } = enemy.object;
    const step = Math.min(distance, enemy.stats.speed * dt);
    const targetX = position.x + dx / distance * step;
    const targetZ = Math.max(secureZ, position.z + dz / distance * step);
    const next = world.resolveMovement(position.x, position.z, targetX, targetZ, enemy.stats.radius);
    position.set(next.x, world.heightAt(next.x, next.z), next.z);
  }

  function startBurst(position, damageMultiplier, onDefeat) {
    cooldown = RUNIC_BURST.cooldown;
    burstElapsed = 0;
    burst.show(position.x, position.z, RUNIC_BURST.radius);
    for (const enemy of enemies) {
      if (!isActive(enemy)) continue;
      const target = enemy.object.position;
      if (!withinRange(target, position, RUNIC_BURST.radius) || isWarded(enemy)) continue;
      enemy.hp -= damageMultiplier;
      enemy.flash = 0.15;
      if (enemy.hp > 0) continue;
      defeated.add(enemy.id);
      enemy.object.visible = false;
      enemy.mark.hide();
      onDefeat({
        id: enemy.id,
        x: target.x,
        z: target.z,
        itemId: enemy.index % 5 === 4 ? 'health-tonic' : 'rune-shard',
        quantity: enemy.stats.warded ? 3 : 1,
      });
    }
  }

  function startSealBreak(position) {
    sealCooldown = SEAL_BREAK.cooldown;
    sealElapsed = 0;
    seal.show(position.x, position.z, SEAL_BREAK.radius);
    for (const enemy of enemies) {
      if (!isActive(enemy) || !withinRange(enemy.object.position, position, SEAL_BREAK.radius)) continue;
      enemy.wardOpening = SEAL_BREAK.wardOpening;
      enemy.flash = 0.15;
      if (enemy.state === 'windup') {
        enemy.state = 'recover';
        enemy.timer = enemy.stats.recovery;
        enemy.mark.hide();
      }
    }
  }

  function advanceEffect(effect, elapsed, dt, duration) {
    if (elapsed >= duration) return duration;
    const next = Math.min(duration, elapsed + dt);
    if (next === duration) effect.hide();
    else effect.update(next / duration);
    return next;
  }

  function updateEnemy(enemy, dt, target, jumpHeight, onDamage) {
    const { position } = enemy.object;
    const stats = enemy.stats;
    enemy.wardOpening = Math.max(0, enemy.wardOpening - dt);
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const homeX = enemy.x - position.x;
    const homeZ = enemy.z - position.z;
    const homeDistance = Math.hypot(homeX, homeZ);
    const canChase = target.z >= secureZ && distance <= stats.aggro && Math.hypot(target.x - enemy.x, target.z - enemy.z) <= stats.leash;
    enemy.object.visible = distance < 55;
    if (!enemy.object.visible && enemy.state === 'idle') return;
    enemy.timer = Math.max(0, enemy.timer - dt);
    enemy.flash = Math.max(0, enemy.flash - dt);
    let moving = false;
    let windup = 0;

    switch (enemy.state) {
      case 'windup':
        windup = 1 - enemy.timer / stats.windup;
        enemy.mark.update(windup);
        if (enemy.timer === 0) {
          enemy.mark.hide();
          enemy.state = 'recover';
          enemy.timer = stats.recovery;
          if (distance <= stats.reach && jumpHeight < 0.72 && target.z >= secureZ && damageCooldown === 0) {
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
          if (distance <= stats.reach * 0.77) {
            enemy.state = 'windup';
            enemy.timer = stats.windup;
            enemy.mark.show(position.x, position.z, stats.reach);
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
          enemy.state = 'idle';
        }
    }
    enemy.phase += dt * (moving ? 13 : 3);
    enemy.model.animate(enemy.phase, moving ? 0.12 : 0.035, windup, enemy.flash > 0, isWarded(enemy));
  }

  function update(dt, { position, cast, breakSeal, auto, damageMultiplier = 1, onDamage, onDefeat }) {
    cooldown = Math.max(0, cooldown - dt);
    sealCooldown = Math.max(0, sealCooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);
    burstElapsed = advanceEffect(burst, burstElapsed, dt, RUNIC_BURST.duration);
    sealElapsed = advanceEffect(seal, sealElapsed, dt, SEAL_BREAK.duration);
    if (breakSeal && sealCooldown === 0) startSealBreak(position);
    const autoTarget = auto && cooldown === 0 && enemies.some(enemy => (
      isActive(enemy) && !isWarded(enemy) && withinRange(enemy.object.position, position, RUNIC_BURST.radius)
    ));
    if (cooldown === 0 && (cast || autoTarget)) startBurst(position, damageMultiplier, onDefeat);
    const jumpHeight = position.y - world.heightAt(position.x, position.z);
    for (const enemy of enemies) {
      if (isActive(enemy)) updateEnemy(enemy, dt, position, jumpHeight, onDamage);
    }
  }

  function encounterStatus(id, position) {
    const enemy = byId.get(id);
    if (!isActive(enemy) || !withinRange(enemy.object.position, position, 19)) return null;
    return { hp: enemy.hp, max: enemy.stats.hp, warded: isWarded(enemy) };
  }

  reset();
  return {
    update,
    reset,
    setEncounterActive,
    resetEncounter,
    encounterStatus,
    defeatedIds: () => Array.from(byId.keys()).filter(id => defeated.has(id)),
    get cooldown() { return cooldown / RUNIC_BURST.cooldown; },
    get sealCooldown() { return sealCooldown / SEAL_BREAK.cooldown; },
    get kills() { return defeated.size; },
  };
}
