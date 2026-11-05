# API, konfiguracja i model danych

[Spis dokumentacji](../README.md)

## Prywatne API

| Operacja | Metoda i ścieżka |
| --- | --- |
| Stan sesji / logowanie / wylogowanie | GET session, POST login/logout pod `/api/` |
| Dane ekranów / wspólne kursy listy i profilu | GET `/api/dashboard`, GET `/api/quotes` |
| Lekkie widoki | GET `/api/dashboard?view=overview`, `view=calendar`, `view=settings` |
| Opis i brief / odczyt / ręczna korekta | GET `/api/insight?id=…`; POST `/api/insight-read`, `/api/insight-retry` |
| Wielowpisowe komentarze | GET `/api/instrument-comments?id=…`; POST `/api/instrument-comments` (dodanie lub `delete_id`) |
| Dawne ponowienie tłumaczenia tytułu | POST `/api/title-retry` — 410, funkcja wyłączona |
| Publikacje jednego podmiotu | GET `/api/instrument-articles?id=…` |
| Historia kursu | GET `/api/price-history?id=…&period=1d\|1w\|1y\|5y` |
| Ustawienia | POST `/api/settings` |
| Obserwowanie / zakup / usunięcie zapisu | POST `/api/watch`, `/api/purchase`, `/api/purchase-delete` |
| Starsze streszczenia — do wyłączenia | POST `/api/summarize`, `/api/retry`; istnieją w kodzie, wycofane z zakresu produktu |
| Przeczytane / ważne / usunięcie artykułu | POST `/api/read`, `/api/article-star`, `/api/article-delete` |
| Dodatkowe doniesienia | POST `/api/article-research` |
| Czat | `/api/chat/status`, `/api/chat/login`, `/api/chat/message`, `/api/chat/stop` |
| Synchronizacja czatu | GET `/api/chat/status?sync=1&cursor=…`; sam stan połączenia GET `/api/chat/status?meta=1` |
| Wdrożenie | GET `/api/deployment/status`; POST prepare/deploy |

Poza sesją i logowaniem API wymaga zalogowania. Mutacje wymagają zgodnego Origin. Cookies sesji mają HttpOnly, Secure w produkcji i SameSite=Strict. Odpowiedzi API nie trafiają do cache service workera. Prywatne API procesu worker i mostu dodatkowo używa tokenu; nie należy przekazywać go do przeglądarki.

Od 5 listopada frontend używa lekkich widoków. `omitted` oznacza pola pominięte w odpowiedzi; klient zachowuje wcześniej pobrane dane zamiast traktować brak jako usunięcie. `insight_summaries` odróżnia metadane od pełnej treści opisu. Profil doczytuje pełny zapis przez `/api/insight` i `/api/instrument-articles`. Bez parametru `view` dashboard nadal zwraca pełny kontrakt.

Wariant `sync=1` zwraca `sync` z `cursor`, `reset`, pełną kolejnością identyfikatorów `order` i nowymi/zmienionymi `messages`. Nieznana lub stara sesja synchronizacji daje pełny reset. Odczyt bez parametrów zachowuje stary pełny format, a `meta=1` pomija historię. Szczegóły: [SPEC, sekcja 14](../SPEC.md#14-optymalizacja-transportu--zmiana-5-listopada-2026).

## SQLite

`instruments` przechowuje katalog i obserwowane; `purchases` zapisy zakupów; `sources` kanały; `articles` tytuł, fragment, tłumaczenie, podsumowanie i powiązanie podmiotu; `revisions` historię treści; `jobs` i `runs` zlecenia oraz wykonania; `events` terminy i dowody; `headline_cache` historyczne tłumaczenia (wyłączone); `price_history` serie wykresów; `quotes` ostatnie ceny; `meta` ustawienia, sloty i raporty; `sessions` sesje; `locks` blokady procesów.

`company_insights` przechowuje opis i datę rzeczywistego wygenerowania, `insight_jobs` wersjonowane zadania, `brief_monitors` osobisty zakres, `brief_seen` przetworzone materiały, `brief_entries` przyrostowe punkty ważne sześć miesięcy. `instrument_comments` zawiera wielowpisowe komentarze. Terminy mają `date_precision` i opcjonalne `event_end_date`; podany miesiąc/półrocze nie jest konkretnym dniem.

Migracje są wykonywane przez kod. Produkcyjnej bazy nie dodaje się do Git. Dane przykładowe w testach są syntetyczne i nie uzupełniają braków w produkcji.

Przy pierwszym użyciu czytnik tworzy `article_page_cache`: `url` jako klucz, `etag`, `modified`, `content_text` i `checked_at`. Cache współdzieli odczyty w cyklu i wymaga weryfikacji źródła w kolejnym; nie przesuwa dat publikacji ani notowań.

## Konfiguracja

`.env.example` dokumentuje nazwy zmiennych. `APP_PASSWORD_HASH` i `WORKER_TOKEN` można przygotować skryptem setup; sekretów nie umieszcza się w argumentach polecenia ani kodzie frontendu. Most potrzebuje własnego `CHAT_BRIDGE_TOKEN` i osobnego trwałego stanu konta ChatGPT. `DEPLOY_SOCKET` włącza dostęp backendu do zainstalowanego kontrolera.

Nazwy techniczne `sygnal.sqlite`, części skryptów i pakietu pochodzą z wcześniejszej nazwy projektu. Nie zmieniaj ich samodzielnie bez migracji; nazwa produktu to Zorza.
