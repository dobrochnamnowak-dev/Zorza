# Opisy, kalendarz i praca bez komputera — 4 listopada 2026

## Wdrożona zmiana

- Sol low: sytuacja i przyrostowy brief w poniedziałki i czwartki o 14:30 Europe/Warsaw; brak nowych materiałów nie uruchamia AI. Bez automatycznych ponowień błędów.
- Pierwszy opis nowo obserwowanego lub zakupionego podmiotu powstaje po pobraniu źródeł, bez czekania na ten termin. Do 20 materiałów z 14 dni; historyczne materiały nie trafiają do przyrostowego briefu.
- Kursy całej listy 15:40 i 21:45; dodatkowo obserwowane lub portfel 18:30. Publikacje i kalendarz osobiste 15:40. Pobieranie danych wykonuje kod, bez AI do sprawdzania pustej kolejki.
- Każdy źródłowo potwierdzony przyszły termin opisu trafia do wspólnego kalendarza. Miesiąc, kwartał, półrocze lub rok mają początek/koniec przedziału i odpowiednią etykietę, bez udawania dokładnego dnia.
- Opis pokazuje datę rzeczywistego wygenerowania, kurs datę notowania ze źródła. Sprawdzenie niezmienionych źródeł nie zmienia daty opisu.

## Jednorazowe opracowania

Przygotowano 12 nowych raportów na zamówienie właścicielki. Łącznie 199 509 tokenów wejścia i wyjścia generowania; research dodatkowo. Ponownie wykorzystano gotowy raport AMD, bez trzynastego wywołania modelu. Raporty mają zweryfikowane publiczne zagraniczne źródła, rzeczywistą datę i ograniczenia danych. Znaleziono dziewięć przyszłych terminów lub przedziałów; dwa AMD były już w kalendarzu i nie powinny się zdublować.

Źródła tego jednorazowego researchu są oznaczone jako `research`: niewidoczne jako nowe publikacje, wykluczone z briefu i automatycznego ponownego opracowania. Zapis gotowych raportów jest atomowy i idempotentny, tylko dla nadal obserwowanych lub posiadanych podmiotów. Nie zapisujemy zakupów ani komentarzy w artefaktach researchu lub repozytorium.

## Infrastruktura i granice

Harmonogram i kolejki działają w stałym procesie serwera na VPS. Telefon i Mac nie muszą być włączone. Kontenery powinny mieć politykę automatycznego uruchomienia po restarcie; przy wdrożeniu należy sprawdzić stan, aktywny scheduler, trwały wolumen danych i uwierzytelniony most ChatGPT. Wygaśnięcie logowania, limit ChatGPT lub niedostępność źródła może wstrzymać opracowanie; kod nie generuje wtedy fikcyjnego wyniku i nie ponawia automatycznie AI.

Automatyczny research modelu w sieci nadal nie jest włączony. W cyklu model opracowuje materiały pobrane przez kod. Apple Calendar i push nadal nie są automatycznie zsynchronizowane.

## Stan

Wdrożono wersję `af2b1e5b7fc04d9682a90c8f0a7ccf16` 4 listopada 2026 o 21:24:46 Europe/Warsaw. 117 testów lokalnie i testy kontrolera przeszły. Kontroler potwierdził `succeeded`; wszystkie 13 osobistych opisów są `done`, mają ważne źródła, a kolejka opisów jest pusta. Dziewięć osobistych terminów/przedziałów widocznych w kalendarzu; scalono starszą szacowaną telekonferencję NVIDIA z potwierdzonym komunikatem. Widok sprawdzono w rozmiarze 390 × 844.

Dodatkowy slot osobisty `2026-11-04/18:30` wykonano po uruchomieniu wersji: 13/13 kursów, zero błędów, sprawdzenie źródła 20:24:45 UTC (21:24:45 Polska). Jest to wykonanie po wdrożeniu, a nie dowód pobrania o 18:30 przed jego wdrożeniem. Daty notowań w UI pochodzą ze źródła.

Na VPS potwierdzono: `SCHEDULER_ENABLED=1`; preferencje cen `twice_daily`, publikacji `daily`, opisów `personal`; wszystkie trzy kontenery uruchomione z `restart=unless-stopped`; Docker i `zorza-deploy.service` włączone i aktywne. Most odpowiada HTTP 200, `ready=true`, `authenticated=true`, `busy=false`. Wybór modelu `insight`: `gpt-6.1-sol`, rozumowanie low. Pierwszy przyszły cykl opisów: czwartek 5 listopada o 14:30; skonfigurowany i przetestowany, jeszcze nie wykonany w chwili tej kontroli.

Kopia bazy i zmienionych plików pozostaje wyłącznie na VPS w `/opt/zorza/config/weekly-release-20261104/before`. Poprzedni obraz mostu: `zorza-chat-before-weekly-20261104`.
