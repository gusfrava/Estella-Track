# Sticker icons and achievement artwork

The approved `design/estella-sticker-pack` is the source. Runtime assets are copied into tracked `icons/stickers/` and `icons/badges/`; the app does not load files from the ignored design folder.

- Main decorative icons, cheers, matching onboarding choices, and exercise muscle-group chips use the static sticker family.
- `js/data/badge-art.js` maps the existing 22 achievement IDs to the source pack's assigned tiers. No earning rules, thresholds, or proposed milestones were added.
- Earned achievements load animated SVGs. A picture source selects static artwork when reduced motion is enabled.
- Unearned achievements load the **static** SVG directly and use a grayscale filter. CSS on a parent cannot pause animations inside an SVG image, so locked badges never load the animated variant.
- Badge names, descriptions, dates and progress remain localized. SVG artwork is decorative; the adjacent text provides its meaning.
- Simple edit, delete, back, close and completion controls retain their functional icons.

Preview: `http://127.0.0.1:4180/tools/badges-preview.html`. Preview wallets are fabricated in memory; this page does not write account data. The preview is in the locally ignored tools folder.

## Verification

Serve the repository on port 4180, then run `node tests/badges-mobile.cjs` with Playwright on the Node module path and its WebKit browser installed. `ESTELLA_PREVIEW_URL` can override the preview origin. This workstation uses Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` for the Chromium checks.

The mobile check uses iPhone 13 settings with Playwright WebKit and Pixel 7 settings with Chrome. It checks English and Spanish layouts, all 22 achievement assets, earned animation, locked grayscale and unchanged screenshot pixels over time, reduced-motion image selection, profile language changes, and muscle filtering. These are browser/device emulations, not physical iOS or Android device tests.

Also run `node tests/routine-video.cjs` and `node tools/test-onboarding-motion.cjs` for exercise expansion and the shared onboarding icons.
