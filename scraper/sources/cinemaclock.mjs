// Cinemaclock lists every cinema in Québec on one page per theatre (/movie-theaters/<slug>).
// It is the source for the chains whose own sites refuse robots (Cineplex: robots.txt
// "Disallow: /") or block them (Cinémathèque québécoise: Cloudflare challenge).
//
// Pages come in French (the client asks for fr-CA). A movie block holds one sub-block per
// presentation; its class names the language of the screening's title (fif = French,
// fie = English, fio = other) and its notes the subtitles ("avec s.-t. fr."), the screen
// ("Écran IMAX", "UltraAVX") or "Version 3D".
import { getText } from '../lib/http.mjs';
import { chunks, text } from '../lib/html.mjs';
import { detectFormats, normalizeVersion } from '../lib/labels.mjs';
import { addDays, montrealIso, monthNumber, nearestYmd, todayYmd } from '../lib/time.mjs';

const BASE = 'https://www.cinemaclock.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LANGUAGES = {
  français: 'fr', anglais: 'en', espagnol: 'es', italien: 'it', allemand: 'de', portugais: 'pt', japonais: 'ja',
  coréen: 'ko', chinois: 'zh', mandarin: 'zh', cantonais: 'zh', hindi: 'hi', tamoul: 'ta', télougou: 'te',
  arabe: 'ar', persan: 'fa', turc: 'tr', russe: 'ru', ukrainien: 'uk', polonais: 'pl', hébreu: 'he',
  philippin: 'tl', tagalog: 'tl', suédois: 'sv', danois: 'da', norvégien: 'no', néerlandais: 'nl', roumain: 'ro',
  grec: 'el', hongrois: 'hu', tchèque: 'cs', vietnamien: 'vi', thaï: 'th', pendjabi: 'pa', bengali: 'bn',
};

export function versionOf(lang, notes) {
  // Only subtitles are read from the notes ("avec s.-t. fr.", "with Eng. subt.").
  const v = normalizeVersion(notes);
  if (v === 'VOSTF' || v === 'VOSTA') return v;
  // A French title without subtitles is a French-language screening: dubbed, or a French film (VO).
  return lang === 'fif' ? 'VF' : 'VO';
}

function dateOf(label, ref) {
  const day = label.match(/\d{1,2}/)?.[0];
  const month = monthNumber(label.replace(/[\d\s.]+/g, ''));
  return day && month ? nearestYmd(month, Number(day), ref) : null;
}

