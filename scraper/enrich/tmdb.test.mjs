import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameDirectors, scoreCandidate } from './tmdb.mjs';

test('sameDirectors rejects namesakes but tolerates typos and order', () => {
  assert.equal(sameDirectors(['Georgia Oakley'], ['Ang Lee']), false);
  assert.equal(sameDirectors(['Noémie D. Lerclerc'], ['Noémie D. Leclerc']), true);
  assert.equal(sameDirectors(['Lee Chang-dong'], ['Chang-dong Lee']), true);
  assert.equal(sameDirectors([], ['Ang Lee']), true);
});

test('scoreCandidate prefers the current release when the cinema gives no year', () => {
  const film = { title: 'Raison et sentiments', year: null };
  const old = { title: 'Raison et sentiments', release_date: '1995-12-13', popularity: 40 };
  const fresh = { title: 'Raison et sentiments', release_date: `${new Date().getFullYear()}-09-18`, popularity: 10 };
  assert.ok(scoreCandidate(fresh, film, film.title) > scoreCandidate(old, film, film.title));
  // A production year two years before the release still matches.
  assert.ok(scoreCandidate({ title: 'Henry', release_date: '1986-09-24' }, { year: 1984 }, 'Henry') >= 3);
});
