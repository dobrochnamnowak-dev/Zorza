# Harmonogram i kalendarz

[Spis dokumentacji](../README.md)

## Obowiązujące ustawienia

| Godzina w Europe/Warsaw | Zadanie |
| --- | --- |
| Poniedziałek i czwartek 14:30 | opisy i przyrostowy brief, tylko obserwowane lub portfel |
| Codziennie 15:40 | wszystkie dostępne kursy; publikacje i terminy tylko obserwowanych lub portfela |
| Codziennie 18:30 | dodatkowe kursy wyłącznie obserwowanych lub posiadanych podmiotów |
| Codziennie 21:45 | ponownie wszystkie dostępne kursy |

Te godziny zastąpiły wcześniejsze 13:00, 16:00 oraz dodatkowe pobranie po otwarciu giełdy USA. Obecna konfiguracja nie śledzi dynamicznie otwarcia rynku amerykańskiego. `us-session.mjs` pozostał jako pomocniczy kod i testy historycznego wariantu.

Domyślne preferencje wdrożenia: `pricesFrequency=twice_daily`, `publicationsFrequency=daily`. W aplikacji można zmieniać obie częstotliwości osobno. Dwa razy w tygodniu oznacza wtorek i piątek o 15:40; wariant dwa razy dziennie dodaje 21:45. Kalendarz jest zbierany codziennie o 15:40.

Dodatkowe 18:30 jest niezależne od preferencji całego katalogu. Zakres jest sumą aktualnie obserwowanych i instrumentów mających co najmniej jeden zapis zakupu; wspólna pozycja jest pobierana raz. Nie uruchamia AI. Osobny znacznik `personal_prices_slot` i raport `quotes_focus_report` nie zastępują raportu całej listy. Pusta grupa nie powoduje pobrania, a zajęte źródło nie oznacza wykonanego slotu.

W poniedziałki i czwartki od 14:30 działa dodatkowe sprawdzenie osobistych źródeł i opracowanie opisów/briefów przy nowych materiałach. Dodanie obserwowania lub pierwszego zakupu włącza pobranie i pierwszy opis niezależnie od dnia; pełne zasady są w [Sytuacji i briefie](13-sytuacja-i-brief.md).

Przy opisie pokazujemy drobnym tekstem `generated_at`, przy kursie `as_of` źródła. Data sprawdzenia źródeł jest osobną informacją i nie przesuwa daty opracowania. Wszystkie daty są prezentowane w Europe/Warsaw.

Serwer sprawdza harmonogram zwykłym kodem co minutę. Zapisuje wykonany slot, korzysta z blokad i po ponownym uruchomieniu realizuje ostatni dostępny slot, bez odtwarzania wszystkich zaległych. Zmiana czasu jest obsługiwana przez strefę, a nie stałą różnicę UTC. W dni bez sesji cena może pozostać ceną ostatniego zamknięcia.

## Daty

Automatyczne zbieranie rozpoznaje zapowiedzi wyników, sprawozdań, spotkań i innych działań finansowych w dostępnych komunikatach. Każde wydarzenie ma artykuł/źródło, cytat, datę i stopień pewności. Rok wywnioskowany z kontekstu pozostaje szacowany. Deduplikacja obejmuje podmiot, rodzaj i datę.

Nie wolno mylić daty artykułu lub końca kwartału z dniem ogłoszenia wyników. `approved` oznacza zapis w kalendarzu aplikacji, nie niezależną ręczną weryfikację. Terminy z opisu są zapisywane automatycznie, po sprawdzeniu źródłowego dowodu. Miesiąc, kwartał, półrocze i rok zapisujemy jako szacowany przedział, a interfejs nie pokazuje fikcyjnego konkretnego dnia. Kalendarz ma także sekcję późniejszych terminów.

Pełniejsze zbieranie kalendarza ma limit stron — obecnie do 12 stron komunikatów obserwowanych i posiadanych podmiotów na przebieg. Nie gwarantuje pełnego oficjalnego kalendarza każdego instrumentu.

## Telefon

Kalendarz aplikacji przechowuje znalezione terminy. Eksport ICS pozwala ręcznie dodać pojedyncze wydarzenie do kalendarza telefonu.
