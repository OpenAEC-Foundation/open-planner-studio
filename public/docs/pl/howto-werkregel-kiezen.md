# Wybieranie typu zadania

Cel: ustawić dla każdego zadania, co aplikacja dopasowuje, gdy zmienisz czas trwania, jednostki lub pracę: sam czas trwania, jednostki lub samą pracę.

## Kiedy tego potrzebujesz

Masz przydzielone zasoby do zadania i chcesz, aby aplikacja liczyła tak, jak sam to robisz. Jeden przykład: dźwig jest wynajęty na jeden dzień i ten dzień jest stały. Inny przykład: wiesz, że jest tam 160 godzin murowania, i chcesz zobaczyć, jak długo to potrwa z trzema osobami zamiast dwiema. Te dwie sytuacje wymagają innego typu zadania.

Typ zadania decyduje, która z trzech wielkości (czas trwania, jednostki i praca) zmienia się razem z inną, gdy zmienisz jedną z nich. Tło i przykłady z obliczeniami znajdziesz w [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels).

## Kroki

### Pokazywanie typu zadania

Typ zadania nie jest domyślnie widoczny. Włącz go raz:

1. Wybierz *Ustawienia › Projekt › Ustawienia aplikacji*, zakładka *Planowanie*.
2. Pod nagłówkiem *Obliczanie* zaznacz *Używaj typów zadań*.
3. Zamknij okno przyciskiem *Zamknij*.

To jest ustawienie aplikacji, a nie pliku projektu. Jeśli plik już zawiera typy zadań lub zapisaną pracę, na przykład plik z MS Project lub Primavera P6, aplikacja pokazuje typ zadania dla tego pliku także bez tego ustawienia. Tak samo jest, gdy sam wybierzesz typ zadania w pliku: wtedy wyświetlanie zostaje włączone dla tego pliku, nawet gdy później wyłączysz ustawienie. Wyświetlanie pozostaje włączone, dopóki plik jest otwarty, a po ponownym otwarciu tak długo, jak plik zawiera typ zadania lub zapisaną pracę.

### Ustawianie typu zadania

1. Zaznacz zadanie. Panel *Właściwości* jest po prawej stronie. Jeśli go nie widzisz, włącz go przez *Widok › Panele › Właściwości*.
2. W polu *Typ zadania* wybierz jedną z pięciu opcji: *Domyślna dla projektu (Stały czas trwania i jednostki)*, *Stały czas trwania i jednostki*, *Stały czas trwania i praca*, *Stała praca* lub *Stałe jednostki*. Przy opcji *Domyślna dla projektu* zadanie podąża za domyślnym typem zadania w projekcie.
3. Chcesz wiedzieć, co robi dana opcja? W otwartej liście rozwijanej każda opcja ma ikonę i. Wskaż ją, kliknij lub dotknij, aby zobaczyć wyjaśnienie. Kliknięcie ikony i nie wybiera jeszcze tego typu zadania.
4. Obok zamkniętego pola jest też ikona i. Wyjaśnia ona typ zadania, który obowiązuje teraz, na przykład *Czas trwania wynika z pracy i jednostek.* Przy opcji *Domyślna dla projektu* jest to typ zadania w nawiasie.

*Domyślna dla projektu* to pierwsza opcja. Każde zadanie ma ją domyślnie. Typ zadania w nawiasie to typ, który projekt ma obecnie jako domyślny. Aplikacja nie ma przycisku do zmiany tego domyślnego typu projektu. Pochodzi on z importu (na przykład z MS Project lub Primavera P6) albo z połączenia MCP. Jeśli chcesz dla jednego zadania inny typ, wybierz go tutaj.

Typ zadania możesz też wybrać w tabeli. Kliknij **+** po prawej stronie nagłówka tabeli zadań (*Dodaj kolumnę*). Pod nagłówkiem *Planowanie* wybierz kolumnę *Typ zadania*.

Zadanie bez przydziału nie ma nic do powiązania, więc typ zadania tam nic nie robi. Najpierw przydziel zasób (zob. [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen)).

### Podgląd i zmiana pracy

