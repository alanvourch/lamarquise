// Cinéma Moderne (Mile End): a WordPress site with a monthly calendar at /horaire/YYYY/MM/.
// Each event carries the time, title and version, plus a card with credits and a ticket link.
import { getText } from '../lib/http.mjs';
import { attr, chunks, text } from '../lib/html.mjs';
import { detectFormats, normalizeVersion } from '../lib/labels.mjs';
import { addDays, montrealIso, todayYmd } from '../lib/time.mjs';

const BASE = 'https://www.cinemamoderne.com';
const CINEMA = {
  id: 'cinema-moderne',
  name: 'Cinéma Moderne',
  short: 'Moderne',
  chain: null,
  area: 'Mile End',
  address: '5150, boul. Saint-Laurent, Montréal',
  url: `${BASE}/`,
  cineplus: false,
};

// Card details read "Director / Country / 2026 / 148 minutes / Français / Anglais / DCP".
export function parseDetails(items) {
  const film = { directors: [], year: null, runtime: null };
  items.forEach((item, i) => {
    if (/^(19|20)\d{2}$/.test(item)) film.year = Number(item);
    else if (/^\d+\s*min/.test(item)) film.runtime = parseInt(item, 10);
    else if (i === 0) film.directors = item.split(/\s*,\s*|\s+et\s+|\s+and\s+/).filter(Boolean);
  });
  return film;
}

export function parseMonth(html) {
  const out = [];
  for (const day of chunks(html, /data-day="\d{4}-\d{2}-\d{2}"/g)) {
    const date = attr(day, 'data-day');
    for (const ev of chunks(day, /<div class="cm-Cal__day__event">/g)) {
      const head = ev.match(/<span class="cm-Fat">([^<]+)<\/span>\s*<br>([\s\S]*?)<\/a>/);
      if (!head) continue;
      const label = text(head[2]);
      // "Train to Busan: 10e anniversaire [DERNIÈRE SÉANCE] (VOSTA)": the version closes the label.
      const v = label.match(/\s*\(([^()]+)\)\s*$/);
      const version = v ? normalizeVersion(v[1]) : null;
      const title = version ? label.slice(0, v.index) : label;
      const items = [...ev.matchAll(/<span class='cm-List__item'><span>([\s\S]*?)<\/span><\/span>/g)].map((m) => text(m[1]));
      const ticket = ev.match(/<a class="cm-CTA cm-CTA--red"[^>]*href="([^"]+)"/)?.[1];
      out.push({
        date,
        time: head[1].trim(),
        title,
        version,
        formats: detectFormats(items.at(-1)),
        bookingUrl: ticket || attr(ev, 'href'),
        poster: attr(ev, 'data-bg'),
        ...parseDetails(items),
      });
    }
  }
  return out;
}

export default {
  id: 'moderne',
  name: 'Cinéma Moderne',
  async fetch({ days }) {
    const first = todayYmd();
    const last = addDays(first, days - 1);
    const months = [...new Set([first, last].map((d) => d.slice(0, 7)))];
    const showtimes = [];
    for (const month of months) {
      const html = await getText(`${BASE}/horaire/${month.replace('-', '/')}/`);
      const events = parseMonth(html);
      if (!events.length) throw new Error(`calendrier ${month} vide ou illisible`);
      for (const e of events) {
        if (e.date < first || e.date > last) continue;
        showtimes.push({
          cinemaId: CINEMA.id,
          start: montrealIso(e.date, e.time),
          version: e.version,
          formats: e.formats,
          bookingUrl: e.bookingUrl,
          film: { title: e.title, year: e.year, runtime: e.runtime, directors: e.directors, backdrop: e.poster },
        });
      }
    }
    return { cinemas: [CINEMA], showtimes };
  },
};
