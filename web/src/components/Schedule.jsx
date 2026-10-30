import { Fragment, useMemo } from 'react';
import { Icon, ImdbBadge, Poster, VersionBadge } from './ui.jsx';
import { dayLabel, formatTime, untilLabel } from '../lib/time.js';
import { groupScheduleHours } from '../lib/schedule.js';

export function Schedule({ showtimes, data, nowTs, today, onOpen, multiDay, expanded, onToggleHour }) {
  const groups = useMemo(() => groupScheduleHours(showtimes), [showtimes]);
  return (
    <ol className="schedule">
      {groups.map((g) => {
        const isOpen = expanded.has(g.key);
        const label = multiDay ? `${dayLabel(g.day, today)} · ${g.hour} h` : `${g.hour} h`;
        return (
          <Fragment key={g.key}>
            <li className="schedule-hour">
              <button
                className={`schedule-hour-btn ${isOpen ? '' : 'schedule-hour-btn--folded'}`}
                onClick={() => onToggleHour(g.key)}
                aria-expanded={isOpen}
              >
                <span>{label}</span>
                <small>{g.movies.length} film{g.movies.length > 1 ? 's' : ''} · {g.count} séance{g.count > 1 ? 's' : ''}</small>
                <Icon name="chevron" size={16} />
              </button>
            </li>
            {isOpen && g.movies.map((group) => (
              <ScheduleRow key={group.movieId} {...{ group, data, nowTs, today, onOpen }} />
            ))}
          </Fragment>
        );
      })}
    </ol>
  );
}

function ScheduleRow({ group, data, nowTs, today, onOpen }) {
  const movie = data.movies.get(group.movieId);
  const first = group.showtimes[0];
  const last = group.showtimes.at(-1);
  const until = first.day === today ? untilLabel(first.ts, nowTs) : null;
  const cinemaCount = group.cinemaIds.size;
  const cinemaLabel = cinemaCount === 1 ? data.cinemas.get(first.cinemaId).name : `${cinemaCount} cinémas`;
  return (
    <li className="srow">
      <button className="srow-main" onClick={() => onOpen(movie.id, first.day)}>
        <Poster movie={movie} size="w154" className="srow-poster" />
        <span className="srow-info">
          <span className="srow-title">{movie.title}</span>
          <span className="srow-sub">
            <strong>{formatTime(first.date)}{last.ts !== first.ts && ` à ${formatTime(last.date)}`}</strong>
            {until && <small className="muted">{until}</small>}
          </span>
          <span className="srow-sub">
            <ImdbBadge movie={movie} />
            {[...group.versions].map((version) => <VersionBadge key={version} version={version} small />)}
          </span>
          <span className="srow-cinema">
            {group.showtimes.length} séance{group.showtimes.length > 1 ? 's' : ''} · {cinemaLabel}
          </span>
        </span>
        <Icon name="chevron" size={16} />
      </button>
    </li>
  );
}
