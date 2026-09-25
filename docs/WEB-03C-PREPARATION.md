# WEB-03C/PREP — lokalne przygotowanie

**Stan 25.09.2026:** techniczny lokalny build `local-test` i kontrola granicy publicznego Hostingu przeszły. Nie było publikacji. `WEB-03C/PUBLISH` pozostaje osobnym zadaniem po rzeczywistych danych ODK-116-B.

## Powtarzalny dowód lokalny

W repo web uruchom `npm run prepare:web03c:local -- /tmp/patternly-web03c-local-manifest.json`. Skrypt wymaga czystych drzew app i web przed buildem, przypina oba HEAD-y, wywołuje `verify:local`, a następnie ponownie potwierdza, że HEAD-y i drzewa nie zmieniły się podczas pracy. Dopiero wtedy zapisuje SHA-256 i rozmiar każdego pliku `dist`, SHA konfiguracji Hosting i źródła prawnego aplikacji oraz wersję Node i SHA lockfile. Ścieżka manifestu musi znajdować się poza oboma repozytoriami. Manifest ma `sourceClean: true`, `mode: local-test` i `deployable: false`. Weryfikacja sprawdza dziewięć tracków, dokumenty testowe, brak kodu admin/privacy intake w publicznym buildzie oraz lokalne 404 dla `/admin*` i `/privacy-request*`.

Ostatni pełny przebieg należy odczytać z wygenerowanego manifestu w `/tmp`; dokumentacja nie utrwala digestów wcześniejszego `dist`. Po każdej zmianie źródeł manifest trzeba odtworzyć z czystych HEAD-ów. Testowy artefakt jest produkowany z `patternly/config/public-legal.release.json` przez app exporter i jawnie używa syntetycznych wartości. Nie stanowi danych do publikacji.

Konfiguracja wskazuje projekt i site `patternly-app-sandbox`, a Hosting publikuje wyłącznie `dist`. Lokalna konfiguracja nie dowodzi prawa dostępu ani bieżącego stanu zdalnego site. `firebase projects:list --json` (CLI 15.19.0) zakończyło się kodem 2, więc obecnie nie ma potwierdzonego dostępu do projektu ani identyfikatora poprzedniego release. Nie wykonano zdalnego rollbacku.

## Osobny WEB-03C/PUBLISH

1. Po ODK-116-B przygotować prawdziwy, zatwierdzony artefakt prawny. Produkcyjny build musi odrzucić `testOnly`; sprawdzić prawdziwe publiczne linki, dane operatora i brak placeholderów. Użyć czystych, przypiętych SHA web i app oraz zapisać fingerprint artefaktu, manifest wszystkich bajtów `dist` i wynik testów.
2. Potwierdzić tożsamość konta Firebase, projekt `patternly-app-sandbox`, site, uprawnienia do Hosting i obecny release ID. Przed zmianą utworzyć jednorazowy kanał podglądu dla rollbacku i sklonować obecną wersję live poleceniem `firebase hosting:clone patternly-app-sandbox:live patternly-app-sandbox:<rollback-channel> --project patternly-app-sandbox`. Odczytać kanał, zapisać jego ID, release ID i wynik. Jeśli live nie ma poprzedniego release, zapisać ten fakt i sprawdzić `firebase hosting:disable --help` jako osobną procedurę awaryjnego zatrzymania serwowania; nie przedstawiać jej jako przywrócenia wersji.
3. W osobno autoryzowanym kroku opublikować wyłącznie Hosting z dokładnego sprawdzonego `dist`. Po publikacji porównać zdalne `/`, `/privacy`, `/terms` i ich zawartość z manifestem oraz sprawdzić zdalne 404 dla `/admin`, `/admin/`, `/admin.html`, `/privacy-request` i podrzędnej ścieżki. Zapisać nowy release ID, czas, projekt/site i wynik.
4. Jeżeli odbiór zawiedzie, zatrzymać dalszy rollout i sklonować zapisany kanał rollbacku z powrotem na live: `firebase hosting:clone patternly-app-sandbox:<rollback-channel> patternly-app-sandbox:live --project patternly-app-sandbox`. Potwierdzić nowy release ID, treść `/` i negatywne trasy. Gdy nie było poprzedniego release, wykonać uprzednio sprawdzoną procedurę awaryjnego zatrzymania serwowania, a nie pozorny rollback. Sama instrukcja nie jest dowodem, że rollback zadziałał.

Stare digesty z 23.09 dotyczą poprzedniego builda i nie identyfikują bieżącego `dist`. Manifest lokalny z syntetycznymi danymi jest niewdrażalny i nie zastępuje manifestu produkcyjnego ani zdalnego odbioru.
