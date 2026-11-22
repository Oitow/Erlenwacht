import * as THREE from 'three';
import { createAvatar } from '../src/character/avatar.js';
import { WORLD_SIZE } from './generation.js';

const { clamp } = THREE.MathUtils;
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyX',
]);
const JUMP_KEYS = new Set(['Space', 'KeyQ']);
const STEPS_PER_SECOND = 60;
const EDGE = WORLD_SIZE / 2 - 1;

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function createInput(canvas, { joystick, thumb, jumpButton, sprintButton, descendButton }) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const keys = new Set();
  const pointers = new Map();
  let stick = null;
  let orbit = null;
  let stickX = 0;
  let stickZ = 0;
  let lookX = 0;
  let lookY = 0;
  let zoom = 0;
  let jump = false;

  function capture(element, event) {
    pointers.set(event.pointerId, element);
    element.setPointerCapture(event.pointerId);
  }

  function moveStick(event) {
    const viewport = joystick.getBoundingClientRect();
    const reach = Math.max(1, Math.min(viewport.width, viewport.height) * 0.34);
    const x = event.clientX - viewport.left - viewport.width / 2;
    const z = event.clientY - viewport.top - viewport.height / 2;
    const length = Math.hypot(x, z);
    const amount = clamp((length / reach - 0.13) / 0.87, 0, 1) / Math.max(1, length);
    stickX = x * amount;
    stickZ = z * amount;
    if (thumb) thumb.style.transform = `translate(${stickX * reach}px, ${stickZ * reach}px)`;
  }

  function release(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (stick === event.pointerId) {
      stick = null;
      stickX = stickZ = 0;
      if (thumb) thumb.style.transform = '';
    }
    if (orbit?.id === event.pointerId) orbit = null;
  }

  function reset() {
    for (const [id, element] of pointers) {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    }
    pointers.clear();
    keys.clear();
    stick = orbit = null;
    stickX = stickZ = lookX = lookY = zoom = 0;
    jump = false;
    if (thumb) thumb.style.transform = '';
  }

  function watchRelease(element) {
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(name, release, options);
    }
  }

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || !MOVE_KEYS.has(event.code)) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable || target.closest('input, select, textarea, dialog[open], [role="dialog"]')
      || (JUMP_KEYS.has(event.code) && target.closest('button, a, summary'))
    )) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    keys.add(event.code);
    if (!event.repeat && JUMP_KEYS.has(event.code)) jump = true;
  }, options);
  window.addEventListener('keyup', event => keys.delete(event.code), options);
  window.addEventListener('blur', reset, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  }, options);

  joystick?.addEventListener('pointerdown', event => {
    if (stick !== null || event.button !== 0) return;
    event.preventDefault();
    stick = event.pointerId;
    capture(joystick, event);
    moveStick(event);
  }, options);
  joystick?.addEventListener('pointermove', event => {
    if (stick === event.pointerId) moveStick(event);
  }, options);
  if (joystick) watchRelease(joystick);

  canvas.addEventListener('pointerdown', event => {
    if (orbit || event.button !== 0) return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    orbit = { id: event.pointerId, x: event.clientX, y: event.clientY };
    capture(canvas, event);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (orbit?.id !== event.pointerId) return;
    lookX += event.clientX - orbit.x;
    lookY += event.clientY - orbit.y;
    orbit.x = event.clientX;
    orbit.y = event.clientY;
  }, options);
  canvas.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    zoom += Math.sign(event.deltaY) * 0.9;
  }, { ...options, passive: false });
  watchRelease(canvas);

  for (const button of [jumpButton, sprintButton, descendButton]) {
    if (!button) continue;
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      capture(button, event);
      if (button === jumpButton) jump = true;
    }, options);
    watchRelease(button);
  }
  jumpButton?.addEventListener('click', event => {
    if (event.detail === 0) jump = true;
  }, options);

  function sample() {
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight'))
      - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stickX;
    const z = Number(keys.has('KeyS') || keys.has('ArrowDown'))
      - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stickZ;
    const scale = Math.max(1, Math.hypot(x, z));
    let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    let rise = keys.has('Space') || keys.has('KeyQ');
    let descend = keys.has('KeyX');
    for (const element of pointers.values()) {
      sprint ||= element === sprintButton;
      rise ||= element === jumpButton;
      descend ||= element === descendButton;
    }
    const state = {
      x: x / scale, z: z / scale, lookX, lookY, zoom, jump,
      sprint, rise, descend,
    };
    lookX = lookY = zoom = 0;
    jump = false;
    return state;
  }

  function dispose() {
    reset();
    listeners.abort();
  }

  return { sample, reset, dispose };
}

