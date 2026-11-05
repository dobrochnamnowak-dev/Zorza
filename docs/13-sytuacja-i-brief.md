# Sytuacja podmiotu i brief prasowy

> Notatka historyczna. Aktualny stan po wdrożeniu z 5 listopada: nagłówki w oryginale, osobne streszczenia wyłączone; Sol low przygotowuje sytuację i brief. [Potwierdzenie](19-brief-zamiast-podsumowan.md). Starsze zapisy poniżej nie przywracają wycofanych funkcji.

**Aktualizacja 4.11.2026:** obowiązuje [nowy harmonogram](16-harmonogram-i-opracowania.md): poniedziałek i czwartek 14:30 oraz pierwszy opis po dodaniu podmiotu. Ten zapis zastępuje wymienione poniżej codzienne 15:00.

Nowszy wybór modelu z 4 listopada: Sytuacja i brief używają GPT-6.1 Sol low, tłumaczenia i pojedyncze podsumowania pozostają na Lunie. Szczegóły i potwierdzenie wdrożenia: [Kalendarz i model](15-kalendarz-i-model.md). To zastępuje wcześniejszy wybór Luny dla zadania insight opisany poniżej.

Zmiana z 4 listopada 2026. Na ekranie Start pozostają niezależne grupy Portfel i Obserwowane. Osobne zakładki Obserwowane oraz Prasówka zastępuje zakładka Spółki na giełdzie z przełącznikiem Akcje / ETF-y. Pokazuje pozostałe pozycje z zatwierdzonego katalogu. Dodanie do obserwowanych przenosi pozycję na Start; nie dodaje zakupu.

W profilu podmiotu są rozwijana Sytuacja spółki / Sytuacja ETF-u i Dodaj komentarz. Komentarze są prywatnymi, osobnymi wpisami zapisywanymi w bazie serwera; każdy ma własny identyfikator i datę. Zachowano istniejące komentarze. Opis w krótkich akapitach zawiera bieżącą sytuację, potwierdzone czynniki ruchu kursu i ryzyka. Osobny brief pod wykresem zawiera: wydarzenia, terminy, działania. Pod briefem jest przycisk Wszystkie publikacje, otwierający również starsze materiały. Indywidualne podsumowanie artykułu nadal powstaje wyłącznie po kliknięciu użytkowniczki.

## Zatwierdzony zakres i koszty

Właścicielka ograniczyła pobieranie publikacji, automatyczne opisy i briefy **wyłącznie do obserwowanych i portfela**. Zrezygnowała na tym etapie z cotygodniowych opracowań pozostałych instrumentów. Ustawienia dopuszczają wyłączenie opisów albo zakres osobisty. Pozostałe podmioty zachowują ceny, wykresy, obserwowanie i dostęp do już zapisanych publikacji; nie pobieramy dla nich nowych materiałów.

- Codziennie od **15:00 Europe/Warsaw**, na VPS-ie, bez komputera właścicielki: pobranie osobistych źródeł publikacji i terminów, porównanie materiałów i zapis zleceń rzeczywistej pracy. Godzina oznacza start aktualizacji; zakończenie zależy od źródeł i kolejki.
- Dotychczasowe pobrania wszystkich cen o 15:40 i 21:45 pozostają niezależne. Pobrania publikacji/kalendarza o 15:40 również obejmują wyłącznie obserwowane i portfel.
- Maksymalnie 20 nowych, jeszcze nieopracowanych materiałów w partii na podmiot, od momentu włączenia monitoringu; bez przyszłych i niezweryfikowanych publikacji. Dane wejściowe to nagłówki i ograniczone fragmenty RSS, bez masowego pobierania pełnych tekstów. Interfejs wskazuje podstawę oraz liczbę użytych materiałów.
- Model opracowań: **gpt-6-luna**, `model_reasoning_effort=low`, przez istniejące logowanie ChatGPT na serwerze. Bez płatnego API. Brak automatycznego przejścia na droższy model.
- Te same materiały nie tworzą kolejnego wywołania modelu. Zmiana ceny bez nowych dowodów również nie uruchamia AI. Pusta kolejka i sprawdzanie harmonogramu to zwykły kod. Błąd nie jest automatycznie ponawiany przez model.
- Opracowania korzystają ze wspólnego limitu 300 operacji mostu dziennie UTC. Tokeny i limity planu ChatGPT są odrębnym ograniczeniem. Nie podajemy niezweryfikowanych kosztów w złotych ani zużycia limitu abonamentu.
- Do modelu trafiają publiczna tożsamość instrumentu, dostępne materiały i poprzedni opis do porównania. Nie trafiają zakupy, ceny nabycia, ilości ani komentarze.

