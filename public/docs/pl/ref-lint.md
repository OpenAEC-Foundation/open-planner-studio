# Wstążka, zakładka po zakładce

Wstążka u góry ekranu ma zakładki. Każda zakładka ma grupy przycisków. Ten artykuł opisuje, dla każdego przycisku, co on robi i gdzie widzisz wynik. Jak krok po kroku wykonać zadanie, opisują poradniki. Tutaj sprawdzisz, czym jest dany przycisk. Przycisk, który istnieje lub działa tylko pod pewnym warunkiem, ma ten warunek przy opisie.

## Jak działa wstążka

- **Zakładki** — *Plik* jest po lewej, dalej *Start*, *Planowanie*, *Zasoby*, *Widok*, *Ustawienia*, *Tabela*, *IFC*, *Raport* i, tylko przy włączonym trybie AI, *AI*.
- **Wąskie okno** — gdy wstążka się nie mieści, przyciski zmniejszają się do ikony, od prawej do lewej. Nazwa jest wtedy podpowiedzią na przycisku. Przycisk bez własnej podpowiedzi pokazuje swoją nazwę.
- **Zwiń wstążkę** — mała strzałka w prawym dolnym rogu wstążki zamienia ją w płaski pasek z samymi ikonami. Grupy *Plan bazowy i postęp* i *Połączenie* na zakładce AI znikają wtedy za jednym przyciskiem z wyskakującym oknem. Domyślnie: rozwinięta. Twój wybór jest zapamiętany.
- **Przyciski rozszerzeń** — rozszerzenie może dodać własną grupę na końcu zakładki. Taki przycisk robi to, co dało mu rozszerzenie.

## Plik

Kliknięcie *Plik* otwiera własny ekran (Backstage), który zajmuje obszar roboczy. Nie ma on wstążki. *Wstecz* zamyka ten ekran. Jeśli zmienisz coś w oknie *Ustawienia projektu* i nie zastosujesz tego, aplikacja najpierw zapyta, co z tym zrobić.

