export default async (req: Request, context: any) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const script = `
<script>
(() => {
  if (window.__stagsMotmFullscreen) return;
  window.__stagsMotmFullscreen = true;

  const ensureModal = () => {
    let modal = document.getElementById('motmFullscreenModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'motmFullscreenModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.96);align-items:center;justify-content:center;padding:18px;';
    modal.innerHTML = '<button type="button" aria-label="Close full photo" style="position:absolute;top:max(16px,env(safe-area-inset-top));right:16px;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.55);color:#fff;font-size:28px;line-height:1;z-index:2;">×</button><img alt="Man of the Match full photo" style="max-width:100%;max-height:92vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.45);">';
    document.body.appendChild(modal);
    const close = () => { modal.style.display = 'none'; modal.setAttribute('aria-hidden','true'); };
    modal.querySelector('button').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return modal;
  };

  document.addEventListener('click', (e) => {
    const img = e.target && e.target.closest ? e.target.closest('img[alt="Man of the Match"]') : null;
    if (!img) return;
    e.preventDefault();
    const modal = ensureModal();
    const full = modal.querySelector('img');
    full.src = img.currentSrc || img.src;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
  });

  const makeTappable = () => {
    document.querySelectorAll('img[alt="Man of the Match"]').forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.title = 'Tap to view full photo';
    });
  };
  makeTappable();
  new MutationObserver(makeTappable).observe(document.body, { childList: true, subtree: true });

  const desiredStandings = [
    { team: 'Hartlepool Stags', p: 3, w: 3, d: 0, l: 0, f: 14, a: 1 },
    { team: 'Nunthorpe', p: 3, w: 3, d: 0, l: 0, f: 21, a: 12 },
    { team: 'Guisborough Town', p: 3, w: 2, d: 0, l: 1, f: 13, a: 9 },
    { team: 'Middleton Rangers', p: 3, w: 2, d: 0, l: 1, f: 8, a: 5 },
    { team: 'Kader', p: 3, w: 1, d: 1, l: 1, f: 10, a: 6 },
    { team: 'Stockton Town', p: 3, w: 1, d: 1, l: 1, f: 9, a: 5 },
    { team: 'Redcar Town', p: 3, w: 1, d: 1, l: 1, f: 10, a: 9 },
    { team: 'Northallerton Blacks', p: 3, w: 0, d: 1, l: 2, f: 5, a: 17 },
    { team: 'Billingham', p: 3, w: 0, d: 0, l: 3, f: 3, a: 14 },
    { team: 'Ferryhill', p: 3, w: 0, d: 0, l: 3, f: 2, a: 17 }
  ];

  const syncLatestLeagueTable = async () => {
    try {
      if (typeof refreshFromBlob !== 'function' || typeof save !== 'function') return;
      await refreshFromBlob();
      if (!Array.isArray(standings) || standings.length === 0) return;
      const maxPlayed = Math.max(...standings.map((t) => Number(t.p) || 0));
      if (maxPlayed > 3) return;
      const norm = (arr) => JSON.stringify(arr.map((t) => [t.team, Number(t.p)||0, Number(t.w)||0, Number(t.d)||0, Number(t.l)||0, Number(t.f)||0, Number(t.a)||0]));
      if (norm(standings) === norm(desiredStandings)) return;
      standings = desiredStandings.map((t) => ({ ...t }));
      const ok = await save();
      if (ok !== false && typeof renderTable === 'function') renderTable();
    } catch (e) { /* leave existing table untouched if sync fails */ }
  };
  setTimeout(syncLatestLeagueTable, 1200);

  const restoreMissingMotmPhotos = async () => {
    try {
      if (typeof refreshFromBlob !== 'function' || typeof save !== 'function' || typeof games === 'undefined') return;
      await refreshFromBlob();
      if (!Array.isArray(games) || games.length === 0) return;

      let changed = false;
      const sameGame = (a, b) => {
        if (String(a.id || '') && String(a.id || '') === String(b.id || '')) return true;
        return String(a.date || '') === String(b.date || '') && String(a.opponent || '').trim().toLowerCase() === String(b.opponent || '').trim().toLowerCase();
      };

      const missing = () => games.filter((g) => !g.motmPhoto);
      if (missing().length) {
        try {
          const countRes = await fetch(JSONBLOB_URL + '/versions/count', { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY } });
          if (countRes.ok) {
            const countData = await countRes.json();
            const versionCount = Number(countData && countData.metadata && countData.metadata.versionCount) || 0;
            const oldest = Math.max(1, versionCount - 59);
            for (let v = versionCount; v >= oldest && missing().length; v--) {
              try {
                const vr = await fetch(JSONBLOB_URL + '/' + v, { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY } });
                if (!vr.ok) continue;
                const vd = await vr.json();
                const oldGames = vd && vd.record && Array.isArray(vd.record.games) ? vd.record.games : [];
                oldGames.forEach((oldGame) => {
                  if (!oldGame || !oldGame.motmPhoto) return;
                  const current = games.find((g) => !g.motmPhoto && sameGame(g, oldGame));
                  if (current) {
                    current.motmPhoto = oldGame.motmPhoto;
                    changed = true;
                  }
                });
              } catch (e) { /* try older version */ }
            }
          }
        } catch (e) { /* use known storage fallbacks below */ }
      }

      const fallbacks = [
        { date: '2026-09-20', opponent: 'Stockton Town Reds', url: 'https://xpfondrwxsydesskmaus.supabase.co/storage/v1/object/public/stags-site-photos/motm/1789903316276-hkho7mre.png' },
        { date: '2026-09-06', opponent: 'Northallerton', url: 'https://xpfondrwxsydesskmaus.supabase.co/storage/v1/object/public/stags-site-photos/motm/1789906242253-yykatw2x.png' }
      ];
      fallbacks.forEach((f) => {
        const current = games.find((g) => !g.motmPhoto && String(g.date || '') === f.date && String(g.opponent || '').toLowerCase().includes(f.opponent.toLowerCase()));
        if (current) {
          current.motmPhoto = f.url;
          changed = true;
        }
      });

      if (changed) {
        const ok = await save();
        if (ok !== false && typeof render === 'function') render();
      }
    } catch (e) { /* never disturb results if recovery fails */ }
  };
  setTimeout(restoreMissingMotmPhotos, 2200);

  const restoreEventsAndSquad = async () => {
    try {
      if (typeof refreshFromBlob !== 'function' || typeof save !== 'function' || typeof events === 'undefined' || typeof squad === 'undefined') return;
      await refreshFromBlob();
      const eventsNeedRestore = !Array.isArray(events) || events.length === 0;
      const squadNeedsRestore = Array.isArray(squad) && squad.length > 0 && squad.some((p) => {
        const n = p && (p.number ?? p.no ?? p.shirtNumber ?? p.squadNumber);
        return n === undefined || n === null || String(n).trim() === '';
      });
      if (!eventsNeedRestore && !squadNeedsRestore) return;

      const countRes = await fetch(JSONBLOB_URL + '/versions/count', { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY } });
      if (!countRes.ok) return;
      const countData = await countRes.json();
      const versionCount = Number(countData && countData.metadata && countData.metadata.versionCount) || 0;
      const oldest = Math.max(1, versionCount - 99);
      let recoveredEvents = null;
      let recoveredSquad = null;

      const numberOf = (p) => p && (p.number ?? p.no ?? p.shirtNumber ?? p.squadNumber);
      const keyOf = (p) => String((p && (p.id ?? p.name ?? p.player ?? p.playerName)) || '').trim().toLowerCase();

      for (let v = versionCount; v >= oldest && ((!recoveredEvents && eventsNeedRestore) || (!recoveredSquad && squadNeedsRestore)); v--) {
        try {
          const vr = await fetch(JSONBLOB_URL + '/' + v, { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY } });
          if (!vr.ok) continue;
          const vd = await vr.json();
          const rec = vd && vd.record ? vd.record : {};
          if (eventsNeedRestore && !recoveredEvents && Array.isArray(rec.events) && rec.events.length) {
            recoveredEvents = rec.events;
          }
          if (squadNeedsRestore && !recoveredSquad && Array.isArray(rec.squad) && rec.squad.length) {
            const numbered = rec.squad.filter((p) => {
              const n = numberOf(p);
              return n !== undefined && n !== null && String(n).trim() !== '';
            });
            if (numbered.length) recoveredSquad = rec.squad;
          }
        } catch (e) { /* try older version */ }
      }

      let changed = false;
      if (eventsNeedRestore && recoveredEvents) {
        events = recoveredEvents.map((e) => ({ ...e }));
        changed = true;
      }
      if (squadNeedsRestore && recoveredSquad) {
        const oldByKey = new Map(recoveredSquad.map((p) => [keyOf(p), p]));
        squad = squad.map((p) => {
          const old = oldByKey.get(keyOf(p));
          if (!old) return p;
          const currentNum = numberOf(p);
          if (currentNum !== undefined && currentNum !== null && String(currentNum).trim() !== '') return p;
          const oldNum = numberOf(old);
          if (oldNum === undefined || oldNum === null || String(oldNum).trim() === '') return p;
          const copy = { ...p };
          if ('number' in old) copy.number = old.number;
          else if ('no' in old) copy.no = old.no;
          else if ('shirtNumber' in old) copy.shirtNumber = old.shirtNumber;
          else if ('squadNumber' in old) copy.squadNumber = old.squadNumber;
          return copy;
        });
        changed = true;
      }
      if (changed) {
        const ok = await save();
        if (ok !== false && typeof render === 'function') render();
      }
    } catch (e) { /* keep current shared data if recovery fails */ }
  };
  setTimeout(restoreEventsAndSquad, 4200);

  const addSuperSundayFixture = async () => {
    try {
      if (typeof refreshFromBlob !== 'function' || typeof save !== 'function' || typeof fixtures === 'undefined') return;
      await refreshFromBlob();
      if (!Array.isArray(fixtures)) return;
      const alreadyThere = fixtures.some((f) => String(f.id || '') === 'tournament-2026-09-27-super-sunday' || (String(f.date || '') === '2026-09-27' && /super sunday autumn series/i.test(String(f.opponent || ''))));
      if (alreadyThere) return;
      fixtures.push({
        id: 'tournament-2026-09-27-super-sunday',
        opponent: 'Super Sunday Autumn Series (U11 Mid Level, 7v7)',
        isHome: false,
        date: '2026-09-27',
        time: '14:00',
        venue: 'Downhill Hubsite, Sunderland, SR5 4BB'
      });
      const ok = await save();
      if (ok !== false && typeof renderFixtures === 'function') renderFixtures();
    } catch (e) { /* leave current fixtures untouched if add fails */ }
  };
  setTimeout(addSuperSundayFixture, 5200);
})();
</script>`;

  const updated = html.includes("</body>")
    ? html.replace("</body>", script + "</body>")
    : html + script;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(updated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const config = {
  path: ["/", "/index.html"],
};
