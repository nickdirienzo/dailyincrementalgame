# Daily Incremental — how to make a game

dailyincrementalgame.com serves one small incremental game per day. Each game is a single,
self-contained HTML file, vibe-coded and then hand-tuned. There is no shared game engine on
purpose: every day can be whatever it wants to be.

For new or revised game music, automatically use `.agents/skills/slopwave/SKILL.md`
and `docs/music.md`. Read `.slopwave/config.json` (run `npm run music:setup` if absent).
Compose from the game's description, rolled music brief, musical scale, and phase;
keep the gameplay number scale separate. Keep plans, experiments, revision snapshots,
listening feedback, and preferences in this project's `.slopwave/`. Preserve exact
feedback quotes and revision references; acceptance is not a preference comparison,
and tests or agent judgments are not human labels. Deliver the selected `song.mjs`
through our existing music adapter; the game owns playback. Preserve existing games
and music unless their revision is part of the task.
Pull private music history with `npm run music:pull` before music work or feedback,
and save it with `npm run music:push` afterward. Follow the R2 account, conflict,
and one-Mac-at-a-time rules in `AGENTS.md` and `docs/music.md`.

## The bar (from the first game, Moonshroom)

Every game should have these bones:

- **Pleasant sounds.** Synthesized with Web Audio, never harsh. Soft feedback on the core action,
  a chime or blip when the number goes up, a small fanfare for purchases and unlocks, something
  special for the ending. Keep rapid sounds on the game's scale (the rolled one, if rolled) so
  they stay musical. Don't build sound buttons: the site's Sound panel (top bar, injected by
  `daily.js`) has effects and music volume and mute for every game, and the audio kit follows it.
- **A balanced mix.** Measure it with `npm run mix -- <slug>` (one save per phase): music around
  -24 dBFS RMS, each sound effect peaking near -10 dBFS and within a few dB of the others. Fix
  what's off with the game's `sfxTrim` / `musicTrim` and per-effect levels, not by ear-guessing.
  The game exposes `window.__game = { A, sfx }` when loaded with `?debug` so the tool can play
  every effect.
- **Background music.** A quiet loop in the game's own style (lo-fi, chiptune, music box...),
  generated live with Web Audio rather than shipped as audio files: no network requests, no
  licenses to track. Never a short loop: a pattern that repeats every few seconds is obvious
  within a minute. Make it a process that keeps changing (mutate the melody a note at a time,
  move through a chord progression, change texture every few dozen bars) so nothing repeats
  exactly for minutes, and let it shift subtly with the game: key, tempo or tone per phase,
  layers that join as things grow. Keep it well under the sound effects in the mix. Write it in Strudel (TidalCycles in the browser) through
  `public/shared/kit/music.mjs`: real instruments (125 General MIDI soundfonts including guitars,
  strings, brass and winds; 128 recorded VCSL instruments; a grand piano; synths) and a pattern
  language built for variation. Fetch the instruments a game uses with `npm run samples`; they're
  served from our site. `public/shared/kit/audio.mjs` owns the mix (it follows the Sound panel)
  and quick synth sound effects. Music starts with the first gesture and pauses while the tab is
  hidden.
- **A clear upgrade path.** Upgrades sit in a column beside the play area (stacking below it on
  phones) so players notice unlocks. New unlocks pulse and get a "new" tag. Once an upgrade has
  shown up it stays until bought: never hide one again because the player spent resources, or
  they lose the goal they were saving for. Mix real upgrades
  with a few silly one-offs that do little but add story.
- **Straightforward.** One core action you get within five seconds. No tutorial walls.
- **Fairly cute.** A small premise with a character or two and a joke or two. Flavor text in a
  log line under the play area.
- **Timeless, mostly.** Games live in the archive forever, so they never riff on trending memes,
  news or real people. When the roll asks for a calendar nod, it's one small touch (an upgrade, a
  log line, a hat), never the premise, and it must not repeat a topic from the last two weeks.
- **Not torture.** Length varies by day (the rolled `length`): mini games of 10–60 minutes,
  short ones of 1–3 hours, and story games of 3–10 hours played over several sittings. These are real incrementals, not toys: there's room for the
  numbers to snowball and the game to change shape. Whatever the length, there are no dead
  stretches where you wait with nothing to do, idle helpers arrive about a fifth of the way in, and
  there is a real ending. Length comes from content, not slower prices: phases or layers that
  change what you're doing, something new every few minutes, and saves frequent enough that a
  reload resumes mid-game. Games over an hour also need offline progress (capped, at a reduced
  rate) so they can be played across sittings.

## Scale is a design choice

Pick each game's number scale on purpose and record it in `games.json` (`"scale"`). Some days
should be cozy and small (the whole game ends at 40 jars of jam), others absurd (quadrillions of
sand grains). Moonshroom lives in the thousands. Vary it from day to day so "bigger number"
doesn't become the only kind of satisfaction.

