"""Generate milestone assets from the app catalog without modifying app code."""
from pathlib import Path
import runpy, re, json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
lib = runpy.run_path(str(ROOT/'tools/build.py'))
art = {i['name']: i for i in lib['ICONS']}
path, circle, rect = lib['path'], lib['circle'], lib['rect']
source = (ROOT.parents[1]/'js/data/badges.js').read_text(encoding='utf-8')
badges = [dict(id=a,family=b,counter=c,at=int(d)) for a,b,c,d in re.findall(r"id: '([^']+)', family: '([^']+)', counter: '([^']+)', at: (\d+)",source)]
assert len(badges)==22, 'Review changed badge catalog before regenerating.'
tiers = {'bronze':('#B87847','#F5C79C'),'titanium':('#596570','#C8D5DF'),'silver':('#B5C0C7','#EEF2F4'),'gold':('#E4AB35','#FFF0B0'),'platinum':('#A7C7C0','#F3FFFA'),'diamond':('#83C9E0','#EDF7FF')}
suggested = dict(zip(['w1','w10','w25','w50','w100','w250'],['bronze','silver','gold','platinum','diamond','titanium']))
suggested.update(dict(zip(['s2','s4','s8','s12','s26','s52'],['bronze','silver','gold','platinum','diamond','titanium'])))
suggested.update(r1='bronze',r10='silver',r25='gold',f1='bronze',f5='silver',c1='bronze',c10='silver',c50='platinum',cr10='silver',cp1='bronze')
for b in badges:
    b['conceptOnly']=False
for prefix,counter in [('c','cheersSent'),('cp','copies')]:
    for n,tier in zip([1,10,25,50,100,250],['bronze','silver','gold','platinum','diamond','titanium']):
        bid=f'{prefix}{n}'
        suggested[bid]=tier
        if not any(b['id']==bid for b in badges):
            badges.append(dict(id=bid,family='social',counter=counter,at=n,conceptOnly=True))
for prefix,counter,values in [('r','records',[1,10,25,50,100,250]),('f','friends',[1,5,10,25,50,100]),('cr','cheersReceived',[1,10,25,50,100,250])]:
    for n,tier in zip(values,['bronze','silver','gold','platinum','diamond','titanium']):
        bid=f'{prefix}{n}'; suggested[bid]=tier
        if not any(b['id']==bid for b in badges):
            badges.append(dict(id=bid,family='records' if prefix=='r' else 'social',counter=counter,at=n,conceptOnly=True))
badges.sort(key=lambda b: (['workouts','bestStreak','records','friends','cheersSent','cheersReceived','copies'].index(b['counter']),b['at']))
# A cheeky masked routine thief carrying a workout sheet.
art['copycat-routine'] = {'art':
    path('M42 84L30 101L18 100M59 85L70 100L82 100','none','stroke-width="11"')
    +path('M34 58Q46 50 66 58L76 87H28Z','cream')
    +path('M33 66H69M30 77H73','none','stroke-width="7"')
    +path('M33 63L20 76L27 86','none','stroke-width="10"')
    +rect(30,21,43,36,14,'peach')
    +path('M27 27Q25 7 50 9Q69 6 75 27Z','ink')
    +rect(26,23,51,8,4,'deep')
    +path('M30 33Q41 29 51 34Q62 29 73 33L71 44Q61 48 52 42Q39 49 31 42Z','ink')
    +path('M36 35H46L45 41H37ZM57 35H67L66 41H58Z','cream')
    +circle(43,38,2,'ink')+circle(64,38,2,'ink')
    +path('M49 49Q59 56 66 47','none','stroke-width="2.5"')
    +'<g transform="rotate(12 88 68)">'+rect(71,45,35,46,5,'paper')
    +rect(80,41,17,8,3,'teal')
    +path('M78 59v12M99 59v12M78 65h21','none','stroke-width="4"')
    +path('M79 80h18','none','stroke-width="3"')+'</g>'
    +path('M62 64L74 77','none','stroke-width="10"')
    +circle(77,78,6,'peach')}
