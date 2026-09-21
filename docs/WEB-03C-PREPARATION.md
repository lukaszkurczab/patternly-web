# WEB-03C — przygotowanie publikacji

**Stan:** oczekuje na zgodę PO i odnowienie sesji Firebase CLI. Brak publikacji.

- Docelowy projekt z `.firebaserc`: `patternly-app-sandbox`; Hosting `site` w `firebase.json`: `patternly-app-sandbox`, katalog `dist`.
- Źródło publicznego buildu: commit web `72faec75a0eabe17b42cac0663bac88ff7b05a28`; `npm run verify:local` PASS, w tym negatywne trasy administratora i privacy.
- SHA-256 lokalnego `dist/index.html`: `36731003b762d8aafc363d9ef6c1758620a144a1fda36142188c884512827199`.
- SHA-256 lokalnego `dist/assets/index-Bu9OYe8r.js`: `2808204a62bd67f10682db95142d0a991d7592b5ecd7281bb72b6da680e62639`.
- Odczyt nagłówków `https://patternly-app-sandbox.web.app/` zwrócił HTTP 404. Firebase CLI 15.19.0 wskazuje zalogowany adres, lecz żądanie `hosting:sites:list` zwróciło `Authentication Error: Your credentials are no longer valid`.

Po zgodzie PO i `firebase login --reauth`: potwierdzić projekt/site, przebudować dokładny commit, przypiąć digesty, zapisać poprzedni release lub jego brak, opublikować wyłącznie Hosting, sprawdzić zdalne `/`, `/admin*`, `/privacy-request*`, porównać artefakty i zapisać rollback oraz raport WEB-03C. Nie traktować samego lokalnego buildu jako dowodu wdrożenia.
