import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorModules, emptyState, h, pages, renderStatsTabs, roleName, summarizeCard } from '../src/cloud/ui.js';

function fixture() {
  return { fileType: 'slime-card-config', version: '1.0.0', playerName: 'Player', modules: {
    buffs: { buffsList: [{ name: 'ATK', value: 12.5 }, { name: 'HP', value: 0 }] },
    slimes: { slimesGrid: { rows: 2, cols: 2 }, layoutMode: 'default', slimesList: [{ name: 'Arp', state: '0', level: 10, skin: 0 }, { name: 'Veinley', state: 'no', level: 1, skin: 0 }] },
    relics: null, artifacts: null, equipment: null,
  } };
}
test('HTML values and empty states escape user-controlled text', () => {
  assert.equal(h('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.ok(!emptyState('<script>', '<img>').includes('<script>'));
});
test('editor has five permanent modules and a dedicated sidebar route', () => {
  assert.deepEqual(editorModules.map(module => module.key), ['equipment', 'slimes', 'relics', 'artifacts', 'buffs']);
  assert.equal(pages.editor.label, 'Прокачка аккаунта');
  assert.ok(pages.account && pages.mine && pages.audit);
});
test('card previews count owned items and nonzero stats, not nonexistent totals', () => {
  const summary = summarizeCard(fixture());
  assert.equal(summary.slimes, 1);
  assert.equal(summary.stats.length, 1);
  assert.equal(summary.stats[0].value, 12.5);
  assert.equal(summarizeCard({}).stats.length, 0);
});
test('card composition uses accessible tabs instead of disclosures', () => {
  const html = renderStatsTabs(fixture(), 'slimes');
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  assert.ok(html.includes('id="sc-stat-tab-slimes"'));
  assert.ok(html.includes('role="tabpanel" aria-labelledby="sc-stat-tab-slimes"'));
  assert.ok(html.includes('sc-collection-grid'));
  assert.ok(html.includes('alt="Arp"'));
  assert.ok(!html.includes('<details'));
});
test('stats and composition escape arbitrary names', () => {
  const config = fixture();
  config.modules.buffs.buffsList[0].name = '<img src=x onerror=alert(1)>';
  const html = renderStatsTabs(config);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});
test('missing modules have a useful empty state and unknown roles stay unprivileged', () => {
  assert.ok(renderStatsTabs(fixture(), 'artifacts').includes('Раздел пока пуст'));
  assert.equal(roleName('anything'), 'Участник');
});
