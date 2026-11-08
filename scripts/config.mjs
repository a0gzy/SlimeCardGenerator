import { readFile } from 'node:fs/promises';

const fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export function parseWebConfig(text) {
  if (/private_key|service_account|BEGIN [A-Z ]*PRIVATE KEY/.test(text)) {
    throw new Error('A service-account credential cannot be used as browser configuration.');
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { /* The supplied file can be a Firebase JS snippet. */ }
  const config = {};
  for (const field of fields) {
    const value = parsed?.[field] ?? text.match(new RegExp(`\\b${field}\\s*:\\s*["']([^"'\\r\\n]+)["']`))?.[1];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing Firebase configuration field: ${field}`);
    config[field] = value.trim();
  }
  if (!/^[a-z0-9-]+$/.test(config.projectId)) throw new Error('Invalid Firebase project ID.');
  return config;
}

export async function loadWebConfig({ required = false } = {}) {
  let text = process.env.FIREBASE_WEB_CONFIG;
  if (!text) {
    try { text = await readFile(new URL('../firestore', import.meta.url), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!text) {
    if (required) throw new Error('Set FIREBASE_WEB_CONFIG to the Firebase web configuration JSON.');
    return null;
  }
  return parseWebConfig(text);
}

export function configScript(config) {
  // Browser configuration is public, not an admin credential. Escape HTML delimiters anyway.
  return `window.__FIREBASE_CONFIG__ = ${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`;
}
