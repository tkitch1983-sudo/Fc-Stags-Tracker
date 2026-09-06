// Runs automatically once a day (see the `config.schedule` export below).
// Checks games and training sessions happening exactly 2 days from now,
// and sends a push notification to everyone marked "Attending" who has
// notifications enabled on their device.

import webpush from 'web-push';

const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6a9dad16da38895dfe409235';
const JSONBIN_MASTER_KEY = '$2a$10$CuR9F/hDrQ5I/2repYjK6eebHJ0J2QVsp2.4NKeWgTvOBIy3GYY1q';

// These must match the keys generated for this project.
// The PRIVATE key should ideally live in a Netlify environment variable
// (Site settings -> Environment variables -> VAPID_PRIVATE_KEY) rather
// than sitting in code, especially if this repo is ever made public.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEWdcbj-zK5NxuS9qL4USRTYlJG7liqCLJ9DhOBGo3YPX8aipSHbqsDPMrOUXvfIVF5szF7tcy7I_C37J-FHc3E';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'pT8EqBGAx4fT0-HGyzYwHxXziqwtJdJMSEvr_UyWZgw';

webpush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function twoDaysFromNowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

function isFriday(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay() === 5;
}

export default async (req) => {
  const targetDate = twoDaysFromNowStr();

  let record = {};
  try {
    const res = await fetch(JSONBIN_URL, { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY } });
    const data = await res.json();
    record = data.record || {};
  } catch (e) {
    return new Response('Could not load shared data: ' + e.message, { status: 500 });
  }

  // Fixtures now live in shared storage (added via the app's Fixtures tab),
  // so this always matches whatever's currently in the app — no separate
  // list to keep in sync here.
  const fixtures = Array.isArray(record.fixtures) ? record.fixtures : [];
  const sessions = [];

  const fixture = fixtures.find(f => f.date === targetDate);
  if (fixture) {
    sessions.push({
      id: 'game-' + fixture.id,
      title: `Match in 2 days: ${fixture.isHome ? 'vs' : '@'} ${fixture.opponent}`,
      body: `${targetDate}${fixture.time ? ', ' + fixture.time : ''} — ${fixture.venue || ''}`
    });
  }
  if (isFriday(targetDate)) {
    sessions.push({
      id: 'training-' + targetDate,
      title: 'Training in 2 days',
      body: `${targetDate}, 4-5pm — Grayfields Recreation Ground (3G)`
    });
  }

  if (sessions.length === 0) {
    return new Response('No sessions 2 days out.', { status: 200 });
  }

  const attendance = record.attendance || {};
  const subscriptions = Array.isArray(record.pushSubscriptions) ? record.pushSubscriptions : [];
  let sent = 0;
  const staleEndpoints = [];

  for (const session of sessions) {
    const entry = attendance[session.id] || {};
    const attendingNames = Object.keys(entry).filter(name => entry[name] === 'yes');
    if (attendingNames.length === 0) continue;

    const matchingSubs = subscriptions.filter(s => attendingNames.includes(s.childName));
    for (const sub of matchingSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: session.title, body: session.body })
        );
        sent++;
      } catch (err) {
        // 404/410 means the subscription is no longer valid (uninstalled, permission revoked, etc.)
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }
  }

  // Clean up subscriptions that are no longer valid.
  if (staleEndpoints.length > 0) {
    const cleaned = subscriptions.filter(s => !staleEndpoints.includes(s.endpoint));
    try {
      await fetch(JSONBIN_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_MASTER_KEY },
        body: JSON.stringify({ ...record, pushSubscriptions: cleaned })
      });
    } catch (e) { /* non-fatal */ }
  }

  return new Response(`Sent ${sent} reminder(s) for ${sessions.length} session(s).`, { status: 200 });
};

// Runs once a day at 09:00 UTC. Cron syntax: minute hour day month weekday.
export const config = {
  schedule: '0 9 * * *'
};
