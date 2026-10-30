import { useRef, useEffect } from 'react';
import { Chip, Icon } from './ui.jsx';
import { SORTS } from '../lib/filters.js';
import { dayLabel } from '../lib/time.js';

const VIEWS = [
  { id: 'films', label: 'Films', icon: 'film' },
  { id: 'seances', label: 'Séances', icon: 'ticket' },
  { id: 'cinemas', label: 'Cinémas', icon: 'pin' },
];

const FROM_OPTIONS = [
  { value: '', label: 'Toute la journée' },
  { value: 12 * 60, label: 'Dès 12 h' },
  { value: 17 * 60, label: 'Dès 17 h' },
  { value: 19 * 60, label: 'Dès 19 h' },
  { value: 21 * 60, label: 'Dès 21 h' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Toutes notes' },
  { value: 6, label: 'IMDb ≥ 6' },
  { value: 7, label: 'IMDb ≥ 7' },
  { value: 7.5, label: 'IMDb ≥ 7,5' },
  { value: 8, label: 'IMDb ≥ 8' },
];

export function DayTabs({ days, day, setDay, today }) {
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [day]);
  return (
    <div className="daytabs" role="tablist" aria-label="Jour" ref={listRef}>
      {days.map((d) => (
        <button key={d} role="tab" aria-selected={d === day} className="daytab" onClick={() => setDay(d)}>
          {dayLabel(d, today)}
        </button>
      ))}
      <button role="tab" aria-selected={day === 'week'} className="daytab" onClick={() => setDay('week')}>
        7 jours
      </button>
    </div>
  );
}

export function ViewSwitch({ view, setView }) {
  return (
    <div className="segmented" role="tablist" aria-label="Affichage">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={view === v.id}
          onClick={() => {
            if (view === v.id) {
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
              });
            } else {
              setView(v.id);
            }
          }}
        >
          <span className="view-icon"><Icon name={v.icon} size={21} /></span>
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  );
}

function SelectChip({ value, onChange, options, active, label }) {
  return (
    <label className={`chip chip--select ${active ? 'chip--on' : ''}`}>
      <span className="sr-only">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ filters, setFilters, favCount, sort, setSort, showSort, onPickCinemas, watchCount }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  return (
    <div className="filterbar">
      <Chip active={filters.watchlistOnly} onClick={() => set({ watchlistOnly: !filters.watchlistOnly })}>
        <Icon name="heart" size={14} /> Ma liste{watchCount ? ` (${watchCount})` : ''}
      </Chip>
      <Chip
        active={filters.cinemaMode === 'fav'}
        onClick={() => (favCount ? set({ cinemaMode: filters.cinemaMode === 'fav' ? 'all' : 'fav' }) : onPickCinemas())}
        title={favCount ? 'Seulement mes cinémas favoris' : 'Choisir mes cinémas favoris'}
      >
        <Icon name="star" size={14} /> Mes cinémas{favCount ? ` (${favCount})` : ''}
      </Chip>
      {showSort && (
        <label className="chip chip--select chip--sort">
          <span className="sr-only">Trier par</span>
          <Icon name="sliders" size={15} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <SelectChip
        label="Heure"
        value={filters.fromMinutes}
        active={filters.fromMinutes != null}
        options={FROM_OPTIONS}
        onChange={(v) => set({ fromMinutes: v == null ? null : Number(v) })}
      />
      <SelectChip
        label="Note IMDb minimale"
        value={filters.minRating}
        active={filters.minRating != null}
        options={RATING_OPTIONS}
        onChange={(v) => set({ minRating: v == null ? null : Number(v) })}
      />
    </div>
  );
}
