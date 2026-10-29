# Dodawanie zadań i kamieni milowych

Cel: dodać nowe zadanie lub kamień milowy do harmonogramu, we właściwym miejscu.

## Kiedy tego potrzebujesz

Budujesz harmonogram, dochodzi nowa praca albo chcesz zapisać moment, na przykład przekazanie lub inspekcję.

**Zadanie** to praca, która trwa. Nowe zadanie trwa domyślnie 5 dni roboczych (przy planowaniu godzinowym domyślny czas projektu może być w godzinach). **Kamień milowy** to moment bez czasu trwania: 0 dni. Zadanie, które ma podzadania, nazywa się **zadaniem sumarycznym**; w budownictwie to często faza. Gdy tylko użyjesz **Oblicz** (F5), jego czas trwania i daty wynikają z podzadań.

## Kroki

### Dodawanie zadania

1. Wybierz *Start › Zadania › Zadanie*. Ten sam przycisk jest na karcie *Tabela*.
2. Otwiera się panel *Właściwości* i pole *Nazwa* jest zaznaczone. Wpisz nazwę i naciśnij Enter.

Nowe zadanie ma najpierw nazwę *Nowe zadanie*. Zaczyna się na początku projektu.

Jeśli zaznaczysz zadanie, nowe zadanie trafi bezpośrednio pod nie, na tym samym poziomie. Jeśli zaznaczone zadanie jest zadaniem sumarycznym, nowe zadanie trafi pod całą fazę, czyli po jego podzadaniach. Jeśli nic nie jest zaznaczone, trafi na koniec listy. Podpowiedź przycisku mówi, co się stanie: *Nowe zadanie bezpośrednio pod zaznaczeniem* albo *Nowe zadanie na końcu listy*. Jeśli zaznaczysz kilka zadań, powstaje jedno nowe zadanie, pod najniżej położonym z zaznaczonych, tak jak widzisz je na ekranie.

### Szybko jedno po drugim w tabeli zadań

Pod ostatnim zadaniem w tabeli zadań jest zawsze szary wiersz *Nowe zadanie*. To jeszcze nie zadanie: nie ma go w Gantt ani w pliku.

1. Kliknij komórkę w tym wierszu albo przejdź do niego strzałką w dół.
2. Wpisz nazwę i naciśnij Enter. Teraz to jest prawdziwe zadanie, na tym samym poziomie co zadanie nad nim. Kursor od razu stoi na nowym szarym wierszu pod spodem.
3. Wpisz kolejną nazwę i tak dalej.

Jeśli wpiszesz tylko czas trwania lub datę w szarym wierszu, zadanie ma nazwę *Nowe zadanie*. Jeśli wyjdziesz bez wpisywania czegokolwiek, nic się nie dzieje: nie ma zadania i nie ma kroku w *Cofnij*. Utworzenie zadania i jego pierwsza wartość to razem jeden krok w *Cofnij*. Szary wiersz jest widoczny tylko wtedy, gdy tabela zadań nie jest filtrowana, grupowana ani sortowana.

### Prawym przyciskiem myszy na puste miejsce

Kliknij prawym przyciskiem myszy na puste miejsce: w tabeli zadań pod ostatnim zadaniem albo w Gantt obok lub pod paskami. Wybierz *Nowe zadanie* albo *Dodaj kamień milowy*. Zadanie trafi na koniec listy. W Gantt zaczyna się w dniu, na którym kliknąłeś. W tabeli zadań komórka nazwy otwiera się od razu, żebyś mógł wpisać nazwę.

### Nad lub pod konkretnym zadaniem

Kliknij zadanie prawym przyciskiem myszy i wybierz *Wstaw powyżej* albo *Wstaw poniżej*. Działa też klawiatura: Insert dodaje nad zaznaczonym zadaniem, Ctrl+I (⌘+I na Macu) pod nim. W tabeli zadań komórka nazwy otwiera się zaraz po Insert, gotowa do wpisania.

