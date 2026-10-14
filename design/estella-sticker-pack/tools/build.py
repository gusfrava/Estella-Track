"""Build original editable SVG stickers. Python standard library only."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
P = dict(ink='#2B1B12', cream='#FFF1E1', orange='#FF6A2B', teal='#3DC4B3', deep='#127F73', yellow='#FFC94D', paper='#FFF7DD', peach='#E8A36B')
def path(d, fill='none', extra=''):
    return f'<path d="{d}" fill="{P.get(fill,fill)}" {extra}/>'
def rect(x,y,w,h,r,fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{P.get(fill,fill)}"/>'
def circle(x,y,r,fill):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{P.get(fill,fill)}"/>'

ICONS = []
def add(category, name, label, art, detail=''):
    ICONS.append(dict(category=category,name=name,label=label,art=art,detail=detail))

add('fitness','dumbbell','Strength',
    '<g transform="rotate(-16 64 64)">'+rect(30,56,68,16,5,'cream')+rect(24,37,19,54,6,'teal')+rect(14,47,13,34,5,'deep')+rect(85,37,19,54,6,'teal')+rect(103,47,13,34,5,'deep')+'</g>',
    path('M31 45v13M92 45v13','none','stroke="#FFF7DD"'))
add('fitness','kettlebell','Kettlebell',
    path('M43 48V34Q43 17 64 17Q85 17 85 34V48H75V34Q75 28 64 28Q53 28 53 34V48Z','cream')+path('M43 43Q23 55 26 80Q29 105 64 105Q99 105 102 80Q105 55 85 43Z','teal')+circle(64,74,17,'paper'),path('M40 55Q33 63 35 73','none','stroke="#FFF7DD"'))
add('fitness','running-shoe','Running',
    path('M24 40L44 45L54 33L71 62Q79 73 99 77Q111 80 110 95H20Q13 91 16 80Z','paper')+path('M20 82Q34 90 50 82Q72 93 110 87V99H19Q13 93 20 82Z','orange')+path('M28 54L46 70L65 64L73 76L45 81L24 66Z','teal')+path('M52 48l13 -5M58 58l13 -5'),path('M91 80l8 3'))
add('fitness','stopwatch','Workout timer',
    rect(55,15,18,13,4,'orange')+path('M87 34l9 -8l9 10l-9 8Z','teal')+circle(64,70,37,'yellow')+circle(64,70,28,'paper')+path('M64 49v22l17 8')+circle(64,70,4,'orange'),path('M43 70h3M82 70h3M64 90v-3'))
add('fitness','yoga-mat','Stretch and recover',
    path('M31 36H87L108 86Q111 100 97 103H34Q20 103 20 90V47Z','teal')+path('M32 36Q17 36 17 51Q17 64 32 64H88L78 36Z','deep')+circle(31,50,12,'paper')+path('M31 44Q22 44 25 52Q29 59 35 52'),path('M40 77h49M44 88h50','none','stroke="#127F73"'))
add('rewards','streak-flame','Training streak',
    path('M64 16Q84 34 78 51Q89 47 91 38Q118 76 92 99Q65 120 39 100Q10 78 36 47Q35 65 47 65Q42 43 64 16Z','orange')+path('M64 61Q82 78 78 89Q75 101 62 101Q43 99 48 85Q51 78 57 75Q55 86 61 86Q68 83 64 61Z','yellow'),path('M83 64q8 11 3 19','none','stroke="#FFF1E1"'))
add('rewards','trophy','Personal record',
    path('M40 33H21V47Q21 66 44 67M88 33H107V47Q107 66 84 67','yellow')+path('M39 25H89L86 58Q82 77 64 78Q46 77 42 58Z','yellow')+rect(59,77,10,18,3,'orange')+path('M46 94H82L89 105H39Z','teal')+path('M64 36l5 10l11 2l-8 8l2 11l-10 -5l-10 5l2 -11l-8 -8l11 -2Z','paper'))
add('rewards','star','Milestone star',
    '<g transform="rotate(-8 64 64)">'+path('M57 26Q64 12 71 26L81 45L101 48Q116 50 105 62L90 77L93 98Q95 112 82 105L64 95L45 105Q32 112 35 98L38 77L23 62Q12 50 27 48L47 45Z','yellow')+'</g>',
    '<g transform="rotate(-8 64 64)">'+path('M57 43L62 33','none','stroke="#FFF7DD" stroke-width="6"')+'</g>')
add('rewards','completion','Workout complete',
    path('M64 18L77 25L92 25L99 39L109 49L104 65L107 81L93 90L84 104L67 102L51 109L39 97L24 91L24 74L17 60L27 47L31 31L48 29Z','teal')+path('M40 64l16 16l32 -34','none','stroke="#FFF7DD" stroke-width="11"'))
add('planning','calendar','Weekly plan',
    rect(24,28,80,77,10,'paper')+path('M24 51V38Q24 28 34 28H94Q104 28 104 38V51Z','orange')+path('M44 20v17M83 20v17')+rect(37,65,16,15,4,'teal')+path('M66 72h21M39 91h14M66 91h21'),path('M40 71l4 4l6 -7','none','stroke-width="2"'))
add('planning','goal-target','Weekly goal',
    circle(60,69,37,'orange')+circle(60,69,26,'paper')+circle(60,69,14,'teal')+path('M60 69l36 -40','none','stroke-width="5"')+path('M87 37V20L99 25L111 25L105 39L88 43Z','yellow'))
add('wellbeing','water-bottle','Hydration',
    rect(48,16,31,14,4,'deep')+path('M48 30H79V40Q91 46 91 60V96Q91 105 81 105H46Q36 105 36 96V60Q36 46 48 40Z','teal')+rect(36,59,55,30,3,'paper')+path('M64 63Q48 78 58 83Q75 90 73 76Z','orange'),path('M45 48l-2 7M82 93v5','none','stroke="#FFF7DD"'))
add('wellbeing','heart','Wellbeing',
    path('M64 103Q10 71 19 43Q29 17 53 33L64 44L75 33Q98 17 108 43Q119 72 64 103Z','orange')+path('M29 64h18l8 -17l13 34l9 -17h20','none','stroke="#FFF7DD" stroke-width="5"'),path('M28 45q5 -10 14 -6','none','stroke="#FFF1E1"'))
add('wellbeing','rest-moon','Rest day',
    path('M79 20Q61 44 73 67Q86 89 109 81Q93 113 60 106Q25 99 25 65Q25 31 57 22Q68 19 79 20Z','yellow')+path('M96 27l4 9l10 3l-9 5l-3 10l-5 -9l-10 -3l9 -5Z','teal'),path('M42 72q8 7 15 -1M59 87q8 4 13 -1'))
add('social','friends','Training friends',
    path('M15 103V90Q15 71 39 71Q63 71 63 91V103Z','teal')+path('M64 103V90Q64 72 87 72Q111 72 111 91V103Z','orange')+circle(39,51,18,'peach')+circle(87,52,18,'peach')+path('M21 47Q17 26 36 29Q44 17 50 31Q60 28 57 46L44 40L30 47Z','ink')+path('M70 45Q64 28 78 31Q84 20 94 33Q108 31 104 48L92 42L80 48Z','ink'),path('M32 53h4M45 53h3M80 54h4M93 54h3M35 62q5 3 9 -1M83 63q5 3 9 -1','none','stroke-width="2"'))
add('social','cheer','Encouragement',
    path('M23 82L33 101L51 92L45 76Z','orange')+path('M20 56L50 49L94 25L101 84L54 75L24 80Z','teal')+path('M50 49l4 26M94 25l7 59')+path('M103 18l5 -7M110 48h7M109 94l7 5','none','stroke-width="5"'),path('M29 61l11 -3','none','stroke="#FFF7DD"'))

# Muscle stickers share body silhouettes; colored regions communicate the target.
# They are category illustrations, not anatomical teaching diagrams.
torso = path('M49 22H79L81 33L96 40Q105 44 108 61L96 67L88 57L84 101H44L40 57L32 67L20 61Q23 44 32 40L47 33Z','peach')
legs = path('M41 22H87L92 44L83 76L83 100L92 105Q96 111 87 112H70L66 77L64 56L60 77L57 112H39Q31 111 36 105L44 100L43 76L36 44Z','peach')
shorts = path('M41 22H87L92 44L68 49L64 40L60 49L36 44Z','deep')
add('muscles','chest','Chest',torso+path('M44 43Q54 38 62 45V63Q49 68 42 57ZM66 45Q76 38 84 43L86 57Q79 68 66 63Z','orange'),path('M64 70v22M52 32l12 6l12 -6'))
add('muscles','back','Back',torso+path('M44 43L60 48L60 88L48 74ZM68 48L84 43L80 74L68 88Z','teal')+path('M64 38v57'),path('M48 33l16 9l16 -9'))
add('muscles','shoulders','Shoulders',torso+path('M43 37Q22 37 22 59L33 64L42 51ZM85 37Q106 37 106 59L95 64L86 51Z','orange'),path('M48 48l14 5M80 48l-14 5'))
arm = path('M30 87L36 55L42 28Q44 21 51 24L62 29Q67 33 63 39L53 42L50 65Q63 52 77 65Q92 59 101 73Q116 101 88 106H51Q35 105 25 97Z','peach')
add('muscles','arms','Arms',arm+path('M50 78Q58 56 74 69Q84 77 78 88Q64 95 50 87Z','orange'),path('M86 91q9 -6 6 -13M43 32l10 4'))
add('muscles','legs','Legs',legs+shorts+path('M44 54L49 78L48 98M82 54L76 78L76 98','none','stroke="#FF6A2B" stroke-width="7"'))
add('muscles','quads','Quads',legs+shorts+path('M42 51L58 54L53 75Q43 79 42 51ZM70 54L86 51Q85 79 75 75Z','orange'))
add('muscles','hamstrings','Hamstrings',legs+shorts+path('M42 51L58 54L53 75Q43 79 42 51ZM70 54L86 51Q85 79 75 75Z','teal')+path('M45 30l10 6M83 30l-10 6'),path('M47 59l3 10M81 59l-3 10','none','stroke="#FFF7DD"'))
add('muscles','calves','Calves',legs+shorts+path('M45 79Q54 74 56 83L54 100L47 99ZM72 83Q74 74 82 79L81 99L74 100Z','orange'))
add('muscles','core','Core',torso+path('M51 55Q64 50 77 55L75 92Q64 99 53 92Z','orange')+path('M64 57v35M53 68h22M54 80h20'),path('M44 69l4 17M84 69l-4 17'))
add('muscles','glutes-plum','Glutes — plum',
    path('M64 42Q32 26 23 56Q14 93 49 107Q61 114 73 108Q107 100 105 66Q103 30 73 40Z','#8B638C')+path('M64 41Q68 22 62 16','none','stroke-width="5"')+path('M66 30Q79 10 97 23Q88 41 66 30Z','teal'),
    path('M69 47Q79 74 66 99','none','stroke="#624361"')+path('M36 51Q29 61 31 71','none','stroke="#FFF1E1" stroke-width="5"'))
add('muscles','cardio','Cardio',path('M64 104Q13 72 22 44Q31 23 52 34L64 45L76 34Q97 23 106 44Q115 73 64 104Z','orange')+path('M70 40L46 71H62L57 91L83 59H67Z','yellow'))
add('muscles','mobility','Mobility',circle(66,27,11,'peach')+path('M55 43L75 43L81 72L102 96L90 105L66 81L44 105L32 95L53 71Z','teal')+path('M56 47L33 61L24 49M76 47L94 33L100 20','none','stroke="#2B1B12" stroke-width="12"')+path('M56 47L33 61L24 49M76 47L94 33L100 20','none','stroke="#E8A36B" stroke-width="7"'))

def svg(icon, size, master=False):
    uid = 'estella-'+icon['name']
    # Filter uses only vector alpha; no embedded raster, fonts or external dependencies.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 128 128" role="img" aria-labelledby="{uid}-title">
  <title id="{uid}-title">{icon['label']}</title>
  <defs><filter id="{uid}-sticker" x="-25%" y="-25%" width="160%" height="165%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="cutout"/>
    <feOffset in="cutout" dx="2" dy="4" result="offset"/>
    <feFlood flood-color="{P['ink']}" flood-opacity="0.25"/><feComposite in2="offset" operator="in" result="shadow"/>
    <feFlood flood-color="{P['cream']}"/><feComposite in2="cutout" operator="in" result="border"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>
  <g id="{uid}-artwork" filter="url(#{uid}-sticker)" stroke="{P['ink']}" stroke-width="{3.6 if size==32 else 3}" stroke-linecap="round" stroke-linejoin="round">
    <g id="{uid}-base">{icon['art']}</g>
    <g id="{uid}-details">{icon['detail'] if size!=32 else ''}</g>
  </g>
</svg>'''

manifest = dict(name='Estella Sticker Pack',version='1.1.0',palette=P | {'plum':'#8B638C','plumShade':'#624361'},sizes=[32,48,64,128,256],icons=[])
manifest['exerciseGroups'] = dict(pecho='chest',espalda='back',hombros='shoulders',brazos='arms',piernas='legs',gluteos='glutes-plum',core='core',cardio='cardio',movilidad='mobility')
manifest['chartGroups'] = dict(chest='chest',back='back',shoulders='shoulders',arms='arms',glutes='glutes-plum',quads='quads',hamstrings='hamstrings',legs='legs',calves='calves',core='core')
for icon in ICONS:
    paths={}
    for folder,size in [('masters',128)]+[(f'{n}px',n) for n in manifest['sizes']]:
        rel=Path(folder)/icon['category']/(icon['name']+'.svg')
        file=ROOT/rel
        file.parent.mkdir(parents=True,exist_ok=True)
        content=svg(icon,size,folder=='masters')
        ET.fromstring(content)
        file.write_text(content,encoding='utf-8')
        paths[folder]=rel.as_posix()
    manifest['icons'].append({k:icon[k] for k in ['category','name','label']}|dict(files=paths))
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
cards=''.join(f'<article><img width="128" height="128" src="128px/{i["category"]}/{i["name"]}.svg" alt="{i["label"]}"><h2>{i["label"]}</h2><code>{i["category"]}/{i["name"]}</code><div class="sizes">'+''.join(f'<img width="{s}" height="{s}" src="{s}px/{i["category"]}/{i["name"]}.svg" alt="{s} pixel variant" title="{s}px">' for s in [32,48,64])+'</div></article>' for i in ICONS)
(ROOT/'preview.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estella Sticker Pack</title><style>
*{box-sizing:border-box}body{margin:0;background:#FFF1E1;color:#2B1B12;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:44px 24px}h1{font-size:40px;line-height:1.1;margin:8px 0}header p{max-width:680px}small{font-weight:800;letter-spacing:2px}button{padding:10px 16px;border:2px solid #2B1B12;border-radius:20px;background:#FFF7DD;color:#2B1B12;cursor:pointer;margin:8px 0 24px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:18px}article{background:#fff8ef;border:1px solid #EEDFCB;border-radius:22px;padding:24px;text-align:center}h2{font-size:18px;margin:10px 0 2px}code{font-size:11px;color:#6E5B4E}.sizes{display:flex;align-items:center;justify-content:center;gap:15px;min-height:90px;margin-top:15px;border-top:1px solid #EEDFCB}img{object-fit:contain}.dark article{background:#504F51}.dark article h2,.dark article code{color:#fff1e1}.dark .sizes{border-color:#777}footer{margin-top:30px;color:#6E5B4E}
</style><main><header><small>ESTELLA / ASSET LIBRARY / 01</small><h1>Little stickers. Real progress.</h1><p>28 original SVG illustrations, including 12 muscle and exercise categories. Warm paper edges, brown ink, bright fitness colors. Main samples: 128px. Below each: actual 32, 48 and 64px exports.</p><button onclick="document.body.classList.toggle('dark')">Toggle dark review surface</button></header><section>'''+cards+'''</section><footer>Sizes: 32 · 48 · 64 · 128 · 256px. Editable masters and handoff guide included. Concept pack — app integration is intentionally separate.</footer></main></html>''',encoding='utf-8')
# A dedicated entry point keeps new muscle stickers from getting lost below the original pack.
import re
muscle_cards = ''.join(card for card in re.findall(r'<article>.*?</article>', cards) if '128px/muscles/' in card)
page = (ROOT/'preview.html').read_text(encoding='utf-8')
muscle_page = page.replace(cards, muscle_cards).replace('Little stickers. Real progress.', 'Muscle category stickers').replace('28 original SVG illustrations, including 12 muscle and exercise categories.', '12 muscle and exercise category stickers. Glutes is represented by a purple plum.')
(ROOT/'muscle-preview.html').write_text(muscle_page, encoding='utf-8')
page = page.replace('<section>', '<p><a href="muscle-preview.html" style="color:#127F73;font-weight:800">View the 12 new muscle stickers →</a> · <a href="milestones/preview.html" style="color:#127F73;font-weight:800">View milestone badges →</a></p><section>', 1)
(ROOT/'preview.html').write_text(page, encoding='utf-8')
print(f'Built and XML-validated {len(ICONS)*6} SVGs, manifest.json and both preview pages in {ROOT}')

