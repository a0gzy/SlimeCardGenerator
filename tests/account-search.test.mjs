import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAccountFilter } from '../src/cloud/account-search.js';
test('account search matches nickname, name or email and intersects guild filters', () => {
  const card = { playerName: 'VladarisMain', title: 'Account' };
  const person = { displayName: 'Сергей', email: 'player@example.test' };
  const membership = { guildId: 'one' };
  for (const query of [' VLAD ', 'СЕРГ', '@EXAMPLE']) assert.ok(matchesAccountFilter(card, person, membership, query, 'one'));
  assert.equal(matchesAccountFilter(card, person, membership, 'vlad', 'two'), false);
  assert.equal(matchesAccountFilter(card, person, null, '', 'one'), false);
  assert.equal(matchesAccountFilter(card, null, null, 'unknown'), false);
});
