import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './data.js';
import { DEFAULT_FILTERS, filterShowtimes, groupByMovie, priceFor, sortGroups } from './filters.js';
import { cineMinutes, dayKey, formatTime } from './time.js';

// Synthetic fixture for the filtering logic only.
const raw = {
  generatedAt: '2026-10-24T10:00:00Z',
  cinemas: [
    { id: 'a', name: 'Salle A', cineplus: true, prices: { adult: 15.5 } },
    { id: 'b', name: 'Salle B', prices: { adult: 13 } },
  ],
  movies: [
    { id: 'm1', title: 'Alpha', imdbRating: 7.9, imdbVotes: 1000, genres: ['Drame'], originalLanguage: 'en', releaseDate: '2026-10-10' },
    { id: 'm2', title: 'Bêta', imdbRating: 6.1, imdbVotes: 90000, genres: ['Comédie'], originalLanguage: 'fr', releaseDate: '2026-09-01' },
    { id: 'm3', title: 'Gamma', genres: ['Drame'], originalLanguage: 'ko' },
  ],
  showtimes: [
    { movieId: 'm1', cinemaId: 'a', start: '2026-10-24T13:00:00-04:00', version: 'VO' },
    { movieId: 'm1', cinemaId: 'b', start: '2026-10-24T21:30:00-04:00', version: 'VOSTF' },
    { movieId: 'm2', cinemaId: 'b', start: '2026-10-24T19:00:00-04:00', version: 'VO' },
    { movieId: 'm3', cinemaId: 'a', start: '2026-10-25T00:45:00-04:00', version: 'VOSTA' },
    { movieId: 'm3', cinemaId: 'b', start: '2026-10-26T18:00:00-04:00', version: 'VOSTF', price: 9 },
  ],
};

const data = normalize(raw);
const base = { ...DEFAULT_FILTERS, day: '2026-10-24', favCinemas: [], watchlist: [], hidePast: true, query: '' };
const at = (iso) => new Date(iso);
const ids = (list) => list.map((s) => `${s.movieId}@${formatTime(s.date)}`);

test('ciné-day keeps after-midnight screenings on the previous evening', () => {
  assert.equal(dayKey(at('2026-10-25T00:45:00-04:00')), '2026-10-24');
  assert.equal(cineMinutes(at('2026-10-25T00:45:00-04:00')), 24 * 60 + 45);
  assert.deepEqual(data.days, ['2026-10-24', '2026-10-26']);
});

test('past screenings disappear after the grace period', () => {
  const now = at('2026-10-24T19:10:00-04:00');
  assert.deepEqual(ids(filterShowtimes(data, base, now)), ['m2@19:00', 'm1@21:30', 'm3@00:45']);
  const later = at('2026-10-24T19:20:00-04:00');
  assert.deepEqual(ids(filterShowtimes(data, base, later)), ['m1@21:30', 'm3@00:45']);
});

test('version, favorite cinemas, rating, time and search filters', () => {
  const now = at('2026-10-24T08:00:00-04:00');
  const run = (f) => ids(filterShowtimes(data, { ...base, ...f }, now));
  assert.deepEqual(run({ versions: ['VOSTF', 'VOSTA'] }), ['m1@21:30', 'm3@00:45']);
  // A French-original film counts as "VF" (heard in French).
  assert.deepEqual(run({ versions: ['VF'] }), ['m2@19:00']);
  assert.deepEqual(run({ cinemaMode: 'fav', favCinemas: ['b'] }), ['m2@19:00', 'm1@21:30']);
  assert.deepEqual(run({ minRating: 7 }), ['m1@13:00', 'm1@21:30']);
  assert.deepEqual(run({ fromMinutes: 21 * 60 }), ['m1@21:30', 'm3@00:45']);
  assert.deepEqual(run({ query: 'beta' }), ['m2@19:00']);
  assert.deepEqual(run({ watchlistOnly: true, watchlist: ['m3'] }), ['m3@00:45']);
});

test('week view and sorting', () => {
  const now = at('2026-10-24T08:00:00-04:00');
  const list = filterShowtimes(data, { ...base, day: 'week' }, now);
  assert.equal(list.length, 5);
  const groups = groupByMovie(list, data, now.getTime());
  const order = (sort) => sortGroups(groups, sort).map((g) => g.movie.id);
  assert.deepEqual(order('next'), ['m1', 'm2', 'm3']);
  assert.deepEqual(order('imdb'), ['m1', 'm2', 'm3']);
  assert.deepEqual(order('votes'), ['m2', 'm1', 'm3']);
  assert.deepEqual(order('recent'), ['m1', 'm2', 'm3']);
  assert.deepEqual(order('title'), ['m1', 'm2', 'm3']);
});

test('CinéPlus member price only applies to Cineplex screens', () => {
  const settings = { cineplus: true, cineplusPrice: 11 };
  const [s1, , , , s5] = data.showtimes;
  assert.deepEqual(priceFor(s1, data.cinemas.get('a'), settings), { amount: 11, member: true });
  assert.deepEqual(priceFor(s5, data.cinemas.get('b'), settings), { amount: 9, member: false });
  assert.deepEqual(priceFor(s1, data.cinemas.get('a'), { cineplus: false }), { amount: 15.5, member: false });
});
