import React, { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bust, Button, Icon, IconButton, Page, Pill, Progress, Row, Sheet, TextButton, Title, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import * as store from '@/core/state/store';
import * as select from '@/core/state/selectors';
import { getLang, routineName } from '@/core/i18n';
import { exerciseName, libraryExercise, techniqueVideo } from '@/core/services/library';
import TechniquePlayer from '@/components/TechniquePlayer';
import { embedUrl, watchUrl, searchUrl } from '@/core/utils/youtube';
import { nextMonday, pad2, todayStr } from '@/core/utils/dates';
import { fmtClock, fmtDay, fmtNum } from '@/core/utils/format';
import { RoutineForm, ExercisePicker, ExerciseForm, Confirm } from '@/features/workouts/Forms';
import { colors, fonts } from '@/theme/tokens';
import { Celebration } from '@/components/celebrate';
import { toast } from '@/components/toast-bus';
import { feel } from '@/services/feel';
const danger = '#C8371F';

// Website views/routine.js: progress, title, exercises (finished ones last); an open exercise shows one row per set.
export default function Routine() {
  const { id } = useLocalSearchParams(); const { L, state } = useApp(); const [open,setOpen] = useState(null), [sheet,setSheet] = useState(null), [celebrate,setCelebrate] = useState(false);
  const routine = store.findRoutine(id), close = () => setSheet(null);
  if (!routine) return <Page back><Title>{L.emptyRoutineTitle}</Title></Page>;
  const count = select.routineProgress(routine), ordered = select.orderedExercises(routine), isDone = select.isRoutineDone(routine);
  // As the website: a set checked → tick, an exercise finished → chime (and "New record!" when it beat the best),
  // the whole routine → celebration and back home.
  const change = (action, exId) => {
    const item = () => select.orderedExercises(routine), stateOf = () => { const all = [...item().pending, ...item().done]; return { sets: all.reduce((n, i) => n + select.setsToShow(i).filter(x => x.done).length, 0), done: all.find(i => i.ex.id === exId)?.done }; };
    const wasComplete = select.isRoutineDone(routine), before = stateOf(), ex = routine.exercises.find(e => e.id === exId), recordBefore = ex && select.personalRecord(store.getState(), ex);
    action();
    const after = stateOf(), justDone = after.done && !before.done;
    if (!wasComplete && select.isRoutineDone(routine)) { feel('complete'); setCelebrate(true); }
    else if (justDone) feel('done');
    else if (after.sets > before.sets) feel('check');
    else feel('tap');
    if (justDone && ex) {
      const best = select.personalRecord(store.getState(), ex);
      if (select.beatsRecord(ex, best, recordBefore) && best.point.d === todayStr()) { toast({ icon: 'ui-trophy', title: L.newRecordToast, body: exerciseName(ex) }); setTimeout(() => feel('points'), 250); }
    }
  };
  const name = routineName(routine);
  return <Page header={false}>
    <Row style={{ gap: 16 }}><Button secondary small title="‹" label={L.back} onPress={() => router.replace('/')} /><Progress value={count.done} max={count.total} /><Txt bold size={17.6}>{pad2(count.done)}/{pad2(count.total)}</Txt></Row>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
      <View style={{ alignSelf: 'center', marginLeft: -4 }}><Bust size={56} /></View>
      <View style={{ flex: 1 }}><Title>{name}</Title><Txt muted>{L.exercisesN(count.total)} · {routine.recurring ? L.weekly : L.once}</Txt></View>
      <Row style={{ gap: 8, marginTop: 6 }}><IconButton icon="ui-pen" label={`${L.edit}: ${name}`} onPress={() => setSheet({kind:'routine'})} /><IconButton icon="ui-bin" color={danger} label={`${L.del}: ${name}`} onPress={() => setSheet({kind:'delete-routine'})} /></Row>
    </View>
    {isDone && <View style={{ gap: 8 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.teal }}><Icon name="ui-star" size={26} /><Txt style={{ flex: 1, minWidth: 160, fontWeight: '600' }}>{routine.recurring ? L.doneThisWeek(fmtDay(nextMonday(), { weekday: 'long', day: 'numeric', month: 'short' })) : L.doneOnce}</Txt><Pill title={L.repeatRoutine} onPress={() => { store.repeatRoutine(id); setOpen(null); }} style={{ paddingVertical: 6, paddingHorizontal: 14 }} /></View><Txt muted size={14.7} style={{ marginHorizontal: 4 }}>{L.repeatHint}</Txt></View>}
    {count.total ? <View style={{ gap: 14, marginTop: 4 }}>{[...ordered.pending,...ordered.done].map(item => <ExerciseCard key={item.ex.id} state={state} routine={routine} item={item} open={open === item.ex.id} onToggleOpen={() => setOpen(open === item.ex.id ? null : item.ex.id)} change={change} setSheet={setSheet} />)}</View>
      : <View style={{ marginTop: 4, borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center', backgroundColor: '#FFFFFF80' }}><Txt bold size={21.5} style={{ textAlign: 'center' }}>{L.emptyRoutineTitle}</Txt><Txt muted style={{ textAlign: 'center', maxWidth: 280 }}>{L.emptyRoutineBody}</Txt></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={L.addExercise} onPress={() => setSheet({kind:'picker'})} style={({ pressed }) => [{ minHeight: 58, borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && { opacity: .7 }]}><Icon name="ui-plus" size={20} /><Txt bold size={17.6}>{L.addExercise}</Txt></Pressable>
    {!!count.done && <TextButton title={L.resetProgress} color={colors.tealInk} style={{ alignSelf: 'center' }} onPress={() => store.resetRoutine(id)} />}
    {sheet?.kind === 'video' && <Sheet title={exerciseName(sheet.exercise)} onClose={close}><TechniquePlayer uri={embedUrl(sheet.video.id)} title={exerciseName(sheet.exercise)} tall={sheet.video.short} /><Txt muted>{L.videoNote}</Txt><Button secondary title={L.openInYouTube} onPress={() => Linking.openURL(watchUrl(sheet.video.id,sheet.video.short))} /><Button secondary title={L.videoChange} onPress={() => setSheet({kind:'exercise',exercise:sheet.exercise})} /></Sheet>}
    {sheet?.kind === 'routine' && <RoutineForm routine={routine} onClose={close} />}{sheet?.kind === 'picker' && <ExercisePicker routineId={id} onClose={close} />}{sheet?.kind === 'exercise' && <ExerciseForm routineId={id} exercise={sheet.exercise} onClose={close} />}{sheet?.kind === 'delete-ex' && <Confirm title={L.confirmDelete(exerciseName(sheet.exercise))} body={L.confirmDeleteEx} action={() => store.deleteExercise(id,sheet.exercise.id)} onClose={close} />}{sheet?.kind === 'delete-routine' && <Confirm title={L.confirmDelete(name)} body={L.confirmDeleteRoutine} action={() => {store.deleteRoutine(id);router.replace('/');}} onClose={close} />}
    {celebrate && <Celebration recurring={routine.recurring} onDone={() => { setCelebrate(false); router.replace('/'); }} />}
  </Page>;
}

// item = { ex: routine exercise, logged: this session's entry or null, done: every set checked }
function ExerciseCard({ state, routine, item, open, onToggleOpen, change, setSheet }) {
  const { L } = useApp(), { ex, logged, done } = item, id = routine.id, name = exerciseName(ex);
  const sets = select.setsToShow(item), nDone = sets.filter(x => x.done).length, partial = !done && nDone > 0;
  const checkLabel = done ? L.markUndone : partial ? L.setsDoneOf(nDone, sets.length) + '. ' + L.markDone : L.markDone;
  const { diff, kind } = select.planChange(state, ex);
  return <View style={{ backgroundColor: done && !open ? 'transparent' : colors.card, opacity: done && !open ? .6 : 1, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, boxShadow: done ? undefined : `3px 4px 0 ${colors.ink}` }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${checkLabel}: ${name}`} onPress={() => change(() => store.toggleExercise(id, ex.id), ex.id)} style={({ pressed }) => [{ width: 36, height: 36, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 11, backgroundColor: done ? colors.teal : partial ? colors.yellow : colors.card, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: .9 }] }]}>{partial ? <Txt bold size={12.5} style={{ lineHeight: 14 }}>{nDone}/{sets.length}</Txt> : done && <Icon name="ui-check" size={22} />}</Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggleOpen} style={{ flex: 1, paddingVertical: 2 }}>
        <Txt bold size={19.2} style={{ lineHeight: 22, textDecorationLine: done ? 'line-through' : 'none' }}>{name}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 4 }}><SetsSummary sets={done ? logged.sets : select.setsToShow({ ex, logged: null })} type={ex.type} />{!!diff && <Txt bold size={14.9} style={{ color: diff < 0 ? colors.muted : colors.tealInk }}>{diff > 0 ? '↑ +' : '↓ −'}{kind === 'time' ? fmtClock(Math.abs(diff)) : `${fmtNum(Math.abs(diff))} ${kind === 'reps' ? L.repsU : ex.target.unit}`}</Txt>}</View>
      </Pressable>
      <Row style={{ gap: 8, marginLeft: 2 }}><IconButton icon="ui-pen" label={`${L.edit}: ${name}`} onPress={() => setSheet({kind:'exercise',exercise:ex})} /><IconButton icon="ui-bin" color={danger} label={`${L.del}: ${name}`} onPress={() => setSheet({kind:'delete-ex',exercise:ex})} /></Row>
    </View>
    {open && <SetsPanel state={state} routine={routine} ex={ex} sets={sets} change={change} setSheet={setSheet} />}
  </View>;
}

// One set as short text: "10×60", "12", "1:30", "10/8×12", "↓8×47,5".
function setText(x, type) {
  const drop = x.kind === 'drop' ? '↓' : '';
  if (type === 'time') return drop + fmtClock(x.seconds);
  const reps = x.repsR == null ? String(x.reps) : `${x.reps}/${x.repsR}`;
  if (type === 'reps') return drop + reps;
  return `${drop}${reps}×${x.weight > 0 ? fmtNum(x.weight) : '–'}`;
}
const setsUnit = (L, sets, type) => (type === 'time' ? '' : type === 'reps' ? ` ${L.repsU}` : ` ${sets[0].unit}`);

// "3 sets · 10 reps · 60 kg" when every set is the same, otherwise "10×60 · 10×62,5 · 8×62,5 kg".
function SetsSummary({ sets, type }) {
  const { L } = useApp();
  if (!sets.length) return null;
  const a = sets[0], part = (b, rest = '') => <Txt key={b + rest} muted size={14.9}><Txt bold size={14.9}>{b}</Txt>{rest && ` ${rest}`}</Txt>;
  const same = sets.every(x => x.kind === 'normal' && x.reps === a.reps && x.repsR === a.repsR && x.weight === a.weight && x.unit === a.unit && x.seconds === a.seconds);
  if (!same) return <Txt muted size={14.9}>{sets.map((x, i) => <React.Fragment key={i}>{i > 0 && ' · '}<Txt bold size={14.9}>{setText(x, type)}</Txt></React.Fragment>)}{setsUnit(L, sets, type)}</Txt>;
  const n = part(sets.length, L.setsU(sets.length));
  if (type === 'time') return <>{n}{part(fmtClock(a.seconds))}</>;
  const reps = a.repsR == null ? part(a.reps, L.repsU) : a.repsR === a.reps ? part(a.reps, `${L.repsU} ${L.eachSide}`) : part(`${a.reps}/${a.repsR}`, L.repsU);
  if (type === 'reps') return <>{n}{reps}</>;
  return <>{n}{reps}{a.weight > 0 && part(fmtNum(a.weight), a.unit)}</>;
}

// The open exercise: technique link, last time, then one row per set (drops under their set) and add buttons.
function SetsPanel({ state, routine, ex, sets, change, setSheet }) {
  const { L } = useApp(), id = routine.id, { type, perSide } = ex, last = select.lastTime(state, routine, ex.id);
  const normals = sets.filter(x => x.kind !== 'drop').length, unit = sets[0] ? sets[0].unit : ex.target.unit, video = techniqueVideo(ex);
  const lib = libraryExercise(ex.exerciseId), en = getLang() === 'en';
  const openTechnique = () => video ? setSheet({kind:'video',exercise:ex,video}) : Linking.openURL(searchUrl(`${en && lib ? lib.en : exerciseName(ex)} ${en ? 'proper form' : 'técnica'}`));
  // Column widths follow the website's grid templates for each layout.
  const cols = type === 'time' || (!perSide && type === 'weight_reps') ? [22, 1, 12, 1.25, 22] : perSide ? (type === 'reps' ? [22, 80, 80, 1] : [22, 1, 1, 1.3]) : [22, 90, 1];
  const cell = (i, child) => <View key={i} style={cols[i] <= 2 ? { flex: cols[i], minWidth: 0 } : { width: cols[i] }}>{child}</View>;
  const fill = list => Array.from({ length: cols.length - 1 }, (_, i) => list[i] ?? null);   // empty cells keep the columns aligned
  const head = type === 'time' ? [L.minShort, '', L.secShort, ''] : perSide ? [L.leftShort, L.rightShort, ...(type === 'weight_reps' ? [unit] : [])] : type === 'reps' ? [L.repsU] : [L.repsU, '', L.weight, ''];
  const canDrop = type === 'weight_reps' && sets.length < 50;
  let n = 0;
  return <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(43,27,18,.2)' }}>
    <Row style={{ marginBottom: 10 }}><Pressable accessibilityRole="button" onPress={openTechnique} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 99, backgroundColor: colors.card }}><Txt bold size={14.4} style={{ color: danger }}>▶</Txt><Txt bold size={14.4}>{L.watchTechnique}</Txt></Pressable><TextButton title={ex.video ? L.videoChange : L.videoAdd} color={colors.tealInk} style={{ paddingVertical: 4 }} onPress={() => setSheet({kind:'exercise',exercise:ex})} /></Row>
    {!!last && <Txt muted size={14} style={{ marginBottom: 10 }}><Txt bold size={14}>{L.lastTime}</Txt> ({fmtDay(new Date(last.date + 'T12:00:00'))}): {last.sets ? last.sets.map(x => setText(x, type)).join(' · ') + setsUnit(L, last.sets, type) : last.point.t != null ? `${last.point.s}× ${fmtClock(last.point.t)}` : `${last.point.s}×${last.point.r}${last.point.w > 0 ? ` · ${fmtNum(last.point.w)} ${last.point.u}` : ''}`}</Txt>}
    <View style={[s.setRow, { paddingBottom: 4 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{cell(0, <Txt bold size={12} muted style={s.head}>#</Txt>)}{fill(head).map((h, i) => cell(i + 1, <Txt bold size={12} muted style={[s.head, { textAlign: perSide || i % 2 === 0 ? 'center' : 'left' }]}>{h}</Txt>))}<View style={{ width: 42 }} /><View style={{ width: 30 }} /></View>
    <View style={{ gap: 8 }}>{sets.map((x, i) => {
      const drop = x.kind === 'drop'; if (!drop) n++;
      const label = drop ? L.dropOf(n) : L.setN(n), right = x.repsR == null ? x.reps : x.repsR;
      const save = patch => store.updateSet(id, ex.id, i, patch), input = (field, value, a11y, k) => <SetInput key={k} drop={drop} done={x.done} label={`${label}: ${a11y}`} value={value} onChange={v => save(field === 'min' ? { seconds: v * 60 + x.seconds % 60 } : field === 'sec' ? { seconds: Math.floor(x.seconds / 60) * 60 + v } : { [field]: v })} />;
      const mark = text => <Txt muted size={14.4} style={{ textAlign: 'center', fontWeight: '600' }}>{text}</Txt>;
      const boxes = type === 'time' ? [input('min', Math.floor(x.seconds / 60), L.minutes), mark(':'), input('sec', x.seconds % 60, L.seconds), null]
        : perSide ? [input('reps', x.reps, `${L.repsU} ${L.left}`), input('repsR', right, `${L.repsU} ${L.right}`), ...(type === 'weight_reps' ? [input('weight', x.weight, `${L.weight} (${x.unit})`)] : [])]
        : type === 'reps' ? [input('reps', x.reps, L.repsU), <Txt key="u" muted size={14.4} style={{ fontWeight: '600' }}>{L.repsU}</Txt>]
        : [input('reps', x.reps, L.repsU), mark('×'), input('weight', x.weight, `${L.weight} (${x.unit})`), mark(x.unit)];
      const canDelete = drop || normals > 1;
      return <View key={i} style={s.setRow}>
        {cell(0, <Txt bold muted={!drop} size={drop ? 17.6 : 16} style={{ textAlign: 'center', color: drop ? colors.orange : colors.muted }}>{drop ? '↓' : n}</Txt>)}
        {fill(boxes).map((b, j) => cell(j + 1, b))}
        <View style={{ width: 42, alignItems: 'center' }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }} accessibilityLabel={`${label}: ${x.done ? L.markUndone : L.markDone}`} onPress={() => change(() => store.toggleSet(id, ex.id, i), ex.id)} style={({ pressed }) => [{ width: drop ? 38 : 42, height: drop ? 38 : 42, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 12, backgroundColor: x.done ? colors.teal : colors.card, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: .9 }] }]}><View style={{ opacity: x.done ? 1 : .15 }}><Icon name="ui-check" size={22} /></View></Pressable></View>
        <View style={{ width: 30, alignItems: 'center' }}>{canDelete && <Pressable accessibilityRole="button" accessibilityLabel={`${L.removeSet}: ${label}`} onPress={() => store.removeSet(id, ex.id, i)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><Txt muted size={21}>×</Txt></Pressable>}</View>
      </View>;
    })}</View>
    {sets.length < 50 && <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={L.addSet} onPress={() => store.addSet(id, ex.id)} style={s.addSet}><Icon name="ui-plus" size={16} /><Txt bold>{canDrop ? L.addSetShort : L.addSet}</Txt></Pressable>
      {canDrop && <Pressable accessibilityRole="button" accessibilityLabel={L.addDropLong} onPress={() => store.addDrop(id, ex.id)} style={s.addSet}><Txt bold size={17.6} style={{ color: colors.orange }}>↓</Txt><Txt bold>{L.addDrop}</Txt></Pressable>}
    </View>}
  </View>;
}

// A box in a set row; numbers show a decimal comma in Spanish and both are accepted when typing.
function SetInput({ value, label, onChange, drop, done }) {
  const [draft,setDraft] = useState(null), shown = getLang() === 'es' ? String(value).replace('.', ',') : String(value);
  return <TextInput accessibilityLabel={label} keyboardType="decimal-pad" selectTextOnFocus value={draft ?? shown} onFocus={() => setDraft(shown)} onChangeText={text => { setDraft(text); const v = Number(text.replace(',','.')); if (text.trim() && Number.isFinite(v) && v >= 0) onChange(v); }} onBlur={() => setDraft(null)}
    style={{ width: '100%', minWidth: 0, height: drop ? 40 : 44, borderWidth: 2, borderStyle: drop ? 'dashed' : 'solid', borderColor: done ? 'rgba(43,27,18,.35)' : colors.ink, borderRadius: 12, backgroundColor: done ? 'transparent' : colors.background, textAlign: 'center', fontFamily: fonts.heading, fontSize: drop ? 16.8 : 18.4, paddingHorizontal: 4, paddingVertical: 0, color: colors.ink }} />;
}

const s = {
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  head: { textTransform: 'uppercase', letterSpacing: .5 },
  addSet: { flex: 1, minHeight: 44, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
};