## Checklist for a new day

1. Pick the title and its slug: lowercase, words joined by hyphens ("Moonshroom" → `moonshroom`).
   Copy `templates/game.html` to `public/<slug>/index.html`. Players only ever see the name; the
   URL is `/<slug>/`.
2. Set `data-day="<n>"` on the `/shared/daily.js` script tag, where `<n>` is the next number in
   `games.json`. It's an internal id for saves and streaks and is never shown to players.
3. Build the game. Save state as one JSON object under `DailyGame.storageKey('save')` (which is
   `di:<n>:save`), merged over defaults on load, so that a save of just `{ "ended": true }` opens
   straight into the ending, drawn as the finished world (everything built), not an empty
   scene. The browser check relies on this.
4. When the player reaches the ending, call `DailyGame.finish({ lines: [...] })` exactly once
   (not again when a finished save is reloaded). The lines become the share card, joined with
   " · ". Keep them short and emoji-led: time, a headline number, one in-joke.
5. Give the ending a "Share result" button that calls `DailyGame.share()`. Keep the template's ids:
   `#ending` for the ending, `#shareBtn` for the button, and upgrades as buttons inside `#shop`.
6. Add an entry to `public/games.json` with `n`, `slug`, `date` (YYYY-MM-DD, the day it goes live),
   `title`, `tagline`, `emoji` (one or two), `scale`, `minutes`, plus, if the theme was
   rolled, `seed` and every field from `tools/roll.py` except subject, verb and object
   (`interaction`, `arc`, `length`, `structure`, `twist`, `ending`, `look`, `music`, `tone`,
   `context`, `palette`; for a calendar nod, add a `"topic"` saying what it was), so
   the next roll can flag repeats. `minutes` comes from the rolled length.
7. Run `npm run credits -- <slug>` to write the game's credits.
8. Add a save for the game's social card to `tools/cards.json`: a busy mid-game moment that
   never shows the ending (the card is the first thing people see, so it must not spoil it).
   Then run `npm run og -- <slug>` to render the card (`public/<slug>/og.png`, the preview image in
   chat apps) and write its meta tags, and look at the card.
9. Run `npm run check -- <slug>` and look at the screenshots in `tests/screenshots/`. Then play it
   yourself: `npm run serve`, open http://localhost:8080/<slug>/, and play all the way through once
   with sound on and once in a phone-width window.

## Technical rules

- A game lives in `public/<slug>/`: `index.html` plus any modules, art and data it needs
  (economy in its own module is a good habit, so the pacing sim can import it). No build step.
  Everything is served from our own site; the only third-party requests allowed are Google Fonts.
- Shared code a game may use:
  - `public/shared/kit/`: our own helpers. `audio.mjs` (audio context, sound and music toggles,
    scales, synth voices, a sequencer for music), `sprites.mjs` (recolor and restyle SVG art,
    pixel grids, outlines, the `?sprites` sheet), `fx.mjs` (grain, scanlines, halftone,
    misregistration, watercolor wash).
  - `public/shared/lib/`: vendored third-party libraries, pinned by version
    (`public/shared/lib/libs.json` lists them): Strudel and its soundfonts (music), PixiJS and pixi-filters (WebGL scenes and
    CRT/glitch/bloom filters), Rough.js (sketchy redraws), perfect-freehand (ink strokes), ZzFX
    (tiny sound effects), matter.js (physics), break_infinity.js (numbers past 1e308, for
    absurd-scale days). Load ES modules through an import map listing only what the game uses.
    Add more with `npm install -D` plus an entry in `tools/vendor.mjs`, then `npm run vendor`.
- Art: fetch open-licensed SVGs with `npm run art -- search <word>` and
  `npm run art -- <slug> <set:name>...` (Iconify, license-checked). They're source shapes, not
  finished art: recolor them to the palette and restyle them to the rolled look so no game looks
  like the icon set. Main characters are often better hand-made (pixel grids or drawn live).
  Emoji only as small accents. Register every sprite and look at the `?sprites` sheet.
- Sounds: `npm run samples -- list` shows every instrument; `npm run samples -- vcsl marimba`,
  `-- piano` or `-- gm gm_acoustic_guitar_nylon` copies it into `public/shared/samples` or
  `public/shared/soundfonts` (recordings transcoded to MP3). Never load sounds from elsewhere at
  runtime; the browser check fails on third-party requests.
- License: the site is AGPL-3.0 (Strudel is), with the source linked from every Credits panel.
- Credits: run `npm run credits -- <slug>` whenever the game's libraries, art, fonts or palette
  change, and keep `data-credits` on the `daily.js` tag. The site shows a Credits panel with
  licenses and links to support each project.
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
