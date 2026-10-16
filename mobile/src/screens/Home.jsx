import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Bust, Button, Card, Icon, IconButton, Label, Page, Pill, Progress, Row, Sheet, TextButton, Title, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { colors } from '@/theme/tokens';
import * as selectors from '@/core/state/selectors';
import * as store from '@/core/state/store';
import { weekRecap, hasRecap, recapHidden, hideRecap } from '@/core/state/recap';
import { routineName } from '@/core/i18n';
import { nextMonday, parseYmd, ymd, todayStr } from '@/core/utils/dates';
import { fmtDay, fmtDuration } from '@/core/utils/format';
import * as fb from '@/core/services/firebase';
import { RoutineForm, ActivityForm, GoalForm, Confirm } from '@/features/workouts/Forms';
const danger = '#C8371F';

// Website views/home.js: greeting, last week's recap, this week, routine cards, other activities and the + button.
export default function Home() {
  const { L,state,session,run,notify } = useApp(); const [sheet,setSheet] = useState(null), [older,setOlder] = useState(false);
  const week = selectors.weekSummary(state), goal = selectors.weekGoalProgress(state), routines = selectors.orderedRoutines(state);
  const hasRoutines = selectors.routinesList(state).length > 0, hasActivities = selectors.activities(state).length > 0;
  const recap = weekRecap(), uid = session.user?.uid, showRecap = hasRecap(recap) && !recapHidden(recap.key, uid);
  const name = (state.profile?.displayName || session.user?.displayName || '').trim().split(/\s+/)[0];
  const close = () => setSheet(null);
  const delRoutine = r => setSheet({kind:'delete',title:L.confirmDelete(routineName(r)),body:L.confirmDeleteRoutine,action:()=>store.deleteRoutine(r.id)});
  const delActivity = a => setSheet({kind:'delete',title:L.confirmDelete(a.activity.sport),body:L.confirmDeleteAct,action:()=>store.deleteActivity(a.id)});
  return <Page tab="home" fab={{ label: L.add, onPress: () => setSheet({kind:'plus'}) }}>
    <Row style={{ justifyContent: 'flex-start', gap: 12 }}><Bust size={64} /><Txt bold size={17.5} style={{ flex: 1, color: colors.tealInk }}>{name ? L.hello(name) : L.helloAnon}</Txt></Row>
    {session.user && fb.needsEmailVerification(session.user) && <Card color="#FFE5AD"><Txt bold>{L.verifyTitle}</Txt><Txt>{L.verifyBody(session.user.email)}</Txt><Row style={{ justifyContent: 'flex-start', gap: 18 }}><TextButton title={L.verifyResend} color={colors.tealInk} onPress={() => run(fb.sendVerificationEmail).catch(() => {})} /><TextButton title={L.verifyDone} color={colors.tealInk} onPress={() => run(async () => { await fb.refreshUser(); notify(); }).catch(() => {})} /></Row></Card>}
    <View style={{ gap: 4 }}><Title>{L.yourRoutines}</Title><Txt muted>{L.weekOf(fmtDay(week.start),fmtDay(week.end))}</Txt></View>
    {showRecap && <RecapCard recap={recap} onHide={() => { hideRecap(recap.key, uid); notify(); }} />}
    {(hasRoutines || hasActivities) && <WeekCard week={week} goal={goal} streak={selectors.weeklyStreak(state)} onGoal={() => setSheet({ kind:'goal' })} />}
    {hasRoutines ? <View style={{ gap: 14, marginTop: 12 }}>{routines.map(r => <RoutineCard key={r.id} routine={r} onEdit={() => setSheet({kind:'routine',routine:r})} onDelete={() => delRoutine(r)} />)}</View>
      : <View style={{ borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center', backgroundColor: '#FFFFFF80' }}><Txt bold size={21.5} style={{ textAlign: 'center' }}>{L.emptyTitle}</Txt><Txt muted style={{ textAlign: 'center', maxWidth: 280 }}>{L.emptyBody}</Txt></View>}
    {hasActivities && <View style={{ gap: 14, marginTop: 12 }}><Txt bold size={21}>{L.otherActivities}</Txt>
      {week.weekActivities.length ? week.weekActivities.map(a => <ActivityItem key={a.id} session={a} onEdit={() => setSheet({kind:'activity',activity:a})} onDelete={() => delActivity(a)} />) : <Txt muted size={14.7}>{L.nothingThisWeek}</Txt>}
      {!!week.olderActivities.length && <TextButton title={older ? L.hideOlder : L.showOlder(week.olderActivities.length)} color={colors.tealInk} style={{ alignSelf: 'flex-start' }} onPress={() => setOlder(!older)} />}
      {older && week.olderActivities.map(a => <ActivityItem key={a.id} session={a} onEdit={() => setSheet({kind:'activity',activity:a})} onDelete={() => delActivity(a)} />)}</View>}
    {sheet?.kind === 'plus' && <Sheet title={L.whatToAdd} onClose={close}><Button title={L.newRoutine} onPress={() => setSheet({kind:'routine'})} /><Button secondary title={L.freeActivity} onPress={() => setSheet({kind:'activity'})} /></Sheet>}
    {sheet?.kind === 'routine' && <RoutineForm routine={sheet.routine} onClose={close} />}{sheet?.kind === 'activity' && <ActivityForm activity={sheet.activity} onClose={close} />}{sheet?.kind === 'goal' && <GoalForm onClose={close} />}{sheet?.kind === 'delete' && <Confirm {...sheet} onClose={close} />}
  </Page>;
}

function RecapCard({ recap: r, onHide }) {
  const { L } = useApp(), R = L.rc, head = r.status === 'met' ? R.headMet : r.status === 'saved' ? R.headSaved : R.headSome;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, paddingLeft: 14, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.yellowSoft, boxShadow: `3px 4px 0 ${colors.ink}` }}>
    <Bust size={56} />
    <View style={{ flex: 1, paddingRight: 22, gap: 1 }}><Txt bold size={12.5} style={{ color: colors.muted, textTransform: 'uppercase', letterSpacing: .6 }}>{R.cardTitle}</Txt><Txt bold size={17.3} style={{ lineHeight: 21 }}>{head}</Txt><Txt muted size={14}>{R.daysOf(r.days, r.goal)} {R.daysLabel}</Txt><Pill title={R.open} onPress={() => router.push('/recap')} style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 14 }} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel={R.hide} onPress={onHide} style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><Icon name="ui-close" size={18} color={colors.muted} /></Pressable>
  </View>;
}

