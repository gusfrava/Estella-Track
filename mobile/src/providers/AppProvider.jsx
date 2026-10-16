import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as store from '@/core/state/store';
import * as session from '@/core/state/session';
import * as social from '@/core/state/social';
import * as rewards from '@/core/state/rewards';
import * as ob from '@/core/controllers/onboarding';
import * as fb from '@/core/services/firebase';
import { loadLibrary } from '@/core/services/library';
import { convertV1, hasV1Data, writesFor } from '@/core/services/migrate';
import { DEFAULT_SHARING, SCHEMA_VERSION } from '@/core/state/model';
import { hydrateStorage, KEYS, readJSON, writeJSON, lsGet, lsSet, lsDel, flushStorage } from '@/core/services/storage';
import { t, getLang, setLang, previewLang, chooseLang, hasChosenLang, onLangChange, routineName } from '@/core/i18n';
import { toast } from '@/components/toast-bus';
import { feel } from '@/services/feel';
const CHEER_ICONS = { fire: 'streak-flame', strong: 'dumbbell', clap: 'cheer' };

const Context = createContext(null);
export function AppProvider({ children }) {
  const [revision, redraw] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const stops = useRef([]), generation = useRef(0), owner = useRef(null), queue = useRef([]), flushing = useRef(null);
  const notify = () => redraw(n => n + 1);
  const report = e => setError(e?.message || String(e));
  const stop = () => { generation.current++; stops.current.forEach(fn => fn()); stops.current = []; owner.current = null; queue.current = []; rewards.clearWallet(); social.clearSocial(); ob.resetOnboardingUI(); };
  async function flush() {
    if (flushing.current) return flushing.current;
    if (!owner.current || !queue.current.length) return;
    const uid = owner.current, mine = generation.current;
    const task = (async () => {
      try {
        while (mine === generation.current && queue.current.length) {
          const batch = queue.current.slice();
          await flushStorage();
          await fb.applyWrites(uid, batch);
          if (mine !== generation.current) return;
          queue.current.splice(0, batch.length);
          writeJSON(`native.outbox.${uid}`, queue.current);
          await flushStorage();
          setError('');
        }
      } catch (e) { if (mine === generation.current) report(e); }
    })();
    flushing.current = task;
    try { await task; } finally { if (flushing.current === task) flushing.current = null; }
  }
  function enterLocal() {
    stop(); lsSet(KEYS.localMode, '1'); store.loadState(readJSON(KEYS.localV2) || {});
    session.setSession({ mode: 'app', user: null, localMode: true, synced: { routines: true, sessions: true } }); notify();
  }
  async function logout() {
    if (queue.current.length) { await flush(); if (queue.current.length) throw new Error(getLang() === 'es' ? 'Hay cambios pendientes. Conéctate antes de salir.' : 'Changes are pending. Reconnect before signing out.'); }
    stop(); lsDel(KEYS.localMode); store.clearState(); session.setSession({ mode: 'auth', user: null, localMode: false, synced: {} });
    if (fb.isLoaded()) await fb.signOut(); notify();
  }
  async function deleteAccount(password) {
    const user = session.getSession().user;
    if (!user) return;
    await fb.reauthenticate(user, password);
    await flush();
    if (queue.current.length) throw new Error(getLang() === 'es' ? 'Hay cambios pendientes. Conéctate antes de eliminar la cuenta.' : 'Changes are pending. Reconnect before deleting your account.');
    // Detach profile initialization before deletion so an empty snapshot cannot recreate it.
    stop();
    try {
      await fb.deleteUserData(user);
      await fb.deleteAuthUser(user);
    } finally {
      lsDel(KEYS.userV2(user.uid));
      lsDel(`native.outbox.${user.uid}`);
      await logout();
      await flushStorage();
    }
  }
  useEffect(() => {
    let active = true, authStop;
    const unsub = store.subscribe((state, event) => {
      const current = session.getSession();
      if (current.mode === 'app' && ['local','remote'].includes(event.source)) writeJSON(current.localMode ? KEYS.localV2 : KEYS.userV2(current.user.uid), state);
      if (event.source === 'local' && owner.current && event.writes.length) {
        queue.current.push(...JSON.parse(JSON.stringify(event.writes))); writeJSON(`native.outbox.${owner.current}`, queue.current); void flush();
      }
      notify();
    });
    // Points and badges from the server: a toast and a sound (not for what was there when the app opened).
    const pointsStop = rewards.onRewardsChange((w, prev) => {
      if (prev === undefined || !w) return;
      const before = prev || { points: 0, badges: {} }, P = t().pts;
      const gained = (Number(w.points) || 0) - (Number(before.points) || 0), fresh = Object.keys(w.badges || {}).filter(id => !(before.badges || {})[id]);
      if (gained > 0) { toast({ icon: 'ui-star', title: P.gained(gained), body: P.why[w.log?.[0]?.why || ''] || '' }); feel('points'); }
      if (fresh.length) setTimeout(() => { toast({ icon: 'badge-' + fresh[0], title: fresh.length > 1 ? P.newBadges : P.newBadge, body: fresh.map(id => P.names[id] || id).join(', ') }); feel('badge'); }, gained > 0 ? 1600 : 0);
    });
    const languageStop = onLangChange(notify), rewardsStop = rewards.onRewardsChange(notify), socialStop = social.onSocialChange(notify), sessionStop = session.onSessionChange(notify);
    const onboardingStop = ob.onOnboardingChange(notify);
    // A cheer that arrives while the app is open: a short toast, as on the website (not for the ones already there).
    let cheersShownUpTo = Date.now();
    const cheerToastStop = social.onSocialChange(() => {
      const fresh = social.recentCheers().filter(c => c.createdAt > cheersShownUpTo);
      if (!fresh.length) return;
      cheersShownUpTo = Math.max(...fresh.map(c => c.createdAt));
      const c = fresh[0], f = social.getSocial().friends[c.from] || { username: c.fromUsername, displayName: c.fromName };
      feel('cheer');
      toast({ icon: CHEER_ICONS[c.kind] || CHEER_ICONS.fire, title: t().fr.cheerToast((f.displayName || '').trim() || `@${f.username || '?'}`), body: routineName({ name: c.workout }) });
    });
    const retry = setInterval(() => { void flush(); }, 10000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') { store.checkNewWeek(); void flush(); } });
    (async () => {
      await hydrateStorage(); if (!active) return;
      const lang = lsGet(KEYS.lang); if (lang) setLang(lang);
      await loadLibrary();
      if (lsGet(KEYS.localMode) === '1') enterLocal();
      // Local onboarding must remain usable while the platform restores Firebase auth.
      setReady(true);
      await fb.loadFirebase(getLang());
      if (!active) return;
      authStop = fb.onAuthChange(user => {
        if (!active) return;
        if (session.getSession().localMode) { setReady(true); return; }
        stop(); store.clearState();
        if (!user) { session.setSession({ mode: 'auth', user: null, localMode: false, synced: {} }); setReady(true); return; }
        const mine = generation.current; owner.current = user.uid; queue.current = readJSON(`native.outbox.${user.uid}`) || [];
        const cached = readJSON(KEYS.userV2(user.uid));
        session.setSession({ mode: 'app', user, localMode: false, synced: { profile: !!cached?.profile } });
        store.loadState(cached || {});
        const guard = fn => value => { if (mine === generation.current) fn(value); };
        let migrating = false;
        stops.current.push(fb.watchProfile(user.uid, guard(snap => {
          if (snap.fromCache && !snap.exists) return;
          if (!snap.fromCache && (snap.data?.schemaVersion || 0) < SCHEMA_VERSION) {
            if (!migrating) {
              migrating = true;
              const legacy = snap.data?.state;
              const writes = hasV1Data(legacy) ? writesFor(convertV1(legacy)) : [];
              writes.push({ op: 'profile', data: {
                schemaVersion: SCHEMA_VERSION,
                displayName: snap.data?.displayName || user.displayName || '',
                sharing: { ...DEFAULT_SHARING, ...snap.data?.sharing },
                createdAt: snap.data?.createdAt || Date.now(),
              } });
              fb.applyWrites(user.uid, writes).catch(guard(e => { migrating = false; report(e); }));
            }
            return;
          }
          const pending = queue.current.filter(w => w.op === 'profile').reduce((a,w) => ({ ...a, ...w.data }), {});
          store.applyRemoteProfile({ ...(snap.data || {}), ...pending });
          session.setSession({ synced: { ...session.getSession().synced, profile: true } });
        }), guard(report)));
        for (const col of ['routines','sessions','stats','body']) stops.current.push(fb.watchCollection(user.uid, col, guard(snap => {
          if (snap.fromCache && !Object.keys(snap.docs).length) return;
          const docs = { ...snap.docs };
          for (const w of queue.current.filter(w => w.col === col)) { if (w.op === 'delete') delete docs[w.id]; else docs[w.id] = w.data; }
          store.applyRemoteCollection(col, docs);
          if (!snap.fromCache) session.setSession({ synced: { ...session.getSession().synced, [col]: true } });
        }), guard(report)));
        // As the website's services/sync.js: one listener per friend's card (their week, streak and dots on Friends),
        // added and removed as the friends list changes.
        const cards = new Map();
        const watchFriendCards = friends => {
          for (const uid of Object.keys(friends)) if (!cards.has(uid)) cards.set(uid, fb.watchCard(uid, guard(entry => social.setCard(uid, entry))));
          for (const [uid, off] of cards) if (!friends[uid]) { off(); cards.delete(uid); social.dropCard(uid); }
        };
        stops.current.push(fb.watchWallet(user.uid, guard(rewards.setWallet), guard(report)), fb.watchFriends(user.uid, guard(friends => { social.setFriends(friends); watchFriendCards(friends); }), guard(report)), () => watchFriendCards({}), fb.watchRequests(user.uid, guard(social.setRequests), guard(report)));
        // My own card: if the server hasn't built it yet (or it's an older version), ask for it once.
        let myCard = null, askedForCard = false;
        const askForCard = () => {
          const outdated = myCard && (myCard.state === 'none' || (myCard.state === 'ok' && myCard.card.v !== fb.CARD_VERSION)), p = store.getState().profile;
          if (mine !== generation.current || !outdated || askedForCard || !p?.username) return;
          askedForCard = true;
          fb.requestCardRefresh(user.uid).catch(() => {});
        };
        stops.current.push(fb.watchCard(user.uid, entry => { myCard = entry; askForCard(); }), store.subscribe(askForCard));
        // Cheers I received: if the listener fails (e.g. an index still building after a deploy), try again a minute later.
        let offCheers = null, cheersRetry = null;
        const startCheers = () => { offCheers = fb.watchCheersToMe(user.uid, guard(social.setCheers), () => { if (mine === generation.current) cheersRetry = setTimeout(startCheers, 60000); }); };
        startCheers();
        stops.current.push(() => { clearTimeout(cheersRetry); offCheers?.(); });
        void flush(); setReady(true);
      });
    })().catch(e => { report(e); if (!session.getSession().localMode) session.setSession({ mode: 'auth' }); setReady(true); });
    return () => { active = false; authStop?.(); stop(); unsub(); languageStop(); rewardsStop(); socialStop(); sessionStop(); onboardingStop(); cheerToastStop(); pointsStop(); clearInterval(retry); foreground.remove(); };
  }, []);
  async function run(action) { setError(''); try { return await action(); } catch (e) { report(e); throw e; } }
  return <Context.Provider value={{ revision, ready, error, clearError: () => setError(''), run, state: store.getState(), session: session.getSession(), L: t(), lang: getLang(), setLang, previewLang, chooseLang: value => { chooseLang(value); void flushStorage(); notify(); }, languageChosen: hasChosenLang(), enterLocal, logout, deleteAccount, notify }}>{children}</Context.Provider>;
}
export const useApp = () => { const value = useContext(Context); if (!value) throw new Error('AppProvider missing'); return value; };

