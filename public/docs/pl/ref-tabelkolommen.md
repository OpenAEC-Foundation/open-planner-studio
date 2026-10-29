# Kolumny tabeli

Tabela zadań ma 86 stałych kolumn, plus jedną kolumnę na każdy kod czynności i pole niestandardowe projektu oraz osiem kolumn na każdy plan bazowy. Ten artykuł opisuje dla każdej kolumny, co pokazuje, czy możesz ją edytować i w jakiej postaci zapisywana jest wartość. Jak wybierać i układać kolumny, opisano w [Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen).

## Gdzie wybierasz kolumny

Tabela zadań obok wykresu Gantt oraz tabela na karcie *Tabela* mają każda swój własny wybór kolumn. Znak plus z prawej strony nagłówka otwiera wybór kolumn (tytuł okna *Wybierz kolumnę*). Na karcie *Tabela* możesz też użyć *Tabela › Kolumny › Kolumny…*. Wybór kolumn pokazuje kolumny według kategorii: *Zadanie*, *Planowanie*, *Ograniczenia*, *Relacje*, *Zasoby*, *Postęp*, *Obliczone*, *Plan bazowy*, *Niestandardowe* i *Techniczne*. Szukasz po nazwie, a na górze jest *Ostatnio używane*. *Przywróć domyślne* przywraca domyślne kolumny.

Domyślnie tabela obok wykresu Gantt pokazuje *WBS*, *Nazwa zadania* i *Czas trwania*. Tabela na karcie *Tabela* pokazuje *WBS*, *Nazwa zadania*, *Czas trwania*, *Początek*, *Koniec*, *Rodzaj robót*, *Krytyczne* i *Zapas całkowity* oraz *Postęp*, plus jedną kolumnę na każdy kod czynności i pole niestandardowe projektu.

## Jak odczytywać i edytować wartości

- **Kolumny obliczone** — kolumny w kategorii *Obliczone* oraz kilka innych są tylko do odczytu: pochodzą z obliczeń. Jeśli spróbujesz edytować komórkę tylko do odczytu, aplikacja pokaże *Tej kolumny obliczeniowej nie można edytować.* To ogólny komunikat dla każdej komórki tylko do odczytu, także wtedy, gdy kolumna nie jest obliczana. Jeśli są nieaktualne, bo coś zmieniłeś, obok nich pojawia się *nieaktualne*, dopóki nie naciśniesz *Oblicz*.
- **Daty** — wyświetlane są w zapisie, który wybrano w oknie *Ustawienia aplikacji*, na karcie *Wygląd*, w sekcji *Format daty*.
- **Czas trwania i zapas** — czas trwania pojawia się w jednostce zadania (`5d`, `12h`) albo zgodnie z ustawieniem *Wyświetlanie czasu trwania* na tej samej karcie (*Automatycznie (własna jednostka dla zadania)*, *Zawsze w dniach* lub *Zawsze w godzinach*). Zapas pojawia się w dniach roboczych, z dwoma miejscami po przecinku i separatorem dziesiętnym Twojego języka.
- **Tak/Nie** — wartość tak/nie pojawia się jako *Tak* lub *Nie*; pusta wartość jako myślnik (—).
- **Edycja** — wpisz lub wybierz wartość. Nieprawidłowa wartość zostaje odrzucona z powodem pod komórką, na przykład *Wprowadź prawidłowy czas trwania, np. 5d lub 8h.* albo *Wprowadź procent od 0 do 100.* Wklejanie bloku komórek działa komórka po komórce; komórki tylko do odczytu są pomijane, a aplikacja podaje, ile ich było.

## Zadanie

- **Nazwa zadania** — nazwa zadania. Można edytować; pole jest wymagane. Zadanie sumaryczne wyświetla się pogrubione, z lekko jaśniejszym tłem w komórce nazwy. Kamień milowy wyświetla się pogrubiony w kolorze kamienia milowego (ta sama rodzina kolorów co kamień milowy na wykresie Gantt). Zwykłe zadanie wygląda tak samo. To tylko formatowanie: zaznaczanie, przeciąganie i edycja działają tak samo.
- **Opis** — opis. Można edytować; dowolny tekst.
- **WBS** — kod WBS. Można edytować, pole jest wymagane, ale tylko do odczytu, gdy włączone jest *WBS auto*.
- **Rodzaj robót** — rodzaj robót zadania (*Budowa*, *Instalacja*, *Rozbiórka*, *Logistyka*, *Inspekcja*, *Przeniesienie*, *Renowacja*, *Konserwacja* lub *Inne*). Można edytować z listy.
- **Niestandardowy rodzaj robót** — niestandardowy rodzaj robót z projektu albo myślnik. Można edytować z listy niestandardowych rodzajów robót projektu.
- **Kolor** — zapisany kolor zadania, jako kod koloru, na przykład `#1a73e8`. Można edytować w selektorze kolorów. Kolor jest zapisany w pliku IFC, ale żaden pasek ani raport go nie używa. Kolory pasków ustawiasz w *Widok › Plan bazowy i postęp › Kolory słupków*.
- **Notatki** — notatki w postaci `✓ text; ○ text`. Można edytować, dopóki jest co najwyżej jedna notatka (edytujesz wtedy jej tekst). Przy większej liczbie notatek są tylko do odczytu.

