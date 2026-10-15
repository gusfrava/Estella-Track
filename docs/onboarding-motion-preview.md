# Testing the onboarding motion branch

Developed on `codex/onboarding-motion`; integrated into local `main`.

From the repository directory, run:

```powershell
git branch --show-current
node tools/serve-preview.cjs 4180
```

Open http://127.0.0.1:4180/tools/onboarding-preview.html.

This preview imports the real onboarding view, controller, translations and starter-plan builder. It does not import authentication or Firebase synchronization, so test answers and generated plans stay in memory. Restart resets the preview. ES / EN changes the language. The full application is at http://127.0.0.1:4180/ and uses the normal authentication flow.

Walk through Welcome → Character → Goal → Focus → Experience. Back navigation retains the choice. All existing questions and validation remain unchanged. There is no separate glutes answer in the current onboarding schema; this branch does not add one.

| Screen / answer | Motion |
| --- | --- |
| Welcome | Smiling wave |
| Selected Estella | Small nod and restrained cheer |
| Strength | One-hand cartoon elephant lift |
| Muscle | Muscular Estella flexing |
| Fat loss | Confident modeling poses |
| Athletic performance | Soccer kick |
| Health and wellbeing | Yoga tree pose |
| Balanced focus | Stretch |
| Legs focus | Leg extensions |
| Upper body focus | Bench press |
| Arms focus | Biceps curls |
| Never trained | Lightly tangled resistance-band moment |
| Beginner | Figuring out a functional trainer |
| Intermediate | Hack squat |
| Advanced | One-arm push-up |
| Training location | Lying comfortably on a mat and tapping her cheek, with a gap below the choices |
| Days per week | Walking in the park with a large white pit bull, in the lower space |
| Workout duration | Back toward the viewer, considering a calendar, below the choices |

Check desktop and phone widths, then enable reduced motion in your browser or operating system. Choice-specific animations run two short cycles (4.4 seconds total) and settle on the first frame. The three single-scene bottom animations (location, days, duration) run for five seconds total from screen entry, then settle. Changing an answer on the same screen preserves that clock and does not replay a finished animation. Leaving and returning to the screen starts a fresh five-second preview. The park walk uses four 1.25-second cycles with alternating human and dog strides; the two quieter scenes use two 2.5-second cycles. Reduced motion shows a still image. This is illustrated keyframe artwork, not newly in-betweened animation.

The integration changes only the artwork on welcome, character, goal, focus, experience, location, days and duration screens, with a CSS file, presentation helper and 72 WebP frames (only the current scene's four frames are requested). A tiny presentation-only custom element waits for frames to decode before starting the CSS sequence. A missing frame leaves the existing SVG mascot visible. Continue stays below the answer list on screens with added artwork. Existing answer storage, routes, controller, translations and plan-building rules are unchanged.

New source sheets and PNG/WebP frames were created and verified in `mockups/onboarding-motion/assets` and the separate `animations-only.html` gallery before being copied into app assets.

The dog has separate reusable assets in `mockups/onboarding-motion/assets/dog`: a transparent sitting cutout, walking sprite sheet, and individual PNG/WebP walking frames. The gallery has 21 scenes, including the dog-only walk.

Equipment references checked for the new artwork: [Hammer Strength hack squat](https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/hack-squat), [Life Fitness functional-trainer exercise poster](https://support.lifefitness.com/hc/en-us/articles/360038611793-Life-Fitness-Axiom-OP-DAP-Dual-Adjustable-Pulley-Exercises-Poster). The elephant lift is intentionally a cartoon gag.

Git branches do not have separate local URLs automatically: this server reads the current checkout. The onboarding integration is committed and merged into local `main`; publishing the live app is a separate step. Original source artwork and unrelated logo exports remain outside the integration commit.

Browser regression check (requires Playwright and Chrome; the supplied script uses this workstation's bundled Playwright path):

```powershell
node tools/test-onboarding-motion.cjs
```

The check covers the actual onboarding flow, every goal/focus/experience mapping, character selection, selected answers, required-field validation, plan generation, image decoding, single-frame visibility, settled state, 320px layout without the footer covering answers, reduced motion and missing-image fallback.
