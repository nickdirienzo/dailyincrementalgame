# dailyincrementalgame.com

One tiny incremental game per day, built by Claude. It's an experiment in agentic game
development: each game is rolled from a random theme, built and play-tested by an agent, then
hand-tuned. The site is static files with no build step, hosted on Cloudflare Pages.

## Setup

```
mise install      # Node 24 and Python 3.12, from mise.toml
mise run setup    # npm deps, Playwright's Chromium, and the music toolchain
mise run serve    # http://localhost:8080
```

The site has to be served over HTTP: opening `public/index.html` directly breaks the absolute
`/shared/...` paths and the `games.json` fetch. `package.json` is dev tooling only.

## Making a game

In Claude Code, run `/new-game` (optionally with steering, like `/new-game Use seed 12345`). It
rolls a theme, builds the game, checks pacing with a simulated player, tests it in a browser, and
commits.

`CLAUDE.md` has the design bar and the full checklist. In short: copy `templates/game.html` to
`public/<slug>/index.html`, build the game, call `DailyGame.finish()` at the ending, add an entry to
`games.json` with its release date, render its social card, and deploy. Games can be queued ahead
of time; each one appears at midnight in the player's local time, and the landing page counts down
to the next one.

## Testing

```
mise run check                # landing page + every game
mise run check moonshroom     # just one game
npm run mix -- moonshroom     # music and sound effect levels
```

`tests/check.mjs` serves `public/`, checks that each game starts with the ending and upgrades
hidden, plays the opening, loads a finished save to check the ending and share card, checks for
sideways scroll at 390px, and fails on console errors or requests to any host but Google Fonts.
Screenshots go to `tests/screenshots/`.

## Social cards

Each game has its own link preview: `public/<slug>/og.png` plus `og:`/`twitter:` meta tags in its
page. The card is drawn from the game's save in `tools/cards.json`, a mid-game moment chosen so the
preview never spoils the ending. `npm run og -- <slug>` (re)renders one game's card;
`npm run og` renders any missing cards and refreshes the landing card. Each card also gets a
half-size `thumb.jpg` for the landing page grid. The image URL in the meta tags carries a content
hash so chat apps refetch a changed card.

## Music

Game music is written in Strudel with [slopwave](https://github.com/nickdirienzo/slopwave), composed from each game's
description and rolled music brief. `mise run setup` installs its toolchain under the ignored
`.slopwave/`, which also holds experiments, revision snapshots, listening feedback and preferences.
`npm run music:pull` and `npm run music:push` share that history between Macs through a private
Cloudflare R2 bucket. Only the selected composition ships, as a module inside the game. See
[docs/music.md](docs/music.md) for composing, rendering, feedback and the one-time login per Mac.

## Deploy

The site is a Cloudflare Worker named `dailyincrementalgame` on the personal account, configured by
`wrangler.jsonc`: everything in `public/` is served as static assets (with `_headers` and
`_redirects`), and `worker/index.js` only runs for `/api/*`. Workers Builds deploys every push to
`main`. To deploy by hand: `npx wrangler deploy`.

Wrangler commands in this repo use the `dailyincrementalgame-site` login profile. On a new Mac:
```
npx wrangler auth create dailyincrementalgame-site      # sign in to the personal account
npx wrangler auth activate dailyincrementalgame-site .
```

## Player data

Everything lives in the player's browser under the `di:` localStorage prefix: `di:done`
(completions, which drive streaks and the landing page's gold stars), the Sound panel settings
(`di:sound-muted`, `di:music-muted`, `di:volume-sfx`, `di:volume-music`), and `di:<n>:save` for
each game's progress. `<n>` is the game's internal number from `games.json`, so renaming a slug
doesn't lose anyone's progress.

## Play stats

On the live site only, `daily.js` keeps anonymous totals per game in `di:plays` and reports them to
`/api/play` (`worker/index.js`) after the player's first tap or key: a random player
id (`di:pid`), sittings, active seconds (tab visible, input in the last minute), visible seconds,
and whether they reached the ending. One row per player per game lands in the D1 database
`dailyincrementalgame-stats` (schema in `migrations/`). `npm run stats` shows players, finish rate
and median minutes per game; `npm run stats -- --json` adds every `games.json` field for comparing
rolls. Everything fits the free plan; if a daily limit is hit, only the reports fail.

The database and its binding are in `wrangler.jsonc`. To change the schema, add a numbered file to
`migrations/` and run `npx wrangler d1 migrations apply dailyincrementalgame-stats --remote`.

## License

AGPL-3.0-or-later (see LICENSE), because the games' music runs on [Strudel](https://strudel.cc).
Art, sounds, fonts and palettes keep their own licenses; each game's Credits panel lists them.
