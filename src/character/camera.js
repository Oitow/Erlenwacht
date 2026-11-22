import { MathUtils, Vector3 } from 'three';

const DEFAULT_PITCH = 0.49;
const CAMERA_DISTANCE = 10.9;
const LOOK_SENSITIVITY = 0.007;

export function createCamera(camera, world) {
  const desired = new Vector3();
  const target = new Vector3();
  const desiredTarget = new Vector3();
  let yaw = 0;
  let pitch = DEFAULT_PITCH;

  function orientMovement(input) {
    yaw -= (input.lookX || 0) * LOOK_SENSITIVITY;
    pitch = MathUtils.clamp(pitch + (input.lookY || 0) * LOOK_SENSITIVITY, 0.25, 1.14);
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);
    const x = input.x * cosine + input.z * sine;
    input.z = input.z * cosine - input.x * sine;
    input.x = x;
  }

  function update(dt, position) {
    const horizontalDistance = Math.cos(pitch) * CAMERA_DISTANCE;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    desired.set(
      position.x - forwardX * horizontalDistance,
      position.y + Math.sin(pitch) * CAMERA_DISTANCE + 1.2,
      position.z - forwardZ * horizontalDistance,
    );
    if (world) desired.y = Math.max(desired.y, world.heightAt(desired.x, desired.z) + 1.1);
    desiredTarget.set(position.x + forwardX * 2.1, position.y + 1.1, position.z + forwardZ * 2.1);

    const cameraBlend = 1 - Math.exp(-dt * 11);
    camera.position.lerp(desired, cameraBlend);
    target.lerp(desiredTarget, cameraBlend);
    camera.lookAt(target);
  }

  function reset(position) {
    yaw = 0;
    pitch = DEFAULT_PITCH;
    update(Infinity, position);
  }

  return { orientMovement, update, reset };
}
