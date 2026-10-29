# Rozwiązywanie przeciążenia

Cel: zobaczyć, w którym dniu zasób ma za dużo do zrobienia, i to rozwiązać, zwykle przez bilansowanie zadań.

## Kiedy tego potrzebujesz

Na papierze harmonogram działa, ale murarz pracuje przy dwóch ścianach, które trwają w tych samych dniach. Aplikacja nazywa to **przeciążeniem**. Zasób jest przeciążony w dniu roboczym, jeśli harmonogram wymaga od niego tego dnia więcej, niż wynosi jego zdolność (*Maks. jednostki*), albo jeśli tego dnia według swojego kalendarza nie pracuje.

Najpierw sprawdzasz przeciążenie. Potem wybierasz rozwiązanie. **Bilansowanie** to rozwiązanie, które aplikacja oblicza za Ciebie: sprawia, że zadania zaczynają się później, aż zasób da radę. Jak to się oblicza, przeczytasz w [Bilansowanie zasobów](docs://uitleg-nivelleren).

## Kroki

### 1. Znajdź przeciążenie

1. Spójrz na wstążkę, na kartę *Zasoby › Nadmierne przydzielenie*. Pokazuje *Brak* albo, czerwonym kolorem, liczbę przeciążonych zasobów, na przykład *1 zasób*. Po obliczeniu pasek stanu pokazuje też *⚠ Przeciążone zasoby: 1*.
2. Kliknij ten komunikat na pasku stanu. Panel *Ostrzeżenia* otwiera się po prawej, z wierszem dla każdego zasobu, na przykład *Bricklayer* z komunikatem *Przeciążenie przez 5 dni (29-06-2027 – 05-07-2027)*.
3. Kliknij ten wiersz. Aplikacja włącza histogram, wybiera zasób i zaznacza wszystkie zadania, na których zasób pracuje.
4. Spójrz na histogram pod wykresem Gantt. Czerwone słupki to dni z przeciążeniem. Jeśli najedziesz myszą na dzień, zobaczysz, które zadania mają w nim udział, na przykład *2 zadania mają udział w dniu 2027-06-30* z nazwami pod spodem.

Histogram możesz też włączyć samodzielnie: *Zasoby › Histogram › Histogram*. Wybierz zasób na liście po lewej stronie albo przechodź po zasobach przyciskami *Wstecz* i *Dalej*. Czerwona kropka na liście oznacza, że zasób jest przeciążony. Wiersz *Wszystkie zasoby* sumuje zasoby razem, bez materiałów.

Jeśli zadanie jest zaznaczone, histogram pokazuje tylko obciążenie tego zadania i tylko zasoby, które są na nim przydzielone. Naciśnij Esc, aby usunąć zaznaczenie i znowu zobaczyć cały projekt.

### 2. Wybierz rozwiązanie

- **Większa zdolność.** Jeśli naprawdę przyjdzie drugi murarz, ustaw *Maks. jednostki* na 2 (zobacz [Zarządzanie zasobami](docs://howto-resources-beheren)). Przeciążenie wtedy znika.
- **Mniej jednostek dziennie.** Obniż *Jednostki* albo wybierz inną krzywą dla przydziału (zobacz [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen)).
- **Ustaw zadania jedno po drugim.** Dodaj relację między dwoma zadaniami, tak aby drugie zaczynało się dopiero po zakończeniu pierwszego (zobacz [Dodawanie relacji](docs://howto-relaties-leggen)).
- **Bilansowanie.** Aplikacja sprawia, że zadanie zaczyna się później.

### 3. Bilansowanie

1. Upewnij się, że harmonogram jest obliczony przyciskiem **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*.
2. Wybierz *Zasoby › Bilansowanie › Bilansuj…*. Otwiera się okno *Bilansuj zasoby*.
3. Zdecyduj, czy data zakończenia projektu może się zmienić. Jeśli pozostawisz pole wyboru *Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian* wyłączone, data zakończenia może się przesunąć. Jeśli je włączysz, aplikacja przesuwa zadania tylko w ramach ich zapasu.
4. Pod nagłówkiem *Zasoby* znajdują się zasoby, które zostaną zbilansowane. Domyślnie zaznaczone są wszystkie zasoby, oprócz materiałów. Odznacz zasób, który chcesz zostawić bez zmian.
5. Kliknij *Oblicz*. Podczas obliczania okno pokazuje *Trwa obliczanie…* i możesz zatrzymać je przyciskiem *Zatrzymaj*. Harmonogram jeszcze się nie zmienia: to jest propozycja.
6. Przeczytaj propozycję. Na górze jest data zakończenia, na przykład *Data zakończenia projektu: bez zmian (30-08-2027)* albo *Data zakończenia projektu: 25-08-2027 → 30-08-2027*. Pod nią jest tabela. Dla każdego zadania pokazuje *Poprzedni start*, *Nowy start* i *Dni przesunięcia*, na przykład *Build outer cavity leaf*, 29-06-2027, 06-07-2027 i *5 d*.
7. Wybierz *Zastosuj*. Aplikacja zapisuje przesunięcia w zadaniach i od razu przelicza harmonogram. Naciskanie F5 nie jest potrzebne. *Anuluj* zamyka okno bez zmian.
8. Sprawdź *Zasoby › Nadmierne przydzielenie*. Pokazuje teraz *Brak*.

Jeśli zmienisz opcję w oknie po kliknięciu *Oblicz*, propozycja znika. Kliknij wtedy ponownie *Oblicz*. Jeśli harmonogram zmieni się, gdy aplikacja oblicza, pokazuje *Harmonogram zmienił się podczas obliczania. Kliknij ponownie Oblicz.*

### Decydowanie, które zadanie zostaje na miejscu

Aplikacja układa zadania jedno po drugim, a zadania, które są wcześniej, zostają tam, gdzie są. Zadania z najwyższym priorytetem idą pierwsze. Przy równym priorytecie pierwsze idzie zadanie z najmniejszym zapasem.

Jeśli chcesz sam zdecydować, które zadanie zostaje, nadaj mu wyższy priorytet. Kliknij prawym przyciskiem myszy pasek zadania w wykresie Gantt i wybierz *Priorytet*, potem *Niski* (100), *Normalny* (500) albo *Wysoki* (900). *Normalny* jest domyślny. Możesz też samodzielnie wpisać liczbę od 0 do 1000 w kolumnie *Priorytet bilansowania*: kliknij **+** z prawej strony nagłówka tabeli zadań (*Dodaj kolumnę*) i wybierz tę kolumnę w grupie *Planowanie*. Wyższa liczba oznacza, że zadanie chętniej zostaje na miejscu. Aplikacja nie przyjmuje liczby powyżej 1000. Zadanie z priorytetem 1000 nigdy nie przesuwa się ze względu na zdolność zasobu.

### Cofanie i ponawianie

- *Cofnij* (Ctrl+Z) cofa *Zastosuj* jednym krokiem.
- *Zasoby › Bilansowanie › Wyczyść bilansowanie* usuwa całe bilansowanie z zadań. Przycisk jest szary, dopóki nie ma bilansowania. Przeciążenie, które w ten sposób wraca, po prostu pojawia się ponownie.
- Jeśli od tego czasu harmonogram się zmienił, wybierz po prostu ponownie *Bilansuj…*. Aplikacja wtedy zaczyna od nowa: stare przesunięcia się nie liczą.

## Pułapki i co wtedy robi aplikacja

**Jeszcze nie obliczono.** Jeśli harmonogram nie został obliczony, okno pokazuje *Najpierw przelicz harmonogram (F5), zanim zbilansujesz zasoby.* a przycisk *Oblicz* jest niedostępny.

**Pozostałe konflikty.** Nie każde przeciążenie da się rozwiązać przesunięciem. Konflikty, które pozostają, są wymienione pod *Pozostałe konflikty*, z liczbą dni i powodem:

- *Za mało wolnej zdolności w ramach zapasu, aby rozwiązać ten konflikt.* Widzisz to przy *wygładzaniu*: w zapasie zadania nie ma żadnego wolnego momentu. Odznacz pole wyboru, a data zakończenia może się przesunąć.
- *Zasób nie pracuje we wszystkie dni potrzebne temu zadaniu — przesunięcie tego nie rozwiąże.* Zasób ma dni wolne w swoim kalendarzu w środku zadania. Zmień kalendarz albo zadanie.
- *Bricklayer: szczyt 2 jedn./dzień, zdolność to 1 — nie da się tego rozwiązać przesunięciem.* Przez swoją krzywą samo zadanie wymaga w jednym dniu więcej, niż zasób może dać. Wybierz inną krzywą albo zmniejsz jednostki.

**Okno pokazuje** *Żadne zadania nie wymagają przesunięcia — harmonogram jest już wolny od konfliktów.* Jeśli ta linia pojawia się razem z listą *Pozostałe konflikty* w propozycji, zaufaj liście. Ta linia mówi tylko, że nic nie trzeba przesunąć. Jeśli ta linia pojawia się bez listy, a *Zasoby › Nadmierne przydzielenie* nadal pokazuje zasób, to wszystkie kolidujące zadania mają priorytet 1000 albo już się rozpoczęły. Nie przesuwają się i okno nie pokazuje ich jako konfliktu. Dlatego po zastosowaniu zawsze sprawdź *Nadmierne przydzielenie*.

**Zadania, które się nie przesuwają.** Zadanie, które już się rozpoczęło albo jest zakończone, nigdy się nie przesuwa. Jego obciążenie się jednak liczy. Kamienie milowe i fazy też się nie przesuwają.

**Materiał nie jest bilansowany.** Jeśli zasób materiałowy wymaga na dzień więcej niż jego *Maks. jednostki*, liczy się jako przeciążony w *Nadmierne przydzielenie*, ale nie ma go w oknie bilansowania.

**Bilansowanie się nie dostosowuje.** Przesunięcia zostają takie, jak zostały obliczone. Jeśli później zmienisz czas trwania zadania, zbilansowane zadanie zostaje tam, gdzie jest, nawet jeśli to miejsce nie jest już potrzebne. Wtedy zbilansuj ponownie.

**Przeciążenie przez kalendarz.** Jeśli zasób według swojego kalendarza nie pracuje danego dnia, panel Ostrzeżenia pokazuje na przykład *Przeciążenie przez 5 dni (29-06-2027 – 05-07-2027), z czego 1 dni to dni, w które zasób nie pracuje według swojego kalendarza*. Jeśli zadanie zawsze przechodzi przez taki dzień, co jest drugim powodem powyżej, bilansowanie tego nie rozwiąże.

## Zobacz także

- [Bilansowanie zasobów](docs://uitleg-nivelleren): co bilansowanie przesuwa, w ramach zapasu i poza nim, oraz czego nie robi.
- [Zarządzanie zasobami](docs://howto-resources-beheren): zmiana zdolności i kalendarza zasobu.
- [Dodawanie relacji](docs://howto-relaties-leggen): ustawianie zadań jedno po drugim.
- [Komunikaty i ostrzeżenia](docs://ref-meldingen): ostrzeżenie o przeciążeniu w panelu Ostrzeżenia.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): zasób plasterers jest przeciążony przez 5 dni. Jeśli *Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian* jest włączone, data zakończenia pozostaje na 17 sierpnia 2027 i zostaje jeden konflikt. Gdy pole wyboru jest wyłączone (domyślnie), wszystko jest rozwiązane, a zakończenie przesuwa się na 24 sierpnia 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tower crane jest przeciążony przez 65 dni, a plasterers przez 15 dni. Bilansowanie przy wyłączonym polu wyboru *Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian* przesuwa zakończenie z 9 maja na 12 października 2028.
