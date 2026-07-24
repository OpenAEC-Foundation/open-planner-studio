# Ścieżka krytyczna i analiza zaawansowana

Każdy harmonogram ma najdłuższy łańcuch zadań, które razem decydują o tym, kiedy projekt się kończy: ścieżkę krytyczną. Wszystko poza nią ma zapas — miejsce na opóźnienie bez wpływu na datę zakończenia. Ten przewodnik wykracza poza „które paski są czerwone": zapas całkowity/swobodny/interferujący, prace prawie krytyczne, wiele jednakowo krytycznych ścieżek, hammocki, twarde przypięcia i ich efekt w górę strumienia oraz łącza zewnętrzne między projektami.

## Czego się tu nauczysz

- Odczytywania ścieżki krytycznej i różnicy między zapasem całkowitym, swobodnym i interferującym.
- Prac prawie krytycznych: ustawiania progu i rozpoznawania oznaczenia bursztynowego.
- Wielu ścieżek krytycznych naraz — kiedy to się zdarza i jak to widać.
- Twardych przypięć i ich wpływu na zapas, w tym ujemnego zapasu powstającego w górę strumienia.
- Hammocków (Level of Effort): co robią, a czego nie robią.
- Łączy zewnętrznych między projektami: zamrożonej kotwicy, odświeżania i statusu „źródło niewczytane".
- Śledzenia ścieżki przez menu kontekstowe lub wstążkę.
- Sekcji **Obliczenia** w ustawieniach projektu.

