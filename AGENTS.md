# Incremendle agent workflow

Read `CLAUDE.md` for the design bar, runtime rules, and new-game checklist. For a
new game, follow `.claude/commands/new-game.md`, including any user steering.

Use `.agents/skills/slopwave/SKILL.md` automatically when composing or revising
game music. Read `.slopwave/config.json` and `docs/music.md`; set up the local
runtime with `npm run music:setup` if absent. The game's description, rolled music
brief, musical scale, and phase drive the composition. Keep gameplay number scale
separate. Inspect existing sessions and confirmed preferences before editing.

Keep briefs, plans, authoring inputs, experiments, immutable revision snapshots,
renders, listening feedback, and preferences inside this project's `.slopwave/`.
Never put consumer work in the engine checkout. Record feedback against the exact
heard revision, preserving the quote separately from interpretation. Acceptance
is not a pairwise preference; only explicit, unambiguous human comparisons create
musical preference labels. Tests, agent critiques, and silence are not approval.

Music history is shared between Macs through the private R2 bucket configured in
`music-storage.json`. Before authoring or recording feedback, run `npm run music:pull`;
after saving work, run `npm run music:push`. See `docs/music.md` for per-Mac login.
Use only the named music profile and configured account, never the default Cloudflare
login. Work on one Mac at a time. Stop on conflicts, preserve both versions, and
resolve them explicitly; never force an overwrite. If sync is unavailable, preserve
local work and report that the other Mac cannot see it yet.

Use `session render` for listening candidates. Deliver only the selected
`song.mjs` through the existing `createMusic` / `createAudio` adapters; the game
owns playback, phase selection, tempo, Sound panel controls, and visibility.
Preserve existing games and music unless a task explicitly requests their edit.
