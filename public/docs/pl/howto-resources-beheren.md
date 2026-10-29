# Zarządzanie zasobami

Cel: tworzyć, edytować i usuwać zasoby (ludzi, maszyny i materiał) w projekcie, żebyś mógł przypisywać je do zadań.

## Kiedy tego potrzebujesz

Zanim przypiszesz murarza albo dźwig do zadania, ta osoba lub maszyna musi istnieć jako zasób. Zasób zapisuje, ile tego jest i w które dni pracuje. Na tej podstawie aplikacja sprawdza, czy wymagasz za dużo od zasobu w jednym dniu. Edytujesz zasób, gdy zmienia się obsada, na przykład gdy dołącza drugi murarz.

Dwa pojęcia. **Maks. jednostki** to zdolność na dzień roboczy: 1 to jedna osoba albo maszyna, 2 to dwie z nich. **Przydział** to zasób przypisany do zadania (zob. [Przypisywanie zasobów z użyciem krzywej](docs://howto-resource-toewijzen)).

## Kroki

### Tworzenie zasobu

1. Wybierz *Zasoby › Zarządzaj › Nowy zasób*. Panel zasobów zajmuje cały obszar roboczy, a na dole tabeli pojawia się pusty wiersz. Możesz też otworzyć panel przez *Zasoby › Zarządzaj › Zasoby* i wtedy wybrać *Nowy zasób w projekcie*.
2. Wpisz nazwę, na przykład *Bricklayer*.
3. Wybierz *Typ*: *Robocizna* (domyślna), *Sprzęt*, *Materiał*, *Podwykonawca* lub *Brygada*.
4. Uzupełnij, jeśli trzeba, pozostałe pola. Wszystko ma wartość domyślną: *Maks. jednostki* to 1, a *Kalendarz* to *Kalendarz projektu*. *Stawka/godz* jest pusta. Pole *Jednostka* możesz uzupełnić tylko dla typu *Materiał*, na przykład m³.
5. Naciśnij Enter albo kliknij poza wiersz. Zasób jest w tabeli. Po naciśnięciu Enter od razu otwiera się pod nim pusty wiersz na następny zasób. Gdy skończysz, naciśnij Esc.

Wiersz staje się zasobem dopiero wtedy, gdy ma nazwę. Jeśli naciśniesz Esc albo klikniesz obok bez nazwy, aplikacja nie tworzy niczego. Kolejność wypełniania nie ma znaczenia: możesz najpierw wybrać typ, a potem wpisać nazwę.

### Edytowanie zasobu

Edytuj pola w wierszu. Aplikacja zapisuje nazwę, stawkę i jednostkę, gdy opuścisz pole. Pozostałe pola zapisuje od razu.

- Aplikacja przyjmuje *Maks. jednostki* tylko wtedy, gdy wartość jest większa niż 0. Przy 0 lub mniej pole dostaje czerwoną ramkę i wraca do poprzedniej wartości.
- *Kalendarz* określa, w które dni zasób pracuje. Wybierz *Kalendarz projektu* albo własny kalendarz. Przyciskiem *+ Kalendarz zasobu* tworzysz nowy, a ołówek (*Edytuj…*) otwiera wybrany kalendarz. Jeśli zadanie jest wykonywane w dniu, w którym zasób według swojego kalendarza nie pracuje, ten dzień liczy się jako przeciążony. Jak utworzyć kalendarz zasobu, opisano w [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen).
- *Stawka/godz* i *Razem*: *Razem* to obciążone godziny tego zasobu razy stawka. Tynkarz z 32 godzinami obciążenia i stawką 50 za godzinę daje 1 600,00. Na dole tabeli jest suma wszystkich zasobów.
- *Brygada* grupuje zasób pod zasobem typu *Brygada*. To tylko grupowanie: aplikacja nie dodaje zdolności ani obciążenia członków do brygady.
- Kolorowy kwadracik po lewej to kolor zasobu. Służy tylko do wyświetlania i nie ma wpływu na harmonogram.

### Zdolność zmieniająca się w czasie

Czy Twój drugi murarz pojawia się dopiero 19 lipca? Kliknij strzałkę obok pola *Maks. jednostki*. Pod nagłówkiem *Zdolność rozłożona w czasie* wybierz *Dodaj krok*. Każdy krok ma datę (*Od*) i liczbę (*Maks. jednostki*). Od tej daty obowiązuje ta liczba. Bez kroków obowiązuje zawsze stała wartość.

Nowy krok ma dzisiejszą datę i wartość 1. Zmień obie wartości, bo inaczej od dzisiaj obowiązuje zdolność 1.

### Usuwanie zasobu

1. Kliknij kosz w wierszu.
2. Jeśli zasób ma przydziały, aplikacja prosi o potwierdzenie, na przykład *„Bricklayer” ma przypisań: 4 — usunąć?* Kliknij znacznik, żeby usunąć, albo krzyżyk, żeby anulować. Bez przydziałów zasób znika od razu.

Przydziały zasobu usuwane są razem z nim. Jeśli zadanie ma typ zadania inny niż *Stały czas trwania i jednostki*, aplikacja rozdziela pracę usuniętego zasobu między zasoby, które zostają. Zależnie od typu zadania zmienia to ich jednostki albo czas trwania zadania. Jeśli czas trwania się zmieni, harmonogram jest nieaktualny.

Tworzenie, edycję i usuwanie możesz cofnąć przyciskiem *Cofnij* (Ctrl+Z).

### Mały przegląd w kolumnie bocznej

*Zasoby › Zarządzaj › Dok zasobów* wstawia kompaktowy przegląd w prawej kolumnie bocznej, obok panelu *Właściwości*. Tam widzisz nazwę i kolor każdego zasobu oraz znak ostrzegawczy (*Przeciążony*) obok zasobu, który jest przeciążony. Możesz tam zmienić tylko *Maks. jednostki*. Jeśli zaznaczysz jedno lub więcej zadań, przegląd pokazuje tylko zasoby tych zadań.

## Pułapki i co wtedy robi aplikacja

**Tylko typ *Materiał* ma znaczenie dla obliczeń.** Robocizna, Sprzęt, Podwykonawca i Brygada są traktowane tak samo. Materiał nie wlicza się do czasu trwania zadania i nie jest wyrównywany. W histogramie wiersz *Wszystkie zasoby* też nie uwzględnia materiału.

**Bez nazwy nie ma zasobu.** Pusty wiersz znika bez śladu.

**Nowy krok zdolności.** Jeśli zapomnisz zmienić datę i liczbę, zdolność wynosi 1 od dzisiaj.

**Usunięcie zasobu, którego nadal potrzebujesz.** Jeśli usuniesz go przez pomyłkę, od razu naciśnij Ctrl+Z. Wracają też przydziały.

## Zobacz także

- [Przypisywanie zasobów z użyciem krzywej](docs://howto-resource-toewijzen): zasób przypisujesz do zadania.
- [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen): ustalasz, w jakich dniach roboczych pracuje jeden zasób.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić, gdy zasób ma w jeden dzień za dużo pracy.
- [Panel zasobów](docs://ref-resourcepaneel): wszystkie pola i przyciski panelu zasobów.
