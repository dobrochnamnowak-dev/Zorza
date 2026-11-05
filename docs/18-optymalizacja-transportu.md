# Optymalizacja transportu i pobierania — etap 1

5 listopada 2026. Zakres zaakceptowany przez właścicielkę: czat, współdzielenie odczytów artykułów, lżejszy Start. Harmonogramy, katalog, modele, źródła i retencja pozostają zgodne z PRD.

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

Przygotowane i przetestowane lokalnie. Potwierdzenie aktywnej wersji i usunięcia tymczasowego dostępu będzie dopisane po wdrożeniu. Nie zmieniać harmonogramów ani włączać modelu dla testów statusu.
