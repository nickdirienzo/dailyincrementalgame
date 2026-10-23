---
description: Roll a theme and build the next Daily Incremental game, with a pacing sim and browser test
argument-hint: "[optional steering, e.g. \"Use seed 12345\" or \"Make the interaction catch-falling-things\"]"
---

Make the next Daily Incremental game. Read CLAUDE.md first and follow it exactly; it's the design bar and checklist.

1. Roll the theme. Unless a seed is given below, generate one with `python3 -c 'import secrets; print(secrets.randbits(32))'` (don't make up a number yourself), and use it to seed Python's `random.Random(seed)`. Pick one each of: a subject (a quirky character, e.g. "a haunted toaster", "a sleepy dragon"), a verb (e.g. "hatching", "knitting"), an object (e.g. "teacups", "fireflies"), an interaction (rub, tap, hold-to-charge, drag-and-drop, swipe/flick, catch falling things, aim and release, draw a path, rhythm taps), and a number scale (tens, hundreds, thousands, millions, billions, absurd). Show me the roll, then pitch the game in 3–4 sentences: the premise, the core action, what the upgrades are, and how it ends. Make it play differently from the games already in public/, not a reskin. Then build it without waiting for approval.

2. Build it as public/<n>/index.html, where n is the next number in public/games.json, starting from templates/game.html. It needs:
   - the rolled interaction as the core action, understood within five seconds, working with both mouse and touch
   - pleasant synthesized Web Audio sounds for every action, an unlock chime, a purchase sound and a finale, plus a mute toggle using the `di:sound-muted` key
   - an upgrade column on the right (stacking below on phones) where new unlocks pulse with a "new" tag and the heading shows how many are affordable
   - a mix of real upgrades and a few silly one-offs that add story, a meter that tracks the emotional arc, and flavor text in a log line
   - a real ending that calls DailyGame.finish() once with short, emoji-led share lines, plus a Share button
   - a distinctive look of its own (palette, Google Fonts, canvas art), not a copy of the earlier games

3. Check the pacing before you call it done. Write a quick headless sim of a reasonable player: one manual action every ~1.3s, buying the cheapest affordable upgrade. Tune costs until the sim finishes in 6–9 minutes (real players take longer), with a purchase every 15–30 seconds and no dead stretches. Show me the purchase timeline.

4. Test it in a real browser. Serve public/ locally and use Playwright to play the opening, then jump to the ending with a saved state. Confirm the ending and the upgrades are hidden at the start, the share card appears at the end, nothing scrolls sideways at 390px width, and the console has no errors. Take screenshots and look at them.

5. Add the entry to public/games.json, dated the day after the last one, with title, tagline, emoji, scale and minutes. Commit with a message naming the game and its seed.

$ARGUMENTS
