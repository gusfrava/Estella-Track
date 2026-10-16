import React, { useEffect } from 'react';
import { confetti } from '@/components/celebrate';
import { feel } from '@/services/feel';
import { Pressable, View } from 'react-native';
import { Bust, Button, Diego, Field, Icon, Motion, Option, Page, Progress, Row, TextButton, Title, Txt, s as ui } from '@/components/native-ui';
import { colors } from '@/theme/tokens';
import { useApp } from '@/providers/AppProvider';
import * as ob from '@/core/controllers/onboarding';
import StarterPlan from '@/components/StarterPlan';
const goalScenes = { strength: 'strength', muscle: 'muscle', fat: 'model', athletic: 'soccer', health: 'yoga' };
const focusScenes = { balanced: 'stretch', legs: 'legs', upper: 'bench', arms: 'curls' };
const expScenes = { never: 'clumsy', beginner: 'trainer', intermediate: 'hack', advanced: 'onearm' };
const iconPrefix = { goal: 'goal', focus: 'focus', experience: 'exp', place: 'place' };
// Confetti once the starter plan appears, as the website does when the last screen shows the plan.
function PlanConfetti() { useEffect(() => { confetti(); feel('complete'); }, []); return null; }
// Website .ob-char: one card per companion; the chosen one plays its cheer, the other holds a still pose.
// After onboarding is completed the choice is locked and only the chosen card stays enabled.
function CharacterCard({ character, selected, disabled }) {
  const name = character === 'diego' ? 'Diego' : 'Estella';
  return <Pressable disabled={disabled} onPress={() => { feel('select'); ob.choose('character', character); }} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected, disabled }} aria-selected={selected} aria-disabled={disabled}
    style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 8, paddingBottom: 14, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 22, backgroundColor: selected ? colors.yellow : colors.card, boxShadow: `3px 4px 0 ${colors.ink}` }, pressed && !disabled && { transform: [{ scale: .95 }] }]}>
    <View style={{ width: '100%', height: 196, justifyContent: 'flex-end' }}><Motion card still={!selected} scene="cheer" character={character} size={190} /></View>
    <Txt bold size={18.4}>{name}</Txt>
    <View style={[ui.tick, { position: 'absolute', top: 10, right: 10 }, selected && { backgroundColor: colors.teal }]}>{selected && <Icon name="ui-check" size={16} />}</View>
  </Pressable>;
}
export default function Onboarding() {
  const { L, notify } = useApp(), O = L.ob, ui = ob.getOnboardingUI(), step = ob.STEPS[ui.step], a = ui.answers;
  const bottom = ['place','days','minutes'].includes(step);
  const scene = step === 'welcome' ? 'welcome' : step === 'character' ? 'cheer' : step === 'goal' ? goalScenes[a.goal] || 'stretch' : step === 'focus' ? focusScenes[a.focus] : step === 'experience' ? expScenes[a.experience] || 'stretch' : ({ place: 'thinking', days: 'dogwalk', minutes: 'calendar' })[step];
  const title = ({ welcome: a.character === 'diego' ? O.welcomeTitle.replace('Estella', 'Diego') : O.welcomeTitle, character: O.charTitle, goal: O.goalTitle, focus: O.focusTitle, experience: O.expTitle, place: O.placeTitle, days: O.daysTitle, minutes: O.minTitle, body: O.bodyTitle, source: O.srcTitle, done: O.planTitle })[step];
  const sub = ({ welcome: O.welcomeBody, character: O.charSub, focus: O.focusSub, place: O.placeSub, days: O.daysSub, body: O.bodySub, source: O.srcSub })[step];
  const table = ({ goal: O.goals, focus: O.focuses, experience: O.exps, place: O.places })[step];
  const footer = step === 'welcome' ? <><Button title={O.start} onPress={ob.next} /><TextButton title={O.skipAll} onPress={ob.skipAll} /></>
    : step === 'done' ? <>{Array.isArray(ui.plan) && <Button title={O.planSave} onPress={ob.savePlan} />}<TextButton title={O.planSkip} onPress={ob.finish} /></>
    : <Button title={O.next} disabled={!ob.canContinue()} onPress={ob.next} />;
  return <Page header={false} key={step} footer={footer}>{ui.step > 0 && step !== 'done' && <Row><Button small secondary title="‹" label={O.back} onPress={ob.back} /><Progress value={Math.min(9,ui.step)} max={9} /><View style={{ minWidth: 56, alignItems: 'flex-end' }}>{ob.OPTIONAL.has(step) && <TextButton title={O.skip} color={colors.tealInk} onPress={ob.skipStep} />}</View></Row>}
    {step === 'welcome' ? <View style={{ alignItems: 'center', gap: 6 }}><Motion scene="welcome" character={a.character} size={300} /><Txt bold size={34} style={{ textAlign: 'center' }}>{title}</Txt><Txt muted style={{ textAlign: 'center', maxWidth: 320 }}>{sub}</Txt></View>
      : step === 'done' ? null : <><Title>{title}</Title>{!!sub && <Txt muted>{sub}</Txt>}</>}
    {!!scene && !bottom && !['welcome','character'].includes(step) && <Motion scene={scene} character={a.character} size={145} />}
    {step === 'character' && <Row style={{ gap: 12, alignItems: 'stretch' }}>{ob.CHOICES.character.map(key => <CharacterCard key={key} character={key} selected={a.character === key} disabled={!ob.AVAILABLE_CHARACTERS.has(key) || (ob.isCharacterLocked() && a.character !== key)} />)}</Row>}
    {table && <View style={{ gap: 10 }}>{ob.CHOICES[step].map(key => <Option key={key} icon={`ob-${iconPrefix[step]}_${key}`} title={table[key][0]} desc={table[key][1]} selected={a[step] === key} onPress={() => ob.choose(step,key)} />)}</View>}
    {step === 'days' && <><Row>{[1,2,3,4,5,6,7].map(n => <Button key={n} small secondary selected={a.daysPerWeek === n} title={String(n)} style={{ flex: 1, paddingHorizontal: 0 }} onPress={() => ob.choose('daysPerWeek',n)} />)}</Row>{!!a.daysPerWeek && <Txt bold>{O.daysN(a.daysPerWeek)}</Txt>}</>}
    {step === 'minutes' && <View style={{ gap: 10 }}>{ob.CHOICES.minutes.map(n => <Option key={n} icon="ob-clock" title={`${n} min`} desc={O.mins[n]} selected={a.minutes === n} onPress={() => ob.choose('minutes',n)} />)}</View>}
    {step === 'body' && <><Row>{['kg','lb'].map(unit => <Button key={unit} secondary selected={ui.body.unit === unit} title={unit} style={{ flex: 1 }} onPress={() => ob.setBodyField('unit',unit)} />)}</Row>{['weight', ...(ui.body.unit === 'kg' ? ['height'] : ['ft','inch'])].map(key => <Field key={key} label={O[key === 'ft' ? 'feet' : key === 'inch' ? 'inches' : key] || key} number value={ui.body[key]} onChangeText={value => { ob.setBodyField(key,value); notify(); }} />)}<Txt muted>{O.bodyPrivate}</Txt></>}
    {step === 'source' && <View style={{ gap: 10 }}>{ob.CHOICES.source.map(key => <Option key={key} compact icon={`ob-src_${key}`} title={O.srcs[key]} selected={a.source === key} onPress={() => ob.choose('source',key)} />)}</View>}
    {bottom && <Motion scene={scene} character={a.character} bottom size={step === 'days' ? 240 : 170} />}
    {!!ui.error && <Txt>{O[ui.error]}</Txt>}
    {step === 'done' && Array.isArray(ui.plan) && <PlanConfetti />}
    {step === 'done' && (Array.isArray(ui.plan) ? <StarterPlan ui={ui} labels={O} /> : <View style={{ alignItems: 'center', gap: 6, paddingTop: 60 }}>{a.character === 'diego' ? <Diego scene="welcome" size={200} /> : <Bust size={160} />}<Txt bold size={30} style={{ textAlign: 'center' }}>{ui.plan === 'failed' ? L.loadFailed : O.planLoading}</Txt></View>)}
  </Page>;
}
