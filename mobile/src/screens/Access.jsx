import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';
import { Bust, Button, Card, Check, Field, Icon, Motion, Option, Page, Row, Tabs, TextButton, Title, Txt } from '@/components/native-ui';
import { colors } from '@/theme/tokens';
import { googleSignInAvailable } from '@/services/google-sign-in';
import { useApp } from '@/providers/AppProvider';
import * as fb from '@/core/services/firebase';
import * as store from '@/core/state/store';
import { LEGAL } from '@/core/config';
import { cleanUsername, usernameProblem } from '@/core/utils/username';
import * as onboarding from '@/core/controllers/onboarding';
import Onboarding from './Onboarding';
const legalUrl = file => `https://estellatrack.app/legal/${file}.html`;
// Translations carry links as <a href="…">text</a>: show them as tappable text.
const withLinks = html => html.split(/(<a href="[^"]*"[^>]*>.*?<\/a>)/).map((part, i) => { const m = part.match(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/); return m ? <Txt key={i} size={13.6} style={{ color: colors.tealInk, fontWeight: '600' }} onPress={() => Linking.openURL(m[1])}>{m[2]}</Txt> : part; });
export function Consent({ onAccept }) {
  const { L, lang } = useApp(); const [accepted,setAccepted] = useState(false);
  return <View style={{ gap: 16 }}><Row><Check selected={accepted} onPress={() => setAccepted(!accepted)} label={L.consentTitle} /><Txt style={{ flex: 1 }}>{lang === 'es' ? 'Tengo 16 años o más y acepto los términos y la política de privacidad.' : 'I am 16 or older and accept the terms and privacy policy.'}</Txt></Row><Row><Button small secondary title={L.terms} onPress={() => Linking.openURL(legalUrl('terms'))} /><Button small secondary title={L.privacyPolicy} onPress={() => Linking.openURL(legalUrl('privacy'))} /></Row>{onAccept && <Button title={L.ob.next} disabled={!accepted} onPress={onAccept} />}</View>;
}
export function ProfileForm({ onDone }) {
  const { L, state, session, run } = useApp(); const [name,setName] = useState(state.profile?.displayName || session.user?.displayName || ''), [username,setUsername] = useState(state.profile?.username || ''), [busy,setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await run(async () => { if (usernameProblem(username)) throw new Error(L.usernameHint); const owner = await fb.usernameOwner(username); if (owner && owner !== session.user.uid) throw new Error(L.uTaken); await fb.claimUsername(session.user.uid, { username, displayName: name.trim(), previous: state.profile?.username }); store.updateProfile({ username, displayName: name.trim() }); onDone?.(); }); } catch {} finally { setBusy(false); } };
  return <View style={{ gap: 20 }}><Title>{L.pickTitle}</Title><Field label={L.name} value={name} onChangeText={setName} maxLength={60} /><Field label={L.username} value={username} autoCapitalize="none" onChangeText={v => setUsername(cleanUsername(v))} /><Txt muted>{L.usernameHint}</Txt><Button title={L.save} disabled={busy || !!usernameProblem(username)} onPress={save} /></View>;
}
export default function Access({ children }) {
  const app = useApp(), { ready, languageChosen, chooseLang, lang, previewLang, L, session, state } = app;
  if (!ready) return <Page header={false}><Motion /><ActivityIndicator accessibilityLabel="Loading Estella" /></Page>;
  if (!languageChosen) return <Page header={false} footer={<Button title={L.ob.next} onPress={() => chooseLang(lang)} />}><View style={{ alignItems: 'center', marginTop: 10 }}><Bust size={96} /></View><View style={{ gap: 6 }}><Title>{L.ob.langTitle}</Title><Txt muted>{L.ob.langSub}</Txt></View><View style={{ gap: 10 }}>{[['es','Español'],['en','English']].map(([key,name]) => <Option key={key} icon="ob-language" title={name} selected={lang === key} onPress={() => previewLang(key)} />)}</View></Page>;
  if (session.mode !== 'app') return <Auth />;
  if (!session.localMode && !session.synced.profile) return <Page header={false}><ActivityIndicator /><Txt>{L.fr.loading}</Txt></Page>;
  if (!session.localMode && state.profile?.legal?.version !== LEGAL.version) return <Page header={false}><Title>{L.consentTitle}</Title><Txt>{L.consentSub}</Txt><Consent onAccept={() => store.updateProfile({ legal: { version: LEGAL.version, acceptedAt: Date.now(), minAgeConfirmed: LEGAL.minAge } })} /></Page>;
  if (!session.localMode && !state.profile?.username) return <Page header={false}><ProfileForm /></Page>;
  if (onboarding.needsOnboarding(state)) return <Onboarding />;
  return children;
}
function Auth() {
  const { L, lang, run, enterLocal, chooseLang } = useApp();
  const [mode,setMode] = useState('login'), [email,setEmail] = useState(''), [password,setPassword] = useState(''), [name,setName] = useState(''), [show,setShow] = useState(false), [busy,setBusy] = useState(false), [accepted,setAccepted] = useState(false), [sent,setSent] = useState(false);
  const submit = async () => { setBusy(true); try { await run(async () => {
    await fb.loadFirebase(lang);
    if (mode === 'reset') { await fb.resetPassword(email.trim()); setSent(true); }
    else if (mode === 'signup') { if (!accepted) throw new Error(L.consentReq); await fb.signUp(name.trim(),email.trim(),password); }
    else await fb.signIn(email.trim(),password);
  }); } catch {} finally { setBusy(false); } };
  const google = () => { setBusy(true); run(async () => { await fb.loadFirebase(lang); await fb.signInWithGoogle(); }).catch(() => {}).finally(() => setBusy(false)); };
  const eye = <Pressable accessibilityRole="button" accessibilityLabel={show ? L.hidePw : L.showPw} accessibilityState={{ selected: show }} onPress={() => setShow(!show)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name={show ? 'ui-eyeOff' : 'ui-eye'} size={22} /></Pressable>;
  return <Page header={false}><Row><Row style={{ gap: 8 }}><Icon name="star" size={26} /><Txt bold size={18}>Estella</Txt></Row><Tabs compact items={[['es','ES'],['en','EN']]} value={lang} onChange={chooseLang} /></Row>
    <View style={{ gap: 6 }}><Title>{mode === 'signup' ? L.signUpTitle : mode === 'reset' ? L.resetTitle : L.signInTitle}</Title><Txt muted>{mode === 'reset' ? L.resetSub : L.authSub}</Txt></View>
    {mode !== 'reset' && <Tabs items={[['login',L.tabLogin],['signup',L.tabSignup]]} value={mode} onChange={setMode} />}
    {mode === 'signup' && <Field label={L.name} value={name} onChangeText={setName} maxLength={60} />}
    <Field label={L.email} value={email} onChangeText={setEmail} placeholder={L.emailPh} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    {mode !== 'reset' && <View><Field label={L.password} value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" trailing={eye} />{mode === 'login' && <TextButton title={L.forgot} color={colors.tealInk} style={{ alignSelf: 'flex-end', paddingTop: 8, paddingBottom: 0 }} onPress={() => setMode('reset')} />}</View>}
    {mode === 'signup' && <><Row><Check selected={accepted} onPress={() => setAccepted(!accepted)} label={L.consentTitle} /><Txt style={{ flex: 1 }}>{lang === 'es' ? 'Tengo 16 años o más y acepto los términos y la privacidad.' : 'I am 16 or older and accept the terms and privacy policy.'}</Txt></Row><Row style={{ justifyContent: 'flex-start', gap: 18 }}><TextButton title={L.terms} color={colors.tealInk} onPress={() => Linking.openURL(legalUrl('terms'))} /><TextButton title={L.privacyPolicy} color={colors.tealInk} onPress={() => Linking.openURL(legalUrl('privacy'))} /></Row></>}
    {sent && <Card><Txt>{L.resetSent}</Txt></Card>}<Button title={mode === 'signup' ? L.signup : mode === 'reset' ? L.sendLink : L.login} disabled={busy || !email || (mode !== 'reset' && !password) || (mode === 'signup' && !accepted)} onPress={submit} />
    {mode === 'reset' && <TextButton title={L.backToLogin} color={colors.tealInk} onPress={() => setMode('login')} />}
    {mode !== 'reset' && (Platform.OS === 'web' || googleSignInAvailable) && <>
      <Row style={{ gap: 14 }}><View style={{ flex: 1, height: 2, backgroundColor: colors.ink, opacity: .18 }} /><Txt bold muted>{L.or}</Txt><View style={{ flex: 1, height: 2, backgroundColor: colors.ink, opacity: .18 }} /></Row>
      <Button secondary title={L.google} disabled={busy} onPress={google} />
      <Txt muted size={13.6} style={{ textAlign: 'center', lineHeight: 20, marginTop: -10 }}>{withLinks(L.googleConsent(legalUrl('terms'), legalUrl('privacy')))}</Txt>
    </>}
    <TextButton title={L.tryLocal} color={colors.tealInk} onPress={enterLocal} />
  </Page>;
}


