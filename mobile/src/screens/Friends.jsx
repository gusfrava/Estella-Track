import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Share, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Bust, Button, Icon, Page, Row, Sheet, Title, Txt, s as ui, toast } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import * as social from '@/core/state/social';
import * as friends from '@/core/controllers/friends';
import * as fb from '@/core/services/firebase';
import { routineName } from '@/core/i18n';
import { exerciseName } from '@/core/services/library';
import { parseYmd, todayStr, weekStart, ymd, ymdOf } from '@/core/utils/dates';
import { fmtClock, fmtDay } from '@/core/utils/format';
import { Confirm } from '@/features/workouts/Forms';
import { feel } from '@/services/feel';
import { colors } from '@/theme/tokens';
const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="${colors.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17a7 7 0 1 0 0 -14a7 7 0 0 0 0 14z"/><path d="M21 21l-6 -6"/></svg>`;
const SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="${colors.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M9 12l2 2l4 -4"/></svg>`;
const CHEER_ICONS = { fire: 'streak-flame', strong: 'dumbbell', clap: 'cheer' };
const hairline = '#EEDFCB', danger = '#C8371F';
// Names come from other people's documents: never assume they're text.
const text = v => (typeof v === 'string' ? v : '').trim();
const personName = p => text(p.displayName) || `@${text(p.username) || '?'}`;
const lastName = (last, F) => (last.kind === 'activity' ? (last.sport || F.activity) : (routineName({ name: last.name }) || F.activity));
function when(date, F) { const y = new Date(); y.setDate(y.getDate() - 1); return date === todayStr() ? F.today : date === ymd(y) ? F.yesterday : fmtDay(parseYmd(date)); }

