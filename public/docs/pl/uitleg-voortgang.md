# Postęp, data statusu i plan bazowy

Harmonogram jest prognozą. Gdy praca już trwa, chcesz wiedzieć, co jest ukończone, co jeszcze zostało i co to oznacza dla przekazania. Ten artykuł wyjaśnia, jak aplikacja przetwarza postęp. Pokazuje, co robi data statusu, jak aplikacja oblicza pozostałą pracę i dlaczego zadanie, które już się zaczęło, czasem nadal czeka na swojego poprzednika. Wyjaśnia też, jak porównujesz stan bieżący z pierwotnym uzgodnieniem. Przykład pokazuje liczby.

## Koncepcja

**Postęp** to to, co się naprawdę wydarzyło. Dla każdego zadania aplikacja zapisuje trzy rzeczy: procent, **rzeczywiste rozpoczęcie** i **rzeczywiste zakończenie**. To, co harmonogram przewidywał, zostaje obok. Rzeczywista data pokazuje, co naprawdę się stało.

**Data statusu** to dzień, w którym robisz podsumowanie. Wszystko, co wydarzyło się przed tym dniem, jest faktem. Wszystko, co jeszcze musi się wydarzyć, aplikacja planuje od początku tego dnia. Rzeczywista data może przypadać w dniu statusu, ale nigdy po nim.

**Pozostała praca** to praca, która jeszcze zostaje na zadaniu. Zadanie na 4 dni robocze, wykonane w 25%, ma 3 dni robocze pozostałej pracy.

**Plan bazowy** to zapisana kopia planowanych dat. Zwykle zapisujesz go w chwili, gdy uzgodnienie zostaje zatwierdzone. Później zestawiasz rzeczywisty harmonogram z planem bazowym i widzisz, jak daleko wykonanie odbiega od planu.

## Jak aplikacja oblicza

Przykład poniżej używa profilu obliczeń *Open Planner Studio*, z którym nowy projekt jest obliczany. Dalej przeczytasz, co różni się w profilach Primavera P6 i Microsoft Project.

Aplikacja sama z siebie nie przelicza. Po każdej zmianie postępu lub daty statusu pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Planowanie › Harmonogram › Oblicz*. Jeśli *Oblicz automatycznie* jest włączone (w *Ustawienia › Projekt › Ustawienia aplikacji*, karta *Planowanie*, nagłówek *Obliczanie*), aplikacja robi to sama.

### Data statusu

Data statusu robi trzy rzeczy.

Po pierwsze aplikacja odrzuca rzeczywistą datę, która przypada po dacie statusu. Data równa dacie statusu jest w porządku.

Po drugie zadanie, które jeszcze się nie zaczęło, nie może leżeć w przeszłości. Jeśli takie zadanie jest planowane przed datą statusu, aplikacja przesuwa je na datę statusu. Dotyczy to także zadań po nim, które przesuwają się przez swoje relacje. Efekt zobaczysz w poniższym przykładzie. W profilu Microsoft Project aplikacja tego nie robi.

Po trzecie pozostała praca zadania, które już trwa, zaczyna się w samym dniu statusu. Aplikacja traktuje datę statusu jako początek tego dnia. Jeśli robisz podsumowanie w piątek po godzinach, ustaw datę statusu na poniedziałek. Ustawiona na piątek data statusu oznacza, że aplikacja nadal planuje pozostałą pracę na ten piątek.

Jeśli nie masz jeszcze daty statusu, a wpisujesz postęp, aplikacja ustawia datę statusu na dzisiaj i o tym informuje. Inną datę ustawisz w *Planowanie › Plan bazowy i postęp › Data statusu*. Bez daty statusu aplikacja liczy zadanie w toku do przodu z jego pozostałym czasem trwania, ale do tyłu z jego pełnym czasem trwania. Zapas wychodzi wtedy ujemny i zadanie wygląda na krytyczne bez powodu.

### Procent, rzeczywiste daty i pozostały czas trwania

Pola zależą od siebie. Wypełnisz jedno, a aplikacja uzupełni pozostałe.

