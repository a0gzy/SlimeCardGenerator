import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { h } from '../src/cloud/ui.js';

test('relic filter offers all fifteen levels with colour labels and selected minimum', async () => {
  const source = await readFile(new URL('../src/cloud/app.js', import.meta.url), 'utf8');
  const state = {
    accountFiltersOpen: true, accountRelicMinLevel: '11', accountArtifactMinLevel: '0',
    accountSearch: '', accountGuild: '', accountSort: 'recent', accountPhase: '',
    accountSet: '', accountPieces: '0', accountQuality: '', accountSlimes: [], accountArtifacts: [], accountRelics: [],
  };
  const context = vm.createContext({
    state, h, icon: () => '', allianceActiveCount: () => 0, guildOptions: () => '',
    renderChipBlock: ({ tools = '' }) => tools, QUALITY_CHOICES: [], GRADE_NAMES: {}, ACCOUNT_SETS: [],
    SLIME_CHOICES: [], ARTIFACT_CHOICES: [], RELIC_CHOICES: [],
  });
  vm.runInContext(source.slice(source.indexOf('const RELIC_LEVEL_CHOICES'), source.indexOf('function renderChipBlock(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderAllianceFilters('), source.indexOf('function allianceActiveCount(')), context);
  const html = context.renderAllianceFilters();
  const select = html.match(/<select data-account-filter="relicLevel">(.*?)<\/select>/s)?.[1];
  assert.ok(select);
  assert.equal((select.match(/<option /g) || []).length, 16);
  for (let level = 1; level <= 15; level++) {
    const colour = level <= 5 ? 'золотые' : level <= 10 ? 'красные' : 'синие';
    assert.ok(select.includes(`${level} ур. · ${(level - 1) % 5 + 1} ★ · ${colour}`));
  }
  assert.ok(select.includes('value="11" selected'));
  assert.ok(!html.includes('Мин. звёзды'));
});
