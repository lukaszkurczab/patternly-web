# WEB-03B — kontrakt guest privacy przed usunięciem publicznego API

**Status:** kanał zatwierdzony przez PO: formularz wyłącznie w aplikacji. Kontrakt techniczny zatwierdzony; implementacja jest w retestach. Ten dokument nie zmienia kanonicznej kolejności w `../../docs/PATTERNLY-WORKING-PLAN.md`.

## Potwierdzone fakty

- BE-DEC-003 wymaga, by wszystkie wnioski użytkownika zaczynały się w mobilnym Settings. Gość może zgłosić dane utworzone przez funkcje sieciowe, a weryfikacja ma wracać do aplikacji lub odbywać się innym sposobem bez webowego formularza/odpowiedzi.
- Authenticated aplikacja używa `/v1/privacy-requests`; gość ma formularz, weryfikację kodu i odczyt odpowiedzi w `Settings`.
- Backend usuwa `/v1/public/privacy-requests`, `/session`, `/response`, `PUBLIC_PRIVACY_ORIGIN` i linki e-mail do webu. Lokalna kolejka PO zostaje.
- Decyzja APPCHK wymaga App Check dla chronionych żądań mobilnych, także gościa. ODK-116 blokuje prawdziwy kontakt operatora/wspierającego.

## Decyzja PO

PO wybrał formularz w aplikacji. Publiczny web ma pozostać marketingowy, bez logowania i zarządzania kontem. Weryfikacja i odpowiedzi dotyczące wniosku gościa również muszą odbywać się bez webowego formularza lub sesji.

## Rozpatrzone kanały

Rozpatrzono dwa kanały gościa:

1. Formularz w Settings: API mobilne pod App Check, weryfikacja e-mail wracająca do aplikacji, jawne stany unavailable/retry i idempotencja.
2. E-mail inicjowany z Settings na rzeczywisty adres operatora, z ręczną obsługą i odpowiedzią e-mail, bez webowego tokenu/sesji. Trzeba potwierdzić, czy otwarcie klienta pocztowego spełnia wymaganie „in-app” BE-DEC-003 i jak aplikacja sygnalizuje wynik, którego nie może potwierdzić.

Wybrano wariant 1. Wariant 2 nie jest ścieżką produktową.

## Wymagania niezależne od wyboru

- Zachować authenticated `/v1/privacy-requests` i stany konta ustalone w EPIC-03.
- Gość widzi rzeczywisty zakres danych lokalnych i sieciowych, a reset lokalny pozostaje oddzielną operacją.
- Brak webowego intake, token exchange i response delivery po migracji. Publiczne endpointy, CORS, email linki, OpenAPI, testy i dokumentacja znikają w jednym zweryfikowanym slice.
- Lokalny admin zachowuje autoryzowaną kolejkę; produkcyjne admin API pozostaje niedostępne zgodnie z WEB-02.
- Testy obejmują gościa, authenticated, unavailable/retry, App Check lub ręczny kanał e-mail zgodnie z decyzją, oraz negatywne direct requests do usuniętych endpointów.

## Zatwierdzony kontrakt techniczny formularza

- Formularz gościa w Settings wysyła żądanie mobilne pod App Check. Odpowiedź `202` oznacza tylko zapis i oczekiwanie na potwierdzenie e-mail; zawiera stabilny `requestId`. `clientRequestId` UUID wiąże ponowienia z tym samym wnioskiem i nie tworzy drugiej sprawy. Powtórka z innym payloadem jest błędem.
- E-mail zawiera jeden kod do wklejenia w aplikacji: `pr_<UUID>.<43-znakowy token base64url>`. Token ma 256 bitów losowości, jest ważny 24 godziny i może być wymieniony tylko raz na sesję przypisaną do wniosku, ważną 15 minut. Aplikacja nie zapisuje sesji trwale. Brak, zły, wygasły i użyty kod zwracają jednolite `404`; limity prób są przypisane do wniosku i IP.
- Ponowne wysłanie przyjmuje `requestId` i e-mail, a zawsze zwraca jednolite `202` po kontroli globalnej gotowości. Dla pasującego wniosku nowy kod unieważnia poprzedni. Limity obejmują IP, e-mail i wniosek. Status dostarczenia e-maila nie pojawia się w odpowiedzi. Globalnie nieskonfigurowany SMTP zwraca jednolite `503` przed sprawdzaniem istnienia wniosku.
- SMTP może dostarczyć więcej niż jedną wiadomość po niejednoznacznym timeout; działa tylko najnowszy kod. Aplikacja komunikuje „sprawdź najnowszą wiadomość” i pozwala ponowić, nie potwierdza dostarczenia. Po przedłużeniu lub dostarczeniu odpowiedzi przychodzi świeży kod; sama odpowiedź pozostaje dostępna tylko w aplikacji po weryfikacji.
- Migracja: starsze wiadomości zawierają `requestId`. Użytkownik może wpisać ten identyfikator i e-mail w aplikacji, otrzymać nowy kod i odczytać istniejącą sprawę. Stary token webowy nie jest akceptowany w nowej trasie. Test obejmuje tę ścieżkę przed usunięciem browser API, CORS, konfiguracji i linków.

Walidacja samego briefu: `gpt-5.6-luna/max`, minimum 0,83 (spójność 0,93; prostota 0,83; ryzyko 0,89; utrzymanie 0,87). Implementacja i QA pozostają otwarte.

## Warunek zamknięcia WEB-03B

Retest formularza mobilnego, backendu, usuniętych tras i publicznego buildu webu. Po pozytywnej niezależnej ocenie przejść do WEB-03C (wdrożenie i zdalny test hostingu). Do zakończenia WEB-03C WEB-03 i EPIC-05 pozostają `partial`.
