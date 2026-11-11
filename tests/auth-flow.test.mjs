import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the real store against a fake SDK, not a real Google account. A
// cross-site redirect stub deliberately fails: Pages cannot support that flow.
async function authFixture(popup) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/cloud/store.js', import.meta.url))],
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'StoreModule',
    plugins: [{
      name: 'fake-firebase',
      setup(builder) {
        builder.onResolve({ filter: /^firebase\// }, args => ({ path: args.path, namespace: 'fake-firebase' }));
        builder.onLoad({ filter: /.*/, namespace: 'fake-firebase' }, ({ path }) => {
          if (path === 'firebase/app') return { contents: 'export const initializeApp = config => ({ options: config });' };
          if (path === 'firebase/auth') return { contents: `
            export const getAuth = () => ({ currentUser: null });
            export class GoogleAuthProvider {
              providerId = 'google.com';
              setCustomParameters(params) { this.customParameters = params; }
            }
            export const signInWithPopup = (auth, provider) => popup(auth, provider);
            export const signInWithRedirect = () => { throw new Error('Cross-site redirect loses the Safari session'); };
            export const getRedirectResult = async () => null;
            export const onAuthStateChanged = (auth, callback) => { auth.notify = callback; callback(auth.currentUser); return () => {}; };
            export const signOut = async auth => { auth.currentUser = null; auth.notify?.(null); };
            export const connectAuthEmulator = () => {};
            export const signInWithCredential = () => {};
          ` };
          return { contents: `export const getFirestore = () => ({});
            export const collection = () => {}, connectFirestoreEmulator = () => {}, doc = () => {}, getDoc = () => {},
              getDocs = () => {}, limit = () => {}, onSnapshot = () => {}, orderBy = () => {}, query = () => {},
              runTransaction = () => {}, serverTimestamp = () => {}, startAfter = () => {}, where = () => {}, writeBatch = () => {};` };
        });
      },
    }],
  });
  const sandbox = vm.createContext({ popup });
  vm.runInContext(result.outputFiles[0].text, sandbox);
  return new sandbox.StoreModule.CloudStore({ projectId: 'test-project', authDomain: 'test-project.firebaseapp.com' });
}

test('Google sign-in starts a popup immediately, then authenticates the original page', async () => {
  const calls = [];
  let finish;
  const store = await authFixture((auth, provider) => {
    calls.push('popup');
    assert.equal(provider.providerId, 'google.com');
    assert.equal(provider.customParameters.prompt, 'select_account');
    return new Promise(resolve => {
      finish = user => { auth.currentUser = user; auth.notify(user); resolve({ user }); };
    });
  });
  store.onAuth(user => calls.push(user ? 'signed-in' : 'signed-out'));
  const pending = store.login();
  assert.deepEqual(calls, ['signed-out', 'popup']);
  const user = { uid: 'google-user' };
  finish(user);
  assert.equal((await pending).user, user);
  assert.equal(store.user(), user);
  assert.deepEqual(calls, ['signed-out', 'popup', 'signed-in']);
});

test('blocked and cancelled popups reject visibly instead of silently redirecting', async () => {
  for (const code of ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/network-request-failed']) {
    const store = await authFixture(() => Promise.reject(Object.assign(new Error(code), { code })));
    await assert.rejects(store.login(), { code });
    assert.equal(store.auth.currentUser, null);
  }
});

test('the tap handler starts login before replacing its button', async () => {
  const source = await readFile(new URL('../src/cloud/app.js', import.meta.url), 'utf8');
  // Run the real operation wrapper in isolation and record call order.
  const wrapper = source.slice(source.indexOf('async function perform('), source.indexOf("root.addEventListener('submit'"));
  const calls = [];
  const context = vm.createContext({
    state: { busy: false }, render: () => calls.push('render'), message: error => error.code,
  });
  vm.runInContext(wrapper, context);
  await context.perform(() => { calls.push('popup'); return Promise.resolve(); }, { renderBefore: false });
  assert.deepEqual(calls, ['popup', 'render', 'render']);
  assert.equal(context.state.busy, false);
  const loginHandler = source.slice(source.indexOf("if (action === 'login')"), source.indexOf('const guildId = action'));
  assert.match(loginHandler, /return store\.login\(\)/);
  assert.match(loginHandler, /renderBefore: false/);
  assert.doesNotMatch(loginHandler, /\bawait\b|redirect:/);
});

test('popup failure clears busy state and produces a visible error', async () => {
  const source = await readFile(new URL('../src/cloud/app.js', import.meta.url), 'utf8');
  const wrapper = source.slice(source.indexOf('async function perform('), source.indexOf("root.addEventListener('submit'"));
  const context = vm.createContext({ state: { busy: false }, render() {}, message: error => error.code });
  vm.runInContext(wrapper, context);
  await context.perform(() => Promise.reject({ code: 'auth/popup-blocked' }), { renderBefore: false });
  assert.equal(context.state.busy, false);
  assert.equal(context.state.status, 'auth/popup-blocked');
  assert.equal(context.state.error, true);
});
