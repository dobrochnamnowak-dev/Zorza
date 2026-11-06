# Zorza

Prywatna aplikacja PWA na telefon do śledzenia akcji i ETF-ów. Łączy notowania, wykresy, zagraniczne publikacje, sytuację podmiotu, przyrostowy brief i kalendarz. Dane zbiera serwer, więc komputer nie musi być włączony.

## Dokumentacja

| Dokument | Zawartość |
| --- | --- |
| [One-pager](ONE-PAGER.md) | Cel aplikacji, najważniejsze funkcje i zasady korzystania |
| [PRD](PRD.md) | Aktualne wymagania produktu, zakres i kryteria odbioru |
| [SPEC](SPEC.md) | Architektura, dane, API, harmonogramy, testy i wdrażanie |

Dokumenty opisują jedną aktualną wersję produktu. Wcześniejsze wersje i decyzje są dostępne w historii Git. [AGENTS.md](AGENTS.md) zawiera krótkie instrukcje pracy nad kodem i dokumentacją.

## Uruchomienie lokalne

Wymagany **Node.js 24** z wbudowanym SQLite. Aplikacja nie wymaga instalowania zależności npm.

```sh
DEV_MODE=1 PORT=4173 node server.mjs
node --test test/*.test.mjs
```

Podgląd: `http://127.0.0.1:4173`. Konfigurację opisuje [.env.example](.env.example). Tryb `DEV_MODE=1` służy wyłącznie pracy lokalnej; produkcja wymaga HTTPS, logowania i trwałego katalogu danych poza kodem.

## Układ kodu

```text
public/            interfejs PWA, logo, ikony i wykresy
lib/               dane, źródła, SQLite, harmonogramy i kolejki
scripts/           most Codexa i opracowania AI
server.mjs         prywatne API i procesy aplikacji
catalog.json       katalog zatwierdzonych instrumentów
quote-sources.json potwierdzone mapowania notowań
sources.json       generowany zapis źródeł publikacji
deployment/        kontroler wdrożeń i szablony administratora
test/              testy bez rzeczywistych wywołań AI
```

Dane portfela, hasła, historia czatu i konfiguracja produkcyjna pozostają poza repozytorium. Informacja o autorze i licencji fotografii jest w [aurora-photo-credit.txt](public/aurora-photo-credit.txt).

GitHub przechowuje kod i dokumentację. Zmiana repozytorium nie wdraża automatycznie aplikacji na VPS. Ostatnią udokumentowaną weryfikację wdrożenia opisuje [SPEC](SPEC.md#13-weryfikacja-i-bramki-kolejnego-wydania).
