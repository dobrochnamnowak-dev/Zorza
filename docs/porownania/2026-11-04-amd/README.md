# AMD: GPT-6.1 Sol low i GPT-6 Luna low

Test na zlecenie użytkownika, 4 listopada 2026. Jeden przebieg na model, ten sam prompt i pakiet danych (SHA-256 w metrykach), brak ponowień. Stan notowań: 11:14 EST / 17:14 Europe/Warsaw. Wyniki to zapis testu, nie aktualne notowania.

- [Sol — oryginalny wynik](sol-low.md)
- [Luna — oryginalny wynik](luna-low.md)
- [Wspólne wejście](wejscie.txt), [źródła i ograniczenia](zrodla.json), [metryki CLI](metryki.json)

| Pomiar | Sol low | Luna low |
|---|---:|---:|
| Czas jednego przebiegu | 25,77 s | 18,48 s |
| Tokeny wejściowe raportowane przez CLI | 14 739 | 14 048 |
| W tym wejściowe z cache | 8 960 | 0 |
| Tokeny wyjściowe | 933 | 863 |
| W tym rozumowanie | 120 | 0 |
| Słowa przed sekcją 5 (z nazwami źródeł, bez URL) | 243 | 271 |

## Co sprawdzono

Badanie porównuje syntezę, nie samodzielny research. Internet przeszukano centralnie raz; otwarto sześć zagranicznych adresów. Cztery strony były dostępne, Reuters/MarketScreener nie udał się odczyt, Yahoo zwróciło 429. Braki oznaczono w pakiecie. Oba modele dostały te same dane; narzędzia i wyszukiwanie w ich przebiegach były wyłączone. Nie wywołano żadnego narzędzia. CLI zgłosił brak opcjonalnego hosta Code Mode, co nie zatrzymało tych zadań tekstowych; oba zakończyły się poprawnie. Nie uruchamiano płatnego API ani dostępu SSH.

Tokeny uwzględniają kontekst systemowy CLI, więc mimo identycznego wejścia aplikacyjnego liczba tokenów wejściowych różni się między modelami. Nie obejmują centralnego researchu i tej rozmowy. Nie sumować osobno rozumowania drugi raz do wyjścia. Cache i różna waga modeli w abonamencie uniemożliwiają przełożenie tej tabeli na wiarygodny procent zużycia limitu lub porównanie ceny. To pojedynczy pomiar, nie benchmark szybkości.

## Ocena tego przypadku

Oba modele poprawnie policzyły zmiany kursu: +0,5% dzień, −16,0% wobec 28 października, −23,3% wobec 2 października. Nie pomyliły starszego premarketu z sesją. Oba podały prawdziwe daty z przekazanego kalendarza i nie wymyśliły następnego terminu wyników ani zweryfikowanych rekomendacji.

Sol zwięźlej wyjaśnił znaczenie obniżenia prognozowanej marży, wyraźniej nazwał własną ocenę, podał godzinę kursu i braki przyszłych terminów. Luna szybciej zakończyła przebieg, lecz powtórzyła dane kursu w czynnikach, zastosowała kropki w kwotach i nie zachowała jednego miejsca po przecinku we wszystkich procentach. Zdanie o tym, co „może wspierać odbicie”, umieściła w części „Fakty”, choć to interpretacja. Sol nie wskazał wprost daty tygodniowej bazy w tekście, a oba raporty pominęły konkretne ryzyka regulacyjne i dostaw wymienione przez emitenta. Żaden wynik nie spełnia więc całego standardu bez zastrzeżeń.

W tym przypadku preferuję Sol low do opisu sytuacji; to ocena jednej pary, bez dowodu na ogólną przewagę w samodzielnym wyszukiwaniu. Luna pozostaje rozsądnym kandydatem do tłumaczeń i prostego porządkowania danych. Automatyzacja na VPS nie została zmieniona. Docelowy prompt zapisano w ../../prompty/sytuacja-spolki.md.

Dokumentacja modeli: [OpenAI Docs — Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [OpenAI Docs — Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). Dostęp do obu potwierdzono w lokalnym teście Codex CLI, nie na VPS.
