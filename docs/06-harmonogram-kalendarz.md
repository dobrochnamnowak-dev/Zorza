# Harmonogram i kalendarz

[Spis dokumentacji](../README.md)

## Obowiązujące ustawienia

| Godzina w Europe/Warsaw | Zadanie |
| --- | --- |
| Codziennie 15:40 | wszystkie dostępne kursy, publikacje i terminy |
| Codziennie 21:45 | ponownie wszystkie dostępne kursy |

Te godziny zastąpiły wcześniejsze 13:00, 16:00 oraz dodatkowe pobranie po otwarciu giełdy USA. Obecna konfiguracja nie śledzi dynamicznie otwarcia rynku amerykańskiego. `us-session.mjs` pozostał jako pomocniczy kod i testy historycznego wariantu.

Domyślne preferencje wdrożenia: `pricesFrequency=twice_daily`, `publicationsFrequency=daily`. W aplikacji można zmieniać obie częstotliwości osobno. Dwa razy w tygodniu oznacza wtorek i piątek o 15:40; wariant dwa razy dziennie dodaje 21:45. Kalendarz jest zbierany codziennie o 15:40.

Serwer sprawdza harmonogram zwykłym kodem co minutę. Zapisuje wykonany slot, korzysta z blokad i po ponownym uruchomieniu realizuje ostatni dostępny slot, bez odtwarzania wszystkich zaległych. Zmiana czasu jest obsługiwana przez strefę, a nie stałą różnicę UTC. W dni bez sesji cena może pozostać ceną ostatniego zamknięcia.

## Daty

Automatyczne zbieranie rozpoznaje zapowiedzi wyników, sprawozdań, spotkań i innych działań finansowych w dostępnych komunikatach. Każde wydarzenie ma artykuł/źródło, cytat, datę i stopień pewności. Rok wywnioskowany z kontekstu pozostaje szacowany. Deduplikacja obejmuje podmiot, rodzaj i datę.

Nie wolno mylić daty artykułu lub końca kwartału z dniem ogłoszenia wyników. `approved` oznacza zapis w kalendarzu aplikacji, nie niezależną ręczną weryfikację. Dokładne terminy są wspierane lepiej niż zapowiedzi ograniczone do miesiąca.

Pełniejsze zbieranie kalendarza ma limit stron — obecnie do 12 stron komunikatów obserwowanych i posiadanych podmiotów na przebieg. Nie gwarantuje pełnego oficjalnego kalendarza każdego instrumentu.

## Telefon

ICS eksportuje pojedyncze wydarzenie. Automatyczna synchronizacja z Kalendarzem Apple i wysyłka push pozostają w planie; zapisane ustawienia wyprzedzenia i godziny przypomnienia nie oznaczają, że telefon otrzyma powiadomienie.
