# Łącza zewnętrzne

Okno **Łącze zewnętrzne (między projektami)** rejestruje zależność między zadaniem w tym projekcie a zadaniem w innym pliku projektu — na przykład projektem robót terenowych, który musi się zakończyć przed Twoim startem.

## Otwieranie

Karta **Relacje** → przycisk **Łącze zewnętrzne…**. Musi być zaznaczone dokładnie jedno zadanie; w przeciwnym razie pojawia się „Zaznacz jedno zadanie, aby dodać łącze zewnętrzne."

## Zamrożona kotwica

Łącze zewnętrzne nie oblicza się na żywo względem projektu źródłowego. Gdy je dodajesz, odpowiednia data zadania źródłowego (początek lub koniec, w zależności od kierunku i typu relacji) jest zapisywana jako stała **data zakotwiczenia**; obliczenie wykorzystuje tę datę jako granicę. Jeśli projekt źródłowy zmieni się później, nic się nie przesuwa razem z nim, dopóki nie **odświeżysz** łącza.

## Dwie drogi

- **Plik źródłowy** — wybierz plik pod **Wybierz ostatni plik**; jest on wczytywany tylko do odczytu („Plik źródłowy jest wczytywany tylko do odczytu — nie jest otwierany jako dokument."). Następnie wybierz **Zadanie źródłowe** z listy; data zakotwiczenia jest odczytywana automatycznie z tego zadania i pokazywana na dole. Ta droga wymaga aplikacji desktopowej i co najmniej jednego ostatniego pliku.
- **Ręcznie (rozwiązanie zastępcze)** — brak pliku pod ręką (albo wersja przeglądarkowa): wklej **Identyfikator projektu** i **Identyfikator zadania** zewnętrznego zadania, opcjonalnie **Nazwę zadania**, i wprowadź samodzielnie **Datę zakotwiczenia**. Łącze ręczne jest oznaczone jako „nieaktualne", dopóki odświeżenie faktycznie nie znajdzie źródła.

## Pola wspólne

- **Kierunek** — **Poprzednik (zewnętrzny → ja)**: zadanie zewnętrzne decyduje o moim zadaniu; albo **Następnik (ja → zewnętrzny)**: moje zadanie decyduje o zewnętrznym.
- **Typ relacji** — FS, SS, FF lub SF.
- **Zwłoka (dni robocze)** — czas oczekiwania (albo ujemna: nakładanie) na dodatek do kotwicy.

**Dodaj łącze** zapisuje łącze (wyłączony, dopóki wymagane pola nie są wypełnione); **Anuluj** zamyka bez dodawania.

## Zarządzanie, odświeżanie i brakujące źródła

Istniejące łącza są wymienione w panelu Relacje pod **Łącza zewnętrzne**:

- Dla każdego łącza: zadanie źródłowe, typ, kotwica oraz odznaka **nieaktualne**, gdy tylko źródła nie można było (już) wczytać — z wyjaśnieniem „źródło niewczytane — zaimportuj ponownie, aby odświeżyć".
- **Odśwież to łącze** — ponownie odczytuje plik źródłowy tego jednego łącza i aktualizuje kotwicę.
- **Odśwież kotwice zewnętrzne** — ponownie odczytuje każdy przywołany plik źródłowy i aktualizuje wszystkie kotwice oraz status nieaktualności. Potem wiersz stanu zgłasza, ile kotwic odświeżono i ile pozostało nieaktualnych.
- **Usuń** — usuwa łącze.
- Odświeżanie odczytuje pliki, więc działa tylko w aplikacji desktopowej; wersja przeglądarkowa zgłasza „Odczyt plików źródłowych jest możliwy tylko w aplikacji desktopowej; użyj ręcznego rozwiązania zastępczego."

## Dalsza lektura

- [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse) — jak łącza zewnętrzne wpływają na ścieżkę krytyczną.
