# Formaty importu i eksportu

Dla każdego formatu pliku: czy można go otworzyć, zapisać i wyeksportować, co zostaje zachowane, a czego nie, i jaki profil obliczeń jest używany przy otwieraniu. Uzasadnienie i przykład z liczbami znajdziesz w [Pliki i formaty](docs://uitleg-bestanden).

## W skrócie

**Otwieranie** działa z IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` i `.xer`. Plik z innym rozszerzeniem aplikacja traktuje jak IFC.

**Zapisywanie** zawsze zapisuje IFC. Tylko otwarty plik IFC staje się celem zapisu. Projekt z innego formatu nie ma pliku po otwarciu, a *Zapisz* wtedy pyta, gdzie ma być zapisany plik IFC.

**Eksportowanie** działa do IFC, MS Project XML, Primavera P6 XML, CSV i dwóch arkuszy postępu (Excel i CSV). Eksport nie zmienia Twojego projektu.

**Tylko do odczytu** są `.mpp` i `.xer`: aplikacja może je otworzyć, ale nie zapisać.

**PDF** pochodzi tylko z raportu (zobacz [Typy raportów](docs://ref-rapporttypes)). Aplikacja nie odczytuje PDF.

**Gdzie.** Otwieranie: *Start › Plik › Otwórz*, *Plik › Otwórz* lub Ctrl+O. Eksport: *Start › Plik › Eksport* lub *Plik › Eksport*. Wypełniony arkusz postępu wczytujesz przez *Plik › Importuj* albo przyciskiem *Aktualizuj postęp z arkusza* w grupie wstążki *Postęp* na kartach *Planowanie*, *Tabela* i *Raport*.

**Profil obliczeń przy otwieraniu.** Każdy format otwiera się z profilem obliczeń. Co to jest, opisuje [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies). `.xer` otwiera się z *Primavera P6*, `.mpp` z *Microsoft Project*, a CSV, MS Project XML i P6 XML z *Open Planner Studio*. IFC zachowuje profil zapisany w pliku. Dla `.xer` i `.mpp` aplikacja zgłasza, że projekt liczy się w ten sposób. Tylko IFC zawiera profil obliczeń i opcje obliczeń. Z opcji obliczeń MS Project XML zapisuje co najwyżej próg krytyczny. Ponownie otwarty eksport innego formatu liczy się jako *Open Planner Studio*.

## IFC

**Otwieranie** — tak, `.ifc`. Aplikacja odczytuje IFC4 i IFC 4.3 (także ADD2). Plik w innym schemacie, na przykład IFC2X3, też się otwiera. Przy pierwszym zapisie wybierasz wtedy schemat, który aplikacja potrafi zapisać (zobacz [Wybieranie schematu IFC](docs://howto-ifc-schema-kiezen)). Profil obliczeń: ten zapisany w pliku.

**Zapisywanie** — tak, i to jedyny format, który można zapisać. *Zapisz* zapisuje cały projekt jako plik IFC, w schemacie IFC projektu (domyślnie IFC 4.3 ADD2). Plik staje się celem zapisu.

**Eksport** — tak, jako *IFC*, w schemacie IFC projektu (domyślnie IFC 4.3 ADD2). Domyślna nazwa: nazwa projektu z rozszerzeniem `.ifc`. Jeśli projekt jest połączony z biblioteką zasobów, pole wyboru *Zapisz również plik biblioteki* znajduje się pod kafelkami w *Plik › Eksport*. Po zaznaczeniu aplikacja pyta o miejsce na *nazwaprojektu-bibliotheek.ifc* obok projektu. Tego pola wyboru nie ma na liście na karcie *Start*.

**Co zostaje zachowane** — wszystko, co należy do projektu: zadania ze strukturą, czasem trwania, datami i postępem; relacje z opóźnieniem; ograniczenia i terminy ostateczne; kalendarze; zasoby i przydziały, w tym rozkład godzin; plany bazowe; kody czynności i pola niestandardowe; notatki; relacje zewnętrzne do innych projektów; przerwy; typy zadań i własne rodzaje robót; ustawienia projektu, na przykład datę statusu, tryb postępu, profil obliczeń i opcje obliczeń; powiązanie z biblioteką zasobów. Dla projektu z pliku `.xer` zostaje też oryginalny plik źródłowy. Własny rodzaj robót zapisuje się jako typ IFC `USERDEFINED` z jego nazwą w polu ObjectType. Dzięki temu inne programy IFC odczytują zadanie normalnie. Aplikacja zachowuje też stały identyfikator rodzaju robót, więc zmiana nazwy nie przerywa powiązania. Jeśli ktoś otworzy plik na innym komputerze, rodzaj pojawi się tam w *Z tego projektu*, a nie w *Moje rodzaje robót* tej osoby.

**Co się nie zachowuje** — układ ekranu (powiększenie, położenie przewijania, zaznaczone zadanie, zwinięte fazy, wybrany filtr i grupowanie) oraz ustawienia aplikacji ([Ustawienia aplikacji](docs://ref-instellingen)). Karta *IFC* to edytor z tekstem IFC Twojego projektu. *Generuj IFC* odświeża ten tekst, *Kopiuj* kopiuje go do schowka, a *Zastosuj* wczytuje tekst jako Twój projekt i zastępuje projekt na tej karcie.

## MS Project XML (MSPDI)

**Otwieranie** — tak. Aplikacja rozpoznaje plik `.xml` jako MS Project XML po elemencie głównym `Project` w przestrzeni nazw MS Project (albo bez przestrzeni nazw). Profil obliczeń: *Open Planner Studio*. Po otwarciu aplikacja w jednym komunikacie podaje, czego nie przejęła; zobacz [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen).

**Zapisywanie** — nie. Taki projekt nie dostaje celu zapisu.

**Eksport** — tak, jako *MS Project XML* (*Otwierane w Microsoft Project. Pełna struktura WBS*.). Domyślna nazwa: nazwa projektu z `.xml`.

**Co zostaje zachowane** — zadania ze strukturą (poziom i WBS), czasem trwania, datami i postępem; relacje z opóźnieniem, także w godzinach lub procentach; ograniczenia, w tym termin ostateczny; kalendarze, w tym kalendarze zadań i zasobów; zasoby i przydziały, w tym krzywą lub rozkład godzin; datę statusu; próg krytyczny jako liczbę całkowitą dni roboczych, 0 lub więcej, z *Zapas całkowity ≤ próg*; opis zadania (jako notatka); typ zadania (jako typ zadania MS Project); własny rodzaj robót w wolnym polu (`ExtendedAttribute`), które aplikacja odczytuje z powrotem i które MS Project może zignorować. Z Twoich planów bazowych zostaje tylko aktywny, jako plan bazowy 0. Zadanie w godzinach zachowuje swoją jednostkę, a kamień milowy swój rodzaj (rozpoczęcia, zakończenia lub automatyczny).

**Co się nie zachowuje** — notatki (lista kontrolna przy zadaniu), relacje zewnętrzne do innych projektów, kody czynności i pola niestandardowe, drugie ograniczenie, oznaczenie *Planowane ręcznie*, opóźnienie bilansowania, punkt wznowienia i zatrzymania zadania z postępem poza kolejnością, konwencje *Pozostała praca wznawia się po upływie czasu* i *Nie przesuwaj nierozpoczętych zadań do daty stanu* z profilu MS Project oraz pozostałe opcje obliczeń. Zadania z przerwami bez rozkładu godzin zostają zachowane, ale bez tych przerw.

**Święta przy otwieraniu.** Kalendarz pochodny dziedziczy wyjątki ze swojego kalendarza bazowego. Kalendarz z własnym tygodniem pracy i bez wyjątków nie dostaje świąt. Tylko kalendarz bez kalendarza bazowego, tygodnia pracy i wyjątków zachowuje standardowe holenderskie święta. Jeśli święta brakują, data zakończenia może być inna; zobacz [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren).

**Co się po drodze zmienia** — ograniczenie *Musi rozpocząć się (MSO)* lub *Musi zakończyć się (MFO)* bez wyboru *Obowiązkowe (twarde przypięcie)* staje się *Rozpocznij nie wcześniej niż (SNET)* albo *Zakończ nie wcześniej niż (FNET)*. Hamak staje się zwykłym zadaniem z obliczonymi datami. MS Project XML zapisuje godziny na dzień tylko dla kalendarza projektu. Inny kalendarz z własnymi godzinami na dzień zamienia przy otwieraniu pliku swoje godziny pracy na godziny na dzień: 8 godzin na dzień przy godzinach pracy po 10 godzin staje się 10. Zadanie w dniach w takim kalendarzu staje się wtedy krótsze, na przykład 4 dni zamiast 5.

## Plik MS Project (`.mpp`)

**Otwieranie** — tak, od MS Project 2010 do 2021. Profil obliczeń: *Microsoft Project*. Aplikacja tylko odczytuje plik: nigdy nie zmienia Twojego `.mpp`. Plik z MS Project 2007 lub starszego oraz plik z hasłem aplikacja odrzuca z komunikatem, który wskazuje eksport XML z MS Project. Po otwarciu aplikacja w jednym komunikacie podaje, czego nie przejęła.

**Zapisywanie** — nie, i nie ma celu zapisu: *Zapisz* zapisuje nowy plik IFC.

**Eksport** — nie.

**Co zostaje zachowane** — zadania ze strukturą, czasem trwania i ograniczeniami; relacje z opóźnieniem; kalendarze; zasoby i przydziały; postęp; kod WBS wpisany ręcznie w MS Project. Daty i zapas, które MS Project sam obliczył, są także odczytywane, dla widoku *Daty zapisane*.

**Co się nie zachowuje** — plany bazowe, koszty i stawki, notatki, hiperłącza, pola niestandardowe MS Project, łącza podprojektów i zadań zewnętrznych oraz próg krytyczny. Zobacz [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen).

**Pochodzenie i licencja** — czytnik `.mpp` jest napisany dla Open Planner Studio i pochodzi z kodu źródłowego oraz wiedzy o strukturze MPXJ (`github.com/joniles/mpxj`, Jon Iles i inni), biblioteki Java na licencji LGPL-2.1. Struktura i stałe pól zostały przeniesione do TypeScript. Sam Open Planner Studio jest wolnym oprogramowaniem na licencji LGPL-3.0. Czytnik `.xer` nie jest pochodną: MPXJ służył tam tylko jako źródło wiedzy.

## Primavera P6 XML

**Otwieranie** — tak. Aplikacja rozpoznaje plik `.xml` jako P6 XML po elemencie głównym `APIBusinessObjects`. Profil obliczeń: *Open Planner Studio*.

**Kilka projektów w jednym pliku.** Każdy projekt z zadaniami otwiera się na własnej karcie o nazwie *Nazwa projektu (ID projektu)*. Aplikacja pomija projekt bez zadań. Aktywna karta to projekt z największą liczbą zadań. Aplikacja nie przenosi relacji do innego projektu ani zadania, które nie należy do żadnego projektu. Po otwarciu aplikacja podaje, ile projektów otworzyła.

**Święta przy otwieraniu.** Obowiązują te same reguły co dla MS Project XML: kalendarz z własnym tygodniem pracy i bez wyjątków nie dostaje świąt.

**Plany bazowe.** `<BaselineProject>` w pliku staje się planem bazowym swojego projektu. Plan bazowy, który P6 oznacza jako aktywny, jest w aplikacji także aktywny.

**Stawka przydziału.** Jeśli pozostaje praca, pozostała stawka (`RemainingUnitsPerTime`) staje się *Jedn./dzień*. W przeciwnym razie jest to planowana stawka (`PlannedUnitsPerTime`). Dla materiału planowana stawka zostaje. Aplikacja nic nie przelicza przy otwieraniu pliku. Przy eksporcie do P6 XML zapisuje planowaną stawkę jako `PlannedUnitsPerTime`. Pozostałą stawkę zapisuje jako `RemainingUnitsPerTime` tylko wtedy, gdy przydział ma osobną planowaną stawkę.

**Brak czytelnych zadań.** Jeśli aplikacja nie znajdzie zadania, które potrafi odczytać, nie otwiera karty. Zgłasza to, z powodem, jeśli jest znany. Przykłady: zadania bez `ObjectId` albo nazwy kolumn XER w pliku XML. Wyeksportuj wtedy projekt z P6 jeszcze raz jako P6 XML albo otwórz go jako `.xer`.

**Zapisywanie** — nie.

**Eksport** — tak, jako *Primavera P6 XML* (*Dla Oracle Primavera P6*.). Domyślna nazwa: nazwa projektu z `.xml`, z ID projektu w nawiasie, jeśli projekt go ma. Eksport do MS Project XML dostaje tę samą nazwę: nadaj im samodzielnie różne nazwy.

**Nazwa projektu i ID projektu.** Aplikacja trzyma ID projektu z P6 osobno od nazwy projektu, tak samo jak przy `.xer`. *Ustawienia projektu* pokazują tylko nazwę, na przykład *Bid for Facility Extension*. Karta pokazuje *Bid for Facility Extension (OZB-05)*. Jeśli zmienisz nazwę projektu na *Hall extension*, karta nazywa się *Hall extension (OZB-05)*. Eksport do P6 XML zapisuje *OZB-05* z powrotem jako ID projektu, a *Hall extension* jako nazwę. Dzięki temu P6 rozpoznaje projekt. Projekt z `.xer` też zachowuje swoje ID projektu. ID projektu zostaje, gdy zapiszesz projekt jako IFC. Nawiasy w samej nazwie, na przykład *New build (phase 2)*, zostają w nazwie. Projekt bez ID projektu dostaje przy eksporcie od aplikacji własne, unikalne ID, które zaczyna się od *OPS:*.

**Co zostaje zachowane** — struktura WBS i zadania z czasem trwania, datami i postępem; relacje z opóźnieniem; ograniczenia (także drugie, jako miękkie ograniczenie); kalendarze; zasoby i przydziały; datę statusu (jako `DataDate`); własny rodzaj robót w osobnym polu `OPS Custom Task Type`, które aplikacja odczytuje z powrotem i które P6 może zignorować.

**Co się nie zachowuje** — plany bazowe i terminy ostateczne; kody czynności, pola niestandardowe, notatki i relacje zewnętrzne; opcje obliczeń; nazwy świąt. P6 nie ma nazwy dla każdego dnia wolnego: po ponownym otwarciu święto nazywa się *Święto*, a wyjątek roboczy *Wyjątek roboczy*. Kolejne dni wolne wracają jako jeden zakres. Aplikacja skraca nazwę lub kod, który jest dłuższy, niż P6 dopuszcza: nazwę zadania do 120 znaków, ID zadania lub kod WBS do 40, a nazwę WBS lub projektu do 100. Zgłasza, ile nazw i kodów skróciła. P6 nie ma opóźnienia w procentach: aplikacja zamienia je na stałą liczbę dni. Opóźnienie w dniach kalendarzowych staje się opóźnieniem w godzinach pracy: 3 dni kalendarzowe stają się 3 dniami roboczymi. Hamak staje się zwykłym zadaniem, zadanie planowane ręcznie zwykłym zadaniem z obliczonymi datami, a opóźnienie bilansowania krótsze niż jeden dzień zostaje pominięte.

## Plik Primavera (`.xer`)

**Otwieranie** — tak. Profil obliczeń: *Primavera P6*. Aplikacja tylko odczytuje plik: nie zapisuje `.xer` i nigdy nie zmienia Twojego pliku. Otwiera jedną zakładkę na projekt z zadaniami. Plik bez zadań lub z uszkodzonymi tabelami aplikacja odrzuca z komunikatem.

**Zapisywanie** — nie, i nie ma celu zapisu: *Zapisz* zapisuje nowy plik IFC, z oryginalnym `.xer` w środku.

**Eksport** — nie. Jeśli wyeksportujesz projekt z `.xer` do CSV, MS Project XML lub P6 XML, aplikacja zgłasza, że informacje źródłowe XER zostaną utracone, nawet jeśli projekt wcześniej zapisałeś jako IFC. Do IFC nic nie przepada.

**Co zostaje zachowane** — struktura WBS i zadania z czasem trwania, datami, ograniczeniami i postępem; relacje z opóźnieniem; kalendarze; zasoby z przydziałami; kody czynności; pola niestandardowe (UDF); notatki; ustawienia planowania P6. Zadanie typu *Level of Effort* staje się hamakiem. Projekt będący planem bazowym staje się aktywnym planem bazowym projektu, który się do niego odwołuje. Relację między dwoma projektami aplikacja zachowuje jako dane źródłowe.

**Wydajność przydziału.** Jeśli pozostaje praca, pozostała wydajność (`remain_qty_per_hr`) staje się wartością *Jedn./dzień*. W przeciwnym razie jest to planowana wydajność (`target_qty_per_hr`). Planowana, rzeczywista i pozostała praca zostają bez zmian, jak w pliku. Dla materiału zostaje planowana wydajność.

**Wolna sobota lub niedziela, która nie jest w pliku.** Niektóre eksporty z P6 przesuwają wolny dzień weekendu w obrębie bloku kilku wolnych dni na piątek wcześniej lub poniedziałek później. Jeśli kalendarz pracuje w sobotę lub niedzielę, ten dzień stałby się błędnie dniem roboczym. Jeśli aplikacja widzi taki wzorzec w bloku co najmniej trzech wolnych dni, ustawia ten dzień weekendu jednak jako wolny. W kalendarzu dzień nazywa się *Wyjątek kalendarza (odtworzenie weekendu)* i liczy się w wierszu *N ustaleń kalendarza.* komunikatu. W kalendarzu, który w weekend nie pracuje, nic się nie zmienia.

**Zapas do końca projektu, bez daty zakończenia.** Czy opcja P6 do obliczania zapasu do końca projektu jest włączona, ale plik nie ma daty zakończenia projektu i żadne zadanie nie ma planowanej daty zakończenia? Wtedy aplikacja wyłącza opcję *Licz zapas do daty zakończenia projektu*. Oblicza wtedy późne terminy wstecz od najpóźniejszego najwcześniejszego zakończenia. Liczy się to w wierszu *N ustawień planowania P6 użyło bezpiecznych wartości zastępczych.* komunikatu.

**Ukończone zadania na dacie statusu.** Niektóre pliki nie zapisują rzeczywistych dat ukończonego zadania, lecz okno na dacie statusu. W widoku *Daty zapisane* takie zadanie jest wtedy wąskim paskiem na dacie statusu. Jeśli przeliczenie umieści je w innym miejscu, liczy się ono w liczbie zadań, które podaje ten pasek. Konwencja *Zakończone zadanie w oknie daty stanu* oblicza takie okno. Dopiero przy tej konwencji ukończone zadanie dostaje prawdziwy zapas dzięki opcji obliczeń *Ukończone zadanie: późne terminy od daty stanu*. Ta konwencja jest przybliżeniem: aplikacja zaobserwowała to zachowanie wyłącznie w wynikach P3, a Primavera nigdzie tego nie potwierdza. Dlatego jest wyłączona w każdym wbudowanym profilu obliczeń, także w *Primavera P6*. Włączasz ją w bloku *Profil obliczeń i opcje*; projekt dostaje wtedy własny profil. Zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).

**Liczby z przecinkiem jako separatorem dziesiętnym.** P6 zapisuje znak dziesiętny i znak tysięcy w tabeli `CURRTYPE`. Aplikacja odczytuje te znaki, zanim przelicza czas trwania, pracę i zapas. Jeśli tych informacji brakuje, aplikacja używa kropki jako separatora dziesiętnego. Jeśli plik nadal zawiera liczby z przecinkiem dziesiętnym, aplikacja niczego nie otwiera. Tak harmonogram z błędnie odczytanymi liczbami nigdy się nie otwiera.

**Co się nie zachowuje** — projekt bez zadań oraz relacja między dwoma projektami jako prawdziwa relacja w harmonogramie. Zobacz [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Otwieranie** — tak. Aplikacja odczytuje `;` i `,` jako separator. Rozpoznaje nagłówki kolumn po angielsku i niderlandzku (na przykład `Name` lub `Naam`, `Duration` lub `Duur`, `Predecessors` lub `Voorgangers`). Daty mogą mieć format *rrrr-mm-dd*, *dd-mm-rrrr* lub *dd/mm/rrrr*. Poprzednika zapisujesz jako kod WBS, typ relacji i opóźnienie, na przykład `1.2FS+2d`. Profil obliczeń: *Open Planner Studio*. Projekt nosi nazwę *CSV Import*. Kolumna `Task Type` zawiera rodzaj robót, nie typ zadania; aplikacja czyta też nagłówki `Werksoort` i `Work category`. Wartość `Task Type`, która nie jest żadnym ze stałych kodów (jak `CONSTRUCTION` lub `INSTALLATION`, które aplikacja zapisuje sama), staje się własnym rodzajem robót w *Z tego projektu*, a nie w *Moje rodzaje robót*. Przy `OPS Custom Task Type ID` zachowany jest identyfikator własnego rodzaju robót.

**Zapisywanie** — nie.

**Eksport** — tak, jako *CSV (;)* (*Uniwersalny eksport tabeli. Wszystkie zadania z datami i czasem trwania.*), na kafelku *CSV (rozdzielany średnikiem)*. Plik używa średnika jako separatora, jest zapisany w UTF-8 z BOM i ma angielskie nagłówki kolumn.

**Co zostaje zachowane** — na każde zadanie te kolumny: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` i `Description`. Kolumna `Task Type` zawiera rodzaj robót. Ukończenie podawane jest w pełnych procentach. Opóźnienie w godzinach dostaje znak godziny z języka aplikacji: `1.2FS+2h` po angielsku, `1.2FS+2u` po niderlandzku. Przy otwieraniu odczytywane są obie formy.

**Co się nie zachowuje** — zasoby, przydziały, kalendarze, ograniczenia, terminy ostateczne, plany bazowe i data statusu. Jeśli daty są w widoku *Daty zapisane*, eksport zostawia `Critical` i `Total Float` puste dla zadań, których plik źródłowy tego nie zapisał.

## Arkusz postępu (Excel i CSV)

**Otwieranie** — tak, przez *Plik › Importuj* (*Aktualizuj postęp z arkusza*) albo przez przycisk o tej samej nazwie w grupie *Postęp* na kartach *Planowanie*, *Tabela* i *Raport*. Aplikacja odczytuje `.xlsx` i `.csv`, do 16 MB i 50 000 wierszy. To nie otwiera projektu: aktualizuje postęp otwartego projektu. Zobacz [Importowanie postępu z arkusza](docs://howto-voortgang-importeren).

**Zapisywanie** — nie.

**Eksport** — tak, jako *Arkusz postępu (Excel)* (*Postęp (Excel)* na liście) i *Arkusz postępu (CSV)* (*Postęp (CSV)*). Domyślna nazwa: *nazwaprojektu-voortgang*. Przycisk *Eksportuj arkusz postępu* w tej samej grupie wstążki tworzy arkusz Excel jednym kliknięciem. Arkusz Excel ma stałe szerokości kolumn, zablokowane pola i kontrolę dat. Arkusz CSV ma tę samą treść jako zwykły tekst.

**Co zostaje zachowane** — kolumny `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` i `Actual Finish`. Przy wczytywaniu aplikacja używa `Completion (%)`, `Actual Start` i `Actual Finish`. `Start` i `Finish` służą tylko do rozpoznania zapisu dat i nie zmieniają harmonogramu. Aplikacja łączy wiersze z zadaniami po `OPS Task ID`, a w przeciwnym razie po unikalnym kodzie WBS.

**Co się nie zachowuje** — wszystko poza tymi kolumnami: czas trwania, relacje, zasoby i reszta harmonogramu. Zadanie sumaryczne nie dostaje postępu z arkusza.

## PDF

**Otwieranie** — nie.

**Zapisywanie** — nie.

**Eksport** — tak, z raportu: na karcie *Raport* przycisk *Eksportuj PDF*. Aplikacja sama nie wysyła raportu do drukarki. Wydruk zrobisz z pliku PDF. Zawartość zależy od typu raportu: zobacz [Typy raportów](docs://ref-rapporttypes) i [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken).

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): dlaczego IFC jest własnym formatem i co eksport traci, z przykładem.
- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): kroki.
- [Eksportowanie](docs://howto-exporteren): wybór formatu i komunikaty po eksporcie.
- [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen): dlaczego otwarty plik może pokazywać inne daty.
- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): profile obliczeń.
