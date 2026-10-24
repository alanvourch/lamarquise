import { cineMinutes, dayKey } from './time.js';

export async function loadData() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/showtimes.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normalize(await res.json());
}

// Turns the raw JSON (see scraper/README.md for the schema) into indexed structures.
export function normalize(raw) {
  const cinemas = new Map(raw.cinemas.map((c) => [c.id, c]));
  const movies = new Map(raw.movies.map((m) => [m.id, m]));
  const showtimes = raw.showtimes
    .filter((s) => movies.has(s.movieId) && cinemas.has(s.cinemaId))
    .map((s) => {
      const date = new Date(s.start);
      return { ...s, date, ts: date.getTime(), day: dayKey(date), minutes: cineMinutes(date) };
    })
    .sort((a, b) => a.ts - b.ts);

  const genres = [...new Set(raw.movies.flatMap((m) => m.genres || []))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );

  return {
    generatedAt: raw.generatedAt,
    sources: raw.sources || [],
    cinemas,
    movies,
    showtimes,
    genres,
    days: [...new Set(showtimes.map((s) => s.day))].sort(),
  };
}
