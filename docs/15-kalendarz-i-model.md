# Kalendarz emitentów i wybór modelu — 4 listopada 2026

> Notatka historyczna. Aktualny stan po wdrożeniu z 5 listopada: nagłówki w oryginale, osobne streszczenia wyłączone; Sol low przygotowuje sytuację i brief. [Potwierdzenie](19-brief-zamiast-podsumowan.md). Starsze zapisy poniżej nie przywracają wycofanych funkcji.

## Uzgodnienie

Po porównaniu na AMD właścicielka wybrała GPT-6.1 Sol low do Sytuacji firmy i briefu prasowego. Oba powstają w dotychczasowym pojedynczym zadaniu `insight`, bez nowego przebiegu dla samego briefu. GPT-6 Luna low pozostaje do tłumaczeń nagłówków i podsumowań pojedynczych artykułów. Nadal tylko obserwowane lub portfel; brak ponawiania i masowego przeliczania dawnych opisów. Harmonogram i limity wejścia pozostają bez zmian.

Wybór modelu nie włącza jego samodzielnego wyszukiwania: materiały nadal pobiera zwykły kod; generator dostaje zapisany pakiet, a `web_search` pozostaje wyłączone. Docelowy pięcioczęściowy prompt z researchu jest w [osobnym dokumencie](prompty/sytuacja-spolki.md); nie należy utożsamiać zmiany modelu z wdrożeniem całego tego procesu.

## Terminy

Istniejący parser odczytywał JSON-LD i zapowiedzi zapisane w zdaniach. Pomijał publiczny kalendarz AMD, gdzie data jest w `<time datetime>`, a nazwa konferencji w nagłówku osobnej karty. Rozpoznawanie tematów pomijało również niektóre konferencje.

Poprawka obsługuje jednoznaczne karty w sekcji Upcoming Events: jedna data i jeden nagłówek w tej samej karcie. Pomija sekcję Past Events, anulowane zdarzenia i niepoprawne daty. Potwierdzone daty zapisuje zwykły kod w istniejącej tabeli `events`, widocznej w zakładce Kalendarz, ze źródłem, podmiotem i dowodem. Nie tworzy zapisu tylko na podstawie tekstu wygenerowanego przez model.

Zweryfikowany punkt startowy AMD: https://ir.amd.com/news-events/ir-calendar. Dla innych emitentów pozostaje odkrywanie linków na zweryfikowanych domenach; kalendarze mają pierwszeństwo. Nie zgadujemy nowych adresów. Limit nadal trzy strony na podmiot, tylko obserwowane lub portfel. Nie pobieramy linków archiwum. Zwykły harmonogram działa na VPS również przy wyłączonym komputerze; opcja `force` pozwala jednorazowo sprawdzić poprawkę tego samego dnia, bez rozszerzenia osobistego zakresu.

Na odczytanej 4 listopada stronie AMD potwierdzono:

- 1 grudnia 2026: UBS Global Technology and AI Conference;
- 9 grudnia 2026: Barclays 24th Annual Global Technology Conference.

Zmiana daty przy tym samym identyfikatorze wydarzenia aktualizuje istniejący wpis; usunięcie ze zmienionej listy oznacza stary wpis jako nieaktualny. Zmieniona publikacja nie przywraca terminu odrzuconego przez właścicielkę.

To kalendarz wewnątrz Zorzy. Automatycznej synchronizacji z Apple Calendar ani działających powiadomień push ta poprawka nie dodaje.

## Wygląd

Zakup, Komentarz i Sytuacja pozostają trzema równymi polami dotyku 44 px, z samym tekstem i ikonami. Bez obramowania, tła i cienia. Widoczny obrys klawiaturowego fokusu zostaje dla dostępności. Zaktualizowana makieta i wersja cache PWA.

## Weryfikacja i stan

111 lokalnych testów przeszło, bez prawdziwych wywołań AI. Dodatkowo odczyt rzeczywistego zapisanego HTML AMD w testowej bazie utworzył oba potwierdzone wpisy. Testy obejmują zmianę daty, brak duplikatów, zachowanie odrzucenia i osobisty zakres.

Wdrożono przez kontroler wersję `e64b3f8f60444891a9f0fc87fcd69221`, 4 listopada 2026 o 18:54 czasu polskiego. Kontroler zakończył testy i publikację statusem `succeeded`, aplikacja odpowiada HTTP 200, a most zachował logowanie ChatGPT. W uruchomionym kontenerze potwierdzono wybór `gpt-6.1-sol` dla `insight` i `gpt-6-luna` dla `titles`/`summary`, z rozumowaniem low. Nie generowano masowo ponownie istniejących opisów.

Jednorazowy odczyt kalendarza AMD na produkcji sprawdził trzy publiczne strony i zapisał dwa wskazane terminy. Oba są widoczne w zakładce Kalendarz przy Advanced Micro Devices, z potwierdzeniem i linkiem do emitenta. W profilu na ekranie 390 × 844 potwierdzono trzy przyciski po 44 px, w tej samej linii, z obramowaniem 0, przezroczystym tłem i bez cienia.
