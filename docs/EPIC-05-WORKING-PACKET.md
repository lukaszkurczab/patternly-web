# EPIC-05 — hosted web i lokalny admin

**Źródło kolejności:** `../../docs/PATTERNLY-WORKING-PLAN.md`. Ten pakiet doprecyzowuje kryteria; nie zmienia roadmapy ani decyzji PO.

## Cel i stan wejściowy

Publiczny artefakt webowy ma zawierać wyłącznie stronę marketingową. Panel administratora działa lokalnie na loopback z Firebase Authentication, autoryzacją backendu i emulatorami. Wnioski użytkowników dotyczące danych i prywatności zaczynają się w aplikacji mobilnej w Settings.

Na wejściu WEB-01–03 były `planned`. WEB-01 ma obecnie lokalny raport i zielone testy; opis starego stanu pozostaje punktem odniesienia. Wcześniej kod budował `admin.html` razem z `index.html`, wspólny `src/main.jsx` importował stronę administratora i `PrivacyRequestPage`, `firebase.json` publikował ścieżki admin/privacy, a stopka publiczna linkowała `/admin`. Backend nadal ma rodzinę `/v1/public/privacy-requests` oraz lokalny launcher admina.

## Reguły wykonania

1. Jeden task naraz: brief Cel / Ustalenia / Podejście, niezależna walidacja `gpt-5.6-luna/max` i ocena architektury, prostoty, ryzyka oraz utrzymywalności; minimum 0,8.
2. Po implementacji: wąska weryfikacja, raport z dowodami, niezależny QA. `done` tylko dla aktualnego kodu i dowodów.
3. Nie utrzymywać dwóch aktywnych ścieżek produktu, ukrytego admina w publicznym bundle'u ani fałszywego fallbacku privacy.
4. Nie nadpisywać zmian innych strumieni w aplikacji i backendzie. Zmiany w backendzie należy uzgodnić z jego bieżącym diffem przed WEB-03.

## WEB-01 — granica publicznego artefaktu (`done` lokalnie)

- **Cel:** produkcyjny build i konfiguracja Firebase Hosting dostarczają tylko stronę marketingową.
- **Zakres:** oddzielić publiczny entry point od lokalnego admina; usunąć publiczny link `/admin`, hosted admin/privacy routing oraz privacy UI z publicznego artefaktu; dostosować build i test negatywny zawartości `dist`.
- **Poza zakresem:** usuwanie backendowych endpointów privacy i zmiana mobilnego Settings.
- **Wejście:** `vite.config.js`, `src/App.jsx`, `src/main.jsx`, `src/pages/PublicPage.jsx`, `firebase.json`, `scripts/verify-local.mjs`, decyzja BE-DEC-003.
- **Akceptacja:** `dist` nie zawiera `admin.html`, kodu panelu, konfiguracji Firebase admina, formularza privacy ani kodu jej sesji; strona publiczna działa, a `/admin` i `/privacy-request` nie są publicznymi trasami; local admin pozostaje uruchamialny osobno.
- **Weryfikacja / dowód:** build, automatyczna inspekcja całego `dist`, direct-request checks lokalnego preview, focused test strony i porównanie Firebase Hosting config; raport `docs/WEB-01-REPORT.md`.
- **Ryzyko:** wspólny chunk lub publiczny asset może nadal zawierać prywatny kod mimo rozdzielenia HTML.

## WEB-02 — lokalny panel administratora (`partial`)

- **Cel:** panel jest używalny wyłącznie na loopback z lokalnym backendem i emulatorami.
- **Zakres:** dopiąć lokalny entry point, konfigurację i dokumentację; zweryfikować Firebase Authentication, autoryzację backendu, dostęp do kolejek oraz odmowę poza loopback.
- **Poza zakresem:** cloud admin i publikowanie panelu.
- **Wejście:** lokalny launcher backendu, `src/pages/AdminPage.jsx`, `src/adminConfig.js`, testy admina i `../patternly-backend/docs/local-admin.md`.
- **Akceptacja:** lokalny flow logowania i odczytu działa; brak konfiguracji lub niewłaściwy origin daje jawny stan niedostępności; backend egzekwuje administratora; publiczny build nie zawiera panelu.
- **Weryfikacja / dowód:** testy konfiguracji, admin behavior, emulator smoke oraz negatywne sprawdzenie hosta; raport `docs/WEB-02-REPORT.md`.
- **Ryzyko:** bieżące, cudze zmiany lokalnego launchera backendu wymagają uzgodnienia przed edycją.

