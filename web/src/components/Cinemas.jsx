import { useMemo, useState } from 'react';
import { Icon, ImdbBadge, Poster, Sheet, VersionBadge } from './ui.jsx';
import { formatPrice } from '../lib/format.js';
import { CINEPLUS_PRICES } from '../lib/filters.js';
import { formatTime, shortDayLabel } from '../lib/time.js';

function groupByCinema(showtimes) {
  const map = new Map();
  for (const s of showtimes) {
    if (!map.has(s.cinemaId)) map.set(s.cinemaId, new Map());
    const movies = map.get(s.cinemaId);
    if (!movies.has(s.movieId)) movies.set(s.movieId, []);
    movies.get(s.movieId).push(s);
  }
  return map;
}

function PriceLine({ cinema, settings }) {
  if (settings.cineplus && cinema.cineplus) {
    return (
      <span className="st-price--member">
        CinéPlus {formatPrice(CINEPLUS_PRICES.base)} · UltraAVX {formatPrice(CINEPLUS_PRICES.UltraAVX)}
      </span>
    );
  }
  if (cinema.prices?.adult == null) return null;
  return (
    <span>
      {formatPrice(cinema.prices.adult)}
      {cinema.prices.note ? ` · ${cinema.prices.note}` : ''}
    </span>
  );
}

export function CinemaList({ showtimes, data, favCinemas, onToggleCinema, onOpen, settings, today, multiDay }) {
  const grouped = useMemo(() => groupByCinema(showtimes), [showtimes]);
  // Every cinema starts folded, to scan the list; a tap on its name shows its programme.
  const [open, setOpen] = useState(() => new Set());
  const toggle = (cid) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(cid)) next.add(cid);
      return next;
    });
  const fav = new Set(favCinemas);
  const ids = [...grouped.keys()].sort(
    (a, b) =>
      fav.has(b) - fav.has(a) ||
      grouped.get(b).size - grouped.get(a).size ||
      data.cinemas.get(a).name.localeCompare(data.cinemas.get(b).name, 'fr'),
  );
  return (
    <div className="cinemas">
      {ids.map((cid) => {
        const cinema = data.cinemas.get(cid);
        const movies = [...grouped.get(cid).entries()].sort(([, a], [, b]) => a[0].ts - b[0].ts);
        const isFav = fav.has(cid);
        const isOpen = open.has(cid);
        const count = movies.reduce((n, [, list]) => n + list.length, 0);
        const next = movies.map(([, list]) => list[0]).sort((a, b) => a.ts - b.ts)[0];
        return (
          <section key={cid} className={`cinema-card ${isOpen ? '' : 'cinema-card--folded'}`}>
            <header className="cinema-card-head">
              <button
                className={`star-btn ${isFav ? 'star-btn--on' : ''}`}
                onClick={() => onToggleCinema(cid)}
                aria-pressed={isFav}
                aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Icon name="star" size={18} />
              </button>
              <button
                className="cinema-card-titles"
                onClick={() => toggle(cid)}
                aria-expanded={isOpen}
                aria-controls={`cinema-${cid}`}
              >
                <h2>{cinema.name}</h2>
                <p>
                  {[cinema.area, cinema.address].filter(Boolean).join(' · ')}
                </p>
                {isOpen ? (
                  <p className="cinema-card-price">
                    <PriceLine cinema={cinema} settings={settings} />
                  </p>
                ) : (
                  <p className="cinema-card-summary">
                    {movies.length} film{movies.length > 1 ? 's' : ''} · {count} séance{count > 1 ? 's' : ''} · prochaine{' '}
                    {multiDay && next.day !== today ? `${shortDayLabel(next.day, today)} ` : ''}
                    {formatTime(next.date)}
                  </p>
                )}
              </button>
              <button
                className={`icon-btn cinema-card-toggle ${isOpen ? 'cinema-card-toggle--open' : ''}`}
                onClick={() => toggle(cid)}
                aria-label={isOpen ? `Replier ${cinema.name}` : `Déplier ${cinema.name}`}
                aria-expanded={isOpen}
              >
                <Icon name="chevron" />
              </button>
              {isOpen && cinema.url && (
                <a className="icon-btn" href={cinema.url} target="_blank" rel="noreferrer" aria-label={`Site de ${cinema.name}`}>
                  <Icon name="external" />
                </a>
              )}
            </header>
            {isOpen && (
            <ul className="cinema-movies" id={`cinema-${cid}`}>
              {movies.map(([mid, list]) => {
                const movie = data.movies.get(mid);
                return (
                  <li key={mid} className="cinema-movie">
                    <button className="cinema-movie-main" onClick={() => onOpen(mid)}>
                      <Poster movie={movie} size="w154" className="cinema-movie-poster" />
                      <span className="cinema-movie-info">
                        <span className="cinema-movie-title">{movie.title}</span>
                        <ImdbBadge movie={movie} />
                      </span>
                    </button>
                    <div className="st-row st-row--compact">
                      {list.map((s) => (
                        <a
                          key={s.id || `${s.ts}-${s.version}`}
                          className="st st--compact"
                          href={s.bookingUrl || cinema.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="st-time">
                            {multiDay && s.day !== today ? `${shortDayLabel(s.day, today)} ` : ''}
                            {formatTime(s.date)}
                          </span>
                          <VersionBadge version={s.version} small />
                        </a>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function CinemaPicker({ open, onClose, data, favCinemas, onToggleCinema }) {
  const cinemas = [...data.cinemas.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const counts = useMemo(() => {
    const c = new Map();
    for (const s of data.showtimes) c.set(s.cinemaId, (c.get(s.cinemaId) || 0) + 1);
    return c;
  }, [data]);
  return (
    <Sheet open={open} onClose={onClose} label="Mes cinémas">
      <div className="picker">
        <h2>Mes cinémas</h2>
        <p className="muted">Touche l'étoile pour ajouter un cinéma à tes favoris, puis active le filtre « Mes cinémas ».</p>
        <ul>
          {cinemas.map((c) => {
            const on = favCinemas.includes(c.id);
            return (
              <li key={c.id}>
                <button className={`picker-row ${on ? 'picker-row--on' : ''}`} onClick={() => onToggleCinema(c.id)} aria-pressed={on}>
                  <span className={`star-btn ${on ? 'star-btn--on' : ''}`}>
                    <Icon name="star" size={18} />
                  </span>
                  <span className="picker-name">
                    {c.name}
                    <small>{[c.area, `${counts.get(c.id) || 0} séances`].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
