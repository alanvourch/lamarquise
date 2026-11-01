import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cineplexPreview, resolveBookings } from './booking.mjs';

test('Cineplex redirect preserves the exact theatre, screening and D-BOX selection', () => {
  const redirect = 'https://apis.cineplex.com/prod/cpx/theatrical/deeplink?s=598047&a=1&l=9172&m=the-shining&ass=False';
  assert.equal(cineplexPreview(redirect), 'https://www.cineplex.com/ticketing/preview?theatreId=9172&showtimeId=598047&dbox=false');
  assert.equal(cineplexPreview(redirect, ['D-BOX']), 'https://www.cineplex.com/ticketing/preview?theatreId=9172&showtimeId=598047&dbox=true');
  for (const url of [null, '', 'https://example.com/?l=9172&s=598047', 'https://apis.cineplex.com/prod/cpx/theatrical/deeplink?s=598047']) {
    assert.equal(cineplexPreview(url), null);
  }
});

test('ticket resolution caches redirects, preserves formats and falls back on failures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'montreel-booking-'));
  try {
    const ticket = 'https://www.cinemaclock.com/buy-tickets/tix123';
    const unavailable = 'https://www.cinemaclock.com/buy-tickets/tix456';
    const cachePath = join(dir, 'links.json');
    let calls = 0;
    const loadRedirect = async (url) => {
      calls++;
      if (url === unavailable) throw new Error('unavailable');
      return 'https://apis.cineplex.com/prod/cpx/theatrical/deeplink?s=598047&l=9172';
    };
    const rows = [{ bookingUrl: ticket }, { bookingUrl: ticket, formats: ['D-BOX'] }, { bookingUrl: unavailable }, { bookingUrl: 'https://cinemapublic.ca/film' }];
    await resolveBookings(rows, { cachePath, loadRedirect });
    assert.equal(calls, 2);
    assert.match(rows[0].bookingUrl, /showtimeId=598047&dbox=false$/);
    assert.match(rows[1].bookingUrl, /showtimeId=598047&dbox=true$/);
    assert.equal(rows[2].bookingUrl, unavailable);
    assert.equal(rows[3].bookingUrl, 'https://cinemapublic.ca/film');
    await resolveBookings([{ bookingUrl: ticket }], { cachePath, loadRedirect });
    assert.equal(calls, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
