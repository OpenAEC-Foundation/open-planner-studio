# Panel zasobów

Panel zasobów to miejsce, w którym zarządzasz zasobami: kto i co jest dostępne, z jaką zdolnością i w jakim kalendarzu. Do niego należą histogram pod widokiem Gantt oraz przeciążenie. Ten artykuł opisuje dla każdego pola i przycisku, co robi, jaka jest wartość domyślna i co zauważysz. Jak tworzyć zasoby i je przypisywać, opisano w [Zarządzanie zasobami](docs://howto-resources-beheren) i [Przypisywanie zasobów z krzywą](docs://howto-resource-toewijzen); rozwiązywanie przeciążenia opisano w [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen).

## Gdzie to znaleźć

- **Pełny panel** — *Zasoby › Zarządzaj › Zasoby* lub *Widok › Panele › Zasoby*. Panel zajmuje cały obszar roboczy; krzyżyk w prawym górnym rogu go zamyka.
- **Dok zasobów** — *Zasoby › Zarządzaj › Dok zasobów* lub *Widok › Panele › Dok zasobów*: kompaktowa lista w prawej kolumnie, obok widoku Gantt. Zobacz niżej.
- **Histogram** — *Zasoby › Histogram › Histogram* lub *Widok › Panele › Histogram*: pas pod widokiem Gantt. Zobacz niżej.
- **Widoki** — jeśli Twój projekt należy do biblioteki zasobów, w prawym górnym rogu panelu możesz wybrać *Biblioteka*, *Projekt* lub *Obłożenie*. Bez biblioteki jest tylko tabela projektu. Za każdym razem, gdy go otwierasz, panel zaczyna od *Projekt*, więc nie trafisz do wspólnej biblioteki bez zauważenia.

## Nowy zasób

- **Nowy zasób w projekcie** (w widoku *Biblioteka* jako *Nowy zasób w bibliotece*) — przycisk w prawym górnym rogu. Otwiera wiersz roboczy na dole tabeli. Nic nie powstaje, dopóki nie wpiszesz nazwy i nie opuścisz wiersza (albo nie naciśniesz Enter). Jeśli klikniesz poza wiersz z pustą nazwą albo naciśniesz Esc, nic nie zostaje: ani zasób, ani krok pod *Cofnij*. Pola możesz wypełniać w dowolnej kolejności; wszystko trafia do aplikacji naraz. Enter lub strzałka w dół zatwierdza wiersz i otwiera nowy wiersz roboczy; Shift+Enter lub strzałka w górę zatwierdza wiersz i wraca do tabeli. Wiersz roboczy nie ma rozwijania zdolności, ołówka kalendarza ani kosza, ponieważ działają na zasobie, który jeszcze nie istnieje. Przycisk *Nowy zasób* w *Zasoby › Zarządzaj* działa tak samo.
- **Nawigacja w tabeli** — w tabeli klawisze Enter i Shift+Enter oraz strzałki w górę i w dół przesuwają kursor między wierszami. Enter w ostatnim wierszu otwiera nowy wiersz roboczy.

## Widok projektu

Tabela tego, czego projekt używa. Każdy wiersz to zasób. Zmiany w polach tekstowych i stawce działają, gdy opuścisz pole, i liczą się jako jeden krok pod *Cofnij*.

- **Kolor** — wybieranie koloru. Wartość domyślna: pierwszy wolny kolor z palety. Skutek: kolor akcentu zasobu pod paskami zadań na wykresie Gantt (*Widok › Plan bazowy i postęp › Akcent zasobu*) i kolor próbki w doku.
- **Nazwa** — nazwa zasobu. Pusta nazwa nie jest zapisywana; pole wraca do poprzedniej nazwy.
- **Typ** — *Robocizna*, *Sprzęt*, *Materiał*, *Podwykonawca* lub *Brygada*. Wartość domyślna dla nowego zasobu: *Robocizna*. Skutek: *Materiał* ma pole *Jednostka* i nie wlicza się do pozycji *Wszystkie zasoby* w histogramie; bilansowanie pomija materiał. Zasób typu *Brygada* można wybrać w polu *Brygada* innych zasobów. Pozostałe typy liczą tak samo.
- **Maks. jednostki** — ile zasobu jest dostępne na dzień, liczba większa od 0 (ułamki są dozwolone). Wartość domyślna: 1. Skutek: zdolność na dzień. Gdy obciążenie jest wyższe, zasób jest przeciążony. Strzałka obok rozwija *Zdolność rozłożona w czasie*; liczba przy strzałce to liczba kroków.
- **Zdolność rozłożona w czasie** — kroki z polem *Od* (data) i *Maks. jednostki*. *Dodaj krok* dodaje krok z dzisiejszą datą i wartością 1. Bez kroków pojawia się napis *Brak kroków — zawsze obowiązuje stałe maks. jednostek*. Skutek: od daty kroku obowiązuje jego *Maks. jednostki* zamiast wartości stałej; wygrywa ostatni krok z datą w tym dniu lub wcześniejszą.
- **Kalendarz** — lista z *Kalendarz projektu* (domyślny), kalendarzami projektu i *+ Kalendarz zasobu* do dodania nowego. Ołówek (*Edytuj…*) otwiera wybrany kalendarz i jest wyłączony dla pozycji *Kalendarz projektu*. Skutek: dni, w których zasób pracuje. W dniu wolnym zdolność wynosi 0; jeśli wtedy jest planowana praca, zasób jest przeciążony z powodem *Nie pracuje w tym dniu według kalendarza „…”*. Kalendarz zasobu nie zmienia dat zadania. Zobacz [Okna kalendarza](docs://ref-kalenders).
- **Stawka/godz** — koszt za godzinę. Puste = brak stawki; nieprawidłowa liczba zostaje odrzucona. Skutek: brak wpływu na harmonogram i obciążenie. Stawka określa kolumnę *Razem*, jest zapisywana w pliku IFC i przy eksporcie do MS Project (stawka standardowa) oraz do XML Primavera P6 (cena za jednostkę) jest przenoszona dalej.
- **Razem** — tylko do odczytu: godziny obciążenia × stawka, z dwoma miejscami po przecinku; *—* bez stawki albo obciążenia. Na dole linia *Razem* sumuje wszystkie zasoby. Godziny pochodzą z ostatniego obliczenia i liczą jednostki × godziny dziennie wg kalendarza zadania. Nieaktualne? Naciśnij *Oblicz*.
- **Jednostka** — jednostka miary materiału, na przykład `m³`. Wypełnić ją można tylko przy typie *Materiał* (podpowiedź: *Do wypełnienia tylko dla zasobów typu Materiał*). Skutek: etykieta; nic nie oblicza.
- **Brygada** — brygada, do której zasób należy, wybierana spośród zasobów typu *Brygada*. Wartość domyślna: *Brak*. Skutek: tylko grupowanie; zdolność i obciążenie brygady nie są sumą jej członków.
- **Usuń** (ikona kosza) — usuwa zasób. Gdy ma przydziały, aplikacja najpierw pyta *„…” ma przypisań: … — usunąć?* z ptaszkiem do potwierdzenia i krzyżykiem do anulowania.
- **Do biblioteki** — tylko wtedy, gdy projekt należy do biblioteki zasobów, dla zasobu z nazwą, która jeszcze nie pochodzi z biblioteki. Zapisuje go w bibliotece zasobów albo łączy z istniejącym elementem o tej samej nazwie i podaje wynik (*Dodano*, *Już istniał w bibliotece — teraz połączony* albo *Połączono z istniejącym elementem biblioteki — wartości się różnią, zobacz oznaczenie*).
- **Odłącz od biblioteki** — ikona odłączenia przy zasobie z biblioteki. Usuwa pochodzenie; potem wszystkie pola są znowu wolne.

Bez zasobów pojawia się napis *Brak zasobów. Dodaj jeden, aby zacząć*. Jeśli projekt należy do biblioteki, pojawia się napis *Ten projekt nie korzysta jeszcze z żadnych zasobów z biblioteki* z podpowiedzią.

### Zasoby z biblioteki

Zasób z biblioteki ma małą ikonę biblioteki (*Z biblioteki*). Jego *Nazwa*, *Typ*, *Stawka/godz* i *Jednostka* są wtedy zwykłym tekstem (*Wartość z biblioteki — edytuj ją w widoku Biblioteka albo odłącz ten zasób od biblioteki*.), bo biblioteka zasobów decyduje, czym zasób jest. *Kolor*, *Maks. jednostki*, kroki zdolności, *Kalendarz* i *Brygada* pozostają edytowalne, bo projekt decyduje, ile i kiedy. Mogą pojawić się dwie odznaki: *różni się — zdecyduj* (kliknięcie otwiera okno *Połącz bibliotekę zasobów*) oraz *nie ma już w bibliotece* z przyciskiem *Usuń z projektu*.

## Widok Biblioteka

Tylko wtedy, gdy projekt należy do biblioteki zasobów. Zobacz [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken) i [Zarządzanie bibliotekami zasobów i ich udostępnianie](docs://howto-bibliotheken-beheren). Na górze jest kolorowy komunikat: *To edytuje bibliotekę i dotyczy wszystkich projektów — poza cofaniem*. Tabela ma te same pola co widok *Projekt*, z tymi różnicami:

- Nie ma kolumny *Razem*: to obliczenie dla jednego projektu.
- Kolumna *Brygada* pojawia się, gdy biblioteka ma zasoby.
- Kolumna *Kalendarz* oferuje kalendarze biblioteki, z domyślnym *Brak kalendarza*.
- **Przypisz do projektu** — dodaje zasób do projektu z kopią jego kalendarza. Podaje *Dodano* albo *Już jest w projekcie*.
- **Usuń** — pyta *Usunąć „…” z biblioteki? Dotyczy to wszystkich projektów i nie można tego cofnąć*.
- Bez zasobów pojawia się napis *W puli nie ma jeszcze żadnych zasobów*.

## Widok Obłożenie

Widok tylko do odczytu dla wszystkich otwartych dokumentów: które zasoby z biblioteki zasobów są gdzie zarezerwowane. Nie ma przycisku dla nowego zasobu. Zobacz [Korzystanie z przeglądu obłożenia](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabela** — dla każdego zasobu z biblioteki: *Nazwa*, *Dokumenty* (w ilu dokumentach jest), *Okres* i *Szczyt / Zdolność* (najwyższe łączne obciążenie wobec zdolności tego dnia). Czerwony napis *N dni podwójnie zarezerwowane* oznacza, że w kilku dokumentach zasób ma więcej, niż wynosi jego zdolność. Strzałka obok nazwy rozwija dokumenty, każdy z okresem i szczytem; kliknięcie wiersza pokazuje histogram tego zasobu (*Wybierz zasób, aby zobaczyć histogram*).
- **Co się liczy** — tylko dokumenty otwarte w tej aplikacji (*Ten przegląd widzi tylko dokumenty otwarte w tej aplikacji*). Dokument, który nie został obliczony, dostaje komunikat przy swoim wierszu. Aktywny dokument liczy się z ostatnio obliczonymi wartościami (*Nieaktualne: to ostatnio obliczone wartości — naciśnij F5 w tym dokumencie*). Inny dokument przegląd oblicza z wyprzedzeniem (*Obliczone z wyprzedzeniem na potrzeby tego przeglądu — sam dokument nadal pokazuje starsze daty, dopóki nie naciśniesz tam F5 lub nie włączysz „Oblicz automatycznie”*); jeśli *Oblicz automatycznie* jest włączone, przegląd naprawdę oblicza te dokumenty. Jeśli obliczanie się nie powiedzie, dokument się nie liczy (*Nie liczy się: harmonogram nieprzeliczony — aktywuj ten dokument i naciśnij F5*). Bez zarezerwowanych zasobów pojawia się napis *Brak zasobów z biblioteki zarezerwowanych w otwartych dokumentach*.
- **Kolejność** — zasoby z podwójnymi rezerwacjami są na górze, najpierw te z największą liczbą dni konfliktu, potem alfabetycznie.

## Dok zasobów

Kompaktowa lista w prawej kolumnie, obok panelu *Właściwości*. Dla każdego zasobu: próbka koloru, nazwa (tylko do odczytu), czerwony trójkąt *Przeciążony*, jak tylko zasób ma co najmniej jeden przeciążony dzień, oraz *Maks. jednostki* do edycji. Jeśli są zaznaczone zadania, lista pokazuje tylko zasoby tych zadań. W nagłówku są *Pełny panel* (otwiera pełny panel) i *Zamknij dokowanie*. Bez zasobów pojawia się napis *Brak zasobów. Dodaj jeden, aby zacząć*.

## Histogram

Pas pod widokiem Gantt, który pokazuje obciążenie zasobu na dzień. Włącz lub wyłącz go w *Zasoby › Histogram › Histogram* albo w *Widok › Panele › Histogram*. Wartość domyślna: wyłączony; Twój wybór jest zapamiętywany. Wysokość wynosi domyślnie 160 pikseli i można ją przeciągnąć na krawędzi między widokiem Gantt a histogramem.

- **Lista wyboru** — po lewej stronie, pod tabelą zadań, jest lista: *Wszystkie zasoby* przypięte na górze, pod nią jeden wiersz na zasób. Kliknięcie wybiera wiersz, strzałki przechodzą po liście, a *Zasoby › Histogram › Poprzedni* i *Następny* robią to samo. Czerwona kropka przy wierszu oznacza, że zasób ma co najmniej jeden przeciążony dzień; dla *Wszystkie zasoby* kropka patrzy tylko na zasoby, które nie są typu *Materiał*. Jeśli zadania są zaznaczone, lista zawiera tylko zasoby tych zadań; jeśli wybrany zasób jest poza nią, pas tymczasowo pokazuje *Wszystkie zasoby* z zaznaczenia.
- **Słupki** — jeden słupek na dzień: obciążenie w jednostkach. Linia pokazuje zdolność; część słupka powyżej zdolności jest czerwona. W lewym górnym rogu jest najwyższa wartość z podpisem *jednostki*. *Wszystkie zasoby* sumuje obciążenie i zdolność wszystkich zasobów, z wyjątkiem zasobów typu *Materiał*.
- **Podpowiedź** — zatrzymaj kursor myszy na chwilę nad dniem: *N zadań ma udział w dniu {date}* z nazwami najwyżej ośmiu zadań. Dla wybranego zasobu i dnia, w którym jego kalendarz nie pracuje, pojawia się też *Nie pracuje w tym dniu według kalendarza „…”*.
- **Komunikaty na pasie** — *Przelicz (F5), aby pokazać obciążenie*, dopóki nie ma obciążenia; *Brak zasobów*, gdy nie ma zasobów; a *⚠ Harmonogram nieaktualny — przelicz (F5)* w prawym górnym rogu, gdy harmonogram jest nieaktualny.
- **Co się liczy** — jednostki na dzień z każdego przydziału, rozłożone w dniach roboczych zadania według ustawienia *Krzywa* (albo *Rozkład godzin*); tylko zadania bez podzadań i bez kamieni milowych. Obciążenie odświeża się po *Oblicz* oraz po zmianach zasobów i przydziałów; jeśli zmienisz daty zadań, liczy się to dopiero po *Oblicz*.

## Przeciążenie

Zasób jest przeciążony w danym dniu, gdy jego obciążenie jest wyższe niż zdolność. Zdolność to *Maks. jednostki* (z krokami zdolności) w dniu roboczym jego kalendarza, a 0 w dniu wolnym. Materiał liczy się tu także. Powodem jest albo za mała zdolność, albo dzień, w którym zasób nie pracuje według swojego kalendarza.

Gdzie to widzisz:

- **Zasoby › Przeciążenie** — liczba przeciążonych zasobów, albo *Brak*.
- **Pasek stanu** — *Przeciążone zasoby: N*; kliknięcie otwiera panel *Ostrzeżenia*.
- **Ostrzeżenia** — jedna linia na zasób: *Przeciążenie przez N dni (pierwszy – ostatni)*, z dopiskiem *zasób nie pracuje w tych dniach według swojego kalendarza*, gdy wszystkie dni są wolne, albo *z czego N dni zasób nie pracuje według kalendarza* w przypadku mieszanym. Zobacz [Powiadomienia i ostrzeżenia](docs://ref-meldingen).
- **Histogram** — czerwone części słupków i czerwona kropka na liście wyboru.
- **Dok zasobów** — czerwony trójkąt *Przeciążony*.

Bilansowanie może rozwiązać przeciążenie, doprowadzając do późniejszego startu zadań. Domyślnie koniec projektu może się przesunąć; przy *wygładzaniu* zostaje w zapasie. Bilansowanie nie rozwiązuje zasobu, który musi pracować w dzień wolny. Zobacz [Bilansowanie](docs://uitleg-nivelleren).
