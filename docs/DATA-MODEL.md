# Estella: data model v2

**Status: approved design, built in phases.**
- **Built:** `users/{uid}` profile and sharing settings, `routines`, `sessions`, `exerciseStats`, the automatic v1 → v2 migration, usernames (`usernames/{name}`, claimed in one batch with the profile) and the privacy settings screen, with matching `firestore.rules`. Friends part 1: search directory, friend requests and friend lists. Friends part 2: friend cards (`profileCards/{uid}`), written by the server (`functions/`, see docs/SERVER.md). Friends part 3: cheers and shared routines ("Copiar rutina").
- **Not built yet:** groups, trainers, mascot and leaderboards. Each piece arrives with its feature. Friends can read the friend card and the shared routines (both built by the server); the person's own routines, sessions and stats stay readable only by them.

## Principles
1. **Data lives under its owner. Sharing is a setting.** Nothing is locked away for good. Each kind of data has a "who can see this" level that the owner chooses.
2. **Plans are separate from logs.** A *routine* is the plan. A *session* is what actually happened on a given day: a gym workout or another activity. "Done this week" is calculated from this week's sessions, so nothing needs to be reset every Monday.
3. **Summaries keep screens fast.** Per-exercise stats, weekly cards and leaderboards are pre-built, so each screen opens with one read.
4. **The server writes anything that gives rewards or rankings:** points, mascot growth, streaks, weekly cards and leaderboards. Nobody can edit these from their phone.
5. **Shares and posts are snapshots.** Sharing a routine in a post copies it as it was at that moment. It never opens a door into private data.

## Visibility
There are three levels:
- **private:** only the owner.
- **friends:** people the owner accepted.
- **public:** any signed-in Estella user.

| What | Default |
|---|---|
| Profile card (name, username, mascot, level, streak, weekly card) | friends |
| Routines | friends |
| Workouts (sessions, weights, PRs, charts) | friends |
| Body data (weight, measurements) | private |

Trainers don't use these levels. Each trainer gets their own permission from the client (see `coaching`).

## Usernames
- Every user picks a unique username during onboarding: 3–20 characters, using `a–z 0–9 _ .`, saved in lowercase. Some names are reserved (admin, estella, support…).
- Uniqueness comes from `usernames/{username} → { uid }`. The rules only allow creating that document if it doesn't exist yet and the uid belongs to the signed-in user.
- **Finding people:**
  - Anyone can be found by their **exact** username, which is how you add a friend.
  - Only **public** profiles show up in search, browsing and charts. Users can also turn off "show me in search".

