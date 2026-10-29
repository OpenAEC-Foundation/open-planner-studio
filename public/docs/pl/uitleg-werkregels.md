# Typy zadań: czas trwania, jednostki i praca

Przydzielasz jednego tynkarza do zadania plastering, a zadanie trwa cztery dni. Jeśli dodasz drugiego tynkarza, pracę można wykonać w dwa dni. Zadanie może też nadal trwać cztery dni, ale z dwa razy większą pracą. Obie możliwości mają sens. Która z nich zostanie wybrana, zależy od **typu zadania**. W tym artykule czytasz, jak aplikacja łączy czas trwania, jednostki i pracę oraz co każdy typ zadania utrzymuje stałe.

## Pojęcie

Trzy wielkości są ze sobą powiązane:

- **Czas trwania**: jak długo trwa zadanie, w dniach roboczych lub w godzinach.
- **Jednostki**: ile zasobu pracuje przy zadaniu na jeden dzień roboczy. W panelu *Właściwości* nazywa się to *Jednostki*, w innych oknach *Jedn./dzień*. Jednostki równe 1 to jeden tynkarz przez cały dzień, 2 to dwóch tynkarzy, a 0,5 to pół dnia.
- **Praca**: łączna liczba godzin, które zasób spędza na zadaniu.

Wzór wygląda tak: praca = czas trwania × jednostki × godziny na dzień roboczy. Godziny na dzień roboczy pochodzą z kalendarza zadania. Plastering trwający cztery dni robocze z jednym tynkarzem to przy 8-godzinnym dniu roboczym 4 × 1 × 8 = 32 godziny pracy.

