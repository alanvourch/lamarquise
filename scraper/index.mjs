// Collects every Montréal screening for the coming days and writes web/public/data/showtimes.json.
//   node scraper/index.mjs            all sources
//   node scraper/index.mjs cineplex   only some sources (others are carried over from the last run)
import { fileURLToPath } from 'node:url';
import SOURCES from './sources/index.mjs';
import { CINEMA_EXTRAS } from './cinemas.mjs';
import { matchFilms, tmdbAvailable } from './enrich/tmdb.mjs';
import { imdbRatings } from './enrich/imdb.mjs';
import { cleanTitle, titleKey } from './lib/labels.mjs';
import { readJson, writeJson } from './lib/cache.mjs';

const OUT = fileURLToPath(new URL('../web/public/data/showtimes.json', import.meta.url));
const OVERRIDES = fileURLToPath(new URL('./overrides.json', import.meta.url));
const DAYS = Number(process.env.DAYS || 7);
const log = (...a) => console.log(...a);

async function runSources(only) {
  const previous = await readJson(OUT, null);
  const now = Date.now();
  const cinemas = new Map();
  const showtimes = [];
  const status = [];

  for (const source of SOURCES) {
    const keep = () => {
      // Source skipped or broken: keep its upcoming screenings from the previous run.
      const old = (previous?.showtimes || []).filter((s) => s.source === source.id && Date.parse(s.start) > now);
      for (const c of previous?.cinemas || []) if (c.source === source.id) cinemas.set(c.id, c);
      return old.map((s) => ({ ...s, film: previous.movies.find((m) => m.id === s.movieId) || { title: '?' } }));
    };
    if (only.length && !only.includes(source.id)) {
      showtimes.push(...keep());
      continue;
    }
    const t0 = Date.now();
    try {
      const res = await source.fetch({ days: DAYS, log: (...a) => log(`  [${source.id}]`, ...a) });
      for (const c of res.cinemas) cinemas.set(c.id, { ...c, source: source.id });
      for (const s of res.showtimes) showtimes.push({ ...s, source: source.id });
      status.push({ id: source.id, ok: true, showtimes: res.showtimes.length, ms: Date.now() - t0 });
      log(`✓ ${source.name}: ${res.cinemas.length} cinémas, ${res.showtimes.length} séances`);
    } catch (err) {
      const kept = keep();
      showtimes.push(...kept);
      status.push({ id: source.id, ok: false, error: err.message, kept: kept.length });
      log(`✗ ${source.name}: ${err.message} (${kept.length} séances conservées)`);
    }
  }
  return { cinemas, showtimes, status };
}

function filmKey(film) {
  const { title, year } = cleanTitle(film.originalTitle || film.title);
  return `${titleKey(title)}|${film.year || year || ''}`;
}

async function buildMovies(showtimes) {
  const films = new Map();
  for (const s of showtimes) {
    s.filmKey = filmKey(s.film);
    if (!films.has(s.filmKey)) {
      const clean = cleanTitle(s.film.title);
      films.set(s.filmKey, {
        key: s.filmKey,
        ...s.film,
        title: clean.title,
        originalTitle: s.film.originalTitle ? cleanTitle(s.film.originalTitle).title : null,
        year: s.film.year || clean.year,
      });
    } else {
      // Fill gaps from other sources showing the same film.
      const f = films.get(s.filmKey);
      for (const [k, v] of Object.entries(s.film)) if (f[k] == null && v != null) f[k] = v;
    }
  }

  const overrides = (await readJson(OVERRIDES, {})).tmdb || {};
  const matches = tmdbAvailable()
    ? await matchFilms([...films.values()], overrides, log)
    : (log('  TMDB_API_KEY absente : pas d\'affiches TMDB ni de notes IMDb'), new Map());

  const movies = new Map();
  const keyToId = new Map();
  for (const film of films.values()) {
    const t = matches.get(film.key);
    const id = t ? `tmdb-${t.tmdbId}` : `film-${titleKey(film.title).replace(/ /g, '-')}${film.year ? `-${film.year}` : ''}`;
    keyToId.set(film.key, id);
    if (movies.has(id)) continue;
    movies.set(id, {
      id,
      title: t?.title || film.title,
      originalTitle: t?.originalTitle || film.originalTitle || null,
      originalLanguage: t?.originalLanguage || film.originalLanguage || null,
      year: t?.year || film.year || null,
      releaseDate: t?.releaseDate || null,
      runtime: t?.runtime || film.runtime || null,
      genres: t?.genres?.length ? t.genres : film.genres || [],
      synopsis: t?.synopsis || film.synopsis || null,
      poster: t?.poster || film.poster || null,
      backdrop: t?.backdrop || film.backdrop || null,
      trailer: t?.trailer || film.trailer || null,
      directors: t?.directors?.length ? t.directors : film.directors || [],
      cast: t?.cast?.length ? t.cast : film.cast || [],
      tmdbId: t?.tmdbId || null,
      imdbId: t?.imdbId || film.imdbId || null,
      imdbRating: null,
      imdbVotes: null,
    });
  }

  const ids = [...movies.values()].map((m) => m.imdbId).filter(Boolean);
  try {
    const ratings = await imdbRatings(ids);
    for (const m of movies.values()) {
      const r = m.imdbId && ratings.get(m.imdbId);
      if (r) Object.assign(m, { imdbRating: r.rating, imdbVotes: r.votes });
    }
    log(`  IMDb: ${ratings.size}/${ids.length} notes`);
  } catch (err) {
    log(`  IMDb: notes indisponibles (${err.message})`);
  }
  return { movies, keyToId };
}

async function main() {
  const only = process.argv.slice(2);
  log(`Pellicule — collecte des séances (${DAYS} jours)`);
  const { cinemas, showtimes, status } = await runSources(only);
  const { movies, keyToId } = await buildMovies(showtimes);

  const seen = new Set();
  const out = [];
  for (const s of showtimes) {
    const movieId = keyToId.get(s.filmKey);
    const movie = movies.get(movieId);
    // A French-language film shown in French is its original version, not a dub.
    const version = s.version === 'VF' && movie.originalLanguage === 'fr' ? 'VO' : s.version ?? null;
    const dedupe = `${movieId}|${s.cinemaId}|${s.start}|${version}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      movieId,
      cinemaId: s.cinemaId,
      start: s.start,
      version,
      formats: s.formats?.length ? s.formats : undefined,
      bookingUrl: s.bookingUrl || undefined,
      price: s.price ?? undefined,
      source: s.source,
    });
  }
  out.sort((a, b) => a.start.localeCompare(b.start));

  const used = new Set(out.map((s) => s.movieId));
  const cinemaList = [...cinemas.values()].map((c) => ({ ...c, ...CINEMA_EXTRAS[c.id] }));
  const data = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources: SOURCES.filter((s) => status.find((x) => x.id === s.id && (x.ok || x.kept))).map((s) => s.name),
    status,
    cinemas: cinemaList.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    movies: [...movies.values()].filter((m) => used.has(m.id)),
    showtimes: out,
  };
  await writeJson(OUT, data);
  log(`→ ${data.cinemas.length} cinémas, ${data.movies.length} films, ${out.length} séances`);
  if (status.length && status.every((s) => !s.ok)) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

