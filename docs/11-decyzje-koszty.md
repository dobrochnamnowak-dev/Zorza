# Decyzje i zużycie zasobów

[Spis dokumentacji](../README.md)

| Uzgodnienie | Skutek techniczny |
| --- | --- |
| Aplikacja przede wszystkim na iPhone | PWA, HTTPS, responsywny interfejs i pola dotykowe |
| Ciemna stylistyka z zorzą | czarne tło, oszczędne polskie etykiety, istniejące logo i ikony |
| Tylko zatwierdzony katalog | brak automatycznego dopisywania podobnych tickerów i produktów |
| Bez płatnych notowań | publiczne źródła, cache, walidacja, jawne braki |
| Wszystko działa bez komputera | procesy i własne logowanie Codexa na VPS |
| Pobrania o 15:40 i 21:45 | polska strefa, stałe godziny, brak zależności od otwarcia USA |
| Tylko zagraniczne publikacje | rejestr dozwolonych źródeł i oficjalnych domen |
| Tłumaczenie tylko wybranych podmiotów | zakres obserwowane + portfel, cache i limit nagłówków |
| Podsumowania na żądanie | trwała kolejka, brak automatycznych opracowań całej prasówki |
| Codex może zmieniać backend | kod w workspace; publikacja przez osobny kontroler po kliknięciu właścicielki |

## Co zużywa model

Pobieranie kursów, historii, RSS, dat, sprawdzanie harmonogramu i odświeżanie wyniku w interfejsie to zwykły kod. Samo wykonanie tych czynności nie zużywa tokenów AI.

Model jest uruchamiany dla rzeczywistej wiadomości w czacie, partii nowych nagłówków lub ręcznie zleconego podsumowania. Gotowe teksty i tłumaczenia są ponownie odczytywane z bazy. Pusta kolejka nigdy nie uruchamia modelu.

Most zlicza wspólny limit 300 operacji dziennie UTC dla czatu i opracowań. Nagłówki mają dodatkowy limit 100 unikalnych nowych tytułów na dzień Europe/Warsaw i partie do 20. Pozostałe ograniczenia źródeł i kolejki mogą zatrzymać pracę wcześniej.

Nie ma wiarygodnego stałego przelicznika na tokeny: zużycie zależy od długości treści, modelu i rozmowy. Liczniki operacji nie są licznikiem tokenów ani prognozą opłat. Logowanie ChatGPT jest odrębne od aktywowania płatnego klucza API; aplikacja nie uruchamia płatnego API automatycznie.

GitHub przechowuje kod i wiedzę o projekcie. Bazy, logowanie i sekrety pozostają poza nim. Automatyczne budowanie w chmurze nie zostało dołączone do tego repozytorium.
