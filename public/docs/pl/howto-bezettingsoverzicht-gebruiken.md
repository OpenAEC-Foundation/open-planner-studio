# Korzystanie z przeglądu obłożenia

Cel: zobacz, w które dni dwa lub więcej otwartych projektów razem potrzebuje więcej danego zasobu, niż ma biblioteka zasobów.

## Kiedy tego potrzebujesz

Twoja ekipa murarzy pracuje w jednym projekcie przy elewacjach, a w innym przy garażach. W każdym projekcie ekipa jest dobrze rozplanowana, bo histogram i przeciążenie danego projektu patrzą tylko na ten jeden projekt. Dopiero gdy zestawisz projekty obok siebie, widać, że w tych samych dniach razem potrzebują więcej murarzy, niż masz. Przegląd obłożenia robi to zestawienie za Ciebie.

Przegląd liczy tylko zasoby z biblioteki zasobów, w projektach połączonych z tą samą biblioteką. Jak to jest liczone, przeczytasz w [Biblioteka zasobów](docs://uitleg-resourcebibliotheek).

## Kroki

### 1. Przygotowanie projektów

1. Otwórz projekty, które chcesz porównać, każdy w osobnej karcie. Zobacz [Praca z kilkoma projektami naraz](docs://howto-meerdere-projecten). Przegląd widzi tylko projekty otwarte w tej aplikacji.
2. Połącz każdy projekt z tą samą biblioteką i użyj zasobu z biblioteki w każdym projekcie. Bez połączenia z biblioteką panel zasobów nie pokazuje przeglądu. Zobacz [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken).
3. Oblicz projekty poleceniem *Oblicz* (F5) albo włącz *Oblicz automatycznie*. Co przegląd robi z nieaktualnymi projektami, opisano niżej, przy pułapkach.

### 2. Otwieranie przeglądu

1. Przejdź do jednego z projektów i wybierz *Zasoby › Zarządzaj › Zasoby*.
2. Wybierz w prawym górnym rogu *Obłożenie*. Przegląd należy do biblioteki projektu, w którym jesteś. Nie możesz nic zmienić w tym panelu: to okno tylko do odczytu.

### 3. Czytanie tabeli

Każdy zasób z biblioteki, który jest zarezerwowany w przynajmniej jednym otwartym projekcie, dostaje wiersz. Zasoby bez rezerwacji nie są wymienione. Wiersze z największą liczbą dni przeciążenia są na górze, potem alfabetycznie.

- *Dokumenty* pokazuje, w ilu projektach zasób jest zarezerwowany, na przykład *2 dokumenty*.
- *Okres* obejmuje dni od pierwszego do ostatniego dnia z obciążeniem, zapisany jako rrrr-mm-dd, na przykład *2027-06-07 – 2027-06-14*.
- *Szczyt / Zdolność* zestawia najwyższe dzienne obciążenie wszystkich projektów razem ze zdolnością zasobu w bibliotece, na przykład *4.0 / 3.0*. Jeśli jest co najmniej jeden dzień przeciążenia, wartość w kolumnie *Szczyt / Zdolność* pokazuje się na czerwono.
- Czerwony znacznik za wierszem, na przykład *3 dni podwójnie zarezerwowane*, liczy dni, w których suma jest większa od zdolności. Jeśli najedziesz na niego myszą, zobaczysz daty.

### 4. Zaglądanie do każdego projektu

1. Kliknij małą strzałkę przed nazwą zasobu. Wiersz się rozwinie.
2. Na górze są daty z przeciążeniem: pierwsze pięć, a potem *… i 3 więcej*, jeśli jest ich więcej. Pod tym jest, dla każdego projektu, jego nazwa z okresem i szczytem tego jednego projektu, na przykład *Houses North 2027-06-07 – 2027-06-11 Szczyt: 2.0*.
3. Kliknij sam wiersz, aby zobaczyć histogram na dole. Każdy projekt ma swój kolor, a słupki są ułożone jeden na drugim. Przerywana linia to zdolność biblioteki. Jeśli się zmienia w czasie, widzisz schodki. Dni z przeciążeniem dostają czerwone tło za słupkami. Kliknij wiersz jeszcze raz, aby zamknąć histogram. Jeśli nie wybrano wiersza, pojawia się napis *Wybierz zasób, aby zobaczyć histogram.*

### 5. Rozwiązywanie problemu

Przegląd pokazuje problem, ale go nie rozwiązuje. Masz dwie możliwości:

- Przesuń zadanie w jednym z projektów albo przydziel mu mniej jednostek dziennie. Potem przelicz ten projekt: naciśnij F5.
- Jeśli ktoś naprawdę dołącza do pracy, zwiększ *Maks. jednostki* zasobu w bibliotece. Robisz to w *Zasoby › Zarządzaj › Zasoby*, w widoku *Biblioteka*.

*Bilansuj…* na wstążce tu nie pomaga: patrzy na zasoby tylko jednego projektu, w którym jesteś. Zobacz [Bilansowanie zasobów](docs://uitleg-nivelleren).

## Pułapki i co wtedy robi aplikacja

**Przegląd jest pusty.** Pokazuje napis *Brak zasobów z biblioteki zarezerwowanych w otwartych dokumentach.* Wtedy żaden otwarty projekt nie ma zasobu z biblioteki przypisanego do zadania.

**Nie widzisz przycisku *Obłożenie*.** Projekt, w którym jesteś, nie jest połączony z biblioteką.

**Projekt się nie liczy.** Nie jest otwarty w tej aplikacji, jest połączony z inną biblioteką albo zasób w nim jest zasobem własnym tego projektu. Na dole przeglądu zawsze widnieje napis *Ten przegląd widzi tylko dokumenty otwarte w tej aplikacji.* Kopia zasobu, który później usunięto z biblioteki zasobów, też się nie liczy.

**Kopia lub wariant liczy się w pełni.** Liczy się każdy otwarty projekt połączony z biblioteką, także jeśli jest kopią lub wariantem innego otwartego projektu, na przykład wariantem, który asystent AI utworzył za pomocą `planner_duplicate_document`. Oryginał i wariant razem mogą wtedy pokazać przeciążenie, które w rzeczywistości istnieje tylko raz. Przegląd tego nie filtruje po cichu: zamknij na chwilę wariant albo czytaj wynik z tym na uwadze.

**Projekt jest nieaktualny.** Projekt jest nieaktualny, jeśli zmienisz coś w harmonogramie bez przeliczenia. Przegląd obsługuje wtedy ten projekt tak:

- Dla projektu, który nie jest aktywną kartą, przegląd sam oblicza z wyprzedzeniem, bez zmiany projektu. Nad tabelą pojawia się wtedy: *Zmienione dokumenty zostały obliczone z wyprzedzeniem na potrzeby tego przeglądu; naciśnij F5 w dokumencie, albo włącz „Oblicz automatycznie”, aby robić to na stałe.* Za projektem pojawia się: *Obliczone z wyprzedzeniem na potrzeby tego przeglądu — sam dokument nadal pokazuje starsze daty, dopóki nie naciśniesz tam F5 lub nie włączysz „Oblicz automatycznie”.* Jeśli *Oblicz automatycznie* jest włączone (*Ustawienia › Projekt › Ustawienia aplikacji*, karta *Planowanie*), aplikacja naprawdę przelicza takie projekty, gdy tylko otworzysz przegląd, a komunikat znika. Jeśli aktywny projekt też jest nieaktualny, nad tabelą pojawia się zamiast tego komunikat z następnego punktu.
- Przegląd nie oblicza samego projektu, w którym jesteś. Jeśli ten projekt jest nieaktualny, pokazuje się: *Zmieniony dokument nie został jeszcze przeliczony; jest tu uwzględniony z ostatnio obliczonymi wartościami. Naciśnij F5 w tym dokumencie albo włącz „Oblicz automatycznie”.* Za projektem: *Nieaktualne: to ostatnio obliczone wartości — naciśnij F5 w tym dokumencie.* Uwaga: *ostatnio obliczone wartości* nie jest całkiem trafne. Przegląd bierze stare daty startu, ale już zmieniony czas trwania lub przydział. Wartości mogą się dlatego różnić zarówno od starego, jak od nowego harmonogramu, i od pasków w Gantt. Ufaj im dopiero po naciśnięciu F5.
- Jeśli przegląd nie może obliczyć projektu, na przykład przez pętlę w jego relacjach, ten projekt się nie liczy. Nadal jest na liście, z napisem *Nie liczy się: harmonogram nieprzeliczony — aktywuj ten dokument i naciśnij F5.* Nad tabelą pojawia się *Co najmniej jeden dokument nie został przeliczony i nie jest uwzględniony w obłożeniu.*

**Przegląd nie zgadza się z tym, czego oczekujesz.** Zdolność pochodzi z biblioteki (*Maks. jednostki* pozycji w bibliotece albo jej *Zdolność rozłożona w czasie* tego dnia), a nie z *Maks. jednostki* kopii w projekcie. Suma równa zdolności nie jest konfliktem.

## Zobacz także

- [Biblioteka zasobów](docs://uitleg-resourcebibliotheek): jak liczone jest obłożenie, z rozpisanym przykładem.
- [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken): łączenie projektów i przypisywanie zasobów.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): przeciążenie w obrębie jednego projektu.
