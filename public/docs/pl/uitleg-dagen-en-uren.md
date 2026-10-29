# Dni i godziny

Zadanie na 2 dni i zadanie na 16 godzin wyglądają tak samo, ale aplikacja liczy je inaczej. Dlaczego możesz wybierać między dniami a godzinami? Co się dzieje, gdy zadanie godzinowe jest połączone z zadaniem w dniach? W tym artykule czytasz, jak aplikacja liczy dni i godziny oraz gdzie zaokrągla. Przykład pokazuje liczby.

## Pojęcie

**Zadanie w dniach** ma czas trwania w pełnych dniach roboczych, na przykład `5d`. Zajmuje pełne dni robocze. W standardowym kalendarzu ma datę rozpoczęcia i datę zakończenia bez godziny.

**Zadanie godzinowe** ma czas trwania w godzinach pracy, na przykład `12h` lub `1h 30m`. Ma rozpoczęcie i zakończenie z godziną, na przykład wtorek 11:00.

Jednostka należy do zadania, nie do projektu. W jednym harmonogramie możesz łączyć zadania w dniach i zadania godzinowe. Nazywa się to **planowaniem mieszanym**.

Godziny stosujesz przy pracy, która nie mieści się w pełnych dniach: dźwigu, który wynajmujesz na dwanaście godzin, wylewaniu przez sześć godzin, zadaniu, które może zacząć się dopiero po przerwie na obiad. W pozostałych przypadkach wystarczą dni i są jaśniejsze.

**Planowanie godzinowe** jest domyślnie wyłączone. Dopóki jest wyłączone, aplikacja działa w dniach. Jeśli plik zawiera planowanie godzinowe, na przykład zadania godzinowe, aplikacja pokazuje komunikat *Ten plik zawiera planowanie godzinowe.* Te zadania są nadal obliczane, ale ich czas trwania możesz edytować dopiero po włączeniu planowania godzinowego.

## Jak aplikacja oblicza

### Godziny pracy i standardowy dzień roboczy

Każdy kalendarz ma **pasma godzin pracy** dla każdego dnia roboczego (w aplikacji nazywane *pasmami*). Standardowy kalendarz ma godziny od 07:00 do 12:00 oraz od 13:00 do 16:00. Luka między nimi to przerwa. Aplikacja wyznacza te pasma na podstawie *Początek (godz.)*, *Koniec (godz.)* i przerwy w kalendarzu. Nie musisz nic w tym celu ustawiać. Jeśli sam ustawisz pasma dla każdego dnia tygodnia, mają one pierwszeństwo.

**Standardowy dzień roboczy** to dzień roboczy, który występuje najczęściej. Jego długość to suma jego pasm. Nie jest to średnia: jeśli poniedziałek ma 16 godzin, a wtorek do piątku po 10 godzin, standardowy dzień roboczy wynosi 10 godzin. Jeśli dni robocze różnią się długością, obowiązuje najczęstsza suma dzienna, a przy remisie najwyższa. Przy czterech dniach po 8 godzin i piątku po 5 godzin standardowy dzień roboczy wynosi więc 8 godzin. Kalendarz z własnymi godzinami dziennymi (na przykład z Primavera P6) także liczy z tą sumą dzienną, a okno kalendarza ją pokazuje. Jego własna wartość zostaje zachowana dla eksportu. Jeśli się różni, okno kalendarza pokazuje pod *Standardowy dzień roboczy* pomarańczowy pasek. Zadanie na 1870 godzin, przy dniach po 10 godzinach pracy, trwa zatem 187 dni, nawet jeśli jego własna wartość to 8 godzin dziennie.

### Zadanie godzinowe

Aplikacja liczy minuty pracy od początku, przez pasma godzin pracy. Przerwy, wieczory, weekendy i święta się nie liczą. Zadanie na 12 godzin zatem nie mieści się w jednym dniu roboczym po 8 godzin: trwa dalej następnego dnia.

### Zadanie w dniach

Aplikacja liczy pełne dni robocze. Godziny dziennie nie mają tu znaczenia. Zadanie na 5 dni kończy się tego samego dnia, bez względu na to, czy kalendarz ma 6, czy 8 godzin dziennie.

### Przeliczanie dni i godzin

Dzień to standardowy dzień roboczy kalendarza zadania. Aplikacja z tego korzysta w trzech miejscach:

