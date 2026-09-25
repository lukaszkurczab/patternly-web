# EPIC-05 — pozostałe wdrożenie hosted web

**Źródło kolejności:** [aktualny plan roboczy](https://github.com/lukaszkurczab/gcp-ace-trainer/blob/main/docs/PATTERNLY-WORKING-PLAN.md). Ten pakiet doprecyzowuje WEB-03C i nie zmienia decyzji PO.

Publiczny build zawiera wyłącznie stronę marketingową z dziewięcioma trackami. Panel administratora działa lokalnie na loopback z Firebase Authentication, autoryzacją backendu i emulatorami. Wnioski o dane i prywatność zaczynają się w aplikacji mobilnej.

## WEB-03C — przygotowanie i zdalna weryfikacja (`PREP done / PUBLISH wait`)

PREP 25.09.2026: lokalny manifest `local-test` obejmuje wszystkie pliki `dist` z SHA-256 i rozmiarem, czyste przypięte HEAD-y źródeł oraz projekt/site. `prepare:web03c:local` odrzuca brudne albo zmieniające się podczas builda źródła. Firebase CLI nadal odrzuca credentials, więc dostępu, zdalnego release i rollbacku nie potwierdzono. Produkcyjny build i PUBLISH czekają na ODK-116-B. Szczegóły i przyszła procedura rollbacku są w [preparation](WEB-03C-PREPARATION.md).

- **Cel:** publiczny hosting serwuje wyłącznie zweryfikowany artefakt marketingowy.
- **Zakres:** zgoda PO została udzielona. Lokalnie wyrównano katalog dziewięciu tracków z mobile registry i dodano brakujące noty niezależności pięciu certyfikacji; `verify:local` sprawdza komplet ID, tytułów i not. Pozostałe: dodać prawdziwe read-only Privacy/Terms/Support linki po ODK-116; następnie odświeżyć/porównać `dist`, opublikować wyłącznie Hosting i sprawdzić zdalne `/`, `/admin*`, `/privacy-request*` oraz rollback.
- **Poza zakresem:** nowa funkcjonalność mobilna i panel hostowany.
- **Wejście:** zgoda na publikację istnieje; pozostają prawdziwe treści i linki PO-116, właściwy projekt Firebase Hosting i odnowiona sesja Firebase CLI; [preparation z lokalnym dowodem i digestami](WEB-03C-PREPARATION.md).
- **Akceptacja:** publiczne informacje są prawdziwe i bez placeholderów; zdalna strona pokazuje dziewięć aktualnych tracków i not niezależności; trasy admin/privacy nie są dostępne; raport wiąże wynik z dokładnym buildem, projektem i rollbackiem. Aktualnie lokalny build/SSR/negatywne trasy PASS, lecz zdalny root 404 i brak credentialów uniemożliwiają wdrożenie/odbiór.
- **Weryfikacja:** direct HTTP checks, manifest builda i raport WEB-03C.
- **Ryzyko:** lokalne testy nie dowodzą aktualnej zawartości hostingu.

Lokalna walidacja 23.09.2026: `npm run verify:local` PASS. Publiczny root zwraca 404; Firebase CLI 15.19.0 wykrywa `patternly-app-sandbox`, ale odrzuca nieważną sesję (exit 2). ODK-116 nie zawiera prawdziwego publicznego kontaktu ani finalnych danych do treści linkowanych, więc linki nie zostały sfabrykowane. Lokalne Playwright Chromium nie jest zainstalowane, a CUA nie wystartował; wizualny odbiór pozostaje otwarty. Szczegóły i SHA-256 builda w [przygotowaniu](WEB-03C-PREPARATION.md).
