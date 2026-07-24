# Zasoby, histogram i bilansowanie

Zadanie mówi, kiedy coś ma się wydarzyć; zasób mówi, kto lub co ma to zrobić — i ile z niego jest dostępne danego dnia. Gdy tylko przypiszesz zasoby do zadań, dzień może wymagać więcej, niż jest dostępnej zdolności: nadmierne przydzielenie. Ten przewodnik pokazuje, jak zarządzać zasobami i je przydzielać, jak odczytywać obciążenie w histogramie oraz jak (i kiedy *nie*) bilansowanie rozwiązuje nadmierne przydzielenie.

## Czego się tu nauczysz

- Pięciu typów zasobów i kiedy stosować każdy z nich.
- Przydzielania zasobów do zadań — przez panel właściwości, okno dialogowe zadania lub wstążkę.
- Jednostek na dzień i sześciu krzywych rozkładu: kiedy wybrać którą.
- Przenoszenia przydziału do innego zadania.
- Kalendarzy zasobów i zdolności rozłożonej w czasie (na przykład drugiego żurawia dodanego później).
- Odczytywania histogramu: selektora zasobów, zagłębiania się w pojedynczy zasób, wykrywania nadmiernego przydzielenia.
- Zadokowanego panelu zasobów obok wykresu Gantta.
- Bilansowania: opcji w oknie **Bilansuj zasoby**, różnicy między pozostawaniem w ramach zapasu a pozwoleniem na przesunięcie daty zakończenia, oraz priorytetów (w tym priorytetu 1000 = „nie bilansuj").
- Uczciwej lekcji: kiedy bilansowanie *nie* rozwiązuje nadmiernego przydzielenia.

Podążaj za przykładem [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (średniej wielkości, jedno celowe i rozwiązywalne przez bilansowanie nadmierne przydzielenie tynkarzy) oraz [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (duży, niemal każdy zasób przeciążony, ponieważ trzy wieże potrzebują tych samych brygad i żurawia wieżowego jednocześnie — przykład, w którym bilansowanie napotyka swoje granice).

## Pięć typów zasobów

Każdy zasób ma **Typ** (kolumna w panelu zasobów):

- **Robocizna (LABOR)** — fachowcy: murarze, tynkarze, monterzy.
- **Sprzęt (EQUIPMENT)** — maszyny i wyposażenie: żuraw wieżowy, winda budowlana.
- **Materiał (MATERIAL)** — materiały zużywalne z **Jednostką** (na przykład m³ betonu). Materiał nigdy nie jest bilansowany i nigdy nie jest liczony w histogramie — to zapas, a nie zdolność dzienna, która może się przepełnić.
- **Podwykonawca (SUBCONTRACTOR)** — firma zewnętrzna z własnym pułapem zdolności, na przykład wykonawca elewacji, który może wystawić naraz tylko dwie brygady.
- **Brygada (CREW)** — grupa nadrzędna. Inne zasoby mogą dołączyć do brygady przez kolumnę **Brygada** w panelu do grupowania/przeglądu; jest to czysto informacyjne — nie ma automatycznego sumowania zdolności do brygady.

## Zarządzanie zasobami

Otwórz panel zasobów przez grupę wstążki **Zarządzaj** na karcie **Zasoby**: przycisk **Zasoby** otwiera pełny panel (osobny widok pełnopanelowy, jak Tabela lub Relacje), **Nowy zasób** dodaje wiersz bezpośrednio. W panelu edytujesz, dla każdego zasobu: **Nazwę**, **Typ**, **Maks. jednostki** (zdolność na dzień roboczy — 1 = jedna osoba/element na pełny etat, 2 = dwie jednostki naraz), **Kalendarz**, **Stawkę/godz.**, **Jednostkę** (tylko materiał) i **Brygadę** (do jakiej brygady należy ten zasób). Na dole kolumna **Razem** sumuje koszt każdego zasobu (przydzielone jednostki × godziny/dzień × stawka), przeliczana przy każdym F5.

### Zdolność rozłożona w czasie

Obok **Maks. jednostki** znajduje się strzałka, która rozwija podwiersz **Zdolność rozłożona w czasie**: tutaj dodajesz kroki (data **Od** + **Maks. jednostki**) dla zdolności, która zmienia się w trakcie projektu. Duży przykład wykorzystuje to dla żurawia wieżowego: zaczyna z **Maks. jednostki 1**, z krokiem podnoszącym zdolność do **2** **od dnia 130** — momentu dodania drugiego żurawia. Przed tą datą wszystkie trzy wieże muszą dzielić jeden żuraw; po niej dwie wieże mogą podnosić jednocześnie.

## Przydzielanie zasobów

Istnieją trzy miejsca, w których zarządzasz przydziałem — działają na tych samych danych źródłowych, więc wszystko, co zrobisz w jednym, pojawia się od razu w pozostałych:

1. **Panel właściwości** — sekcja **Przydziały** pod zaznaczonym zadaniem: rozwijana lista **Przydziel zasób** z jeszcze nieprzydzielonymi zasobami, a dla każdego istniejącego przydziału **jednostki/dzień**, **krzywa** i przycisk usuwania.
2. **Okno dialogowe zadania** — ta sama sekcja **Przydziały**, w oknie **Edytuj zadanie**.
3. **Wstążka** — karta **Zasoby**, grupa wstążki **Przydział**, przycisk **Przydziel ▾**. Ten przycisk jest aktywny tylko wtedy, gdy zaznaczone jest dokładnie jedno zadanie niebędące kamieniem milowym ani zadaniem sumarycznym; rozwijana lista pozwala najpierw ustawić **jednostki/dzień** i **krzywą**, a następnie wyświetla poniżej jeszcze nieprzydzielone zasoby — kliknij nazwę, aby dokończyć przydział za jednym razem.

Kamienie milowe i zadania sumaryczne nie mogą nosić zasobów (nie mają własnego czasu trwania do obciążenia) — w obu miejscach zamiast formularza przydziału pojawia się wyjaśnienie.

### Przenoszenie przydziału

Przypisałeś zasób do niewłaściwego zadania przez pomyłkę, albo przenosisz pracę z jednego zadania na drugie? W sekcji **Przydziały** panelu właściwości (lub w oknie dialogowym zadania) każdy przydział ma rozwijaną listę **Przenieś do…** z kandydującymi zadaniami (zadania liście bez tego zasobu, z wyjątkiem bieżącego zadania). Wybranie jednego przenosi przydział w jednym kroku, wraz z jego jednostkami i krzywą — bez potrzeby usuwania i tworzenia go od nowa.

## Jednostki i krzywe rozkładu

Każdy przydział ma **jednostki/dzień** (1 = jedna osoba/element na pełny etat, 0,5 = pół dnia) oraz **krzywą**, która określa, jak to obciążenie jest rozłożone na czas trwania zadania:

- **Jednolity** — płaski, ta sama ilość każdego dnia. Domyślny i właściwy punkt wyjścia dla większości zadań.
- **Obciążony na początku (FRONT_LOADED)** — większość pracy wcześnie w zadaniu, zmniejszająca się w kierunku końca.
- **Obciążony na końcu (BACK_LOADED)** — lustrzane odbicie: narastające w kierunku końca, na przykład zadanie, które musi nabrać rozpędu.
- **Dzwonowy (BELL)** — niski na początku i na końcu, ze szczytem pośrodku — zadanie, które narasta, działa pełną parą, a potem wygasa.
- **Wczesny szczyt (EARLY_PEAK)** — szczyt znajduje się wcześnie w zadaniu, potem obciążenie maleje.
- **Późny szczyt (LATE_PEAK)** — szczyt znajduje się późno w zadaniu.

Różnica krzywych najwyraźniej widoczna jest w histogramie: to samo zadanie z tymi samymi jednostkami/dzień daje bardzo inny kształt paska przy krzywej dzwonowej niż przy jednolitej. Średniej wielkości przykład celowo miesza jednolity/obciążony na początku/obciążony na końcu na zadaniach wykończeniowych poszczególnych domów, abyś mógł porównać różnicę.

## Kalendarze zasobów

Zasób może być na **Kalendarzu projektu** (domyślnie) albo na własnym kalendarzu — na przykład dla podwykonawcy dostępnego tylko cztery dni w tygodniu. Ustaw to przez kolumnę **Kalendarz** w panelu zasobów albo pole **Kalendarz** na samym zasobie. Kalendarz zasobu nigdy nie dotyka dat CPM zadania (te nadal działają na kalendarzu zadania/projektu) — wpływa tylko na **obciążenie** i **bilansowanie**: jeśli zasób nie pracuje w dniu, którego potrzebuje zadanie, liczy się to jako niedobór w histogramie, a bilansujący ostrzega, że przesunięcie nie naprawi tego niedopasowania kalendarzy. Zobacz przewodnik [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren) po pełne wyjaśnienie kalendarzy.

## Odczytywanie histogramu

Włącz histogram przez grupę wstążki **Histogram** na karcie **Zasoby** (przycisk **Histogram**). Pod wykresem Gantta na tej samej osi czasu pojawia się pasek: słupki na dzień, z częścią powyżej linii zdolności pokazaną na czerwono.

Po lewej stronie słupków, nad kolumną tabeli zadań, znajduje się **selektor zasobów**: lista z „Wszystkie zasoby" na górze i każdym zasobem poniżej, każdy z czerwoną kropką, jeśli ten zasób jest gdziekolwiek nadmiernie przydzielony. Kliknij nazwę, aby przybliżyć widok do jednego zasobu — histogram przeskalowuje się wtedy tylko do jego obciążenia i zdolności. Kliknij z powrotem na „Wszystkie zasoby", aby ponownie zobaczyć sumę wszystkich zasobów. Oprócz klikania, możesz też przechodzić przez zasoby przyciskami **Poprzedni**/**Następny** w grupie wstążki **Histogram**, bez dotykania samego selektora.

Kliknij przeciążony słupek, a podpowiedź pokaże, ile zadań przyczynia się do obciążenia tego dnia, z pierwszymi kilkoma nazwami zadań — przydatne, aby szybko zobaczyć, która kombinacja zadań powoduje nadmierne przydzielenie, bez ręcznego sprawdzania każdego przydziału.

Jeśli zamiast słupków widzisz „Przelicz (F5), aby pokazać obciążenie", harmonogram nie został (ponownie) obliczony od ostatniej zmiany — histogram, podobnie jak ścieżka krytyczna, to migawka, którą odświeżasz samodzielnie.

## Zadokowany panel zasobów

Oprócz pełnego panelu zasobów (przycisk wstążki **Zasoby**), istnieje kompaktowy wariant, który możesz zadokować po prawej stronie: przycisk **Zadokuj** w grupie wstążki **Zarządzaj**. Ten zadokowany panel pokazuje tylko nazwę, **Maks. jednostki** (edytowalne bezpośrednio) i czerwoną/zieloną kropkę oznaczającą nadmierne przydzielenie — szybki przegląd obok wykresu Gantta bez otwierania pełnego panelu. Zadokowany panel zasobów i panel właściwości zadania wykluczają się wzajemnie — w prawym pasie widzisz naraz tylko jedno z nich.

## Wykrywanie nadmiernego przydzielenia

Zasób jest przeciążony w danym dniu, gdy tylko zsumowane jednostki wszystkich jego przydziałów tego dnia przekraczają jego **Maks. jednostki**. Zobaczysz to w trzech miejscach: w czerwonej części słupka w histogramie, w czerwonej kropce w selektorze zasobów i w zadokowanym panelu, oraz w liczniku **Nadmierne przydzielenie** w grupie wstążki na karcie Zasoby („N zasobów" z ikoną ostrzeżenia, albo „Brak").

Średniej wielkości przykład celowo pokazuje to: na początku czerwca **Stukadoors** (tynkarze, maks. jednostki 2) otrzymują przydział 2 jednostek na trzy domy jednocześnie (tynkowanie domów 1, 2 i 3 nakłada się tam przez kilka dni) — łącznie 6 jednostek w szczycie, znacznie powyżej zdolności równej 2.

## Bilansowanie

Otwórz okno **Bilansuj zasoby** przez przycisk **Bilansuj…** w grupie wstążki **Bilansowanie** na karcie Zasoby. Okno wymaga ważnego, aktualnego obliczenia (najpierw przelicz F5, jeśli harmonogram jest nieaktualny) i działa w dwóch krokach: najpierw **Oblicz**, aby uzyskać propozycję, potem **Zastosuj** — nic nie zmienia się w Twoim harmonogramie, dopóki nie zobaczysz propozycji.

W oknie wybierasz:

- **Zasoby** — które zasoby biorą udział w przebiegu bilansowania (domyślnie wszystkie; materiał jest zawsze wykluczony — nigdy nie jest bilansowany).
- **Bilansuj tylko w ramach zapasu (wygładzanie)** — pole wyboru z wyraźnym podtytułem: „data zakończenia projektu pozostaje bez zmian". Wyłączone (**bilansowanie**), bilansujący może przesunąć zadania tak daleko, jak trzeba, nawet poza ich własny zapas, co może przesunąć datę zakończenia projektu. Włączone (**wygładzanie**), data zakończenia jest nienaruszalna — bilansujący przesuwa tylko w ramach istniejącego zapasu każdego zadania, a konflikt, który się w tym nie mieści, pozostaje oznaczony jako konflikt pozostały.

Po **Oblicz** okno pokazuje tabelę z każdym zadaniem, którego początek się zmienia (stary początek → nowy początek → dni przesunięcia), wiersz informujący, czy data zakończenia projektu się zmienia, oraz — jeśli pozostają konflikty — sekcję **Pozostałe konflikty** z powodem dla każdego zadania: niedopasowanie kalendarza (zasób nie pracuje w dniach, których potrzebuje zadanie), niewystarczająca wolna zdolność w ramach zapasu, albo nieodłączne przekroczenie (jeden przydział już wymaga w szczycie więcej, niż zasób mógłby kiedykolwiek dostarczyć — żadne przesunięcie tego nie naprawi). Dopiero gdy jesteś zadowolony z propozycji, klikasz **Zastosuj**.

Wypróbuj to sam na nadmiernym przydzieleniu tynkarzy w średniej wielkości przykładzie: otwórz **Nieuwbouw 6 Rijwoningen De Akkers**, przejdź na kartę **Zasoby** i otwórz **Bilansuj zasoby**. Pozostaw wszystkie zasoby zaznaczone, pozostaw wygładzanie wyłączone i kliknij **Oblicz**: konflikty znikają całkowicie (0 pozostałych konfliktów), ale data zakończenia projektu przesuwa się o około tydzień później. Następnie zaznacz **Bilansuj tylko w ramach zapasu** i oblicz ponownie: data zakończenia pozostaje teraz niezmieniona, ale jedno zadanie (tynkowanie w jednym z domów) pozostaje jako oznaczony konflikt — po prostu nie ma wystarczająco dużo zapasu, by zmieścić je w całości w istniejącym harmonogramie. To dokładnie ten kompromis, który to pole wyboru czyni widocznym: rozwiązujesz problem, pozwalając odejść dacie zakończenia, czy trzymasz datę zakończenia stałą i akceptujesz oznaczony konflikt pozostały?

### Priorytety

Każde zadanie ma **priorytet bilansowania** od 0 do 1000 (domyślnie 500). Kliknij prawym przyciskiem zadanie i wybierz **Priorytet** dla trzech gotowych ustawień: **Niski** (100), **Normalny** (500) i **Wysoki** (900) — w konflikcie zdolności między dwoma zadaniami, to o wyższym priorytecie otrzymuje pierwszeństwo w dostępie do ograniczonej zdolności. Wartość **1000** to przypadek specjalny: „nie bilansuj" (MS Project nazywa to „Do Not Level"). Takie zadanie nadal przechodzi przez pętlę bilansowania i podąża za swoimi własnymi, ewentualnie przesuniętymi poprzednikami, ale samo nigdy nie jest przesuwane, aby zwolnić zdolność. Duży przykład wykorzystuje to na „Nutsaansluitingen aanleggen" (podłączenie przyłączy komunalnych): stała data przyłączenia ustalona przez zakład użyteczności publicznej, która nie może się przesunąć, bez względu na to, co poza tym proponuje przebieg bilansowania.

**Wyczyść bilansowanie** (w grupie wstążki **Bilansowanie**) usuwa za jednym razem każde wcześniej zastosowane przesunięcie — przydatne, aby wrócić do oryginalnego, niezbilansowanego harmonogramu bez ręcznego resetowania każdego zadania.

## Uczciwa lekcja: kiedy bilansowanie nie pomaga

Bilansowanie rozwiązuje nadmierne przydzielenie, przestawiając pracę w czasie — w ramach zapasu albo, jeśli trzeba, z późniejszą datą zakończenia. To działa dobrze, dopóki gdzieś w harmonogramie jest wystarczająco dużo miejsca (zapasu lub czasu), aby rozłożyć nadmiar zapotrzebowania. Zasadniczo *nie* działa, gdy zapotrzebowanie jest strukturalnie większe niż to, co kiedykolwiek będzie dostępne, bez względu na to, jak przesuwasz rzeczy.

Duży przykład pokazuje to na wielu zasobach naraz: ponieważ trzy wieże działają w dużej mierze równolegle i dzielą te same brygady (murarze, monterzy, tynkarze, glazurnicy, żuraw wieżowy), niemal każdy zasób robocizny jest w pewnym momencie przeciążony. Bilansuj z wszystkimi zaznaczonymi zasobami i swobodną datą zakończenia, a większość konfliktów znika — ale data zakończenia projektu przesuwa się o miesiące, a garść zadań wykończeniowych na wieżę (prace glazurnicze, kuchnie, instalacje sanitarne, malowanie) pozostaje jako nieodłączne przekroczenie: szczytowe obciążenie pojedynczego przydziału już tam przekracza zdolność, więc żadne przesunięcie nie pomaga. Włącz wygładzanie, aby chronić datę zakończenia, a znacznie większa część konfliktów po prostu pozostaje nierozwiązana.

Lekcja nie polega na tym, że bilansowanie „nie działa" — algorytm robi dokładnie to, o co go proszono. Lekcja polega na tym, że bilansowanie to narzędzie **harmonogramowania**, nie narzędzie **zdolności**: przestawia istniejącą pracę w ramach istniejącego czasu, ale nie tworzy dodatkowych fachowców, sprzętu ani dni kalendarzowych. Strukturalny niedobór — zbyt mało tynkarzy na trzy wieże naraz, jeden żuraw wieżowy obsługujący trzy place budowy — wymaga innego rozwiązania: zatrudnienia większej zdolności, dostosowania fazowania (wieże jedna po drugiej zamiast równolegle, co krok z drugim żurawiem od dnia 130 już częściowo robi), albo innego podziału pracy. Bilansowanie to narzędzie, które pokazuje, gdzie boli; nie rozwiązuje za Ciebie leżącego u podstaw problemu zdolności.

## Czytaj dalej

- Powtórz samodzielnie bilansowanie nadmiernego przydzielenia tynkarzy w [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zobacz granice bilansowania w praktyce — plus wszystkie pięć typów zasobów, wszystkie sześć krzywych i zdolność żurawia wieżowego rozłożoną w czasie — w [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Zasoby działają na kalendarzach — przeczytaj przewodnik [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren) o kalendarzach zasobów i planowaniu godzinowym.
- Chcesz ustawić baseline przed rozpoczęciem bilansowania, aby móc zobaczyć różnicę? Przeczytaj przewodnik [Baseline i postęp](docs://gids-baselines-voortgang).
- Bilansowanie może zmienić, które zadania są krytyczne — przeczytaj przewodnik [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse), aby dowiedzieć się, jak to rozpoznać.