// Website views/friends.js: search + invite, requests, cheers from the last week, friends with their week, sent requests.
export default function Friends() {
  const { L,session,run,state } = useApp(), F = L.fr; const [search,setSearch] = useState(false), [person,setPerson] = useState(null), [seenAt] = useState(() => friends.cheersSeenAt());
  const signedIn = !session.localMode && !!session.user;
  useEffect(() => { if (signedIn) friends.markCheersSeen(); });   // the dots on new cheers stay until the next visit; the tab badge clears now
  const execute = action => run(action).catch(() => {});
  const head = <View style={{ gap: 6 }}><Title>{F.title}</Title><Txt muted>{F.sub}</Txt></View>;
  if (!signedIn) return <Page tab="friends">{head}<View style={s.empty}><Txt bold size={21.5} style={{ textAlign: 'center' }}>{F.needAccount}</Txt><Txt muted style={{ textAlign: 'center', maxWidth: 280 }}>{F.needAccountBody}</Txt></View></Page>;
  const incoming = social.pendingIncoming(), outgoing = social.pendingOutgoing(), list = social.friendList(), cheers = social.recentCheers();
  const section = (title, count) => <Row style={{ justifyContent: 'flex-start', gap: 6, marginTop: 12 }}><Txt bold size={21}>{title}</Txt>{!!count && <View style={s.count}><Txt bold size={14.4}>{count}</Txt></View>}</Row>;
  return <Page tab="friends">{head}
    <Pressable accessibilityRole="search" onPress={() => setSearch(true)} style={s.search}><SvgXml xml={SEARCH} width={22} height={22} /><Txt muted>{F.searchPh}</Txt></Pressable>
    <Pressable accessibilityRole="button" onPress={() => Share.share({ message: `${F.inviteText} https://gusfrava.github.io/Estella-Track/?add=${encodeURIComponent(state.profile?.username || '')}` })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: -10 }}><Icon name="ui-plus" size={16} color={colors.tealInk} /><Txt bold style={{ color: colors.tealInk }}>{F.invite}</Txt></Pressable>
    {!!incoming.length && <>{section(F.requests, incoming.length)}<View style={{ gap: 8 }}>{incoming.map(r => { const p = { uid: r.from, username: r.fromUsername, displayName: r.fromName }; return <View key={r.id} style={s.person}><Avatar p={p} /><PersonText p={p} /><Row style={{ gap: 6 }}><Pressable accessibilityRole="button" onPress={() => execute(() => friends.accept(p.uid))} style={[s.pbtn, { backgroundColor: colors.orange }]}><Txt bold size={14.7} style={{ color: colors.card }}>{F.accept}</Txt></Pressable><Pressable accessibilityRole="button" accessibilityLabel={F.decline} onPress={() => execute(() => friends.decline(p.uid))} style={[s.pbtn, { width: 38, paddingHorizontal: 0 }]}><Icon name="ui-close" size={16} /></Pressable></Row></View>; })}</View></>}
    {!!cheers.length && <>{section(F.cheersTitle)}<View style={{ gap: 8 }}>{cheers.map(c => { const f = social.getSocial().friends[c.from] || { username: c.fromUsername, displayName: c.fromName }; const isNew = c.createdAt > seenAt; return <Pressable key={c.id} accessibilityRole="button" onPress={() => setPerson({ uid: c.from, ...f })} style={[s.person, { backgroundColor: colors.yellowSoft }]}>
      <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}><Icon name={CHEER_ICONS[c.kind] || CHEER_ICONS.fire} size={24} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Row style={{ justifyContent: 'flex-start', gap: 6 }}><Txt bold size={16.3} numberOfLines={1}>{personName({ ...f, uid: c.from })}</Txt>{isNew && <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.orange }} />}</Row><Txt muted size={14}>{F.cheerLine(F.cheerKinds[c.kind] || F.cheerKinds.fire, routineName({ name: c.workout }))}</Txt></View>
      <Txt muted size={13}>{when(ymdOf(c.createdAt), F)}</Txt></Pressable>; })}</View></>}
    {section(F.yourFriends, list.length)}
    {!social.getSocial().ready ? <Txt muted size={14.7}>{F.loading}</Txt>
      : !list.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 20 }}><Bust size={84} /><View style={{ flex: 1 }}><Txt bold size={17}>{F.emptyTitle}</Txt><Txt muted size={14.7}>{F.emptyBody}</Txt></View></View>
      : <View style={{ gap: 8 }}>{list.map(f => { const line = friendLine(f.uid, F); return <Pressable key={f.uid} accessibilityRole="button" onPress={() => setPerson(f)} style={({ pressed }) => [s.person, pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] }]}><Avatar p={f} /><View style={{ flex: 1, minWidth: 0 }}><Txt bold size={16.3} numberOfLines={1}>{personName(f)}</Txt>{!!(line || f.displayName) && <Txt muted size={14} numberOfLines={1}>{line || `@${f.username}`}</Txt>}</View><MiniDots uid={f.uid} /><View style={{ transform: [{ rotate: '180deg' }], opacity: .55 }}><Icon name="ui-back" size={18} /></View></Pressable>; })}</View>}
    {!!outgoing.length && <>{section(F.sent)}<View style={{ gap: 8 }}>{outgoing.map(r => { const p = { uid: r.to, username: r.toUsername, displayName: r.toName }; return <View key={r.id} style={s.person}><Avatar p={p} /><PersonText p={p} /><Pressable accessibilityRole="button" onPress={() => execute(() => friends.cancel(p.uid))} style={s.pbtn}><Txt bold size={14.7}>{F.cancelReq}</Txt></Pressable></View>; })}</View></>}
    {search && <SearchSheet onClose={() => setSearch(false)} onOpen={p => { setSearch(false); setPerson(p); }} />}
    {person && <FriendCard person={person} onClose={() => setPerson(null)} />}
  </Page>;
}

const Avatar = ({ p, big = false }) => <View style={[s.avatar, big && { width: 76, height: 76, borderRadius: 38 }]}><Txt bold size={big ? 32 : 18.4} style={{ lineHeight: big ? 36 : 22 }}>{([...(text(p.displayName) || text(p.username))][0] || '?').toUpperCase()}</Txt></View>;
const PersonText = ({ p }) => <View style={{ flex: 1, minWidth: 0 }}><Txt bold size={16.3} numberOfLines={1}>{personName(p)}</Txt>{!!p.displayName && <Txt muted size={14} numberOfLines={1}>@{p.username}</Txt>}</View>;

// "2/3 days · streak 4 wk." under their name; '' while loading or when there's nothing to show.
function friendLine(uid, F) {
  const w = social.friendWeek(uid);
  if (!w || w.state !== 'ok') return '';
  return [F.weekShort(w.days, w.goal), ...(w.streak.current > 0 ? [F.streakShort(w.streak.current)] : [])].join(' · ');
}
function weekDays() { const start = weekStart(); return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return ymd(d); }); }
function MiniDots({ uid }) {
  const w = social.friendWeek(uid), today = todayStr();
  if (!w || w.state !== 'ok') return null;
  return <View style={{ flexDirection: 'row', gap: 3 }}>{weekDays().map(k => <View key={k} style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: w.dates.has(k) ? colors.orange : colors.card, boxShadow: k === today ? `0 0 0 2px ${colors.yellow}` : undefined }} />)}</View>;
}