Gdy zaznaczysz kilka zadań, powstaje jedno nowe zadanie: *Wstaw powyżej* dodaje je nad najwyższym zaznaczonym zadaniem, *Wstaw poniżej* pod najniższym.

### Dodawanie podzadania

Kliknij zadanie prawym przyciskiem myszy i wybierz *Dodaj podzadanie*. Nowe zadanie trafi na koniec podzadań tego zadania. W tabeli zadań obok Gantt zadanie sumaryczne ma też mały **+** za nazwą, który robi to samo.

### Dodawanie kamienia milowego

1. Wybierz *Start › Zadania › Kamień milowy ▾*, a potem *Kamień milowy początkowy*, *Kamień milowy końcowy* albo *Punkt inspekcji (obowiązkowy)*.
2. Wpisz nazwę i naciśnij Enter. Miejsce ustala ta sama reguła co dla przycisku *Zadanie*.

Te trzy rodzaje różnią się tak:

- *Kamień milowy początkowy* leży na początku dnia, *Kamień milowy końcowy* na końcu dnia. W Gantt romb staje odpowiednio po lewej albo po prawej stronie kolumny dnia. Ma to znaczenie też dla następnika. Załóżmy, że kamień milowy jest we wtorek 29 września 2026, a po nim następuje zadanie z relacją zakończenie-rozpoczęcie: po początkowym kamieniu milowym to zadanie zaczyna się tego samego wtorku, po końcowym kamieniu milowym w środę 30 września.
- *Punkt inspekcji (obowiązkowy)* to końcowy kamień milowy z rodzajem robót *Inspekcja* i z zaznaczonym polem *Obowiązkowy (umowny)*.

### Zmiana istniejącego zadania w kamień milowy

Kliknij zadanie prawym przyciskiem myszy i wybierz *Przełącz kamień milowy*, albo zaznacz pole *Kamień milowy* w panelu *Właściwości*. Pozycja menu działa dla całego zaznaczenia. Czas trwania wynosi 0.

Jeśli wyłączysz to ponownie, zadanie zostaje zwykłym zadaniem z czasem trwania 0. Wpisz czas trwania sam.

### Inne sposoby

- Ctrl+M (⌘+M na Macu) dodaje nowy kamień milowy na koniec listy, nawet gdy zaznaczone jest zadanie. Panel *Właściwości* się nie otwiera.
- Kamień milowy utworzony przez Ctrl+M albo z menu prawego przycisku myszy dostaje rodzaj robót *Inspekcja*. *Kamień milowy początkowy* albo *Kamień milowy końcowy* z menu *Kamień milowy ▾* dostaje *Inne*. Zmień rodzaj robót w panelu *Właściwości*, jeśli potrzebujesz.
- *Dodaj kamień milowy* w menu zadania, po kliknięciu prawym przyciskiem myszy, tworzy kamień milowy jako podzadanie tego zadania, nie jako zadanie na tym samym poziomie.

### Kopiowanie zadania albo całej gałęzi

1. W Gantt kliknij pasek zadania. Zaznacz więcej zadań przez Ctrl+kliknięcie.
2. Naciśnij Ctrl+C (⌘+C na Macu). Aplikacja kopiuje zadanie razem ze wszystkimi podzadaniami, relacjami między skopiowanymi zadaniami i ich przydziałami zasobów.
3. Jeśli chcesz, kliknij pasek zadania, obok którego ma trafić kopia, i naciśnij Ctrl+V (⌘+V).

