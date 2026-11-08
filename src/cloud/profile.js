// The deployed React generator already supports this JSON format and storage key.
// Keep the original compiled application untouched; cloud loading uses its JSON importer.
export const DRAFT_KEY = 'slime_card_profile_autosave';
export const BACKUP_KEY = 'slime_card_before_cloud_load';
export const CONTEXT_KEY = 'slime_cloud_editor_context';
const MODULES = ['relics', 'slimes', 'equipment', 'buffs', 'artifacts'];
const listFields = { relics: 'relicsList', slimes: 'slimesList', equipment: 'equipmentList', buffs: 'buffsList', artifacts: 'artifactsList' };
const entryFields = {
  relics: ['name', 'state', 'slotIndex'], slimes: ['name', 'state', 'level', 'skin', 'slotIndex'],
  equipment: ['name', 'grade'], buffs: ['name', 'value'], artifacts: ['name', 'state', 'level', 'fragments'],
};

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function normalizeConfig(value) {
  if (!object(value) || value.fileType !== 'slime-card-config' || value.version !== '1.0.0' || !object(value.modules)) {
    throw new Error('Неизвестный формат карточки. Нужен JSON генератора версии 1.0.0.');
  }
  if (typeof value.playerName !== 'string' || value.playerName.length > 120) throw new Error('Имя игрока должно быть не длиннее 120 символов.');
  const config = { fileType: 'slime-card-config', version: '1.0.0', playerName: value.playerName.trim(), modules: {} };
  for (const key of MODULES) {
    const module = value.modules[key];
    if (module == null) { config.modules[key] = null; continue; }
    const list = module[listFields[key]];
    if (!object(module) || !Array.isArray(list) || list.length > 300) throw new Error(`Некорректный раздел: ${key}.`);
    for (const entry of list) {
      if (!object(entry) || typeof entry.name !== 'string' || !entry.name || entry.name.length > 120) throw new Error(`Некорректный элемент: ${key}.`);
      for (const item of Object.values(entry)) {
        if (!['string', 'number', 'boolean'].includes(typeof item) && item !== null) throw new Error('Недопустимое значение в карточке.');
        if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Некорректное число в карточке.');
      }
      if (key === 'buffs' && (typeof entry.value !== 'number' || !Number.isFinite(entry.value))) throw new Error('Некорректный стат.');
      if (['relics', 'slimes', 'artifacts'].includes(key) && (typeof entry.state !== 'string' || entry.state.length > 40)) throw new Error('Некорректное состояние элемента.');
      if (['slimes', 'artifacts'].includes(key) && (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 10000)) throw new Error('Некорректный уровень.');
      if (key === 'slimes' && (!Number.isInteger(entry.skin) || entry.skin < 0 || entry.skin > 20)) throw new Error('Некорректный скин.');
      if (entry.slotIndex !== undefined && (!Number.isInteger(entry.slotIndex) || entry.slotIndex < -1 || entry.slotIndex > 10000)) throw new Error('Некорректный слот.');
      if (key === 'equipment' && (typeof entry.grade !== 'string' || entry.grade.length > 40)) throw new Error('Некорректный ранг снаряжения.');
      if (key === 'artifacts' && (!Number.isInteger(entry.fragments) || entry.fragments < 0 || entry.fragments > 1e9)) throw new Error('Некорректное количество фрагментов.');
    }
    const clean = { [listFields[key]]: list.map(entry => Object.fromEntries(entryFields[key].filter(field => entry[field] !== undefined).map(field => [field, entry[field]]))) };
    if (key === 'relics' || key === 'slimes') {
      const grid = module[key === 'relics' ? 'relicsGrid' : 'slimesGrid'];
      if (!object(grid) || ![grid.rows, grid.cols].every(n => Number.isInteger(n) && n > 0 && n <= 100)) throw new Error('Некорректный размер сетки.');
      if (!['default', 'manual', 'to-end', 'hidden', undefined].includes(module.layoutMode)) throw new Error('Некорректная раскладка.');
      clean[key === 'relics' ? 'relicsGrid' : 'slimesGrid'] = { rows: grid.rows, cols: grid.cols };
      if (module.layoutMode !== undefined) clean.layoutMode = module.layoutMode;
    }
    config.modules[key] = clean;
  }
  if (new TextEncoder().encode(JSON.stringify(config)).length > 400_000) throw new Error('Карточка слишком большая (лимит 400 КБ).');
  return config;
}

export function readDraft(storage = localStorage) {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) throw new Error('Сначала заполни карточку в генераторе. Локальный черновик пока не найден.');
  return normalizeConfig(JSON.parse(raw));
}

export function readContext(storage = sessionStorage) {
  try { return JSON.parse(storage.getItem(CONTEXT_KEY)) || null; } catch { return null; }
}

export function importIntoGenerator(value, editorContext = null) {
  const config = normalizeConfig(value);
  const inputs = [...document.querySelectorAll('#root input[type="file"]')];
  const input = inputs.find(el => /json/i.test(el.accept));
  if (!input) throw new Error('Не найден JSON-импорт генератора. Дождись загрузки страницы.');
  const previous = localStorage.getItem(DRAFT_KEY);
  if (previous) localStorage.setItem(BACKUP_KEY, previous);
  // Save before importing, so storage quota / privacy errors cannot silently lose a draft.
  localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  if (editorContext) sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(editorContext));
  else sessionStorage.removeItem(CONTEXT_KEY);
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(config)], 'cloud-card.json', { type: 'application/json' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return config;
}

export function cardStats(config) {
  const modules = normalizeConfig(config).modules;
  return MODULES.map(key => ({ key, entries: modules[key]?.[listFields[key]] || [] }));
}
