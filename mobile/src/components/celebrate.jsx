// Website js/ui/motion.js: confetti bursts and the "Routine complete!" card.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Motion, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { colors as c } from '@/theme/tokens';

const COLORS = [c.orange, c.teal, c.yellow, c.ink, '#FFFFFF'];
const DURATION = 2600, FRAMES = Math.round(DURATION / (1000 / 60)), KEYS = 16;

// The website moves each piece frame by frame (gravity 0.32, drag 0.99). The same steps are simulated here once and
// sampled into keyframes, so the animation itself runs on the native driver.
function pieces(W, H) {
  const list = [];
  const burst = (x, y, dir) => {
    for (let i = 0; i < 80; i++) {
      const ang = -Math.PI / 2 + dir * 0.45 + (Math.random() - 0.5) * 1.1, sp = 9 + Math.random() * 9;
      let px = x, py = y, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, r = Math.random() * 6;
      const vr = (Math.random() - 0.5) * 0.35, xs = [], ys = [], rs = [];
      for (let f = 0; f <= FRAMES; f++) {
        if (f % Math.round(FRAMES / (KEYS - 1)) === 0 || f === FRAMES) { xs.push(px); ys.push(py); rs.push(`${r}rad`); }
        vy += 0.32; vx *= 0.99; vy *= 0.99; px += vx; py += vy; r += vr;
      }
      list.push({ xs, ys, rs, w: 7 + Math.random() * 7, h: 4 + Math.random() * 6, color: COLORS[i % COLORS.length], round: Math.random() < 0.3 });
    }
  };
  burst(W * 0.12, H * 0.95, 1); burst(W * 0.88, H * 0.95, -1); burst(W * 0.5, H * 0.9, 0);
  return list;
}

export function Confetti({ onEnd }) {
  const { width: W, height: H } = useWindowDimensions(), [t] = useState(() => new Animated.Value(0)), [still, setStill] = useState(null);
  const list = useMemo(() => pieces(W, H), [W, H]);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill, () => setStill(false)); }, []);
  useEffect(() => {
    if (still === null) return;
    if (still) { onEnd?.(); return; }
    const run = Animated.timing(t, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    run.start(() => onEnd?.());
    return () => run.stop();
  }, [still, t, onEnd]);
  if (still !== false) return null;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{list.map((p, i) => {
    const input = p.xs.map((_, k) => k / (p.xs.length - 1));
    return <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, width: p.round ? p.w / 1.2 : p.w, height: p.round ? p.w / 1.2 : p.h, borderRadius: p.round ? p.w : 0, backgroundColor: p.color, borderWidth: 1.5, borderColor: c.ink,
      transform: [{ translateX: t.interpolate({ inputRange: input, outputRange: p.xs }) }, { translateY: t.interpolate({ inputRange: input, outputRange: p.ys }) }, { rotate: t.interpolate({ inputRange: input, outputRange: p.rs }) }] }} />;
  })}</View>;
}

// confetti() from anywhere (onboarding's starter plan): the host at the app root shows it over the current screen.
let fire = null;
export const confetti = () => fire?.();
export function ConfettiHost() {
  const [bursts, setBursts] = useState([]), next = useRef(0);
  useEffect(() => { fire = () => setBursts(list => [...list, ++next.current]); return () => { fire = null; }; }, []);
  return <>{bursts.map(id => <Confetti key={id} onEnd={() => setBursts(list => list.filter(b => b !== id))} />)}</>;
}

// The card + confetti; closes itself after ~2 s (or when tapped) and then calls onDone.
export function Celebration({ recurring, onDone }) {
  const { L } = useApp(), done = useRef(false), [scale] = useState(() => new Animated.Value(0.6));
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 14 }).start();
    const timer = setTimeout(finish, 2100);
    return () => clearTimeout(timer);
  });
  return <Modal transparent animationType="fade" onRequestClose={finish}>
    <Pressable accessibilityRole="button" accessibilityLabel={L.completedTitle} onPress={finish} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(255,241,225,0.82)' }}>
      <Animated.View accessibilityLiveRegion="polite" style={{ width: '100%', maxWidth: 340, alignItems: 'center', backgroundColor: c.yellow, borderWidth: 2.5, borderColor: c.ink, borderRadius: 28, paddingHorizontal: 24, paddingBottom: 30, boxShadow: `5px 6px 0 ${c.ink}`, transform: [{ scale }] }}>
        <View style={{ width: '100%', marginTop: -150, marginBottom: 8 }}><Motion scene="cheer" size={240} /></View>
        <Txt bold size={32} style={{ textAlign: 'center', lineHeight: 36 }}>{L.completedTitle}</Txt>
        <Txt style={{ marginTop: 6, fontWeight: '600', textAlign: 'center' }}>{recurring ? L.completedWeekly : L.completedOnce}</Txt>
      </Animated.View>
      <Confetti />
    </Pressable>
  </Modal>;
}
