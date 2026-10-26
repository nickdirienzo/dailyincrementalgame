# Composing game music with slopwave

The installed skill is `.agents/skills/slopwave/SKILL.md`, from
https://github.com/nickdirienzo/slopwave/tree/main/.agents/skills/slopwave.
The initial toolchain is pinned to `6253c8a73ca6767d1f1280717f1057c3a534f972`.
Use `mise install` for Python 3.12 and Node 24, then `npm run music:setup` on a
new checkout. Setup installs a separate engine and dependencies in
`.slopwave/toolchain/`, records absolute runtime paths in `.slopwave/config.json`,
and leaves an existing configuration unchanged. No sibling checkout is required.
If the project moves, update the machine paths or reinstall the toolchain after
backing up the config; retain all sessions and preferences.

`npm run music -- <arguments>` runs the configured Python CLI from this repository
and supplies the configured toolchain and Node to `session render`. This is authoring
tooling only; the site retains its static, local Strudel runtime.

## Sharing music history between Macs

The private Cloudflare R2 bucket in `music-storage.json` stores complete snapshots
of `.slopwave/sessions/`, `work/`, and `preferences/`, including audio, exact revision
artifacts and feedback. The public game repository contains only the tooling and
bucket/account identifiers. Credentials, `config.json`, the installed toolchain,
sync state and local backup archives are never included in uploads.

On a second Mac, pull this repository, then run:

```sh
npm ci
mise install
npm run music:setup
npx wrangler auth create dailyincrementalgame-music
npx wrangler auth activate dailyincrementalgame-music --cwd .slopwave
npx wrangler whoami --cwd .slopwave
npm run music:pull
```

Authorize the personal Cloudflare account matching `music-storage.json`, not a
work account. The named profile preserves the default Cloudflare login. If using
another browser profile, copy the authorization URL printed by Wrangler into it.
Login is per machine; never copy its token into this repo or a music snapshot.

Before music work or listening feedback, run `npm run music:pull`; afterward run
`npm run music:push`. `npm run music:status` shows the local and remote snapshot
IDs and whether local files changed. Git still handles game code separately.
`npm run music:verify` downloads the latest snapshot and verifies a complete
restore into a temporary empty workspace, without changing your music files.

Uploads create uniquely named archives and JSON manifests under `slopwave/snapshots/`
and publish `slopwave/latest.json` only after uploading the archive. Earlier
snapshots remain in R2. Downloads verify the archive and every file's SHA-256.
Pull preserves local-only changes and makes a local backup before replacing clean
files; conflicting edits or changes to immutable revisions/events stop the restore.
There is no delete propagation or force-overwrite option.

Use one Mac at a time: push before switching, then pull on the other. The CLI checks
for a changed remote head but does not provide an atomic distributed lock; simultaneous
uploads can race on `latest.json`, although both named archives remain recoverable.
Recover an older snapshot by downloading its matching `.zip` and `.json` objects
from R2 and verifying checksums before a deliberate restore. Local backups live in
`.slopwave/backups/`. Each push is a full compressed snapshot; retention is manual.
Run `npm run music:storage-check` for local archive/conflict tests.

## Brief to revision

Read the skill's composition and session references and the configured toolchain's
`docs/score-format.md` and `docs/workflows.md`. Resolve config `sessions` and
`preferences` relative to `.slopwave/config.json`. Defaults below assume those
paths have not been customized.

1. Inspect `.slopwave/sessions/<slug>/` if it exists; don't assume its newest
   revision was accepted. Review relevant confirmed preferences from this project.
2. Save `.slopwave/work/<slug>/brief.json` with the game description/causal chain,
   rolled music style and musical scale, phase and energy, intended play duration,
   instrumentation, variation and loop constraints, and space needed for effects.
   Keep the gameplay number scale in a separate field. Preserve user steering.
3. Save `plan.json` with motif/rhythm, harmony, phrase lengths, groove, roles and
   registers, articulation, development, and the return to the first phrase.
   Save authoring code, seeds if any, and explicit notes beside `score.json`.
   An authored score may start at `reviewed` with `source_kind: authored` and a
   documented content-hash basis. This is not a claim of human listening review.
