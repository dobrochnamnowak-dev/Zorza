# Brief zamiast osobnych streszczeń artykułów

Decyzja właścicielki · 5 listopada 2026
[PRD](../PRD.md) · [SPEC](../SPEC.md) · [Karta produktu](../ONE-PAGER.md)

## Obowiązujący zakres

Publikacje opracowujemy w jednym przyrostowym briefie. Nie tworzymy dodatkowych streszczeń pojedynczych artykułów, także po kliknięciu. Lista publikacji zachowuje oryginalny nagłówek, podmiot, wydawcę, datę i link do oryginału. Sytuacja firmy nadal opisuje jej kondycję, czynniki kursu i ryzyka.

Bez zmian: Sol low dla sytuacji i briefu; obserwowane lub portfel; poniedziałek i czwartek 14:30 oraz pierwszy opis po dodaniu; brief bez uzupełniania historii, ważność sześć miesięcy kalendarzowych i koniec obecnego cyklu 4 maja 2027. Pobieranie publikacji i terminów pozostaje odrębną pracą serwera.

## Stan wykonania

Poprawiono zakres w dokumentacji. Przegląd kodu wykazał, że interfejs nadal ma przyciski streszczeń i oznaczenia w Ustawieniach, API ma `/api/summarize` i `/api/retry`, a `publication-work.mjs` obsługuje starszą kolejkę. Nie potwierdzono ich wyłączenia w aplikacji. Ostatnie sprawdzone wdrożenie z 5 listopada dotyczyło optymalizacji transportu, a nie usunięcia tej funkcji.

## Kryteria wyłączenia w aplikacji

- Usunąć przyciski generowania/ponawiania i osobną sekcję streszczenia artykułu; pozostawić nagłówek, metadane, źródło i link.
- Zablokować nowe zlecenia i ponowienia starszą ścieżką API oraz wykonywanie starych oczekujących zleceń streszczeń. Nie uruchamiać AI w ramach tej migracji.
- Nie kasować historycznych treści ani danych portfela; pola i tabele mogą pozostać dla zgodności.
- Zachować wspólny odczyt artykułów potrzebny publikacjom i kalendarzowi oraz niezależne `insight_jobs` i przyrostowy brief.
- Zaktualizować Ustawienia i instrukcje, sprawdzić brak osobnych wywołań AI oraz działanie profilu, źródeł, briefu, kalendarza i harmonogramu.
- Oddzielnie wdrożyć i zweryfikować aplikację; dopiero wtedy oznaczyć wyłączenie jako działające na VPS.

Notatki opisujące wcześniejsze wdrożenia i testy zachowują wartość historyczną. Nie przywracają wycofanego wymagania FR-11.