- Procent powyżej 0 oznacza, że zadanie się zaczęło. Nie podasz rzeczywistego rozpoczęcia? Wtedy aplikacja przyjmuje planowany start. Jeśli zadanie jest planowane na start po dacie statusu, aplikacja najpierw pyta, kiedy naprawdę się zaczęło.
- Procent 100 oznacza ukończone. Nie podasz rzeczywistego zakończenia? Wtedy zakończenie to data statusu, nawet jeśli praca była skończona wcześniej.
- Rzeczywiste zakończenie daje zadaniu 100%. Zmienisz ukończone zadanie na mniej niż 100%? Wtedy rzeczywiste zakończenie znika. Wyczyścisz rzeczywiste zakończenie? Wtedy procent wraca do 0, a zadanie zostaje *W toku*, aż wyczyścisz też rzeczywiste rozpoczęcie.
- **Pozostały czas trwania** to czas trwania razy część, która jeszcze zostaje, zaokrąglony do pełnych dni roboczych. Zadanie na 2 dni robocze: przy 0% i przy 25% pozostają 2 dni robocze pozostałej pracy, a przy 50% i 75% po 1. Przy 90% aplikacja zaokrągla do 0: pozostała praca jest wtedy wykonana w dniu statusu. Zadanie w godzinach liczy się w pełnych minutach: zadanie 5 godzin przy 40% ma 3 godziny pozostałej pracy.
- Kamień milowy ma tylko jedną rzeczywistą datę.
- Zadanie sumaryczne (faza) nie ma własnego postępu. Po obliczeniu jego procent wynika z zadań pod nim: średnia ważona ich procentów, z czasem trwania w dniach roboczych jako wagą. Kamień milowy waży 0.

Zmieniasz czas trwania zadania, które już trwa? Wykonana praca zostaje wykonana. Procent się dopasowuje: zadanie na 5 dni roboczych, wykonane w 60%, ustawione na 10 dni roboczych, ma 30%. Aplikacja odrzuca czas trwania krótszy niż już wykonana praca.

### Ukończone i trwające zadania

Ukończone zadanie jest ustalone na swoich rzeczywistych datach. Już się nie przesuwa i przy dacie statusu nigdy nie jest krytyczne. Bez daty statusu ukończone zadanie może nadal być krytyczne.

Zadanie w toku zachowuje swoje rzeczywiste rozpoczęcie. Przesuwa się tylko pozostała praca. Od trybu postępu zależy, gdzie zaczyna się pozostała praca.

### Retained Logic i Progress Override

Co robi aplikacja, jeśli zadanie już się zaczęło, a jego poprzednik nadal trwa? Taka relacja nazywa się **poza kolejnością**: postęp przeczy kolejności. Pomyśl o malarzu, który już zaczyna w pomieszczeniu, które jest otynkowane, podczas gdy tynkarz jest jeszcze zajęty gdzie indziej.

Dwa tryby postępu określają, jak aplikacja to oblicza:

- **Retained Logic** (domyślny): relacja pozostaje w mocy. Pozostała praca następnika podąża za relacją: przy relacji zakończenie-rozpoczęcie zaczyna się dopiero, gdy poprzednik jest zakończony, i nigdy przed datą statusu.
- **Progress Override**: rzeczywistość wygrywa. Pozostała praca następnika zaczyna się w dniu statusu, bez czekania na poprzednika.

W tym profilu różnica dotyczy tylko pozostałej pracy zadań, które już się zaczęły, podczas gdy ich poprzednik nie jest jeszcze zakończony. Inne zadania liczą w obu trybach tak samo. Aplikacja zgłasza taką relację w obu trybach: w pasku stanu jako *Relacje poza kolejnością: 1* i w panelu *Ostrzeżenia*.

### Plany bazowe i odchylenia

Przy zapisie aplikacja zapisuje dla każdego zadania bez podzadań najwcześniejsze rozpoczęcie, najwcześniejsze zakończenie, czas trwania i typ kamienia milowego. Zadań sumarycznych w nim nie ma. Późniejsze zmiany nie wpływają na plan bazowy. Możesz zachować kilka planów bazowych; dokładnie jeden jest **aktywny**. Widok Gantt, raport variance i *Raport postępu* korzystają z aktywnego planu bazowego.

