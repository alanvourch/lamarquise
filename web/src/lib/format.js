export function formatVotes(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 10_000) return `${Math.round(n / 1000)} k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')} k`;
  return String(n);
}

export function formatRating(r) {
  return r == null ? null : r.toFixed(1).replace('.', ',');
}

const priceFmt = (digits) =>
  new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const PRICE_INT = priceFmt(0);
const PRICE_DEC = priceFmt(2);

export function formatPrice(amount) {
  if (amount == null) return null;
  return (Number.isInteger(amount) ? PRICE_INT : PRICE_DEC).format(amount);
}

const TMDB_IMG = 'https://image.tmdb.org/t/p';

// Posters are stored as TMDB paths ("/abc.jpg") or full URLs from the cinema sites.
export function img(path, size = 'w342') {
  if (!path) return null;
  return path.startsWith('http') ? path : `${TMDB_IMG}/${size}${path}`;
}

export function normalizeText(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
