// Incremendle shared runtime.
// Include on every page:  <script src="/shared/daily.js" data-day="N" defer></script>
// N is the game's "n" in games.json: an internal id for saves and streaks, never shown to players.
// Add data-credits when the game has a credits.json next to it (npm run credits -- <slug>): the top
// bar then links to a Credits panel with licenses and support links.
// Add data-why when the game has a why.json next to it: the top bar then links to a "What??" panel
// with the theme the dice rolled and what the game made of each roll (ending spoilers behind a warning).
// (omit data-day on non-game pages like the landing page).
//
// Game API:
//   DailyGame.finish({ lines: ['⏱ 9m12s', '1,204 polished'] })
//       Call once when the player reaches the ending. Records the completion,
//       updates the streak, and opens the share card.
//       Finishing again after "Play again" on the share card adds another run to the history.
//   DailyGame.share()      Reopen the share card (e.g. from a "Share" button).
//   DailyGame.day          This page's game number, or null.
//   DailyGame.storageKey(name)  -> 'di:<day>:<name>', for the game's own saves. Keep every save under
//       this prefix: the top bar's Save panel moves all of di:<day>:* to another device.
(() => {
  const script = document.currentScript;
  const DAY = script && script.dataset.day ? Number(script.dataset.day) : null;
  const SITE = 'incremendle.com';
  const SOURCE = 'https://github.com/nickdirienzo/incremendle';

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

  // completions: { [n]: { at: 'YYYY-MM-DD', lines: [...], runs: [{ at, lines }, ...] } }
  // at/lines are the first finish (the streak counts it). runs holds every finish, oldest first;
  // completions from before replays have no runs and count as one.
  const completions = () => store.get('done', {});
  const runsOf = c => (c ? c.runs || [{ at: c.at, lines: c.lines || [] }] : []);

  // The run in progress, set by "Play again": 2 for the first replay, and so on.
  const runKey = () => `di:${DAY}:run`;
  const currentRun = () => { try { return Number(localStorage.getItem(runKey())) || 1; } catch (e) { return 1; } };

  // Seconds in a '⏱ 1h4m12s' line, so the card can mark the fastest run.
  function runSeconds(lines) {
    const t = (lines || []).find(l => /^\s*⏱/.test(l));
    const m = t && t.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?\s*$/);
    if (!m || !(m[1] || m[2] || m[3])) return null;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  const shortDate = at => { const [y, mo, d] = at.split('-').map(Number); return new Date(y, mo - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

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

  // ---------- Panels ----------
  // <di-modal> is every site panel (share card, Credits, What??, Save): a native <dialog> in the site's
  // sketchbook look (daily.css, the landing page's paper and ink), with the eyebrow, title, close
  // button, Escape, backdrop click and focus handled once. Children become the panel's body.
  //   <di-modal class="di-save" eyebrow="Play on another device" heading="Your save">…</di-modal>
  //   el.show('.di-save-copy')   opens it and focuses that element (the close button by default)
  //   el.close()
  let modalId = 0;
  class DiModal extends HTMLElement {
    static observedAttributes = ['eyebrow', 'heading'];
    connectedCallback() {
      if (this.dialog) return;
      const kids = [...this.childNodes];
      const id = `di-modal-${++modalId}`;
      const d = this.dialog = document.createElement('dialog');
      d.className = 'di-card';
      d.setAttribute('aria-labelledby', id);
      d.innerHTML = `<p class="di-eyebrow"></p><h2 class="di-title" id="${id}"></h2><div class="di-body"></div>`
        + `<button type="button" class="di-close" aria-label="Close">×</button>`;
      this.body = d.querySelector('.di-body');
      this.body.append(...kids);
      this.append(d);
      d.querySelector('.di-close').addEventListener('click', () => this.close());
      // A click on the backdrop lands on the dialog itself, outside its box.
      d.addEventListener('click', e => {
        if (e.target !== d) return;
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
      });
      d.addEventListener('close', () => this.removeAttribute('open'));
      this.sync();
    }
    attributeChangedCallback() { this.sync(); }
    sync() {
      if (!this.dialog) return;
      this.dialog.querySelector('.di-eyebrow').textContent = this.getAttribute('eyebrow') || '';
      this.dialog.querySelector('.di-title').textContent = this.getAttribute('heading') || '';
    }
    show(focus) {
      if (!this.dialog.open) this.dialog.showModal();
      this.setAttribute('open', '');
      const el = (focus && this.querySelector(focus)) || this.dialog.querySelector('.di-close');
      el.focus();
    }
    close() { this.dialog.close(); }
  }
  if (!customElements.get('di-modal')) customElements.define('di-modal', DiModal);
  function modal(cls, eyebrow, heading, html) {
    const m = document.createElement('di-modal');
    m.className = cls;
    m.setAttribute('eyebrow', eyebrow);
    m.setAttribute('heading', heading);
    m.innerHTML = html;
    document.body.appendChild(m);
    return m;
  }

  // ---------- Share card ----------
  let cardEl = null;
  function shareText(game, lines, run = 1) {
    const head = (game ? `Incremendle: ${game.title}${game.emoji ? ' ' + game.emoji : ''}` : 'Incremendle') + (run > 1 ? ` (run ${run})` : '');
    const url = game ? `${SITE}/${game.slug}` : SITE;
    return [head, (lines || []).join(' · '), url].filter(Boolean).join('\n');
  }

  async function openCard() {
    const list = await manifest();
    const game = list.find(g => g.n === DAY) || null;
    const runs = runsOf(completions()[DAY]);
    const last = runs[runs.length - 1];
    const text = shareText(game, last ? last.lines : [], runs.length);
    const s = streak(list);

    if (!cardEl) {
      cardEl = modal('di-share-card', '', '', `
        <pre class="di-share" id="di-share" tabindex="0"></pre>
        <div class="di-row">
          <button type="button" class="di-btn di-copy">Copy result</button>
          <a class="di-btn di-ghost" href="/">More games</a>
          <button type="button" class="di-btn di-ghost di-again">Play again</button>
        </div>
        <p class="di-streak di-again-msg" aria-live="polite"></p>
        <div class="di-runs" hidden><h3><span>Your runs</span></h3><ol></ol></div>
        <p class="di-streak di-streak-count"></p>`);
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
      cardEl.querySelector('.di-again').addEventListener('click', e => {
        const btn = e.currentTarget;
        if (!btn.dataset.armed) {
          btn.dataset.armed = '1'; btn.textContent = 'Start over';
          cardEl.querySelector('.di-again-msg').textContent = 'The game starts from zero. This run stays in your history. Tap again to start.';
          return;
        }
        playAgain();
      });
    }
    const again = cardEl.querySelector('.di-again');
    delete again.dataset.armed; again.textContent = 'Play again';
    cardEl.querySelector('.di-again-msg').textContent = '';
    cardEl.setAttribute('eyebrow', game && game.date !== localDate() ? 'You finished it' : 'You finished today\'s game');
    cardEl.setAttribute('heading', game ? game.title : document.title);
    cardEl.querySelector('.di-share').textContent = text;
    cardEl.querySelector('.di-streak-count').textContent = s > 0 ? `Streak: ${s} day${s === 1 ? '' : 's'}` : '';
    const history = cardEl.querySelector('.di-runs');
    history.hidden = runs.length < 2;
    const times = runs.map(r => runSeconds(r.lines));
    const best = times.some(t => t != null) ? times.indexOf(Math.min(...times.filter(t => t != null))) : -1;
    history.querySelector('ol').innerHTML = runs.map((r, i) => `<li${i === runs.length - 1 ? ' class="di-run-last"' : ''}>`
      + `<span class="di-run-n">#${i + 1}</span><span class="di-run-at">${esc(shortDate(r.at))}</span>`
      + (i === best ? '<span class="di-run-best">fastest</span>' : '') + `<span class="di-run-lines">${esc((r.lines || []).join(' · '))}</span></li>`).join('');
    cardEl.show('.di-copy');
  }

  function finish({ lines = [] } = {}) {
    if (DAY == null) return;
    const done = completions();
    const run = { at: localDate(), lines };
    if (!done[DAY]) {
      done[DAY] = { at: run.at, lines, runs: [run] };
      store.set('done', done);
    } else {
      // A replay's finish adds a run; finishing the same run twice doesn't.
      const runs = runsOf(done[DAY]);
      if (runs.length < currentRun()) { done[DAY].runs = [...runs, run]; store.set('done', done); }
    }
    openCard();
  }

  // Clears this game's save (every di:<n>:* key) and reloads into a fresh start. Finished runs live
  // in di:done, so they stay.
  function playAgain() {
    const prefix = savePrefix();
    try {
      const old = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) old.push(k); }
      old.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(runKey(), String(runsOf(completions()[DAY]).length + 1));
    } catch (e) {}
    freezeSave();
    location.reload();
  }

  // The running game would save over a cleared or replaced save on its way out. Ignore its writes
  // until the reload.
  function freezeSave() {
    const prefix = savePrefix();
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith(prefix)) return; return set.call(this, k, v); };
    Storage.prototype.removeItem = function (k) { if (String(k).startsWith(prefix)) return; return remove.call(this, k); };
  }

  // The site used to count anonymous plays. Clear what that left behind.
  try { localStorage.removeItem('di:plays'); localStorage.removeItem('di:pid'); } catch (e) {}

  // ---------- Credits ----------
  // Games list what they're built on in credits.json next to the page (npm run credits -- <slug>).
  // The top bar links to a panel with each project's license and where to support it.
  let creditsEl = null;
  const LICENSES = { 'OFL-1.1': 'Open Font License', 'Apache-2.0': 'Apache License 2.0', 'UFL-1.0': 'Ubuntu Font License' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  function creditsHtml(c) {
    const item = (title, meta, support) => `<li><span class="di-credit-name">${title}</span><span class="di-credit-meta">${meta}</span>${support ? ` <a class="di-support" href="${esc(support)}" target="_blank" rel="noopener">Support ♥</a>` : ''}</li>`;
    const parts = [];
    if (c.libs && c.libs.length) parts.push(`<h3><span>Code</span></h3><ul>${c.libs.map(l => item(link(l.home, l.name), `${esc(l.what)} · ${esc(l.license)}`, l.support)).join('')}</ul>`);
    if (c.art && c.art.length) parts.push(`<h3><span>Art, redrawn for this game</span></h3><ul>${c.art.map(s => {
      const authors = [...new Set(s.icons.map(i => i.author))].join(', ');
      const icons = s.icons.map(i => link(i.source, i.icon.split(':')[1])).join(', ');
      return item(link(s.home, s.set), `${icons} · by ${esc(authors)} · ${link(s.licenseUrl, s.license)}`, s.support);
    }).join('')}</ul>`);
    if (c.sounds && c.sounds.length) parts.push(`<h3><span>Sounds</span></h3><ul>${c.sounds.map(x => item(link(x.home, x.name), `by ${esc(x.author)} · ${esc(x.license)}`, '')).join('')}</ul>`);
    if (c.palette) parts.push(`<h3><span>Palette</span></h3><ul>${item(link(c.palette.home, c.palette.name), c.palette.author ? `by ${esc(c.palette.author)} · Lospec` : 'Lospec', 'https://lospec.com/supporters')}</ul>`);
    if (c.fonts && c.fonts.length) parts.push(`<h3><span>Fonts</span></h3><ul>${c.fonts.map(f => item(link(f.home, f.name), `Google Fonts · ${esc(LICENSES[f.license] || f.license || 'Open Font License')}`, '')).join('')}</ul>`);
    parts.push(`<h3><span>This site</span></h3><ul>${item(link(SOURCE, 'Incremendle source code'), 'AGPL-3.0, like Strudel', '')}${item(link('/privacy/', 'Privacy'), 'what stays in your browser', '')}</ul>`);
    return parts.join('');
  }
  function openCredits(c) {
    if (!creditsEl) {
      creditsEl = modal('di-credits', 'Made with open things', 'Credits', `
        <div class="di-credits-body"></div>
        <p class="di-streak">These are free because people gave their time. If one made you smile, consider supporting it.</p>`);
    }
    creditsEl.querySelector('.di-credits-body').innerHTML = creditsHtml(c);
    creditsEl.show();
  }

  // ---------- What is even happening ----------
  // why.json: { intro, rolls: [{ roll, value, became, spoiler? }], outro? }. Rows marked spoiler stay
  // hidden behind a warning until the player asks for them.
  let whyEl = null;
  function whyHtml(w, open) {
    const row = r => `<li><span class="di-credit-name">${esc(r.roll)}: ${esc(r.value)}</span><span class="di-why-became">${esc(r.became)}</span></li>`;
    const plain = (w.rolls || []).filter(r => !r.spoiler), spoilers = (w.rolls || []).filter(r => r.spoiler);
    const parts = [];
    if (w.intro) parts.push(`<p class="di-why-intro">${esc(w.intro)}</p>`);
    parts.push(`<h3><span>The dice said</span></h3><ul>${plain.map(row).join('')}</ul>`);
    if (spoilers.length) {
      parts.push(`<h3><span>How it ends</span></h3>`);
      parts.push(open
        ? `<ul>${spoilers.map(row).join('')}</ul>${w.outro ? `<p class="di-why-intro">${esc(w.outro)}</p>` : ''}`
        : `<p class="di-why-intro">⚠ Spoilers: ${spoilers.length} more roll${spoilers.length > 1 ? 's' : ''} explain how the game ends. <button type="button" class="di-why-reveal">Show them</button></p>`);
    } else if (w.outro) parts.push(`<p class="di-why-intro">${esc(w.outro)}</p>`);
    return parts.join('');
  }
  function openWhy(w) {
    if (!whyEl) {
      whyEl = modal('di-why', 'Rolled by dice, explained by the maker', 'What is even happening', `<div class="di-credits-body"></div>`);
      whyEl.addEventListener('click', e => {
        if (e.target.closest('.di-why-reveal')) whyEl.querySelector('.di-credits-body').innerHTML = whyHtml(w, true);
      });
    }
    whyEl.querySelector('.di-credits-body').innerHTML = whyHtml(w, false);
    whyEl.show();
  }

  // ---------- Sound settings ----------
  // One panel for every game: effects and music volume plus mute, saved in localStorage and shared
  // across games. Games on the audio kit (shared/kit/audio.mjs) listen for the di:audio event.
  const audioKey = { sfx: 'di:volume-sfx', music: 'di:volume-music', muted: 'di:sound-muted' };
  const raw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const audioSettings = () => ({
    sfx: Number(raw(audioKey.sfx) ?? 0.8),
    music: raw('di:music-muted') === '1' ? 0 : Number(raw(audioKey.music) ?? 0.6),
    muted: raw(audioKey.muted) === '1',
  });
  function setAudio(patch) {
    const next = { ...audioSettings(), ...patch };
    try {
      localStorage.setItem(audioKey.sfx, String(next.sfx));
      localStorage.setItem(audioKey.music, String(next.music));
      localStorage.setItem(audioKey.muted, next.muted ? '1' : '0');
      localStorage.removeItem('di:music-muted');
    } catch (e) {}
    window.dispatchEvent(new Event('di:audio'));
    syncSound();
  }
  let soundEl = null, soundBtn = null;
  function syncSound() {
    const a = audioSettings();
    if (soundBtn) soundBtn.textContent = a.muted ? '♪ Sound off' : '♪ Sound';
    if (!soundEl) return;
    soundEl.querySelector('#di-sfx').value = Math.round(a.sfx * 100);
    soundEl.querySelector('#di-music').value = Math.round(a.music * 100);
    soundEl.querySelector('#di-mute').checked = a.muted;
    soundEl.querySelector('#di-sfx-v').textContent = Math.round(a.sfx * 100) + '%';
    soundEl.querySelector('#di-music-v').textContent = Math.round(a.music * 100) + '%';
  }
  function toggleSound() {
    if (!soundEl) {
      soundEl = document.createElement('div');
      soundEl.className = 'di-sound';
      soundEl.setAttribute('role', 'dialog');
      soundEl.setAttribute('aria-label', 'Sound settings');
      soundEl.innerHTML = `
        <label class="di-slider"><span>Effects</span><input id="di-sfx" type="range" min="0" max="100" step="1"><output id="di-sfx-v"></output></label>
        <label class="di-slider"><span>Music</span><input id="di-music" type="range" min="0" max="100" step="1"><output id="di-music-v"></output></label>
        <label class="di-mute"><input id="di-mute" type="checkbox"> Mute everything</label>
        <p class="di-sound-note">Saved for every game.</p>`;
      soundEl.querySelector('#di-sfx').addEventListener('input', e => setAudio({ sfx: e.target.value / 100 }));
      soundEl.querySelector('#di-music').addEventListener('input', e => setAudio({ music: e.target.value / 100 }));
      soundEl.querySelector('#di-mute').addEventListener('change', e => setAudio({ muted: e.target.checked }));
      soundBtn.after(soundEl);
      document.addEventListener('pointerdown', e => { if (!soundEl.hidden && !soundEl.contains(e.target) && e.target !== soundBtn) soundEl.hidden = true; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') soundEl.hidden = true; });
      soundEl.hidden = true;
    }
    soundEl.hidden = !soundEl.hidden;
    soundBtn.setAttribute('aria-expanded', String(!soundEl.hidden));
    syncSound();
  }
  addEventListener('storage', e => { if (e.key && e.key.startsWith('di:')) syncSound(); });

  // ---------- Moving a save ----------
  // Saves live in this browser only. The Save panel turns this game's save (every di:<n>:* key, plus
  // its completion) into a code to paste on another device, and loads one back in.
  const savePrefix = () => `di:${DAY}:`;
  const b64 = str => { const b = new TextEncoder().encode(str); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = str => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  function saveCode() {
    const keys = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(savePrefix())) keys[k.slice(savePrefix().length)] = localStorage.getItem(k); } } catch (e) {}
    if (!Object.keys(keys).length) return '';
    return `DI${DAY}-` + b64(JSON.stringify({ v: 1, n: DAY, keys, done: completions()[DAY] || null }));
  }
  // Accepts our codes, and a bare save copied out of the console ({"…"}) for this game.
  function readCode(text) {
    text = text.trim();
    if (text.startsWith('{')) { JSON.parse(text); return { n: DAY, keys: { save: text }, done: null }; }
    const m = text.replace(/\s+/g, '').match(/^DI(\d+)-([\w-]+)$/);
    if (!m) throw new Error('That doesn’t look like a save code.');
    const data = JSON.parse(unb64(m[2]));
    if (data.n !== DAY) throw new Error('That code is for a different day’s game.');
    return data;
  }
  function loadCode(data) {
    const prefix = savePrefix();
    const old = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) old.push(k); }
    old.forEach(k => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(data.keys || {})) localStorage.setItem(prefix + k, v);
    if (data.done) {
      const done = completions();
      // Keep whichever device has the longer run history; the first finish stays the earliest.
      if (!done[DAY]) done[DAY] = data.done;
      else if (runsOf(data.done).length > runsOf(done[DAY]).length) done[DAY] = { ...data.done, ...(done[DAY].at < data.done.at ? { at: done[DAY].at, lines: done[DAY].lines } : {}) };
      store.set('done', done);
    }
    freezeSave();
    location.reload();
  }
  let saveEl = null;
  function openSave() {
    if (!saveEl) {
      saveEl = modal('di-save', 'Play on another device', 'Your save', `
        <p class="di-streak">Your save lives in this browser. Copy the code, then paste it on the other device under Save.</p>
        <textarea class="di-code" id="di-code-out" readonly rows="3" aria-label="Save code for this game"></textarea>
        <div class="di-row"><button type="button" class="di-btn di-save-copy">Copy save code</button></div>
        <label class="di-streak" for="di-code-in">Got a code from another device?</label>
        <textarea class="di-code" id="di-code-in" rows="3" placeholder="Paste a save code"></textarea>
        <div class="di-row"><button type="button" class="di-btn di-ghost di-save-load">Load save</button></div>
        <p class="di-streak di-save-msg" aria-live="polite"></p>`);
      const msg = t => { saveEl.querySelector('.di-save-msg').textContent = t; };
      saveEl.querySelector('.di-save-copy').addEventListener('click', async e => {
        const btn = e.currentTarget, out = saveEl.querySelector('#di-code-out');
        out.value = saveCode();
        if (!out.value) { msg('Nothing saved yet. Play a little first.'); return; }
        try { await navigator.clipboard.writeText(out.value); btn.textContent = 'Copied'; }
        catch (err) { out.select(); btn.textContent = 'Selected, press copy'; }
        setTimeout(() => { btn.textContent = 'Copy save code'; }, 1800);
      });
      let armed = false;
      const load = saveEl.querySelector('.di-save-load');
      saveEl.querySelector('#di-code-in').addEventListener('input', () => { armed = false; load.textContent = 'Load save'; msg(''); });
      load.addEventListener('click', () => {
        let data;
        try { data = readCode(saveEl.querySelector('#di-code-in').value); } catch (err) { msg(err instanceof SyntaxError ? 'That code is cut off or mistyped.' : err.message); return; }
        const here = saveCode() !== '';
        if (here && !armed) { armed = true; load.textContent = 'Replace the save here'; msg('This replaces the game on this device. Tap again to load.'); return; }
        try { loadCode(data); } catch (err) { msg('Couldn’t load it here. Is storage turned off?'); }
      });
    }
    saveEl.querySelector('#di-code-out').value = saveCode();
    saveEl.querySelector('.di-save-msg').textContent = '';
    saveEl.show('.di-save-copy');
  }

  // ---------- Top bar on game pages ----------
  function addBar() {
    if (DAY == null) return;
    const bar = document.createElement('nav');
    bar.className = 'di-bar';
    bar.innerHTML = `<a href="/">← Incremendle</a><span class="di-right"><span class="di-sound-wrap"><button type="button" class="di-sound-btn" aria-expanded="false"></button></span></span>`;
    document.body.prepend(bar);
    const saveLink = document.createElement('a');
    saveLink.href = '#save'; saveLink.className = 'di-save-link'; saveLink.textContent = 'Save';
    saveLink.addEventListener('click', e => { e.preventDefault(); openSave(); });
    bar.querySelector('.di-right').prepend(saveLink);
    soundBtn = bar.querySelector('.di-sound-btn');
    soundBtn.addEventListener('click', toggleSound);
    syncSound();
    // Panels that need a file are fetched; their links keep this order (What??, Credits) whichever loads first.
    const right = bar.querySelector('.di-right');
    const panelLink = (attr, file, ok, cls, text, open) => {
      if (!script || !script.hasAttribute(attr)) return;
      const a = document.createElement('a');
      a.href = '#' + file.split('.')[0]; a.className = cls; a.textContent = text; a.hidden = true;
      right.insertBefore(a, saveLink);
      fetch(file, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(data => {
        if (!data || !ok(data)) return;
        a.addEventListener('click', e => { e.preventDefault(); open(data); });
        a.hidden = false;
      }).catch(() => {});
    };
    panelLink('data-why', 'why.json', w => (w.rolls || []).length, 'di-why-link', 'What??', openWhy);
    panelLink('data-credits', 'credits.json', c => (c.libs || []).length || (c.art || []).length || c.palette || (c.fonts || []).length, 'di-credits-link', 'Credits', openCredits);
  }

  // Stylesheet lives next to this script, plus the site's handwriting fonts for the panels and the
  // Sound popover (declared only; the browser fetches them when a panel first shows).
  for (const href of ['/shared/daily.css', '/shared/fonts/gaegu/font.css', '/shared/fonts/patrick-hand/font.css']) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    document.head.appendChild(css);
  }

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
