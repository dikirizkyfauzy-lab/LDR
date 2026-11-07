// Vercel serverless function: GET /api/search?type=watch|game&q=...
// Movies/TV: TMDB (needs TMDB_KEY in Vercel Environment Variables)
// Games: Steam store search (no key needed)
module.exports = async (req, res) => {
  const { type, q } = req.query || {};
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
      const k = process.env.TMDB_KEY || '';
      const bearer = k.length > 40; // long token = "API Read Access Token"
      const url = 'https://api.themoviedb.org/3/search/multi?include_adult=false&query=' + encodeURIComponent(q) +
        (bearer ? '' : '&api_key=' + encodeURIComponent(k));
      const j = await (await fetch(url, bearer ? { headers: { Authorization: 'Bearer ' + k } } : {})).json();
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
    return res.status(200).json({ results: [] });
  }
};
