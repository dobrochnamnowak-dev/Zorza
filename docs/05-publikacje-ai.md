# Publikacje, źródła i AI

[Spis dokumentacji](../README.md)

## Dobór publikacji

Każdy artykuł jest przypisany do instrumentu. W publikacjach profilu są zweryfikowane zagraniczne źródła ogólnofinansowe i branżowe oraz oficjalne domeny spółek i emitentów ETF-ów. Reguły są w `publication-policy.mjs` i `issuer-sources.mjs`. Polski interfejs nie oznacza korzystania z polskich portali. Nie ma osobnej zakładki Prasówka.

Pobieranie publikacji i komunikatów obejmuje tylko obserwowane LUB zakupione podmioty. Dodanie do którejś grupy włącza pobranie; usunięcie z obu zatrzymuje nowe pobrania i zachowuje historię.

`syncPublicationSources` odtwarza źródła z aktualnego katalogu i branży. `sources.json` jest zapisem generowanym. Nowy zatwierdzony podmiot powinien mieć `working_group` i opcjonalnie zweryfikowany `official_url`. Dla nieznanej branży działają źródła ogólnofinansowe; specjalistycznych domen nie należy dopisywać bez weryfikacji.

Źródło jest sprawdzane także przy przyjmowaniu artykułu, nie tylko przy tworzeniu kanału. Komunikaty emitentów mają `publication_kind=press`. Pozostałe kategorie obejmują wyniki, kontrakty, działania i inne doniesienia. Kategorie przed opracowaniem mogą być wstępne.

## Nagłówki

Na listach są oryginalny nagłówek, podmiot, wydawca i data. Tłumaczenie nagłówków jest wyłączone; angielski lub polski tytuł jest widoczny od razu. Stare tłumaczenia i cache pozostają wyłącznie jako historia. Worker nie zleca tłumaczeń, a most odrzuca `titles` przed uruchomieniem CLI. Szczegóły: [oryginalne nagłówki](17-oryginalne-naglowki.md).

Lista publikacji dzieli materiały na Dzisiaj, Wczoraj, Przedwczoraj i Archiwum. Nieprzeczytane i oznaczenie ważności są trwałe; usunięty wpis nie wraca po następnym pobraniu.

## Opracowanie publikacji w briefie

Brief jest jedynym opracowaniem zbioru publikacji. Dopisuje nowe istotne wydarzenia, działania i terminy, z przypisaniem źródeł; zachowuje ustaloną przyrostowość, ważność i harmonogram. Lista artykułów pokazuje oryginalny tytuł, podmiot, wydawcę, datę i link do oryginału.

Osobne streszczenia artykułów, także na żądanie, są wycofane z zakresu, aby nie dublować treści i zużycia AI. Sytuacja firmy pozostaje osobnym opisem kondycji, czynników kursu i ryzyk. Paywalle i blokady nadal nie są obchodzone.

W kodzie pozostaje starszy worker streszczeń i jego interfejs. Ich wyłączenie wymaga zmiany aplikacji i wdrożenia; nie zostało potwierdzone w tej aktualizacji dokumentacji. [Decyzja i kryteria wyłączenia](19-brief-zamiast-podsumowan.md).

## Wspólny odczyt treści

Od wdrożenia z 5 listopada publikacje i kalendarz tego samego cyklu współdzielą odczyt artykułu przez `article-reader.mjs`. Trwały cache zawiera tekst i walidatory HTTP, bez pełnego HTML. Następny cykl ponownie weryfikuje źródło; błąd lub blokada nie udostępnia starego tekstu jako aktualnego, a `no-store` wyłącza zapis trwały. Kontrola domen pozostaje osobna dla każdego podmiotu.

Optymalizacja nie zmienia harmonogramu ani zakresu pobrań. Wycofanie osobnych streszczeń jest późniejszą, odrębną decyzją. Szczegóły: [optymalizacja transportu](18-optymalizacja-transportu.md).
