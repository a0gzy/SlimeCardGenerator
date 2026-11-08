import { cardStats } from './profile.js';
import { artUrl } from './game-assets.js';
import { equipmentQuality, equipmentSets, GRADE_NAMES, permanentProgress, SET_GRID_SLOTS, SLOT_NAMES, tearsEstimates, totalSlimeBonus, BUFF_RULES } from './progress.js';

export const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const roleName = role => ({ owner: 'Владелец', admin: 'Администратор', member: 'Участник' })[role] || 'Участник';
export const moduleNames = { equipment: 'Снаряжение', slimes: 'Слаймы', relics: 'Реликвии', artifacts: 'Артефакты', buffs: 'Пермы' };
export const editorModules = [
  { key: 'equipment', label: 'Снаряжение', icon: 'sword' },
  { key: 'slimes', label: 'Слаймы', icon: 'slime' },
  { key: 'relics', label: 'Реликвии', icon: 'gem' },
  { key: 'artifacts', label: 'Артефакты', icon: 'sparkles' },
  { key: 'buffs', label: 'Баффы', icon: 'chart' },
];
export const pages = {
  editor: { label: 'Прокачка аккаунта', title: 'Вся прокачка — на одной карточке.', description: 'Слаймы, сеты и пермы твоего аккаунта. Сохраняй прогресс без лишних полей.', icon: 'grid', eyebrow: 'ПРОГРЕСС ИГРОКА' },
  mine: { label: 'Мои аккаунты', title: 'Прокачка твоих аккаунтов', description: 'Обычно аккаунт один. Если играешь на нескольких — сохраняй каждый отдельно.', icon: 'cards', eyebrow: 'ЛИЧНОЕ ПРОСТРАНСТВО' },
  people: { label: 'Участники', title: 'Весь союз — в одном месте', description: 'Участники, их гильдии и права доступа.', icon: 'users', eyebrow: 'УПРАВЛЕНИЕ СОЮЗОМ' },
  all: { label: 'Аккаунты союза', title: 'Прокачка участников', description: 'Бонус слаймов, фаза пермов и собранность сетов — сразу в карточке.', icon: 'collection', eyebrow: 'УПРАВЛЕНИЕ СОЮЗОМ' },
  guilds: { label: 'Гильдии', title: 'Три гильдии. Один союз.', description: 'Создай гильдии и объедини участников в команды.', icon: 'shield', eyebrow: 'УПРАВЛЕНИЕ СОЮЗОМ' },
  audit: { label: 'Журнал действий', title: 'Ни одно изменение не потеряется', description: 'История карточек, назначений гильдий и прав доступа.', icon: 'history', eyebrow: 'УПРАВЛЕНИЕ СОЮЗОМ' },
  account: { label: 'Мой аккаунт', title: 'Твоё пространство', description: 'Аккаунт, доступ и локальные данные этого браузера.', icon: 'user', eyebrow: 'НАСТРОЙКИ' },
};
const drawings = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  cards: '<rect x="7" y="3" width="14" height="18" rx="3"/><path d="M4 6H3v12a3 3 0 0 0 3 3M11 8h6M11 12h6M11 16h3"/>',
  collection: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  sword: '<path d="m14 4 6-1-1 6-9 9-5-5 9-9ZM4 20l4-4M3 12l9 9M15 6l3 3"/>',
  slime: '<path d="M3 15c0-5 3.5-11 9-11s9 6 9 11c0 4-4 5-9 5s-9-1-9-5Z"/><path d="M8 12v1M16 12v1M10 16h4"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13L3 8ZM3 8h18M7 3l5 18 5-18"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  chart: '<path d="M4 20h17M7 15v-4M12 15V5M17 15V8M4 3v17"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .5-10A7 7 0 0 1 21 11a4 4 0 0 1-2 7M12 12v9m-3-6 3-3 3 3"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  refresh: '<path d="M20 7a8 8 0 0 0-13-3L3 8m0-6v6h6M4 17a8 8 0 0 0 13 3l4-4m0 6v-6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  drop: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
};
export function icon(name, className = '') {
  return `<svg class="sc-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.cards}</svg>`;
}
export function googleIcon() {
  return '<svg class="sc-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.3H3a10 10 0 0 0 0 9.4l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.3L6.4 10c.8-2.3 3-4 5.6-4Z"/></svg>';
}
export function emptyState(title, description, glyph = 'cards') {
  return `<div class="sc-empty"><span class="sc-empty-icon">${icon(glyph)}</span><h3>${h(title)}</h3><p>${h(description)}</p></div>`;
}
export function summarizeCard(config) {
  try {
    const modules = cardStats(config);
    const entries = key => modules.find(module => module.key === key)?.entries || [];
    return {
      slimes: entries('slimes').filter(entry => entry.state !== 'no').length,
      relics: entries('relics').filter(entry => entry.state !== 'no').length,
      artifacts: entries('artifacts').filter(entry => entry.state !== 'no').length,
      stats: entries('buffs').filter(entry => entry.value !== 0),
      slimeBonus: totalSlimeBonus(entries('slimes')),
      hasSlimes: entries('slimes').length > 0,
      perms: permanentProgress(entries('buffs')),
      hasPerms: entries('buffs').length > 0,
      sets: equipmentSets(entries('equipment')),
    };
  } catch { return { slimes: 0, relics: 0, artifacts: 0, stats: [], slimeBonus: 0, hasSlimes: false, hasPerms: false, perms: permanentProgress(), sets: equipmentSets() }; }
}
export const formatNumber = (value, digits = 0) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
export function renderAccountMetrics(summary) {
  return `<div class="sc-account-metrics"><div>${icon('slime')}<span>Бонус слаймов</span><strong>${summary.hasSlimes ? formatNumber(summary.slimeBonus, 2) : '—'}</strong></div><div>${icon('chart')}<span>Перманентные баффы</span><strong>${summary.hasPerms ? summary.perms.complete ? 'Закрыты' : `${summary.perms.phase} фаза` : 'Нет данных'}</strong><small>${summary.hasPerms ? `${formatNumber(summary.perms.percent, 1)}% · ${summary.perms.closed}/${summary.perms.total}` : 'Заполни пермы в редакторе'}</small></div></div>`;
}
export function renderSetPanels(sets, compact = false) {
  return `<div class="sc-set-panels ${compact ? 'sc-set-panels-mini' : ''}">${sets.map(set => `<section class="sc-set-panel" aria-label="${h(set.label)}: ${set.owned} из 4 предметов"><header><strong>${h(set.label)}</strong><span>${set.owned}/4</span></header><div class="sc-set-layout">${SET_GRID_SLOTS.map(slot => {
    const item = set.items.find(item => item.slot === slot);
    const quality = equipmentQuality(item.grade);
    return `<div class="sc-set-piece ${item.owned ? '' : 'is-missing'}" data-slot="${slot}" data-quality="${quality.family}" title="${h(item.label)} — ${h(quality.fullName)}"><span class="sc-piece-slot">${h(item.label)}</span><div class="sc-piece-picture">${itemPicture('equipment', item)}</div><span class="sc-quality-pill">${h(quality.label)}</span></div>`;
  }).join('')}</div></section>`).join('')}</div>`;
}
function stars(state) {
  if (state === 'no') return '<span class="sc-item-absent">Не получен</span>';
  if (state === '0') return '<span class="sc-item-zero">0 ★</span>';
  const count = Math.max(0, Math.min(5, parseInt(state) || 0));
  const color = { y: 'yellow', r: 'red', v: 'violet' }[state?.at(-1)] || 'yellow';
  return `<span class="sc-item-stars sc-stars-${color}" aria-label="${count} звёзд">${'★'.repeat(count)}</span>`;
}
function itemPicture(category, entry) {
  const url = artUrl(category, entry.name, entry.skin || 0);
  return url ? `<img src="${h(url)}" alt="${h(entry.name)}" loading="lazy" decoding="async">` : `<span class="sc-picture-missing">${icon(category === 'equipment' ? 'sword' : 'gem')}</span>`;
}
function renderImageItems(module) {
  return `<div class="sc-collection-grid">${module.entries.map(entry => {
    const absent = module.key === 'equipment' ? entry.grade === 'no' : entry.state === 'no';
    const slot = module.key === 'equipment' ? Object.keys(SLOT_NAMES).find(slot => entry.name.endsWith(slot)) : null;
    const label = slot ? `${entry.name.startsWith('Astral') ? 'Астрал' : 'Эгида'} · ${SLOT_NAMES[slot]}` : entry.name;
    return `<article class="sc-collection-item ${absent ? 'is-missing' : ''}"><div class="sc-item-picture">${itemPicture(module.key, entry)}</div><strong>${h(label)}</strong>${module.key === 'equipment' ? `<span class="sc-item-grade">${h(GRADE_NAMES[entry.grade] || entry.grade)}</span>` : stars(entry.state)}
      <div class="sc-item-meta">${entry.level !== undefined ? `<span>Ур. ${h(entry.level)}</span>` : ''}${entry.skin > 0 ? `<span>Скин ${h(entry.skin)}</span>` : ''}${entry.fragments !== undefined ? `<span>${h(entry.fragments)} фрагм.</span>` : ''}</div></article>`;
  }).join('')}</div>`;
}
export function renderTearsPanel(buffs) {
  const estimate = tearsEstimates(buffs);
  return `<section class="sc-tears-panel" aria-label="Расход слёз на пермы"><div class="sc-tears-heading">${icon('drop')}<div><h3>Сколько слёз до закрытия ${estimate.phase}-й фазы?</h3><p>${formatNumber(estimate.percent, 1)}% фазы · закрыто ${estimate.closed} из ${estimate.total} пермов</p></div></div>
    ${estimate.complete ? '<p class="sc-perms-complete">Все пермы закрыты. Дополнительные слёзы не требуются.</p>' : `<p class="sc-perm-counts">Осталось выбить пермов: мин. <b>${formatNumber(estimate.estimatedDrops.min)}</b> · сред. <b>${formatNumber(estimate.estimatedDrops.avg)}</b> · макс. по модели <b>${formatNumber(estimate.estimatedDrops.smallIncrements)}</b></p><div class="sc-tears-chances">${estimate.chances.map(chance => `<article><h4>${chance.probability === .045 ? 'Обычный шанс · 4,5%' : 'Под баффом · 9%'}</h4><div class="sc-tears-values">${[['Минимум', chance.min], ['Среднее ≈', chance.average], ['Макс. по модели', chance.max]].map(([label, value]) => `<span>${label}<strong>${formatNumber(value)} ${icon('drop', 'sc-gold-drop')}</strong></span>`).join('')}</div></article>`).join('')}</div><p class="sc-tears-disclaimer">Гарант на 30-й капле; выпадение перма сбрасывает счётчик. Среднее = число пермов × (1 − (1 − шанс)³⁰) / шанс, а не просто деление на шанс. Минимум — идеальные выпадения, максимум — 30 капель на каждый перм в оценке с малыми приростами. Тип перма случаен, поэтому это оценки по модели, а не гарантия закрытия фазы.</p>`}</section>`;
}
export function renderStatsTabs(config, selected = 'buffs') {
  try {
    const modules = cardStats(config);
    const active = modules.find(module => module.key === selected) || modules.find(module => module.key === 'buffs');
    const tabs = `<div class="sc-detail-tabs" role="tablist" aria-label="Состав карточки">${Object.entries(moduleNames).map(([key, label]) => `<button type="button" role="tab" id="sc-stat-tab-${key}" data-action="stats-tab" data-module="${key}" aria-selected="${key === active.key}" aria-controls="sc-stats-panel" tabindex="${key === active.key ? 0 : -1}">${label}</button>`).join('')}</div>`;
    const entries = active.entries;
    const content = active.key === 'buffs'
      ? `${renderTearsPanel(entries)}<div class="sc-stat-grid">${entries.map(entry => `<div class="sc-stat">${itemPicture('buffs', entry)}<span>${h(entry.name)}</span><strong>${h(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(entry.value))}</strong><small>${BUFF_RULES[entry.name] ? `${formatNumber(Math.min(100, Math.max(0, entry.value / BUFF_RULES[entry.name].cap * 100)), 1)}%` : ''}</small></div>`).join('')}</div>`
      : active.key === 'equipment' ? renderSetPanels(equipmentSets(entries)) : renderImageItems(active);
    return `${tabs}<div id="sc-stats-panel" class="sc-stats-panel" role="tabpanel" aria-labelledby="sc-stat-tab-${active.key}" tabindex="0">${entries.length ? content : emptyState('Раздел пока пуст', 'В этой карточке нет данных для выбранного раздела.', 'gem')}</div>`;
  } catch { return emptyState('Не удалось прочитать карточку', 'Скачай JSON, чтобы проверить формат данных.', 'info'); }
}
