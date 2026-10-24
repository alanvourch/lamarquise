// All times are shown in Montréal time, whatever the device's timezone.
export const TZ = 'America/Toronto';

// A "ciné-day" runs from 4:00 to 3:59: a 00:30 screening belongs to the previous evening.
const CUTOFF_HOURS = 4;

const pad = (n) => String(n).padStart(2, '0');

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function localParts(date) {
  const p = {};
  for (const { type, value } of partsFmt.formatToParts(date)) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

export function dayKey(date) {
  const p = localParts(new Date(date.getTime() - CUTOFF_HOURS * 3600_000));
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

// Minutes since midnight of the ciné-day (01:00 → 25 * 60).
export function cineMinutes(date) {
  const { h, mi } = localParts(date);
  return (h < CUTOFF_HOURS ? h + 24 : h) * 60 + mi;
}

export function formatTime(date) {
  const { h, mi } = localParts(date);
  return `${pad(h)}:${pad(mi)}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const keyToDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const weekdayFmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('fr-CA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function dayLabel(key, todayKey) {
  if (key === todayKey) return "Aujourd'hui";
  if (key === addDays(todayKey, 1)) return 'Demain';
  const date = keyToDate(key);
  return `${weekdayFmt.format(date)} ${date.getUTCDate()}`;
}

export function shortDayLabel(key, todayKey) {
  if (key === todayKey) return 'auj.';
  if (key === addDays(todayKey, 1)) return 'dem.';
  return weekdayFmt.format(keyToDate(key));
}

export function longDayLabel(key) {
  const s = longFmt.format(keyToDate(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${pad(m)}` : `${m} min`;
}

export function untilLabel(ts, nowTs) {
  const min = Math.round((ts - nowTs) / 60_000);
  if (min < -2) return 'commencé';
  if (min <= 0) return 'maintenant';
  if (min < 60) return `dans ${min} min`;
  if (min < 180) return `dans ${Math.floor(min / 60)} h ${pad(min % 60)}`;
  return null;
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  return `${longDayLabel(dayKey(date))} à ${formatTime(date)}`;
}
