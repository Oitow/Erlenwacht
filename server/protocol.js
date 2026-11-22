export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD = 2048;

const CONTROLS = /[\p{Cc}\p{Cf}]/u;

function text(value, maxLength) {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFC').trim();
  return clean.length > 0 && clean.length <= maxLength && !CONTROLS.test(clean) ? clean : null;
}

export function joinData(packet) {
  if (typeof packet.room !== 'string' || packet.version !== PROTOCOL_VERSION) return null;
  const room = packet.room.trim().toLowerCase();
  const name = text(packet.name, 24);
  return name && /^[a-z0-9][a-z0-9-]{0,23}$/.test(room) ? { room, name } : null;
}

export function chatData(packet) {
  return text(packet.text, 160);
}

function between(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function round(value, precision = 100) {
  return Math.round(value * precision) / precision;
}

export function poseData(packet) {
  const { x, y, z, yaw, speed, grounded } = packet;
  if (!between(x, -4096, 4096) || !between(z, -4096, 4096) || !between(y, -256, 1024)
    || !between(yaw, -1e6, 1e6) || !between(speed, 0, 32) || typeof grounded !== 'boolean') return null;
  return {
    x: round(x), y: round(y), z: round(z),
    yaw: round(Math.atan2(Math.sin(yaw), Math.cos(yaw)), 1000),
    speed: round(Math.min(speed, 12)), grounded,
  };
}
