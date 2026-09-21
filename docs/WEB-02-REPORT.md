# WEB-02 — panel wyłącznie lokalny

**Stan:** `done` lokalnie. Kod, testy i rzeczywisty smoke pełnego lokalnego przepływu przeszły niezależny QA.

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
| Realny `npm run test:admin-local` na izolowanym stacku | `PASS`: Auth emulator `127.0.0.1:39099`, Firestore emulator `127.0.0.1:38081`, API `127.0.0.1:38080`, Vite `127.0.0.1:35173`. Test objął logowanie kontem emulatora, kolejki privacy/legal/security/content, overview, questions, usage i wylogowanie; wszystkie odczyty API 200, `externalRequests: 0`. Log `/tmp/patternly-web02-integrated-smoke.log`. Harness przyjmuje opcjonalne porty wyłącznie dla ścisłych originów `http://127.0.0.1`. |

## Ograniczenia

- Domyślnego `npm run dev:admin` nie uruchomiono do końca, ponieważ port 29199 pozostaje zajęty przez inny proces. Równoważny stack na izolowanych portach przeszedł ten sam rzeczywisty smoke przeglądarkowy z kontem emulatorowym.
- Pierwszy niezależny QA wskazał, że backend przy `HOST=0.0.0.0` i bez emulatorów mógł nadal obsługiwać admin API. Dodano walidację hosta/emulatorów, produkcyjne `OPTIONS` oraz testy negatywne. Końcowy QA po izolowanym smoke: consistency 0,94, simplicity 0,88, risk control 0,87, maintainability 0,89; minimum **0,87**, `PASS`.
- Backendowe publiczne privacy API pozostaje aktywne do WEB-03, po potwierdzeniu ścieżek aplikacji mobilnej.
- Katalog dziewięciu tracków jest domknięty oddzielnie w WEB-03A.
