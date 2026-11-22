import { createAvatar } from './avatar.js';
import { getClass } from '../game/classes.js';

const WALK_SPEED = 5.8;
const SPRINT_SPEED = 8.1;
const COLLISION_RADIUS = 0.43;
const JUMP_SPEED = 6.8;
const GRAVITY = 19;
const JUMP_BUFFER = 0.12;

export function createCharacter(scene, world) {
  const avatar = createAvatar();
  const position = avatar.root.position;
  const velocity = { x: 0, z: 0 };
  const facing = { x: 0, z: -1 };
  let speedMultiplier = 1;
  let jumpHeight = 0;
  let verticalVelocity = 0;
  let jumpBuffer = 0;
  scene.add(avatar.root);

  function reset(x = world.spawn.x, z = world.spawn.z) {
    position.set(x, world.heightAt(x, z), z);
    avatar.root.rotation.y = 0;
    facing.x = 0;
    facing.z = -1;
    velocity.x = velocity.z = 0;
    jumpHeight = verticalVelocity = jumpBuffer = 0;
    avatar.reset();
  }

  function update(dt, input) {
    if (dt <= 0) return;

    const magnitude = Math.hypot(input.x, input.z);
    const speed = (input.sprint ? SPRINT_SPEED : WALK_SPEED) * speedMultiplier;
    const grounded = jumpHeight === 0;
    const response = grounded ? (magnitude > 0.015 ? 19 : 27) : 9;
    const responsiveness = 1 - Math.exp(-dt * response);
    const inputScale = speed / Math.max(1, magnitude);
    velocity.x += (input.x * inputScale - velocity.x) * responsiveness;
    velocity.z += (input.z * inputScale - velocity.z) * responsiveness;
    if (magnitude < 0.001 && Math.hypot(velocity.x, velocity.z) < 0.008) {
      velocity.x = velocity.z = 0;
    }

    let movedX = 0;
    let movedZ = 0;
    let groundHeight = position.y - jumpHeight;
    if (velocity.x || velocity.z) {
      const next = world.resolveMovement(
        position.x, position.z,
        position.x + velocity.x * dt, position.z + velocity.z * dt,
        COLLISION_RADIUS,
      );
      movedX = next.x - position.x;
      movedZ = next.z - position.z;
      velocity.x = movedX / dt;
      velocity.z = movedZ / dt;
      groundHeight = world.heightAt(next.x, next.z);
      position.x = next.x;
      position.z = next.z;
    }

    jumpBuffer = input.jump ? JUMP_BUFFER : Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && grounded) {
      verticalVelocity = JUMP_SPEED;
      jumpBuffer = 0;
    }
    if (!grounded || verticalVelocity > 0) {
      jumpHeight = Math.max(0, jumpHeight + (verticalVelocity - GRAVITY * dt * 0.5) * dt);
      verticalVelocity = jumpHeight > 0 ? verticalVelocity - GRAVITY * dt : 0;
    }
    position.y = groundHeight + jumpHeight;

    let turned = 0;
    const movedSpeed = Math.hypot(movedX, movedZ) / dt;
    if (movedSpeed > 0.15) {
      const target = Math.atan2(-movedX, -movedZ);
      const yawOffset = target - avatar.root.rotation.y;
      turned = Math.atan2(Math.sin(yawOffset), Math.cos(yawOffset)) * (1 - Math.exp(-dt * 15));
      avatar.root.rotation.y += turned;
      facing.x = -Math.sin(avatar.root.rotation.y);
      facing.z = -Math.cos(avatar.root.rotation.y);
    }
    avatar.animate(dt, movedSpeed, jumpHeight === 0, verticalVelocity, turned / dt);
  }

  reset();
  return {
    position,
    facing,
    update,
    setClass(classId) {
      const playerClass = getClass(classId);
      speedMultiplier = playerClass.speedMultiplier;
      avatar.setClass(playerClass.id);
    },
    reset,
    playCast: avatar.playCast,
    playHit: avatar.playHit,
    setWeapon: avatar.setWeapon,
  };
}