symbols = dict(workouts='dumbbell',bestStreak='streak-flame',records='trophy',friends='friends',cheersSent='cheer',cheersReceived='star',copies='copycat-routine')
labels = dict(workouts='workouts',bestStreak='weeks in a row',records='records',friends='friends',cheersSent='cheers sent',cheersReceived='cheers received',copies='routine copied')

# Numerals are paths, so badges have no font dependency.
segments = dict(a='M1 0H7',b='M8 1V7',c='M8 9V15',d='M1 16H7',e='M0 9V15',f='M0 1V7',g='M1 8H7')
digits = ['abcdef','bc','abged','abgcd','fgbc','afgcd','afgecd','abc','abcdefg','abfgcd']
def number(n):
    s=str(n); x=64-(len(s)*12-4)/2
    return ''.join(f'<g transform="translate({x+12*k} 91)" stroke-width="2.6">'+''.join(path(segments[a]) for a in digits[int(v)])+'</g>' for k,v in enumerate(s))

def frame(tier):
    base, light=tiers[tier]
    if tier in ('bronze','silver','gold'):
        outer=circle(64,61,48,base)+circle(64,61,40,'paper')
        shine=path('M28 46Q39 19 66 21','none',f'stroke="{light}" stroke-width="5"')
        if tier=='gold':
            shine+=path('M96 68l3 5l-3 5l-3 -5Z',light)
    else:
        outer=path('M43 13H85L111 39V81L85 108H43L17 81V39Z',base)
        shine=path('M43 13L47 25H81L85 13M17 39L29 44M111 39L99 44M17 81L29 76M111 81L99 76M43 108L47 96M85 108L81 96','none',f'stroke="{light}" stroke-width="3"')
        outer+=path('M47 25H81L99 44V76L81 96H47L29 76V44Z','paper')
        if tier=='diamond':
            shine+=path('M92 20l5 8l9 3l-9 4l-5 9l-4 -9l-9 -4l9 -3Z',light)
    return outer+shine

def workout_character(n):
    stage=[1,10,25,50,100,250].index(n)
    half=[12,15,18,22,25,28][stage]
    skin='#A9BCC9' if stage==5 else '#E8A36B'
    shirt='#596570' if stage==5 else '#127F73'
    # Deliberately exaggerated game-character progression, with distinct arm poses.
    poses=[('M51 48L43 66L46 82','M77 48L83 67L80 81'),
           ('M49 48L34 59L32 43','M79 48L88 68L80 75'),
           ('M46 47L30 59L26 34','M82 47L96 64L82 75'),
           ('M42 46L24 57L23 32','M86 46L104 57L105 32'),
           ('M40 46L24 62L45 67','M88 46L104 62L83 67'),
           ('M37 45L22 34L31 18','M91 45L106 34L97 18')]
    arms=''
    for d in poses[stage]:
        arms+=path(d,'none',f'stroke="#2B1B12" stroke-width="{12+stage*2}"')+path(d,'none',f'stroke="{skin}" stroke-width="{7+stage*2}"')
    legs=path('M53 77L48 100L37 105M75 77L80 100L92 105','none','stroke="#2B1B12" stroke-width="13"')+path('M53 77L48 100M75 77L80 100','none',f'stroke="{skin}" stroke-width="8"')
    body=path(f'M{64-half} 43Q64 35 {64+half} 43L79 80H49Z',shirt)
    body+=path('M49 76H79L82 88H66L64 82L62 88H46Z','ink')
    head=rect(53,17,22,25,9,skin)+path('M53 23Q47 9 58 13Q65 3 69 13Q83 9 76 24L69 20L59 24Z','ink')
    head+=path('M57 29h4M67 29h4M60 35q5 3 9 -1','none','stroke-width="2"')
    muscles=path('M49 52l12 4M79 52l-12 4M64 58v12','none','stroke="#FFF1E1" stroke-width="2"') if stage>=2 else ''
    shine=''
    if stage==5:
        shine='<g class="titanium-shine">'+path('M38 22l3 7l7 3l-7 3l-3 7l-3 -7l-7 -3l7 -3Z','paper')+path('M95 76l3 6l7 3l-7 3l-3 7l-3 -7l-6 -3l6 -3Z','paper')+path('M55 46l-5 17M69 20l2 7','none','stroke="#FFFFFF" stroke-width="3"')+'</g>'
    return legs+arms+body+muscles+head+shine

