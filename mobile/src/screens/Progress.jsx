import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { router } from 'expo-router';
import { Icon, Page, RouteSheet, Row, TextButton, Title, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { recordsByRoutine, weeklyStreak, weekGoalProgress } from '@/core/state/selectors';
import { badgeList, earnedCount, getWallet, points } from '@/core/state/rewards';
import { weekRecap, hasRecap } from '@/core/state/recap';
import { routineName } from '@/core/i18n';
import { exerciseName } from '@/core/services/library';
import { daysAgo, parseYmd } from '@/core/utils/dates';
import { fmtClock, fmtDay, fmtNum } from '@/core/utils/format';
import { colors } from '@/theme/tokens';
// Tabler Icons (MIT): shield-check
const SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="${colors.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M9 12l2 2l4 -4"/></svg>`;
const NEW_DAYS = 7, MONTH_DAYS = 30, hairline = '#EEDFCB';
const card = { backgroundColor: colors.card, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 24, boxShadow: `3px 4px 0 ${colors.ink}` };

// Website views/progress.js: streak, badges (once the wallet has loaded), recap link and personal records by routine.
export default function ProgressScreen() {
  const { L,state } = useApp(), groups = recordsByRoutine(state), monthFrom = daysAgo(MONTH_DAYS - 1);
  const newThisMonth = groups.reduce((n, g) => n + g.items.filter(i => i.record.prev && i.record.point.d >= monthFrom).length, 0);
  return <Page tab="progress"><View style={{ gap: 6 }}><Title>{L.progressTitle}</Title><Txt muted>{L.recordsSub}</Txt></View>
    <StreakCard s={weeklyStreak(state)} g={weekGoalProgress(state)} />
    {getWallet() !== undefined && <Rewards />}
    {hasRecap(weekRecap()) && <Pressable accessibilityRole="button" onPress={() => router.push('/recap')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}><Icon name="ui-trophy" size={24} /><Txt bold>{L.rc.fromProgress}</Txt></Pressable>}
    {!groups.length ? <View style={{ borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center', backgroundColor: '#FFFFFF80', gap: 4 }}><Icon name="ui-trophy" size={44} /><Txt bold size={21.5} style={{ textAlign: 'center' }}>{L.noRecordsTitle}</Txt><Txt muted style={{ textAlign: 'center', maxWidth: 280 }}>{L.noRecordsBody}</Txt></View>
      : <>{!!newThisMonth && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.yellow }}><Icon name="ui-trophy" size={26} /><Txt style={{ flex: 1, fontWeight: '600' }}>{L.recordsThisMonth(newThisMonth)}</Txt></View>}
        {groups.map(g => <View key={g.routine.id} style={{ gap: 14, marginTop: 12 }}><Txt bold size={21}>{routineName(g.routine)}</Txt>{g.items.map(({ ex, record }) => <RecordItem key={ex.id} ex={ex} record={record} />)}</View>)}</>}
  </Page>;
}

// "5 weeks in a row" + the last 8 weeks as dots: full = goal reached, teal = kept by a streak saver, half = short of the goal.
function StreakCard({ s, g }) {
  const { L } = useApp();
  const msg = s.thisWeek ? L.streakKept : s.savedLast ? L.jokerUsed
    : g.goal ? (s.current ? L.streakLeft(g.left) : g.days ? L.streakStartLeft(g.left) : L.streakStartGoal(g.goal))
    : !s.current ? L.streakStart : L.streakKeepIt;
  return <View accessibilityLabel={L.streakLabel} style={[card, { paddingVertical: 16, paddingHorizontal: 18, boxShadow: `4px 5px 0 ${colors.ink}` }]}>
    <Row style={{ justifyContent: 'flex-start', gap: 14 }}><Icon name="ui-flame" size={46} /><View style={{ flex: 1 }}><Txt bold size={24} style={{ lineHeight: 27 }}>{s.current ? L.streakWeeks(s.current) : L.streakZero}</Txt><Txt muted size={14.7} style={{ lineHeight: 20 }}>{msg}</Txt></View></Row>
    <View accessibilityRole="image" accessibilityLabel={L.streakDotsLabel(s.recent.filter(w => w.done).length)} style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>{s.recent.map((w, i) => {
      const now = i === s.recent.length - 1, part = !w.done && !w.saved && w.days > 0;
      return <View key={w.key} style={{ flex: 1, height: 14, borderWidth: 2, borderStyle: now && !w.done ? 'dashed' : 'solid', borderColor: colors.ink, borderRadius: 99, overflow: 'hidden', backgroundColor: w.done ? colors.orange : w.saved ? colors.teal : colors.background }}>{part && <View style={{ width: '50%', height: '100%', backgroundColor: colors.orange }} />}</View>;
    })}</View>
    {s.best > s.current && <Txt muted size={14} style={{ marginTop: 10, fontWeight: '600' }}>{L.streakBest(s.best)}</Txt>}
    {s.jokers != null && <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}><SvgXml xml={SHIELD} width={24} height={24} /></View>
      <View style={{ flex: 1 }}><Txt bold size={16.8}>{L.jokersN(s.jokers)}</Txt><Txt muted size={14.4}>{s.nextJoker ? L.jokerNext(s.nextJoker) : L.jokerFull}</Txt></View></View>
      <Txt muted size={13.6} style={{ marginTop: 8, lineHeight: 18 }}>{L.jokerHow}</Txt></>}
  </View>;
}

// The first badges (earned first, then the closest ones); "See all" opens the full list.
function Rewards() {
  const { L } = useApp(), P = L.pts;
  return <View style={[card, { paddingVertical: 16, paddingHorizontal: 18 }]}>
    <Row style={{ marginBottom: 10 }}><Txt bold size={18.4}>{P.allTitle}</Txt><TextButton title={P.seeAll} onPress={() => router.push('/badges')} /></Row>
    <View style={{ flexDirection: 'row', gap: 6 }}>{badgeList().slice(0, 5).map(b => <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={P.names[b.id] || b.id} onPress={() => router.push('/badges')} style={{ flex: 1, alignItems: 'center', gap: 4, minWidth: 0 }}><Icon name={'badge-' + b.id} size={56} locked={!b.earned} /><Txt bold size={11.5} numberOfLines={2} style={{ textAlign: 'center', lineHeight: 13.5 }}>{P.names[b.id] || b.id}</Txt></Pressable>)}</View>
    {!points() && !earnedCount() && <Txt muted size={14.7} style={{ marginTop: 10 }}>{P.empty}</Txt>}
  </View>;
}

// One record: name, date and gain on the left, the record value on the right.
function RecordItem({ ex, record: { point: p, prev } }) {
  const { L } = useApp(), isNew = !!prev && p.d >= daysAgo(NEW_DAYS - 1);
  const when = fmtDay(parseYmd(p.d), p.d.slice(0, 4) === String(new Date().getFullYear()) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const moreReps = d => `↑ +${d} ${d === 1 ? L.repU : L.repsU}`;
  const gain = !prev ? '' : ex.type === 'time' ? `↑ +${fmtClock(p.t - prev.t)}` : ex.type === 'reps' || !(p.w > 0) ? moreReps(p.r - prev.r) : prev.u !== p.u ? '' : p.w > prev.w ? `↑ +${fmtNum(p.w - prev.w)} ${p.u}` : moreReps(p.r - prev.r);
  const big = text => <Txt bold size={27} style={{ lineHeight: 30 }}>{text}</Txt>, small = text => <Txt muted size={14.4} style={{ fontWeight: '700' }}>{text}</Txt>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isNew ? colors.yellowSoft : colors.card, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, boxShadow: `3px 4px 0 ${colors.ink}` }}>
    <View style={{ flex: 1, gap: 2 }}><Txt bold size={18.4} style={{ lineHeight: 21 }}>{exerciseName(ex)}</Txt><Txt muted size={14.4}>{when}{!!gain && <> · <Txt bold size={14.4} style={{ color: colors.tealInk }}>{gain}</Txt></>}</Txt>
      {isNew && <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: 99, backgroundColor: colors.orange }}><Txt bold size={13}>{L.newRecord}</Txt></View>}</View>
    <View style={{ maxWidth: '50%', alignItems: 'flex-end' }}>{ex.type === 'time' ? big(fmtClock(p.t)) : ex.type === 'reps' || !(p.w > 0) ? <Row style={{ gap: 4, alignItems: 'baseline' }}>{big(p.r)}{small(L.repsU)}</Row> : <><Row style={{ gap: 4, alignItems: 'baseline' }}>{big(fmtNum(p.w))}{small(p.u)}</Row>{small(`× ${p.r}`)}</>}</View>
  </View>;
}

// The full badge list (the website's "Your badges" sheet).
export function BadgesScreen() {
  const { L } = useApp(), P = L.pts, badges = badgeList(), [how,setHow] = useState(false);
  return <RouteSheet title={P.allTitle}><Txt muted style={{ marginTop: -16 }}>{P.earned(earnedCount(),badges.length)} · {P.points(points())}</Txt>
    <View style={{ gap: 12 }}>{badges.map(b => <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Icon name={'badge-'+b.id} size={72} locked={!b.earned} />
      <View style={{ flex: 1, gap: 2 }}><Txt bold size={17} style={{ color: b.earned ? colors.ink : colors.muted }}>{P.names[b.id] || b.id}</Txt><Txt muted size={14.4}>{(P.desc[b.counter] || (() => ''))(b.at)}</Txt>
        {b.earned ? <Txt muted size={13.6}>{P.earnedOn(fmtDay(new Date(b.earned)))}</Txt> : <><View style={{ height: 8, marginTop: 4, borderRadius: 99, backgroundColor: hairline, overflow: 'hidden' }}><View style={{ width: `${Math.round(b.progress * 100)}%`, height: '100%', backgroundColor: colors.orange }} /></View><Txt muted size={13.6}>{Math.min(b.count, b.at)}/{b.at}</Txt></>}</View></View>)}</View>
    <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline, paddingTop: 10 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: how }} onPress={() => setHow(!how)}><Txt bold>{how ? '▾' : '▸'} {P.howTitle}</Txt></Pressable>{how && <Txt muted style={{ marginTop: 8 }}>{P.how}</Txt>}</View>
  </RouteSheet>;
}
