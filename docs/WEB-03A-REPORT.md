# WEB-03A — dziewiąty track w katalogu marketingowym

**Stan:** `done` w lokalnym zakresie marketingowego katalogu.

## Brief i walidacja

Szeroki brief WEB-03 otrzymał minimum 0,48 i `REDESIGN`: łączył marketing, brakującą mobilną ścieżkę gościa i wycofanie backendowego API. Po wydzieleniu katalogu dziewięciu tracków niezależna rewalidacja `gpt-5.6-luna/max` dała consistency 0,98, simplicity 0,93, risk control 0,91 i maintainability 0,94; minimum **0,91**, `PASS`.

## Zmiany

- Dodano Claude Certified Architect – Professional do publicznego katalogu z dokładnym opisem i notą braku afiliacji z `patternly/src/domain/tracks/trackRegistry.ts`.
- Skopiowano ikonę `sparkle.svg` z aplikacji, ustawiono siatkę trzech kolumn na szerokim ekranie i zachowano istniejące przejścia do dwóch oraz jednej kolumny.
- Copy katalogu mówi o dziewięciu trackach; verifier wymaga dziewięciu kart oraz Claude i jego noty. README opisuje obecny stan.

## Weryfikacja

- `npm run verify:local`: `PASS` po zmianie (Vite build, skan tekstowych plików `dist`, SSR 9 kart, pełne Claude description/legal note i ikona sparkle, lokalne wejście admina, 404 dla admin/privacy w publicznym preview).
- Kanoniczne copy i ikona porównane z aktualnym kodem aplikacji.
- Niezależny QA: consistency 0,96, simplicity 0,95, risk control 0,89, maintainability 0,90; minimum **0,89**. Wskazana przez QA słabsza asercja copy/ikony została wzmocniona, a `verify:local` i `git diff --check` przeprowadzono ponownie z wynikiem `PASS`.

## Ograniczenia

WEB-03A nie zamyka WEB-03. Guest privacy i usunięcie public-browser API są `blocking` do czasu działającej i zweryfikowanej ścieżki w aplikacji; zdalny hosting nie został wdrożony ani sprawdzony.