def pom(x,y,r,color):
    return circle(x,y,r,color)+path(f'M{x-r} {y}h{r*2}M{x} {y-r}v{r*2}M{x-r*.7} {y-r*.7}l{r*1.4} {r*1.4}M{x-r*.7} {y+r*.7}l{r*1.4} {-r*1.4}','none','stroke="#FFF7DD" stroke-width="3"')

def cheer_character(n):
    stage=[1,10,25,50,100,250].index(n)
    head=rect(49,18,30,29,12,'peach')+path('M47 27Q43 9 61 11Q79 4 82 26L66 20L54 28Z','ink')+path('M55 31h4M69 31h4M57 39q8 7 15 -2','none','stroke-width="2.5"')
    if stage>=2:
        def person(x,y,color,raised=False):
            arm_y=y-12 if raised else y+12
            return (path(f'M{x-5} {y+23}l-7 12M{x+5} {y+23}l7 12','none','stroke-width="5"')
                +path(f'M{x-8} {y+8}L{x-17} {arm_y}M{x+8} {y+8}L{x+17} {arm_y}','none','stroke="#E8A36B" stroke-width="5"')
                +path(f'M{x-8} {y+5}h16l3 20h-22Z',color)
                +circle(x,y-3,8,'peach')+path(f'M{x-7} {y-7}q7 -10 14 0','none','stroke-width="4"')
                +path(f'M{x-3} {y-2}h1M{x+3} {y-2}h1','none','stroke-width="2"')
                +(pom(x-17,arm_y,6,'orange')+pom(x+17,arm_y,6,'yellow') if raised else ''))
        if stage==2: return person(42,62,'teal',True)+person(86,62,'orange',True)
        if stage==3: return person(28,66,'teal',True)+person(64,58,'orange',True)+person(100,66,'teal',True)
        if stage==4: return person(26,69,'teal')+person(102,69,'teal')+person(46,44,'orange',True)+person(82,44,'orange',True)
        # Three supporters, two in the middle and one at the top.
        return (person(28,75,'teal')+person(64,75,'orange')+person(100,75,'teal')
                +person(46,43,'teal')+person(82,43,'orange')+person(64,12,'teal',True))
    lift=stage*4
    limbs=path(f'M51 78L{43-stage*4} 101M76 78L{85+stage*4} 101','none','stroke-width="10"')+path(f'M48 53L28 {59-lift}L22 {43-lift}M80 53L99 {59-lift}L105 {44-lift}','none','stroke="#E8A36B" stroke-width="9"')
    body=path('M48 46H80L76 71L85 86H43L52 71Z','teal')+path('M52 63h24','none','stroke="#FFF7DD" stroke-width="5"')
    decor=pom(22,43-lift,10+stage*2,'orange')
    if stage: decor+=pom(105,44-lift,10+stage*2,'yellow')
    if stage>=2: decor+=path('M15 78l6 -5M108 82l6 4M38 15l3 -6','none','stroke="#FF6A2B" stroke-width="4"')
    return limbs+body+head+decor

