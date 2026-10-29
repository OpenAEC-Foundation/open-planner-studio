# Korzystanie z biblioteki zasobów

Cel: używać zasobów z biblioteki zasobów w projekcie i dodać do biblioteki zasób, który utworzyłeś w projekcie, aby każdy projekt używał tych samych danych.

## Kiedy tego potrzebujesz

Masz stałą ekipę murarską, dźwig i tynkarza, którzy pojawiają się w kilku projektach. Bez biblioteki wpisujesz ich ponownie w każdym projekcie. Grozi to różnymi nazwami i stawkami. Żaden projekt nie widzi, że inny projekt też żąda tej samej ekipy. W bibliotece zapisujesz ich raz.

Czym jest biblioteka i co projekt z niej przejmuje, czytasz w [Biblioteka zasobów](docs://uitleg-resourcebibliotheek). Ten artykuł opisuje czynności. Tworzenie, eksportowanie i usuwanie bibliotek opisano w [Zarządzanie i udostępnianie bibliotek zasobów](docs://howto-bibliotheken-beheren).

## Kroki

### 1. Łączenie projektu z biblioteką zasobów

Z biblioteką pracujesz tylko wtedy, gdy projekt jest z nią połączony. Bez połączenia panel *Zasoby* nie pokazuje przełącznika *Biblioteka*, *Projekt* i *Obłożenie*.

Dla nowego projektu:

1. Wybierz *Plik › Nowy*. Otwiera się okno *Nowy projekt*.
2. Zobacz pole *Biblioteka zasobów*. Pole ma ustawioną domyślną bibliotekę. Możesz wybrać inną, *brak (projekt niezależny)* albo *+ Nowa biblioteka zasobów…*.
3. Kliknij *Utwórz*.

Dla istniejącego projektu:

1. Wybierz *Plik › Ustawienia projektu*.
2. W polu *Biblioteka zasobów* wybierz bibliotekę.
3. Kliknij *Zastosuj*. Do tego czasu na dole stoi *Zmiany nie zostały zastosowane — kliknij Zastosuj, aby je zachować.*

Jeśli projekt ma już zasoby o tej samej nazwie co element biblioteki, otwiera się okno *Połącz bibliotekę zasobów* z sekcją *Rozpoznaj*. Każdy zasób, który pasuje, ma napis *Propozycja: Bricklayer*. Kliknij *Połącz*, aby połączyć jeden zasób, albo *Połącz wszystkie propozycje*, jeśli propozycji jest więcej. Aplikacja porównuje nazwy bez względu na wielkość liter i podwójne spacje. Przy łączeniu zasób przejmuje z elementu biblioteki nazwę, typ, stawkę, jednostkę i opis. *Maks. jednostki* zostaje takie, jak było w projekcie. Okno pokazuje też kalendarze projektu, które mają tę samą nazwę co kalendarz w bibliotece. Przyciskiem *Zdecyduj później* zamykasz okno bez połączenia.

### 2. Dodawanie zasobu do biblioteki

1. Wybierz *Zasoby › Zarządzaj › Zasoby*. Panel zasobów zajmuje cały obszar roboczy. Zawsze otwiera się na *Projekt*, także dla połączonego projektu.
2. W prawym górnym rogu wybierz *Biblioteka*. Nad tabelą stoi *To edytuje bibliotekę i dotyczy wszystkich projektów — poza cofaniem.*
3. Kliknij *Nowy zasób w bibliotece*. Na dole tabeli pojawia się pusty wiersz.
4. Wpisz nazwę, na przykład *Bricklayer*, i naciśnij Enter. Zasób jest teraz w bibliotece. Od razu otwiera się pusty wiersz na następny zasób. Gdy skończysz, naciśnij Esc. Bez nazwy aplikacja niczego nie tworzy.
5. Wypełnij resztę wiersza. Pole *Typ* ma domyślnie wartość *Robocizna*. W polu *Maks. jednostki* wpisujesz, ile jest tego zasobu łącznie, na przykład 3 dla trzech murarzy. Przegląd obłożenia używa tej liczby jako zdolności. *Stawka/godz* jest opcjonalna. Możesz wypełnić pole *Jednostka* tylko dla typu *Materiał*. W polu *Kalendarz* wybierasz kalendarz z biblioteki albo *+ Kalendarz zasobu*, aby go utworzyć. Zobacz [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen). Aplikacja zapisuje nazwę, stawkę i jednostkę, gdy opuścisz pole. Pozostałe pola zapisuje od razu.

Każda zmiana w bibliotece od razu przechodzi na niezmienione kopie w Twoich otwartych projektach.

### 3. Przypisywanie zasobu do projektu

1. W widoku *Biblioteka* wybierz przy zasobie *Przypisz do projektu*. Nad tabelą pojawia się *Dodano.* Jeśli klikniesz ponownie, pojawia się *Już jest w projekcie.* i nie powstaje druga kopia.
2. Wybierz *Projekt*. Kopia jest w tabeli z małą ikoną biblioteki przy nazwie, oznaczona jako *Z biblioteki*. Nazwa, typ, stawka i jednostka są zwykłym tekstem. Jeśli najedziesz na nie myszą, zobaczysz *Wartość z biblioteki — edytuj ją w widoku Biblioteka albo odłącz ten zasób od biblioteki.*
3. Ustaw *Maks. jednostki* dla tego projektu. Pole zaczyna się od wartości z biblioteki i w projekcie pozostaje edytowalne.
4. Teraz przydziel zasób do zadań jak każdy inny zasób, zobacz [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen). *Zasoby › Przydział › Przydziel* pokazuje tylko zasoby, które są już w projekcie. Dlatego najpierw przypisz zasób z biblioteki do projektu w ten sposób.

*Przypisz do projektu* istnieje tylko w widoku *Biblioteka* projektu, który jest połączony z tą biblioteką.

### 4. Przenoszenie zasobu z projektu do biblioteki

Robisz to dla zasobu, który utworzyłeś w projekcie i używasz częściej, na przykład wynajętego dźwigu.

1. W widoku *Projekt* wybierz przy zasobie *Do biblioteki*. Przycisk pojawia się tylko przy zasobie, który ma nazwę i jeszcze nie pochodzi z biblioteki, w połączonym projekcie.
2. Przeczytaj komunikat nad tabelą.

Komunikat może mówić trzy rzeczy:

- *Dodano.* Biblioteka nie miała elementu o tej nazwie. Utworzono nowy element i Twój zasób jest z nim połączony.
- *Już istniał w bibliotece — teraz połączony.* Był element o tej samej nazwie i tych samych danych. Twój zasób jest z nim połączony.
- *Połączono z istniejącym elementem biblioteki — wartości się różnią, zobacz oznaczenie.* Był element o tej samej nazwie, ale z innymi danymi. Zasób jest połączony i od razu oznaczony *różni się — zdecyduj*. Przejdź do kroku 6.

### 5. Odłączanie kopii

Jeśli w jednym projekcie chcesz odejść od biblioteki, na przykład z inną stawką, odłączasz kopię.

1. W widoku *Projekt* kliknij ikonę *Odłącz od biblioteki* na końcu wiersza.
2. Zasób jest teraz zwykłym zasobem projektu. Wszystkie pola są edytowalne i zasób już nie podąża za biblioteką. Kalendarz, który przyszedł z zasobem, też zostaje odłączony, chyba że inny zasób w tym projekcie nadal z niego korzysta.

Przyciskiem *Cofnij* (Ctrl+Z) cofasz odłączenie.

### 6. Rozwiązywanie rozbieżności

Kopia z napisem *różni się — zdecyduj* różni się od elementu biblioteki. Aplikacja nie wybiera, kto ma rację.

1. Kliknij oznaczenie *różni się — zdecyduj* przy zasobie. Otwiera się okno *Połącz bibliotekę zasobów*. Okno otwiera się też samo, gdy otworzysz plik z taką kopią.
2. W sekcji *Rozbieżności* wybierz, co chcesz zrobić z elementem. Zobacz niżej.
3. Kliknij *Zdecyduj później*, jeśli jeszcze nie chcesz wybierać. Okno się zamyka, a oznaczenie zostaje.

Dla rozbieżności masz dwie możliwości:

- *Użyj wartości biblioteki*: kopia dostaje dane z biblioteki.
- *Przyjmij wartości z pliku do biblioteki*: biblioteka dostaje dane z Twojej kopii. Pod spodem pojawia się *Uwaga: to zmienia bibliotekę i dotyczy wszystkich Twoich projektów.* Kopie w innych otwartych projektach podążają za zmianą.

## Typowe problemy i co wtedy robi aplikacja

**Przykładowe projekty mają własną bibliotekę.** Jeśli otworzysz jeden z trzech przykładów (*Plik › Przykłady*, albo przez odnośnik w Pomocy), aplikacja raz utworzy bibliotekę *Demo biblioteka zasobów* i połączy z nią projekt. Zasoby projektu o tej samej nazwie co element biblioteki są od razu połączone. Kalendarze nie. Twoje własne biblioteki nie są zmieniane. Jeśli otworzysz dwa przykłady obok siebie, razem pokazują konflikty w [Korzystanie z przeglądu obłożenia](docs://howto-bezettingsoverzicht-gebruiken). Na przykład przy ekipie murarzy (*Masonry crew*) między *Refurbishment & Extension of a Family Home* a *6 New Terraced Houses, De Akkers*.

**Nie widzisz przełącznika.** Projekt nie jest połączony z biblioteką. Zrób krok 1.

**Edytujesz bibliotekę przez pomyłkę.** Panel zawsze otwiera się na *Projekt*, aby temu zapobiec. Zmiany w widoku *Biblioteka* dotyczą wszystkich projektów i są poza *Cofnij*.

**Usuwasz zasób z biblioteki.** Aplikacja najpierw pyta *Usunąć „Bricklayer” z biblioteki? Dotyczy to wszystkich projektów i nie można tego cofnąć.* Kopie w Twoich projektach zostają i dalej działają. Dostają oznaczenie *nie ma już w bibliotece* i są w pełni edytowalne. Przyciskiem *Usuń z projektu* usuwasz kopię z projektu.

**W polu *Biblioteka zasobów* wybierasz inną bibliotekę albo *brak (projekt niezależny)*.** Oznaczenia pochodzenia poprzedniej biblioteki znikają. Zasoby zostają w projekcie jako zwykłe zasoby projektu. Przy innej bibliotece aplikacja ponownie szuka zasobów o tej samej nazwie.

**Zasób nie ma propozycji w sekcji *Rozpoznaj*.** Pojawia się napis *Brak propozycji — wybierz ręcznie*, ale to okno nie ma przycisku do tego. Wygląda to na braki w aplikacji. Dodaj taki zasób do biblioteki przyciskiem *Do biblioteki* (krok 4).

## Zobacz także

- [Biblioteka zasobów](docs://uitleg-resourcebibliotheek): co decyduje biblioteka, co decyduje projekt i jak kopie za nią podążają.
- [Zarządzanie i udostępnianie bibliotek zasobów](docs://howto-bibliotheken-beheren): tworzenie, eksportowanie i importowanie bibliotek.
- [Korzystanie z przeglądu obłożenia](docs://howto-bezettingsoverzicht-gebruiken): sprawdzanie, czy dwa projekty chcą tego samego zasobu w tym samym czasie.
- [Zarządzanie zasobami](docs://howto-resources-beheren): zasoby jednego projektu.
