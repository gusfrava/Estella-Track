# Exercise library

The built-in exercises live in two files in `data/`. They ship with the app (no Firestore reads, works offline)
and are the same for everyone. People can still create their own exercises; those live only in their routines.

## data/exercises.json

One exercise per line:

| field | meaning |
|---|---|
| `id` | Permanent id (e.g. `press_de_banca_con_barra`). Routines store it as `exerciseId`, so **never change or reuse an id**. To retire an exercise, leave it in. |
| `n` / `en` | Spanish / English name |
| `g` | Group for browsing: pecho, espalda, hombros, brazos, piernas, gluteos, core, cardio, movilidad |
| `eq` | Equipment, free text |
| `lv` | 0 any, 1 beginner, 2 intermediate, 3 advanced |
| `type` | `weight_reps`, `reps` or `time` (what a set measures) |
| `side` | 1 = done one side at a time (the "Por lado" switch starts on) |
| `s` | Score used to order lists (higher first) |
| `sv`, `cw` | Muscle weights (0–100) for the muscle maps later |

It was made from the old app's list with `tools/build-library.mjs`, which also fixed groups and types the old
list had wrong (e.g. rows marked as "time", calf raises under "core").

## data/exercise-videos.json — adding technique videos

Each exercise has a line with its Spanish name and an empty `"video"`. To add one:

1. On GitHub, open `data/exercise-videos.json` and click the ✏️ pencil.
2. Press **Ctrl+F** and type the exercise's Spanish name (e.g. `Hip thrust con barra`).
3. Paste the YouTube link between the quotes:
   `"hip_thrust_con_barra": { "name": "Hip thrust con barra", "video": "https://youtu.be/xxxxxxxxxxx" },`
   Any YouTube link works: youtu.be, youtube.com/watch?v=…, Shorts.
4. **Commit changes…** → choose *Create a new branch… and start a pull request* → merge it like any other PR.

Add as many as you like per PR. Keep the quotes and the comma at the end of the line; GitHub shows a red mark if
the file breaks. Pick videos that allow embedding (most do; if one shows "Video unavailable" in the app, choose another).

Which video plays for "▶ Ver técnica": the person's own link (exercise form) → this file → a YouTube search.
