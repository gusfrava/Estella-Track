# Estella milestone badges — current handoff

Open preview.html. Use Pause motion to switch the entire catalog to static assets.

## Active inventory
42 badge designs: seven families with six tiers each. 252 static SVGs and 252 animated SVGs, including masters and 32, 48, 64, 128, 256px sizes. manifest.json is authoritative. Each badge has one assigned tier, variants containing static paths, animatedFiles, and conceptOnly. Twenty-two badges exist in the app; twenty are artwork-only proposed milestones.

## Thresholds by tier
Order: bronze, silver, gold, platinum, diamond, titanium.
- Workouts, records, cheers sent, cheers received, copied routines: 1, 10, 25, 50, 100, 250.
- Streak weeks: 2, 4, 8, 12, 26, 52.
- Friends: 1, 5, 10, 25, 50, 100.
These art mappings do not modify app/server rewards. Preserve existing badge IDs and only enable new milestones when explicitly requested.

## Creative progression
- Workouts: beginner to exaggerated muscular titanium gym buddy; gentle flex pulse.
- Streaks: flame flicker.
- Records: individual trophy to increasingly full trophy cabinet; brief wobble.
- Friends: one friendly face to a crowd; gentle bob.
- Cheers sent: solo cheerleader, duo, trio, squad, six-person human pyramid; small cheer hop.
- Cheers received: pleased face to sunglasses-wearing red-carpet celebrity with stars; playful wobble.
- Copies: petty thief, paper stacks, loot bag, safecracker, kingpin, fictional politician at podium; sneaky sway.
Titanium rims use a chrome gradient with teal, violet and pink reflections. The politician belongs ONLY to copied routines.

## Paths and editing
Static: {size}/{family}/{tier}/{id}.svg.
Animated: animated/{size}/{family}/{tier}/{id}.svg.
Earlier unused designs in archive-alternatives are excluded from the manifest; do not integrate them.
Source: ../tools/build_badges.py, run from the parent pack with python tools/build_badges.py. It also regenerates the ordinary sticker pack.
No app source files or earning rules were changed. SVGs are self-contained vector assets with vector numerals, SVG filters and CSS keyframes. No raster assets or external fonts.

## Motion and accessibility
Animation currently transforms whole center illustrations, not individually rigged arms and legs. Badge frames and milestone numerals remain stable. Animated SVGs honor prefers-reduced-motion. Use static exports for charts, print, import into vector tools, or quiet interfaces. Keep localized text labels and tier names visible. Locked state is independent of tier.
XML and inventory consistency have been validated. Browser rendering and animation playback still require visual review. The catalog provides actual small-size samples; detailed scenes may need further simplification after review at 32px.
