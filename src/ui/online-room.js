const ROOM_CODE = /^[a-z0-9][a-z0-9-]{0,23}$/;
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;
const STATES = Object.freeze({
  idle: { title: 'Offline', detail: 'Du spielst allein.' },
  connecting: { title: 'Verbindet …', detail: 'Der Raum wird geöffnet.' },
  connected: { title: 'Online', detail: '' },
  reconnecting: { title: 'Verbindet erneut …', detail: 'Die Verbindung wird wiederhergestellt.' },
  error: { title: 'Verbindung fehlgeschlagen', detail: 'Prüfe Serveradresse und Raumcode.' },
});

function defaultEndpoint() {
  const { protocol, host } = window.location;
  if (!host) return 'ws://localhost:8080/ws';
  return (protocol === 'https:' ? 'wss://' : 'ws://') + host + '/ws';
}

export function mountOnlineRoom(byId, callbacks, onChatScope) {
  const launcher = byId('online-button');
  const status = byId('online-status');
  const stateText = byId('online-state');
  const statusMessage = byId('online-status-message');
  const peersText = byId('online-peers');
  const form = byId('online-form');
  const settings = byId('online-settings');
  const name = byId('online-name');
  const roomCode = byId('online-room');
  const url = byId('online-url');
  const advanced = byId('online-advanced');
  const connect = byId('online-connect');
  const disconnect = byId('online-disconnect');
  let current = { state: 'idle', room: '', id: '' };
  let joinedRoom = '';
  let joinedId = '';
  let peerCount = 0;

  url.value = defaultEndpoint();
  form.noValidate = true;
  connect.disabled = typeof callbacks.onConnect !== 'function';

  function fieldError(input, message) {
    if (input === url) advanced.open = true;
    input.setCustomValidity(message);
    input.reportValidity();
  }

  for (const field of [name, roomCode, url]) {
    field.addEventListener('input', () => field.setCustomValidity(''));
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (connect.hidden || connect.disabled) return;
    const player = name.value.normalize('NFC').trim();
    const room = roomCode.value.trim().toLowerCase();
    if (!player || player.length > 24 || CONTROL_CHARACTERS.test(player)) {
      fieldError(name, 'Gib einen Spielernamen mit 1 bis 24 Zeichen ein.');
      return;
    }
    if (!ROOM_CODE.test(room)) {
      fieldError(roomCode, 'Der Raumcode beginnt mit einem Buchstaben oder einer Ziffer und enthält höchstens 24 Buchstaben, Ziffern und Bindestriche.');
      return;
    }
    let endpoint;
    try {
      endpoint = new URL(url.value.trim());
    } catch {
      fieldError(url, 'Gib eine vollständige WebSocket-Adresse ein, zum Beispiel wss://example.com/ws.');
      return;
    }
    if (!['ws:', 'wss:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.hash) {
      fieldError(url, 'Verwende eine ws://- oder wss://-Adresse ohne Anmeldedaten und Fragment.');
      return;
    }
    if (window.location.protocol === 'https:' && endpoint.protocol !== 'wss:') {
      fieldError(url, 'Diese Seite verwendet HTTPS. Gib eine wss://-Adresse ein.');
      return;
    }
    name.value = player;
    roomCode.value = room;
    url.value = endpoint.href;
    callbacks.onConnect({ url: endpoint.href, room, name: player });
  });
  disconnect.addEventListener('click', () => callbacks.onDisconnect?.());

  function renderPeers() {
    const connected = current.state === 'connected';
    peersText.hidden = !connected;
    if (!connected) return;
    const summary = peerCount === 1 ? '1 weiterer Spieler' : peerCount + ' weitere Spieler';
    peersText.textContent = summary + ' im Raum';
    launcher.textContent = 'Online · ' + (peerCount + 1);
    launcher.setAttribute('aria-label', 'Online · ' + summary + ' · Raumeinstellungen');
  }

  return {
    status(next) {
      if (!Object.hasOwn(STATES, next.state)) return;
      current = next;
      const { state, message, room, id } = current;
      const label = STATES[state];
      const connected = state === 'connected';
      const active = connected || state === 'connecting' || state === 'reconnecting';
      const clearRoom = state === 'idle' || (connected && Boolean(joinedRoom) && (room !== joinedRoom || id !== joinedId));
      if (connected || state === 'idle') {
        joinedRoom = connected ? room : '';
        joinedId = connected ? id : '';
      }
      if (state === 'idle' || state === 'error') peerCount = 0;
      launcher.dataset.state = state;
      status.dataset.state = state;
      stateText.textContent = connected && room ? 'Online · ' + room : label.title;
      const detail = message || label.detail;
      statusMessage.hidden = !detail;
      statusMessage.textContent = detail;
      if (!connected) {
        launcher.textContent = active ? 'Verbinde …' : 'Offline';
        launcher.setAttribute('aria-label', label.title + ' · Raumeinstellungen');
      }
      settings.disabled = active;
      connect.hidden = active;
      disconnect.hidden = !active;
      disconnect.textContent = connected ? 'Verbindung trennen' : 'Abbrechen';
      renderPeers();
      onChatScope(active ? room : '', clearRoom, active && !connected);
    },
    count(count) {
      const nextCount = Number.isSafeInteger(count) && count >= 0 ? count : 0;
      if (peerCount === nextCount) return;
      peerCount = nextCount;
      renderPeers();
    },
  };
}
