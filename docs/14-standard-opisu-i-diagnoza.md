# Standard „Sytuacji firmy” i diagnoza z 4 listopada 2026

## Jak ma wyglądać opis

Screeny właścicielki są wzorem konstrukcji wypowiedzi. Ich twierdzenia o transakcjach, kursach i cenach docelowych nie są automatycznie zweryfikowanymi faktami i nie wolno kopiować ich do aplikacji.

1. **Krótka teza.** Jedno–dwa zdania: co jest obecnie najważniejsze dla podmiotu. Bez wstępu „najnowszy materiał podaje” i bez opisu pracy generatora.
2. **Główne czynniki.** Do czterech różnych punktów. Pogrubiona krótka nazwa, a następnie co się wydarzyło, kiedy i co to oznacza dla działalności. Po jednym–dwóch zdaniach. Przy skąpych danych mniej punktów, bez sztucznego wypełniania.
3. **Konkret zamiast ogólnika.** Jeżeli źródło podaje kwotę kontraktu, dynamikę wyników, zmianę prognozy albo wycenę analityka, zachowaj liczby, walutę, okres i autora. Gdy nie podaje — nie dopowiadaj.
4. **Logiczny związek.** Nie utożsamiaj dobrego wyniku firmy ze wzrostem kursu. Przyczynę ruchu kursu podawaj tylko z dowodem i zgodnością dat. Nie opisuj dzisiejszej sesji bez aktualnego notowania. Interpretację oznacz jako wniosek, z podaniem przesłanki.
5. **Status wydarzenia.** Rozróżniaj plany, negocjacje, podpisany kontrakt i realizację; zapowiedziane i zakończone przejęcie; prognozę i wynik; cenę docelową i rekomendację. Nie łącz różnych spółek o podobnych nazwach.
6. **Ryzyka.** Do trzech konkretnych ryzyk z mechanizmem, np. potwierdzonym kosztem, zadłużeniem albo zależnością od klienta. Bez automatycznej listy „konkurencja, makroekonomia, regulacje”, gdy materiały jej nie uzasadniają. Brak danych nie oznacza braku ryzyka.
7. **Ostrożny wniosek.** Jedno–dwa zdania: co będzie najważniejsze dalej i co pozostaje niepewne. Bez obietnic ceny i zaleceń kupna/sprzedaży.
8. **Źródła przy faktach.** Klikalne odnośniki, data weryfikacji i jedna krótka informacja o ograniczeniu materiałów. Bez UUID, technicznych identyfikatorów i adresów w prozie. Źródła zagraniczne oraz publiczne komunikaty emitenta.
9. **Jeden fakt nie jest trzema akapitami.** Nie powtarzaj tej samej informacji w tezie, czynnikach i wniosku. Łącznie opis i nowe punkty briefu do 300 słów. Prosty polski, czytelne akapity, bez mechanicznego powtarzania komunikatów o braku danych.
10. **Materiał niewystarczający.** Sam nagłówek pozwala streścić to, co dosłownie w nim napisano, ale nie upoważnia do wymyślania przyczyn, ryzyk i szczegółów. Bogatsza analiza wymaga odpowiednich dowodów, nie bardziej stanowczego stylu.
11. **ETF osobno.** Opisuj fundusz, ekspozycję, koncentrację i potwierdzone zmiany dotyczące funduszu. Kontrakt spółki z portfela ETF-u nie jest kontraktem ETF-u. Nie używaj wskaźników spółki do oceny kondycji funduszu.
12. **Jedna korekta w tym samym wywołaniu.** Sprawdź spójność nazw, dat, liczb, statusów transakcji i brak powtórzeń. Nie uruchamiaj dodatkowego modelu wyłącznie do poprawiania stylu.

## Co ma zawierać brief

Brief jest osobną częścią pod wykresem: **wydarzenia, terminy, działania**. Istotny fakt może wystąpić zarówno w opisie sytuacji, jak i w briefie, ponieważ te widoki pełnią różne funkcje. Opublikowane wyniki są wydarzeniem; brak przyszłej daty albo potwierdzonego wpływu na kurs nie jest powodem pominięcia ich w briefie. Nie dubluj jednego wydarzenia w kilku kategoriach samego briefu.

Dopisuj nowe, istotne punkty i zachowuj wcześniejsze do upływu sześciu miesięcy od publikacji. Nie czytaj codziennie całego archiwum i nie uzupełniaj automatycznie historii sprzed aktywacji monitoringu. Nie zamawiaj automatycznie pełnych streszczeń poszczególnych artykułów. Opracowania dotyczą tylko obserwowanych i portfela, przez ekonomiczny model; nadal bez płatnego API.

Nie wolno jednym tekstem „Brak nowych pozycji” zastępować wszystkich stanów. Rozróżnij: brak kwalifikujących się materiałów, oczekiwanie/pracę, błąd oraz ukończony wynik bez punktów briefu. Przy ostatnim stanie udostępnij jednorazowe, jawne „Uzupełnij brief”, bez automatycznych ponowień. Korekta używa ostatniej zapisanej partii, nie całej historii.

## Co rzeczywiście stwierdzono w działającej aplikacji

**Opis i brief AMD:** stan `done`; sprawdzenie 4 listopada o 15:00:33 czasu polskiego, zakończenie o 15:00:48. Użyto dwóch materiałów z tego dnia, opublikowanych o 13:44 oraz 14:24 czasu polskiego. Opis zawierał informację o wynikach, lecz `events`, `actions` i `deadlines` były puste. To nie był przypadek odrzucenia obu materiałów jako sprzed aktywacji. W prozie były UUID oraz powtórzona informacja, a generator otrzymał tylko krótkie fragmenty. To obserwacja wyjścia aplikacji, nie niezależne potwierdzenie treści raportu finansowego AMD.

