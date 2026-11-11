import { CloudStore } from './store.js';
import { detectAuthEnvironment } from './auth-environment.js';
import { BACKUP_KEY, CONTEXT_KEY, importIntoGenerator, readContext } from './profile.js';
import { editorModules, emptyState, googleIcon, h, icon, pages, renderAccountMetrics, renderSetPanels, renderStatsTabs, renderTearsPanel, roleName, summarizeCard } from './ui.js';
import { observeEditorModule, selectEditorModule } from './editor-bridge.js';
import { chooseLegacyOption, closeLegacyPicker, installEditorEnhancements, prepareAccountDraft, readLiveBuffs } from './editor-enhancements.js';
import { accountTitle, chooseSaveTarget } from './account-save.js';
import { loadAllianceAccounts } from './account-search.js';
import { EQUIPMENT_QUALITY_RANK, GRADE_NAMES, SLIME_RARITIES } from './progress.js';
import { GAME_ART, artUrl } from './game-assets.js';

const root = document.getElementById('cloud-root');
const mobileLayout = matchMedia('(max-width: 760px)');
const authEnvironment = detectAuthEnvironment({
  userAgent: navigator.userAgent,
});
const config = window.__FIREBASE_CONFIG__;
const store = config ? new CloudStore(config, window.__FIREBASE_EMULATORS__ === true) : null;
const state = {
  user: null, role: 'member', authReady: !store, profileReady: false, busy: false,
  tab: 'editor', page: { rows: [], more: false, cursor: null }, guilds: [], people: new Map(),
  ownerFilter: '', guildFilter: '', emailFilter: '', accountSearch: '', accountGuild: '', deleted: false, editor: null,
  accountMinBonus: 0, accountPhase: '', accountSet: '', accountPieces: '0', accountQuality: '', accountSort: 'recent',
  accountSlimes: [], accountArtifacts: [], accountArtifactMinLevel: '0', accountRelics: [], accountRelicMinStars: '0',
  accountFiltersOpen: false,
  allianceRows: null,
  status: '', error: false, menuOpen: false, forceNewAccount: false, picker: null,
  inspected: null, statsTab: 'equipment', editorModule: 'equipment', editorReady: false, myGuild: null,
};
let authGeneration = 0;
let unsubscribeAccess = null;
let focusAfterRender = null;
let scrollToTopAfterRender = false;
const isAdmin = () => ['owner', 'admin'].includes(state.role);
const date = value => value?.toDate ? value.toDate().toLocaleString('ru-RU') : '—';
const emptyPage = () => ({ rows: [], more: false, cursor: null });
const actions = {
  'card.create': 'Создал карточку', 'card.update': 'Изменил карточку', 'card.delete': 'Удалил карточку',
  'card.restore': 'Восстановил карточку', 'guild.create': 'Создал гильдию', 'guild.update': 'Переименовал гильдию',
  'membership.assign': 'Назначил гильдию', 'access.change': 'Изменил права',
};

function button(action, label, attributes = '') {
  return `<button type="button" data-action="${action}" ${attributes} ${state.busy ? 'disabled' : ''}>${label}</button>`;
}
function userLabel(uid) {
  const person = state.people.get(uid);
  return person ? (person.displayName || 'Игрок') : uid;
}
function message(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Окно входа закрыто. Генератор доступен и без входа.',
    'auth/cancelled-popup-request': 'Предыдущая попытка входа отменена.',
    'auth/popup-blocked': 'Браузер заблокировал окно Google. Разреши всплывающие окна для этого сайта и нажми «Войти» ещё раз. Если это ярлык на экране «Домой», открой сайт в Safari.',
    'auth/operation-not-supported-in-this-environment': 'Этот браузер не поддерживает вход через всплывающее окно. Открой сайт в Safari или Chrome и повтори вход.',
    'auth/web-storage-unsupported': 'Не удалось сохранить вход в этом браузере. Открой сайт в обычной вкладке Safari или Chrome и повтори вход.',
    'auth/internal-error': 'Google отклонил вход. Если сайт открыт из Telegram, VK или Discord, скопируй ссылку и открой её в Safari или Chrome.',
    'auth/unauthorized-domain': 'Добавь домен сайта в Firebase → Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'В Firebase Authentication нужно включить провайдера Google.',
    'permission-denied': 'Нет доступа. Проверь опубликованные Firestore Rules и свою роль. Черновик остаётся на компьютере.',
    'failed-precondition': 'Базе нужен индекс. Опубликуй firestore.indexes.json по инструкции в README.',
    'unavailable': 'База временно недоступна. Черновик остаётся на компьютере; повтори попытку позже.',
    'resource-exhausted': 'Достигнут лимит Firebase. Генератор и локальные сохранения продолжают работать.',
    'auth/network-request-failed': 'Не удалось связаться с Google. Проверь подключение.',
  };
  return messages[error.code] || (error.code ? `Ошибка облака (${error.code}). Локальный генератор остаётся доступен.` : error.message || 'Не удалось выполнить действие.');
}
function notify(text, error = false) { state.status = text; state.error = error; render(); }

const ACCOUNT_SETS = [['', 'Любой'], ['astral', 'Астрал'], ['egida', 'Эгида'], ['abyss', 'Abyss']];
const QUALITY_CHOICES = Object.keys(EQUIPMENT_QUALITY_RANK).filter(grade => grade !== 'no');
const SLIME_CHOICES = Object.values(SLIME_RARITIES).flat();
const ARTIFACT_CHOICES = Object.keys(GAME_ART.artifacts);
const RELIC_CHOICES = Object.keys(GAME_ART.relics);
const optionList = (entries, selected) => entries.map(([value, label]) => `<option value="${h(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${h(label)}</option>`).join('');

function renderChipBlock({ key, action, title, hint, names, category, selected, tools = '' }) {
  return `<section class="sc-filter-block sc-chip-block" data-chip-group="${key}">
    <header class="sc-filter-block-head"><div class="sc-filter-block-title"><h3>${h(title)}<span class="sc-chip-count" data-chip-count="${key}" ${selected.length ? '' : 'hidden'}>${selected.length}</span></h3><p>${h(hint)}</p></div>
      <div class="sc-chip-tools">${tools}<button type="button" class="sc-filter-clear" data-action="clear-${key}" ${selected.length ? '' : 'disabled'}>Очистить</button></div></header>
    <div class="sc-choice-grid" role="group" aria-label="${h(title)}">${names.map(name => {
      const url = artUrl(category, name);
      return `<button type="button" class="sc-choice" data-action="${action}" data-value="${h(name)}" aria-pressed="${selected.includes(name)}">${url ? `<img src="${h(url)}" alt="" loading="lazy" decoding="async">` : ''}<span>${h(name)}</span></button>`;
    }).join('')}</div></section>`;
}

