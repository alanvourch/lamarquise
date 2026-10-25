// Decodes SvelteKit's `__data.json` payloads, which use the "devalue" flat format:
// one array of values where objects and arrays hold indexes into that same array.
const SPECIAL = { '-1': undefined, '-3': NaN, '-4': Infinity, '-5': -Infinity, '-6': -0 };

export function unflatten(values) {
  const done = new Map();
  const hydrate = (i) => {
    if (i in SPECIAL) return SPECIAL[i];
    if (done.has(i)) return done.get(i);
    const v = values[i];
    if (v === null || typeof v !== 'object') return done.set(i, v), v;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') {
        if (v[0] === 'Date') return done.set(i, new Date(v[1])), done.get(i);
        if (v[0] === 'Set') return done.set(i, new Set(v.slice(1).map(hydrate))), done.get(i);
        if (v[0] === 'Map') {
          const m = new Map();
          done.set(i, m);
          for (let j = 1; j < v.length; j += 2) m.set(hydrate(v[j]), hydrate(v[j + 1]));
          return m;
        }
        if (v[0] === 'null') {
          const o = Object.create(null);
          done.set(i, o);
          for (let j = 1; j < v.length; j += 2) o[v[j]] = hydrate(v[j + 1]);
          return o;
        }
      }
      const a = new Array(v.length);
      done.set(i, a);
      v.forEach((x, j) => x !== -2 && (a[j] = hydrate(x)));
      return a;
    }
    const o = {};
    done.set(i, o);
    for (const k of Object.keys(v)) o[k] = hydrate(v[k]);
    return o;
  };
  return hydrate(0);
}

/** Data of the page's own load function (the last node; the others are layouts). */
export function pageData(payload) {
  const nodes = (payload.nodes || []).filter((n) => n?.type === 'data');
  if (!nodes.length) throw new Error('réponse SvelteKit sans données');
  return unflatten(nodes.at(-1).data);
}

export function layoutData(payload, index) {
  const node = payload.nodes?.[index];
  return node?.type === 'data' ? unflatten(node.data) : null;
}