def thief_character(n):
    if n==1: return art['copycat-routine']['art']
    if n==250:
        head=rect(49,18,30,29,12,'peach')+path('M47 27Q43 9 61 11Q79 4 82 26L66 20L54 28Z','ink')+path('M55 31h4M69 31h4M57 39q8 7 15 -2','none','stroke-width="2.5"')
        return (head+path('M46 46L64 54L82 46L95 83H33Z','#A9BCC9')+path('M57 49l7 7l7 -7l-7 23Z','orange')
            +path('M83 52L99 37L94 21','none','stroke-width="10"')+circle(94,20,6,'peach')
            +rect(21,62,22,31,3,'paper')+path('M26 73h12M26 80h12')
            +path('M33 72H96L89 109H39Z','deep')+circle(64,89,10,'yellow')
            +path('M64 73V60Q64 54 74 54')+circle(76,54,4,'ink')
            +path('M22 24l6 6M104 64l7 -4','none','stroke="#FF6A2B" stroke-width="5"'))
    stage=[1,10,25,50,100,250].index(n)
    if stage<3:
        props=''.join(rect(81+i*3,44-i*7,24,36,3,'paper') for i in range(stage+1))
        if stage==2: props=path('M75 43Q112 38 114 80Q115 110 80 109Q57 104 62 82Z','teal')+path('M75 44l4 -13l13 3l-1 12Z','paper')
        return props+'<g transform="translate(-5 0) scale(.9)">'+art['copycat-routine']['art']+'</g>'
    suit='#A9BCC9' if stage==5 else '#127F73'
    vault=rect(76,50,38,55,6,'deep')+circle(95,76,12,'cream')+path('M95 66v20M85 76h20')
    boss=path('M29 53L51 61L69 51L81 108H18Z',suit)+path('M37 54l14 8l-10 13l10 25l10 -25l-10 -13l11 -10','cream')+rect(33,22,35,31,12,'peach')+path('M24 27H78L64 20L62 8H38L34 21Z','ink')+path('M35 34h13l3 4l4 -4h12v9H55l-4 -5l-4 5H35Z','ink')+path('M46 48q9 4 16 -2','none','stroke-width="2"')
    if stage>=4: vault+=''.join(rect(83-i*3,87+i*4,26,9,2,'paper') for i in range(3))
    if stage==5: boss+='<g class="titanium-shine">'+path('M31 61l4 8l8 3l-8 3l-4 8l-3 -8l-8 -3l8 -3Z','paper')+'</g>'
    return vault+boss

def collection_character(counter,stage):
    if counter=='records':
        if stage<2:
            return '<g transform="translate(10 7) scale(.85)">'+art['trophy']['art']+'</g>'+ (path('M21 92l-7 5M108 85l7 5','none','stroke="#FF6A2B" stroke-width="4"') if stage else '')
        cabinet=rect(12,18,104,92,7,'deep')+path('M16 64h96M16 105h96','none','stroke="#FFF1E1" stroke-width="4"')
        positions=[(16,23),(65,23),(16,65),(65,65)]
        for x,y in positions[:min(4,stage)]: cabinet+=f'<g transform="translate({x} {y}) scale(.36)">'+art['trophy']['art']+'</g>'
        if stage==5: cabinet+='<g transform="translate(41 -2) scale(.43)">'+art['trophy']['art']+'</g>'
        return cabinet
    def face(x,y,r,color):
        return circle(x,y,r,color)+path(f'M{x-r*.7} {y-r*.4}q{r*.7} {-r*1.1} {r*1.4} 0','none','stroke-width="4"')+path(f'M{x-r*.3} {y}h1M{x+r*.3} {y}h1M{x-3} {y+5}q3 3 6 0','none','stroke-width="2"')
    if counter=='friends':
        positions=[(44,43),(84,43),(24,78),(64,78),(104,78),(64,15)]
        return ''.join(face(x,y,14,'peach')+path(f'M{x-13} {y+16}q13 -5 26 0v12h-26Z','teal' if i%2 else 'orange') for i,(x,y) in enumerate(positions[:stage+1]))
    # Receiving encouragement develops from a pleased face to red-carpet celebrity.
    drawing=path('M39 73Q64 54 89 73L97 108H31Z','teal')+face(64,48,24,'peach')
    for x,y in [(24,39),(102,35),(23,79),(105,80),(64,12)][:stage]:
        drawing+=path(f'M{x} {y-7}l3 5l6 2l-5 4v6l-4 -3l-5 3l1 -6l-5 -4l6 -2Z','yellow')
    if stage>=3: drawing+=path('M42 43h18l4 5l4 -5h18v13H68l-4 -6l-4 6H42Z','ink')
    if stage==5: drawing+=path('M36 100H92L110 114H18Z','orange')+path('M36 73l12 15M92 73L80 88','none','stroke="#FFC94D" stroke-width="5"')
    return drawing

