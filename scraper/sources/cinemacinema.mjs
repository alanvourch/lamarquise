// Cinéma du Parc, Cinéma du Musée and Cinéma Beaubien share cinemacinema.ca, a SvelteKit site whose
// pages come with a JSON twin: /fr/horaire/__data.json?date=YYYY-MM-DD lists one day for the three
// cinemas, /fr/films/<slug>/__data.json gives a film's credits and synopsis.
import { getJson, mapLimit } from '../lib/http.mjs';
import { layoutData, pageData } from '../lib/devalue.mjs';
import { text, youtubeId } from '../lib/html.mjs';
import { detectFormats, normalizeVersion, smartCase } from '../lib/labels.mjs';
import { addDays, montrealIso, todayYmd } from '../lib/time.mjs';

const BASE = 'https://cinemacinema.ca';

// Keyed by the site's cinema_id.
const CINEMAS = {
  1: { id: 'cinema-beaubien', name: 'Cinéma Beaubien', short: 'Beaubien', area: 'Rosemont', slug: 'cinema-beaubien' },
  2: { id: 'cinema-du-parc', name: 'Cinéma du Parc', short: 'du Parc', area: 'Milton-Parc', slug: 'cinema-du-parc' },
  3: { id: 'cinema-du-musee', name: 'Cinéma du Musée', short: 'du Musée', area: 'Centre-ville', slug: 'cinema-du-musee' },
};

const ymdOf = (date) => (date instanceof Date ? date.toISOString() : String(date)).slice(0, 10);
const blank = (s) => (s && String(s).trim() ? String(s).trim() : null);
const list = (s) => (blank(s) ? s.split(/\s*,\s*/).filter(Boolean) : []);

async function filmDetails(slug) {
  const { cmFilmCurrent: f } = pageData(await getJson(`${BASE}/fr/films/${slug}/__data.json`));
  if (!f) return {};
  return {
    originalTitle: blank(f.original_title),
    year: f.annee || null,
    directors: list(f.realisateur),
    cast: list(f.acteurs).slice(0, 6),
    synopsis: blank(text(f.synopsis)),
    trailer: youtubeId(f.bande_annonce_url),
    backdrop: blank(f.image1_url),
    // "Ce film est aussi présenté au Cinéma Beaubien avec sous-titres français" links the other copy.
    siblings: [...String(f.synopsis || '').matchAll(/\/films\/([a-z0-9-]+)/g)].map((m) => m[1]),
  };
}

// Copies of one film get their own film_id per cinema and version, sometimes under another title
// ("Possible Love" / "Amours possibles"). Give every copy the title of the first one as original title.
function linkCopies(films, details) {
  const bySlug = new Map([...films.values()].map((f) => [f.slug, f]));
  const sorted = [...films.values()].sort((a, b) => a.film_id - b.film_id);
  const canonical = new Map();
  for (const film of sorted) {
    if (canonical.has(film.film_id)) continue;
    const group = [film];
    for (let i = 0; i < group.length; i++) {
      for (const slug of details.get(group[i].film_id)?.siblings || []) {
        const other = bySlug.get(slug);
        if (other && !group.includes(other)) group.push(other);
      }
    }
    for (const f of group) canonical.set(f.film_id, film);
  }
  for (const [id, first] of canonical) {
    const d = details.get(id);
    if (!d || first.film_id === id || d.originalTitle) continue;
    d.originalTitle = details.get(first.film_id)?.originalTitle || smartCase(first.titre);
  }
  for (const d of details.values()) delete d.siblings;
}

export default {
  id: 'cinemacinema',
  name: 'Cinéma Cinéma (Parc, Musée, Beaubien)',
  async fetch({ days, log }) {
    const today = todayYmd();
    const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
    const pages = await mapLimit(dates, 3, (date) => getJson(`${BASE}/fr/horaire/__data.json?date=${date}`));

    // Addresses and ticketing domains come from the layout data shipped with every page.
    const sites = new Map((layoutData(pages[0], 1)?.cmCinemas || []).map((c) => [c.id, c]));
    const films = new Map();
    const raw = [];
    pages.forEach((payload, i) => {
      for (const film of pageData(payload).filmsRepresentations || []) {
        films.set(film.film_id, film);
        for (const r of film.representations || []) {
          // The page for a date also carries that date's screenings only, but stay defensive.
          if (ymdOf(r.representation_date) === dates[i]) raw.push(r);
        }
      }
    });

    const details = new Map();
    await mapLimit([...films.values()], 4, async (film) => {
      try {
        details.set(film.film_id, await filmDetails(film.slug));
      } catch (err) {
        log(`fiche « ${film.titre} » indisponible (${err.message})`);
      }
    });

    linkCopies(films, details);

    const showtimes = [];
    for (const r of raw) {
      const cinema = CINEMAS[r.cinema_id];
      const film = films.get(r.film_id);
      if (!cinema || !film) continue;
      const site = sites.get(r.cinema_id);
      const booking =
        r.url_bel && site?.online_sales_url
          ? `${site.online_sales_url}?P1=01&P2=${String(r.cinema_id).padStart(2, '0')}&P3=${r.representation_id}`
          : blank(r.url_autre_bel) || `${BASE}/fr/films/${film.slug}`;
      showtimes.push({
        cinemaId: cinema.id,
        start: montrealIso(ymdOf(r.representation_date), r.heure_debut),
        version: normalizeVersion(r.version || film.version),
        formats: detectFormats(r.format, r.salle_desc),
        bookingUrl: booking,
        film: {
          title: smartCase(film.titre),
          runtime: film.duree || null,
          genres: [film.genre1, film.genre2, film.genre3].filter(blank),
          poster: blank(film.poster_url),
          ...details.get(film.film_id),
        },
      });
    }

    const cinemas = Object.entries(CINEMAS).map(([key, c]) => {
      const site = sites.get(Number(key));
      return {
        id: c.id,
        name: c.name,
        short: c.short,
        chain: 'Cinéma Cinéma',
        area: c.area,
        address: site ? [site.adresse_1, site.ville].filter(blank).join(', ') : null,
        url: `${BASE}/fr/${c.slug}`,
        cineplus: false,
      };
    });
    return { cinemas, showtimes };
  },
};
