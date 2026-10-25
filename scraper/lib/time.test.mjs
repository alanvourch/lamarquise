import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, montrealIso, nearestYmd, parseTime, todayYmd } from './time.mjs';

test('montrealIso uses the Montréal offset of that date', () => {
  assert.equal(montrealIso('2026-10-25', '19 h 00'), '2026-10-25T19:00:00-04:00');
  assert.equal(montrealIso('2026-11-02', '20h30'), '2026-11-02T20:30:00-05:00');
  assert.equal(montrealIso('2026-07-01', [13, 5]), '2026-07-01T13:05:00-04:00');
});

test('after-midnight screenings belong to the next calendar day', () => {
  assert.equal(montrealIso('2026-10-30', '00 h 30'), '2026-10-31T00:30:00-04:00');
  assert.equal(montrealIso('2026-10-30', [24, 15]), '2026-10-31T00:15:00-04:00');
});

test('parseTime reads the usual notations', () => {
  assert.deepEqual(parseTime('20 h 00'), [20, 0]);
  assert.deepEqual(parseTime('9:30'), [9, 30]);
  assert.deepEqual(parseTime('21h'), [21, 0]);
});

test('dates', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(todayYmd(Date.parse('2026-10-25T03:00:00Z')), '2026-10-24');
  assert.equal(nearestYmd(1, 3, '2026-12-28'), '2027-01-03');
  assert.equal(nearestYmd(10, 24, '2026-10-25'), '2026-10-24');
});
