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

## Pliki projektu

Poniższe opisy dotyczą plików śledzonych przez Git. Makiety i zrzuty ekranów przechowywane lokalnie poza katalogiem repozytorium nie są jego częścią.

### Dokumenty i konfiguracja główna

| Plik | Rola |
| --- | --- |
| [README.md](README.md) | Punkt wejścia: uruchomienie, mapa plików i granice repozytorium. |
| [ONE-PAGER.md](ONE-PAGER.md) | Jednostronicowy opis celu, funkcji i zasad działania produktu. |
| [PRD.md](PRD.md) | Aktualne wymagania, scenariusze i kryteria odbioru. |
| [SPEC.md](SPEC.md) | Kontrakty techniczne, model danych, harmonogram, testy i wdrożenie. |
| [AGENTS.md](AGENTS.md) | Zasady pracy nad projektem dla Codexa. |
| [package.json](package.json) | Wymagana wersja Node.js i polecenia uruchomienia, testów oraz zbierania danych. |
| [.env.example](.env.example) | Wzór zmiennych środowiskowych, bez sekretów produkcyjnych. |
| [.gitignore](.gitignore), [.dockerignore](.dockerignore) | Wyłączenia plików lokalnych odpowiednio z Git i kontekstu budowy obrazu. |
| [Dockerfile](Dockerfile), [Dockerfile.chat](Dockerfile.chat) | Obrazy aplikacji i oddzielnego mostu czatu. |
| [server.mjs](server.mjs) | Prywatne API, sesje, udostępnianie interfejsu, harmonogram i obsługa zadań. |
| [catalog.json](catalog.json) | Zatwierdzony katalog spółek i ETF-ów. |
| [quote-sources.json](quote-sources.json) | Potwierdzone mapowania instrumentów na źródła notowań. |
| [sources.json](sources.json) | Zapis źródeł publikacji używany przez proces ich zbierania. |

### Interfejs `public/`

| Plik | Rola |
| --- | --- |
| [index.html](public/index.html) | Struktura strony i punkt wejścia PWA. |
| [app.js](public/app.js) | Widoki, nawigacja, profil instrumentu, formularze i komunikacja z API. |
| [style.css](public/style.css) | Wygląd i układ na telefonie, w tym stany interakcji. |
| [portfolio.js](public/portfolio.js) | Obliczenia portfela, filtrowanie publikacji i scalanie danych instrumentów. |
| [price-chart.js](public/price-chart.js) | Geometria i obsługa interaktywnego wykresu cen. |
| [company-insights.js](public/company-insights.js) | Wyświetlanie Sytuacji, briefu, źródeł i terminów. |
| [data-sync.js](public/data-sync.js) | Scalanie przyrostowych odpowiedzi czatu i lekkich widoków dashboardu. |
| [card-dismiss.js](public/card-dismiss.js) | Zamykanie kart gestem i przyciskiem z uwzględnieniem ograniczonego ruchu. |
| [sw.js](public/sw.js) | Pamięć podręczna publicznych plików powłoki PWA. |
| [manifest.webmanifest](public/manifest.webmanifest) | Nazwa aplikacji, ikony i sposób uruchamiania po instalacji. |
| [icon.svg](public/icon.svg), [icon-192.png](public/icon-192.png), [icon-512.png](public/icon-512.png), [apple-touch-icon.png](public/apple-touch-icon.png) | Znak Zorzy i ikony instalacyjne dla przeglądarki oraz iPhone'a. |
| [aurora-photo.jpg](public/aurora-photo.jpg), [aurora-photo-credit.txt](public/aurora-photo-credit.txt) | Fotografia używana przez interfejs i informacja o jej pochodzeniu. |
| `public/logos/AKCJA-*.png`, `public/logos/ETF-*.png` | Logotypy instrumentów indeksowane identyfikatorem z katalogu. |

### Logika serwera `lib/`

