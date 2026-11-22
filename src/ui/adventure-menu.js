import { mountOnlineRoom } from './online-room.js';

const CHAT_LIMIT = 48;
const SECTIONS = ['menu', 'skills', 'online', 'chat'];

export function mountAdventureMenu(byId, callbacks) {
  const dialog = byId('adventure-menu');
  const closeButton = byId('menu-close');
  const autoButton = byId('menu-auto');
  const skillsList = byId('skills-list');
  const skillFeedback = byId('skill-feedback');
  const summary = byId('progress-summary');
  const unreadBadge = byId('chat-unread');
  const chatLog = byId('chat-log');
  const chatLines = byId('chat-lines');
  const chatEmpty = byId('chat-empty');
  const chatMode = byId('chat-mode');
  const chatForm = byId('chat-form');
  const chatMessage = byId('chat-message');
  const chatMessageLabel = byId('chat-message-label');
  const tabs = new Map(SECTIONS.map(id => [id, {
    section: byId(id + '-page'),
    button: byId(id + '-page-button'),
  }]));
  let page = 'menu';
  let progression = { level: 1, xp: 0, nextXp: 100, points: 0, skills: [] };

  function updateUnread() {
    const unread = chatLines.querySelectorAll('[data-unread]').length;
    unreadBadge.hidden = unread === 0;
    unreadBadge.textContent = unread > 9 ? '9+' : String(unread);
  }

  const online = mountOnlineRoom(byId, callbacks, (room, clearRoom, pending) => {
    chatMode.textContent = pending ? 'Raumchat · Warte auf Verbindung'
      : room ? 'Raumchat · ' + room : 'Lokaler Chat';
    chatMessageLabel.textContent = room ? 'Nachricht an den Raum' : 'Lokale Nachricht';
    if (clearRoom) {
      for (const line of chatLines.querySelectorAll('[data-channel="room"]')) line.remove();
      chatEmpty.hidden = chatLines.childElementCount > 0;
      updateUnread();
    }
  });

  function scrollChat() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderSkills() {
    const { level, xp, nextXp, points, skills = [] } = progression;
    const experience = nextXp > 0 ? xp + '/' + nextXp + ' EP' : 'Höchststufe';
    summary.textContent = 'Stufe ' + level + ' · ' + experience + ' · ' + points + (points === 1 ? ' freier Punkt' : ' freie Punkte');
    const focusedSkill = document.activeElement?.dataset?.skill;
    const rows = document.createDocumentFragment();
    let nextFocus;

    for (const skill of skills) {
      const { id, name, description, rank, maxRank, requirement } = skill;
      const unlocked = skill.unlocked ?? skill.available ?? true;
      const row = document.createElement('li');
      const details = document.createElement('div');
      const title = document.createElement('h3');
      const detail = document.createElement('p');
      title.textContent = name;
      detail.textContent = unlocked ? description : requirement ?? 'Im Abenteuer freischalten';
      details.append(title, detail);

      const upgrade = document.createElement('button');
      upgrade.type = 'button';
      upgrade.dataset.skill = id;
      upgrade.textContent = unlocked ? 'Rang ' + rank + '/' + maxRank : 'Gesperrt';
      upgrade.disabled = !unlocked || rank >= maxRank || points < 1 || skill.available === false;
      if (!upgrade.disabled) {
        upgrade.textContent = 'Rang ' + rank + '/' + maxRank + ' · +';
        upgrade.setAttribute('aria-label', name + ' auf Rang ' + (rank + 1) + ' verbessern');
      }
      upgrade.addEventListener('click', () => {
        const result = callbacks.onUpgrade?.(id);
        skillFeedback.textContent = result === false ? 'Diese Fähigkeit lässt sich gerade nicht verbessern.' : name + ' verbessert.';
      });
      if (focusedSkill === id && !upgrade.disabled) nextFocus = upgrade;
      row.append(details, upgrade);
      rows.append(row);
    }
    skillsList.replaceChildren(rows);
    if (focusedSkill) (nextFocus ?? tabs.get('skills').button).focus({ preventScroll: true });
  }

  function showPage(next) {
    page = next;
    for (const [id, { section, button }] of tabs) {
      section.hidden = id !== page;
      button.setAttribute('aria-pressed', String(id === page));
    }
    if (page === 'skills') {
      skillFeedback.textContent = '';
      renderSkills();
    }
    if (page === 'chat') {
      for (const line of chatLines.querySelectorAll('[data-unread]')) delete line.dataset.unread;
      updateUnread();
    }
  }

  function open(next, focusComposer = false) {
    const wasOpen = dialog.open;
    showPage(next);
    if (!wasOpen) {
      dialog.showModal();
      callbacks.onOpenChange?.(true);
    }
    if (page === 'chat') scrollChat();
    if (focusComposer && !chatForm.hidden) chatMessage.focus({ preventScroll: true });
    else tabs.get(page).button.focus({ preventScroll: true });
  }

  function close() {
    if (!dialog.open) return;
    dialog.close();
    callbacks.onOpenChange?.(false);
  }

  for (const [id, { button }] of tabs) {
    button.addEventListener('click', () => open(id));
    byId(id + '-button').addEventListener('click', () => open(id));
  }
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
  byId('menu-bag').addEventListener('click', () => {
    close();
    callbacks.onBag?.();
  });
  autoButton.addEventListener('click', () => callbacks.onToggleAuto?.());
  chatForm.hidden = typeof callbacks.onChat !== 'function';
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = chatMessage.value.trim();
    if (!message) return;
    if (callbacks.onChat?.(message) !== false) chatMessage.value = '';
    chatMessage.focus({ preventScroll: true });
  });

  return {
    isOpen: () => dialog.open,
    onlineStatus: online.status,
    onlineCount: online.count,
    handleActions(actions) {
      const next = SECTIONS.find(id => actions[id]);
      if (!next) return false;
      if (dialog.open && next === page && next !== 'chat') close();
      else open(next, next === 'chat');
      return true;
    },
    auto(active) {
      autoButton.setAttribute('aria-pressed', String(active));
    },
    progress(state) {
      progression = state;
      if (dialog.open && page === 'skills') renderSkills();
    },
    chat(author, message, channel = 'system') {
      const reading = dialog.open && page === 'chat';
      const follow = reading && chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 24;
      const line = document.createElement('li');
      const speaker = document.createElement('strong');
      line.dataset.channel = channel;
      if (!reading) line.dataset.unread = '';
      speaker.textContent = author;
      line.append(speaker, document.createTextNode(message));
      chatEmpty.hidden = true;
      chatLines.append(line);
      if (chatLines.childElementCount > CHAT_LIMIT) chatLines.firstElementChild.remove();
      if (follow) scrollChat();
      if (!reading) updateUnread();
    },
  };
}