## Planowanie

- **Kamień milowy** — czy zadanie jest kamieniem milowym. Można edytować. Po włączeniu czas trwania wynosi 0. Aplikacja odrzuca tę zmianę dla zadania sumarycznego i dla zadania z przydziałami.
- **Typ kamienia milowego** — *Kamień milowy początkowy* lub *Kamień milowy końcowy*, albo myślnik dla automatycznego. Można edytować tylko dla kamienia milowego.
- **Obowiązkowy kamień milowy** — flaga *Obowiązkowy (umowny)*. Można edytować tylko dla kamienia milowego.
- **Priorytet bilansowania** — liczba całkowita od 0 do 1000, domyślnie 500. Można edytować. Wartość 1000 przypina zadanie do bilansowania.
- **Luki podziału** — liczba przerw, w postaci `Split gaps: 2`, albo myślnik. Tylko do odczytu; edytujesz je w panelu *Właściwości*.
- **Typ zadania** — typ zadania; pusta wartość oznacza domyślną wartość projektu. Można edytować z listy, ale dla kamienia milowego, zadania sumarycznego lub hamaka pole jest puste i tylko do odczytu. Widoczne w oknie wyboru tylko wtedy, gdy widoczne są typy zadań (*Używaj typów zadań*, albo plik zawiera typy zadań).
- **Hamak (wyliczony czas trwania)** — czy zadanie jest hamakiem. Można edytować, z wyjątkiem kamienia milowego i zadania sumarycznego.
- **Kalendarz** — identyfikator własnego kalendarza zadania; pusta wartość (—) oznacza kalendarz projektu. Wpisujesz identyfikator albo wybierasz go z podpowiedzi; nieznany identyfikator zostaje odrzucony. Uwaga: komórka pokazuje obecnie wewnętrzny identyfikator zamiast nazwy. Lepiej wybierz kalendarz w panelu *Właściwości*.
- **Typ czasu trwania** — *Czas pracy* (czas trwania liczy się w dniach roboczych lub godzinach pracy z kalendarza) albo *Czas, który upłynął* (czas trwania liczy się w ciągłym czasie zegarowym, bez kalendarza). Można edytować.
- **Jednostka czasu trwania** — *Dni* lub *Godziny*. Można edytować, z wyjątkiem zadania sumarycznego, hamaka i kamienia milowego. Przełączenie działa tylko wtedy, gdy przeliczenie jest dokładne i włączono *Włącz planowanie godzinowe*.
- **Czas trwania** — czas trwania zadania, w jednostce zadania albo zgodnie z ustawieniem *Wyświetlanie czasu trwania*. Można edytować: wpisz `5d`, `12h` lub `1h 30m`; możesz też wpisać liczbę w jednostce zadania. Tylko do odczytu dla zadania sumarycznego, hamaka oraz kamienia milowego z czasem trwania 0.
- **Początek** — wyświetlany początek, ta sama data co pasek na wykresie Gantt. Dla zadania, które się rozpoczęło, to rzeczywiste rozpoczęcie. Można edytować. Zadanie z poprzednikiem, któremu nadasz nowy początek, dostaje ograniczenie *Rozpocznij nie wcześniej niż (SNET)* na tę datę. Tylko do odczytu dla zadania sumarycznego lub hamaka, chyba że jest planowane ręcznie, oraz dla zadania, które się rozpoczęło (*To zadanie zostało rozpoczęte; jego początek to rzeczywiste rozpoczęcie. Zmień je przez postęp.*).
- **Koniec** — wyświetlane zakończenie. Dla ukończonego zadania to rzeczywiste zakończenie. Można edytować: nowe zakończenie wyznacza nowy czas trwania. Aplikacja odrzuca tę zmianę dla kamienia milowego, zadania z czasem, który upłynął, zadania z przerwami oraz zakończenia przed początkiem (*Koniec przypada przed początkiem.*). Tylko do odczytu dla zadania sumarycznego lub hamaka, chyba że jest planowane ręcznie, oraz dla ukończonego zadania (*To zadanie jest ukończone; jego koniec to rzeczywiste zakończenie. Zmień je przez postęp.*).
- **Planowany początek** — punkt kotwiczenia, od którego zaczyna się obliczenie (niekoniecznie wyświetlany początek). Można edytować; działa tak samo jak wpisanie wartości w kolumnie *Początek*.
- **Planowane zakończenie** — wpisane zakończenie. Można je edytować tylko przy zadaniu planowanym ręcznie. W innym przypadku aplikacja pokazuje *Planowane zakończenie dotyczy tylko zadania planowanego ręcznie. Zmień koniec w kolumnie Koniec lub przez czas trwania.*

