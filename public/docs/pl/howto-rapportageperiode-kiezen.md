# Wybór okresu raportu

Cel: wybierz, jaki przedział czasu obejmuje raport, na przykład najbliższe cztery tygodnie albo cały czerwiec.

## Kiedy tego potrzebujesz

Cotygodniowe spotkanie chce wiedzieć, co wydarzy się w najbliższych czterech tygodniach. Raport miesięczny obejmuje czerwiec. Bez okresu dostajesz na papierze cały harmonogram. Pięć raportów ma zatem ustawienie *Okres raportu:*: *Prognoza (look-ahead)*, *Raport postępu*, *Obciążenie zasobów*, *Przydziały zasobów* i *Diagram zasobów*. Pozostałe raporty nie mają okresu.

Okres nie jest związany z miesiącem kalendarzowym, lecz z **dniem referencyjnym**: datą statusu projektu (dniem, w którym mierzysz postęp, zob. [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang)), a gdy projekt nie ma daty statusu, to dzisiaj. *Następne 4 tygodnie* liczone są od tego dnia. Jeśli przesuniesz datę statusu, okres przesunie się razem z nią.

## Kroki

### 1. Ustawianie daty statusu

Jeśli pracujesz z wyborem względnym, na przykład *Następne 4 tygodnie* albo *Ostatni miesiąc*, ustaw najpierw datę statusu. Wybierz *Planowanie › Plan bazowy i postęp* i wypełnij pole *Data statusu*. Przyciskiem z krzyżykiem obok (*Wyczyść datę statusu*) usuwasz datę ponownie. Jeśli pracujesz ze stałym okresem (krok 4), nie potrzebujesz tego.

### 2. Wybór raportu z okresem

Otwórz zakładkę *Raport* i wybierz jeden z pięciu raportów w polu *Typ raportu*. Lista *Okres raportu:* jest pod *Opcje raportu*. Przy diagramie zasobów jest ona pod *Ustawienia*, pod czterema polami wyboru tego raportu.

Każdy raport pamięta swój własny okres. To są wartości początkowe:

- *Prognoza (look-ahead)*: *Następny miesiąc*.
- *Raport postępu*: *Ostatni miesiąc*.
- *Obciążenie zasobów*, *Przydziały zasobów* i *Diagram zasobów*: *Cały projekt*.

### 3. Wybór okresu z listy

Lista zawiera *Następny tydzień*, *Następne 2 tygodnie*, *Następne 4 tygodnie*, *Następne 6 tygodni*, *Następne 8 tygodni*, *Następne 12 tygodni*, *Następny miesiąc*, oraz te same siedem z przedrostkiem *Ostatnie*, *Cały projekt* i *Niestandardowe*. Pod listą są pola *Od* i *Do* z datami, które wynikają z wybranej opcji. Tutaj możesz je tylko odczytać.

Oba dni się wliczają. Jeśli data statusu to czwartek 20 maja, *Następny tydzień* obejmuje dni od 20 do 26 maja włącznie, a *Następne 4 tygodnie* od 20 maja do 16 czerwca włącznie (28 dni). *Następny miesiąc* trwa do jednego dnia przed tą samą datą w następnym miesiącu, tutaj do 19 czerwca włącznie. *Ostatnie 2 tygodnie* obejmują dni od 7 do 20 maja włącznie.

*Cały projekt* obejmuje harmonogram od pierwszego rozpoczęcia do ostatniego zakończenia.

### 4. Lub wybór opcji Niestandardowe

Przy opcji *Niestandardowe* pola *Od* i *Do* stają się dwoma polami dat. Na początku pokazują daty opcji, którą wybrałeś przed chwilą. Wpisz obie, na przykład 1 i 14 czerwca. Jeśli wpis jest błędny, raport zostaje przy ostatnim poprawnym okresie i wyświetla czerwony komunikat:

- *Data końcowa jest wcześniejsza niż data początkowa.* gdy *Do* jest wcześniej niż *Od*.
- *Wpisz obie daty.* gdy jedna z dwóch jest pusta.

### 5. Odczytanie okresu w raporcie

