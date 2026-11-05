# Wdrażanie backendu Zorzy z telefonu

To mechanizm własnej aplikacji, nie dodatkowa usługa OpenAI. Nie uruchamia modelu ani nie wymaga płatnego API. Obejmuje backend aplikacji; most Codexa, konfiguracja VPS, Dockerfile i sam kontroler nadal wymagają administratorki.

## Obsługa

1. W czacie zleć Codexowi zmianę backendu i zaczekaj na zakończenie pracy.
2. W sekcji **Backend** wybierz **Sprawdź zmiany**. Serwer zapisze oddzielną wersję i uruchomi jej testy w odizolowanym kontenerze.
3. Sprawdź listę plików i identyfikator wersji. Wybierz **Wdróż zmiany**. Ten przycisk zatwierdza dokładnie zapisaną wersję; późniejsze edycje Codexa nie wchodzą do niej.
4. Poczekaj na „Backend wdrożony i sprawdzony”. W czasie restartu możliwa jest krótka przerwa. Przy błędzie startu przywracany jest poprzedni obraz i baza sprzed wdrożenia.

## Granice dostępu

- Agent nadal działa jako użytkownik 1000 bez root, Dockera, konfiguracji VPS, bazy portfela i dostępu do innych aplikacji.
- Kontroler działa na hoście i przyjmuje tylko `status`, `prepare` oraz `deploy` z identyfikatorem przetestowanej wersji. Nie przyjmuje poleceń powłoki, ścieżek, nazw obrazów ani adresów URL.
- Prywatne gniazdo Unix jest montowane tylko do backendu WWW, nigdy do kontenera agenta. Żądanie wymaga zalogowanej sesji i zgodnego Origin. Tokeny i cookies nie trafiają do procesu Codexa.
- Testy projektu uruchamia Docker bez sieci, sekretów i bazy produkcyjnej, jako użytkownik bez root, z limitami zasobów. Kontroler nigdy nie uruchamia testów projektu jako root na hoście.
- Zaufany Dockerfile, usługa i kontroler muszą znajdować się poza katalogiem agenta i należeć do root. Wgrany przez agenta Dockerfile, Compose lub skrypt npm nie jest wykonywany przez kontroler.
- Wdrożony backend ma dostęp do swojej produkcyjnej bazy i konfiguracji, więc zatwierdzenie dowolnego kodu pozostaje istotną decyzją. Lista plików i testy nie zastępują oceny zmiany.
- Frontend `public/` zachowuje dotychczasowy podgląd na żywo; automatyczny powrót obejmuje backend i bazę, a nie te pliki interfejsu.
- Awaria procesu/hosta w środku wdrożenia daje stan `interrupted` i wymaga sprawdzenia przez administratorkę; nie ponawia się wdrożenia samoczynnie.

## Jednorazowa instalacja przez administratorkę

1. Skopiuj `controller.py` jako `/opt/zorza/config/deployment-controller.py`, `Deployment.Dockerfile` do `/opt/zorza/config/Deployment.Dockerfile`, oba jako root bez prawa zapisu agenta.
2. Utwórz `/opt/zorza/deploy-state` z trybem 0700 i `/opt/zorza/deploy-run` z trybem 0755, przypisane do konta root.
3. Skopiuj `deployment-access.json` do `/opt/zorza/config/` jako root. Nakładka Compose dodaje **tylko do app** zmienną `DEPLOY_SOCKET=/run/zorza-deploy/control.sock` i montowanie `/opt/zorza/deploy-run:/run/zorza-deploy:ro`. Do kontenera agenta nie dodaje żadnego montowania ani uprawnień. Pierwsze administracyjne wdrożenie uruchom z `-f compose.yml -f deployment-access.json`; później kontroler sam używa tej nakładki.
4. Zainstaluj `zorza-deploy.service` w `/etc/systemd/system/`, uruchom `systemctl daemon-reload` i `systemctl enable --now zorza-deploy`.
5. Przed pierwszą zmianą zapisz root-only `baseline.json` ze skrótami obecnie wdrożonego kodu (funkcja `freeze` kontrolera). Opublikuj backend z `lib/deployment.mjs`, trasami `/api/deployment/*` i panelem w czacie. Zapisz bazową listę skrótów po tym wdrożeniu.
6. Zweryfikuj uprawnienia gniazda, blokadę bez logowania/Origin, przygotowanie wersji, wdrożenie, brak powtórnego wdrożenia, test odrzucenia błędnego kodu i powrót przy nieudanym starcie na środowisku testowym. Nie uruchamiaj celowo błędnej wersji na produkcji.
7. Kolejne administracyjne restarty Compose muszą uwzględniać `-f /opt/zorza/config/deployment-access.json -f /opt/zorza/config/deployment-override.json --no-build`, aby zachować dostęp do kontrolera i nie zastąpić ostatniego obrazu wersją sprzed wdrożenia. Sam restart kontenera zachowuje obraz.

Kontroler wymaga co najmniej 2 GiB wolnego miejsca przed przygotowaniem. Zachowuje pięć ostatnich prób oraz aktywną wersję, a starsze kopie i ich tagi usuwa przed kolejnym przygotowaniem. Docker odmawia usunięcia używanego obrazu. Kopie bazy zawierają dane prywatne i pozostają wyłącznie na serwerze w katalogu root. Dodatkowe codzienne kopie bazy pozostają niezależne od tego mechanizmu.


Instalacja 3 listopada 2026 zakończona. Kontroler systemd zorza-deploy aktywny; panel Backend → Sprawdź zmiany → Wdróż zmiany działa przez prywatne gniazdo dostępne tylko backendowi. Przetestowano 54 testy aplikacji w kontenerze bez sieci i sekretów, 8 testów kontrolera oraz rzeczywisty powrót obrazu i testowej bazy w odrębnym środowisku Docker. Duplikat wdrożenia HTTP 409, brak sesji HTTP 401, obcy Origin HTTP 403. Harmonogram i połączenie ChatGPT zachowane. Przy pracy Codexa lub aktualizacji danych przygotowanie/wdrożenie jest blokowane komunikatem HTTP 409; poczekaj na zakończenie pracy.