## Ograniczenia

- **Typ ograniczenia** — typ ograniczenia, od *Jak najwcześniej (ASAP)* do *Musi zakończyć się (MFO)*. Można edytować. Zadanie bez ograniczenia pokazuje *ASAP*.
- **Data ograniczenia** — data ograniczenia. Można edytować.
- **Twarde ograniczenie** — flaga *Obowiązkowe (twarde przypięcie)*. Można edytować tylko przy *MSO* i *MFO*.
- **Typ ograniczenia drugorzędnego** — typ drugiej granicy albo myślnik. Można edytować. Tabela zadań oferuje wszystkie typy, ale niedozwolona kombinacja zostaje odrzucona: musi to być *SNET*, *FNET*, *SNLT* lub *FNLT*. Główne ograniczenie musi być granicą (nie *ASAP*, *ALAP*, *MSO*, *MFO* ani twardego ograniczenia), a obie granice muszą leżeć po przeciwnych stronach (dolna granica *SNET* lub *FNET* z górną granicą *SNLT* lub *FNLT*, albo odwrotnie).
- **Data ograniczenia drugorzędnego** — data drugiej granicy. Można edytować.
- **Termin ostateczny** — docelowa data zakończenia. Można edytować.

## Relacje

- **Poprzednicy** — poprzedniki w postaci `WBS type±lag`, oddzielone `; `, na przykład `1.2 FS+2d`. Można edytować, wpisując tę samą postać. Relacji zewnętrznej nie dodajesz tutaj, lecz w *Planowanie › Relacje › Połącz › Dodaj relację zewnętrzną…*.
- **Następniki** — następniki w tej samej postaci. Można edytować.
- **Relacja wiodąca** — relacje, które wyznaczają datę tego zadania, w postaci `← 1.2` (poprzednik) lub `→ 1.4` (następnik). Tylko do odczytu; nieaktualne, dopóki nie naciśniesz *Oblicz*.
- **Zapas swobodny** (w kategorii *Relacje*) — zapas swobodny dla każdej relacji, w postaci `← 1.2: 3d`. To nie jest ta sama kolumna co *Zapas swobodny* w kategorii *Obliczone*, która pokazuje zapas samego zadania. Tylko do odczytu.
- **Ostrzeżenia** — ostrzeżenia dla każdej relacji, na przykład *Poza kolejnością* lub *Nieuwzględniona w obliczeniach*. Tylko do odczytu. Zobacz [Powiadomienia i ostrzeżenia](docs://ref-meldingen).

## Zasoby

- **Przydzielone zasoby** — nazwy przydzielonych zasobów, oddzielone przecinkami. Można edytować: dodanie nazwy przydziela zasób z 1 jednostką dziennie, a usunięcie nazwy usuwa przydział. Tylko do odczytu dla kamienia milowego lub zadania sumarycznego.
- **Jednostki przydziału dziennie** — jednostki na zasób, w postaci `Name: 1; Name: 0.5`, z maksymalnie dwoma miejscami po przecinku. Zapisana wartość pozostaje dokładna. Można edytować przy zadaniu z przydziałami.
- **Planowane jednostki dziennie** — planowane jednostki na zasób, w postaci `Name: 1.11`, z maksymalnie dwoma miejscami po przecinku, jak przy *Jednostki przydziału dziennie*. Dotyczy tylko przydziału z Primavera P6 z inną pozostałą liczbą jednostek; *Jednostki przydziału dziennie* pokazują wtedy pozostałą liczbę jednostek. Tylko do odczytu.
- **Krzywa przydziału** — krzywa na zasób, w postaci `Name: Uniform`. Można edytować przy zadaniu z przydziałami.
- **Początek okna pracy** i **Zakończenie okna pracy** — okno pracy na zasób z zaimportowanego pliku, w postaci `Name: date`. Tylko do odczytu.
- **Praca planowana (godziny)** i **Praca rzeczywista (godziny)** — planowana i rzeczywista praca na zasób w godzinach, w postaci `Name: 617.14`, z maksymalnie dwoma miejscami po przecinku. Wartości pochodzą z zaimportowanego pliku. Tylko do odczytu.
- **Pozostała praca (godziny)** — pozostała praca na zasób w godzinach, w postaci `Name: 6` lub `Name: 26.67`: zapisana praca, a jeśli jej brak, pozostały czas trwania × jednostki. Można edytować przy zadaniu z przydziałami, do którego stosuje się typ zadania, z przecinkiem lub kropką jako separatorem dziesiętnym. Widoczne w oknie wyboru tylko wtedy, gdy widoczne są typy zadań. Żółte ⚠ w komórce oznacza, że zapisana praca różni się od jednostek × pozostałego czasu trwania, jak ⚠ przy *Praca (pozost.)* w panelu zadania.

## Postęp

- **Status** — *Nierozpoczęte*, *W toku* lub *Ukończone*. Można edytować, z wyjątkiem zadania sumarycznego.
- **Postęp** — procent w postaci `40%`. Można edytować, wpisując liczbę od 0 do 100, z wyjątkiem zadania sumarycznego.
- **Rzeczywiste rozpoczęcie** — data, w której zadanie się rozpoczęło. Można edytować, z wyjątkiem zadania sumarycznego.
- **Rzeczywiste zakończenie** — data, w której zadanie zostało zakończone. Można edytować, z wyjątkiem zadania sumarycznego.
- **Rzeczywisty czas trwania** — rzeczywisty czas trwania, jako liczba. Można edytować, z wyjątkiem zadania sumarycznego.
- **Pozostały czas trwania** — pozostały czas trwania, w jednostce zadania. Można edytować, z wyjątkiem zadania sumarycznego.
- **Data wznowienia** i **Data zatrzymania** — wznowienie i zatrzymanie trwającego zadania z pliku MS Project lub pliku Primavera. Tylko do odczytu.

Kolumny postępu stosują reguły postępu aplikacji: rzeczywista data późniejsza niż data statusu zostaje odrzucona. Dla zadania sumarycznego aplikacja pokazuje *Postęp zadania sumarycznego jest wyliczany z jego podzadań i nie można go tutaj zmienić.*

## Obliczone

Wszystkie kolumny w tej kategorii są tylko do odczytu.

- **Opóźnienie bilansowania** — o ile dni roboczych bilansowanie opóźniło zadanie; myślnik, jeśli nie zastosowano bilansowania.
- **Najwcześniejsze rozpoczęcie** i **Najwcześniejsze zakończenie** — najwcześniejsze daty z obliczeń. Dla zadania, które się rozpoczęło, mogą się one różnić od *Początek* i *Koniec*: profil obliczeń *Primavera P6* ustawia najwcześniejsze rozpoczęcie zadania w toku lub ukończonego na dacie statusu.
- **Najpóźniejsze rozpoczęcie** i **Najpóźniejsze zakończenie** — najpóźniejsze daty, w których zadanie może jeszcze się rozpocząć lub zakończyć, bez przesunięcia końca projektu.
- **Zapas swobodny** — o ile dni roboczych zadanie może się przesunąć, nie przesuwając następnika.
- **Zapas całkowity** — o ile dni roboczych zadanie może się przesunąć, nie przesuwając końca projektu. Ujemny, jeśli ograniczenia lub termin ostateczny nie mogą zostać spełnione.
- **Krytyczne** — *Tak*, jeśli zadanie leży na ścieżce krytycznej.
- **Kolidujący zapas** — zapas całkowity minus zapas swobodny.
- **Prawie krytyczne** — *Tak* dla zadania prawie krytycznego. Wypełnione tylko wtedy, gdy włączono *Oznaczaj jako prawie krytyczne* (*Ustawienia projektu*, blok *Profil obliczeń i opcje*); w przeciwnym razie myślnik.
- **Ścieżka zapasu** — numer ścieżki zapasu, 1 dla najbardziej krytycznej. Wypełnione tylko wtedy, gdy włączono *Wiele ścieżek zapasu*; w przeciwnym razie myślnik.
- **Źródło zarejestrowanych dat** — dopóki aplikacja pokazuje daty z pliku: *Częściowo niezapisane* przy zadaniu, dla którego plik nie zawiera wszystkiego. Widoczne w oknie wyboru kolumn tylko w tym widoku. Na osi bez zapisanych dat pojawia się *Niezapisane* w kolumnach późnych terminów i zapasu.

Zobacz [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad).

## Plan bazowy

Dla każdego planu bazowego projektu dodawane są kolumny, a przed nazwą kolumny stoi nazwa planu bazowego (`<baseline> — Scheduled start`). Są tylko do odczytu. Zadanie, którego nie ma w planie bazowym, pokazuje myślnik z podpowiedzią *Brak w tym planie bazowym*.

- **Planowany początek**, **Planowane zakończenie** i **Czas trwania** — początek, zakończenie i czas trwania zapisane w planie bazowym.
- **Odchylenie rozpoczęcia** i **Odchylenie zakończenia** — liczba dni roboczych między planem bazowym a wyświetlanym początkiem lub zakończeniem, w kalendarzu projektu; dodatnia, jeśli zadanie jest późniejsze.
- **Odchylenie czasu trwania** — bieżący czas trwania minus czas trwania w planie bazowym, w dniach roboczych.

## Niestandardowe

- **Kod czynności** — jedna kolumna na każdy kod czynności, z nazwą kodu. Pokazuje kod wybranej wartości. Można edytować: wpisz kod albo wybierz go z podpowiedzi. Nieznany kod zostaje odrzucony. Jeśli kod występuje więcej niż raz, aplikacja prosi Cię o wybór z listy.
- **Pole niestandardowe** — jedna kolumna na każde pole niestandardowe, z jego nazwą. Wpisywana wartość odpowiada typowi: tekst, liczba, liczba całkowita, koszt, data lub tak/nie. Można edytować.

Te kolumny należą do projektu, w którym jest dany kod lub pole. Zobacz [Kody i pola niestandardowe](docs://howto-codes-en-velden).

## Techniczne

Wszystkie kolumny w tej kategorii są tylko do odczytu. Pokazują dane, które aplikacja przechowuje, ale nie pokazuje w zwykłej kolumnie, na przykład do sprawdzenia importu.

- **ID zadania** — wewnętrzny identyfikator zadania.
- **ID zadania nadrzędnego** i **ID zadań podrzędnych** — identyfikatory zadania nadrzędnego i zadań podrzędnych.
- **ID zasobów** — identyfikatory zasobów przypisanych do zadania.
- **ID przydziału**, **ID zadania przydziału** i **ID zasobu przydziału** — identyfikatory przydziałów, zadań i zasobów tego zadania.
- **Czas trwania (minuty)** i **Pozostały czas trwania (minuty)** — czas trwania i pozostały czas trwania w minutach; wypełnione tylko przy zadaniu w godzinach.
- **Opóźnienie bilansowania (minuty)** i **Opóźnienie bilansowania w czasie, który upłynął** — opóźnienie bilansowania z MS Project w minutach oraz to, czy liczy się w czasie zegarowym.
- **Planowane ręcznie** — czy zadanie jest planowane ręcznie.
- **Typ zadania MS Project (import)** i **Sterowane nakładem pracy** — typ zadania i flaga sterowania nakładem pracy, tak jak miał je MS Project.
- **Pochodzenie Primavera P6** — pola źródłowe z pliku Primavera, jako `key: value`.
- **Jawne zadanie sumaryczne** — czy zadanie jest jawnym zadaniem sumarycznym bez podzadań (z pliku Primavera).
- **Dolna granica zakończenia (rozkład w czasie)**, **Kotwica początku (rozkład w czasie)**, **Segmenty czasu trwania (rozkład w czasie)** i **Kontury (rozkład w czasie)** — rozkład godzin z pliku MS Project, jako daty i liczby.
- **Dane kodów czynności**, **Dane pól niestandardowych** i **Dane notatek** — liczba przypisań kodów, pól niestandardowych i notatek.
- **Dane relacji wewnętrznych** i **Dane relacji zewnętrznych** — liczba relacji wewnętrznych i zewnętrznych.
- Dla każdego planu bazowego są tu także **Kamień milowy** i **Typ kamienia milowego**, tak jak zapisał je plan bazowy.
