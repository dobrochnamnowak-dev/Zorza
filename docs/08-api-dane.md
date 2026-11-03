# API, konfiguracja i model danych

[Spis dokumentacji](../README.md)

## Prywatne API

| Operacja | Metoda i ścieżka |
| --- | --- |
| Stan sesji / logowanie / wylogowanie | GET session, POST login/logout pod `/api/` |
| Dane ekranów | GET `/api/dashboard` |
| Publikacje jednego podmiotu | GET `/api/instrument-articles?id=…` |
| Historia kursu | GET `/api/price-history?id=…&period=1d|1w|1y|5y` |
| Ustawienia | POST `/api/settings` |
| Obserwowanie / zakup / usunięcie zapisu | POST `/api/watch`, `/api/purchase`, `/api/purchase-delete` |
| Żądanie podsumowania / ręczne ponowienie | POST `/api/summarize`, `/api/retry` |
| Przeczytane / ważne / usunięcie artykułu | POST `/api/read`, `/api/article-star`, `/api/article-delete` |
| Dodatkowe doniesienia | POST `/api/article-research` |
| Czat | `/api/chat/status|login|message|stop` |
| Wdrożenie | GET `/api/deployment/status`; POST prepare/deploy |

Poza sesją i logowaniem API wymaga zalogowania. Mutacje wymagają zgodnego Origin. Cookies sesji mają HttpOnly, Secure w produkcji i SameSite=Strict. Odpowiedzi API nie trafiają do cache service workera. Prywatne API procesu worker i mostu dodatkowo używa tokenu; nie należy przekazywać go do przeglądarki.

## SQLite

`instruments` przechowuje katalog i obserwowane; `purchases` zapisy zakupów; `sources` kanały; `articles` tytuł, fragment, tłumaczenie, podsumowanie i powiązanie podmiotu; `revisions` historię treści; `jobs` i `runs` zlecenia oraz wykonania; `events` terminy i dowody; `headline_cache` gotowe tytuły; `price_history` serie wykresów; `quotes` ostatnie ceny; `meta` ustawienia, sloty i raporty; `sessions` sesje; `locks` blokady procesów.

Migracje są wykonywane przez kod. Produkcyjnej bazy nie dodaje się do Git. Dane przykładowe w testach są syntetyczne i nie uzupełniają braków w produkcji.

## Konfiguracja

`.env.example` dokumentuje nazwy zmiennych. `APP_PASSWORD_HASH` i `WORKER_TOKEN` można przygotować skryptem setup; sekretów nie umieszcza się w argumentach polecenia ani kodzie frontendu. Most potrzebuje własnego `CHAT_BRIDGE_TOKEN` i osobnego trwałego stanu konta ChatGPT. `DEPLOY_SOCKET` włącza dostęp backendu do zainstalowanego kontrolera.

Nazwy techniczne `sygnal.sqlite`, części skryptów i pakietu pochodzą z wcześniejszej nazwy projektu. Nie zmieniaj ich samodzielnie bez migracji; nazwa produktu to Zorza.
