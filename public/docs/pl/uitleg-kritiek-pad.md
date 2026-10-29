# Ścieżka krytyczna i zapas

Dlaczego data zakończenia projektu jest taka, a nie inna? Które zadanie może spóźnić się o dzień, nie przesuwając przekazania? Te pytania leżą u podstaw ścieżki krytycznej. Ten artykuł dokładnie wyjaśnia, co aplikacja oblicza, na przykładzie.

## Koncepcja

Harmonogram to sieć zadań. Zadania łączą **relacje**: umowy, na przykład „ramy okienne można montować dopiero po zamknięciu dachu”. Te relacje wiążą zadania ze sobą. Niektóre łańcuchy zadań są dłuższe od innych. Najdłuższy łańcuch decyduje, ile trwa cały projekt.

Ten najdłuższy łańcuch to **ścieżka krytyczna**. Jeśli jedno zadanie na niej opóźni się o dzień, przekazanie przesunie się o dzień. Na niej nie ma zapasu czasu.

Zadania poza ścieżką krytyczną mają **zapas**. Murarz, który wykonuje Build outer cavity leaf, mógłby zacząć dwa dni później, a nikt by tego nie zauważył. Te dwa dni to zapas tego zadania.

Słowo krytyczny nic nie mówi o tym, jak ważne jest zadanie. Mówi tylko, że na takim zadaniu nie ma zapasu czasu.

Metoda obliczeń nazywa się **CPM** (Critical Path Method). Dlatego blok z wynikami w panelu *Właściwości* nazywa się *Wynik CPM*.

## Jak aplikacja oblicza

Aplikacja sama nie przelicza harmonogramu. Obliczenie zaczynasz poleceniem **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Jeśli coś się zmieniło od ostatniego obliczenia, pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Gdy *Oblicz automatycznie* jest włączone (w *Ustawienia › Projekt › Ustawienia aplikacji*, zakładka *Planowanie*, nagłówek *Obliczanie*), aplikacja robi to sama.

Obliczenie przechodzi przez sieć dwa razy.

### Przebieg w przód

Aplikacja zaczyna od początku projektu i idzie po relacjach od poprzednika do następnika. Dla każdego zadania znajduje najwcześniejszy dzień, w którym może się ono rozpocząć. Jeśli zadanie ma kilku poprzedników, czeka na zakończenie ostatniego z nich. Tak każde zadanie dostaje **najwcześniejsze rozpoczęcie** i **najwcześniejsze zakończenie**. Największe z najwcześniejszych zakończeń wszystkich zadań to koniec projektu.

### Przebieg wstecz

Potem aplikacja wraca od tej daty zakończenia do początku. Dla każdego zadania znajduje ostatni dzień, do którego zadanie musi być zakończone, żeby koniec projektu się nie przesunął. Jeśli zadanie ma kilku następników, liczy się ten, który musi zacząć się jako pierwszy. Tak każde zadanie dostaje **najpóźniejsze rozpoczęcie** i **najpóźniejsze zakończenie**.

### Zapas całkowity i zapas swobodny

Różnica między najpóźniejszymi a najwcześniejszymi datami zadania to **zapas całkowity**. To liczba dni roboczych, o które zadanie może się opóźnić albo później zacząć, zanim koniec projektu się przesunie. Aplikacja liczy dni robocze z kalendarza zadania. Weekend i święto się nie liczą.

**Zapas swobodny** jest ostrzejszy. To czas, o który zadanie może się opóźnić, zanim któryś z jego następników będzie musiał zacząć się później. Tego czasu możesz użyć, a żadne inne zadanie tego nie zauważy.

Zapas całkowity można dzielić z innymi zadaniami. Jeśli dwa niekrytyczne zadania następują po sobie, dzielą ten sam zapas. Jeśli pierwsze go zużyje, drugie nie ma już żadnego. Pierwsze ma wtedy zapas całkowity, ale nie ma zapasu swobodnego. Część zapasu całkowitego, która nie jest swobodna, to **zapas kolidujący**: jeśli go użyjesz, przesuną się też zadania po nim. Przykład poniżej pokazuje to na liczbach.

### Ujemny zapas

