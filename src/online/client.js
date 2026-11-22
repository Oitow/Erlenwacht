const VERSION = 1;
const POSE_INTERVAL_MS = 100;
const HANDSHAKE_TIMEOUT_MS = 9000;
const MAX_PLAYERS = 32;
const MAX_ATTEMPTS = 7;
const MAX_PACKET_SIZE = 16384;
const MAX_BUFFERED = 8192;
const OPEN = 1;
const RETRY_CODES = new Set([1001, 1005, 1006, 1011, 1012, 1013]);
const ROOM_PATTERN = /^[a-z0-9][a-z0-9-]{0,23}$/;
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

function cleanText(value, limit) {
  if (typeof value !== 'string') return '';
  const text = value.trim().normalize('NFC');
  if (text.length > limit || CONTROL_CHARACTERS.test(text)) return '';
  return text;
}

function endpoint(value) {
  try {
    const url = new URL(typeof value === 'string' ? value.trim() : '');
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) return null;
    if (url.pathname === '/') url.pathname = '/ws';
    return url;
  } catch {
    return null;
  }
}

function poseFrom(value) {
  if (!value) return null;
  const { x, y, z, yaw, speed, grounded } = value;
  if (![x, y, z, yaw, speed].every(Number.isFinite)
    || Math.abs(x) > 4096 || y < -256 || y > 1024 || Math.abs(z) > 4096
    || speed < 0 || speed > 32 || typeof grounded !== 'boolean') return null;
  return { x, y, z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), speed, grounded };
}