4. Arrange, mix, and snapshot the composition:

   ```sh
   npm run music -- session init .slopwave/sessions/<slug> --brief .slopwave/work/<slug>/brief.json
   npm run music -- arrange .slopwave/work/<slug>/score.json --profile synth -o .slopwave/work/<slug>/arranged.json
   npm run music -- mix .slopwave/work/<slug>/arranged.json -o .slopwave/work/<slug>/mixed.json
   npm run music -- session render .slopwave/sessions/<slug> --score .slopwave/work/<slug>/mixed.json --plan .slopwave/work/<slug>/plan.json --note 'Initial composition'
   npm run music -- session inspect .slopwave/sessions/<slug>
   ```

   Initialize only once. For subsequent candidates use `--parent <exact-revision>`;
   supply `--plan` when musical decisions change and `--brief` when the brief changes.
   Work in new stage files as needed; do not edit revision artifacts or discard branches.
   Each successful revision retains score, brief, plan, Strudel source, `song.mjs`,
   WAV, runtime hashes and checks. Keep custom authoring inputs in the work directory.
5. Start with a composed loop, then develop deliberate phrase variations and phase
   arrangements for long play. Don't ship the setup test as a game's soundtrack.
   The synth profile is the supported session renderer. If the brief needs sampled
   instruments, keep the brief, fetch local instruments using `npm run samples`,
   and separately verify the adapted arrangement and sample starts in the game.
   Retain that source and verification alongside the session; synth checks do not
   verify a later sampled adaptation.

## Game delivery and verification

Copy the selected revision's `song.mjs` to `public/<slug>/song.mjs` when delivering
the game. Record the selected revision and destination in a project-local work
note. An autonomous delivery choice is not human acceptance. When the user has
accepted a revision, use that revision. Keep WAVs and experiments outside `public/`.
The template shows the integration:

```js
import { createPattern, cps } from './song.mjs';
let music = null;
function song() {
  return ['main', createPattern(music.strudel), cps];
}
createMusic(A, { song }).then(m => { music = m; music.update(); });
```

`createMusic` invokes `song()` after initialization. Use the exported `cps`
directly (currently `bpm / 240`, one cycle per four quarter-note beats). The
composition spans `beats / 4` cycles; its full repeat takes `beats * 60 / bpm` seconds.
Never call `.play()`, `.hush()`, or global tempo setters from the composition module,
or introduce a second AudioContext/transport. The game selects stable phase keys
and calls `music.update()` when state changes. The adapter manages gesture gating,
Sound panel routing and tab visibility. State changes currently switch immediately;
they are not quantized to bar boundaries.

For phase arrangements, keep the selected composition in `song.mjs`, exposing
`createParts(S)` alongside `createPattern(S)` when stems are needed. Put the
game's cached phase arrangements in `music.mjs`; retain the source revision,
adaptation notes, and previous game source under `.slopwave/work/<slug>/integration/`.
The Longest Noon and Three Lemons use this structure. Acceptance of a core theme
does not imply that the listener separately reviewed every phase arrangement.

Run `npm run music:check -- <path-to-revision/song.mjs>` to exercise the exported
module through the site's vendored Strudel and real adapters without editing a game.
Then run the normal `npm run check -- <slug>` and `npm run mix -- <slug>` for each
game phase, balancing music near -24 dBFS RMS and effects near -10 dBFS peak.
Check gesture start, mute/volume, hidden-tab pause, transitions and release tails.
`npm run music:game-check` exercises the phase arrangements and playback controls
in The Longest Noon and Three Lemons. `npm run mix -- <slug> --music-only <save>...`
measures phase music without replaying effects during each measurement.
Listen across several returns in the game before claiming extended-play comfort.
A rendered WAV is a finite preview, not proof of a seamless audio file or musical quality.

## Feedback and preferences

Record relevant user words in a UTF-8 quote file inside `.slopwave/`, then use:

```sh
npm run music -- session record .slopwave/sessions/<slug> --revision <heard-id> --quote-file .slopwave/work/<slug>/feedback.txt --kind feedback
```

Keep the verbatim quote separate from `--interpretation`; use `--scope` and
`--message-ref` when known, never invented. “Too busy” is feedback. “Ship it” uses
`--kind acceptance` and creates no pairwise wins. An unambiguous “much better”
uses `--kind comparison --against <earlier-id> --outcome preferred`: the revision
wins; `rejected` means the earlier one wins. Record ties/undecided when appropriate,
and preserve remaining complaints and conflicting judgments. Leave ambiguous
comparisons unlabelled. Technical comparisons use `--dimension technical`.
Agent critiques, automated checks, silence, and inferred listening are not human labels.

Export preferences only when requested, to a new file under the configured
`.slopwave/preferences/`. Export includes attributed decisive comparisons under
the same brief, excludes technical fixes, and infers no transitive preferences.
Don't train models, upload feedback, or publish artifacts as part of this workflow.
`.slopwave/` is ignored by Git; only a successful `music:push` backs up its consumer
data to R2. Preserve sessions and artifacts when moving it; exported indexes refer
to those files. Toolchains and credentials are configured separately on each Mac.
