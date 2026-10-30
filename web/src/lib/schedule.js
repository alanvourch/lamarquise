import { localParts } from './time.js';

// Input is filtered and sorted chronologically. Preserve all screenings but
// display each film once per cinema day and hour.
export function groupScheduleHours(showtimes) {
  const hours = new Map();
  for (const s of showtimes) {
    const hour = localParts(s.date).h;
    const key = `${s.day}-${hour}`;
    if (!hours.has(key)) hours.set(key, { key, day: s.day, hour, count: 0, movies: new Map() });
    const group = hours.get(key);
    group.count++;
    if (!group.movies.has(s.movieId)) {
      group.movies.set(s.movieId, { movieId: s.movieId, showtimes: [], cinemaIds: new Set(), versions: new Set() });
    }
    const movie = group.movies.get(s.movieId);
    movie.showtimes.push(s);
    movie.cinemaIds.add(s.cinemaId);
    if (s.version) movie.versions.add(s.version);
  }
  return [...hours.values()].map((g) => ({ ...g, movies: [...g.movies.values()] }));
}