**Odchylenie** to różnica w dniach roboczych między planem bazowym a bieżącym harmonogramem. Plus oznacza później, minus wcześniej. Aplikacja liczy w kalendarzu projektu. Raport variance pokazuje odchylenie startu i zakończenia dla każdego zadania. Status wynika tylko z zakończenia: *Później* przy plusie, *Wcześniej* przy minusie, w innym razie *Zgodnie z planem*. Zadanie dodane po planie bazowym nazywa się *Nowe*. Zadanie, które już nie istnieje, to *Usunięte*.

Dwie uwagi. Odchylenie czasu trwania znajduje się w tabeli zadań (kolumna *Odchylenie czasu trwania*), nie w raporcie variance. Porównuje ono bieżący planowany czas trwania zadania z tym w planie bazowym. Postęp nie zmienia tego planowanego czasu trwania: zadanie planowane na dwa dni, które trwało trzy dni, ma więc odchylenie zakończenia +1, ale odchylenie czasu trwania 0. Jeśli zapiszesz plan bazowy po wpisaniu postępu, zapisuje on stan z tymi rzeczywistymi datami. Odchylenie wynosi wtedy zero.

*Raport postępu* zestawia postęp planowany z postępem rzeczywistym. Obie wartości są ważone dniami roboczymi. *Planowane* to część każdego zadania, która według planu bazowego miała być ukończona w dniu statusu. *Rzeczywiste* to wpisany procent.

### Gdzie to widzisz

W widoku Gantt przerywana linia oznacza datę statusu, a data pojawia się w nagłówku. Przy każdym zadaniu w toku linia wybrzusza się do punktu na pasku, który wskazuje procent. To jest **linia postępu**. Jeśli wyłączysz *Linia postępu*, a *Linia daty statusu* pozostanie włączona, zostaje prosta linia. Wyłączysz obie? Znika linia i etykieta. Przyciski *Nakładka planu bazowego*, *Linia postępu* i *Linia daty statusu* znajdziesz w *Widok › Plan bazowy i postęp*. Nie zmieniają obliczeń. Plan bazowy pojawia się jako cienki pasek pod każdym paskiem zadania. Tabela zadań ma kolumny dla postępu i, dla każdego planu bazowego, dla odchylenia. Na karcie *Raport* znajdziesz typy raportów *Variance* i *Raport postępu*.

## Przykład: rozbudowa po trzech tygodniach

Przykład to projekt do ćwiczeń *House extension* z samouczków, w stanie po dodaniu wszystkich relacji: bez urlopu budowlanego, zasobów i godzin. W samouczku 6 robisz to sam w projekcie do ćwiczeń. Ten projekt ma wtedy więcej elementów, więc liczby się tam różnią. Tutaj czytasz, dlaczego liczby są takie, jakie są.

Rozbudowa zaczyna się w poniedziałek 7 czerwca 2027 r. Na obliczonym harmonogramie aplikacja zapisuje plan bazowy o nazwie *Plan bazowy*: przekazanie w piątek 6 sierpnia 2027 r., 45 dni roboczych.

### Stan w poniedziałek 28 czerwca

Data statusu to poniedziałek 28 czerwca 2027 r. Oto, co się wydarzyło:

- *Start of construction*, *Set up site*, *Clear garden and paving* i *Set out the extension* są ukończone zgodnie z planem, od 7 do 10 czerwca.
- *Excavate foundation trench* było planowane na 2 dni robocze (piątek 11 i poniedziałek 14 czerwca), a trwało 3: od 11 do 15 czerwca.
- *Foundation formwork and reinforcement* trwa od 16 do 18 czerwca. *Reinforcement inspection* przypada na 18 czerwca, *Pour foundation* na poniedziałek 21 czerwca.
- *Foundation brickwork* (2 dni robocze) zaczęło się w piątek 25 czerwca i jest wykonane w 50%.

Po **Oblicz** aplikacja liczy tak:

