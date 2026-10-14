# Estella Sticker Pack

Original SVG concept pack inspired by the supplied sticker reference and Estella's existing app palette. Created separately from the application; no app assets or screens have been replaced.

## Start here

Open `preview.html` in a browser. Every icon is shown at 128px and at actual 32, 48 and 64px sizes. The button switches the card backgrounds to dark gray for checking the cream sticker edge.

## Folder structure

```
estella-sticker-pack/
  masters/       Editable full-detail SVGs on a 128 × 128 coordinate grid
  32px/          Small version: heavier outlines, decorative details omitted
  48px/          Full-detail SVGs with 48 × 48 intrinsic size
  64px/          Full-detail SVGs with 64 × 64 intrinsic size
  128px/         Full-detail SVGs with 128 × 128 intrinsic size
  256px/         Full-detail SVGs with 256 × 256 intrinsic size
  manifest.json  Machine-readable inventory, palette and paths
  preview.html   Local visual catalog; no server or dependencies needed
  CLAUDE-HANDOFF.md
  tools/build.py Generator and source geometry (Python standard library)
```

Each artwork directory has the same category folders and filenames:

| Category | Filenames |
| --- | --- |
| fitness | dumbbell, kettlebell, running-shoe, stopwatch, yoga-mat |
| rewards | streak-flame, trophy, star, completion |
| planning | calendar, goal-target |
| wellbeing | water-bottle, heart, rest-moon |
| social | friends, cheer |

28 designs × 6 versions = 168 SVG files. SVG is resolution-independent; export sizes set the default display dimensions. Only the 32px export has different detail and stroke treatment. These are static illustrations, not animations.

## Art direction

Rounded, slightly asymmetric cartoon shapes; brown ink; cream die-cut border; short translucent offset shadow. Uses the app colors: ink #2B1B12, cream #FFF1E1, orange #FF6A2B, teal #3DC4B3, deep teal #127F73, yellow #FFC94D, pale paper #FFF7DD. Peach #E8A36B is a supporting skin color.

The friends icon depicts generic buddies, not approved portraits of Estella or Leo. This pack interprets the shared illustration style; character-specific likenesses need their own references and review.

## Editing

Each SVG contains named base and detail groups. Geometry is editable vector paths and basic shapes, with no raster images, fonts or external assets. Cream borders and shadows use SVG filters. Browsers support them; design-tool imports may handle filters differently. For a tool that drops the effect, recreate or expand the border/shadow there while keeping the source SVG.

The canonical reproducible geometry lives in `tools/build.py`. Edit that file and run `python tools/build.py` from this folder to regenerate all sizes, masters, preview and manifest. This overwrites generated exports. If editing a master directly in a vector editor, preserve that edit and update the generator before regenerating.

Use 32px for compact badges, 48–64px for cards, 128–256px for empty states and achievement illustrations. These decorative assets do not replace the need for simple back/close/delete controls or accessible text labels. For inline SVG reuse, prefix IDs per instance to avoid duplicate filter/title IDs. With `<img>`, SVG IDs are isolated; provide meaningful alt text or empty alt for decorative usage.

