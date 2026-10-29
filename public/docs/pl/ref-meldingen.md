# Powiadomienia i ostrzeżenia

Aplikacja informuje Cię, co się dzieje, na czterech miejscach: w pasku stanu na dole, w panelu *Ostrzeżenia* w prawej kolumnie, w powiadomieniach, które na krótko pojawiają się na dole ekranu, oraz w paskach pod wstążką. Ten artykuł opisuje dla każdego miejsca, co widzisz, kiedy się pojawia i co możesz z tym zrobić. Dlaczego zadanie w harmonogramie jest krytyczne albo zasób przeciążony, opisano w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad); rozwiązywanie przeciążenia opisano w [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen); tworzenie relacji opisano w [Tworzenie relacji](docs://howto-relaties-leggen).

## Różnica między czterema

- **Pasek stanu** — stała linia z licznikami. Pochodzą z ostatniego obliczenia i zostają, aż ponownie obliczysz.
- **Panel ostrzeżeń** — lista za tymi licznikami. Zawiera wszystko, co znalazło ostatnie obliczenie. Kliknięcie przenosi Cię do zadania, relacji lub zasobu. Lista pochodzi z ostatniego obliczenia; nic nie jest zapisywane.
- **Powiadomienia** — krótkie komunikaty o czymś, co właśnie wykonano (zapis się nie powiódł, relacja odrzucona, import odczytany). Informacja znika po chwili, a błąd zostaje, aż go zamkniesz. Nie ma ich w panelu.
- **Pasek pod wstążką** — kolorowy pasek z wyjaśnieniem i jednym przyciskiem. Należy do stanu dokumentu albo trybu i zostaje, tak długo jak ten stan obowiązuje. Zobacz *Paski pod wstążką*.

## Pasek stanu

Pasek na dole pokazuje od lewej do prawej:

- **Zadania:** — liczba zadań liściowych (zadania sumaryczne się nie liczą).
- **Kamienie milowe:** — liczba kamieni milowych.
- **Ścieżka krytyczna: N zadań, N dni roboczych** — liczba zadań krytycznych i czas trwania projektu. Widoczne tylko po obliczeniu.
- **Koniec:** — koniec projektu z ostatniego obliczenia. Widoczne tylko po obliczeniu. Pusty projekt nie ma końca.
- **N terminów ostatecznych przekroczonych**, **N ograniczeń naruszonych**, **N relacji z postępem poza kolejnością** i **N zasobów przeciążonych** — każdy jako przycisk z ikoną ostrzeżenia. Widoczny tylko wtedy, gdy licznik jest większy niż 0 i istnieje obliczenie. Kliknięcie otwiera panel *Ostrzeżenia* (podpowiedź: *Otwórz panel ostrzeżeń (szczegóły i nawigacja)*). Jeśli jesteś na karcie *IFC* lub *Raport*, aplikacja jednocześnie przechodzi na *Start*, ponieważ prawa kolumna tam nie istnieje. Licznik *zasobów przeciążonych* odświeża się też po zmianach zasobów i przydziałów. Pozostałe liczniki zmieniają się dopiero po kliknięciu przycisku *Oblicz*. Te cztery liczniki to tylko wybór. To, co panel pokazuje dodatkowo (obcięte wyprzedzenie, zignorowana relacja, hamak bez drivera końca, ograniczona data zakończenia, błąd harmonogramu), nie jest na pasku stanu.
- **Nieaktualny — przelicz (F5)** — z ikoną ostrzeżenia (podpowiedź: *Harmonogram nieaktualny — przelicz (F5)*). Widoczne, gdy zmienisz coś, co wpływa na harmonogram, i jeszcze go nie przeliczono. Jeśli włączono *Oblicz automatycznie*, nie pojawia się, chyba że obliczenie dało błąd. Wtedy zostaje.
- **Zaznaczenie: N zadań** — liczba zaznaczonych zadań. Widoczne tylko przy zaznaczeniu.
- **Skala:** i **Zoom: Npx/dzień** — skala czasu na osi czasu i poziom zoomu. Skala zależy od zoomu.
- **Niezapisane** — dopóki dokument zawiera zmiany, których nie ma w pliku.
- **AI** — kolorowa kropka z napisem AI, tylko gdy tryb AI jest włączony. Podpowiedź zaczyna się od *Most AI:* i pokazuje *Wyłączony*, *Aktywny na porcie N*, *Port N zajęty* albo *Błąd*. Kliknięcie otwiera kartę *AI*.
- **Terminal debugowania** — przycisk terminala, tylko gdy terminal debugowania jest włączony. Pokazuje lub ukrywa terminal (*Pokaż terminal debugowania* / *Ukryj terminal debugowania*).

## Panel ostrzeżeń

- **Otwieranie** — *Planowanie › Harmonogram › Ostrzeżenia*, *Widok › Panele › Ostrzeżenia* albo licznik na pasku stanu. Panel znajduje się w prawej kolumnie, pod panelem *Właściwości* i dokiem zasobów, i rozwija zwiniętą kolumnę. Domyślnie jest zamknięty i nie jest zapamiętywany między sesjami. Wysokość przeciągasz za krawędź, gdy panel stoi pod innymi panelami. Ta wysokość jest zapamiętywana. Krzyżyk w prawym górnym rogu zamyka panel (*Zamknij ostrzeżenia*).
- **Wiersz nagłówka** — *Błędy: N, ostrzeżenia: N*. Jeśli jeszcze nic nie obliczono, pojawia się: *Jeszcze nie obliczono — naciśnij Oblicz (F5), aby uruchomić kontrole.*
- ***Oblicz*** — przycisk w wierszu nagłówka. Widoczny, dopóki harmonogram jest nieaktualny albo jeszcze nie obliczony. Robi to samo co *Oblicz* na wstążce.
- **Ikona ostrzeżenia w wierszu nagłówka** — gdy harmonogram jest nieaktualny. Podpowiedź: *Harmonogram nieaktualny — ta lista pochodzi z ostatniego obliczenia. Przelicz (F5)*. Lista nie jest ukryta, tylko oznaczona jako nieaktualna.
- **Pusta lista** — *Brak ostrzeżeń. Harmonogram przechodzi wszystkie kontrole.*
- **Wiersz** — na górze miejsce (zadanie, relacja, zasób albo projekt), a pod nim opis. Błąd ma własny ośmiokątny znak, ostrzeżenie trójkątny. Zadanie pojawia się jako `nazwa WBS`. Relacja pojawia się jako `poprzednik → następnik (FS+2d)`, z typem i opóźnieniem. Kliknięcie przenosi do miejsca (podpowiedź *Przejdź do: …*), zobacz niżej. Wiersz, który należy do aktywnego zadania (dla relacji: do jej następnika) albo do zasobu wybranego w histogramie, jest podświetlony.
- **Kolejność** — najpierw błędy. Potem według rodzaju, w kolejności poniższej listy. W obrębie rodzaju w kolejności dokumentu (dla relacji: kolejność następnika, dla zasobu: kolejność listy zasobów). Zadanie, relacja albo zasób usunięty po ostatnim obliczeniu znika z listy.

### Rodzaje ostrzeżeń

- **Błąd harmonogramu** — *Nie można obliczyć harmonogramu: …* z przyczyną za dwukropkiem, zobacz niżej. Kliknięcie: przy cyklu aplikacja zaznacza wszystkie zadania w cyklu i przechodzi do pierwszego. Przy innych błędach nie ma dokąd przejść, a wiersz nie jest przyciskiem.
- **Przekroczony termin** — *Przekroczono termin {date} — najwcześniejsze zakończenie {date}*. Zadanie ma termin ostateczny, a obliczenie go nie spełnia. Kliknięcie przenosi do zadania. Naprawa: zmień logikę albo czas trwania, albo przesuń termin ostateczny.
- **Naruszone ograniczenie** — *Ograniczenie {typ i data} jest nadpisywane przez logikę (ujemny zapas)*. Ograniczenia nie da się spełnić bez złamania logiki, a zapas jest ujemny. Kliknięcie przenosi do zadania. Zobacz [Ograniczenia](docs://uitleg-constraints).
- **Poza kolejnością** — *Poza kolejnością: postęp następnika przeczy relacji*. Postęp następnika nie pasuje do typu relacji. Na przykład następnik jest już w toku, a poprzednik przy relacji zakończenie-rozpoczęcie nie jest jeszcze gotowy. Kliknięcie zaznacza oba zadania, z aktywnym następnikiem. Sprawdź rzeczywiste daty albo relację.
- **Obcięte wyprzedzenie** — *Wyprzedzenie obcięte przez start projektu — relacja nie jest w pełni zachowana*. Wyprzedzenie (ujemne opóźnienie) relacji sięga przed początek projektu. Kliknięcie zaznacza oba zadania.
- **Zignorowana relacja** — *Relacja zignorowana: brakuje poprzednika lub następnika albo nie jest zadaniem liściem*. Obliczenie nie używa tej relacji. Kliknięcie zaznacza zadania, które jeszcze istnieją. Zobacz [Relacje](docs://uitleg-relaties).
- **Hamak bez sterownika końca** — *Hamak bez sterownika końca (brak poprzednika FF/SF): czas trwania spada do zera*. Kliknięcie przenosi do zadania. Zobacz [Zadania hamakowe](docs://howto-hammock).
- **Ograniczona data zakończenia** — *Data zakończenia obcięta: kalendarz nie zostawia dla tego zadania żadnego roboczego okna*. Obliczenie trafiło w limit dni, które przeszukuje. Na przykład z powodu bardzo długiego, nieprzerwanego ciągu dni wolnych w kalendarzu. Kliknięcie przenosi do zadania. Zobacz [Kalendarze i dni robocze](docs://uitleg-kalenders).
- **Przeciążenie** — *Przeciążenie przez N dni (pierwszy – ostatni)*, z dodatkiem *zasób nie pracuje tych dni według swojego kalendarza*, jeśli wszystkie dni są dniami wolnymi. Przy mieszance dodatek brzmi *z czego N dni zasób nie pracuje według swojego kalendarza*. Kliknięcie zaznacza zadania z przydziałem tego zasobu, włącza histogram i wybiera w nim ten zasób. Z kart *Tabela*, *IFC* lub *Raport* aplikacja przechodzi do panelu *Zasoby*. Zobacz [Panel zasobów](docs://ref-resourcepaneel).

### Przyczyny błędu harmonogramu

- *Zależność cykliczna między zadaniami: {ścieżka}* — relacje tworzą cykl. Zadania są w tym ciągu. Odwróć albo usuń jedną relację.
- *W kalendarzu nie ustawiono dni roboczych* — daj kalendarzowi co najmniej jeden dzień roboczy. Zobacz [Okna kalendarza](docs://ref-kalenders).
- *Nieprawidłowy czas trwania w dniach dla zadania '{zadanie}'* i *Nieprawidłowy czas trwania w godzinach dla zadania '{zadanie}'* — czas trwania zadania nie jest prawidłową liczbą.
- *Zadanie godzinowe '{zadanie}' nie ma prawidłowych godzin pracy w swoim kalendarzu* — zadanie godzinowe w kalendarzu bez godzin pracy.
- *Nieprawidłowa data rozpoczęcia dla zadania '{zadanie}'* — data rozpoczęcia zadania nie jest prawidłowa.

## Paski pod wstążką

Pasek leży bezpośrednio pod wstążką, nad obszarem roboczym z wykresem Gantt. Ma tekst i jeden przycisk. Pasek trybu nie ma krzyżyka. Inne paski zamykasz krzyżykiem. Pięć pasków:

- **Tryb połączeń** — *Tryb połączeń: przeciągnij od jednego paska do drugiego na wykresie Gantta, aby utworzyć relację. Esc kończy.* Zostaje widoczny, dopóki tryb połączeń jest włączony. Przycisk: *Zatrzymaj*. Zobacz [Tworzenie relacji](docs://howto-relaties-leggen).
- **Tryb podziału** — *Kliknij pasek w dniu, w którym zaczyna się przerwa, i przeciągnij w prawo, aby ustawić długość. Esc kończy.* Pasek zostaje widoczny, dopóki opcja *Podziel zadanie* jest włączona. Przycisk: *Zatrzymaj*.
- **Planowanie godzinowe w pliku** — *Ten plik zawiera planowanie godzinowe.* Pojawia się, gdy otwarty plik zawiera planowanie godzinowe, a opcja *Włącz planowanie godzinowe* jest wyłączona. Przycisk: *Włącz planowanie godzinowe*. Zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).
- **Zablokowana struktura** — *Niedostępne podczas filtrowania/grupowania/sortowania.* Pojawia się, gdy wcięcie albo zmniejszenie wcięcia zadania jest odrzucone, bo tabela zadań jest filtrowana, grupowana lub sortowana. Przycisk: *Wyczyść*, który usuwa filtr, grupowanie i sortowanie.
- **Daty zapisane** — po otwarciu pliku, w którym przeliczenie przesunęło daty: *Przeliczenie przesunęło N z M zadań względem dat zapisanych w pliku.* z przyciskiem *Pokaż zapisane daty*. Gdy ten widok jest włączony: *Widzisz daty zapisane w pliku …* z przyciskiem *Przelicz*. Zobacz [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen).

## Powiadomienia

Powiadomienia pojawiają się na dole ekranu, również w tabeli, w Backstage i w trybie prezentacji. Powiadomienie to *błąd* albo *informacja*. Błąd jest czerwony i zostaje, dopóki nie klikniesz krzyżyka. Informacja znika po 5 sekundach (powiadomienie z dużą ilością wyjaśnień zostaje dłużej). Te czasy zaczynają się od nowa, gdy tylko zmieni się stos. Każde powiadomienie ma krzyżyk w prawym górnym rogu (podpowiedź *Zamknij powiadomienie*). Krzyżyk zamyka powiadomienie od razu. Kliknięcie w tekst powiadomienia nic nie robi. Odmowa jest zawsze błędem. To powiadomienie, że aplikacja nie wykonała czegoś, co zrobiłeś, na przykład odrzuconej relacji, czasu trwania, startu lub kamienia milowego. Dzięki temu nie przegapisz go, gdy na chwilę odwrócisz wzrok. Odmowa znika po Ctrl+Z lub Ctrl+Y oraz wtedy, gdy przejdziesz do innego dokumentu, bo wtedy nie jest już prawdziwa. Inny błąd, na przykład *Nie udało się zapisać*, zostaje. Dotyczy to także sytuacji, gdy reszta tej samej akcji się powiodła, na przykład przy wklejaniu do kilku komórek. Jeśli w akcji bierze udział kilka zadań, linia poniżej mówi, których zadań nie zmieniono, na przykład *Nie zmieniono: Foundation, Masonry.* Przy więcej niż pięciu zadaniach linia kończy się na *i jeszcze N zadań*. Ta sama odmowa składa się w jedną linię z licznikiem, gdy się powtarza. Naraz widać najwyżej trzy powiadomienia. Gdy przyjdzie czwarte, najpierw znika najstarsza informacja. Gdy nie ma informacji, znika najstarsza odmowa, potem najstarsze powiadomienie przy otwieraniu, które zostaje, i dopiero na końcu najstarszy błąd. Dzięki temu informacja lub odmowa nigdy nie wypchnie innego błędu, na przykład *Nie udało się zapisać*. Stos odsuwa się od przycisków otwartego okna dialogowego i od pasków działań, które zostają na miejscu. Powiadomienie przy otwieraniu pliku także zostaje, aż klikniesz krzyżyk, jeśli aplikacja podczas otwierania uzupełniła, zastąpiła, naprawiła lub pominęła dane. Dotyczy to linii o ustaleniach parsera lub kalendarza, problemach z formatem liczb, rozwiązaniach awaryjnych enum, ustawieniach planowania P6 z bezpiecznym rozwiązaniem zastępczym, ochronnym rozwiązaniu awaryjnym planu bazowego, zignorowanych odwołaniach do planu bazowego, zadaniach bez planowanego startu, którym nadano start, relacjach między projektami lub zadaniach bez projektu, które nie zostały zaimportowane (P6 XML), czymś z pliku MS Project, co nie zostało zaimportowane (MS Project XML i `.mpp`), lub z nieużywalnym archiwum źródłowym XER, oraz o zduplikowanych identyfikatorach i relacjach, które nie są uwzględniane w obliczeniach. Jeśli powiadomienie zawiera tylko informację bez takiej zmiany (na przykład liczbę projektów, dokumentów lub kodowanie tekstu), znika po 5 sekundach.

- **Licznik ×N** — powiadomienie ze stałym kluczem składa powtórki w jedną linię z licznikiem, na przykład błąd zapisu, który wraca, albo odrzuconą relację, którą powtarzasz. Nie każde powiadomienie tak robi.
- **Dowiedz się więcej** — niektóre powiadomienia mają link *Dowiedz się więcej* albo własny temat (na przykład *Wyjaśnienie typów zadań*), który prowadzi do przewodnika w Backstage › Pomoc.
- **Przycisk akcji** — powiadomienie o profilu obliczeń ma przycisk *Otwórz profil obliczeń*, który prowadzi do Info o projekcie.

Poniższa lista to wybór, pogrupowany tematycznie. Tam, gdzie nie jest napisane inaczej, to informacja.

### Zapisywanie, otwieranie i odzyskiwanie

- **Zapisywanie nie powiodło się** (błąd) — *Nie udało się zapisać* z przyczyną pod spodem. Przy zapisywaniu, zapisywaniu jako i eksporcie raportu.
- **Zapisano jako pobranie** (informacja) — *Zapisano jako pobranie: „{name}” jest teraz w folderze pobranych plików. …* Przy *Zapisz jako* i przy eksportach, gdy środowisko nie pozwala aplikacji zapisać bezpośrednio w wybranym miejscu. Dwa pobrania jedno po drugim składają się w jedną linię.
- **Zapisano jako pobranie (wyjaśnienie)** (informacja, 15 sekund) — *Zapisano jako pobranie: „{name}” jest w folderze pobranych plików. Ta przeglądarka nie pozwala aplikacji zapisywać w osobnym miejscu, …* Przy *Zapisz* w przeglądarce, która zapisuje tylko przez pobieranie. Raz na sesję, z linkiem do wyjaśnienia o plikach.
- **Przeglądarka nie zapisuje zwrotnie** (informacja, 15 sekund) — *Ta przeglądarka nie pozwala aplikacji zapisać zmian z powrotem w „{name}”. …* Przy *Zapisz* projektu, który ma plik, gdy przeglądarka musi ponownie zapytać o miejsce. Raz na sesję, z linkiem do wyjaśnienia o plikach.
- **Autozapis nie powiódł się** (błąd) — *Błąd autozapisu* z przyczyną. Dotyczy autozapisu do pliku i odzyskiwania po awarii.
- **Biblioteka nie mogła zostać zapisana** (błąd) — *Nie można było zapisać biblioteki*, przy zapisywaniu biblioteki zasobów.
- **Otwieranie pliku nie powiodło się** (błąd) — *Nie udało się otworzyć pliku* z przyczyną. Na przykład przy ostatnim pliku albo zaimportowanym pliku.
- **Stary lub chroniony .mpp** (błąd) — *Ten plik .mpp ma starszy format (Project 2007 lub wcześniejszy)…* albo *Ten plik .mpp jest chroniony hasłem…*. Oba z radą: wyeksportuj plik jako XML w MS Project i otwórz ten plik.
- **Nieprawidłowy plik XER** (błąd) — jeden z komunikatów o pliku XER, na przykład *Ten plik XER jest nieprawidłowy lub nieobsługiwany.* albo *Plik XER zawiera zduplikowaną tabelę.*, z dopisaną przyczyną.
- **Nie udało się odczytać IFC** (błąd) — *Nie udało się odczytać pliku IFC* z przyczyną, w widoku IFC.
- **Odzyskiwanie** (błąd) — *Nie udało się odczytać odzyskanego pliku*, *Nie udało się przywrócić* oraz *N plików odzyskiwania nie mogło zostać wczytanych i zostało pominiętych*. Przy odzyskiwaniu po nieoczekiwanym zamknięciu.
- **Gałąź zapisana jako szablon** (informacja) — *Gałąź zapisana jako szablon '{name}'*.
- **Komunikat z rozszerzenia** (informacja lub błąd, gdy rozszerzenie zgłasza błąd) — *Rozszerzenie {name}: {message}*. Rozszerzenie może pokazać najwyżej trzy nowe komunikaty w ciągu 10 sekund, żeby nie zapchać stosu. Jeśli krok przewodnika rozszerzenia zakończy się błędem, pojawi się *Krok rozszerzenia {name} zakończył się błędem. Przewodnik działa dalej*. Jeśli nie można otworzyć pliku projektu rozszerzenia, pojawi się *Nie udało się otworzyć pliku projektu {file} z rozszerzenia {name}*. Oba są błędami.
- **Zmiana nadeszła w międzyczasie** (błąd) — *Zmiana wprowadzona przez asystenta AI lub rozszerzenie nastąpiła w międzyczasie. …* Gdy anulujesz okno zadania, a asystent AI lub rozszerzenie w tym czasie coś zmieniło: zmiany zadań sprzed tej zmiany nie są cofane i zostają jako zwykłe kroki pod *Cofnij*.

### Obliczanie

- **Nie udało się obliczyć harmonogramu** (błąd) — *Nie udało się obliczyć harmonogramu* z przyczyną pod spodem (zob. *Przyczyny błędu harmonogramu*). Przy *Oblicz*, przy przełączaniu dokumentów i przy otwieraniu pliku.
- **Data statusu ustawiona na dziś** (informacja) — *Datę statusu ustawiono na dziś ({date}).* Przy wpisywaniu postępu w projekcie bez daty statusu. Aplikacja mierzy postęp do daty statusu, więc bez niej nie może przetworzyć postępu. Inną datę ustawisz w *Planowanie › Plan bazowy i postęp › Data statusu*. Z linkiem *Dowiedz się więcej* do [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).
- **Czas trwania krótszy niż wykonana praca** (błąd) — *„{name}” jest już wykonane w {N}%: czas trwania krótszy niż wykonana praca jest niemożliwy. Czas trwania nie został zmieniony.*

### Relacje i hierarchia

- **Relacja odrzucona** (błąd) — *Taka relacja już istnieje*, *Relacja między zadaniem a jego własnym nadrzędnym zadaniem sumarycznym jest niedozwolona* lub *Ta relacja utworzyłaby cykl w harmonogramie ({cycle}) i nie została utworzona*. Cykl nazywa zadania, więc wiesz, którą relację usunąć lub odwrócić najpierw.
- **Przesunięcie odrzucone** (błąd) — *To przeniesienie utworzyłoby cykl w harmonogramie ({cycle}): relacje zadania sumarycznego dotyczą również jego podzadań. Niczego nie przeniesiono*.
- **Relacje wypadają po przesunięciu** (informacja) — *Po przeniesieniu N relacji łączy zadanie z jego własnym nadrzędnym zadaniem sumarycznym; nie są one już uwzględniane w obliczeniach*.
- **Relacje pominięte przy wstawianiu** (błąd) — *N relacji nie zostało utworzonych: nieprawidłowe połączenie…*, przy wklejaniu lub wstawianiu gałęzi. Linia poniżej mówi, których relacji to dotyczy, na przykład *Nie utworzono: Foundation → Masonry.*
- **Relacje nieuwzględnione po imporcie** (informacja) — *Nie udało się uwzględnić N relacji. Sprawdź kolumny Poprzedniki i Następniki*.
- **Zduplikowane identyfikatory po imporcie** (informacja) — *Obiekty z powtórzonym identyfikatorem w tym pliku: N. Nadano im własne identyfikatory…*

### Edycja zadań

- **Start zapisany jako ograniczenie** (informacja) — *„{name}” rozpoczyna się nie wcześniej niż {date} (SNET).* Gdy zmienisz start zadania z poprzednikiem. Poprzednik określa start, więc aplikacja zapisuje Twoją datę jako ograniczenie *rozpocznij nie wcześniej niż* (SNET). Po przeliczeniu (F5) zadanie nie rozpocznie się przed tą datą. Jeśli zadanie już miało takie ograniczenie, pojawi się *„{name}” rozpoczyna się teraz nie wcześniej niż {date} (SNET)*. Dla kilku zadań naraz aplikacja pokazuje liczbę. Z linkiem *Dowiedz się więcej* do [Ograniczenia i terminy ostateczne](docs://uitleg-constraints).
- **Nowy start nie został zastosowany** (błąd) — *Nowy start „{name}” nie został zastosowany: zadanie ma poprzednika, a poprzednik i ograniczenie {type} {date} określają jego start*. Zmień to ograniczenie, żeby przesunąć start.
- **Kamień milowy odrzucony** (błąd) — *„{task}” ma przydziały zasobów i nie może stać się kamieniem milowym. Najpierw usuń przydziały.* albo *„{task}” jest zadaniem sumarycznym z podzadaniami i nie może stać się kamieniem milowym.* Przy zamianie w oknie zadania, w panelu właściwości, w menu kontekstowym i w tabeli.
- **Przydziały przeniesione do podzadania** (informacja) — *Przydział przeniesiono do podzadania „{child}”.* albo *N przydziałów przeniesiono do podzadania „{child}”.* Gdy rozszerzenie daje podzadania zadaniu z przydziałami. To zadanie staje się zadaniem sumarycznym, a zadanie sumaryczne nie ma własnych przydziałów. Dlatego przechodzą one do pierwszego nowego podzadania. W samej aplikacji wybierasz to w oknie *Zadanie staje się zadaniem sumarycznym*; ten komunikat wtedy się nie pojawia. Z linkiem *Dowiedz się więcej* do [Zmiana struktury](docs://howto-structuur-aanpassen).
- **Znacznik kamienia milowego usunięty** (informacja) — *„{phase}” nie jest już kamieniem milowym.* Gdy kamień milowy dostaje podzadania. Kamień milowy to moment bez podzadań. Z podzadaniami staje się zadaniem sumarycznym. Z linkiem *Dowiedz się więcej* do [Zmiana struktury](docs://howto-structuur-aanpassen).
- **Pytanie nieaktualne** (błąd) — *Zadania lub przydziały zmieniły się, gdy pytanie było otwarte. Nic nie zostało zmienione. Spróbuj ponownie.* Gdy wybierzesz opcję w oknie *Zadanie staje się zadaniem sumarycznym*, ale pytanie nie pasuje już do stanu projektu.
- **Zadanie sumaryczne odrzucone** (błąd) — *„{phase}” nie może stać się zadaniem sumarycznym: …* z przyczyną i *Nic nie zostało zmienione.* Gdy rozszerzenie daje podzadania zadaniu z przydziałami, a przydziałów nie da się przenieść do pierwszego nowego podzadania. W samej aplikacji ten komunikat się nie pojawia. Tam okno *Zadanie staje się zadaniem sumarycznym* pyta, co zrobić, a *Przesuń* jest wtedy wyłączone.
- **Komórki pominięte przy wklejaniu** (błąd) — *N komórek pominiętych: są tylko do odczytu (np. automatycznie numerowany kod WBS lub kolumna obliczana).*
- **Odwołania wyczyszczone przy wklejaniu** (informacja) — *N odwołań nie istniało w tym dokumencie i zostało wyczyszczone (kalendarzy zadań, własnych rodzajów robót, kodów czynności lub pól niestandardowych z dokumentu źródłowego).*
- **Struktura zablokowana** (błąd, czerwony pasek pod wstążką) — *Niedostępne podczas filtrowania/grupowania/sortowania*, z przyciskiem *Wyczyść*. Gdy lista jest przefiltrowana, pogrupowana lub posortowana: przy zwiększaniu wcięcia, zmniejszaniu wcięcia i przeciąganiu, oraz przy *Wstaw powyżej* i *Wstaw poniżej* (menu kontekstowe lub skrót). Pasek zostaje, aż klikniesz krzyżyk, użyjesz Ctrl+Z lub Ctrl+Y albo przejdziesz do innego dokumentu. Zobacz [Zmiana struktury](docs://howto-structuur-aanpassen).
- **Nowe zadanie dodane na końcu** (błąd) — *Nowe zadanie zostało dodane na końcu. Podczas filtrowania, grupowania lub sortowania aplikacja nie może umieścić go pod zaznaczeniem.* Z przyciskiem *Wyczyść*. Przy *Zadanie* i *Kamień milowy* ▾, gdy wybrane jest zadanie, a lista jest przefiltrowana, pogrupowana lub posortowana. Zadanie zostaje dodane, ale na dole. *Wyczyść* usuwa filtr, grupowanie i sortowanie oraz zamyka powiadomienie. Zobacz [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen).
- **Typ zadania dostosował czas trwania** (informacja) — *Po zmianie kalendarza typ zadania dostosował czas trwania w N zadaniach (praca pozostaje, zmieniła się liczba godzin dziennie).* Z linkiem *Wyjaśnienie typów zadań*.

### Primavera P6 XML

- **Otwarto plik P6 XML** (informacja) — *Otwarto plik P6 XML: N dokumentów projektu.* Po otwarciu pliku P6 XML.
- **Nie zaimportowano** (zostaje) — *N relacji między projektami nie zostało zaimportowanych jako relacje.* i *N zadań bez projektu nie zostało wczytanych.* Sprawdź, czy Twój harmonogram jest kompletny.
- **Pusty lub nieużywalny** (błąd) — nic się nie otwiera. Są trzy przyczyny: *W tym pliku nie ma zadań, które aplikacja może odczytać.*, *Zadania nie mają ObjectId. …* i *Plik używa nazw kolumn XER … Otwórz sam plik .xer*.

### Primavera (XER)

- **Otwarto plik XER** (informacja) — *Otwarto plik XER: N dokumentów projektu.* Jedno powiadomienie na plik, nawet gdy plik otwiera kilka projektów, z linkiem *Dowiedz się więcej* i wierszami szczegółów pod nim. Zawsze *Znaleziono N projektów.* Tylko gdy liczba jest wyższa niż 0: *Pominięto N pustych projektów.*, *Wykluczono N projektów bazowych.*, *Utworzono N planów bazowych.*, *Zignorowano N oderwanych odwołań do planów bazowych.*, *Użyto ochronnego rozwiązania awaryjnego dla planu bazowego.* i *Zachowano N relacji zewnętrznych.* Tylko przy kodowaniu innym niż UTF-8: *Wybrane kodowanie tekstu: {encoding}.* Dalej, gdy liczba jest wyższa niż 0: *N ustaleń parsera.*, *N ustaleń kalendarza.*, *N problemów formatu liczbowego.*, *N rozwiązań awaryjnych enum.* i *N ustawień planowania P6 użyło bezpiecznych wartości zastępczych*.
- **Daty zapisane przez Primaverę** (wiersz szczegółów w tym samym powiadomieniu) — *N zadań pokazuje daty tak, jak zapisał je Primavera (bez ponownego przeliczenia).* N liczy każde zadanie, dla którego plik zapisał daty, także te, które się nie różnią. Albo, jeśli tryb się nie włączył, *N zadań różni się od dat w pliku — możesz je pokazać*.
- **Archiwum źródłowe XER nieużywalne** (informacja) — *Archiwum źródłowe XER w tym pliku jest bezużyteczne i zostało pominięte; sam projekt otwarto w całości.* z przyczyną (na przykład *Powód: suma kontrolna nie pasuje do bajtów źródłowych — archiwum jest uszkodzone*.) i skutkiem (*Harmonogram, profil obliczeń i wszystkie dane projektu z IFC są kompletne. …*). Przy otwieraniu pliku IFC, w którym zapisane wcześniej archiwum źródłowe XER nie może zostać użyte. Także przy odzyskiwaniu po nieoczekiwanym zamknięciu, gdy magazyn odzyskiwania nie zawiera już archiwum źródłowego.
- **Eksport traci informacje XER** (informacja) — *Eksport do {format} powoduje utratę informacji źródłowych XER.* Po udanym eksporcie do formatu innego niż IFC projektu z danymi, które istnieją tylko w pliku XER. Z linkiem *Dowiedz się więcej*.

### Importowanie, eksportowanie i profil obliczeń

- **Daty tak jak w pliku** (informacja) — *N zadań pokazuje daty tak, jak zapisano je w pliku (bez ponownego przeliczenia).* (N liczy każde zadanie z zapisanymi datami) albo *N zadań różni się od dat w pliku — możesz je pokazać.* Przy otwieraniu pliku z zapisanymi datami.
- **Zapisane typy zadań i praca** (informacja) — *Ten plik zawiera zapisaną pracę lub typy zadań; typ zadania i pozostała praca są widoczne dla tego projektu.*
- **Harmonogram MS Project odczytany** (informacja) — *Ten plik MS Project zawiera N zadań z podzielonym, wyrównanym lub zależnym od zasobów harmonogramem. Są one importowane i wyświetlane w takiej postaci.*
- **Przerwy nie zostały wyeksportowane** (informacja) — *N zadań z przerwami zostało wyeksportowanych bez przerw: MS Project/P6 znają je tylko jako rozkład pracy.* Przy eksporcie do MS Project lub Primavery.
- **Początek projektu przesunięty** (informacja) — *N zadań przesunięto wraz ze startem projektu.* Gdy ustawisz późniejszy początek projektu. Do tej daty przesuwają się tylko zadania bez poprzednika i bez ograniczenia, które leżałoby przed nową datą. Z linkiem *Dowiedz się więcej* do [Nowy projekt i Info o projekcie](docs://ref-projectinfo).
- **Okno dat przestaje sterować** (informacja) — *Okno dat MS Project nie steruje już N zadaniami po tej zmianie; …* Raz na dokument.
- **Opóźnienie bilansowania zaokrąglone** (informacja) — *Bilansowanie zaokrągla dokładne co do minuty opóźnienie bilansowania z MS Project dla N zadań do pełnych dni roboczych.* Raz na dokument.
- **Profil obliczeń zastosowany** (informacja) — *Ten projekt liczy się jako {profile}. Zmień to w Plik → Info o projekcie → Profil obliczeń i opcje.* Z przyciskiem *Otwórz profil obliczeń*. Po zastosowaniu profilu pojawia się, jeśli trzeba, także *Po zastosowaniu przesunięto N zadań*.
