// Small data helpers.

// Short random id (letters and digits only).
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// Deep copy that also drops `undefined` values (Firestore rejects them).
export const clone = v => JSON.parse(JSON.stringify(v));

// JSON with sorted keys, so two equal objects always compare equal as strings.
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