## WEB-03 — domknięcie marketingu i privacy (`partial`)

WEB-03 jest podzielony na trzy małe kroki. Pierwszy nie zależy od nowego kontraktu mobilnego; drugi wymaga go jako twardego wejścia. Raport każdego kroku pozostaje osobny, a status całego WEB-03 nie przechodzi na `done` od samej strony marketingowej.

### WEB-03A — katalog dziewięciu tracków (`done` lokalnie)

- **Cel:** publiczny katalog odpowiada zaakceptowanemu kandydatowi dziewięciu tracków.
- **Zakres:** dodać Claude Certified Architect – Professional z kanoniczną nazwą, opisem i notą braku afiliacji z rejestru aplikacji; lokalną ikonę sparkle; układ 3×3 oraz test dziewięciu kart.
- **Poza zakresem:** zmiany contentu edukacyjnego, płatności, guest privacy i backendu.
- **Wejście:** `patternly/src/domain/tracks/trackRegistry.ts`, `patternly/src/assets/icons/sparkle.svg` i obecny katalog webowy.
- **Akceptacja:** SSR pokazuje dokładnie dziewięć kart i kanoniczne Claude copy; build nie dodaje admin/privacy; siatka pozostaje responsywna.
- **Weryfikacja / dowód:** `npm run verify:local`, porównanie ikony i copy z aplikacją, niezależny QA; raport `docs/WEB-03A-REPORT.md`.
- **Ryzyko:** opis niezależnego contentu nie może sugerować afiliacji z Anthropic.

### WEB-03B — kanał guest privacy i usunięcie publicznego API (`blocking`)

- **Cel:** brak publicznego web intake, verification-link i response delivery; prawdziwe ścieżki w aplikacji i lokalny workflow PO pozostają dostępne.
- **Zakres:** usunąć lub zastąpić backendową rodzinę `/v1/public/privacy-requests`, publiczne linki i konfigurację zależne od niej; zaktualizować OpenAPI, testy oraz dokumentację po potwierdzeniu kontraktu aplikacji.
- **Poza zakresem:** nowa webowa ścieżka wniosków oraz release provider evidence.
- **Wejście:** BE-DEC-003, gotowy i przetestowany kontrakt mobilnego guest privacy z EPIC-04, kod backendu i aktualny Settings. Obecny `guestSupport` otwiera zewnętrzny `supportUrl` HTTPS i nie stanowi dowodu in-app request/verification; prawdziwy kontakt PO należy do ODK-116.
- **Akceptacja:** publiczny browser nie może rozpocząć, potwierdzić ani odebrać wniosku; mobilny guest i authenticated mają działające, odrębne ścieżki; lokalna kolejka PO działa; brak osieroconych linków w mailach, OpenAPI i docs.
- **Weryfikacja / dowód:** testy kontraktowe negatywne i mobile/backend E2E dla obu stanów, test lokalnej kolejki admina; raport `docs/WEB-03B-REPORT.md`.
- **Ryzyko:** proste usunięcie endpointów odbierze gościom kanał obsługi praw, zanim nowy flow będzie gotowy. Do tego czasu publiczne API pozostaje niespójnym legacy, które nie może być podstawą release.

### WEB-03C — wdrożenie i zdalna weryfikacja (`planned`)

- **Cel:** publiczny hosting faktycznie serwuje wyłącznie zweryfikowany marketingowy artefakt.
- **Zakres:** po WEB-03B opublikować przypięty `dist`, sprawdzić zdalne `/`, `/admin*` i `/privacy-request*`, porównać digesty artefaktu z lokalnym buildem i zapisać rollback.
- **Poza zakresem:** nowa funkcjonalność mobilna lub panel hostowany.
- **Wejście:** zamknięte WEB-01/02/03B, zgoda na publikację, właściwy projekt Firebase Hosting.
- **Akceptacja:** zdalna strona pokazuje dziewięć tracków; admin/privacy routes nie są dostępne; raport wiąże wynik z exact build i projektem.
- **Weryfikacja / dowód:** direct HTTP checks i manifest builda, raport `docs/WEB-03C-REPORT.md`.
- **Ryzyko:** lokalne testy nie dowodzą aktualnej zawartości hostingu.

Następny task: WEB-02. Backendowe usunięcie w WEB-03 wymaga najpierw dowodu, że aplikacja ma alternatywny, działający kanał.
