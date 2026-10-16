# Estella Track mobile

Native React Native screens using Expo SDK 57 and Expo Router. This migration is in progress; it is not yet a production-ready, exact copy of the website.

## Run

From `mobile/`, run `npm install`, then `npm start`. Press `w` for the browser preview. For a phone on the same Wi-Fi, use `npx expo start --lan` and scan the QR code with Expo Go. A localhost-only server cannot be opened from another device. Native Google sign-in will require a development build and additional OAuth/signing setup.

## Organization

- `src/app/`: Expo Router entry points.
- `src/screens/`: native onboarding, authentication, routines, progress, friends, account, badges and recap screens.
- `src/components/`: shared controls, artwork, motion playback, starter-plan details and technique video players.
- `src/features/workouts/`: routine, exercise, activity and goal forms.
- `src/providers/AppProvider.jsx`: authentication, account lifecycle, subscriptions, local cache and cloud write queue.
- `src/core/`: shared website business logic, translations, exercise library, data models and Firebase adapter.
- `src/services/`: platform-specific persistence and file export.
- `src/theme/`, `assets/motion/`: shared design tokens and reused artwork.
- `scripts/sync-core.cjs`: copies selected website modules and generates artwork imports. Change this script when adapting generated modules; do not edit generated files alone. The mobile storage adapter is handwritten.
- `docs/firebase.md`: Firebase registrations, data boundaries and remaining validation.

The app uses the existing v2 routines/session schema. Local mode stays on the device. Authenticated mode connects to the existing Firebase project and can write real account data. Points and earned badges are read from the server-owned wallet, never calculated into it by the client.

React Compiler is disabled because the reused website store mutates state outside React; automatic memoization previously left routine cards stale. Keep it disabled until the store has an immutable subscription interface.

## Validation

Run `npm run typecheck` and `npm run lint`.

With the preview running at `http://localhost:8081` and Playwright available:

- `node tests/native-flow.cjs`: local routine creation, exercises without videos, set edits/completion, drop sets, persistence, progress, badges and language switching at iPhone 13 and Pixel 7 viewport sizes.
- `node tests/onboarding-flow.cjs`: starter-plan generation, volume summary, saving and reload persistence.
- `npx expo export --platform all`: bundle validation, not physical-device testing.

Browser device profiles do not validate native iOS/Android behavior. Cloud account deletion, reconnect/conflict handling, native Google sign-in, native media/export and physical-device layouts still need dedicated validation. Remaining parity work includes feedback sounds/haptics, earned-badge motion, recap image sharing, social deep links and final visual comparison. App icons/splash still contain template assets.

Keep changes local for review. Branching, commits, PRs and publishing are managed by the project owner.
