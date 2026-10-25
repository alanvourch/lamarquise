// Montréal wall-clock dates and times → ISO 8601 with the right offset (EDT -04:00 / EST -05:00).
const TZ = 'America/Toronto';
const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function wallClock(ms) {
  const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

function offsetMinutes(ms) {
  const w = wallClock(ms);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of the current day in Montréal. */
export function todayYmd(now = Date.now()) {
  const w = wallClock(now);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Parses "20 h 00", "20h00", "20:00", "2000", "9:30" → [hours, minutes]. */
export function parseTime(s) {
  const m = String(s).match(/(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] || 0)];
}

/**
 * Montréal local date + time → "2026-10-25T19:00:00-04:00".
 * Cinemas list after-midnight screenings under the evening they belong to, so hours before
 * 5 a.m. (or written as 24:30) are moved to the next calendar day.
 */
export function montrealIso(ymd, time) {
  let [h, mi] = Array.isArray(time) ? time : parseTime(time);
  let day = ymd;
  if (h >= 24 || h < 5) {
    h %= 24;
    day = addDays(ymd, 1);
  }
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let off = offsetMinutes(wall);
  const second = offsetMinutes(wall - off * 60_000);
  if (second !== off) off = second;
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return `${day}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const MONTHS = {
  jan: 1, janv: 1, janvier: 1, january: 1,
  feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, avril: 4, april: 4,
  may: 5, mai: 5,
  jun: 6, juin: 6, june: 6,
  jul: 7, juil: 7, juillet: 7, july: 7,
  aug: 8, aou: 8, aout: 8, august: 8,
  sep: 9, sept: 9, septembre: 9, september: 9,
  oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11,
  dec: 12, decembre: 12, december: 12,
};

export function monthNumber(name) {
  const key = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.$/, '');
  return MONTHS[key] || null;
}

/** Day and month without a year ("Lundi 2 nov.") → the closest such date to `ref`. */
export function nearestYmd(month, day, ref) {
  const refMs = Date.parse(ref);
  const year = Number(ref.slice(0, 4));
  let best = null;
  for (const y of [year - 1, year, year + 1]) {
    const ymd = `${y}-${pad(month)}-${pad(day)}`;
    if (!best || Math.abs(Date.parse(ymd) - refMs) < Math.abs(Date.parse(best) - refMs)) best = ymd;
  }
  return best;
}
