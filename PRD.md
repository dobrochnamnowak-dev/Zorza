# Zorza — PRD

Wymagania produktu · wersja 1.2 · 5 listopada 2026
Właścicielka produktu: właścicielka prywatnej aplikacji Zorza
Baza: [kod optymalizacji 74319c5](https://github.com/dobrochnamnowak-dev/Zorza/commit/74319c55be700f3a532225386e0e61d1daeda4c3), ustalenia właścicielki i wdrożenie `1d1fcc3ecea44e72ac567b54083760f3` sprawdzone 5 listopada 2026. Dokument nie potwierdza wykonania późniejszych cykli serwera. Korekta zakresu po tym wdrożeniu: osobne streszczenia artykułów wycofano na rzecz briefu. Usunięcie starszego mechanizmu nie zostało wdrożone; szczegóły w [decyzji produktowej](docs/19-brief-zamiast-podsumowan.md).

[One-pager produktu](ONE-PAGER.md) · [Specyfikacja techniczna](SPEC.md) · [Dokumentacja projektu](README.md)

## 1. Problem i cel

Informacje o spółkach i ETF-ach są rozproszone między notowaniami, portalami branżowymi i stronami emitentów. Użytkowniczka potrzebuje krótkiego przeglądu na telefonie: co zmieniło się w jej podmiotach, dlaczego mogło się zmienić, jakie informacje są istotne i kiedy nastąpi kolejne wydarzenie. Ręczne sprawdzanie wszystkich stron i odświeżanie aplikacji ma zastąpić proces działający na serwerze.

Zorza jest prywatną aplikacją informacyjną. Umożliwia śledzenie zatwierdzonego katalogu, własnych zapisów zakupów i obserwowanych instrumentów. Nie wykonuje transakcji, nie zastępuje rachunku maklerskiego i nie zapewnia pewnych prognoz kursów.

## 2. Użytkownicy i najważniejsze zadania

| Rola | Potrzeba |
| --- | --- |
| Właścicielka | Sprawdzić portfel, notowania, sytuację podmiotu, publikacje i terminy na iPhonie |
| Właścicielka w roli redaktorki listy | Dodać obserwowanie, zapisać zakup, komentarz lub oznaczyć artykuł |
| Właścicielka w roli zatwierdzającej | Zlecić zmianę Codexowi i zatwierdzić konkretną przetestowaną wersję backendu |
| Administrator | Utrzymać VPS, logowanie mostu, kopie danych i publikację usług |

To role operacyjne w prywatnym systemie. Obecna wersja nie ma osobnych kont zespołu ani uprawnień dla wielu inwestorów.

Najważniejsze scenariusze:

1. Otwieram Start i widzę portfel, obserwowane oraz największe wzrosty i spadki całej dostępnej listy.
2. Otwieram profil podmiotu: sprawdzam cenę, wykres, słowny opis sytuacji, ryzyka i brief pod wykresem.
3. Pod briefem wybieram Wszystkie publikacje; widzę oryginalne nagłówki, podmioty, daty i linki do źródeł. Merytoryczne opracowanie publikacji czytam w briefie, bez osobnego generowania streszczeń artykułów.
4. Dodaję podmiot do obserwowanych albo zapisuję pierwszy zakup. Serwer włącza jego źródła i przygotowuje pierwszy opis, jeśli znajdzie wystarczające materiały.
5. Z telefonu zlecam Codexowi poprawkę aplikacji. Przed wdrożeniem backendu oglądam zapisany wynik testów i wybieram Wdróż.

## 3. Zakres wersji bazowej

Katalog zawiera 108 akcji i 46 ETF-ów według `catalog.json` z dnia opracowania dokumentu. Zakres można zmieniać tylko po zatwierdzeniu właścicielki. Podobny ticker nie oznacza tego samego instrumentu.

Obserwowane i kupione są niezależne. Zbiór osobisty to suma obu grup; wspólny podmiot przetwarzamy raz. Pozostała część katalogu może mieć notowania i wykres, lecz nie uruchamia nowego pobierania publikacji, terminów ani opisów AI.

| ID | Wymaganie i kryterium odbioru | Stan bazowy |
| --- | --- | --- |
| FR-01 | PWA na iPhone: dostęp przez HTTPS, instalacja z Safari, poprawny układ przy szerokości 390 px; komputer może być wyłączony | Działa |
| FR-02 | Start pokazuje portfel i obserwowane jako osobne sekcje. Każdy podmiot ma jedną kartę, bez dodatkowej ramki całej listy | Działa |
| FR-03 | Ranking wzrostów i spadków pokazuje do trzech pozycji w każdej grupie akcji i ETF-ów, z całego dostępnego katalogu; pomija nieporównywalne notowania | Działa dla dostępnych danych |
| FR-04 | Spółki na giełdzie pozwalają wybrać akcje lub ETF-y, wyszukać podmiot i dodać go do obserwowanych. Osobnych zakładek Obserwowane i Prasówka nie ma | Działa |
| FR-05 | Cena ma walutę, znak zmiany procentowej i datę źródłową. Ta sama cena jest używana na liście i w profilu; starsza odpowiedź nie cofa nowszej | Działa dla potwierdzonych mapowań |
| FR-06 | Profil oferuje wykres 1D / 1T / 1R / 5L. Dotyk lub suwak pokazuje cenę i datę punktu; brak historii nie tworzy sztucznych danych | Działa, zależne od źródła |
| FR-07 | Zapis zakupu obejmuje ilość, cenę jednostkową, walutę i datę. Gwiazdka nie jest zakupem; zapis nie wysyła zlecenia do brokera. Import pomija dokładne duplikaty | Działa |
| FR-08 | W profilu są komentarze i przyciski Zakup / Komentarz / Sytuacja: jeden równy rząd, bez ramek. Na kartach Startu komentarzy i Sytuacji nie ma | Działa |
| FR-09 | Nowe publikacje dotyczą wyłącznie zbioru osobistego. Każda ma przypisany podmiot, wydawcę, datę i link; komunikaty emitenta stanowią osobną kategorię | Działa, pokrycie niepełne |
| FR-10 | Wszystkie widoki pokazują oryginalny nagłówek. Tytuł angielski lub polski nie czeka na tłumaczenie; brak automatycznych zadań tłumaczeń | Działa |
| FR-11 | Wymaganie osobnego streszczenia artykułu wycofane. Zastępuje je brief FR-13; publikacja zachowuje oryginalny nagłówek, podmiot, datę i link. Bez przycisku generowania, osobnej kolejki AI i ponawiania streszczeń | Decyzja potwierdzona; starszy mechanizm w kodzie pozostaje do wyłączenia |
| FR-12 | Sytuacja firmy zawiera krótką tezę, konkretne czynniki, uzasadnione ryzyka, przyszłe terminy i ostrożny wniosek. Każde ustalenie ma źródło; data opisu oznacza rzeczywiste wygenerowanie | Działa dla zbioru osobistego |
| FR-13 | Brief pod wykresem dopisuje tylko nowe istotne wydarzenia, działania i terminy. Nie odczytuje ponownie całego archiwum; przy braku nowych informacji nie uruchamia AI | Działa w uzgodnionym cyklu |
| FR-14 | Zmiana merytoryczna opisu lub nowy punkt briefu włącza czerwone oznaczenie przy podmiocie; samo sprawdzenie lub zmiana stylu go nie włącza. Odczyt dotyczy konkretnej wersji | Działa |
| FR-15 | Znalezione przyszłe terminy trafiają automatycznie do kalendarza aplikacji, z podmiotem i dowodem. Miesiąc, kwartał, półrocze lub rok nie są prezentowane jako pewny dzień | Działa, pokrycie niepełne |
| FR-16 | Harmonogram wykonuje serwer, bez otwierania aplikacji. Częstotliwości cen i publikacji można zmieniać osobno; harmonogram opisów jest odrębny | Działa |
| FR-17 | Czat z Codexem działa z telefonu, przyjmuje tekst i do trzech zgodnych zdjęć. Backend publikuje dopiero osobny kontroler po zatwierdzeniu konkretnej wersji | Działa; wymaga ważnego logowania |
| FR-18 | Błąd nie udaje sukcesu: pozostaje ostatni poprawny kurs z datą, a sytuacja i brief pokazują właściwy stan. Nie ma automatycznych ponowień błędów przez model | Działa; wymaga dalszego monitorowania |
| FR-19 | Oszczędzanie transferu zachowuje pełną historię czatu, komplet danych profilu, nowsze kursy i kalendarz. Każdy nowy cykl nadal weryfikuje źródła; godziny, modele i zakres pracy na VPS pozostają bez zmian | Wdrożone i sprawdzone 5 listopada 2026 |

„Działa” oznacza kod i wcześniejszą weryfikację opisaną w notatkach wdrożeń. Nie oznacza kompletności źródeł ani gwarancji nieprzerwanej pracy zewnętrznych usług.

## 4. Standard treści

### Sytuacja firmy i ETF-u

Opis jest po polsku, słowny i zwięzły: cel redakcyjny około 300 słów. Zawiera tezę w 1–2 zdaniach, do czterech różnych czynników i krótkie, źródłowo uzasadnione ryzyka. Pokazuje najbliższe znalezione terminy oraz wniosek kończący się zdaniem „To nie jest rekomendacja inwestycyjna.” Propozycje dalszej analizy są schowane, aby nie przeciążać profilu.

Przyczyna ruchu kursu wymaga dowodu. Sama zbieżność publikacji i spadku ceny nie pozwala napisać, że artykuł spowodował spadek. Należy odróżniać prognozy od wyników, zapowiedziane umowy od zamkniętych transakcji i ocenę analityka od faktu. Brak danych o ryzyku nie oznacza braku ryzyka.

Dla ETF-u opis dotyczy funduszu, jego ekspozycji, koncentracji i konstrukcji. Kontrakt spółki z portfela nie jest kontraktem ETF-u. Dostępność, koszty, waluty i zabezpieczenie walutowe muszą wynikać z dokumentów konkretnego produktu.

Aktualna automatyzacja korzysta z materiałów pobranych przez kod. Samodzielny pełny research internetowy modelu pozostaje poza wdrożonym cyklem.

### Publikacje i brief

Brief jest jedynym opracowaniem zbioru publikacji. Osobne streszczenia artykułów, także na żądanie, są wycofane z zakresu. Sytuacja firmy pozostaje odrębnym opisem bieżącej kondycji, czynników kursu i ryzyk.

Źródła: wyłącznie zatwierdzone zagraniczne portale i publiczne strony emitentów. Nie obchodzimy paywalli ani blokad. Nagłówek pozostaje w oryginale; polski język interfejsu nie zmienia kraju wydawcy.

Brief jest odrębny od opisu. Istotne wyniki lub kontrakt mogą dostać punkt, nawet jeśli nie potwierdzono wpływu na cenę. Każdy punkt wygasa po sześciu miesiącach kalendarzowych od publikacji najstarszego cytowanego materiału. Pierwszy opis może wykorzystać materiały sprzed obserwowania, lecz nie uzupełnia nimi historycznego briefu.

## 5. Harmonogram i automatyzacja

Wszystkie godziny oznaczają `Europe/Warsaw`, ze zmianą czasu.

| Kiedy | Zakres i zadanie |
| --- | --- |
| Poniedziałek i czwartek 14:30 | Sprawdzenie źródeł, opis i brief zbioru osobistego, jeśli są nowe materiały |
| Codziennie 15:40 | Dostępne kursy katalogu; publikacje i terminy wyłącznie zbioru osobistego |
| Codziennie 18:30 | Dodatkowe kursy zbioru osobistego |
| Codziennie 21:45 | Ponownie dostępne kursy katalogu |
| Dodanie obserwowania lub pierwszego zakupu | Aktywacja źródeł i pierwszy opis po pobraniu wystarczających materiałów |

Częstotliwości cen i publikacji mają opcje: codziennie, dwa razy dziennie, dwa razy w tygodniu. Wariant tygodniowy tych ustawień oznacza wtorek/piątek 15:40, a nie poniedziałek/czwartek opisów. Dodatkowe 18:30 jest niezależne.

Uzgodnione dopisywanie briefu oraz obecny cykl opisów kończą się **4 maja 2027 o 23:59:59 czasu polskiego**. Przed tą datą trzeba zdecydować o przedłużeniu. To odrębne ograniczenie od sześciomiesięcznej ważności każdego punktu.

## 6. Wygląd i obsługa telefonu

Czarne tło i nawigacja; zielono-fuksjowo-niebieska zorza w prawym górnym rogu, gwiazdy, czytelne logo Zorzy. Estetyka ma ułatwiać szybkie przeglądanie i zachować dotychczasowy charakter aplikacji. Tło profilu jest spójne z ekranami głównymi.

Nazwy podmiotów, ceny i ważne nagłówki mają wyraźną hierarchię. Filtry mają bardziej kwadratowy kształt i efekt fizycznych przycisków 3D; przyciski Zakup / Komentarz / Sytuacja pozostają bez ramek. Logotypy są używane tam, gdzie są dostępne; w pozostałych przypadkach czytelny znak zastępczy. Minimalny tekst dotyczy nawigacji i kart, nie pozbawia opisu źródeł ani ryzyk.

Pola dotykowe mają co najmniej 44 px. Kolor nie jest jedynym oznaczeniem zmiany; wymagane są znak i liczba. Kartę zamyka × albo gest w górę od uchwytu/nagłówka, z płynną animacją. Tryb ograniczonego ruchu wyłącza zbędne animacje i miganie. Zwykłe przewijanie tekstu nie może przypadkowo zamknąć karty.

## 7. Mierniki i odbiór

Nie ustalono liczbowego SLA, docelowej dostępności ani miesięcznego budżetu tokenów. Nie przedstawiamy ich jako spełnionych. Do oceny służą lokalne raporty i testy:

| Miernik | Oczekiwany wynik |
| --- | --- |
| Pokrycie kursów | Liczba poprawnie pobranych względem skonfigurowanych; braki jawne |
| Świeżość | Osobno czas notowania, wygenerowania opisu i sprawdzenia źródeł |
| Koszt bezczynności | Zero wywołań modelu dla pustej kolejki i tytułów |
| Jakość terminów | Każdy widoczny termin ma podmiot, źródło i właściwą precyzję |
| Stabilność wyświetlania | Lista i profil korzystają z tego samego najnowszego kursu |
| Odbiór mobilny | Czytelny profil, publikacje i kalendarz przy 390 × 844, bez wymuszonego poziomego przewijania |
| Oszczędne pobieranie | Bez zmian nie przesyłamy ponownie pełnej historii czatu; Start nie pobiera archiwum publikacji, a profil nadal udostępnia pełne dane |

Przy wydaniu należy przejść scenariusze FR-01–FR-19 odpowiednie do zmiany i kontrolę na VPS. Ostatni pełny zestaw aplikacji: 124 testy, 5 listopada 2026. Osiem testów kontrolera sprawdzono przy wcześniejszej weryfikacji; etap optymalizacji nie zmieniał kontrolera. Testy nie wywołują rzeczywistego modelu. Sama ich liczba nie dowodzi wykonania późniejszego zaplanowanego cyklu.

W pomiarze produkcyjnym Start zwrócił 67 345 B zamiast 4 021 846 B pełnego dashboardu; kolejne odpytanie niezmienionego czatu 5 182 B wobec 6 356 261 B początkowej synchronizacji. To obserwacje rozmiaru odpowiedzi dla jednego stanu danych, nie SLA ani obietnica obniżenia kosztów hostingu lub tokenów. Szczegóły: [wdrożenie optymalizacji](docs/18-optymalizacja-transportu.md).

## 8. Poza obecną wersją i dalsze decyzje

| Temat | Stan / warunek kolejnego etapu |
| --- | --- |
| Pełne pokrycie katalogu | Do dalszej weryfikacji mapowań i źródeł; braków nie uzupełnia się fikcyjnymi danymi |
| Pełny research AI | Wymaga zakresu, limitu źródeł i zgody na dodatkowe zużycie; wybór modelu sam tego nie uruchamia |
| Cykl po 4 maja 2027 | Wymaga decyzji o przedłużeniu i osobnej zmianie konfiguracji/kodu |
| Długotrwała niedostępność serwera | Brak odtwarzania wszystkich pominiętych cykli; potrzebne uzgodnienie powiadamiania o awarii i nadrabiania |
| App Store, handel, płatne notowania, wielu użytkowników | Poza zakresem; wymagają osobnej decyzji produktowej |
| Automatyczna synchronizacja GitHub–VPS | Niewdrożona. Aktualizacja repozytorium i publikacja aplikacji pozostają osobnymi czynnościami |

Zmiana tych decyzji wymaga aktualizacji PRD, odpowiadającego mu punktu SPEC i kryterium odbioru. Materiały historyczne zachowujemy jako uzasadnienie decyzji, bez przywracania wycofanych wymagań, np. tłumaczenia nagłówków lub codziennych opisów.
