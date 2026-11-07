module.exports = async (req, res) => {
  const { type, q, debug } = req.query || {};
  if (!q || q.length < 2) return res.status(200).json({ results: [] });
  try {
    let results = [];
    if (type === 'game') {
      const url = 'https://store.steampowered.com/api/storesearch/?l=english&cc=US&term=' + encodeURIComponent(q);
      const j = await (await fetch(url)).json();
      results = (j.items || [])
        .filter(g => !g.type || g.type === 'app')
        .slice(0, 6)
        .map(g => ({
          title: g.name,
          year: '',
          poster: 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + g.id + '/library_600x900.jpg'
        }));
    } else {
      const k = (process.env.TMDB_KEY || '').trim();
      const bearer = k.length > 40;
      const url = 'https://api.themoviedb.org/3/search/multi?include_adult=false&query=' + encodeURIComponent(q) +
        (bearer ? '' : '&api_key=' + encodeURIComponent(k));
      const r = await fetch(url, bearer ? { headers: { Authorization: 'Bearer ' + k } } : {});
      const j = await r.json();
      if (debug) {
        return res.status(200).json({
          keyLength: k.length,
          keyType: bearer ? 'token' : 'api_key',
          status: r.status,
          tmdbMessage: j.status_message || 'ok',
          count: (j.results || []).length
        });
      }
      results = (j.results || [])
        .filter(m => m.media_type === 'movie' || m.media_type === 'tv')
        .slice(0, 6)
        .map(m => ({
          title: m.title || m.name,
          kind: m.media_type,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          poster: m.poster_path ? 'https://image.tmdb.org/t/p/w185' + m.poster_path : ''
        }));
    }
    if (results.length) res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(200).json({ results: [], error: debug ? String(e) : undefined });
  }
};
