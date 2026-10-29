# Dodawanie relacji

Cel: połącz zadania tak, aby zadanie zaczynało się dopiero wtedy, gdy roboty przed nim są zakończone. Tam, gdzie trzeba, dodaj czas oczekiwania (opóźnienie) między zadaniami.

## Kiedy tego potrzebujesz

Bez relacji aplikacja nie wie, że murarz może zacząć dopiero wtedy, gdy fundament jest wylany. Wszystkie zadania zaczynają się wtedy na początku projektu, a data zakończenia nic nie znaczy. **Relacja** zapisuje tę kolejność. Pierwsze zadanie to **poprzednik**, drugie to **następnik**.

Dodajesz relacje, gdy budujesz harmonogram, gdy dodajesz zadanie albo gdy okaże się, że dwa zadania jednak od siebie zależą. **Opóźnienie** to czas oczekiwania między dwoma zadaniami, na przykład beton, który musi dojrzeć, albo wylewka, która musi wyschnąć.

Domyślna relacja to **FS** (zakończenie-rozpoczęcie): następnik może zacząć się dopiero po zakończeniu poprzednika. Aplikacja zna także SS, FF i SF. Łączą one początek lub koniec z początkiem lub końcem. Przy SS (rozpoczęcie-rozpoczęcie) tynkowanie może na przykład zacząć się dopiero wtedy, gdy rozpoczną się instalacje.

Nie wiesz, którego typu potrzebujesz? Pod wyborem typu stoi zdanie z prawdziwymi nazwami zadań. Na przykład: *Metselwerk rozpoczyna się dopiero po zakończeniu zadania Fundering.* Wybierz inny typ, a zdanie się zmieni. Zobaczysz je w oknie *Typ relacji*, w bloku *Zależności* i w kolumnie *Poprzedniki* lub *Następniki*.

## Kroki

Są cztery sposoby, aby dodać relację. Wszystkie tworzą tę samą relację. Wybierz ten, który najlepiej pasuje do Twojej sytuacji.

### Łączenie dwóch zaznaczonych zadań

Przydatne, gdy pracujesz w tabeli zadań.

1. W tabeli zadań kliknij zadanie, które jest pierwsze: poprzednik.
2. Przytrzymaj Ctrl (⌘ na Macu) i kliknij zadanie, które jest następne: następnik.
3. Wybierz *Start › Zadania › Połącz ▾ › Połącz zaznaczone zadania*. Ten sam przycisk jest też w *Planowanie › Relacje*.

Aplikacja tworzy relację zakończenie-rozpoczęcie bez opóźnienia. Widzisz ją jako strzałkę w widoku Gantt i w kolumnie *Poprzedniki*. Powiadomienie pojawia się tylko wtedy, gdy aplikacja odrzuci relację. Przycisk działa tylko wtedy, gdy zaznaczone są dokładnie dwa zadania.

### Rysowanie relacji w widoku Gantt

Przydatne, gdy dodajesz wiele relacji po kolei.

1. Wybierz *Start › Zadania › Połącz ▾ › Rysuj relację*. Nad harmonogramem pojawia się komunikat *Tryb połączeń: przeciągnij od jednego paska do drugiego na wykresie Gantta, aby utworzyć relację. Esc kończy.*
2. Naciśnij pasek poprzednika i przeciągnij do paska następnika. Za kursorem idzie przerywana linia ze strzałką.
3. Zwolnij przycisk. Pojawia się małe okno *Typ relacji* z typem (domyślnie FS) i polem na opóźnienie.
4. Jeśli trzeba, zmień typ lub opóźnienie i naciśnij Enter albo kliknij poza oknem. Relacja zostaje utworzona.
5. Dodaj od razu następną: tryb pozostaje włączony. Kończysz klawiszem Esc, przyciskiem *Zakończ* w komunikacie albo ponownie wybierając *Rysuj relację*.

