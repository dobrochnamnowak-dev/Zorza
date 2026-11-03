# Produkt i zakres

[Spis dokumentacji](../README.md)

## Cel

Zorza zbiera informacje o zatwierdzonych akcjach i ETF-ach, aby można było szybko sprawdzić notowania, doniesienia i zbliżające się wydarzenia. Nie wykonuje transakcji, nie obiecuje prognoz kursów ani kompletnego pokrycia wszystkich źródeł.

## Katalog

Stan kodu z 3 listopada 2026: **105 akcji i 46 ETF-ów**. Początkowa lista ze zdjęć była mniejsza; dalsze pozycje pochodzą z późniejszych zatwierdzonych zmian. Źródłem aktualnego zakresu jest `catalog.json`, a nie liczba z historycznej rozmowy.

Mapowania źródłowe i podobne nazwy nie upoważniają do dopisywania nowych instrumentów. Tickera trzeba rozpatrywać razem z giełdą, walutą i typem produktu; dla ETF-ów także z potwierdzoną nazwą.

## Zasady interfejsu

Czarne tło i nawigacja, kolorowa zorza i gwiazdy, wyraźna nazwa i logo, logotypy podmiotów, oszczędny tekst po polsku. Przyciski mają efekt fizycznych klawiszy; pola dotykowe co najmniej 44 px. Wzrosty i spadki rozróżnia także znak oraz liczba, nie tylko kolor. Animacje respektują ograniczenie ruchu.

## Stan funkcji

| Obszar | Stan |
| --- | --- |
| Katalog, obserwowane i zakupy | Działa |
| Import zapisów zakupów JSON | Działa; walidacja i pomijanie dokładnych duplikatów |
| Kursy i rankingi całej listy | Działa dla dostępnych potwierdzonych mapowań |
| Wykresy 1D / 1T / 1R / 5L | Działa; historia zależy od źródła i daty debiutu |
| Zagraniczne publikacje i komunikaty | Działa; pokrycie nie jest kompletne |
| Polskie nagłówki | Działa dla obserwowanych i portfela, z limitem |
| Podsumowania na żądanie | Działa na VPS; wynik odświeża się w interfejsie |
| Daty i kalendarz aplikacji | Działa; parser zachowawczy, oznacza niepewność |
| Czat, zdjęcia, publikacja backendu | Działa |
| Push na iPhone | Do wdrożenia |
| Automatyczna synchronizacja Kalendarza Apple | Do wdrożenia; obecnie ICS |
| Automatyczny GitHub → VPS i VPS → GitHub | Nieskonfigurowane |