## Wiarygodność i sygnalizacja

Każdy punkt ma odnośniki wyłącznie do przekazanych materiałów. Terminy muszą odpowiadać dacie, pewności i publikacji zapisanej już w kalendarzu. Brak potwierdzonego wyjaśnienia ruchu kursu jest jawnie wskazany; korelacja nie jest przedstawiana jako ustalona przyczyna. Brak danych o ryzykach nie oznacza braku ryzyka.

Nowy lub istotnie zmieniony opis dostaje trwałe oznaczenie nieprzeczytania i pulsującą kontrolkę. Samo sprawdzenie źródeł, duplikat wiadomości lub zmiana stylu nie powinny zapalać jej ponownie. Otwarcie opisu oznacza konkretną wersję jako przeczytaną; spóźniona odpowiedź nie kasuje oznaczenia nowszej wersji. Zwykłe nieprzeczytane publikacje mają statyczny znacznik. Przy ograniczeniu animacji w systemie kontrolka nie pulsuje.

Materiały usunięte, zmienione lub po upływie 6 miesięcy ważności nie mogą dalej uzasadniać wyświetlanego opisu. Przy braku aktualnych dowodów opis jest ukrywany z informacją o potrzebie aktualizacji. Opracowanie nie gwarantuje pełnego pokrycia wszystkich doniesień. Blokady i paywalle nie są obchodzone.

## Implementacja i wdrożenie

- `lib/company-insights.mjs`: trwała kolejka, okno źródeł, porównanie wejścia, walidacja, wersje i odczyt.
- `scripts/insight-ai.mjs`: schemat i instrukcje krótkiego polskiego opracowania.
- `scripts/publication-ai.mjs` i `scripts/chat-bridge.mjs`: ekonomiczny model i nowy rodzaj pracy `insight`.
- `public/company-insights.js` i `public/app.js`: mobilne opisy, briefy, komentarze i nowe menu.
- Nowe tabele: `company_insights`, `insight_jobs`, `instrument_comments` pozostaje w dotychczasowym schemacie wielowpisowym. Migracja dodaje tabele opisów i zachowuje dotychczasowy portfel.
- Nowe API: GET `/api/insight?id=...`, POST `/api/insight-read`, `/api/insight-retry`, `/api/instrument-comments` (istniejący wielowpisowy mechanizm komentarzy). Dotychczasowe logowanie i kontrola Origin obejmują te operacje.

Zmiana mostu wymaga wdrożenia administracyjnego; sam kontroler backendu nie przełącza obrazu usługi chat. Nie oznaczaj funkcji jako działającej na produkcji po samym zapisaniu plików lub przejściu testów lokalnych.

## Ostateczne doprecyzowanie — przyrostowo przez 6 miesięcy

Ta sekcja zastępuje wcześniejsze okno 30 dni i opis ponownego opracowywania zestawu źródeł. Nie pobieramy historycznych materiałów do nowego briefu. Po włączeniu monitoringu model otrzymuje wyłącznie nowe publikacje lub nowe wersje zmienionych materiałów. Otrzymuje też niewielki kontekst zapisanych punktów, aby nie powielać tej samej informacji; nie dostaje ponownie dawnych artykułów. Kolejne punkty dopisywane są do zachowanego briefu. Wygaśnięcie wpisu nie uruchamia AI.

Każda wiadomość jest ważna przez 6 miesięcy kalendarzowych od publikacji (z prawidłowym końcem lutego), nie przez umowne 180 dni. Uzgodniony okres dopisywania kończy się 4 maja 2027 r. po zakończeniu dnia w Polsce. Wpisy nie znikają tylko dlatego, że skończył się okres dopisywania; zachowują własny termin ważności.

`brief_monitors` zapisuje aktywny zakres i moment startu. Zdarzenia POST watch/purchase/purchase-delete automatycznie synchronizują zakres. Pierwsze obserwowanie lub zakup tworzy sprawdzenie źródeł bez modelu, również przed porą codzienną; usunięcie z obu grup zatrzymuje pracę. Rejestr `brief_seen` zapobiega ponownemu opracowywaniu, także po restarcie i po błędzie. `brief_entries` zachowuje dopisywane punkty, źródła, wersje i daty ważności.