- **Nowy** — otwiera okno *Nowy projekt* i zamyka Backstage. Pola opisuje [Nowy projekt i Ustawienia projektu](docs://ref-projectinfo).
- **Otwórz** — wybiera plik i otwiera go jako dokument. Zamyka Backstage.
- **Ostatnie** — lista ostatnio otwieranych projektów; kliknięcie otwiera jeden z nich. Widoczne tylko wtedy, gdy środowisko może ponownie otwierać pliki: w aplikacji na komputer i w przeglądarkach z dostępem do plików, na przykład Chrome i Edge. W innych przeglądarkach przycisk jest, ale strona pozostaje pusta.
- **Przykłady** — wbudowane przykładowe harmonogramy, podzielone na *Pełne przykładowe harmonogramy* (znaczek *Wszystkie funkcje*) i *Proste przykłady*. Kliknięcie otwiera jeden z nich w nowej karcie.
- **Zapisz** — zapisuje projekt do pliku tego dokumentu. Jeśli dokument nie ma jeszcze pliku, najpierw wybierz nazwę i miejsce. Plik otwarty w innym formacie niż IFC nigdy nie zostanie nadpisany; wtedy *Zapisz* pyta o nazwę i miejsce dla pliku IFC.
- **Zapisz jako** — wybiera nową nazwę lub miejsce i zapisuje tam jako IFC.
- **Eksport** — karty dla każdego formatu eksportu, z opisem. Kliknięcie przekształca projekt, zapisuje go i wraca do *Start*. Jeśli harmonogram zawiera cykl, błąd pojawia się w Backstage i zostajesz tam. Jeśli projekt jest połączony z biblioteką zasobów, pod spodem pojawia się pole wyboru *Zapisz również plik biblioteki*; działa ono tylko dla karty IFC.
- **Import** — na górze karta *Aktualizuj postęp z arkusza* (nieaktywna bez zadań), poniżej importery, które dodają rozszerzenia.
- **Drukuj** — przycisk *Otwórz podgląd wydruku* przenosi cię na zakładkę *Raport*.
- **Ustawienia projektu** — metadane i profil obliczeń tego projektu. Zmiany działają dopiero po kliknięciu *Zastosuj*. Zobacz [Nowy projekt i Ustawienia projektu](docs://ref-projectinfo) oraz [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen).
- **Ustawienia aplikacji** — te same ustawienia co w oknie *Ustawienia aplikacji*.
- **Rozszerzenia** — zarządzanie rozszerzeniami i ich instalacja; zobacz [Instalowanie i zarządzanie rozszerzeniem](docs://howto-extensie-installeren).
- **Biblioteka** — zarządzanie bibliotekami zasobów; zobacz [Zarządzanie bibliotekami zasobów i udostępnianie ich](docs://howto-bibliotheken-beheren).
- **Pomoc** — wbudowana dokumentacja, też z klawiszem F1. Pole wyszukiwania szuka w tytułach, nagłówkach i w samym tekście. Artykuły są w czterech działach: *Samouczki*, *Poradniki*, *Wyjaśnienia* i *Materiały referencyjne*. W polu *Język dokumentacji* wybierz *Zgodnie z językiem aplikacji* lub język z listy. Holenderski i angielski to języki źródłowe. Pozostałe języki mają tylko artykuły, które już zostały przetłumaczone. Jeśli artykułu nie ma w twoim języku, czytasz wersję angielską z odpowiednim komunikatem. Wybór zostaje na tym urządzeniu, osobno od języka aplikacji. Pomoc otworzysz też z okna lub panelu: wiele okien oraz panele *Właściwości*, *Zasoby* i *Ostrzeżenia* mają w prawym górnym rogu znak zapytania (*Pomoc do tego tematu*), który otwiera Pomoc z artykułem o tym oknie lub panelu. Jeśli w oknie wpisałeś coś, czego jeszcze nie zapisano, aplikacja najpierw zapyta: *Zapisz*, *Anuluj* (odrzuć wpis) lub *Wstecz* (zostań w oknie). Potem okno się zamyka i otwiera się Pomoc. Kilka okien, na przykład *Edytuj zadanie* i *Bilansuj zasoby*, zawsze pyta. Bez wpisanych danych Pomoc otwiera się od razu.
- **Rozpocznij przewodnik** — zamyka Backstage i uruchamia przewodnik od kroku 1.
- **Zamknij projekt** — zamyka aktywny dokument. Jeśli ma niezapisane zmiany, aplikacja prosi o potwierdzenie.

## Start

### Start › Plik

- **Nowy**, **Zapisz**, **Otwórz** i **Zapisz jako** — te same działania co w *Plik*.
- **Ostatnie** — lista rozwijana z ostatnimi projektami; kliknięcie otwiera jeden z nich. Widoczne pod tym samym warunkiem co *Plik › Ostatnie*. Bez ostatnich plików pokazuje *Brak ostatnich plików*.
- **Eksport** — lista rozwijana z formatami eksportu (krótkie nazwy). Kliknięcie przekształca projekt i go zapisuje.

### Start › Edycja

- **Cofnij** — cofa ostatnią zmianę. Nieaktywne, gdy nie ma czego cofnąć.
- **Ponów** — przywraca ostatnio cofniętą zmianę. Nieaktywne, gdy nie ma czego ponowić.
- **Usuń** — usuwa zaznaczone zadania razem z ich podzadaniami, jednym krokiem. Nieaktywne bez zaznaczenia.

### Start › Zadania

- **Zadanie** — dodaje zadanie o nazwie *Nowe zadanie*, z czasem trwania 5 dni roboczych, zaczynające się na początku projektu. (Jeśli *Włącz planowanie godzinowe* jest włączone, a *Domyślna jednostka nowych zadań* w oknie *Ustawienia projektu* to godziny, czas trwania wynosi 5 godzin.) Jeśli zadanie jest zaznaczone i widok jest zwykłym drzewem, nowe zadanie trafia bezpośrednio pod najniżej zaznaczonym zadaniem (podpowiedź *Nowe zadanie bezpośrednio pod zaznaczeniem*). Bez zaznaczenia trafia na dół (podpowiedź *Nowe zadanie na końcu listy*). Przy zaznaczeniu, ale podczas filtrowania, grupowania lub sortowania, również trafia na dół. Wtedy czerwone powiadomienie mówi, że aplikacja nie może umieścić zadania pod zaznaczeniem. Jest przycisk *Wyczyść*. Nowe zadanie staje się jedynym zaznaczeniem, wykres Gantt przechodzi do niego, a jego nazwę można od razu nadpisać w panelu *Właściwości*.
- **Kamień milowy ▾** — lista rozwijana, która dodaje kamień milowy (czas trwania 0) w tym samym miejscu co *Zadanie*. *Kamień milowy początkowy* i *Kamień milowy końcowy* ustawiają typ kamienia milowego. Nowy kamień milowy nosi nazwę *Nowy kamień milowy* i dostaje rodzaj robót *Inne*. *Punkt inspekcji (obowiązkowy)* tworzy kamień milowy końcowy z rodzajem robót *Inspekcja* i znacznikiem *Obowiązkowy (umowny)*, o nazwie *Nowy punkt inspekcji*.
- **Połącz ▾** — lista rozwijana z czterema stałymi działaniami; główny przycisk nigdy nie zmienia znaczenia. Cztery działania opisuje *Planowanie › Relacje*.
- **Podziel zadanie** — włącza lub wyłącza tryb podziału. Po włączeniu pasek pod wstążką wyjaśnia, że klikasz na pasek w miejscu początku przerwy i przeciągasz w prawo o jej długość. Przycisk jest nieaktywny, gdy wykres Gantt nie jest widoczny (na zakładkach *Tabela*, *IFC* i *Raport* oraz przy pełnym panelu zasobów); podpowiedź brzmi wtedy *Dostępne tylko wtedy, gdy wykres Gantta jest widoczny*. Zobacz [Dzielenie zadania](docs://howto-taak-splitsen).

### Start › Harmonogram

- **Oblicz** — oblicza harmonogram: daty, zapas, ścieżkę krytyczną i obciążenie zasobów. Nigdy nie dzieje się to samo z siebie, chyba że włączysz *Oblicz automatycznie* (*Ustawienia aplikacji*, zakładka *Planowanie*, nagłówek *Obliczanie*). Gdy harmonogram jest nieaktualny, pasek stanu pokazuje *Nieaktualne — przelicz (F5)*.

### Start › Powiększenie

- **Powiększ +** — powiększa oś czasu o 10 pikseli na dzień.
- **Pomniejsz -** — pomniejsza oś czasu o 10 pikseli na dzień.

## Planowanie

### Planowanie › Harmonogram

Przycisk *Oblicz* jest taki sam jak na zakładce *Start*.

- **Przesuń projekt…** — otwiera okno *Przesuń projekt*. Nieaktywne bez daty początku projektu. Zobacz [Przesuwanie projektu](docs://howto-project-verplaatsen).
- **Ostrzeżenia** — pokazuje lub ukrywa panel *Ostrzeżenia* w prawej kolumnie. Przycisk jest podświetlony, gdy widzisz panel. Włączenie rozwija zwiniętą kolumnę. Co w nim jest, opisuje [Powiadomienia i ostrzeżenia](docs://ref-meldingen).

### Planowanie › Relacje

Grupa ma przycisk *Połącz ▾* z czterema działaniami oraz przycisk *Podziel zadanie* (tak samo jak na zakładce *Start*). Cztery działania:

- **Narysuj relację** — włącza lub wyłącza tryb łączenia; gdy jest włączony, pojawia się znacznik wyboru, a przycisk główny jest podświetlony. Po włączeniu przeciągasz z jednego paska na drugi w wykresie Gantt, żeby utworzyć relację. Pasek pod wstążką pokazuje, jak wyjść z trybu (*Zakończ* lub Esc). Nieaktywne, gdy wykres Gantt nie jest widoczny.
- **Połącz zaznaczone zadania** — tworzy relację zakończenie-rozpoczęcie bez opóźnienia między dwoma zadaniami; zadanie zaznaczone jako pierwsze staje się poprzednikiem. Dostępne tylko przy dokładnie dwóch zaznaczonych zadaniach (w przeciwnym razie *Zaznacz dokładnie dwa zadania*). Powtórzona relacja lub cykl zostaje odrzucona z komunikatem.
- **Dodaj relację zewnętrzną…** — otwiera okno, w którym dodasz zewnętrznego poprzednika lub następnika do zaznaczonego zadania. Dostępne tylko przy dokładnie jednym zaznaczonym zadaniu (w przeciwnym razie *Zaznacz dokładnie jedno zadanie*).
- **Odśwież wszystkie relacje zewnętrzne** — odświeża kotwice wszystkich relacji zewnętrznych i pokazuje w menu, ile z nich zaktualizowano lub ile brakuje. Dostępne tylko wtedy, gdy projekt ma relacje zewnętrzne (w przeciwnym razie *Ten projekt nie zawiera relacji zewnętrznych*).

Więcej o tym, dlaczego relacje działają tak, a nie inaczej, znajdziesz w [Tworzenie relacji](docs://howto-relaties-leggen) oraz [Relacje i opóźnienie](docs://uitleg-relaties).

### Planowanie › Śledzenie ścieżki

- **Poprzedniki** — podświetla w wykresie Gantt poprzedników zaznaczonych zadań, łańcuch po łańcuchu.
- **Następniki** — podświetla następników zaznaczonych zadań.

Możesz włączyć obie opcje naraz; kolejne kliknięcie przycisku wyłącza tę stronę. Relacje wiodące dostają mocniejszy odcień. Zobacz [Śledzenie ścieżki](docs://howto-pad-traceren).

### Planowanie › Kalendarz

- **Kalendarz** — otwiera okno *Kalendarze* z biblioteką kalendarzy projektu. Zobacz [Okna kalendarzy](docs://ref-kalenders).

### Planowanie › Struktura

- **Kody i pola** — otwiera okno *Kody i pola* dla kodów czynności i pól niestandardowych. Zobacz [Kody i pola niestandardowe](docs://howto-codes-en-velden).
- **WBS auto** — włącza lub wyłącza automatyczne numerowanie kodów WBS. Domyślnie: włączone w nowym projekcie. W otwartym pliku bez tego ustawienia: włączone, jeśli plik jest pusty lub wszystkie kody już pasują do numeracji drzewa, w przeciwnym razie wyłączone. Po włączeniu całe drzewo zostaje od razu ponumerowane, kody podążają za każdą zmianą struktury, a pole *Kod WBS* w panelu i w oknie jest nieaktywne.
- **Ponumeruj WBS** — numeruje kody WBS jeden raz, zgodnie z położeniem w drzewie (1.2.3). Nieaktywne, gdy *WBS auto* jest włączone.
- **Szablony** — lista rozwijana z zapisanymi szablonami WBS, każdy z liczbą zadań i relacji. Kliknięcie wstawia szablon pod zaznaczonym zadaniem albo na najwyższym poziomie, gdy nic nie jest zaznaczone. Ikona kosza usuwa szablon. Bez szablonów pokazuje, jak zapisać szablon (kliknij prawym przyciskiem zadanie sumaryczne i wybierz *Zapisz gałąź jako szablon*). Zobacz [Zapisywanie i wstawianie szablonów WBS](docs://howto-wbs-sjablonen).
- **Wcięcie** — zamienia każde zaznaczone zadanie w podzadanie zadania przed nim. Nieaktywne bez zaznaczenia i gdy filtrujesz, grupujesz lub sortujesz; podpowiedź brzmi wtedy *Niedostępne podczas filtrowania/grupowania/sortowania*.
- **Zmniejsz wcięcie** — przenosi zaznaczone zadania o jeden poziom wyżej, zaraz za ich obecne zadanie nadrzędne. Warunki są takie same jak dla przycisku *Wcięcie*.

### Planowanie › Plan bazowy i postęp

- **Zarządzaj planami bazowymi…** — otwiera okno planów bazowych. Zobacz [Zapisywanie i zarządzanie planem bazowym](docs://howto-baseline-opslaan-en-beheren).
- **Data statusu** — data, do której mierzysz postęp. Wpisz datę. Krzyżyk (*Wyczyść datę statusu*) ją usuwa. Jeśli kalendarz projektu ma pasma godzin pracy, aplikacja liczy w godzinach, a obok daty pojawia się pole czasu (MS Project często zapisuje 17:00). Czas wtedy ma znaczenie: 12:00 zamiast 17:00 daje pół dnia innej pozostałej pracy. Bez pasm godzin pracy aplikacja liczy w pełnych dniach i nie ma pola czasu. Efekt: postęp jest mierzony do tej daty, a linia daty statusu i linia postępu w wykresie Gantt są na niej ustawione. Zobacz [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).
- **Tryb postępu** — wybór między *Retained Logic* a *Progress Override*. Domyślnie: *Retained Logic*. Efekt: przy *Retained Logic* pozostała praca rozpoczętego następnika podąża za relacją; przy *Progress Override* pozostała praca zaczyna się w dacie statusu, bez czekania na poprzednika. Zobacz [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen).

Na zwiniętej wstążce te trzy elementy są za jednym przyciskiem z flagą o nazwie *Plan bazowy i postęp*.

### Planowanie › Postęp

- **Eksportuj arkusz postępu** — tworzy arkusz `.xlsx` z zadaniami, do uzupełnienia postępu poza aplikacją. Nieaktywne bez zadań.
- **Aktualizuj postęp z arkusza** — otwiera okno importu dla zwróconego arkusza. Nieaktywne bez zadań. Zobacz [Importowanie postępu z arkusza](docs://howto-voortgang-importeren).

Ta grupa jest też na zakładkach *Tabela* i *Raport*.

## Zasoby

### Zasoby › Zarządzanie

- **Zasoby** — otwiera pełny panel zasobów; zajmuje cały obszar roboczy. Podświetla się, gdy widzisz ten panel. Zobacz [Panel zasobów](docs://ref-resourcepaneel).
- **Dok zasobów** — dokuje kompaktowy panel zasobów w prawej kolumnie, obok wykresu Gantt. Podświetla się, gdy dok jest widoczny; drugie kliknięcie go zamyka. Dok pokazuje tylko nazwę, kolor, ostrzeżenie o przeciążeniu i *Maks. jednostki*. Gdy zaznaczone są zadania, pokazuje tylko zasoby tych zadań.
- **Nowy zasób** — otwiera pełny panel zasobów z pustym wierszem roboczym dla nowego zasobu. Nic nie powstaje, dopóki nie wpiszesz nazwy. Jeśli klikniesz obok, nic nie zostaje. Zasób trafia do biblioteki zasobów albo do projektu, zależnie od widoku.

### Zasoby › Przydział

- **Przydziel ▾** — przydziela zasób do zaznaczonego zadania. Dostępne tylko przy dokładnie jednym zaznaczonym zadaniu, które jest zadaniem bez podzadań, a nie kamieniem milowym; w przeciwnym razie przycisk jest szary. W menu ustawiasz najpierw *Jedn./dzień* (domyślnie 1) i *Krzywa* (domyślnie *Jednolity*); kliknięcie zasobu przydziela go z tymi wartościami. Menu pokazuje tylko zasoby, które nie są jeszcze przypisane do zadania. Zobacz [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen).

### Zasoby › Histogram

- **Histogram** — pokazuje lub ukrywa pasek histogramu pod wykresem Gantt. Domyślnie: wyłączony. Twój wybór jest zapamiętany.
- **Poprzedni** i **Następny** — przechodzą przez zasoby w selektorze paska histogramu; *Wszystkie zasoby* to dodatkowy krok w tym cyklu. Nieaktywne, gdy histogram jest wyłączony albo projekt nie ma zasobów.

### Zasoby › Bilansowanie

- **Bilansuj…** — otwiera okno *Bilansuj zasoby*. Zobacz [Bilansowanie](docs://uitleg-nivelleren).
- **Wyczyść bilansowanie** — usuwa przesunięcia i przerwy, które bilansowanie wprowadziło. Nieaktywne, gdy żadne zadanie nie ma wyniku bilansowania.

### Zasoby › Przeciążenie

- **Przeciążenie** — to nie przycisk, lecz licznik: liczba zasobów z co najmniej jednym przeciążonym dniem, albo *Brak*. Gdy taki zasób jest, licznik jest czerwony z ikoną ostrzeżenia. Liczba odświeża się po *Oblicz* oraz po zmianach zasobów i przydziałów; jeśli zmienisz daty zadań, liczy się to dopiero po *Oblicz*.

## Widok

### Widok › Skala czasu

- **Powiększ +** i **Pomniejsz -** — powiększają lub pomniejszają oś czasu o 10 pikseli na dzień.
- **Resetuj** — ustawia powiększenie z powrotem na domyślne 30 pikseli na dzień.
- **Dopasuj do projektu** — powiększa i przewija tak, aby cały projekt był widoczny.
- **Wybór skali** — lista z *Rok*, *Kwartał*, *Miesiąc*, *Tydzień*, *Dzień* oraz, tylko wtedy, gdy opcja *Włącz planowanie godzinowe* jest włączona, *Godzina*. Wybór ustawia stałe powiększenie. Pokazana wartość zależy od bieżącego powiększenia, a pod nią jest to powiększenie podane w pikselach na dzień.

### Widok › Wyświetlanie

- **Kolumny…**, **Filtr…**, **Grupuj…** i **Sortuj…** — widoczne tylko wtedy, gdy włączona jest opcja *Pokaż klasyczne przyciski widoku* (*Ustawienia aplikacji*, karta *Zaawansowane*, nagłówek *Funkcje starszego typu*). Domyślnie: wyłączone. *Kolumny…* przenoszą do karty *Tabela* i tam otwierają wybór kolumn. *Filtr…* otwiera okno filtra od razu, o ile nie ma zapisanego filtra. Przy zapisanych filtrach otwiera menu z *Filtr…*, *Wyczyść* (tylko wtedy, gdy filtr jest aktywny) i zapisanymi filtrami. *Grupuj…* pozwala na dwa poziomy. *Sortuj…* pozwala na więcej poziomów. Przycisk się podświetla, gdy to ustawienie widoku jest aktywne. W bieżącej wstążce robisz to przyciskami układów; zobacz [Tworzenie i używanie układu](docs://howto-layouts-gebruiken).

### Widok › Struktura

- **Zwiń** — zwija wybrane zadania sumaryczne; bez zaznaczenia wszystkie. W widoku z grupowaniem zwija wszystkie grupy, a zaznaczenie nie ma wpływu.
- **Rozwiń** — odwrotność.

### Widok › Układ

- **Przyciski układów** — każdy układ to przełącznik z ikoną i nazwą. *Diagram zasobów* jest w zestawie standardowym. Jedno kliknięcie włącza układ, kolejne go wyłącza i przywraca widok sprzed kliknięcia. Układy z różnymi częściami mogą być włączone razem. Kliknij układ prawym przyciskiem myszy: *Edytuj…*, *Duplikuj* i *Usuń* (po potwierdzeniu). Dołączony układ można tylko zduplikować.
- **Nowy układ** — otwiera okno układu dla nowego układu.

### Widok › Prezentacja

- **Prezentacja** — włącza lub wyłącza tryb prezentacji (zakończ klawiszem Esc, w aplikacji desktopowej także F11): tylko widok Gantt wypełnia ekran. Zobacz [Prezentacja na dużym ekranie](docs://howto-presentatie).
- **Widok podzielony** — dzieli widok Gantt na dwa okna czasu. Oba zaczynają się od Twojego bieżącego powiększenia i położenia (podział 50 procent) albo scala je ponownie w jeden. Domyślnie: wyłączone. Zobacz [Używanie widoku podzielonego i minimapy](docs://howto-split-view-en-mini-map).
- **Minimapa** — pokazuje lub ukrywa minimapę. Domyślnie: wyłączone. Twój wybór jest zapamiętany.

### Widok › Panele

- **Właściwości** — pokazuje lub ukrywa panel *Właściwości* w prawej kolumnie. Domyślnie: włączone. Zobacz [Okno zadania i panel właściwości](docs://ref-taak-eigenschappen).

Przyciski *Zasoby*, *Dok zasobów* i *Histogram* są takie same jak na karcie *Zasoby*, a przycisk *Ostrzeżenia* jest taki sam jak na karcie *Planowanie*.

**Kolumna po prawej.** Kolumna po prawej stronie wykresu Gantt jest widoczna, gdy włączony jest co najmniej jeden z paneli *Właściwości*, *Dok zasobów* lub *Ostrzeżenia*. Jeśli żaden nie jest włączony, kolumny nie ma. Jeśli pełny panel zajmuje obszar roboczy, na przykład pełny panel zasobów, kolumna znika. Tylko na karcie *Tabela* kolumna zostaje.

- **Szerokość** — przeciągnij podział między obszarem roboczym a kolumną. Jedna szerokość dotyczy wszystkich paneli w kolumnie.
- **Podział** — jeśli włączone są dwa panele, przeciągnij granicę między nimi. Jeśli włączony jest jeden, ten panel wypełnia całą kolumnę.
- **Zwiń** — przycisk *Zwiń kolumnę boczną* w nagłówku ukrywa kolumnę. Wąski pasek z przyciskiem *Rozwiń kolumnę boczną* przywraca ją z tymi samymi panelami co wcześniej.
- **Zamknij** — każdy panel ma krzyżyk w nagłówku. Jest to ten sam przełącznik co przycisk na wstążce.
- **Pełny panel** — w panelu *Dok zasobów* przycisk *Pełny panel* otwiera pełny panel zasobów.

### Widok › Plany bazowe i postęp

Ta grupa ma taką samą nazwę jak na karcie *Planowanie*, ale zawiera opcje rysowania wykresu Gantt.

- **Nakładka planu bazowego** — pokazuje aktywny plan bazowy jako cienki pasek pod każdym paskiem zadania. Domyślnie: włączone. Bez aktywnego planu bazowego nie ma nic do zobaczenia.
- **Linia postępu** — rysuje linię na dacie statusu, która wybrzusza się dla każdego zadania zgodnie z jego postępem. Domyślnie: włączone. Bez daty statusu nie ma nic do zobaczenia. Gdy linia postępu jest włączona, ta linia jest też znacznikiem daty statusu.
- **Linia daty statusu** — rysuje przerywaną linię na dacie statusu. Domyślnie: włączone. Widzisz ją tylko wtedy, gdy linia postępu jest wyłączona, bo w przeciwnym razie zastępuje ją linia postępu. Etykieta z datą w nagłówku zostaje, dopóki co najmniej jedna z tych dwóch linii jest włączona. Etykieta podąża za Twoim zapisem daty, na przykład 20-09-2006. Gdy aplikacja oblicza w godzinach, linia i etykieta są ustawione na porze dnia, a etykieta pokazuje też godzinę, na przykład 20-09-2006 17:00.
- **Kolory pasków** — wybiera sposób kolorowania pasków: *Ścieżka krytyczna* (domyślnie), *Na zadanie — automatycznie* albo *Według kategorii* z wyborem pola. Gdy tego pola nie ma w tym projekcie, menu mówi, że tymczasowo używany jest *Rodzaj robót*. Poza wyborem *Ścieżka krytyczna* czerwony kontur oznacza ścieżkę krytyczną. Wybór dotyczy też raportu.
- **Akcent zasobu** — rysuje cienki pasek w kolorze zasobu pod każdym paskiem zadania bez podzadań, podzielony proporcjonalnie do jednostek na dzień. Domyślnie: wyłączone.
- **Pas zapasu** — rysuje zielony pas za niekrytycznym paskiem, do najpóźniejszego zakończenia zadania. Domyślnie: włączone.
- **Linie relacji** — pokazuje lub ukrywa linie relacji między zadaniami. Domyślnie: włączone. Wybór należy do dokumentu i do układu.

## Ustawienia

### Ustawienia › Projekt

- **Ustawienia projektu** — otwiera okno *Ustawienia projektu*: metadane projektu oraz, w bloku *Profil obliczeń i opcje*, jak projekt się oblicza. Zobacz [Nowy projekt i Ustawienia projektu](docs://ref-projectinfo).
- **Ustawienia aplikacji** — otwiera okno *Ustawienia aplikacji* z kartami *Wygląd*, *Planowanie* i *Zaawansowane*. Te same ustawienia są pod *Plik › Ustawienia aplikacji*.

### Ustawienia › Kalendarz

Przycisk *Kalendarz* jest taki sam jak na karcie *Planowanie*.

### Ustawienia › Skróty klawiszowe

- **Skróty klawiszowe** — otwiera okno *Skróty klawiszowe*.

## Tabela

Karta *Tabela* pokazuje zadania jako pełną tabelę zamiast wykresu Gantt. Grupy *Plik*, *Edycja*, *Zadania*, *Harmonogram* i *Śledzenie ścieżki* są takie same jak na kartach *Start* i *Planowanie* i działają na tym samym zaznaczeniu. Nie ma grupy *Powiększenie*, bo powiększenie tylko skaluje oś czasu wykresu Gantt. Przyciski *Podziel zadanie* i *Rysuj relację* są tu wyłączone: nie ma wykresu Gantt.

### Tabela › Kolumny

- **Kolumny…** — otwiera wybór kolumn tej tabeli. Ten sam wybór otwiera się plusem w nagłówku tabeli. Podpowiedź mówi *Wybierz kolumny widoku Tabela*. Zobacz [Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen) i [Kolumny tabeli](docs://ref-tabelkolommen).

## IFC

Karta pokazuje panel IFC w obszarze roboczym. Wstążka nie ma tu przycisków, jest tylko wiersz tekstu *IFC - Industry Foundation Classes, w schemacie projektu (domyślnie IFC 4.3 ADD2)*.

## Raport

### Raport › Raport

- **Drukuj** — tylko na tej karcie, gdzie nic nie robi, bo *Raport* jest już otwarty; opcje raportu są na ekranie raportu.

## AI

Karta *AI* istnieje tylko wtedy, gdy opcja *Włącz tryb AI* jest włączona (*Ustawienia aplikacji*, karta *Zaawansowane*, nagłówek *Tryb AI*). Domyślnie: wyłączone. Wyłączenie tej opcji usuwa kartę i zatrzymuje mostek. Asystent AI pracuje z Twoim harmonogramem przez mostek MCP, który uruchamiasz tutaj. Zobacz [Łączenie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Serwer

- **Uruchom mostek** i **Zatrzymaj mostek** — uruchamiają lub zatrzymują mostek MCP. Obok jest stan: *Wyłączony*, *Działa na porcie …*, *Port … zajęty* (z powodem) lub *Błąd*. Niedostępne w wersji przeglądarkowej; podpowiedź mówi *Mostek działa tylko w aplikacji desktopowej*. Ten sam stan pokazuje się jako kropka z *AI* na pasku stanu.

### AI › Połączenie

- **Port** — port mostka. Domyślnie: 3877. Można go zmienić tylko wtedy, gdy stan to *Wyłączony* (podpowiedź: *Można edytować tylko wtedy, gdy serwer jest zatrzymany*).
- **Token** — hasło mostka, wyświetlane jako ukryte. Małe przyciski *Pokaż token*/*Ukryj token*, *Kopiuj* i *Nowy token*. *Nowy token* najpierw pyta o potwierdzenie, bo nowy token przerywa wszystkie istniejące połączenia; gdy mostek działa, uruchamia się ponownie z nowym tokenem.
- **Połącz** — pokazuje szczegóły połączenia: punkt końcowy (endpoint), token, fragment konfiguracji i polecenie połączenia, które wklejasz do swojego agenta AI.

### AI › Bezpieczeństwo

- **Wstrzymaj** / **Wznów** — tymczasowo odrzuca wszystkie zmiany wykonane przez AI; odczyt pozostaje dozwolony, a mostek nadal działa. Przycisk świeci się na czerwono, gdy zmiany AI są wstrzymane.
- **Tylko do odczytu** — odrzuca wszystkie narzędzia, które zmieniają dane, dopóki ta opcja jest włączona.
- **Auto-kopia: włączona** / **Auto-kopia: wyłączona** — automatycznie zapisuje kopię IFC przed pierwszą zmianą AI w każdym dokumencie. Domyślnie: włączona.
- **Zrób kopię teraz** — zapisuje kopię od razu i podaje nazwę pliku. Tylko aplikacja desktopowa.
- **Otwórz folder kopii** — otwiera folder z kopiami. Tylko aplikacja desktopowa.

### AI › Aktywność

- **Panel aktywności** — pokazuje lub ukrywa panel *Aktywność AI* z wywołaniami mostka, z ich argumentami i odpowiedzią.
