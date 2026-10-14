# Handoff for Claude

## Scope

This is an isolated proposed artwork pack. The application has not been integrated with it. Review the user's requested changes before editing application files.

## Suggested prompt

> Review design/estella-sticker-pack/README.md, manifest.json and preview.html. Adjust this original SVG sticker family to match Estella and Leo's approved character references. Keep the folder structure, semantic filenames, transparent backgrounds, cream cutout border, brown outlines and consistent shadow direction. Preserve 32, 48, 64, 128 and 256px exports and editable masters. The 32px version should remain simplified. Make reusable changes in tools/build.py and regenerate all exports. Do not integrate the assets into the app until I ask.

## Design checks

- Keep the cream border readable on both cream and dark backgrounds.
- Keep artwork and shadow within the viewBox; check all five sizes.
- Preserve strong silhouettes. Avoid extra facial detail at small sizes.
- Use the shared palette in manifest.json; avoid introducing unrelated colors.
- Compare the drawing treatment with supplied character references. Generic friends are not character portraits.
- Review legibility at actual output size, not only zoomed in.

## Verification

Run `python tools/build.py` from this folder. It builds 96 SVGs and parses each as XML. Open preview.html for visual verification. Check that only files in this pack changed when the request is artwork-only. XML validation does not prove visual quality or compatibility with every SVG importer.

## Future integration candidates (only when authorized)

- js/ui/icons.js: dumbbell, flame, trophy and star equivalents.
- js/ui/cheer-icons.js: strength, fire and encouragement illustrations.
- js/views/home.js: activity illustrations and weekly summary accents.
- js/views/progress.js: records, streaks and goal illustrations.

Do not blindly replace 24px utility icons with detailed stickers. Keep interaction targets and accessible labels intact. Use static SVG for the initial pack; motion should be a separate approved step.