function bakeColoredParts(group, material) {
  const parts = group.children.filter(node => node.isMesh);
  const positions = [];
  const colors = [];
  const vertex = new THREE.Vector3();
  const tint = new THREE.Color();
  for (const part of parts) {
    part.updateMatrix();
    const source = part.geometry.getAttribute('position');
    const palette = part.geometry.getAttribute('color');
    const index = part.geometry.getIndex();
    const length = index?.count ?? source.count;
    for (let i = 0; i < length; i++) {
      const point = index ? index.getX(i) : i;
      vertex.fromBufferAttribute(source, point).applyMatrix4(part.matrix);
      if (palette) tint.setRGB(palette.getX(point), palette.getY(point), palette.getZ(point));
      else tint.copy(part.material.color);
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  group.remove(...parts);
  group.add(new THREE.Mesh(geometry, material));
}

function createStag(parent) {
  const root = new THREE.Group();
  parent.add(root);
  const block = new THREE.BoxGeometry();
  const facet = new THREE.IcosahedronGeometry(1, 0);
  const hide = new THREE.MeshBasicMaterial({ color: 0x614334 });
  const mane = new THREE.MeshBasicMaterial({ color: 0x2d2925 });
  const antler = new THREE.MeshBasicMaterial({ color: 0xb0a17d });
  const saddle = new THREE.MeshBasicMaterial({ color: 0x763e32 });

  function part(group, geometry, material, x, y, z, width, height, length, tilt = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, length);
    mesh.rotation.x = tilt;
    group.add(mesh);
    return mesh;
  }

  part(root, facet, hide, 0, 1.21, 0.19, 0.55, 0.49, 1.11);
  part(root, facet, hide, 0, 1.53, -0.6, 0.32, 0.65, 0.42, 0.49);
  part(root, facet, mane, 0, 1.65, -0.43, 0.26, 0.46, 0.38, 0.52);
  part(root, facet, hide, 0, 2.04, -0.99, 0.29, 0.31, 0.46, -0.55);
  part(root, facet, mane, 0, 1.92, -1.22, 0.24, 0.2, 0.26, -0.4);
  part(root, block, saddle, 0, 1.48, 0.08, 0.81, 0.15, 0.81);
  part(root, facet, mane, 0, 1.2, 1.04, 0.19, 0.19, 0.46, 0.49);

  const legs = [];
  for (const side of [-1, 1]) {
    part(root, facet, hide, side * 0.24, 2.19, -0.83, 0.22, 0.09, 0.14)
      .rotation.z = side * 0.36;
    part(root, block, antler, side * 0.26, 2.45, -0.89, 0.07, 0.63, 0.07, 0.52)
      .rotation.z = -side * 0.34;
    part(root, block, antler, side * 0.38, 2.6, -0.79, 0.055, 0.28, 0.062, -0.48)
      .rotation.z = -side * 0.54;
    part(root, block, antler, side * 0.43, 2.57, -0.93, 0.052, 0.27, 0.049, 0.6)
      .rotation.z = -side * 0.81;

    for (const fore of [-1, 1]) {
      const joint = new THREE.Group();
      joint.position.set(side * 0.29, 1.19, fore * 0.7);
      root.add(joint);
      part(joint, facet, hide, 0, -0.31, 0, 0.145, 0.58, 0.142, fore * 0.13);
      part(joint, block, hide, 0, -0.8, 0.03, 0.12, 0.52, 0.13, -fore * 0.14);
      part(joint, block, mane, 0, -1.06, -0.025, 0.18, 0.15, 0.23);
      legs.push({ joint, phase: side === fore ? 0 : Math.PI });
    }
  }
  const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
  bakeColoredParts(root, surface);
  for (const { joint } of legs) bakeColoredParts(joint, surface);
  block.dispose();
  facet.dispose();
  for (const palette of [hide, mane, antler, saddle]) palette.dispose();

  let stride = 0;
  function animate(dt, speed) {
    stride = (stride + speed * dt * 2.3) % (2 * Math.PI);
    const amplitude = Math.min(1, speed / 12);
    root.position.y = Math.abs(Math.sin(stride)) * 0.11 * amplitude;
    for (const { joint, phase } of legs) joint.rotation.x = Math.sin(stride + phase) * 0.77 * amplitude;
  }

  return { root, animate };
}

function createGlider(parent) {
  const wing = new THREE.Group();
  wing.position.y = 2.42;
  const position = [];
  const colors = [];
  for (const side of [-1, 1]) {
    const vertices = [
      [0, 0.23, -1.12], [side * 1.65, 0, -0.51], [side * 3.75, -0.24, 0.89],
      [side * 2.17, -0.18, 1.08], [side * 0.68, -0.02, 1.68], [0, 0.18, 0.64],
    ];
    const panels = [[0, 1, 5], [1, 2, 3], [1, 3, 5], [3, 4, 5]];
    const color = new THREE.Color();
    panels.forEach((panel, index) => {
      color.setHex([0xb2845c, 0x70463a, 0xa15d4a, 0xd0a577][index]);
      for (const point of panel) {
        position.push(...vertices[point]);
        colors.push(color.r, color.g, color.b);
      }
    });
  }
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  sail.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const canvas = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true, roughness: 0.96 });
  wing.add(new THREE.Mesh(sail, canvas));

  const frame = new THREE.CylinderGeometry(0.035, 0.047, 1, 5);
  const wood = new THREE.MeshBasicMaterial({ color: 0x453127 });
  const axis = new THREE.Vector3(0, 1, 0);
  const up = new THREE.Vector3();
  for (const [start, end] of [
    [[0, 0.23, -1.12], [-3.75, -0.24, 0.89]],
    [[0, 0.23, -1.12], [3.75, -0.24, 0.89]],
    [[0, 0.22, -1.12], [0, 0.16, 1.18]],
    [[-1.65, 0, -0.51], [-0.28, -1.04, -0.15]],
    [[1.65, 0, -0.51], [0.28, -1.04, -0.15]],
  ]) {
    const beam = new THREE.Mesh(frame, wood);
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    beam.position.copy(a).lerp(b, 0.5);
    up.subVectors(b, a);
    beam.scale.y = up.length();
    beam.quaternion.setFromUnitVectors(axis, up.normalize());
    wing.add(beam);
  }
  bakeColoredParts(wing, canvas);
  sail.dispose();
  frame.dispose();
  wood.dispose();
  parent.add(wing);
  return wing;
}

