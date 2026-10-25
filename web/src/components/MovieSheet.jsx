import { useMemo, useState } from 'react';
import { Icon, Poster, ScoreLinks, Sheet, VersionBadge } from './ui.jsx';
import { GRACE_MS, priceFor } from '../lib/filters.js';
import { formatPriceLabel, img, priceTitle } from '../lib/format.js';
import { dayLabel, formatRuntime, formatTime } from '../lib/time.js';

// Letterboxd names its people pages after them: "Alejandro G. Iñárritu" → /director/alejandro-g-inarritu/.
export const letterboxdDirector = (name) =>
  `https://letterboxd.com/director/${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}/`;

/** Address of the film's own page, which carries the link preview (title, poster) for sharing. */
export const filmUrl = (movie) => new URL(`${import.meta.env.BASE_URL}film/${movie.id}/`, location.origin).href;

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
      {price && (
        <span className={`st-price ${price.member ? 'st-price--member' : ''}`} title={priceTitle(price)}>
          {formatPriceLabel(price)}
        </span>
      )}
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
  // The French title under the original one, or the original script ("가능한 사랑") under an English title.
  const subtitle = [movie.titleFr, movie.originalTitle].find((t) => t && t !== movie.title);
  const facts = [movie.year, formatRuntime(movie.runtime), ...(movie.genres || []).slice(0, 3)].filter(Boolean);

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = filmUrl(movie);
    try {
      if (navigator.share) await navigator.share({ title: movie.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <Sheet open onClose={onClose} label={movie.title} wide>
      <div className="msheet">
        <div
          className={`msheet-hero ${backdrop || movie.trailer ? '' : 'msheet-hero--bare'} ${trailer ? 'msheet-hero--playing' : ''}`}
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
            {subtitle && <p className="msheet-original">{subtitle}</p>}
            <p className="msheet-facts">{facts.join(' · ')}</p>
            <ScoreLinks movie={movie} />
          </div>
        </div>

        <div className="msheet-actions">
          <button className={`btn ${inWatchlist ? 'btn--on' : ''}`} onClick={() => onToggleWatch(movie.id)}>
            <Icon name="heart" size={16} filled={inWatchlist} /> {inWatchlist ? 'Dans ma liste' : 'Ma liste'}
          </button>
          <button className="btn" onClick={share}>
            <Icon name="share" size={16} /> {copied ? 'Lien copié' : 'Partager'}
          </button>
        </div>

        {movie.synopsis && <p className="msheet-synopsis">{movie.synopsis}</p>}
        {(movie.directors?.length > 0 || movie.cast?.length > 0) && (
          <dl className="msheet-credits">
            {movie.directors?.length > 0 && (
              <>
                <dt>Réalisation</dt>
                <dd>
                  {movie.directors.map((name, i) => (
                    <span key={name}>
                      {i > 0 && ', '}
                      <a className="person-link" href={letterboxdDirector(name)} target="_blank" rel="noreferrer">
                        {name}
                      </a>
                    </span>
                  ))}
                </dd>
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
