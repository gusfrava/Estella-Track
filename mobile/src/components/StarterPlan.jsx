import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bust, Icon, Row, Title, Txt } from './native-ui';
import { routineName } from '@/core/i18n';
import { exerciseName } from '@/core/services/library';
import { fmtClock } from '@/core/utils/format';
import { colors as c } from '@/theme/tokens';
const hairline = '#EEDFCB';

// Website views/onboarding.js planScreen: head, why line, one card per routine (tap to see its exercises),
// sets per week by muscle, the fat-goal note and "How we built your plan".
export default function StarterPlan({ ui, labels: O }) {
  const [open, setOpen] = useState(0), [more, setMore] = useState(false);
  const a = ui.answers, info = ui.planInfo || {}, W = O.why, plan = ui.plan.filter(r => r.exercises.length);
  const time = s => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : fmtClock(s));
  const dose = e => (e.type === 'time' ? (e.sets > 1 ? `${e.sets} × ${time(e.seconds)}` : time(e.seconds)) : `${e.sets} × ${e.reps}${e.perSide ? ` ${O.planPerSide}` : ''}`);
  const reasons = [W.split[info.split || 'full'](a.daysPerWeek), W.goal[a.goal], W.level[info.level || 'std'], W.volume,
    a.focus && a.focus !== 'balanced' ? W.focus(O.focuses[a.focus][0], info.focusExtra || 0) : '', info.light ? W.light : '', W.progress, W.weights].filter(Boolean);
  const groups = Object.keys(info.volume || {}), max = Math.max(1, ...groups.map(g => info.volume[g]));
  const chevron = up => <View style={{ transform: [{ rotate: up ? '90deg' : '-90deg' }] }}><Icon name="ui-back" size={22} color={up === null ? c.tealInk : undefined} /></View>;
  return <View style={{ gap: 14 }}>
    <Row style={{ justifyContent: 'flex-start', gap: 14 }}><Bust size={88} character={a.character} /><View style={{ flex: 1, gap: 4 }}><Title>{O.planTitle}</Title><Txt muted>{O.planSub(plan.length, a.daysPerWeek, a.minutes)}</Txt></View></Row>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: c.ink, backgroundColor: c.yellowSoft }}>
      <Icon name={`ob-focus_${a.focus || 'balanced'}`} size={22} color={c.tealInk} /><Txt size={15.2} style={{ flex: 1, lineHeight: 21 }}>{O.planWhy(a.focus || 'balanced', info.focusExtra || 0)}</Txt>
    </View>
    <View style={{ gap: 10 }}>{plan.map((r, i) => { const isOpen = open === i; return <View key={r.key || i} style={{ borderWidth: 2.5, borderColor: c.ink, borderRadius: 20, backgroundColor: c.card, boxShadow: `3px 4px 0 ${c.ink}`, overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: c.ink, backgroundColor: c.yellow, alignItems: 'center', justifyContent: 'center' }}><Txt bold style={{ lineHeight: 20 }}>{i + 1}</Txt></View>
        <View style={{ flex: 1 }}><Txt bold size={17.3} style={{ lineHeight: 21 }}>{routineName(r)}</Txt><Txt muted size={14.4}>{O.planCount(r.exercises.length)}</Txt></View>
        {chevron(isOpen)}
      </Pressable>
      {isOpen && <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2, borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline }}>{r.exercises.map((e, k) => <Row key={k} style={{ alignItems: 'baseline', gap: 12, paddingVertical: 8, borderBottomWidth: k < r.exercises.length - 1 ? 1 : 0, borderColor: hairline }}><Txt size={15.2} style={{ flex: 1 }}>{exerciseName(e)}</Txt><Txt bold size={15.2} style={{ color: c.tealInk }}>{dose(e)}</Txt></Row>)}</View>}
    </View>; })}</View>
    {!!groups.length && <View accessibilityLabel={O.volTitle} style={{ marginTop: 4, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10, borderWidth: 2.5, borderColor: c.ink, borderRadius: 20, backgroundColor: c.card }}>
      <Txt bold size={17.6}>{O.volTitle}</Txt><Txt muted size={14} style={{ marginTop: 2, marginBottom: 10 }}>{O.volSub}</Txt>
      <View style={{ gap: 7 }}>{groups.map(g => { const n = info.volume[g], focus = (info.focusMuscles || []).includes(g); return <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={14.7} numberOfLines={1} style={{ width: 86, fontWeight: focus ? '800' : '400' }}>{O.muscles[g]}</Txt>
        <View style={{ flex: 1, height: 10, borderRadius: 99, backgroundColor: hairline, overflow: 'hidden' }}><View style={{ width: `${Math.round((n / max) * 100)}%`, height: '100%', borderRadius: 99, backgroundColor: focus ? c.orange : c.teal }} /></View>
        <Txt bold size={14.7} style={{ width: 28, textAlign: 'right' }}>{n || '–'}</Txt>
      </View>; })}</View>
    </View>}
    {a.goal === 'fat' && <Txt muted size={14.4} style={{ marginHorizontal: 2 }}>{O.planNoteFat}</Txt>}
    <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: hairline, paddingTop: 6 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore(!more)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, paddingHorizontal: 2 }}>
        <Txt bold style={{ color: c.tealInk, flex: 1 }}>{O.moreTitle}</Txt><View style={{ transform: [{ rotate: more ? '90deg' : '-90deg' }] }}><Icon name="ui-back" size={22} color={c.tealInk} /></View>
      </Pressable>
      {more && <View style={{ gap: 8, paddingLeft: 4, paddingBottom: 4 }}>{reasons.map(x => <Row key={x} style={{ alignItems: 'flex-start', gap: 8 }}><Txt size={14.9}>•</Txt><Txt size={14.9} style={{ flex: 1, lineHeight: 21 }}>{x}</Txt></Row>)}</View>}
    </View>
  </View>;
}
