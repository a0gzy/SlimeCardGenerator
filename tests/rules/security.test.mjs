import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const projectId = process.env.FIREBASE_TEST_PROJECT || 'demo-slime-castle';
const old = Timestamp.fromMillis(1_700_000_000_000);
const config = { fileType: 'slime-card-config', version: '1.0.0', playerName: 'Player', modules: { relics: null, slimes: null, equipment: null, buffs: null, artifacts: null } };
function db(uid) {
  return uid ? env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore() : env.unauthenticatedContext().firestore();
}
function card() { return { ownerId: 'alice', title: 'Build', playerName: 'Player', config, createdAt: old, updatedAt: old, updatedBy: 'alice', changeId: 'a'.repeat(20), revision: 1, deleted: false }; }
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await Promise.all(['alice', 'bob', 'admin', 'owner'].map(uid => setDoc(doc(database, 'users', uid), { uid, displayName: uid, email: `${uid}@example.com`, createdAt: old, lastSeenAt: old })));
    await setDoc(doc(database, 'access', 'admin'), { role: 'admin' });
    await setDoc(doc(database, 'access', 'owner'), { role: 'owner' });
    await setDoc(doc(database, 'cards', 'build'), card());
    await setDoc(doc(database, 'guilds', 'guild-one'), { name: 'One', createdAt: old, updatedAt: old, updatedBy: 'admin', changeId: 'g'.repeat(20) });
  });
});

