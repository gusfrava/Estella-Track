# Firebase connection

Project: `estella-track---official`. The mobile app reuses the website's public configuration, v2 data model and security rules. No service-account key is bundled.

## Registered apps

Both platforms use `com.gusfrava.estellatrack`.

- iOS: `1:436604220343:ios:d2274fca3bb4c87067ae32`
- Android: `1:436604220343:android:5b89d757728269f567ae32`
- Downloaded client configuration: `config/firebase/GoogleService-Info.plist` and `config/firebase/google-services.json`.

These registrations are complete. They do not by themselves enable native Google sign-in. Android signing fingerprints, native OAuth setup and a development build remain pending. Email/password uses the Firebase JS SDK with AsyncStorage-backed auth persistence on native and browser persistence on web.

## Data and synchronization

The provider listens to profile, routines, sessions, exercise stats, body records, wallet and social data. Local mode uses its own device-only cache. Signed-in caches and queued writes are scoped by Firebase user ID. The queue drains sequentially and sign-out waits for pending writes; failed writes remain queued for retry.

New accounts receive a v2 profile. Legacy cloud data can use the existing website migration converter. Account deletion detaches listeners before deleting documents, preventing the profile initializer from recreating a deleted profile. Cached account data and its outbox are removed when leaving the deletion flow.

Points and badges remain server-owned. Mobile does not write reward totals. Existing Firestore rules and backend functions have not been changed.

## Validation still required

Use an emulator or dedicated test account for authentication, legacy migration, disconnected edits/reconnect, account switching, export and deletion. Do not test deletion against the owner's account. Browser local-mode tests do not establish cloud-sync or physical-device correctness.

References: https://docs.expo.dev/guides/using-firebase/ and the repository's `docs/DATA-MODEL.md`.
