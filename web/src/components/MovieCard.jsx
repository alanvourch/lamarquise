import { Icon, ImdbBadge, Poster, VersionBadge } from './ui.jsx';
import { VERSIONS } from '../lib/filters.js';
import { formatRuntime, formatTime, shortDayLabel } from '../lib/time.js';

const VERSION_ORDER = VERSIONS.map((v) => v.id);

export function MovieCard({ group, cinemas, onOpen, inWatchlist, onToggleWatch, today, multiDay }) {
  const { movie, next, showtimes, cinemaIds, versions } = group;
  const nextCinema = cinemas.get(next.cinemaId);
  const meta = [movie.year, formatRuntime(movie.runtime), movie.genres?.[0]].filter(Boolean).join(' · ');
  return (
    <article className="card">
      <button className="card-hit" onClick={() => onOpen(movie.id)} aria-label={`Voir ${movie.title}`}>
        <div className="card-poster">
          <Poster movie={movie} />
          <div className="card-poster-top">
            <ImdbBadge movie={movie} />
          </div>
        </div>
        <div className="card-body">
          <h3 className="card-title">{movie.title}</h3>
          {meta && <p className="card-meta">{meta}</p>}
          <div className="card-versions">
            {VERSION_ORDER.filter((v) => versions.has(v)).map((v) => (
              <VersionBadge key={v} version={v} small />
            ))}
          </div>
          <p className="card-next">
            <Icon name="clock" size={13} />
            <strong>
              {multiDay && next.day !== today ? `${shortDayLabel(next.day, today)} ` : ''}
              {formatTime(next.date)}
            </strong>
            <span className="card-next-cinema">{nextCinema?.short || nextCinema?.name}</span>
          </p>
          <p className="card-count">
            {showtimes.length} séance{showtimes.length > 1 ? 's' : ''} · {cinemaIds.size} cinéma
            {cinemaIds.size > 1 ? 's' : ''}
          </p>
        </div>
      </button>
      <button
        className={`fav-btn ${inWatchlist ? 'fav-btn--on' : ''}`}
        onClick={() => onToggleWatch(movie.id)}
        aria-pressed={inWatchlist}
        aria-label={inWatchlist ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
      >
        <Icon name="heart" size={16} />
      </button>
    </article>
  );
}