**Dodatkowy błąd kodu:** `material_changed=false` blokowało dopisanie briefu, mimo że flaga opisuje zmianę ogólnej sytuacji, a nowy punkt briefu może być zasadny. Interfejs nie pokazywał kolejki ani błędu przy pustym briefie. Otwarty profil odświeżał wynik tylko przy rozwiniętym opisie; przy zwiniętym opis mógł już być gotowy na serwerze, a brief nadal pozostać stary w przeglądarce.

**Kursy:** raport serwera odczytany o 15:42:16 czasu polskiego. Pobranie rozpoczęło się o 15:40:07, zakończyło bez blokady źródła i bez pominiętych zapytań. Z katalogu 154 pozycji skonfigurowano 140 źródeł, pobrano 139 notowań. Wszystkie 139 zapisanych notowań miało datę 4 listopada. Jedno źródło — ETF-045 / OP8E.DE — zwracało dane starsze niż siedem dni i zostało odrzucone. Dla 14 pozycji nie ma potwierdzonego przypisania: AKCJA-066, 067, 074, 075, 090, 094, 099, 100, 101, 102, 104, 105 oraz ETF-019 i ETF-046. Ich poprawa wymaga weryfikacji właściwych instrumentów, giełd i walut; nie wolno zgadywać tickerów ani podstawiać podobnego funduszu.

**Rozbieżności ekranów:** lista i duży kurs w profilu korzystają z tabeli `quotes`; wykres pobiera odrębną serię i pokazuje wybrany punkt. Otwarty modal blokował pełne odświeżenie danych aplikacji. Także pozostawiony fokus w wyszukiwarce mógł je wstrzymywać. W efekcie nowy wykres mógł być widoczny obok starego kursu. Nie każda różnica wartości oznacza awarię źródła — punkt wykresu i notowanie mogą mieć inne daty — ale interfejs nie wyjaśniał tego wystarczająco.

**Przyciski:** Zakup znajdował się w jednym kontenerze, Komentarz i Sytuacja w drugim. Nakładające się reguły CSS oraz rozwijany opis zmieniały ich układ. Zastępuje je jeden rząd trzech równych przycisków; treść sytuacji rozwija się pod nim.

## Wdrożone poprawki i granice

- Nowa instrukcja i układ opisu: teza, czynniki z pogrubionymi nazwami, ryzyka i wniosek. Usuwanie technicznych UUID z istniejącego wyświetlanego tekstu.
- Wykorzystanie już pobranego publicznego tekstu zamiast samego fragmentu RSS, gdy tekst jest dostępny. Nadal najwyżej 20 nowych materiałów i łącznie do 8 tys. znaków materiału w partii, maks. 1600 na materiał. Bez dodatkowego researchu i modelu w testach.
- Brief dopisywany niezależnie od flagi zmiany opisu. Czytelne stany pustego briefu i jawna korekta ostatniego wyniku.
- Małe prywatne API kursów i odświeżanie tego samego zapisu na liście oraz w otwartym profilu. Ochrona przed nadpisaniem nowego kursu spóźnioną odpowiedzią dashboardu. Daty notowań również na kartach i osobna etykieta ceny punktu na wykresie.
- Jeden rząd: Zakup · Komentarz · Sytuacja.

Poprawki wdrożono 4 listopada 2026: wersja 8cd92322562c4c7bbe4944245049f374, kontroler succeeded. Nie naprawiają samoczynnie 14 niezweryfikowanych mapowań ani niedostępnego/starego źródła ETF-045. Nowy prompt sam nie przepisuje istniejących opisów; wymagają jawnej korekty lub kolejnego opracowania nowych materiałów. Pełna synteza historii firmy nie może powstać z dwóch urwanych nagłówków. Utrzymywanie długotrwałego kontekstu wymaga zachowywania ważnych, zweryfikowanych faktów wraz z dowodami; nie wolno udawać takiego kontekstu na podstawie pamięci modelu.

## Weryfikacja po wdrożeniu

109 testów przeszło lokalnie oraz w izolowanym kontenerze kontrolera. Test przeglądarkowy z otwartym profilem: zmiana testowego kursu ze 100 na 120 USD pojawiła się na liście i w nagłówku bez zamykania profilu; przy zwiniętej Sytuacji brief przeszedł w stan pracy. Trzy przyciski miały identyczne współrzędne pionowe, szerokość i wysokość 44 px.

Na produkcji główny kurs AMD na liście i w profilu wynosił 501,86 USD z tą samą datą źródła. Wartość punktu wykresu była opisana osobno. Jednorazowo, jawnie ponowiono ostatnią partię AMD (dwa fragmenty RSS), bez nowego przeszukiwania archiwum i bez masowego generowania pozostałych opisów. Wynik status done: brief zawiera punkt o przekroczeniu oczekiwań w wynikach według CNBC i link do źródła. Nowy opis nie zawiera UUID. Materiał pozostał skąpy; brakujące liczby i szczegóły nie zostały dopisane. Błędów konsoli nie było.

Wprowadzona korekta nie gwarantuje rozbudowanej analizy z samych nagłówków. Oszczędny model i nowy prompt nie zastępują materiałów źródłowych. Dla nowego opracowania kod używa również już pobranego dostępnego tekstu, przy zachowaniu limitu materiałów i zakazu wymyślania danych.

Kod źródłowy odpowiada manifestowi wdrożenia. Kopia sprzed poprawki jest na VPS (before-quality3-20261104-iygoa5z2), a kontroler zachował poprzedni obraz i bazę. Tymczasowy klucz SSH usunięto; Hostinger potwierdził pustą listę kluczy. Pozostałe 15 brakujących notowań nadal wymaga weryfikacji źródeł.