Jeśli zmienisz jedną z tych trzech wielkości, co najmniej jedna z pozostałych dwóch musi się przesunąć. Inaczej suma przestaje się zgadzać. O tym, która to będzie, decyduje typ zadania. Ustawiasz go dla każdego zadania w panelu *Właściwości*. Aplikacja pokazuje typ zadania i pracę dopiero po ich włączeniu. Jak to działa, opisuje [Wybieranie typu zadania](docs://howto-werkregel-kiezen).

Typ zadania działa tylko przy zwykłych zadaniach. Kamienie milowe, fazy (zadania sumaryczne), hamaki oraz zadania, których *Typ czasu trwania* to *Czas, który upłynął*, nie mają go. Pole *Typ zadania* tam nie występuje. Materiał, na przykład beton lub zaprawa tynkarska, też się nie liczy. Ilość materiału nigdy nie steruje czasem trwania. Aplikacja jej nigdy nie zmienia z powodu typu zadania.

## Jak aplikacja oblicza

### Typ zadania działa na to, co zmieniasz

Aplikacja przelicza czas trwania, jednostki i pracę tylko w chwili, gdy zmienisz jedną z nich: czas trwania zadania, jednostki przydziału, pracę, zasób dodany lub usunięty albo godziny na dzień w kalendarzu. **Oblicz** (F5) nie zmienia żadnej z nich: F5 tylko oblicza daty. Samo wybranie typu zadania też nie zmienia ani jednej liczby. Typ zadania zadziała przy Twojej następnej zmianie.

Jeśli typ zadania zmienia czas trwania zadania, harmonogram staje się nieaktualny. Pasek stanu pokazuje wtedy *Nieaktualne — przelicz (F5)*, chyba że *Oblicz automatycznie* jest włączone.

### Cztery typy zadań

W panelu *Właściwości* obok listy rozwijanej *Typ zadania* jest ikona i. Najedź na nią, kliknij ją lub dotknij, a aplikacja wyjaśni typ zadania, który obowiązuje w tej chwili. W otwartej liście rozwijanej każda opcja ma też taką ikonę i. Wyjaśnienie zaczyna się pogrubionym zdaniem. Cztery typy zadań, z tym zdaniem z aplikacji:

- **Stały czas trwania i jednostki** (*Praca wynika z czasu trwania i jednostek.*). To jest ustawienie domyślne. Aplikacja nigdy sama nie zmienia czasu trwania, a praca wynika z czasu trwania i jednostek. Jeśli wpiszesz pracę samodzielnie, aplikacja dostosuje jednostki, bo czas trwania jest stały.
- **Stały czas trwania i praca** (*Jednostki wynikają z czasu trwania i pracy.*). Aplikacja nigdy sama nie zmienia czasu trwania. Jeśli zmienisz czas trwania, praca zostaje, a jednostki się dostosowują.
- **Stała praca** (*Czas trwania wynika z pracy i jednostek.*). Praca jest stała, a czas trwania wynika z pracy i jednostek.
- **Stałe jednostki** (*Czas trwania wynika z pracy i jednostek.*). Jednostki są stałe, a czas trwania wynika z pracy.

Dwa typy zadań nie zmieniają czasu trwania. Przy pozostałych dwóch czas trwania przesuwa się, gdy zmienisz jednostki, pracę albo liczbę zasobów. Przy jednym zasobie stała praca i stałe jednostki działają tam dokładnie tak samo. Różnią się, gdy sam zmienisz czas trwania. Przy typie stała praca praca się nie zmienia, a jednostki się dostosowują. Przy typie stałe jednostki pozostają bez zmian, a praca rośnie razem z czasem trwania. Różnią się też, gdy przy zadaniu jest więcej zasobów (zobacz niżej).

Przykłady niżej pokazują, co robi każdy typ zadania.

### Zaokrąglanie

Czas trwania, który wynika z sumy, aplikacja zaokrągla w górę. Dla zadania w dniach zaokrągla do pełnych dni roboczych, a dla zadania godzinowego do pełnych minut. Praca i jednostki zostają takie, jakie wpiszesz, albo takie, jakie aplikacja wzięła z sumy. Dlatego suma czasem przestaje dokładnie się zgadzać. Poniższy przykład pokazuje, co wtedy się dzieje.

### Kilka zasobów

Jeśli zadanie ma kilka zasobów, obowiązują dwie zasady. Przy typach *Stały czas trwania i praca*, *Stała praca* i *Stałe jednostki* łączna praca zostaje ta sama, gdy dodasz lub usuniesz zasób. Aplikacja dzieli ją wtedy proporcjonalnie do jednostek. Przy typie stały czas trwania i jednostki nowy zasób wnosi zamiast tego własną pracę. Przy typach stała praca i stałe jednostki najwolniejszy zasób decyduje o czasie trwania: dla każdego zasobu to praca podzielona przez jednostki, a liczy się największy wynik.

Przykład: dwa zasoby mają każdy po 32 godziny pracy i jednostki 1, razem 4 dni robocze. Ustawiasz jednostki pierwszego na 0,5. Czas trwania wynosi wtedy 8 dni roboczych. Przy typie stała praca drugi zasób zachowuje swoje 32 godziny pracy, a jego jednostki spadają do 0,5. Przy typie stałe jednostki drugi zasób zachowuje jednostki 1, a jego praca rośnie do 64 godzin.

### Postęp

Jeśli zadanie ma już postęp, typ zadania działa na część pozostałą: pozostały czas trwania i pozostałą pracę. W panelu *Właściwości* ta praca jest w kolumnie *Praca (g)*. To, co zostało zrobione, zostaje.

### Zadania godzinowe

Zadanie godzinowe wylicza się tak samo, ale w minutach. Jeśli na zadaniu trwającym 5 godzin pracuje tylko crane, to praca wynosi 5 godzin. Przy typie stała praca czas trwania przy jednostkach 2 wynosi wtedy 2,5 godziny. W projekcie ćwiczeniowym zadanie hollow-core floor ma też przypisane carpentry crew. Nadal potrzebuje 5 godzin pracy, jest najwolniejszy, więc czas trwania zostaje 5 godzin. Jak godziny i dni się do siebie mają, opisuje [Dni i godziny](docs://uitleg-dagen-en-uren).

## Przykład: plastering

Przykład pochodzi z projektu ćwiczeniowego samouczków, *House extension*. W samouczku 5 sam to obliczasz i sprawdzasz liczby. Tutaj czytasz, co robi każdy typ zadania.

Zadanie plastering trwa 4 dni robocze. Przydzielony jest do niego jeden tynkarz z jednostkami 1, a dzień roboczy ma 8 godzin. Praca wynosi więc 32 godziny.

### Stały czas trwania i jednostki

- Ustawiasz czas trwania na 6 dni roboczych: praca rośnie do 48 godzin, jednostki zostają 1.
- Ustawiasz jednostki na 2: czas trwania zostaje 4 dni robocze, praca wynosi 64 godziny.
- Wpisujesz 48 godzin w polu *Praca (g)*: czas trwania zostaje 4 dni robocze, jednostki wynoszą 1,5.
- Przydzielasz drugi zasób, na przykład *Plasterer 2*, z jednostkami 1: czas trwania zostaje 4 dni robocze, a ten drugi wnosi 32 godziny pracy, razem 64 godziny.

### Stały czas trwania i praca

- Ustawiasz czas trwania na 6 dni roboczych: praca zostaje 32 godziny, jednostki spadają do 0,67.
- Ustawiasz jednostki na 2: czas trwania zostaje 4 dni robocze. Ponieważ czas trwania jest stały, praca rośnie do 64 godzin.
- Wpisujesz 16 godzin w polu *Praca (g)*: czas trwania zostaje 4 dni robocze, jednostki wynoszą 0,5.
- Przydzielasz drugi zasób, na przykład *Plasterer 2*, z jednostkami 1: 32 godziny dzielą się po 16 godzin, a jednostki wynoszą dla obu 0,5. Czas trwania zostaje 4 dni robocze.

### Stała praca

- Ustawiasz czas trwania na 6 dni roboczych: praca zostaje 32 godziny, jednostki spadają do 0,67.
- Ustawiasz jednostki na 2: praca zostaje 32 godziny, a czas trwania wynosi 2 dni robocze. To jest krok, który wykonujesz w samouczku 5.
- Wpisujesz 48 godzin w polu *Praca (g)*: jednostki zostają 1, a czas trwania wynosi 6 dni roboczych.
- Przydzielasz drugi zasób, na przykład *Plasterer 2*, z jednostkami 1: 32 godziny dzielą się po 16 godzin, a czas trwania wynosi 2 dni robocze. Usuwasz ten drugi zasób i czas trwania znów wynosi 4 dni robocze.

### Stałe jednostki

- Ustawiasz czas trwania na 6 dni roboczych: jednostki zostają 1, praca rośnie do 48 godzin.
- Ustawiasz jednostki na 2: praca zostaje 32 godziny, a czas trwania wynosi 2 dni robocze.
- Wpisujesz 48 godzin w polu *Praca (g)*: jednostki zostają 1, a czas trwania wynosi 6 dni roboczych.
- Przydzielasz drugi zasób, na przykład *Plasterer 2*, z jednostkami 1: 32 godziny dzielą się po 16 godzin, a czas trwania wynosi 2 dni robocze.

### Gdy suma się nie zgadza

Przy typie stała praca ustawiasz jednostki na 3. Praca wynosi 32 godziny, więc czas trwania wynosi 32 ÷ (3 × 8) = 1,33 dnia roboczego. Aplikacja zaokrągla to w górę do 2 dni roboczych. Praca (32 godziny) i jednostki (3) zostają, ale 2 × 3 × 8 to 48 godzin. Histogram dlatego rozkłada 32 godziny na 2 dni robocze: 2 jednostki dziennie, a nie 3. W polu *Praca (g)* pojawia się znak ostrzeżenia *Różni się od jednostek × czasu trwania*, który to pokazuje.

Przy dwóch zasobach z różnymi jednostkami działa to tak samo. Jeśli przy typie stała praca dodasz drugi zasób, na przykład *Plasterer 2*, z jednostkami 2 do pierwszego tynkarza z jednostkami 1, aplikacja dzieli 32 godziny w stosunku 1 : 2, czyli 10,7 i 21,3 godziny. Obaj potrzebują wtedy 1,33 dnia roboczego. Czas trwania wynosi 2 dni robocze.

Plik z P6 lub MS Project może też zawierać *Praca (pozost.)*, która nie jest równa jednostkom × pozostałemu czasowi trwania. Wtedy pojawia się ten sam znak ostrzeżenia. Aplikacja sama tej pracy nie zmienia. Jeśli zmienisz czas trwania takiego zadania, aplikacja stosuje typ zadania, także wtedy, gdy pozostała praca pochodzi z pliku. Przy typach *Stały czas trwania i jednostki* oraz *Stałe jednostki* pozostała praca staje się jednostkami × nowym pozostałym czasem trwania. Przy typach *Stały czas trwania i praca* oraz *Stała praca* praca zostaje, a jednostki się dostosowują. Jeśli pozostała praca z pliku w ten sposób zniknie, dostajesz powiadomienie ze starą i nową liczbą godzin. Ctrl+Z przywraca starą wartość. Wyjaśnienie przy znaku ostrzeżenia mówi dla każdego zadania, które z tych dwóch się dzieje.

### Inny kalendarz

Przy typie stała praca dzień roboczy kalendarza zmienia się z 8 na 6 godzin. Praca zostaje 32 godziny, więc czas trwania wynosi 32 ÷ 6 = 5,33, zaokrąglone w górę do 6 dni roboczych. Jak aplikacja liczy dni robocze i godziny pracy, opisuje [Kalendarze i dni robocze](docs://uitleg-kalenders). Aplikacja pokazuje: *Po zmianie kalendarza typ zadania dostosował czas trwania w 1 zadaniu (praca pozostaje, zmieniła się liczba godzin dziennie).*

### Zadanie z postępem

Zadanie inner cavity leaf trwa 5 dni roboczych i jest wykonane w 40%: 2 dni robocze są zrobione, a 3 dni robocze (24 godziny) zostają. Przy typie stała praca zmieniasz jednostki z 1 na 2. Pozostała praca zostaje 24 godziny, a pozostały czas trwania wynosi 1,5, zaokrąglone w górę do 2 dni roboczych. Zadanie trwa teraz 2 + 2 = 4 dni robocze, a postęp wynosi 50%. Procent się zmienia, bo część wykonana zostaje ta sama, a pozostała część się skraca.

## Skutki i nieporozumienia

**„Stała praca oznacza, że czas trwania jest stały”.** Nie, wręcz przeciwnie. Przy typach *Stały czas trwania i jednostki* oraz *Stały czas trwania i praca* czas trwania jest stały. Przy typach *Stała praca* i *Stałe jednostki* czas trwania wynika z dwóch pozostałych.

**„Jeśli wybiorę typ zadania, mój harmonogram się zmieni”.** Nie. Wybór nie zmienia żadnej liczby. Dopiero przy następnej zmianie typ zadania decyduje, co się przesunie. Przy typie, który chroni pracę, aplikacja ustala pracę w chwili wyboru, więc jest liczba do ochrony. Takie zadanie ma wtedy zapisaną wartość w polu *Praca (g)*.

**„Czas trwania zmienił się, choć niczego nie ruszałem”.** Tak może być po zmianie jednostek, pracy, liczby zasobów albo godzin dziennie, przy typach *Stała praca* lub *Stałe jednostki*. Pasek stanu wtedy pokazuje, że harmonogram jest nieaktualny. Naciśnij **Oblicz** (F5), aby zobaczyć nowe daty.

**Bez przydziału typ zadania nic nie robi.** Nie ma wtedy jednostek ani pracy, z którymi można by powiązać czas trwania.

**Pliki z MS Project lub Primavera P6 zawsze pokazują typ zadania.** Przy zadaniu z MS Project aplikacja czasem zachowuje ustawienie sterowane nakładem pracy. To zapisane ustawienie zmienia dwa przypadki. Przy typie *Stały czas trwania i praca* i ustawieniu sterowanym nakładem pracy praca przesuwa się, gdy zmienisz czas trwania, zamiast jednostek. Przy typie *Stałe jednostki* i ustawieniu niesterowanym nakładem pracy praca przesuwa się, gdy dodasz lub usuniesz zasób, a czas trwania zostaje. Zadania utworzone w aplikacji nie mają tego ustawienia. Wyjaśnienie przy tej ikonie uwzględnia to ustawienie.

## Zobacz też

- [Wybieranie typu zadania](docs://howto-werkregel-kiezen): kroki do ustawienia typu zadania.
- [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen): zasób dodajesz do zadania, z jednostkami i rozkładem.
- [Dni i godziny](docs://uitleg-dagen-en-uren): jak aplikacja zamienia dni i godziny.
- [Kalendarze i dni robocze](docs://uitleg-kalenders): jak aplikacja liczy dni robocze i godziny pracy.
