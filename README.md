# dailyincrementalgame.com

One tiny incremental game per day. It's a static site with no build step, hosted on Cloudflare Pages.

```
public/
  index.html          landing page: today's game, streak, archive
  games.json          the manifest; one entry per day
  shared/daily.js     site runtime injected into each game: top bar, share card, streaks
  shared/daily.css
  1/index.html        game #1, Moonshroom
  _headers            keeps games.json uncached so new days show up right away
templates/game.html   starting point for a new game
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

See `CLAUDE.md`. In short: copy the template to `public/<n>/index.html`, build the game, call
`DailyGame.finish()` at the ending, add the entry to `games.json` with its release date, and deploy.
You can queue games ahead of time; each one appears at midnight in the player's local time.

Or, in Claude Code, run `/new-game` (optionally with steering like `/new-game Use seed 12345`). It rolls a
theme, builds the game, checks pacing with a simulated player, tests it in a browser, and commits.

## Local data

Everything is stored in the player's browser under the `di:` localStorage prefix:
`di:done` (completions, which drive streaks and checkmarks), `di:sound-muted`, and `di:<n>:save`
for each game's own progress.
