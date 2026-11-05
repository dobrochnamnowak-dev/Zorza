# Decyzje i zużycie zasobów

[Spis dokumentacji](../README.md)

| Uzgodnienie | Skutek techniczny |
| --- | --- |
| Aplikacja przede wszystkim na iPhone | PWA, HTTPS, responsywny interfejs i pola dotykowe |
| Ciemna stylistyka z zorzą | czarne tło, oszczędne polskie etykiety, istniejące logo i ikony |
| Tylko zatwierdzony katalog | brak automatycznego dopisywania podobnych tickerów i produktów |
| Bez płatnych notowań | publiczne źródła, cache, walidacja, jawne braki |
| Wszystko działa bez komputera | procesy i własne logowanie Codexa na VPS |
| Ceny 15:40 i 21:45; osobiste także 18:30 | polska strefa, stałe godziny, bez zależności od zegara komputera |
| Opisy i briefy poniedziałek/czwartek 14:30 | tylko nowe materiały obserwowanych i portfela, pierwszy opis po dodaniu |
| Tylko zagraniczne publikacje | rejestr dozwolonych źródeł i oficjalnych domen |
| Oryginalne nagłówki | tłumaczenia wyłączone, brak wywołań AI dla tytułów |
| Brief zamiast osobnych streszczeń | jedna ścieżka opracowania publikacji; starsze zlecenia artykułów wyłączone w API, workerze i moście |
| Codex może zmieniać backend | kod w workspace; publikacja przez osobny kontroler po kliknięciu użytkownika |
| Optymalizacja bez zmiany wymagań | przyrostowy czat, lekki Start i wspólny odczyt artykułu w cyklu; harmonogramy i modele zachowane |

## Co zużywa model

Pobieranie kursów, historii, RSS, dat, sprawdzanie harmonogramu i odświeżanie wyniku w interfejsie to zwykły kod. Samo wykonanie tych czynności nie zużywa tokenów AI.

W aktualnym zakresie model służy rzeczywistym wiadomościom w czacie oraz uzgodnionej sytuacji i briefowi na podstawie nowych materiałów. Sytuacja i brief używają Sol low. Osobne streszczenia artykułów są wyłączone na VPS. Most odrzuca ten rodzaj przed naliczeniem operacji; próba nie powoduje wywołania modelu. Nagłówki nie wywołują modelu. Gotowe teksty są odczytywane z bazy. Pusta kolejka nigdy nie uruchamia modelu.

Most zlicza wspólny limit 300 operacji dziennie UTC dla czatu i opracowań. Dawny limit 100 tłumaczeń nagłówków i partie po 20 nie są już aktywne. Pozostałe ograniczenia źródeł i kolejki mogą zatrzymać pracę wcześniej.

Nie ma wiarygodnego stałego przelicznika na tokeny: zużycie zależy od długości treści, modelu i rozmowy. Liczniki operacji nie są licznikiem tokenów ani prognozą opłat. Logowanie ChatGPT jest odrębne od aktywowania płatnego klucza API; aplikacja nie uruchamia płatnego API automatycznie.

GitHub przechowuje kod i wiedzę o projekcie. Bazy, logowanie i sekrety pozostają poza nim. Automatyczne budowanie w chmurze nie zostało dołączone do tego repozytorium.

## Pomiary etapu 1 — 5 listopada 2026

W jednym stanie produkcyjnych danych początkowa synchronizacja czatu miała 6 356 261 B, a kolejne odpytanie bez zmian 5 182 B. Start miał 67 345 B wobec 4 021 846 B pełnego dashboardu. Początkowe pobranie historii nadal jest pełne, a profil doczytuje potrzebne treści.

To ograniczenie transferu i powtórnych odczytów; nie obniża automatycznie liczby tokenów, ceny abonamentu ani rachunku za VPS. Nie wyliczamy oszczędności pobierania artykułów bez pomiaru rzeczywistego cyklu. Pełne warunki: [notatka techniczna](18-optymalizacja-transportu.md).
