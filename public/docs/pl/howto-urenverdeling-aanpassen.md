# Dostosowywanie rozkładu godzin

Cel: dla jednego przydziału ustalasz sam, ile zasób pracuje w każdym dniu roboczym zadania, zamiast używać standardowej krzywej.

## Kiedy tego potrzebujesz

Krzywa, na przykład *Dzwonowy*, ma stały kształt. Czasem wiesz lepiej. Murarz zaczyna przy zewnętrznej warstwie muru z połową wydajności, bo rusztowanie jeszcze się montuje, a potem pracuje pełnym etatem. Albo chcesz utrzymać szczyt tuż poniżej zdolności zasobu. Wtedy dostosowujesz **rozkład godzin**.

Pracujesz z **fazami**: kolejnymi dniami roboczymi, w których zasób pracuje z tymi samymi jednostkami. Rozkład zmienia tylko godziny na dzień tego jednego przydziału. Daty zadania się nie zmieniają.

## Kroki

Przykład to zewnętrzna warstwa muru: 6 dni roboczych, jeden murarz, 48 godzin.

1. Zaznacz zadanie. Panel *Właściwości* jest po prawej stronie. Jeśli go nie widzisz, włącz go: *Widok › Panele › Właściwości*.
2. W bloku *Przydziały* kliknij nazwę murarza. Pod nim pojawiają się *Krzywa* i przycisk *Rozkład godzin…*. Kliknij *Rozkład godzin…*. Otwiera się okno *Rozkład godzin w fazach*. Zaczynasz od tego, co aplikacja obecnie rezerwuje. Dla tej zewnętrznej warstwy muru to jedna faza, 6 dni, z jednostkami 1.
3. Jeśli trzeba, wybierz punkt startowy przy polu *Zastosuj kształt:*. Przy kształcie *Dzwonowy* aplikacja tworzy pięć faz: 0,18 jednostki na pierwszym i ostatnim dniu, 0,84 na drugim i piątym dniu oraz 1,98 na dwóch środkowych dniach. Suma pozostaje 48 godzin.

### Dostosowywanie faz

Możesz pracować w tabeli albo w pasku nad nią.

- Wpisz inny *Nakład (jedn./dzień)* w fazie. Kolumny *Godz./dzień* i *Godziny* obliczają się same.
- Zmień liczbę *Dni* fazy. Ostatnia faza zawsze trwa do końca zadania i dostaje pozostałe dni.
- Wybierz *Podziel*, aby podzielić fazę na dwie, na przykład 6 dni na 3 i 3. Wybierz *Scal*, aby połączyć fazę z następną.
- W pasku przeciągasz granicę, aby fazę wydłużyć lub skrócić. Przeciągasz górną krawędź, aby ustawić nakład. Dwukrotnie klikasz dzień, aby podzielić fazę.

### Zastosowanie

Wybierz *Zastosuj*. Po kliknięciu przycisku *Anuluj* okno zamyka się bez zmian.

Przykład. Wybierz *Podziel*, ustaw *Dni* pierwszej fazy na 2 i nakład tej fazy na 0,5. Druga faza trwa wtedy 4 dni z nakładem 1. Suma wynosi 2 × 0,5 × 8 + 4 × 1 × 8 = 40 godzin.

Po kliknięciu przycisku *Zastosuj* krzywa przydziału ustawia się na *Kontur* i jest wyłączona. *Jednostki* zostają bez zmian. Obok nazwy pojawia się ikona z słupkami, także gdy przydział jest zwinięty. Histogram i przeciążenie od razu zmieniają się zgodnie z nowym rozkładem. Przeliczenie nie jest potrzebne, bo żadna data się nie przesuwa.

### Zwalnianie rozkładu

Jeśli przydział ma własny rozkład, okno ma też przycisk *Zwolnij rozkład*. To usuwa Twój własny rozkład, a aplikacja wraca do pola *Jednostki* i do krzywej. Wybierz to też wtedy, gdy chcesz zmienić krzywą, bo lista *Krzywa* jest wyłączona, dopóki przydział ma własny rozkład.

## Pułapki i co wtedy robi aplikacja

**Suma zmienia się razem z rozkładem.** Godzin nie dzielisz, tylko je ustalasz. Jeśli ustawisz fazę na 0,5 zamiast 0,18, suma rośnie. Suma w godzinach jest na dole okna, więc sprawdź ją przed kliknięciem *Zastosuj*.

**Co jednostki robią potem, zależy od typu zadania.** Dla typu *Stały czas trwania i jednostki* inne *Jednostki* nie zmieniają rozkładu. Dla typu *Stały czas trwania i praca* aplikacja skaluje godziny na dzień razem z nowymi jednostkami: przy jednostkach 2 zamiast 1 podwaja się każdy dzień i suma (z 32 do 64 godzin), a czas trwania zostaje ten sam. Dla typu *Stała praca* jednostki zmieniają czas trwania zadania. Rozkład wtedy zostaje ściśnięty lub rozciągnięty na nowy czas trwania, z tą samą sumą. Dla typu *Stałe jednostki* jednostki zmieniają także czas trwania. Sprawdź potem sumę na dole okna.

**Gdy zmienisz czas trwania zadania, rozkład się z nim rozciąga.** Kształt zostaje ten sam. Dla typu *Stały czas trwania i jednostki* oraz dla typu *Stałe jednostki* suma rośnie proporcjonalnie do czasu trwania: jeśli czas trwania zadania z własnym rozkładem podwoi się z 4 do 8 dni roboczych, suma też się podwaja, z 32 do 64 godzin. Dla typu *Stały czas trwania i praca* oraz dla typu *Stała praca* suma zostaje taka sama (32 godziny pozostają 32 godzinami), a jednostki spadają.

**Praca zależy od rozkładu.** *Praca (g)* staje się sumą Twoich faz, także dla typu *Stała praca*. Czas trwania zadania przez to się nie zmienia.

**Niepoprawne jednostki.** Pusty lub ujemny nakład dostaje czerwoną ramkę, a *Zastosuj* jest wtedy wyłączone. Faza z nakładem 0 jest dozwolona. Taka faza zostaje w czasie trwania zadania.

**Wszystko dotyczy tylko tego jednego przydziału.** Aplikacja sama to mówi: *Rozkład zmienia tylko godziny na dzień tego przydziału; daty zadania i podziały pozostają bez zmian.* Inne zasoby przy tym samym zadaniu zachowują swój własny rozkład.

**Bilansowanie uwzględnia rozkład.** Bilansowanie liczy te same godziny na dzień co histogram.

**Cofanie.** Każde z poleceń *Zastosuj* i *Zwolnij rozkład* to jeden krok, który można cofnąć poleceniem *Cofnij* (Ctrl+Z).

## Zobacz też

- [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen): zasób przypisujesz do zadania i wybierasz krzywą.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić, gdy zasób ma w jednym dniu zbyt wiele do zrobienia.
