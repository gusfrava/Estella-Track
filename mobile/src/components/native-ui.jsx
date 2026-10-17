import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { SvgCss } from 'react-native-svg/css';
import { router } from 'expo-router';
import { colors as c, fonts } from '@/theme/tokens';
import art from '@/theme/art.json';
import { motions } from '@/theme/motions';
import { diegoMotions } from '@/theme/diego-motions';
import { getState } from '@/core/state/store';
import { addToastHost } from './toast-bus';
import { feel } from '@/services/feel';
import { useApp } from '@/providers/AppProvider';
import { getWallet, points } from '@/core/state/rewards';
import { fmtNum } from '@/core/utils/format';
import { pendingIncoming, unseenCheers } from '@/core/state/social';
import { cheersSeenAt } from '@/core/controllers/friends';
import { avatarById, avatarPath } from '@/core/data/avatars';

// Names like "Piernas+Quads" have no spaces, so Android would split them anywhere ("Piernas+Qua / ds").
// A zero-width space after + / & between letters lets the line break there instead.
const softBreaks = c => (typeof c === 'string' ? c.replace(/([+/&])(?=[A-Za-z\u00C0-\u024F])/g, '$1\u200B') : Array.isArray(c) ? c.map(softBreaks) : c);
// A light buzz on every button, like the website's tap feedback; picking an answer sounds like a selection.
const withFeel = (fn, kind = 'tap') => fn && (e => { feel(kind); fn(e); });
// Baloo's glyphs are taller than their size: iOS clips them when the line is shorter than ~1.25× (e.g. "2/4" on Home).
const minLine = (size, bold, style) => { const lh = StyleSheet.flatten(style)?.lineHeight; return bold && lh && lh < size * 1.25 ? { lineHeight: Math.ceil(size * 1.25) } : null; };
export function Txt({ children, size = 16, bold = false, muted = false, style, ...props }) { children = softBreaks(children); return <Text {...props} style={[{ fontFamily: bold ? fonts.heading : fonts.body, color: muted ? c.muted : c.ink, fontSize: size, lineHeight: size * 1.35 }, style, minLine(size, bold, style)]}>{children}</Text>; }
export const Title = ({ children }) => <Txt size={34} bold>{children}</Txt>;
const grayArt = Object.fromEntries(Object.entries(art).map(([name, xml]) => [name, xml.replace(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi, color => {
  const hex = color.length === 4 ? color.slice(1).split('').map(c => c + c).join('') : color.slice(1);
  const gray = Math.round(.2126 * parseInt(hex.slice(0,2),16) + .7152 * parseInt(hex.slice(2,4),16) + .0722 * parseInt(hex.slice(4,6),16)).toString(16).padStart(2,'0');
  return '#' + gray.repeat(3);
})]));
export function Icon({ name, size = 26, locked = false, color }) { let xml = (locked ? grayArt : art)[name]; if (xml && color) xml = xml.replaceAll(c.ink, color); const Svg = xml?.includes('<style>') ? SvgCss : SvgXml; return xml ? <View style={{ opacity: locked ? .5 : 1 }}><Svg xml={xml} width={size} height={size} /></View> : <Txt bold size={size}>{({ back: '‹', close: '×', edit: '✎', delete: '×', add: '+', check: '✓' })[name] || '✦'}</Txt>; }
// Website .btn: pill with a hard ink shadow that the press pushes the button into. Back ("‹") is the website's .round.
export function Button({ children, title, onPress, secondary = false, disabled = false, small = false, selected = false, label, style }) { const round = title === '‹'; return <Pressable onPress={withFeel(onPress)} accessibilityRole="button" accessibilityLabel={label || title} accessibilityState={{ disabled, selected }} aria-disabled={disabled} aria-selected={selected} disabled={disabled} style={({ pressed }) => [s.button, small && s.small, round && s.round, { backgroundColor: selected ? c.yellow : secondary ? c.card : c.orange, opacity: disabled ? .6 : 1 }, pressed && !disabled && !round && s.pressed, pressed && round && { opacity: .7 }, style]}>{children || (['‹','✎','×'].includes(title) ? <Icon name={'ui-'+({'‹':'back','✎':'pen','×':'close'})[title]} size={round ? 22 : 26} /> : <Txt bold size={small ? 16 : 20} style={{ textAlign: 'center' }}>{title}</Txt>)}</Pressable>; }
// Website selectedCharacter(): the companion chosen in onboarding.
export const selectedCharacter = () => getState().profile?.onboarding?.character === 'diego' ? 'diego' : 'estella';
// Website mascotHTML({ crop: 'bust' }): the companion's head and shoulders in a bordered circle (Diego's blinking portrait).
export const Bust = ({ size = 96, character = selectedCharacter() }) => <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: c.ink, backgroundColor: c.yellowSoft, overflow: 'hidden' }}>{character === 'diego' ? <Diego scene="portrait" size={size - 4} /> : <Icon name="mascot-bust" size={size - 4} />}</View>;
export function TextButton({ title, onPress, color = c.ink, style }) { return <Pressable onPress={withFeel(onPress)} accessibilityRole="button" style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 4, opacity: pressed ? .6 : 1 }, style]}><Txt bold style={{ color, textAlign: 'center' }}>{title}</Txt></Pressable>; }
// Website .ob-opt: icon tile, title and description, and a tick that turns teal when chosen.
export function Option({ icon, title, desc, selected = false, compact = false, onPress }) {
  return <Pressable onPress={withFeel(onPress, 'select')} accessibilityRole="button" accessibilityLabel={desc ? `${title}, ${desc}` : title} accessibilityState={{ selected }} aria-selected={selected} style={({ pressed }) => [s.option, compact && { paddingVertical: 10 }, { backgroundColor: selected ? c.yellow : c.card }, pressed && s.optionPressed]}>
    {!!icon && <View style={[s.optionIcon, { backgroundColor: selected ? c.card : c.background }]}><Icon name={icon} size={26} /></View>}
    <View style={{ flex: 1, gap: 2 }}><Txt bold size={17} style={{ lineHeight: 21 }}>{title}</Txt>{!!desc && <Txt size={14.5} style={{ color: selected ? c.ink : c.muted, lineHeight: 19 }}>{desc}</Txt>}</View>
    <View style={[s.tick, selected && { backgroundColor: c.teal }]}>{selected && <Icon name="ui-check" size={16} />}</View>
  </Pressable>;
}
// Website .ib: square icon button (edit, delete, close); .pill-btn / .week-goal: small outlined pill; .label: small caps heading.
export function IconButton({ icon, label, onPress, color, size = 40 }) { return <Pressable onPress={withFeel(onPress)} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.iconButton, { width: size, height: size }, pressed && { transform: [{ scale: .92 }] }]}><Icon name={icon} size={20} color={color} /></Pressable>; }
export function Pill({ title, onPress, label, style }) { return <Pressable onPress={withFeel(onPress)} accessibilityRole="button" accessibilityLabel={label || title} style={({ pressed }) => [s.pill, pressed && { transform: [{ scale: .98 }] }, style]}><Txt bold size={14}>{title}</Txt></Pressable>; }
export const Label = ({ children, color = c.tealInk }) => <Txt bold size={12.5} style={{ color, letterSpacing: 1.1, textTransform: 'uppercase' }}>{children}</Txt>;
export const Row = ({ children, style }) => <View style={[s.row, style]}>{children}</View>;
export const Card = ({ children, color = c.card, style }) => <View style={[s.card, { backgroundColor: color }, style]}>{children}</View>;
export function Field({ label, value, onChangeText, number = false, trailing, style, ...props }) { return <View style={[{ gap: 8 }, style]}>{label && <Txt bold size={17}>{label}</Txt>}<View style={{ justifyContent: 'center' }}><TextInput accessibilityLabel={label} value={String(value ?? '')} onChangeText={onChangeText} placeholderTextColor="#9A8577" keyboardType={number ? 'decimal-pad' : 'default'} style={[s.input, trailing && { paddingRight: 58 }]} {...props} />{trailing && <View style={{ position: 'absolute', right: 8 }}>{trailing}</View>}</View></View>; }
// Website .tabs (full width) and .lang (compact): ink pill segments, the chosen one filled with ink.
export function Tabs({ items, value, onChange, compact = false, style }) { return <View accessibilityRole="tablist" style={[s.segments, compact ? { alignSelf: 'flex-start' } : { alignSelf: 'stretch' }, style]}>{items.map(([key, text]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: value === key }} aria-selected={value === key} onPress={withFeel(() => onChange(key), value === key ? 'tap' : 'select')} style={[compact ? { paddingVertical: 6, paddingHorizontal: 12 } : { flex: 1, paddingVertical: 12, paddingHorizontal: 8 }, { alignItems: 'center', backgroundColor: value === key ? c.ink : 'transparent' }]}><Txt bold size={compact ? 13.5 : 17} style={{ color: value === key ? c.background : c.ink }}>{text}</Txt></Pressable>)}</View>; }
export function Check({ selected, onPress, label }) { return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={withFeel(onPress)} style={[s.check, { backgroundColor: selected ? c.teal : c.card }]}><Txt bold>{selected ? '✓' : ''}</Txt></Pressable>; }
export function Progress({ value, max = 100, mini = false }) { return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }} style={[s.progress, mini && s.mini]}><View style={{ height: '100%', width: `${max ? Math.min(100, value / max * 100) : 0}%`, backgroundColor: c.orange }} /></View>; }
// A single letter in a round avatar: Baloo is centered only at its natural line height (1.6x, the website's line-height:
// normal); the tighter default makes iOS draw it high.
export const initialLine = size => Math.round(size * 1.6);
// Website ui/avatar.js accountAvatarHTML: the chosen account avatar if it's free or owned, otherwise the initial.
export function AccountAvatar({ initial, size = 40 }) {
  const wallet = getWallet(), avatar = avatarById(wallet?.avatarId);
  if (avatar && (!avatar.price || wallet?.avatars?.[avatar.id])) return <Image source={avatarPath(avatar.id)} style={{ width: '100%', height: '100%', borderRadius: size / 2 }} />;
  return <Txt bold size={size * .44} style={{ lineHeight: initialLine(size * .44) }}>{initial}</Txt>;
}
// Website appHeader: brand, points (once the wallet has loaded) and the account avatar ("·" in local mode).
// The brand is the wordmark at the website's size: 28% of the screen width, 102.4–134.4 wide (3:1).
const wordmark = require('../../assets/brand/teal-bright-orange.svg');
export function Header() {
  const { L, state, session } = useApp(), wallet = getWallet() !== undefined, n = points(), brandW = Math.min(134.4, Math.max(102.4, useWindowDimensions().width * .28));
  const initial = session.localMode ? '·' : ((state.profile?.displayName || session.user?.displayName || state.profile?.username || session.user?.email || '?').trim()[0] || '?').toUpperCase();
  return <Row><Image source={wordmark} accessible accessibilityRole="image" accessibilityLabel="Estella Track" style={{ width: brandW, height: brandW / 3 }} contentFit="contain" /><Row>{wallet && <Pressable accessibilityRole="button" accessibilityLabel={`${L.pts.points(n)} · ${L.pts.title}`} onPress={() => router.push('/badges')} style={s.points}><Icon name="ui-star" size={19} /><Txt size={13}><Txt bold size={13}>{fmtNum(n)}</Txt> {L.pts.pointsWord(n)}</Txt></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={L.account} onPress={() => router.push('/account')} style={[s.avatar, { overflow: 'hidden' }]}>{session.localMode ? <Txt bold size={17.5} style={{ lineHeight: initialLine(17.5) }}>{initial}</Txt> : <AccountAvatar initial={initial} />}</Pressable></Row></Row>;
}
export function Page({ children, tab, header = true, back = false, footer, fab }) { const { L, error, clearError } = useApp(); return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, tab && { paddingBottom: fab ? 190 : 110 }, footer && { paddingBottom: 8 }]}>{header && <Header />}{back && <Button small secondary title={'‹ ' + L.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />}{!!error && <Pressable accessibilityRole="button" onPress={clearError}><Txt style={{ color: '#C8371F' }}>{error}</Txt></Pressable>}{children}</ScrollView>{footer && <View style={s.footer}>{footer}</View>}</KeyboardAvoidingView>{fab && <Pressable accessibilityRole="button" accessibilityLabel={fab.label} onPress={fab.onPress} style={({ pressed }) => [s.fab, pressed && s.pressed]}><Icon name="ui-plus" size={32} /></Pressable>}{tab && <View style={s.tabs}>{[['home','/', 'ui-dumbbellTab',L.tabRoutines], ['progress','/progress','ui-trophy',L.tabProgress],['friends','/friends','ui-users',L.tabFriends]].map(([key,url,icon,label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => router.replace(url)} style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, pressed && { transform: [{ scale: .92 }] }]}><View style={tab === key ? s.tabOn : { padding: 4 }}><Icon name={icon} size={26} /></View><Txt bold size={13.5} style={{ color: tab === key ? c.ink : c.muted }}>{label}</Txt>{key === 'friends' && <TabBadge active={tab === 'friends'} />}</Pressable>)}</View>}</SafeAreaView>; }
// Friend requests to answer + cheers not seen yet (not while on Friends), as on the website's tab bar.
function TabBadge({ active }) { const { L, session } = useApp(); if (session.localMode || !session.user) return null; const n = pendingIncoming().length + (active ? 0 : unseenCheers(cheersSeenAt())); return n ? <View accessibilityLabel={L.fr.badgeLabel(n)} style={s.tabBadge}><Txt bold size={12} style={{ color: c.card, lineHeight: 14 }}>{n}</Txt></View> : null; }
// Website .sheet: grab bar, round close button, title, scrolling body. Sheet opens over the screen; RouteSheet is a whole route (account, badges).
// The subtitle sits outside the scroll area so it can't be clipped. Dragging the header (grab bar and title) down
// closes the sheet, like a native one; a short drag springs back.
const AnimatedKAV = Animated.createAnimatedComponent(KeyboardAvoidingView);
function useSwipeClose(onClose) {
  const [y] = useState(() => new Animated.Value(0));
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) Animated.timing(y, { toValue: 900, duration: 180, useNativeDriver: true }).start(() => onClose());
      else Animated.spring(y, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
  }), [y, onClose]);
  return [y, pan.panHandlers];
}
function SheetPanel({ title, sub, children, onClose }) { const { L } = useApp(), insets = useSafeAreaInsets(), [y, drag] = useSwipeClose(onClose); return <AnimatedKAV behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.sheet, { paddingBottom: 24 + insets.bottom, transform: [{ translateY: y }] }]}><View {...drag}><View style={s.sheetTop}><View style={s.grab} /><Pressable accessibilityRole="button" accessibilityLabel={L.close} onPress={onClose} style={s.sheetX}><Icon name="ui-close" size={20} /></Pressable></View>{!!title && <Txt bold size={26.4} style={{ lineHeight: 30, paddingRight: 40, marginBottom: sub ? 4 : 18 }}>{title}</Txt>}{!!sub && <Txt muted style={{ marginBottom: 18 }}>{sub}</Txt>}</View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20, paddingBottom: 12, paddingRight: 5 }}>{children}</ScrollView></AnimatedKAV>; }
// Website ui/sheet.js shows one sheet at a time: a sheet opened from a route sheet (Account's avatar, profile…) takes
// its place instead of stacking on it; closing it (×, swipe, back button) goes back to the route sheet.
const InPlace = createContext(false);
export const InPlaceSheets = ({ children }) => <InPlace.Provider value>{children}</InPlace.Provider>;
export function Sheet({ title, sub, children, onClose }) {
  const { L } = useApp(), inPlace = useContext(InPlace);
  useEffect(() => { if (!inPlace) return; const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; }); return () => back.remove(); }, [inPlace, onClose]);
  if (inPlace) return <View style={s.shade}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={L.close} /><SheetPanel title={title} sub={sub} onClose={onClose}>{children}</SheetPanel></View>;
  return <Modal transparent animationType="slide" onRequestClose={onClose}><View style={s.shade}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={L.close} /><SheetPanel title={title} sub={sub} onClose={onClose}>{children}</SheetPanel><ToastHost /></View></Modal>; }