// Trained days against the weekly goal, activities, Monday–Sunday strip and the streak line.
function WeekCard({ week, goal: g, streak, onGoal }) {
  const { L } = useApp(), n = week.weekActivities.length, today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(week.start); d.setDate(d.getDate() + i); return ymd(d); });
  const stat = (value, label) => <View><Txt bold size={35} style={{ lineHeight: 38 }}>{value}</Txt><Txt size={14.7} style={{ fontWeight: '600' }}>{label}</Txt></View>;
  return <View accessibilityLabel={L.thisWeek} style={{ backgroundColor: colors.yellow, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 24, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, boxShadow: `4px 5px 0 ${colors.ink}` }}>
    <Row><Label color={colors.ink}>{L.thisWeek}</Label><Pill title={g.goal ? L.goalChip(g.goal) : L.goalSet} onPress={onGoal} /></Row>
    <View style={{ flexDirection: 'row', gap: 28, marginTop: 6, marginBottom: 14 }}>{g.goal ? stat(`${g.days}/${g.goal}`, L.workoutsDone(g.goal)) : stat(`${week.doneCount}/${week.total}`, L.routinesDone)}{stat(n, L.activitiesN(n))}</View>
    {g.goal ? <View accessibilityRole="image" accessibilityLabel={L.daysTrainedLabel(days.filter(d => g.dates.has(d)).length)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{days.map((d, i) => { const on = g.dates.has(d); return <View key={d} style={{ flex: 1, alignItems: 'center', gap: 4 }}><View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: on ? colors.orange : colors.card, alignItems: 'center', justifyContent: 'center', boxShadow: d === today ? `0 0 0 3px ${colors.yellow}, 0 0 0 5px ${colors.ink}` : undefined }}>{on && <Icon name="ui-check" size={16} />}</View><Txt bold size={13.5}>{L.dayLetters[i]}</Txt></View>; })}</View>
      : <View style={{ height: 18 }}><Progress value={week.pct} max={100} /></View>}
    {g.goal && g.met && <Txt bold style={{ marginTop: 8 }}>{L.goalMet}</Txt>}
    {!!streak.current && <Pressable accessibilityRole="button" onPress={() => router.replace('/progress')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}><Icon name="ui-flame" size={24} /><Txt size={15} style={{ flex: 1 }}><Txt bold size={15}>{L.streakWeeks(streak.current)}</Txt>{streak.thisWeek ? '' : ` · ${g.goal ? L.streakLeft(g.left) : L.streakKeepIt}`}</Txt></Pressable>}
  </View>;
}

