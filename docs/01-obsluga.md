# Obsługa na telefonie

[Spis dokumentacji](../README.md)

## Instalacja na iPhonie

Otwórz adres aplikacji HTTPS w Safari, zaloguj się, wybierz Udostępnij → Dodaj do ekranu początkowego. To PWA, bez pobierania z App Store. Adres `127.0.0.1` działa tylko na komputerze, na którym uruchomiono podgląd.

## Codzienne użycie

- **Start:** portfel, obserwowane i największe wzrosty/spadki całej dostępnej listy. Ranking nie ogranicza się do zakupów.
- **Akcje / ETF-y:** kupione, obserwowane i pozostałe. Gwiazdka i zakup są niezależne.
- **Profil:** cena i data notowania, wykres, zakupy, terminy i publikacje. Zakup zapisuje ilość, cenę jednostkową, walutę i datę; niczego nie kupuje u brokera. Import JSON pomija dokładnie zgodne zapisane transakcje.
- **Wykres:** 1D, 1T, 1R, 5L; dotyk lub suwak pokazuje cenę i datę. Dzień przed otwarciem rynku może oznaczać ostatnią zakończoną sesję.
- **Prasówka:** obserwowane i portfel albo pozostałe podmioty; Dzisiaj / Wczoraj / Przedwczoraj / Archiwum oraz kategorie. Komunikaty prasowe są osobno.
- **Kalendarz:** daty z dowodem źródłowym; termin szacowany pozostaje oznaczony. ICS dodaje pojedyncze wydarzenie do kalendarza telefonu.

## Podsumowanie artykułu

Wybierz Generuj podsumowanie. Zlecenie jest zapisywane na serwerze, a po zakończeniu wynik pojawia się automatycznie w otwartym artykule. Nie trzeba ponownie generować tekstu ani trzymać komputera włączonego. Gotowy tekst otwiera przycisk Czytaj podsumowanie. Błąd można ponowić ręcznie.

Podsumowanie informuje, czy powstało z pełnego tekstu, fragmentu RSS czy nagłówka. Link do oryginału pozostaje dostępny.

## Codex i wdrażanie

W zakładce Codex połącz konto ChatGPT. Kod urządzenia pokazuje aplikacja po wybraniu logowania; wpisuje się go na stronie OpenAI. Nie jest to kod SMS ani kod blokady telefonu.

Po zleceniu zmiany backendu poczekaj na zakończenie pracy, wybierz Backend → Sprawdź, przejrzyj szczegóły i wybierz Wdróż. Przy błędzie startu kontroler próbuje przywrócić poprzednią wersję.

Ustawienia przypomnień są zapisane, ale powiadomienia push nie są jeszcze wysyłane.
