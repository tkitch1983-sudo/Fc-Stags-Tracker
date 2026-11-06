// Temporary, single-purpose update for the user-supplied 2 November 2026 table.
// Delete this function after a verified application. No fixture or result changes.
const { createHash, timingSafeEqual } = require('node:crypto');
const EXPECTED_HASH = '24a4604861b728f497f61e4f40b6e3601cfeb692fa68b947efe161c986002b9f';
const standings = [{"team":"Nunthorpe","p":7,"w":5,"d":1,"l":1,"f":34,"a":17},{"team":"Guisborough Town","p":7,"w":5,"d":1,"l":1,"f":27,"a":14},{"team":"Hartlepool Stags","p":6,"w":5,"d":0,"l":1,"f":22,"a":6},{"team":"Middleton Rangers","p":7,"w":4,"d":1,"l":2,"f":17,"a":17},{"team":"Kader","p":6,"w":3,"d":2,"l":1,"f":28,"a":9},{"team":"Stockton Town","p":7,"w":2,"d":3,"l":2,"f":21,"a":15},{"team":"Redcar Town","p":7,"w":2,"d":1,"l":4,"f":17,"a":27},{"team":"Billingham","p":7,"w":2,"d":0,"l":5,"f":16,"a":29},{"team":"Northallerton Blacks","p":7,"w":1,"d":1,"l":5,"f":11,"a":34},{"team":"Ferryhill","p":7,"w":0,"d":0,"l":7,"f":6,"a":31}];
const response = (statusCode, object) => ({ statusCode, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}, body: JSON.stringify(object) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return response(405,{error:'Method not allowed'});
  const supplied = String(event.queryStringParameters?.token || '');
  const hash = createHash('sha256').update(supplied).digest('hex');
  if (!timingSafeEqual(Buffer.from(hash), Buffer.from(EXPECTED_HASH))) return response(403,{error:'Forbidden'});
  if (Date.now() > Date.parse('2026-11-06T20:00:00Z')) return response(410,{error:'Expired'});
  try {
    // Read the existing site's shared-data API credentials, not new credentials.
    const site = await fetch('https://fcstags.netlify.app/',{cache:'no-store'});
    if (!site.ok) throw Error('Site unavailable');
    const html = await site.text();
    const endpoint = html.match(/const JSONBLOB_URL\\s*=\\s*'([^']+)'/);
    const secret = html.match(/const JSONBIN_MASTER_KEY\\s*=\\s*'([^']+)'/);
    if (!endpoint || !secret) throw Error('Data API configuration missing');
    const url = endpoint[1], key = secret[1];
    const getRecord = async () => {
      const res = await fetch(url,{headers:{'X-Master-Key':key},cache:'no-store'});
      if (!res.ok) throw Error('Read shared table failed: HTTP '+res.status);
      const body=await res.json();
      if (!body || !body.record || typeof body.record!=='object' || Array.isArray(body.record)) throw Error('Invalid shared record');
      return body.record;
    };
    const rec = await getRecord();
    if (!Array.isArray(rec.standings)) throw Error('Shared standings are not an array');
    const currentStags = rec.standings.find(x => /hartlepool stags/i.test(x.team || ''));
    if (!currentStags) throw Error('Stags are missing from current standings');
    if (Number(currentStags.p)>6) return response(409,{error:'Live table is newer than supplied screenshot; no changes made'});
    const equal=(a,b) => JSON.stringify(a)===JSON.stringify(b);
    if (!equal(rec.standings,standings)) {
      const put=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':key},body:JSON.stringify({...rec,standings})});
      if (!put.ok) throw Error('Write shared table failed: HTTP '+put.status);
    }
    const check=await getRecord();
    if (!equal(check.standings,standings)) throw Error('Read-back did not match; verify manually');
    return response(200,{status:'verified',teams:check.standings.length,stags:check.standings[2],unchangedKeys:Object.keys(rec).filter(k=>k!=='standings').every(k=>equal(rec[k],check[k]))});
  } catch (e) {
    return response(500,{status:'failed',error:String(e.message||e).slice(0,130)});
  }
};
