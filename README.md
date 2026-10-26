# dailyincrementalgame.com

One tiny incremental game per day. It's a static site with no build step, hosted on Cloudflare Pages.

```
public/
  index.html          landing page: today's game, streak, archive
  games.json          the manifest; one entry per day
  shared/daily.js     site runtime injected into each game: top bar, credits, share card, streaks
  shared/daily.css
  shared/kit/         our helpers for games: audio + music, sprites, style passes
  shared/lib/         vendored third-party libraries, pinned by version (libs.json lists them)
  shared/palettes.json  Lospec palettes the roll picks from
  shared/samples/, shared/soundfonts/  instruments for Strudel music, served locally
  moonshroom/         one folder per game, named by its slug (page, modules, art/, credits.json)
  _redirects          old /1/-style links → named URLs
  _headers            keeps games.json uncached so new days show up right away; caches shared/lib forever
templates/game.html   starting point for a new game
tests/check.mjs       browser smoke test (Playwright)
tools/roll.py         rolls a random theme and game shape for a new game
tools/og.mjs          renders social cards (og.png) and their meta tags
tools/art.mjs         finds and fetches open-licensed SVG art (Iconify), license-checked
tools/credits.mjs     writes a game's credits.json (libraries, art, fonts, palette, support links)
tools/vendor.mjs      copies pinned libraries from node_modules into public/shared/lib
tools/palettes.mjs    adds Lospec palettes to public/shared/palettes.json
tools/samples.mjs     copies Strudel instruments (VCSL, piano, soundfonts) into public/shared
CLAUDE.md             the design bar and checklist for making a game
```

## Run it locally

```
python3 -m http.server -d public 8080
```

Then open http://localhost:8080. It has to be served over HTTP; opening the files directly
breaks the absolute `/shared/...` paths and the manifest fetch.

## Deploy to Cloudflare Pages

**Option A: git-connected (deploys on every push).**
1. Push this folder to a GitHub or GitLab repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git, then pick the repo.
3. Build settings: framework preset **None**, build command empty, output directory `public`.
4. After the first deploy: the Pages project → Custom domains → add `dailyincrementalgame.com`
   (and `www.` if you want it). The domain is already on Cloudflare, so DNS is set up for you.

**Option B: direct upload from your machine.**
```
npx wrangler pages project create dailyincrementalgame --production-branch main
npx wrangler pages deploy public --project-name dailyincrementalgame
```
Then add the custom domain the same way as in step 4.

## Adding a day

See `CLAUDE.md`. In short: copy the template to `public/<slug>/index.html`, build the game, call
`DailyGame.finish()` at the ending, add the entry to `games.json` with its release date, and deploy.
You can queue games ahead of time; each one appears at midnight in the player's local time.

Or, in Claude Code, run `/new-game` (optionally with steering like `/new-game Use seed 12345`). It rolls a
theme, builds the game, checks pacing with a simulated player, tests it in a browser, and commits.

Game music uses the repo-local slopwave skill, driven by each game's description
and music brief. Run `mise install` then `npm run music:setup` once per checkout;
see [the music workflow](docs/music.md) for composition, rendering and feedback.
The separate toolchain, experiments, revision snapshots, listening feedback and
preferences live under ignored `.slopwave/`. `npm run music:pull` and
`npm run music:push` share music history through a private Cloudflare R2 bucket;
the toolchain and machine-specific configuration remain local. See the music
workflow for the one-time login on each Mac.
Only selected composition modules go into game assets, using the existing Strudel
adapter and game-owned playback. `AGENTS.md` and `CLAUDE.md` enable this workflow
for future agent sessions.

## Testing

```
npm install && npm run setup   # once per machine: Playwright and its Chromium (Node 24, see mise.toml)
npm run check                  # landing page + every game
npm run check -- moonshroom    # just one game
```

`tests/check.mjs` serves `public/`, checks each game starts with the ending and upgrades hidden,
plays the opening, loads a finished save to check the ending and share card, checks for
sideways scroll at 390px, and fails on any console error. Screenshots go to `tests/screenshots/`.
`package.json` is dev tooling only; the site still has no build step.

## Social cards

Each game has its own link preview: `public/<slug>/og.png` plus `og:`/`twitter:` meta tags in its
page. `npm run og` renders cards for games that don't have one yet and refreshes the landing card;
`npm run og -- <slug>` re-renders one game. Chat apps cache previews hard, so the image URL carries
a content hash to make them refetch a changed card. The card is drawn from the game's save in `tools/cards.json`, a mid-game
moment chosen so the preview never spoils the ending (games without one fall back to a finished save).

## Local data

Everything is stored in the player's browser under the `di:` localStorage prefix:
`di:done` (completions, which drive streaks and checkmarks), `di:sound-muted`, and `di:<n>:save`
for each game's own progress. `<n>` is the game's internal number from `games.json`, so renaming a
game's slug doesn't lose anyone's progress.

## License

AGPL-3.0-or-later (see LICENSE), because the games' music runs on [Strudel](https://strudel.cc). Art, sounds, fonts and palettes keep their own licenses; each game's Credits panel lists them.
