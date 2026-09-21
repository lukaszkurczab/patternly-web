# WEB-01 — publiczny artefakt marketingowy

**Stan:** `done` dla lokalnego zakresu WEB-01. Nie wykonano zdalnego deployu.

## Brief i decyzja

- **Cel:** produkcyjny build webu i Firebase Hosting nie zawierają panelu administratora ani przeglądarkowego privacy flow.
- **Ustalenia:** wspólny `src/main.jsx` importował obie powierzchnie, Vite budował `admin.html`, `firebase.json` wystawiał trasy, stopka linkowała admina. Backendowe API privacy i mobilny Settings są osobnym zakresem.
- **Podejście:** osobne publiczne i lokalne wejście React; build wyłącznie z `index.html`; usunięcie publicznych tras, UI privacy i linku; automatyczny skan `dist` oraz direct-request test preview.
- **Walidacja briefu:** pierwsza ocena `gpt-5.6-luna/max` dała minimum 0,68 (`REDESIGN`). Po doprecyzowaniu obu entry pointów, inspekcji całego bundle'a i testów tras rewalidacja dała consistency 0,96, simplicity 0,87, risk control 0,87, maintainability 0,90; minimum **0,87**, `PASS`.

## Zmiany

- `src/main.jsx` renderuje tylko marketing, `src/adminMain.jsx` tylko lokalny panel. Usunięto wspólny router `src/App.jsx` i nieużywany `PrivacyRequestPage.jsx`.
- Vite buduje wyłącznie publiczne `index.html`. `/admin` pozostaje lokalną trasą dev servera; produkcyjny preview nie ma trasy admina ani privacy.
- `firebase.json` nie kieruje żadnych żądań do admina ani privacy; publiczna stopka nie linkuje panelu.
- Usunięto nieużywane style privacy i test starego publicznego flow; verifier bada cały tekstowy `dist`, publiczny render, lokalne wejście admina i brak tras produkcyjnych. README i `.env.example` opisują aktualną granicę.

## Weryfikacja

| Kontrola | Wynik |
| --- | --- |
| `npm run verify:local` | `PASS`: build, skan `dist`, SSR marketingu, lokalne `/admin`, 404 dla publicznych `/admin*` i `/privacy-request*` w preview. |
| `npm run test:admin-config` | `PASS`: 3 testy konfiguracji. |
| `npm run test:admin-behavior` | `PASS`: 34/34 w Playwright Chromium uruchomionym poza sandboxem macOS. Początkowe próby w sandboxie kończyły się przed testami przez odmowę MachPort; log końcowego runu: `/tmp/patternly-web-admin-test-escalated.log`. |

Niezależny QA ocenił architekturę 0,92, prostotę 0,88, kontrolę ryzyka 0,83 i utrzymywalność 0,86; minimum **0,83**. Potwierdził czystość `dist` oraz granicę tras. Wcześniejszy brak browser evidence został domknięty końcowym runem 34/34.

## Ograniczenia i następny task

- Zdalna zawartość Firebase Hosting nie została zmieniona ani zweryfikowana; przed publicznym wydaniem potrzebne są deploy i remote route checks.
- Publiczny katalog pokazuje osiem tracków, gdy plan wydania wymaga dziewięciu; pozostaje do korekty w dalszym WEB-03.
- Backend nadal ma publiczne API privacy. WEB-03 musi usunąć je dopiero po potwierdzeniu działającej mobilnej ścieżki gościa i zachowaniu lokalnego workflow PO.
- WEB-02 obejmuje pełną lokalną bramkę panelu i usunięcie akceptacji produkcyjnej konfiguracji admina; bieżący backendowy diff należy zachować.