- Dla ustawienia *Wyświetlanie czasu trwania*. W *Ustawienia › Projekt › Ustawienia aplikacji*, na karcie *Wygląd* wybierasz *Automatycznie (własna jednostka dla zadania)*, *Zawsze w dniach* albo *Zawsze w godzinach*. Zadanie na 18 godzin pokazuje się przy *Zawsze w dniach* jako `2.25d(18h)`: własna jednostka zostaje w nawiasie.
- Dla opóźnienia w godzinach po zadaniu w dniach (zobacz *Zaokrąglanie*).
- Gdy zmieniasz jednostkę zadania. Aplikacja liczy wtedy dni od początku zadania, każdy dzień z jego własnymi godzinami, i od razu przelicza czas trwania, gdy wynik jest dokładny. Dwa dni zamieniają się w `16h`. W kalendarzu, w którym piątek ma 5 godzin, 5 dni od poniedziałku zamieniają się w `37h`. Dwunastu godzin nie można zamienić na pełne dni w kalendarzu z dniami po 8 godzin: aplikacja wtedy zostawia jednostkę bez zmian.

### Zadania w dniach i zadania godzinowe razem

Poniższe reguły dotyczą relacji zakończenie-rozpoczęcie w kalendarzu bez własnych pasm godzin pracy, na przykład w standardowym kalendarzu.

- **Zadanie godzinowe → zadanie godzinowe.** Następnik zaczyna się w chwili, gdy poprzednik się kończy, nawet jeśli dzieje się to w środku dnia.
- **Zadanie godzinowe → zadanie w dniach.** Zadanie w dniach nigdy nie zaczyna się w środku dnia. Zaczyna się w pierwszym dniu roboczym po dniu, w którym kończy się zadanie godzinowe. Reszta tego dnia pozostaje niewykorzystana i wraca jako zapas zadania godzinowego.
- **Zadanie w dniach → zadanie godzinowe.** Zadanie w dniach zajmuje cały swój ostatni dzień. Zadanie godzinowe zaczyna się w pierwszym dniu roboczym po nim, na początku pierwszego pasma godzin pracy.

### Zaokrąglanie

Aplikacja zaokrągla lub odrzuca wartość w czterech miejscach:

- **Zadanie w dniach po zadaniu godzinowym** zaczyna się następnego dnia roboczego. Zadanie godzinowe jest niejako zaokrąglone w górę do pełnych dni.
- **Opóźnienie w godzinach** liczy się w kalendarzu opóźnienia, domyślnie w kalendarzu poprzednika. Jeśli poprzednik jest zadaniem w dniach w kalendarzu bez własnych pasm godzin pracy, na przykład w standardowym kalendarzu, aplikacja zamienia opóźnienie na pełne dni robocze: opóźnienie podzielone przez godziny standardowego dnia roboczego, zaokrąglone do liczby całkowitej; pół dnia zaokrągla się w górę. Przy 8 godzinach dziennie 1 godzina liczy się jako 0 dni, 4 godziny jako 1 dzień, a 12 godzin jako 2 dni. To dotyczy także sytuacji, gdy następnik jest zadaniem godzinowym. Jeśli poprzednik jest zadaniem godzinowym albo jego kalendarz ma własne pasma godzin pracy, opóźnienie liczy się dokładnie w godzinach pracy, a przerwa się nie liczy.
- **Czas trwania w dniach** jest zawsze liczbą całkowitą. Jeśli wpiszesz `1.5d`, aplikacja pokazuje komunikat *Wprowadź całkowitą liczbę dni lub godzin, na przykład 2d albo 12h.* Czas trwania w godzinach może wynosić `1.5h` albo `1h 30m`.
- **Zmiana jednostki** następuje tylko wtedy, gdy wynik jest dokładny (zobacz wyżej).

## Przykład praktyczny: dźwig

Kalendarz obejmuje dni od poniedziałku do piątku, od 07:00 do 12:00 i od 13:00 do 16:00: standardowy dzień roboczy to 8 godzin. Projekt zaczyna się w poniedziałek 7 czerwca 2027 r.

### Dwa zadania godzinowe i zadanie w dniach

*Place crane* trwa 12 godzin. Poniedziałek ma 8 godzin pracy (5 do 12:00 i 3 po przerwie), a wtorek ostatnie 4 godziny. Zadanie trwa od poniedziałku 07:00 do **wtorku 8 czerwca 11:00**.

*Adjust elements* trwa 8 godzin i następuje po *Place crane* w relacji zakończenie-rozpoczęcie. Zaczyna się od razu we wtorek o 11:00: to 1 godzina do przerwy i 3 godziny po niej. Ostatnie 4 godziny to środa od 07:00 do 11:00. Zakończenie to **środa 9 czerwca 11:00**.

*Finishing* trwa 2 dni i następuje po *Adjust elements*. Zadanie w dniach nie zaczyna się w środku dnia, więc zaczyna się **w czwartek 10 czerwca** i kończy w piątek 11 czerwca.

### Zaokrąglenie przy przejściu

