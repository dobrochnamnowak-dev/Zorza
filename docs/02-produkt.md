# Produkt i zakres

[Spis dokumentacji](../README.md)

Stan po wdrożeniu z 5 listopada 2026. Krótki opis dla odbiorczyni: [karta produktu](../ONE-PAGER.md). Wymagania i kryteria odbioru: [PRD 1.1](../PRD.md).

## Cel

Zorza zbiera informacje o zatwierdzonych akcjach i ETF-ach, aby można było szybko sprawdzić notowania, doniesienia i zbliżające się wydarzenia. Nie wykonuje transakcji, nie obiecuje prognoz kursów ani kompletnego pokrycia wszystkich źródeł.

## Katalog

Stan katalogu z 5 listopada 2026: **108 akcji i 46 ETF-ów**. Początkowa lista ze zdjęć była mniejsza; dalsze pozycje pochodzą z późniejszych zatwierdzonych zmian. Źródłem aktualnego zakresu jest `catalog.json`, a nie liczba z historycznej rozmowy.

Mapowania źródłowe i podobne nazwy nie upoważniają do dopisywania nowych instrumentów. Tickera trzeba rozpatrywać razem z giełdą, walutą i typem produktu; dla ETF-ów także z potwierdzoną nazwą.

## Zasady interfejsu

Czarne tło i nawigacja, kolorowa zorza i gwiazdy, wyraźna nazwa i logo, logotypy podmiotów, oszczędny tekst po polsku. Filtry zachowują efekt fizycznych klawiszy; Zakup / Komentarz / Sytuacja w profilu są bez ramek, w jednym równym rzędzie; pola dotykowe co najmniej 44 px. Wzrosty i spadki rozróżnia także znak oraz liczba, nie tylko kolor. Animacje respektują ograniczenie ruchu.

## Stan funkcji

| Obszar | Stan |
| --- | --- |
| Katalog, obserwowane i zakupy | Działa |
| Import zapisów zakupów JSON | Działa; walidacja i pomijanie dokładnych duplikatów |
| Kursy i rankingi całej listy | Działa dla dostępnych potwierdzonych mapowań |
| Wykresy 1D / 1T / 1R / 5L | Działa; historia zależy od źródła i daty debiutu |
| Zagraniczne publikacje i komunikaty | Działa; pokrycie nie jest kompletne |
| Oryginalne nagłówki | Działa bez tłumaczenia i kolejki AI |
| Sytuacja firmy i przyrostowy brief | Sol low, obserwowane i portfel; poniedziałek/czwartek 14:30 i pierwszy opis po dodaniu |
| Podsumowania na żądanie | Działa na VPS; wynik odświeża się w interfejsie |
| Daty i kalendarz aplikacji | Działa; parser zachowawczy, oznacza niepewność |
| Czat, zdjęcia, publikacja backendu | Działa |
| Lżejszy Start i przyrostowy czat | Wdrożone 5 listopada; pełne dane profilu i historia zachowane |
| Push na iPhone | Do wdrożenia |
| Automatyczna synchronizacja Kalendarza Apple | Do wdrożenia; obecnie ICS |
| Automatyczny GitHub → VPS i VPS → GitHub | Nieskonfigurowane |

Optymalizacja współdzieli także odczyt treści artykułu między publikacjami i kalendarzem tego samego cyklu. Kolejny cykl ponownie weryfikuje źródło. Godziny i zakres zbierania danych pozostają bez zmian; szczegóły oraz pomiary są w [notatce wdrożenia](18-optymalizacja-transportu.md).
