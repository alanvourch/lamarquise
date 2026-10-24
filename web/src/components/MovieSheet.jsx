import { useMemo, useState } from 'react';
import { Icon, ImdbBadge, Poster, Sheet, VersionBadge } from './ui.jsx';
import { GRACE_MS, priceFor } from '../lib/filters.js';
import { formatPrice, img } from '../lib/format.js';
import { dayLabel, formatRuntime, formatTime } from '../lib/time.js';

function ShowtimeChip({ s, cinema, settings, nowTs }) {
  const past = s.ts < nowTs - GRACE_MS;
  const price = priceFor(s, cinema, settings);
  const body = (
    <>
      <span className="st-time">{formatTime(s.date)}</span>
      <span className="st-meta">
        <VersionBadge version={s.version} small />
        {s.formats?.map((f) => (
          <span key={f} className="fbadge">
            {f}
          </span>
        ))}
      </span>
      {price && <span className={`st-price ${price.member ? 'st-price--member' : ''}`}>{formatPrice(price.amount)}</span>}
    </>
  );
  const url = s.bookingUrl || cinema.url;
  if (past || !url) return <span className={`st ${past ? 'st--past' : ''}`}>{body}</span>;
  return (
    <a className="st" href={url} target="_blank" rel="noreferrer" title={`Réserver · ${cinema.name}`}>
      {body}
    </a>
  );
}

export function MovieSheet({ movie, data, nowTs, today, initialDay, settings, favCinemas, onToggleCinema, inWatchlist, onToggleWatch, onClose }) {
  const all = useMemo(() => data.showtimes.filter((s) => s.movieId === movie.id && s.day >= today), [data, movie.id, today]);
  const days = useMemo(() => [...new Set(all.map((s) => s.day))], [all]);
  const [day, setDay] = useState(() => (days.includes(initialDay) ? initialDay : days[0]));
  const [trailer, setTrailer] = useState(false);

  const byCinema = useMemo(() => {
    const map = new Map();
    for (const s of all) {
      if (s.day !== day) continue;
      if (!map.has(s.cinemaId)) map.set(s.cinemaId, []);
      map.get(s.cinemaId).push(s);
    }
    const fav = new Set(favCinemas);
    return [...map.entries()].sort(
      ([a, sa], [b, sb]) => fav.has(b) - fav.has(a) || sa[0].ts - sb[0].ts,
    );
  }, [all, day, favCinemas]);

  const backdrop = img(movie.backdrop, 'w1280');
  const facts = [movie.year, formatRuntime(movie.runtime), ...(movie.genres || []).slice(0, 3)].filter(Boolean);

  const share = async () => {
    const text = `${movie.title} — ${byCinema
      .map(([cid, list]) => `${data.cinemas.get(cid).short}: ${list.map((s) => formatTime(s.date)).join(', ')}`)
      .join(' · ')}`;
    try {
      if (navigator.share) await navigator.share({ title: movie.title, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelled */
    }
  };

  return (
    <Sheet open onClose={onClose} label={movie.title} wide>
      <div className="msheet">
        <div
          className={`msheet-hero ${backdrop || movie.trailer ? '' : 'msheet-hero--bare'}`}
          style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
        >
          {trailer && movie.trailer ? (
            <iframe
              className="msheet-trailer"
              src={`https://www.youtube-nocookie.com/embed/${movie.trailer}?autoplay=1&rel=0`}
              title={`Bande-annonce : ${movie.title}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            movie.trailer && (
              <button className="msheet-play" onClick={() => setTrailer(true)}>
                <Icon name="play" size={22} /> Bande-annonce
              </button>
            )
          )}
        </div>
        <div className="msheet-head">
          <Poster movie={movie} className="msheet-poster" />
          <div className="msheet-titles">
            <h2>{movie.title}</h2>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="msheet-original">{movie.originalTitle}</p>
            )}
            <p className="msheet-facts">{facts.join(' · ')}</p>
            <div className="msheet-scores">
              <ImdbBadge movie={movie} />
              {movie.imdbId && (
                <a href={`https://www.imdb.com/title/${movie.imdbId}/`} target="_blank" rel="noreferrer" className="textlink">
                  IMDb <Icon name="external" size={12} />
                </a>
              )}
              {movie.tmdbId && (
                <a href={`https://letterboxd.com/tmdb/${movie.tmdbId}`} target="_blank" rel="noreferrer" className="textlink">
                  Letterboxd <Icon name="external" size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="msheet-actions">
          <button className={`btn ${inWatchlist ? 'btn--on' : ''}`} onClick={() => onToggleWatch(movie.id)}>
            <Icon name="heart" size={16} filled={inWatchlist} /> {inWatchlist ? 'Dans ma liste' : 'Ma liste'}
          </button>
          <button className="btn" onClick={share}>
            <Icon name="share" size={16} /> Partager
          </button>
        </div>

        {movie.synopsis && <p className="msheet-synopsis">{movie.synopsis}</p>}
        {(movie.directors?.length > 0 || movie.cast?.length > 0) && (
          <dl className="msheet-credits">
            {movie.directors?.length > 0 && (
              <>
                <dt>Réalisation</dt>
                <dd>{movie.directors.join(', ')}</dd>
              </>
            )}
            {movie.cast?.length > 0 && (
              <>
                <dt>Avec</dt>
                <dd>{movie.cast.slice(0, 5).join(', ')}</dd>
              </>
            )}
          </dl>
        )}

        <section className="msheet-showtimes">
          <h3>Séances</h3>
          {days.length === 0 ? (
            <p className="muted">Plus de séance annoncée.</p>
          ) : (
            <>
              <div className="daytabs daytabs--inline" role="tablist">
                {days.map((d) => (
                  <button key={d} role="tab" aria-selected={d === day} className="daytab" onClick={() => setDay(d)}>
                    {dayLabel(d, today)}
                  </button>
                ))}
              </div>
              {byCinema.map(([cid, list]) => {
                const cinema = data.cinemas.get(cid);
                const fav = favCinemas.includes(cid);
                return (
                  <div key={cid} className="cinema-block">
                    <div className="cinema-block-head">
                      <button
                        className={`star-btn ${fav ? 'star-btn--on' : ''}`}
                        onClick={() => onToggleCinema(cid)}
                        aria-pressed={fav}
                        aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      >
                        <Icon name="star" size={16} />
                      </button>
                      <div>
                        <p className="cinema-name">{cinema.name}</p>
                        {cinema.area && <p className="cinema-area">{cinema.area}</p>}
                      </div>
                    </div>
                    <div className="st-row">
                      {list.map((s) => (
                        <ShowtimeChip key={s.id || `${s.cinemaId}-${s.ts}-${s.version}`} s={s} cinema={cinema} settings={settings} nowTs={nowTs} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>
    </Sheet>
  );
}
