import { join } from 'node:path';
import { CACHE_DIR, readJson, writeJson } from './cache.mjs';
import { mapLimit, request } from './http.mjs';

const CACHE = join(CACHE_DIR, 'ticket-links.json');
const CLOCK = 'https://www.cinemaclock.com';

export function cineplexPreview(location, formats = []) {
  let url;
  try { url = new URL(location); } catch { return null; }
  if (url.hostname !== 'apis.cineplex.com' || url.pathname !== '/prod/cpx/theatrical/deeplink') return null;
  const theatre = url.searchParams.get('l');
  const showtime = url.searchParams.get('s');
  if (!/^\d+$/.test(theatre || '') || !/^\d+$/.test(showtime || '')) return null;
  return `https://www.cineplex.com/ticketing/preview?theatreId=${theatre}&showtimeId=${showtime}&dbox=${formats.includes('D-BOX')}`;
}

// Resolve only CinemaClock's redirect, without downloading a ticketing page or starting a cart.
export async function resolveBookings(showtimes, { log = () => {}, loadRedirect, cachePath = CACHE } = {}) {
  const cache = await readJson(cachePath, {});
  const urls = [...new Set(showtimes.map((s) => s.bookingUrl).filter((u) => u?.startsWith(`${CLOCK}/buy-tickets/tix`)))];
  let failures = 0;
  await mapLimit(urls, 4, async (url) => {
    if (cache[url]) return;
    try {
      const location = loadRedirect ? await loadRedirect(url) : (await request(url, {
        redirect: 'manual', acceptedStatuses: [301, 302, 303, 307, 308], retries: 0, timeoutMs: 8000,
      })).headers.get('location');
      if (cineplexPreview(location)) cache[url] = location;
    } catch { failures++; }
  });
  for (const s of showtimes) {
    s.bookingUrl = cineplexPreview(cache[s.bookingUrl], s.formats) || s.bookingUrl;
  }
  // Ticket IDs are unique to a dated screening; discard entries no longer in this collection.
  await writeJson(cachePath, Object.fromEntries(urls.filter((u) => cache[u]).map((u) => [u, cache[u]])));
  if (failures) log(`${failures} liens de réservation non résolus : redirection CinemaClock conservée`);
  return showtimes;
}
