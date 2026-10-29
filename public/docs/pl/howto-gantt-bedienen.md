# Przeciąganie, przesuwanie i powiększanie w wykresie Gantt

Cel: obsługiwać oś czasu myszą: przesunąć pasek lub zmienić jego czas trwania, przesunąć oś czasu, zaznaczać zadania ramką i powiększać oraz pomniejszać.

## Kiedy tego potrzebujesz

W wykresie Gantt widzisz, że murowanie musi zacząć się dwa dni później, albo że wylewanie trwa o dzień dłużej, i chcesz to zmienić bezpośrednio na pasku. Albo masz projekt na miesiące i chcesz szybko przewinąć do święta budowlanego w kalendarzu. Mysz ma do tego kilka gestów. Który gest co robi, zależy od miejsca, w którym zaczynasz przeciągać, i od ustawienia przewijania.

## Kroki

### Przesuwanie paska

1. Naciśnij środek paska zadania i przeciągnij poziomo. Początek i zakończenie przesuwają się razem, w całych dniach. Czas trwania się nie zmienia.
2. Puść przycisk. Pasek zostaje na nowym miejscu. Harmonogram jest wtedy nieaktualny: naciśnij *Oblicz* (F5) albo pozwól, aby aplikacja zrobiła to sama, jeśli opcja *Oblicz automatycznie* jest włączona.