Zapas może też stać się ujemny. Dzieje się tak, gdy zadanie ma termin ostateczny albo ograniczenie, które narzuca najpóźniejszą datę, wcześniejszą niż data obliczona przez aplikację. Na papierze zadanie jest już spóźnione. Zadanie i łańcuch przed nim stają się krytyczne.

### Kiedy zadanie jest krytyczne?

Domyślnie zadanie jest krytyczne, gdy jego zapas całkowity wynosi 0 lub mniej. Tę definicję możesz zmienić w *Ustawienia › Projekt › Ustawienia projektu*, w bloku *Profil obliczeń i opcje*, w sekcji *Opcje obliczeń tego projektu*. Gdy klikniesz *Zastosuj*, aplikacja od razu przelicza harmonogram. Opcje należą do pliku projektu, nie do aplikacji.

- **Definicja krytyczności** z *Zapas całkowity ≤ próg* i polem *Próg (dni robocze)*. Próg wynosi domyślnie 0. Aby chronić bufor, ustaw go na 2, na przykład: każde zadanie z zapasem 2 dni robocze lub mniejszym jest wtedy krytyczne i staje się czerwone. Jeśli wybierzesz opcję *Najdłuższa ścieżka*, zadanie jest krytyczne, gdy leży na najdłuższym łańcuchu do ostatniego zakończenia. Jego zapas nie ma wtedy znaczenia.
- **Wiele ścieżek zapasu** numeruje łańcuchy według zapasu w kolumnie *Ścieżka zapasu*. Ścieżka 1 to ścieżka krytyczna. Zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).
- **Oznaczaj jako prawie krytyczne** z własnym polem *Próg*, domyślnie 2 dni robocze. Zadanie z zapasem większym niż 0, ale nie większym niż ten próg, dostaje bursztynowy pasek. Widać wtedy, które zadania prawie nie mają zapasu, bez nazywania ich krytycznymi.
- **Zadania z otwartym końcem krytyczne**: zadanie bez następnika, które nie jest jeszcze skończone, liczy się jako krytyczne. Przydaje się jako siatka bezpieczeństwa przy zapomnianych relacjach (zobacz błędne przekonania poniżej).
- **Sposób obliczania zapasu** określa, czy zapas całkowity mierzy się od początku zadania, od jego końca, czy jako mniejszą z tych dwóch wartości. Nowe projekty mają ustawione *Automatycznie (domyślnie)*. Jeśli projekt używa profilu obliczeń Primavera P6 i wybór nie jest ustawiony na *Zapas końca*, pomarańczowy blok w ustawieniach projektu o tym informuje. Jego przycisk ustawia wybór na *Zapas końca*. Dla MS Project ten sam przycisk ustawia z powrotem *Automatycznie (domyślnie)*: przy dacie statusu liczy MS Project właśnie tak.

### Gdzie to widzisz

Krytyczne zadania mają czerwony pasek w widoku Gantt. Za paskiem niekrytycznego zadania widać zielony pas do najpóźniejszego zakończenia zadania: to jest zapas. Pas włączasz albo wyłączasz w *Widok › Plan bazowy i postęp › Pas zapasu*.

Dla wybranego zadania panel *Właściwości* pokazuje wszystko w bloku *Wynik CPM*: najwcześniejsze i najpóźniejsze rozpoczęcie oraz zakończenie, zapas całkowity, swobodny i kolidujący oraz to, czy zadanie leży na ścieżce krytycznej. Zapas wszystkich zadań obok siebie znajdziesz w kolumnach z grupy *Obliczone* (znak **+** z prawej strony nagłówka tabeli), na przykład *Zapas całkowity*, *Zapas swobodny*, *Krytyczne* i *Prawie krytyczne*.

Pasek stanu na dole liczy krytyczne zadania, na przykład *Ścieżka krytyczna: 21 zadań, 45 dni roboczych*.

## Przykład krok po kroku: House extension

Przykład to ćwiczeniowy projekt *House extension* z samouczków, w stanie, w którym są już wszystkie relacje. W samouczku 2, „Relacje i ścieżka krytyczna”, zbudujesz go sam i sprawdzisz liczby. Tutaj czytasz, dlaczego liczby są takie, jakie są.