export function createOnlineClient({ onStatus, onSnapshot, onChat }) {
  let desired = null;
  let socket = null;
  let retryTimer = null;
  let handshakeTimer = null;
  let attempts = 0;
  let state = 'idle';
  let playerId = null;
  let joinedRoom = null;
  let joinedAt = 0;
  let nextPoseAt = 0;
  let parked = false;
  let disposed = false;

  function report(next, message = '') {
    state = next;
    onStatus({ state, message, room: joinedRoom ?? desired?.room ?? '', id: playerId });
  }

  function clearPeers() {
    playerId = null;
    joinedRoom = null;
    nextPoseAt = 0;
    onSnapshot({ count: 0, players: [] });
  }

  function clearRetry() {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  function clearHandshake() {
    clearTimeout(handshakeTimer);
    handshakeTimer = null;
  }

  function closeSocket() {
    clearHandshake();
    const previous = socket;
    socket = null;
    previous?.close();
  }

  function fail(message) {
    desired = null;
    report('error', message);
  }

  function retry() {
    if (!desired) return;
    if (attempts >= MAX_ATTEMPTS) {
      fail('Server nicht erreichbar. Verbinde dich erneut.');
      return;
    }
    const delay = Math.min(12000, 1000 * 2 ** attempts);
    attempts++;
    report('reconnecting', 'Verbindung verloren. Neuer Versuch …');
    retryTimer = setTimeout(() => {
      retryTimer = null;
      resume();
    }, delay);
  }

  function send(data) {
    if (socket?.readyState !== OPEN || socket.bufferedAmount > MAX_BUFFERED) return false;
    try {
      socket.send(JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function receiveSnapshot(packet) {
    if (!Number.isInteger(packet.count) || packet.count < 1 || packet.count > MAX_PLAYERS
      || !Array.isArray(packet.players) || packet.players.length >= MAX_PLAYERS) return;
    const players = [];
    const ids = new Set([playerId]);
    for (const entry of packet.players) {
      const pose = poseFrom(entry);
      const id = cleanText(entry?.id, 64);
      const name = cleanText(entry?.name, 24);
      if (!pose || !id || !name || ids.has(id)) continue;
      ids.add(id);
      players.push({ id, name, ...pose });
    }
    onSnapshot({ count: Math.max(packet.count, players.length + 1), players });
  }

  function openSocket() {
    const { url, room, name } = desired;
    let current;
    try {
      current = new WebSocket(url);
    } catch {
      fail('WebSocket konnte nicht geöffnet werden.');
      return;
    }
    socket = current;
    let joinError = '';

    current.addEventListener('open', () => {
      if (socket !== current) return;
      send({ type: 'join', version: VERSION, room, name });
    });
    current.addEventListener('message', event => {
      if (socket !== current || typeof event.data !== 'string' || event.data.length > MAX_PACKET_SIZE) return;
      let packet;
      try {
        packet = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!packet || typeof packet !== 'object') return;

      if (packet.type === 'error') {
        const message = cleanText(packet.message, 200) || 'Der Server hat die Anfrage abgelehnt.';
        if (playerId) report('connected', message);
        else {
          joinError = message;
          report(state, message);
        }
        return;
      }
      if (packet.type === 'welcome' && !playerId) {
        const id = cleanText(packet.id, 64);
        if (!id || packet.room !== room) return;
        clearHandshake();
        playerId = id;
        joinedRoom = room;
        joinedAt = performance.now();
        report('connected');
        return;
      }
      if (!playerId) return;
      if (packet.type === 'snapshot') receiveSnapshot(packet);
      if (packet.type === 'chat') {
        const id = cleanText(packet.id, 64);
        const name = cleanText(packet.name, 24);
        const text = cleanText(packet.text, 160);
        if (id && name && text) onChat({ id, name, text, self: id === playerId });
      }
    });
    current.addEventListener('close', event => {
      if (socket !== current) return;
      socket = null;
      clearHandshake();
      if (playerId && performance.now() - joinedAt >= 10000) attempts = 0;
      clearPeers();
      if (RETRY_CODES.has(event.code)) {
        retry();
        return;
      }
      fail(joinError || 'Der Server hat die Verbindung geschlossen.');
    });
    handshakeTimer = setTimeout(() => {
      if (socket !== current) return;
      closeSocket();
      clearPeers();
      if (joinError) fail(joinError);
      else retry();
    }, HANDSHAKE_TIMEOUT_MS);
  }

  function resume() {
    if (desired && !socket && retryTimer === null && !parked && !document.hidden) openSocket();
  }

  function connect({ url, room, name } = {}) {
    if (disposed) return false;
    const address = endpoint(url);
    const roomName = typeof room === 'string' ? room.trim().toLowerCase() : '';
    const displayName = cleanText(name, 24);
    let error = '';
    if (!address) error = 'Gib eine gültige ws://- oder wss://-Adresse ein.';
    else if (location.protocol === 'https:' && address.protocol !== 'wss:') {
      error = 'Auf HTTPS brauchst du eine wss://-Adresse.';
    } else if (!ROOM_PATTERN.test(roomName)) {
      error = 'Der Raumname braucht 1–24 Buchstaben, Ziffern oder Bindestriche.';
    } else if (!displayName) {
      error = 'Gib einen Spielernamen mit 1–24 Zeichen ein.';
    }
    if (error) {
      report(desired ? state : 'error', error);
      return false;
    }

    clearRetry();
    closeSocket();
    clearPeers();
    attempts = 0;
    desired = { url: address.href, room: roomName, name: displayName };
    report('connecting', 'Verbinde mit dem Server …');
    resume();
    return desired !== null;
  }

  function disconnect() {
    desired = null;
    clearRetry();
    closeSocket();
    clearPeers();
    report('idle');
  }

  function update(_dt, pose) {
    if (!playerId || document.hidden) return;
    const now = performance.now();
    if (now < nextPoseAt) return;
    const sample = poseFrom(pose);
    if (!sample) return;
    nextPoseAt = now + POSE_INTERVAL_MS;
    send({ type: 'pose', ...sample });
  }

  function chat(value) {
    if (!playerId || document.hidden) return false;
    const text = cleanText(value, 160);
    return Boolean(text && send({ type: 'chat', text }));
  }

  function onVisibilityChange() {
    if (document.hidden) return;
    nextPoseAt = 0;
    resume();
  }

  function onPageHide(event) {
    if (!event.persisted) {
      dispose();
      return;
    }
    parked = true;
    clearRetry();
    closeSocket();
    if (desired) {
      clearPeers();
      report('reconnecting', 'Verbindung wird beim Zurückkehren erneuert.');
    }
  }

  function onPageShow(event) {
    if (!event.persisted) return;
    parked = false;
    resume();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  return {
    connect,
    disconnect,
    update,
    chat,
    dispose,
    get connected() { return playerId !== null && socket?.readyState === OPEN; },
  };
}
