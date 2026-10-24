import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { request } from '../lib/http.mjs';
import { CACHE_DIR } from '../lib/cache.mjs';

// IMDb's official daily dump (personal / non-commercial use): tconst, averageRating, numVotes.
const RATINGS_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const FILE = join(CACHE_DIR, 'title.ratings.tsv.gz');
const MAX_AGE = 20 * 3600_000;

async function ensureDownloaded() {
  try {
    if (Date.now() - (await stat(FILE)).mtimeMs < MAX_AGE) return;
  } catch {
    /* not downloaded yet */
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const res = await request(RATINGS_URL, { timeoutMs: 120_000 });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(FILE));
}

/** @returns Map(imdbId → { rating, votes }) for the requested ids only */
export async function imdbRatings(ids) {
  const wanted = new Set(ids);
  const out = new Map();
  if (!wanted.size) return out;
  await ensureDownloaded();
  const lines = createInterface({ input: createReadStream(FILE).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    const tab = line.indexOf('\t');
    const id = line.slice(0, tab);
    if (!wanted.has(id)) continue;
    const [, rating, votes] = line.split('\t');
    out.set(id, { rating: Number(rating), votes: Number(votes) });
    if (out.size === wanted.size) break;
  }
  return out;
}
