// Parsers checked against trimmed copies of the live markup (October 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unflatten } from '../lib/devalue.mjs';
import { parseTheatre, versionOf } from './cinemaclock.mjs';
import { daysMatching, parseSchedule, weekDates } from './guzzo.mjs';
import { parseMonth } from './moderne.mjs';
import { parseFilmPage } from './public.mjs';

test('devalue payloads', () => {
  assert.deepEqual(unflatten([{ a: 1, b: 2 }, 'x', [3, 1], 7]), { a: 'x', b: [7, 'x'] });
});

test('Cinéma Moderne calendar', () => {
  const html = `
    <div class="cm-Cal__day" data-day="2026-10-30"><div class="cm-Cal__day__body">
      <div class="cm-Cal__day__event"><div class="cm-Cal__day__event__title">
        <a href="https://www.cinemamoderne.com/films/details/the-fly-40e-anniversaire/">
          <span class="cm-Fat">19:30</span>
          <br>
          The Fly: 40e anniversaire  (VOA)    </a></div>
        <div class="cm-Cal__day__event__card"><a class="cm-Card__image lazy" data-bg="https://x/fly.jpg"></a>
          <div class='cm-List cm-List--horizontal' data-sep='/'><span class='cm-List__item'><span>David Cronenberg</span></span><span class='cm-List__item'><span>États-Unis</span></span><span class='cm-List__item'><span>1986</span></span><span class='cm-List__item'><span>96 minutes</span></span><span class='cm-List__item'><span>35mm</span></span></div>
          <a class="cm-CTA cm-CTA--red" target="_blank" href="https://cinemamoderne.ticketacces.net/fr/x?EvenementID=1">Billetterie</a>
        </div></div></div></div>`;
  const [e] = parseMonth(html);
  assert.equal(e.date, '2026-10-30');
  assert.equal(e.time, '19:30');
  assert.equal(e.title, 'The Fly: 40e anniversaire');
  assert.equal(e.version, 'VO');
  assert.deepEqual(e.directors, ['David Cronenberg']);
  assert.equal(e.year, 1986);
  assert.equal(e.runtime, 96);
  assert.deepEqual(e.formats, ['35mm']);
  assert.match(e.bookingUrl, /EvenementID=1/);
});

test('Cinéma Public film page', () => {
  const html = `
    <h1 class="hero-title hero-title--long">Ha-Chan, Shake Your Booty!</h1>
    <p class="film-meta">Josef Kubota Wladyka<br>2026&nbsp;-&nbsp;Drame&nbsp;-&nbsp;122 min</p>
    <ul class="vedette-seances mb-3">
      <li class="vedette-seances-single mb-3 d-flex" data-address="casa-d-italia"><div class="w-50"><span class="vedette-seances-time">Dimanche 25 Oct<br />15h00</span><span class="vedette-seances-subtitles"> - STA</span></div><div><a href="https://cinemapublic.ticketacces.net/fr/organisation/achat/index.cfm?RepresentationID=94714">Billetterie</a></div></li>
      <li class="vedette-seances-single mb-3 d-flex" data-address="livart"><div class="w-50"><span class="vedette-seances-time">Lundi 2 Nov<br />20h30</span></div></li>
    </ul>`;
  const { film, screenings } = parseFilmPage(html, '2026-10-24');
  assert.equal(film.title, 'Ha-Chan, Shake Your Booty!');
  assert.equal(film.year, 2026);
  assert.equal(film.runtime, 122);
  assert.deepEqual(film.directors, ['Josef Kubota Wladyka']);
  assert.deepEqual(screenings[0], {
    venue: 'casa-d-italia',
    date: '2026-10-25',
    time: [15, 0],
    version: 'VOSTA',
    bookingUrl: 'https://cinemapublic.ticketacces.net/fr/organisation/achat/index.cfm?RepresentationID=94714',
  });
  assert.equal(screenings[1].venue, 'livart');
  assert.equal(screenings[1].date, '2026-11-02');
  assert.equal(screenings[1].version, 'VO');
});

