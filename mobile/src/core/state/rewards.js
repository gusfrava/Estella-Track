// Points and badges (users/{uid}/wallet/main). Written only by the server (functions/rewards.js); the app just reads it.
// Filled by services/sync.js; read by Progreso, the toasts and the badge sheets.
import { BADGES } from '../data/badges.js';

let wallet;                   // undefined = not loaded yet · null = no points yet · object = the wallet
const listeners = new Set();

export const getWallet = () => wallet;
export function onRewardsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setWallet(w) {
  const prev = wallet;
  wallet = w;
  listeners.forEach(fn => { try { fn(wallet, prev); } catch (err) { console.error('[rewards] listener failed', err); } });
}
export const clearWallet = () => setWallet(undefined);

export const points = () => (wallet && Number(wallet.points)) || 0;
export const counter = name => (wallet && wallet.counters && Number(wallet.counters[name])) || 0;
export const hasBadge = id => !!(wallet && wallet.badges && wallet.badges[id]);

// All badges with their state: [{ ...badge, earned: earnedAt | null, progress: 0–1, count }]. Earned first (newest first).
export function badgeList() {
  return BADGES.map(b => {
    const count = counter(b.counter), earned = (wallet && wallet.badges && wallet.badges[b.id]) || null;
    return { ...b, earned, count, progress: earned ? 1 : Math.min(1, count / b.at) };
  }).sort((a, b) => (b.earned || 0) - (a.earned || 0) || (b.earned ? 0 : b.progress - a.progress));
}
export const earnedCount = () => BADGES.filter(b => hasBadge(b.id)).length;

// Points earned between two times (ms), from the recent log (last 20 events) — for the weekly recap.
export function pointsBetween(from, to) {
  return ((wallet && wallet.log) || []).filter(e => e.at >= from && e.at < to).reduce((n, e) => n + (Number(e.pts) || 0), 0);
}
