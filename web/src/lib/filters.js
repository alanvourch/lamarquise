import { addDays, dayKey } from './time.js';
import { normalizeText } from './format.js';

export const VERSIONS = [
  { id: 'VO', title: 'Version originale, sans sous-titres' },
  { id: 'VOSTF', title: 'Version originale sous-titrée en français' },
  { id: 'VOSTA', title: 'Version originale sous-titrée en anglais' },
  { id: 'VF', title: 'Version française (doublée ou tournée en français)' },
];

export const SORTS = [
  { id: 'next', label: 'Prochaine séance' },
  { id: 'imdb', label: 'Note IMDb' },
  { id: 'votes', label: 'Popularité IMDb' },
  { id: 'count', label: 'Nombre de séances' },
  { id: 'recent', label: 'Nouveautés' },
  { id: 'title', label: 'Titre A → Z' },
  { id: 'runtime', label: 'Durée' },
];

export const DEFAULT_FILTERS = {
  cinemaMode: 'all', // 'all' | 'fav'
  versions: [],
  fromMinutes: null,
  minRating: null,
  genre: null,
  watchlistOnly: false,
};

// A screening that started less than this long ago still shows (trailers run ~15 min).
export const GRACE_MS = 15 * 60_000;

export function activeFilterCount(f) {
  return (
    (f.cinemaMode === 'fav' ? 1 : 0) +
    (f.versions.length ? 1 : 0) +
    (f.fromMinutes != null ? 1 : 0) +
    (f.minRating != null ? 1 : 0) +
    (f.genre ? 1 : 0) +
    (f.watchlistOnly ? 1 : 0)
  );
}

function movieMatches(movie, f, ctx) {
  if (ctx.watch && !ctx.watch.has(movie.id)) return false;
  if (f.minRating != null && !(movie.imdbRating >= f.minRating)) return false;
  if (f.genre && !(movie.genres || []).includes(f.genre)) return false;
  if (ctx.query) {
    const hay = normalizeText(
      [movie.title, movie.titleFr, movie.originalTitle, ...(movie.directors || []), ...(movie.cast || [])]
        .filter(Boolean)
        .join(' '),
    );
    if (!hay.includes(ctx.query)) return false;
  }
  return true;
}

// "VF" means "heard in French": a French-language film in its original version qualifies too.
function versionMatches(s, movie, versions) {
  if (versions.has(s.version)) return true;
  return s.version === 'VO' && movie.originalLanguage === 'fr' && versions.has('VF');
}

/**
 * @param data   normalized data (lib/data.js)
 * @param f      filters + { day, query, favCinemas, watchlist, hidePast }
 * @param now    Date
 */
export function filterShowtimes(data, f, now) {
  const today = dayKey(now);
  const weekEnd = addDays(today, 6);
  const nowTs = now.getTime();
  const cinemas = f.cinemaMode === 'fav' && f.favCinemas.length ? new Set(f.favCinemas) : null;
  const versions = f.versions.length ? new Set(f.versions) : null;
  const ctx = {
    watch: f.watchlistOnly ? new Set(f.watchlist) : null,
    query: normalizeText((f.query || '').trim()),
  };
  const movieOk = new Map();

  return data.showtimes.filter((s) => {
    if (f.day === 'week' ? s.day < today || s.day > weekEnd : s.day !== f.day) return false;
    if (f.hidePast && s.ts < nowTs - GRACE_MS) return false;
    if (f.fromMinutes != null && s.minutes < f.fromMinutes) return false;
    if (cinemas && !cinemas.has(s.cinemaId)) return false;
    if (versions && !versionMatches(s, data.movies.get(s.movieId), versions)) return false;
    if (!movieOk.has(s.movieId)) movieOk.set(s.movieId, movieMatches(data.movies.get(s.movieId), f, ctx));
    return movieOk.get(s.movieId);
  });
}

export function groupByMovie(showtimes, data, nowTs) {
  const groups = new Map();
  for (const s of showtimes) {
    let g = groups.get(s.movieId);
    if (!g) {
      g = { movie: data.movies.get(s.movieId), showtimes: [], cinemaIds: new Set(), versions: new Set() };
      groups.set(s.movieId, g);
    }
    g.showtimes.push(s);
    g.cinemaIds.add(s.cinemaId);
    if (s.version) g.versions.add(s.version);
  }
  for (const g of groups.values()) {
    g.next = g.showtimes.find((s) => s.ts >= nowTs - GRACE_MS) || g.showtimes[0];
  }
  return [...groups.values()];
}

const byNullableDesc = (a, b) => (b ?? -Infinity) - (a ?? -Infinity);

const COMPARATORS = {
  next: (a, b) => a.next.ts - b.next.ts,
  imdb: (a, b) =>
    byNullableDesc(a.movie.imdbRating, b.movie.imdbRating) ||
    byNullableDesc(a.movie.imdbVotes, b.movie.imdbVotes),
  votes: (a, b) => byNullableDesc(a.movie.imdbVotes, b.movie.imdbVotes),
  count: (a, b) => b.showtimes.length - a.showtimes.length,
  recent: (a, b) => (b.movie.releaseDate || '').localeCompare(a.movie.releaseDate || ''),
  title: (a, b) => a.movie.title.localeCompare(b.movie.title, 'fr', { sensitivity: 'base' }),
  runtime: (a, b) => (a.movie.runtime ?? Infinity) - (b.movie.runtime ?? Infinity),
};

export function sortGroups(groups, sortId) {
  const cmp = COMPARATORS[sortId] || COMPARATORS.next;
  return [...groups].sort((a, b) => cmp(a, b) || COMPARATORS.next(a, b));
}

// CinéPlus member prices at Cineplex: a regular screen, and premium screens whose price is known.
// Other premium screens (IMAX, VIP, D-BOX, 3D…) cost an extra the app doesn't know: shown as "11 $ +".
export const CINEPLUS_PRICES = { base: 11, UltraAVX: 16 };
const PREMIUM_FORMATS = new Set(['IMAX', 'UltraAVX', 'VIP', 'D-BOX', '3D', '4DX', 'ScreenX']);

// Price shown for a screening, applying the CinéPlus member price on Cineplex screens.
export function priceFor(showtime, cinema, settings) {
  if (settings.cineplus && cinema.cineplus) {
    const premium = (showtime.formats || []).filter((f) => PREMIUM_FORMATS.has(f));
    const known = premium.map((f) => CINEPLUS_PRICES[f]).filter((p) => p != null);
    const amount = Math.max(CINEPLUS_PRICES.base, ...known);
    return known.length < premium.length ? { amount, member: true, surcharge: true } : { amount, member: true };
  }
  const amount = showtime.price ?? cinema.prices?.adult ?? null;
  return amount == null ? null : { amount, member: false };
}
