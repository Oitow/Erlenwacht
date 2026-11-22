import { createAvatar } from './avatar.js';

const WALK_SPEED = 5.8;
const SPRINT_SPEED = 8.1;
const COLLISION_RADIUS = 0.43;
const JUMP_SPEED = 6.8;
const GRAVITY = 19;

export function createCharacter(scene, world) {
  const avatar = createAvatar();
  const position = avatar.root.position;
  const velocity = { x: 0, z: 0 };
  let jumpHeight = 0;
  let verticalVelocity = 0;
  scene.add(avatar.root);

  function reset(x = world.spawn.x, z = world.spawn.z) {
    position.set(x, world.heightAt(x, z), z);
    avatar.root.rotation.y = 0;
    velocity.x = 0;
    velocity.z = 0;
    jumpHeight = 0;
    verticalVelocity = 0;
    avatar.reset();
  }

  function update(dt, input) {
    if (dt <= 0) return;

    const magnitude = Math.max(1, Math.hypot(input.x, input.z));
    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    const responsiveness = 1 - Math.exp(-dt * 17);
    velocity.x += (input.x * speed / magnitude - velocity.x) * responsiveness;
    velocity.z += (input.z * speed / magnitude - velocity.z) * responsiveness;

    const next = world.resolveMovement(
      position.x, position.z,
      position.x + velocity.x * dt, position.z + velocity.z * dt,
      COLLISION_RADIUS,
    );
    const movedX = next.x - position.x;
    const movedZ = next.z - position.z;
    const movedSpeed = Math.hypot(movedX, movedZ) / dt;
    if (Math.abs(movedX) < 0.0001 && input.x) velocity.x = 0;
    if (Math.abs(movedZ) < 0.0001 && input.z) velocity.z = 0;

    if (input.jump && jumpHeight === 0) verticalVelocity = JUMP_SPEED;
    if (jumpHeight > 0 || verticalVelocity > 0) {
      verticalVelocity -= GRAVITY * dt;
      jumpHeight = Math.max(0, jumpHeight + verticalVelocity * dt);
      if (jumpHeight === 0) verticalVelocity = 0;
    }

    position.set(next.x, world.heightAt(next.x, next.z) + jumpHeight, next.z);
    if (movedSpeed > 0.13) {
      const target = Math.atan2(-movedX, -movedZ);
      const yawOffset = target - avatar.root.rotation.y;
      avatar.root.rotation.y += Math.atan2(Math.sin(yawOffset), Math.cos(yawOffset)) * (1 - Math.exp(-dt * 13));
    }
    avatar.animate(dt, movedSpeed, jumpHeight === 0);
  }

  reset();
  return { position, update, reset };
}
