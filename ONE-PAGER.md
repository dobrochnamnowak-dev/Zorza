# Zorza — karta produktu

One-pager · 5 listopada 2026 · zakres po korekcie dotyczącej briefu
[Dokumentacja](README.md) · [Wymagania produktu](PRD.md) · [Specyfikacja techniczna](SPEC.md)

## Cel i odbiorczyni

Zorza to prywatna aplikacja na iPhone do śledzenia akcji i ETF-ów. Łączy notowania, zagraniczne publikacje i terminy emitentów, aby właścicielka mogła szybko sprawdzić, co zmieniło się w obserwowanych podmiotach i portfelu. Dane zbiera serwer — komputer nie musi być włączony.

## Jak z niej korzystać

**Start → profil podmiotu → sytuacja, brief i terminy → źródło.**

Na Starcie są portfel, obserwowane i największe zmiany całego zatwierdzonego katalogu. Profil pokazuje kurs z datą, wykres 1D / 1T / 1R / 5L, słowną sytuację podmiotu, ryzyka, komentarze i brief pod wykresem. Pełną listę publikacji otwiera osobny przycisk.

Obserwowanie i zapis zakupu to niezależne funkcje. Zakup zapisuje ilość, cenę, walutę i datę. Dodanie do którejkolwiek grupy włącza źródła podmiotu i przygotowanie pierwszego opisu. Pozostałe pozycje katalogu mają dostępne notowania i wykresy, bez nowego pobierania publikacji i opracowań AI.

## Najważniejsze funkcje

- **Informacje z dowodami:** zagraniczne portale, komunikaty emitentów, źródła i daty. Nagłówki w oryginale i linki do źródeł. Opracowanie po polsku jest w briefie; bez osobnego streszczenia każdego artykułu.
- **Sytuacja i brief:** zwięzły opis faktów, czynników i ryzyk; brief dopisuje nowe istotne wydarzenia, działania i terminy. Zmiany sygnalizuje czerwone oznaczenie.
- **Kalendarz:** automatyczny zapis znalezionych terminów z dowodem i oznaczeniem niepewności; eksport wydarzenia do telefonu przez ICS.
- **Rozwój przez czat:** rozmowa z Codexem, zdjęcia i zlecanie zmian. Backend publikuje osobny kontroler po zatwierdzeniu przetestowanej wersji.

## Kiedy dane się odświeżają

Godziny polskie, `Europe/Warsaw`; tabela pokazuje potwierdzone ustawienia produkcji.

| Kiedy | Co |
| --- | --- |
| Codziennie 15:40 | Kursy katalogu; publikacje i terminy obserwowanych i portfela |
| Codziennie 18:30 | Dodatkowe kursy obserwowanych i portfela |
| Codziennie 21:45 | Kursy katalogu |
| Poniedziałek i czwartek 14:30 | Sytuacja i brief obserwowanych i portfela, przy nowych materiałach |
| Po dodaniu podmiotu | Włączenie źródeł i pierwszy opis, gdy są wystarczające dane |

Brief jest przyrostowy, bez uzupełniania historii; wpis pozostaje ważny sześć miesięcy kalendarzowych. Obecny cykl opisów i dopisywania briefu kończy się 4 maja 2027; przedłużenie wymaga decyzji.

## Zasady i granice

Instalacja jako PWA z Safari przez „Dodaj do ekranu początkowego”. Czarne tło, zorza, czytelne logotypy i krótka nawigacja służą obsłudze telefonu.

Publiczne dane, bez płatnych notowań i bez obchodzenia paywalli. Sytuację i brief przygotowuje Sol low. Osobne streszczenia artykułów zostały wycofane z zakresu, aby nie dublować opracowań i zużycia AI. Gotowe wyniki są zapisywane; pusta kolejka nie wywołuje modelu. Oszczędzanie transferu zachowuje historię, godziny aktualizacji i pełne dane profilu.

Osobne streszczenia są wyłączone w interfejsie, API i procesach AI; zapisane wcześniej treści zachowano ([potwierdzenie](docs/19-brief-zamiast-podsumowan.md)).

Pokrycie cen i terminów zależy od źródeł; data sprawdzenia nie zastępuje daty danych. Zorza nie wykonuje transakcji ani nie gwarantuje przyszłych kursów. GitHub przechowuje kod i dokumentację; publikacja repozytorium nie wdraża automatycznie aplikacji.
