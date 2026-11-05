# Prompty i instrukcje

[Spis dokumentacji](../../README.md)

## Źródło prawdy

Aktywne prompty podsumowań są w `scripts/publication-ai.mjs`, razem ze schematami JSON. Instrukcje czatu znajdują się w `scripts/chat-bridge.mjs`, a zasady pracy nad projektem w `AGENTS.md`. Dokumentacja nie zastępuje uruchamianego kodu.

## Oryginalne nagłówki

Tłumaczenie wyłączono 4 listopada 2026. Tytuły są wyświetlane bez wywołania AI; dawne zadanie `titles` jest odrzucane. Historyczna nazwa pola `title_pl` w schemacie podsumowania nie oznacza tłumaczenia — generator kopiuje oryginalny tytuł.

## Podsumowanie

Wejście: podmiot, tytuł, data publikacji, URL, ograniczony tekst i informacja, czy to tekst, fragment lub nagłówek. Wynik: oryginalny tytuł, zwykle 3–4 krótkie zdania, krótkie znaczenie bez spekulacji, kategoria i wyłącznie rzeczywiste zapowiedzi z dokładną datą oraz cytatem. Gdy danych jest mało, tekst może być krótszy. Data artykułu nie jest automatycznie datą wydarzenia.

Treści źródła nie mogą zlecać terminala, sieci, odczytu plików ani innych narzędzi. Wynik jest walidowany przez serwer, łącznie ze zgodnością wersji artykułu.

## Wzorzec zlecenia ręcznego researchu

> Sprawdź publiczne zagraniczne doniesienia o [podmiot i potwierdzony ticker/ISIN]. Uwzględnij oficjalne komunikaty emitenta i uznane źródła branżowe. Oddziel fakty, zapowiedzi i interpretacje. Przy każdym ustaleniu podaj źródło, datę publikacji oraz — jeśli inna — datę wydarzenia. Nie wymyślaj terminów, brakujących danych ani treści niedostępnego artykułu. Wskaż zakres poszukiwań i braki. Nie uruchamiaj płatnych usług ani masowych opracowań bez uzgodnienia.

Ten wzorzec nie jest cyklicznym zadaniem i sam nie włącza żadnego modelu.

## Sytuacja spółki

[Wzorzec właścicielki i warunki weryfikacji](sytuacja-spolki.md): pięć sekcji, do około 300 słów, dane i daty ze źródłami, wyłącznie zagraniczne publikacje. Zapisany 4 listopada 2026; porównanie Sol low i Luna low zachowano jako historyczny test. Właścicielka następnie wybrała Sol low do sytuacji i briefu; aktywny prompt jest w `scripts/insight-ai.mjs`. Harmonogram: poniedziałek i czwartek 14:30 plus pierwszy opis po dodaniu.
