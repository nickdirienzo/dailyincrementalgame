# Daily Incremental — how to make a game

dailyincrementalgame.com serves one small incremental game per day. Each game is a single,
self-contained HTML file, vibe-coded and then hand-tuned. There is no shared game engine on
purpose: every day can be whatever it wants to be.

## The bar (from game #1, Moonshroom)

Every game should have these bones:

- **Pleasant sounds.** Synthesized with Web Audio, never harsh. Soft feedback on the core action,
  a chime or blip when the number goes up, a small fanfare for purchases and unlocks, something
  special for the ending. Pentatonic scales keep rapid sounds musical. Include a mute toggle,
  shared across games via the `di:sound-muted` localStorage key.
- **A clear upgrade path.** Upgrades sit in a column beside the play area (stacking below it on
  phones) so players notice unlocks. New unlocks pulse and get a "new" tag. Mix real upgrades
  with a few silly one-offs that do little but add story.
- **Straightforward.** One core action you get within five seconds. No tutorial walls.
- **Fairly cute.** A small premise with a character or two and a joke or two. Flavor text in a
  log line under the play area.
- **Not torture.** 8–15 minutes to the ending. No dead stretches where you wait with nothing to
  do. Idle helpers arrive around the 2–3 minute mark. It must have a real ending.

## Scale is a design choice

Pick each game's number scale on purpose and record it in `games.json` (`"scale"`). Some days
should be cozy and small (the whole game ends at 40 jars of jam), others absurd (quadrillions of
sand grains). Moonshroom lives in the thousands. Vary it from day to day so "bigger number"
doesn't become the only kind of satisfaction.

## Checklist for a new day

1. Copy `templates/game.html` to `public/<n>/index.html`, where `<n>` is the next game number.
2. Set `data-day="<n>"` on the `/shared/daily.js` script tag.
3. Build the game. Save state as one JSON object under `DailyGame.storageKey('save')` (which is
   `di:<n>:save`), merged over defaults on load, so that a save of just `{ "ended": true }` opens
   straight into the ending. The browser check relies on this.
4. When the player reaches the ending, call `DailyGame.finish({ lines: [...] })` exactly once
   (not again when a finished save is reloaded). The lines become the share card, joined with
   " · ". Keep them short and emoji-led: time, a headline number, one in-joke.
5. Give the ending a "Share result" button that calls `DailyGame.share()`. Keep the template's ids:
   `#ending` for the ending, `#shareBtn` for the button, and upgrades as buttons inside `#shop`.
6. Add an entry to `public/games.json` with `n`, `date` (YYYY-MM-DD, the day it goes live),
   `title`, `tagline`, `emoji` (one or two), `scale`, `minutes`, plus `seed` and `interaction`
   from `tools/roll.py` if the theme was rolled.
7. Run `npm run check -- <n>` and look at the screenshots in `tests/screenshots/`. Then play it
   yourself: `npm run serve`, open http://localhost:8080/<n>/, and play all the way through once
   with sound on and once in a phone-width window.

## Technical rules

- Everything for a game lives in its one HTML file: inline CSS and JS, Google Fonts allowed,
  no other network requests, no build step.
- Input: mouse and touch both work. Use pointer events; `touch-action: none` on the play canvas.
- Audio starts only after the first user gesture (pointerdown or keydown unlocks the AudioContext).
- Respect `prefers-reduced-motion`.
- Keep the template's `[hidden] { display: none !important; }` rule. Without it, any element
  with its own `display` (flex, grid) ignores the `hidden` attribute, and the ending or locked
  upgrades show from the start.
- Each game picks its own look. The site chrome (top bar, share card) is injected by `daily.js`
  and styles itself; don't restyle `.di-*` classes.
- Games are released by date in the player's local time zone. Future games are hidden from the
  landing page and archive, but their URLs aren't secret. That's fine.
