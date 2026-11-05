# Obsługa na telefonie

[Spis dokumentacji](../README.md)

## Instalacja na iPhonie

Otwórz adres aplikacji HTTPS w Safari, zaloguj się, wybierz Udostępnij → Dodaj do ekranu początkowego. To PWA, bez pobierania z App Store. Adres `127.0.0.1` działa tylko na komputerze, na którym uruchomiono podgląd.

## Codzienne użycie

- **Start:** portfel, obserwowane i największe wzrosty/spadki całej dostępnej listy. Ranking nie ogranicza się do zakupów.
- **Spółki na giełdzie:** katalog akcji i ETF-ów z wyborem rodzaju. Gwiazdka i zakup są niezależne; wybrane podmioty są widoczne na Starcie.
- **Profil:** cena i data notowania, wykres, zakupy, terminy i publikacje. Zakup zapisuje ilość, cenę jednostkową, walutę i datę; niczego nie kupuje u brokera. Import JSON pomija dokładnie zgodne zapisane transakcje.
- **Wykres:** 1D, 1T, 1R, 5L; dotyk lub suwak pokazuje cenę i datę. Dzień przed otwarciem rynku może oznaczać ostatnią zakończoną sesję.
- **Sytuacja i brief:** opis otwierasz w profilu. Przyrostowy brief jest pod wykresem; Wszystkie publikacje otwiera nagłówki i artykuły. Osobne zakładki Obserwowane i Prasówka zostały usunięte. Komunikaty emitentów mają osobną kategorię; nagłówki pozostają w oryginale.
- **Kalendarz:** daty z dowodem źródłowym; termin szacowany pozostaje oznaczony. ICS dodaje pojedyncze wydarzenie do kalendarza telefonu.

## Publikacje i brief

Opracowanie publikacji czytasz w briefie pod wykresem. Lista Wszystkie publikacje służy do przeglądania oryginalnych nagłówków i otwierania źródeł. Nie planujemy osobnego streszczenia każdego artykułu — brief zbiera istotne wydarzenia, działania i terminy.

Starsze przyciski generowania streszczeń mogą nadal występować w obecnej wersji aplikacji. Ich wyłączenie pozostaje do wdrożenia; nie jest skutkiem samej aktualizacji tej instrukcji. [Stan decyzji](19-brief-zamiast-podsumowan.md). Kartę można płynnie zamknąć gestem w górę od uchwytu lub nagłówka.

## Codex i wdrażanie

W zakładce Codex połącz konto ChatGPT. Kod urządzenia pokazuje aplikacja po wybraniu logowania; wpisuje się go na stronie OpenAI. Nie jest to kod SMS ani kod blokady telefonu.

Po zleceniu zmiany backendu poczekaj na zakończenie pracy, wybierz Backend → Sprawdź, przejrzyj szczegóły i wybierz Wdróż. Przy błędzie startu kontroler próbuje przywrócić poprzednią wersję.