`lib/issuer-calendar.mjs` sprawdza tylko wybrane podmioty, korzystając ze zweryfikowanych domen. Weryfikuje publiczny kalendarz/IR, odkrywa odnośniki na stronie zamiast zgadywać adresy, sprawdza do 3 stron na emitenta dziennie i ogranicza przekierowania do jego domen. Nie obchodzi logowania, paywalla ani blokad. Wspólne strony są pobierane raz w przebiegu. Dane Event ze struktury strony aktualizują identyfikowalny termin zamiast go dublować. Data odczytu kalendarza jest oznaczona jako odczyt, nie oryginalna data publikacji. Dla ETF-u ogólne terminy emitenta nie mogą zostać przypisane wszystkim funduszom: wymagana jest zweryfikowana strona konkretnego funduszu i zgodność tożsamości. Brak takiego źródła pozostaje brakiem pokrycia.

Kod połączono z najnowszą wersją VPS, zachowując komentarze, załączniki, kontrolę dostępu do treści artykułów i dotychczasowe wdrażanie z czatu.

## Zamykanie kart

Przycisk × pozostaje. Dodatkowo przeciągnięcie uchwytu lub nagłówka w górę o co najmniej 80 px zamyka kartę z płynnym wysunięciem i wygaszeniem tła (260 ms). Przewijanie treści i obsługa przycisków nie rozpoczynają tego gestu. Krótki, boczny lub anulowany gest przywraca położenie; systemowe ograniczenie ruchu wyłącza animacje. Implementacja jest w `public/card-dismiss.js`, a działający podgląd w osobnej makiecie na porcie 4290. Zmiana została wdrożona na VPS 4 listopada 2026.

## Potwierdzone wdrożenie — 4 listopada 2026

Wersja `b36d46069012482b88327ba68a89845b`, kontroler: `succeeded`, 12:31 UTC / 13:31 Polska. 103 testy przeszły lokalnie i w izolowanym kontenerze kontrolera. Osobny test migracji na kopii pozostającej na VPS potwierdził zachowanie zakupów, komentarzy, publikacji, terminów i notowań oraz integralność SQLite. Kod na serwerze odpowiada zamrożonemu manifestowi.

Opublikowano układ, słowne opisy, oddzielny brief pod wykresem, przyrostowy monitoring od aktywacji (ważność 6 miesięcy), ograniczenie pobierania do obserwowanych lub portfela i gest zamykania z animacją. Most Codexa dostał obsługę insight oraz gpt-6-luna/low, zachowując logowanie, załączniki i izolację. Nie wykonano rzeczywistego wywołania modelu w testach. Brak historycznego uzupełniania oznacza, że nowy brief początkowo może być pusty.

Potwierdzono health HTTP 200, aktywny harmonogram, zgodność aktywnych monitorów z obserwowanymi/portfelem, ChatGPT authenticated i ready. Ceny: twice_daily (15:40/21:45), publikacje: daily; osobisty monitoring opisów/emitentów od 15:00 Europe/Warsaw. Gest sprawdzono na działającym serwerze w widoku 390 px: karta zamknięta i tło odblokowane; błędów konsoli nie było.

Poprzednia wersja i kopia bazy pozostają na VPS do powrotu. Tymczasowy klucz SSH usunięto; API Hostingera potwierdziło pustą listę kluczy.

## Uproszczenie Startu — kolejna poprawka z 4 listopada

Portfel i Obserwowane pokazują tylko kompaktowe karty (logo, nazwa, kurs, zmiana; w portfelu także ilość). Komentarze i Sytuacja są dostępne po wejściu w profil. Każdy podmiot ma jedną ramkę; kontener całej grupy/asset-list jest przezroczysty, bez własnego obramowania i cienia. Pozostają nagłówki grup, suma portfela i sygnały nowych publikacji. Poprawka wdrożona na VPS 4 listopada 2026 po wyraźnej zgodzie na tymczasowy klucz SSH. Zmieniono wyłącznie cztery pliki interfejsu (app.js, style.css, index.html i sw.js) oraz dopisano instrukcję dla agenta. Backend bez restartu; health HTTP 200. Na widoku telefonu 390 px potwierdzono brak narzędzi na Starcie, border 0 i przezroczyste tło kontenerów list, pojedynczy border 1 px kart oraz zachowanie komentarza i Sytuacji w profilu. Brak błędów konsoli. Kopia poprzednich plików na VPS: before-start-cards-20261104-a2swi1bj. Klucz usunięto; lista SSH Hostingera pusta.

Nowsza korekta jakości opisu, pustego briefu, spójności kursów i przycisków została wdrożona w wersji 8cd92322562c4c7bbe4944245049f374. Szczegóły, standard pisania i zweryfikowane ograniczenia: [Standard i diagnoza](14-standard-opisu-i-diagnoza.md).
