# Optymalizacja transportu i pobierania — etap 1

5 listopada 2026. Zakres zaakceptowany przez użytkownika: czat, współdzielenie odczytów artykułów, lżejszy Start. Harmonogramy, katalog, modele, źródła i retencja pozostają zgodne z PRD.

## Czat

Nowy klient pyta `/api/chat/status?sync=1&cursor=…`. Most zwraca `sync` w wersji 1: procesowy epoch i rewizję w `cursor`, `reset`, pełną kolejność identyfikatorów oraz wyłącznie nowe lub zmienione wiadomości. Odpowiedź podczas streamingu aktualizuje tylko właściwą wiadomość. Nie zmieniamy retencji ani nie usuwamy historii dla oszczędności.

Po restarcie mostu nieznany epoch wymusza komplet początkowy. Usunięcie zdjęć z istniejącej wiadomości i zmiany kolejności są synchronizowane. Bez zmian nie przesyłamy ponownie tekstów ani data URL zdjęć; klient nie przebudowuje tych samych dymków. Odpytywanie nadal co 3 sekundy podczas widocznego czatu, bez wywoływania modelu. Równoczesne zapytania klienta są blokowane, a po niekompletnym zestawie kolejny odczyt żąda pełnego stanu.

Zapytanie `?meta=1` zwraca sam stan połączenia, np. przed wysłaniem screenów. Stary klient i stary most zachowują zgodność przez dotychczasowy pełny format `messages`.

## Wspólny odczyt artykułu

`createArticleReader` współdzieli publiczny odczyt między sprawdzeniem dostępności artykułu i ekstrakcją terminów tego samego cyklu. Tabela `article_page_cache` przechowuje URL, ETag, Last-Modified, wyodrębniony tekst i czas weryfikacji, bez pełnego HTML. Kontrola domen nadal poprzedza użycie treści dla konkretnego podmiotu.

Nowy cykl zawsze weryfikuje źródło: warunkowo przez `If-None-Match` / `If-Modified-Since`, jeżeli wydawca ma walidatory; inaczej pełnym GET. HTTP 304 używa potwierdzonego tekstu. Nowa treść zastępuje poprzednią. Odmowa, błąd lub paywall nie zwracają starego tekstu jako aktualnego; `no-store` nie zapisuje treści na dysku. Nie pomijamy zaplanowanego sprawdzenia tylko dlatego, że kiedyś pobrano stronę.

Współdzielenie obejmuje ten sam slot publikacji/kalendarza; cykl opisów ma własny czytnik, a następny slot osobny kontekst. Pula trzyma najwyżej cztery konteksty. Nie zmieniamy częstotliwości cen ani źródłowych dat danych.

## Lżejsze widoki

Dotychczasowe `/api/dashboard` pozostaje pełnym kontraktem. Nowy klient używa `?view=overview` na Starcie, liście i czacie: bez archiwum artykułów, zleceń i pełnych opisów. Zamiast nich dostaje metadane i oznaczenia zmian. Kalendarz i Ustawienia pobierają odpowiednio `?view=calendar` lub `?view=settings`.

`omitted` wskazuje pola pominięte, a nie celowo opróżnione. Klient zachowuje wcześniej pobrane publikacje i nowsze notowania. Opis tej samej wersji pozostaje w pamięci. Profil używa istniejącego `/api/insight`, publikacje `/api/instrument-articles`; te odczyty nie uruchamiają modelu ani generowania danych. Przygotowanie na VPS pozostaje niezależne od otwarcia aplikacji.

## Weryfikacja lokalna

124 testy aplikacji przeszły, w tym siedem scenariuszy nowego transportu i API. Po korekcie kolejności wiadomości i sprzątania fixture powtórzono siedem testów dotkniętych zmianą — poprawne. Bez rzeczywistych wywołań modelu.

Sprawdzono: niezmieniony czat bez ponownej transmisji zdjęcia, streaming, usunięcie załącznika, zmiana kolejności, restart mostu, starszy kontrakt, źródło zmienione/304/403/paywall/no-store, brak walidatorów, kontrola domen, wspólne pobranie dla kalendarza i publikacji oraz nowy odczyt kolejnego slotu. Test HTTP potwierdził pomijanie ciężkich pól i zachowanie pełnych danych profilu oraz kalendarza.

Na lokalnej atrapie mostu przy 390 × 844: komplet wiadomości po odświeżeniach, działający Kalendarz i Ustawienia, brak poziomego przewijania i błędów konsoli. Liczby oszczędności z danych testowych nie są benchmarkiem produkcji.

## Stan wdrożenia

Wdrożone 5 listopada 2026 o 13:30:49 czasu polskiego (12:30:49 UTC). Kontroler potwierdził przetestowaną wersję `1d1fcc3ecea44e72ac567b54083760f3` jako `succeeded`; kontener aplikacji używa obrazu tej wersji. Most czatu ma nowy transport. Publikację wykonano etapami: najpierw zgodny backend, następnie klient i końcowy obraz całego zestawu. Poprzednia wersja `5b3c1cdce7504cc78f6966a3b398c2f4` pozostaje punktem przywrócenia.

Pomiary na produkcji, dla tego samego stanu danych:

| Odczyt | Pełna odpowiedź | Odpowiedź po optymalizacji |
| --- | ---: | ---: |
| Czat: początkowa synchronizacja / kolejne odpytanie bez zmian | 6 356 261 B | 5 182 B |
| Dashboard: pełny kontrakt / Start (`view=overview`) | 4 021 846 B | 67 345 B |

To rozmiary treści odpowiedzi, nie pomiar łącznego ruchu ani kosztu całego VPS-a. Początkowe wczytanie czatu nadal przesyła pełną historię. Mechanizm współdzielenia artykułów sprawdzono testami kontrolowanymi, w tym warunkowym odczytem 304 i nowym cyklem; nie szacujemy oszczędności produkcyjnych pobrań przed obserwacją zaplanowanego cyklu.

W produkcyjnej przeglądarce przy 390 × 844 sprawdzono Start, profil z pełnym zapisanym opisem, listę publikacji, Kalendarz i Ustawienia. Brak poziomego przewijania i błędów konsoli. Skróty kontrolne obserwowanych, zakupów i komentarzy przed i po wdrożeniu są identyczne. Kontenery aplikacji, mostu i HTTPS działają z `restart: unless-stopped`; Docker i kontroler wdrożeń są aktywne. Most zgłasza gotowość i aktywne logowanie ChatGPT.

Potwierdzono aktywny harmonogram serwera: ceny całej listy 15:40 i 21:45, dodatkowo obserwowane i portfel 18:30, publikacje i kalendarz 15:40; opisy i briefy w poniedziałki i czwartki o 14:30 oraz pierwszy opis po dodaniu podmiotu. Wszystkie godziny dotyczą `Europe/Warsaw`. Procesy działają na VPS niezależnie od komputera użytkownika. Nie uruchamiano rzeczywistych modeli w celu testowania optymalizacji ani nie wykonywano pełnego pobierania danych poza harmonogramem.

Zakres weryfikacji nie obejmuje gwarancji dostępności zewnętrznych wydawców, kompletności wszystkich mapowań notowań ani przyszłego czasu zakończenia badań AI. Dotychczasowe ograniczenia źródeł pozostają zgodne ze SPEC.

Po weryfikacji usunięto tymczasowy klucz SSH użyty do wdrożenia.
