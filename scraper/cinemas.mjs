// Hand-kept details the sources don't publish in a usable form, merged over each source's cinema record.
// prices.adult = regular adult ticket, taxes included; note = discount days. Fill from each cinema's pricing page.
// Checked October 2026. Cineplex prices vary by screen (the app shows the CinéPlus price instead);
// the Cinémathèque's site could not be read from the collector.
const CINEMA_CINEMA = { adult: 16.25, note: '9 $ le mardi' }; // cinemacinema.ca/fr/tarifs

export const CINEMA_EXTRAS = {
  'cinema-beaubien': { prices: CINEMA_CINEMA },
  'cinema-du-parc': { prices: CINEMA_CINEMA },
  'cinema-du-musee': { prices: CINEMA_CINEMA },
  // cinemamoderne.com/infos-pratiques: 13,67 $ + taxes (11,92 $ before 4 p.m. on weekdays), plus a service fee.
  'cinema-moderne': { prices: { adult: 15.72, note: '13,71 $ en semaine avant 16 h, + frais de service' } },
  // cinemapublic.ca/tarifs-et-cine-cartes
  'cinema-public-casa-ditalia': { prices: { adult: 12, note: '10 $ étudiants et 65 ans et plus' } },
  'cinema-public-livart': { prices: { adult: 12, note: '10 $ étudiants et 65 ans et plus' } },
  // cinemasguzzo.com/5-tarifs-mega-plex-terrebonne-14.html
  'guzzo-mega-plex-terrebonne-14': { prices: { adult: 16, note: '9 $ le mardi et avant 18 h, 3D + 3 $' } },
};
