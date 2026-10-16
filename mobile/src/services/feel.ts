// How the app feels, as the website's js/ui/feel.js: one place for vibration and small sounds.
//   'tap' any button (vibration only) · 'select' picking an answer · 'check' a set checked · 'done' an exercise
//   finished · 'complete' a whole routine · 'points' points arrived · 'badge' a new badge · 'cheer' a cheer ·
//   'error' something didn't work
// The sounds are the website's tones rendered to files (scripts/make-sounds.cjs). They mix with whatever else is
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
const SOURCES: Partial<Record<FeelKind, number>> = {
  select: require('../../assets/sounds/select.wav'),
  check: require('../../assets/sounds/check.wav'),
  done: require('../../assets/sounds/done.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  points: require('../../assets/sounds/points.wav'),
  badge: require('../../assets/sounds/badge.wav'),
  cheer: require('../../assets/sounds/cheer.wav'),
  error: require('../../assets/sounds/error.wav'),
};
const players: Partial<Record<FeelKind, AudioPlayer>> = {};
let audioReady = false;
function player(kind: FeelKind) {
  const source = SOURCES[kind];
  if (!source) return null;
  if (!audioReady) { audioReady = true; void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {}); }
  return (players[kind] ??= createAudioPlayer(source));
}

export function feel(kind: FeelKind) {
  const prefs = feelPrefs();
  if (prefs.haptics && canVibrate) { try { void Promise.resolve(HAPTICS[kind]()).catch(() => {}); } catch { /* not available */ } }
  if (prefs.sound) {
    try {
      const p = player(kind);
      if (p) { void p.seekTo(0); p.play(); }
    } catch { /* audio not available right now */ }
  }
}
