# WEB-02 — panel wyłącznie lokalny

**Stan:** `partial`. Kod i focused checks przeszły QA, ale rzeczywisty smoke launchera wymaga wolnego portu 29199.

## Brief

- **Cel:** panel administratora działa tylko na loopback z lokalnym API, projektem `demo-patternly-admin` i Firebase Auth emulatorem; produkcyjne trasy administratora są niedostępne.
- **Ustalenia:** webowy `getAdminConfigurationError` akceptował zdalny Firebase i HTTPS API bez emulatora. Backend wymagał produkcyjnego `ADMIN_WEB_ORIGIN` i dopuszczał trasy administratora w produkcji. Lokalny launcher miał równoległy, cudzy diff; jego plików nie edytowano.
- **Podejście:** odrzucić wszystkie konfiguracje web admina poza lokalną; w backendzie odrzucić produkcyjny origin admina, zablokować trasy admina przed weryfikacją tokenu w produkcji, zachować uwierzytelnienie i autoryzację w test/development; poprawić testy i dokumentację.
- **Niezależna walidacja briefu `gpt-5.6-luna/max`:** consistency 0,93, simplicity 0,86, risk control 0,84, maintainability 0,88; minimum **0,84**, `PASS`.

## Zmiany i dowody

- `patternly-web/src/adminConfig.js` wymaga developmentu, loopback browser host, projektu demo, HTTP loopback API i Auth emulatora. Testy odrzucają produkcyjny Firebase i zdalne API. Playwright harness używa lokalnego kontraktu.
- `patternly-backend/src/config/environment.ts` nie wymaga produkcyjnego `ADMIN_WEB_ORIGIN`; jawnie go odrzuca. Lokalny origin administratora jest akceptowany tylko przy loopback `HOST`, obu emulatorach na loopback i projekcie demo w development.
- `patternly-backend/src/api/app.ts` zwraca jawne `404 admin_unavailable` dla produkcyjnych tras admina, także `OPTIONS`, przed weryfikacją Firebase. Bez zweryfikowanej lokalnej konfiguracji trasy też są niedostępne. Lokalne trasy nadal wymagają tokenu i zweryfikowanego adresu administratora.
- Usunięto stare instrukcje wdrażania hostowanego panelu z backendowych dokumentów i `.env.example`.

| Kontrola | Wynik |
| --- | --- |
| Web `npm run test:admin-config` | `PASS` 3/3. |
| Web `npm run verify:local` | `PASS`: publiczny build czysty, lokalne wejście admina 200, publiczny preview bez admina. |
| Web `npm run test:admin-behavior` | `PASS` 34/34 w Playwright Chromium poza sandboxem macOS; log `/tmp/patternly-web02-admin-test.log`. |
| Backend `npm run typecheck && npm run lint` | `PASS`. |
| Backend `firebase emulators:exec ... tests/firestore.emulator.test.ts` | `PASS` 30/30 po poprawce na tymczasowych portach 29099/28081; log `/tmp/patternly-web02-backend-test.log`. Test obejmuje produkcyjne 404/OPTIONS, brak CORS admina i negatywne konfiguracje lokalne. |
| Realny `npm run dev:admin` / `test:admin-local` | Nie wykonano: port 29199 jest zajęty przez istniejący proces; launcher zatrzymał się bez naruszania go. |

## Ograniczenia

- Nie wykonano realnego smoke lokalnego launchera z kontem emulatorowym. Przed oznaczeniem WEB-02 jako pełne `done` trzeba uruchomić ten test, gdy port jest wolny, lub na izolowanej konfiguracji o równoważnym kontrakcie.
- Pierwszy niezależny QA wskazał, że backend przy `HOST=0.0.0.0` i bez emulatorów mógł nadal obsługiwać admin API. Dodano walidację hosta/emulatorów, produkcyjne `OPTIONS` oraz testy negatywne. Ponowny QA potwierdził poprawkę: consistency 0,92, simplicity 0,84, risk control 0,86, maintainability 0,88; minimum **0,84**. Status pozostaje `partial` wyłącznie z powodu braku realnego smoke launchera.
- Backendowe publiczne privacy API pozostaje aktywne do WEB-03, po potwierdzeniu ścieżek aplikacji mobilnej.
- Publiczny katalog nadal pokazuje osiem tracków zamiast dziewięciu.
