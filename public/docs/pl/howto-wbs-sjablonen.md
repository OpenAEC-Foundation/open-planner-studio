# Zapisywanie i wstawianie szablonów WBS

Cel: zapisz fazę z jej podzadaniami i relacjami jako szablon i wstaw ją później ponownie w tym samym lub innym projekcie.

## Kiedy tego potrzebujesz

Ciągle planujesz ten sam rodzaj prac: każdy dom ma fundament z robotami ziemnymi, zbrojeniem, betonowaniem i pielęgnacją betonu. Zamiast tworzyć te zadania raz za razem i je połączyć, zapisz fazę raz jako **szablon**. Szablon to gałąź Twojej struktury WBS: jedno zadanie ze wszystkim, co się pod nim znajduje.

## Kroki

### Zapisywanie gałęzi jako szablonu

1. Zbuduj gałąź tak, jak chcesz ją ponownie użyć: zadanie sumaryczne z podzadaniami i relacjami między nimi.
2. Kliknij prawym przyciskiem myszy to zadanie sumaryczne i wybierz *Zapisz gałąź jako szablon*. Ta pozycja menu pojawia się tylko przy zadaniach z podzadaniami.

Aplikacja pokazuje komunikat *Gałąź zapisana jako szablon 'Foundation'*. Aplikacja nie pyta o nazwę: szablon dostaje nazwę od najwyższego zadania gałęzi.

### Wstawianie szablonu

1. Zaznacz zadanie, pod którym ma być szablon, albo nic nie zaznaczaj.
2. Wybierz *Planowanie › Struktura › Szablony*. Lista pokazuje nazwę każdego szablonu oraz, na przykład, *Zadania: 4, relacje: 2*.
3. Kliknij szablon.

Jeśli zadanie jest zaznaczone, szablon trafia jako ostatnie podzadanie pod tym zadaniem. Przez to zadanie staje się zadaniem sumarycznym. Jeśli zaznaczonych jest kilka zadań, liczy się to zadanie, które kliknąłeś jako pierwsze. Jeśli nic nie jest zaznaczone, gałąź trafia na dół listy, na najwyższy poziom. Wstawiona gałąź zostaje potem zaznaczona.

Wszystkie wstawione zadania zaczynają się na początku projektu, a harmonogram jest nieaktualny. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*, a daty wynikają z relacji. Jedno *Cofnij* cofa całe wstawienie. Zapisanie lub usunięcie szablonu nie wchodzi w jego skład.

### Usuwanie szablonu

Otwórz *Planowanie › Struktura › Szablony* i kliknij mały kosz po prawej stronie szablonu (*Usuń szablon*). Aplikacja nie pyta o potwierdzenie.

### Co zawiera szablon

Dla każdego zadania szablon zachowuje nazwę, opis, rodzaj robót, informację, czy zadanie jest kamieniem milowym, oraz czas trwania w dniach. Z relacji zachowuje te, które łączą dwa zadania w gałęzi, wraz z ich typem i opóźnieniem. Opóźnienie w godzinach (`4h`) nie zostaje zachowane i staje się 0. Opóźnienie w dniach roboczych, dniach kalendarzowych lub procentach zostaje zachowane.

Wszystko inne zostaje poza szablonem: daty, postęp i rzeczywiste daty, przydziały zasobów, kody i pola niestandardowe (zob. [Kody i pola niestandardowe](docs://howto-codes-en-velden)), kalendarz, ograniczenia i terminy ostateczne, priorytet, niestandardowy rodzaj robót, dla kamienia milowego jego rodzaj i pole wyboru *Obowiązkowy (umowny)*, oraz relacje z zadaniami spoza gałęzi. Po wstawieniu musisz je uzupełnić ponownie: przydziały, kody, kalendarz i ograniczenia są puste, a wszystkie zadania zaczynają się na początku projektu.

Zadanie w godzinach wraca jako zadanie w dniach, a jego czas trwania zostaje przeliczony na ułamek dnia roboczego. Zadanie trwające 5 godzin, przy dniu roboczym 8 godzin, ma po wstawieniu czas trwania 0,625 dnia.

## Pułapki i co robi aplikacja

**Szablony nie należą do projektu.** Aplikacja przechowuje je w pamięci aplikacji na tym urządzeniu, a nie w pliku projektu. Kolega, który otworzy Twój plik, nie zobaczy Twoich szablonów. W wersji przeglądarkowej szablon należy do tej przeglądarki. Jeśli szablony są dla Ciebie ważne, zachowaj je także w innym miejscu: umieść je w projekcie, który zapiszesz jako plik.

**Ta sama nazwa może wystąpić więcej niż raz.** Jeśli zapiszesz gałąź dwa razy, lista zawiera dwa szablony o tej samej nazwie. Aplikacja niczego nie nadpisuje.

**Czas trwania najwyższego zadania się nie liczy.** Zadanie sumaryczne dostaje czas trwania z podzadań, gdy tylko użyjesz polecenia Oblicz.

**Zadanie z przydziałami zasobów jako miejsce docelowe.** Jeśli zaznaczysz zadanie z przydziałami zasobów, które nie ma jeszcze podzadań, i wstawisz pod nim szablon, aplikacja odmówi. Zadanie stałoby się zadaniem sumarycznym, a zadanie sumaryczne nie ma przydziałów. Najwyższe zadanie szablonu ma już własne podzadania, więc przydziały nie miałyby dokąd trafić. Aplikacja informuje o tym i niczego nie zmienia. Wybierz wtedy inne zadanie albo nic jako miejsce. Kamień milowy, który dostaje szablon, traci znacznik kamienia milowego; aplikacja pokazuje o tym komunikat.

**Nieprawidłowa relacja w szablonie.** Jeśli relacja w szablonie jest niedozwolona, na przykład relacja między zadaniem a jego własną fazą, albo już istnieje, aplikacja ją pomija i informuje, ile relacji pominęła.

## Zobacz też

- [Zmiana struktury](docs://howto-structuur-aanpassen): przenieś wstawioną gałąź lub zmień jej wcięcie.
- [Dodawanie relacji](docs://howto-relaties-leggen): utwórz samodzielnie relacje wewnątrz gałęzi, zanim ją zapiszesz.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co dzieje się z wstawioną gałęzią po poleceniu Oblicz.
