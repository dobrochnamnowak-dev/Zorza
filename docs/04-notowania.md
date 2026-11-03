# Notowania i historia kursów

[Spis dokumentacji](../README.md)

## Źródło i identyfikacja

Zwykły kod pobiera publiczne dane Yahoo Finance. Nie używa modelu ani płatnego API. Nie ma gwarancji ciągłej dostępności źródła. W razie blokady nie są używane obejścia.

`quote-sources.json` zawiera potwierdzone mapowania. Odpowiedź musi zgadzać się z symbolem, walutą, typem i skonfigurowaną giełdą/nazwą. Sam identyczny ticker nie wystarcza.

Cena sesji regularnej i procent odnoszą się do poprzedniego zamknięcia. Zachowywana jest data źródła; starsza odpowiedź nie zastępuje nowszego notowania. Błąd odświeżenia pozostawia poprzednią cenę z jej datą. Raport `status.quotesReport` pokazuje braki i błędy. Ranking całej listy pomija nieporównywalne daty i błędne wartości.

## Wykresy

| Przycisk | Zapytanie źródłowe | Punkty | Cache |
| --- | --- | --- | --- |
| 1D | ostatnia sesja | 5 min | 15 min |
| 1T | 5 sesji | 30 min | 30 min |
| 1R | rok | dzienne | 6 h |
| 5L | pięć lat | tygodniowe | 24 h |

Historia jest pobierana po wybraniu zakresu i zapisywana w SQLite. Równoczesne wejścia w ten sam wykres korzystają z jednego zapytania. Do źródła trafiają maksymalnie dwa równoległe zapytania historii. HTTP 401/403/429 wstrzymuje kolejne pobrania historii na 30 minut. Zapisany starszy wykres może być pokazany z ostrzeżeniem.

Wykres używa źródłowej serii zamknięć, bez reinwestowania dywidend. Nie jest to całkowita stopa zwrotu. Dla 1D procent liczony jest od poprzedniego zamknięcia, a dla dłuższych zakresów od pierwszej dostępnej ceny. Punkt tygodniowy ma datę początku tygodnia. Źródłowa konwencja korekt serii pozostaje po stronie dostawcy; aplikacja nie wykonuje własnych korekt splitów.

Brakujące punkty przerywają linię. Krótsza historia nowej spółki lub ETF-u nie jest wydłużana fikcyjnymi danymi. Daty interfejsu są pokazywane w strefie Europe/Warsaw.
