# Kalendarze i dni robocze

Ile dni roboczych trwa zadanie i na jaką datę się kończy? To zależy od kalendarza, w którym aplikacja liczy. W tym artykule przeczytasz, czym jest kalendarz, jak aplikacja liczy dni robocze z jego pomocą i który kalendarz ma pierwszeństwo, gdy bierze udział więcej niż jeden kalendarz. Przykład krok po kroku pomaga ci prześledzić liczby.

## Pojęcie

Harmonogram liczy w **dniach roboczych**, nie w dniach kalendarzowych. „Pięć dni murowania” oznacza pięć dni, w których odbywa się praca. Weekend lub święto państwowe się nie liczy, więc takie zadanie obejmuje w kalendarzu więcej niż pięć dni.

Które dni są dniami roboczymi, zapisuje się w **kalendarzu**. Kalendarz określa trzy rzeczy:

- **Tydzień roboczy**: dni tygodnia, w których odbywa się praca. Domyślnie jest to od poniedziałku do piątku.
- **Godziny pracy**: początek, koniec i przerwa. Dają **godziny netto na dzień**. Domyślnie jest to od 07:00 do 16:00 z godzinną przerwą, czyli 8 godzin.
- **Święta**: pojedyncze dni lub całe okresy, w których nie odbywa się praca, na przykład Dzień Króla, Boże Narodzenie lub urlop budowlany.

Projekt ma jedną bibliotekę kalendarzy. Jeden z nich to **kalendarz projektu**. Dotyczy on każdego zadania, które nie ma własnego kalendarza. Pojedynczemu zadaniu nadajesz inny kalendarz, na przykład sześciodniowy tydzień roboczy dla podwykonawcy, który pracuje też w soboty. Zasób może mieć też własny kalendarz, ale działa on inaczej (zob. niżej).

## Jak aplikacja oblicza

Ten artykuł opisuje standardowe obliczenie, czyli profil obliczeń *Open Planner Studio*. Nowy projekt liczy z tym profilem.

### Liczenie dni roboczych

Pierwszy dzień roboczy zadania liczy się jako dzień 1. Zadanie na 5 dni kończy się więc w piątym dniu roboczym. Jeśli początek wypada w dzień wolny od pracy, zadanie zaczyna się w następnym dniu roboczym. Święto lub urlop budowlany w środku zadania się nie liczy: zadanie po prostu trwa dalej przez tę przerwę i w kalendarzu jest dłuższe.

