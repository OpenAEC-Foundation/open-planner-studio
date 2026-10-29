# Daty zapisane w pliku

Otwierasz harmonogram z Primavery albo z MS Project. Daty różnią się od tego, co widziałeś w tamtym programie. Czy import się nie udał? Zwykle nie. W tym artykule czytasz, dlaczego aplikacja sama przelicza, kiedy pokazuje daty z pliku, co wtedy zostaje puste i jak wracasz do jej własnego obliczenia. Przykład na końcu śledzi dwa zadania przez cały proces.

## Pojęcie

Plik harmonogramu zawiera dwa rodzaje danych. Najpierw logikę: zadania, czasy trwania, relacje, kalendarze i ograniczenia. Po drugie daty, które tamten program sam z tego obliczył. Przy otwieraniu Open Planner Studio korzysta z logiki i oblicza samodzielnie. Daty w pliku nie są więc danymi wejściowymi.

Jeśli obliczenie aplikacji kończy się na innych datach niż w pliku, nie wiesz, która strona ma rację. W pliku może brakować logiki, której tamten program użył. Tamten program może też inaczej liczyć niż aplikacja w jakimś punkcie. Dlatego aplikacja może pokazać daty **takie, jak zapisano**: daty, które tamten program zapisał w pliku. Tak porównujesz z tym, co widziałeś w tamtym programie.

## Jak aplikacja to obsługuje

### Którego profilu obliczeń używa aplikacja

Aplikacja oblicza z **profilem obliczeń**: zestawem reguł obliczeń (konwencji), który decyduje na przykład o tym, jak traktuje planowany start zadania i ograniczenia. Zobacz [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen). Są trzy wbudowane profile: *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Plik `.xer` otwiera się z profilem *Primavera P6*, a plik `.mpp` z profilem *Microsoft Project*. CSV, XML MS Project i XML Primavera P6 otwierają się z profilem *Open Planner Studio*. Profil projektu znajdziesz w *Plik › Ustawienia projektu*, przy *Profil obliczeń i opcje*. Plik IFC zapisany przez aplikację zachowuje swój profil.

### Kiedy aplikacja porównuje

Przy otwieraniu aplikacja zapisuje, co mówił plik, i porównuje to ze swoim własnym wynikiem. Robi to dla:

- pliku Primavery (`.xer`) i XML Primavera P6;
- XML MS Project i plików MS Project (`.mpp`);
- pliku IFC z innego programu, dla zadań, których najwcześniejsze daty są w pliku;
- pliku IFC zapisanego przez aplikację, który zapamiętał swoje pochodzenie. Niżej czytasz, kiedy tak jest.

Aplikacja nigdy nie porównuje pliku CSV: data startu w CSV jest daną wejściową, a nie wynikiem obliczenia. Plik IFC zapisany przez aplikację, bez zapamiętanego pochodzenia, też nie jest porównywany.

Jeśli żadne zadanie się nie różni, niczego nie zauważysz. Jeśli w pliku, który właśnie importujesz, różni się co najmniej jedno zadanie, aplikacja od razu włącza widok.

Przy pliku Primavery aplikacja oblicza z profilem obliczeń *Primavera P6*. Ten profil zachowuje planowany start z pliku jako najwcześniejsze rozpoczęcie. Zadanie, które w pliku jest późniejsze, niż wymagają relacje, ale ma tam też planowany start, zachowuje więc ten start: wtedy nie ma różnicy.

### Co widzisz

Pod wstążką jest pasek informacji: *Widzisz daty takie, jak zostały zapisane w pliku; ponowne przeliczenie przesunęłoby 4 zadania.* Przy źródle Primavery (pliku `.xer` albo XML Primavera P6) pasek mówi: *Widzisz harmonogram tak, jak zapisał go Primavera; ponowne przeliczenie przesunęłoby 1 zadanie.* Po prawej stronie paska jest przycisk *Przelicz*. Pasek nie ma krzyżyka.

