# Tworzenie i przypisywanie kalendarza

Cel: utwórz własny kalendarz, na przykład sześciodniowy tydzień pracy, i przypisz go zadaniom, które trzeba obliczyć w tym kalendarzu.

## Kiedy tego potrzebujesz

Podwykonawca pracuje też w soboty. Ekipa pracuje tylko od poniedziałku do czwartku. Zadanie przypada na czas, w którym tylko to zadanie stoi w miejscu. Kalendarz projektu ma wtedy złe dni robocze. Z własnym kalendarzem aplikacja oblicza te zadania we właściwych dniach, a reszta zostaje w kalendarzu projektu. Co aplikacja dokładnie robi z kalendarzem, opisuje [Kalendarze i dni robocze](docs://uitleg-kalenders).

## Kroki

### Tworzenie kalendarza

1. Wybierz *Planowanie › Kalendarz › Kalendarz*. Ten sam przycisk jest w *Ustawienia › Kalendarz › Kalendarz*. Otwiera się okno *Kalendarze*. Po lewej są kalendarze projektu; kalendarz projektu ma gwiazdkę.
2. Pod listą kliknij przycisk z plusem (*Nowy kalendarz*). Nowy kalendarz jest kopią standardowego kalendarza: od poniedziałku do piątku, od 07:00 do 16:00, z godzinną przerwą. Jeśli *Tryb budowlany* jest włączony, kalendarz zawiera holenderskie święta państwowe. Chcesz jako podstawę istniejący kalendarz? Wybierz go na liście i kliknij przycisk z dwoma arkuszami pod listą (*Duplikuj*).
3. Nadaj kalendarzowi nazwę w polu *Nazwa*, która mówi, kto go używa, na przykład *Six-day week*.
4. W sekcji *Dni robocze* kliknij dni tygodnia, aby je włączyć lub wyłączyć. *Pon–pt* przywraca standardowy tydzień, od 07:00 do 16:00. Jeśli kalendarz ma pasma godzin pracy, *Pon–pt* tylko włącza dni od poniedziałku do piątku, a każdy dzień zachowuje swoje pasma. *Ciągły (24/7)* włącza wszystkie siedem dni, od 00:00 do 24:00.
5. Zmień w razie potrzeby godziny pracy: *Początek (godz.)*, *Koniec (godz.)*, *Początek przerwy* i *Czas przerwy (minuty)*. Czas wpisujesz w formacie GG:MM; strzałkami zwiększasz lub zmniejszasz go o kwadrans. Jeśli ustawisz czas przerwy na 0, kalendarz działa bez przerwy. *Standardowy dzień roboczy* aplikacja oblicza sama. Jeśli kalendarz ma pasma godzin pracy dla każdego dnia tygodnia (na przykład z MS Project), nie widzisz tych pól, lecz blok *Godziny pracy* — także przy wyłączonym planowaniu godzinowym; zobacz [Ustawianie godzin pracy](docs://howto-werktijden-instellen).
6. Jeśli trzeba, dostosuj święta. Jak to działa, opisano w [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren).
7. Kliknij *Zastosuj*. Aplikacja od razu przelicza harmonogram i zamyka okno. Przyciskiem *Anuluj* odrzucasz zmiany. Enter w polu zapisuje zmiany po drodze i też przelicza, bez zamykania okna; *Anuluj* cofa wtedy tylko zmiany, które wprowadziłeś potem.

### Przypisywanie kalendarza zadaniom

Nowy kalendarz działa dopiero wtedy, gdy zadanie z niego korzysta. Są dwa sposoby.

**Przez panel właściwości**

1. Zaznacz zadanie. Jeśli nie widzisz panelu *Właściwości*, włącz go przez *Widok › Panele › Właściwości*.
2. W sekcji *Zadanie* wybierz kalendarz na liście *Kalendarz*. Najwyższy wybór, *Kalendarz projektu* z nazwą po nim, oznacza, że zadanie nie ma własnego kalendarza.

**Przez menu prawego przycisku myszy**

1. Kliknij zadanie prawym przyciskiem myszy w tabeli zadań albo na pasku w Gantt.
2. Wybierz *Przypisz kalendarz*, a potem kalendarz, albo *Kalendarz projektu*, aby ponownie usunąć własny kalendarz zadania. Kalendarz, który obowiązuje teraz, ma ptaszek.
3. Chcesz jeden kalendarz dać kilku zadaniom naraz? Zaznacz je najpierw z klawiszem Ctrl (⌘ na Macu) i kliknij prawym przyciskiem myszy jedno z zaznaczonych zadań. Wybór dotyczy wszystkich zaznaczonych zadań. Jeśli klikniesz prawym przyciskiem zadanie, którego nie zaznaczono, wybór dotyczy tylko tego zadania.

Nowy wybór kalendarza jeszcze nie aktualizuje harmonogramu: na pasku stanu pojawia się *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Jeśli *Oblicz automatycznie* jest włączone (*Ustawienia › Projekt › Ustawienia aplikacji*, zakładka *Planowanie*, nagłówek *Obliczanie*), aplikacja robi to sama.

### Zmiana kalendarza projektu

1. Otwórz *Planowanie › Kalendarz › Kalendarz* i wybierz kalendarz na liście.
2. Nad formularzem kliknij *Ustaw jako domyślny dla projektu*. Gwiazdka przechodzi do tego kalendarza.
3. Kliknij *Zastosuj*.

Przechodzą na nowy kalendarz tylko zadania bez własnego kalendarza.

### Usuwanie kalendarza

1. Otwórz okno *Kalendarze* i wybierz kalendarz na liście.
2. Pod listą kliknij przycisk z koszem (*Usuń*). Ten przycisk jest wyłączony, dopóki istnieje tylko jeden kalendarz.
3. Kliknij *Zastosuj*. Zadania i zasoby, które używały tego kalendarza, wracają do kalendarza projektu. Jeśli usuniesz sam kalendarz projektu, pierwszy kalendarz na liście staje się kalendarzem projektu.

## Pułapki i co aplikacja wtedy robi

**Brak dni roboczych.** Jeśli wyłączysz wszystkie dni tygodnia, aplikacja nie może obliczyć harmonogramu. Przy obliczaniu pojawia się komunikat *W kalendarzu nie ustawiono dni roboczych*.

**Nieprawidłowe dane.** Przerwa poza dniem roboczym, godzina początku późniejsza niż godzina końca albo święto z nieprawidłową datą: przy polu pojawia się czerwony komunikat, a *Zastosuj* jest nieaktywne, dopóki tego nie poprawisz. Przy nieprawidłowej przerwie albo święcie pojawia się też znak ostrzegawczy przy kalendarzu na liście (*Ten kalendarz zawiera nieprawidłowe dane*).

**Kalendarz na fazie.** Faza zawsze jest obliczana według kalendarza projektu, ponieważ jej czas trwania wynika z zadań. Przypisz kalendarz do samych zadań.

**Ten sam kalendarz, dwa wybory.** Na liście kalendarz projektu pojawia się dwa razy: jako *Kalendarz projektu: nazwa* i jako zwykły kalendarz o tej nazwie. Jeśli wybierzesz drugi, to osobny wybór dla tego zadania. Zadanie wtedy nie zmienia kalendarza razem z kalendarzem projektu, gdy później wybierzesz inny kalendarz projektu.

**Inne godziny dziennie.** Jeśli zmienisz godziny pracy albo przerwę tak, że zmieni się *Standardowy dzień roboczy* kalendarza, zadanie podane w dniach liczy się nadal jako tyle samo dni. Dla zadania z zasobami i typem zadania *Stała praca* lub *Stałe jednostki* czas trwania się wtedy zmienia, bo praca pozostaje taka sama. Praca wynosząca czterdzieści godzin to 5 dni po 8 godzin dziennie albo 7 dni po 6 godzin dziennie. Aplikacja pokazuje, u ilu zadań zmienił się czas trwania.

## Zobacz też

- [Kalendarze i dni robocze](docs://uitleg-kalenders): jak aplikacja liczy dni robocze i który kalendarz ma pierwszeństwo.
- [Dni i godziny](docs://uitleg-dagen-en-uren): co robi standardowy dzień roboczy.
- [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen): kalendarz dla zasobu zamiast dla zadania.
- [Okna kalendarzy](docs://ref-kalenders): wszystkie pola okien kalendarzy.
