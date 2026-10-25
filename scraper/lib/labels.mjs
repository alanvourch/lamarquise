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
  ['VOSTF', /\b(vostf|vostfr|vost fr|vo st fr|vostfa|stf|s t f|(s t|st) (fr|francais|bilingues?)|sous titres? (en )?francais|sous titres? bilingues?|french subtitles|french and english subtitles|bilingual subtitles|fr subt)\b/],
  ['VOSTA', /\b(vosta|vostang|vost ang|vost en|sta|s t a|(s t|st) (ang|anglais|en)|sous titres? (en )?anglais|english subtitles|eng subs?|eng subt|subtitled in english)\b/],
  ['VF', /\b(vf|vfq|version francaise|french version|en francais|doublee?|dubbed in french)\b/],
  ['VO', /\b(vo|voa|vof|voan|version originale( anglaise| francaise)?|original version|original language|en anglais|english)\b/],
];

// Whole-label acronyms, compared with every dot and space removed ("V.O.S.T.F." → "vostf").
const ACRONYMS = {
  vostf: 'VOSTF', vostfr: 'VOSTF', vostfa: 'VOSTF', stf: 'VOSTF', voastf: 'VOSTF',
  vosta: 'VOSTA', vostang: 'VOSTA', sta: 'VOSTA', vofsta: 'VOSTA',
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
  ['16mm', /\b16 ?mm\b/],
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
  /\s+v\.f\.?$/i,
  // Programming tags: "[DERNIÈRE SÉANCE]", ": 40e anniversaire", "- Ciné-tricot", "(ciné-rencontre)".
  /\s*\[[^\]]*\]/g,
  /\s*[-–—:]\s*\d+\s*(e|ème|eme|th)\s+anniversaire.*$/i,
  /\s*[-–—(]\s*cin[ée][- ](club|rencontre|tricot|conférence|conference|causerie|discussion)s?\)?\s*$/i,
  /\s+[-–—]\s+coups? de c(œ|oe)ur.*$/i,
  // Film-club numbering in front: "QCC #30: What Ever Happened to Baby Jane?".
  /^[\p{L}]{2,12}\s*#\d+\s*[:\-–—]\s*/u,
];

const SMALL_WORDS = new Set(
  'a à au aux d de des du en et l la le les ou par pour sur un une and at for in of on or the to with'.split(' '),
);

/** "LA MEILLEURE FAÇON, C'EST PAR ACCIDENT" → "La meilleure façon, c'est par accident". Mixed case is kept. */
export function smartCase(title) {
  const s = String(title || '');
  if (!s || s !== s.toUpperCase() || !/[A-ZÀ-Ý]{2}/.test(s)) return s;
  const lower = s.toLowerCase();
  // French titles take sentence case; English ones get capitalized words.
  const french = /[àâçéèêëîïôûùœ]|\b(le|la|les|des|du|une?|l'|d'|c'est|et)\b/.test(lower);
  let first = true;
  return lower.replace(/[\p{L}\d]+/gu, (word, idx) => {
    const after = lower[idx - 1];
    const startsPart = first || /[:.!?]\s*$/.test(lower.slice(0, idx));
    first = false;
    if (after === "'" || after === '’') return word;
    if (startsPart || (!french && !SMALL_WORDS.has(word))) return word[0].toUpperCase() + word.slice(1);
    return word;
  });
}

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
// Leading articles and "&" / "et" / "and" are dropped: "Les minions & les monstres" = "Minions et les monstres".
export function titleKey(title) {
  return strip(String(title).replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').replace(/Æ/g, 'Ae'))
    .replace(/^(the|le|la|les|l) /, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/(^| )(et|and)(?= |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
