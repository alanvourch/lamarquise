const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function request(url, { headers = {}, retries = 2, timeoutMs = 20_000, ...init } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': UA, 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${url}`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${url}`);
        err.status = res.status;
        err.fatal = true;
        throw err;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (err.fatal) break;
      await sleep(800 * 2 ** attempt);
    }
  }
  throw lastError;
}

export const getText = async (url, opts) => (await request(url, opts)).text();
export const getJson = async (url, opts) =>
  (await request(url, { ...opts, headers: { accept: 'application/json', ...opts?.headers } })).json();

// Runs fn over items with at most `limit` in flight (polite to small cinema sites and to TMDB).
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
