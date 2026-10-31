import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseStatus } from './time.js';

test('release badges cover the last seven days and all known future releases', () => {
  const today = '2026-11-02';
  assert.equal(releaseStatus('2026-10-26', today), null);
  assert.equal(releaseStatus('2026-10-27', today), 'Nouveau');
  assert.equal(releaseStatus(today, today), 'Nouveau');
  assert.equal(releaseStatus('2026-11-03', today), 'À venir');
  assert.equal(releaseStatus('2027-01-01', today), 'À venir');
  assert.equal(releaseStatus(undefined, today), null);
  assert.equal(releaseStatus('', today), null);
});