test('Guzzo weekly schedule', () => {
  assert.deepEqual(weekDates('23 au 29 oct. 2026'), [
    '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
  ]);
  assert.equal(weekDates('30 oct. au 5 nov. 2026').length, 7);
  assert.deepEqual(weekDates('26 déc. au 1 janv. 2027')[0], '2026-12-26');
  const week = weekDates('23 au 29 oct. 2026');
  assert.deepEqual(daysMatching('Lundi, Mercredi, Jeudi', week), ['2026-10-26', '2026-10-28', '2026-10-29']);
  assert.deepEqual(daysMatching('Lundi au Mercredi', week), ['2026-10-26', '2026-10-27', '2026-10-28']);
  assert.equal(daysMatching('Tous les jours', week).length, 7);

  const html = `
    <a href="5-cinemas-horaire-mega-plex-terrebonne-14.html" class="actif">Horaire du
      23 au 29 oct. 2026 </a>
    <div class="listing hoverFilm"><div class="info">
      <h2><a href="9536-bande-annonce-gueule-d-argile.html">Gueule D'argile </a></h2>
      <p class="fontBleu"><b>Vendredi, Samedi&nbsp;: </b></p>
      <p>13:05:15:10</p>
      <p><strong>Version anglaise</strong></p>
      <p class="fontBleu"><b>Lundi&nbsp;: </b></p>
      <p>19:15-21:25</p>
    </div></div>`;
  const { films } = parseSchedule(html);
  assert.equal(films[0].title, "Gueule D'argile");
  assert.deepEqual(
    films[0].screenings.map((s) => `${s.date} ${s.time} ${s.version}`),
    ['2026-10-23 13:05 VF', '2026-10-23 15:10 VF', '2026-10-24 13:05 VF', '2026-10-24 15:10 VF', '2026-10-26 19:15 VO', '2026-10-26 21:25 VO'],
  );
});

test('Cinemaclock versions', () => {
  assert.equal(versionOf('fie', 'Salle régulière avec s.-t. fr.'), 'VOSTF');
  assert.equal(versionOf('fio', 'avec s.-t. en anglais et en chinois'), 'VOSTA');
  assert.equal(versionOf('fie', 'with Eng. subt.'), 'VOSTA');
  assert.equal(versionOf('fif', 'Salle régulière'), 'VF');
  assert.equal(versionOf('fie', 'Salle régulière • Version 3D'), 'VO');
});

test('Cinemaclock theatre page', () => {
  const html = `<div id="moviecin10294clayface2026" class="showtimeblock movie today cin10294 movie277252"><div class='movieblock'><div id='md277252' class='moviedesc'><h3 class='movietitle short' data-sort='clayface2026'><a class='okienko' href='/films/clayface-2026'>Gueule d&apos;argile</a></h3><span class='movietitleother'><i class='subt'>anglais</i><!-- FRTITLE --></span><p class='moviegenre'><span class='rtQC'>13+</span><!-- Y:0 -->1h48m &nbsp;&nbsp; Horreur</p></div></div>
    <div data-earliest-date="20261024" class="filall fil2d filimax fil1000010 fif277252"><p class="timesalso"> Écran IMAX </p><p class="times"><u>Aujourd'hui <span class="timesdate">24 oct.</span></u><i><span class="tix tod" data-time="1910">19 h 10</span></i></p><p class="timesother"><s><u>Dim <span class="timesdate">25 oct.</span></u><i><span class="tix" data-time="1310">13 h 10</span><span class="tix" data-time="2200">22 h 00</span></i></s></p></div><!-- endsb --></div>`;
  const [m] = parseTheatre(html).movies;
  assert.equal(m.clockId, '277252');
  assert.equal(m.title, "Gueule d'argile");
  assert.equal(m.originalLanguage, 'en');
  assert.equal(m.year, 2026);
  assert.equal(m.runtime, 108);
  const [p] = m.presentations;
  assert.equal(p.version, 'VF');
  assert.deepEqual(p.formats, ['IMAX']);
  assert.deepEqual(p.screenings, [
    { date: '2026-10-24', time: [19, 10] },
    { date: '2026-10-25', time: [13, 10] },
    { date: '2026-10-25', time: [22, 0] },
  ]);
});