- Pozostała praca zadania foundation brickwork wynosi 2 × (1 − 0,5) = 1 dzień roboczy. Zaczyna się w dniu statusu, więc kończy się w poniedziałek 28 czerwca.
- *Lay hollow-core floor* następuje we wtorek 29 czerwca. W efekcie *Build inner cavity leaf* zaczyna się w środę 30 czerwca zamiast we wtorek 29 czerwca. Przekazanie przypada w poniedziałek 9 sierpnia: o jeden dzień roboczy później niż w planie bazowym. Ten jeden dodatkowy dzień wykopu przesuwa więc cały projekt o dzień, bo to zadanie leżało na ścieżce krytycznej.
- Pasek stanu pokazuje *Ścieżka krytyczna: 13 zadań, 46 dni roboczych*, w porównaniu z 21 zadaniami i 45 dniami roboczymi przed wpisaniem postępu. Osiem ukończonych zadań, które leżały na ścieżce krytycznej, już się nie liczy.
- Zadanie sumaryczne *Foundations* jest w 77,8%. Zadania w nim ważą 2 + 3 + 1 + 2 + 1 = 9 dni roboczych. Ukończone to 2 + 3 + 1 dni roboczych, plus połowa z 2: razem 7. A 7 z 9 to 77,8%. Kamień milowy *Reinforcement inspection* waży 0.

Raport variance zestawia to z planem bazowym:

- *Excavate foundation trench*: rozpoczęcie 0, zakończenie +1 (zakończenie w planie bazowym 14 czerwca, teraz 15 czerwca).
- *Foundation brickwork*: rozpoczęcie +1 (24 czerwca stało się 25 czerwca), zakończenie +1.
- *Build outer cavity leaf*: +1, +1. To zadanie nadal nie jest krytyczne: miało 2 dni robocze zapasu i zachowuje je.
- *Handover*: +1. Koniec projektu odchyla się o 1 dzień roboczy.
- W sumie 19 zadań ma status *Później*, a 4 ma status *Zgodnie z planem*. Żadne zadanie nie ma statusu *Wcześniej*.

*Raport postępu* pokazuje *Planowane* 28,3% i *Rzeczywiste* 23,9%. Zadania ważą razem 46 dni roboczych. Według planu bazowego miało być ukończone 13 dni roboczych: 4 na przygotowanie, 2 na wykop, 3 na zbrojenie, 1 na wylanie, 2 na foundation brickwork i 1 na hollow-core floor. Rzeczywiście ukończone jest 11 dni roboczych: 4 + 2 + 3 + 1, plus pół dnia foundation brickwork.

### Co, jeśli przesuniesz datę statusu?

Ten sam postęp, inna data statusu. Pozostała praca zadania foundation brickwork zawsze zaczyna się w dniu statusu, więc przekazanie przesuwa się razem z nią:

- Data statusu piątek 25 czerwca: pozostała praca przypada na piątek 25 czerwca, przekazanie zostaje w piątek 6 sierpnia.
- Poniedziałek 28 czerwca: przekazanie w poniedziałek 9 sierpnia.
- Wtorek 29 czerwca: przekazanie we wtorek 10 sierpnia, o 2 dni robocze później niż w planie bazowym.

### Co, jeśli zmienisz procent?

Zadanie foundation brickwork ma 2 dni robocze. Przy 0% albo 25% pozostała praca to 2 dni robocze: kończy się we wtorek 29 czerwca, a przekazanie wypada we wtorek 10 sierpnia. Przy 50% albo 75% to 1 dzień roboczy: poniedziałek 28 czerwca, przekazanie w poniedziałek 9 sierpnia. Przy 90% pozostała praca wynosi 0, a zadanie kończy się w dniu statusu.

### Co, jeśli ustawisz datę statusu bez wpisywania postępu?

Jeśli tylko ustawisz datę statusu na poniedziałek 28 czerwca i nic nie wpiszesz, to zgodnie z harmonogramem nic się jeszcze nie wydarzyło. Praca, która się jeszcze nie zaczęła, nie może leżeć w przeszłości. Aplikacja więc przesuwa wszystko na 28 czerwca: *Start of construction* przypada wtedy tego dnia, a przekazanie w piątek 27 sierpnia, o 15 dni roboczych później niż w planie bazowym. Wpisz więc najpierw istniejący postęp.

## Przykład: tynkarz i malarz

Teraz przykład dla trybu postępu. Ten sam przykład, inny stan: jest środa 21 lipca 2027. Wszystko aż do *Install building services* włącznie jest zakończone zgodnie z planem. *Plastering* (4 dni robocze) rozpoczęło się we wtorek 20 lipca i jest na poziomie 25%. *Painting* (3 dni robocze) następuje po tynkowaniu, ale malarz już dziś zaczął i jest na poziomie 33%.

