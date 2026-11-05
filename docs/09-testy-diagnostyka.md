# Testy i diagnostyka

[Spis dokumentacji](../README.md)

## Polecenia

```sh
node --test test/*.test.mjs
node --check server.mjs
node --check public/app.js
cd deployment
python3 -m unittest test_controller.py
```

Node.js 24 udostępnia SQLite bez zewnętrznej biblioteki. Testy korzystają z tymczasowych baz i atrap odpowiedzi źródeł. Nie uruchamiają rzeczywistego modelu ani nie wymagają płatnych danych. Testy HTTP i gniazda Unix wymagają możliwości otwarcia lokalnych gniazd; ograniczony sandbox może je blokować niezależnie od poprawności aplikacji.

## Zweryfikowane obszary

- katalog, zakupy, mapowania, waluty, daty i obliczenia zmian;
- źródła zagraniczne, komunikaty, deduplikacja, usunięcia i wersje;
- oryginalne nagłówki, brak automatycznych tłumaczeń, odrzucenie dawnych zadań i niezależność podsumowań od starego limitu;
- podsumowanie wyłącznie po żądaniu, ręczne ponowienia i odzyskanie przerwanych zleceń;
- kalendarz, dowody, niepewność i harmonogram w polskiej strefie;
- sesje, Origin, ograniczenie API i brak cache danych prywatnych;
- wykresy, braki, cache, blokady źródła i zgodność instrumentu;
- kontroler: zapis wersji, ograniczone testy, blokada duplikatu i rollback.

Ostatni pełny zestaw aplikacji sprawdzony 4 listopada 2026: **117 testów**. Notatki [harmonogramu](16-harmonogram-i-opracowania.md) i [oryginalnych nagłówków](17-oryginalne-naglowki.md) zawierają późniejsze potwierdzenia wdrożeń.

## Naprawa niewidocznych podsumowań — 3 listopada 2026

Serwer miał gotowe wyniki, ale otwarty artykuł nie odświeżał danych. Dodatkowo stary dashboard miał pierwszeństwo przed nowszą odpowiedzią profilu. Interfejs pokazywał ogólną informację o połączeniu, mimo że ChatGPT był zalogowany.

Poprawka synchronizuje oba widoki i pobiera stan widocznych oczekujących wyników co 5 sekund, bez wywoływania modelu. Odświeżanie ustaje przy braku oczekujących zleceń lub ukryciu strony. Gotowe opracowanie tej samej wersji nie jest kasowane przez wolniejszą odpowiedź. Przeglądarkowy test na sztucznych danych potwierdził pojawienie się wyniku bez zamykania okna i ponowny odczyt bez generowania. Po wdrożeniu pełny zestaw miał 68 przechodzących testów.

## Gdy coś nie działa

| Objaw | Co sprawdzić |
| --- | --- |
| Artykuł stale w kolejce | stan ChatGPT, zajętość mostu, kolejkę i limity; nie generować duplikatów |
| Zadanie failed | zapisany błąd, dostęp do źródła, ważność wersji; ponowienie tylko ręczne |
| Nieaktualna cena | datę źródła i `quotesReport`, dostępność mapowania i blokady HTTP |
| Brak wykresu | mapowanie, odpowiedź źródła, przerwę po 429 i długość historii |
| Brak terminu | źródło, dowód i rozpoznawalną dokładną datę; brak wpisu nie dowodzi braku wydarzenia |
| Wdrożenie nieaktywne | socket i usługę kontrolera; nie dodawać uprawnień agenta |
| Proces przerwany w połowie wdrożenia | administracyjna kontrola stanu; nie ponawiać w ciemno |

Nie traktuj samego `summaryWorkerConfigured` jako dowodu zalogowania. Bieżący stan konta pokazuje status mostu. Licznik dawnego procesu `workerSeen` może być pusty, mimo że współczesna ścieżka działa.
