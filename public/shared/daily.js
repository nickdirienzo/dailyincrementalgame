// Daily Incremental shared runtime.
// Include on every page:  <script src="/shared/daily.js" data-day="N" defer></script>
// N is the game's "n" in games.json: an internal id for saves and streaks, never shown to players.
// Add data-credits when the game has a credits.json next to it (npm run credits -- <slug>): the top
// bar then links to a Credits panel with licenses and support links.
// (omit data-day on non-game pages like the landing page).
//
// Game API:
//   DailyGame.finish({ lines: ['⏱ 9m12s', '1,204 polished'] })
//       Call once when the player reaches the ending. Records the completion,
//       updates the streak, and opens the share card.
//   DailyGame.share()      Reopen the share card (e.g. from a "Share" button).
//   DailyGame.day          This page's game number, or null.
//   DailyGame.storageKey(name)  -> 'di:<day>:<name>', for the game's own saves. Keep every save under
//       this prefix: the top bar's Save panel moves all of di:<day>:* to another device.
(() => {
  const script = document.currentScript;
  const DAY = script && script.dataset.day ? Number(script.dataset.day) : null;
  const SITE = 'dailyincrementalgame.com';
  const SOURCE = 'https://github.com/nickdirienzo/dailyincrementalgame';

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
    try { stats.finish(); } catch (e) {} // stats must never get in the way of an ending
    openCard();
  }

  // ---------- Play stats ----------
  // Anonymous totals per game, so we can see what gets played, what gets finished and how long it
  // takes: a random player id, sittings, seconds active (tab visible, input in the last minute) and
  // seconds visible (idling included), and whether the ending was reached. Kept in di:plays and
  // reported to /api/play (worker/index.js) every five minutes and when the tab hides.
  // Only on the live site, never in automated browsers or with Global Privacy Control or Do Not
  // Track on, and only after the first tap or key. /privacy/ explains it to players.
  const stats = (() => {
    const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
    const on = DAY != null && location.hostname === SITE && !navigator.webdriver && !optedOut;
    const ACTIVE_WINDOW = 60000, REPORT_EVERY = 300;
    let started = false, lastInput = 0, lastTick = 0, sinceReport = 0;
    const plays = () => store.get('plays', {});
    const mine = () => plays()[DAY];
    // Read and write fresh each time so two tabs of the same game add up instead of overwriting.
    const update = fn => { const all = plays(); const r = all[DAY]; if (!r) return; fn(r); store.set('plays', all); };
    function pid() {
      let id = store.get('pid', null);
      if (!id) {
        const h = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
        id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        store.set('pid', id);
      }
      return id;
    }
    function report() {
      const r = mine();
      if (!r) return;
      const body = JSON.stringify({ pid: pid(), n: DAY, sessions: r.sessions, active: Math.round(r.active), visible: Math.round(r.visible), finished: !!r.finished });
      try { navigator.sendBeacon('/api/play', new Blob([body], { type: 'application/json' })); } catch (e) {}
      sinceReport = 0;
    }
    function tick() {
      const now = performance.now();
      const dt = Math.min(10, (now - lastTick) / 1000); // a sleeping laptop isn't play time
      lastTick = now;
      if (document.visibilityState !== 'visible' || (mine() || {}).finished) return;
      const active = Date.now() - lastInput < ACTIVE_WINDOW;
      update(r => { r.visible += dt; if (active) r.active += dt; });
      if ((sinceReport += dt) >= REPORT_EVERY) report();
    }
    function start() {
      if (started) return;
      started = true;
      const all = plays();
      if (!all[DAY]) all[DAY] = { sessions: 0, active: 0, visible: 0 };
      all[DAY].sessions++;
      store.set('plays', all);
      lastTick = performance.now();
      setInterval(tick, 5000);
      addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { tick(); report(); } });
      addEventListener('pagehide', () => { tick(); report(); });
      report();
    }
    if (on) {
      const r = mine();
      // Finished before stats existed (or already reported the ending): nothing honest to add.
      const skip = (r && r.finished) || (!r && completions()[DAY]);
      if (!skip) {
        const input = () => { lastInput = Date.now(); try { start(); } catch (e) {} };
        for (const t of ['pointerdown', 'keydown', 'wheel']) addEventListener(t, input, { capture: true, passive: true });
        addEventListener('pointermove', () => { if (started) lastInput = Date.now(); }, { capture: true, passive: true });
      }
    }
    return {
      finish() {
        if (!started) return;
        tick();
        update(r => { r.finished = true; });
        report();
      },
    };
  })();

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
    parts.push(`<h3><span>This site</span></h3><ul>${item(link(SOURCE, 'Daily Incremental source code'), 'AGPL-3.0, like Strudel', '')}${item(link('/privacy/', 'Privacy'), 'what we count, and what stays in your browser', '')}</ul>`);
    return parts.join('');
  }
  function openCredits(c) {
    if (!creditsEl) {
      creditsEl = document.createElement('div');
      creditsEl.className = 'di-overlay';
      creditsEl.innerHTML = `
        <div class="di-card di-credits" role="dialog" aria-modal="true" aria-labelledby="di-credits-title">
          <p class="di-eyebrow">Made with open things</p>
          <h2 id="di-credits-title" class="di-title">Credits</h2>
          <div class="di-credits-body"></div>
          <p class="di-streak">These are free because people gave their time. If one made you smile, consider supporting it.</p>
          <button type="button" class="di-close" aria-label="Close">×</button>
        </div>`;
      document.body.appendChild(creditsEl);
      const close = () => { creditsEl.hidden = true; };
      creditsEl.addEventListener('click', e => { if (e.target === creditsEl) close(); });
      creditsEl.querySelector('.di-close').addEventListener('click', close);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }
    creditsEl.querySelector('.di-credits-body').innerHTML = creditsHtml(c);
    creditsEl.hidden = false;
    creditsEl.querySelector('.di-close').focus();
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
    if (data.done) { const done = completions(); if (!done[DAY]) { done[DAY] = data.done; store.set('done', done); } }
    // The running game would save over the new save on its way out. Ignore its writes until the reload.
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith(prefix)) return; return set.call(this, k, v); };
    Storage.prototype.removeItem = function (k) { if (String(k).startsWith(prefix)) return; return remove.call(this, k); };
    location.reload();
  }
  let saveEl = null;
  function openSave() {
    if (!saveEl) {
      saveEl = document.createElement('div');
      saveEl.className = 'di-overlay';
      saveEl.innerHTML = `
        <div class="di-card" role="dialog" aria-modal="true" aria-labelledby="di-save-title">
          <p class="di-eyebrow">Play on another device</p>
          <h2 id="di-save-title" class="di-title">Your save</h2>
          <p class="di-streak">Your save lives in this browser. Copy the code, then paste it on the other device under Save.</p>
          <textarea class="di-code" id="di-code-out" readonly rows="3" aria-label="Save code for this game"></textarea>
          <div class="di-row"><button type="button" class="di-btn di-save-copy">Copy save code</button></div>
          <label class="di-streak" for="di-code-in">Got a code from another device?</label>
          <textarea class="di-code" id="di-code-in" rows="3" placeholder="Paste a save code"></textarea>
          <div class="di-row"><button type="button" class="di-btn di-ghost di-save-load">Load save</button></div>
          <p class="di-streak di-save-msg" aria-live="polite"></p>
          <button type="button" class="di-close" aria-label="Close">×</button>
        </div>`;
      document.body.appendChild(saveEl);
      const close = () => { saveEl.hidden = true; };
      const msg = t => { saveEl.querySelector('.di-save-msg').textContent = t; };
      saveEl.addEventListener('click', e => { if (e.target === saveEl) close(); });
      saveEl.querySelector('.di-close').addEventListener('click', close);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
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
    saveEl.hidden = false;
    saveEl.querySelector('.di-save-copy').focus();
  }

  // ---------- Top bar on game pages ----------
  function addBar() {
    if (DAY == null) return;
    const bar = document.createElement('nav');
    bar.className = 'di-bar';
    bar.innerHTML = `<a href="/">← Daily Incremental</a><span class="di-right"><span class="di-sound-wrap"><button type="button" class="di-sound-btn" aria-expanded="false"></button></span></span>`;
    document.body.prepend(bar);
    const saveLink = document.createElement('a');
    saveLink.href = '#save'; saveLink.className = 'di-save-link'; saveLink.textContent = 'Save';
    saveLink.addEventListener('click', e => { e.preventDefault(); openSave(); });
    bar.querySelector('.di-right').prepend(saveLink);
    soundBtn = bar.querySelector('.di-sound-btn');
    soundBtn.addEventListener('click', toggleSound);
    syncSound();
    if (!script || !script.hasAttribute('data-credits')) return;
    fetch('credits.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(c => {
      if (!c || !((c.libs || []).length || (c.art || []).length || c.palette || (c.fonts || []).length)) return;
      const a = document.createElement('a');
      a.href = '#credits'; a.className = 'di-credits-link'; a.textContent = 'Credits';
      a.addEventListener('click', e => { e.preventDefault(); openCredits(c); });
      bar.querySelector('.di-right').prepend(a);
    }).catch(() => {});
  }

  // Stylesheet lives next to this script, plus the site's handwriting fonts for the Credits panel
  // (declared only; the browser fetches them when the panel first shows).
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
