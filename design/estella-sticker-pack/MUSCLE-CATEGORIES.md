# Muscle and exercise category stickers

12 new illustrations in `masters/muscles/` and in `32px/muscles/`, `48px/muscles/`, `64px/muscles/`, `128px/muscles/`, `256px/muscles/`.

| Filename | Meaning | Current exercise group |
| --- | --- | --- |
| chest.svg | Chest, front torso with orange pecs | pecho |
| back.svg | Back, rear torso with teal back muscles | espalda |
| shoulders.svg | Orange shoulder caps | hombros |
| arms.svg | Flexed arm | brazos |
| legs.svg | Both legs | piernas |
| glutes-plum.svg | Purple plum with teal leaf | gluteos |
| core.svg | Highlighted abdomen | core |
| cardio.svg | Heart with lightning bolt | cardio |
| mobility.svg | Stretching figure | movilidad |
| quads.svg | Front thighs highlighted orange | Chart subdivision |
| hamstrings.svg | Rear thighs highlighted teal | Chart subdivision |
| calves.svg | Lower legs highlighted orange | Chart subdivision |

Glutes intentionally uses a **plum**, not a peach. The muted purple (#8B638C, shadow #624361) extends the shared palette for this recognizable fruit. These are simplified category symbols, not anatomical diagrams.

## Claude integration notes

`manifest.json` now includes `exerciseGroups` (actual Spanish exercise keys to icon stems) and `chartGroups` (English chart keys to icon stems). All mapped icons are in the muscles category. Example: `48px/muscles/glutes-plum.svg`.

Use 32px in chart labels or legends, and 48px in exercise-category tiles. Keep the visible text label, especially for quads versus hamstrings and the playful plum metaphor. Do not use icon color alone to distinguish categories. For dense chart axes, prefer a labeled legend to shrinking these assets below 32px.

The 32px variant preserves the highlighted muscle region while omitting optional highlights and decorative lines. All versions retain cream borders and short shadows. No app integration or chart behavior has been changed; these files are ready for the separate implementation step.