motion_style='''<style>
.badge-motion{transform-box:fill-box;transform-origin:50% 85%;animation:idle 3.6s ease-in-out infinite}
.motion-workouts{animation-name:flex}
.motion-records{animation-name:wobble}
.motion-friends{animation-name:idle}
.motion-cheersSent{animation-name:hop}
.motion-cheersReceived{animation-name:wobble}
.motion-copies{animation-name:sneak}
@keyframes idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes flex{0%,100%{transform:scale(1)}45%,60%{transform:scale(1.04,1.02)}}
@keyframes wobble{0%,65%,100%{transform:rotate(0)}75%{transform:rotate(-3deg)}85%{transform:rotate(3deg)}}
@keyframes hop{0%,65%,100%{transform:translateY(0)}78%{transform:translateY(-4px)}90%{transform:translateY(1px)}}
@keyframes sneak{0%,100%{transform:translateX(-2px) rotate(-1deg)}50%{transform:translateX(2px) rotate(1deg)}}
.living-flame{transform-box:fill-box;transform-origin:50% 95%;animation:burn 1.35s ease-in-out infinite alternate}
@keyframes burn{0%{transform:rotate(-2deg) scale(.97,1.02)}50%{transform:rotate(1deg) scale(1.025,.97)}100%{transform:rotate(2deg) scale(.98,1.03)}}
.titanium-shine{animation:shine 2.4s ease-in-out infinite}
@keyframes shine{0%,100%{opacity:.45}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){.living-flame,.titanium-shine,.badge-motion{animation:none}}
</style>'''
manifest={'name':'Estella Milestone Badges','version':'2.0.0','source':'js/data/badges.js','tierOrder':['bronze','silver','gold','platinum','diamond','titanium'],'suggestedTiersOnly':True,'sizes':[32,48,64,128,256],'badges':[]}
rows=[]
for b in badges:
    label=f"{b['at']} {labels[b['counter']]}"
    symbol=art[symbols[b['counter']]]
    center=workout_character(b['at']) if b['family']=='workouts' else symbol['art']
    if b['counter']=='cheersSent': center=cheer_character(b['at'])
    if b['counter']=='copies': center=thief_character(b['at'])
    tier_index=manifest['tierOrder'].index(suggested[b['id']])
    if b['counter'] in ('records','friends','cheersReceived'): center=collection_character(b['counter'],tier_index)
    animated=True
    if b['family']=='streak':
        center='<g class="living-flame">'+center+'</g>'
    else:
        center=f'<g class="badge-motion motion-{b["counter"]}">'+center+'</g>'
    entry=b|{'label':label,'tier':suggested[b['id']],'variants':{}}
    cells=[]
    for tier in [suggested[b['id']]]:
        drawing=frame(tier)+'<g transform="translate(25 23) scale(.60)">'+center+'</g>'+rect(43,87,42,24,9,'cream')+number(b['at'])
        icon={'name':f"badge-{b['id']}-{tier}",'label':f'{label}, {tier} tier','art':drawing,'detail':''}
        files={}
        for folder,size in [('masters',128)]+[(f'{s}px',s) for s in manifest['sizes']]:
            rel=Path(folder)/b['family']/tier/(b['id']+'.svg')
            dest=ROOT/'milestones'/rel; dest.parent.mkdir(parents=True,exist_ok=True)
            svg=lib['svg'](icon,size)
            if tier=='titanium':
                gid=f'chrome-{b["id"]}'
                gradient=f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#394550"/><stop offset=".24" stop-color="#CBDCE5"/><stop offset=".38" stop-color="#FFFFFF"/><stop offset=".43" stop-color="#647584"/><stop offset=".58" stop-color="#9FDCD9"/><stop offset=".72" stop-color="#C0A6D6"/><stop offset=".83" stop-color="#F3C6D6"/><stop offset="1" stop-color="#52616C"/></linearGradient>'
                svg=svg.replace('<defs>','<defs>'+gradient).replace('fill="#596570"',f'fill="url(#{gid})"').replace('fill="#A9BCC9"',f'fill="url(#{gid})"')
            ET.fromstring(svg); dest.write_text(svg,encoding='utf-8'); files[folder]=rel.as_posix()
            if animated:
                motion=svg.replace('</svg>',motion_style+'</svg>')
                ET.fromstring(motion)
                motion_dest=ROOT/'milestones'/'animated'/rel
                motion_dest.parent.mkdir(parents=True,exist_ok=True)
                motion_dest.write_text(motion,encoding='utf-8')
        entry['variants'][tier]=files
        if animated:
            entry['animatedFiles']={key:'animated/'+value for key,value in files.items()}
        cells.append(f'<div><img src="128px/{b["family"]}/{tier}/{b["id"]}.svg" width="128" height="128" alt="{label}, {tier}"><b>{tier.title()}</b><small>{"Suggested" if tier==suggested[b["id"]] else "Alternative"}</small><span>'+''.join(f'<img width="{s}" height="{s}" src="{s}px/{b["family"]}/{tier}/{b["id"]}.svg" alt="{s}px">' for s in [32,48,64])+'</span></div>')
    manifest['badges'].append(entry)
    if animated:
        cells=[cell.replace('src="','src="animated/') for cell in cells]
    status=' · Artwork concept — not yet earnable' if b['conceptOnly'] else ''
    rows.append(f'<article><h2>{label} <code>{b["id"]}</code></h2><small>{status}</small><section>'+''.join(cells)+'</section></article>')