Jest też komunikat: *12 zadań pokazuje daty tak, jak zapisano je w pliku (bez ponownego przeliczenia).* Tylko przy pliku `.xer` pisze: *12 zadań pokazuje daty tak, jak zapisał je Primavera (bez ponownego przeliczenia).* Ta liczba obejmuje każde zadanie, dla którego plik zapisał daty, także zadania, które się nie różnią. Liczba zadań, które różnią się po przeliczeniu, jest na pasku. Każde zadanie, dla którego plik zapisał daty, pokazuje pomarańczowy blok w panelu *Właściwości*, tuż nad polem *Początek*: *Widzisz daty zapisane przez Primaverę, a nie obliczenia aplikacji.* Przy innym źródle pisze: *Widzisz daty, które były w pliku, a nie obliczenia aplikacji.* Drugi wiersz mówi, co się stanie z tym zadaniem po przeliczeniu: *Przy przeliczeniu to zadanie się zmieni.* albo *Przy przeliczeniu to zadanie pozostanie bez zmian.* Wykres Gantt, tabela zadań i pasek stanu pokazują daty z pliku.

### Zadania, które się rozpoczęły lub są ukończone

Zadanie ukończone leży na dniach, w których faktycznie się odbyło: od rzeczywistego rozpoczęcia do rzeczywistego zakończenia. Zadanie w toku zaczyna się w dniu, w którym faktycznie się rozpoczęło. Kończy się w obliczonym zakończeniu. Dotyczy to tego widoku, po przeliczeniu i przy każdym profilu obliczeń, tak jak w Primaverze i Microsoft Project.

Dla takiego zadania plik często zapisuje inne najwcześniejsze daty. Primavera ustawia najwcześniejsze rozpoczęcie zadania w toku lub ukończonego na dacie statusu. Te daty widzisz w kolumnach *Najwcześniejsze rozpoczęcie* i *Najwcześniejsze zakończenie*, a nie w *Początek* i *Koniec*. Zadanie ukończone zatem nigdy nie liczy się jako różnica. Zadanie w toku liczy się tylko wtedy, gdy różni się jego zakończenie.

Dla zadania, które się rozpoczęło, początek jest tylko do odczytu. W tabeli zadań, w panelu *Właściwości* i w *Edytuj zadanie* nie możesz go wtedy zmienić. Dla zadania ukończonego dotyczy to także zakończenia w tabeli zadań. Zmień zamiast tego *Rzeczywiste rozpoczęcie* albo *Rzeczywiste zakończenie* przy postępie. Na wykresie Gantt pasek takiego zadania się nie przesuwa; wtedy dostajesz komunikat.

### Co pozostaje puste w tym widoku

W tym widoku aplikacja niczego nie oblicza. Pokazuje tylko to, co plik zapisał. Zapas i ścieżkę krytyczną widzisz więc tylko wtedy, gdy plik je zawiera. Jeśli plik nie zapisuje zadań krytycznych, pasek stanu pokazuje 0 zadań krytycznych. To nic nie mówi o ścieżce krytycznej w samym programie. Wszystko, co wynika dopiero z obliczenia, w tym widoku nie istnieje: które relacje napędzają harmonogram, naruszone ograniczenia, zadania w niewłaściwej kolejności i zadania prawie krytyczne.

Jeśli plik nie zapisuje wszystkiego dla zadania, pomarańczowy blok w panelu *Właściwości* dostaje trzeci wiersz, na przykład *Primavera nie zapisała dla tego zadania wszystkiego. Brakuje: zapas swobodny.* Przy innym źródle pisze: *Plik nie zawiera wszystkiego dla tego zadania.* Dwa pierwsze wiersze zostają: dla takiego zadania widzisz więc nadal, że daty pochodzą z pliku, i czy zadanie zmieni się po przeliczeniu. Brakujące wartości mają te same nazwy co kolumny w tabeli zadań. W eksporcie CSV kolumny *Krytyczne* i *Zapas całkowity* zostają dla takiego zadania puste, zamiast zmyślonego zera.

