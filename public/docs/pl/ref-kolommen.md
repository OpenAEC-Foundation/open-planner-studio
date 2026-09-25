# Wybór kolumn

**Tabela** (karta **Tabela**) i lista zadań obok wykresu Gantta mają każda własne kolumny. Zmieniasz je w samej tabeli: plus w nagłówku tabeli otwiera selektor kolumn, a w nagłówku kolumny przenosisz, poszerzasz, przypinasz lub usuwasz kolumnę. Każda zmiana działa od razu; nie ma kroku OK.

Domyślnie lista zadań obok wykresu Gantta pokazuje **Struktura podziału pracy (SPP)**, **Nazwa zadania** i **Czas trwania**. Tabela pokazuje dodatkowo **Początek**, **Koniec**, **Typ zadania**, **Krytyczne**, **Zapas całkowity** i **Postęp**, a także kody zadań i pola użytkownika projektu.

## Otwieranie selektora kolumn

- Plus po prawej stronie nagłówka tabeli. Tabela i lista zadań obok wykresu Gantta mają każda własny plus, który zmienia tylko swoją tabelę.
- Karta **Tabela** → **Kolumny…** otwiera selektor kolumn Tabeli.
- Gdy klasyczne przyciski widoku są włączone (**Ustawienia** → karta **Zaawansowane** → **Funkcje starszego typu** → **Pokaż klasyczne przyciski widoku**), **Widok** → grupa wstążki **Wyświetlanie** → **Kolumny…** robi to samo: przycisk przechodzi na kartę Tabela i otwiera tam selektor kolumn.

**Esc**, kliknięcie poza selektorem albo ponowne kliknięcie plusa zamyka selektor.

## Dodawanie kolumny

Selektor **Wybierz kolumnę** zawiera, od góry do dołu:

- **Ostatnio używane** — pola, które niedawno dodałeś selektorem. Ten blok pojawia się, gdy tylko dodasz kolumnę.
- Pole **Szukaj** — wpisz część nazwy pola; **Wyniki wyszukiwania** pochodzą ze wszystkich grup.
- Pola według grup: **Zadanie**, **Planowanie**, **Ograniczenia**, **Relacje**, **Zasoby**, **Postęp**, **Obliczone**, **Plan bazowy**, **Niestandardowe** i **Techniczne**. Kliknięcie grupy ją rozwija; liczba obok to liczba pól w tej grupie.
- Na dole przycisk **Przywróć domyślne** (zobacz niżej).

Kliknij pole, aby dodać je jako ostatnią kolumnę; selektor się wtedy zamyka. Pole, które już jest kolumną, jest zaznaczone i nie można go wybrać ponownie. Kody zadań i pola użytkownika projektu są w grupie **Niestandardowe**, pola twoich planów bazowych w grupie **Plan bazowy**.

W grupie **Obliczone** są między innymi pola analityczne **Zapas swobodny**, **Zapas zakłócający**, **Prawie krytyczne** i **Ścieżka zapasu**. Otrzymują wartości dopiero po obliczeniu (**F5**), a **Prawie krytyczne** i **Ścieżka zapasu** tylko wtedy, gdy włączona jest odpowiednia opcja harmonogramowania — zobacz [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse).

## Zmiana kolumn w nagłówku

- **Przenoszenie** — przeciągnij nagłówek kolumny w inne miejsce. Przypięte kolumny trzymają się razem na początku; nieprzypiętą kolumnę przenosisz tylko między nieprzypiętymi kolumnami.
- **Szerokość** — przeciągnij prawą krawędź nagłówka kolumny (od 40 do 480 pikseli). Dwukrotne kliknięcie tej krawędzi dopasowuje kolumnę do nagłówka i najdłuższej wartości. Z klawiatury: ustaw fokus na krawędzi i użyj strzałek w lewo i w prawo, z **Shift** dla większych kroków.
- **Usuwanie** — znak minus, który pojawia się w nagłówku kolumny po najechaniu na niego wskaźnikiem. Pole pozostaje dostępne w selektorze kolumn.
- **Prawy przycisk myszy** na nagłówku kolumny daje **Przypnij** (lub **Odepnij**), **Dopasuj automatycznie** i **Usuń**. Przypięta kolumna przesuwa się na początek, do pozostałych przypiętych kolumn, i pozostaje widoczna podczas przewijania tabeli w poziomie (o ile przypięte kolumny razem mieszczą się w tabeli).

## Początek, Koniec i planowane daty

**Początek** i **Koniec** (w domyślnym układzie Tabeli) pokazują te same daty co pasek na wykresie Gantta: obliczony harmonogram, a przed pierwszym obliczeniem wprowadzone daty. Jeśli wpiszesz inną datę w polu Początek, stanie się ona planowanym rozpoczęciem. Inny Koniec zmienia czas trwania zadania planowanego automatycznie; w zadaniu planowanym ręcznie staje się planowanym zakończeniem. Następnie naciśnij **F5**, aby przeliczyć. Jeśli wpiszesz z powrotem tę samą datę, nic się nie zmienia.

Pola **Planowane rozpoczęcie** i **Planowane zakończenie** pokazują same wprowadzone daty, nawet gdy obliczenie przesuwa zadanie. Planowane zakończenie można edytować tylko w zadaniu planowanym ręcznie: w innych zadaniach koniec wynika z początku i czasu trwania. Początek i Koniec automatycznie planowanego zadania sumarycznego wynikają z jego zadań podrzędnych i nie można ich edytować.

## Przywróć domyślne

**Przywróć domyślne** znajduje się na dole selektora kolumn. Jedno kliknięcie przywraca domyślny układ kolumn tej tabeli: które kolumny są widoczne, ich kolejność i szerokość oraz przypięte kolumny. Dodatkowo dodane pola znikają z tabeli i nadal można je wybrać w selektorze. W ten sposób po aktualizacji otrzymasz też nowy układ domyślny, na przykład **Początek** i **Koniec** zamiast **Planowane rozpoczęcie** i **Planowane zakończenie**: wcześniej zapisany własny układ nie zmienia się sam. Jeśli tabela ma już układ domyślny, przycisk jest nieaktywny.

## Zapisywanie, cofanie i layouty

Układ kolumn to osobiste ustawienie na tym urządzeniu: obowiązuje we wszystkich twoich projektach i nie jest zapisywany w pliku projektu. Każda czynność na kolumnach — dodanie, usunięcie, przeniesienie, zmiana szerokości, przypięcie lub **Przywróć domyślne** — to jeden krok, który cofa **Ctrl+Z**.

Layout może też zapamiętać kolumny. Przejmuje układ tabeli, którą widzisz podczas tworzenia layoutu, a kliknięcie przycisku layoutu przenosi go do tabeli widocznej w danej chwili: na karcie Tabela do Tabeli, na pozostałych kartach do listy zadań obok wykresu Gantta. Zobacz [Zapisywanie i wczytywanie layoutów](docs://ref-layouts).

## Dalsza lektura

- [Filtry](docs://ref-filters) — które zadania pokazuje tabela i wykres Gantta.
