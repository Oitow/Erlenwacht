import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { MAX_PAYLOAD, chatData, joinData, poseData } from './protocol.js';

const MAX_ROOMS = 24;
const MAX_PEERS = 32;
const MAX_CONNECTIONS = 256;
const SNAPSHOT_INTERVAL = 100;
const HEARTBEAT_INTERVAL = 25_000;
const JOIN_TIMEOUT = 8_000;
const INTEREST_RADIUS_SQUARED = 65 ** 2;
const SNAPSHOT_BACKLOG = 64 * 1024;
const CLOSE_BACKLOG = 256 * 1024;

function bucket(capacity, refill, now) {
  return { capacity, refill, at: now, tokens: capacity };
}

function consume(limit, now) {
  limit.tokens = Math.min(limit.capacity, limit.tokens + (now - limit.at) * limit.refill / 1000);
  limit.at = now;
  if (limit.tokens < 1) return false;
  limit.tokens--;
  return true;
}

function isNear(a, b) {
  const x = b.x - a.x;
  const z = b.z - a.z;
  return x * x + z * z <= INTEREST_RADIUS_SQUARED;
}

function rejectUpgrade(socket, status) {
  socket.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
}

function acceptedOrigin(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (typeof origin !== 'string') return false;
  if (allowedOrigins.has(origin)) return true;
  const host = request.headers.host;
  return typeof host === 'string' && origin === 'http://' + host.toLowerCase();
}

export function attachRooms(server, allowedOrigins) {
  const socketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });
  const rooms = new Map();

  function send(socket, data, isSnapshot = false) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > CLOSE_BACKLOG) {
      socket.terminate();
      return;
    }
    if (isSnapshot && socket.bufferedAmount > SNAPSHOT_BACKLOG) return;
    socket.send(data);
  }

  function sendError(socket, message) {
    send(socket, JSON.stringify({ type: 'error', message }));
  }

  function checkJoin(peer, packet) {
    const data = packet.type === 'join' && joinData(packet);
    if (!data) {
      sendError(peer.socket, 'Raum, Name oder Protokollversion ist ungültig.');
      peer.socket.close(1008, 'Invalid join');
      return;
    }

    const { room, name } = data;
    let members = rooms.get(room);
    if (members?.size >= MAX_PEERS || (!members && rooms.size >= MAX_ROOMS)) {
      sendError(peer.socket, 'Der Raum oder Server ist voll.');
      peer.socket.close(1013, 'Room unavailable');
      return;
    }
    if (!members) {
      members = new Set();
      rooms.set(room, members);
    }
    peer.room = room;
    peer.name = name;
    members.add(peer);
    clearTimeout(peer.joinTimer);
    send(peer.socket, JSON.stringify({ type: 'welcome', id: peer.id, room }));
  }

  function receive(peer, data, isBinary) {
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    if (isBinary) {
      peer.socket.close(1003, 'Text frames only');
      return;
    }
    const now = performance.now();
    if (!consume(peer.messages, now)) {
      peer.socket.close(1008, 'Message limit exceeded');
      return;
    }

    let packet;
    try {
      packet = JSON.parse(data.toString());
    } catch {
      if (consume(peer.errors, now)) sendError(peer.socket, 'Ungültige Nachricht.');
      return;
    }
    if (!packet || typeof packet.type !== 'string') {
      if (consume(peer.errors, now)) sendError(peer.socket, 'Ungültige Nachricht.');
      return;
    }
    if (!peer.room) {
      checkJoin(peer, packet);
      return;
    }
    if (packet.type === 'pose') {
      if (!consume(peer.poses, now)) return;
      const pose = poseData(packet);
      if (pose) peer.pose = { id: peer.id, name: peer.name, ...pose };
      return;
    }
    if (packet.type === 'chat') {
      const message = chatData(packet);
      if (message && consume(peer.chat, now)) {
        const event = JSON.stringify({ type: 'chat', id: peer.id, name: peer.name, text: message });
        for (const member of rooms.get(peer.room)) send(member.socket, event);
      } else if (consume(peer.errors, now)) {
        sendError(peer.socket, message ? 'Du sendest Nachrichten zu schnell.' : 'Der Nachrichtentext ist ungültig.');
      }
      return;
    }
    if (consume(peer.errors, now)) sendError(peer.socket, 'Unbekannter Nachrichtentyp.');
  }

  socketServer.on('connection', socket => {
    const now = performance.now();
    const peer = {
      socket,
      id: randomUUID(),
      room: null,
      name: null,
      pose: null,
      joinTimer: setTimeout(() => socket.close(1008, 'Join timeout'), JOIN_TIMEOUT),
      messages: bucket(48, 30, now),
      poses: bucket(5, 20, now),
      chat: bucket(3, 0.3, now),
      errors: bucket(2, 1, now),
    };
    socket.alive = true;
    socket.on('pong', () => { socket.alive = true; });
    socket.on('message', (data, isBinary) => receive(peer, data, isBinary));
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      clearTimeout(peer.joinTimer);
      const members = rooms.get(peer.room);
      if (!members) return;
      members.delete(peer);
      if (members.size === 0) rooms.delete(peer.room);
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const path = request.url?.split('?', 1)[0];
    if (path !== '/ws') return rejectUpgrade(socket, '404 Not Found');
    if (!acceptedOrigin(request, allowedOrigins)) return rejectUpgrade(socket, '403 Forbidden');
    if (socketServer.clients.size >= MAX_CONNECTIONS) return rejectUpgrade(socket, '503 Service Unavailable');
    socketServer.handleUpgrade(request, socket, head, client => socketServer.emit('connection', client));
  });

  const snapshots = setInterval(() => {
    for (const members of rooms.values()) {
      for (const peer of members) {
        if (peer.socket.readyState !== WebSocket.OPEN || peer.socket.bufferedAmount > SNAPSHOT_BACKLOG) continue;
        const players = [];
        if (peer.pose) {
          for (const other of members) {
            if (other !== peer && other.pose && isNear(peer.pose, other.pose)) players.push(other.pose);
          }
        }
        send(peer.socket, JSON.stringify({ type: 'snapshot', count: members.size, players }), true);
      }
    }
  }, SNAPSHOT_INTERVAL);

  const heartbeat = setInterval(() => {
    for (const socket of socketServer.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL);

  server.on('close', () => {
    clearInterval(snapshots);
    clearInterval(heartbeat);
    for (const socket of socketServer.clients) socket.close(1001, 'Server shutdown');
    socketServer.close();
  });
}