Projekt zaczyna się w poniedziałek 7 czerwca 2027. Po obliczeniu przekazanie wypada w piątek 6 sierpnia 2027, a pasek stanu pokazuje *Ścieżka krytyczna: 21 zadań, 45 dni roboczych*. Dwa zadania nie są krytyczne: *Build outer cavity leaf* i *Painting*.

### Dwa łańcuchy, które się spotykają

Po ułożeniu stropu konstrukcyjnego (*Lay hollow-core floor*, zakończonego w poniedziałek 28 czerwca) praca dzieli się na dwa łańcuchy. Oba kończą się przy *Install window frames*:

- Wewnętrzny łańcuch: *Build inner cavity leaf* (5 dni roboczych), potem *Place roof elements* (1), potem *Apply roofing* (2). Ramy okienne można wstawić dopiero po zamknięciu dachu.
- Zewnętrzny łańcuch: *Build outer cavity leaf* (6 dni roboczych). Ramy są osadzone w elewacji, więc ta warstwa też musi być gotowa.

**W przód.** Obie warstwy ściany warstwowej mogą zacząć się we wtorek 29 czerwca. Wewnętrzna warstwa kończy się w poniedziałek 5 lipca. Elementy dachu układa się we wtorek 6 lipca, a pokrycie dachu w środę 7 i czwartek 8 lipca. Zewnętrzna warstwa kończy się we wtorek 6 lipca. *Install window frames* czeka na późniejszy z dwóch łańcuchów, czyli pokrycie dachu, i zaczyna się w piątek 9 lipca.

**Wstecz.** Ramy muszą zacząć się najpóźniej w piątek 9 lipca, inaczej przekazanie się przesunie. Zewnętrzna warstwa musi więc być gotowa najpóźniej w czwartek 8 lipca. Sześć dni roboczych wstecz to najpóźniejsze rozpoczęcie w czwartek 1 lipca.

**Zapas.** Zewnętrzna warstwa może zacząć się najwcześniej 29 czerwca, a najpóźniej musi zacząć się 1 lipca. Pomiędzy są 2 dni robocze: środa 30 czerwca i czwartek 1 lipca. To jest jej zapas całkowity. Panel pokazuje *Zapas całkowity: 2 dni* i *Ścieżka krytyczna: nie*. Zapas swobodny też wynosi 2 dni, bo jej jedyny następnik, *Install window frames*, leży na ścieżce krytycznej.

Wewnętrzny łańcuch nie ma zapasu. Każdy dzień spóźnienia tam przesuwa ramy i wszystko po nich.

### Painting

*Painting* (3 dni robocze) zaczyna się po tynkowaniu, w poniedziałek 26 lipca, i kończy się w środę 28 lipca. Następne zadanie, *Snagging and cleaning*, także czeka na układanie płytek. Układanie płytek kończy się dopiero w czwartek 5 sierpnia, bo wylewka musi najpierw wyschnąć przez 5 dni roboczych. *Painting* może więc trwać do czwartku 5 sierpnia. To daje 6 dni roboczych zapasu: 29 i 30 lipca oraz 2–5 sierpnia. Także tutaj zapas swobodny równa się zapasowi całkowitemu, bo następnik jest krytyczny.

### Gdy zewnętrzna warstwa się spóźnia

Jeśli zewnętrzna warstwa zajmie 8 dni roboczych zamiast 6, skończy się w czwartek 8 lipca, dokładnie w swoim najpóźniejszym zakończeniu. Zapas zniknie, a zadanie zrobi się czerwone. Obie ścieżki są wtedy krytyczne, a pasek stanu liczy 22 zadania krytyczne. Przekazanie zostaje w piątek 6 sierpnia.

Jeśli zajmie 9 dni roboczych, zewnętrzna warstwa skończy się dopiero w piątek 9 lipca. Ramy przesuną się na poniedziałek 12 lipca, a przekazanie na poniedziałek 9 sierpnia: o jeden dzień roboczy później. Zewnętrzny łańcuch jest teraz ścieżką krytyczną. Pasek stanu pokazuje *Ścieżka krytyczna: 19 zadań, 46 dni roboczych*.

Wewnętrzny łańcuch ma wtedy 1 dzień roboczy zapasu całkowitego, ale ten dzień jest wspólny:

