// How the app feels, as the website's js/ui/feel.js: one place for vibration and small sounds.
//   'tap' any button (a very soft tick) · 'select' picking an answer · 'check' a set checked · 'done' an exercise
//   finished · 'complete' a whole routine · 'points' points arrived · 'badge' a new badge · 'cheer' a cheer ·
//   'error' something didn't work
// The sounds are the website's notes as soft marimba/bell tones, rendered to files (scripts/make-sounds.cjs). They mix with whatever else is
// playing and stay quiet when the phone is on silent. The "Sounds" and "Vibration" switches live in Account.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { lsGet, lsSet } from '@/core/services/storage';

export type FeelKind = 'tap' | 'select' | 'check' | 'done' | 'complete' | 'points' | 'badge' | 'cheer' | 'error';
type Prefs = { sound: boolean; haptics: boolean };
const KEY = 'native.feel';
const defaults: Prefs = { sound: true, haptics: true };

export function feelPrefs(): Prefs {
  try { return { ...defaults, ...JSON.parse(lsGet(KEY) || '{}') }; } catch { return { ...defaults }; }
}
export function setFeelPref(name: keyof Prefs, on: boolean) { lsSet(KEY, JSON.stringify({ ...feelPrefs(), [name]: !!on })); }
export const canVibrate = Platform.OS !== 'web';

// ---------- vibration ----------
const later = (ms: number, fn: () => unknown) => setTimeout(() => { void fn(); }, ms);
const android = Platform.OS === 'android';
const HAPTICS: Record<FeelKind, () => unknown> = {
  tap: () => android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key) : Haptics.selectionAsync(),
  select: () => android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click) : Haptics.selectionAsync(),
  check: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  done: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); later(60, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
  complete: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); later(180, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)); },
  points: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); later(50, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
  badge: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  cheer: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); later(50, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// ---------- sound ----------
const SOURCES: Record<FeelKind, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  select: require('../../assets/sounds/select.wav'),
  check: require('../../assets/sounds/check.wav'),
  done: require('../../assets/sounds/done.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  points: require('../../assets/sounds/points.wav'),
  badge: require('../../assets/sounds/badge.wav'),
  cheer: require('../../assets/sounds/cheer.wav'),
  error: require('../../assets/sounds/error.wav'),
};
// Every sound is loaded when the app opens (a player created on the first tap isn't ready in time and stays silent),
// with a few players each so quick repeated taps overlap instead of cutting each other off.
const POOL = 3;
const pools: Partial<Record<FeelKind, { players: AudioPlayer[]; next: number }>> = {};
let prepared = false;
export function prepareFeel() {
  if (prepared) return;
  prepared = true;
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  for (const kind of Object.keys(SOURCES) as FeelKind[]) {
    try { pools[kind] = { players: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES[kind])), next: 0 }; } catch { /* audio not available */ }
  }
}

function play(kind: FeelKind) {
  prepareFeel();
  const pool = pools[kind];
  if (!pool) return;
  // The least recently used player that is ready; skip one still loading rather than lose the sound.
  for (let k = 0; k < POOL; k++) {
    const p = pool.players[(pool.next + k) % POOL];
    if (!p.isLoaded) continue;
    pool.next = (pool.next + k + 1) % POOL;
    if (p.currentTime > 0 || p.playing) p.seekTo(0).then(() => p.play(), () => p.play());
    else p.play();
    return;
  }
}

export function feel(kind: FeelKind) {
  const prefs = feelPrefs();
  if (prefs.haptics && canVibrate) { try { void Promise.resolve(HAPTICS[kind]()).catch(() => {}); } catch { /* not available */ } }
  if (prefs.sound) { try { play(kind); } catch { /* audio not available right now */ } }
}
