# EPIC-05 — pozostałe wdrożenie hosted web

**Źródło kolejności:** `../../docs/PATTERNLY-WORKING-PLAN.md`. Ten pakiet doprecyzowuje WEB-03C i nie zmienia decyzji PO.

Publiczny build zawiera wyłącznie stronę marketingową z dziewięcioma trackami. Panel administratora działa lokalnie na loopback z Firebase Authentication, autoryzacją backendu i emulatorami. Wnioski o dane i prywatność zaczynają się w aplikacji mobilnej.

## WEB-03C — wdrożenie i zdalna weryfikacja (`planned`)

- **Cel:** publiczny hosting serwuje wyłącznie zweryfikowany artefakt marketingowy.
- **Zakres:** po zgodzie PO opublikować przypięty `dist`, sprawdzić zdalne `/`, `/admin*` i `/privacy-request*`, porównać digesty artefaktu z lokalnym buildem i zapisać rollback.
- **Poza zakresem:** nowa funkcjonalność mobilna i panel hostowany.
- **Wejście:** zgoda na publikację, właściwy projekt Firebase Hosting i odnowiona sesja Firebase CLI; [przygotowanie](WEB-03C-PREPARATION.md).
- **Akceptacja:** zdalna strona pokazuje dziewięć tracków; trasy admin/privacy nie są dostępne; raport wiąże wynik z dokładnym buildem i projektem.
- **Weryfikacja:** direct HTTP checks, manifest builda i raport WEB-03C.
- **Ryzyko:** lokalne testy nie dowodzą aktualnej zawartości hostingu.
