import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY, cardStats, normalizeConfig, readContext, readDraft } from '../src/cloud/profile.js';
import { configScript, parseWebConfig } from '../scripts/config.mjs';

export function fixture() {
  return {
    fileType: 'slime-card-config', version: '1.0.0', playerName: ' Игрок ',
    modules: {
      relics: { relicsGrid: { rows: 3, cols: 6 }, layoutMode: 'to-end', relicsList: [{ name: 'DemonClaw', state: '0' }] },
      slimes: { slimesGrid: { rows: 5, cols: 6 }, layoutMode: 'manual', slimesList: [{ name: 'Arp', state: '0', level: 250, skin: 0, slotIndex: 0 }] },
      equipment: { equipmentList: [{ name: 'AstralSword', grade: 'no' }] },
      buffs: { buffsList: [{ name: 'ATK', value: 12.5 }] },
      artifacts: { artifactsList: [{ name: 'Fenicis', state: 'no', level: 1, fragments: 0 }] },
    },
  };
}
test('normalizes the existing generator format without changing its modules', () => {
  const value = fixture();
  const normalized = normalizeConfig({ ...value, exportDate: 'ignored', exportedModules: ['buffs'] });
  assert.equal(normalized.playerName, 'Игрок');
  assert.deepEqual(normalized.modules, value.modules);
  assert.equal(normalized.exportDate, undefined);
  normalized.modules.buffs.buffsList[0].value = 99;
  assert.equal(value.modules.buffs.buffsList[0].value, 12.5);
});
test('supports all four original layout modes', () => {
  for (const layoutMode of ['default', 'manual', 'to-end', 'hidden']) {
    const value = fixture(); value.modules.relics.layoutMode = layoutMode;
    assert.equal(normalizeConfig(value).modules.relics.layoutMode, layoutMode);
  }
});
test('partial generator exports are supported', () => {
  const value = fixture(); value.modules = { buffs: value.modules.buffs };
  assert.equal(normalizeConfig(value).modules.slimes, null);
});
test('rejects invalid versions, grids, stats, names and oversized documents', () => {
  for (const mutate of [
    value => { value.version = '2'; },
    value => { value.modules.slimes.slimesGrid.rows = -1; },
    value => { value.modules.buffs.buffsList[0].value = Infinity; },
    value => { value.modules.buffs.buffsList[0].value = '12'; },
    value => { value.modules.slimes.slimesList[0].state = null; },
    value => { value.modules.slimes.slimesList[0].level = 'bad'; },
    value => { value.modules.slimes.slimesList[0].slotIndex = 0.5; },
    value => { value.playerName = 'a'.repeat(121); },
    value => { value.modules.artifacts.artifactsList[0].state = 'a'.repeat(400_000); },
  ]) { const value = fixture(); mutate(value); assert.throws(() => normalizeConfig(value)); }
});
test('reads generator draft and handles unavailable or corrupted state', () => {
  assert.equal(readDraft({ getItem(key) { assert.equal(key, DRAFT_KEY); return JSON.stringify(fixture()); } }).playerName, 'Игрок');
  assert.throws(() => readDraft({ getItem: () => null }), /Сначала/);
  assert.throws(() => readDraft({ getItem: () => '{' }));
  assert.equal(readContext({ getItem: () => '{' }), null);
  assert.equal(readContext({ getItem() { throw new Error('blocked'); } }), null);
});
test('stats preserve names and values', () => {
  const stats = cardStats(fixture());
  assert.equal(stats.find(row => row.key === 'buffs').entries[0].value, 12.5);
});
const web = { apiKey: 'public-test-key', authDomain: 'example.firebaseapp.com', projectId: 'example-project', storageBucket: 'example.firebasestorage.app', messagingSenderId: '123', appId: '1:123:web:test' };
test('reads JSON or Firebase snippets and strips unrelated fields', () => {
  assert.deepEqual(parseWebConfig(JSON.stringify({ ...web, ignored: 'no' })), web);
  const snippet = `const firebaseConfig = {${Object.entries(web).map(([key, value]) => `${key}: '${value}'`).join(',')}};`;
  assert.deepEqual(parseWebConfig(snippet), web);
});
test('rejects private credentials and incomplete browser configuration', () => {
  assert.throws(() => parseWebConfig(JSON.stringify({ ...web, private_key: 'do not publish' })), /service-account/);
  assert.throws(() => parseWebConfig('{}'), /Missing/);
});
test('generated config escapes script delimiters', () => {
  assert.ok(!configScript({ ...web, appId: '</script>' }).includes('</script>'));
});
