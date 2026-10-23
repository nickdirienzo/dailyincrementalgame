// Daily Incremental shared runtime.
// Include on every page:  <script src="/shared/daily.js" data-day="N" defer></script>
// N is the game's "n" in games.json: an internal id for saves and streaks, never shown to players.
// (omit data-day on non-game pages like the landing page).
//
// Game API:
//   DailyGame.finish({ lines: ['⏱ 9m12s', '1,204 polished'] })
//       Call once when the player reaches the ending. Records the completion,
//       updates the streak, and opens the share card.
//   DailyGame.share()      Reopen the share card (e.g. from a "Share" button).
//   DailyGame.day          This page's game number, or null.
//   DailyGame.storageKey(name)  -> 'di:<day>:<name>', for the game's own saves.
(() => {
  const script = document.currentScript;
  const DAY = script && script.dataset.day ? Number(script.dataset.day) : null;
  const SITE = 'dailyincrementalgame.com';

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('di:' + k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem('di:' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let manifestPromise = null;
  function manifest() {
    if (!manifestPromise) {
      manifestPromise = fetch('/games.json', { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    return manifestPromise;
  }

  // Games whose date has arrived in the player's local time zone, oldest first.
  function released(list, today = localDate()) {
    return list.filter(g => g.date <= today).sort((a, b) => a.n - b.n);
  }

  // completions: { [n]: { at: 'YYYY-MM-DD', lines: [...] } }
  const completions = () => store.get('done', {});

  // Streak = consecutive released games, newest first, each finished on its own release date.
  // Today's game not being finished yet doesn't break the streak.
  function streak(list, today = localDate(), done = completions()) {
    const games = released(list, today).reverse();
    let count = 0;
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const c = done[g.n];
      if (c && c.at === g.date) { count++; continue; }
      if (i === 0 && g.date === today && !c) continue;
      break;
    }
    return count;
  }

  // ---------- Share card ----------
  let cardEl = null;
  function shareText(game, lines) {
    const head = game ? `Daily Incremental: ${game.title}${game.emoji ? ' ' + game.emoji : ''}` : 'Daily Incremental';
    const url = game ? `${SITE}/${game.slug}` : SITE;
    return [head, (lines || []).join(' · '), url].filter(Boolean).join('\n');
  }

  async function openCard() {
    const list = await manifest();
    const game = list.find(g => g.n === DAY) || null;
    const done = completions()[DAY];
    const text = shareText(game, done ? done.lines : []);
    const s = streak(list);

    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'di-overlay';
      cardEl.innerHTML = `
        <div class="di-card" role="dialog" aria-modal="true" aria-labelledby="di-card-title">
          <p class="di-eyebrow">You finished today's game</p>
          <h2 id="di-card-title" class="di-title"></h2>
          <pre class="di-share" id="di-share" tabindex="0"></pre>
          <div class="di-row">
            <button type="button" class="di-btn di-copy">Copy result</button>
            <a class="di-btn di-ghost" href="/">More games</a>
          </div>
          <p class="di-streak"></p>
          <button type="button" class="di-close" aria-label="Close">×</button>
        </div>`;
      document.body.appendChild(cardEl);
      cardEl.addEventListener('click', e => { if (e.target === cardEl) closeCard(); });
      cardEl.querySelector('.di-close').addEventListener('click', closeCard);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });
      cardEl.querySelector('.di-copy').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const pre = cardEl.querySelector('.di-share');
        try {
          await navigator.clipboard.writeText(pre.textContent);
          btn.textContent = 'Copied';
        } catch (err) {
          const range = document.createRange(); range.selectNodeContents(pre);
          const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
          btn.textContent = 'Selected, press copy';
        }
        setTimeout(() => { btn.textContent = 'Copy result'; }, 1800);
      });
    }
    cardEl.querySelector('.di-title').textContent = game ? game.title : document.title;
    cardEl.querySelector('.di-share').textContent = text;
    cardEl.querySelector('.di-streak').textContent = s > 0 ? `Streak: ${s} day${s === 1 ? '' : 's'}` : '';
    cardEl.hidden = false;
    cardEl.querySelector('.di-copy').focus();
  }
  function closeCard() { if (cardEl) cardEl.hidden = true; }

  function finish({ lines = [] } = {}) {
    if (DAY == null) return;
    const done = completions();
    if (!done[DAY]) {
      done[DAY] = { at: localDate(), lines };
      store.set('done', done);
    }
    openCard();
  }

  // ---------- Top bar on game pages ----------
  function addBar() {
    if (DAY == null) return;
    const bar = document.createElement('nav');
    bar.className = 'di-bar';
    bar.innerHTML = `<a href="/">← Daily Incremental</a>`;
    document.body.prepend(bar);
  }

  // Stylesheet lives next to this script.
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/shared/daily.css';
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBar);
  else addBar();

  window.DailyGame = {
    day: DAY,
    finish,
    share: openCard,
    storageKey: name => `di:${DAY}:${name}`,
    // Helpers used by the landing page.
    manifest, released, streak, completions, localDate,
  };
})();
