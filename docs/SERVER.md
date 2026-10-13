# Estella's server (Cloud Functions)

Some things can't be trusted to a phone: anything friends see, points, streak rewards and leaderboards. Those are
calculated by small functions that run on Google's servers (Firebase Cloud Functions). The code is in `functions/`.

## What runs there today
- **Friend cards** (`profileCards/{uid}`): your week, weekly goal, streak and last workout, as your friends see them.
  - `cardOnSession` updates your card when a workout or activity changes (only when it matters: a new training day,
    a day removed, a new last workout; checking more sets in the same workout does nothing).
  - `cardOnProfile` updates it when your name, weekly goal or sharing settings change, rebuilds it from all your data
    when it's missing or outdated, and deletes it when you delete your account.
  - The app only reads cards. The Firestore rules let your friends read yours if "Tu perfil" is shared with friends
    (or public), and nobody can write one from a phone.
  - "Último entreno" is left out when "Entrenos" is set to private.

## One-time setup (already done on Jazmin's computer)
1. Install Node.js (LTS) from nodejs.org.
2. In a Command Prompt: `npm install -g firebase-tools`
3. `firebase login` (the Google account that owns the Firebase project)
4. `firebase projects:list` should show `estella-track---official`. The repo's `.firebaserc` already points at it.

## Deploying
Open a Command Prompt in the Estella Track folder (GitHub Desktop → Repository → Open in Command Prompt):

```
cd functions
npm install
cd ..
firebase deploy --only functions
```

- `npm install` is needed the first time and whenever `functions/package.json` changes.
- The first deploy asks to turn on some Google services (Cloud Build, Artifact Registry, Eventarc…): answer yes.
  If it then fails with a permissions / "service agent" error, wait 5 minutes and run the deploy again.
- If it asks how many days to keep container images, press Enter (the default keeps storage cost at zero).
- "User code failed to load … Timeout after 10000": your computer took more than 10 seconds to read the functions.
  Run `set FUNCTIONS_DISCOVERY_TIMEOUT=60` in the same Command Prompt, then deploy again.
- Changes to the app itself (everything outside `functions/`) don't need this: they go live with the GitHub merge as always.

## Publishing the Firestore rules
`firebase deploy --only firestore:rules` publishes `firestore.rules` (same as pasting it in the console).

## Checking it works
- Firebase console → Functions: `cardOnSession` and `cardOnProfile` are listed.
- Firebase console → Firestore → `profileCards`: a document per person after they open the app.
- Logs: `firebase functions:log`, or Firebase console → Functions → Logs.

## Tests
`cd functions` then `npm test`. Runs the card calculations and both functions against an in-memory copy of the
database (no Firebase account needed).

## Where it runs and what it costs
- Region `us-central1`, which is inside the database's location (`nam7`).
- At most 10 copies run at once (`maxInstances`), so a mistake can't run up a big bill.
- Free allowance: 2 million function runs a month. A normal workout triggers 1–3 runs.
