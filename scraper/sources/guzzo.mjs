// Cinémas Guzzo: one page per cinema with the week's schedule ("Horaire du 23 au 29 oct. 2026"),
// written as weekday groups ("Vendredi, Samedi, Dimanche, Mardi : 13:00-15:05-…") under a
// French block and an optional "Version anglaise" block. Film pages add the director.
import { getText, mapLimit } from '../lib/http.mjs';
import { chunks, text } from '../lib/html.mjs';
import { detectFormats, smartCase } from '../lib/labels.mjs';
import { addDays, montrealIso, monthNumber, todayYmd } from '../lib/time.mjs';

const BASE = 'https://www.cinemasguzzo.com';
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const weekday = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

/** "23 au 29 oct. 2026" or "30 oct. au 5 nov. 2026" → every date of that week. */
export function weekDates(label) {
  const m = fold(label).match(/(\d{1,2})\s*([a-z]+)?\.?\s+au\s+(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/);
  if (!m) return [];
  const endMonth = monthNumber(m[4]);
  const startMonth = m[2] ? monthNumber(m[2]) : endMonth;
  let year = Number(m[5]);
  if (startMonth > endMonth) year -= 1;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const end = `${m[5]}-${String(endMonth).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const dates = [];
  for (let d = start; d <= end && dates.length < 14; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** "Vendredi, Samedi, Mardi", "Lundi au Jeudi", "Tous les jours" → matching dates of the week. */
export function daysMatching(label, dates) {
  const s = fold(label);
  if (/tous les jours/.test(s)) return dates;
  const range = s.match(/(\w+)\s+au\s+(\w+)/);
  if (range && WEEKDAYS.includes(range[1]) && WEEKDAYS.includes(range[2])) {
    const from = dates.findIndex((d) => WEEKDAYS[weekday(d)] === range[1]);
    const to = dates.findIndex((d) => WEEKDAYS[weekday(d)] === range[2]);
    return from >= 0 && to >= from ? dates.slice(from, to + 1) : [];
  }
  const wanted = new Set(WEEKDAYS.filter((w) => new RegExp(`\\b${w}\\b`).test(s)));
  return dates.filter((d) => wanted.has(WEEKDAYS[weekday(d)]));
}

export function parseSchedule(html) {
  const dates = weekDates(text(html.match(/Horaire du([\s\S]*?)<\/a>/)?.[1] || ''));
  const films = [];
  for (const block of chunks(html, /<div class="listing hoverFilm">/g)) {
    const link = block.match(/<h2>\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!link) continue;
    const only = fold(text(block.match(/<span class="seulement">([\s\S]*?)<\/span>\s*<\/h2>/)?.[1] || ''));
    // Screenings come first in French unless the film is English only; "Version anglaise" switches.
    let version = /anglais/.test(only) ? 'VO' : 'VF';
    const screenings = [];
    const steps = block.matchAll(/<strong>\s*Version (anglaise|fran[^<]*)\s*<\/strong>|<p class="fontBleu"><b>([\s\S]*?)<\/b><\/p>\s*<p>([^<]*)<\/p>/g);
    for (const step of steps) {
      if (step[1]) {
        version = /anglaise/.test(step[1]) ? 'VO' : 'VF';
        continue;
      }
      const times = step[3].match(/\d{1,2}:\d{2}/g) || [];
      for (const date of daysMatching(text(step[2]), dates)) {
        for (const time of times) screenings.push({ date, time, version });
      }
    }
    films.push({ url: link[1], title: text(link[2]), screenings });
  }
  return { dates, films };
}

async function director(url) {
  const page = text(await getText(`${BASE}/${url}`));
  const m = page.match(/Réalisé par\s*:\s*(.+?)\s+(Distribution|Genre|Qualité|Synopsis)\b/);
  return m ? m[1].split(/\s*,\s*|\s+-\s+|\s+et\s+/).filter(Boolean).map(smartCase) : [];
}

export default {
  id: 'guzzo',
  name: 'Cinémas Guzzo',
  async fetch({ days, log }) {
    const first = todayYmd();
    const last = addDays(first, days - 1);
    const index = await getText(`${BASE}/cinemas.html`);
    const pages = [...new Set([...index.matchAll(/href="(\d+-cinemas-horaire-[^"#]+\.html)"/g)].map((m) => m[1]))];
    if (!pages.length) throw new Error('aucun cinéma trouvé');

    const cinemas = [];
    const showtimes = [];
    const directors = new Map();
    for (const page of pages) {
      const html = await getText(`${BASE}/${page}`);
      const name = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]) || page.replace(/^\d+-cinemas-horaire-|\.html$/g, '');
      const address = html.match(/(\d+,\s*[^<]+?\(Québec\)[^<]*)/)?.[1]?.trim() || null;
      const id = `guzzo-${page.replace(/^\d+-cinemas-horaire-|\.html$/g, '')}`;
      cinemas.push({
        id,
        name: /guzzo/i.test(name) ? name : `Guzzo ${name}`,
        short: name.replace(/^(Guzzo\s+)?Méga-Plex\s+/i, ''),
        chain: 'Guzzo',
        area: address?.split(',')[2]?.replace(/\(.*$/, '').trim() || null,
        address,
        url: `${BASE}/${page}`,
        cineplus: false,
      });

      const { dates, films } = parseSchedule(html);
      if (!dates.length) throw new Error(`semaine illisible sur ${page}`);
      await mapLimit(films, 3, async (f) => {
        if (directors.has(f.url)) return;
        directors.set(f.url, await director(f.url).catch((err) => (log(`fiche ${f.url}: ${err.message}`), [])));
      });
      for (const f of films) {
        for (const s of f.screenings) {
          if (s.date < first || s.date > last) continue;
          showtimes.push({
            cinemaId: id,
            start: montrealIso(s.date, s.time),
            version: s.version,
            formats: detectFormats(f.title),
            bookingUrl: `${BASE}/${page}`,
            film: { title: f.title, directors: directors.get(f.url) || [] },
          });
        }
      }
    }
    return { cinemas, showtimes };
  },
};