function RoutineCard({ routine: r, onEdit, onDelete }) {
  const { L } = useApp(), p = selectors.routineProgress(r), done = selectors.isRoutineDone(r), name = routineName(r);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12, backgroundColor: done ? '#E3F7F3' : colors.card, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 22, boxShadow: done ? undefined : `3px 4px 0 ${colors.ink}` }}>
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={() => router.push({ pathname:'/routine/[id]',params:{id:r.id} })} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingLeft: 18, paddingRight: 4 }, pressed && { transform: [{ scale: .98 }] }]}>
      <View style={{ flex: 1 }}><Txt bold size={21.5} style={{ lineHeight: 25 }}>{name}</Txt><Txt muted size={14.7}>{L.exercisesN(p.total)} · {r.recurring ? L.weekly : L.once}</Txt>
        {done ? <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: 99, backgroundColor: colors.teal }}><Txt bold size={13}>{L.done}{r.recurring ? ' · ' + L.resetsOn(fmtDay(nextMonday(), { weekday: 'short' })) : ''}</Txt></View>
          : !!p.total && <View style={{ marginTop: 10 }}><Progress mini value={p.done} max={p.total} /></View>}</View>
      <View style={{ minWidth: 56, height: 56, paddingHorizontal: 6, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: done ? colors.teal : colors.background, alignItems: 'center', justifyContent: 'center' }}>{done ? <Icon name="ui-check" size={26} /> : <Txt bold size={17}>{p.done}/{p.total}</Txt>}</View>
    </Pressable>
    <View style={{ gap: 8 }}><IconButton icon="ui-pen" label={`${L.edit}: ${name}`} onPress={onEdit} /><IconButton icon="ui-bin" color={danger} label={`${L.del}: ${name}`} onPress={onDelete} /></View>
  </View>;
}

// s = an activity session: { id, date, activity: { sport, minutes, note } }
function ActivityItem({ session: s, onEdit, onDelete }) {
  const { L } = useApp(), a = s.activity;
  const when = s.date === todayStr() ? L.today : fmtDay(parseYmd(s.date), { weekday: 'short', day: 'numeric', month: 'short' });
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, paddingVertical: 14, paddingLeft: 16, paddingRight: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={a.sport} onPress={onEdit} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}><Txt bold size={21} style={{ textTransform: 'uppercase' }}>{a.sport.trim()[0] || '·'}</Txt></View>
      <View style={{ flex: 1 }}><Txt bold size={18} style={{ lineHeight: 21 }}>{a.sport}</Txt><Txt muted size={14.4}>{fmtDuration(a.minutes)} · {when}</Txt>{!!a.note && <Txt size={14.4}>{a.note}</Txt>}</View>
    </Pressable>
    <Row style={{ gap: 8 }}><IconButton icon="ui-pen" label={`${L.edit}: ${a.sport}`} onPress={onEdit} /><IconButton icon="ui-bin" color={danger} label={`${L.del}: ${a.sport}`} onPress={onDelete} /></Row>
  </View>;
}
