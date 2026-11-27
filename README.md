# Sejmbook

**Wydarzenia w Rzeczypospolitej.** Sejmbook to niezależny serwis w formie mediów społecznościowych, w którym patrzymy, co robią posłowie: jak głosują, ile latają na koszt Sejmu, czy przychodzą na posiedzenia i jakie funkcje pełnili w państwie. Wszystkie liczby pochodzą z oficjalnych lub sprawdzonych źródeł i są podpisane źródłem. Nic nie jest dopisane z głowy.

**Strona:** https://sejmbook.zygler-pawel.workers.dev/ (Cloudflare Workers, wdrażana automatycznie z `main`; każdy pull request dostaje własny podgląd).

## Sekcje
- Feed
- Posłowie
- Państwo
- Frequent Flyer
- Frekwencja
- Changelog

<details>
<summary><b>Dane</b></summary>

- `data/mps.json`, `data/clubs.json`: API Sejmu (`api.sejm.gov.pl`).
- `data/feed.json`: głosowania z API Sejmu oraz kanały oficjalne; pobierane w GitHub Actions (`feed.yml`).
- `data/attendance.json`, `data/terms.json`, `data/career.json`: frekwencja, kadencje i historia klubowa z API Sejmu i Wikipedii.
- `data/government.json`: rządy i urzędy z artykułów polskiej Wikipedii (`government.yml`), zdjęcia z Wikimedia Commons na wolnych licencjach (`gov-photos.yml`).
- `data/flights.json`: loty i koszty z danych Kancelarii Sejmu opublikowanych przez media (RMF FM/Wprost, TVN24/Wprost, Interia). Każdy zbiór ma okres, zakres i źródła.
- `data/airports.json`: lotnisko dla każdego okręgu; kilometry to liczba lotów razy odległość WAW ↔ lotnisko okręgu (szacunek, Sejm nie publikuje tras).
</details>

<details>
<summary><b>Struktura kodu</b></summary>

- `src/lib/`: czysta logika (geo, ranking, wyszukiwanie, routing, rządy, feed), pokryta testami jednostkowymi.
- `src/ui/`: widoki jako funkcje zwracające HTML; `src/app.js`: stan, routing po `#hash`, zdarzenia.
- `scripts/`: pobieranie danych (uruchamiane w GitHub Actions) i `build.mjs`, który składa jeden plik `dist/index.html` oraz stronę `dist/pages`.
</details>

<details>
<summary><b>Testy</b></summary>

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
Zasady:
- każda nowa funkcja wchodzi razem z testami na wszystkich trzech poziomach;
- każdy znaleziony brak (zauważony przez Claude'a albo przez Pawła) zamieniamy w test automatyczny, który pilnuje, że brakujący element już jest; wybieramy najtańszy poziom: unit, potem integracja, a e2e (Playwright) tylko w ostateczności;
- każda nowa funkcja dostaje krótki post w Changelogu (`data/news.json`), a test kontraktu danych pilnuje jego poprawności. CI: `.github/workflows/tests.yml`.
</details>
