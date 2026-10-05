# LUMEN — a musical puzzle

Un puzzle game musicale rilassante per il web mobile. Sposta note luminose su una
griglia finché la sequenza letta (da sinistra a destra, dall'alto in basso) non
diventa la melodia richiesta. Niente timer, niente vite, niente game over.

- **100 livelli** in 5 mondi (FIRST NOTES · HARMONY · RHYTHM · ECHO · CONSTELLATION)
- **9 meccaniche introdotte gradualmente**: note bloccate, note doppie, catene, silenzi,
  echo, reverse, mirror, portali, rotazione (più griglie con forme irregolari)
- **Audio sintetizzato con la Web Audio API**: pianoforte morbido, campane di vetro,
  carillon, pad caldo. La musica ambient reagisce a quanto sei vicino alla soluzione
- **Costellazioni**: ogni livello accende una stella; ogni mondo completa una figura
  (balena, volpe, cervo, uccello, luna) e i puzzle giornalieri formano un fiore
- **Puzzle giornaliero** identico per tutti (seed basato sulla data)
- **Modalità Zen**, **temi** e cosmetici acquistabili con ✨ NOTES (nessun pay-to-win)
- **PWA installabile**, funziona offline, salvataggio automatico in `localStorage`
- Accessibilità: simboli per ogni nota, palette per daltonici, animazioni ridotte,
  vibrazione e audio disattivabili, nomi DO-RE-MI o C-D-E

Non ci sono dipendenze né build: è HTML, CSS e JavaScript (moduli ES) puri.

## Avvio in locale

Serve solo un server statico (i moduli ES e il service worker non funzionano da `file://`):

```bash
npm start                 # npx serve su http://localhost:5173
# oppure
python3 -m http.server 5173
```

Poi apri `http://localhost:5173` (dal telefono: usa l'IP del computer sulla stessa rete).

## Pubblicazione su GitHub Pages

Tutti i percorsi sono relativi, quindi il gioco funziona anche in una sottocartella
(`https://<utente>.github.io/<repo>/`).

1. Settings → Pages → *Deploy from a branch*
2. Scegli il branch e la cartella `/ (root)`

Il file `.nojekyll` è già presente. Dopo aver modificato dei file esegui
`npm run precache` così il service worker scarica la nuova versione.

## Struttura

```
index.html            shell dell'app (+ splash iniziale)
manifest.json, sw.js  PWA (manifest, cache offline)
assets/               icone, font Manrope (OFL), effetti .wav renderizzati
src/
  main.js, app.js     avvio, router delle schermate, tasto indietro, temi
  audio/              engine (grafo Web Audio + riverbero), strumenti, sfx,
                      musica adattiva, API per note e sequenze
  game/               model (regole, mosse, valutazione), planner (soluzioni),
                      hints (3 livelli di aiuto), progress (stelle, valuta, sblocchi)
  levels/             world1 (livelli fatti a mano), recipes (mondi 2-5),
                      generator (generazione procedurale verificata), melody,
                      par-table (mosse ottime calcolate), index (registro)
  data/               note, mondi, temi/negozio, costellazioni, meccaniche
  components/         board (griglia + drag & drop), tile, melodyBar, sky (sfondo
                      animato), constellation, icone, ui (bottoni, overlay, toast)
  screens/            loading, home, journey, world, game, worldComplete,
                      settings, theme, zen, daily, sky
  styles/             base.css, screens.css, game.css
  utils/              rng deterministico, storage, haptics, dom
tools/                validatore livelli, test end-to-end, generatori icone/sfx/precache
```

## Come funziona un livello

La griglia viene letta come un testo: riga per riga, da sinistra a destra
(al contrario nei livelli *Mirror* e *Reverse*). Le celle vuote vengono saltate.
La sequenza di note ottenuta deve essere uguale alla melodia mostrata in alto.

Mosse: trascina una nota su una cella vuota per spostarla, su un'altra nota per
scambiarle; tocca una nota per ascoltarla (o per ruotarla, se è una nota rotante).
Le stelle dipendono dal numero di mosse rispetto al *par* (★★★ ≤ par).

## Aggiungere livelli

### Livelli disegnati a mano (`src/levels/world1.js`)

Ogni livello ha una griglia `solution` (una disposizione corretta) e una griglia
`start`. La melodia viene calcolata automaticamente dalla soluzione.

```js
{
  tip: 'Testo facoltativo mostrato sotto la griglia',
  intro: 'locked',            // facoltativo: mostra la scheda della meccanica
  solution: [
    '. 2 . .',
    '1 5! . 6',
    '. . 3 .',
    '. . . .',
  ],
  start: [
    '. 6 . .',
    '3 5! . 1',
    '. . 2 .',
    '. . . .',
  ],
}
```

Simboli delle celle (separati da spazi):

| token    | significato                                  |
| -------- | -------------------------------------------- |
| `.`      | cella vuota                                  |
| `#`      | vuoto (non fa parte della griglia)           |
| `1`…`7`  | nota DO…SI                                   |
| `35`     | nota doppia (suona MI poi SOL)               |
| `-`      | silenzio (pausa)                             |
| `r351`   | nota rotante con facce 3,5,1 (`r351:2` = faccia 2 in alto) |
| suffisso `!`  | nota bloccata                           |
| suffisso `@`  | cella echo (la nota suona due volte)    |
| suffisso `^A` | portale (coppia A)                      |
| suffisso `~1` | catena 1 (le note del gruppo si muovono insieme) |

Esempio: `3!@` è un MI bloccato su una cella echo, `.^A` è un portale vuoto.

### Livelli generati (`src/levels/recipes.js`)

Ogni riga è una "ricetta": dimensione, numero di tessere, meccaniche e numero di
mosse di mescolamento. Il generatore costruisce prima una soluzione, ne ricava la
melodia e poi mescola la griglia **solo con mosse legali**, registrando il percorso
inverso: ogni livello è quindi risolvibile per costruzione.

```js
R(6, 7, 4, { rests: 2, locked: 1, voids: 'corners' }),
```

Per aggiungere un mondo basta un nuovo array di ricette (e una voce in `data/worlds.js`).

### Verifica

```bash
npm run validate   # verifica tutti i livelli + 800 giorni di puzzle giornalieri,
                   # calcola le mosse ottime (ricerca esaustiva) e aggiorna par-table.js
npm test           # validazione rapida + test end-to-end nel browser
                   # (richiede Playwright: npm i -D playwright && npx playwright install chromium)
```

Il test end-to-end gioca davvero: home → play → tutorial → mosse → soluzione →
ricompensa → livello successivo → mappa → impostazioni → reload, un livello per
ogni meccanica (risolto con veri drag del puntatore), scena di fine mondo, daily,
zen, negozio, layout a 360×640 e 1280×800, e funzionamento offline.

## Crediti

- Font: [Manrope](https://github.com/googlefonts/manrope) — SIL Open Font License (`assets/fonts/OFL.txt`)
- Tutta la musica, le melodie e gli effetti sono generati dal codice: nessun file audio di terzi
