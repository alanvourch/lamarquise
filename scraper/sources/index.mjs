// Each source returns { cinemas, showtimes } for the next `days` days:
//   cinema:   { id, name, short, chain, address, area, lat, lng, url, cineplus }
//   showtime: { cinemaId, start (ISO 8601 with offset), version ('VO'|'VOSTF'|'VOSTA'|'VF'|null),
//               formats: [], bookingUrl, price, film: { title, originalTitle, year, runtime,
//               directors, synopsis, poster, imdbId } }
// Adapters are added once each site has been checked against its live pages.
import cinemacinema from './cinemacinema.mjs';
import { cinematheque, cineplex } from './cinemaclock.mjs';
import guzzo from './guzzo.mjs';
import moderne from './moderne.mjs';
import publicCinema from './public.mjs';

export default [cineplex, cinemacinema, moderne, publicCinema, cinematheque, guzzo];
