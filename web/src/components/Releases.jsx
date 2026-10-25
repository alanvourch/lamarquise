import { useMemo } from 'react';
import { Poster } from './ui.jsx';
import { addDays, releaseLabel } from '../lib/time.js';

// "Sorties": films that opened this week, then what comes to theatres in the next three weeks.
export function Releases({ data, today, onOpen }) {
  const items = useMemo(() => {
    const showing = new Set(data.showtimes.map((s) => s.movieId));
    const since = addDays(today, -6);
    const recent = [...data.movies.values()].filter(
      (m) => showing.has(m.id) && m.releaseDate && m.releaseDate >= since && m.releaseDate <= today,
    );
    const coming = data.upcoming.map((id) => data.movies.get(id)).filter((m) => m && m.releaseDate > today);
    return [...recent, ...coming].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  }, [data, today]);

  if (!items.length) return null;
  return (
    <section className="releases" aria-labelledby="releases-title">
      <h2 id="releases-title" className="releases-title">
        Sorties
      </h2>
      <div className="releases-row">
        {items.map((movie) => {
          const out = movie.releaseDate <= today;
          return (
            <button key={movie.id} className="release" onClick={() => onOpen(movie.id)}>
              <Poster movie={movie} size="w185" className="release-poster" />
              <span className={`release-date ${out ? 'release-date--out' : ''}`}>
                {out ? 'Nouveau' : releaseLabel(movie.releaseDate, today)}
              </span>
              <span className="release-title">{movie.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
