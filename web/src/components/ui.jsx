import { useEffect, useRef } from 'react';
import { formatRating, formatVotes, img } from '../lib/format.js';

const PATHS = {
  heart:
    'M12 20.5s-7.5-4.6-9.6-9.2C.9 7.9 3 4.5 6.5 4.5c2.1 0 3.5 1.2 4.3 2.4.4.6 1.9.6 2.4 0 .8-1.2 2.2-2.4 4.3-2.4 3.5 0 5.6 3.4 4.1 6.8-2.1 4.6-9.6 9.2-9.6 9.2Z',
  star: 'm12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3.2Z',
  search: 'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm10 2.5-4.7-4.7',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5L8 5.5Z',
  ticket:
    'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5Zm10-1.5v12',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.1.1-1.4-.1-1.4 2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.4-1.4L14.2 2.5h-4l-.4 2.6c-.9.3-1.7.8-2.4 1.4l-2.4-.9-2 3.4 2 1.6-.1 1.4.1 1.4-2 1.6 2 3.4 2.4-.9c.7.6 1.5 1.1 2.4 1.4l.4 2.6h4l.4-2.6c.9-.3 1.7-.8 2.4-1.4l2.4.9 2-3.4-2-1.6Z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v6.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V13',
  chevron: 'm9 6 6 6-6 6',
  film: 'M4 5.5h16v13H4zM8 5.5v13M16 5.5v13M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5',
};

const FILLED = new Set(['heart', 'star', 'play']);

export function Icon({ name, size = 18, filled, className = '' }) {
  const fill = filled ?? FILLED.has(name);
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Sheet({ open, onClose, children, label, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`sheet ${wide ? 'sheet--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
      >
        <button className="sheet-close icon-btn" onClick={onClose} aria-label="Fermer">
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function VersionBadge({ version, small }) {
  if (!version) return null;
  return <span className={`vbadge vbadge--${version.toLowerCase()} ${small ? 'vbadge--sm' : ''}`}>{version}</span>;
}

// Rating on thumbnails; the number of votes is on the film sheet.
export function ImdbBadge({ movie }) {
  if (movie.imdbRating == null) return null;
  return (
    <span className="imdb" title={`IMDb ${movie.imdbRating}/10 · ${movie.imdbVotes ?? 0} votes`}>
      <span className="imdb-logo">IMDb</span>
      <strong>{formatRating(movie.imdbRating)}</strong>
    </span>
  );
}

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

/** Film sheet: IMDb and Letterboxd logos linking to the film, the rating and its votes in between. */
export function ScoreLinks({ movie }) {
  const votes = formatVotes(movie.imdbVotes);
  return (
    <div className="msheet-scores">
      {movie.imdbId ? (
        <a className="score-link" href={`https://www.imdb.com/title/${movie.imdbId}/`} target="_blank" rel="noreferrer">
          <img className="logo-imdb" src={asset('logos/imdb.svg')} alt="IMDb" />
          {movie.imdbRating != null && <strong>{formatRating(movie.imdbRating)}</strong>}
          {votes && <span className="score-votes">{votes} votes</span>}
        </a>
      ) : (
        movie.imdbRating != null && <strong>{formatRating(movie.imdbRating)}</strong>
      )}
      {movie.tmdbId && (
        <a className="score-link" href={`https://letterboxd.com/tmdb/${movie.tmdbId}`} target="_blank" rel="noreferrer">
          <picture>
            <source srcSet={asset('logos/letterboxd.svg')} media="(prefers-color-scheme: light)" />
            <img className="logo-letterboxd" src={asset('logos/letterboxd-dark.svg')} alt="Letterboxd" />
          </picture>
        </a>
      )}
    </div>
  );
}

export function Poster({ movie, size = 'w342', className = '' }) {
  const src = img(movie.poster, size);
  if (!src) {
    return (
      <div className={`poster poster--empty ${className}`}>
        <Icon name="film" size={28} />
        <span>{movie.title}</span>
      </div>
    );
  }
  return <img className={`poster ${className}`} src={src} alt={`Affiche : ${movie.title}`} loading="lazy" />;
}

export function Chip({ active, onClick, children, title, className = '' }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'chip--on' : ''} ${className}`}
      aria-pressed={active}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
