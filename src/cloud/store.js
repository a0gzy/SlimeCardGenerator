import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, startAfter, where, writeBatch,
} from 'firebase/firestore';
import { normalizeConfig } from './profile.js';

const PAGE_SIZE = 25;
export class CloudStore {
  constructor(config, emulators = false) {
    this.emulators = emulators;
    const app = initializeApp(config);
    this.auth = getAuth(app);
    // Default in-memory Firestore cache. No persistent cache of other people's admin data.
    this.db = getFirestore(app);
    if (emulators) {
      if (!config.projectId.startsWith('demo-')) throw new Error('Emulators require a demo Firebase project.');
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.db, '127.0.0.1', 8080);
    }
  }
  onAuth(callback) { return onAuthStateChanged(this.auth, callback); }
  async login() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(this.auth, provider);
  }
  loginDemo(email) {
    if (!this.emulators) throw new Error('Тестовый вход разрешён только в локальном эмуляторе.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Укажи тестовый email.');
    const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: email, email, email_verified: true, name: email.split('@')[0] })}.`;
    return signInWithCredential(this.auth, GoogleAuthProvider.credential(token));
  }
  logout() { return signOut(this.auth); }
  user() {
    if (!this.auth.currentUser) throw new Error('Сначала войди через Google.');
    return this.auth.currentUser;
  }
  async touchProfile() {
    const user = this.user();
    const ref = doc(this.db, 'users', user.uid);
    await runTransaction(this.db, async tx => {
      const previous = await tx.get(ref);
      tx.set(ref, {
        uid: user.uid, displayName: (user.displayName || 'Игрок').slice(0, 120), email: user.email,
        createdAt: previous.exists() ? previous.data().createdAt : serverTimestamp(), lastSeenAt: serverTimestamp(),
      });
    });
  }
  watchAccess(next, error) {
    return onSnapshot(doc(this.db, 'access', this.user().uid), snap => next(snap.data()?.role || 'member'), error);
  }
  async get(type, id) {
    const snapshot = await getDoc(doc(this.db, type, id));
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
  }
  async page(type, { constraints = [], cursor = null } = {}) {
    const parts = [...constraints];
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limit(PAGE_SIZE));
    const result = await getDocs(query(collection(this.db, type), ...parts));
    return {
      rows: result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id })),
      cursor: result.docs.at(-1) || null, more: result.size === PAGE_SIZE,
    };
  }
  cards({ ownerId = null, deleted = false, cursor = null } = {}) {
    const constraints = [where('deleted', '==', deleted), orderBy('updatedAt', 'desc')];
    if (ownerId) constraints.unshift(where('ownerId', '==', ownerId));
    return this.page('cards', { constraints, cursor });
  }
  people({ cursor = null, email = '', guildId = '' } = {}) {
    if (guildId) {
      return this.page('memberships', { constraints: [where('guildId', '==', guildId)], cursor }).then(async page => ({
        ...page, rows: (await Promise.all(page.rows.map(row => this.get('users', row.uid)))).filter(Boolean),
      }));
    }
    return this.page('users', { constraints: email ? [where('email', '==', email)] : [orderBy('lastSeenAt', 'desc')], cursor });
  }
  audit(cursor = null) { return this.page('audit', { constraints: [orderBy('createdAt', 'desc')], cursor }); }
  async guilds() {
    const result = await getDocs(query(collection(this.db, 'guilds'), orderBy('name'), limit(50)));
    return result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));
  }
  event(targetType, targetId, action) {
    const ref = doc(collection(this.db, 'audit'));
    return { ref, data: { actorId: this.user().uid, targetType, targetId, action, createdAt: serverTimestamp() } };
  }
  stamp(event) { return { updatedAt: serverTimestamp(), updatedBy: this.user().uid, changeId: event.ref.id }; }
  async createCard(title, value) {
    const config = normalizeConfig(value);
    const ref = doc(collection(this.db, 'cards'));
    const event = this.event('cards', ref.id, 'card.create');
    const batch = writeBatch(this.db);
    batch.set(ref, {
      ownerId: this.user().uid, title, playerName: config.playerName, config, createdAt: serverTimestamp(),
      ...this.stamp(event), revision: 1, deleted: false,
    });
    batch.set(event.ref, event.data);
    await batch.commit();
    return { cardId: ref.id, ownerId: this.user().uid, revision: 1, title, uid: this.user().uid };
  }
  async updateCard(editor, { title, config: value, deleted } = {}) {
    const config = value ? normalizeConfig(value) : null;
    const ref = doc(this.db, 'cards', editor.cardId);
    const result = await runTransaction(this.db, async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error('Карточка не найдена.');
      const previous = snapshot.data();
      if (previous.revision !== editor.revision) throw new Error('Карточку уже изменили в другой вкладке или админке. Загрузи свежую версию; черновик не потерян.');
      const nextDeleted = deleted ?? previous.deleted;
      const action = nextDeleted && !previous.deleted ? 'card.delete' : (!nextDeleted && previous.deleted ? 'card.restore' : 'card.update');
      const event = this.event('cards', ref.id, action);
      tx.update(ref, {
        ...this.stamp(event), revision: previous.revision + 1, deleted: nextDeleted,
        ...(title ? { title } : {}), ...(config ? { config, playerName: config.playerName } : {}),
      });
      tx.set(event.ref, event.data);
      return { ...editor, revision: previous.revision + 1, title: title || previous.title };
    });
    return result;
  }
  async saveGuild(name, id = null) {
    const ref = id ? doc(this.db, 'guilds', id) : doc(collection(this.db, 'guilds'));
    const event = this.event('guilds', ref.id, id ? 'guild.update' : 'guild.create');
    const batch = writeBatch(this.db);
    if (id) batch.update(ref, { name, ...this.stamp(event) });
    else batch.set(ref, { name, createdAt: serverTimestamp(), ...this.stamp(event) });
    batch.set(event.ref, event.data);
    await batch.commit();
  }
  async assignGuild(uid, guildId) {
    const event = this.event('memberships', uid, 'membership.assign');
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'memberships', uid), { uid, guildId: guildId || null, ...this.stamp(event) });
    batch.set(event.ref, event.data);
    await batch.commit();
  }
  async assignRole(uid, role) {
    const event = this.event('access', uid, 'access.change');
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'access', uid), { role, ...this.stamp(event) });
    batch.set(event.ref, event.data);
    await batch.commit();
  }
}