Bez postępu tynkowanie było planowane od wtorku 20 do piątku 23 lipca, a malowanie od poniedziałku 26 do środy 28 lipca. Pasek stanu pokazuje teraz *Relacje poza kolejnością: 1*: malowanie się rozpoczęło, a tynkowanie nie jest zakończone. W panelu *Ostrzeżenia* jest napisane: *Poza kolejnością: postęp następnika przeczy relacji*.

*Plastering* ma 4 × (1 − 0,25) = 3 dni robocze pozostałej pracy: 21, 22 i 23 lipca. Malowanie ma 3 × (1 − 0,33) = 2 dni robocze pozostałej pracy.

- Przy **Retained Logic** pozostała praca może się zacząć dopiero, gdy tynkowanie jest zakończone. To jest piątek 23 lipca, więc malowanie zaczyna się w poniedziałek 26 lipca i kończy we wtorek 27 lipca. Pasek biegnie od rzeczywistego rozpoczęcia 21 lipca do 27 lipca. Zapas całkowity wynosi 7 dni roboczych.
- Przy **Progress Override** pozostała praca zaczyna się w dacie statusu. Malowanie kończy się w czwartek 22 lipca, przed zakończeniem tynkowania. Zapas całkowity wynosi 10 dni roboczych.

Przekazanie zostaje w piątek 6 sierpnia w obu przypadkach: malowanie i tak miało zapas.

### Inne profile obliczeń

W profilach Primavera P6 i Microsoft Project malowanie w tym przykładzie kończy się w tych samych datach (27 i 22 lipca). Różnią się w poniższych punktach. To konwencje profilu; znajdziesz je w *Ustawienia › Projekt › Ustawienia projektu*, w bloku *Profil obliczeń i opcje*.

- W profilu Microsoft Project praca, która się jeszcze nie rozpoczęła, nie przesuwa się do daty statusu (konwencja *Nie przesuwaj nierozpoczętych zadań do daty stanu*). Jeśli w przykładzie powyżej ustawisz tylko datę statusu i nic nie wpiszesz, przekazanie w tym profilu zostaje w piątek 6 sierpnia.
- W profilu Microsoft Project pozostała praca też nie zaczyna się wcześniej niż rzeczywiste rozpoczęcie plus czas, który upłynął (konwencja *Pozostała praca wznawia się po upływie czasu*). To jest dodatkowa dolna granica obok daty statusu: liczy się późniejsza z obu. Weź *Build inner cavity leaf* (5 dni roboczych), rozpoczęte we wtorek 29 czerwca i na poziomie 40% w środę 30 czerwca, czyli w dniu daty statusu (dwie ekipy murują jednocześnie, więc 40% jest już po jednym dniu). Wszystko przed nim jest zakończone zgodnie z planem. Open Planner Studio i Primavera P6 pozwalają zadaniu zakończyć się w piątek 2 lipca; Microsoft Project w poniedziałek 5 lipca, ponieważ wtorek 29 czerwca plus 2 dni robocze, które upłynęły, to czwartek 1 lipca, czyli po dacie statusu.
- Primavera P6 pokazuje jako najwcześniejsze rozpoczęcie zadania w toku początek pozostałej pracy, nie rzeczywiste rozpoczęcie (w przykładzie z wewnętrznym murem: środa 30 czerwca). Kolumna *Początek* i pasek pokazują we wszystkich profilach rzeczywiste rozpoczęcie.
- W profilu Primavera P6 przy Progress Override relacja do następnika, który już się rozpoczął, też nie liczy się dla poprzednika: wtedy nie ogranicza już jego późnych terminów ani jego zapasu swobodnego (konwencja *Progress Override pomija rozpoczętego następnika także wstecz*). W przykładzie tynkarza i malarza tego nie widać, bo tynkowanie jest tak czy tak krytyczne przez wylewkę: jego późne terminy i zapas swobodny są takie same przy Retained Logic i przy Progress Override.
- Gdy otworzysz plik .xer, aplikacja przejmuje tryb postępu z pliku. Actual Dates, trzeci tryb P6, nie jest aplikacji znany; taki plik liczy się jako Retained Logic.

