const KEY_ACTIONS = new Map([
  ['Space', 'cast'],
  ['KeyF', 'breakSeal'],
  ['KeyQ', 'jump'],
  ['KeyE', 'interact'],
  ['KeyI', 'inventory'],
  ['KeyB', 'inventory'],
  ['KeyR', 'auto'],
]);
const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);

export function createInput({ canvas, stick, nub }) {
  const keys = new Set();
  const actions = new Set();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let stickPointer = null;
  let lookPointer = null;
  let stickX = 0;
  let stickZ = 0;
  let lastLookX = 0;
  let lastLookY = 0;
  let lookX = 0;
  let lookY = 0;

  function stopStick() {
    stickPointer = null;
    stickX = 0;
    stickZ = 0;
    nub.style.transform = '';
  }

  function clear() {
    const previousStick = stickPointer;
    const previousLook = lookPointer;
    keys.clear();
    actions.clear();
    stopStick();
    lookPointer = null;
    lookX = 0;
    lookY = 0;
    if (previousStick !== null && stick.hasPointerCapture(previousStick)) {
      stick.releasePointerCapture(previousStick);
    }
    if (previousLook !== null && canvas.hasPointerCapture(previousLook)) {
      canvas.releasePointerCapture(previousLook);
    }
  }

  function trigger(action) {
    actions.add(action);
  }

  function sample() {
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight'))
      - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stickX;
    const z = Number(keys.has('KeyS') || keys.has('ArrowDown'))
      - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stickZ;
    const movementMagnitude = Math.max(1, Math.hypot(x, z));
    const input = {
      x: x / movementMagnitude,
      z: z / movementMagnitude,
      jump: actions.has('jump'),
      cast: actions.has('cast'),
      breakSeal: actions.has('breakSeal'),
      interact: actions.has('interact'),
      inventory: actions.has('inventory'),
      auto: actions.has('auto'),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      lookX,
      lookY,
    };
    actions.clear();
    lookX = 0;
    lookY = 0;
    return input;
  }

  function updateStick(event) {
    const bounds = stick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.35);
    const x = event.clientX - bounds.left - bounds.width / 2;
    const z = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(x, z);
    const magnitude = Math.max(0, Math.min(1, (length / radius - 0.12) / 0.88));
    stickX = x / Math.max(1, length) * magnitude;
    stickZ = z / Math.max(1, length) * magnitude;
    nub.style.transform = 'translate(' + stickX * radius + 'px, ' + stickZ * radius + 'px)';
  }

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    const element = event.target;
    if (element instanceof HTMLElement) {
      if (element.isContentEditable || element.matches('input, textarea, select')) return;
      if (event.code === 'Space' && element.matches('button, a, [role="button"]')) return;
    }
    const action = KEY_ACTIONS.get(event.code);
    if (MOVEMENT_KEYS.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    } else if (action) {
      event.preventDefault();
      if (!event.repeat) trigger(action);
    }
  }, options);
  window.addEventListener('keyup', (event) => keys.delete(event.code), options);
  window.addEventListener('blur', clear, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  }, options);

  stick.addEventListener('pointerdown', (event) => {
    if (stickPointer !== null || event.button !== 0) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    updateStick(event);
  }, options);
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) updateStick(event);
  }, options);
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(eventName, (event) => {
      if (event.pointerId === stickPointer) stopStick();
    }, options);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (lookPointer !== null || event.button !== 0) return;
    event.preventDefault();
    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }, options);
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookPointer) return;
    lookX += event.clientX - lastLookX;
    lookY += event.clientY - lastLookY;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
  }, options);
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(eventName, (event) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    }, options);
  }

  function destroy() {
    clear();
    listeners.abort();
  }

  return { sample, trigger, clear, destroy };
}
