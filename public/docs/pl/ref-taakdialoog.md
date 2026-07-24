# Okno dialogowe zadania

Okno **Edytuj zadanie** pokazuje wszystkie właściwości jednego zadania — te same pola i sekcje co panel właściwości po prawej, ale w oknie z jawnym krokiem zapisu.

## Otwieranie

- **Kliknięcie dwukrotne** zadania na wykresie Gantta.
- **F2** przy zaznaczonym zadaniu.
- **Kliknięcie prawym przyciskiem** zadania → **Edytuj...**

## Zapisywanie i anulowanie

- **Zapisz** stosuje wszystkie zmiany pól naraz; przycisk jest wyłączony, dopóki nazwa jest pusta. **Enter** działa tak samo jak Zapisz (z wyjątkiem wnętrza wieloliniowego pola tekstowego).
- **Anuluj**, **Esc**, krzyżyk zamykający albo kliknięcie poza oknem zamyka je bez zastosowania zmian pól.
- Wyjątek: sekcje **Zależności**, **Przydziały** i **Kody i pola** działają bezpośrednio na harmonogramie (identycznie jak panel) — zmiany tam wchodzą w życie natychmiast, nawet jeśli potem anulujesz.

## Pola

- **Nazwa \*** — wymagana; automatycznie otrzymuje fokus przy otwarciu okna dialogowego.
- **Kod WBS** — wolny wpis. Przy włączonym automatycznym numerowaniu WBS (Planowanie → Struktura) pole jest zablokowane: aplikacja zarządza kodami.
- **Opis** — wolny tekst.
- **Typ** — typ zadania (na przykład Budowa); steruje kolorowaniem paska.
- **Kalendarz** — **Kalendarz projektu** albo konkretny kalendarz z biblioteki; określa dni robocze tego zadania.
- **Zadanie nadrzędne** — przenieś zadanie pod inne zadanie nadrzędne, albo **- Brak (korzeń) -**. To pole istnieje tylko w oknie dialogowym; w panelu restrukturyzację wykonuje się przez przeciąganie lub wcięcie/usunięcie wcięcia.

## Notatki

Lista kontrolna dla każdego zadania: każdy wiersz ma **pole wyboru gotowe**, pole tekstowe i przycisk usuwania; **Dodaj notatkę** tworzy nowy wiersz. Ukończone wiersze są przekreślone. Zobacz [Planowanie i WBS](docs://gids-plannen-wbs).

## Kamień milowy

- **Kamień milowy** — zaznaczenie ustawia czas trwania na 0 i pokazuje romb zamiast paska.
- **Rodzaj punktu kontrolnego** — **Automatycznie**, **Punkt kontrolny początkowy** lub **Punkt kontrolny końcowy**.
- **Obowiązkowy (umowny)** — oznacza kamień milowy jako umowny.

## Czas

- **Data rozpoczęcia** — pokazuje obliczony wczesny początek; ręczna zmiana zakotwicza nową datę jako planowany początek.
- **Czas trwania (dni robocze)** — pełne dni robocze; wyłączone dla kamienia milowego.
- Przy **włączonym planowaniu godzinowym** i kalendarzu godzinowym na zadaniu pojawiają się trzy zsynchronizowane pola: **Dni**, **Godziny** i **Suma godzin** (tylko liczby całkowite). Bez kalendarza godzinowego pokazuje się podpowiedź: „Wprowadzanie w godzinach wymaga kalendarza godzinowego (godzin pracy)." Zobacz [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren).

## Hammock (czas trwania pochodny)

Tylko na zadaniu bez podzadań, które nie jest kamieniem milowym. Zaznaczenie sprawia, że czas trwania staje się pochodny: rozpiętość między **driverem początku** (przychodząca relacja FS/SS) a **driverem końca** (przychodząca relacja FF/SF), oba pokazane tylko do odczytu. Jeśli driver końca brakuje, okno dialogowe zgłasza, że rozpiętość wraca do zerowej długości. Zobacz [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse).

## Ograniczenie i termin ostateczny

- **Ograniczenie** — Jak najwcześniej (ASAP), Jak najpóźniej (ALAP), Rozpocznij nie wcześniej niż (SNET), Rozpocznij nie później niż (SNLT), Zakończ nie wcześniej niż (FNET), Zakończ nie później niż (FNLT), Musi rozpocząć się (MSO) lub Musi zakończyć się (MFO); z **Datą ograniczenia**, tam gdzie ma to zastosowanie.
- **Obowiązkowe (twarde przypięcie)** — tylko MSO/MFO: twardo przypina datę i nadpisuje logikę relacji; naruszenie zamienia się w ujemny zapas w górę strumienia.
- **Ograniczenie drugorzędne** — druga granica (SNET/FNET/SNLT/FNLT) z **Datą drugorzędną**; niemożliwe przy twardym przypięciu. Zabronione kombinacje zabarwiają się na czerwono wraz z powodem.
- **Termin ostateczny** — data docelowa poza obliczeniem; jej niedotrzymanie daje ostrzeżenie, nie przesunięcie. Zobacz [Relacje i ograniczenia](docs://gids-relaties-constraints).

## Postęp

- **Postęp (%)** — suwak 0–100%.
- **Rzeczywisty początek** / **Rzeczywisty koniec** — zarejestrowane fakty; dla kamienia milowego jedno pole **Rzeczywista data**. Daty po dacie statusu są odrzucane.
- **Pozostało (dni robocze)** — tylko do odczytu, wynika z czasu trwania × (1 − postęp). Zobacz [Baseline i postęp](docs://gids-baselines-voortgang).

## Wynik CPM (tylko do odczytu)

**Wczesny początek/koniec**, **Późny początek/koniec**, **Zapas całkowity**, **Zapas swobodny**, **Zapas interferujący** (gdy obliczony) i **Ścieżka krytyczna** (tak/nie). Wypełniane po obliczeniu (F5).

## Zależności

Wszystkie relacje tego zadania: kierunek (→ następnik, ← poprzednik), drugie zadanie, ikona błyskawicy na **relacji wiodącej**, typ relacji (FS/SS/FF/SF), **zwłoka** (np. 2d, 3ed, 50%) i przycisk usuwania. Zmiany wchodzą w życie natychmiast.

## Przydziały

Dla każdego przydzielonego zasobu: nazwa, **Jedn./dzień**, **Krzywa**, **Przenieś do…** (przenieś przydział do innego zadania) oraz usuwanie; na dole **Przydziel zasób**. Niemożliwe dla kamieni milowych ani zadań sumarycznych. Wchodzi w życie natychmiast. Zobacz [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram).

## Kody i pola

Widoczne tylko wtedy, gdy projekt ma typy kodów zadań lub pola użytkownika: selektor wartości dla każdego typu kodu, wpis typowany dla każdego pola użytkownika. Wchodzi w życie natychmiast. Definicje są zarządzane w oknie dialogowym struktury — zobacz [Kody i pola](docs://ref-codes-velden).
