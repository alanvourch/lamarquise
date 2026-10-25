// After `vite build`: one static page per film (dist/film/<id>/index.html) so a shared link shows the
// film's title, poster and showtimes in messaging apps, which read <meta> tags but never run the app.
// The page is the app itself with other meta tags: opened in a browser, it shows that film's sheet.
//   SITE_URL  public address of the site ("https://montreel.vercel.app"), for absolute og:url / og:image
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
// GitHub reports custom domains as http:// even when the site is served over https.
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '').replace(/^http:\/\//, 'https://');
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const imageUrl = (path, size) => (!path ? null : path.startsWith('http') ? path : `${TMDB_IMG}/${size}${path}`);
const rating = (r) => r.toFixed(1).replace('.', ',');

function metaTags({ title, description, image, url, large }) {
  const tags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'MontReel'],
    ['property', 'og:locale', 'fr_CA'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['name', 'twitter:card', large ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  if (image) tags.push(['property', 'og:image', image], ['name', 'twitter:image', image]);
  if (url) tags.push(['property', 'og:url', url]);
  return tags.map(([k, n, v]) => `    <meta ${k}="${n}" content="${esc(v)}" />`).join('\n');
}

function withMeta(html, { title, description, ...rest }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`)
    .replace('</head>', `${metaTags({ title, description, ...rest })}\n  </head>`);
}

function filmDescription(movie, showtimes, cinemas) {
  const names = [...new Set(showtimes.map((s) => cinemas.get(s.cinemaId)?.short).filter(Boolean))];
  const facts = [
    movie.titleFr,
    movie.year,
    movie.directors?.length ? `de ${movie.directors.slice(0, 2).join(' et ')}` : null,
    movie.imdbRating != null ? `IMDb ${rating(movie.imdbRating)}` : null,
  ].filter(Boolean);
  const where = showtimes.length
    ? `${showtimes.length} séance${showtimes.length > 1 ? 's' : ''} à Montréal : ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}.`
    : '';
  const synopsis = movie.synopsis ? ` ${movie.synopsis.slice(0, 160).replace(/\s+\S*$/, '')}…` : '';
  return `${facts.join(' · ')}. ${where}${synopsis}`.trim();
}

const html = await readFile(`${DIST}index.html`, 'utf8');
let data;
try {
  data = JSON.parse(await readFile(`${DIST}data/showtimes.json`, 'utf8'));
} catch {
  console.log('film-pages: pas de données, pages de films non générées');
  data = { movies: [], showtimes: [], cinemas: [] };
}

// Home page: same tags with the app icon.
const home = {
  title: 'MontReel — Séances à Montréal',
  description: 'Toutes les séances de cinéma de Montréal au même endroit : notes IMDb, VO, VOSTF, VF, prix et bandes-annonces.',
  image: SITE ? `${SITE}/icon-512.png` : null,
  url: SITE ? `${SITE}/` : null,
};
await writeFile(`${DIST}index.html`, withMeta(html, home));
// GitHub Pages serves 404.html for unknown paths: a film page that no longer exists opens the app.
await writeFile(`${DIST}404.html`, withMeta(html, home));

const cinemas = new Map(data.cinemas.map((c) => [c.id, c]));
const byMovie = new Map();
const now = Date.now();
for (const s of data.showtimes) {
  if (Date.parse(s.start) < now - 3600_000) continue;
  if (!byMovie.has(s.movieId)) byMovie.set(s.movieId, []);
  byMovie.get(s.movieId).push(s);
}
for (const movie of data.movies) {
  const page = withMeta(html, {
    title: `${movie.title}${movie.year ? ` (${movie.year})` : ''} — MontReel`,
    description: filmDescription(movie, byMovie.get(movie.id) || [], cinemas),
    image: imageUrl(movie.poster, 'w500') || (SITE ? `${SITE}/icon-512.png` : null),
    url: SITE ? `${SITE}/film/${movie.id}/` : null,
    large: Boolean(movie.poster),
  });
  await mkdir(`${DIST}film/${movie.id}`, { recursive: true });
  await writeFile(`${DIST}film/${movie.id}/index.html`, page);
}
console.log(`film-pages: ${data.movies.length} pages de films`);
