# Wdrożenie na Hostingerze

[Spis dokumentacji](../README.md) · [Instrukcja kontrolera](../deployment/README.md)

## Układ produkcji

```text
/opt/zorza/source/       kod widoczny dla Codexa jako /workspace
/opt/zorza/config/       zaufana konfiguracja i sekrety; poza repozytorium
/opt/zorza/data/         trwała baza aplikacji; poza repozytorium
/opt/zorza/chat-state/   własne logowanie ChatGPT i czat; poza repozytorium
/opt/zorza/deploy-state/ wersje i kopie sprzed wdrożeń; dostęp root
/opt/zorza/deploy-run/   prywatne gniazdo kontrolera
```

Aplikacja, most i HTTPS działają jako oddzielne usługi Compose. Zorza nie zastępuje konfiguracji innych aplikacji współdzielących serwer. Konkretne adresy i hasło dostępu przechowuje się w prywatnej konfiguracji administratora.

[Szablon app + chat](../deployment/compose.app-chat.example.yml) pokazuje rozdzielenie sekretów, katalogów i uprawnień. Nie zawiera konfiguracji HTTPS istniejącego serwera ani prawdziwych plików env.

## Zmiana interfejsu

`public/` ma podgląd na żywo po odświeżeniu. Przy dodawaniu nowego modułu JS trzeba sprawdzić także listę dozwolonych zasobów w `server.mjs`; inaczej stary backend może zwracać 404.

## Zmiana backendu

1. Codex kończy edycję kodu na VPS.
2. Właścicielka wybiera Backend → Sprawdź.
3. Kontroler zapisuje oddzielną wersję, wykonuje testy bez sieci i sekretów jako użytkownik 1000, po czym buduje obraz przez zaufany Dockerfile.
4. Właścicielka przegląda listę plików i wybiera Wdróż. Publikowana jest zapisana wersja, nie późniejsze edycje katalogu roboczego.
5. Kontroler zachowuje poprzedni obraz i bazę, uruchamia app oraz sprawdza odpowiedź. Przy błędzie próbuje przywrócić backend i bazę sprzed wdrożenia.

Przygotowanie i wdrażanie jest blokowane podczas aktywnej pracy Codexa lub aktualizacji danych. Frontend z public/ nie jest automatycznie cofany razem z backendem. Awaria hosta w środku procesu daje stan wymagający sprawdzenia administracyjnego.

## Uprawnienia i utrzymanie

Kontroler, Dockerfile oraz nakładki są kopiowane do config i należą do root. Zmiana szablonu w repozytorium nie modyfikuje aktywnego kontrolera. Gniazdo jest montowane wyłącznie do app; agent nie ma Dockera, gniazda ani uprawnień root.

Administracyjne polecenia Compose muszą zachować kolejność nakładek: `compose.yml`, `deployment-access.json`, `deployment-override.json` i `--no-build`, aby nie zastąpić wdrożonego obrazu starą wersją. Szczegóły pierwszej instalacji są w deployment/README.md.

Są osobne codzienne kopie bazy. Do kopii aktywnego SQLite stosuje się mechanizm backup, nie kopiowanie samego pliku przy otwartym WAL. Kontroler zachowuje pięć ostatnich prób i aktywną wersję oraz wymaga 2 GiB wolnego miejsca przed przygotowaniem.

Repozytorium nie zawiera prawdziwego Compose z sekretami, bazy ani konfiguracji logowania. GitHub i VPS nie synchronizują się automatycznie — publikacja kodu i wdrożenie to odrębne czynności.
