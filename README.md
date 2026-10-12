# Estella Track

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
icons/                  App icons.

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
  utils/                Dates, formatting, ids, logging. No app logic.

  state/
    model.js            What a routine / exercise / activity looks like (read this first).
    store.js            The ONLY place data changes: add, edit, delete, check, weekly reset.
    selectors.js        Read-only math: progress, ordering, weekly summary, weight change.
    session.js          Who's signed in and which top-level screen (loading / sign-in / app).

  services/
    storage.js          Everything saved on the phone (localStorage keys listed at the top).
    firebase.js         The ONLY file that talks to Firebase (sign-in + the user's document).
    sync.js             Connects store ↔ phone storage ↔ Firebase. Sign-in session start/end.

  controllers/
    auth.js             Sign-in logic: login, create account, reset password, Google.

  views/                Build the HTML for each screen. No logic, no data changes.
    home.js  routine.js  auth.js  splash.js  partials.js

  sheets/               The pop-up panels and what their Save buttons do.
    routine-form.js  exercise-form.js  activity-form.js  plus-menu.js  account.js  delete.js  fields.js

  ui/
    router.js           Home vs routine screen, and the phone's back button.
    sheet.js            Opening/closing bottom sheets, and the "are you sure?" sheet.
    motion.js           List reordering animation, confetti, the completion card.
    icons.js            SVG icons.
```

## Where to look when something breaks
- **Wrong text or a missing translation:** `js/i18n/es.js` / `en.js`
- **A button does nothing:** turn on debug mode (below). It logs `[ui] action <name>`, or `no handler for data-action = <name>` if the action isn't in `ACTIONS` in `main.js`.
- **Data is wrong after a tap** (checking, deleting, weekly reset): `js/state/store.js`
- **Numbers on screen are wrong** (progress, "1/3", "↑ +2.5 kg"): `js/state/selectors.js`
- **Looks wrong but the data is right:** the screen's file in `js/views/`, then `css/`
- **A form saves the wrong thing:** its file in `js/sheets/`
- **Sign-in errors:** `js/controllers/auth.js`. Error wording is under `errors` in the i18n files.
- **Data isn't saving or syncing between phones:** `js/services/sync.js`, then `firebase.js`. Also check the Firestore rules.
- **The installed app shows old code:** `sw.js`. Change `CACHE` to the next number and push.

## Debug mode
Add `?debug` to the URL (for example `…github.io/estella-track/?debug`) and open the browser console. Every layer logs with its own tag: `[store]`, `[sync]`, `[firebase]`, `[auth]`, `[session]`, `[router]` and `[ui]`. You'll also get these helpers in the console:
- `estella.state()` shows the current data
- `estella.session()` shows who's signed in and which screen is showing
- `estella.view()` shows the current screen inside the app

Warnings and errors always print, even without `?debug`.
