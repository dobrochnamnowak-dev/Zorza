# Brief zamiast osobnych streszczeń artykułów

Decyzja właścicielki · 5 listopada 2026
[PRD](../PRD.md) · [SPEC](../SPEC.md) · [Karta produktu](../ONE-PAGER.md)

## Obowiązujący zakres

Publikacje opracowujemy w jednym przyrostowym briefie. Nie tworzymy dodatkowych streszczeń pojedynczych artykułów, także po kliknięciu. Lista publikacji zachowuje oryginalny nagłówek, podmiot, wydawcę, datę i link do oryginału. Sytuacja firmy nadal opisuje jej kondycję, czynniki kursu i ryzyka.

Bez zmian: Sol low dla sytuacji i briefu; obserwowane lub portfel; poniedziałek i czwartek 14:30 oraz pierwszy opis po dodaniu; brief bez uzupełniania historii, ważność sześć miesięcy kalendarzowych i koniec obecnego cyklu 4 maja 2027. Pobieranie publikacji i terminów pozostaje odrębną pracą serwera.

## Stan wykonania

Wdrożono i sprawdzono 5 listopada 2026, 14:14:14 Europe/Warsaw (13:14:14 UTC). Końcowa wersja kontrolera `4585972331e64c66aa95c672bab3c14f` ma status `succeeded`. Najpierw wdrożono backend (`02a9245ff7ae4fdaad1a3b86e203a456`), potem frontend i końcowy zestaw. Most zaktualizowano osobno, zachowując logowanie i historię.

121 testów aplikacji przeszło lokalnie, bez prawdziwego modelu; dodatkowy test HTTP migracji starego oczekującego zlecenia przy starcie również przeszedł. Kontroler potwierdził testy zamrożonych wersji na VPS. Mniejsza liczba względem 124 z etapu optymalizacji wynika z zastąpienia wycofanych scenariuszy generowania testami blokad.

Na produkcji `/api/summarize`, `/api/retry`, `/api/worker/claim`, `/api/worker/finish` i `kind=summary` mostu zwracają 410. Próba w moście nie zwiększa licznika operacji. Status: `articleSummariesEnabled=false`, most gotowy i zalogowany, brak `queued/running` w starej kolejce artykułów. Sesję używaną do prywatnego testu HTTP usunięto w `finally`.

Przy 390 × 844 karta artykułu ma nagłówek, podmiot, datę, źródło, fragment i link; brak osobnych streszczeń oraz panelu automatycznej analizy screenów pojedynczego artykułu. Sprawdzono zachowanie profilu i briefu, brak poziomego przewijania i błędów konsoli. Skróty kontrolne obserwowanych, zakupów, komentarzy i zapisanych wcześniej streszczeń są zgodne przed i po wdrożeniu.

Harmonogramy i modele nie zmieniły się: ceny 15:40/21:45, osobiste także 18:30, publikacje i kalendarz 15:40, sytuacja i brief poniedziałek/czwartek 14:30, Europe/Warsaw. Scheduler działa na VPS, bez włączonego komputera. Nie generowano nowych opisów ani briefów w celu testowania tej zmiany.

## Zrealizowany zakres wyłączenia

- Usunąć przyciski generowania/ponawiania i osobną sekcję streszczenia artykułu; pozostawić nagłówek, metadane, źródło i link.
- Zablokować nowe zlecenia i ponowienia starszą ścieżką API oraz wykonywanie starych oczekujących zleceń streszczeń. Nie uruchamiać AI w ramach tej migracji.
- Nie kasować historycznych treści ani danych portfela; pola i tabele mogą pozostać dla zgodności.
- Zachować wspólny odczyt artykułów potrzebny publikacjom i kalendarzowi oraz niezależne `insight_jobs` i przyrostowy brief.
- Zaktualizować Ustawienia i instrukcje, sprawdzić brak osobnych wywołań AI oraz działanie profilu, źródeł, briefu, kalendarza i harmonogramu.
- Oddzielnie wdrożyć i zweryfikować aplikację; wykonanie potwierdzono powyżej.

Notatki opisujące wcześniejsze wdrożenia i testy zachowują wartość historyczną. Nie przywracają wycofanego wymagania FR-11.

Po testach usunięto tymczasowy klucz SSH użyty do tego wdrożenia.
