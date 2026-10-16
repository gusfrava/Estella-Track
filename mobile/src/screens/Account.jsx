import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { exportFile } from '@/services/export-file';
import { router } from 'expo-router';
import { Button, Field, RouteSheet, Row, Sheet, Tabs, TextButton, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { ProfileForm } from './Access';
import * as store from '@/core/state/store';
import * as fb from '@/core/services/firebase';
import { DEFAULT_SHARING, SHARING_LEVELS } from '@/core/state/model';
import { replayOnboarding } from '@/core/controllers/onboarding';
import { colors } from '@/theme/tokens';
import { googleSignInAvailable } from '@/services/google-sign-in';
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
  return <RouteSheet title={L.account}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.card }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}><Txt bold size={25.6} style={{ lineHeight: 30 }}>{initial}</Txt></View>
      <View style={{ flex: 1, minWidth: 0 }}>{session.localMode ? <><Txt bold size={19.2}>{L.localMode}</Txt><Txt muted>{L.localModeBody}</Txt></> : <>{!!name && <Txt bold size={19.2}>{name}</Txt>}{!!handle && <Txt bold style={{ color: colors.tealInk }}>{handle}</Txt>}<Txt muted>{user?.email || ''}</Txt></>}</View>
    </View>
    {language}
    <FeelSwitches />
    {session.localMode ? <Button secondary title={L.exitLocal} onPress={leave} /> : <View style={{ gap: 12 }}>
      <Button secondary title={L.editProfile} onPress={() => setSheet('profile')} />
      <Button secondary title={L.privacy} onPress={() => setSheet('privacy')} />
      <Button secondary title={exporting ? L.exporting : L.exportData} disabled={exporting} onPress={exportData} />
      <Button secondary title={L.ob.replay} onPress={() => { replayOnboarding(); router.replace('/'); }} />
      {!!message && <FormMessage kind={message[0]} text={message[1]} />}
      <TextButton title={L.signOut} onPress={leave} style={{ alignSelf: 'center' }} />
      <TextButton title={L.deleteAccount} color={danger} onPress={() => setSheet('delete')} style={{ alignSelf: 'center' }} />
      <Txt muted size={14.4} style={{ textAlign: 'center', marginTop: 14 }}><Txt size={14.4} style={{ color: colors.tealInk }} onPress={() => Linking.openURL(SITE + 'legal/privacy.html')}>{L.privacyPolicy}</Txt> · <Txt size={14.4} style={{ color: colors.tealInk }} onPress={() => Linking.openURL(SITE + 'legal/terms.html')}>{L.terms}</Txt></Txt>
    </View>}
    {sheet === 'profile' && <Sheet title={L.editProfile} onClose={() => setSheet(null)}><ProfileForm onDone={() => setSheet(null)} /></Sheet>}
    {sheet === 'privacy' && <PrivacySheet onClose={() => setSheet(null)} />}
    {sheet === 'delete' && <DeleteSheet onClose={() => setSheet(null)} exportData={exportData} exporting={exporting} />}
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

// Website sheets/privacy.js: who can see each kind of data, and whether people can find you.
function PrivacySheet({ onClose }) {
  const { L, state } = useApp(), p = state.profile || {}, sharing = { ...DEFAULT_SHARING, ...(p.sharing || {}) };
  const label = { profile: [L.shareProfile, L.shareProfileHint], routines: [L.shareRoutines, L.shareRoutinesHint], workouts: [L.shareWorkouts, L.shareWorkoutsHint], body: [L.shareBody, L.shareBodyHint] };
  const levelText = { private: L.levelPrivate, friends: L.levelFriends, public: L.levelPublic };
  return <Sheet title={L.privacyTitle} onClose={onClose}>
    <Txt muted style={{ marginTop: -16 }}>{L.privacySub}</Txt>
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
  return <Sheet title={L.deleteTitle} onClose={onClose}>
    <Txt muted style={{ marginTop: -16 }}>{L.deleteBody}</Txt>
    <View style={{ gap: 6 }}>{[L.deleteWhat1, L.deleteWhat2, L.deleteWhat3].map(item => <Txt key={item}>• {item}</Txt>)}</View>
    <Button small secondary title={exporting ? L.exporting : L.deleteExportFirst} disabled={exporting} onPress={exportData} />
    {usesPassword ? <Field label={L.deletePassword} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" /> : <Txt muted size={14.7}>{L.deleteGoogle}</Txt>}
    <Field label={L.deleteType(L.deleteWord)} value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} />
    {!!error && <FormMessage kind="err" text={error} />}
    <View style={{ gap: 12 }}><Button disabled={busy || !ready} onPress={submit} style={{ backgroundColor: danger }}><Txt bold size={20} style={{ color: colors.card, textAlign: 'center' }}>{L.deleteConfirm}</Txt></Button><Button secondary title={L.cancel} onPress={onClose} /></View>
  </Sheet>;
}
