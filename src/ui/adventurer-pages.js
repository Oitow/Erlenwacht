const RECIPE_REASONS = {
  locked: 'Dein Berufsrang reicht noch nicht.',
  materials: 'Dir fehlen Zutaten.',
  full: 'Dein Beutel ist voll.',
  owned: 'Dieses Stück ist bereits in deinem Beutel.',
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function choice({ id, name, description, action, disabled, active, onClick }) {
  const row = element('li');
  const text = element('div', '', 'choice-details');
  text.append(element('h4', name));
  if (description) text.append(element('p', description));
  const button = element('button', action);
  button.type = 'button';
  button.dataset.choice = id;
  button.disabled = disabled;
  button.setAttribute('aria-label', name + ' · ' + action);
  button.addEventListener('click', onClick);
  if (active) row.classList.add('active-choice');
  row.append(text, button);
  return { row, text, button };
}

export function classAbilities(item) {
  return [item?.spell ?? item?.primary, item?.arc ?? item?.secondary, item?.seal];
}

export function mountAdventurerPages(byId, callbacks, close) {
  const ranks = byId('profession-ranks');
  let classState = {};
  let professionState = {};
  let travelState = {};

  function replaceChoices(page, items, render) {
    const list = byId(page + '-list');
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset?.choice : null;
    const rows = document.createDocumentFragment();
    let nextFocus;
    for (const item of items) {
      const { row, button } = render(item);
      if (focused === item.id && !button.disabled) nextFocus = button;
      rows.append(row);
    }
    list.replaceChildren(rows);
    if (focused) (nextFocus ?? byId(page + '-page-button')).focus({ preventScroll: true });
  }

  function renderClasses() {
    const { selected, choices = [], canChange = false, reason } = classState;
    const selectedName = choices.find(item => item.id === selected)?.name;
    byId('classes-summary').textContent = canChange
      ? selectedName ? 'Aktiv · ' + selectedName : 'Wähle deine Klasse.'
      : reason ?? (selectedName ? 'Aktiv · ' + selectedName : 'Klassenwahl ist hier gesperrt.');
    const feedback = byId('classes-feedback');
    replaceChoices('classes', choices, item => {
      const active = item.id === selected;
      const entry = choice({
        ...item,
        action: active ? 'Aktiv' : 'Wählen',
        disabled: active || !canChange,
        active,
        onClick() {
          feedback.textContent = callbacks.onClass?.(item.id)
            ? item.name + ' gewählt.'
            : 'Du kannst die Klasse gerade nicht wechseln.';
        },
      });
      const abilities = classAbilities(item).slice(0, 2);
      for (const [index, ability] of abilities.entries()) {
        if (!ability) continue;
        const name = typeof ability === 'string' ? ability : ability.name;
        const detail = element('p', '', 'class-ability');
        const key = element('kbd', index === 0 ? 'Leertaste' : 'C');
        detail.append(key, document.createTextNode(' ' + name));
        if (ability.description) detail.append(document.createTextNode(' · ' + ability.description));
        entry.text.append(detail);
      }
      return entry;
    });
  }

  function renderProfessions() {
    const { atWorkbench, professions = [], recipes = [] } = professionState;
    byId('professions-summary').textContent = atWorkbench
      ? 'Werkbank in Reichweite.'
      : 'Geh zu einer Werkbank, um Rezepte herzustellen.';
    const rows = document.createDocumentFragment();
    const names = new Map();
    for (const { id, name, rank, xp, nextXp } of professions) {
      names.set(id, name);
      const row = element('li');
      row.append(element('strong', name), element('span', 'Rang ' + rank));
      if (nextXp > 0) {
        const progress = element('progress');
        progress.max = nextXp;
        progress.value = xp;
        progress.setAttribute('aria-label', name + ' · ' + xp + ' von ' + nextXp + ' Berufs-EP');
        row.append(progress);
      }
      rows.append(row);
    }
    ranks.replaceChildren(rows);
    const feedback = byId('professions-feedback');
    replaceChoices('professions', recipes, recipe => {
      const { id, name, description, profession, rank, available, reason, quantity = 1 } = recipe;
      const title = quantity > 1 ? name + ' ×' + quantity : name;
      const entry = choice({
        id, name: title, description,
        action: 'Herstellen',
        disabled: !atWorkbench || !available,
        onClick() {
          feedback.textContent = callbacks.onCraft?.(id)
            ? title + ' hergestellt.'
            : 'Dieses Rezept lässt sich gerade nicht herstellen.';
        },
      });
      if (profession) entry.text.append(element('p', (names.get(profession) ?? profession) + ' · Rang ' + rank, 'recipe-rank'));
      const ingredients = recipe.ingredients ?? recipe.materials ?? [];
      const costs = element('ul', '', 'recipe-costs');
      for (const material of ingredients) {
        const owned = material.owned ?? material.have;
        const required = material.required ?? material.need;
        const cost = element('li', material.name + ' ' + owned + '/' + required);
        if (owned < required) cost.classList.add('missing');
        costs.append(cost);
      }
      if (ingredients.length) entry.text.append(costs);
      if (reason && reason !== 'materials') entry.text.append(element('p', RECIPE_REASONS[reason] ?? reason));
      return entry;
    });
  }

  function renderTravel() {
    const { canTravel, reason, destinations = [] } = travelState;
    byId('travel-summary').textContent = reason || (canTravel
      ? 'Wähle einen entdeckten Rastpunkt.'
      : 'Geh zu einem Wegstein, um zu reisen.');
    const feedback = byId('travel-feedback');
    replaceChoices('travel', destinations, destination => {
      const { id, name, description, unlocked, current, available = true } = destination;
      return choice({
        id, name, description,
        action: current ? 'Hier' : unlocked ? 'Reisen' : 'Unentdeckt',
        disabled: current || !unlocked || !canTravel || !available,
        active: current,
        onClick() {
          if (callbacks.onTravel?.(id)) close();
          else feedback.textContent = 'Dieser Rastpunkt ist gerade nicht erreichbar.';
        },
      });
    });
  }

  const render = { classes: renderClasses, professions: renderProfessions, travel: renderTravel };
  return {
    show(page) {
      if (!Object.hasOwn(render, page)) return;
      byId(page + '-feedback').textContent = '';
      render[page]();
    },
    classes(state, visible) {
      classState = state;
      if (visible) renderClasses();
    },
    professions(state, visible) {
      professionState = state;
      if (visible) renderProfessions();
    },
    travel(state, visible) {
      travelState = state;
      if (visible) renderTravel();
    },
  };
}
