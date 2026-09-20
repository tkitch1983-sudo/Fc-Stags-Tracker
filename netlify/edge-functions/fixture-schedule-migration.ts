import type { Context, Config } from "@netlify/edge-functions";

export default async (req: Request, context: Context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const script = String.raw`<script>
(() => {
  const desiredFixtures = [
    { id:'2026-09-20', opponent:'Stockton Town Reds U10', isHome:false, date:'2026-09-20', time:'09:00', venue:'STOCKTON TOWN FOOTBALL CLUB 2', competition:'League' },
    { id:'2026-10-04', opponent:'Guisborough Town Royals U10', isHome:true, date:'2026-10-04', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2026-10-11', opponent:'Redcar Town Royals U10', isHome:true, date:'2026-10-11', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2026-10-18', opponent:'Boro Rangers Oranges U10', isHome:false, date:'2026-10-18', time:'10:00', venue:'TRINITY CATHOLIC COLLEGE 9', competition:'Cup', round:'U10 Preliminary Round' },
    { id:'2026-10-25', opponent:'Ferryhill Miners United U10', isHome:false, date:'2026-10-25', time:'10:00', venue:'FERRYHILL SPORTS & EDUCATION CENTRE 2', competition:'League' },
    { id:'2026-11-01', opponent:'Nunthorpe Athletic Blues U10', isHome:false, date:'2026-11-01', time:'10:00', venue:'NUNTHORPE & MARTON PLAYING FIELDS ASSOCIATION 12', competition:'League' },
    { id:'2026-11-08', opponent:'Northallerton Town Blacks U10', isHome:true, date:'2026-11-08', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2026-11-15', opponent:'Stockton Town Reds U10', isHome:true, date:'2026-11-15', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2026-11-22', opponent:'Kader FC U10', isHome:false, date:'2026-11-22', time:'10:00', venue:'KADER U10 FC', competition:'League' },
    { id:'2026-11-29', opponent:'Guisborough Town Royals U10', isHome:false, date:'2026-11-29', time:'10:00', venue:'LAURENCE JACKSON SPORTS VILLAGE 11', competition:'League' },
    { id:'2026-12-06', opponent:'Nunthorpe Athletic Blues U10', isHome:true, date:'2026-12-06', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2026-12-13', opponent:'Redcar Town Royals U10', isHome:false, date:'2026-12-13', time:'10:00', venue:'MO MOWLAM MEMORIAL PARK 1', competition:'League' },
    { id:'2026-12-20', opponent:'Middleton Rangers Spitfires U10', isHome:false, date:'2026-12-20', time:'10:00', venue:'EASTBOURNE SPORTS COMPLEX 3', competition:'League' },
    { id:'2027-01-10', opponent:'Billingham Juniors U10', isHome:true, date:'2027-01-10', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2027-01-17', opponent:'Ferryhill Miners United U10', isHome:true, date:'2027-01-17', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2027-01-24', opponent:'Kader FC U10', isHome:true, date:'2027-01-24', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' },
    { id:'2027-02-14', opponent:'Middleton Rangers Spitfires U10', isHome:true, date:'2027-02-14', time:'10:00', venue:'GRAYFIELDS RECREATION GROUND 4', competition:'League' }
  ];

  const same = (current) => Array.isArray(current) && current.length === desiredFixtures.length && desiredFixtures.every((f, i) => {
    const c = current[i] || {};
    return c.id === f.id && c.opponent === f.opponent && !!c.isHome === f.isHome && c.date === f.date && c.time === f.time && c.venue === f.venue;
  });

  let tries = 0;
  const apply = async () => {
    tries++;
    try {
      if (typeof save !== 'function' || typeof renderFixtures !== 'function' || !Array.isArray(fixtures)) {
        if (tries < 40) setTimeout(apply, 250);
        return;
      }
      if (same(fixtures)) return;
      fixtures = desiredFixtures.map(f => ({ ...f }));
      const ok = await save();
      renderFixtures();
      if (ok === false) console.error('Fixture schedule migration could not be saved.');
    } catch (e) {
      if (tries < 40) setTimeout(apply, 250);
    }
  };
  setTimeout(apply, 600);
})();
</script>`;

  const updated = html.includes("</body>") ? html.replace("</body>", script + "</body>") : html + script;
  return new Response(updated, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const config: Config = {
  path: "/",
};