function renderAllianceFilters() {
  const artifactTools = `<label class="sc-filter-inline">Мин. уровень<input data-account-filter="artifactLevel" type="number" min="0" max="10000" step="1" value="${h(state.accountArtifactMinLevel)}" placeholder="0"></label>`;
  const relicTools = `<label class="sc-filter-inline">Мин. звёзды<select data-account-filter="relicStars">${optionList([['0', 'Неважно'], ['1', '1 ★'], ['2', '2 ★'], ['3', '3 ★'], ['4', '4 ★'], ['5', '5 ★']], state.accountRelicMinStars)}</select></label>`;
  const active = allianceActiveCount();
  const resultPill = `<span class="sc-result-pill">${icon('collection')} Найдено <b data-alliance-count>${state.allianceRows ? state.allianceRows.length : 0}</b></span>`;
  const reset = `<button type="button" class="sc-quiet" data-action="reset-accounts" ${active ? '' : 'disabled'}>${icon('refresh')} Сбросить</button>`;
  if (!state.accountFiltersOpen) return `<section class="sc-filter-panel sc-filter-panel-collapsed sc-alliance-filters" role="search" aria-label="Фильтры аккаунтов союза">
    <div class="sc-filter-collapsed-bar"><div class="sc-filter-heading"><span class="sc-filter-glyph">${icon('search')}</span><div><span class="sc-kicker">ЖИВОЙ ПОИСК ПО СОЮЗУ</span><h2>Фильтры аккаунтов<span class="sc-filter-active-pill" data-alliance-active-pill ${active ? '' : 'hidden'}>${active}</span></h2><p>Скрыты по умолчанию. Раскрой, чтобы выбрать условия — результаты обновятся сами.</p></div></div>
      <div class="sc-filter-status">${resultPill}<button type="button" class="sc-primary" data-action="toggle-account-filters" aria-expanded="false">${icon('search')} Показать фильтры</button>${reset}</div></div>
  </section>`;
  return `<section class="sc-filter-panel sc-alliance-filters" role="search" aria-label="Фильтры аккаунтов союза">
    <header class="sc-filter-panel-head"><div class="sc-filter-heading"><span class="sc-filter-glyph">${icon('search')}</span><div><span class="sc-kicker">ЖИВОЙ ПОИСК ПО СОЮЗУ</span><h2>Фильтры аккаунтов<span class="sc-filter-active-pill" data-alliance-active-pill ${active ? '' : 'hidden'}>${active}</span></h2><p>Результаты обновляются сразу, пока ты вводишь текст или выбираешь условия.</p></div></div>
      <div class="sc-filter-status">${resultPill}${reset}<button type="button" class="sc-quiet" data-action="toggle-account-filters" aria-expanded="true">${icon('close')} Скрыть</button></div></header>
    <div class="sc-filter-primary">
      <label class="sc-search-field">Ник, имя или email<input data-account-filter="search" name="search" value="${h(state.accountSearch)}" placeholder="Начни вводить ник…" autocomplete="off"></label>
      <label>Гильдия<select data-account-filter="guild">${guildOptions(state.accountGuild, true)}</select></label>
      <label>Сортировка<select data-account-filter="sort">${optionList([['recent', 'Недавно обновлены'], ['bonus-desc', 'Бонус: сначала высокий'], ['bonus-asc', 'Бонус: сначала низкий']], state.accountSort)}</select></label>
    </div>
    <div class="sc-filter-groups">
      <fieldset class="sc-filter-block"><legend>${icon('chart')} Прогресс</legend><div class="sc-filter-fields">
        <label>Бонус слаймов от<input data-account-filter="minBonus" type="number" min="0" step="any" value="${h(state.accountMinBonus || '')}" placeholder="Например, 300"></label>
        <label>Фаза пермов<select data-account-filter="phase">${optionList([['', 'Любая'], ['1', '1 фаза'], ['2', '2 фаза'], ['closed', 'Все пермы закрыты'], ['open', 'Есть незакрытые']], state.accountPhase)}</select></label>
      </div></fieldset>
      <fieldset class="sc-filter-block"><legend>${icon('sword')} Сет снаряжения</legend><div class="sc-filter-fields sc-filter-fields-three">
        <label>Набор<select data-account-filter="set">${optionList(ACCOUNT_SETS, state.accountSet)}</select></label>
        <label>Предметов не менее<select data-account-filter="pieces">${optionList([['0', 'Неважно'], ['1', '1 из 4'], ['2', '2 из 4'], ['3', '3 из 4'], ['4', '4 из 4 · полный']], state.accountPieces)}</select></label>
        <label>Качество не ниже<select data-account-filter="quality">${optionList([['', 'Любое'], ...QUALITY_CHOICES.map(grade => [grade, GRADE_NAMES[grade]])], state.accountQuality)}</select></label>
      </div></fieldset>
    </div>
    <div class="sc-filter-multigroups">
      ${renderChipBlock({ key: 'slimes', action: 'toggle-slime', title: 'Слаймы', hint: 'Показать аккаунты, где есть все выбранные слаймы', names: SLIME_CHOICES, category: 'slimes', selected: state.accountSlimes })}
      ${renderChipBlock({ key: 'artifacts', action: 'toggle-artifact', title: 'Артефакты', hint: 'Есть все выбранные артефакты не ниже указанного уровня', names: ARTIFACT_CHOICES, category: 'artifacts', selected: state.accountArtifacts, tools: artifactTools })}
      ${renderChipBlock({ key: 'relics', action: 'toggle-relic', title: 'Реликвии', hint: 'Есть все выбранные реликвии с нужным количеством звёзд', names: RELIC_CHOICES, category: 'relics', selected: state.accountRelics, tools: relicTools })}
    </div>
  </section>`;
}

function allianceActiveCount() {
  return [
    state.accountSearch.trim(), state.accountGuild, Number(state.accountMinBonus) > 0, state.accountPhase,
    state.accountSet, Number(state.accountPieces) > 0, state.accountQuality,
    state.accountSlimes.length, state.accountArtifacts.length, state.accountRelics.length,
    state.accountArtifacts.length > 0 && Number(state.accountArtifactMinLevel) > 0,
    state.accountRelics.length > 0 && Number(state.accountRelicMinStars) > 0,
  ].filter(Boolean).length;
}

function refreshAllianceChrome() {
  const count = root.querySelector('[data-alliance-count]');
  if (count) count.textContent = String(state.allianceRows ? state.allianceRows.length : 0);
  const active = allianceActiveCount();
  const activePill = root.querySelector('[data-alliance-active-pill]');
  if (activePill) { activePill.textContent = String(active); activePill.hidden = !active; }
  const reset = root.querySelector('[data-action="reset-accounts"]');
  if (reset) reset.disabled = active === 0;
  for (const [key, list] of [['slimes', state.accountSlimes], ['artifacts', state.accountArtifacts], ['relics', state.accountRelics]]) {
    const badge = root.querySelector(`[data-chip-count="${key}"]`);
    if (badge) { badge.textContent = String(list.length); badge.hidden = !list.length; }
    const clear = root.querySelector(`[data-action="clear-${key}"]`);
    if (clear) clear.disabled = !list.length;
  }
}