export function parseTheatre(html) {
  const ld = html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?"MovieTheater"[\s\S]*?\})\s*<\/script>/);
  let info = {};
  try {
    info = ld ? JSON.parse(ld[1]) : {};
  } catch {
    /* address stays empty */
  }

  const movies = [];
  for (const block of chunks(html, /<div id="moviecin/g)) {
    const head = block.match(/<h3 class='movietitle[^']*'[^>]*>\s*<a[^>]*href='\/(?:films|movies)\/([^']+)'[^>]*>([\s\S]*?)<\/a>/);
    if (!head) continue;
    // "« Ga-neung-han Sa-rang » en coréen", or just "anglais" when the title is already the original.
    const other = text(block.match(/<span class='movietitleother'>([\s\S]*?)<\/span>/)?.[1]);
    const quoted = other.match(/[«"]\s*(.+?)\s*[»"]/)?.[1];
    const language = other.replace(/[«"].*?[»"]/, '').replace(/^\s*en\s+/, '').trim().toLowerCase();
    const genre = text(block.match(/<p class='moviegenre'>([\s\S]*?)<\/p>/)?.[1]?.replace(/<\/span>/g, '</span> '));
    const runtime = genre.match(/\b(?:(\d+)h)?(\d+)m\b/);
    const movie = {
      clockId: block.match(/\bmovie(\d+)"/)?.[1] || head[1],
      title: text(head[2]),
      originalTitle: quoted || null,
      originalLanguage: LANGUAGES[language] || null,
      year: Number(head[1].match(/-((19|20)\d{2})$/)?.[1] || genre.match(/\b(19|20)\d{2}\b/)?.[0]) || null,
      runtime: runtime ? Number(runtime[1] || 0) * 60 + Number(runtime[2]) : null,
      presentations: [],
    };
    for (const pres of chunks(block, /<div data-earliest-date="\d{8}" class="filall [^"]*">/g)) {
      const earliest = pres.match(/data-earliest-date="(\d{4})(\d{2})(\d{2})"/);
      const classes = pres.match(/class="filall ([^"]*)"/)[1].split(/\s+/);
      const lang = classes.find((c) => /^fi[efo]\d+$/.test(c))?.slice(0, 3) || 'fie';
      const notes = [...pres.matchAll(/<p class="timesalso[^"]*">([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).join(' · ');
      const ref = `${earliest[1]}-${earliest[2]}-${earliest[3]}`;
      const screenings = [];
      let date = ref;
      for (const m of pres.matchAll(/<span class="timesdate">([^<]+)<\/span>|data-time="(\d{3,4})"/g)) {
        if (m[1]) date = dateOf(m[1], ref) || date;
        else {
          const t = m[2].padStart(4, '0');
          screenings.push({ date, time: [Number(t.slice(0, 2)), Number(t.slice(2))] });
        }
      }
      const formats = detectFormats(notes, classes.includes('filimax') && 'IMAX', classes.includes('fil3d') && '3D');
      movie.presentations.push({ lang, notes, version: versionOf(lang, notes), formats, screenings });
    }
    movies.push(movie);
  }
  return { info, movies };
}

/**
 * @param theatres [{ slug, id, name, short, area, url }]: slug on cinemaclock.com, the rest as shown in the app.
 */
export function cinemaclockSource({ id, name, chain = null, cineplus = false, theatres }) {
  return {
    id,
    name,
    async fetch({ days, log }) {
      const first = todayYmd();
      const last = addDays(first, days - 1);
      const cinemas = [];
      const parsed = [];
      let failures = 0;
      for (const t of theatres) {
        try {
          const { info, movies } = parseTheatre(await getText(`${BASE}/movie-theaters/${t.slug}`));
          const a = info.address || {};
          cinemas.push({
            id: t.id,
            name: t.name,
            short: t.short,
            chain,
            area: t.area || a.addressLocality || null,
            address: [a.streetAddress, a.addressLocality].filter(Boolean).join(', ') || null,
            lat: Number(info.geo?.latitude) || undefined,
            lng: Number(info.geo?.longitude) || undefined,
            url: t.url || `${BASE}/movie-theaters/${t.slug}`,
            cineplus,
          });
          parsed.push({ t, movies });
          if (!movies.length) log(`${t.name}: aucune séance`);
        } catch (err) {
          failures++;
          log(`${t.name}: ${err.message}`);
        }
        await sleep(500);
      }
      if (failures === theatres.length) throw new Error('aucune salle lisible');

      // Québec cinemas list dubbed films under their French title; the same Cinemaclock movie is
      // listed under its original title wherever it plays in English. Pair them up for TMDB.
      const originals = new Map();
      for (const { movies } of parsed) {
        for (const m of movies) {
          if (m.presentations.some((p) => p.lang !== 'fif')) originals.set(m.clockId, m.originalTitle || m.title);
        }
      }

      const showtimes = [];
      for (const { t, movies } of parsed) {
        for (const m of movies) {
          const original = m.originalTitle || (originals.get(m.clockId) !== m.title ? originals.get(m.clockId) : null);
          const film = {
            title: m.title,
            originalTitle: original || null,
            originalLanguage: m.originalLanguage,
            year: m.year,
            runtime: m.runtime,
          };
          for (const p of m.presentations) {
            for (const s of p.screenings) {
              if (s.date < first || s.date > last) continue;
              showtimes.push({
                cinemaId: t.id,
                start: montrealIso(s.date, s.time),
                version: p.version,
                formats: p.formats,
                bookingUrl: t.url || `${BASE}/movie-theaters/${t.slug}`,
                film,
              });
            }
          }
        }
      }
      return { cinemas, showtimes };
    },
  };
}

const CINEPLEX = 'https://www.cineplex.com/theatre';

export const cineplex = cinemaclockSource({
  id: 'cineplex',
  name: 'Cineplex (via Cinemaclock)',
  chain: 'Cineplex',
  cineplus: true,
  theatres: [
    { slug: 'banque-scotia-montreal', id: 'cineplex-banque-scotia', name: 'Cinéma Banque Scotia Montréal', short: 'Banque Scotia', area: 'Centre-ville', url: `${CINEPLEX}/cinema-banque-scotia-montreal` },
    { slug: 'cineplex-forum-vip', id: 'cineplex-forum', name: 'Cinéma Cineplex Forum et VIP', short: 'Forum', area: 'Centre-ville', url: `${CINEPLEX}/cinema-cineplex-forum-et-vip` },
    { slug: 'cinema-cineplex-quartier-latin', id: 'cineplex-quartier-latin', name: 'Cinéma Cineplex Odeon Quartier Latin', short: 'Quartier Latin', area: 'Quartier latin', url: `${CINEPLEX}/cinema-cineplex-odeon-quartier-latin` },
    { slug: 'cineplex-royalmount', id: 'cineplex-royalmount', name: 'Cineplex Royalmount', short: 'Royalmount', area: 'Mont-Royal' },
    { slug: 'starcite-montreal', id: 'cineplex-starcite', name: 'Cinéma StarCité Montréal', short: 'StarCité', area: 'Hochelaga', url: `${CINEPLEX}/cinema-starcite-montreal` },
    { slug: 'carrefour-angrignon', id: 'cineplex-angrignon', name: 'Cinéma Famous Players Carrefour Angrignon', short: 'Angrignon', area: 'LaSalle', url: `${CINEPLEX}/cinema-famous-players-carrefour-angrignon` },
    { slug: 'cineplex-kirkland', id: 'cineplex-kirkland', name: 'Cinéma Cineplex Kirkland', short: 'Kirkland', area: 'Kirkland', url: `${CINEPLEX}/cinema-cineplex-kirkland` },
    { slug: 'cineplex-laval', id: 'cineplex-laval', name: 'Cinéma Cineplex Laval', short: 'Laval', area: 'Laval', url: `${CINEPLEX}/cinema-cineplex-laval` },
    { slug: 'cineplex-odeon-brossard-dix30-vip', id: 'cineplex-brossard', name: 'Cinéma Cineplex Odeon Brossard et VIP', short: 'Brossard', area: 'Brossard', url: `${CINEPLEX}/cinema-cineplex-odeon-brossard-et-vip` },
  ],
});

export const cinematheque = cinemaclockSource({
  id: 'cinematheque',
  name: 'Cinémathèque québécoise (via Cinemaclock)',
  theatres: [
    { slug: 'cinematheque-quebecoise', id: 'cinematheque-quebecoise', name: 'Cinémathèque québécoise', short: 'Cinémathèque', area: 'Quartier latin', url: 'https://www.cinematheque.qc.ca/fr/' },
  ],
});
