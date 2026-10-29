# Ustawianie godzin pracy

Cel: zapisać dla każdego dnia tygodnia, o jakich godzinach zegarowych kalendarz pracuje, aby zadania w godzinach przebiegały we właściwych porach.

## Kiedy tego potrzebujesz

Piątkowe popołudnie jest wolne. Ekipa pracuje od 06:00 do 22:00 w dwóch zmianach. Jest ekipa nocna. Przerwa trwa krócej niż godzinę. Dopóki planujesz tylko w dniach, wystarczą *Początek (godz.)*, *Koniec (godz.)* i przerwa ([Tworzenie kalendarza i przypisywanie go](docs://howto-kalender-maken-en-toewijzen)). Jeśli planujesz zadania w godzinach, aplikacja liczy minuty pracy w ramach **pasm** kalendarza. W aplikacji nazywa się je *pasmami*: pasmo to ciągły odcinek godzin pracy w jednym dniu tygodnia, a odstęp między dwoma pasmami to przerwa. Co to oznacza dla Twojego harmonogramu, wyjaśnia [Dni i godziny](docs://uitleg-dagen-en-uren).

Żeby zwykły kalendarz dostał pasma czasu pracy, potrzebujesz opcji *Włącz planowanie godzinowe* ([Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten)). Jeśli kalendarz ma już pasma, na przykład z pliku MS Project, sekcja *Godziny pracy* jest zawsze widoczna. Pasma zmienisz także przy wyłączonym planowaniu godzinowym.

## Kroki

### Wybieranie profilu zmian

1. Wybierz *Planowanie › Kalendarz › Kalendarz* i wybierz kalendarz po lewej stronie.
2. W sekcji *Godziny pracy* kliknij profil. Zastępuje on dni robocze i godziny pracy kalendarza.
3. Kliknij *Zastosuj*.

Każdy profil działa tak:

- *Zmiana dzienna*: od poniedziałku do piątku od 08:00 do 16:00 bez przerwy. Dzięki temu kalendarz znów jest zwykłym kalendarzem, bez pasm czasu pracy.
- *2 zmiany*: od poniedziałku do piątku od 06:00 do 14:00 i od 14:00 do 22:00, łącznie 16 godzin.
- *3 zmiany*: od poniedziałku do piątku trzy zmiany: od 06:00 do 14:00, od 14:00 do 22:00 i od 22:00 do 06:00 dnia następnego, łącznie 24 godziny.
- *Zmiana nocna*: od poniedziałku do piątku od 22:00 do 06:00 dnia następnego, 8 godzin.
- *24/7*: wszystkie siedem dni od 00:00 do 24:00.

### Ustawianie godzin pracy dla każdego dnia tygodnia

1. W sekcji *Godziny pracy* kliknij *Ustaw dla każdego dnia tygodnia…*. Pod przyciskami pojawia się wiersz dla każdego dnia tygodnia z czasem pracy tego dnia. Kalendarz ma teraz pasma czasu pracy dla każdego dnia tygodnia. Jeśli kalendarz już je ma, ten przegląd jest od razu otwarty. Przycisk nazywa się wtedy *Ukryj godziny pracy* i zwija go.
2. Zmień czas początku i końca każdego pasma w dwóch polach godzin. Wpisz godzinę i naciśnij Enter albo użyj strzałek (co 15 minut). Pola korzystają z ustawienia *Format godziny* w ustawieniach; obie formy działają: *13:00* i *1:00 PM*.
3. Jeśli chcesz wstawić przerwę, kliknij **+** (*Dodaj pasmo*) przy tym dniu i zmień godziny pasm tak, aby między nimi był odstęp. Nowe pasmo zaczyna się o 08:00 i kończy o 16:00.
4. Pasmo, które trwa po północy, zaznacz opcją *następny dzień*. Pasmo liczy się do dnia, w którym się zaczyna.
5. Kliknij kosz za pasmem, aby je usunąć. Dzień bez pasm pokazuje się jako *Niepracujący*.
6. Dla dnia od poniedziałku do piątku kliknij symbol kopiowania (*Kopiuj do wszystkich dni roboczych*), aby skopiować pasma tego dnia na poniedziałek do piątku.
7. Nad sekcją *Godziny pracy* znajduje się *Standardowy dzień roboczy*: czas pracy na dzień, który aplikacja wylicza z pasm i na którym liczy. Liczba zmienia się od razu, gdy zmienisz pasma. Jeśli kalendarz ma własne godziny na dzień (na przykład z pliku Primavera P6), ta własna wartość zostaje i jest zachowywana przy eksporcie, dopóki profil jej nie zastąpi. Jeśli ta własna wartość różni się od wartości w polu *Standardowy dzień roboczy*, pod liczbą pojawia się pomarańczowe pole, na przykład: *Plik ma własny dzień roboczy o długości 8 g. Aplikacja zachowuje go przy eksporcie do MS Project i P6. Tam dzień liczy 8 g, tutaj 10 g.* Pole znika, gdy tylko pasma dają tę samą sumę dzienną, albo gdy profil zastąpi własną wartość. Pole nie zmienia obliczeń. Kliknij *Zastosuj*.

**Przykład: wolne piątkowe popołudnie.** Kliknij *Ustaw dla każdego dnia tygodnia…*. Usuń drugie pasmo (13:00 do 16:00) dla *Pt*. Piątek ma teraz 5 godzin, pozostałe dni 8. *Standardowy dzień roboczy* pozostaje 8 godzin.

### Zapisywanie własnego profilu

1. Kliknij *Zapisz jako profil…* i wpisz nazwę w polu *Nazwa profilu*.
2. Kliknij *Zapisz*. Profil pojawia się teraz wśród innych profili i możesz go użyć w każdym projekcie. Krzyżykiem obok niego usuniesz go ponownie.

Własny profil jest zapisany na tym urządzeniu, a nie w pliku projektu.

## Pułapki i co wtedy robi aplikacja

**Profil zastępuje wszystko.** Jeśli wybierzesz profil, dni robocze i godziny pracy, ustawione wcześniej, znikają. Święta pozostają.

**Przyciski dni zmieniają pasma.** Jeśli wyłączysz dzień w polu *Dni robocze*, znikają pasma tego dnia. Jeśli włączysz go ponownie, dostanie pasma, które miał, gdy otworzyłeś okno (albo po ostatnim profilu). Jeśli takich pasm nie ma, dostanie pasma pierwszego dnia roboczego. *Pon–pt* robi to dla poniedziałku do piątku i usuwa pasma soboty i niedzieli. *Ciągły (24/7)* zastępuje wszystkie pasma: każdy dzień dostaje 00:00 do 24:00.

**Zmiana godzin pracy przy wyłączonym planowaniu godzinowym.** Kalendarz z pasmami czasu pracy zachowuje sekcję *Godziny pracy*, także gdy wyłączysz planowanie godzinowe. Pasma zmieniasz tam po prostu. Jeśli wybierzesz *Zmiana dzienna*, kalendarz znów staje się zwykły, z polami *Początek (godz.)*, *Koniec (godz.)* i przerwą. Pasma wstawisz wtedy tylko przy włączonym planowaniu godzinowym.

**Brak użytecznych godzin pracy.** Kalendarz bez pasm albo bez dni roboczych nie może obsłużyć zadania w godzinach. Aplikacja wtedy zgłasza: *Ten kalendarz nie ma prawidłowych godzin pracy. Sprawdź dni i godziny pracy.*

## Zobacz także

- [Dni i godziny](docs://uitleg-dagen-en-uren): jak aplikacja liczy godziny pracy i wylicza standardowy dzień roboczy.
- [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten): planowanie zadania w godzinach.
- [Kalendarze i dni robocze](docs://uitleg-kalenders): który kalendarz dotyczy którego zadania.
- [Okna kalendarza](docs://ref-kalenders): wszystkie pola okien kalendarza.