Jeśli naciśniesz Esc w oknie *Typ relacji*, nic nie zostaje zapisane. Dla pojedynczej relacji nie musisz włączać trybu: przytrzymaj Shift, gdy przeciągasz od paska do paska. *Rozpocznij relację stąd* w menu kontekstowym paska włącza tryb połączeń; przeciąganie nadal wykonujesz samodzielnie. Na karcie *Tabela*, bez widoku Gantt, *Rysuj relację* jest wyłączone.

### Dodawanie relacji w panelu właściwości

Przydatne, gdy patrzysz na jedno zadanie i chcesz dodać jego poprzedniki albo następniki.

1. Wybierz zadanie. Panel *Właściwości* jest po prawej stronie. Nie widzisz go? Włącz go przez *Widok › Panele › Właściwości*.
2. W bloku *Zależności* kliknij *Dodaj zależność*.
3. Zostaw kierunek na *Poprzednik*, gdy drugie zadanie jest wcześniej, albo wybierz *Następnik*.
4. Wpisz część nazwy drugiego zadania. Wybierz właściwe strzałkami i naciśnij Enter albo kliknij je.
5. Wybierz typ (domyślnie FS) i w razie potrzeby wpisz opóźnienie.
6. Naciśnij Enter albo kliknij znacznik (*Utwórz zależność*).

Relacje zadania są wtedy wypisane w bloku *Zależności*, każda z numerem WBS drugiego zadania, typem i opóźnieniem.

### Wpisywanie relacji w kolumnie Poprzedniki

Przydatne, gdy szybko pracujesz z klawiaturą i znasz numery WBS.

1. Kliknij **+** po prawej stronie nagłówka tabeli zadań (*Dodaj kolumnę*) i wybierz w grupie *Relacje* kolumnę *Poprzedniki*. Kolumna *Następniki* działa tak samo.
2. W kolumnie *Poprzedniki* kliknij komórkę następnika.
3. Wpisz numer WBS poprzednika, spację i typ, na przykład `2.6 FS`. Dopisz opóźnienie zaraz po nim: `2.6 FS+1d`. Kilka poprzedników oddziel średnikiem albo przecinkiem: `3.1 FS; 3.2 SS+2d`.
4. Naciśnij Enter.

To, co wpiszesz, zastępuje całą komórkę. Jeśli są w niej już poprzedniki, wpisz także je (zob. pułapki). Jeśli naciśniesz Enter albo F2 w komórce zamiast wpisywać, otwiera się pole, które zachowuje istniejące relacje: szukasz zadania po numerze WBS albo nazwie i wybierasz typ oraz opóźnienie dla każdej relacji.

### Ustawianie lub zmienianie opóźnienia

Opóźnienie wpisujesz w polu obok typu, przy każdej z opisanych wyżej metod. Istniejące opóźnienie zmieniasz w bloku *Zależności*: kliknij w pole opóźnienia, wpisz nową wartość i naciśnij Enter.

- `3` albo `3d`: 3 dni robocze. Weekend się nie liczy. Aplikacja pokazuje `+3d`.
- `3ed`: 3 dni kalendarzowe. Weekend się liczy, na przykład przy betonie, który dojrzewa także w sobotę i niedzielę.
- `-1`: ujemne opóźnienie (wyprzedzenie). Następnik może zacząć się o dzień wcześniej, więc zadania nachodzą na siebie.
- `4h`: 4 godziny pracy; aplikacja pokazuje to jako `+4h`. Jeśli poprzednik jest zadaniem w dniach w kalendarzu bez własnych pasm godzin pracy, na przykład w kalendarzu standardowym, aplikacja zamienia to na pełne dni robocze, zaokrąglone do najbliższego dnia: `4h` działa jak 1 dzień, `2h` jak 0. Przy kalendarzu z własnymi pasmami albo po zadaniu godzinowym opóźnienie liczy się dokładnie w godzinach.
- `50%`: połowa czasu trwania poprzednika.

