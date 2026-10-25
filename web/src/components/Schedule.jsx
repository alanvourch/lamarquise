import { Fragment } from 'react';
import { Icon, ImdbBadge, Poster, VersionBadge } from './ui.jsx';
import { priceFor } from '../lib/filters.js';
import { formatPriceLabel, priceTitle } from '../lib/format.js';
import { dayLabel, formatTime, localParts, untilLabel } from '../lib/time.js';
import { useProgressive } from '../lib/hooks.js';

// Chronological list of every screening: "what can I catch tonight?"
// Hundreds of rows on a full day: render the first ones at once, the rest while scrolling.
export function Schedule({ showtimes, data, nowTs, today, settings, onOpen, multiDay }) {
  const [shown, setSentinel] = useProgressive(showtimes);
  let lastHeading = null;
  return (
    <>
    <ol className="schedule">
      {showtimes.slice(0, shown).map((s) => {
        const movie = data.movies.get(s.movieId);
        const cinema = data.cinemas.get(s.cinemaId);
        const price = priceFor(s, cinema, settings);
        const until = s.day === today ? untilLabel(s.ts, nowTs) : null;
        const hour = localParts(s.date).h;
        const heading = multiDay ? `${dayLabel(s.day, today)} · ${hour} h` : `${hour} h`;
        const showHeading = heading !== lastHeading;
        lastHeading = heading;
        return (
          <Fragment key={s.id || `${s.movieId}-${s.cinemaId}-${s.ts}-${s.version}`}>
            {showHeading && <li className="schedule-hour">{heading}</li>}
            <li className="srow">
              <button className="srow-main" onClick={() => onOpen(movie.id)}>
                <span className="srow-time">
                  {formatTime(s.date)}
                  {until && <small>{until}</small>}
                </span>
                <Poster movie={movie} size="w154" className="srow-poster" />
                <span className="srow-info">
                  <span className="srow-title">{movie.title}</span>
                  <span className="srow-sub">
                    <ImdbBadge movie={movie} />
                    <VersionBadge version={s.version} small />
                    {s.formats?.map((f) => (
                      <span key={f} className="fbadge">
                        {f}
                      </span>
                    ))}
                  </span>
                  <span className="srow-cinema">
                    <Icon name="pin" size={12} /> {cinema.name}
                  </span>
                </span>
              </button>
              {(s.bookingUrl || cinema.url) && (
                <a className="srow-book" href={s.bookingUrl || cinema.url} target="_blank" rel="noreferrer">
                  {price ? (
                    <span className={price.member ? 'st-price--member' : ''} title={priceTitle(price)}>
                      {formatPriceLabel(price)}
                    </span>
                  ) : (
                    <Icon name="ticket" size={18} />
                  )}
                  <span className="srow-book-label">Réserver</span>
                </a>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
    {shown < showtimes.length && <div ref={setSentinel} className="progressive-sentinel" aria-hidden="true" />}
    </>
  );
}
