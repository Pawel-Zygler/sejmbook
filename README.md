# Sejmbook

Dashboard o Sejmie RP w formie serwisu społecznościowego. MVP: profile posłów X kadencji z przynależnością klubową oraz ranking **Frequent Flyer** (krajowe loty posłów na koszt Kancelarii Sejmu).

## Dane
- `data/mps.json`, `data/clubs.json` – API Sejmu (`api.sejm.gov.pl/sejm/term10/MP`, `/clubs`), stan na 2026-11-23.
- `data/flights.json` – liczby lotów i koszty z danych Kancelarii Sejmu opublikowanych przez media (RMF FM/Wprost, TVN24/Wprost, Interia). Każdy zbiór ma okres, opis zakresu (`coverageNote`) i źródła. Nic nie jest dopisane z głowy.
- `data/airports.json` – lotnisko dla każdego okręgu; kilometry = liczba lotów × odległość po kole wielkim WAW ↔ lotnisko okręgu (szacunek, Sejm nie publikuje tras).

## Struktura
- `src/lib/` – czysta logika (geo, ranking, wyszukiwanie, routing) – 100% pokrycia testami jednostkowymi.
- `src/ui/render.js` – widoki jako funkcje zwracające HTML; `src/app.js` – stan, routing po `#hash`, zdarzenia.
- `scripts/build.mjs` – bundel do jednego pliku: `dist/index.html` (artefakt) i `dist/standalone.html`.

## Piramida testów
| Warstwa | Narzędzie | Gdzie | Co sprawdza |
|---|---|---|---|
| Jednostkowe (podstawa) | Vitest | `tests/unit` | logika, widoki, kontrakt danych (spójność id, źródła, kluczowe liczby) |
| Integracyjne | Vitest + jsdom | `tests/integration` | cała aplikacja w DOM: nawigacja, wyszukiwanie, filtry, sortowanie |
| E2E | Playwright (desktop + Pixel 7) | `tests/e2e` | zbudowany plik w przeglądarce: przepływy, brak poziomego scrolla, tryb ciemny |

```
npm ci
npm test            # unit → integration → build → e2e
npm run coverage    # unit + progi pokrycia (lines/functions/statements 95%, branches 85%)
```
Zasada: każda nowa funkcja wchodzi razem z testami na wszystkich trzech poziomach. CI: `.github/workflows/tests.yml`.
