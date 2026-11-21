const groupsRoot = document.getElementById('groups');
const status = document.getElementById('status');
const statusText = document.getElementById('status-text');
const summary = document.getElementById('summary');
const empty = document.getElementById('empty');
const collapseAll = document.getElementById('collapse-all');
const dropdown = document.getElementById('theme');
const trigger = dropdown.querySelector('button');
const menu = dropdown.querySelector('.menu');
const options = [...menu.querySelectorAll('[role="option"]')];
const themeValue = document.getElementById('theme-value');
const pageButtons = [...document.querySelectorAll('[data-page]')];
const cards = new Map();
const groups = new Map();

const ICON_PATHS = {
  replay: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6',
  chevron: 'M4 6l4 4 4-4',
};

let drawingTheme = remembered('ik-drawing-theme', 'auto');
let collapsed = new Set(JSON.parse(remembered('ik-collapsed', '[]')));
let activeIndex = 0;

function remembered(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the choice still applies for this visit.
  }
}

function icon(name, className) {
  const klass = className ? ` class="${className}"` : '';

  return `<svg${klass} viewBox="0 0 16 16" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;
}

function kilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function setStatus(state, text) {
  status.dataset.state = state;
  statusText.textContent = text;
}

function chip(text, tone) {
  const element = document.createElement('span');

  element.className = 'chip';
  element.textContent = text;

  if (tone) element.dataset.tone = tone;

  return element;
}

function iconButton(name, label, onClick) {
  const button = document.createElement('button');

  button.className = 'icon-button';
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = icon(name, name === 'chevron' ? 'chevron' : null);
  button.addEventListener('click', onClick);

  return button;
}

function folderOf(file) {
  const parts = file.split('/');

  return parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
}

function applyCollapsed(element, key, label) {
  const shut = collapsed.has(key);

  element.toggleAttribute('data-collapsed', shut);

  const toggle = element.querySelector(':scope > .group-head, :scope .collapse');

  if (toggle) toggle.setAttribute('aria-expanded', String(!shut));
  if (label) label.setAttribute('aria-label', `${shut ? 'Expand' : 'Collapse'} ${key.split('/').at(-1)}`);
}

function toggle(key) {
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);

  remember('ik-collapsed', JSON.stringify([...collapsed]));
  refreshCollapsed();
}

function refreshCollapsed() {
  for (const [folder, group] of groups) applyCollapsed(group, `folder:${folder}`, null);

  for (const [file, figure] of cards) {
    applyCollapsed(figure, file, figure.querySelector('.collapse'));
  }

  const everything = [...groups.keys()].map((f) => `folder:${f}`).concat([...cards.keys()]);
  const allShut = everything.length > 0 && everything.every((key) => collapsed.has(key));

  collapseAll.textContent = allShut ? 'Expand all' : 'Collapse all';
}

function group(folder) {
  const existing = groups.get(folder);

  if (existing) return existing;

  const section = document.createElement('section');
  const head = document.createElement('button');
  const grid = document.createElement('div');

  section.className = 'group';
  head.className = 'group-head';
  head.type = 'button';
  head.innerHTML = `${icon('chevron', 'chevron')}<b></b>`;
  head.querySelector('b').textContent = folder.split('/').at(-1);
  head.title = folder;
  head.append(chip('0'));
  head.addEventListener('click', () => toggle(`folder:${folder}`));
  grid.className = 'grid';

  section.append(head, grid);
  groupsRoot.append(section);
  groups.set(folder, section);

  return section;
}

function card(file) {
  const existing = cards.get(file);

  if (existing) return existing;

  const name = file.split('/').at(-1);
  const figure = document.createElement('figure');
  const art = document.createElement('div');
  const footer = document.createElement('footer');
  const title = document.createElement('span');
  const meta = document.createElement('span');
  const collapse = iconButton('chevron', `Collapse ${name}`, () => toggle(file));

  figure.className = 'card';
  art.className = 'art';
  art.innerHTML = '<div class="placeholder"></div>';
  title.className = 'name';
  title.textContent = name;
  meta.className = 'meta';
  collapse.classList.add('collapse');

  footer.append(collapse, title, meta, iconButton('replay', `Replay ${name}`, () => render(file)));
  figure.append(art, footer);
  group(folderOf(file)).querySelector('.grid').append(figure);
  cards.set(file, figure);

  return figure;
}

async function render(file) {
  const figure = card(file);
  const art = figure.querySelector('.art');
  const meta = figure.querySelector('.meta');

  figure.dataset.busy = '';

  const query = new URLSearchParams({ file, theme: drawingTheme });
  const body = await (await fetch(`/render?${query}`)).json();

  delete figure.dataset.busy;

  if (body.error) {
    const message = document.createElement('pre');

    message.className = 'error';
    message.textContent = body.error;
    art.replaceChildren(message);
    meta.replaceChildren(chip('failed', 'failed'));

    return;
  }

  art.innerHTML = body.svg;
  meta.replaceChildren(chip(kilobytes(body.svg.length)), chip(`${body.ms} ms`));
}

function prune(files) {
  for (const [file, figure] of cards) {
    if (!files.includes(file)) {
      figure.remove();
      cards.delete(file);
    }
  }

  for (const [folder, section] of groups) {
    const count = files.filter((file) => folderOf(file) === folder).length;

    if (count === 0) {
      section.remove();
      groups.delete(folder);
    } else {
      section.querySelector('.group-head .chip').textContent = String(count);
    }
  }
}

async function renderAll() {
  const files = await (await fetch('/scenes')).json();

  for (const file of files) card(file);

  prune(files);
  refreshCollapsed();

  empty.hidden = files.length > 0;
  collapseAll.hidden = files.length === 0;
  summary.textContent = files.length === 1 ? '1 sketch' : `${files.length} sketches`;

  await Promise.all(files.map(render));
}

function pickTheme(value) {
  drawingTheme = value;
  themeValue.textContent = value;
  remember('ik-drawing-theme', value);

  for (const option of options) {
    option.setAttribute('aria-selected', String(option.dataset.value === value));
  }
}

function highlight(index) {
  activeIndex = (index + options.length) % options.length;

  for (const [i, option] of options.entries()) {
    option.toggleAttribute('data-active', i === activeIndex);
  }
}

function openMenu() {
  menu.hidden = false;
  dropdown.dataset.open = '';
  trigger.setAttribute('aria-expanded', 'true');
  highlight(options.findIndex((o) => o.dataset.value === drawingTheme));
  menu.focus();
}

function closeMenu() {
  menu.hidden = true;
  delete dropdown.dataset.open;
  trigger.setAttribute('aria-expanded', 'false');
}

function choose(option) {
  const changed = option.dataset.value !== drawingTheme;

  pickTheme(option.dataset.value);
  closeMenu();
  trigger.focus();

  if (changed) renderAll();
}

function setPage(theme) {
  document.documentElement.dataset.theme = theme;
  remember('ik-page-theme', theme);

  for (const button of pageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.page === theme));
  }
}

trigger.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));

menu.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') highlight(activeIndex + 1);
  else if (event.key === 'ArrowUp') highlight(activeIndex - 1);
  else if (event.key === 'Enter' || event.key === ' ') choose(options[activeIndex]);
  else if (event.key === 'Escape') {
    closeMenu();
    trigger.focus();
  } else return;

  event.preventDefault();
});

for (const [i, option] of options.entries()) {
  option.addEventListener('mouseenter', () => highlight(i));
  option.addEventListener('click', () => choose(option));
}

document.addEventListener('pointerdown', (event) => {
  if (!menu.hidden && !dropdown.contains(event.target)) closeMenu();
});

for (const button of pageButtons) {
  button.addEventListener('click', () => setPage(button.dataset.page));
}

collapseAll.addEventListener('click', () => {
  const opening = collapseAll.textContent === 'Expand all';
  const everything = [...groups.keys()].map((f) => `folder:${f}`).concat([...cards.keys()]);

  collapsed = opening ? new Set() : new Set(everything);
  remember('ik-collapsed', JSON.stringify([...collapsed]));
  refreshCollapsed();
});

document.getElementById('replay').addEventListener('click', renderAll);

const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;

setPage(remembered('ik-page-theme', systemDark ? 'dark' : 'light'));
pickTheme(drawingTheme);

const events = new EventSource('/events');

events.addEventListener('open', () => setStatus('live', 'live'));
events.addEventListener('error', () => setStatus('reconnecting', 'reconnecting'));
events.addEventListener('change', () => renderAll());

renderAll();