Jeśli zadanie ma poprzednika, aplikacja zapisuje nowy początek jako ograniczenie *Rozpocznij nie wcześniej niż (SNET)* i informuje o tym po puszczeniu. Dlaczego tak jest i co się dzieje przy innym ograniczeniu, znajdziesz w [Ograniczenia i terminy ostateczne](docs://uitleg-constraints). Jeśli przeciągniesz z powrotem na pierwotny początek, wraca także pierwotne ograniczenie.

Jeśli przeciągasz głównie w górę lub w dół zamiast w bok, przesuwasz zadanie do innego wiersza, a daty zostają. Kierunek, który wybierzesz w pierwszych kilku pikselach, obowiązuje dla całego przeciągania. Dzięki temu jeden gest nigdy nie zmienia jednocześnie dat i struktury. Zobacz [Dostosowywanie struktury](docs://howto-structuur-aanpassen).

### Zmienianie czasu trwania

1. Przesuń mysz na prawą krawędź paska. Kursor zmienia się w strzałkę wskazującą w lewo i w prawo.
2. Przeciągnij krawędź. Podczas przeciągania mały znacznik w kolorze akcentu motywu (domyślnie pomarańczowym) pokazuje czas trwania, jaki zadanie dostanie teraz, na przykład *4d*. Znacznik aktualizuje się na bieżąco, więc nowy czas trwania widzisz przed puszczeniem. Przy prawej krawędzi znacznik leży wewnątrz paska, przy lewej krawędzi tuż na lewo od niego. Znacznik pokazuje czas trwania tak, jak pokazuje go kolumna czasu trwania.
3. Puść przycisk. Czas trwania jest taki, jaki pokazał znacznik.

Lewa krawędź przesuwa początek i zostawia zakończenie, więc zadanie skraca się lub wydłuża od początku. Ta sama reguła SNET obowiązuje jak przy przesuwaniu. Gdy przeciągasz środek paska, znacznik się nie pojawia: czas trwania się nie zmienia.

Czas trwania liczy dni robocze z kalendarza zadania. Weekendy i dni wolne się nie liczą. Zadanie w dniach nie może być krótsze niż jeden dzień roboczy. Dla zadania w godzinach aplikacja zaokrągla do kroku osi czasu pod myszą: co najmniej godzinę, albo ćwierć godziny, jeśli powiększysz wystarczająco i włączona jest opcja *Pokazuj ćwierćgodziny przy dużym powiększeniu*.

Jedno przeciągnięcie to jeden krok w *Cofnij*, niezależnie od długości przeciągania. Na podzielonym pasku krawędzie działają inaczej. Zobacz [Dzielenie zadania](docs://howto-taak-splitsen).

### Przesuwanie osi czasu

Co robi przeciągnięcie po pustym tle, zależy od trybu przewijania. Wybierasz go w oknie *Ustawienia aplikacji*, na karcie *Wygląd*, w sekcji *Gantt › Przewijanie i powiększenie*, w polu *Tryb*:

- **Zoom + przeciąganie** (domyślny): jeśli przeciągasz po pustym tle lewym przyciskiem myszy, oś czasu porusza się razem z myszą, jak mapa. Kursor to dłoń. Na pasku przeciąganie po prostu zaczyna gest paska.
- **Pozycja** i **Klawisze**: to samo przeciąganie tworzy ramkę zaznaczenia. Oś czasu przesuwasz kółkiem myszy (zobacz [Ustawienia aplikacji](docs://ref-instellingen)) albo środkowym przyciskiem myszy.

**Środkowy przycisk myszy** (wciśnięte kółko) przesuwa oś czasu we wszystkich trybach, także gdy zaczynasz na pasku. Nie działa, gdy trwa inny gest, na przykład przeciąganie paska.

### Zaznaczanie zadań ramką

Ramka zaznacza wszystkie zadania w wierszach, których dotyka. Liczy się tylko wysokość ramki, nie skala czasu.

1. Zacznij na pustym tle. W trybie *Zoom + przeciąganie* przytrzymaj Ctrl (⌘ na Macu) podczas tego. W trybie *Pozycja* i *Klawisze* nie trzeba tego robić.
2. Przeciągnij po wierszach, które chcesz zaznaczyć. Zaznaczenie dostaje ramkę.
3. Puść przycisk. Klawisz Esc podczas przeciągania anuluje ramkę, a zaznaczenie zostaje takie, jakie było.

Więcej o zaznaczaniu znajdziesz w [Zaznaczanie, usuwanie i cofanie zadań](docs://howto-taken-selecteren-verwijderen). Na pustej przestrzeni w samej tabeli zadań przeciąganie nic nie robi.

### Powiększanie i pomniejszanie

1. Użyj *Zoom +* i *Zoom -* (*Start › Powiększenie*) albo klawisze + i -. Kółko myszy też powiększa. To, kiedy kółko powiększa, zależy od trybu przewijania (zobacz [Ustawienia aplikacji](docs://ref-instellingen)).
2. Jeśli chcesz, aby cały projekt był widoczny, wybierz *Widok › Skala czasu › Dopasuj do projektu* albo naciśnij Ctrl+0. *Resetuj* (na karcie *Widok*) albo klawisz 0 ustawia powiększenie z powrotem na domyślne.
3. W prawym dolnym rogu paska stanu jest powiększenie w pikselach na dzień, na przykład *Zoom: 15px/dzień*.

Im dalej pomniejszasz, tym mniej linii siatki jest widocznych. Przy 8 pikselach na dzień lub więcej jest linia dla każdego dnia, z grubszą linią na granicy tygodnia. Między 2 a 8 pikselami na dzień zostaje tylko granica tygodnia. Poniżej 2 pikseli na dzień, na poziomie roku, zostają tylko granice miesięcy. Inaczej płótno zamieniłoby się w równomierny wzór pasków, w którym paski zadań znikają. Szare weekendy i dni wolne oraz naprzemiennie zabarwione pasy tygodni zostają na każdym poziomie. Niosą strukturę tygodnia, gdy linie znikają. W nagłówku osi czasu numery tygodni i dni pojawiają się tylko wtedy, gdy jest na nie miejsce. Od 40 pikseli na dzień przed numerem dnia pokazywany jest także dzień tygodnia.

Nazwa zadania jest pokazana w pasku, jeśli się w nim zmieści w całości. Jeśli się nie mieści, na przykład gdy pomniejszasz, pełna nazwa pojawia się po prawej stronie paska.

### Sprawdzanie szczegółów zadania

Przytrzymaj mysz nieruchomo na pasku. Pojawi się mała karta z nazwą zadania, *WBS*, *Czas trwania*, *Początek*, *Koniec*, *Stan*, *Krytyczne* i *Zapas całkowity*. Podczas przeciągania, przesuwania widoku, ramki zaznaczenia lub menu kontekstowego karta znika.

## Pułapki i co robi wtedy aplikacja

**Początek się nie przesuwa.** Jeśli zadanie ma poprzednika i ograniczenie inne niż SNET, na przykład *Jak najpóźniej (ALAP)*, aplikacja nie stosuje przeciągniętego początku. Po puszczeniu aplikacja mówi, które ograniczenie blokuje początek. Zmień to ograniczenie, aby przesunąć początek. Prawa krawędź działa, bo zmienia tylko czas trwania.

**Gest robi coś innego.** W trybie relacji i w trybie podziału gesty paska działają inaczej; klawisz Esc kończy te tryby. Jeśli przytrzymasz Shift podczas przeciągania z paska, tworzysz relację zamiast przesuwać pasek. Zobacz [Dodawanie relacji](docs://howto-relaties-leggen).

**W trybie *Pozycja* lub *Klawisze* lewy przycisk myszy nie przesuwa widoku.** Wtedy widzisz zwykły kursor zamiast dłoni. Użyj kółka albo środkowego przycisku myszy albo ustaw tryb na *Zoom + przeciąganie*.

**Kliknięcie w przerwę podzielonego paska** zaznacza zadanie i nie zaczyna przeciągania ani ramki.

## Zobacz także

- [Menu kontekstowe](docs://ref-contextmenus): menu paska, wiersza i nagłówka grupy.
- [Skróty klawiszowe](docs://ref-sneltoetsen): klawisze do powiększania i do anulowania gestu.
- [Ustawienia aplikacji](docs://ref-instellingen): tryb przewijania i skala czasu.
- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): dlaczego przesunięty początek staje się ograniczeniem.