## Konsekwencje i nieporozumienia

**„Przesunę tylko datę statusu.”** Jeśli ją przesuniesz, pozostała praca zadań w toku zaczyna się od nowej daty, a praca, która jeszcze się nie rozpoczęła, nigdy nie może leżeć przed tą datą. Przesuwaj datę statusu dlatego tylko razem z aktualizacją postępu.

**„Wpisanie 100% zapisuje rzeczywiste zakończenie.”** Tylko wtedy, gdy wpiszesz też rzeczywiste zakończenie. Jeśli ustawisz zadanie na 100% bez rzeczywistego zakończenia, staje się ono datą statusu. Jeśli zostało w rzeczywistości zakończone wcześniej, wpisz rzeczywiste zakończenie.

**„0% znaczy, że nie rozpoczęto.”** Jeśli zadanie ma rzeczywiste rozpoczęcie, liczy się jako rozpoczęte, nawet przy 0%. Pozostała praca to wtedy pełny czas trwania i zaczyna się w dacie statusu. Usuń rzeczywiste rozpoczęcie, aby zadanie znowu liczyło się jako nierozpoczęte.

**„Progress Override usuwa ostrzeżenie.”** Komunikat o postępie poza kolejnością pozostaje. Tryb decyduje tylko o tym, jak aplikacja liczy. Jeśli relacja nie jest już właściwa, zmień relację.

**„Przerwa w zadaniu w trybie podziału odpada.”** Nie. Przerwa w części, która jeszcze do zrobienia, zostaje w pozostałej pracy. Weź zadanie o 5 dniach roboczych z 1-dniową przerwą po 2 dniach pracy, rozpoczęte we wtorek 29 czerwca i, przy dacie statusu w środę 30 czerwca, na poziomie 40%. Pozostała praca wynosząca 3 dni robocze zaczyna się w dacie statusu i przechodzi przez przerwę: zakończenie to poniedziałek 5 lipca. Bez przerwy byłoby to piątek 2 lipca.

**Godziny a data statusu.** W wstążce nie wpiszesz godziny: wpisujesz datę statusu jako datę. Jeśli robisz podsumowanie po godzinach pracy, ustaw datę statusu na najbliższy dzień roboczy. Zadanie w godzinach liczy pozostałą pracę od początku daty statusu. Weź *Lay hollow-core floor* w projekcie ćwiczeniowym po samouczku 4, w chwili gdy wszystko przed nim jest zakończone: 5 godzin, w poniedziałek 28 czerwca, dzień roboczy od 07:00. Przy dacie statusu w poniedziałek 28 czerwca i zadaniu na 40% zostają 3 godziny pozostałej pracy, od 07:00 do 10:00, nawet jeśli tego ranka już coś zrobiono. Jak aplikacja liczy godziny, wyjaśnia [Dni i godziny](docs://uitleg-dagen-en-uren).

**Aktualizacja planu bazowego.** To nie jest możliwe. Zapisujesz nowy plan bazowy i usuwasz stary. Jeśli przesuniesz projekt, rzeczywiste daty i data statusu przesuwają się razem z nim, ale plany bazowe domyślnie nie: dzięki temu przesunięcie zostaje widoczne jako odchylenie. Zobacz [Przenoszenie projektu](docs://howto-project-verplaatsen).

## Zobacz też

- [Aktualizacja postępu](docs://howto-voortgang-bijwerken): ustawianie daty statusu i wpisywanie postępu.
- [Import postępu z arkusza](docs://howto-voortgang-importeren): jednorazowe wczytanie postępu od pracowników budowy.
- [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen): ustawianie Retained Logic lub Progress Override.
- [Zapisywanie i zarządzanie planem bazowym](docs://howto-baseline-opslaan-en-beheren): zapisywanie planu bazowego i jego używanie.
- [Przenoszenie projektu](docs://howto-project-verplaatsen): co się dzieje z rzeczywistymi datami, datą statusu i planami bazowymi.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): dlaczego zadanie jest krytyczne i co oznacza zapas.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): postęp i data statusu w połowie projektu (20 maja 2027).
