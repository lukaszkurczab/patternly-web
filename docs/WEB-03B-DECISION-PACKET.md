# WEB-03B — kontrakt guest privacy przed usunięciem publicznego API

**Status:** kanał zatwierdzony przez PO: formularz wyłącznie w aplikacji. Kontrakt techniczny i implementacja pozostają otwarte. Ten dokument nie zmienia kanonicznej kolejności w `../../docs/PATTERNLY-WORKING-PLAN.md`.

## Potwierdzone fakty

- BE-DEC-003 wymaga, by wszystkie wnioski użytkownika zaczynały się w mobilnym Settings. Gość może zgłosić dane utworzone przez funkcje sieciowe, a weryfikacja ma wracać do aplikacji lub odbywać się innym sposobem bez webowego formularza/odpowiedzi.
- Authenticated aplikacja używa `/v1/privacy-requests`; gość w `YourDataScreen` ma `guestSupport`, który otwiera skonfigurowany `supportUrl` HTTPS. Nie jest to in-app formularz ani dowód wysłania i potwierdzenia wniosku.
- Backend nadal ma `/v1/public/privacy-requests`, `/session`, `/response`, `PUBLIC_PRIVACY_ORIGIN`, linki e-mail do `/privacy-request/<id>#token=...` i lokalną kolejkę PO. Publiczny web usunięto z builda w WEB-01; samo API pozostaje legacy.
- Decyzja APPCHK wymaga App Check dla chronionych żądań mobilnych, także gościa. ODK-116 blokuje prawdziwy kontakt operatora/wspierającego.

## Decyzja PO

PO wybrał formularz w aplikacji. Publiczny web ma pozostać marketingowy, bez logowania i zarządzania kontem. Weryfikacja i odpowiedzi dotyczące wniosku gościa również muszą odbywać się bez webowego formularza lub sesji.

## Rozpatrzone kanały

Wybrać dokładnie jeden kanał gościa:

1. Formularz w Settings: API mobilne pod App Check, weryfikacja e-mail wracająca do aplikacji, jawne stany unavailable/retry i idempotencja.
2. E-mail inicjowany z Settings na rzeczywisty adres operatora, z ręczną obsługą i odpowiedzią e-mail, bez webowego tokenu/sesji. Trzeba potwierdzić, czy otwarcie klienta pocztowego spełnia wymaganie „in-app” BE-DEC-003 i jak aplikacja sygnalizuje wynik, którego nie może potwierdzić.

Wybrano wariant 1. Wariant 2 nie jest ścieżką produktową.

## Wymagania niezależne od wyboru

- Zachować authenticated `/v1/privacy-requests` i stany konta ustalone w EPIC-03.
- Gość widzi rzeczywisty zakres danych lokalnych i sieciowych, a reset lokalny pozostaje oddzielną operacją.
- Brak webowego intake, token exchange i response delivery po migracji. Publiczne endpointy, CORS, email linki, OpenAPI, testy i dokumentacja znikają w jednym zweryfikowanym slice.
- Lokalny admin zachowuje autoryzowaną kolejkę; produkcyjne admin API pozostaje niedostępne zgodnie z WEB-02.
- Testy obejmują gościa, authenticated, unavailable/retry, App Check lub ręczny kanał e-mail zgodnie z decyzją, oraz negatywne direct requests do usuniętych endpointów.

## Warunek rozpoczęcia usuwania API

Zatwierdzony kontrakt gościa, działająca implementacja mobilna/backendowa i przechodzący retest dla rzeczywistego kanału. Dopiero wtedy usunąć public-browser API i przejść do WEB-03C (wdrożenie i zdalny test hostingu). Do tego czasu WEB-03 i EPIC-05 pozostają `partial`.
