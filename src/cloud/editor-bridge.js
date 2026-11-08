import { editorModules } from './ui.js';

function toggle() { return document.querySelector('#root header button[class*="dropdownToggle"]'); }
export function observeEditorModule(onChange) {
  const editor = document.getElementById('root');
  let previous = null;
  function update() {
    const label = toggle()?.textContent.trim();
    const module = editorModules.find(module => module.label === label);
    if (module && module.key !== previous) { previous = module.key; onChange(module.key); }
  }
  const observer = new MutationObserver(update);
  observer.observe(editor, { subtree: true, childList: true, characterData: true });
  update();
  return () => observer.disconnect();
}

export async function selectEditorModule(key) {
  const module = editorModules.find(module => module.key === key);
  const control = toggle();
  if (!module || !control) throw new Error('Дождись загрузки редактора.');
  if (control.textContent.trim() === module.label) return;
  const container = control.parentElement;
  const findOption = () => [...container.querySelectorAll('button[class*="dropdownItem"]')].find(option => option.textContent.trim() === module.label);
  if (!findOption()) control.click();
  await new Promise((resolve, reject) => {
    let timeout;
    function finish() {
      const option = findOption();
      if (!option) return false;
      observer.disconnect(); clearTimeout(timeout); option.click(); resolve(); return true;
    }
    const observer = new MutationObserver(finish);
    observer.observe(container, { subtree: true, childList: true });
    if (!finish()) timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Не удалось переключить раздел редактора. Обнови страницу.'));
    }, 2000);
  });
}
