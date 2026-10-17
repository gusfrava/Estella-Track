// Platform-independent, serialized identity handling. Subscription state is separate
// from editable profile data. Unknown/unavailable must never be interpreted as Free.
import { BILLING } from '../billing-config.js';

export function createBillingSession(adapter, enabled) {
  let state = { status: enabled ? 'signed-out' : 'disabled', userId: null, plus: null, customerInfo: null, offerings: null, error: '' };
  let desiredUser = null, generation = 0, queue = Promise.resolve();
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); };
  const enqueue = task => { queue = queue.then(task, task); return queue; };
  async function read(uid, revision) {
    try {
      await adapter.identify(uid);
      if (revision !== generation) return;
      const info = await adapter.customerInfo();
      if (revision !== generation) return;
      publish({ status: 'ready', customerInfo: info, plus: !!info.entitlements?.active?.[BILLING.entitlement], error: '' });
      try {
        const offerings = await adapter.offerings();
        if (revision === generation) publish({ offerings, error: offerings.all?.[BILLING.offering] ? '' : `Offering ${BILLING.offering} is missing. Check its Test Store packages.` });
      } catch (e) {
        if (revision === generation) publish({ error: `Offerings: ${e.message || String(e)}` });
      }
    } catch (e) {
      if (revision === generation) publish({ status: 'unavailable', error: e.message || String(e) });
    }
  }
  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setUser(uid) {
      uid = uid || null;
      if (!enabled || uid === desiredUser) return queue;
      desiredUser = uid;
      const revision = ++generation;
      // Clear access synchronously before any network work or account switch.
      publish({ status: uid ? 'loading' : 'signed-out', userId: uid, plus: null, customerInfo: null, offerings: null, error: '' });
      return enqueue(async () => {
        if (revision !== generation) return;
        if (uid) await read(uid, revision);
        else try { await adapter.disconnect(); } catch (e) {
          if (revision === generation) publish({ error: e.message || String(e) });
        }
      });
    },
    refresh() {
      const uid = desiredUser, revision = generation;
      if (!enabled || !uid) return queue;
      return enqueue(() => revision === generation ? read(uid, revision) : undefined);
    },
  };
}
