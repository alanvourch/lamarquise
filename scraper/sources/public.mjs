// Cinéma Public: a travelling cinema (WordPress) that screens at Casa d'Italia and at Livart.
// The /horaire/ calendar lists the films; each film page lists all its screenings with the
// venue, the subtitles ("- STA") and a ticket link.
import { getText, mapLimit } from '../lib/http.mjs';
import { attr, chunks, text } from '../lib/html.mjs';
import { normalizeVersion } from '../lib/labels.mjs';
import { addDays, montrealIso, monthNumber, nearestYmd, todayYmd } from '../lib/time.mjs';

const BASE = 'https://cinemapublic.ca';

// Keyed by the data-address the site puts on every screening.
const VENUES = {
  'casa-d-italia': {
    id: 'cinema-public-casa-ditalia',
    name: "Cinéma Public (Casa d'Italia)",
    short: 'Public',
    area: 'Petite-Italie',
    address: '505, rue Jean-Talon Est (entrée sur Berri), Montréal',
  },
  livart: {
    id: 'cinema-public-livart',
    name: 'Cinéma Public (Livart)',
    short: 'Public Livart',
    area: 'Plateau-Mont-Royal',
    address: '3980, rue Saint-Denis, Montréal',
  },
};

export function parseFilmPage(html, today) {
  const meta = html.match(/<p class="film-meta">([\s\S]*?)<\/p>/)?.[1] || '';
  const [credits = '', facts = ''] = meta.split(/<br\s*\/?>/i).map(text);
  const year = facts.match(/\b(19|20)\d{2}\b/)?.[0];
  const runtime = facts.match(/(\d+)\s*min/)?.[1];
  const film = {
    title:
      text(html.match(/<h1 class="hero-title[^"]*">([\s\S]*?)<\/h1>/)?.[1]) ||
      text(attr(html.match(/<meta property="og:title"[^>]*>/)?.[0] || '', 'content')).replace(/\s*–\s*Cinéma Public$/, ''),
    year: year ? Number(year) : null,
    runtime: runtime ? Number(runtime) : null,
    directors: credits ? credits.split(/\s*,\s*|\s+et\s+/).filter(Boolean) : [],
    synopsis: text(html.match(/<div class="vedette-description[^"]*">\s*<p>([\s\S]*?)<\/p>/)?.[1]) || null,
    backdrop: attr(html.match(/<div class="hero-image">\s*<img[^>]*>/)?.[0] || '', 'src'),
  };

  const screenings = [];
  for (const li of chunks(html, /<li class="vedette-seances-single/g)) {
    const when = li.match(/<span class="vedette-seances-time">\s*\S+\s+(\d{1,2})\s+([^<\s]+)\s*<br\s*\/?>\s*(\d{1,2})h(\d{2})/);
    if (!when) continue;
    const month = monthNumber(when[2]);
    if (!month) continue;
    const subtitles = text(li.match(/<span class="vedette-seances-subtitles">([\s\S]*?)<\/span>/)?.[1]).replace(/^-\s*/, '');
    screenings.push({
      venue: attr(li, 'data-address'),
      date: nearestYmd(month, Number(when[1]), today),
      time: [Number(when[3]), Number(when[4])],
      // No subtitle tag means the film is shown as is, in its original language.
      version: subtitles ? normalizeVersion(subtitles) : 'VO',
      bookingUrl: li.match(/href="(https:\/\/cinemapublic\.ticketacces\.net[^"]+)"/)?.[1] || null,
    });
  }
  return { film, screenings };
}

export default {
  id: 'public',
  name: 'Cinéma Public',
  async fetch({ days, log }) {
    const first = todayYmd();
    const last = addDays(first, days - 1);
    const calendar = await getText(`${BASE}/horaire/`);
    const urls = [...new Set([...calendar.matchAll(/href="(https:\/\/cinemapublic\.ca\/films\/[^"#?]+)"/g)].map((m) => m[1]))];
    if (!urls.length) throw new Error('aucun film dans le calendrier');

    const showtimes = [];
    const used = new Set();
    await mapLimit(urls, 3, async (url) => {
      let page;
      try {
        page = parseFilmPage(await getText(url), first);
      } catch (err) {
        log(`fiche ${url} indisponible (${err.message})`);
        return;
      }
      for (const s of page.screenings) {
        const venue = VENUES[s.venue] || VENUES['casa-d-italia'];
        if (s.date < first || s.date > last) continue;
        used.add(venue);
        showtimes.push({
          cinemaId: venue.id,
          start: montrealIso(s.date, s.time),
          version: s.version,
          bookingUrl: s.bookingUrl || url,
          film: page.film,
        });
      }
    });

    const cinemas = Object.values(VENUES)
      .filter((v) => used.has(v) || v === VENUES['casa-d-italia'])
      .map((v) => ({ ...v, chain: 'Cinéma Public', url: `${BASE}/`, cineplus: false }));
    return { cinemas, showtimes };
  },
};