export function RouteSheet({ title, sub, children }) { const { L } = useApp(), close = () => router.canGoBack() ? router.back() : router.replace('/'); return <View style={s.shade}><Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={L.close} /><SheetPanel title={title} sub={sub} onClose={close}>{children}</SheetPanel></View>; }
function useReduceMotion() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce); return () => sub.remove(); }, []);
  return reduce;
}
// Website .diego-mascot: Diego's approved poses as discrete frames, never a crossfade. All four stay stacked so a
// switch never waits for a load. Poses step every 0.5 s; the portrait holds still and blinks (third pose) every 5 s.
export function Diego({ scene = 'welcome', size = 120 }) {
  const reduce = useReduceMotion(), [frame, setFrame] = useState(0), portrait = scene === 'portrait';
  useEffect(() => {
    if (reduce) return;
    const start = Date.now();
    const timer = setInterval(() => { const t = Date.now() - start; setFrame(portrait ? (t % 5000 >= 4250 && t % 5000 < 4500 ? 2 : 0) : Math.floor(t / 500) % 4); }, 50);
    return () => clearInterval(timer);
  }, [portrait, reduce]);
  const shown = reduce ? 0 : frame;
  return <View style={{ width: size, height: size, alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{(diegoMotions[scene] || diegoMotions.welcome).map((source, i) => <Image key={i} source={source} style={[StyleSheet.absoluteFill, { opacity: shown === i ? 1 : 0 }]} contentFit="contain" transition={0} />)}</View>;
}
// Website onboarding-motion.js: one playback clock picks exactly one of the scene's four poses, Estella's or Diego's.
// card: the character-step card (art 190 wide); still: the unchosen card's first pose without stars.
function MotionFrames({ scene = 'welcome', bottom = false, size = 220, character, card = false, still = false }) {
  const [frame, setFrame] = useState(0), reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce || still) return;
    const start = Date.now(), duration = bottom ? 5000 : scene === 'soccer' ? Infinity : 4400, cycle = scene === 'dogwalk' ? 1250 : bottom ? 2500 : 2200;
    const timer = setInterval(() => { const elapsed = Date.now() - start; setFrame(elapsed >= duration ? 0 : Math.floor(elapsed % cycle / (cycle / 4))); if (elapsed >= duration) clearInterval(timer); }, 60);
    const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' })]), { iterations: 3 }); animation.start();
    return () => { clearInterval(timer); animation.stop(); pulse.setValue(1); };
  }, [scene, bottom, reduce, still, pulse]);
  const frames = character === 'diego' ? diegoMotions : motions;
  return <View style={{ height: size, width: '100%', marginTop: bottom ? 28 : 0, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={(frames[scene] || frames.welcome)[reduce || still ? 0 : frame]} style={[{ width: card ? 190 : '100%', height: '100%' }, card && character === 'diego' && { transform: [{ scale: 1.035 }] }]} contentFit="contain" transition={0} />
    {!still && <><Animated.Text style={{ position: 'absolute', right: card ? '5%' : '12%', top: card ? 20 : 25, color: c.orange, fontSize: card ? 17 : 28, transform: [{ scale: pulse }] }}>✦</Animated.Text><Txt size={card ? 13 : 16} style={[{ position: 'absolute', left: card ? '5%' : '12%', color: c.teal }, card ? { top: '48%' } : { bottom: 50 }]}>✧</Txt></>}
  </View>;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  page: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 20, paddingBottom: 40, gap: 22 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  card: { borderWidth: 2.5, borderColor: c.ink, borderRadius: 22, padding: 16, gap: 12, boxShadow: `3px 4px 0 ${c.ink}` },
  iconButton: { borderWidth: 2, borderColor: c.ink, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderWidth: 2, borderColor: c.ink, borderRadius: 99, backgroundColor: c.card },
  points: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 2, borderColor: c.ink, borderRadius: 999, backgroundColor: c.card },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: c.ink, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 104, width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: c.ink, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center', boxShadow: `4px 5px 0 ${c.ink}`, zIndex: 5 },
  tabOn: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: c.ink, backgroundColor: c.yellow },
  tabBadge: { position: 'absolute', top: 2, left: '50%', marginLeft: 8, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 99, borderWidth: 2, borderColor: c.ink, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', zIndex: 45, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: c.yellow, borderWidth: 2.5, borderColor: c.ink, borderRadius: 18, boxShadow: `3px 4px 0 ${c.ink}` },
  mini: { height: 10, borderWidth: 2, backgroundColor: c.background },
  button: { borderWidth: 2.5, borderColor: c.ink, borderRadius: 999, minHeight: 60, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', boxShadow: `4px 5px 0 ${c.ink}` },
  small: { minHeight: 48, paddingVertical: 7, paddingHorizontal: 12 },
  round: { width: 52, height: 52, minHeight: 52, padding: 0, paddingHorizontal: 0, boxShadow: 'none' },
  pressed: { transform: [{ translateX: 3 }, { translateY: 4 }], boxShadow: `1px 1px 0 ${c.ink}` },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2.5, borderColor: c.ink, borderRadius: 20, boxShadow: `3px 4px 0 ${c.ink}` },
  optionPressed: { transform: [{ translateX: 2 }, { translateY: 3 }], boxShadow: `1px 1px 0 ${c.ink}` },
  optionIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: c.ink, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  footer: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 6, alignItems: 'stretch', backgroundColor: c.background },
  input: { backgroundColor: c.card, color: c.ink, borderWidth: 2.5, borderColor: c.ink, borderRadius: 18, minHeight: 58, paddingVertical: 14, paddingHorizontal: 18, fontFamily: fonts.body, fontSize: 17 },
  segments: { flexDirection: 'row', borderWidth: 2.5, borderColor: c.ink, borderRadius: 999, backgroundColor: c.card, overflow: 'hidden' },
  check: { width: 40, height: 40, borderRadius: 13, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  progress: { height: 18, borderWidth: 2.5, borderColor: c.ink, backgroundColor: c.card, overflow: 'hidden', borderRadius: 20, flex: 1 },
  tabs: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingTop: 10, paddingBottom: 20, borderWidth: 2.5, borderColor: c.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: c.card },
  shade: { flex: 1, backgroundColor: '#2B1B1266', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '92%', backgroundColor: c.background, borderWidth: 2.5, borderBottomWidth: 0, borderColor: c.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20 },
  sheetTop: { height: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  grab: { width: 48, height: 5, borderRadius: 9, backgroundColor: c.ink, opacity: .25 },
  sheetX: { position: 'absolute', right: -8, top: 6, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: c.ink, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
});

