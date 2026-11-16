/* Elelroi Mental Wellness — cross-device sync Worker (Cloudflare Workers + D1)
 *
 * One small backend so the admin passcode, recovery question, contact details,
 * flyers, content and bookings are shared across EVERY device/browser.
 *
 * DEPLOY (dashboard, ~5 min):
 *   1. Cloudflare dashboard → Storage & Databases → D1 → Create database → name: elelroi
 *   2. Workers & Pages → Create → Worker → name: elelroi-sync → paste this whole file → Deploy
 *   3. The new Worker → Settings → Bindings → Add binding → D1 database:
 *        Variable name: DB   ·   D1 database: elelroi   → Save & Deploy
 *   4. Copy the Worker URL (e.g. https://elelroi-sync.<your-subdomain>.workers.dev) and send it over.
 *
 * Security (static-site tier): secrets (passcode, recovery answer) are stored ONLY as
 * SHA-256 hashes; all writes require the current passcode; bookings can be added by the
 * public form but only LISTED with the passcode. Tables auto-create on first request.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s || ''));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const normAns = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function init(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, created_at TEXT)'),
  ]);
}
async function kvGet(db, k) {
  const r = await db.prepare('SELECT v FROM kv WHERE k=?').bind(k).first();
  return r ? JSON.parse(r.v) : null;
}
async function kvSet(db, k, v) {
  await db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
    .bind(k, JSON.stringify(v)).run();
}
async function passOk(db, pass) {
  const p = await kvGet(db, 'pass');
  if (!p || !p.h) return true; // bootstrap: no passcode set yet
  return (await sha256(pass)) === p.h;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!env.DB) return json({ error: 'D1 binding "DB" is missing — add it in Worker → Settings → Bindings' }, 500);

    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const db = env.DB;

    try {
      await init(db);
      switch (path) {
        case '/login': {
          const p = await kvGet(db, 'pass');
          if (!p || !p.h) {
            // first ever login: bootstrap with the historic default passcode
            if (body.pass === 'elelroi2026') { await kvSet(db, 'pass', { h: await sha256('elelroi2026') }); return json({ ok: true, bootstrapped: true }); }
            return json({ ok: false });
          }
          return json({ ok: (await sha256(body.pass)) === p.h });
        }
        case '/setpass': {
          if (!(await passOk(db, body.old))) return json({ error: 'unauthorized' }, 403);
          if (!body.new || String(body.new).length < 4) return json({ error: 'passcode too short' }, 400);
          await kvSet(db, 'pass', { h: await sha256(body.new) });
          return json({ ok: true });
        }
        case '/get': {
          if (body.key === 'pass' || body.key === 'recovery') return json({ error: 'forbidden' }, 403);
          return json({ value: await kvGet(db, body.key) });
        }
        case '/set': {
          if (body.key === 'pass' || body.key === 'recovery') return json({ error: 'use the dedicated endpoint' }, 400);
          if (!(await passOk(db, body.pass))) return json({ error: 'unauthorized' }, 403);
          await kvSet(db, body.key, body.value);
          return json({ ok: true });
        }
        case '/recovery/set': {
          if (!(await passOk(db, body.pass))) return json({ error: 'unauthorized' }, 403);
          if (!body.question || normAns(body.answer).length < 2) return json({ error: 'need question and answer' }, 400);
          await kvSet(db, 'recovery', { question: String(body.question), h: await sha256(normAns(body.answer)) });
          return json({ ok: true });
        }
        case '/recovery/question': {
          const r = await kvGet(db, 'recovery');
          return json({ question: r && r.question ? r.question : null });
        }
        case '/recovery/reset': {
          const r = await kvGet(db, 'recovery');
          if (!r || !r.h) return json({ ok: false });
          if ((await sha256(normAns(body.answer))) !== r.h) return json({ ok: false });
          if (!body.new || String(body.new).length < 4) return json({ error: 'passcode too short' }, 400);
          await kvSet(db, 'pass', { h: await sha256(body.new) });
          return json({ ok: true });
        }
        case '/bookings/add': {
          await db.prepare('INSERT INTO bookings(data,created_at) VALUES(?,?)')
            .bind(JSON.stringify(body.data || {}), new Date().toISOString()).run();
          return json({ ok: true });
        }
        case '/bookings/list': {
          if (!(await passOk(db, body.pass))) return json({ error: 'unauthorized' }, 403);
          const rs = await db.prepare('SELECT data,created_at FROM bookings ORDER BY id DESC').all();
          return json({ rows: (rs.results || []).map((r) => Object.assign(JSON.parse(r.data), { at: r.created_at })) });
        }
        case '/bookings/clear': {
          if (!(await passOk(db, body.pass))) return json({ error: 'unauthorized' }, 403);
          await db.prepare('DELETE FROM bookings').run();
          return json({ ok: true });
        }
        default:
          return json({ error: 'not found', path }, 404);
      }
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};
