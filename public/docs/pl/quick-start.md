# Twój pierwszy harmonogram w 10 minut

Ten przewodnik w około 10 minut prowadzi Cię od pustego projektu do w pełni obliczonego harmonogramu budowy: dodawania zadań, budowania struktury zadań, dodawania relacji, obliczania i zapisywania. Bez teorii na wstępie — po prostu to robisz, krok po kroku, korzystając z dokładnie tych samych przycisków i menu, które znajdziesz w Open Planner Studio.

## Co zrobisz

1. Utworzysz nowy projekt.
2. Dodasz zadania — przez wstążkę, tabelę zadań i wykres Gantta.
3. Ułożysz zadania w strukturę (WBS) przez wcinanie.
4. Dodasz relacje między zadaniami.
5. Obliczysz harmonogram.
6. Odczytasz wynik: ścieżkę krytyczną i zapas.
7. Zapiszesz projekt.

Chcesz najpierw zobaczyć, dokąd zmierzasz? Otwórz przykładowy projekt [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) przez **Plik → Przykłady**. (Przykładowe nazwy są pokazane po niderlandzku, tak jak są dołączone do projektu.) To niewielki, łatwy do odczytania harmonogram, który pokazuje już niemal każdy z poniższych kroków — warto trzymać go otwartym obok tego artykułu, aby porównywać.

Wszystko poniżej działa identycznie w aplikacji desktopowej i w wersji przeglądarkowej: te same przyciski, te same menu, te same skróty.

## Krok 1 — Utwórz nowy projekt

1. Kliknij kartę wstążki **Plik**. Otworzy się ekran plików.
2. Kliknij **Nowy** (lub użyj skrótu **Ctrl+N**, jeśli pracujesz już w innym projekcie). Pojawi się okno **Nowy projekt**.
3. Wpisz **Nazwę projektu**, na przykład „Mój pierwszy harmonogram", i sprawdź **Datę rozpoczęcia** — domyślnie jest to dzisiejsza data.
4. Dla **Szablonu faz** wybierz **Pusty**. Szablony **Budownictwo mieszkaniowe** i **Budownictwo użytkowe / remont** od razu tworzą kilka zadań fazowych, ale w tym ćwiczeniu zbudujesz wszystko samodzielnie, aby rozpoznać każdy krok.
5. Pozostaw opcje kalendarza na wartościach domyślnych i kliknij **Utwórz**.

Masz teraz pusty projekt: pustą tabelę zadań po lewej, pusty wykres Gantta po prawej i kalendarz pracy już skonfigurowany na podstawie ustawień domyślnych.

## Krok 2 — Dodaj zadania

Upewnij się, że jesteś na karcie wstążki **Start**. Ta karta pokazuje obok siebie tabelę zadań (lewa strona) i wykres Gantta (prawa strona) — dwa widoki tego samego harmonogramu, więc dodane zadanie pojawia się od razu w obu miejscach.

### Przez wstążkę

1. W grupie wstążki **Zadania** kliknij przycisk **Zadanie**. Na dole zarówno tabeli zadań, jak i wykresu Gantta pojawi się nowe zadanie o nazwie „Nowe zadanie", z czasem trwania 5 dni roboczych.
2. Powtórz to kilka razy, aż uzyskasz zadanie dla każdej głównej fazy projektu. Jeśli podążasz za przykładowym projektem, użyj tych samych głównych faz co on: „1. Voorbereiding" (Przygotowanie), „2. Fundering & ruwbouw" (Fundamenty i stan surowy), „3. Afbouw" (Wykończenie) i „4. Oplevering" (Odbiór).
3. Kliknij dwukrotnie zadanie — w tabeli lub na jego pasku na wykresie Gantta — aby otworzyć okno **Edytuj zadanie**. Dostosuj **Nazwę**, **Typ** i **Czas trwania (dni robocze)** do swojej fazy.

### Przez tabelę zadań i wykres Gantta

Nie musisz za każdym razem wracać do wstążki. Kliknij prawym przyciskiem myszy **pusty wiersz** w tabeli zadań albo puste miejsce na wykresie Gantta (tam, gdzie nie ma jeszcze zadania) i wybierz **Nowe zadanie** z menu kontekstowego.

Kliknij prawym przyciskiem myszy **istniejące** zadanie, a otrzymasz inne menu kontekstowe, między innymi z opcjami:

- **Wstaw powyżej** / **Wstaw poniżej** — dodaje zadanie przed lub po zadaniu, na którym kliknięto prawym przyciskiem.
- **Dodaj podzadanie** — tworzy nowe zadanie jako podrzędne wobec tego zadania w jednym kroku (zobacz krok 3, co to oznacza).

Wpisałeś coś źle albo dodałeś zadanie w niewłaściwym miejscu? **Ctrl+Z** cofa ostatnią akcję, **Ctrl+Y** (lub **Ctrl+Shift+Z**) ją ponawia — oba działają w całym harmonogramie, nie tylko w polach tekstowych.

### Dodaj kamień milowy

Każdy harmonogram potrzebuje co najmniej jednego kamienia milowego, na przykład dla odbioru. W grupie wstążki **Zadania** kliknij strzałkę obok **Kamień milowy** i wybierz **Punkt kontrolny końcowy**, **Punkt kontrolny początkowy** lub **Punkt inspekcji (obowiązkowy)** — albo użyj skrótu **Ctrl+M** dla szybkiego, ogólnego kamienia milowego („Nowy kamień milowy"), który potem sam nazwiesz.

## Krok 3 — Zbuduj strukturę zadań (WBS)

Płaska lista zadań szybko staje się nieprzejrzysta. Wcinając zadania, budujesz strukturę zadań (WBS): zadanie powyżej automatycznie staje się wtedy **zadaniem sumarycznym**, które obejmuje cały okres swoich podzadań.

1. Zaznacz zadanie, które ma znaleźć się głębiej w strukturze — na przykład „Fundering aanbouw" (Fundament dobudówki) pod zadaniem fazowym „2. Fundering & ruwbouw" (Fundamenty i stan surowy).
2. Naciśnij **Alt+→**, aby zwiększyć wcięcie, albo kliknij prawym przyciskiem i wybierz **Wcięcie** z menu kontekstowego. Zadanie powyżej od razu staje się widoczne jako zadanie sumaryczne.
3. Poszedłeś za daleko albo chcesz przenieść zadanie z powrotem na najwyższy poziom? Użyj **Alt+←** albo kliknij prawym przyciskiem i wybierz **Usuń wcięcie**.
4. Szybszy sposób na zupełnie nowe podzadanie: kliknij prawym przyciskiem zadanie nadrzędne i wybierz **Dodaj podzadanie** — pomija to osobne kroki dodawania, a potem wcinania.

Powtarzaj to, aż zejdziesz kilka poziomów w głąb. W przykładowym projekcie faza „2. Fundering & ruwbouw" dzieli się na przykład na podzadania „Grondwerk aanbouw" (Roboty ziemne dobudówki), „Fundering aanbouw" (Fundament dobudówki), „Begane grondvloer storten" (Wylewanie podłogi na gruncie), „Wanden opmetselen" (Murowanie ścian) i „Dakconstructie plaatsen" (Montaż konstrukcji dachu).

Ten artykuł omawia budowanie WBS tylko na poziomie praktycznym, żeby ruszyć z miejsca. Aby dowiedzieć się, jak rodzaje kamieni milowych, zadania sumaryczne i kody zadań współdziałają ze sobą w szczegółach, przeczytaj przewodnik [Planowanie i WBS](docs://gids-plannen-wbs).

## Krok 4 — Dodaj relacje

Zadania bez relacji są od siebie niezależne i nie przesuwają się, gdy zmienisz wcześniejsze zadanie. Relacja (zależność) łączy ze sobą dwa zadania.

1. Upewnij się, że paski obu zadań, które chcesz połączyć, są widoczne na wykresie Gantta.
2. Przytrzymaj **Shift** i przeciągnij od paska poprzednika do paska następnika. Zaraz po zwolnieniu przycisku myszy zostaje od razu utworzona relacja **Finish-Start (FS)** ze zwłoką 0 dni roboczych — najczęstsza relacja: następnik zaczyna się dopiero, gdy poprzednik zostanie zakończony.
3. Zaraz po zwolnieniu przycisku pojawia się okno **Typ relacji**. Tutaj możesz zmienić typ relacji (**FS**, **SS**, **FF** lub **SF**) i wprowadzić **zwłokę**, na przykład `2d` dla dwóch dni roboczych czasu oczekiwania między zadaniami. W skrócie: przy **FS** (Finish-Start) następnik zaczyna się po zakończeniu poprzednika, przy **SS** (Start-Start) oba zadania zaczynają się (mniej więcej) w tym samym czasie, przy **FF** (Finish-Finish) kończą się (mniej więcej) w tym samym czasie, a przy **SF** (Start-Finish) poprzednik musi się zacząć, zanim następnik będzie mógł się zakończyć — ten ostatni typ jest najrzadszy w praktyce budowlanej.
4. Wolisz połączyć dwa zadania bez przeciągania? Przejdź na kartę wstążki **Relacje** (albo kliknij **Zarządzaj** w grupie wstążki **Relacje** na karcie Planowanie), zaznacz najpierw poprzednika, potem (przytrzymując Ctrl/Cmd) następnika, i użyj przycisku **Nowa relacja z zaznaczenia** — ten przycisk działa tylko wtedy, gdy zaznaczone są dokładnie dwa zadania, w tej kolejności.

W ramach ćwiczenia dodaj co najmniej dwie relacje: na przykład „1. Voorbereiding" → „2. Fundering & ruwbouw" i „2. Fundering & ruwbouw" → „3. Afbouw".

## Krok 5 — Oblicz

Teraz, gdy masz zadania i relacje, możesz zlecić obliczenie harmonogramu (CPM — Critical Path Method).

1. Naciśnij **F5** albo kliknij przycisk **Oblicz** w grupie wstążki **Harmonogram**.
2. Open Planner Studio oblicza teraz, dla każdego zadania, najwcześniejszą i najpóźniejszą datę rozpoczęcia i zakończenia, zapas oraz to, które zadania leżą na ścieżce krytycznej.
3. Nie chcesz już myśleć o F5? Włącz **Oblicz automatycznie** w **Ustawieniach**. Harmonogram wtedy sam się przelicza, gdy tylko stanie się nieaktualny, zamiast czekać na ręczne naciśnięcie F5.

## Krok 6 — Odczytaj wynik

- Na dole ekranu pasek stanu pokazuje na przykład „Ścieżka krytyczna: 4 zadań, 62 dni robocze", gdy harmonogram zostanie już obliczony. Jeśli coś zmieniłeś od ostatniego obliczenia, pokazuje zamiast tego „Nieaktualne — przelicz (F5)".
- Na wykresie Gantta zadania krytyczne — zadania bez zapasu, które więc bezpośrednio decydują o dacie zakończenia projektu — mają inny kolor paska niż zadania, które wciąż mają zapas (float). Jeśli zadanie krytyczne się opóźni, cała data zakończenia projektu przesuwa się razem z nim; zadanie z zapasem może się opóźnić bez konsekwencji, dopóki zapas nie zostanie wyczerpany.
- Kliknij dwukrotnie zadanie, aby ponownie otworzyć okno **Edytuj zadanie**. W sekcji **Wynik CPM** znajdziesz, dla każdego zadania: **Wczesny początek**, **Wczesny koniec**, **Późny początek**, **Późny koniec**, **Zapas całkowity**, **Zapas swobodny** oraz informację, czy zadanie leży na ścieżce krytycznej.
- Chcesz mieć te dane też jako kolumny w tabeli zadań, zamiast otwierać każde zadanie osobno? Przejdź na kartę wstążki **Widok**, kliknij **Kolumny…** w grupie **Wyświetlanie** i zaznacz **Krytyczne** oraz **Zapas całkowity**.

## Krok 7 — Zapisz

1. Naciśnij **Ctrl+S** albo kliknij **Zapisz** na karcie **Plik**. Za pierwszym razem Open Planner Studio zapyta o nazwę pliku i lokalizację; projekt zostaje zapisany jako natywny plik IFC.
2. Chcesz zamiast tego zachować kopię pod inną nazwą, na przykład aby trzymać obok siebie dwa warianty? Użyj **Plik → Zapisz jako** (skrót **Ctrl+Shift+S**).

## Ćwicz dalej

- Powtórz powyższe kroki na pełnym przykładzie: otwórz [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) przez **Plik → Przykłady** i rozpoznaj łańcuch FS między fazami, nakładanie SS między robotami ściennymi a konstrukcją dachu, powiązanie FF między pracami glazurniczymi a malarskimi oraz ograniczenie pozwolenia (SNET) przed startem.
- Chcesz dowiedzieć się więcej o strukturze zadań, zadaniach sumarycznych, rodzajach kamieni milowych i kodach zadań? Przeczytaj przewodnik [Planowanie i WBS](docs://gids-plannen-wbs).
- Wolisz zwiedzić wizualnie główne obszary ekranu? Uruchom ponownie wycieczkę przez kartę **Widok** → przycisk **Wycieczka**, albo przez **Plik** → **Rozpocznij wycieczkę**.