Przykład: beton fundamentu musi dojrzeć, zanim murarz może na nim pracować. Dlatego *Pour foundation → Foundation brickwork* dostaje relację FS z opóźnieniem `3`. Jeśli wylewanie fundamentu wypada w piątek 18 czerwca 2027 r., murowanie zaczyna się w czwartek 24 czerwca, po naciśnięciu **Oblicz**: od poniedziałku do środy to czas oczekiwania. Przy `3ed` wlicza się weekend i murowanie zaczyna się we wtorek 22 czerwca.

### Na koniec: przeliczenie

Nowa relacja jeszcze nie przesuwa żadnych pasków. Pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Dopiero wtedy następniki dostają nowe daty. Chcesz, aby aplikacja robiła to sama? Włącz *Oblicz automatycznie* pod *Ustawienia › Projekt › Ustawienia aplikacji*, karta *Planowanie*.

## Pułapki i co robi aplikacja

**Odwrócona kolejność.** Przy *Połącz zaznaczone zadania* liczy się kolejność, w jakiej klikasz, nie kolejność na liście. Jeśli najpierw klikniesz późniejsze zadanie, relacja jest odwrócona. Usuń ją w bloku *Zależności* ikoną kosza i dodaj ponownie.

**Wpisywanie w kolumnie usuwa to, co było.** Jeśli komórka zawiera `3.4 FS; 3.2 FS`, a Ty wpiszesz tylko `3.2 FS`, relacja z 3.4 znika bez komunikatu. Wpisz wszystkie poprzedniki, użyj Enter albo F2, aby dopisać, albo cofnij Ctrl+Z.

**Cykl.** Jeśli dodasz relację, która prowadzi z powrotem do zadania wcześniej w łańcuchu, harmonogram nigdy nie mógłby się zacząć. Aplikacja takiej relacji nie przyjmuje: *Ta relacja utworzyłaby cykl w harmonogramie (…) i nie została utworzona*, z zadaniami cyklu w nawiasie. Najpierw usuń relację, która zamyka cykl.

**Zadanie i zadanie sumaryczne, w którym leży.** Relacja między zadaniem a zadaniem sumarycznym, pod którym się znajduje, jest niemożliwa. Aplikacja pisze: *Relacja między zadaniem a jego własnym nadrzędnym zadaniem sumarycznym jest niedozwolona.*

**Duplikat.** Jeśli relacja już istnieje, aplikacja pisze *Taka relacja już istnieje* i nic się nie zmienia.

**Krótsze komunikaty w kolumnie.** Kolumna *Poprzedniki* pokazuje te same odmowy, z krótszym tekstem pod komórką: *Ta zmiana utworzyłaby cykl w harmonogramie.*, *Ta relacja już istnieje.* albo *Zadanie nie może mieć relacji z własnym zadaniem sumarycznym.* Jeśli wpiszesz tylko numer WBS, na przykład `3.1`, brakuje typu i komórka pokazuje *Użyj na przykład 1.2 FS+2d.* Komórka pozostaje otwarta; popraw wpis albo naciśnij Esc, aby anulować.

**Brak połówek dni w opóźnieniu.** Opóźnienie w dniach jest zawsze liczbą całkowitą: `1.5` staje się `+2d`. Opóźnienie w godzinach po zadaniu w dniach na kalendarzu bez własnych pasm zaokrągla się do pełnych dni roboczych. Niezrozumiały wpis, na przykład słowo, nie zostaje zapisany: pole wraca do poprzedniej wartości.

## Zobacz także

- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co aplikacja oblicza na podstawie relacji i dlaczego zadanie staje się krytyczne.
- [Relacje i opóźnienie](docs://uitleg-relaties): co robią cztery rodzaje relacji i opóźnienie z datami.
- [Śledzenie ścieżki](docs://howto-pad-traceren): wyświetlanie łańcucha poprzedników i następników.
- [Dialog zadania i panel właściwości](docs://ref-taak-eigenschappen): pola relacji i opóźnienia w panelu i w oknie dialogowym.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): łańcuch relacji zakończenie-rozpoczęcie, z jedną relacją rozpoczęcie-rozpoczęcie (ściany i dach, opóźnienie 2 dni) i jedną zakończenie-zakończenie (układanie płytek i malowanie, opóźnienie 1 dzień).