export function createTraversal({ scene, camera, canvas, model, stream, controls = {}, spawn = model.spawn }) {
  const input = createInput(canvas, controls);
  const player = new THREE.Group();
  const avatar = createAvatar();
  player.add(avatar.root);
  scene.add(player);
  const position = player.position;
  const mount = createStag(player);
  const glider = createGlider(player);
  const anchor = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0.34;
  let wantedYaw = yaw;
  let wantedPitch = pitch;
  let zoom = 0;
  let wantedZoom = 0;
  let lift = 0;
  let travel = 'walk';
  let mode = 'Laufen';
  let grounded = true;
  let gliding = false;
  let availableJump = 0;
  let age = 0;

  function groundAt(x, z) {
    const floor = model.heightAt(x, z);
    return floor < model.waterLevel - 0.8 && model.isWet(x, z) ? model.waterLevel - 0.8 : floor;
  }

  function setTravelMode(value) {
    if (value !== 'walk' && value !== 'ride' && value !== 'fly') return;
    if (travel === value) return;
    if (value === 'fly') {
      position.y = Math.max(position.y, groundAt(position.x, position.z) + 6);
      velocity.y = 0;
      grounded = false;
    }
    if (travel === 'fly') velocity.y = 0;
    travel = value;
    gliding = false;
    availableJump = 0;
  }

  function moveCamera(dt, instant = false) {
    const factor = instant ? 1 : 1 - Math.exp(-dt * 9);
    anchor.lerp(position, factor);
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);
    const portrait = camera.aspect < 0.82;
    const distance = clamp((portrait ? 8.1 : 9.5) + zoom + (travel !== 'walk' || gliding ? 3.1 : 0), 4.6, 25);
    const radius = Math.cos(pitch) * distance;
    const cameraX = anchor.x + sine * radius;
    const cameraZ = anchor.z + cosine * radius;
    const focusY = anchor.y + (mount.root.visible ? 2.25 : 1.35);
    const cameraY = focusY + Math.sin(pitch) * distance + 0.25;

    let neededLift = 0;
    for (let i = 1; i <= 5; i++) {
      const fraction = i / 5;
      const x = anchor.x + (cameraX - anchor.x) * fraction;
      const z = anchor.z + (cameraZ - anchor.z) * fraction;
      const y = focusY + (cameraY - focusY) * fraction;
      neededLift = Math.max(neededLift, (model.heightAt(x, z) + 0.68 - y) / fraction);
    }
    lift = Math.max(neededLift, instant ? 0 : lift * Math.exp(-dt * 7));
    camera.position.set(cameraX, cameraY + lift, cameraZ);
    const lead = travel === 'walk' ? 1.2 : 2;
    aim.set(anchor.x - sine * lead, focusY, anchor.z - cosine * lead);
    camera.lookAt(aim);
  }

  function teleport(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const px = clamp(x, -EDGE, EDGE);
    const pz = clamp(z, -EDGE, EDGE);
    position.set(px, groundAt(px, pz) + (travel === 'fly' ? 6 : 0), pz);
    velocity.set(0, 0, 0);
    availableJump = 0;
    grounded = travel !== 'fly';
    gliding = false;
    avatar.reset();
    input.reset();
    moveCamera(0, true);
  }

  function moveHorizontally(dt) {
    const x = position.x;
    const z = position.z;
    const targetX = clamp(x + velocity.x * dt, -EDGE, EDGE);
    const targetZ = clamp(z + velocity.z * dt, -EDGE, EDGE);
    if (x === targetX && z === targetZ) return;
    const radius = travel === 'ride' ? 0.65 : 0.37;
    const distance = Math.hypot(targetX - x, targetZ - z);
    const colliders = stream?.nearbySolids(x, z, distance + radius) ?? [];
    function canMove(nextX, nextZ) {
      const floor = groundAt(nextX, nextZ);
      if (floor - position.y > Math.hypot(nextX - x, nextZ - z) * 1.4 + 0.075) return false;
      for (const solid of colliders) {
        if (position.y > solid.y + Math.min(6, 1.45 + solid.radius * 1.45)) continue;
        const oldSquared = (x - solid.x) ** 2 + (z - solid.z) ** 2;
        const newSquared = (nextX - solid.x) ** 2 + (nextZ - solid.z) ** 2;
        if (newSquared < (radius + solid.radius) ** 2 && newSquared < oldSquared + 1e-6) return false;
      }
      return true;
    }

    if (canMove(targetX, targetZ)) {
      position.x = targetX;
      position.z = targetZ;
      return;
    }
    if (targetX !== x && canMove(targetX, z)) position.x = targetX;
    else if (targetZ !== z && canMove(x, targetZ)) position.z = targetZ;
    if (position.x === x) velocity.x = 0;
    if (position.z === z) velocity.z = 0;
  }

  function simulate(dt, state) {
    const { sprint, rise, descend, x, z } = state;
    const flying = travel === 'fly';
    const beforeX = position.x;
    const beforeZ = position.z;
    const terrain = model.heightAt(beforeX, beforeZ);
    const water = terrain < model.waterLevel - 0.55 && model.isWet(beforeX, beforeZ);
    const floor = water ? Math.max(terrain, model.waterLevel - 0.8) : terrain;
    const swimming = !flying && water && position.y < model.waterLevel - 0.26;
    const mounted = travel === 'ride' && !swimming;
    const speed = flying ? (sprint ? 105 : 57) : gliding ? 22
      : swimming ? 4.4 : mounted ? (sprint ? 26 : 16) : sprint ? 9.8 : 6.2;
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);
    const localZ = gliding && z > -0.55 ? -0.55 : z;
    const magnitude = Math.max(1, Math.hypot(x, localZ));
    const targetX = (x * cosine + localZ * sine) * speed / magnitude;
    const targetZ = (localZ * cosine - x * sine) * speed / magnitude;
    const response = 1 - Math.exp(-dt * (flying || gliding ? 3.6 : grounded ? 14 : 7));
    velocity.x += (targetX - velocity.x) * response;
    velocity.z += (targetZ - velocity.z) * response;
    if (Math.abs(velocity.x) < 0.005 && Math.abs(targetX) < 0.005) velocity.x = 0;
    if (Math.abs(velocity.z) < 0.005 && Math.abs(targetZ) < 0.005) velocity.z = 0;

    if (availableJump > 0) {
      if (grounded && !swimming && !flying) {
        grounded = false;
        velocity.y = mounted ? 8.4 : 7.2;
        availableJump = 0;
      } else {
        availableJump = Math.max(0, availableJump - dt);
      }
    }

    moveHorizontally(dt);
    const distance = Math.hypot(position.x - beforeX, position.z - beforeZ);
    const newFloor = distance === 0 ? floor : groundAt(position.x, position.z);
    if (flying) {
      const climb = (Number(rise) - Number(descend)) * 28;
      const pitchVelocity = clamp(0.34 - pitch, -0.66, 0.66) * -z * speed * 0.47;
      velocity.y += (climb + pitchVelocity - velocity.y) * response;
      position.y = clamp(position.y + velocity.y * dt, newFloor + 4, Math.max(newFloor + 12, 1200));
    } else if (grounded && floor - newFloor < distance * 1.35 + 0.085) {
      position.y = newFloor;
      velocity.y = 0;
    } else {
      grounded = false;
      velocity.y = gliding ? Math.max(-3.25, velocity.y - 7.5 * dt) : velocity.y - 19 * dt;
      position.y += velocity.y * dt;
      if (position.y <= newFloor) {
        position.y = newFloor;
        grounded = true;
        gliding = false;
        velocity.y = 0;
      }
    }

    let turned = 0;
    if (distance / dt > 0.22) {
      const target = Math.atan2(beforeX - position.x, beforeZ - position.z);
      turned = wrapAngle(target - player.rotation.y) * (1 - Math.exp(-dt * 13));
      player.rotation.y += turned;
    }
    mount.root.visible = mounted;
    glider.visible = gliding || flying;
    mount.animate(dt, mounted ? distance / dt : 0);
    avatar.root.position.y = mounted
      ? 1.18 + mount.root.position.y
      : swimming ? Math.sin(age * 5) * 0.08 : 0;
    avatar.root.scale.setScalar(mounted ? 0.9 : 1);
    glider.rotation.z = clamp(-turned / dt * 0.16, -0.46, 0.46);
    avatar.animate(dt, mounted || flying ? 0 : Math.min(distance / dt, 10), grounded, velocity.y, turned / dt);
    mode = flying ? 'Fliegen' : gliding ? 'Gleiten' : swimming ? 'Schwimmen' : mounted ? 'Reiten'
      : sprint && distance > 0 ? 'Sprint' : 'Laufen';
  }

  function update(dt) {
    const elapsed = Math.min(0.09, Math.max(0, dt));
    if (!elapsed) return;
    age += elapsed;
    const state = input.sample();
    wantedYaw = wrapAngle(wantedYaw - state.lookX * 0.007);
    wantedPitch = clamp(wantedPitch + state.lookY * 0.007, -0.48, 1.1);
    wantedZoom = clamp(wantedZoom + state.zoom, -4.3, 13);
    const blend = 1 - Math.exp(-elapsed * 23);
    yaw = wrapAngle(yaw + wrapAngle(wantedYaw - yaw) * blend);
    pitch += (wantedPitch - pitch) * blend;
    zoom += (wantedZoom - zoom) * blend;
    if (state.jump && travel !== 'fly') {
      if (!grounded && travel === 'walk' && position.y - groundAt(position.x, position.z) > 0.28) {
        gliding = !gliding;
        if (gliding) velocity.y = clamp(velocity.y, -3.25, 1.5);
      } else {
        availableJump = 0.13;
      }
    }
    const steps = Math.ceil(elapsed * STEPS_PER_SECOND);
    for (let i = 0; i < steps; i++) simulate(elapsed / steps, state);
    moveCamera(elapsed);
  }

  function dispose() {
    input.dispose();
    player.removeFromParent();
    const geometries = new Set();
    const materials = new Set();
    player.traverse(node => {
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      materials.add(node.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  mount.root.visible = glider.visible = false;
  teleport(spawn.x, spawn.z);
  return {
    update, teleport, setTravelMode, dispose, resetInput: input.reset,
    get position() { return position; },
    get heading() { return yaw; },
    get mode() { return mode; },
  };
}
