import { Fragment, useMemo } from 'react';
import { Icon, ImdbBadge, Poster, VersionBadge } from './ui.jsx';
import { priceFor } from '../lib/filters.js';
import { formatPriceLabel, priceTitle } from '../lib/format.js';
import { dayLabel, formatTime, localParts, untilLabel } from '../lib/time.js';
import { useProgressive } from '../lib/hooks.js';

// Chronological list of every screening: "what can I catch tonight?"
// Rows are grouped by hour; tapping an hour folds it, to jump past the early screenings.
// Hundreds of rows on a full day: render the first ones at once, the rest while scrolling.
// `folded`: the hours folded for this day, kept by the app so they survive a trip to another view.
export function Schedule({ showtimes, data, nowTs, today, settings, onOpen, multiDay, folded, onToggleHour }) {
  const groups = useMemo(() => {
    const list = [];
    for (const s of showtimes) {
      const hour = localParts(s.date).h;
      const label = multiDay ? `${dayLabel(s.day, today)} · ${hour} h` : `${hour} h`;
      if (list.at(-1)?.label !== label) list.push({ label, items: [] });
      list.at(-1).items.push(s);
    }
    return list;
  }, [showtimes, multiDay, today]);

  const openRows = groups.reduce((n, g) => n + (folded.has(g.label) ? 0 : g.items.length), 0);
  // The list is rebuilt every minute (past screenings drop out): only another day starts over.
  const [shown, setSentinel] = useProgressive(openRows, multiDay ? 'week' : showtimes[0]?.day);
  let budget = shown;
  const visible = [];
  for (const g of groups) {
    if (budget <= 0) break;
    const isFolded = folded.has(g.label);
    const rows = isFolded ? [] : g.items.slice(0, budget);
    budget -= rows.length;
    visible.push({ ...g, isFolded, rows });
  }

  return (
    <>
      <ol className="schedule">
        {visible.map((g) => (
          <Fragment key={g.label}>
            <li className="schedule-hour">
              <button
                className={`schedule-hour-btn ${g.isFolded ? 'schedule-hour-btn--folded' : ''}`}
                onClick={() => onToggleHour(g.label)}
                aria-expanded={!g.isFolded}
              >
                <span>{g.label}</span>
                <small>
                  {g.items.length} séance{g.items.length > 1 ? 's' : ''}
                </small>
                <Icon name="chevron" size={16} />
              </button>
            </li>
            {g.rows.map((s) => (
              <ScheduleRow
                key={s.id || `${s.movieId}-${s.cinemaId}-${s.ts}-${s.version}`}
                {...{ s, data, nowTs, today, settings, onOpen }}
              />
            ))}
          </Fragment>
        ))}
      </ol>
      {shown < openRows && <div ref={setSentinel} className="progressive-sentinel" aria-hidden="true" />}
    </>
  );
}

function ScheduleRow({ s, data, nowTs, today, settings, onOpen }) {
  const movie = data.movies.get(s.movieId);
  const cinema = data.cinemas.get(s.cinemaId);
  const price = priceFor(s, cinema, settings);
  const until = s.day === today ? untilLabel(s.ts, nowTs) : null;
  return (
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
  );
}