W raportach *Prognoza (look-ahead)*, *Obciążenie zasobów* i *Przydziały zasobów* okres znajduje się pod tytułem, na przykład *Okres: 20-05-2027 – 19-06-2027*. Jeśli wybierzesz *Cały projekt*, za datami pojawia się *Cały projekt*. Raport postępu pokazuje okres w podsumowaniu w polu *Okres*. Oś czasu diagramu zasobów przebiega dokładnie przez okres.

### Co okres robi w każdym raporcie

Okres nie działa w każdym raporcie tak samo.

- **Prognoza (look-ahead)** uwzględnia niezakończone zadania, które choć częściowo przypadają na okres, także gdy obejmują cały okres. Zaległe zadania sprzed dnia referencyjnego są również wliczane, o ile koniec okresu nie wypada przed dniem referencyjnym. Okres niestandardowy całkowicie w przeszłości jest spojrzeniem wstecz: pokazuje tylko to, co wtedy trwało i jeszcze się nie zakończyło, bez dzisiejszych zaległości.
- **Raport postępu** używa okresu dla *Ukończone w minionym okresie*. Sekcja *Rozpoczynające się w następnym okresie* patrzy w przyszłość od daty statusu, do daty w polu *Wybiegając do* w podsumowaniu. Jeśli wybierzesz okres typu *Ostatnie* lub *Ostatni*, raport patrzy w przyszłość tak samo daleko, jak wstecz: przy opcji *Ostatnie 2 tygodnie* i dacie statusu 20 maja pokazuje *Wybiegając do* 3 czerwca. Okres niestandardowy albo *Cały projekt*, który leży w całości w przeszłości, nie jest odzwierciedlany.
- **Obciążenie zasobów** pokazuje w całości każdy tydzień lub miesiąc, który choć częściowo przypada na okres. Jeśli okres biegnie od środy do środy, widzisz więc całe tygodnie, dlatego wiersz zawsze pokazuje tę samą liczbę co histogram.
- **Przydziały zasobów** pokazują przydziały zadań, które choć częściowo przypadają na okres. Przy opcji *Cały projekt* nie ma filtrowania po dacie.
- **Diagram zasobów** pokazuje tylko zadania, które choć częściowo przypadają na okres. W podsumowaniu pole *Poza okresem:* liczy, ile zadań zostało pominiętych.

## Pułapki i co robi aplikacja

**Nie ma daty statusu.** Aplikacja używa wtedy dzisiejszego dnia. Dla czterech raportów tabelarycznych z okresem (*Prognoza (look-ahead)*, *Raport postępu*, *Obciążenie zasobów* i *Przydziały zasobów*) pojawia się na górze, przy okresie względnym, komunikat *Nie ustawiono daty statusu — raport używa dnia dzisiejszego (29-09-2026).*, z Twoją dzisiejszą datą. Diagram zasobów tego nie zgłasza. Dlatego zajrzyj do *Od* i *Do*: wtedy są ustawione wokół dzisiaj, a nie wokół harmonogramu.

**Okres leży poza harmonogramem.** Wtedy raport jest pusty. Diagram zasobów mówi to komunikatem *Brak zadań w okresie raportu — wybierz inny okres lub Cały projekt.* (na liście ten wybór nazywa się *Cały projekt*). W pozostałych raportach widzisz zero zadań albo brak wierszy.

**Daty mają Twój format zapisu.** *Od* i *Do* podążają za formatem daty z Twoich ustawień, z wyjątkiem pól dat przy *Niestandardowe*: te pokazują zapis z Twojej przeglądarki.

**Okres przesuwa się dalej.** Wybór względny, taki jak *Następny miesiąc*, jest ustalany na nowo za każdym razem: gdy zmieni się data statusu, albo bez daty statusu, gdy jest już dzień później, okres od razu się przesuwa. Jeśli chcesz stały okres, wybierz *Niestandardowe*.

**Wybór dotyczy wszystkich Twoich projektów.** Okres niestandardowy dotyczy też wszystkich Twoich projektów na tym urządzeniu, nie tylko otwartego projektu.

## Zobacz także

- [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken): cała droga od typu raportu do PDF.
- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): czym jest data statusu i dlaczego aplikacja oblicza na jej podstawie.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić z przeciążonymi tygodniami, które pokazuje Obciążenie zasobów.
- [Typy raportów](docs://ref-rapporttypes): wszystkie typy raportów i ich opcje.