Liczba godzin na dzień nie wpływa na daty zadania w dniach. Liczą się tylko tydzień roboczy i święta. Godziny pracy wchodzą w grę dopiero przy zadaniu godzinowym. Opisano to w [Dni i godziny](docs://uitleg-dagen-en-uren).

### Który kalendarz ma pierwszeństwo

Aplikacja wybiera jeden kalendarz dla każdego zadania:

1. Jeśli zadanie ma własny kalendarz, aplikacja oblicza to zadanie w całości w tym kalendarzu: czas trwania, datę zakończenia i zapas.
2. Jeśli nie ma, obowiązuje kalendarz projektu. Jeśli zadanie wskazuje kalendarz, który już nie istnieje, również wraca do kalendarza projektu.

Zadanie sumaryczne (faza) nie ma własnej pracy, więc nie ma też własnego kalendarza. Jego czas trwania wynika z dat jego zadań, a aplikacja liczy go w kalendarzu projektu.

Kalendarz **zasobu** nie wpływa na daty. W harmonogramie, który sam budujesz w aplikacji, określa on tylko, kiedy zasób jest dostępny: w histogramie, przy przeciążeniu i przy bilansowaniu.

### Zadania na różnych kalendarzach

Gdy połączysz dwa zadania z różnymi kalendarzami, obowiązuje następujące:

- Przy relacji zakończenie-rozpoczęcie **następnik** zaczyna się w pierwszym dniu roboczym po zakończeniu **poprzednika**, liczonym w kalendarzu **następnika**. Jeśli zadanie kończy się w piątek, następnik z sześciodniowym tygodniem roboczym zaczyna się w sobotę.
- **Opóźnienie** liczy się domyślnie w kalendarzu **poprzednika**. Możesz to zmienić w *Ustawienia › Projekt › Ustawienia projektu*, w bloku *Profil obliczeń i opcje*, w części *Opcje obliczeń tego projektu*, przy opcji *Kalendarz zwłoki*: *Poprzednik* (domyślnie), *Następnik*, *24-godzinny* lub *Kalendarz projektu*.
- **Zapas całkowity** liczy się w dniach roboczych kalendarza samego zadania. W tym profilu **zapas swobodny** liczy się w kalendarzu następnika.

Dokładnie czym jest opóźnienie, opisano w [Dodawanie relacji](docs://howto-relaties-leggen). Czym jest zapas, opisano w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad).

### Na wykresie Gantt

Szare tło na wykresie Gantt pokazuje zawsze dni wolne od pracy **kalendarza projektu**. Zadanie z własnym kalendarzem może zatem przechodzić przez szary dzień, na przykład zadanie sześciodniowe przez sobotę. Blok świąt o szerokości trzech dni lub więcej wyświetla swoją nazwę, na przykład *Bouwvak (Noord)*. Tak się nie dzieje, gdy włączone jest *Pokazuj tylko dni robocze*. Jeśli nie chcesz w ogóle widzieć szarych dni, włącz *Pokazuj tylko dni robocze* w *Ustawienia › Projekt › Ustawienia aplikacji*, karta *Wygląd*, nagłówek *Oś czasu*.

## Przykład krok po kroku: harmonogram budowy

Przykład korzysta ze standardowego kalendarza *Bouwkalender NL*: od poniedziałku do piątku, z holenderskimi świętami państwowymi. Wszystkie zadania trwają pełną liczbę dni. W samouczku o kalendarzach (samouczek 3) sam zbudujesz taki kalendarz.

### Weekend, święto i urlop budowlany

*Brickwork* trwa 5 dni roboczych i zaczyna się w czwartek 13 maja 2027. Czwartek 13 i piątek 14 maja to dzień 1 i 2. Weekend i Poniedziałek Zielonych Świątek, 17 maja, się nie liczą. Wtorek 18, środa 19 i czwartek 20 maja to dni 3, 4 i 5. Zadanie kończy się w **czwartek, 20 maja**: osiem dni kalendarzowych na pięć dni roboczych.

Urlop budowlany robi różnicę jeszcze większą. Weźmy *Bouwvak (Noord)*, od 26 lipca do 13 sierpnia 2027 włącznie, i to samo zadanie na 5 dni roboczych od piątku 23 lipca. Piątek 23 lipca to dzień 1. Potem kalendarz stoi w miejscu przez trzy tygodnie. Od poniedziałku 16 do czwartku 19 sierpnia to dni 2 do 5. Zakończenie wypada w **czwartek, 19 sierpnia**, 28 dni kalendarzowych po początku. Bez urlopu budowlanego byłoby to czwartek, 29 lipca.

### Zadanie w sobotę

Trzy zadania następują po sobie, wszystkie z relacją zakończenie-rozpoczęcie bez opóźnienia: *Groundwork* (4 dni), *Pour foundation* (3 dni) i *Brickwork* (5 dni). Projekt zaczyna się w poniedziałek 24 maja 2027.

Jeśli wszystkie trzy są w kalendarzu projektu, *Groundwork* trwa od poniedziałku 24 do czwartku 27 maja. *Pour foundation* trwa od piątku 28 maja do wtorku 1 czerwca (piątek, poniedziałek, wtorek). *Brickwork* trwa od środy 2 czerwca do wtorku 8 czerwca. Projekt kończy się we **wtorek, 8 czerwca**.

Nadaj zadaniu *Pour foundation* kalendarz *Six-day week* (od poniedziałku do soboty), a sobota się liczy. Zadanie trwa od piątku 28 maja do **poniedziałku 31 maja** (piątek, sobota, poniedziałek). *Brickwork* zostaje w kalendarzu projektu, zaczyna się we wtorek 1 czerwca i kończy w **poniedziałek 7 czerwca**. Cały projekt jest o jeden dzień krótszy, bo jedno zadanie pracuje w sobotę.

### Opóźnienie na dwóch kalendarzach

*Pour floor* (sześciodniowy tydzień roboczy, 4 dni) zaczyna się w poniedziałek 31 maja i kończy w czwartek 3 czerwca. *Pointing* (kalendarz projektu, 3 dni) następuje po nim z opóźnieniem 2 dni roboczych. Bez opóźnienia *Pointing* zaczynałoby się w piątek 4 czerwca.

- Domyślnie opóźnienie liczy się w kalendarzu poprzednika, czyli w sześciodniowym tygodniu roboczym. Od piątku 4 czerwca sobota 5 czerwca to pierwszy dzień roboczy, a poniedziałek 7 czerwca drugi. *Pointing* zaczyna się w **poniedziałek 7 czerwca** i kończy w środę 9 czerwca.
- Jeśli ustawisz *Kalendarz zwłoki* na *Następnik*, liczy się kalendarz projektu. Sobota wtedy się nie liczy: poniedziałek 7 czerwca to pierwszy dzień roboczy, a wtorek 8 czerwca drugi. *Pointing* zaczyna się we **wtorek 8 czerwca** i kończy w czwartek 10 czerwca.

### Zapas we własnym kalendarzu

*Brickwork* (5 dni, kalendarz projektu) i *Crane hire* (3 dni, sześciodniowy tydzień roboczy) zaczynają się oba w poniedziałek 24 maja. Oba są poprzednikami *Fit window frames* (2 dni, kalendarz projektu).

*Brickwork* kończy się w piątek 28 maja, więc *Fit window frames* zaczyna się w poniedziałek 31 maja. *Crane hire* kończy się już w środę 26 maja. Zapas całkowity *Crane hire* liczy się w jego własnym kalendarzu: czwartek 27, piątek 28 i sobota 29 maja, czyli **3 dni robocze**. Gdyby *Crane hire* był w kalendarzu projektu, byłyby to 2 dni robocze. Zapas swobodny wynosi 2 dni robocze (czwartek i piątek), bo aplikacja liczy go w kalendarzu następnika.

### Kalendarz zasobu

W innym przykładowym projekcie zasób *Bricklaying crew* ma kalendarz *Crew Mon–Thu* (od poniedziałku do czwartku). Jest przydzielony po 1 jednostce dziennie do *Brickwork* (5 dni, kalendarz projektu, od poniedziałku 31 maja do piątku 4 czerwca).

Daty *Brickwork* się nie zmieniają. Ale piątek 4 czerwca jest w histogramie zaznaczony na czerwono, z komunikatem *Nie pracuje w tym dniu według kalendarza „Crew Mon–Thu”*, a wstążka pokazuje jeden zasób pod *Nadmierne przydzielenie*. Bilansowanie tego nie rozwiązuje. Przesuwanie nie pomaga, bo pięć dni roboczych pod rząd zawsze zawiera piątek. W oknie *Bilansuj zasoby* zadanie trafia dlatego na listę *Pozostałe konflikty*, z powodem *Zasób nie pracuje we wszystkie dni potrzebne temu zadaniu — przesunięcie tego nie rozwiąże.*

## Konsekwencje i nieporozumienia

**„Kalendarz zasobu przesuwa moje zadania.”** Nie. Kalendarz zasobu nie zmienia żadnej daty; tylko uwidacznia przeciążenie. Jeśli chcesz, aby samo zadanie przebiegało w innych dniach, nadaj zadaniu własny kalendarz.

**„Jeśli zmienię kalendarz projektu, wszystko się przesunie.”** Przesuwają się tylko zadania bez własnego kalendarza. Zadanie, któremu sam nadałeś kalendarz z listy, zachowuje go, nawet jeśli to przypadkiem stary kalendarz projektu. Jeśli usuniesz kalendarz, zadania i zasoby, które go używały, wracają do kalendarza projektu.

**„Święta są w nim, prawda?”** Święta istnieją tylko dla lat, dla których je utworzono. Dzień poza tymi latami jest po prostu dniem roboczym. W oknie dialogowym kalendarza aplikacja mówi to komunikatem *Święta obejmują 2025–2028. Wygenerować ponownie do 2030 włącznie?*

**„Więcej godzin dziennie skraca moje zadanie.”** Nie dla zadania w dniach: liczy ono pełne dni robocze, bez względu na to, czy dzień ma 6, czy 8 godzin. Czas trwania zmienia się wraz z liczbą godzin tylko dla zadania z zasobami i typem zadania *Stała praca* lub *Stałe jednostki*.

**Kalendarz bez dni roboczych** nie może zostać obliczony przez aplikację. Obliczenie zgłasza *W kalendarzu nie ustawiono dni roboczych*.

## Zobacz także

- [Dni i godziny](docs://uitleg-dagen-en-uren): jak aplikacja liczy godziny pracy i co się dzieje, gdy spotykają się zadania w dniach i zadania godzinowe.
- [Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen): kroki, aby utworzyć własny kalendarz i nadać go zadaniom.
- [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren): wprowadzanie świąt kraju i urlopu budowlanego.
- [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen): zapisywanie dostępności zasobu.
- [Okna kalendarza](docs://ref-kalenders): wszystkie pola okien kalendarza.