| Plik | Rola |
| --- | --- |
| `store.mjs` | Schemat i migracje SQLite, zapis oraz odczyt danych aplikacji. |
| `core.mjs` | Wspólne funkcje normalizacji, identyfikacji i analizy publikacji. |
| `settings.mjs` | Walidacja ustawień oraz wyznaczanie terminów cyklicznych zadań. |
| `quotes.mjs`, `price-history.mjs`, `personal-prices.mjs` | Pobieranie i weryfikacja notowań, historia wykresów oraz dodatkowy cykl cen osobistych. |
| `us-session.mjs` | Wyznaczanie sesji rynku amerykańskiego potrzebnej harmonogramowi notowań. |
| `publication-policy.mjs` | Dobór dozwolonych źródeł i kontrola powiązania publikacji z instrumentem. |
| `issuer-sources.mjs`, `issuer-calendar.mjs` | Zaufane domeny emitentów, adresy kalendarzy i odczyt wydarzeń z ich stron. |
| `collector.mjs` | Pobieranie i zapisywanie publikacji ze źródeł. |
| `article-access.mjs`, `article-text.mjs`, `article-content.mjs` | Ocena dostępności tekstu i wyodrębnianie treści artykułu. |
| `article-reader.mjs` | Wspólny odczyt artykułów, walidatory HTTP i pamięć treści w jednym cyklu. |
| `article-research.mjs` | Jednorazowe szukanie dodatkowych materiałów dla wskazanego artykułu. |
| `publication-work.mjs` | Obsługa zgodności ze starymi zadaniami publikacji bez generowania osobnych streszczeń. |
| `company-insights.mjs`, `brief-monitor.mjs` | Zadania Sytuacji i przyrostowego briefu, ich walidacja, zapis i ważność. |
| `calendar-fetch.mjs`, `event-extraction.mjs`, `event-windows.mjs` | Pobieranie, rozpoznawanie i zapis terminów oraz przedziałów dat. |
| `deployment.mjs` | Komunikacja backendu z oddzielnym kontrolerem wdrożeń. |

### Procesy `scripts/` i wdrażanie `deployment/`

| Plik | Rola |
| --- | --- |
| `scripts/chat-bridge.mjs`, `scripts/chat-sync.mjs`, `scripts/chat-images.mjs` | Most Codexa, przyrostowa historia rozmowy i walidacja zdjęć. |
| `scripts/insight-ai.mjs`, `scripts/publication-ai.mjs` | Aktywny prompt i schemat Sytuacji/briefu oraz wywołanie i kontrola rodzaju zadania AI. |
| `scripts/codex-worker.mjs` | Starszy proces zadań publikacji; indywidualne streszczenia pozostają wyłączone. |
| `scripts/collect.mjs` | Ręczne uruchomienie pobierania publikacji. |
| `scripts/preview-publications.mjs`, `scripts/preview-quotes.mjs` | Podgląd publicznych danych bez korzystania z prywatnej bazy i AI. |
| `scripts/setup.mjs` | Przygotowanie lokalnej konfiguracji aplikacji. |
| `scripts/summary.schema.json` | Schemat historycznego formatu odpowiedzi; nie oznacza aktywnej funkcji streszczeń. |
| `deployment/controller.py` | Kontroler testowania, publikowania i cofania wersji backendu na hoście. |
| `deployment/Deployment.Dockerfile`, `deployment/compose.app-chat.example.yml`, `deployment/deployment-access.json`, `deployment/zorza-deploy.service` | Szablony administracyjne obrazu testowego, usług i dostępu do kontrolera; nie są aktywną konfiguracją VPS. |
| `deployment/test_controller.py` | Testy kontrolera wdrożeń. |

Pliki `test/*.test.mjs` sprawdzają odpowiadające im moduły i kontrakty aplikacji. Szablony w `.github/ISSUE_TEMPLATE/` i `.github/pull_request_template.md` służą do zgłaszania zmian i przeglądu pull requestów. Nazwy z dopiskiem ` 2` widoczne w lokalnym katalogu są nieśledzonymi kopiami i nie należą do wersji na GitHubie.

Dane portfela, hasła, historia czatu i konfiguracja produkcyjna pozostają poza repozytorium. Informacja o autorze i licencji fotografii jest w [aurora-photo-credit.txt](public/aurora-photo-credit.txt).

GitHub przechowuje kod i dokumentację. Zmiana repozytorium nie wdraża automatycznie aplikacji na VPS. Ostatnią udokumentowaną weryfikację wdrożenia opisuje [SPEC](SPEC.md#13-weryfikacja-i-bramki-kolejnego-wydania).