Podążaj za przykładem [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — dużym przykładem „wszystko naraz" z trzema równoległymi wieżami, który pokazuje niemal każdy temat z tego przewodnika: wiele ścieżek krytycznych, prace prawie krytyczne, hammock, twarde przypięcie i łącze zewnętrzne do osobnego pliku źródłowego.

## Odczytywanie ścieżki krytycznej

Naciśnij **F5** (lub przycisk **Oblicz**), aby uruchomić harmonogram. Pasek stanu na dole pokazuje wtedy na przykład „Ścieżka krytyczna: N zadań, M dni roboczych" — liczbę zadań na ścieżce krytycznej i łączny czas trwania. Na wykresie Gantta zadania krytyczne otrzymują własny (czerwony) kolor paska: zadania bez zapasu, gdzie każdy dzień opóźnienia bezpośrednio przesuwa datę zakończenia projektu.

Kliknij dwukrotnie zadanie i poszukaj w sekcji **Wynik CPM** dokładnych liczb: **Wczesny początek**, **Wczesny koniec**, **Późny początek**, **Późny koniec**, **Zapas całkowity**, **Zapas swobodny** i (tam, gdzie ma to zastosowanie) **Zapas interferujący**, plus to, czy zadanie jest na ścieżce krytycznej. Chcesz mieć te pola jako kolumny w tabeli zadań? **Widok → Kolumny…** i zaznacz je.

### Zapas całkowity, swobodny i interferujący

- **Zapas całkowity** — o ile zadanie może się łącznie opóźnić bez wpływu na datę zakończenia projektu. Zero oznacza krytyczne.
- **Zapas swobodny** — o ile zadanie może się opóźnić bez wpływu na jego bezpośredni następny następnik. Może być mniejszy niż zapas całkowity: zadanie może mieć pewien zapas całkowity, a mimo to, jeśli opóźni się o jeden dzień, jego bezpośredni następnik już się przesuwa razem z nim (ten następnik ma wtedy wystarczający własny zapas, by nie dotknąć daty zakończenia).
- **Zapas interferujący** — różnica między tymi dwoma (zapas całkowity − zapas swobodny): część Twojego zapasu, która nie dotyka daty zakończenia, ale „przeszkadza" następnikowi. Zero oznacza, że zapas swobodny i całkowity są równe — opóźnienie w ramach zapasu wtedy nikomu nie przeszkadza.

## Prace prawie krytyczne

Zadanie z małym, niezerowym zapasem całkowitym jest wrażliwe: mały wstrząs czyni je jednak krytycznym. Włącz to przez **Info o projekcie → Obliczenia → Oznaczaj jako prawie krytyczne**, z **Progiem** w dniach roboczych (lub godzinach, w zależności od Twojego wyświetlania czasu trwania). Każde zadanie z zapasem całkowitym większym od zera i mniejszym lub równym temu progowi otrzymuje bursztynowy kolor paska na wykresie Gantta — pomiędzy czerwienią krytycznego a zielenią obfitego zapasu.

Duży przykład ustawia próg na 3 dni robocze. Ostateczna inspekcja **Tower C** ma więc dokładnie 3 dni robocze zapasu całkowitego — tuż w granicach progu — podczas gdy identyczne ostateczne inspekcje **Tower A** i **Tower B** mają zerowy zapas i są rzeczywiście krytyczne. Tower C jest identyczna z pozostałymi dwiema pod względem zadań i czasów trwania, z wyjątkiem jednego nieco krótszego zadania wykończeniowego; ta niewielka różnica wystarcza dokładnie, aby przesunąć ją z krytycznej do prawie krytycznej.

## Wiele ścieżek krytycznych

Zwykle istnieje dokładnie jeden najdłuższy łańcuch, ale może się zdarzyć, że dwa lub więcej łańcuchów mają dokładnie tę samą długość — wtedy oba (lub wszystkie) są jednakowo krytyczne. Włącz **Wiele ścieżek zapasu** (**Info o projekcie → Obliczenia**), aby to obliczyć: wybierz **Metodę** (**Zapas swobodny (peeling)** lub **Zapas całkowity (ranking)**) i **Maks. ścieżek**. Każde zadanie otrzymuje wtedy numer **Ścieżki zapasu** (1 = najbardziej krytyczna); zadanie bez ścieżki zapasu nie znajduje się na żadnej z obliczonych ścieżek.

W dużym przykładzie Tower A i Tower B są w pełni symetryczne pod względem zadań i czasów trwania — kończą się dokładnie w tym samym momencie. Gdy tylko włączysz **Wiele ścieżek zapasu**, zobaczysz więcej niż jedną ścieżkę w wynikach (`criticalPaths.length` większe niż 1 w obliczeniu): nie jeden najdłuższy łańcuch, lecz kilka jednakowo krytycznych łańcuchów przebiegających przez projekt. To inny sygnał niż „jedna ścieżka krytyczna z pewną pracą prawie krytyczną obok" — oznacza, że opóźnienie w *którejkolwiek* z tych ścieżek uderza w datę zakończenia jednakowo, więc nie możesz skupić uwagi na jednym łańcuchu.

## Twarde przypięcia i ich wpływ na zapas

**Twarde przypięcie** (pole wyboru **Obowiązkowe (twarde przypięcie)** na ograniczeniu MSO lub MFO) przypina zadanie do daty, nawet jeśli jego poprzednicy logicznie temu przeczą. Duży przykład wykorzystuje to na „Wegafzetting gemeente (vergunde stremmingsperiode)" (zamknięcie drogi przez gminę, zezwolony okres zamknięcia): gmina zezwala na zamknięcie tylko dokładnie w tym zezwolonym terminie, kropka — logika sieci wygina się wokół tego.

Efekt w górę strumienia jest trudniejszą częścią do przejrzenia: jeśli poprzednicy przypiętego zadania potrzebują więcej czasu, niż jest dostępny do daty przypięcia, na tych poprzednikach pojawia się **ujemny zapas**. Ujemny zapas nie jest więc błędem obliczenia: to sposób, w jaki silnik mówi „ten poprzedzający łańcuch nie mieści się już w czasie, na jaki pozwala przypięcie". Jeśli widzisz ujemny zapas w górę strumienia od twardego przypięcia, pytanie nie brzmi „co tu jest zepsute", lecz „które z tych dwóch rzeczy musi ustąpić: data przypięcia czy czas trwania łańcucha przed nim".

Uwaga: w dużym przykładzie cały łańcuch wokół „Wegafzetting gemeente" — łącznie z samym przypiętym zadaniem — od dawna jest w pełni ukończony (rzeczywisty początek i koniec, dobrze przed datą statusu). Z tego powodu zobaczysz tam niewielki resztkowy ujemny zapas w całym łańcuchu fazy 1, łącznie z samym zadaniem przypięcia: to cecha charakterystyczna już ukończonych zadań w połączeniu z datą statusu, a nie scenariusz „poprzednicy się nie mieszczą" opisany powyżej. Aby zobaczyć ten scenariusz w czystej postaci: tymczasowo wyczyść datę statusu (grupa wstążki **Baseline i postęp**, przycisk **Wyczyść datę statusu**) i przelicz ponownie — zadanie przypięcia wraca wtedy z powrotem do zerowego zapasu całkowitego, a ujemny zapas pojawia się dopiero wtedy, gdy celowo wydłużysz poprzedzający łańcuch ponad miejsce dostępne przed datą przypięcia.

## Hammocki (Level of Effort)

**Hammock** (pole wyboru **Hammock (czas trwania pochodny)** w panelu właściwości) to zadanie bez własnego wprowadzanego czasu trwania: jego początek i koniec wynikają automatycznie z jego własnych relacji. Przychodzące relacje **FS**/**SS** dostarczają **driver początku** (najwcześniejszy początek), przychodzące relacje **FF**/**SF** dostarczają **driver końca** (najpóźniejszy koniec) — panel pokazuje oba tylko do odczytu, gdy tylko zaznaczysz pole hammock, dzięki czemu dokładnie widzisz, które zadania decydują o rozpiętości. Bez drivera końca rozpiętość wraca do zerowej długości, z ostrzeżeniem w panelu.

Co robi hammock: pokazuje, jako rodzaj nadrzędnego paska, pełną rozpiętość fragmentu pracy, bez konieczności samodzielnego utrzymywania czasu trwania — przydatne na przykład dla „nadzoru" albo „ogólnych kosztów ogólnych placu budowy", które dosłownie trwają tak długo, jak leżąca u podstaw praca. Czego hammock nie robi: nie niesie żadnych zasobów ani własnej logiki wpływającej na obliczenie CPM — to widok pochodny, nie zadanie wiodące. Duży przykład wykorzystuje to dla „Ruwbouw toren A (LOE)" (stan surowy, wieża A): hammock, który zaczyna się, gdy tylko rozpocznie się pierwsze prawdziwe zadanie stanu surowego wieży A, i kończy się, gdy tylko zostanie ukończone ostatnie z nich, nie znajdując się nigdzie pomiędzy sam w sobie.

## Łącza zewnętrzne między projektami

Duże projekty czasami składają się z kilku oddzielnie zarządzanych podharmonogramów — na przykład Twojego własnego harmonogramu głównego i pakietu robót terenowych zarządzanego przez innego wykonawcę. **Łącze zewnętrzne** (okno **Łącze zewnętrzne (między projektami)**, otwierane przyciskiem na karcie **Relacje**) rejestruje relację do zadania w takim innym pliku, bez konieczności otwierania tego pliku jako dokumentu.

Wybierasz **Plik źródłowy** spośród swoich ostatnich plików (jest on wczytywany tylko do odczytu, nigdy nie jest otwierany jako dokument) albo wypełniasz **Ręcznie** identyfikatorem projektu, identyfikatorem zadania i datą zakotwiczenia, jeśli nie masz pliku źródłowego pod ręką. Następnie wybierasz **Kierunek** (poprzednik lub następnik), **Typ relacji** (FS/SS/FF/SF) i **Zwłokę**. **Data zakotwiczenia** — data zadania źródłowego w momencie, gdy je połączono — jest zamrożona w Twoim własnym pliku; ta data nie podąża automatycznie, jeśli projekt źródłowy się zmieni.

Chcesz wiedzieć, czy plik źródłowy został od tamtej pory zaktualizowany? Przejdź na kartę **Relacje**, sekcję **Łącza zewnętrzne**, i kliknij **Odśwież to łącze** (dla jednego łącza) albo **Odśwież kotwice zewnętrzne** (wszystkie naraz), aby ponownie odczytać plik źródłowy i zaktualizować kotwicę. Jeśli plik źródłowy jest niedostępny — przeniesiony, zmieniono jego nazwę, albo nigdy nie został dołączony — łącze pokazuje etykietę **nieaktualne** z podpowiedzią „źródło niewczytane — zaimportuj ponownie, aby odświeżyć": aplikacja nie może wtedy sama zweryfikować, czy zamrożona kotwica nadal obowiązuje.

Duży przykład celowo demonstruje dokładnie tę ostatnią ścieżkę: zadanie „Bestrating parkeerterrein" (Nawierzchnia parkingu) jest połączone z plikiem źródłowym od podwykonawcy robót terenowych, który celowo *nie* jest dołączony do przykładu. Otwórz zadanie, a zobaczysz łącze wymienione ze statusem „nieaktualne" — uczciwa demonstracja tego, co się dzieje, gdy zewnętrzny plik źródłowy nie jest już dostępny, zamiast łącza, które zawsze odświeża się bezbłędnie.

## Śledzenie ścieżki

Chcesz dokładnie zobaczyć, które zadania wpływają na dane zadanie w górę i w dół strumienia? Kliknij prawym przyciskiem zadanie i wybierz **Śledź ścieżkę** (lub **Zatrzymaj śledzenie ścieżki**, aby to wyłączyć) — podświetla to za jednym razem cały łańcuch poprzedników i następników. Do bardziej ukierunkowanej pracy wstążka (karta **Planowanie** lub **Relacje**, grupa wstążki **Śledzenie ścieżki**) ma osobną parę przycisków **Poprzedniki**/**Następniki**: oba wyłączone nic nie pokazuje, jeden włączony pokazuje ten jeden kierunek, oba włączone to to samo co polecenie z menu kontekstowego. Śledzenie rozróżnia też wszystkie logicznie połączone zadania od tych, które faktycznie **decydują** o dacie (ta sama relacja „Wiodąca" pokazana w tabeli relacji) — więc widzisz nie tylko to, co jest połączone, ale co faktycznie steruje.

## Ustawienia obliczeń

Sekcja **Obliczenia** w **Info o projekcie** (Backstage → Info o projekcie, albo okno **Info o projekcie**) gromadzi opcje obliczeń, które należą do tego konkretnego projektu — należą one do pliku, nie do aplikacji, więc kolega otwierający ten sam plik otrzyma ten sam wynik:

- **Definicja krytyczności** — **Zapas całkowity ≤ próg** (domyślny próg 0) albo **Najdłuższa ścieżka**, która oznacza zadania jako krytyczne na podstawie najdłuższego łańcucha w sieci, niezależnie od ich liczby zapasu.
- **Obliczanie zapasu** — jak zapas całkowity jest ustalany dla zadania z zarówno stroną początkową, jak i końcową: **Najmniejszy (początek/koniec)** (domyślnie), **Zapas początku** lub **Zapas końca**.
- **Zadania z otwartym końcem krytyczne** — automatycznie traktuje zadania bez następnika jako krytyczne.
- **Oznaczaj jako prawie krytyczne** z **Progiem** (patrz wyżej).
- **Wiele ścieżek zapasu** z **Metodą** i **Maks. ścieżek** (patrz wyżej).
- **Kalendarz zwłoki** — który kalendarz jest używany dla zwłoki w dniach roboczych: kalendarz **Poprzednika**, **Następnika**, zawsze **24-godzinny**, albo **Kalendarz projektu**.

## Czytaj dalej

- Zobacz wiele ścieżek krytycznych, prace prawie krytyczne, hammock, twarde przypięcie i łącze zewnętrzne, wszystko w jednym harmonogramie: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relacje, zwłoka/wyprzedzenie i ograniczenia (w tym twarde przypięcie) są wyjaśnione bardziej szczegółowo w przewodniku [Relacje i ograniczenia](docs://gids-relaties-constraints).
- Bilansowanie może zmienić strukturę ścieżki krytycznej — przeczytaj przewodnik [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram).
- Postęp i data statusu mogą powodować ujemny zapas na już ustalonym zadaniu — przeczytaj przewodnik [Baseline i postęp](docs://gids-baselines-voortgang).
