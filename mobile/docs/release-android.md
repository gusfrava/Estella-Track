# Publishing on Google Play

Package: `com.gusfrava.estellatrack`. Builds run on EAS (`eas.json`): `production` makes the signed `.aab` for Play, `preview` an installable `.apk` for testing, `development` the dev client. Version codes are managed by EAS (`appVersionSource: remote`, `autoIncrement`). App icon sources: `assets/store/` (`play-store-icon.png` is the 512×512 listing icon; regenerate the app icons with `scripts/make-icons.cjs`).

## 1. Google Play Console account

- Sign up at https://play.google.com/console ($25 once, identity verification can take days).
- A **personal** account must run a **closed test with at least 12 testers opted in for 14 days in a row** before it can apply for production. An **organization** account (needs a D-U-N-S number) skips that.

## 2. Create the app

Play Console → **Create app**: name *Estella Track*, app (not game), free, accept the declarations. Then finish every item under **Policy → App content**:

| Item | Answer |
|---|---|
| Privacy policy | https://gusfrava.github.io/Estella-Track/legal/privacy.html |
| App access | Most features work with **"Try it without an account"**; Friends needs an account: give reviewers a test account. |
| Ads | No ads |
| Content rating | Questionnaire (no violence, no user-generated media; users can see friends' names and workouts) |
| Target audience | 16 and older (matches the sign-up age check) |
| Data safety | Collected: email, name, @username, workouts and routines, body weight/height (optional). Stored in Firebase, encrypted in transit, not sold, not used for ads. Users can delete their account and data in the app. |
| Health apps | Declare fitness/workout tracking. |
| Account deletion | A **web URL** where people can request deletion is required, besides the in-app button. *(Still to make: a page next to the privacy policy.)* |

**Store listing**: short description (80 characters), full description, the 512×512 icon (`assets/store/play-store-icon.png`), a 1024×500 feature graphic and at least 2 phone screenshots.

## 3. Build

From `mobile/` (logged in to Expo as the project owner):

```bash
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile production
```

`init` links the app to an EAS project once (adds its id to `app.json`). On the first build, let EAS **generate the Android keystore**: it keeps the upload key for every later build.

## 4. Upload the first build

Easiest the first time: download the `.aab` from the EAS build page and upload it in Play Console → **Testing → Internal testing** (or **Closed testing**). Later builds can go up with `npx eas-cli@latest submit --platform android` once a Google Service Account key is added to EAS (`eas credentials`); `eas.json` sends them to the internal track as drafts.

## 5. Firebase: Google sign-in for the store version

Play re-signs the app, so Google sign-in only works once Firebase knows those certificates:

1. Play Console → **Test and release → App integrity → App signing**: copy the **SHA-1** and **SHA-256** of the *App signing key certificate* and of the *Upload key certificate*.
2. Firebase console → **Project settings → General → Your apps → com.gusfrava.estellatrack → Add fingerprint**: add all four.
3. Download the updated `google-services.json` into `config/firebase/`.

Install the testing version from Play and try **Continue with Google** before inviting testers.

## 6. Closed test → production

Testing → **Closed testing**: create the track, add the testers (an email list or a Google Group), share the opt-in link, and keep at least 12 opted in for 14 days. Then **Apply for production** from the dashboard; review usually takes a few days.
