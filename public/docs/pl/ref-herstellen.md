# Przywracanie po awarii

Aplikacja desktopowa automatycznie przechowuje migawki odzyskiwania Twojej pracy. Jeśli aplikacja zamknie się niespodziewanie (awaria, brak zasilania), przy następnym uruchomieniu oferuje przywrócenie tej pracy.

## Jak działa automatyczny zapis

- Wkrótce po każdej zmianie (poniżej sekundy) aplikacja zapisuje migawkę każdego otwartego dokumentu do własnego folderu danych — dla wszystkich otwartych kart, łącznie z dokumentami, które nigdy nie zostały zapisane.
- To nie jest zamiennik zapisywania: sam plik projektu się nie zmienia. Zapisuj więc swoją pracę regularnie za pomocą Ctrl+S.
- Migawki są usuwane, gdy tylko dokonasz wyboru w oknie odzyskiwania (**Przywróć** albo **Nie przywracaj**).
- **Tylko aplikacja desktopowa.** Wersja przeglądarkowa nie ma automatycznego zapisu ani odzyskiwania — zapisuj tam pracę regularnie samodzielnie.

## Okno „Przywróć niezapisaną pracę"

Pojawia się przy uruchomieniu, gdy znalezione zostaną migawki: „Open Planner Studio nie zostało zamknięte poprawnie. Poniższe dokumenty miały niezapisane zmiany, które można przywrócić:" Dla każdego dokumentu pokazuje:

- **nazwę** (nazwę pliku albo nazwę projektu; bez nazwy: „Projekt bez nazwy");
- **ścieżkę pliku**, jeśli dokument był kiedykolwiek zapisany;
- **liczbę zadań** w migawce;
- **Zapisano** — czas ostatniej migawki.

## Wybory

- **Przywróć** (albo **Enter**) — wszystkie wymienione dokumenty wracają jako otwarte karty. Liczą się wtedy jako niezapisane: zapisz je samodzielnie.
- **Nie przywracaj** — migawki są odrzucane; zaczynasz z pustym projektem.
- **Krzyżyk zamykający**, **Esc** albo kliknięcie poza oknem — bezpiecznie odłóż decyzję: nic nie jest odrzucane ani przywracane; pytanie pojawi się ponownie przy następnym uruchomieniu.

## Dalsza lektura

- [Szybki start](docs://quick-start) — zapisywanie i otwieranie projektów.