Kopia ma tę samą nazwę, te same daty i ten sam postęp. Trafia jako zadanie na tym samym poziomie co zaznaczone zadanie (przy kilku: to, które kliknąłeś jako pierwsze), na koniec wśród tych zadań na tym poziomie. Jeśli nic nie jest zaznaczone, trafia na koniec listy. Skopiowane zadania zostają potem zaznaczone, kody WBS (numer każdego zadania w drzewie, na przykład 1.2; zob. [Zmiana struktury](docs://howto-structuur-aanpassen)) są ustalane na nowo, a harmonogram jest nieaktualny.

Schowek jest wspólny dla całej aplikacji, więc możesz wkleić też do innego dokumentu. Wszystko, czego tam nie ma, na przykład kalendarz zadania, niestandardowy rodzaj robót, kod czynności albo pole niestandardowe, aplikacja usuwa i informuje cię o tym.

### Co dalej

Nowe zadanie nie zmienia jeszcze innych dat. Pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*.

## Pułapki i co robi aplikacja

**Każde nowe zadanie zaczyna się na początku projektu.** Bez relacji zadanie na nic nie czeka. Dodaj relacje, zob. [Dodawanie relacji](docs://howto-relaties-leggen).

**Filtrowanie, grupowanie lub sortowanie jest włączone.** Kolejność, którą widzisz, nie jest wtedy kolejnością harmonogramu. Gdy jest zaznaczone zadanie, *Zadanie* i *Kamień milowy ▾* dodają nowe zadanie na koniec. Pojawia się czerwone powiadomienie: *Nowe zadanie zostało dodane na końcu. Podczas filtrowania, grupowania lub sortowania aplikacja nie może umieścić go pod zaznaczeniem*. *Wstaw powyżej* i *Wstaw poniżej* są odrzucane, z paskiem *Niedostępne podczas filtrowania/grupowania/sortowania*. Przycisk *Wyczyść* w powiadomieniu albo na pasku usuwa filtr, grupowanie i sortowanie za jednym razem. To nie jest część *Cofnij*: Ctrl+Z ich nie przywraca.

**Podzadanie pod zadaniem z przydziałami zasobów.** Zadanie staje się zadaniem sumarycznym, a zadanie sumaryczne samo nie ma przydziałów. Aplikacja przenosi przydziały do nowego podzadania i informuje cię o tym. Jeśli to nie jest możliwe, na przykład dlatego że wybrano *Dodaj kamień milowy*, a kamień milowy nie może mieć przydziałów, aplikacja niczego nie dodaje i mówi dlaczego.

**Podzadanie pod kamieniem milowym.** Kamień milowy staje się zadaniem sumarycznym, a aplikacja usuwa znacznik kamienia milowego i wyświetla komunikat.

**Włączenie kamienia milowego przy zadaniu sumarycznym lub zadaniu z przydziałami.** Aplikacja odmawia i podaje powód. Przy przydziałach: najpierw je usuń.

**Kopiowanie w tabeli zadań.** W tabeli zadań (i na karcie *Tabela*) Ctrl+C kopiuje tylko wartości zaznaczonych komórek, jak w arkuszu, a Ctrl+V wkleja do komórek. Kopiowanie zadań działa więc tylko wtedy, gdy używasz Gantt: najpierw kliknij pasek.

## Zobacz także

- [Zmiana struktury](docs://howto-structuur-aanpassen): zmieniasz wcięcia i przesuwasz zadania, a numery WBS pozostają aktualne.
- [Dodawanie relacji](docs://howto-relaties-leggen): pozwala połączyć zadania ze sobą.
- [Zaznaczanie, usuwanie i cofanie zadań](docs://howto-taken-selecteren-verwijderen): usuwasz zadanie ponownie.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co aplikacja oblicza, gdy są relacje.
- [Okno zadania i panel właściwości](docs://ref-taak-eigenschappen): wszystkie pola zadania.
- [Nowy projekt i info o projekcie](docs://ref-projectinfo): start od szablonu faz.
- [Menu prawego przycisku myszy](docs://ref-contextmenus): wszystkie pozycje menu zadania.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): mały przykładowy projekt (*Plik › Przykłady*) z czterema fazami, początkowym kamieniem milowym i obowiązkowym kamieniem milowym przekazania.