// Website sheets/friend-search.js: results as you type (300 ms pause), with the button that fits how you're related.
function SearchSheet({ onClose, onOpen }) {
  const { L, run } = useApp(), F = L.fr; const [query,setQuery] = useState(''), [results,setResults] = useState([]), [status,setStatus] = useState('idle'), seq = useRef(0), timer = useRef(null);
  const find = value => {
    const q = value.trim(), mine = ++seq.current;
    if (q.replace(/^@/, '').length < 2) { setStatus('idle'); setResults([]); return; }
    setStatus('loading');
    friends.search(value).then(list => { if (mine === seq.current) { setResults(list); setStatus('done'); } }, () => { if (mine === seq.current) setStatus('error'); });
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Sheet title={F.searchTitle} onClose={onClose}>
    <TextInput autoFocus value={query} placeholder={F.searchPh} placeholderTextColor="#9A8577" accessibilityLabel={F.searchPh} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { clearTimeout(timer.current); find(query); }} onChangeText={v => { setQuery(v); clearTimeout(timer.current); timer.current = setTimeout(() => find(v), 300); }} style={ui.input} />
    {status === 'loading' && !results.length ? <Txt muted size={14.7}>{F.searching}</Txt> : status === 'error' ? <Txt muted size={14.7}>{F.searchError}</Txt> : status === 'done' && !results.length ? <Txt muted size={14.7}>{F.noResults(query.trim())}</Txt>
      : status !== 'idle' && <View style={{ gap: 8 }}>{results.map(p => <View key={p.uid} style={s.person}><Pressable accessibilityRole="button" onPress={() => onOpen(p)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar p={p} /><PersonText p={p} /></Pressable><RelationButton p={p} run={run} /></View>)}</View>}
    <Txt muted size={14.7}>{F.searchHint}</Txt>
  </Sheet>;
}
function RelationButton({ p, run }) {
  const { L } = useApp(), F = L.fr, rel = friends.relationTo(p.uid), [busy,setBusy] = useState(false);
  const act = fn => { setBusy(true); run(fn).catch(() => {}).finally(() => setBusy(false)); };
  const chip = label => <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.teal }}><Txt bold size={13.6}>{label}</Txt></View>;
  const btn = (label, fn, ok) => <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(fn)} style={[s.pbtn, ok && { backgroundColor: colors.orange }, busy && { opacity: .5 }]}><Txt bold size={14.7} style={{ color: ok ? colors.card : colors.ink }}>{label}</Txt></Pressable>;
  if (rel === 'friend') return chip(F.isFriend);
  if (rel === 'me') return chip(F.you);
  if (rel === 'sent') return btn(F.pending, () => friends.cancel(p.uid));
  if (rel === 'received') return btn(F.accept, () => friends.accept(p.uid), true);
  return btn(F.add, () => { toast({ icon: 'ui-check', title: F.sentToast, body: personName(p) }); return friends.add(p); }, true);
}

// Website sheets/friend-card.js: who they are, their week (and a cheer for their last workout), their routines to copy.
function FriendCard({ person, onClose }) {
  const { L,run } = useApp(), F = L.fr, p = { ...person, ...(social.getSocial().friends[person.uid] || {}) }, [shared,setShared] = useState(null), [removing,setRemoving] = useState(false);
  const relation = friends.relationTo(p.uid), isFriend = relation === 'friend', w = isFriend ? social.friendWeek(p.uid) : null;
  useEffect(() => { if (!isFriend) return; let active = true; const stop = fb.watchCard(p.uid, entry => social.setCard(p.uid, entry)); friends.sharedRoutinesOf(p.uid).then(value => { if (active) setShared(value); }, () => { if (active) setShared({ state: 'error' }); }); return () => { active = false; stop(); }; }, [p.uid, isFriend]);
  useEffect(() => { if (w?.last?.date) return friends.watchMyCheer(p.uid, w.last.date); }, [p.uid, w?.last?.date]);
  const execute = action => run(action).catch(() => {});
  if (removing) return <Confirm title={F.removeTitle(personName(p))} body={F.removeBody} action={() => execute(async () => { await friends.remove(p.uid); onClose(); })} onClose={() => setRemoving(false)} />;
  const since = label => <Row style={{ justifyContent: 'center', gap: 8 }}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}><Icon name="ui-check" size={12} /></View><Txt bold>{label}</Txt></Row>;
  return <Sheet title="" onClose={onClose}>
    <View style={{ alignItems: 'center', gap: 4 }}><Avatar p={p} big /><Txt bold size={22} style={{ marginTop: 8, textAlign: 'center' }}>{personName(p)}</Txt>{!!p.displayName && <Txt muted>@{p.username}</Txt>}</View>
    {isFriend && <FriendWeek uid={p.uid} w={w} run={run} />}
    {isFriend && <SharedRoutines p={p} shared={shared} />}
    <View style={{ gap: 10 }}>
      {relation === 'me' && <Txt muted style={{ textAlign: 'center' }}>{F.thisIsYou}</Txt>}
      {isFriend && <>{since(F.isFriend)}<Button secondary onPress={() => setRemoving(true)}><Txt bold size={20} style={{ color: danger }}>{F.remove}</Txt></Button></>}
      {relation === 'sent' && <><Txt muted>{F.sentHint}</Txt><Button secondary title={F.cancelReq} onPress={() => execute(() => friends.cancel(p.uid))} /></>}
      {relation === 'received' && <><Txt muted>{F.receivedHint}</Txt><Button title={F.accept} onPress={() => execute(() => friends.accept(p.uid))} /><Button secondary title={F.decline} onPress={() => execute(() => friends.decline(p.uid))} /></>}
      {relation === 'none' && <Button title={F.add} onPress={() => { execute(() => friends.add(p)); toast({ icon: 'ui-check', title: F.sentToast, body: personName(p) }); }} />}
    </View>
  </Sheet>;
}

