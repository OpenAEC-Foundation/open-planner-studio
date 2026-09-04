# Planowanie i WBS

Harmonogram zaczyna się od struktury zadań: jakie zadania istnieją, jak są podzielone na fazy i które momenty są na tyle ważne, by zasłużyć na kamień milowy? Ten przewodnik wchodzi głębiej w te podstawy niż przewodnik [Szybki start](docs://quick-start) — tutaj dowiesz się nie tylko *jak* wcinać zadania, ale też co dokładnie robi zadanie sumaryczne, czym różnią się trzy rodzaje kamieni milowych, jak nadać zadaniom własne kody i pola oraz jak prowadzić notatki dla poszczególnych zadań.

## Czego się tu nauczysz

- Budowania struktury zadań (WBS) za pomocą wcinania i zadań sumarycznych.
- Przenoszenia zadań w obrębie tego samego poziomu, bez ponownego wcinania — z klawiatury, przeciąganiem albo na karcie **Tabela** w stylu arkusza kalkulacyjnego.
- Trzech rodzajów kamieni milowych i osobnej flagi obowiązkowości dla momentów umownych.
- Zarządzania kodami zadań i polami użytkownika przez okno **Kody i pola** oraz grupowania według nich.
- Korzystania z notatek (listy kontrolnej dla każdego zadania), aby śledzić otwarte kwestie.

Wolisz podążać za pełnym przykładem? Otwórz [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) przez **Plik → Przykłady** — fazowanie „1. Voorbereiding" (Przygotowanie) / „2. Fundering & ruwbouw" (Fundamenty i stan surowy) / „3. Afbouw" (Wykończenie) / „4. Oplevering" (Odbiór) wraz z podzadaniami to dokładnie ta struktura, która jest wyjaśniona poniżej.

## Budowanie struktury zadań

Płaska lista zadań nic nie mówi o tym, jak się one ze sobą wiążą. Wcinając zadanie pod innym zadaniem, budujesz strukturę drzewiastą (WBS — Work Breakdown Structure): zadanie nadrzędne automatycznie staje się wtedy **zadaniem sumarycznym**.

1. Zaznacz zadanie, które chcesz umieścić głębiej w strukturze.
2. Naciśnij **Alt+→**, aby zwiększyć wcięcie. Istnieje drugi skrót dla tej samej czynności: **Alt+Shift+→** — przydatny, jeśli Twój układ klawiatury już wykorzystuje Alt+→ do czegoś innego. Oba robią dokładnie to samo.
3. Wolisz pracować myszą? Kliknij prawym przyciskiem zadanie i wybierz **Wcięcie** z menu kontekstowego.
4. Poszedłeś o jeden poziom za daleko? **Alt+←** (albo kliknięcie prawym przyciskiem → **Usuń wcięcie**) przenosi zadanie o jeden poziom wyżej.
5. Dla zupełnie nowego podzadania istnieje szybsza droga: kliknij prawym przyciskiem zadanie nadrzędne i wybierz **Dodaj podzadanie**. Tworzy to w jednym kroku nowe, od razu wcięte zadanie, zamiast najpierw dodawać zadanie, a potem osobno je wcinać.

Gdy tylko zadanie ma co najmniej jedno podzadanie, automatycznie staje się zadaniem sumarycznym: jego pasek na wykresie Gantta obejmuje wtedy cały okres od najwcześniejszego początku do najpóźniejszego końca wszystkich podzadań pod nim, a jego własny czas trwania i daty nie mogą już być ustawiane niezależnie. Zadanie sumaryczne jest więc zawsze wartością pochodną, nigdy harmonogramem wpisywanym bezpośrednio — usuń lub przesuń podzadania, a pasek zadania sumarycznego dostosuje się automatycznie.

**Zwijanie i rozwijanie.** Przy dużym WBS czasem chcesz tymczasowo skompresować drzewo. Karta wstążki **Widok**, grupa **Konspekt**, ma do tego dwa osobne przyciski — **Zwiń** i **Rozwiń** — celowo nie jeden przełącznik, ponieważ przy mieszanym zaznaczeniu (część gałęzi otwarta, część zamknięta) przełącznik nigdy nie mógłby ustawić wszystkiego jednakowo.

- **Z zaznaczeniem** przyciski działają na zaznaczonych zadaniach; dotyczą tylko zadań z podzadaniami, samodzielne zadania są pomijane.
- **Bez zaznaczenia** działają na cały harmonogram. Usuń zaznaczenie klawiszem **Esc** albo kliknij puste miejsce w widoku Gantta.
- W widoku pogrupowanym (zobacz *Grupowanie według kodów i pól* niżej) przyciski zwijają/rozwijają zamiast tego pasma grup — łącznie z zagnieżdżonymi pasmami — a nie zadania.

Strzałka przed zadaniem sumarycznym nadal działa tak jak wcześniej, otwierając lub zamykając tylko tę jedną gałąź.

### Wstawianie nowego zadania we właściwym miejscu

Nowe zadania nie muszą już lądować na końcu. Wszystkie przyciski i klawisze tworzące zadanie działają według tej samej zasady:

- **Jeśli zadanie jest zaznaczone**, nowe zadanie trafia bezpośrednio **pod** nim, a nie na koniec całej listy. Dziedziczy poziom i zadanie nadrzędne zaznaczenia, więc nowe zadanie w obrębie fazy pozostaje w tej fazie.
- **Jeśli nic nie jest zaznaczone**, trafia na koniec, jak dotąd.
- **Jeśli zaznaczono kilka zadań**, trafia pod **najniższe** zadanie zaznaczenia w kolejności widocznej na ekranie — nigdy w środek zaznaczenia, a kolejność klikania nie ma znaczenia.

Dotyczy to przycisku **Zadanie** oraz menu **Kamień milowy** w grupie wstążki **Zadania**, a także pozycji **Nowe zadanie** w menu kontekstowym. Ta grupa znajduje się zarówno na karcie **Start**, jak i na karcie **Tabela**, z tymi samymi trzema przyciskami (**Zadanie**, **Kamień milowy**, **Połączenie**), więc do wprowadzania zadań nie trzeba już przełączać kart.

Z klawiatury idzie jeszcze szybciej:

- **Insert** wstawia zadanie **nad** zaznaczeniem.
- **Ctrl+I** (**Cmd+I** w macOS) wstawia zadanie **pod** zaznaczeniem — zwykle właśnie tam chcesz trafić, przechodząc przez listę.

Oba znajdziesz też w przeglądzie skrótów (**Ctrl+/**) w kategorii **Struktura**.

**Tylko w zwykłym widoku drzewa.** Wstawianie nad lub pod jest ingerencją w strukturę i ma sens tylko dopóty, dopóki pokazywana kolejność jest kolejnością rzeczywistą. Przy aktywnym filtrze, sortowaniu lub grupowaniu nowe zadanie pojawiłoby się gdzie indziej niż tam, gdzie je umieszczasz. Aplikacja odmawia wtedy wstawienia nad/pod i pokazuje pasek z wyjaśnieniem oraz przyciskiem, który jednym kliknięciem czyści filtr, sortowanie i grupowanie. Przyciski **Zadanie** i **Kamień milowy** nadal działają, ale umieszczają zadanie na końcu — z tym samym wyjaśnieniem.

### Przenoszenie zadań bez ponownego wcinania

Oprócz zmiany poziomu zadania (wcięcie/usunięcie wcięcia), możesz też zamienić pozycję zadania w obrębie tego samego poziomu, bez zmiany samej struktury:

- **Alt+↑** przenosi zaznaczone zadanie w górę, ponad zadanie znajdujące się aktualnie nad nim.
- **Alt+↓** przenosi zadanie w dół.

Działa to na każdym poziomie drzewa: przenieś zadanie fazowe, a wszystkie jego podzadania automatycznie przeniosą się razem z nim.

Wolisz myszą? Chwyć zadanie za jego wiersz w tabeli zadań (lewa kolumna widoku Gantta, z tym samym zachowaniem przeciągania na karcie wstążki **Tabela**) i przeciągnij je w górę lub w dół. Upuść je między dwoma wierszami, aby zmienić jego kolejność wśród rodzeństwa — tak samo jak Alt+↑/↓. Upuść je zamiast tego na dolną część wiersza zadania sumarycznego, a zostanie zagnieżdżone: zadanie staje się nowym, ostatnim podzadaniem tego zadania sumarycznego, wcinając się w jednym ruchu — to myszowy odpowiednik Alt+→. Zaznacz najpierw kilka zadań (Ctrl/Cmd+klik albo zaznaczenie ramką), a całe zaznaczenie przeciąga się i upuszcza razem.

Karta wstążki **Tabela** pokazuje tę samą strukturę jako zwykłą, edytowalną siatkę, przydatną, gdy wprowadzasz lub poprawiasz naraz wiele zadań: pojedyncze kliknięcie dowolnej edytowalnej komórki od razu rozpoczyna edycję z zaznaczoną istniejącą wartością, klawisze strzałek przesuwają kursor komórki bez jej otwierania, **F2**/**Enter** otwiera bieżącą komórkę do edycji, a **Tab**/**Shift+Tab** przechodzi do następnej/poprzedniej komórki i dalej do następnego/poprzedniego wiersza zadania. Wcinanie pozostaje pod **Alt+→**/**Alt+←**. Dotarcie klawiszem **Enter** lub **↓** do ostatniego wiersza tworzy w tym miejscu nowe zadanie na tym samym poziomie, z kursorem już w jego komórce nazwy, dzięki czemu możesz prowadzić dalej całą listę bez dotykania myszy — działa to tylko w zwykłym widoku drzewa, ponieważ przy aktywnym filtrze, sortowaniu lub grupowaniu nowe zadanie mogłoby całkowicie wypaść z widoku, więc aplikacja najpierw pyta, zamiast po cichu umieścić zadanie, którego nie widzisz.

## Rodzaje kamieni milowych

Kamień milowy to zadanie bez czasu trwania, które oznacza moment — start, odbiór, inspekcję. Open Planner Studio ma trzy sposoby dodania kamienia milowego, wszystkie przez grupę wstążki **Zadania**, za pomocą strzałki obok przycisku **Kamień milowy**:

- **Punkt kontrolny początkowy** — oznacza początek fazy lub projektu.
- **Punkt kontrolny końcowy** — oznacza zakończenie, na przykład odbiór.
- **Punkt inspekcji (obowiązkowy)** — w praktyce punkt kontrolny końcowy z już zaznaczoną flagą **Obowiązkowy (umowny)** i Typem ustawionym bezpośrednio na **Inspekcja**, dzięki czemu moment inspekcji jest od razu rozpoznawalny zarówno jako umownie obowiązkowy, jak i jako inspekcja.

Wolisz skrót **Ctrl+M**? Daje on ogólny kamień milowy („Nowy kamień milowy"), który sam nazwiesz i stypujesz.

Ten sam podział zobaczysz w panelu właściwości po zaznaczeniu kamienia milowego z zaznaczonym polem wyboru **Kamień milowy**: pole **Rodzaj punktu kontrolnego** oferuje **Automatycznie**, **Punkt kontrolny początkowy** lub **Punkt kontrolny końcowy**. „Automatycznie" pozwala silnikowi harmonogramowania samemu zdecydować, jak kamień milowy się zachowuje, na podstawie jego relacji — wybierz to, jeśli kamień milowy nie ma wyraźnego charakteru początkowego ani końcowego. Osobno jest pole wyboru **Obowiązkowy (umowny)**: oznacza ono kamień milowy jako wiążący umownie, niezależnie od tego, czy jest to kamień początkowy czy końcowy. Dzięki temu możesz na przykład uczynić obowiązkowym również kamień początkowy albo — jak w przypadku **Punktu inspekcji** — skonfigurować obowiązkowy kamień końcowy jednym kliknięciem.

## Kody i pola: kody zadań i pola użytkownika

Większe harmonogramy szybko potrzebują dodatkowych wymiarów, które nie mieszczą się w WBS: która jednostka, która branża, który wykonawca. Do tego służą **kody zadań** i **pola użytkownika**, oba zarządzane przez okno **Kody i pola** (grupa wstążki **Struktura** na karcie **Planowanie**, przycisk oznaczony **Kody i pola**).

- **Kody zadań** to swobodnie definiowalne wymiary (na przykład „Lokalizacja" lub „Branża") z listą wartości — każda wartość ma **Kod**, **Opis** i **Kolor**. Zadanie może mieć co najwyżej jedną wartość na typ kodu. Użyj **Dodaj typ kodu**, aby rozpocząć nowy wymiar, i **Dodaj wartość**, aby budować możliwe wartości.
- **Pola użytkownika** to Twoje własne, typowane pola — **Tekst**, **Liczba**, **Liczba całkowita**, **Koszt**, **Data** lub **Tak/nie** — które pojawiają się jako kolumna w tabeli zadań i można je wypełnić dla każdego zadania osobno. Pomyśl o polu „Wykonawca" (tekst) albo „Pozwolenie otrzymane" (tak/nie).

Po utworzeniu przypisujesz kod zadania lub wypełniasz pole użytkownika przez kolumny w tabeli zadań (w razie potrzeby uwidocznij je najpierw przez **Widok → Kolumny…**) albo przez panel właściwości zadania.

### Grupowanie według kodów i pól

Kody zadań i pola użytkownika naprawdę się opłacają, gdy grupujesz według nich: przejdź na kartę wstążki **Widok**, otwórz **Grupuj** i wybierz kod zadania lub pole użytkownika, według którego ma nastąpić grupowanie, w polu **Pole**. Tabela zadań pokazuje wtedy nagłówki grup zamiast drzewa WBS — przydatne, aby zobaczyć na przykład wszystkie zadania na jednostkę lub na branżę razem, niezależnie od fazowania. Można ustawić jednocześnie do dwóch poziomów grupowania (na przykład najpierw według jednostki, potem według branży).

## Notatki: lista kontrolna dla każdego zadania

Każde zadanie ma sekcję **Notatki** w panelu właściwości — w istocie małą listę kontrolną, która pozostaje przypisana do zadania. Jest ona przeznaczona dla luźnych elementów działania, które nie pasują do daty w harmonogramie: „jeszcze do sprawdzenia z wykonawcą", „jeszcze zamówić materiał", „czekamy na rysunek v2".

1. Kliknij **+ Dodaj notatkę**. Pojawia się nowy, pusty wiersz z fokusem w polu tekstowym.
2. Wpisz treść notatki.
3. Zaznacz pole wyboru, gdy sprawa zostanie załatwiona — tekst zostaje wtedy przekreślony, ale notatka pozostaje widoczna (oznaczona jako gotowa, a nie usunięta), dzięki czemu historia zadania pozostaje czytelna.
4. Użyj ikony kosza, aby trwale usunąć notatkę.

Notatki są czysto informacyjne: nie wpływają na harmonogram ani na obliczenia, więc są odpowiednim narzędziem dla uwag, których nie da się wyrazić jako datę lub czas trwania. Zobacz mieszankę otwartych i zakończonych notatek w praktyce w średniej wielkości przykładzie „Nieuwbouw 6 Rijwoningen De Akkers" (tag *aantekeningen*/notatki w **Plik → Przykłady**).

## Czytaj dalej

- Zobacz tę strukturę — fazowanie, zadania sumaryczne, kamienie milowe — w praktyce w [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Teraz, gdy struktura jest już gotowa, kolejnym krokiem jest łączenie zadań ze sobą: przeczytaj przewodnik [Relacje i ograniczenia](docs://gids-relaties-constraints).
- Dopiero zaczynasz z Open Planner Studio? Zacznij od przewodnika [Szybki start](docs://quick-start) — ciągłego ćwiczenia od pustego projektu do obliczonego harmonogramu.
