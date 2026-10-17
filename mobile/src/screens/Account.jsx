import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { exportFile } from '@/services/export-file';
import { router } from 'expo-router';
import { AccountAvatar, Button, InPlaceSheets, initialLine, Field, RouteSheet, Row, Sheet, Tabs, TextButton, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { ProfileForm } from './Access';
import * as store from '@/core/state/store';
import * as fb from '@/core/services/firebase';
import { DEFAULT_SHARING, SHARING_LEVELS } from '@/core/state/model';
import { AVATARS, avatarPath } from '@/core/data/avatars';
import { getWallet, setWallet } from '@/core/state/rewards';
import { colors } from '@/theme/tokens';
import { googleSignInAvailable } from '@/services/google-sign-in';
import { RevenueCatStatus } from '@/components/RevenueCatStatus';
import { canVibrate, feel, feelPrefs, setFeelPref } from '@/services/feel';
const SITE = 'https://gusfrava.github.io/Estella-Track/';
const danger = '#C8371F';

// Website sheets/account.js: who you are, language, profile and privacy, your data, sign out and delete.
export default function Account() {
  const { L,lang,setLang,state,session,logout,run } = useApp(), [sheet,setSheet] = useState(null), [exporting,setExporting] = useState(false), [message,setMessage] = useState(null);
  const execute = action => run(action).catch(() => {});
  const leave = () => execute(async () => { await logout(); router.replace('/'); });
  const exportData = async () => { setExporting(true); setMessage(null); try { const data = await fb.exportUserData(session.user); await exportFile(data, `estella-${new Date().toISOString().slice(0,10)}.json`); setMessage(['ok', L.exportShared]); } catch { setMessage(['err', L.exportFailed]); } finally { setExporting(false); } };
  const profile = state.profile, user = session.user;
  const name = (profile?.displayName || user?.displayName || '').trim(), handle = profile?.username ? `@${profile.username}` : '';
  const initial = session.localMode ? '·' : ((name || profile?.username || user?.email || '?').trim()[0] || '?').toUpperCase();
  const language = <Row><Txt bold size={17}>{L.language}</Txt><Tabs compact items={[['es','ES'],['en','EN']]} value={lang} onChange={key => { if (key === lang) return; setLang(key); if (!session.localMode) store.updateProfile({ lang: key }); }} /></Row>;
  const back = () => setSheet(null);
  const open = { profile: <Sheet title={L.editProfile} onClose={back}><ProfileForm onDone={back} /></Sheet>, avatars: <AvatarSheet onClose={back} />, privacy: <PrivacySheet onClose={back} />, delete: <DeleteSheet onClose={back} exportData={exportData} exporting={exporting} /> }[sheet];
  if (open) return <InPlaceSheets>{open}</InPlaceSheets>;
  return <RouteSheet title={L.account}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.card }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{session.localMode ? <Txt bold size={25.6} style={{ lineHeight: initialLine(25.6) }}>{initial}</Txt> : <AccountAvatar initial={initial} size={60} />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{session.localMode ? <><Txt bold size={19.2}>{L.localMode}</Txt><Txt muted>{L.localModeBody}</Txt></> : <>{!!name && <Txt bold size={19.2}>{name}</Txt>}{!!handle && <Txt bold style={{ color: colors.tealInk }}>{handle}</Txt>}<Txt muted>{user?.email || ''}</Txt></>}</View>
    </View>
    {language}
    {__DEV__ && <RevenueCatStatus lang={lang} />}
    <FeelSwitches />
    {session.localMode ? <Button secondary title={L.exitLocal} onPress={leave} /> : <View style={{ gap: 12 }}>
      <Button secondary title={avatarLabels(lang).title} onPress={() => setSheet('avatars')} />
      <Button secondary title={L.editProfile} onPress={() => setSheet('profile')} />
      <Button secondary title={L.privacy} onPress={() => setSheet('privacy')} />
      <Button secondary title={exporting ? L.exporting : L.exportData} disabled={exporting} onPress={exportData} />
      {!!message && <FormMessage kind={message[0]} text={message[1]} />}
      <TextButton title={L.signOut} onPress={leave} style={{ alignSelf: 'center' }} />
      <TextButton title={L.deleteAccount} color={danger} onPress={() => setSheet('delete')} style={{ alignSelf: 'center' }} />
      <Txt muted size={14.4} style={{ textAlign: 'center', marginTop: 14 }}><Txt size={14.4} style={{ color: colors.tealInk }} onPress={() => Linking.openURL(SITE + 'legal/privacy.html')}>{L.privacyPolicy}</Txt> · <Txt size={14.4} style={{ color: colors.tealInk }} onPress={() => Linking.openURL(SITE + 'legal/terms.html')}>{L.terms}</Txt></Txt>
    </View>}
  </RouteSheet>;
}

const FormMessage = ({ kind, text }) => <View accessibilityRole={kind === 'err' ? 'alert' : undefined} style={{ padding: 12, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: kind === 'err' ? '#FDE7E1' : '#E3F7F3' }}><Txt size={15}>{text}</Txt></View>;

// Website .switch: title, hint and a sliding track.
// Website sheets/account.js feelSwitches: turning one on plays a sample of it.
function FeelSwitches() {
  const { L } = useApp(), [prefs, setPrefs] = useState(feelPrefs);
  const toggle = (name, sample) => on => { setFeelPref(name, on); setPrefs(feelPrefs()); if (on) feel(sample); };
  return <View style={{ gap: 10 }}><Switch title={L.feelSound} hint={L.feelSoundHint} value={prefs.sound} onChange={toggle('sound', 'check')} />{canVibrate && <Switch title={L.feelHaptics} hint={L.feelHapticsHint} value={prefs.haptics} onChange={toggle('haptics', 'done')} />}</View>;
}
function Switch({ title, hint, value, onChange }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.card }}>
    <View style={{ flex: 1 }}><Txt bold size={16.8}>{title}</Txt><Txt muted size={14.4}>{hint}</Txt></View>
    <View style={{ width: 56, height: 32, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: value ? colors.teal : colors.background, padding: 2 }}><View style={{ width: 23, height: 23, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card, transform: [{ translateX: value ? 24 : 0 }] }} /></View>
  </Pressable>;
}