### Wyjście z widoku

Z widoku wychodzisz na dwa sposoby:

- Kliknij *Przelicz* na pasku informacji albo wybierz *Oblicz* (F5). Aplikacja oblicza według własnych reguł.
- Zmień coś, co może zmienić daty, na przykład czas trwania zadania albo nowe zadanie. Aplikacja opuszcza widok i od razu przelicza, nawet gdy *Oblicz automatycznie* jest wyłączone. Zmiana nazwy, opisu, rodzaju robót albo typu zadania tego nie robi: widok zostaje włączony.

Zmiana kalendarza z biblioteki zasobów pozostawia widok włączony i daty z pliku bez zmian, ale aktualizuje liczbę na pasku.

Po wyjściu nie ma przycisku, który wraca do widoku. Ctrl+Z przywraca go zaraz po przeliczeniu albo zaraz po takiej zmianie. W innym razie możesz ponownie otworzyć plik źródłowy. Przy pliku `.xer` włącza widok ponownie także otwarcie pliku IFC, który zapisałeś po przeliczeniu, ale nie edytowałeś.

### Odzyskiwanie po awarii

Jeśli odzyskujesz projekt po awarii, która zdarzyła się w widoku, widok zostaje włączony. Jeśli widok był wyłączony, aplikacja zapomina daty z pliku. Aktywny projekt pokazuje ten sam pasek co wcześniej. Projekt na innej karcie pokazuje pasek bez liczby: *Widzisz daty takie, jak zostały zapisane w pliku. Nie wykonano ponownego przeliczenia.* Zobacz [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash).

### Zapisywanie i ponowne otwieranie

Jeśli zapiszesz, gdy korzystasz z widoku, aplikacja zapisuje wyświetlane daty w pliku IFC razem z formatem źródłowym. Jeśli później ponownie otworzysz ten plik IFC, widok jest znowu włączony, bez nowego komunikatu. Dotyczy to także zmiany w widoku, która nie wpływa na daty, na przykład nazwy. Aplikacja otwiera plik tak, jak go zostawiłeś.

Jeśli zapiszesz po wyjściu z widoku, przez przeliczenie albo przez zmianę, która może zmienić daty, plik zawiera obliczenie aplikacji. Przy ponownym otwarciu widzisz to obliczenie, bez paska i bez bloku w panelu *Właściwości*. Jest jeden wyjątek: plik `.xer`, który tylko przeliczyłeś i nie edytowałeś (zobacz wyżej). Twój zmieniony harmonogram jest teraz harmonogramem; dawne daty z programu źródłowego do niego już nie należą. Jeśli je jeszcze chcesz zobaczyć, otwórz ponownie plik źródłowy.

## Przykład: przybudówka

Załóżmy, że otwierasz plik Primavery *Uitbouw* (przybudówka) z dwoma zadaniami, w kalendarzu bez świąt. W 2027 roku 6 maja to Wniebowstąpienie Pańskie, a 17 maja Poniedziałek Zielonych Świątek. Ze świętami w kalendarzu daty wychodzą inaczej. *Fundering storten* (wylanie fundamentu) trwa 5 dni roboczych, *Metselwerk* (murowanie) 10 dni roboczych, a Metselwerk następuje po Fundering z relacją zakończenie-rozpoczęcie. Plik zapisuje, że Fundering trwa od poniedziałku 3 maja do piątku 7 maja 2027, a Metselwerk od poniedziałku 17 maja do piątku 28 maja 2027: tydzień później niż najwcześniejsze rozpoczęcie, na które pozwala relacja. Planowany start Metselwerk w pliku to poniedziałek 10 maja 2027.