function setAllianceLoading(loading) {
  root.querySelector('.sc-alliance-filters')?.classList.toggle('is-loading', loading);
  const results = root.querySelector('#sc-alliance-results');
  results?.classList.toggle('is-loading', loading);
  results?.setAttribute('aria-busy', String(loading));
}

function renderCardArticle(card) {
  const summary = summarizeCard(card.config);
  return `<article class="sc-card sc-build-card"><div class="sc-build-cover"><span class="sc-build-avatar">${icon('slime')}</span><div><span class="sc-kicker">ПРОКАЧКА АККАУНТА</span><h3>${h(card.playerName || card.title || 'Аккаунт')}</h3></div><span class="sc-version">v${card.revision}</span></div>
    <div class="sc-card-body"><p class="sc-muted sc-small">Обновлено ${date(card.updatedAt)}</p>
      ${renderAccountMetrics(summary)}${renderSetPanels(summary.sets, true)}
      ${state.tab !== 'mine' ? `<p class="sc-card-owner">${icon('user')} ${h(userLabel(card.ownerId))}</p>` : ''}
      <div class="sc-actions">${!card.deleted ? button('inspect-card', `${icon('collection')} Смотреть`, `data-id="${h(card.id)}" class="sc-primary"`) : button('restore-card', `${icon('refresh')} Восстановить`, `data-id="${h(card.id)}" class="sc-primary"`)}
        ${button('download', icon('download'), `data-id="${h(card.id)}" class="sc-icon-button" aria-label="Скачать JSON: ${h(card.title)}" title="Скачать JSON"`)}
        ${!card.deleted ? button('delete-card', icon('trash'), `data-id="${h(card.id)}" class="sc-icon-button sc-danger" aria-label="Удалить: ${h(card.title)}" title="В корзину"`) : ''}</div>
    </div></article>`;
}

function renderAllianceResults() {
  const articles = state.page.rows.map(renderCardArticle).join('');
  return `${articles ? `<div class="sc-cards">${articles}</div>` : emptyState('Ничего не найдено', 'Попробуй ослабить фильтры — список обновится сам, как только изменится условие.', 'search')}${state.page.more ? `<div class="sc-load-more">${button('more', 'Показать ещё')}</div>` : ''}`;
}

function updateAllianceResults() {
  const container = root.querySelector('#sc-alliance-results');
  if (container) container.innerHTML = renderAllianceResults();
  refreshAllianceChrome();
}

// Filters never rebuild the whole panel: keeping the inputs mounted lets the
// caret stay in place while debounced fetches replace only the result cards.
let allianceTimer = 0;
let allianceLoading = false;
let alliancePending = false;
function scheduleAllianceReload(delay = 0) {
  clearTimeout(allianceTimer);
  allianceTimer = setTimeout(runAllianceReload, delay);
}
async function runAllianceReload() {
  if (state.tab !== 'all' || !state.user || !state.profileReady) return;
  if (allianceLoading) { alliancePending = true; return; }
  allianceLoading = true;
  setAllianceLoading(true);
  try {
    do {
      alliancePending = false;
      await loadPage();
      if (state.tab !== 'all') break;
      updateAllianceResults();
    } while (alliancePending);
  } catch (error) {
    state.status = message(error); state.error = true; render();
  } finally {
    allianceLoading = false;
    setAllianceLoading(false);
  }
}

