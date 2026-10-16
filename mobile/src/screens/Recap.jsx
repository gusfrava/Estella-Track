import React from 'react';
import { Share } from 'react-native';
import { Button, Card, Motion, Page, Row, Title, Txt } from '@/components/native-ui';
import { useApp } from '@/providers/AppProvider';
import { weekRecap } from '@/core/state/recap';
export default function Recap() { const {L}=useApp(), r=weekRecap(), R=L.rc; return <Page back><Title>{R.title}</Title><Txt muted>{r.from} – {r.to}</Txt><Motion scene="cheer" size={160} /><Title>{r.status==='met' ? R.headMet : r.status==='saved' ? R.headSaved : R.headSome}</Title><Card><Txt bold size={32}>{R.daysOf(r.days,r.goal)}</Txt>{[[r.workouts,R.workouts(r.workouts)],[r.activities,R.activities(r.activities)],[r.sets,R.sets],[r.minutes,R.minutes]].map(([n,label])=><Row key={label}><Txt bold size={24}>{n}</Txt><Txt>{label}</Txt></Row>)}</Card><Txt>{R.cheers(r.cheers)}</Txt><Txt>{L.pts.points(r.points)}</Txt><Button title={R.share} onPress={()=>Share.share({message:`${R.shareText}\n${r.from} – ${r.to}\n${R.daysOf(r.days,r.goal)}\n${r.sets} ${R.sets}`})} /></Page>; }
