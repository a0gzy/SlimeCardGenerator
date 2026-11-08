import { BUFF_ORDER, BUFF_RULES, equipmentQuality, GRADE_NAMES } from './progress.js';
import { GAME_ART } from './game-assets.js';
import { readDraft } from './profile.js';

let activeMenu = null;
const states = {
  relics: ['no', '0', ...['y', 'r', 'v'].flatMap(color => [1, 2, 3, 4, 5].map(n => `${n}${color}`))],
  slimes: ['no', '0', ...['y', 'r'].flatMap(color => [1, 2, 3, 4, 5].map(n => `${n}${color}`))],
  artifacts: ['no', '0', '1y', '2y', '3y', '4y', '5y'],
};
export function stateLabel(state) {
  if (state === 'no') return 'Нет';
  if (state === '0') return '0 звёзд';
  return `${parseInt(state, 10)} ★ · ${{ y: 'жёлтые', r: 'красные', v: 'фиолетовые' }[state.at(-1)] || ''}`;
}
export function readLiveBuffs() {
  const module = document.querySelector('#root header button[class*="dropdownToggle"]')?.textContent.trim();
  if (module === 'Баффы') {
    const inputs = [...document.querySelectorAll('#root main input[type="text"]')];
    if (inputs.length === BUFF_ORDER.length) return inputs.map((input, i) => ({ name: BUFF_ORDER[i], value: Math.max(0, Math.min(BUFF_RULES[BUFF_ORDER[i]].cap, parseFloat(input.value) || 0)) }));
  }
  try { return readDraft().modules.buffs?.buffsList || []; } catch { return []; }
}
export async function prepareAccountDraft(user) {
  const input = document.querySelector('#root input[placeholder="Ник игрока"]');
  if (!input) throw new Error('Дождись загрузки редактора.');
  if (!input.value.trim()) {
    const name = (user.displayName?.trim() || user.email?.split('@')[0] || 'Аккаунт').slice(0, 120);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Let React commit and its existing autosave effect run. Do not wait for
  // animation frames: they stop in background tabs and would leave Save pending.
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  const config = readDraft();
  if (config.playerName !== input.value.trim()) throw new Error('Автосохранение ещё выполняется. Повтори сохранение через мгновение.');
  return config;
}
function describeMenu(menu, module) {
  const buttons = [...menu.querySelectorAll('button')];
  const card = menu.closest('[class*="_cardContainer_"], [class*="_artCard_"]');
  const image = card?.querySelector('img');
  let name = image?.alt || '';
  if (module === 'relics') name = Object.entries(GAME_ART.relics).find(([, file]) => image?.src.endsWith(file))?.[0] || 'Реликвия';
  return { module, name, returnElement: card, choices: buttons.map((button, i) => {
    const state = states[module]?.[i];
    const text = button.textContent.trim();
    return {
      index: i, label: state ? stateLabel(state) : GRADE_NAMES[text] || text || `Вариант ${i + 1}`,
      quality: module === 'equipment' ? equipmentQuality(text).family : 'none',
      state, selected: button.className.includes('selectedItem') || !!button.style.backgroundColor?.includes('230, 168, 23'),
      images: [...button.querySelectorAll('img')].slice(0, 5).map(image => image.src).filter(src => src.startsWith('data:image/png;base64,') || new URL(src, location.href).origin === location.origin),
    };
  }) };
}
export function installEditorEnhancements({ onPicker, onProgress }) {
  const editor = document.getElementById('root');
  let progressTimer;
  function changed() {
    for (const card of editor.querySelectorAll('main [class*="_cardContainer_"]')) {
      const image = card.querySelector('img');
      if (!image) continue;
      const label = image.alt === 'Relic Base' ? Object.entries(GAME_ART.relics).find(([, file]) => image.src.endsWith(file))?.[0] : image.alt;
      if (label && card.dataset.editorLabel !== label) { card.dataset.editorLabel = label; card.title = 'Нажми на название: звёзды или качество'; }
    }
    for (const card of editor.querySelectorAll('main [class*="_artCard_"]')) {
      const name = card.querySelector('img')?.nextElementSibling;
      if (name && !name.dataset.namePicker) {
        name.dataset.namePicker = 'true'; name.tabIndex = 0; name.setAttribute('role', 'button'); name.style.cursor = 'pointer';
        const open = () => card.querySelector('button')?.click();
        name.addEventListener('click', open);
        name.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); } });
      }
    }
    const label = document.querySelector('#root header button[class*="dropdownToggle"]')?.textContent.trim();
    const module = { 'Снаряжение': 'equipment', 'Слаймы': 'slimes', 'Реликвии': 'relics', 'Артефакты': 'artifacts', 'Баффы': 'buffs' }[label];
    const menus = [...editor.querySelectorAll('main [class*="_menuOverlay_"]')];
    if (module === 'artifacts') menus.push(...[...editor.querySelectorAll('main div[style]')].filter(node => node.style.overflowY === 'auto' && node.style.maxHeight === '80px' && node.style.visibility !== 'hidden'));
    const menu = menus.find(node => getComputedStyle(node).visibility !== 'hidden' && node.querySelector('button')) || null;
    if (menu !== activeMenu) {
      activeMenu = menu;
      onPicker(menu ? describeMenu(menu, module) : null);
    }
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => onProgress(readLiveBuffs()), 20);
  }
  const observer = new MutationObserver(changed);
  observer.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  editor.addEventListener('input', changed);
  editor.addEventListener('change', changed);
  // Legacy pickers close on document mousedown. Keep them mounted while the user
  // chooses in our full-list dialog, then relay the original option's click.
  const keepOpen = event => { if (event.target.closest('[data-legacy-picker]')) event.stopPropagation(); };
  document.addEventListener('mousedown', keepOpen, true);
  changed();
  return () => { observer.disconnect(); clearTimeout(progressTimer); editor.removeEventListener('input', changed); editor.removeEventListener('change', changed); document.removeEventListener('mousedown', keepOpen, true); };
}
export function chooseLegacyOption(index) {
  const option = activeMenu?.querySelectorAll('button')[index];
  if (!option?.isConnected) throw new Error('Список выбора уже закрыт. Открой его ещё раз.');
  option.click();
}
export function closeLegacyPicker() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}