- *Build inner cavity leaf*: zapas całkowity 1, zapas swobodny 0, zapas kolidujący 1. Jeśli wewnętrzna warstwa spóźni się o dzień, elementy dachu przesuną się razem z nią.
- *Place roof elements*: zapas całkowity 1, zapas swobodny 0, zapas kolidujący 1.
- *Apply roofing*: zapas całkowity 1, zapas swobodny 1. Tylko tutaj spóźnienie o dzień nikomu nie szkodzi.

To ten sam pojedynczy dzień, wspólny dla całego łańcucha. Jeśli wewnętrzna warstwa go wykorzysta, zniknie dla elementów dachu i pokrycia dachu.

### Prawie krytyczne i ujemny zapas

Przy włączonym *Oznaczaj jako prawie krytyczne* i domyślnym progu 2 dni roboczych zewnętrzna warstwa, z dokładnie 2 dniami zapasu, dostaje bursztynowy pasek. *Painting* z 6 dniami zapasu zostaje niebieski.

Jeśli przekazanie dostanie termin ostateczny w środę 4 sierpnia, czyli 2 dni robocze przed obliczonym przekazaniem, zapas stanie się ujemny. Wszystkie 21 zadań na ścieżce krytycznej dostaje zapas całkowity wynoszący −2 dni robocze. Zewnętrzna warstwa nie ma już zapasu i też staje się krytyczna. *Painting* ma nadal zapas wynoszący 4 dni robocze.

## Konsekwencje i błędne przekonania

**„Krytyczny znaczy ważny”.** Nie. Odbiór może być bardzo ważny i mimo to mieć zapas. Odwrotnie: prosta czynność może być krytyczna. W przykładzie *Snagging and cleaning* leży na ścieżce krytycznej. Krytyczność dotyczy tylko czasu: nie ma już zapasu.

**„To zadanie ma zapas, więc może poczekać”.** Najpierw sprawdź zapas swobodny. Jeśli zadanie ma zapas całkowity, ale nie ma zapasu swobodnego, każdy dzień spóźnienia zabiera zapas zadaniom po nim, jak wewnętrzna warstwa w przypadku z 9 dniami roboczymi.

**Zapomniana relacja daje fałszywy zapas.** Zadanie bez następnika dostaje zapas aż do końca projektu. Gdyby w przykładzie brakowało relacji od zewnętrznej warstwy do ram, zewnętrzna warstwa miałaby nagle 23 dni robocze zapasu, aż do przekazania 6 sierpnia. Na papierze mogłaby wtedy spóźnić się o tygodnie, a ramy by na to nie czekały. Przy włączonym *Zadania z otwartym końcem krytyczne* zewnętrzna warstwa staje się w tym przypadku krytyczna i luka się pokazuje.

**Ścieżka krytyczna nie jest stała.** Jeśli zadanie niekrytyczne spóźni się bardziej niż jego zapas, najdłuższym łańcuchem stanie się inny. Widać to wyżej, w przypadku 9 dni roboczych na warstwie zewnętrznej. Dlatego harmonogram trzeba przeliczać po każdej zmianie. Dopóki pasek stanu pokazuje *Nieaktualne — przelicz (F5)*, czerwone paski nadal należą do poprzedniego obliczenia.

**Zapas liczy się w dniach roboczych.** Zapas *Painting* wynosi 6 dni roboczych i biegnie od czwartku 29 lipca do czwartku 5 sierpnia: osiem dni w kalendarzu, bo weekend się nie liczy. Święto albo urlop budowlany w kalendarzu też się nie liczą.

## Zobacz też

- [Dodawanie relacji](docs://howto-relaties-leggen): kroki, jak połączyć zadania i ustawić opóźnienie.
- [Relacje i opóźnienie](docs://uitleg-relaties): jak relacje i opóźnienie określają daty najwcześniejsze.
- [Ograniczenia i terminy](docs://uitleg-constraints): jak ograniczenie albo termin ostateczny daje ujemny zapas.
- [Śledzenie ścieżki](docs://howto-pad-traceren): śledzenie łańcucha za zadaniem.
- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): definicja krytyczności, prawie krytyczne i sposób liczenia zapasu, opcja po opcji.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): duży projekt z kilkoma ścieżkami zapasu, zadaniami prawie krytycznymi (próg 3 dni robocze), z hamakiem, twardym przypięciem i relacją zewnętrzną.
