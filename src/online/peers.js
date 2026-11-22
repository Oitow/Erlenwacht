import {
  CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace,
} from 'three';
import { createPeerAvatarBatch } from '../character/avatar.js';

const PEER_RANGE = 65;
const NAME_RANGE = 24;
const MAX_AVATARS = 32;
const MAX_LABELS = 6;
const TELEPORT_DISTANCE = 5;

function isPlayer(player) {
  return player && typeof player.id === 'string' && player.id.length > 0
    && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z)
    && Number.isFinite(player.yaw) && Number.isFinite(player.speed)
    && typeof player.grounded === 'boolean';
}

function playerName(name) {
  if (typeof name !== 'string') return 'Wanderer';
  return name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim().slice(0, 24) || 'Wanderer';
}

function createNameLabel(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 52;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.font = '600 26px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const width = Math.min(context.measureText(name).width + 24, 248);
  context.fillStyle = 'rgba(13, 25, 29, 0.82)';
  context.fillRect((256 - width) / 2, 6, width, 40);
  context.fillStyle = '#e4fbf1';
  context.fillText(name, 128, 27, 228);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const sprite = new Sprite(new SpriteMaterial({
    map: texture, depthWrite: false, toneMapped: false, transparent: true,
  }));
  sprite.scale.set(2.85, 2.85 * canvas.height / canvas.width, 1);
  return sprite;
}

function placeAtTarget(peer) {
  peer.x = peer.target.x;
  peer.y = peer.target.y;
  peer.z = peer.target.z;
  peer.yaw = peer.target.yaw;
  peer.speed = Math.max(0, Math.min(9, peer.target.speed));
  peer.air = peer.target.grounded ? 0 : 1;
}

function removeNameLabel(scene, peer) {
  if (!peer.label) return;
  scene.remove(peer.label);
  peer.label.material.map.dispose();
  peer.label.material.dispose();
  peer.label = null;
}

export function createPeerView(scene, world) {
  const peers = new Map();
  const nearby = [];
  let batches;

  function applySnapshot(players, selfId) {
    if (!Array.isArray(players)) return;
    const active = new Set();
    for (const player of players) {
      if (!isPlayer(player) || player.id === selfId) continue;
      active.add(player.id);
      const name = playerName(player.name);
      let peer = peers.get(player.id);
      if (!peer) {
        peer = { name, target: player, phase: 0, label: null };
        placeAtTarget(peer);
        peers.set(player.id, peer);
        continue;
      }

      if (peer.name !== name) {
        removeNameLabel(scene, peer);
        peer.name = name;
      }
      const dx = player.x - peer.target.x;
      const dy = player.y - peer.target.y;
      const dz = player.z - peer.target.z;
      peer.target = player;
      if (dx * dx + dy * dy + dz * dz > TELEPORT_DISTANCE ** 2) {
        placeAtTarget(peer);
        peer.phase = 0;
      }
    }

    for (const [id, peer] of peers) {
      if (active.has(id)) continue;
      removeNameLabel(scene, peer);
      peers.delete(id);
    }
  }

  function update(dt, position) {
    nearby.length = 0;
    const blend = 1 - Math.exp(-dt * 14);
    for (const peer of peers.values()) {
      if (peer.label) peer.label.visible = false;
      const dx = peer.target.x - position.x;
      const dz = peer.target.z - position.z;
      peer.distance = dx * dx + dz * dz;
      if (peer.distance <= PEER_RANGE * PEER_RANGE) nearby.push(peer);
      else placeAtTarget(peer);
    }
    if (nearby.length === 0) {
      batches?.finish();
      return;
    }

    nearby.sort((first, second) => first.distance - second.distance);
    batches ??= createPeerAvatarBatch(scene, MAX_AVATARS);
    for (let i = 0; i < nearby.length; i++) {
      const peer = nearby[i];
      if (i >= MAX_AVATARS) {
        placeAtTarget(peer);
        continue;
      }
      const target = peer.target;
      peer.x += (target.x - peer.x) * blend;
      peer.y += (target.y - peer.y) * blend;
      peer.z += (target.z - peer.z) * blend;
      const yawDelta = target.yaw - peer.yaw;
      peer.yaw += Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)) * blend;
      peer.speed += (Math.max(0, Math.min(9, target.speed)) - peer.speed) * blend;
      peer.air += ((target.grounded ? 0 : 1) - peer.air) * blend;
      peer.phase = (peer.phase + dt * peer.speed * 2.25) % (Math.PI * 2);

      const ground = world.heightAt(peer.x, peer.z);
      const height = target.grounded && peer.air < 0.1 ? ground : Math.max(peer.y, ground);
      batches.add(peer, height);
      if (i >= MAX_LABELS || peer.distance > NAME_RANGE * NAME_RANGE) continue;
      if (!peer.label) {
        peer.label = createNameLabel(peer.name);
        if (!peer.label) continue;
        scene.add(peer.label);
      }
      peer.label.visible = true;
      peer.label.position.set(peer.x, height + 2.3, peer.z);
    }
    batches.finish();
  }

  function clear() {
    for (const peer of peers.values()) removeNameLabel(scene, peer);
    peers.clear();
    nearby.length = 0;
    batches?.finish();
  }

  return { applySnapshot, update, clear };
}
