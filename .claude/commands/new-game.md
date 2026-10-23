---
description: Roll a theme and build the next Daily Incremental game, with a pacing sim and browser test
argument-hint: "[optional steering, e.g. \"Use seed 12345\" or \"Make the interaction catch-falling-things\"]"
---

Make the next Daily Incremental game. Read CLAUDE.md first and follow it exactly; it's the design bar and checklist.

1. Roll the theme. Run `python3 tools/roll.py`, or `python3 tools/roll.py <seed>` if a seed is given below. It picks a subject, verb, object, interaction and number scale from fixed lists. Use exactly what it rolls; don't reroll, swap words or pick your own, because the point is to get ideas you wouldn't choose. The only exception is steering written below, which overrides the parts it names. If it notes a repeat of a recent game, keep the roll and make the game feel different anyway. Show me the roll, then pitch the game in 3–4 sentences: the premise, the core action, what the upgrades are, and how it ends. Make it play differently from the games already in public/, not a reskin. Then build it without waiting for approval.

2. Build it as public/<slug>/index.html, where slug is the title in lowercase with hyphens, starting from templates/game.html. Set data-day to the next "n" in public/games.json; numbers are internal ids only, so never show them to players. It needs:
   - the rolled interaction as the core action, understood within five seconds, working with both mouse and touch
   - pleasant synthesized Web Audio sounds for every action, an unlock chime, a purchase sound and a finale, plus a mute toggle using the `di:sound-muted` key
   - an upgrade column on the right (stacking below on phones) where new unlocks pulse with a "new" tag and the heading shows how many are affordable
   - a mix of real upgrades and a few silly one-offs that add story, a meter that tracks the emotional arc, and flavor text in a log line
   - a real ending that calls DailyGame.finish() once with short, emoji-led share lines, plus a Share button
   - a distinctive look of its own (palette, Google Fonts, canvas art), not a copy of the earlier games

3. Check the pacing before you call it done. Write a quick headless sim of a reasonable player: one manual action every ~1.3s, buying the cheapest affordable upgrade. Tune costs until the sim finishes in 6–9 minutes (real players take longer), with a purchase every 15–30 seconds and no dead stretches. Show me the purchase timeline.

4. Test it in a real browser. Run `npm run check -- <slug>` (first time on a machine: `npm install && npm run setup`). It checks that the ending and upgrades are hidden at the start, plays the opening, loads a finished save to check the ending and share card, checks for sideways scroll at 390px, and fails on console errors. It relies on the conventions in CLAUDE.md (`#ending`, `#shareBtn`, upgrades as buttons in `#shop`, a save with `ended: true` resuming into the ending). Then look at every screenshot in tests/screenshots/ and fix anything that looks off. If the core interaction needs more than the script's generic drag-and-tap, play it with a short Playwright script of your own.

5. Add the entry to public/games.json, dated the day after the last one, with n, slug, title, tagline, emoji, scale and minutes, plus `seed` and `interaction` from the roll. Then run `npm run og` to render its social card and refresh the landing card, look at public/<slug>/og.png, and rerun `npm run check -- <slug>`. Commit with a message naming the game and its seed.

$ARGUMENTS
