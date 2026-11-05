# Zorza

Prywatna aplikacja PWA na telefon do obserwowania akcji i ETF-ów: notowania, wykresy, zagraniczne publikacje, komunikaty emitentów, terminy oraz czat z Codexem.

Dokumentacja opisuje wdrożenie sprawdzone **5 listopada 2026** i późniejszą korektę zakresu: brief zastępuje osobne streszczenia artykułów. Wyłączenie osobnych streszczeń wdrożono i sprawdzono; [stan wdrożenia](docs/19-brief-zamiast-podsumowan.md). Kod pochodzi z działającej aplikacji. Dane portfela, hasła i konfiguracja produkcyjna nie należą do repozytorium.

## Zacznij tutaj

| Potrzeba | Dokument |
| --- | --- |
| Wycofanie osobnych streszczeń na rzecz briefu — decyzja i stan kodu | [Tylko brief](docs/19-brief-zamiast-podsumowan.md) |
| Cel, odbiorczyni, funkcje i granice produktu na jednej stronie | [Zorza — one-pager](ONE-PAGER.md) |
| Wymagania produktu, scenariusze i kryteria odbioru | [PRD](PRD.md) |
| Kontrakty techniczne, dane, API i automatyzacja | [SPEC](SPEC.md) |
| Optymalizacja czatu, odczytów artykułów i Startu | [Etap 1 — transport](docs/18-optymalizacja-transportu.md) |
| Jak korzystać z aplikacji na iPhonie | [Obsługa](docs/01-obsluga.md) |
| Co działa, a co pozostaje do zrobienia | [Funkcje i zakres](docs/02-produkt.md), [Plan rozwoju](docs/10-plan-rozwoju.md) |
| Jak zbudowany jest system | [Architektura](docs/03-architektura.md) |
| Skąd pochodzą ceny i wykresy | [Notowania i historia](docs/04-notowania.md) |
| Publikacje, źródła i brief | [Publikacje i AI](docs/05-publikacje-ai.md) |
| Nowy układ, sytuacja podmiotu i brief | [Sytuacja i brief — zmiana 4 listopada](docs/13-sytuacja-i-brief.md) |
| Warunki jakości opisu i diagnoza pustego briefu / kursów | [Standard i diagnoza](docs/14-standard-opisu-i-diagnoza.md) |
| Model, kalendarze emitentów i terminy częściowe | [Kalendarz i model](docs/15-kalendarz-i-model.md), [Harmonogram i opisy](docs/16-harmonogram-i-opracowania.md) |
| Oryginalne nagłówki i wyłączenie tłumaczeń | [Nagłówki publikacji](docs/17-oryginalne-naglowki.md) |
| Aktualizacje i ważne terminy | [Harmonogram i kalendarz](docs/06-harmonogram-kalendarz.md) |
| Hostinger, wdrażanie i cofanie wersji | [Wdrożenie](docs/07-wdrozenie.md) |
| API, SQLite i konfiguracja | [Interfejsy i dane](docs/08-api-dane.md) |
| Testy i rozwiązywanie problemów | [Testy i diagnostyka](docs/09-testy-diagnostyka.md) |
| Uzgodnione zasady i zużycie AI | [Decyzje i koszty](docs/11-decyzje-koszty.md) |
| Prompty i instrukcje dla Codexa | [Prompty](docs/prompty/README.md), [AGENTS.md](AGENTS.md) |
| Logo, ikony i fotografia zorzy | [Materiały wizualne](docs/12-materialy-wizualne.md) |

## Najważniejsze funkcje

- Akcje i ETF-y, osobno kupione i obserwowane; zakupy zapisują ilość, cenę, walutę i datę.
- Notowania oraz wykresy **1D / 1T / 1R / 5L** z odczytem ceny i daty.
- Publikacje w profilach: zagraniczne źródła branżowe i osobna kategoria komunikatów emitentów.
- Oryginalne nagłówki i linki do źródeł; ich opracowanie po polsku jest w briefie, bez osobnych streszczeń artykułów w zakresie produktu.
- Słowna Sytuacja firmy i przyrostowy brief pod wykresem, tylko dla obserwowanych lub portfela.
- Terminy zapisane w kalendarzu aplikacji z dowodem źródłowym i oznaczeniem niepewności.
- Czat z Codexem, dołączanie zdjęć i zatwierdzane przez właścicielkę wdrażanie backendu.

**Harmonogram, Europe/Warsaw:** kursy całej dostępnej listy o 15:40 i 21:45; dodatkowo obserwowane i portfel o 18:30. Publikacje i terminy tylko wybranych podmiotów codziennie o 15:40. Opisy i briefy: poniedziałek i czwartek 14:30; pierwszy opis po dodaniu obserwowania lub zakupu. Zadania wykonuje VPS, więc komputer nie musi być włączony.

Ostatnie potwierdzone wdrożenie: `4585972331e64c66aa95c672bab3c14f` — wyłączenie osobnych streszczeń artykułów, 5 listopada 2026, 14:14:14 czasu polskiego. Przeszło 121 testów aplikacji; na produkcji sprawdzono blokady API, worker i most, widok mobilny oraz niezmienione harmonogramy. Szczegóły: [stan wdrożenia](docs/19-brief-zamiast-podsumowan.md). Wcześniejsze optymalizacje pozostają aktywne ([pomiary](docs/18-optymalizacja-transportu.md)). Dalsze zmiany kodu w repozytorium wymagają osobnego wdrożenia.

Start pobiera dane potrzebne do widoku, a profil doczytuje pełny opis i publikacje. Czat przesyła przyrostowo zmienione wiadomości. Publikacje i kalendarz współdzielą odczyt artykułu w jednym cyklu, a kolejny cykl ponownie sprawdza źródło. Oszczędności nie zmieniają godzin, modeli ani zakresu danych.

## Uruchomienie lokalne

Wymagany **Node.js 24** z wbudowanym SQLite. Aplikacja nie wymaga instalowania zależności npm.

```sh
DEV_MODE=1 PORT=4173 node server.mjs
node --test test/*.test.mjs
```

Podgląd: `http://127.0.0.1:4173`. Ten tryb służy wyłącznie pracy lokalnej. Produkcja wymaga HTTPS, logowania i trwałego katalogu danych poza kodem.

Przed uruchomieniem zapoznaj się z [konfiguracją](.env.example). W produkcji nie kopiuj pliku przykładowego bez uzupełnienia sekretów.

## Układ kodu

```text
public/       interfejs PWA, logo, ikony, wykresy
lib/          dane, źródła, SQLite, harmonogramy, kolejki
scripts/      most Codexa, opracowania AI, konfiguracja
server.mjs    prywatne API i procesy aplikacji
catalog.json  katalog zatwierdzonych instrumentów
quote-sources.json  potwierdzone mapowania notowań
sources.json  generowany zapis źródeł publikacji
deployment/   kontroler wdrożeń i szablony administratora
test/         testy bez rzeczywistych wywołań AI
docs/         uporządkowana wiedza o projekcie
```

## Granice obecnej wersji

Kalendarz działa w Zorzy; pojedyncze wydarzenie można wyeksportować do pliku ICS. Pokrycie notowań i terminów zależy od potwierdzonych mapowań oraz dostępności źródeł; braków nie uzupełnia się przykładowymi danymi. GitHub przechowuje kod i dokumentację; sam push nie wdraża aplikacji na VPS.
