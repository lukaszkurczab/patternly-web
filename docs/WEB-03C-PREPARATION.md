# WEB-03C/PREP — lokalne przygotowanie

**Stan 25.09.2026:** techniczny lokalny build `local-test` i kontrola granicy publicznego Hostingu przeszły. Nie było publikacji. `WEB-03C/PUBLISH` pozostaje osobnym zadaniem po rzeczywistych danych ODK-116-B.

## Powtarzalny dowód lokalny

W repo web uruchom `npm run prepare:web03c:local -- /tmp/patternly-web03c-local-manifest.json`. Skrypt wywołuje `verify:local`, a następnie zapisuje SHA-256 i rozmiar każdego pliku `dist`, SHA konfiguracji Hosting i źródła prawnego aplikacji, SHA HEAD obu repozytoriów oraz stan ich drzew. Manifest ma `mode: local-test` i `deployable: false`. Weryfikacja sprawdza dziewięć tracków, dokumenty testowe, brak kodu admin/privacy intake w publicznym buildzie oraz lokalne 404 dla `/admin*` i `/privacy-request*`.

Ostatni przebieg: `verify:local` PASS; 11 plików `dist`. `index.html` SHA-256 `bf23c49602134c7c0d8cf0562cda5b02c7bc2496551f3670256147aea98a3308`; `privacy.html` `0185420ad30a1967903c2456c2167f08d484e3905e29db99d1e765b4ce068eda`; `terms.html` `9e00e9864c1fc0362cec63584e3638d86a75d7648959fe7c7924f474124d18d2`. Cały manifest lokalny jest w `/tmp/patternly-web03c-local-manifest.json`; po zmianach źródeł należy go odtworzyć. Testowy artefakt jest produkowany z `patternly/config/public-legal.release.json` przez app exporter i jawnie używa syntetycznych wartości. Nie stanowi danych do publikacji.

Konfiguracja wskazuje projekt i site `patternly-app-sandbox`, a Hosting publikuje wyłącznie `dist`. Lokalna konfiguracja nie dowodzi prawa dostępu ani bieżącego stanu zdalnego site. `firebase projects:list --json` (CLI 15.19.0) zakończyło się kodem 2, więc obecnie nie ma potwierdzonego dostępu do projektu ani identyfikatora poprzedniego release. Nie wykonano zdalnego rollbacku.

## Osobny WEB-03C/PUBLISH

1. Po ODK-116-B przygotować prawdziwy, zatwierdzony artefakt prawny. Produkcyjny build musi odrzucić `testOnly`; sprawdzić prawdziwe publiczne linki, dane operatora i brak placeholderów. Użyć czystych, przypiętych SHA web i app oraz zapisać fingerprint artefaktu, manifest wszystkich bajtów `dist` i wynik testów.
2. Potwierdzić tożsamość konta Firebase, projekt `patternly-app-sandbox`, site, uprawnienia do Hosting i obecny release ID. Przed zmianą utworzyć jednorazowy kanał podglądu dla rollbacku i sklonować obecną wersję live poleceniem `firebase hosting:clone patternly-app-sandbox:live patternly-app-sandbox:<rollback-channel> --project patternly-app-sandbox`. Odczytać kanał, zapisać jego ID, release ID i wynik. Jeśli live nie ma poprzedniego release, zapisać ten fakt i sprawdzić `firebase hosting:disable --help` jako osobną procedurę awaryjnego zatrzymania serwowania; nie przedstawiać jej jako przywrócenia wersji.
3. W osobno autoryzowanym kroku opublikować wyłącznie Hosting z dokładnego sprawdzonego `dist`. Po publikacji porównać zdalne `/`, `/privacy`, `/terms` i ich zawartość z manifestem oraz sprawdzić zdalne 404 dla `/admin`, `/admin/`, `/admin.html`, `/privacy-request` i podrzędnej ścieżki. Zapisać nowy release ID, czas, projekt/site i wynik.
4. Jeżeli odbiór zawiedzie, zatrzymać dalszy rollout i sklonować zapisany kanał rollbacku z powrotem na live: `firebase hosting:clone patternly-app-sandbox:<rollback-channel> patternly-app-sandbox:live --project patternly-app-sandbox`. Potwierdzić nowy release ID, treść `/` i negatywne trasy. Gdy nie było poprzedniego release, wykonać uprzednio sprawdzoną procedurę awaryjnego zatrzymania serwowania, a nie pozorny rollback. Sama instrukcja nie jest dowodem, że rollback zadziałał.

Stare digesty z 23.09 dotyczą poprzedniego builda i nie identyfikują bieżącego `dist`. Manifest lokalny z syntetycznymi danymi jest niewdrażalny i nie zastępuje manifestu produkcyjnego ani zdalnego odbioru.