function mutation(database, actor, type, id, action, data, { create = false, eventPatch = {} } = {}) {
  const event = doc(collection(database, 'audit'));
  const batch = writeBatch(database);
  const target = doc(database, type, id);
  const payload = { ...data, updatedBy: actor, updatedAt: serverTimestamp(), changeId: event.id };
  if (create) batch.set(target, payload); else batch.update(target, payload);
  batch.set(event, { actorId: actor, targetType: type, targetId: id, action, createdAt: serverTimestamp(), ...eventPatch });
  return batch.commit();
}
test('guests cannot read any cloud records', async () => {
  for (const [type, id] of [['users', 'alice'], ['cards', 'build'], ['access', 'owner'], ['guilds', 'guild-one']]) {
    await assertFails(getDoc(doc(db(), type, id)));
  }
});
test('owner reads own cards; another member cannot; admin can', async () => {
  await assertSucceeds(getDoc(doc(db('alice'), 'cards', 'build')));
  await assertFails(getDoc(doc(db('bob'), 'cards', 'build')));
  await assertSucceeds(getDoc(doc(db('admin'), 'cards', 'build')));
});
test('own constrained queries work; unbounded or cross-user queries fail', async () => {
  await assertSucceeds(getDocs(query(collection(db('alice'), 'cards'), where('ownerId', '==', 'alice'), limit(25))));
  await assertFails(getDocs(query(collection(db('alice'), 'cards'), limit(25))));
  await assertFails(getDocs(collection(db('admin'), 'cards')));
  await assertSucceeds(getDocs(query(collection(db('admin'), 'cards'), limit(25))));
});
test('cannot promote oneself via profile or access record', async () => {
  await assertFails(updateDoc(doc(db('alice'), 'users', 'alice'), { role: 'admin' }));
  await assertFails(setDoc(doc(db('alice'), 'access', 'alice'), { role: 'admin' }));
});
test('profile registration enforces own UID, verified email and immutable creation time', async () => {
  const payload = { uid: 'new', displayName: 'New', email: 'new@example.com', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('new'), 'users', 'new'), payload));
  await assertFails(updateDoc(doc(db('new'), 'users', 'new'), { email: 'other@example.com', lastSeenAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('new'), 'users', 'new'), { createdAt: old, lastSeenAt: serverTimestamp() }));
  const unverified = env.authenticatedContext('unverified', { email: 'unverified@example.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore();
  await assertFails(setDoc(doc(unverified, 'users', 'unverified'), { ...payload, uid: 'unverified', email: 'unverified@example.com' }));
});
test('create card plus matching audit succeeds atomically', async () => {
  await assertSucceeds(mutation(db('alice'), 'alice', 'cards', 'new-card', 'card.create', { ...card(), createdAt: serverTimestamp() }, { create: true }));
  assert.equal((await getDoc(doc(db('alice'), 'cards', 'new-card'))).data().revision, 1);
});
test('create without audit or with spoofed actor fails', async () => {
  await assertFails(setDoc(doc(db('alice'), 'cards', 'new-card'), { ...card(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(mutation(db('alice'), 'alice', 'cards', 'new-card', 'card.create', { ...card(), createdAt: serverTimestamp() }, { create: true, eventPatch: { actorId: 'admin' } }));
});
test('cannot create a card for another user', async () => {
  await assertFails(mutation(db('bob'), 'bob', 'cards', 'new-card', 'card.create', { ...card(), createdAt: serverTimestamp() }, { create: true }));
});
test('card update requires correct actor, revision and audit action', async () => {
  await assertFails(mutation(db('bob'), 'bob', 'cards', 'build', 'card.update', { title: 'Stolen', revision: 2 }));
  await assertFails(mutation(db('alice'), 'alice', 'cards', 'build', 'card.update', { title: 'Old revision', revision: 1 }));
  await assertFails(mutation(db('alice'), 'alice', 'cards', 'build', 'card.create', { title: 'Wrong action', revision: 2 }));
  await assertSucceeds(mutation(db('alice'), 'alice', 'cards', 'build', 'card.update', { title: 'New build', revision: 2 }));
});
test('admin can edit but cannot transfer ownership', async () => {
  await assertFails(mutation(db('admin'), 'admin', 'cards', 'build', 'card.update', { ownerId: 'admin', revision: 2 }));
  await assertSucceeds(mutation(db('admin'), 'admin', 'cards', 'build', 'card.update', { title: 'Admin correction', revision: 2 }));
});
test('delete is soft and audited; hard deletes are forbidden', async () => {
  await assertFails(deleteDoc(doc(db('alice'), 'cards', 'build')));
  await assertSucceeds(mutation(db('alice'), 'alice', 'cards', 'build', 'card.delete', { deleted: true, revision: 2 }));
  await assertSucceeds(mutation(db('alice'), 'alice', 'cards', 'build', 'card.restore', { deleted: false, revision: 3 }));
});
test('audit is append-only; fake stand-alone events are forbidden', async () => {
  const database = db('alice');
  await assertFails(setDoc(doc(collection(database, 'audit')), { actorId: 'alice', targetType: 'cards', targetId: 'build', action: 'card.update', createdAt: serverTimestamp() }));
  await assertSucceeds(mutation(database, 'alice', 'cards', 'build', 'card.update', { revision: 2 }));
  const events = await getDocs(query(collection(db('admin'), 'audit'), limit(25)));
  await assertFails(updateDoc(doc(db('admin'), 'audit', events.docs[0].id), { actorId: 'bob' }));
  await assertFails(deleteDoc(doc(db('owner'), 'audit', events.docs[0].id)));
  await assertFails(getDocs(query(collection(database, 'audit'), limit(25))));
});
test('audit cannot be replayed for a later card revision', async () => {
  const database = db('alice');
  await assertSucceeds(mutation(database, 'alice', 'cards', 'build', 'card.update', { revision: 2 }));
  const current = (await getDoc(doc(database, 'cards', 'build'))).data();
  await assertFails(updateDoc(doc(database, 'cards', 'build'), { revision: 3, updatedAt: serverTimestamp(), changeId: current.changeId }));
});
test('only admin assigns guilds and assignment needs a valid guild and audit', async () => {
  const payload = { uid: 'alice', guildId: 'guild-one' };
  await assertFails(mutation(db('alice'), 'alice', 'memberships', 'alice', 'membership.assign', payload, { create: true }));
  await assertFails(mutation(db('admin'), 'admin', 'memberships', 'alice', 'membership.assign', { ...payload, guildId: 'missing' }, { create: true }));
  await assertSucceeds(mutation(db('admin'), 'admin', 'memberships', 'alice', 'membership.assign', payload, { create: true }));
  await assertSucceeds(mutation(db('admin'), 'admin', 'memberships', 'alice', 'membership.assign', { uid: 'alice', guildId: null }));
});
test('guild creation and rename require admin and matching audit', async () => {
  const payload = { name: 'Second', createdAt: serverTimestamp() };
  await assertFails(mutation(db('alice'), 'alice', 'guilds', 'new-guild', 'guild.create', payload, { create: true }));
  await assertSucceeds(mutation(db('admin'), 'admin', 'guilds', 'new-guild', 'guild.create', payload, { create: true }));
  await assertSucceeds(mutation(db('admin'), 'admin', 'guilds', 'new-guild', 'guild.update', { name: 'Renamed' }));
});
test('only owner can grant and revoke admin; nobody can grant or modify owner in browser', async () => {
  await assertFails(mutation(db('admin'), 'admin', 'access', 'bob', 'access.change', { role: 'admin' }, { create: true }));
  await assertFails(mutation(db('owner'), 'owner', 'access', 'bob', 'access.change', { role: 'owner' }, { create: true }));
  await assertSucceeds(mutation(db('owner'), 'owner', 'access', 'bob', 'access.change', { role: 'admin' }, { create: true }));
  await assertSucceeds(getDoc(doc(db('bob'), 'cards', 'build')));
  await assertSucceeds(mutation(db('owner'), 'owner', 'access', 'bob', 'access.change', { role: 'member' }));
  await assertFails(getDoc(doc(db('bob'), 'cards', 'build')));
  await assertFails(mutation(db('owner'), 'owner', 'access', 'owner', 'access.change', { role: 'member' }));
});
test('unknown collections and nested documents remain inaccessible', async () => {
  await assertFails(setDoc(doc(db('owner'), 'unknown', 'record'), { value: true }));
  await assertFails(setDoc(doc(db('alice'), 'cards', 'build', 'private', 'child'), { value: true }));
});