Zaraz po otwarciu widzisz daty z pliku. Pasek stanu pokazuje *Koniec: 28-05-2027* i *Ścieżka krytyczna: 2 zadania, 20 dni roboczych*. Pasek informacji mówi, że przy przeliczeniu różni się 1 zadanie. Oba zadania pokazują pomarańczowy blok *Widzisz daty zapisane przez Primaverę, a nie obliczenia aplikacji.* Pod nim Metselwerk pokazuje *Przy przeliczeniu to zadanie się zmieni.*, a Fundering *Przy przeliczeniu to zadanie pozostanie bez zmian.*

Po kliknięciu *Przelicz* Fundering zostaje na 3 do 7 maja. Metselwerk zaczyna się teraz w poniedziałek 10 maja, w następnym dniu roboczym po zakończeniu Fundering, i kończy w piątek 21 maja. Harmonogram kończy się 21 maja 2027 i trwa 15 dni roboczych zamiast 20. Ścieżka krytyczna składa się z tych samych 2 zadań.

Co, jeśli jest inaczej?

- Jeśli Metselwerk jest w pliku również planowany na poniedziałek 17 maja, profil obliczeń *Primavera P6* zachowuje ten start. Obliczenie daje daty od 17 do 28 maja, nie ma różnicy i widok się nie włącza.
- Dodajesz zadanie w widoku: to samo przeliczenie. Metselwerk przesuwa się na 10 do 21 maja.
- Zapisujesz w widoku i ponownie otwierasz plik IFC, bez edycji: Metselwerk wraca na 17 do 28 maja.
- Przeliczasz, zapisujesz bez dalszej edycji i ponownie otwierasz plik IFC: widok jest znowu włączony, a Metselwerk jest na 17 do 28 maja.
- Zmieniasz w widoku tylko nazwę Metselwerk, zapisujesz i ponownie otwierasz: widok jest znowu włączony, a Metselwerk jest na 17 do 28 maja.
- Dodajesz zadanie w widoku, zapisujesz i ponownie otwierasz: aplikacja zapomina daty z pliku. Metselwerk jest na 10 do 21 maja, bez paska i bez bloku.
- Fundering jest w pliku już ukończony: faktycznie rozpoczął się 3 maja i faktycznie zakończył 7 maja. Plik zapisuje datę statusu jako jego najwcześniejsze rozpoczęcie. Pasek zadania Fundering nadal jest na 3 do 7 maja, w widoku i po przeliczeniu. Fundering nie liczy się jako różnica.

## Konsekwencje i nieporozumienia

**Różnica nie jest błędem importu.** Aplikacja oblicza według własnych reguł: przy `.xer` z profilem obliczeń *Primavera P6*, przy `.mpp` z *Microsoft Project*, a przy CSV, XML MS Project i XML Primavera P6 z *Open Planner Studio*. Przyczyna tego, że daty w pliku źródłowym wyszły inaczej, może leżeć w pliku albo w tamtym programie. Widok pokazuje ci *że* się różnią.

**Widok nie jest wynikiem obliczenia.** Aplikacja nie obliczyła tych dat. Nie przyjmuj ich po prostu jako wynik własnego harmonogramu.

**Zapisanie w widoku zachowuje daty z programu źródłowego.** Plik IFC zawiera wtedy to, co mówił program źródłowy, a nie to, co obliczyłaby aplikacja.

**Po edycji, która może zmienić daty, daty z pliku nie wracają.** Jeśli wyszedłeś z widoku przez taką edycję, po zapisaniu i ponownym otwarciu widzisz tylko własne obliczenie aplikacji. Zmiana nazwy się nie liczy: widok zostaje wtedy włączony (zobacz *Zapisywanie i ponowne otwieranie*). Otwórz ponownie plik źródłowy, jeśli chcesz zobaczyć daty z programu źródłowego.

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): co aplikacja zachowuje w pliku i co niesie import albo eksport.
- [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen): kroki i komunikaty dla pliku `.xer`.
- [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen): kroki i komunikaty dla pliku `.mpp`.
- [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash): co się dzieje z tym projektem po awarii.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak aplikacja liczy zapas i krytyczność, kiedy je oblicza.