function FriendWeek({ uid, w, run }) {
  const { L } = useApp(), F = L.fr, today = todayStr();
  const note = msg => <Txt muted size={14.7} style={{ textAlign: 'center' }}>{msg}</Txt>;
  if (!w) return note(F.loading);
  if (w.state !== 'ok') return note(w.state === 'hidden' ? F.hidden : w.state === 'none' ? F.noCard : F.cardError);
  const st = w.streak, sub = st.current === 0 ? '' : st.thisWeek ? F.streakKept : w.goal && w.left > 0 ? F.streakLeft(w.left) : '';
  const mine = w.last ? social.myCheerFor(uid, w.last.date) : null, label = { fontSize: 12.8, color: colors.muted, textTransform: 'uppercase', letterSpacing: .5, fontWeight: '700' };
  const divider = { paddingTop: 10, borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline };
  return <View style={{ gap: 8 }}>
    {!!w.badges && <Row style={{ justifyContent: 'center', gap: 6 }}><Icon name="ui-star" size={20} /><Txt style={{ fontWeight: '700' }}>{L.pts.badgesOf(w.badges)}</Txt></Row>}
    <View style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.card, padding: 14, gap: 10 }}>
      <Row><Txt bold size={18}>{F.thisWeek}</Txt><View style={{ paddingHorizontal: 10, paddingVertical: 2, borderWidth: 2, borderColor: colors.ink, borderRadius: 99, backgroundColor: colors.teal }}><Txt bold size={13}>{F.daysOfGoal(w.days, w.goal)}</Txt></View></Row>
      <View accessibilityRole="image" accessibilityLabel={F.theyTrained(weekDays().filter(d => w.dates.has(d)).length)} style={{ flexDirection: 'row' }}>{weekDays().map((d, i) => <View key={d} style={{ flex: 1, alignItems: 'center', gap: 4 }}><View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: w.dates.has(d) ? colors.orange : colors.card, alignItems: 'center', justifyContent: 'center', boxShadow: d === today ? `0 0 0 3px ${colors.yellow}, 0 0 0 5px ${colors.ink}` : undefined }}>{w.dates.has(d) && <Icon name="ui-check" size={16} />}</View><Txt bold size={13.5}>{L.dayLetters[i]}</Txt></View>)}</View>
      {w.goal && w.met && <Txt bold>{F.goalMet}</Txt>}
      <Row style={[divider, { gap: 10 }]}><Icon name="ui-flame" size={30} /><View style={{ flex: 1 }}><Txt bold>{st.current > 0 ? L.streakWeeks(st.current) : F.noStreak}</Txt>{!!sub && <Txt muted size={14}>{sub}</Txt>}</View>{!!st.jokers && <View accessibilityLabel={L.jokersN(st.jokers)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.yellow }}><SvgXml xml={SHIELD} width={18} height={18} /><Txt bold>{st.jokers}</Txt></View>}</Row>
      {st.savedLast && <Txt muted size={14.7}>{F.savedLast}</Txt>}
      {w.last && <><View style={[divider, { gap: 2 }]}><Txt style={label}>{F.last}</Txt><Row><Txt bold numberOfLines={1} style={{ flex: 1 }}>{lastName(w.last, F)}</Txt><Txt muted size={14}>{when(w.last.date, F)}</Txt></Row></View>
        <View style={{ gap: 8 }}><Txt style={label}>{F.cheerPrompt}</Txt><View style={{ flexDirection: 'row', gap: 8 }}>{friends.CHEER_KINDS.map(k => { const on = mine?.kind === k; return <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { feel(mine?.kind === k ? 'tap' : 'cheer'); return run(() => friends.cheer(uid, k, { date: w.last.date, name: lastName(w.last, F) })).then(result => toast(result === 'removed' ? { title: F.cheerRemoved } : { icon: CHEER_ICONS[k], title: F.cheerSentToast(F.cheerKinds[k]), body: personName(social.getSocial().friends[uid] || { uid }) })).catch(() => {}); }} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: on ? colors.orange : colors.card, boxShadow: pressed ? `1px 2px 0 ${colors.ink}` : `2px 3px 0 ${colors.ink}` }, pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] }]}><Icon name={CHEER_ICONS[k]} size={26} /><Txt bold size={14.4}>{F.cheerKinds[k]}</Txt></Pressable>; })}</View>{mine && <Txt muted size={14}>{F.cheerSent(F.cheerKinds[mine.kind])}</Txt>}</View></>}
    </View>
  </View>;
}