## Collections
```
users/{uid}                         PRIVATE settings (owner only)
  username, displayName, lang, units, goal, createdAt, discoverable,
  sharing: { profile, routines, workouts, body },       // 'private' | 'friends' | 'public'
  weeklyGoals: { 'YYYY-MM-DD': days },                // weekly goal by the Monday it started (onboarding days, or "Meta semanal" on home);
                                                       // a week counts for the streak when its goal is met
                                                       // (or a comodín saves it: start with 1, +1 every 4 goal weeks, max 2;
                                                       //  worked out from history in selectors.weeklyStreak, never stored)
  units: 'kg' | 'lb',                                   // chosen in onboarding; default for new exercises
  onboarding: { version, character, goal, focus: 'balanced'|'legs'|'upper'|'arms', experience, place, daysPerWeek, minutes, source,
                startedAt, completedAt, skippedAt,      // saved after every answer (js/controllers/onboarding.js)
                starterPlan: { version, choice: 'saved'|'skipped', routines: ['fbA', …], at } },
                                                        // the plan proposed on the last screen; saved = its routines were created
    // goal: strength|muscle|fat|athletic|health · experience: never|beginner|intermediate|advanced
    // place: gym|small|home|body · daysPerWeek: 1–7 (the weekly goal) · minutes: 30|45|60|90
    // source: instagram|tiktok|youtube|friend|search|ad|other
  legal: { version, acceptedAt, minAgeConfirmed }       // accepted privacy policy + terms (re-asked when LEGAL.version changes)

  routines/{routineId}              the plan
    name, order, days[0-6], recurring, archived, updatedAt,
    exercises: [{ id, exerciseId, name, type, perSide, restSec, note,
                  target: { sets, reps, weight, unit, seconds } }],
    // type: 'weight_reps' | 'reps' | 'time' – what a set measures. perSide: reps logged for left and right.
    // exerciseId: the library exercise it was picked from (data/exercises.json), null for your own.
    // video: your own YouTube link ('' = the library's video for exerciseId, else a YouTube search).
    source: null | { type: 'friend'|'group'|'trainer'|'post', id, routineId, name },   // 'friend' = Copiar rutina
    assignedBy,                      // trainer uid when assigned
    current: { sessionId, weekKey }  // the session holding this week's check marks (latest one if not recurring)

  sessions/{sessionId}              the log: one per workout or activity
    kind: 'gym'|'activity', status: 'in_progress'|'done',
    date 'YYYY-MM-DD', weekKey, startedAt, finishedAt,
    routineId, routineName,
    exercises: [{ id /* routine exercise id */, exerciseId, name, type, note, doneAt,
                  sets: [{ kind: 'normal'|'drop'|'warmup', side: null|'L'|'R',
                           reps, repsR, weight, unit, seconds, done }] }],
    // repsR = right-side reps for per-side exercises (reps = left), null otherwise.
    // kind 'drop' = a drop set; it follows the set it belongs to and isn't counted as an extra set.
    // Per-set logging: an exercise entry is done when every set has done: true (older data without the
    // flag counts as done). Unchecked sets hold the values typed so far, while the workout is in progress.
    // doneAt is set when the last set is checked.
    activity: { sport, minutes, note },
    totals: { sets, volume, minutes }

  exerciseStats/{exerciseId}        summary per exercise (prefill + charts)
    name, points: [{ d, s, r, w, u }]   // one point per day it was done, capped at 500:
                                        // s = sets done (drops not counted), w = heaviest weight, r = best reps at that
                                        // weight (per side: the weaker side), t = longest time (time exercises only)
    (later: lastSets[], best: { weight, e1rm, volume, date })

  body/{date}                       { date, weight, weightUnit: 'kg'|'lb', heightCm, source: 'onboarding'|'manual', updatedAt }
                                    // health data: private, only if the person enters it; height always stored in cm
  friends/{friendUid}               { since, username, displayName }   // written for both people when a request is accepted
  customExercises/{id}              exercises not in the library
  mascot/state                      SERVER ONLY: level, xp, energy, muscles{…}, shape
  wallet/main                       SERVER ONLY: points, inventory[]

profileCards/{uid}                  SERVER ONLY (functions/card.js): what friends see. Readable by the owner; by friends when
                                    visibility is 'friends'; by anyone signed in when 'public'.
  v, visibility: sharing.profile, username, displayName, character,
  goals: { weekKey: days },         // weekly goal history (same as profile.weeklyGoals)
  weeks: { weekKey: '024' },        // days trained that week, 0 = Monday … 6 = Sunday (a checked set or an activity)
  pts:   { weekKey: '1' },          // days known only from old exercise history (v1 accounts), kept when a week is recomputed
  last:  { kind, name, sport, date } | null,   // last workout; null when sharing.workouts is 'private'
  updatedAt
  // The app works out this week, the streak and comodines from goals + weeks (selectors.streakFrom), so cards never go
  // stale. The app writes users/{uid}.cardRefreshAt to ask for a rebuild when its own card is missing or outdated.
  (later) mascot: { look, equipped, level }

sharedRoutines/{uid}                SERVER ONLY (functions/routines.js): routines friends can see and copy. visibility = sharing.routines
  v, visibility, routines: [{ id, name, exercises: [{ exerciseId, name, type, perSide, sets, reps, seconds }] }], updatedAt
  // no weights, notes or archived routines. Copying adds a routine with source: { type: 'friend', id, routineId, name }

cheers/{from}_{to}_{date}           { from, to, fromUsername, fromName, kind: 'fire'|'strong'|'clap', date, workout, createdAt }
                                    // a reaction to a friend's workout of that date; one per friend per workout day (another kind
                                    // replaces it). Only friends can send; only the two people can read; either can delete.
                                    // Index (to, createdAt desc) for "Te animaron". The cheer I sent is read by its id (no index).

usernames/{username}                { uid }
directory/{uid}                     { username, displayName, nameKey, lastKey, character, updatedAt }   // friend search; only while
                                    // "Aparecer en búsquedas" is on; nameKey/lastKey = name / name from its 2nd word, lowercase, no accents
friendRequests/{fromUid_toUid}      { from, to, fromUsername, fromName, toUsername, toName, status: 'pending'|'accepted', createdAt, respondedAt }
                                    // declining or cancelling deletes it; removing a friend deletes both lists' entries and the requests

groups/{groupId}                    name, inviteCode, createdBy
  members/{uid}                     role: 'member'|'trainer'|'admin'
  routines/{id}                     written by trainers, read by members, versioned

coaching/{clientUid_trainerUid}     the client's permission slip for one trainer
  status, permissions: { routines: 'none'|'read'|'assign', workouts: bool, body: bool }

leaderboards/{metric_period}        SERVER ONLY: top entries { uid, username, value }

(future) posts/{id}, posts/{id}/comments, posts/{id}/reactions, reports/{id}
```