// Website sheets/avatars.js (labels copied from its avatarLabels): free launch avatars, Halloween ones bought with
// points. The server (chooseAvatar) owns prices, ownership and the balance; the wallet listener refreshes this sheet.
const avatarLabels = lang => lang === 'es' ? {
  title: 'Tu avatar', intro: 'Elige cómo apareces en tu cuenta.', release: 'Colección de lanzamiento',
  halloween: 'Especial Halloween', free: 'Gratis', owned: 'Desbloqueado', selected: 'Seleccionado',
  initial: 'Usar mi inicial', points: 'puntos', buy: 'Desbloquear por 100 puntos', cancel: 'Cancelar',
  confirm: 'Este avatar será tuyo para siempre. Se descontarán 100 puntos de tu saldo.',
  missing: n => `Te faltan ${n} puntos`, loading: 'Cargando tus puntos…', saving: 'Guardando…',
  error: 'No se pudo guardar. Inténtalo de nuevo.', balance: 'Tu saldo', success: 'Avatar guardado.',
} : {
  title: 'Your avatar', intro: 'Choose how you appear on your account.', release: 'Launch collection',
  halloween: 'Halloween special', free: 'Free', owned: 'Unlocked', selected: 'Selected',
  initial: 'Use my initial', points: 'points', buy: 'Unlock for 100 points', cancel: 'Cancel',
  confirm: 'This avatar will be yours permanently. 100 points will be deducted from your balance.',
  missing: n => `You need ${n} more points`, loading: 'Loading your points…', saving: 'Saving…',
  error: 'Could not save. Please try again.', balance: 'Your balance', success: 'Avatar saved.',
};
function AvatarSheet({ onClose }) {
  const { lang } = useApp(), A = avatarLabels(lang), [busy,setBusy] = useState(false), [confirm,setConfirm] = useState(null), [message,setMessage] = useState('');
  const wallet = getWallet(), loaded = wallet !== undefined, balance = Number(wallet?.points) || 0, selected = wallet?.avatarId || 'initial';
  // Choosing a free or owned avatar shows at once (the server can take seconds when it's cold); the wallet listener
  // then brings the server's copy, and a refusal puts the previous one back. Buying waits for the server.
  const save = async (id, purchase) => {
    if (busy) return;
    const before = getWallet()?.avatarId;
    if (!purchase) setWallet({ ...getWallet(), avatarId: id });
    setBusy(purchase); setMessage('');
    try { await fb.chooseAvatar(id, purchase); setConfirm(null); setMessage(A.success); }
    catch (err) {
      if (!purchase && getWallet()?.avatarId === id) setWallet({ ...getWallet(), avatarId: before });
      setMessage(err?.code === 'functions/failed-precondition' ? A.missing(Math.max(0, 100 - (Number(getWallet()?.points) || 0))) : A.error);
    }
    finally { setBusy(false); }
  };
  const pick = a => { if (a.price && !wallet?.avatars?.[a.id]) { setConfirm(a.id); setMessage(''); } else save(a.id, false); };
  const group = premium => <View style={{ flexDirection: 'row', gap: 12 }}>{AVATARS.filter(a => !!a.price === premium).map(a => {
    const locked = a.price > 0 && !wallet?.avatars?.[a.id], short = locked && loaded && balance < a.price, on = selected === a.id;
    const disabled = busy || !loaded || short;
    const status = on ? A.selected : locked ? `🔒 ${a.price} ${A.points}` : a.price ? A.owned : A.free;
    return <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.name}, ${status}`} accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={() => pick(a)}
      style={({ pressed }) => [{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 6, borderWidth: 2, borderColor: colors.ink, borderRadius: 20, backgroundColor: on ? colors.yellow : colors.card }, on && { boxShadow: `0 4px 0 ${colors.ink}` }, pressed && { transform: [{ scale: .97 }] }]}>
      <Image source={avatarPath(a.id)} style={[{ width: '100%', aspectRatio: 1, borderRadius: 999 }, locked && { opacity: .6, filter: 'grayscale(1)' }]} />
      <Txt bold size={15}>{a.name}</Txt><Txt size={12} style={{ textAlign: 'center' }}>{status}</Txt>
      {short && <Txt size={12} muted style={{ textAlign: 'center' }}>{A.missing(a.price - balance)}</Txt>}
    </Pressable>;
  })}</View>;
  return <Sheet title={A.title} sub={A.intro} onClose={onClose}>
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.yellow, borderRadius: 14 }}>{loaded ? <Txt>{A.balance}: <Txt bold>{balance} {A.points}</Txt></Txt> : <Txt>{A.loading}</Txt>}</View>
    {!!(busy || message) && <Txt accessibilityLiveRegion="polite" bold>{busy ? A.saving : message}</Txt>}
    {!!confirm && <View style={{ alignItems: 'center', gap: 12, padding: 16, borderWidth: 2, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.card }}>
      <Image source={avatarPath(confirm)} style={{ width: 112, height: 112, borderRadius: 56 }} />
      <Txt style={{ textAlign: 'center' }}>{A.confirm}</Txt>
      <Button title={A.buy} disabled={busy} onPress={() => save(confirm, true)} style={{ alignSelf: 'stretch' }} />
      <TextButton title={A.cancel} onPress={() => { if (!busy) setConfirm(null); }} />
    </View>}
    <Txt bold size={19}>{A.release}</Txt>{group(false)}
    <Txt bold size={19}>{A.halloween}</Txt>{group(true)}
    <Button secondary title={A.initial} disabled={busy || !loaded} onPress={() => save('initial', false)} />
  </Sheet>;
}

// Website sheets/privacy.js: who can see each kind of data, and whether people can find you.
function PrivacySheet({ onClose }) {
  const { L, state } = useApp(), p = state.profile || {}, sharing = { ...DEFAULT_SHARING, ...(p.sharing || {}) };
  const label = { profile: [L.shareProfile, L.shareProfileHint], routines: [L.shareRoutines, L.shareRoutinesHint], workouts: [L.shareWorkouts, L.shareWorkoutsHint], body: [L.shareBody, L.shareBodyHint] };
  const levelText = { private: L.levelPrivate, friends: L.levelFriends, public: L.levelPublic };
  return <Sheet title={L.privacyTitle} sub={L.privacySub} onClose={onClose}>
    <View style={{ gap: 12 }}>{Object.keys(label).map(cat => <View key={cat} style={{ gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.card }}>
      <View><Txt bold size={16.8}>{label[cat][0]}</Txt><Txt muted size={14.4}>{label[cat][1]}</Txt></View>
      <Tabs items={SHARING_LEVELS.map(lv => [lv, levelText[lv]])} value={sharing[cat]} onChange={lv => { if (sharing[cat] !== lv) store.updateProfile({ sharing: { ...sharing, [cat]: lv } }); }} />
    </View>)}</View>
    <Switch title={L.discoverable} hint={L.discoverableHint} value={p.discoverable !== false} onChange={value => store.updateProfile({ discoverable: value })} />
  </Sheet>;
}

// Website sheets/delete-account.js: what goes, download first, password (email accounts) and the typed word.
function DeleteSheet({ onClose, exportData, exporting }) {
  const { L, session, run, deleteAccount } = useApp(), [password,setPassword] = useState(''), [word,setWord] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const usesPassword = fb.signInMethod(session.user) === 'password';
  // Google accounts confirm in Google's account picker, which needs native sign-in (not available in Expo Go).
  const ready = (usesPassword ? !!password : googleSignInAvailable) && word.trim().toUpperCase() === L.deleteWord;
  const submit = async () => { setBusy(true); setError(''); try { await run(async () => { await deleteAccount(password); router.replace('/'); }); } catch (err) { setError(err?.message || L.errors.default); } finally { setBusy(false); } };
  return <Sheet title={L.deleteTitle} sub={L.deleteBody} onClose={onClose}>
    <View style={{ gap: 6 }}>{[L.deleteWhat1, L.deleteWhat2, L.deleteWhat3].map(item => <Txt key={item}>• {item}</Txt>)}</View>
    <Button small secondary title={exporting ? L.exporting : L.deleteExportFirst} disabled={exporting} onPress={exportData} />
    {usesPassword ? <Field label={L.deletePassword} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" /> : <Txt muted size={14.7}>{L.deleteGoogle}</Txt>}
    <Field label={L.deleteType(L.deleteWord)} value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} />
    {!!error && <FormMessage kind="err" text={error} />}
    <View style={{ gap: 12 }}><Button disabled={busy || !ready} onPress={submit} style={{ backgroundColor: danger }}><Txt bold size={20} style={{ color: colors.card, textAlign: 'center' }}>{L.deleteConfirm}</Txt></Button><Button secondary title={L.cancel} onPress={onClose} /></View>
  </Sheet>;
}
