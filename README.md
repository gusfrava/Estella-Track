# Estella

A gym routine tracker. It's plain HTML, CSS and JavaScript modules, with no build step. It's hosted on GitHub Pages and uses Firebase for accounts and data.

## Running it
- **Live:** push the whole folder to your GitHub Pages repo.
- **On your computer:** open a terminal in this folder, run `python -m http.server 8000`, then go to http://localhost:8000. Double-clicking index.html won't work, because browsers block JavaScript modules opened from a file.
- **Connecting Firebase:** see SETUP-FIREBASE.md. The only file you edit is `js/config.js`.

## How it's built
Data only moves in one direction:

tap a button → `main.js` finds its action → the action calls the **store** → the store changes the data and tells everyone → the screen **re-renders** and **sync** saves it (on the phone, and to Firebase 0.5 s later).

Screens never change data directly, and the store never touches the screen or Firebase. That's what keeps a bug inside one layer.

## Folder map
```
index.html              Page shell: loads the styles and js/main.js. No logic.
manifest.webmanifest    App name, colors and icons for "Add to Home Screen".
sw.js                   Service worker: lets the installed app open offline.
legal/                  Privacy policy and terms (ES + EN). If you change them meaningfully, bump LEGAL.version in js/config.js.
icons/                  App icons.
data/                   The exercise library (same for everyone, shipped with the app). See docs/EXERCISE-LIBRARY.md.
  exercises.json        359 exercises: names ES/EN, muscle group, equipment, type, per side, muscle weights.
  exercise-videos.json  One technique video (YouTube link) per exercise. Fill these in over time.
tools/                  One-off scripts (build-library.mjs made data/exercises.json from the old app;
                        build-character.mjs turns a Figma character export into js/ui/characters/*.js). Not loaded by the app.
design/figma/           Figma exports the characters are built from (SVG with layer ids). Not loaded by the app.

css/
  tokens.css            Colors and fonts. Change the palette here only.
  base.css              Reset, page column, headings.
  components.css        Buttons, pen/bin icons, inputs, steppers, toggles, messages.
  screens.css           Layout of home, routine, sign-in and loading screens.
  overlays.css          Bottom sheets, confirmations, "¡Rutina completada!".

js/
  main.js               Starts the app, picks which screen to show, maps every button to an action.
  config.js             Firebase keys. The only file you edit to connect Firebase.

  i18n/                 All text. es.js and en.js must have the same keys.
  utils/                Dates, formatting, ids, logging, username rules, YouTube links. No app logic.

  state/
    model.js            What a routine / session / exercise history looks like (read this first; full design in docs/DATA-MODEL.md).
    store.js            The ONLY place data changes: add, edit, delete, check. Each change lists the documents it writes.
    selectors.js        Read-only math: progress, ordering, weekly summary, weight change.
    session.js          Who's signed in and which top-level screen (loading / sign-in / app).

  services/
    storage.js          Everything saved on the phone (localStorage keys listed at the top).
    firebase.js         The ONLY file that talks to Firebase (sign-in + the user's document).
    sync.js             Connects store ↔ phone storage ↔ Firebase: listeners, saving each change, sign-in start/end.
    migrate.js          One-time move of old (v1) data into the v2 structure. Pure function, easy to test.
    library.js          Loads the exercise library + videos and searches it (Spanish/English, accents, plurals).

  controllers/
    auth.js             Sign-in logic: login, create account, reset password, Google.
    profile.js          Name + username form: live "is it free?" check and saving (claims the name atomically).
    account.js          Accepting policy/terms, email verification, "Download my data", "Delete account".
    onboarding.js       The welcome questions for new accounts: which screen, saving each answer, weight/height.

  views/                Build the HTML for each screen. No logic, no data changes.
    home.js  routine.js  progress.js  auth.js  username.js  consent.js  splash.js  partials.js  onboarding.js
    (onboarding.js = the first language screen + the welcome questions)
    (progress.js = the Progreso tab: personal records; the bottom tab bar is tabBar() in partials.js)

  sheets/               The pop-up panels and what their Save buttons do.
    routine-form.js  exercise-form.js  activity-form.js  plus-menu.js  account.js  delete.js  fields.js
    profile-form.js  privacy.js  delete-account.js
    exercise-picker.js  "Añadir ejercicio" step 1: search the library or browse by muscle group.
    video.js            "Ver técnica": plays the YouTube video in a sheet (loads only on tap).

  ui/
    router.js           Which screen shows (Rutinas tab, Progreso tab, a routine), and the phone's back button.
    sheet.js            Opening/closing bottom sheets, and the "are you sure?" sheet.
    motion.js           List reordering animation, confetti, the completion card.
    toast.js            The short message at the top ("¡Nuevo récord!").
    mascot.js           Draws the mascot (mood, full body or bust, hop). characters/ holds each character's drawing.
                        Its animations (blink, breathing, hop) are in css/mascot.css.
    icons.js            SVG icons.
    onboarding-icons.js Icons for the welcome questions (Tabler Icons, MIT).
```

