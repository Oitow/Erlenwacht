import { MathUtils, Vector3 } from 'three';

const DEFAULT_PITCH = 0.47;
const LOOK_SENSITIVITY = 0.007;
const MIN_PITCH = 0.24;
const MAX_PITCH = 1.12;
const TERRAIN_SAMPLES = [0.36, 0.68, 1];

function wrapAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export function createCamera(camera, world) {
  const anchor = new Vector3();
  const target = new Vector3();
  let yaw = 0;
  let pitch = DEFAULT_PITCH;
  let wantedYaw = 0;
  let wantedPitch = DEFAULT_PITCH;
  let floorLift = 0;

  function orientMovement(input, dt = 1 / 60) {
    wantedYaw = wrapAngle(wantedYaw - (input.lookX || 0) * LOOK_SENSITIVITY);
    wantedPitch = MathUtils.clamp(wantedPitch + (input.lookY || 0) * LOOK_SENSITIVITY,
      MIN_PITCH, MAX_PITCH);
    const blend = 1 - Math.exp(-dt * 26);
    yaw = wrapAngle(yaw + wrapAngle(wantedYaw - yaw) * blend);
    pitch += (wantedPitch - pitch) * blend;

    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);
    const x = input.x * cosine + input.z * sine;
    input.z = input.z * cosine - input.x * sine;
    input.x = x;
  }

  function update(dt, position) {
    const portrait = camera.aspect < 0.82;
    const cameraDistance = portrait ? 8.9 : 10.2;
    const horizontalDistance = Math.cos(pitch) * cameraDistance;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const follow = 1 - Math.exp(-dt * 14);
    anchor.x += (position.x - anchor.x) * follow;
    anchor.y += (position.y - anchor.y) * (1 - Math.exp(-dt * 8));
    anchor.z += (position.z - anchor.z) * follow;

    const x = anchor.x - forwardX * horizontalDistance;
    const z = anchor.z - forwardZ * horizontalDistance;
    const shoulder = anchor.y + 1.4;
    const y = anchor.y + Math.sin(pitch) * cameraDistance + 1.35;

    let wantedLift = 0;
    if (world) {
      for (const fraction of TERRAIN_SAMPLES) {
        const sampleX = anchor.x + (x - anchor.x) * fraction;
        const sampleZ = anchor.z + (z - anchor.z) * fraction;
        const floor = world.heightAt(sampleX, sampleZ) + 0.72;
        const rayY = shoulder + (y - shoulder) * fraction;
        wantedLift = Math.max(wantedLift, (floor - rayY) / fraction);
      }
    }
    floorLift = Math.max(wantedLift, floorLift * Math.exp(-dt * 7));
    camera.position.set(x, y + floorLift, z);

    const lead = portrait ? 1.72 : 2.02;
    target.set(anchor.x + forwardX * lead, anchor.y + 1.22, anchor.z + forwardZ * lead);
    camera.lookAt(target);
  }

  function reset(position) {
    yaw = wantedYaw = 0;
    pitch = wantedPitch = DEFAULT_PITCH;
    floorLift = 0;
    anchor.copy(position);
    update(0, position);
  }

  return {
    orientMovement,
    update,
    reset,
    bearingTo(x, z) {
      return wrapAngle(Math.atan2(x, -z) + yaw);
    },
  };
}
