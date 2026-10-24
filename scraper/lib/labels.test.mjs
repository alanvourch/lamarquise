import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, detectFormats, normalizeVersion, titleKey } from './labels.mjs';

test('normalizeVersion understands Québec labels', () => {
  const cases = {
    VOSTF: ['VOSTF', 'V.O.S.T.F.', 'VOSTFR', 'v.o. s.-t.f.', 'Sous-titres français', 'Original version with French subtitles', 's.-t. bilingues'],
    VOSTA: ['VOSTA', 'v.o.s.t.a.', 'English subtitles', 'Sous-titres anglais', 'STA'],
    VF: ['VF', 'V.F.', 'Version française', 'French version', 'doublé'],
    VO: ['VO', 'VOA', 'V.O.A.', 'Version originale anglaise', 'Original version', 'English'],
  };
  for (const [expected, labels] of Object.entries(cases)) {
    for (const label of labels) assert.equal(normalizeVersion(label), expected, label);
  }
  assert.equal(normalizeVersion(''), null);
  assert.equal(normalizeVersion('Projection spéciale'), null);
});

test('detectFormats', () => {
  assert.deepEqual(detectFormats('IMAX 3D'), ['IMAX', '3D']);
  assert.deepEqual(detectFormats('Copie 35 mm'), ['35mm']);
  assert.deepEqual(detectFormats('UltraAVX', 'D-BOX'), ['D-BOX', 'UltraAVX']);
  assert.deepEqual(detectFormats('Régulier'), []);
});

test('cleanTitle strips version and format suffixes', () => {
  assert.deepEqual(cleanTitle('Dune : deuxième partie (VF)'), { title: 'Dune : deuxième partie', year: null });
  assert.deepEqual(cleanTitle('Nosferatu (1922)'), { title: 'Nosferatu', year: 1922 });
  assert.deepEqual(cleanTitle('Sinners IMAX'), { title: 'Sinners', year: null });
  assert.deepEqual(cleanTitle('Oppenheimer - 70mm'), { title: 'Oppenheimer', year: null });
  assert.deepEqual(cleanTitle('Amélie (Version originale française)'), { title: 'Amélie', year: null });
  assert.deepEqual(cleanTitle('3 Days of the Condor'), { title: '3 Days of the Condor', year: null });
});

test('titleKey merges spelling variants', () => {
  assert.equal(titleKey('Le Robot sauvage'), titleKey('robot sauvage'));
  assert.equal(titleKey("L'Étranger"), titleKey('Etranger'));
  assert.equal(titleKey('The Brutalist'), 'brutalist');
});