const time = sec => (sec < 60 ? `${sec} s` : sec % 60 === 0 ? `${sec / 60} min` : fmtClock(sec));
const dose = (e, L) => (e.type === 'time' ? (e.sets > 1 ? `${e.sets} × ${time(e.seconds)}` : time(e.seconds)) : `${e.sets} × ${e.reps}${e.perSide ? ` ${L.ob.planPerSide}` : ''}`);
function SharedRoutines({ p, shared }) {
  const { L } = useApp(), F = L.fr, [open,setOpen] = useState(null), [, redraw] = useState(0);
  const hint = msg => <Txt muted size={14.7}>{msg}</Txt>;
  const body = !shared ? hint(F.loading) : shared.state === 'hidden' ? hint(F.routinesHidden) : shared.state === 'none' ? hint(F.routinesLater) : shared.state !== 'ok' ? hint(F.routinesError) : !shared.routines.length ? hint(F.routinesNone)
    : <View style={{ gap: 10 }}>{shared.routines.map(r => { const done = friends.alreadyCopied(p.uid, r.id), isOpen = open === r.id; return <View key={r.id} style={{ borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.card, boxShadow: `3px 4px 0 ${colors.ink}`, overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : r.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}><View style={{ flex: 1 }}><Txt bold size={17.3} style={{ lineHeight: 21 }}>{routineName(r)}</Txt><Txt muted size={14.4}>{L.ob.planCount(r.exercises.length)}</Txt></View><View style={{ transform: [{ rotate: isOpen ? '90deg' : '-90deg' }] }}><Icon name="ui-back" size={22} /></View></Pressable>
      {isOpen && <><View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2, borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline }}>{r.exercises.map((e, i) => <Row key={i} style={{ alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: i < r.exercises.length - 1 ? 1 : 0, borderColor: hairline }}><Txt size={15.2} style={{ flex: 1 }}>{exerciseName(e)}</Txt><Txt bold size={15.2} style={{ color: colors.tealInk }}>{dose(e, L)}</Txt></Row>)}</View>
        <View style={{ gap: 6, paddingHorizontal: 14, paddingBottom: 14 }}>{done && <Row style={{ justifyContent: 'center', gap: 8 }}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}><Icon name="ui-check" size={12} /></View><Txt bold>{F.copied}</Txt></Row>}<Button secondary={done} title={done ? F.copyAgain : F.copy} onPress={() => { friends.copyRoutine(p, r); feel('done'); toast({ icon: 'ui-check', title: F.copiedToast, body: routineName(r) }); redraw(n => n + 1); }} /><Txt muted size={14.7} style={{ textAlign: 'center' }}>{F.copyHint}</Txt></View></>}
    </View>; })}</View>;
  return <View style={{ gap: 10 }}><Txt bold size={21}>{F.routinesTitle}</Txt>{body}</View>;
}

const s = {
  empty: { borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center', backgroundColor: '#FFFFFF80', gap: 4 },
  search: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.card },
  count: { minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.card },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  pbtn: { minHeight: 38, paddingHorizontal: 14, borderWidth: 2, borderColor: colors.ink, borderRadius: 99, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
};
