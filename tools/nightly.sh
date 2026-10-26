#!/bin/zsh
# Nightly: build the next Daily Incremental game with no one watching, check it, and ship it
# to main (Workers Builds deploys). Runs from a launchd agent in its own clone,
# so it never touches a working checkout. Logs go to ~/Library/Logs/dailyincremental/.
# If anything fails, the work is pushed to nightly/failed-<date> instead and you get a notification.
set -uo pipefail

REPO=${NIGHTLY_REPO:-${0:A:h:h:h}/dailyincrementalgame-nightly}  # a clone next to this checkout
BUDGET=${NIGHTLY_BUDGET_USD:-50}
LOGS=$HOME/Library/Logs/dailyincremental
day=$(date +%F)
mkdir -p $LOGS
exec >>$LOGS/$day.log 2>&1
print "=== nightly $(date)"

notify() {
  print -r -- "$(date +%T) $1"
  osascript -e "display notification \"$1\" with title \"Daily Incremental\"" || true
}
fail() {
  notify "Nightly failed: $1"
  if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    git add -A && git commit -qm "Nightly $day (failed: $1)"
  fi
  if (( $(git rev-list --count origin/main..HEAD 2>/dev/null || print 0) > 0 )); then
    git push -qf origin HEAD:refs/heads/nightly/failed-$day && print "pushed nightly/failed-$day"
  fi
  exit 1
}
games() { node -e 'const g=require("./public/games.json");console.log(g.length, g.at(-1).slug)'; }

cd $REPO || fail "no clone at $REPO"
git fetch -q origin || fail "git fetch"
git checkout -qB main origin/main || fail "git checkout"
git clean -fdq  # untracked leftovers from a failed night; ignored files (.slopwave, node_modules) stay
npm ci --silent --no-audit --no-fund || fail "npm ci"

read count_before _ <<< "$(games)"

STEER="This is an unattended nightly run: nobody is watching and nobody will answer. Never ask \
questions or wait for approval; make every call yourself and keep going until the game is done. \
Wherever the steps say to show me something (pitch, pacing timeline, mix table), print it and \
carry on. Commit the game when finished but do not git push: the wrapper checks and pushes it. \
Run npm run music:pull before music work and npm run music:push after. If music sync is \
unavailable or conflicts, never force it: keep local work, say so in the commit message, and \
still finish the game."

caffeinate -i claude -p "/new-game $STEER" \
  --permission-mode auto \
  --max-budget-usd $BUDGET \
  --output-format stream-json --verbose \
  > $LOGS/$day.claude.jsonl
claude_status=$?
print "claude exited $claude_status"

read count_after slug <<< "$(games)" || fail "games.json unreadable"
(( count_after == count_before + 1 )) || fail "no new games.json entry (claude exit $claude_status)"
[[ -f public/$slug/index.html ]] || fail "public/$slug/index.html missing"
if [[ -n $(git status --porcelain) ]]; then
  git add -A && git commit -qm "Nightly $day: leftover changes for $slug"
fi
npm run check -- $slug || fail "npm run check -- $slug"

if ! git push -q origin HEAD:main; then
  git pull -q --rebase origin main && git push -q origin HEAD:main || fail "git push"
fi
notify "Shipped $slug"
