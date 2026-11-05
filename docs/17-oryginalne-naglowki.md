# Oryginalne nagłówki — 4 listopada 2026

> Notatka historyczna. Aktualny stan po wdrożeniu z 5 listopada: nagłówki w oryginale, osobne streszczenia wyłączone; Sol low przygotowuje sytuację i brief. [Potwierdzenie](19-brief-zamiast-podsumowan.md). Starsze zapisy poniżej nie przywracają wycofanych funkcji.

## Diagnoza produkcji

Odczyt prywatnego statusu wykazał 100/100 wykorzystanych tłumaczeń w dniu polskim oraz 122 oczekujące nagłówki. Samo źródło miało tytuły, ale interfejs zasłaniał je komunikatem „Nagłówek w tłumaczeniu”. Była to kolejka ograniczona budżetem, nie brak pobranych publikacji.

## Zmiana na życzenie użytkownika

- Wszystkie listy, profil i okno artykułu pokazują wyłącznie oryginalny `articles.title`; wyszukiwanie korzysta z tego samego tytułu. Oryginalny nagłówek angielski lub polski nie wymaga opracowania AI.
- Automatyczne tłumaczenie usunięto z workera. Nie sprawdza cache tłumaczeń, nie zużywa limitu 100/dzień i nie wywołuje modelu dla nagłówków. Historyczne stany ustawiane są na `disabled`; nowe i zmienione artykuły dostają ten sam stan.
- `/api/title-retry` odpowiada 410, a most odrzuca zadania `titles` przed uruchomieniem CLI. Usunięto komunikaty oczekiwania, błędy tłumaczenia i przyciski ponawiania z interfejsu.
- Stare tłumaczenia/cache pozostają w bazie jako historia, ale nie są prezentowane, wyszukiwane ani ponownie zlecane.
- Podsumowania artykułu nadal po polsku, wyłącznie na żądanie. Historyczne pole schematu `title_pl` zawiera wtedy oryginalny tytuł; nie nadpisuje tytułu publikacji i nie zasila cache tłumaczeń.
- Tylko zatwierdzone zagraniczne źródła; oryginalny polski tytuł od takiego wydawcy nie jest powodem odrzucenia. To nie zgoda na polskie portale ani rozszerzenie katalogu źródeł.
- Harmonogram cen, opisów, briefu oraz kalendarza pozostaje bez zmian.

## Stan

Wdrożono przez kontroler wersję `d9b97559380549ea9321a8541409b48e` 4 listopada 2026 o 21:46:51 Europe/Warsaw. Lokalnie przeszło 117 testów; kontroler również potwierdził testy i zakończył publikację statusem `succeeded`. Most: `zorza-chat:original-headlines-20261104`, zachowany obraz poprzedni `zorza-chat-before-headlines-20261104`.

Potwierdzenie produkcyjne: `headlines.enabled=false`, `mode=original`, `pending=0`; wszystkie 3040 zapisanych artykułów mają stan tłumaczenia `disabled`. Przebieg pustej kolejki nie wykonał modelu ani sprawdzenia jego dostępności. Most odrzucił zadanie `titles` przed CLI. Prywatne API nie eksponuje historycznych `title_pl`; 336 osobistych publikacji pozostaje dostępnych. Na ekranie 390 × 844 sprawdzono oryginalne nagłówki w profilu Marvell. Logowanie ChatGPT pozostaje gotowe i uwierzytelnione, scheduler aktywny. Bez rzeczywistych wywołań AI podczas wdrożenia i weryfikacji.

Kopia poprzednich plików pozostaje na VPS w `/opt/zorza/config/headlines-release-20261104/before`.
