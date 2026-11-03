# Zorza

Prywatna aplikacja PWA na telefon do obserwowania akcji i ETF-ów: notowania, wykresy, zagraniczne publikacje, komunikaty emitentów, terminy oraz czat z Codexem.

Dokumentacja przedstawia stan sprawdzony **3 listopada 2026**. Kod pochodzi z działającej aplikacji. Dane portfela, hasła i konfiguracja produkcyjna nie należą do repozytorium.

## Zacznij tutaj

| Potrzeba | Dokument |
| --- | --- |
| Jak korzystać z aplikacji na iPhonie | [Obsługa](docs/01-obsluga.md) |
| Co działa, a co pozostaje do zrobienia | [Funkcje i zakres](docs/02-produkt.md), [Plan rozwoju](docs/10-plan-rozwoju.md) |
| Jak zbudowany jest system | [Architektura](docs/03-architektura.md) |
| Skąd pochodzą ceny i wykresy | [Notowania i historia](docs/04-notowania.md) |
| Publikacje, źródła i podsumowania | [Prasówka i AI](docs/05-publikacje-ai.md) |
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
- Prasówka: zagraniczne źródła branżowe i osobna kategoria komunikatów emitentów.
- Polskie nagłówki dla obserwowanych i portfela; podsumowania po polsku wyłącznie na żądanie.
- Terminy zapisane w kalendarzu aplikacji z dowodem źródłowym i oznaczeniem niepewności.
- Czat z Codexem, dołączanie zdjęć i zatwierdzane przez właścicielkę wdrażanie backendu.

**Codziennie, czas polski:** 15:40 — kursy, publikacje i terminy; 21:45 — ponownie kursy. Zadania wykonuje VPS, więc komputer nie musi być włączony.

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

Powiadomienia push i automatyczna synchronizacja z Kalendarzem Apple nie są uruchomione. Dostępny jest eksport ICS. Pokrycie notowań i terminów zależy od potwierdzonych mapowań oraz dostępności źródeł; braków nie uzupełnia się przykładowymi danymi. GitHub przechowuje kod i dokumentację; sam push nie wdraża aplikacji na VPS.
