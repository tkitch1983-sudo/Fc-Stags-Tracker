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
