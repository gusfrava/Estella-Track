import AsyncStorage from '@react-native-async-storage/async-storage';
const cache = new Map();
let pending = Promise.resolve();
export const KEYS = { lang: 'native.lang', local: 'native.v1', localMode: 'native.localmode', migrated: 'native.migrated', debug: 'native.debug', user: uid => `native.v1.${uid}`, userV2: uid => `native.v2.${uid}`, localV2: 'native.v2.local' };
export async function hydrateStorage() {
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('native.'));
  for (const [key, value] of await AsyncStorage.multiGet(keys)) cache.set(key, value);
}
export const lsGet = key => cache.get(key) ?? null;
export const lsSet = (key, value) => { cache.set(key, String(value)); pending = pending.catch(() => {}).then(() => AsyncStorage.setItem(key, String(value))); };
export const lsDel = key => { cache.delete(key); pending = pending.catch(() => {}).then(() => AsyncStorage.removeItem(key)); };
export function readJSON(key) { try { return JSON.parse(lsGet(key)); } catch { return null; } }
export const writeJSON = (key, value) => lsSet(key, JSON.stringify(value));
export const flushStorage = () => pending;
