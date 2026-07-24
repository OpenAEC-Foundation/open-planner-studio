# Baseline i postęp

Harmonogram, którego nigdy nie aktualizujesz, to prognoza. Gdy prace się rozpoczynają, chcesz widzieć jednocześnie dwie rzeczy: co pierwotnie uzgodniono i co faktycznie dzieje się teraz. **Baseline** zamraża to pierwsze; **postęp** i **data statusu** śledzą to drugie. Ten przewodnik pokazuje, jak zapisać i zarządzać baseline, jak uwidocznić odchylenie, jak wprowadzać postęp i co dokładnie robi data statusu z Twoim harmonogramem.

## Czego się tu nauczysz

- Zapisywania i zarządzania baseline oraz tego, która baseline jest aktywna.
- Widzenia odchylenia: nakładki baseline na wykresie Gantta i raportu odchylenia.
- Wprowadzania postępu — procent, rzeczywiste daty — przez panel, okno dialogowe zadania i menu kontekstowe.
- Daty statusu: co robi z jeszcze nierozpoczętymi zadaniami i z nieoznaczonymi kamieniami milowymi.
- Ostrzeżeń o niezgodnej kolejności: co oznaczają i jak je rozwiązać.
- Odczytywania linii postępu.

Podążaj za przykładem [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (jedna baseline przed startem, plus postęp i data statusu w połowie projektu) oraz [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (dwie baseline — baseline kontraktowa i przeliczona baseline po zleceniu zmiany — z własnym postępem i datą statusu).

## Zapisywanie i zarządzanie baseline

Otwórz okno **Baseline** przez grupę wstążki **Baseline i postęp** na karcie **Planowanie**: **Zapisz baseline…** od razu zapisuje nową baseline z sugerowaną nazwą („Baseline 1 — [data]"), **Zarządzaj baseline…** otwiera to samo okno, aby przejrzeć, zmienić nazwę lub usunąć.

Okno pokazuje tabelę z każdą zapisaną baseline: przycisk radiowy **Aktywna**, **Nazwę** (edytowalną bezpośrednio), datę **Utworzono** oraz przycisk usuwania. Dokładnie jedna baseline może być aktywna naraz — to ta baseline, względem której porównują się nakładka na wykresie Gantta i raport odchylenia. Usunięcie aktywnej baseline pyta o potwierdzenie (żadna baseline nie pozostaje aktywna potem, dopóki nie wybierzesz innej albo nie zapiszesz nowej). Jeśli harmonogram jest nieaktualny od ostatniego obliczenia, okno pokazuje podpowiedź obok „Zapisz nową baseline", aby najpierw przeliczyć — baseline zapisana na podstawie nieaktualnego harmonogramu zamroziłaby niewłaściwe daty.

Baseline to migawka: początek, koniec i (dla kamieni milowych) data każdego zadania w momencie zapisania. Zmieniaj harmonogram dalej po tym, a baseline pozostaje niezmieniona, dopóki sam nie zapiszesz nowej.

## Widzenie odchylenia

### Na wykresie Gantta: nakładka baseline

Włącz nakładkę przez **Widok → grupa wstążki Baseline i postęp → Nakładka baseline**. Pod każdym paskiem zadania pojawia się cienki podpasek (lub romb dla kamienia milowego), w kolorze baseline, na oryginalnych datach baseline. Jeśli główny pasek wykracza poza swój podpasek, od razu widać, jak bardzo zadanie się opóźniło względem baseline — bez otwierania osobnego raportu.

### Jako raport: raport odchylenia

Przejdź na kartę **Raport**, wybierz **Variance** dla **Typu raportu**. Raport pokazuje, dla każdego zadania: **Początek baseline**, **Koniec baseline**, **Bieżący początek**, **Bieżący koniec**, **Δ początek (dr)**, **Δ koniec (dr)** oraz **Stan** (**Zgodnie z planem**, **Później**, **Wcześniej**, **Nowe** dla zadań dodanych od baseline, lub **Usunięte** dla zadań usuniętych od tego czasu). Na górze raport sumuje liczbę zadań, ile jest opóźnionych i ile wyprzedza harmonogram, oraz — jeśli data zakończenia projektu się przesunęła — wiersz z liczbą dni roboczych różnicy względem baseline. Jeśli nie ma aktywnej baseline, raport wprost to zaznacza, zamiast pokazywać pustą tabelę.

## Wprowadzanie postępu

Postęp ustawiasz w trzech miejscach, wszystkie z tym samym efektem:

1. **Panel właściwości** — sekcja **Postęp** pod zaznaczonym zadaniem: suwak dla **procentu ukończenia** oraz (dla zwykłego zadania) pola **Rzeczywisty początek**/**Rzeczywisty koniec**, albo (dla kamienia milowego) jedno pole **Rzeczywista data**. Przesuń procent powyżej 0% bez rzeczywistej daty początku, a zostanie ona automatycznie wypełniona planowanym wczesnym początkiem; cofnij poniżej 100%, a wprowadzona wcześniej rzeczywista data zakończenia zostanie ponownie wyczyszczona.
2. **Okno dialogowe zadania** — ta sama sekcja **Postęp**, w oknie **Edytuj zadanie**.
3. **Menu kontekstowe** — kliknij prawym przyciskiem zadanie, podmenu **Postęp**, ze stałymi krokami **0%**, **25%**, **50%**, **75%** i **100%**. Przydatne dla szybkiej aktualizacji bez otwierania panelu; dla pośredniego procentu lub konkretnej rzeczywistej daty użyj panelu lub okna dialogowego zadania.

Rzeczywiste daty nigdy nie mogą wypadać później niż data statusu — spróbuj wprowadzić późniejszą, a aplikacja odrzuci ją z błędem. To celowa granica: „fakt" (coś, co faktycznie się wydarzyło) z definicji nie może leżeć w przyszłości względem momentu, w którym rejestrujesz postęp.

## Data statusu

**Data statusu** (grupa wstążki **Baseline i postęp** na karcie Planowanie, pole **Data statusu**) oznacza „dzisiaj" w ramach harmonogramu — moment, na który zarejestrowano postęp. Gdy jest ustawiona, robi jednocześnie dwie rzeczy:

- Każde zadanie lub kamień milowy, które jeszcze się nie zaczęły (0% ukończenia, brak rzeczywistego początku), nie mogą zacząć się wcześniej niż data statusu, nawet jeśli logika (poprzednicy, relacje) w przeciwnym razie pozwoliłaby na wcześniejszy start. Ich obliczony wczesny początek zostaje „podłogowany" do daty statusu.
- Zadania, które już się zaczęły lub zakończyły, zachowują swoje rzeczywiste daty — te nigdy nie są nadpisywane przez datę statusu.

Możesz to dokładnie zobaczyć w średniej wielkości przykładzie: przy dacie statusu ustawionej na 20 maja 2027, kilka jeszcze nierozpoczętych zadań (na przykład murowanie i roboty hydrauliczne w różnych domach) ma swój wczesny początek przypięty dokładnie do tej daty, mimo że działają w różnych domach i bez podłogi daty statusu zaczęłyby się w różnych, wcześniejszych terminach.

### Dlaczego nieoznaczony kamień milowy „przesuwa się w prawo"

W obliczeniu kamień milowy to nic więcej niż zadanie z zerowym czasem trwania, więc obowiązuje ta sama reguła: jeśli nie został jeszcze oznaczony jako ukończony (brak 100%, brak rzeczywistej daty), jego obliczona data nie może wypaść przed datą statusu. Przesuwaj datę statusu dalej, nie oznaczając kamienia milowego jako ukończonego, a jego wyświetlana data na wykresie Gantta wciąż przesuwa się razem z nią w prawo, mimo że nic się nie zmieniło w leżących u podstaw zadaniach — harmonogram w istocie mówi „ten moment nie może leżeć w przeszłości, jeśli jeszcze go nie odhaczyłeś". Gdy tylko oznaczysz kamień milowy jako ukończony z rzeczywistą datą, wraca on do tej ustalonej daty i przestaje się przesuwać.

## Ostrzeżenia o niezgodnej kolejności

Gdy tylko istnieje data statusu, obliczenie sprawdza też, czy zarejestrowane fakty (rzeczywiste daty początku/końca) nie przeczą logice relacji — na przykład następnik, który już się rozpoczął, podczas gdy jego poprzednik, zgodnie z harmonogramem, nie powinien jeszcze się zakończyć. Takie przypadki nazywane są **niezgodnymi z kolejnością** i pojawiają się jako ostrzeżenie na pasku stanu na dole ekranu („N relacji poza kolejnością"), z podpowiedzią pokazującą liczbę. To ostrzeżenie, nie blokujący błąd — obliczenie mimo to kontynuuje.

Rozwiąż ostrzeżenie o niezgodnej kolejności, rejestrując rzeczywistą sytuację dokładnie: wypełnij brakującą lub nieprawidłową rzeczywistą datę początku/końca na zaangażowanych zadaniach (przez panel, okno dialogowe zadania lub menu kontekstowe, jak powyżej), aby zarejestrowane fakty ponownie zgadzały się z tym, co logicznie musiało je poprzedzać. Często oznacza to po prostu: zadanie, które w rzeczywistości już się zakończyło, nie zostało jeszcze tak oznaczone w harmonogramie.

## Linia postępu

Włącz linię postępu przez **Widok → grupa wstążki Baseline i postęp → Linia postępu**. Rysuje ona pomarańczową przerywaną linię (wzór kreski 4/4, ten sam styl co linia daty statusu), która wykreśla dla każdego zadania punkt na pozycji odpowiadającej jego procentowi ukończenia i łączy go z datą statusu — klasyczny wzór zygzaka. Załamanie na lewo od daty statusu oznacza, że zadanie jest opóźnione względem tego, czego można by oczekiwać na podstawie upływu czasu; załamanie na prawo oznacza, że wyprzedza harmonogram. Linia postępu sama już rysuje pionową linię daty statusu jako kręgosłup zygzaka, więc osobny przełącznik **Linia daty statusu** (ta sama grupa wstążki) cofa się na dalszy plan, gdy linia postępu jest włączona — staje się ponownie widoczny dopiero, gdy wyłączysz linię postępu, a nadal chcesz, aby data statusu była pokazana jako zwykła linia pionowa.

## Czytaj dalej

- Zobacz baseline przed startem i postęp w połowie projektu w praktyce: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zobacz dwie baseline (kontraktowa → przeliczona baseline po zleceniu zmiany) w praktyce: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Zasoby i ich obciążenie są również przeliczane przy każdym F5 — przeczytaj przewodnik [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram) o nadmiernym przydzieleniu i bilansowaniu.
- Postęp i data statusu mogą powodować ujemny zapas na zadaniu, które jest już ustalone — przeczytaj przewodnik [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse), aby dowiedzieć się, jak to odczytać.
