# Przesuwanie projektu

Cel: przesunąć cały harmonogram na nową datę rozpoczęcia i zawczasu zobaczyć, jak to wpływa na koniec projektu.

## Kiedy to potrzebujesz

Początek prac się przesuwa: pozwolenie przychodzi później albo używasz harmonogramu poprzedniego budynku przy następnym. Przesuwanie każdego zadania osobno kosztuje dużo pracy. Dzięki **Przesuń projekt** wpisujesz jedną nową datę rozpoczęcia, a aplikacja przesuwa wszystko za nią.

Koniec projektu nie zawsze przesuwa się o tyle samo co początek. **Kalendarz** nie przesuwa się razem z nimi: święta, urlop budowlany i zimowy postój leżą na stałych datach. Przykład: w *Start › Plik › Nowy* tworzysz projekt z *Data rozpoczęcia* 29-09-2026, *Kraj* ustawionym na *Holandia* i *Urlop budowlany* ustawionym na *Brak*. Wstawiasz do niego harmonogram 30 dni roboczych, który kończy się 9 listopada 2026. Przesuwasz go na 14 grudnia 2026, czyli 76 dni kalendarzowych później. Koniec projektu wypada wtedy 26 stycznia 2027. To 78 dni później, bo 25 grudnia i 1 stycznia są teraz dniami wolnymi w Twoim harmonogramie. Czas trwania pozostaje 30 dni roboczych. Podgląd w oknie pokazuje to, zanim zmienisz cokolwiek.

## Kroki

1. Wybierz *Planowanie › Harmonogram › Przesuń projekt…*. Przycisk jest nieaktywny, dopóki projekt nie ma daty rozpoczęcia.
2. Pod *Bieżący początek projektu* zobaczysz, gdzie projekt zaczyna się teraz. Pod *Nowy początek projektu* wybierz nową datę.
3. Jeśli projekt ma plany bazowe, pojawia się pole wyboru *Przesuń także plany bazowe*. Zostaw je wyłączone, jeśli chcesz dalej widzieć przesunięcie jako odchylenie (zob. pułapki).
4. Kliknij *Oblicz podgląd*. Aplikacja oblicza przesunięty harmonogram w całości, bez zmieniania projektu.
5. Sprawdź podgląd (zob. niżej). Jeśli jest dobry, kliknij *Przesuń*.

W podglądzie widzisz:

- przesunięcie w dniach kalendarzowych (*Przesunięcie: 76 dni kalendarzowych do przodu*);
- *Początek projektu* i *Koniec projektu*, przed i po zmianie;
- czerwone ostrzeżenie, jeśli kalendarz przeszkadza, albo komunikat, że czas trwania projektu pozostaje taki sam;
- liczbę przesuniętych zadań i to, co jeszcze się przesuwa;
- ostrzeżenia, które warto przeczytać (zob. pułapki).

Aplikacja oblicza nowy harmonogram od razu, więc nie musisz używać **Oblicz** (F5), i dopasowuje widok do całego projektu. Całą operację cofasz jednym poleceniem *Cofnij* (Ctrl+Z).

Przycisk *Przesuń* działa tylko po podglądzie bez błędu i wtedy, gdy nowa data różni się od bieżącej. Jeśli zmienisz datę albo pole wyboru, podgląd znika i musisz ponownie obliczyć.

### Co się przesuwa, a co nie

Przesuwa się: początek i zakończenie każdego zadania, rzeczywiste rozpoczęcie i rzeczywiste zakończenie, daty ograniczeń (także twardego przypięcia Mandatory, zob. [Ograniczenia i terminy ostateczne](docs://uitleg-constraints)), terminy ostateczne, data statusu, kotwice relacji zewnętrznych i kroki dostępności zasobów. Początek projektu i, jeśli ją uzupełnisz, data zakończenia projektu też się przesuwają.

Nie przesuwa się:

- kalendarze, czyli święta, urlop budowlany i zimowy postój;
- plany bazowe, chyba że włączysz *Przesuń także plany bazowe*;
- wypełnione pole niestandardowe typu *Data*.

## Pułapki i co robi aplikacja

**Zakończenie projektu przesuwa się o inną liczbę dni.** Jeśli podgląd zauważy, że zakończenie przesuwa się o więcej lub mniej dni kalendarzowych niż początek, albo że czas trwania projektu w dniach roboczych się zmienia, pokaże czerwone ostrzeżenie z liczbami. Wtedy nadal możesz anulować.

**Plany bazowe pozostają ustalone.** Plan bazowy służy do mierzenia odchylenia. Jeśli przesuniesz projekt przy wyłączonym polu wyboru, zobaczysz przesunięcie jako odchylenie od planu bazowego. Jeśli włączysz pole wyboru, plany bazowe przesuwają się razem z harmonogramem. Przesuwają się tylko ich daty; data zapisania planu bazowego się nie zmienia.

**Projekt w toku.** Rzeczywiste daty przesuwają się razem z harmonogramem. W projekcie, w którym już wpisano postęp, nie zawsze tego chcesz. Aplikacja ostrzega: *Sprawdź, czy to jest poprawne w przypadku projektu w toku.*

**Relacje zewnętrzne.** Kotwica w Twoim projekcie przesuwa się razem z harmonogramem, projekt źródłowy nie. Odśwież relacje po przesunięciu za pomocą *Start › Zadania › Połącz ▾ › Odśwież wszystkie relacje zewnętrzne*. Zobacz [Relacje zewnętrzne do innego projektu](docs://howto-externe-relaties).

**Święta, które nie sięgają wystarczająco daleko.** Kalendarz z wygenerowanymi świętami obejmuje kilka lat. Jeśli przesunięty harmonogram wykracza poza ten okres, aplikacja oblicza ten rok bez świąt. Podgląd ostrzega o tym, na przykład: *Wygenerowane dni wolne kalendarza „Bouwkalender NL” obejmują 2025–2029; przesunięty harmonogram sięga 2030. Wygeneruj dni wolne ponownie.* Najpierw przesuń projekt. Potem otwórz *Planowanie › Kalendarz › Kalendarz*: obok świąt jest teraz *Generuj ponownie*. Potwierdź *Zastosuj*, a aplikacja przelicza harmonogram. Zakres nowych świąt zależy od dat projektu, więc regenerowanie przed przesunięciem nie pomaga.

**Data leży w przeszłości.** To jest dozwolone, ale podgląd o tym wspomina: *Nowa data rozpoczęcia jest w przeszłości.*

**Zmiana początku projektu w ustawieniach projektu to coś innego.** Jeśli zmienisz datę rozpoczęcia w *Ustawienia › Projekt › Ustawienia projektu* i wybierzesz *Zastosuj*, harmonogram się nie przesuwa. Tylko zadania bez poprzednika ani ograniczenia, które po zmianie leżałyby przed nowym początkiem, przesuwają się do tej daty, a aplikacja podaje, ile ich jest. Jeśli chcesz przesunąć wszystko, użyj *Przesuń projekt…*.

## Zobacz także

- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak harmonogram się oblicza i dlaczego przesuwa się zakończenie projektu.
- [Dodawanie relacji](docs://howto-relaties-leggen): relacje po prostu pozostają ustalone przy przesuwaniu.
- [Nowy projekt i ustawienia projektu](docs://ref-projectinfo): co robi data rozpoczęcia w ustawieniach projektu.
