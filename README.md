# MontReel — les séances de Montréal

Une app web (installable sur téléphone) qui rassemble les séances de **tous les cinémas de Montréal** au même endroit, dans l'esprit de LaBobine à Paris.

- **Films du jour, de demain ou des 7 prochains jours**, avec affiches, synopsis et bande-annonce
- **Note IMDb et nombre de votes** sur chaque film
- **Version de chaque séance : VO, VOSTF, VOSTA, VF.** Un film québécois en français compte comme VO *et* comme VF.
- Tri : prochaine séance, note IMDb, popularité, nombre de séances, nouveautés, titre, durée
- Filtres : mes cinémas favoris ★, version, « dès 19 h », note minimale, genre, ma liste ♥, recherche (titre, réalisateur, acteur)
- 3 vues : **Films** (grille d'affiches), **Séances** (liste chronologique, « que voir dans l'heure ? »), **Cinémas** (programme par salle)
- Films affichés sous leur **titre et affiche en VO** (le titre français reste sur la fiche et dans la recherche)
- Prix de la place, et **prix membre CinéPlus** sur les salles Cineplex (réglage) : 11 $, 16 $ en UltraAVX, « 11 $ + » pour les autres salles premium (`CINEPLUS_PRICES` dans `web/src/lib/filters.js`)
- Lien de réservation sur chaque séance, liens IMDb et Letterboxd (films et réalisateurs)
- Partage d'un film par un lien qui s'affiche avec son affiche et ses séances (une page par film générée au build, `web/scripts/film-pages.mjs`)
- Favoris et réglages enregistrés dans le navigateur, thème clair ou sombre selon le téléphone

## Comment ça marche

```
GitHub Actions, 2 fois par jour
  └─ scraper/index.mjs
       ├─ sources/*        une source par cinéma ou réseau → séances brutes
       ├─ lib/labels.mjs   normalise « V.O.S.T.F. », « s.-t. bilingues », « IMAX 3D »…
       ├─ enrich/tmdb.mjs  titre québécois, affiche, synopsis FR, bande-annonce, id IMDb
       ├─ enrich/imdb.mjs  note + votes (dump officiel quotidien d'IMDb)
       └─ web/public/data/showtimes.json
  └─ web/ (React + Vite) → site statique publié sur Vercel (montreel.vercel.app)
```

Pas de serveur ni de base de données : un fichier JSON régénéré chaque matin, servi par un site statique. Si une source tombe en panne, ses séances de la veille sont conservées jusqu'à la prochaine collecte réussie.

## Sources

| Cinémas | Source | État |
| --- | --- | --- |
| Cineplex : Banque Scotia, Forum, Quartier Latin, Royalmount, StarCité, Angrignon, Kirkland, Laval, Brossard | Cinemaclock | branché |
| Cinéma du Parc, Cinéma du Musée, Cinéma Beaubien | cinemacinema.ca (données JSON des pages) | branché |
| Cinéma Moderne | cinemamoderne.com (calendrier mensuel) | branché |
| Cinéma Public (Casa d'Italia, Livart) | cinemapublic.ca (fiches films) | branché |
| Cinémathèque québécoise | Cinemaclock | branché |
| Guzzo (Méga-Plex Terrebonne 14, la seule salle encore sur leur site) | cinemasguzzo.com (horaire de la semaine) | branché |
| Les autres salles | Cinemaclock, en complément | à ajouter (une ligne par salle) |

Cineplex et la Cinémathèque passent par Cinemaclock : le `robots.txt` de cineplex.com interdit tous les robots (`Disallow: /`), et cinematheque.qc.ca renvoie un défi Cloudflare aux serveurs. Cinemaclock autorise la collecte et donne pour chaque séance la langue, les sous-titres et l'écran (IMAX, UltraAVX, D-BOX, VIP…). Pour ajouter une salle, il suffit d'une ligne dans `scraper/sources/cinemaclock.mjs` avec son identifiant Cinemaclock (`cinemaclock.com/movie-theaters/<identifiant>`).

Chaque source est un module de `scraper/sources/` qui renvoie `{ cinemas, showtimes }` (contrat détaillé dans `scraper/sources/index.mjs`). Les prix des salles indépendantes se renseignent dans `scraper/cinemas.mjs`. Si un film est mal reconnu par TMDB, on force la correspondance dans `scraper/overrides.json` (`"titre normalisé": idTMDB`).

Pour reconnaître les films, la collecte croise les titres : « Raison et sentiments » chez Guzzo (sans année) rejoint « Raison et sentiments » [Sense and Sensibility, 2026] chez Cineplex, les copies d'un même film à Beaubien et au Parc sont reliées, et une correspondance TMDB dont le réalisateur ne colle pas est écartée (homonymes). `node scraper/index.mjs moderne public` ne recollecte que ces sources ; les autres gardent leurs séances de la veille.

## En local

```bash
cd web && npm install && cd ..
TMDB_API_KEY=xxxx npm run scrape   # écrit web/public/data/showtimes.json
npm run dev                        # http://localhost:5173
npm test                           # tests (parseurs des sources, normalisation, filtres, tris, prix)
```

`TMDB_API_KEY` accepte une clé v3 ou un jeton de lecture v4.

## Mise en ligne (Vercel)

GitHub Actions collecte et construit le site, puis l'envoie tel quel sur Vercel (aucun build côté Vercel).

1. *Settings → Secrets and variables → Actions* : ajouter `TMDB_API_KEY` et `VERCEL_TOKEN` (jeton créé sur vercel.com/account/tokens).
2. Le workflow `.github/workflows/update.yml` collecte, construit et publie vers 5 h et 11 h (heure de Montréal), et à chaque push sur `main`. On peut aussi le lancer à la main (*Actions → Run workflow*). Le projet Vercel `montreel` est créé au premier passage.
3. L'adresse publique est fixée par `SITE_URL` dans le workflow (aperçus de liens partagés).
4. Sur iPhone : ouvrir le site dans Safari, puis *Partager → Sur l'écran d'accueil*.

## Format des données

```jsonc
{
  "generatedAt": "2026-10-25T09:17:00Z",
  "cinemas":  [{ "id", "name", "short", "area", "address", "url", "cineplus", "prices": { "adult", "note" } }],
  "movies":   [{ "id", "title", "originalTitle", "year", "runtime", "genres", "synopsis", "poster", "backdrop",
                 "trailer", "directors", "cast", "tmdbId", "imdbId", "imdbRating", "imdbVotes", "originalLanguage" }],
  "showtimes":[{ "movieId", "cinemaId", "start": "2026-10-25T19:00:00-04:00", "version": "VOSTF",
                 "formats": ["IMAX"], "bookingUrl", "price" }]
}
```

Les séances après minuit (ex. 00 h 30) sont rattachées à la soirée de la veille.

## À savoir

Projet personnel, non commercial. Les horaires viennent des sites publics des cinémas ; certains passent par des interfaces non documentées qui peuvent changer sans préavis. Les notes viennent des [jeux de données IMDb](https://developer.imdb.com/non-commercial-datasets/) (usage personnel et non commercial). Ce produit utilise l'API TMDB sans être approuvé ni certifié par TMDB.