function renderCards() {
  const articles = state.page.rows.map(renderCardArticle).join('');
  if (state.tab === 'all') return `${renderAllianceFilters()}<div class="sc-alliance-results" id="sc-alliance-results" aria-live="polite">${renderAllianceResults()}</div>`;
  return `<div class="sc-toolbar sc-list-toolbar"><div class="sc-segmented" role="group" aria-label="Список карточек">${button('card-filter', 'Карточки', `data-deleted="false" aria-pressed="${!state.deleted}"`)}${button('card-filter', `${icon('trash')} Корзина`, `data-deleted="true" aria-pressed="${state.deleted}"`)}</div>
    <span class="sc-private">${icon('lock')} Только владелец и админы</span>${state.tab === 'mine' ? button('new-account', `${icon('plus')} Ещё один аккаунт`, 'class="sc-quiet"') : ''}
    ${state.ownerFilter ? `<span class="sc-filter-tag">${h(userLabel(state.ownerFilter))}${button('clear-owner', icon('close'), 'class="sc-icon-button" aria-label="Сбросить участника"')}</span>` : ''}</div>
    ${articles ? `<div class="sc-cards">${articles}</div>` : ''}${!state.page.rows.length ? emptyState(state.deleted ? 'Корзина пуста' : 'Сохрани прокачку аккаунта', state.deleted ? 'Удалённые аккаунты можно будет восстановить отсюда.' : 'Заполни прогресс и нажми «Сохранить аккаунт». Ничего дополнительно подписывать не нужно.', state.deleted ? 'trash' : 'cards') : ''}`;
}
function guildOptions(selected = '', filter = false) {
  return `<option value="">${filter ? 'Все гильдии' : 'Без гильдии'}</option>${state.guilds.map(guild => `<option value="${h(guild.id)}" ${guild.id === selected ? 'selected' : ''}>${h(guild.name)}</option>`).join('')}`;
}
function renderPeople() {
  return `<form data-form="people-filter" class="sc-toolbar sc-filter-bar">${state.role === 'owner' ? `<label>Поиск по точному email<input name="email" type="email" placeholder="player@gmail.com" value="${h(state.emailFilter)}"></label>` : ''}
      <label>Гильдия<select name="guild">${guildOptions(state.guildFilter, true)}</select></label><button class="sc-primary" ${state.busy ? 'disabled' : ''}>${icon('search')} Найти</button>${button('reset-people', 'Сбросить', 'class="sc-quiet"')}</form>
    ${state.page.rows.length ? `<div class="sc-card sc-table-wrap"><table class="sc-people-table"><thead><tr><th>Участник</th><th>Гильдия</th><th>Роль</th><th>Последний вход</th><th>Управление</th></tr></thead><tbody>${state.page.rows.map(person => `<tr><td><div class="sc-person"><span class="sc-avatar">${h(person.displayName?.slice(0, 1).toUpperCase() || '?')}</span><div><strong>${h(person.displayName)}</strong>${state.role === 'owner' ? `<span>${h(person.email)}</span>` : ''}</div></div></td>
      <td><div class="sc-guild-assignment"><select data-guild-for="${h(person.uid)}" aria-label="Гильдия: ${h(person.displayName)}">${guildOptions(person.guildId)}</select>${button('assign-guild', icon('check'), `data-id="${h(person.uid)}" class="sc-icon-button" aria-label="Применить гильдию: ${h(person.displayName)}" title="Применить"`)}</div></td>
      <td><span class="sc-role sc-role-${h(person.role || 'member')}">${roleName(person.role)}</span></td><td class="sc-muted sc-small">${date(person.lastSeenAt)}</td>
      <td><div class="sc-actions">${button('person-cards', `${icon('cards')} Карточки`, `data-id="${h(person.uid)}"`)}${state.role === 'owner' && person.uid !== state.user.uid && person.role !== 'owner' ? button('assign-role', person.role === 'admin' ? 'Снять админа' : 'Выдать админа', `data-id="${h(person.uid)}" class="sc-quiet"`) : ''}</div></td></tr>`).join('')}</tbody></table></div>` : emptyState('Никого не нашли', state.role === 'owner' ? 'Проверь email или выбери другую гильдию. Участники появляются после первого входа на сайт.' : 'Выбери другую гильдию. Участники появляются после первого входа на сайт.', 'users')}
    <p class="sc-footnote">Гильдия — это команда, а не уровень доступа. Права администратора назначаются отдельно.${state.role !== 'owner' ? ' Почты участников видит только владелец союза.' : ''}</p>`;
}
function renderGuilds() {
  return `<form data-form="new-guild" class="sc-toolbar sc-filter-bar"><label>Новая гильдия<input name="name" required maxlength="80" placeholder="Название вашей команды"></label><button class="sc-primary" ${state.busy ? 'disabled' : ''}>${icon('plus')} Создать гильдию</button></form>
    <div class="sc-guild-grid">${state.guilds.map((guild, index) => `<article class="sc-card sc-guild-card"><span class="sc-guild-emblem sc-emblem-${index % 3}">${icon('shield')}</span><span class="sc-kicker">ГИЛЬДИЯ СОЮЗА</span><h3>${h(guild.name)}</h3><form data-form="rename-guild" data-id="${h(guild.id)}"><label>Название<input name="name" aria-label="Новое название гильдии ${h(guild.name)}" required maxlength="80" value="${h(guild.name)}"></label><button ${state.busy ? 'disabled' : ''}>Сохранить название</button></form></article>`).join('')}</div>
    ${!state.guilds.length ? emptyState('Союз начинается с команды', 'Добавь три гильдии с вашими названиями, затем назначь участников в боковом разделе «Участники».', 'shield') : '<p class="sc-footnote">Назначить участнику гильдию можно в разделе «Участники».</p>'}`;
}
function renderAudit() {
  return `<div class="sc-info-strip">${icon('shield')} Журнал защищён от изменений через сайт. Здесь записываются действия, а не просмотры.</div>
    <div class="sc-card sc-timeline">${state.page.rows.map(event => `<article class="sc-timeline-item"><span class="sc-timeline-icon">${icon(event.targetType === 'cards' ? 'cards' : event.targetType === 'access' ? 'lock' : 'shield')}</span><div><strong>${h(actions[event.action] || event.action)}</strong><p>${h(userLabel(event.actorId))}</p><code>${h(event.targetType)}/${h(event.targetId)}</code></div><div class="sc-timeline-end"><time>${date(event.createdAt)}</time>${event.targetType === 'cards' ? button('inspect-card', `${icon('arrow')} Карточка`, `data-id="${h(event.targetId)}" class="sc-quiet"`) : ''}</div></article>`).join('')}</div>
    ${!state.page.rows.length ? emptyState('Пока тихо', 'Создание карточек, изменения гильдий и прав появятся здесь.', 'history') : ''}`;
}
function renderAccount() {
  const guild = state.guilds.find(guild => guild.id === state.myGuild);
  return `<div class="sc-account-grid"><section class="sc-card sc-account-card"><span class="sc-account-portrait">${icon('user')}</span><h2>${h(state.user?.displayName || 'Гостевой режим')}</h2><p class="sc-muted">${h(state.user?.email || 'Для генерации карточки аккаунт не нужен')}</p>
    ${state.user ? `<span class="sc-role sc-role-${state.role}">${roleName(state.role)}</span><dl><dt>Гильдия</dt><dd>${h(guild?.name || 'Пока не назначена')}</dd><dt>UID аккаунта</dt><dd><code>${h(state.user.uid)}</code>${button('copy-uid', icon('copy'), 'class="sc-icon-button" aria-label="Скопировать UID"')}</dd></dl>` : '<p>Войди через Google в боковом меню, чтобы сохранять прокачку аккаунта на разных устройствах.</p>'}</section>
    <section class="sc-card sc-account-card"><span class="sc-account-portrait sc-local-portrait">${icon('monitor')}</span><h2>На этом устройстве</h2><p class="sc-muted">Редактор автоматически сохраняет черновик в этом браузере. Загрузка из облака создаёт резервную копию предыдущей карточки.</p>${button('undo-load', `${icon('history')} Вернуть предыдущий черновик`)}<div class="sc-info-strip">${icon('info')} При выходе из аккаунта текущий черновик остаётся на компьютере. На общем устройстве очищай данные сайта после работы.</div></section></div>`;
}
function renderSidebar() {
  const nav = key => button('tab', `${icon(pages[key].icon)}<span>${pages[key].label}</span>${key === 'mine' && !state.user ? icon('lock', 'sc-nav-lock') : ''}`, `data-tab="${key}" class="sc-nav-item" ${state.tab === key ? 'aria-current="page"' : ''}`);
  return `<aside class="sc-sidebar ${state.menuOpen ? 'is-open' : ''}" id="sc-sidebar" aria-label="Основное меню"><a class="sc-brand" href="#" data-action="home"><span class="sc-brand-mark">${icon('slime')}</span><span><strong>SLIME CASTLE</strong><small>КАРТОЧКИ ТВОЕГО СОЮЗА</small></span></a>
    <div class="sc-nav-label">ТВОЯ МАСТЕРСКАЯ</div><nav aria-label="Личная мастерская">${nav('editor')}${nav('mine')}</nav>
    ${isAdmin() ? `<div class="sc-nav-label sc-admin-label">УПРАВЛЕНИЕ СОЮЗОМ<span class="sc-admin-dot"></span></div><nav aria-label="Администрирование">${['people', 'all', 'guilds', 'audit'].map(nav).join('')}</nav>` : ''}
    <div class="sc-sidebar-bottom"><div class="sc-local-hint">${icon(state.user ? 'cloud' : 'monitor')}<div><strong>${state.user ? 'Твой союз в облаке' : 'Сначала — просто создай'}</strong><p>${state.user ? 'В облако попадают только сохранённые тобой карточки.' : 'Генерация и скачивание PNG работают без аккаунта.'}</p></div></div>
    ${state.user ? `<div class="sc-user-box">${button('tab', `<span class="sc-avatar">${h((state.user.displayName || state.user.email || '?').slice(0, 1).toUpperCase())}</span><span class="sc-user-caption"><strong>${h(state.user.displayName || 'Игрок')}</strong><small>${roleName(state.role)}</small></span>`, 'data-tab="account" class="sc-user-button" aria-label="Мой аккаунт"')}${button('logout', icon('logout'), 'class="sc-icon-button sc-logout" aria-label="Выйти из аккаунта" title="Выйти"')}</div>` : `${button('login', `${googleIcon()}<span>${state.authReady ? 'Войти через Google' : 'Подключение…'}</span>`, `class="sc-google" ${!store || !state.authReady ? 'disabled' : ''}`)}<span class="sc-signin-caption">${authEnvironment.embedded ? 'Открой сайт в Safari или Chrome — Google блокирует вход из встроенного браузера.' : 'Твой прогресс на всех устройствах'}</span>`}
    ${!state.user ? button('tab', `${icon('info')} Локальные данные`, 'data-tab="account" class="sc-local-link"') : ''}
    </div></aside>${state.menuOpen ? '<button class="sc-sidebar-backdrop" data-action="close-menu" aria-label="Закрыть меню"></button>' : ''}`;
}
function renderWorkspace() {
  if (state.tab === 'account') return renderAccount();
  if (!store) return emptyState('Облако ещё не настроено', 'Локальный генератор уже работает. Настрой Firebase по инструкции в README, чтобы подключить сохранения.', 'cloud');
  if (!state.user) return `${emptyState('Прокачка аккаунта в облаке', 'Войди через Google внизу бокового меню. Сохраняй прогресс и возвращайся к нему с любого устройства — или продолжай работать без входа.', 'lock')}<div class="sc-empty-action">${button('tab', `${icon('arrow')} Вернуться к прокачке`, 'data-tab="editor" class="sc-primary"')}</div>`;
  if (!state.profileReady) return `${emptyState('Подключаем твою мастерскую', 'Если подключение не завершается, проверь Firestore Rules и настройки Google-входа.', 'cloud')}<div class="sc-empty-action">${button('retry-profile', `${icon('refresh')} Повторить подключение`)}</div>`;
  const view = state.tab === 'people' ? renderPeople() : state.tab === 'guilds' ? renderGuilds() : state.tab === 'audit' ? renderAudit() : renderCards();
  return `${view}${state.page.more && !['guilds', 'account', 'all'].includes(state.tab) ? `<div class="sc-load-more">${button('more', 'Показать ещё')}</div>` : ''}`;
}
function renderDialogs() {
  if (state.picker) return `<dialog class="sc-dialog sc-picker-dialog" data-legacy-picker aria-labelledby="sc-picker-title"><div class="sc-inspect-heading"><div><span class="sc-kicker">ВСЕ ВАРИАНТЫ СРАЗУ</span><h2 id="sc-picker-title">${h(state.picker.name || 'Выбери значение')}</h2></div>${button('close-dialog', icon('close'), 'class="sc-icon-button" aria-label="Закрыть выбор"')}</div><div class="sc-picker-options">${state.picker.choices.map(choice => button('choose-option', `<span class="sc-picker-stars">${choice.images.map(src => `<img src="${h(src)}" alt="">`).join('')}</span><strong>${h(choice.label)}</strong>`, `data-index="${choice.index}" data-quality="${choice.quality}" aria-pressed="${choice.selected}"`)).join('')}</div></dialog>`;
  if (state.inspected) {
    const card = state.inspected;
    const summary = summarizeCard(card.config);
    return `<dialog class="sc-dialog sc-inspect-dialog" aria-labelledby="sc-inspect-heading"><div class="sc-inspect-heading"><span class="sc-build-avatar">${icon('slime')}</span><div><span class="sc-kicker">ПРОКАЧКА АККАУНТА · v${card.revision}</span><h2 id="sc-inspect-heading">${h(card.playerName || card.title)}</h2></div>${button('close-dialog', icon('close'), 'class="sc-icon-button" aria-label="Закрыть просмотр"')}</div>${renderAccountMetrics(summary)}${renderStatsTabs(card.config, state.statsTab)}<div class="sc-dialog-actions">${button('download', `${icon('download')} Скачать JSON`, `data-id="${h(card.id)}"`)}${!card.deleted ? button('load-card', `${icon('arrow')} Открыть в редакторе`, `data-id="${h(card.id)}" class="sc-primary"`) : '<span class="sc-muted">Аккаунт находится в корзине</span>'}</div></dialog>`;
  }
  return '';
}
function render() {
  const page = pages[state.tab] || pages.editor;
  document.body.classList.add('sc-app');
  document.body.classList.toggle('sc-menu-open', state.menuOpen);
  const editorRoot = document.getElementById('root');
  editorRoot.hidden = state.tab !== 'editor';
  editorRoot.setAttribute('role', 'tabpanel');
  editorRoot.setAttribute('aria-labelledby', `sc-editor-tab-${state.editorModule}`);
  editorRoot.toggleAttribute('data-picker-open', !!state.picker);
  editorRoot.dataset.module = state.editorModule;
  root.innerHTML = `<a class="sc-skip-link" href="#sc-main-heading">К содержимому</a>${renderSidebar()}<div class="sc-main ${state.tab === 'editor' ? 'sc-editor-heading' : ''}">
    <header class="sc-page-heading"><div class="sc-heading-copy"><div class="sc-eyebrow">${button('menu', icon('menu'), `class="sc-icon-button sc-menu-toggle" aria-label="Открыть меню" aria-expanded="${state.menuOpen}" aria-controls="sc-sidebar"`)}<span>${page.eyebrow}</span></div><h1 id="sc-main-heading" tabindex="-1">${page.title}</h1><p>${page.description}</p></div><div class="sc-heading-actions">${state.busy ? '<span class="sc-sync"><span></span> Синхронизация</span>' : ''}${state.tab === 'editor' ? button('open-save', `${icon('cloud')} ${state.forceNewAccount ? 'Добавить аккаунт' : 'Сохранить аккаунт'}`, 'class="sc-primary"') : state.user && state.profileReady ? button('refresh', icon('refresh'), 'class="sc-icon-button" aria-label="Обновить данные" title="Обновить"') : ''}</div></header>
    ${store?.emulators ? '<div class="sc-demo-badge">DEMO · Только локальные эмуляторы</div>' : ''}
    ${state.tab === 'editor' ? `<div class="sc-editor-meta"><span class="sc-local-indicator"><span></span> Черновик на этом устройстве</span>${state.editor ? `<span class="sc-editing-label">${icon('cards')} ${h(state.editor.title)} · v${state.editor.revision}${state.editor.ownerId !== state.user?.uid ? ' · аккаунт участника' : ''}${button('detach', icon('close'), 'class="sc-icon-button" aria-label="Выбрать другой аккаунт" title="Выбрать другой аккаунт"')}</span>` : '<span class="sc-small sc-muted">Сохраняй PNG без регистрации</span>'}</div><div class="sc-editor-tabs" role="tablist" aria-label="Разделы генератора">${editorModules.map(module => button('editor-module', `${icon(module.icon)}<span>${module.label}</span>`, `data-module="${module.key}" role="tab" id="sc-editor-tab-${module.key}" aria-selected="${module.key === state.editorModule}" aria-controls="root" tabindex="${module.key === state.editorModule ? 0 : -1}" ${!state.editorReady ? 'disabled' : ''}`)).join('')}</div>${state.editorModule === 'buffs' ? `<div id="sc-editor-perms">${renderTearsPanel(readLiveBuffs())}</div>` : ''}` : `<main class="sc-workspace" aria-busy="${state.busy}">${renderWorkspace()}</main>`}
    </div>${state.status ? `<div class="sc-toast ${state.error ? 'sc-toast-error' : ''}" role="${state.error ? 'alert' : 'status'}" aria-live="polite">${icon(state.error ? 'info' : 'check')}<span>${h(state.status)}</span>${button('dismiss-status', icon('close'), 'class="sc-icon-button" aria-label="Закрыть уведомление"')}</div>` : ''}${renderDialogs()}`;
  root.querySelector('.sc-editor-tabs')?.insertAdjacentHTML('afterend', '<p class="sc-editor-click-hint">Нажми на название предмета или слайма, чтобы выбрать качество или звёзды.</p>');
  const dialog = root.querySelector('dialog');
  root.querySelector('.sc-sidebar').inert = mobileLayout.matches && !state.menuOpen;
  if (dialog) dialog.showModal();
  if (focusAfterRender && !state.busy) { root.querySelector(focusAfterRender)?.focus(); focusAfterRender = null; }
  if (scrollToTopAfterRender && !state.busy) { window.scrollTo({ top: 0, behavior: 'instant' }); scrollToTopAfterRender = false; }
}

