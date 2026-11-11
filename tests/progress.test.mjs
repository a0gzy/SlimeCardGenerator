import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { GAME_ART, artFile } from '../src/cloud/game-assets.js';
import { artOverrides } from '../src/cloud/art-overrides.js';
import { attemptsQuantile, BUFF_ORDER, BUFF_RULES, dropProbability, equipmentQuality, equipmentSets, expectedPityCost, permanentProgress, relicLevel, SET_GRID_SLOTS, SLIME_RARITIES, slimeBonus, tearsEstimates, totalSlimeBonus } from '../src/cloud/progress.js';
import { renderAccountMetrics, renderSetPanels, summarizeCard } from '../src/cloud/ui.js';
import { accountTitle, chooseSaveTarget } from '../src/cloud/account-save.js';

test('every catalog image exists and skins fall back to their own base art', async () => {
  for (const file of new Set([...Object.values(GAME_ART).flatMap(group => Object.values(group)), ...Object.values(artOverrides)])) await access(new URL(`../assets/${file}`, import.meta.url));
  assert.equal(artFile('slimes', 'Arp', 1), GAME_ART.skins['Arp-1']);
  assert.equal(artFile('slimes', 'Arp', 20), GAME_ART.slimes.Arp);
  assert.notEqual(artFile('artifacts', 'Fenicis'), artFile('slimes', 'Fenicis'));
});
test('slime bonus matches all original level and star rules', () => {
  const defaults = Object.values(SLIME_RARITIES).flat().map(name => ({ name, state: '0', level: 250 }));
  assert.equal(totalSlimeBonus(defaults), 317.5);
  assert.equal(slimeBonus({ name: 'Vladaris', state: '0', level: 250 }), 10);
  assert.equal(slimeBonus({ name: 'Balenor-Slime', state: '0', level: 250 }), 10);
  assert.equal(slimeBonus({ name: 'Arp', state: 'no', level: 250 }), 0);
  assert.equal(slimeBonus({ name: 'Arp', state: '5r', level: 250 }), 12.5);
  assert.equal(slimeBonus({ name: 'Panpan', state: '5r', level: 250 }), 110);
  assert.equal(slimeBonus({ name: 'Arp', state: '0', level: 125 }), 1.25);
  assert.equal(slimeBonus({ name: 'Unknown', state: '5r', level: 250 }), 0);
  assert.equal(totalSlimeBonus([defaults[0], defaults[0]]), 2.5);
});
test('relic star colours map to levels 1–5, 6–10 and 11–15', () => {
  for (let stars = 1; stars <= 5; stars++) {
    assert.equal(relicLevel(`${stars}y`), stars);
    assert.equal(relicLevel(`${stars}r`), stars + 5);
    assert.equal(relicLevel(`${stars}v`), stars + 10);
  }
  assert.equal(relicLevel('0'), 0);
  for (const invalid of ['no', undefined, null, '', '1', '6y', '0r', '5unknown', '15', 5]) {
    assert.equal(relicLevel(invalid), -1);
  }
});
test('phase one excludes ATK, HP and CritRes, and switches only when all others close', () => {
  const zero = permanentProgress();
  assert.equal(zero.phase, 1); assert.equal(zero.percent, 0); assert.equal(zero.total, 14);
  const buffs = BUFF_ORDER.map(name => ({ name, value: ['ATK', 'HP', 'CritRes'].includes(name) ? 0 : BUFF_RULES[name].cap }));
  assert.equal(permanentProgress(buffs).phase, 2);
  assert.equal(permanentProgress(buffs).percent, 0);
  buffs.find(buff => buff.name === 'ATK').value = BUFF_RULES.ATK.cap;
  assert.ok(Math.abs(permanentProgress(buffs).percent - 100 / 3) < 1e-10);
  buffs.forEach(buff => { buff.value = BUFF_RULES[buff.name].cap; });
  assert.equal(permanentProgress(buffs).complete, true);
  assert.equal(permanentProgress(buffs).percent, 100);
});
test('set layout is sword/chestplate over helmet/ring with missing pieces greyed', () => {
  const items = ['Sword', 'Helmet', 'Chestplate'].map(slot => ({ name: `Astral${slot}`, grade: 'epic' }));
  const sets = equipmentSets([...items, items[0], { name: 'AstralRing', grade: 'no' }]);
  assert.equal(sets[0].owned, 3); assert.equal(sets[0].total, 4); assert.equal(sets[1].owned, 0);
  const html = renderSetPanels(sets);
  assert.ok(html.includes('Астрал: 3 из 4'));
  assert.deepEqual(SET_GRID_SLOTS, ['Sword', 'Chestplate', 'Helmet', 'Ring']);
  const positions = SET_GRID_SLOTS.map(slot => html.indexOf(`data-slot="${slot}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(html.includes('is-missing" data-slot="Ring" data-quality="none"'));
  assert.ok(!html.includes('conic-gradient'));
});
test('each slot displays its own quality, including mythic and fantasy upgrades', () => {
  const items = ['Sword', 'Helmet', 'Chestplate', 'Ring'].map((slot, i) => ({ name: `Astral${slot}`, grade: ['epic', 'legendary', 'mythic', 'fantasy'][i] }));
  const html = renderSetPanels(equipmentSets(items), true);
  for (const label of ['Фиол', 'Лег', 'Миф', 'Фен']) assert.ok(html.includes(`>${label}</span>`));
  assert.equal(equipmentQuality('mythic3').label, 'Миф III');
  assert.equal(equipmentQuality('fantasy2').label, 'Фен II');
  assert.equal(equipmentQuality('no').family, 'none');
});
test('negative-binomial quantiles agree with exact small-trial probabilities', () => {
  assert.equal(attemptsQuantile(1, .5), 5);
  assert.equal(attemptsQuantile(2, .5), 8);
  assert.equal(attemptsQuantile(3, .5), 11);
  for (const p of [.045, .09]) assert.equal(attemptsQuantile(1, p), Math.ceil(Math.log(.05) / Math.log1p(-p)));
  assert.equal(attemptsQuantile(0, .045), 0);
  assert.equal(attemptsQuantile(17, 1), 17);
  const q = attemptsQuantile(1000, .045);
  assert.ok(dropProbability(q, 1000, .045) >= .95);
  assert.ok(dropProbability(q - 1, 1000, .045) < .95);
  assert.throws(() => attemptsQuantile(1, 0));
  assert.throws(() => attemptsQuantile(1, NaN));
});
test('tears include the resettable 30-drop pity and no confidence reserve', () => {
  const estimate = tearsEstimates();
  const [normal, buffed] = estimate.chances;
  assert.equal(normal.max, estimate.estimatedDrops.smallIncrements * 30);
  assert.equal(normal.min, buffed.min);
  assert.ok(normal.average > buffed.average);
  assert.equal(normal.average, Math.ceil(estimate.estimatedDrops.avg * expectedPityCost(.045)));
  assert.equal(expectedPityCost(.5, 2), 1.5);
  assert.ok(expectedPityCost(.045) < 1 / .045);
  assert.equal(normal.reserve95, undefined);
  const closed = tearsEstimates(BUFF_ORDER.map(name => ({ name, value: BUFF_RULES[name].cap })));
  assert.ok(closed.chances.every(chance => chance.average === 0 && chance.max === 0));
});
test('account preview contains the slime bonus and phase, not individual ATK/HP stats', () => {
  const config = { fileType: 'slime-card-config', version: '1.0.0', playerName: 'Player', modules: { slimes: { slimesList: [{ name: 'Arp', state: '0', level: 250, skin: 0 }], slimesGrid: { rows: 1, cols: 1 } }, buffs: { buffsList: [{ name: 'ATK', value: 100 }] } } };
  const html = renderAccountMetrics(summarizeCard(config));
  assert.ok(html.includes('Бонус слаймов')); assert.ok(html.includes('1 фаза'));
  assert.ok(!html.includes('ATK')); assert.ok(!html.includes('HP'));
});
test('one account updates by default and another account is an explicit action', () => {
  const cards = [{ id: 'a', ownerId: 'u', revision: 5, playerName: 'Player', title: 'Old title' }];
  const plan = chooseSaveTarget({ cards, uid: 'u', playerName: 'Player' });
  assert.equal(plan.action, 'update'); assert.equal(plan.context.cardId, 'a'); assert.equal(plan.confirm, true);
  assert.equal(chooseSaveTarget({ cards, uid: 'u', playerName: 'Player', forceNew: true }).action, 'create');
  assert.equal(chooseSaveTarget({ cards: [], uid: 'u', playerName: 'Player' }).action, 'create');
  assert.equal(chooseSaveTarget({ cards: [...cards, { ...cards[0], id: 'b', playerName: 'Alt' }], uid: 'u', playerName: 'Unknown' }).action, 'choose');
  const context = { uid: 'u', cardId: 'a', ownerId: 'u', revision: 2 };
  assert.equal(chooseSaveTarget({ cards, context, uid: 'u', playerName: 'Renamed' }).context.revision, 2);
  assert.equal(accountTitle({ playerName: '' }, { displayName: 'Google Name' }), 'Google Name');
});
