# A Gamut of Games — Digital Collection

Browser adaptations of the **38 games** collected in Sid Sackson’s *A Gamut of Games* (Dover reprint of the 1982 Pantheon edition).

Open [`index.html`](index.html) in a local server (or via Cursor’s simple static preview). The menu is driven by [`games.json`](games.json).

## Approach

- Vanilla HTML / CSS / JS only (no React/Next). Optional helpers: SVG, Canvas, p5.js, Three.js where useful.
- Multiplayer titles run as **single-player vs computer** opponents.
- Each game has a **short how-to** — enough to start, not a reprint of the book entry.
- Sprites live in [`assets/`](assets/) (cards, dice, chips, colored pieces, letter tiles, shapes, sports, splat). Games may also use SVG or CDN assets.
- Source rules were OCR’d from the scanned PDF into `_ocr/` (gitignored) for implementation reference only.

## Status

| # | Game | Status | Notes |
|---|------|--------|-------|
| 1 | Mate | playable | Vs AI; 20-card deck |
| 2 | Blue and Gray | playable | Vs AI |
| 3 | Le Truc | playable | Vs AI |
| 4 | Plank | playable | Vs AI |
| 5 | Zetema | playable | Vs AI; 65-card deck, hearts duplicated; race to 300 |
| 6 | Hekaton | playable | Vs AI; digit tricks; race to 5,000 (shortened) |
| 7 | Lines of Action | playable | Vs AI |
| 8 | Cups | playable | Vs AI |
| 9 | Crossings | playable | Vs AI |
| 10 | Lap | playable | Vs AI |
| 11 | Three Musketeers | playable | Vs AI |
| 12 | Paks | playable | Vs AI; race to 500 |
| 13 | Skedoodle | playable | Vs AI |
| 14 | Knight Chase | playable | Vs AI |
| 15 | Origins of World War I | playable | Simplified 3-nation crisis vs AI |
| 16 | All My Diamonds | playable | Vs AI |
| 17 | Osmosis | playable | Vs AI |
| 18 | Patterns | playable | Vs AI |
| 19 | Suit Yourself | playable | Vs AI |
| 20 | Bowling Solitaire | playable | Solo |
| 21 | Card Baseball | playable | Simplified 9-inning duel vs AI |
| 22 | Slam | playable | Two-hand bidding vs AI; rubber simplified |
| 23 | Poke | playable | Draw + trick poker vs AI |
| 24 | Color Gin | playable | Four suit columns vs AI |
| 25 | Focus | playable | Vs AI |
| 26 | Network | playable | Vs AI |
| 27 | Take It Away | playable | Vs AI |
| 28 | Hold That Line | playable | Vs AI |
| 29 | Cutting Corners | playable | Vs AI |
| 30 | Paper Boxing | playable | Vs AI |
| 31 | Patterns II | playable | Design or guess vs AI guessers/designer |
| 32 | Last Word | playable | Vs AI; permissive word check |
| 33 | Property | playable | Simplified paper property vs AI |
| 34 | Solitaire Dice | playable | Five dice, combination/reject sheet, free rides, 500+ win |
| 35 | Domino Bead Game | playable | Vs AI; SVG-style domino tiles; pattern extension + scoring |
| 36 | Haggle | playable | Party → solo + 4 AI traders; secret slips + timed trading |
| 37 | The No Game | playable | Party → chat UI vs AI guests; ribbons + timer |
| 38 | Change Change | playable | 11-coin sliding symmetry; 7-board / ≤100-move win |

## Stuck / simplified

- **Haggle** — Free-form party haggling becomes structured trade offers with bots; all 15 scoring rules apply at submit.
- **The No Game** — Physical ribbon pins become a timed chat round; guests ask questions and can be baited into saying “no.”
- **Origins of World War I** — Full five-power map and objectives reduced to a playable Britain vs France/Germany crisis: place PF, one diplomatic attack per turn (die + odds), 8 rounds, treaty rights at 10+ PF, simplified national scoring.
- **Hekaton** — Target lowered from 10,000 to 5,000 for a shorter match; arrangement UI helps form multiples of 100.
- **Card Baseball** — Core pitch / swing / fielding arithmetic kept; some specialty options (new ball frequency, sacrifice nuances) are light.
- **Slam** — Progressive deal and bidding retained; four-card tricks and lay-off tricks included; rubber / slam bonuses abbreviated toward game points.
- **Patterns II** — Multi-guesser pencil game becomes you-as-designer vs two AI guessers, or you-as-guesser vs an AI designer.
- **Last Word** — Any alphabetic string of length ≥ 2 scores (dictionary used mainly to bias the AI); anagrams along a line as in the book.
- **Property** — Two-player vs AI on the 8×8 grid; purchase units are an abstract count (K/Q/J values) rather than dealt picture cards; chip colors collapsed to a dollar total.

## Assets used

- **Cards** — `assets/Cards/` for card games
- **Dice** — `assets/Dice/` for Solitaire Dice, Origins
- **Chips** — `assets/Chips/` for Focus-adjacent / Take It Away / auctions
- **Pieces** — colored `assets/Pieces (*)/` for board games
- **Letter Tiles** — Last Word
- **Shape Pieces / Shape Pieces 2** — Plank, pencil-paper visualizations as needed

## Local preview

```bash
# from repo root
python3 -m http.server 8080
# then open http://localhost:8080/
```

## Copyright note

The book text is copyrighted; these pages are **original code** and **original brief instructions** implementing playable game mechanics. Do not paste long passages from the OCR/PDF into the UI.
