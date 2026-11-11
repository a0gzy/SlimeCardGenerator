import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountProgress, loadAllianceAccounts, matchesProgressFilter, sortProgressAccounts } from '../src/cloud/account-search.js';
import { equipmentSets } from '../src/cloud/progress.js';
import { renderSetPanels } from '../src/cloud/ui.js';

function card(id, level, equipment = []) {
  return { id, ownerId: id, playerName: id, updatedAt: { seconds: level }, config: {
    fileType: 'slime-card-config', version: '1.0.0', playerName: id,
    modules: { slimes: { slimesGrid: { rows: 1, cols: 1 }, slimesList: [{ name: 'Arp', state: '0', level, skin: 0 }] }, equipment: { equipmentList: equipment } },
  } };
}
test('bonus threshold includes equality and rejects missing progress', () => {
  const progress = accountProgress(card('a', 250));
  assert.equal(progress.bonus, 2.5);
  assert.ok(matchesProgressFilter(progress, { minBonus: 2.5 }));
  assert.equal(matchesProgressFilter(progress, { minBonus: 2.51 }), false);
  assert.equal(matchesProgressFilter(accountProgress({}), { minBonus: 1 }), false);
});
test('set filters require the requested number of qualifying pieces of one set', () => {
  const progress = accountProgress(card('a', 250, [
    { name: 'AbyssSword', grade: 'legendary' }, { name: 'AbyssHelmet', grade: 'mythic3' },
    { name: 'AbyssChestplate', grade: 'epic' }, { name: 'AstralRing', grade: 'fantasy2' },
  ]));
  assert.ok(matchesProgressFilter(progress, { set: 'abyss', pieces: 2, quality: 'legendary' }));
  assert.equal(matchesProgressFilter(progress, { set: 'abyss', pieces: 3, quality: 'legendary' }), false);
  assert.equal(matchesProgressFilter(progress, { pieces: 4 }), false);
  assert.ok(matchesProgressFilter(progress, { quality: 'fantasy' }));
  assert.ok(matchesProgressFilter(progress, { set: 'abyss', pieces: 1, quality: 'mythic3' }));
  assert.equal(matchesProgressFilter(progress, { set: 'abyss', pieces: 1, quality: 'fantasy' }), false);
  assert.ok(matchesProgressFilter(progress, { quality: 'fantasy1' }));
});
test('phase and owned item filters check slimes, artifacts levels and relic levels', () => {
  const progress = accountProgress({ config: {
    fileType: 'slime-card-config', version: '1.0.0', playerName: 'Items',
    modules: {
      buffs: { buffsList: [{ name: 'ATK', value: 1 }] },
      slimes: { slimesGrid: { rows: 1, cols: 1 }, slimesList: [{ name: 'Arp', state: '3y', level: 10, skin: 0 }] },
      artifacts: { artifactsList: [{ name: 'Fenicis', state: '2y', level: 7, fragments: 0 }] },
      relics: { relicsGrid: { rows: 1, cols: 1 }, relicsList: [{ name: 'DemonClaw', state: '4r' }] },
    },
  } });
  assert.equal(progress.perms.phase, 1);
  assert.ok(matchesProgressFilter(progress, { slimes: ['Arp'] }));
  assert.equal(matchesProgressFilter(progress, { slimes: ['Yana'] }), false);
  assert.ok(matchesProgressFilter(progress, { artifacts: ['Fenicis'], artifactLevel: 7 }));
  assert.equal(matchesProgressFilter(progress, { artifacts: ['Fenicis'], artifactLevel: 8 }), false);
  assert.ok(matchesProgressFilter(progress, { relics: ['DemonClaw'], relicLevel: 9 }));
  assert.equal(matchesProgressFilter(progress, { relics: ['DemonClaw'], relicLevel: 10 }), false);
  assert.ok(matchesProgressFilter(progress, { phase: '1' }));
  assert.equal(matchesProgressFilter(progress, { phase: '2' }), false);
  assert.equal(matchesProgressFilter(progress, { phase: 'closed' }), false);
});
test('relic minimum level follows all fifteen star tiers, including colour transitions', () => {
  const states = ['0', ...['y', 'r', 'v'].flatMap(color => [1, 2, 3, 4, 5].map(count => `${count}${color}`))];
  for (const [level, state] of states.entries()) {
    const progress = accountProgress({ config: {
      fileType: 'slime-card-config', version: '1.0.0', playerName: 'Relics',
      modules: { relics: { relicsGrid: { rows: 1, cols: 1 }, relicsList: [{ name: 'DemonClaw', state }] } },
    } });
    for (let minimum = 0; minimum <= 15; minimum++) {
      assert.equal(matchesProgressFilter(progress, { relics: ['DemonClaw'], relicLevel: minimum }), level >= minimum, `${state} >= ${minimum}`);
    }
  }
});
test('each selected relic must meet the level, and missing relics never match', () => {
  const progress = { relics: [{ name: 'DemonClaw', state: '5v' }, { name: 'FrozenHeart', state: '5r' }, { name: 'OminousMask', state: 'no' }] };
  assert.ok(matchesProgressFilter(progress, { relics: ['DemonClaw', 'FrozenHeart'], relicLevel: 10 }));
  assert.equal(matchesProgressFilter(progress, { relics: ['DemonClaw', 'FrozenHeart'], relicLevel: 11 }), false);
  assert.equal(matchesProgressFilter(progress, { relics: ['OminousMask'], relicLevel: 0 }), false);
  assert.equal(matchesProgressFilter(progress, { relics: ['Unknown'], relicLevel: 0 }), false);
});
test('global bonus sorting is stable and places missing data last in either direction', () => {
  const rows = [card('small', 100), { id: 'missing' }, card('large', 250)];
  assert.deepEqual(sortProgressAccounts(rows, 'bonus-desc').map(row => row.id), ['large', 'small', 'missing']);
  assert.deepEqual(sortProgressAccounts(rows, 'bonus-asc').map(row => row.id), ['small', 'large', 'missing']);
  assert.equal(rows[0].id, 'small');
});
test('sorting considers later Firestore pages and combines guild and progress filters', async () => {
  let reads = 0;
  const rows = await loadAllianceAccounts({
    fetchPage: async cursor => { reads++; return cursor ? { rows: [card('large', 250)], more: false } : { rows: [card('small', 100)], more: true, cursor: 'next' }; },
    fetchMembership: async () => ({ guildId: 'guild' }),
    filters: { guild: 'guild', minBonus: .5, sort: 'bonus-desc' },
  });
  assert.equal(reads, 2);
  assert.deepEqual(rows.map(row => row.id), ['large', 'small']);
});
test('cancelled queries return no stale private data', async () => {
  const result = await loadAllianceAccounts({ fetchPage: async () => ({ rows: [card('a', 250)], more: false }), filters: {}, isCurrent: () => false });
  assert.equal(result, null);
});
test('compact previews use exactly four coloured corners per set; details remain 2x2', () => {
  const sets = equipmentSets([{ name: 'AstralSword', grade: 'legendary' }]);
  const compact = renderSetPanels(sets, true);
  assert.equal((compact.match(/class="sc-set-corner /g) || []).length, 12);
  assert.ok(compact.includes('sc-corner-Sword" data-slot="Sword" data-quality="legendary"'));
  assert.ok(compact.includes('sc-set-center'));
  assert.ok(!compact.includes('sc-set-layout'));
  assert.ok(renderSetPanels(sets).includes('sc-set-layout'));
});