**The exercise library (365 exercises)** ships as a static file, `js/data/exercises.json`, not as database documents. That makes it free, available offline and instant.

## Who can read what
- **Owner:** everything of their own.
- **Friend:** a friend is someone listed in `users/{owner}/friends/`. Friends can see the categories the owner set to `friends` or `public`.
- **Any signed-in user:** categories set to `public`, plus username lookup and friend search (`directory`: name, @username, character only).
- **Trainer:** only what the `coaching/{client_trainer}` document allows. A trainer can write routines into the client's list only with `routines: 'assign'`. Seeing body data needs its own explicit yes, because the EU treats health data as special.
- **Group members** read the group's routines. Trainers and admins write them.
- **Server only:** friend cards (`profileCards`), mascot state, wallet, streak rewards and leaderboards.
- Removing a friend or a trainer cuts their access immediately.

## Assigned routines
- **Group:** the trainer writes the routine once in `groups/{id}/routines`. Each member gets a linked copy, marked with `source: { type: 'group', id, version }`. When the trainer publishes a new version, members see "Tu entrenador actualizó la rutina" and choose whether to update. Their history stays intact either way.
- **One-on-one:** with `routines: 'assign'`, the trainer writes straight into `users/{client}/routines`, with `assignedBy` set.

## Charts and leaderboards
- Leaderboards are calculated by the server and include public profiles only.
- They start with consistency metrics: workouts per week, streak, active minutes. These are fair for every level and body type.
- Strength rankings come later and would need categories (bodyweight, experience).

## Mascot progression
There are two separate things:

**1. Points (currency).** You earn them and spend them in the store on gym wear and hairstyles. They're awarded by the server after each session. The amounts below are placeholders to tune later:
- Workout: +10
- Activity of 20 minutes or more: +5
- New personal record: +20
- Weekly plan met: +15
- Streak bonuses

**2. Growth (how the mascot looks).** The server recalculates it after every session:
- **Muscle definition per body region** (chest, back, shoulders, arms, core, legs), on a level from 0 to 5. A level goes up when the person's estimated strength on exercises for that region improves compared with *their own starting point*. The exercise library says which muscles each exercise works. Because it measures improvement and not absolute strength, a beginner progresses just as visibly as an advanced lifter.
- **Energy** comes from consistency. Training according to the plan keeps the mascot energetic. Weeks off make it look tired. Muscle levels only fade slowly, after about 4 weeks without training.
- **Level and XP** come from total effort over time.
- **Body shape** is only used if the person turns on body tracking. It's based on their own logged weight and stays private.

**Art needed:** every body region drawn at 6 definition levels as separate layers, about 3 energy expressions, a handful of body-shape presets, and clothing and hair layers that fit every shape.

## Server functions (needs the Blaze plan)
- `onSessionDone`: updates points, mascot growth, streak, the weekly card and leaderboards.
- `onUserDeleted`: a safety net that deletes anything left behind. (Today "Delete account" runs in the app: it deletes every document, frees the username, then deletes the sign-in.)
- Later: push notifications, AI features, moderation.

## Migration from v1
On the first launch of the new version:
- Routines from `users/{uid}.state` become `routines/` documents.
- Each exercise's check-off history becomes `sessions/`, grouped by date and routine.
- Activities become sessions with `kind: 'activity'`.
- `exerciseStats` are built from those sessions.

The old `state` field stays as a backup for 30 days.

## Cost
An active user makes roughly 50 reads and 20 writes a day. Firebase's free daily quota is 50,000 reads and 20,000 writes, and Cloud Functions are free up to 2 million calls a month. Hundreds of daily users stay at about $0. Set a budget alert anyway.