async function loadPage(append = false) {
  if (!state.user || !state.profileReady) return;
  if (state.tab === 'editor') return;
  if (state.tab === 'account') {
    const [guilds, membership] = await Promise.all([store.guilds(), store.get('memberships', state.user.uid)]);
    state.guilds = guilds; state.myGuild = membership?.guildId || null; return;
  }
  const generation = authGeneration;
  const tab = state.tab;
  const cursor = append ? state.page.cursor : null;
  let page;
  if (tab === 'guilds') { state.guilds = await store.guilds(); state.page = emptyPage(); return; }
  if (tab === 'all') {
    if (!append || !state.allianceRows) {
      const rows = await loadAllianceAccounts({
        fetchPage: cursor => store.cards({ ownerId: state.ownerFilter || null, deleted: state.deleted, cursor }),
        fetchPerson: uid => store.get('users', uid), fetchMembership: uid => store.get('memberships', uid),
        filters: {
          search: state.accountSearch, guild: state.accountGuild, minBonus: state.accountMinBonus,
          phase: state.accountPhase, set: state.accountSet, pieces: state.accountPieces, quality: state.accountQuality,
          slimes: state.accountSlimes, artifacts: state.accountArtifacts, artifactLevel: state.accountArtifactMinLevel,
          relics: state.accountRelics, relicStars: state.accountRelicMinStars, sort: state.accountSort,
        },
        isCurrent: () => generation === authGeneration && state.tab === tab && isAdmin(),
      });
      if (!rows) return;
      state.allianceRows = rows;
    }
    const offset = append ? state.page.rows.length : 0;
    page = { rows: state.allianceRows.slice(offset, offset + 25), more: offset + 25 < state.allianceRows.length, cursor: null };
  } else if (tab === 'mine') {
    page = await store.cards({ ownerId: state.user.uid, deleted: state.deleted, cursor });
  } else if (tab === 'people') {
    state.guilds = await store.guilds();
    page = await store.people({ email: state.emailFilter, guildId: state.guildFilter, cursor });
    page.rows = await Promise.all(page.rows.map(async person => {
      const [membership, access] = await Promise.all([store.get('memberships', person.uid), store.get('access', person.uid)]);
      return { ...person, guildId: membership?.guildId || '', role: access?.role || 'member' };
    }));
    for (const person of page.rows) state.people.set(person.uid, person);
  } else {
    page = await store.audit(cursor);
  }
  if (isAdmin() && tab !== 'people') {
    const uids = new Set(page.rows.map(row => row.ownerId || row.actorId));
    await Promise.all([...uids].filter(uid => uid && !state.people.has(uid)).map(async uid => {
      const person = await store.get('users', uid);
      if (person && generation === authGeneration) state.people.set(uid, person);
    }));
  }
  if (generation !== authGeneration || tab !== state.tab) return;
  state.page = { ...page, rows: append ? [...state.page.rows, ...page.rows] : page.rows };
}
async function connectProfile() {
  const generation = authGeneration;
  const uid = store.user().uid;
  await store.touchProfile();
  const [guilds, membership] = await Promise.all([store.guilds(), store.get('memberships', uid)]);
  if (generation !== authGeneration) return;
  state.guilds = guilds;
  state.myGuild = membership?.guildId || null;
  state.profileReady = true;
  await loadPage();
}
function editorFor(card) {
  return { uid: state.user.uid, cardId: card.id, ownerId: card.ownerId, revision: card.revision, title: card.title };
}
function setEditor(editor) {
  state.editor = editor;
  if (editor) sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(editor));
  else sessionStorage.removeItem(CONTEXT_KEY);
}
async function saveAccountProgress() {
  const generation = authGeneration;
  const user = state.user;
  const value = await prepareAccountDraft(user);
  const saved = state.forceNewAccount || state.editor ? { rows: [] } : await store.cards({ ownerId: user.uid });
  if (generation !== authGeneration) throw new Error('Аккаунт входа изменился. Повтори сохранение.');
  const plan = chooseSaveTarget({ cards: saved.rows, context: state.editor, uid: user.uid, playerName: value.playerName, forceNew: state.forceNewAccount });
  if (plan.action === 'choose') {
    state.tab = 'mine'; state.page = emptyPage(); await loadPage();
    notify('У тебя несколько аккаунтов. Открой нужный в редакторе или нажми «Ещё один аккаунт».'); return;
  }
  if (plan.action === 'update') {
    if (plan.confirm && !confirm(plan.context.ownerId !== user.uid ? 'Обновить прокачку другого участника от имени администратора?' : 'Обновить сохранённый аккаунт данными этого браузера? Локальный черновик не будет загружен из облака автоматически.')) return;
    setEditor(await store.updateCard(plan.context, { title: accountTitle(value, user), config: value }));
  } else setEditor(await store.createCard(accountTitle(value, user), value));
  state.forceNewAccount = false;
  state.status = 'Прокачка аккаунта сохранена. Изменение записано в журнал.'; state.error = false;
}
async function loadCard(card) {
  if (!card || card.deleted) throw new Error('Карточка удалена или недоступна.');
  if (!confirm(`Загрузить «${card.title}» в генератор? Текущий черновик будет сохранён как резервная копия в этом браузере.`)) return;
  const editor = editorFor(card);
  importIntoGenerator(card.config, editor);
  state.editor = editor;
  state.forceNewAccount = false;
  state.tab = 'editor'; state.inspected = null; state.menuOpen = false;
  scrollToTopAfterRender = true;
  notify('Карточка загружена в редактор и сохранена локально. Изменения попадут в облако только по кнопке сохранения.');
}
async function perform(operation, { renderBefore = true } = {}) {
  if (state.busy) return;
  state.busy = true;
  try {
    if (renderBefore) render();
    const pending = operation();
    if (!renderBefore) render();
    await pending;
  }
  catch (error) { state.status = message(error); state.error = true; }
  finally { state.busy = false; render(); }
}

