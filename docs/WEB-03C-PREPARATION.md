# WEB-03C — przygotowanie publikacji

**Stan:** zgoda PO na marketingową publikację w `patternly-app-sandbox` została udzielona 22 września 2026. Nie opublikowano. Lokalny slice katalogu przeszedł weryfikację; publikacja pozostaje zablokowana przez brak dokładnych, prawdziwych treści/linków PO-116 oraz nieważne Firebase CLI credentials.

- Projekt/site z `.firebaserc` i `firebase.json`: `patternly-app-sandbox`; katalog Hosting `dist`.
- Repo web HEAD przed lokalnymi zmianami: `3465fdb3a767055bf26a65bc015e3d56c4ae871a`; źródło kontraktu katalogu: mobile `patternly` HEAD `80ec9db0316ebae8af29987377d19d5008509acd`, plik `src/domain/tracks/trackRegistry.ts`.
- Lokalna zmiana wyrównała dziewięć publicznych track ID/tytułów i pięć not niezależnościowych dla certyfikacji. `npm run verify:local` PASS; lokalne Vite na porcie 5173 zachowano.
- SHA-256 lokalnego `dist/index.html`: `d6dc82cf490870a83613e5939cc165c07f3f21eb1a14c916c2541e02fc05169e`.
- SHA-256 `dist/assets/index-DU4bLOKV.css`: `44e387155ae855526fd11b54a6c8f6589f97827bcf18de189a57c4f5e97df024`.
- SHA-256 `dist/assets/index-CnyuTZ-Z.js`: `1aceb2f45fb4580a1753196b4e9cda00cb14daa5f59fa7b2f346e9e73bb1aedb`.
- Weryfikacja 23 września 2026: publiczny root zwraca HTTP 404. Firebase CLI 15.19.0 rozpoznaje site, lecz `hosting:sites:list` kończy się `Authentication Error: Your credentials are no longer valid` (exit 2).
- ODK-116 nadal blokuje prawdziwe publiczne Privacy/Terms/Support linki i końcowe informacje operatora. Nie dodawać fikcyjnych adresów ani placeholderów. Nie sprawdzono wizualnie zrzutów: brak lokalnego Chromium Playwright, a runtime CUA nie startował; strona została skierowana do wbudowanego panelu, ale wynik wyświetlenia nie jest potwierdzeniem odbioru.

Po dostarczeniu ODK-116 i odnowieniu Firebase CLI: dodać/weryfikować publiczne read-only informacje; odświeżyć dokładny build i digesty; potwierdzić projekt/site oraz poprzedni release lub jego brak; dopiero wówczas wykonać osobno autoryzowaną publikację wyłącznie Hosting, sprawdzić zdalne `/`, `/admin*`, `/privacy-request*`, porównać artefakty, zachować rollback i uzupełnić raport WEB-03C. Lokalny build nie dowodzi zdalnego wdrożenia.
