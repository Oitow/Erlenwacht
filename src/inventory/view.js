import { INVENTORY_CAPACITY } from './inventory.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountInventory({ dialog, inventory, onUse, onOpenChange }) {
  const sheet = element('div', 'bag-sheet');
  const header = element('header', 'bag-header');
  const heading = element('h2', 'bag-title', 'Tasche');
  heading.id = 'inventory-title';
  const capacity = element('p', 'bag-capacity');
  capacity.setAttribute('aria-live', 'polite');
  const headingGroup = element('div', 'bag-title-group');
  headingGroup.append(heading, capacity);

  const closeButton = element('button', 'bag-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Tasche schließen');
  closeButton.autofocus = true;
  closeButton.addEventListener('click', () => dialog.close());
  header.append(headingGroup, closeButton);

  const list = element('ul', 'bag-items');
  const empty = element('p', 'bag-empty', 'Deine Tasche ist leer.');
  const feedback = element('p', 'bag-feedback');
  feedback.setAttribute('role', 'status');
  sheet.append(header, feedback, list, empty);
  dialog.replaceChildren(sheet);
  dialog.addEventListener('close', () => {
    if (!dialog.open) onOpenChange?.(false);
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  function render() {
    const slots = inventory.slots();
    const activeItem = document.activeElement?.dataset?.bagAction;
    const rows = document.createDocumentFragment();
    let focusTarget;

    for (const [index, { item, quantity, equipped }] of slots.entries()) {
      const row = element('li', 'bag-item');
      row.dataset.kind = item.kind;
      if (item.rarity) row.dataset.rarity = item.rarity;
      const glyph = element('span', 'bag-glyph', item.glyph);
      glyph.setAttribute('aria-hidden', 'true');
      const details = element('div', 'bag-details');
      const name = element('span', 'bag-name', item.name + (quantity > 1 ? ' ×' + quantity : ''));
      const description = element('p', 'bag-description', item.description);
      details.append(name, description);
      row.append(glyph, details);

      if (equipped) {
        const state = element('span', 'bag-equipped', 'Angelegt');
        row.append(state);
      } else if (item.kind === 'consumable' || (item.kind === 'equipment' && inventory.equipped(item.equipmentSlot) !== item.id)) {
        const usable = item.kind === 'consumable';
        const action = element('button', 'bag-action', usable ? 'Trinken' : 'Anlegen');
        action.type = 'button';
        action.dataset.bagAction = item.id + ':' + index;
        action.setAttribute('aria-label', item.name + (usable ? ' trinken' : ' anlegen'));
        action.addEventListener('click', () => {
          if (usable) {
            const used = onUse(item.id);
            if (used === true) feedback.textContent = 'Du hast einen Heiltrank getrunken.';
            if (used === false) feedback.textContent = 'Dein Leben ist bereits voll.';
          } else if (inventory.equip(item.id)) {
            feedback.textContent = item.name + ' angelegt.';
          }
        });
        row.append(action);
        if (activeItem === action.dataset.bagAction) focusTarget = action;
      }
      if (!equipped) {
        const discard = element('button', 'bag-action bag-discard', '×');
        discard.type = 'button';
        discard.dataset.bagAction = 'discard:' + index;
        discard.setAttribute('aria-label', item.name + ' wegwerfen');
        discard.addEventListener('click', () => {
          if (window.confirm(item.name + ' wegwerfen?') && inventory.discard(index)) {
            feedback.textContent = item.name + ' weggeworfen.';
            closeButton.focus({ preventScroll: true });
          }
        });
        row.append(discard);
      }
      rows.append(row);
    }

    capacity.textContent = slots.length + ' von ' + INVENTORY_CAPACITY + ' Plätzen belegt';
    list.replaceChildren(rows);
    empty.hidden = slots.length > 0;
    if (activeItem) (focusTarget ?? closeButton).focus({ preventScroll: true });
  }

  inventory.subscribe(() => {
    if (dialog.open) render();
  });

  return {
    toggle() {
      if (dialog.open) {
        dialog.close();
      } else {
        feedback.textContent = '';
        render();
        dialog.showModal();
        onOpenChange?.(true);
      }
    },
    close() {
      if (dialog.open) dialog.close();
    },
    isOpen() {
      return dialog.open;
    },
  };
}
