// Each source returns { cinemas, showtimes } for the next `days` days:
//   cinema:   { id, name, short, chain, address, area, lat, lng, url, cineplus }
//   showtime: { cinemaId, start (ISO 8601 with offset), version ('VO'|'VOSTF'|'VOSTA'|'VF'|null),
//               formats: [], bookingUrl, price, film: { title, originalTitle, year, runtime,
//               directors, synopsis, poster, imdbId } }
// Adapters are added once each site has been checked against its live pages.
export default [];
