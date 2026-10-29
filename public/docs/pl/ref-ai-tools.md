# Narzędzia AI (planner_*)

Wszystkie narzędzia, które asystent AI może wywołać przez most, pogrupowane. Opisano, co robią i co odrzucają. Wszystkie zaczynają się od `planner_`. Komunikat połączenia w oknie *Szczegóły połączenia* podaje bieżący numer. Asystent dostaje pełną listę z opisami bezpośrednio od mostu (`tools/list`). Dlaczego połączenie działa tak, jak działa, opisano w [Jak działa połączenie z AI](docs://uitleg-ai-koppeling). Jak je włączyć, opisano w [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen).

## Jak czytać tę listę

**Odczyt** oznacza: narzędzie niczego nie zmienia. To działa też w trybach *Wstrzymaj* i *Tylko do odczytu*. Otwarte okno dialogowe je jednak blokuje (zobacz niżej *Kiedy narzędzie zostaje odrzucone*). Narzędzie odczytu zawsze podaje aktualne daty. Gdy harmonogram jest nieaktualny, najpierw go przelicza, także w trybach *Wstrzymaj* i *Tylko do odczytu*. Te tryby wstrzymują zmiany, nie przeliczenie przy odczycie. Jeśli jesteś w trakcie edycji (przeciągasz pasek albo wpisujesz wartość w polu), nie przelicza. Asystent dostaje wtedy daty sprzed Twojej edycji, z informacją, że są nieaktualne. Jeśli projekt jest w widoku *Daty zapisane*, nie przelicza. Asystent dostaje wtedy zapisane daty z informacją, że nie zostały przeliczone.

**Zmiana** oznacza: narzędzie zmienia Twój projekt. Jest odrzucane w trybach *Wstrzymaj*, *Tylko do odczytu* i gdy otwarte jest okno dialogowe. Tak samo jest z narzędziami bez oznaczenia poniżej (`planner_undo`, `planner_redo`, narzędzia plików i narzędzia dokumentów, z wyjątkiem `planner_list_documents`). Każda zmiana to jeden krok w Twojej historii cofania. Gdy zmienią się dane projektu, aplikacja sama przelicza harmonogram. Nie musisz naciskać przycisku *Oblicz*. Przed pierwszą zmianą w każdym dokumencie aplikacja zapisuje kopię zapasową, jeśli włączona jest *Automatyczna kopia zapasowa*.

**Zbiorczo** oznacza: jedno wywołanie może zawierać kilka elementów. Nieprawidłowy element zostaje odrzucony z podaniem powodu, a prawidłowe elementy zostają. Odpowiedź podaje odrzucone elementy.

## Odczyt: harmonogram

- `planner_get_project_info` (odczyt) — szczegóły projektu i kluczowe liczby: liczba zadań, relacji, zasobów i kamieni milowych, data statusu, zakończenie i czas trwania projektu, informacja, czy harmonogram jest nieaktualny, profil obliczeń oraz podsumowanie kalendarzy. Dobre pierwsze wywołanie.
- `planner_get_project_overview` (odczyt) — cała struktura WBS w jednej odpowiedzi: dla każdego identyfikatora zadania WBS, nazwa, czas trwania, wczesne daty, postęp, czy zadanie jest krytyczne, oraz relacje wychodzące z ich identyfikatorem relacji.
- `planner_list_tasks` (odczyt) — zadania z filtrami (krytyczne, status, przedział dat, zadania bez relacji) i stronicowanie.
- `planner_get_task` (odczyt) — jedno zadanie szczegółowo: daty, zapas, postęp, ograniczenia, termin ostateczny, kalendarz, przydziały, poprzedniki i następniki, przerwy.
- `planner_get_critical_path` (odczyt) — zadania krytyczne z ich zapasem całkowitym oraz relacje, które wyznaczają ścieżkę.
- `planner_list_resources` (odczyt) — zasoby ze zdolnością, stawką, kalendarzem, ekipą, dostępnością i podsumowaniem ich przydziałów. Gdy zasób pochodzi z biblioteki zasobów, pokazuje, które pola są ustalone.
- `planner_get_resource_histogram` (odczyt) — obciążenie w porównaniu ze zdolnością, na zasób, na dzień, tydzień lub miesiąc (domyślnie tydzień). Bez przedziału i bez zasobów podaje podsumowanie na zasób. Z przedziałem lub zasobami podaje pełną serię oraz zadania, które powodują przeciążenie.
- `planner_get_calendars` (odczyt) — wszystkie kalendarze z pełną definicją oraz liczbą zadań i zasobów, które z nich korzystają.

## Odczyt: plany bazowe i odchylenia

- `planner_list_baselines` (odczyt) — zapisane plany bazowe i informacja, który z nich jest aktywny.
- `planner_compare_baseline` (odczyt) — bieżący plan porównany z aktywnym planem bazowym: tylko zadania, które się różnią, oraz różnica w zakończeniu projektu, w dniach roboczych według bieżącego kalendarza projektu. Bez aktywnego planu bazowego wywołanie zostaje odrzucone.
- `planner_analyze_delay` (odczyt) — analiza przesunięć względem aktywnego planu bazowego: różnica w terminie oddania oraz zadania krytyczne, które się przesunęły. Bez aktywnego planu bazowego wywołanie zostaje odrzucone.

## Zadania i struktura

- `planner_add_tasks` (zmiana, zbiorczo) — tworzy zadania, w tym zagnieżdżoną strukturę WBS, w jednym wywołaniu. Każde zadanie dostaje własną tymczasową nazwę (`tmp-…`), żeby zadanie podrzędne mogło odwołać się do nadrzędnego. Bez czasu trwania zadanie dostaje 5 dni roboczych. Kamień milowy ma czas trwania 0. Wszystkie zadania jednego wywołania albo się udają razem, albo razem zawodzą.
- `planner_update_tasks` (zmiana, zbiorczo) — zmienia pola istniejących zadań: nazwę, opis, czas trwania z jednostką (dni lub godziny), typ czasu trwania, rodzaj robót, kamień milowy, obowiązkowe, priorytet, ograniczenie, termin ostateczny, kalendarz i typ zadania. Obsługuje też ścieżkę postępu: procent ukończenia, rzeczywiste rozpoczęcie i rzeczywiste zakończenie. Każdy inny klucz zostaje odrzucony z podaniem powodu.
- `planner_delete_tasks` (zmiana) — usuwa zadania razem z całą podstrukturą, relacjami i przydziałami. Odpowiedź dokładnie wymienia, co zniknęło razem z nimi.
- `planner_move_task` (zmiana) — przenosi zadanie pod inne zadanie nadrzędne, na wskazaną pozycję. Odwołanie cykliczne albo wstawienie zadania pod samo siebie zostaje odrzucone.
- `planner_set_task_splits` (zmiana) — ustawia przerwy jednego zadania: po ilu dniach roboczych (lub godzinach pracy) wykonywania zadania i po ilu dniach roboczych (lub godzinach pracy) wstrzymania. Pusta lista usuwa wszystkie przerwy. Zobacz [Dzielenie zadania](docs://howto-taak-splitsen).

## Relacje

- `planner_add_dependencies` (zmiana, zbiorczo) — tworzy relacje z typem (`FS`, `SS`, `FF`, `SF` lub pełna forma) i opóźnieniem, na przykład `+2d`.
- `planner_update_dependencies` (zmiana, zbiorczo) — zmienia typ, opóźnienie, poprzednika lub następnika istniejącej relacji, na podstawie identyfikatora relacji. To jeden krok, zamiast usuwać i tworzyć na nowo.
- `planner_remove_dependencies` (zmiana, zbiorczo) — usuwa relacje na podstawie identyfikatora relacji.

## Projekt i kalendarze

- `planner_update_project` (zmiana) — nazwę, opis, autora, firmę, datę rozpoczęcia, datę zakończenia, datę statusu, tryb postępu oraz domyślną wartość projektu dla typu zadania. Data rozpoczęcia jest punktem zakotwiczenia dla nowych zadań. Jeśli asystent zmieni ją później, przesuwają się tylko luźne zadania (bez poprzednika i bez ograniczenia wyznaczającego dolną granicę, na przykład *Rozpocznij nie wcześniej niż*). Odpowiedź podaje ich liczbę jako `anchorsClamped`. Reszta harmonogramu zostaje na miejscu. Zobacz [Nowy projekt i Info o projekcie](docs://ref-projectinfo). Data statusu nie jest etykietą, lecz datą referencyjną obliczenia: w harmonogramie bez postępu przesuwa się wszystko. Data zakończenia to tylko metadane.
- `planner_move_project` (zmiana) — przenosi cały istniejący harmonogram na nową datę rozpoczęcia. Kalendarze nie przesuwają się razem, dlatego zakończenie może się przesunąć o inną liczbę dni niż początek. Plany bazowe zostają, chyba że asystent wyraźnie każe przesunąć także je. Zobacz [Przenoszenie projektu](docs://howto-project-verplaatsen).
- `planner_update_calendar` (zmiana, zbiorczo) — zmienia lub tworzy kalendarze: dni robocze, godziny pracy, przerwę, pasma godzin, święta (generuje je dla kraju i regionu albo wpisuje dosłownie) oraz wyjątki od dni roboczych. Nie może zmienić, który kalendarz jest kalendarzem projektu.

## Zasoby i jednostki

- `planner_manage_resources` (zmiana, zbiorczo) — tworzy, zmienia lub usuwa zasoby: nazwę, typ (robocizna, sprzęt, materiał, podwykonawca lub ekipa), opis, maks. jednostki, koszt na godzinę, jednostkę, kalendarz, ekipę oraz dostępność w czasie. Usunięcie zasobu z przydziałami zostaje odrzucone, dopóki asystent tego wyraźnie nie potwierdzi. Dla zasobu z biblioteki zasobów są ustalone: nazwa, typ, opis, stawka godzinowa i jednostka.
- `planner_manage_assignments` (zmiana, zbiorczo) — dodaje, zmienia, przenosi lub usuwa przydziały: jednostki na dzień roboczy, krzywą i pozostałą pracę. Tylko na zadaniu bez podzadań, a ten sam zasób tylko raz na zadanie. Jak zmiana jednostek wpływa na czas trwania, zależy od typu zadania, jak opisano w [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels).
- `planner_level_resources` (zmiana) — bilansuje przeciążenia. Domyślnie w granicach zapasu, dzięki czemu data zakończenia zostaje. Z `constrainToFloat: false` zakończenie może się przesunąć. Przy przebiegu próbnym asystent najpierw dostaje podgląd bez zmian. Pomija materiały. Zobacz [Bilansowanie zasobów](docs://uitleg-nivelleren).
- `planner_clear_leveling` (zmiana) — usuwa wszystkie opóźnienia bilansowania.

## Zarządzanie planami bazowymi

- `planner_save_baseline` (zmiana) — zapisuje bieżący harmonogram jako plan bazowy i od razu go aktywuje. Najpierw przelicza nieaktualne daty. Nie można go użyć w skrypcie.
- `planner_activate_baseline` (zmiana) — ustawia plan bazowy jako aktywny albo nie ustawia żadnego jako aktywnego.
- `planner_rename_baseline` (zmiana) — zmienia nazwę planu bazowego.
- `planner_delete_baseline` (zmiana) — usuwa jeden plan bazowy. Jeśli był to aktywny plan bazowy, ostatni pozostały plan bazowy staje się aktywny, a gdy nic nie zostaje, żaden nie jest aktywny.

## Cofanie

- `planner_undo` i `planner_redo` — cofa lub ponawia jeden krok w aktywnym dokumencie. Ta historia cofania jest taka sama jak Twoja. Odpowiedź mówi, czy coś zostało naprawdę cofnięte.

## Dokumenty i pliki

- `planner_list_documents` (odczyt) — wszystkie otwarte dokumenty z tytułem, tym, czy są aktywne i zmienione, liczbą zadań, początkiem projektu i obliczonym zakończeniem.
- `planner_new_document` — nowy, pusty dokument w osobnej karcie, bez okna *Nowy projekt*.
- `planner_duplicate_document` — kopiuje aktywny dokument do nowej karty, do analizy scenariusza lub do wariantu przetargowego. Kopia jest odłączona i nie ma ścieżki pliku.
- `planner_switch_document` — zmienia aktywny dokument na inny. To też sposób, aby po przełączeniu karty potwierdzić, na którym dokumencie pracuje asystent.
- `planner_import_schedule` — otwiera plik harmonogramu z dysku jako dokument: `.ifc`, `.xml` (Primavera P6 lub MS Project, rozpoznawany po zawartości), `.csv`, `.xer` i `.mpp` (MS Project od 2010 do 2021). Nic nie zostaje scalone z bieżącym planem. CSV nie ma kalendarza, więc daty mogą się przesunąć. Tylko w Twoim folderze użytkownika. Po imporcie CSV, XML lub `.mpp` dokument nie ma miejsca zapisu. Tylko IFC przejmuje jego ścieżkę.
- `planner_export_ifc` — zapisuje aktywny dokument jako plik IFC w schemacie IFC projektu (domyślnie IFC 4.3 ADD2). Tylko w Twoim folderze użytkownika. Istniejący plik nadpisuje się tylko na wyraźne żądanie. Jeśli dokument został otwarty w schemacie, którego aplikacja nie potrafi zapisać (na przykład IFC2X3), narzędzie odmawia nadpisania tego pliku. Projekt pozostaje niezapisany.

## Przewodnik i pochodzenie źródła

- `planner_get_planning_guide` (odczyt) — angielski przewodnik dla asystentów (zasady [Dobre planowanie](docs://gids-goed-plannen) z narzędziami dla każdej zasady), dwie umiejętności *goed-plannen* (ustawianie harmonogramu) i *progress-update* (aktualizacja postępu), albo wszystko. Wybierz za pomocą `part`: `guide`, `skill` (obie umiejętności) lub `both`. Domyślnie `both`. Dla każdej umiejętności zwraca, gdzie ma się ją umieścić, oraz adresy pobierania. Parametr `language` jest nadal przyjmowany dla starszych asystentów, ale tekst jest zawsze po angielsku. Nie zmienia harmonogramu.
- `planner_inspect_xer_provenance` (odczyt) — sprawdza zachowane znaczenie źródłowe otwartego pliku Primavera P6 (`.xer`): co plik zawierał, z liczbami z importu i diagnostyką. Pola tekstu swobodnego z pliku są domyślnie niewidoczne. Asystent musi o nie wyraźnie poprosić. Nazwy zasobów są domyślnie ukryte, bo zasób w P6 to zwykle osoba; kody zasobów zostają widoczne. Asystent musi najpierw poprosić Cię o zgodę, zanim zażąda nazw, bo wtedy trafiają do dostawcy AI. Nie można go użyć w skrypcie.

## Skrypt

- `planner_batch` — uruchamia skrypt do 100 kroków jako jedną zmianę: jeden krok cofania, jedno przeliczenie, jedna kopia zapasowa. Gdy krok zawiedzie strukturalnie, cały skrypt zostaje wycofany, a odpowiedź podaje dla każdego kroku, czy został wykonany, nie powiódł się, czy nie został osiągnięty. Tymczasowe nazwy (`tmp-…`) z `planner_add_tasks` działają w późniejszych krokach. Niedozwolone jako krok: `planner_batch` samo, cofanie i ponawianie, narzędzia dokumentów i plików, `planner_save_baseline`, `planner_get_planning_guide` oraz `planner_inspect_xer_provenance`. Skrypt nie jest językiem programowania: nie ma zmiennych, warunków ani pętli.

## Kiedy narzędzie zostaje odrzucone

Asystent dostaje wtedy odpowiedź z kodem błędu i wyjaśnieniem.

- `PAUSED` — *Wstrzymaj* jest włączone.
- `READ_ONLY` — *Tylko do odczytu* jest włączone.
- `DIALOG_OPEN` — otwarte jest okno dialogowe. Dotyczy to także odczytu, z wyjątkiem `planner_get_planning_guide`. Odpowiedź podaje, co jest otwarte, po wewnętrznej nazwie, na przykład `showTaskDialog`.
- `DOC_DRIFT` — podczas pracy asystenta zmieniono kartę. Asystent musi potwierdzić przez `planner_switch_document`, nad którym dokumentem pracuje.
- `VALIDATION` — argumenty nie pasują do schematu albo żądana zmiana jest niedozwolona. Odpowiedź wskazuje pole.
- `NOT_FOUND` — identyfikator albo dokument nie istnieje.
- `CYCLE` — zmiana utworzyłaby odwołanie cykliczne. Wszystko w tym wywołaniu zostaje wycofane.
- `SCOPE` — ścieżka pliku leży poza Twoim folderem użytkownika.
- `BACKUP_FAILED` — kopia zapasowa przed zmianą nie powiodła się. Zmiana nie została wykonana.
- `INTERNAL` — nieoczekiwany błąd podczas uruchamiania narzędzia, na przykład nieudana operacja na pliku. Odpowiedź podaje oryginalny komunikat błędu.
- `STALE_PRECONDITION` — jest częścią kontraktu mostu, ale żadne z bieżących narzędzi nie zwraca tego kodu.

Żądanie, które czekało w kolejce dłużej niż 110 sekund, aplikacja już nie wykonuje. Klient dostał już przekroczenie czasu, a wykonanie go zmieniłoby dane dwa razy przy ponowieniu. Wywołanie, które trwa dłużej niż 120 sekund, dostaje przekroczenie czasu od mostu.

## Czego asystent nie może ustawić

Dla każdego zadania asystent nie może ustawić: hamaka, zadania planowanego ręcznie, drugiego ograniczenia, notatek, koloru, kodów czynności, pól niestandardowych, relacji zewnętrznych ani ręcznego opóźnienia bilansowania. Aplikacja sama oblicza kod WBS. Na poziomie projektu nie może zmienić profilu obliczeń ani opcji obliczeń. Ustawienia, motyw, język, rozszerzenia i aktualizacje są poza zasięgiem, tak samo jak biblioteka zasobów. Asystent też nie ma dostępu do raportów, układów, filtrów ani widoku. Dlaczego tak jest, opisano w [Jak działa połączenie z AI](docs://uitleg-ai-koppeling).

## Co aplikacja przechowuje

- **Token** jest na tym komputerze, w zapisanych ustawieniach aplikacji. Ma 64 znaki i jest losowy. *Nowy token* go zastępuje.
- **Port** domyślnie to 3877. Można go zmienić tylko wtedy, gdy most jest zatrzymany.
- **Panel aktywności** przechowuje ostatnie 500 wywołań, tylko gdy aplikacja jest otwarta. Argumenty i odpowiedzi są obcinane po 20 kB na pole. *Wyczyść* opróżnia listę.
- **Kopie zapasowe** znajdują się w folderze `ai-backups` w folderze danych aplikacji. *Otwórz folder kopii zapasowych* przenosi Cię tam. Nazywają się `<project name>-<timestamp>.ifc`. Zapisany plik projektu ma jeden folder dla wszystkich sesji. Dokument, którego nigdy nie zapisano, dostaje własny folder na sesję. Przy każdym uruchomieniu mostu powstaje jedna kopia na dokument, plus kopie, które sam utworzysz przyciskiem *Utwórz kopię zapasową teraz*.
- **Przerzedzanie** następuje automatycznie, osobno dla każdego folderu. Z ostatnich 7 dni zostają wszystkie, do 20 kopii. To, co utworzyła bieżąca sesja, zawsze zostaje. Potem zostaje jedna kopia na tydzień, do 30 dni wstecz, jedna na miesiąc, do roku, a potem jedna na rok. Kopie dokumentu, którego nigdy nie zapisano, znikają całkowicie po roku. Pliki w folderze, które nie należą do aplikacji, zostają nietknięte.

## Zobacz też

- [Jak działa połączenie z AI](docs://uitleg-ai-koppeling): dlaczego most jest ustawiony tak, a nie inaczej, oraz co asystent może, a czego nie może robić.
- [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen): uruchom most, połącz się i zainstaluj umiejętność.
- [Ustawienia](docs://ref-instellingen): dwa przełączniki AI.
- [Powiadomienia i ostrzeżenia](docs://ref-meldingen): kropka AI na pasku stanu.