Jeśli pominiesz *Adjust elements* i połączysz *Finishing* bezpośrednio z *Place crane*, *Finishing* zaczyna się w środę 9 czerwca, a kończy w czwartek 10 czerwca. Reszty wtorku (4 godziny pracy) nie można wykorzystać. Widzisz te 4 godziny ponownie jako zapas całkowity zadania *Place crane*: pół dnia roboczego.

Jeśli odwrócisz kolejność, jest prościej. *Pour foundation* trwa 2 dni, od poniedziałku 7 do wtorku 8 czerwca. *Place crane* trwa teraz 4 godziny i następuje po *Pour foundation*. Zaczyna się w **środę 9 czerwca o 07:00** i kończy się o 11:00.

### Opóźnienie w godzinach

Między *Place crane* (12 godzin) a *Adjust elements* (8 godzin) wstawiasz opóźnienie wynoszące 2 godziny. *Adjust elements* wtedy nie zaczyna się o 11:00, lecz we wtorek o **14:00**: 1 godzina do przerwy i 1 godzina po niej. Zakończenie przesuwa się na **środę 9 czerwca 14:00**.

Po zadaniu w dniach opóźnienie działa inaczej. *Pour foundation* kończy się we wtorek 8 czerwca. Bez opóźnienia *Finishing* zaczyna się w środę 9 czerwca. Przy opóźnieniu wynoszącym 4 godziny to pół dnia, a aplikacja zaokrągla je w górę: *Finishing* zaczyna się **w czwartek 10 czerwca**. Przy opóźnieniu wynoszącym 1 godzinę aplikacja zaokrągla w dół i *Finishing* po prostu zaczyna się w środę.

### Wolne popołudnie w piątek

Teraz piątek ma tylko jedno pasmo, od 07:00 do 12:00: 5 godzin. Pozostałe dni mają nadal po 8 godzin. Standardowy dzień roboczy pozostaje 8 godzin, bo to najczęstsza suma dzienna. Tydzień ma teraz 37 godzin pracy.

Zadanie na 40 godzin od poniedziałku 7 czerwca 07:00 obejmuje od poniedziałku do czwartku (32 godziny) i piątek (5 godzin). Ostatnie 3 godziny przypadają na kolejny poniedziałek, od 07:00 do 10:00. Zakończenie to **poniedziałek 14 czerwca 10:00**. Zadanie na 5 dni zajęłoby od poniedziałku 37 godzin i to aplikacja proponuje, jeśli zmienisz jednostkę z 5 dni na godziny.

W samouczku 4 o planowaniu godzinowym planujesz samodzielnie zadanie z dźwigiem w godzinach.

## Konsekwencje i nieporozumienia

**„8 godzin to 1 dzień.”** Tylko wtedy, gdy kalendarz ma dni po 8 godzin. W kalendarzu z wolnym piątkowym popołudniem 5 dni to 37 godzin, nie 40.

**„Jeśli ustawię więcej godzin dziennie, moje zadanie w dniach skończy się szybciej.”** Nie. Zadanie w dniach liczy pełne dni robocze. Godziny dziennie zmieniają tylko to, ile godzin jest warty dzień, na przykład w wyświetlaniu i przy opóźnieniu w godzinach. Tylko przy zadaniu z zasobami, z typem zadania *Stała praca* albo *Stałe jednostki*, czas trwania zmienia się razem z liczbą godzin dziennie, bo praca pozostaje taka sama: 40 godzin pracy to 5 dni po 8 godzin dziennie i 7 dni po 6 godzin dziennie.

**„Zadanie na 8 godzin trwa jeden dzień.”** Tylko wtedy, gdy zaczyna się na początku dnia. Jeśli zaczyna się później, jak *Adjust elements* we wtorek o 11:00, trwa dalej następnego dnia.

**Kalendarz z własnymi pasmami godzin pracy** działa inaczej niż standardowy kalendarz. Taki kalendarz powstaje, gdy ustawisz godziny pracy dla każdego dnia tygodnia albo wybierzesz gotowe ustawienie zmiany (*2 zmiany*, *3 zmiany*, *Zmiana nocna* lub *24/7*). W takim kalendarzu opóźnienie w godzinach liczy się dokładnie w godzinach pracy, także po zadaniu w dniach.

**Wyłączenie planowania godzinowego** niczego nie usuwa. Zadania godzinowe zostają i są nadal obliczane, ale nie możesz ich edytować, dopóki znowu nie włączysz planowania godzinowego.

## Zobacz także

- [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten): kroki, jak zaplanować zadanie godzinowe.
- [Ustawianie godzin pracy](docs://howto-werktijden-instellen): dostosowanie pasm godzin pracy kalendarza.
- [Kalendarze i dni robocze](docs://uitleg-kalenders): jak aplikacja liczy dni robocze i który kalendarz ma pierwszeństwo.
- [Dodawanie relacji](docs://howto-relaties-leggen): kroki, jak dodać relację albo opóźnienie.
