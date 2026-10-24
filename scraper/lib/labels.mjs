// Normalizes the many ways Montréal cinemas label language versions and formats.
//
// Versions used in the app:
//   VO    original language, no subtitles (VOA = English original, VOF = French original)
//   VOSTF original language, French subtitles (bilingual subtitles count as French)
//   VOSTA original language, English subtitles
//   VF    French version (dubbed)

const strip = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\-–_/'’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const RULES = [
  ['VOSTF', /\b(vostf|vostfr|vost fr|vo st fr|vostfa|stf|s t f|(s t|st) (fr|francais|bilingues?)|sous titres? (en )?francais|sous titres? bilingues?|french subtitles|french and english subtitles|bilingual subtitles)\b/],
  ['VOSTA', /\b(vosta|vostang|vost ang|vost en|sta|s t a|(s t|st) (ang|anglais|en)|sous titres? (en )?anglais|english subtitles|eng subs?|subtitled in english)\b/],
  ['VF', /\b(vf|vfq|version francaise|french version|en francais|doublee?|dubbed in french)\b/],
  ['VO', /\b(vo|voa|vof|voan|version originale( anglaise| francaise)?|original version|original language|en anglais|english)\b/],
];

// Whole-label acronyms, compared with every dot and space removed ("V.O.S.T.F." → "vostf").
const ACRONYMS = {
  vostf: 'VOSTF', vostfr: 'VOSTF', vostfa: 'VOSTF', stf: 'VOSTF',
  vosta: 'VOSTA', vostang: 'VOSTA', sta: 'VOSTA',
  vf: 'VF', vfq: 'VF',
  vo: 'VO', voa: 'VO', vof: 'VO', voan: 'VO',
};

export function normalizeVersion(label) {
  if (!label) return null;
  const s = strip(String(label));
  const acronym = ACRONYMS[s.replace(/[^a-z0-9]/g, '')];
  if (acronym) return acronym;
  for (const [version, re] of RULES) if (re.test(s)) return version;
  return null;
}

const FORMATS = [
  ['IMAX', /\bimax\b/],
  ['3D', /\b3 ?d\b/],
  ['4DX', /\b4 ?dx\b/],
  ['D-BOX', /\bd ?box\b/],
  ['UltraAVX', /\bultra ?avx\b/],
  ['VIP', /\bvip\b/],
  ['ScreenX', /\bscreen ?x\b/],
  ['Dolby', /\bdolby (cinema|atmos)\b/],
  ['70mm', /\b70 ?mm\b/],
  ['35mm', /\b35 ?mm\b/],
];

export function detectFormats(...labels) {
  const s = strip(labels.filter(Boolean).join(' '));
  return FORMATS.filter(([, re]) => re.test(s)).map(([f]) => f);
}

// Suffixes cinemas glue onto titles: "Dune (VF)", "Nosferatu - 35mm", "Alien IMAX 3D".
const TITLE_NOISE = [
  /\s*[([]\s*(v\.?\s?o\.?\s?s\.?\s?t\.?\s?[fa]\.?|v\.?\s?f\.?|v\.?\s?o\.?\s?[af]?\.?|version (originale|française|francaise)[^)\]]*|st[fa]|s\.-t\.[^)\]]*|sous-titres?[^)\]]*|english[^)\]]*|french[^)\]]*)\s*[)\]]/gi,
  /\s+[-–—:]\s*(version (originale|française|francaise).*|v\.?f\.?|vostf|vosta|voa)$/i,
  /\s*[-–—:]?\s*\b(imax|3d|4dx|d-box|ultraavx|screenx|70\s?mm|35\s?mm)\b(\s+(imax|3d|4dx|d-box|ultraavx|screenx))*\s*$/gi,
  /\s*[([]\s*(imax|3d|4dx|d-box|ultraavx|screenx|70\s?mm|35\s?mm)( ?(et|and|&|\/) ?(imax|3d))?\s*[)\]]/gi,
];

export function cleanTitle(raw) {
  let title = String(raw || '').replace(/\s+/g, ' ').trim();
  let year = null;
  const y = title.match(/\s*\((19|20)\d{2}\)\s*$/);
  if (y) {
    year = Number(y[0].replace(/\D/g, ''));
    title = title.slice(0, y.index);
  }
  for (const re of TITLE_NOISE) title = title.replace(re, '');
  return { title: title.trim(), year };
}

// Key used to merge the same film across sources before TMDB matching.
export function titleKey(title) {
  return strip(title)
    .replace(/^(the|le|la|les|l ) ?/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
