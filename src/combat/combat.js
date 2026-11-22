import * as THREE from 'three';
import { createEnemyModels, createGroundEffect } from './visuals.js';

const BURST = { cooldown: 0.85, radius: 6.5, damage: 1, duration: 0.42 };
const ARCHETYPES = {
  hunter: { hp: 2, speed: 3.35, radius: 0.51, aggro: 11, leash: 18, reach: 2.15, windup: 0.64, recovery: 0.78, damage: 10, tint: 0xf18848 },
  sentinel: { hp: 3, speed: 2.25, radius: 0.70, aggro: 10, leash: 15, reach: 3.15, windup: 0.96, recovery: 1.25, damage: 17, tint: 0xe06657 },
};
const HURT_COOLDOWN = 0.35;

function withinBurst(target, position) {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  return dx * dx + dz * dz <= BURST.radius ** 2;
}

export function createCombat(scene, world, defeatedIds = []) {
  const group = new THREE.Group();
  scene.add(group);
  const makeModel = createEnemyModels();
  const burst = createGroundEffect(group, world, 0x74dcff, true);
  const secureZ = world.gate.z + 5;
  const enemies = world.encounters.map((anchor, id) => {
    if (anchor.z < secureZ) return null;
    const { x, z } = anchor;
    const archetype = Object.hasOwn(ARCHETYPES, anchor.archetype)
      ? anchor.archetype
      : id % 3 === 2 ? 'sentinel' : 'hunter';
    const stats = ARCHETYPES[archetype];
    const object = new THREE.Group();
    object.position.set(x, world.heightAt(x, z), z);
    group.add(object);
    return {
      id, x, z, stats, object,
      model: makeModel(archetype, object),
      mark: createGroundEffect(group, world, stats.tint),
      state: 'idle',
      timer: 0,
      flash: 0,
      hp: stats.hp,
      phase: id * 1.7,
    };
  });
  const initialDefeats = Array.isArray(defeatedIds) ? defeatedIds.filter(id => Number.isInteger(id) && enemies[id]) : [];
  const defeated = new Set();
  let cooldown = 0;
  let damageCooldown = 0;
  let burstElapsed = BURST.duration;

  function reset() {
    defeated.clear();
    for (const id of initialDefeats) defeated.add(id);
    cooldown = damageCooldown = 0;
    burstElapsed = BURST.duration;
    burst.hide();
    for (const enemy of enemies) {
      if (!enemy) continue;
      enemy.hp = enemy.stats.hp;
      enemy.state = 'idle';
      enemy.timer = enemy.flash = 0;
      enemy.phase = enemy.id * 1.7;
      enemy.object.position.set(enemy.x, world.heightAt(enemy.x, enemy.z), enemy.z);
      enemy.object.rotation.y = 0;
      enemy.object.visible = !defeated.has(enemy.id);
      enemy.model.animate(enemy.phase, 0, 0, false);
      enemy.mark.hide();
    }
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
    cooldown = BURST.cooldown;
    burstElapsed = 0;
    burst.show(position.x, position.z, BURST.radius);
    for (const enemy of enemies) {
      if (!enemy || defeated.has(enemy.id)) continue;
      const target = enemy.object.position;
      if (!withinBurst(target, position)) continue;
      enemy.hp -= BURST.damage * damageMultiplier;
      enemy.flash = 0.15;
      if (enemy.hp > 0) continue;
      defeated.add(enemy.id);
      enemy.object.visible = false;
      enemy.mark.hide();
      onDefeat({
        id: enemy.id,
        x: target.x,
        z: target.z,
        itemId: enemy.id % 5 === 4 ? 'health-tonic' : 'rune-shard',
        quantity: 1,
      });
    }
  }

  function updateEnemy(enemy, dt, target, jumpHeight, onDamage) {
    const { position } = enemy.object;
    const stats = enemy.stats;
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
    enemy.model.animate(enemy.phase, moving ? 0.12 : 0.035, windup, enemy.flash > 0);
  }

  function update(dt, { position, cast, auto, damageMultiplier = 1, onDamage, onDefeat }) {
    cooldown = Math.max(0, cooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);
    if (burstElapsed < BURST.duration) {
      burstElapsed = Math.min(BURST.duration, burstElapsed + dt);
      if (burstElapsed === BURST.duration) burst.hide();
      else burst.update(burstElapsed / BURST.duration);
    }
    const autoTarget = auto && cooldown === 0 && enemies.some(enemy => (
      enemy && !defeated.has(enemy.id) && withinBurst(enemy.object.position, position)
    ));
    if (cooldown === 0 && (cast || autoTarget)) startBurst(position, damageMultiplier, onDefeat);
    const jumpHeight = position.y - world.heightAt(position.x, position.z);
    for (const enemy of enemies) {
      if (enemy && !defeated.has(enemy.id)) updateEnemy(enemy, dt, position, jumpHeight, onDamage);
    }
  }

  reset();
  return {
    update,
    reset,
    defeatedIds: () => Array.from(defeated).sort((a, b) => a - b),
    get cooldown() { return cooldown / BURST.cooldown; },
    get kills() { return defeated.size; },
  };
}