## Where to look when something breaks
- **Wrong text or a missing translation:** `js/i18n/es.js` / `en.js`
- **A button does nothing:** turn on debug mode (below). It logs `[ui] action <name>`, or `no handler for data-action = <name>` if the action isn't in `ACTIONS` in `main.js`.
- **Data is wrong after a tap** (checking, deleting, "done this week"): `js/state/store.js`, then `selectors.js`
- **Numbers on screen are wrong** (progress, "1/3", "↑ +2.5 kg"): `js/state/selectors.js`
- **Looks wrong but the data is right:** the screen's file in `js/views/`, then `css/`
- **A form saves the wrong thing:** its file in `js/sheets/`
- **An exercise is missing from search, or found under the wrong group/type:** `data/exercises.json` (data) or `searchLibrary()` in `js/services/library.js` (matching)
- **Sign-in errors:** `js/controllers/auth.js`. Error wording is under `errors` in the i18n files.
- **Delete account or data download fails:** `js/controllers/account.js`, then `deleteUserData` / `exportUserData` in `firebase.js`. Deleting asks for the password (or Google) again first.
- **Username won't save / says taken:** `js/controllers/profile.js` and the `usernames` rules. Each taken name is a document in `usernames/` in the Firebase console.
- **Data isn't saving or syncing between phones:** `js/services/sync.js`, then `firebase.js`. Also check the Firestore rules. With `?debug`, every save logs `[sync] saved N doc(s)`.
- **Old data looks wrong after updating:** `js/services/migrate.js`. The original data is still in `users/{uid}.state` in the Firebase console.
- **The installed app shows old code:** `sw.js`. Change `CACHE` to the next number and push.

## Debug mode
Add `?debug` to the URL (for example `…github.io/estella-track/?debug`) and open the browser console. Every layer logs with its own tag: `[store]`, `[sync]`, `[firebase]`, `[auth]`, `[session]`, `[router]` and `[ui]`. You'll also get these helpers in the console:
- `estella.state()` shows the current data
- `estella.session()` shows who's signed in and which screen is showing
- `estella.view()` shows the current screen inside the app

Warnings and errors always print, even without `?debug`.

## Updating the mascot from Figma
1. In Figma select the character's part library frame → Export → **SVG**, with **"Include 'id' attribute" ON**.
2. Save it over `design/figma/estella-part-library.svg`.
3. Run `node tools/build-character.mjs design/figma/estella-part-library.svg js/ui/characters/estella.js` (or ask Claude to).
Layer names the script relies on: "Estella / Character / Starter", "Expression / face features", "Expression=Amused|Focused|Excited|Blink",
"Neck_2" and "Hair / front fringe_2". If they're renamed in Figma, update the names at the top of the script.
