import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadParticipantNickname, participantName } from '../src/cloud/participants.js';
import { emptyState, h, icon, roleName } from '../src/cloud/ui.js';

test('participants prefer their card nickname without changing the Google profile', () => {
  const person = { uid: 'user', displayName: 'Google Name', cardNickname: ' Game Nick ' };
  assert.equal(participantName(person), 'Game Nick');
  assert.equal(person.displayName, 'Google Name');
  assert.equal(participantName({ displayName: ' Google Name ', cardNickname: '' }), 'Google Name');
  assert.equal(participantName({ displayName: 'Google Name', cardNickname: '  ' }), 'Google Name');
  assert.equal(participantName({}), 'Игрок');
});

test('uses the most recently updated active card with a nickname', async () => {
  let reads = 0;
  const name = await loadParticipantNickname({ fetchPage: async () => {
    reads++;
    return { rows: [
      { playerName: 'Deleted Nick', deleted: true }, { playerName: '  ' },
      { playerName: ' Latest Nick ' }, { playerName: 'Older Nick' },
    ], more: true, cursor: 'unneeded' };
  } });
  assert.equal(name, 'Latest Nick');
  assert.equal(reads, 1);
});

test('can find a nickname on a later owner card page and in an older config', async () => {
  const cursors = [];
  const name = await loadParticipantNickname({ fetchPage: async cursor => {
    cursors.push(cursor);
    return cursor
      ? { rows: [{ config: { playerName: ' Legacy Nick ' } }], more: false }
      : { rows: [{ playerName: '' }], more: true, cursor: 'second' };
  } });
  assert.equal(name, 'Legacy Nick');
  assert.deepEqual(cursors, [null, 'second']);
});

test('empty cards fall back to the Google name and cancelled reads return no nickname', async () => {
  assert.equal(await loadParticipantNickname({ fetchPage: async () => ({ rows: [], more: false }) }), '');
  let current = true;
  const name = await loadParticipantNickname({
    fetchPage: async () => { current = false; return { rows: [{ playerName: 'Private Nick' }], more: false }; },
    isCurrent: () => current,
  });
  assert.equal(name, '');
  await loadParticipantNickname({ fetchPage: () => assert.fail('must not read after cancellation'), isCurrent: () => false });
});

test('invalid nickname pagination fails instead of looping forever', async () => {
  await assert.rejects(loadParticipantNickname({ fetchPage: async () => ({ rows: [], more: true }) }));
  await assert.rejects(loadParticipantNickname({ fetchPage: async () => ({ rows: [], more: true, cursor: 'same' }) }));
});

test('participants table renders the escaped nickname and still hides email from admins', async () => {
  const source = await readFile(new URL('../src/cloud/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    state: {
      role: 'admin', user: { uid: 'admin' }, guilds: [], emailFilter: '', guildFilter: '', busy: false,
      page: { rows: [{ uid: 'member', displayName: 'Google Name', cardNickname: '<Game & Nick>', email: 'private@example.test', role: 'member' }] },
    },
    participantName, h, icon, roleName, emptyState, date: () => 'Сегодня',
  });
  vm.runInContext(source.slice(source.indexOf('function button('), source.indexOf('function userLabel(')), context);
  vm.runInContext(source.slice(source.indexOf('function guildOptions('), source.indexOf('function renderGuilds(')), context);
  const adminHtml = context.renderPeople();
  assert.ok(adminHtml.includes('<strong>&lt;Game &amp; Nick&gt;</strong>'));
  assert.ok(adminHtml.includes('aria-label="Гильдия: &lt;Game &amp; Nick&gt;"'));
  assert.ok(!adminHtml.includes('private@example.test'));
  assert.ok(!adminHtml.includes('Google Name'));
  context.state.role = 'owner';
  assert.ok(context.renderPeople().includes('private@example.test'));
});

test('participants page loads cards separately for each owner, without losing pagination', async () => {
  const source = await readFile(new URL('../src/cloud/app.js', import.meta.url), 'utf8');
  const reads = [];
  const state = {
    user: { uid: 'admin' }, profileReady: true, role: 'admin', tab: 'people',
    page: { rows: [] }, people: new Map(), emailFilter: '', guildFilter: '',
  };
  const context = vm.createContext({
    state, authGeneration: 1, isAdmin: () => ['owner', 'admin'].includes(state.role), loadParticipantNickname,
    store: {
      guilds: async () => [{ id: 'guild', name: 'Guild' }],
      people: async ({ cursor }) => ({ rows: [{ uid: cursor ? 'second-user' : 'first-user', displayName: 'Google Name' }], cursor: 'next', more: !cursor }),
      get: async (type, uid) => type === 'access' ? { role: uid === 'first-user' ? 'admin' : 'member' } : { guildId: 'guild' },
      cards: async ({ ownerId, cursor }) => { reads.push([ownerId, cursor]); return { rows: [{ playerName: `Nick: ${ownerId}` }], more: false }; },
    },
  });
  vm.runInContext(source.slice(source.indexOf('async function loadPage('), source.indexOf('async function connectProfile(')), context);
  await context.loadPage();
  await context.loadPage(true);
  assert.deepEqual(reads, [['first-user', null], ['second-user', null]]);
  assert.deepEqual(Array.from(state.page.rows, person => person.cardNickname), ['Nick: first-user', 'Nick: second-user']);
  assert.equal(state.page.more, false);
  assert.equal(state.people.get('first-user').guildId, 'guild');
  assert.equal(state.people.get('first-user').role, 'admin');
  assert.equal(state.people.get('first-user').displayName, 'Google Name');
});
