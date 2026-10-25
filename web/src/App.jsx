import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadData } from './lib/data.js';
import { DEFAULT_FILTERS, activeFilterCount, filterShowtimes, groupByMovie, sortGroups } from './lib/filters.js';
import { toggleIn, useNow, usePersistentState } from './lib/hooks.js';
import { dayKey, formatDateTime, longDayLabel } from './lib/time.js';
import { DayTabs, FilterBar, ViewSwitch } from './components/Toolbar.jsx';
import { MovieCard } from './components/MovieCard.jsx';
import { MovieSheet } from './components/MovieSheet.jsx';
import { Schedule } from './components/Schedule.jsx';
import { CinemaList, CinemaPicker } from './components/Cinemas.jsx';
import { SettingsSheet } from './components/Settings.jsx';
import { Releases } from './components/Releases.jsx';
import { Icon } from './components/ui.jsx';

const DEFAULT_SETTINGS = { cineplus: false, hidePast: true };

// A film opens from "#film=<id>" (in-app navigation) or from its shared page "<base>film/<id>/".
const FILM_PATH = new RegExp(`^${import.meta.env.BASE_URL}film/([^/]+)/?$`);
const filmFromHash = () =>
  decodeURIComponent(location.hash.replace(/^#film=/, '')) ||
  decodeURIComponent(location.pathname.match(FILM_PATH)?.[1] || '') ||
  null;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const now = useNow();
  const today = dayKey(now);

  const [view, setView] = usePersistentState('view', 'films');
  const [sort, setSort] = usePersistentState('sort', 'next');
  const [storedFilters, setFilters] = usePersistentState('filters', DEFAULT_FILTERS);
  // Version and genre filters are gone from the bar: choices saved by an earlier version no longer apply.
  const filters = useMemo(() => ({ ...storedFilters, versions: [], genre: null }), [storedFilters]);
  const [settings, setSettings] = usePersistentState('settings', DEFAULT_SETTINGS);
  const [favCinemas, setFavCinemas] = usePersistentState('favCinemas', []);
  const [watchlist, setWatchlist] = usePersistentState('watchlist', []);
  const [day, setDay] = useState(null);
  const [foldedHours, setFoldedHours] = useState({}); // { [day]: [hour labels] }
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMovie, setOpenMovie] = useState(filmFromHash);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadData().then(setData, setError);
  }, []);

  // Hour headings in the Séances view stick just under the header, whatever its height.
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--sticky-offset', `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The film sheet lives in the URL hash, so the back button closes it and links can be shared.
  useEffect(() => {
    const onPop = () => setOpenMovie(filmFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openFilm = useCallback((id) => {
    history.pushState({ film: id }, '', `#film=${encodeURIComponent(id)}`);
    setOpenMovie(id);
  }, []);
  const closeFilm = useCallback(() => {
    if (history.state?.film) history.back();
    else {
      // Leaving a shared film page lands on the home page.
      history.replaceState(null, '', FILM_PATH.test(location.pathname) ? import.meta.env.BASE_URL : location.pathname + location.search);
      setOpenMovie(null);
    }
  }, []);

  const days = useMemo(() => (data ? data.days.filter((d) => d >= today).slice(0, 8) : []), [data, today]);
  const activeDay = day === 'week' || days.includes(day) ? day : days[0] ?? today;
  const multiDay = activeDay === 'week';

  const showtimes = useMemo(
    () =>
      data
        ? filterShowtimes(
            data,
            { ...filters, day: activeDay, query, favCinemas, watchlist, hidePast: settings.hidePast },
            now,
          )
        : [],
    [data, filters, activeDay, query, favCinemas, watchlist, settings.hidePast, now],
  );
  const groups = useMemo(
    () => (data ? sortGroups(groupByMovie(showtimes, data, now.getTime()), sort) : []),
    [data, showtimes, sort, now],
  );

  const toggleCinema = useCallback((id) => setFavCinemas((l) => toggleIn(l, id)), [setFavCinemas]);
  const toggleWatch = useCallback((id) => setWatchlist((l) => toggleIn(l, id)), [setWatchlist]);
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery('');
  };

  const movie = openMovie && data?.movies.get(openMovie);
  // A shared film page starts with that film's title; follow the open sheet from there.
  useEffect(() => {
    document.title = movie ? `${movie.title} — MontReel` : 'MontReel — Séances à Montréal';
  }, [movie]);
  const nFilters = activeFilterCount(filters) + (query ? 1 : 0);

  return (
    <div className="app">
      <header className="topbar" ref={headerRef}>
        <div className="topbar-row">
          <a className="brand" href="./" aria-label="MontReel, accueil">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">MontReel</span>
            <span className="brand-city">Montréal</span>
          </a>
          <nav className="viewnav">
            <ViewSwitch view={view} setView={setView} />
          </nav>
          <div className="topbar-actions">
            <button
              className={`icon-btn ${searchOpen || query ? 'icon-btn--on' : ''}`}
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Rechercher un film"
              aria-expanded={searchOpen}
            >
              <Icon name="search" />
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Réglages">
              <Icon name="settings" />
            </button>
          </div>
        </div>
        {(searchOpen || query) && (
          <div className="search">
            <Icon name="search" size={16} />
            <input
              autoFocus
              type="search"
              placeholder="Film, réalisateur, acteur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher"
            />
            {query && (
              <button className="icon-btn icon-btn--sm" onClick={() => setQuery('')} aria-label="Effacer">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        )}
        {data && <DayTabs days={days} day={activeDay} setDay={setDay} today={today} />}
      </header>

      <main className="content">
        {error && (
          <div className="empty">
            <h2>Pas de programme pour l'instant</h2>
            <p className="muted">Les séances n'ont pas encore été récupérées ({String(error.message || error)}).</p>
          </div>
        )}
        {!data && !error && <div className="loading" aria-label="Chargement" />}
        {data && (
          <>
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              favCount={favCinemas.length}
              sort={sort}
              setSort={setSort}
              showSort={view === 'films'}
              onPickCinemas={() => setPickerOpen(true)}
              watchCount={watchlist.length}
            />
            {view === 'films' && !query && <Releases data={data} today={today} onOpen={openFilm} />}
            <div className="summary">
              <p>
                <strong>{multiDay ? '7 prochains jours' : longDayLabel(activeDay)}</strong>
                <span>
                  {groups.length} film{groups.length > 1 ? 's' : ''} · {showtimes.length} séance
                  {showtimes.length > 1 ? 's' : ''}
                </span>
              </p>
              {nFilters > 0 && (
                <button className="textlink" onClick={resetFilters}>
                  Effacer les filtres ({nFilters})
                </button>
              )}
            </div>

            {showtimes.length === 0 ? (
              <div className="empty">
                <h2>Aucune séance</h2>
                <p className="muted">Rien ne correspond à ces filtres pour ce jour.</p>
                {nFilters > 0 && (
                  <button className="btn" onClick={resetFilters}>
                    Effacer les filtres
                  </button>
                )}
              </div>
            ) : view === 'seances' ? (
              <Schedule
                showtimes={showtimes}
                folded={new Set(foldedHours[activeDay] || [])}
                onToggleHour={(label) =>
                  setFoldedHours((f) => ({ ...f, [activeDay]: toggleIn(f[activeDay] || [], label) }))
                }
                data={data}
                nowTs={now.getTime()}
                today={today}
                settings={settings}
                onOpen={openFilm}
                multiDay={multiDay}
              />
            ) : view === 'cinemas' ? (
              <CinemaList
                showtimes={showtimes}
                data={data}
                favCinemas={favCinemas}
                onToggleCinema={toggleCinema}
                onOpen={openFilm}
                settings={settings}
                today={today}
                multiDay={multiDay}
              />
            ) : (
              <div className="grid">
                {groups.map((g) => (
                  <MovieCard
                    key={g.movie.id}
                    group={g}
                    cinemas={data.cinemas}
                    onOpen={openFilm}
                    inWatchlist={watchlist.includes(g.movie.id)}
                    onToggleWatch={toggleWatch}
                    today={today}
                    multiDay={multiDay}
                  />
                ))}
              </div>
            )}

            <footer className="footer">
              <p>Programme mis à jour le {formatDateTime(data.generatedAt)}.</p>
              {data.sources.length > 0 && <p>Sources : {data.sources.join(', ')}.</p>}
              <p>
                Notes : IMDb. Affiches et résumés : TMDB. Ce produit utilise l'API TMDB sans être approuvé ni certifié
                par TMDB. Vérifie l'horaire sur le site du cinéma avant de partir.
              </p>
            </footer>
          </>
        )}
      </main>

      {data && movie && (
        <MovieSheet
          key={movie.id}
          movie={movie}
          data={data}
          nowTs={now.getTime()}
          today={today}
          initialDay={multiDay ? today : activeDay}
          settings={settings}
          favCinemas={favCinemas}
          onToggleCinema={toggleCinema}
          inWatchlist={watchlist.includes(movie.id)}
          onToggleWatch={toggleWatch}
          onClose={closeFilm}
        />
      )}
      {data && (
        <CinemaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          data={data}
          favCinemas={favCinemas}
          onToggleCinema={toggleCinema}
        />
      )}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        onPickCinemas={() => {
          setSettingsOpen(false);
          setPickerOpen(true);
        }}
        onReset={() => {
          resetFilters();
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
