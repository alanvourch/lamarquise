import { useMemo } from 'react';
import { Poster, ReleaseBadge } from './ui.jsx';
import { releaseStatus, releaseLabel } from '../lib/time.js';

// Recent theatrical releases and all known future releases, independent of day filters.
export function Releases({ data, today, onOpen, query = '' }) {
  const items = useMemo(() => {
    const showing = new Set(data.showtimes.map((s) => s.movieId));
    const upcoming = new Set(data.upcoming);
    const search = query.trim().toLocaleLowerCase('fr');
    return [...data.movies.values()].filter((movie) => {
      const status = releaseStatus(movie.releaseDate, today);
      if (!status || (!showing.has(movie.id) && !upcoming.has(movie.id))) return false;
      return !search || [movie.title, movie.titleFr, movie.originalTitle, ...(movie.directors || []), ...(movie.cast || [])]
        .filter(Boolean).some((value) => value.toLocaleLowerCase('fr').includes(search));
    }).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  }, [data, today, query]);

  return (
    <section className="releases" aria-labelledby="releases-title">
      <h1 id="releases-title" className="releases-title">
        Sorties
      </h1>
      <p className="muted">Les nouveautés des sept derniers jours et les prochaines sorties en salle.</p>
      {!items.length && <p className="empty">Aucune sortie{query ? " pour cette recherche" : " annoncée pour le moment"}.</p>}
      <div className="releases-row">
        {items.map((movie) => {
          const out = movie.releaseDate <= today;
          return (
            <button key={movie.id} className="release" onClick={() => onOpen(movie.id)}>
              <Poster movie={movie} size="w185" className="release-poster" />
              <ReleaseBadge movie={movie} today={today} />
              <span className={`release-date ${out ? 'release-date--out' : ''}`}>
                {releaseLabel(movie.releaseDate, today)}
              </span>
              <span className="release-title">{movie.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