out=ROOT/'milestones'
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(out/'preview.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estella milestone badges</title><style>*{box-sizing:border-box}body{margin:0;background:#FFF1E1;color:#2B1B12;font:16px/1.5 system-ui}main{max-width:1100px;margin:auto;padding:30px}h1{font-size:36px;margin-bottom:8px}p{max-width:740px}article{background:#fff9f1;border:1px solid #EEDFCB;border-radius:24px;padding:22px;margin:22px 0}h2{font-size:20px;margin:0 0 16px}code{font-size:13px;color:#6E5B4E}section{display:grid;grid-template-columns:1fr;gap:14px}section>div{display:flex;align-items:center;flex-direction:column}small{color:#6E5B4E}span{display:flex;align-items:center;gap:8px;margin-top:12px}a{color:#127F73}@media(max-width:720px){section{grid-template-columns:1fr}main{padding:16px}}</style><main><a href="../preview.html">← Sticker library</a><h1>Milestones worth keeping.</h1><p>One tier per milestone: bronze → silver → gold → platinum → diamond → titanium. Workouts: 1 → 10 → 25 → 50 → 100 → 250. Earning rules are unchanged.</p><p>Large: 128px. Small samples: 32, 48 and 64px.</p>'''+''.join(rows)+'</main></html>',encoding='utf-8')
page=(out/'preview.html').read_text(encoding='utf-8')
controls='''<p>42 badges · seven families · six tiers each. New thresholds are artwork concepts.</p><button id="motion-toggle" style="padding:12px 20px;border:2px solid #2B1B12;border-radius:20px;background:#FFC94D;cursor:pointer" aria-pressed="true">Pause motion</button><script>document.getElementById('motion-toggle').onclick=function(){const playing=this.getAttribute('aria-pressed')==='true';document.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src');img.setAttribute('src',playing?src.replace(/^animated\\//,''):('animated/'+src));});this.setAttribute('aria-pressed',String(!playing));this.textContent=playing?'Play motion':'Pause motion';};</script>'''
page=page.replace('<h1>Milestones worth keeping.</h1>','<h1>Milestones worth keeping.</h1>'+controls)
(out/'preview.html').write_text(page,encoding='utf-8')
print(f'Generated {len(badges)*6} static and {len(badges)*6} animated milestone SVGs; all XML validated.')

