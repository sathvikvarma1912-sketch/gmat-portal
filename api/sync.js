// Cloud history for GMAT Practice Room, kept in a private Vercel Blob store.
// GET    /api/sync                 -> { tests: [...], attempts: [...], session: {...}|null }
// POST   /api/sync {kind,id,data}  -> saves one item (kind: test | attempt | session)
// DELETE /api/sync?kind=..&id=..   -> removes one item
// The site sits behind Vercel Authentication, so only the owner can reach this.
const { put, list, get, del } = require('@vercel/blob');

const ROOT = 'gmat/';
const KINDS = { test: 'tests', attempt: 'attempts', session: 'session' };
const ID = /^[A-Za-z0-9_-]{1,80}$/;

function pathFor(kind, id) {
  if (!KINDS[kind]) throw new Error('bad kind');
  if (kind === 'session') return ROOT + 'session.json';
  if (!ID.test(String(id || ''))) throw new Error('bad id');
  return `${ROOT}${KINDS[kind]}/${id}.json`;
}

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

async function readJson(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Cloud storage is not configured' });
  try {
    if (req.method === 'GET') {
      const blobs = await listAll(ROOT);
      const items = await Promise.all(blobs.map(async b => {
        try { return { pathname: b.pathname, data: await readJson(b.pathname) }; } catch (e) { return null; }
      }));
      const out = { tests: [], attempts: [], session: null };
      for (const it of items) {
        if (!it || !it.data) continue;
        if (it.pathname === ROOT + 'session.json') out.session = it.data;
        else if (it.pathname.startsWith(ROOT + 'tests/')) out.tests.push(it.data);
        else if (it.pathname.startsWith(ROOT + 'attempts/')) out.attempts.push(it.data);
      }
      return res.status(200).json(out);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!body.data || typeof body.data !== 'object') return res.status(400).json({ error: 'missing data' });
      const pathname = pathFor(body.kind, body.id);
      await put(pathname, JSON.stringify(body.data), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
      });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const pathname = pathFor(req.query.kind, req.query.id);
      await del(pathname);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    const msg = String((e && e.message) || e);
    return res.status(/^bad /.test(msg) ? 400 : 500).json({ error: msg });
  }
};
