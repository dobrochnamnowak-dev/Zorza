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
- kontroler: zapis wersji, ograniczone testy, blokada duplikatu i rollback;
- przyrostowy czat: streaming, kolejność, usunięcie zdjęć, reset po restarcie i zgodność starszego formatu;
- lekki dashboard: pełny profil, zachowanie pól pominiętych i nowszych kursów;
- wspólny odczyt artykułu: HTTP 304/200/403, paywall, `no-store`, kontrola domen i nowy cykl.

Ostatni pełny zestaw aplikacji sprawdzony 5 listopada 2026: **124 testy**. Po drobnej korekcie powtórzono siedem testów objętych zmianą; przeszły. Osiem testów kontrolera potwierdzono wcześniej; etap optymalizacji nie zmieniał kontrolera. Testy transportu są w `test/transport-optimization.test.mjs`, integracyjny test HTTP w `test/optimized-http.test.mjs`.

Po wdrożeniu sprawdzono Start, profil, publikacje, Kalendarz i Ustawienia przy 390 × 844, brak błędów konsoli oraz gotowość schedulerów i mostu. Testy nie uruchamiały rzeczywistych modeli ani pełnego pobierania danych poza harmonogramem. Pomiary i dokładny zakres potwierdzeń są w [notatce optymalizacji](18-optymalizacja-transportu.md).

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
| Czat po restarcie otrzymuje pełną historię | to oczekiwany reset sesji synchronizacji; kolejne odczyty powinny przesyłać tylko zmiany |
| W lekkim dashboardzie nie ma publikacji | sprawdzić `omitted`; profil pobiera je osobnym API, brak pola nie oznacza usunięcia |

Nie traktuj samego `summaryWorkerConfigured` jako dowodu zalogowania. Bieżący stan konta pokazuje status mostu. Licznik dawnego procesu `workerSeen` może być pusty, mimo że współczesna ścieżka działa.

## Wyłączenie osobnych streszczeń — 5 listopada 2026

Aktualny zestaw: 121 testów aplikacji. Scenariusze generowania wycofanej funkcji zastąpiono testami braku pobrań i wywołań AI, zachowania danych oraz kończenia starych zleceń. Test HTTP potwierdza 410 dla generowania, ponawiania i dawnego workera, zachowując pełny opis, brief i kalendarz. Na VPS potwierdzono także blokadę mostu bez zmiany licznika operacji. [Wdrożenie](19-brief-zamiast-podsumowan.md). Starsze opisy napraw tej funkcji powyżej są historyczne.
