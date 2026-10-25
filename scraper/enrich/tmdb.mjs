import { join } from 'node:path';
import { getJson } from '../lib/http.mjs';
import { CACHE_DIR, readJson, writeJson } from '../lib/cache.mjs';
import { titleKey } from '../lib/labels.mjs';

const API = 'https://api.themoviedb.org/3';
const CACHE_FILE = join(CACHE_DIR, 'tmdb.json');
const DETAILS_TTL = 5 * 86400_000;
// Bumped when details() returns new fields, so cached entries are refetched.
const DETAILS_VERSION = 2;
const MISS_TTL = 2 * 86400_000;
// Bumped when the search logic changes, so earlier misses are retried at once.
const SEARCH_VERSION = 3;
// A search tries at most this many well-scored candidates before giving up.
const MAX_CANDIDATES = 4;
let calls = 0;

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
  calls++;
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
    // Cinemas often give the production year, TMDB the release: allow a gap of two years.
    score += diff === 0 ? 2 : diff === 1 ? 1 : diff === 2 ? 0 : -2;
  } else if (!film.year && ry && ry >= new Date().getFullYear() - 1) {
    // No year from the cinema (first-run multiplexes): a current release is the likelier reading.
    score += 1;
  }
  score += Math.min((r.popularity || 0) / 100, 0.5);
  return score;
}

/** First well-scored search result that `accept(id)` agrees with (same director), or null. */
async function searchId(film, accept) {
  const tried = new Set();
  const queries = [...new Set([film.originalTitle, film.title, ...(film.altTitles || [])].filter(Boolean))];
  // Results carry the French title and the original one; the English pass catches films that cinemas
  // list under their English title when neither of those matches ("A Bay of Blood", "Possible Love").
  for (const language of ['fr-CA', 'en-US']) {
    for (const query of queries) {
      for (const year of film.year ? [film.year, null] : [null]) {
        // No `region`: it swaps release_date (and the year filter) for the latest Canadian release,
        // so a 1992 classic back in theatres would read as 2026.
        const { results = [] } = await call('/search/movie', {
          query,
          primary_release_year: year,
          language,
          include_adult: 'false',
        });
        const ranked = results
          .slice(0, 10)
          .map((r) => ({ r, score: scoreCandidate(r, film, query) }))
          .filter((c) => c.score >= 3)
          .sort((a, b) => b.score - a.score);
        for (const { r } of ranked) {
          if (tried.has(r.id)) continue;
          tried.add(r.id);
          if (await accept(r.id)) return r.id;
          if (tried.size >= MAX_CANDIDATES) return null;
        }
      }
    }
  }
  return null;
}

const nameTokens = (names) =>
  names.flatMap((n) => titleKey(n).split(' ')).filter((t) => t.length >= 3);

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** False when both sides name directors and none of them line up (a namesake film). Tolerates typos. */
export function sameDirectors(ours = [], theirs = []) {
  const a = nameTokens(ours);
  const b = nameTokens(theirs);
  if (!a.length || !b.length) return true;
  return a.some((x) => b.some((y) => x === y || (Math.min(x.length, y.length) >= 5 && editDistance(x, y) <= 1)));
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

export const isLatin = (s) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u.test(s || '');

/** Poster in the given language, the best voted first; TMDB's default poster follows the request language. */
function posterIn(images, lang) {
  const posters = (images?.posters || []).filter((p) => p.iso_639_1 === lang);
  return posters.sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count)[0]?.file_path || null;
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
  const lang = d.original_language;
  const tr = d.translations?.translations;
  const frCA = translation(tr, 'fr', 'CA');
  const fr = translation(tr, 'fr', 'FR') || translation(tr, 'fr');
  const en = translation(tr, 'en', 'US') || translation(tr, 'en');
  const frenchTitle = frCA?.title || fr?.title || (lang === 'fr' ? d.original_title : null);
  // Films are shown under their original title and poster ("Primetime", not "En direct"). Titles in
  // another script ("가능한 사랑") read in English instead, with the English poster to match.
  const readable = lang === 'fr' || isLatin(d.original_title);
  const voTitle = lang === 'fr' ? frenchTitle || d.original_title : readable ? d.original_title : en?.title || d.original_title;
  const posterLang = readable ? lang : 'en';
  const images = await call(`/movie/${id}/images`, { include_image_language: [...new Set([posterLang, 'en', 'null'])].join(',') });
  const poster =
    posterIn(images, posterLang) || posterIn(images, 'en') || posterIn(images, null) || d.poster_path || null;
  return {
    tmdbId: d.id,
    imdbId: d.imdb_id || null,
    title: voTitle,
    titleFr: frenchTitle && frenchTitle !== voTitle ? frenchTitle : null,
    originalTitle: d.original_title,
    originalLanguage: d.original_language,
    year: yearOf(d.release_date),
    releaseDate: canadianRelease(d.release_dates) || d.release_date || null,
    runtime: d.runtime || null,
    genres: (d.genres || []).map((g) => GENRES_FR[g.id] || g.name),
    synopsis: frCA?.overview || fr?.overview || d.overview || en?.overview || null,
    poster,
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
 * @param films  [{ key, title, originalTitle, altTitles, year, directors }]
 * @param overrides  { [titleKey]: tmdbId } for titles the search gets wrong
 * @returns Map(key → details | null)
 */
export async function matchFilms(films, overrides = {}, log = console.log) {
  const cache = await readJson(CACHE_FILE, { search: {}, details: {} });
  const now = Date.now();
  const out = new Map();
  calls = 0;

  const getDetails = async (id) => {
    const cached = cache.details[id];
    if (!cached || cached.v !== DETAILS_VERSION || now - cached.at > DETAILS_TTL) {
      cache.details[id] = { v: DETAILS_VERSION, at: now, movie: await details(id) };
    }
    return cache.details[id].movie;
  };

  for (const film of films) {
    try {
      // Other titles are part of the key: a film seen under a new title gets a new search.
      const alt = (film.altTitles || []).map(titleKey).sort().join('/');
      const sKey = `${SEARCH_VERSION}|${titleKey(film.originalTitle || film.title)}|${film.year || ''}|${alt}`;
      const forced = overrides[titleKey(film.title)] ?? overrides[titleKey(film.originalTitle || '')];
      const accept = async (id) => {
        const movie = await getDetails(id);
        if (sameDirectors(film.directors, movie.directors)) return true;
        log(`  TMDB: « ${film.title} » ≠ ${movie.title} (${movie.year}, ${movie.directors.join(', ')})`);
        return false;
      };
      let id = forced;
      if (id == null) {
        const hit = cache.search[sKey];
        // A cached match is checked again: the same title may now come with another director.
        const usable = hit && (hit.id ? await accept(hit.id) : now - hit.at < MISS_TTL);
        if (usable) id = hit.id;
        else {
          id = await searchId(film, accept);
          cache.search[sKey] = { id, at: now };
        }
      }
      if (!id) {
        out.set(film.key, null);
        continue;
      }
      const movie = await getDetails(id);
      out.set(film.key, movie);
    } catch (err) {
      log(`  TMDB: échec pour « ${film.title} » (${err.message})`);
      out.set(film.key, null);
    }
  }
  await writeJson(CACHE_FILE, cache);
  log(`  TMDB: ${[...out.values()].filter(Boolean).length}/${films.length} films reconnus (${calls} appels)`);
  return out;
}
