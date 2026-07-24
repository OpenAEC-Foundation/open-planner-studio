# Relacje i ograniczenia

Zadania, które istnieją samodzielnie, nie przesuwają się, gdy zmienia się harmonogram. Relacje rejestrują tę zależność; ograniczenia rejestrują twardy lub miękki wymóg dotyczący daty. Ten przewodnik wchodzi głębiej w oba tematy niż [Szybki start](docs://quick-start): kiedy wybrać który typ relacji, co dokładnie robi zwłoka/wyprzedzenie, co oznacza twarde przypięcie i kiedy konkretnie *nie* powinno się go używać, oraz jak termin ostateczny odnosi się do ograniczenia.

## Czego się tu nauczysz

- Czterech typów relacji (FS/SS/FF/SF) i kiedy stosować każdy z nich.
- Zwłoki i wyprzedzenia, w tym zwłoki procentowej i zwłoki w dniach kalendarzowych (na przykład dla dojrzewania betonu).
- Trzech sposobów dodawania relacji: przeciąganie, zaznaczenie i tabela relacji.
- Wszystkich ośmiu typów ograniczeń, plus twardego przypięcia (P6 Mandatory) i ograniczenia drugorzędnego.
- Różnicy między terminem ostatecznym a ograniczeniem.

Podążaj za przykładem podstawowym [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (pozwolenie SNET, nakładanie SS, powiązanie FF), a dla konfliktu terminu ostatecznego — za [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Cztery typy relacji

Każda relacja ma **Poprzednika** i **Następnika** oraz jeden z czterech typów:

- **FS — Finish-Start**: następnik zaczyna się dopiero, gdy poprzednik zostanie zakończony. Zdecydowanie najczęstsza relacja w budownictwie: najpierw fundament, potem stan surowy. Użyj FS, gdy jedno zadanie fizycznie nie może się zacząć, dopóki drugie nie zostanie ukończone.
- **SS — Start-Start**: oba zadania zaczynają się (mniej więcej) w tym samym czasie. Użyj tego, gdy dwa zadania mogą działać razem, gdy tylko pierwsze ruszy — na przykład roboty ścienne i konstrukcja dachu zaczynające się z nakładaniem, gdy stan surowy jest już w trakcie, bez czekania jednego na zakończenie drugiego.
- **FF — Finish-Finish**: oba zadania kończą się (mniej więcej) w tym samym czasie. Przydatne, gdy dwa zadania mogą działać niezależnie, ale muszą zostać ukończone razem — na przykład malowanie, które musi zakończyć się krótko po pracach glazurniczych, aby pomieszczenie można było odebrać za jednym razem.
- **SF — Start-Finish**: poprzednik musi się zacząć, zanim następnik będzie mógł się zakończyć. Zdecydowanie najrzadszy typ w praktyce budowlanej — zarezerwuj go dla przypadków szczególnych, gdy zadanie wykończeniowe może się zatrzymać dopiero po rozpoczęciu innego zadania (na przykład przekazanie zmiany).

Chcesz rozpoznać te pierwsze trzy typy w prawdziwym przykładzie? Przykład „Verbouwing & Aanbouw Eengezinswoning" zawiera łańcuch FS między głównymi fazami, nakładanie SS między robotami ściennymi a konstrukcją dachu oraz powiązanie FF między pracami glazurniczymi a malarskimi.

## Zwłoka i wyprzedzenie

Relacja nie musi być zerowa: **zwłoka** (dodatnia) dodaje czas oczekiwania między poprzednikiem a następnikiem, **wyprzedzenie** (ujemne, wprowadzane jako liczba ujemna) pozwala następnikowi zacząć się wcześniej — celowe nakładanie. Pole zwłoki (**Zwłoka**, w panelu właściwości i w tabeli relacji) akceptuje krótki zapis:

- `2d` — 2 dni robocze zwłoki (jednostka domyślna: dni w kalendarzu projektu).
- `3ed` — 3 dni **kalendarzowe**: dni, które biegną też przez weekendy i święta. To jednostka, której chcesz na przykład dla **dojrzewania betonu**: beton dojrzewa również w sobotę i niedzielę, więc zwłoka „3 dni robocze" zaniżyłaby czas dojrzewania, jeśli w międzyczasie wypadnie weekend. W takim przypadku ustaw zwłokę na jednostkę kalendarzową.
- `50%` — zwłoka procentowa: 50% czasu trwania poprzednika, przeliczana przy każdym przebiegu CPM w miarę zmiany czasu trwania poprzednika (ta sama logika co w MS Project). Przydatne, gdy czas oczekiwania naturalnie skaluje się z wielkością poprzedzającego zadania.
- `-25e%` — ujemna, procentowa zwłoka kalendarzowa: wyprzedzenie równe 25% czasu trwania poprzednika, w dniach kalendarzowych.

Liczba ujemna (wyprzedzenie) oznacza, że następnik zaczyna się, gdy poprzednik wciąż trwa — na przykład prace glazurnicze, które zaczynają się już w ostatnich dniach tynkowania w tym samym pomieszczeniu.

## Dodawanie relacji

Istnieją trzy sposoby utworzenia relacji, w zależności od tego, gdzie akurat pracujesz:

1. **Przeciąganie na wykresie Gantta**: przytrzymaj **Shift** i przeciągnij od paska poprzednika do paska następnika. Zaraz po zwolnieniu przycisku myszy zostaje od razu utworzona relacja FS ze zwłoką 0, a od razu pojawia się okno **Typ relacji** — tam możesz dostosować typ (FS/SS/FF/SF) i zwłokę, bez otwierania panelu właściwości.
2. **Zaznaczenie + przycisk**: zaznacz najpierw poprzednika, przytrzymaj Ctrl/Cmd i zaznacz następnie następnika (w tej kolejności), po czym kliknij **Nowa relacja z zaznaczenia** (grupa wstążki **Relacje** na karcie **Planowanie**, albo sama karta **Relacje**). Ten przycisk działa tylko wtedy, gdy zaznaczone są dokładnie dwa zadania.
3. **Bezpośrednio w tabeli relacji**: otwórz kartę **Relacje** (przez **Zarządzaj** w grupie wstążki Relacje). Tabela pokazuje, dla każdej relacji, kolumny **Poprzednik**, **Typ**, **Zwłoka**, **Następnik**, **Wiodąca** i **Zapas swobodny** — typ i zwłokę można edytować bezpośrednio tutaj, także dla relacji utworzonych wcześniej przez przeciąganie lub zaznaczenie.

Kolumna **Wiodąca** pokazuje, po obliczeniu, która relacja rzeczywiście decyduje o dacie początku lub końca następnika — dla zadania z wieloma poprzednikami niekoniecznie jest to relacja utworzona najniedawniej, lecz ta z najpóźniejszą (wiodącą) datą.

## Typy ograniczeń

Ograniczenie narzuca granicę daty na zadanie, niezależnie od jego relacji. Open Planner Studio ma osiem typów, ustawianych przez pole **Ograniczenie** w panelu właściwości:

- **Jak najwcześniej (ASAP)** — brak granicy daty, wartość domyślna.
- **Jak najpóźniej (ALAP)** — zadanie przesuwa się tak daleko, jak to możliwe, w ramach swojego zapasu.
- **Rozpocznij nie wcześniej niż (SNET)** — dolna granica daty rozpoczęcia (na przykład: nie zaczynaj przed uzyskaniem pozwolenia).
- **Rozpocznij nie później niż (SNLT)** — górna granica daty rozpoczęcia.
- **Zakończ nie wcześniej niż (FNET)** — dolna granica daty zakończenia.
- **Zakończ nie później niż (FNLT)** — górna granica daty zakończenia.
- **Musi rozpocząć się (MSO)** — stała data rozpoczęcia.
- **Musi zakończyć się (MFO)** — stała data zakończenia.

SNET/SNLT/FNET/FNLT to wszystko **granice miękkie**: obliczenie CPM bierze je pod uwagę, ale naruszenie prowadzi „tylko" do ujemnego zapasu, a nie do awarii czy blokady. Przykład „Verbouwing & Aanbouw Eengezinswoning" wykorzystuje na przykład ograniczenie SNET, aby zadanie nie mogło zacząć się przed uzyskaniem pozwolenia.

### Twarde przypięcie (P6 Mandatory)

MSO i MFO mogą dodatkowo zostać uczynione **twardymi** przez pole wyboru **Obowiązkowe (twarde przypięcie)**, które pojawia się tylko dla tych dwóch typów. Jest to ograniczenie „P6 Mandatory" z Primavera P6: pasek jest ustawiony na stałe na tej dacie, nawet jeśli jego poprzednicy logicznie temu przeczą. Gdy włączysz twarde przypięcie, Open Planner Studio pokazuje jednorazowe ostrzeżenie: **twarde przypięcie nadpisuje relacje — pasek jest ustawiony na stałe na tej dacie, nawet przed poprzednikami. Naruszenie zamienia się w ujemny zapas w górę strumienia.**

Używaj więc twardego przypięcia tylko wtedy, gdy data naprawdę nie podlega negocjacji i stoi z boku logiki harmonogramu — na przykład prawnie ustalona data odbioru, która obowiązuje niezależnie od postępu. **Nie** używaj go jako reguły kciuka dla „chcę, żeby to zadanie było na tej dacie": w takim przypadku ograniczenie miękkie (SNET/FNLT/itp.) albo po prostu dobrze zaplanowany łańcuch relacji jest niemal zawsze lepszym wyborem. Twarde przypięcie może ścisnąć całą sieć w górę strumienia: jeśli poprzedzające zadania chcą przebiegać przez przypięcie, pojawia się ujemny zapas i propaguje się przez cały łańcuch przed przypiętym zadaniem — to sygnał, że harmonogram jest w konflikcie, a nie że przypięcie rozwiązało problem.

### Ograniczenie drugorzędne

Dla ograniczenia nietwardego (czyli nie ASAP/ALAP i nie twardego MSO/MFO) można dodać **ograniczenie drugorzędne**: drugą granicę z tych samych czterech typów miękkich (SNET/FNET/SNLT/FNLT), która nie może ograniczać tej samej strony co ograniczenie podstawowe. Pozwala to na przykład ustawić jednocześnie zarówno dolną, jak i górną granicę daty rozpoczęcia. Open Planner Studio waliduje kombinację na bieżąco i pokazuje błąd, gdy tylko kombinacja jest nieprawidłowa — na przykład ograniczenie drugorzędne obok twardego przypięcia, co jest niedozwolone.

## Terminy ostateczne kontra ograniczenia

**Termin ostateczny** (osobne pole w panelu właściwości) wygląda jak ograniczenie, ale celowo się od niego różni: jest to miękka, informacyjna górna granica daty zakończenia, pokazywana na wykresie Gantta jako znacznik w kształcie strzałki skierowanej w dół — zielonej, dopóki zadanie jest jeszcze na czas, czerwonej, gdy jego wczesne zakończenie ją przekroczy. Termin ostateczny nie wymusza harmonogramu (w przeciwieństwie do ograniczenia MFO/FNLT, które aktywnie uczestniczy w obliczeniu), ale liczy się jako górna granica przy obliczaniu zapasu: jeśli harmonogram naturalnie nie dotrzymuje terminu ostatecznego, powstaje **ujemny zapas**, bez udziału jakiegokolwiek ograniczenia.

Dokładnie to dzieje się w przykładzie [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): zawiera on celowo napięty umowny termin ostateczny, którego naturalny czas trwania harmonogramu nie dotrzymuje, co skutkuje widocznym ujemnym zapasem — dobry przykład do obejrzenia, jeśli chcesz zobaczyć, jak wygląda konflikt terminu ostatecznego w praktyce, bez niczego „zepsutego": harmonogram po prostu przelicza się do końca i pokazuje, gdzie jest pod presją.

Zasada praktyczna: użyj **terminu ostatecznego** dla docelowej daty, którą chcesz monitorować bez wymuszania logiki harmonogramu, a użyj **ograniczenia** (miękkiego lub, wyjątkowo, twardego), gdy data naprawdę jest granicą, której obliczenie musi przestrzegać.

## Czytaj dalej

- Zobacz SNET, nakładanie SS i powiązanie FF w praktyce: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Zobacz konflikt terminu ostatecznego w praktyce: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Struktura jeszcze nie gotowa? Przeczytaj najpierw [Planowanie i WBS](docs://gids-plannen-wbs).
- Dla kalendarzy i czasów pracy, które wpływają na czas trwania zadań: przewodnik [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren).
