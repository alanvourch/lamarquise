import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './data.js';
import { groupScheduleHours } from './schedule.js';

const data = normalize({
  cinemas: [{ id: 'a' }, { id: 'b' }],
  movies: [{ id: 'm1' }, { id: 'm2' }],
  showtimes: [
    { movieId: 'm1', cinemaId: 'a', start: '2026-10-30T18:00:00-04:00', version: 'VO' },
    { movieId: 'm2', cinemaId: 'a', start: '2026-10-30T18:10:00-04:00', version: 'VO' },
    { movieId: 'm1', cinemaId: 'b', start: '2026-10-30T18:20:00-04:00', version: 'VF' },
    { movieId: 'm1', cinemaId: 'a', start: '2026-10-30T19:00:00-04:00', version: 'VO' },
    { movieId: 'm1', cinemaId: 'b', start: '2026-10-31T00:30:00-04:00', version: 'VO' },
    { movieId: 'm1', cinemaId: 'a', start: '2026-10-31T18:00:00-04:00', version: 'VO' },
  ],
});

test('schedule merges a film across cinemas within an hour, preserving every screening', () => {
  const [hour] = groupScheduleHours(data.showtimes);
  assert.equal(hour.count, 3);
  assert.deepEqual(hour.movies.map((m) => m.movieId), ['m1', 'm2']);
  assert.equal(hour.movies[0].showtimes.length, 2);
  assert.deepEqual([...hour.movies[0].cinemaIds], ['a', 'b']);
  assert.deepEqual([...hour.movies[0].versions], ['VO', 'VF']);
});

test('schedule separates hours and days, including screenings after midnight', () => {
  const hours = groupScheduleHours(data.showtimes);
  assert.deepEqual(hours.map((h) => [h.day, h.hour]), [
    ['2026-10-30', 18], ['2026-10-30', 19], ['2026-10-30', 0], ['2026-10-31', 18],
  ]);
  assert.equal(hours.reduce((n, h) => n + h.count, 0), data.showtimes.length);
  assert.deepEqual(groupScheduleHours([]), []);
});
