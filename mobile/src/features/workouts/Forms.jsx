import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Check, Field, Row, Sheet, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import * as store from '@/core/state/store';
import { GROUPS, searchLibrary } from '@/core/services/library';
import { lastUsedUnit, weeklyGoal } from '@/core/state/selectors';
import { todayStr } from '@/core/utils/dates';
import { youTubeId } from '@/core/utils/youtube';
export function Confirm({ title, body, action, onClose }) { const { L } = useApp(); return <Sheet title={title} onClose={onClose}><Txt>{body}</Txt><Button title={L.yesDelete} onPress={() => { action(); onClose(); }} /><Button secondary title={L.cancel} onPress={onClose} /></Sheet>; }
export function RoutineForm({ routine, onClose }) {
  const { L } = useApp(), [name,setName] = useState(routine?.name || ''), [recurring,setRecurring] = useState(routine?.recurring ?? true);
  return <Sheet title={routine ? L.editRoutine : L.newRoutine} onClose={onClose}><Field label={L.routineName} value={name} onChangeText={setName} placeholder={L.routinePh} maxLength={100} /><Row><Check selected={recurring} onPress={() => setRecurring(!recurring)} label={L.repeatWeekly} /><View style={{ flex: 1 }}><Txt bold>{L.repeatWeekly}</Txt><Txt muted>{L.repeatWeeklyHint}</Txt></View></Row><Button title={routine ? L.save : L.create} disabled={!name.trim()} onPress={() => { if (routine) store.updateRoutine(routine.id,{ name: name.trim(),recurring }); else store.addRoutine({ name: name.trim(),recurring }); onClose(); }} /></Sheet>;
}
export function GoalForm({ onClose }) { const { L, state } = useApp(); const [goal,setGoal] = useState(weeklyGoal(state) || 3); return <Sheet title={L.goalTitle} onClose={onClose}><Txt>{L.goalSub}</Txt><Row>{[1,2,3,4,5,6,7].map(n => <Button key={n} small secondary selected={n === goal} title={String(n)} style={{ flex: 1, paddingHorizontal: 0 }} onPress={() => setGoal(n)} />)}</Row><Txt muted>{L.goalHint}</Txt><Button title={L.save} onPress={() => { store.setWeeklyGoal(goal); onClose(); }} /></Sheet>; }
export function ActivityForm({ activity, onClose }) {
  const { L } = useApp(); const [data,setData] = useState({ sport: activity?.activity.sport || '', minutes: String(activity?.activity.minutes || ''), date: activity?.date || todayStr(), note: activity?.activity.note || '' });
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date) && !Number.isNaN(Date.parse(data.date)) && new Date(data.date).toISOString().slice(0,10) === data.date;
  return <Sheet title={activity ? L.editActivity : L.freeActivity} onClose={onClose}>{[['sport',L.sport],['minutes',L.minutes],['date',L.date],['note',L.note]].map(([key,label]) => <Field key={key} label={label} number={key === 'minutes'} value={data[key]} onChangeText={value => setData({ ...data,[key]:value })} placeholder={key === 'date' ? 'YYYY-MM-DD' : ''} />)}<Button title={L.saveActivity} disabled={!data.sport.trim() || !(Number(data.minutes) > 0) || !validDate} onPress={() => { const value = { ...data, sport: data.sport.trim(), minutes: Number(data.minutes) }; if (activity) store.updateActivity(activity.id,value); else store.addActivity(value); onClose(); }} /></Sheet>;
}
function prefill(e,lang,unit) { return { name: lang === 'es' ? e.n : e.en, exerciseId: e.id, type: e.type, perSide: !!e.side, sets: e.type === 'time' && ['cardio','movilidad'].includes(e.g) ? 1 : 3, reps: 10, weight: 0, seconds: e.g === 'cardio' ? 1200 : e.g === 'movilidad' ? 600 : 30, unit }; }
export function ExercisePicker({ routineId, onClose }) {
  const { L,lang,state } = useApp(); const [query,setQuery] = useState(''), [group,setGroup] = useState(''), [picked,setPicked] = useState([]), [custom,setCustom] = useState(null);
  const results = searchLibrary(query,group);
  if (custom) return <ExerciseForm routineId={routineId} initial={custom} onClose={onClose} />;
  return <Sheet title={L.addExercise} onClose={onClose}><Field label={L.libSearchPh} value={query} onChangeText={setQuery} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{GROUPS.map(key => <Button key={key} small secondary selected={group === key} title={L.groups[key]} onPress={() => setGroup(group === key ? '' : key)} />)}</ScrollView>
    {results.map(e => <Button key={e.id} secondary selected={picked.some(p => p.id === e.id)} title={lang === 'es' ? e.n : e.en} onPress={() => setPicked(picked.some(p => p.id === e.id) ? picked.filter(p => p.id !== e.id) : [...picked,e])} />)}
    <Button secondary title={query ? L.libCustom(query) : L.libCustomEmpty} onPress={() => setCustom({ name: query })} />
    {picked.length === 1 && <Button secondary title={L.libTune} onPress={() => setCustom(prefill(picked[0],lang,lastUsedUnit(state)))} />}
    {!!picked.length && <Button title={L.libAddN(picked.length)} onPress={() => { store.addExercises(routineId,picked.map(e => prefill(e,lang,lastUsedUnit(state)))); onClose(); }} />}
  </Sheet>;
}
export function ExerciseForm({ routineId, exercise, initial, onClose }) {
  const { L,state } = useApp(); const [data,setData] = useState({ name: '', type:'weight_reps',perSide:false,sets:3,reps:10,weight:0,unit:lastUsedUnit(state),seconds:60,video:'', ...initial, ...exercise, ...exercise?.target }); const [error,setError] = useState('');
  const change = (key,value) => setData({ ...data,[key]:value });
  const save = () => { if (data.video && !youTubeId(data.video)) { setError(L.videoBad); return; } if (!data.name.trim()) { setError(L.nameRequired); return; } if (!(Number(data.sets) >= 1 && Number(data.sets) <= 50) || (data.type === 'time' ? !(Number(data.seconds) > 0) : !(Number(data.reps) > 0)) || Number(data.weight) < 0) { setError(L.timeRequired); return; } const value = { ...data, sets:Number(data.sets), reps:Number(data.reps), weight:Number(data.weight), seconds:Number(data.seconds) }; if (exercise) store.updateExercise(routineId,exercise.id,value); else store.addExercise(routineId,value); onClose(); };
  return <Sheet title={exercise ? L.editExercise : L.newExercise} onClose={onClose}><Field label={L.exName} value={data.name} onChangeText={value => change('name',value)} />
    {['weight_reps','reps','time'].map((type,i) => <Button key={type} secondary selected={data.type === type} title={[L.typeWeightReps,L.typeReps,L.typeTime][i]} onPress={() => change('type',type)} />)}
    {data.type !== 'time' && <Row><Txt>{L.perSide}</Txt><Check label={L.perSide} selected={data.perSide} onPress={() => change('perSide',!data.perSide)} /></Row>}
    {['sets', ...(data.type === 'time' ? ['seconds'] : ['reps', ...(data.type === 'weight_reps' ? ['weight'] : [])])].map(key => <Field key={key} number label={L[key]} value={data[key]} onChangeText={value => change(key,value.replace(',','.'))} />)}
    {data.type === 'weight_reps' && <Row>{['kg','lb'].map(unit => <Button key={unit} secondary selected={data.unit === unit} title={unit} style={{ flex: 1 }} onPress={() => change('unit',unit)} />)}</Row>}
    <Field label={L.videoLabel} value={data.video || ''} onChangeText={value => change('video',value)} autoCapitalize="none" /><Txt muted>{L.videoHint}</Txt>{!!error && <Txt>{error}</Txt>}<Button title={L.save} onPress={save} /></Sheet>;
}

