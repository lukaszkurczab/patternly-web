# WEB-03B — formularz privacy wyłącznie w aplikacji

**Wynik:** `done` lokalnie; WEB-03C (zdalny hosting) pozostaje osobnym zadaniem.

PO wybrał formularz gościa w aplikacji. W Settings gość może złożyć wniosek, wkleić kod z e-maila, odczytać status i odpowiedź oraz poprosić o nowy kod. Wniosek zalogowanego użytkownika nadal korzysta z dotychczasowej ścieżki konta. Publiczny web jest marketingowy, bez logowania, zarządzania kontem i formularza privacy; lokalny panel PO pozostaje odrębnym artefaktem.

Backend udostępnia cztery mobilne trasy `/v1/guest/privacy-requests*` pod App Check. Utworzenie zwraca `202` i identyfikator; ponowienie z tym samym kluczem i treścią zachowuje identyfikator i kod, a zmieniona treść daje `409`. Świadome ponowne wysłanie rotuje kod. Jednorazowy kod jest ważny 24 godziny, sesja odczytu 15 minut; starsze tokeny webowe nie przechodzą wymiany. Usunięto trzy trasy `/v1/public/privacy-requests*`, ich CORS, konfigurację originu i linki webowe z e-maili. Starszy wniosek można odszukać przez identyfikator i e-mail, aby otrzymać świeży kod aplikacyjny.

**Weryfikacja:** backend `lint`, `typecheck`, `openapi:check` (56 operacji), `frontend:client:check` (48 użytych) oraz pełny zestaw na emulatorach Firebase `172/172` PASS. Aplikacja `typecheck` PASS; `npm test`: `1205/1215` PASS, pozostałe 10 testów manifestu wymaga czystych repozytoriów i zostało uruchomionych przed commitami. Publiczny web `npm run verify:local` PASS, łącznie z negatywnymi trasami i kontrolą lokalnego panelu. `git diff --check` PASS. QA niezależnie wykrył i po poprawce zaakceptował semantykę idempotencji; jego własne uruchomienie emulatora ograniczył sandbox, a pełny zestaw emulatorowy uruchomił kontroler.

**Ograniczenia:** brak jeszcze dowodu z interakcji na fizycznym urządzeniu i ze zdalnie wdrożonego hostingu. Są to osobne bramki planu. Gdy SMTP nie dostarczy wiadomości, zapisany wniosek pozostaje oczekujący i użytkownik może ponowić wysłanie; odpowiedź `202` nie oznacza doręczenia.