root.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.form;
  const id = form.dataset.id;
  void perform(async () => {
    if (kind === 'people-filter') {
      state.emailFilter = (data.email || '').trim(); state.guildFilter = data.guild;
      if (state.emailFilter && state.guildFilter) throw new Error('Выбери один фильтр: точный email или гильдию.');
      await loadPage();
    } else {
      const name = data.name.trim();
      if (!name || name.length > 80) throw new Error('Название гильдии: от 1 до 80 символов.');
      await store.saveGuild(name, kind === 'rename-guild' ? id : null);
      await loadPage();
      state.status = 'Гильдия сохранена.'; state.error = false;
    }
  });
});
const accountFilterKeys = {
  search: 'accountSearch', guild: 'accountGuild', minBonus: 'accountMinBonus', phase: 'accountPhase',
  set: 'accountSet', pieces: 'accountPieces', quality: 'accountQuality', sort: 'accountSort',
  artifactLevel: 'accountArtifactMinLevel', relicStars: 'accountRelicMinStars',
};
function applyAccountFilterInput(event) {
  const field = event.target.dataset.accountFilter;
  const key = accountFilterKeys[field];
  if (!key) return false;
  state[key] = event.target.value;
  scheduleAllianceReload(['search', 'minBonus', 'artifactLevel'].includes(field) ? 320 : 0);
  return true;
}
root.addEventListener('input', event => {
  if (event.target.tagName === 'SELECT') return;
  if (applyAccountFilterInput(event)) refreshAllianceChrome();
});
root.addEventListener('change', event => {
  if (applyAccountFilterInput(event)) return;
  if (event.target.dataset.filter === 'deleted') {
    state.deleted = event.target.checked;
    void perform(() => loadPage());
  }
});
let dialogReturnFocus = null;
function closeDialog() {
  const picker = state.picker;
  root.querySelector('dialog')?.close();
  state.picker = null; state.inspected = null;
  if (picker) closeLegacyPicker();
  render();
  if (picker?.returnElement?.isConnected) { picker.returnElement.tabIndex = -1; picker.returnElement.focus({ preventScroll: true }); }
  else if (dialogReturnFocus) root.querySelector(dialogReturnFocus)?.focus();
}
root.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); }, true);
root.addEventListener('keydown', event => {
  const list = event.target.closest('[role="tablist"]');
  if (list && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...list.querySelectorAll('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.click();
  }
  if (state.menuOpen && event.key === 'Escape') { state.menuOpen = false; render(); root.querySelector('[data-action="menu"]')?.focus(); }
  if (state.menuOpen && event.key === 'Tab') {
    const items = [...root.querySelectorAll('.sc-sidebar a, .sc-sidebar button:not(:disabled)')];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
  }
});
root.addEventListener('click', event => {
  if (event.target.matches('dialog')) { closeDialog(); return; }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  event.preventDefault();
  const { action, id, tab, module } = target.dataset;
  if (action === 'toggle-account-filters') {
    state.accountFiltersOpen = !state.accountFiltersOpen;
    focusAfterRender = '[data-action="toggle-account-filters"]';
    render();
    return;
  }
  const chipKey = { 'toggle-slime': 'accountSlimes', 'toggle-artifact': 'accountArtifacts', 'toggle-relic': 'accountRelics' }[action];
  if (chipKey) {
    const value = target.dataset.value;
    state[chipKey] = state[chipKey].includes(value) ? state[chipKey].filter(item => item !== value) : [...state[chipKey], value];
    target.setAttribute('aria-pressed', String(state[chipKey].includes(value)));
    refreshAllianceChrome();
    scheduleAllianceReload(0);
    return;
  }
  const clearChip = {
    'clear-slimes': ['accountSlimes', 'slimes'],
    'clear-artifacts': ['accountArtifacts', 'artifacts', 'accountArtifactMinLevel', 'artifactLevel'],
    'clear-relics': ['accountRelics', 'relics', 'accountRelicMinStars', 'relicStars'],
  }[action];
  if (clearChip) {
    state[clearChip[0]] = [];
    root.querySelectorAll(`[data-chip-group="${clearChip[1]}"] [data-action^="toggle-"]`).forEach(chip => chip.setAttribute('aria-pressed', 'false'));
    if (clearChip[2]) {
      state[clearChip[2]] = '0';
      const field = root.querySelector(`[data-account-filter="${clearChip[3]}"]`);
      if (field) field.value = '0';
    }
    refreshAllianceChrome();
    scheduleAllianceReload(0);
    return;
  }
  if (action === 'menu' || action === 'close-menu') {
    state.menuOpen = action === 'menu' ? !state.menuOpen : false; render();
    root.querySelector(state.menuOpen ? '.sc-sidebar a' : '[data-action="menu"]')?.focus(); return;
  }
  if (action === 'dismiss-status') { state.status = ''; render(); return; }
  if (action === 'close-dialog') { closeDialog(); return; }
  if (action === 'stats-tab') {
    state.statsTab = module; render(); root.querySelector(`#sc-stat-tab-${CSS.escape(module)}`)?.focus(); return;
  }
  if (action === 'choose-option') {
    root.querySelector('dialog')?.close();
    try { chooseLegacyOption(Number(target.dataset.index)); state.picker = null; render(); }
    catch (error) { state.picker = null; notify(message(error), true); }
    return;
  }
  if (action === 'open-save') {
    if (!state.user || !state.profileReady) { state.tab = 'mine'; state.page = emptyPage(); render(); return; }
    state.status = ''; state.error = false;
    void perform(saveAccountProgress); return;
  }
  if (action === 'login') {
    if (!store || !state.authReady || state.busy) return;
    state.status = ''; state.error = false;
    // Start OAuth in the tap handler, before replacing its button or awaiting
    // anything. Safari must retain user activation to open the Google window.
    void perform(() => {
      if (store.emulators) {
        const email = prompt('Тестовый email для локального Google Auth Emulator:', 'owner@example.test');
        return email ? store.loginDemo(email.trim()) : null;
      }
      if (authEnvironment.embedded) throw new Error('Google запрещает вход из встроенного браузера. Открой сайт в Safari или Chrome и повтори вход.');
      return store.login();
    }, { renderBefore: false });
    return;
  }
  const guildId = action === 'assign-guild' ? root.querySelector(`[data-guild-for="${CSS.escape(id)}"]`).value : null;
  void perform(async () => {
    if (action === 'logout') {
      await store.logout(); setEditor(null);
    } else if (action === 'retry-profile') await connectProfile();
    else if (action === 'tab' || action === 'home') {
      const route = action === 'home' ? 'editor' : tab;
      if (!(route in pages)) return;
      if (['people', 'all', 'guilds', 'audit'].includes(route) && !isAdmin()) throw new Error('Раздел доступен только администраторам.');
      state.tab = route; state.page = emptyPage(); state.deleted = false; state.menuOpen = false;
      focusAfterRender = `.sc-sidebar [data-tab="${route}"]`;
      scrollToTopAfterRender = true;
      if (route === 'all') { state.ownerFilter = ''; state.accountFiltersOpen = false; }
      await loadPage();
    } else if (action === 'editor-module') {
      focusAfterRender = `#sc-editor-tab-${CSS.escape(module)}`;
      await selectEditorModule(module);
      state.editorModule = module;
    } else if (action === 'card-filter') {
      state.deleted = target.dataset.deleted === 'true'; await loadPage();
    } else if (action === 'copy-uid') {
      await navigator.clipboard.writeText(state.user.uid);
      state.status = 'UID аккаунта скопирован.'; state.error = false;
    } else if (action === 'refresh' || action === 'more') await loadPage(action === 'more');
    else if (action === 'reset-accounts') {
      clearTimeout(allianceTimer);
      state.accountSearch = ''; state.accountGuild = ''; state.accountMinBonus = 0; state.accountPhase = '';
      state.accountSet = ''; state.accountPieces = '0'; state.accountQuality = ''; state.accountSort = 'recent';
      state.accountSlimes = []; state.accountArtifacts = []; state.accountArtifactMinLevel = '0';
      state.accountRelics = []; state.accountRelicMinStars = '0';
      await loadPage();
    }
    else if (action === 'clear-owner') { state.ownerFilter = ''; await loadPage(); }
    else if (action === 'reset-people') {
      state.emailFilter = ''; state.guildFilter = ''; await loadPage();
    } else if (action === 'person-cards') {
      state.ownerFilter = id; state.tab = 'all'; state.deleted = false; state.accountFiltersOpen = false; scrollToTopAfterRender = true; await loadPage();
    } else if (action === 'new-account') {
      setEditor(null); state.forceNewAccount = true; state.tab = 'editor'; scrollToTopAfterRender = true;
      state.status = 'Сохраним ещё один аккаунт отдельно. Ник можно изменить в редакторе, название сохранения не требуется.'; state.error = false;
    } else if (action === 'detach') {
      setEditor(null); state.forceNewAccount = false; state.tab = 'mine'; await loadPage();
    }
    else if (action === 'undo-load') {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (!backup) throw new Error('Резервной копии пока нет. Она создаётся при загрузке карточки из облака.');
      if (confirm('Вернуть предыдущий локальный черновик? Текущий займёт его место в резервной копии.')) {
        importIntoGenerator(JSON.parse(backup)); state.editor = null;
        state.tab = 'editor';
        state.status = 'Локальный черновик восстановлен.'; state.error = false;
      }
    } else if (action === 'assign-guild') {
      await store.assignGuild(id, guildId); await loadPage();
      state.status = 'Гильдия участника обновлена, событие записано в журнал.'; state.error = false;
    } else if (action === 'assign-role') {
      const person = state.page.rows.find(row => row.uid === id);
      const role = person.role === 'admin' ? 'member' : 'admin';
      if (!confirm(`${role === 'admin' ? 'Выдать права администратора' : 'Снять права администратора'}: ${person.email}? Админ видит всех участников и карточки.`)) return;
      await store.assignRole(id, role); await loadPage();
      state.status = 'Права обновлены.'; state.error = false;
    } else if (['load-card', 'download', 'delete-card', 'restore-card', 'inspect-card'].includes(action)) {
      const card = await store.get('cards', id);
      if (!card) throw new Error('Карточка не найдена.');
      if (action === 'inspect-card') {
        state.inspected = card; state.statsTab = 'equipment';
        dialogReturnFocus = `[data-action="inspect-card"][data-id="${CSS.escape(card.id)}"]`;
      } else if (action === 'load-card') await loadCard(card);
      else if (action === 'download') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(card.config, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `${card.playerName || 'card'}-${card.id}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const deleted = action === 'delete-card';
        if (!confirm(`${deleted ? 'Переместить в корзину' : 'Восстановить'} «${card.title}»?`)) return;
        await store.updateCard(editorFor(card), { deleted });
        if (state.editor?.cardId === id) setEditor(null);
        await loadPage(); state.status = deleted ? 'Карточка в корзине.' : 'Карточка восстановлена.'; state.error = false;
      }
    }
  });
});

render();
mobileLayout.addEventListener('change', () => { state.menuOpen = false; render(); });
observeEditorModule(key => { state.editorModule = key; state.editorReady = true; render(); });
installEditorEnhancements({
  onPicker(picker) {
    if (!picker && !state.picker) return;
    if (picker && state.tab !== 'editor') return;
    state.picker = picker;
    dialogReturnFocus = `#sc-editor-tab-${state.editorModule}`;
    render();
  },
  onProgress(buffs) {
    const panel = root.querySelector('#sc-editor-perms');
    if (panel) { const html = renderTearsPanel(buffs); if (panel.innerHTML !== html) panel.innerHTML = html; }
  },
});
if (store) {
  void store.redirectResult().catch(error => notify(message(error), true));
  store.onAuth(user => {
    const generation = ++authGeneration;
    unsubscribeAccess?.(); unsubscribeAccess = null;
    const previousUser = state.user;
    state.user = user; state.authReady = true; state.profileReady = false; state.role = 'member';
    state.page = emptyPage(); state.people.clear(); state.guilds = []; state.ownerFilter = ''; state.myGuild = null; state.allianceRows = null;
    state.inspected = null; state.picker = null; state.forceNewAccount = false;
    if (previousUser || ['people', 'all', 'guilds', 'audit'].includes(state.tab)) state.tab = 'editor';
    state.status = ''; state.error = false;
    const context = readContext();
    state.editor = user && context?.uid === user.uid ? context : null;
    if (!user) { render(); return; }
    state.people.set(user.uid, { displayName: user.displayName, email: user.email });
    unsubscribeAccess = store.watchAccess(role => {
      if (generation !== authGeneration) return;
      if (isAdmin() && !['owner', 'admin'].includes(role)) {
        // Drop private admin data immediately on revocation; Rules also reject subsequent requests.
        state.page = emptyPage(); state.people.clear(); state.tab = 'editor'; state.inspected = null; state.allianceRows = null;
        if (state.editor?.ownerId !== user.uid) setEditor(null);
      }
      if (role !== 'owner') state.emailFilter = '';
      state.role = role; render();
    }, error => { if (generation === authGeneration) notify(message(error), true); });
    render();
    void connectProfile().then(() => { if (generation === authGeneration) render(); })
      .catch(error => { if (generation === authGeneration) notify(message(error), true); });
  });
}
