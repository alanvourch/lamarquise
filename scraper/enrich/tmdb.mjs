import { join } from 'node:path';
import { getJson } from '../lib/http.mjs';
import { CACHE_DIR, readJson, writeJson } from '../lib/cache.mjs';
import { titleKey } from '../lib/labels.mjs';

const API = 'https://api.themoviedb.org/3';
const CACHE_FILE = join(CACHE_DIR, 'tmdb.json');
const DETAILS_TTL = 5 * 86400_000;
const MISS_TTL = 2 * 86400_000;

// TMDB genre ids are stable; naming them here keeps French labels whatever the API locale returns.
const GENRES_FR = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime', 99: 'Documentaire',
  18: 'Drame', 10751: 'Familial', 14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
  9648: 'Mystère', 10749: 'Romance', 878: 'Science-fiction', 10770: 'Téléfilm', 53: 'Thriller',
  10752: 'Guerre', 37: 'Western',
};

export function tmdbAvailable() {
  return Boolean(process.env.TMDB_API_KEY || process.env.TMDB_TOKEN);
}

function call(path, params = {}) {
  const key = process.env.TMDB_TOKEN || process.env.TMDB_API_KEY;
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v);
  const headers = {};
  // A v4 "read access token" is a JWT and goes in the header; a v3 key goes in the query string.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  return getJson(url, { headers });
}

const yearOf = (date) => (date ? Number(date.slice(0, 4)) : null);

export function scoreCandidate(r, film, query) {
  const q = titleKey(query);
  let score = 0;
  if (titleKey(r.title || '') === q || titleKey(r.original_title || '') === q) score += 3;
  else if (titleKey(r.title || '').startsWith(q) || titleKey(r.original_title || '').startsWith(q)) score += 1;
  const ry = yearOf(r.release_date);
  if (film.year && ry) {
    const diff = Math.abs(ry - film.year);
    score += diff === 0 ? 2 : diff === 1 ? 1 : -2;
  } else if (!film.year && ry && ry >= new Date().getFullYear() - 1) {
    // No year from the cinema: a current release is the likelier reading.
    score += 0.5;
  }
  score += Math.min((r.popularity || 0) / 100, 0.5);
  return score;
}

async function searchId(film) {
  const queries = [...new Set([film.originalTitle, film.title].filter(Boolean))];
  for (const query of queries) {
    for (const year of film.year ? [film.year, null] : [null]) {
      const { results = [] } = await call('/search/movie', {
        query,
        year,
        language: 'fr-CA',
        region: 'CA',
        include_adult: 'false',
      });
      const ranked = results
        .slice(0, 10)
        .map((r) => ({ r, score: scoreCandidate(r, film, query) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0] && ranked[0].score >= 3) return ranked[0].r.id;
    }
  }
  return null;
}

function pickTrailer(videos = []) {
  const yt = videos.filter((v) => v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type));
  const rank = (v) =>
    (v.type === 'Trailer' ? 4 : 0) + (v.iso_639_1 === 'fr' ? 2 : v.iso_639_1 === 'en' ? 1 : 0) + (v.official ? 1 : 0);
  return yt.sort((a, b) => rank(b) - rank(a))[0]?.key || null;
}

function translation(translations = [], lang, country) {
  return translations.find((t) => t.iso_639_1 === lang && (!country || t.iso_3166_1 === country))?.data;
}

function canadianRelease(releaseDates) {
  const ca = releaseDates?.results?.find((r) => r.iso_3166_1 === 'CA');
  const theatrical = ca?.release_dates?.find((d) => d.type === 3) || ca?.release_dates?.[0];
  return theatrical?.release_date?.slice(0, 10) || null;
}

async function details(id) {
  const d = await call(`/movie/${id}`, {
    language: 'fr-CA',
    append_to_response: 'videos,credits,translations,release_dates',
    include_video_language: 'fr,en,null',
  });
  const tr = d.translations?.translations;
  const frCA = translation(tr, 'fr', 'CA');
  const fr = translation(tr, 'fr', 'FR') || translation(tr, 'fr');
  const en = translation(tr, 'en', 'US') || translation(tr, 'en');
  return {
    tmdbId: d.id,
    imdbId: d.imdb_id || null,
    title: frCA?.title || fr?.title || d.title,
    originalTitle: d.original_title,
    originalLanguage: d.original_language,
    year: yearOf(d.release_date),
    releaseDate: canadianRelease(d.release_dates) || d.release_date || null,
    runtime: d.runtime || null,
    genres: (d.genres || []).map((g) => GENRES_FR[g.id] || g.name),
    synopsis: frCA?.overview || fr?.overview || d.overview || en?.overview || null,
    poster: d.poster_path || null,
    backdrop: d.backdrop_path || null,
    trailer: pickTrailer(d.videos?.results),
    directors: (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name),
    cast: (d.credits?.cast || []).slice(0, 6).map((c) => c.name),
    countries: (d.production_countries || []).map((c) => c.iso_3166_1),
    tmdbRating: d.vote_average || null,
    popularity: d.popularity || null,
  };
}

/**
 * Matches films scraped from the cinemas to TMDB.
 * @param films  [{ key, title, originalTitle, year }]
 * @param overrides  { [titleKey]: tmdbId } for titles the search gets wrong
 * @returns Map(key → details | null)
 */
export async function matchFilms(films, overrides = {}, log = console.log) {
  const cache = await readJson(CACHE_FILE, { search: {}, details: {} });
  const now = Date.now();
  const out = new Map();
  let calls = 0;

  for (const film of films) {
    try {
      const sKey = `${titleKey(film.originalTitle || film.title)}|${film.year || ''}`;
      let id = overrides[titleKey(film.title)] ?? overrides[titleKey(film.originalTitle || '')];
      if (id == null) {
        const hit = cache.search[sKey];
        if (hit && (hit.id || now - hit.at < MISS_TTL)) id = hit.id;
        else {
          id = await searchId(film);
          calls++;
          cache.search[sKey] = { id, at: now };
        }
      }
      if (!id) {
        out.set(film.key, null);
        continue;
      }
      const cached = cache.details[id];
      if (!cached || now - cached.at > DETAILS_TTL) {
        cache.details[id] = { at: now, movie: await details(id) };
        calls++;
      }
      out.set(film.key, cache.details[id].movie);
    } catch (err) {
      log(`  TMDB: échec pour « ${film.title} » (${err.message})`);
      out.set(film.key, null);
    }
  }
  await writeJson(CACHE_FILE, cache);
  log(`  TMDB: ${[...out.values()].filter(Boolean).length}/${films.length} films reconnus (${calls} appels)`);
  return out;
}