export function Motion({ character = selectedCharacter(), ...props }) { return <MotionFrames key={`${character}:${props.scene || 'welcome'}:${!!props.still}`} character={character} {...props} />; }

// Website ui/toast.js: one short message at the top (icon, bold title, optional line), gone after 3.2 s.
export { toast } from './toast-bus';
export function ToastHost() {
  const [message, setMessage] = useState(null), insets = useSafeAreaInsets(), [y] = useState(() => new Animated.Value(-140)), timer = useRef(null);
  useEffect(() => {
    const show = async next => {
      clearTimeout(timer.current); setMessage(next);
      const still = await AccessibilityInfo.isReduceMotionEnabled();
      const move = toValue => still ? y.setValue(toValue) : Animated.spring(y, { toValue, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 6 }).start();
      move(0);
      timer.current = setTimeout(() => { move(-140); timer.current = setTimeout(() => setMessage(null), 300); }, 3200);
    };
    const remove = addToastHost(show);
    return () => { remove(); clearTimeout(timer.current); };
  }, [y]);
  if (!message) return null;
  return <Animated.View pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.toast, { top: insets.top + 14, transform: [{ translateY: y }] }]}>
    {!!message.icon && <Icon name={message.icon} size={30} />}
    <View style={{ flexShrink: 1 }}><Txt bold size={16.8} style={{ lineHeight: 21 }}>{message.title}</Txt>{!!message.body && <Txt size={15}>{message.body}</Txt>}</View>
  </Animated.View>;
}





