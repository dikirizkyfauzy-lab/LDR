// Vercel serverless function: POST /api/data  body: { room: "secret code", set: { key: value, ... } }
// Stores each list in a Redis hash (Upstash via Vercel Marketplace) and returns the full state.
const crypto = require('crypto');
const KEYS = ['ldrStart', 'watch', 'game', 'meet', 'log0', 'log1'];

async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) { const e = new Error('no redis'); e.code = 503; throw e; }
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { room, set } = body;
    if (typeof room !== 'string' || room.length < 8 || room.length > 64) {
      return res.status(400).json({ error: 'bad room' });
    }
    const hk = 'ldr:' + crypto.createHash('sha256').update('ldr|' + room).digest('hex').slice(0, 40);
    const args = [];
    for (const k of Object.keys(set || {})) {
      if (!KEYS.includes(k)) continue;
      const s = JSON.stringify(set[k]);
      if (s.length > 900000) return res.status(413).json({ error: 'too big' });
      args.push(k, s);
    }
    if (args.length) await redis(['HSET', hk, ...args]);
    const flat = await redis(['HGETALL', hk]);
    const state = {};
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) { try { state[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} }
    } else if (flat && typeof flat === 'object') {
      for (const k of Object.keys(flat)) { try { state[k] = JSON.parse(flat[k]); } catch (e) {} }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ state });
  } catch (e) {
    return res.status(e.code === 503 ? 503 : 500).json({ error: 'server error' });
  }
};
