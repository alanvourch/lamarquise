# La Marquise — les séances de Montréal

Une app web (installable sur téléphone) qui rassemble les séances de **tous les cinémas de Montréal** au même endroit, dans l'esprit de LaBobine à Paris.

- **Films du jour, de demain ou des 7 prochains jours**, avec affiches, synopsis et bande-annonce
- **Note IMDb et nombre de votes** sur chaque film
- **Version de chaque séance : VO, VOSTF, VOSTA, VF.** Un film québécois en français compte comme VO *et* comme VF.
- Tri : prochaine séance, note IMDb, popularité, nombre de séances, nouveautés, titre, durée
- Filtres : mes cinémas favoris ★, version, « dès 19 h », note minimale, genre, ma liste ♥, recherche (titre, réalisateur, acteur)
- 3 vues : **Films** (grille d'affiches), **Séances** (liste chronologique, « que voir dans l'heure ? »), **Cinémas** (programme par salle)
- Prix de la place, et **prix membre CinéPlus** sur les salles Cineplex (réglage)
- Lien de réservation sur chaque séance, partage, liens IMDb et Letterboxd
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
  └─ web/ (React + Vite) → site statique sur GitHub Pages
```

Pas de serveur ni de base de données : un fichier JSON régénéré chaque matin, servi par un site statique. Si une source tombe en panne, ses séances de la veille sont conservées jusqu'à la prochaine collecte réussie.

## Sources

| Cinémas | Source prévue | État |
| --- | --- | --- |
| Cineplex (Forum, Quartier Latin, Banque Scotia…) | API utilisée par cineplex.com | à brancher |
| Cinéma du Parc, Cinéma du Musée, Cinéma Beaubien | cinemacinema.ca | à brancher |
| Cinéma Moderne | cinemamoderne.com | à brancher |
| Cinéma Public | cinemapublic.ca | à brancher |
| Cinémathèque québécoise | cinematheque.qc.ca | à brancher |
| Guzzo | cinemasguzzo.com | à brancher |
| Les autres salles | Cinemaclock, en complément | à brancher |

Chaque source est un module de `scraper/sources/` qui renvoie `{ cinemas, showtimes }` (contrat détaillé dans `scraper/sources/index.mjs`). Les prix des salles indépendantes se renseignent dans `scraper/cinemas.mjs`. Si un film est mal reconnu par TMDB, on force la correspondance dans `scraper/overrides.json` (`"titre normalisé": idTMDB`).

## En local

```bash
cd web && npm install && cd ..
TMDB_API_KEY=xxxx npm run scrape   # écrit web/public/data/showtimes.json
npm run dev                        # http://localhost:5173
npm test                           # tests (normalisation, filtres, tris, prix)
```

`TMDB_API_KEY` accepte une clé v3 ou un jeton de lecture v4.

## Mise en ligne (GitHub Pages)

1. Pousser ce dossier dans un dépôt GitHub.
2. *Settings → Secrets and variables → Actions* : ajouter le secret `TMDB_API_KEY`.
3. *Settings → Pages* : source = **GitHub Actions**.
4. Le workflow `.github/workflows/update.yml` collecte, construit et publie vers 5 h et 11 h (heure de Montréal). On peut aussi le lancer à la main (*Actions → Run workflow*).
5. Sur iPhone : ouvrir le site dans Safari, puis *Partager → Sur l'écran d'accueil*.

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
