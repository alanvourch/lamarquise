// Just enough HTML handling for the cinema pages, without a parser dependency.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', ensp: ' ', emsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—',
  bull: '•', middot: '·', deg: '°', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â',
  auml: 'ä', ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ucirc: 'û', ugrave: 'ù', uuml: 'ü',
  oelig: 'œ', aelig: 'æ', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Ccedil: 'Ç', Ocirc: 'Ô', OElig: 'Œ',
};

export function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name] ?? m);
}

/** Visible text of an HTML fragment, on one line. */
export function text(html) {
  if (html == null) return '';
  return decodeEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li)>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[\s  ]+/g, ' ')
    .trim();
}

/** Value of an attribute in an opening tag (or any snippet containing it). */
export function attr(html, name) {
  const m = String(html).match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 's'));
  return m ? decodeEntities(m[2]) : null;
}

/** Splits `html` at every match of `re` (which must be global); each chunk starts at its match. */
export function chunks(html, re) {
  const starts = [...html.matchAll(re)].map((m) => m.index);
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
}

/** YouTube video id from any watch / share / embed URL. */
export function youtubeId(url) {
  return String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)?.[1] || null;
}