Dla zadania z przydziałami pojawia się w bloku *Przydziały* panelu *Właściwości* kolumna *Praca (g)*, obok *Jednostki*. To jest pozostała praca tego zasobu w godzinach. Mała kłódka nad kolumną pokazuje, co typ zadania utrzymuje stałe: *Jednostki* przy *Stały czas trwania i jednostki* oraz przy *Stałe jednostki*, a *Praca (g)* przy *Stały czas trwania i praca* oraz przy *Stała praca*.

Jeśli chcesz pracę zmienić samodzielnie, wpisz godziny w polu i naciśnij Enter. Aplikacja nie przyjmuje wartości 0 lub mniejszej. Pole wraca wtedy do poprzedniej wartości.

### Sprawdzanie skutków

Gdy wybierzesz typ zadania, żadna liczba jeszcze się nie zmienia. Przy typie zadania chroniącym pracę aplikacja tylko zapisuje bieżącą pracę, więc *Praca (g)* ma zapisaną wartość. Dopiero przy następnej zmianie decyduje typ zadania, co się przesunie. Zmień na przykład *Jednostki* i zobacz, co się stanie z czasem trwania i pracą.

Jeśli to zmieni czas trwania zadania, pasek stanu pokaże *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*, aby zobaczyć nowe daty. Gdy *Oblicz automatycznie* jest włączone (na zakładce *Planowanie*, pod nagłówkiem *Obliczanie*), aplikacja robi to sama.

## Który typ zadania pasuje

- **Stały czas trwania i jednostki** pasuje, gdy czas trwania jest ustalony w umowie, a jednostki ustalasz Ty. Praca wynika z tych dwóch wartości. To jest typ domyślny. Dźwig wynajęty na jeden dzień pasuje tutaj: dzień jest stały, a Ty decydujesz, ile dźwigów na nim jest.
- **Stały czas trwania i praca** pasuje, gdy zadanie musi się zakończyć w ustalonym czasie, a Ty wiesz, ile pracy jest w nim. Gdy czas trwania się zmieni, aplikacja dostosuje jednostki.
- **Stała praca** pasuje, gdy wiesz, ile godzin pracy jest w zadaniu, i chcesz zobaczyć, jak czas trwania zmienia się przy innej liczbie osób. Tu pasuje 160 godzin murowania z trzema osobami zamiast dwiema. Tynkowanie w projekcie ćwiczeniowym ma ten typ zadania.
- **Stałe jednostki** pasuje, gdy jednostki są stałe, na przykład jeden dźwig, a praca decyduje o czasie trwania.

## Pułapki i co wtedy robi aplikacja

**Brak pola *Typ zadania*.** Wtedy ustawienie *Używaj typów zadań* jest wyłączone i plik nie ma jeszcze typów zadań. Albo wybrano kamień milowy, fazę, hamak lub zadanie z typem czasu trwania *czas, który upłynął*. Tam nie ma typu zadania. Zaznacz zwykłe zadanie.

**Czas trwania zmienia się, choć go nie zmieniasz.** Przy opcjach *Stała praca* i *Stałe jednostki* czas trwania wynika z jednostek i pracy. Jeśli zmienisz jedną z nich albo liczbę zasobów, aplikacja dostosuje czas trwania, zaokrąglony w górę do pełnych dni roboczych. Dla zadania w godzinach aplikacja zaokrągla w górę do pełnych minut.

**Praca nie zgadza się dokładnie z jednostkami × czasem trwania.** Może to wynikać z zaokrąglenia. W polu *Praca (g)* pojawia się wtedy znak ostrzeżenia *Różni się od jednostek × czasu trwania*. Histogram uwzględnia zapisaną pracę.

**Materiał się nie liczy.** Dla zasobu materiałowego *Praca (g)* pokazuje myślnik. Materiał nigdy nie decyduje o czasie trwania.

**Zadanie z postępem.** Typ zadania działa na pozostałej części. Dlatego *Praca (g)* pokazuje tylko to, co jeszcze trzeba wykonać.

**Cofanie.** Wybór typu zadania i każda zmiana, którą typ zadania oblicza, to jeden krok dla *Cofnij* (Ctrl+Z). Wybrany typ zadania wtedy znika ponownie, ale pole *Typ zadania* zostaje widoczne.

## Zobacz także

- [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels): jak aplikacja łączy czas trwania, jednostki i pracę, z przykładami obliczeń.
- [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen): dodawanie zasobu do zadania.
