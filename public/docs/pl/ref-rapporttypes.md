# Typy raportów

Każdy raport na karcie *Raport*, z opcjami, które do niego należą: co robią, wartość początkową, co się zmienia w raporcie i gdzie je znajdziesz. Jak zrobić raport i zapisać go jako PDF, opisuje [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken).

## Jak działa okno raportu

Otwórz kartę *Raport* (lub naciśnij Ctrl+P). Po lewej stronie jest kolumna *Raport* z rozwijaną listą *Typ raportu*, blokiem *Podsumowanie* z liczbami, blokiem *Ustawienia* albo *Opcje raportu* i na dole przyciskiem *Eksportuj PDF*. Po prawej stronie jest podgląd. Wszystko, co widzisz w podglądzie, trafia do PDF.

**Typ raportu** — który raport zobaczysz. Wybierz jeden z jedenastu raportów. Domyślnie: *Wykres Gantta*. Gdzie: *Raport*, na górze kolumny *Raport*.

**Eksportuj PDF** — tworzy plik PDF. Skutek: wynik to tylko plik PDF; aplikacja nic nie wysyła do drukarki. Jeśli harmonogram jest nieaktualny, aplikacja najpierw go oblicza. Jeśli obliczenie zwróci błąd, na przykład przez pętlę w relacjach, przycisk nie utworzy pliku i pokaże błąd. Gdzie: *Raport*, na dole kolumny *Raport*.

**Zapamiętane.** Aplikacja zapamiętuje wszystkie opcje raportu na tym urządzeniu, dla wszystkich projektów. Nie należą do pliku projektu. Tylko pole *Firma*: wykresu typu Gantt nie jest zapamiętywane.

**Aktualny harmonogram.** Raporty używają ostatniego obliczenia. Jeśli harmonogram zmienił się od tej pory, raporty tabelaryczne pokazują u góry *Harmonogram zmienił się od ostatniego obliczenia — naciśnij Oblicz (F5), aby zobaczyć aktualne wartości.* Jeśli nic nie zostało jeszcze obliczone, pojawia się *Jeszcze nie obliczono — naciśnij Oblicz (F5), aby uzyskać daty i zapasy.* Jeśli projekt jest w widoku *Daty zapisane*, raporty pokazują daty z pliku źródłowego, a komunikat na górze to zaznacza.

**Skróty.** *dr* to dni robocze. *TF* to zapas całkowity, *FF* to zapas swobodny.

## Papier i orientacja

**Papier:** — rozmiar papieru PDF. Wybierz jeden z rozmiarów: A4, A3, A2 i A1. Domyślnie: A3. Skutek: strony są ułożone dla tego rozmiaru. Jest jeden wybór dla wszystkich raportów: wybór dla jednego raportu obowiązuje też dla pozostałych. Na pionowym A4 szeroka tabela staje się mała, bo tabela jest skalowana do szerokości strony. Gdzie: *Ustawienia* (wykres typu Gantt i diagram zasobów) albo *Opcje raportu* (siedem raportów tabelarycznych). Przegląd kamieni milowych i Odchylenie nie pokazują wyborów.

**Orientacja:** — pozioma lub pionowa. Wybierz jedną z opcji: *Poziomo* lub *Pionowo*. Domyślnie: *Poziomo*. Skutek: tak samo jak przy ustawieniu *Papier:*. Gdzie: w tym samym miejscu co *Papier:*.

## Wykres Gantta

Harmonogram jako wykres słupkowy, z tabelą po lewej i osią czasu po prawej, na kilku stronach, jeśli trzeba. Podgląd pokazuje papier z nagłówkiem strony, tabelą, osią czasu i legendą. Blok *Podsumowanie* liczy *Zadania*:, *Zadania końcowe*:, *Krytyczne*: i *Relacje*:. Wszystkie opcje są w sekcji *Ustawienia*.

**Firma:** — firma w nagłówku strony. Domyślnie: firma z ustawień projektu. Skutek: tylko nagłówek raportu; to, co tutaj wpiszesz, nie jest zapamiętywane. Zmień firmę w *Ustawienia › Projekt › Ustawienia projektu*, w polu *Zleceniodawca/organizacja*, i potwierdź przyciskiem *Zastosuj*.

**Autor:** — autor w nagłówku strony. Tylko do odczytu: aplikacja pobiera go z ustawień projektu.

**Rozmiar czcionki:** — rozmiar tekstu i tabeli w raporcie. Wybierz jedną z wartości: 90%, 100%, 110% lub 125%. Domyślnie: 100%. Skutek: przy większej czcionce tekst, wiersze i tabela rosną, a oś czasu traci szerokość. Niezależne od ustawienia *Rozmiar tekstu* w ustawieniach.

**Kolory słupków:** — od czego zależy kolor paska. Wybierz jedną z opcji: *Ścieżka krytyczna*, *Na zadanie — automatycznie* lub *Według kategorii*, z rozwijaną listą *Pole kategorii* dla *Według kategorii*. Domyślnie: *Ścieżka krytyczna*. Skutek: to ten sam wybór co *Kolory słupków* na karcie *Widok*: zmiana tutaj zmienia też wykres typu Gantt na ekranie. Jeśli wybrane pole nie istnieje w tym projekcie, pojawia się komunikat *To pole nie istnieje w tym projekcie. Tymczasowo używany jest rodzaj robót.*

**Linia statusu:** — linia przy dacie statusu. Wybierz jedną z opcji: *Brak*, *Linia daty statusu* lub *Linia postępu*. Domyślnie: *Brak*. Skutek: *Linia daty statusu* rysuje linię przy dacie statusu; *Linia postępu* rysuje zygzakowatą linię, która wybrzusza się do postępu każdego zadania. Jeśli projekt nie ma daty statusu, pojawia się *Najpierw ustaw datę statusu* i raport nic nie rysuje.

**Podążaj za widokiem (filtr, grupowanie, sortowanie)** — tylko dla wykresu Gantta. Domyślnie: wyłączone. Skutek: wyłączone umieszcza na papierze całe drzewo zadań. Włączone rysuje dokładnie wiersze z ekranu: z Twoim filtrem, grupowaniem, sortowaniem i zwiniętymi fazami.

**Dopasuj do papieru** — skaluje oś czasu do szerokości strony. Domyślnie: włączone. Skutek: włączone skaluje oś czasu do szerokości strony; liczba stron wynika z wysokości. Wyłączone używa stałej skali (*Powiększenie:*) i dzieli oś czasu także na szerokość, co szybko daje wiele stron.

**Powiększenie:** — stała skala osi czasu. Widoczne tylko, gdy *Dopasuj do papieru* jest wyłączone. Suwak od 1 do 40. Domyślnie: 22. Skutek: większa wartość rozszerza oś czasu, więc więcej stron w szerokości.

**Oś czasu na:** — rozkłada oś czasu na więcej szerokości stron. Wybierz od 1 do 8 stron. Domyślnie: 1 strona. Skutek: działa tylko z *Dopasuj do papieru*; w przeciwnym razie wybór jest wyłączony i pojawia się *Tylko przy automatycznym dopasowaniu*. Praktyczne przy długim harmonogramie, który chcesz wydrukować w czytelnym rozmiarze.

**Powtarzaj nagłówek na każdej stronie** — Domyślnie: włączone. Skutek: włączone umieszcza nagłówek strony na każdej stronie; wyłączone tylko na pierwszej.

**Powtarzaj stopkę na każdej stronie** — Domyślnie: włączone. Skutek: włączone umieszcza stopkę (nazwę projektu, datę druku i legendę) na każdej stronie; wyłączone tylko na ostatniej. Wydruk bez legendy jest nieczytelny, dlatego domyślnie włączone.

**Nazwy zadań na paskach** — Domyślnie: włączone. Skutek: nazwa zadania na pasku, tam gdzie jest miejsce.

**Pokaż ukończenie** — Domyślnie: włączone. Skutek: ukończona część paska jest szara, jak na wykresie Gantta, a w tabeli pojawia się kolumna *Post*. Ukończone zadanie nie ma pasa zapasu.

**Skracaj nazwy zadań** — Domyślnie: włączone. Skutek: włączone skraca nazwy w tabeli do szerokości *Kolumna nazwy*:. Wyłączone: kolumna rośnie z najdłuższą nazwą; pojawia się *Kolumna nazwy dopasowuje się do najdłuższej nazwy zadania*.

**Kolumna nazwy:** — szerokość kolumny nazwy. Widoczne tylko, gdy *Skracaj nazwy zadań* jest włączone. Suwak od 60 do 400. Domyślnie: 130.

**Pokaż nakładkę planu bazowego** — aktywny plan bazowy przy paskach. Domyślnie: wyłączone. Skutek: cienki pasek w kolorze planu bazowego pod paskiem zadania, tylko dla zadań, które są w planie bazowym.

**Ścieżka krytyczna** — Domyślnie: włączone. Skutek: steruje tylko czerwonymi liniami relacji między dwoma zadaniami krytycznymi i wierszem legendy. Same paski zależą od ustawienia *Kolory słupków:*, niezależnie od tego pola wyboru.

**Pokaż zapas** — Domyślnie: włączone. Skutek: zapas jako pas za paskami zadań niekrytycznych.

**Zależności** — linie relacji. Domyślnie: włączone. Skutek: rysuje strzałki między paskami.

**Pokazuj tylko dni robocze** — skraca oś czasu w tym raporcie. Domyślnie: wyłączone. Skutek: weekendy i święta są pomijane, a pasy tygodni zastępują zacienienie weekendów. Niezależne od tego samego ustawienia dla wykresu Gantta na ekranie.

**Weekendy** — Domyślnie: włączone. Skutek: zacienia weekendy i święta na osi czasu, dopóki skala pozwala odróżnić dni. Na skróconej osi (*Pokazuj tylko dni robocze*) to pole wyboru nie ma skutku.

**Legenda** — Domyślnie: włączone. Skutek: legenda w stopce.

**Jakość podglądu** — jak ostry jest podgląd. Wybierz jedną z opcji: *Standardowa*, *Wysoka* lub *Maksymalna*. Domyślnie: *Wysoka*. Skutek: tylko ostrość podglądu na ekranie; PDF się nie zmienia. Gdzie: *Raport*, nad podglądem.

## Diagram zasobów

Te same paski co na wykresie typu Gantt, pogrupowane według zasobów: kto wykonuje co i kiedy. Blok *Podsumowanie* liczy *Zasoby*:, *Przydziały*: i *Bez zasobu*: (przy okresie także *Poza okresem*:). Diagram ma wszystkie opcje wykresu typu Gantt, oprócz *Podążaj za widokiem (filtr, grupowanie, sortowanie)*, *Ścieżka krytyczna* i *Zależności*: wiersze nie pochodzą z ekranu, zadanie może być pod kilkoma zasobami, a relacje nie są tam rysowane. Pole wyboru *Ścieżka krytyczna* jest ukryte i włączone. Dochodzą opcje wykresu typu Gantt w sekcji *Ustawienia* oraz te cztery pola wyboru i okres:

**Każdy zasób na nowej stronie** — Domyślnie: wyłączone. Skutek: każdy zasób zaczyna się na nowej stronie, więc możesz rozdać kartkę na ekipę lub pracownika. Wyłączone daje jeden ciągły dokument.

**Uwzględnij zadania bez zasobu** — Domyślnie: wyłączone. Skutek: zadania bez zasobu pojawiają się jako ostatni pas w diagramie, żeby zobaczyć, czego nikt jeszcze nie ma.

**Grupuj według typu zasobu** — Domyślnie: wyłączone. Skutek: warstwa na wierzchu: najpierw pas dla każdego typu zasobu (robocizna, ekipa, podwykonawca, sprzęt, materiał), w nim pas dla każdego zasobu.

**Pokaż jednostki/dzień i krzywą** — Domyślnie: włączone. Skutek: dwie kolumny po nazwie zadania z jednostkami na dzień i krzywą rozkładu zasobu tego pasa. Jeśli na oś czasu jest za mało miejsca, raport pomija kolumny i pisze *Kolumny Jedn./d i Krzywa zostały pominięte: …*; więcej miejsca daje większy rozmiar papieru albo orientacja pozioma, mniejszy rozmiar czcionki lub węższa tabela.

**Okres raportu:** — tylko zadania, które dotykają okresu. Domyślnie: *Cały projekt*. Skutek: oś czasu biegnie dokładnie przez okres. Jeśli w okresie nic nie ma, pojawia się *Brak zadań w okresie raportu — wybierz inny okres lub Cały projekt*. Zobacz poniżej *Okres raportu*.

## Przegląd kamieni milowych

Wszystkie kamienie milowe projektu w tabeli. Nie ma własnych opcji. Blok *Podsumowanie* liczy *Kamienie milowe*, *Obowiązkowe* i *Opóźnione*. Kolumny to *WBS*, *Nazwa*, *Rodzaj* (*Automatycznie*, *Początek* lub *Zakończ*), *Data*, *Ograniczenie/termin*, *Zapas*, *Obowiązkowy* i *Stan*. Stan to *Opóźniony*, gdy ograniczenie jest naruszone, termin minął albo zapas całkowity jest ujemny; w przeciwnym razie *Krytyczne*, gdy kamień milowy jest krytyczny według definicji krytyczności projektu; w przeciwnym razie *Zgodnie z planem*. Bez kamieni milowych pojawia się *Brak punktów kontrolnych w tym projekcie*. PDF używa papieru i orientacji, które ostatnio wybrałeś dla innego raportu.

## Odchylenie

Bieżący harmonogram obok aktywnego planu bazowego, dla zadań końcowych. Nie ma własnych opcji. Blok *Podsumowanie* liczy *Zadania*, *Później* i *Wcześniej* i pokazuje *Koniec projektu: +3 dni robocze* (różnicę w dniach roboczych między końcem planu bazowego a bieżącym zakończeniem). Kolumny to *WBS*, *Nazwa*, *Początek planu bazowego*, *Koniec planu bazowego*, *Bieżący początek*, *Bieżący koniec*, *Δ początek (dr)*, *Δ koniec (dr)* i *Stan*. Stan zależy od zakończenia: *Później*, gdy zakończenie jest późniejsze niż w planie bazowym, *Wcześniej*, gdy jest wcześniejsze, w przeciwnym razie *Zgodnie z planem*. *Nowy* to zadanie, którego nie ma w planie bazowym; *Usunięte* to zadanie z planu bazowego, które nie jest już w harmonogramie. Bez aktywnego planu bazowego pojawia się *Brak aktywnego planu bazowego — zapisz plan bazowy lub ustaw jeden jako aktywny*. PDF używa papieru i orientacji, które ostatnio wybrałeś dla innego raportu.

## Spojrzenie naprzód

Co trwa lub się zaczyna w okresie: lista na cotygodniowe spotkanie. Opcje są w sekcji *Opcje raportu*.

**Okres raportu:** — okno raportu. Domyślnie: *Następny miesiąc*. Skutek: raport zawiera nieukończone czynności, które dotykają okresu, nawet jeśli obejmują cały okres, oraz zaległe czynności sprzed dnia odniesienia, o ile koniec okresu nie wypada przed dniem odniesienia.

**Prawie krytyczne ≤ (dr):** — próg dla *Prawie krytyczne*. Liczba od 0 do 60. Domyślnie: 5. Skutek: zadanie z zapasem całkowitym większym niż 0 i nie większym niż tyle dni roboczych liczy się jako prawie krytyczne. Przy 0 liczy się tylko to, co oznacza opcja obliczenia projektu *Oznaczaj jako prawie krytyczne*.

Blok *Podsumowanie* liczy *Czynności*, *Zaległe*, *W toku*, *Powinno się rozpocząć*, *Rozpoczyna się*, *Krytyczne* i *Prawie krytyczne*. Stan w każdym wierszu, zawsze względem dnia odniesienia: *Zaległe* (nieukończone, a zakończenie jest przed dniem odniesienia), *Powinno się rozpocząć* (nierozpoczęte, a początek był przed dniem odniesienia), *W toku* i *Rozpoczyna się* (jeszcze nierozpoczęte, zaczynają się w oknie). Kolumny to *WBS*, *Nazwa*, *Początek*, *Zakończ*, *Pozost. (dr)*, *Post*, *ZC (dr)* (TF), *Krytyczne*, *Zasoby* i *Stan*.

## Krytyczne i prawie krytyczne

Czynności, które wyznaczają koniec projektu, i te, które są blisko tego. Opcja jest w sekcji *Opcje raportu*.

**Prawie krytyczne ≤ (dr):** — Domyślnie: 5. Liczba od 0 do 60. Skutek i znaczenie jak przy Spojrzeniu naprzód. Podtytuł podaje wybrany próg.

Raport zawiera nieukończone zadania, które są krytyczne (według obliczenia harmonogramu i definicji krytyczności projektu) albo prawie krytyczne, posortowane według ścieżki zapasu, potem według zapasu całkowitego, potem według początku. Blok *Podsumowanie* liczy *Krytyczne*, *Prawie krytyczne*, *Łańcuchy krytyczne* i *Zadania końcowe*. Kolumny to *WBS*, *Nazwa*, *Początek*, *Zakończ*, *Pozost. (dr)*, *ZC (dr)* (TF), *ZS (dr)* (FF), *Ścieżka* i *Stan*. Kolumna *Ścieżka* pokazuje ścieżkę zapasu, jeśli opcja obliczenia *Wiele ścieżek zapasu* jest włączona; w przeciwnym razie myślnik.

## Raport postępu

Stan projektu na dacie statusu. Opcje są w sekcji *Opcje raportu*.

**Okres raportu:** — Domyślnie: *Ostatni miesiąc*. Skutek: *Ukończone w minionym okresie* liczy się w okresie. *Rozpoczynające się w następnym okresie* patrzy w przód od daty statusu, aż do daty ustawionej w polu *Wybiegając do*; przy okresie *Ostatni miesiąc* tak daleko w przód, jak okres sięga wstecz.

**Prawie krytyczne ≤ (dr):** — Domyślnie: 5. Jak w polu *Wybiegając do*.

Blok *Podsumowanie* pokazuje *Data statusu*, *Okres*, *Wybiegając do*, *Koniec planu bazowego*, *Prognozowany koniec*, *Δ koniec (dr)*, *Planowane* (z *(plan bazowy)* albo *(bieżący harmonogram)*), *Rzeczywiste* oraz liczby *Ukończone*, *W toku*, *Nierozpoczęte*, *Zaległe* i *Krytyczne*. Planowane i rzeczywiste są ważone czasem trwania zadań. Planowane mierzy względem planu bazowego, jeśli jest aktywny; w przeciwnym razie względem bieżącego harmonogramu. Sekcje to *Ukończone w minionym okresie*, *W toku*, *Rozpoczynające się w następnym okresie*, *Zaległe* i *Otwarte czynności krytyczne*; zadanie może być w więcej niż jednej sekcji. Każda sekcja ma te same kolumny: *WBS*, *Nazwa*, *Koniec planu bazowego*, *Prognozowany koniec*, *Post*, *Pozost. (dr)*, *ZC (dr)* (TF), *Krytyczne* i *Stan*. Stan w każdym wierszu to *Ukończone*, *W toku*, *Nierozpoczęte*, *Powinno się rozpocząć* albo *Powinno się zakończyć*.

## Kondycja harmonogramu

Kontrola samego harmonogramu pod kątem błędów i nietypowych wartości, z oceną DCMA w 14 punktach na górze. Opcje znajdziesz w obszarze *Opcje raportu*.

**Duży zapas > (dr):** — Liczba od 1 do 365. Domyślnie: 44. Efekt: niezakończone zadanie z większym zapasem całkowitym niż ta wartość trafia do kategorii *Duży zapas*.

**Długi czas trwania > (dr):** — Liczba od 1 do 365. Domyślnie: 44. Efekt: niezakończone zadanie, nie kamień milowy, z dłuższym czasem trwania trafia do kategorii *Długi czas trwania*.

**Opóźnienie > (dr):** — Liczba od 0 do 365. Domyślnie: 10. Efekt: relacja z większym opóźnieniem trafia do kategorii *Długie opóźnienie*. Ujemne opóźnienie (wyprzedzenie) jest zawsze pokazywane.

**Prawie krytyczne ≤ (dr):** — Liczba od 0 do 60. Domyślnie: 5. Efekt: określa kontrolę *Prawie krytyczne*.

Sekcja *Ocena DCMA w 14 punktach* jest pierwsza. Opiera się na czternastu kontrolach US Defense Contract Management Agency, ze wzorami i progami z broszury *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, październik 2012). Przy każdym punkcie widzisz *Liczba*, *Z* (suma, z której liczono), *Wartość*, *Próg*, *Wynik* i *Szczegóły*. Wynik to *Spełnia*, *Oznaczenie* lub *nd*. Przy *nd* powód podano w kolumnie *Szczegóły*. Oznaczenie nie jest błędem: broszura nazywa je powodem do dalszej analizy. Progi w obszarze *Opcje raportu* nie dotyczą tej sekcji; ona zawsze używa progów z broszury.

Liczy niezakończone zadania końcowe, bez kamieni milowych i hamaków, oraz relacje prowadzące do takich zadań. Uwaga nad raportem podaje obie liczby. Czternaście punktów:

- *Logika*: zadania bez poprzednika lub następnika. Próg: co najwyżej 5%.
- *Wyprzedzenia*: relacje z ujemnym opóźnieniem. Próg: brak.
- *Opóźnienia*: relacje z dodatnim opóźnieniem, choćby krótkim. Próg: co najwyżej 5%.
- *Typy relacji*: udział relacji FS. Próg: co najmniej 90%.
- *Twarde ograniczenia*: zadania z twardym ograniczeniem albo z MSO, MFO, SNLT lub FNLT. Próg: co najwyżej 5%.
- *Duży zapas*: zadania z zapasem całkowitym większym niż 44 dni robocze. Próg: co najwyżej 5%. Wymaga obliczeń.
- *Ujemny zapas*: zadania z zapasem całkowitym poniżej 0. Próg: brak. Wymaga obliczeń.
- *Wysoki czas trwania*: zadania dłuższe niż 44 dni robocze. Liczy czas trwania z planu bazowego, jeśli zadanie jest w aktywnym planie bazowym, a w przeciwnym razie bieżący czas trwania. Próg: co najwyżej 5%.
- *Nieprawidłowe daty*: rzeczywiste rozpoczęcie lub rzeczywiste zakończenie późniejsze niż data statusu albo prognozowane rozpoczęcie lub prognozowany koniec wcześniejszy niż data statusu. Próg: brak. Wymaga daty statusu.
- *Zasoby*: zadania bez zasobu. Próg: brak. Tylko gdy projekt używa zasobów; w przeciwnym razie nd.
- *Nietrzymane zadania*: spośród zadań, które plan bazowy wskazuje jako zakończone do daty statusu włącznie, udział tych, które kończą się później albo mają późniejszy prognozowany koniec. Próg: co najwyżej 5%. Wymaga daty statusu i aktywnego planu bazowego.
- *Test ścieżki krytycznej*: aplikacja wydłuża zadanie krytyczne o 100 dni roboczych i wykonuje przeliczenie na kopii, bez zmiany projektu. Test jest zaliczony, jeśli ostatnie zadanie projektu nie kończy się wtedy przed tym zadaniem. Testuje niezakończone zadanie krytyczne z najwcześniejszym rozpoczęciem; w szczegółach podano nazwę zadania i o ile dni roboczych przesunęło się zakończenie. W widoku *Daty zapisane* test ma wynik *nd* (*nie obliczono*): test oblicza, a raport pokazuje wtedy daty z pliku źródłowego. Naciśnij Oblicz (F5), a test uruchomi się ponownie.
- *CPLI*: (długość ścieżki krytycznej + zapas) / długość ścieżki krytycznej. Długość to liczba dni roboczych od daty statusu do zakończenia ostatniego zadania; zapas to różnica względem zakończenia tego zadania w planie bazowym, a gdy zadania nie ma w planie bazowym, obliczony zapas. Próg: co najmniej 0,95. Wymaga daty statusu.
- *BEI* (wskaźnik realizacji planu bazowego): liczba zadań zakończonych do daty statusu włącznie, podzielona przez sumę liczby zadań, które plan bazowy wskazuje jako zakończone do tego dnia, i zadań bez planu bazowego. Próg: co najmniej 0,95. Wymaga daty statusu i aktywnego planu bazowego.

Dwa punkty różnią się od broszury, bo aplikacja nie zna tego pojęcia: *Wysoki czas trwania* liczy każde niezakończone zadanie, a broszura ogranicza je do szczegółowego okresu planowania (rolling wave), a *Zasoby* bierze pod uwagę tylko przypisane zasoby, nie koszty. Broszura nie podaje liczby dla testu ścieżki krytycznej; 100 dni roboczych to wybór aplikacji.

Kontrole są w tej kolejności, z ich ważnością. Błąd: *Ujemny zapas*, *Niedotrzymany termin*, *Naruszone ograniczenie* i *Niespójny postęp* (rzeczywiste rozpoczęcie lub rzeczywiste zakończenie późniejsze niż data statusu, prognozowane rozpoczęcie lub prognozowany koniec wcześniejszy niż data statusu, 100% bez rzeczywistego zakończenia, rzeczywiste zakończenie, ale nie 100%, postęp bez rzeczywistego rozpoczęcia). Ostrzeżenie: *Bez poprzednika (otwarty początek)* i *Bez następnika (otwarty koniec)* (nie kamienie milowe), *Długi czas trwania*, *Wyprzedzenie (ujemne opóźnienie)*, *Twarde ograniczenie* (twarde ograniczenie albo MSO, MFO, SNLT lub FNLT), *Postęp poza kolejnością* i *Nietrzymane zadanie (względem planu bazowego)*. Informacja: *Prawie krytyczne*, *Duży zapas*, *Długie opóźnienie*, *Relacja inna niż FS* i *Bez zasobu* (tylko gdy projekt używa zasobów). Raport sprawdza wyłącznie zadania końcowe, które nie są hamakami. Blok *Podsumowanie* liczy *Oznaczenia DCMA*, *Błędy*, *Ostrzeżenia*, *Informacje*, *Zadania końcowe* i *Relacje*; pod sekcją DCMA znajdują się sekcja *Przegląd* (dla każdej kontroli ważność i liczba) i sekcja *Ustalenia* (każde zadanie lub relacja). Bez obliczeń brakuje kontroli, które wymagają zapasu.

## Obciążenie zasobów

Dla każdego zasobu i każdego tygodnia lub miesiąca: co jest wymagane w porównaniu z tym, co jest dostępne. Opcje znajdziesz w obszarze *Opcje raportu*.

**Okres raportu:** — Domyślnie: *Cały projekt*. Efekt: każdy tydzień lub miesiąc, który dotyka okresu, jest uwzględniany w całości. Dzięki temu wiersz pokazuje tę samą liczbę co histogram.

**Agregacja:** — Wybierz *Tygodniowo* lub *Miesięcznie*. Domyślnie: *Tygodniowo*. Efekt: jeden wiersz na tydzień kalendarzowy (kolumna *Tydzień od*, z datą poniedziałku) albo na miesiąc kalendarzowy (kolumna *Miesiąc*).

**Tylko przeciążone okresy** — Domyślnie: wyłączone. Efekt: włączona opcja pokazuje tylko tygodnie lub miesiące z co najmniej jednym przeciążonym dniem.

Kolumny to *Zasób*, *Typ*, *Tydzień od* lub *Miesiąc*, *Wymagane*, *Dostępne*, *Różnica* (dostępne minus wymagane; wartość ujemna oznacza niedobór), *Szczyt/dzień* i *Przeciążony*. *Wymagane* to suma jednostko-dni. Zawiera tylko tygodnie lub miesiące z zapotrzebowaniem. Blok *Podsumowanie* liczy *Zasoby*, *Tygodnie* lub *Miesiące*, *Przeciążone tygodnie* lub *Przeciążone miesiące* i *Przeciążone zasoby*.

## Przydziały zasobów

Dla każdego zasobu zadania, do których jest przypisany: co robi ta ekipa albo ten dźwig? Opcje znajdziesz w obszarze *Opcje raportu*.

**Okres raportu:** — Domyślnie: *Cały projekt*. Efekt: przy okresie uwzględniane są tylko przydziały zadań, które dotykają okresu, oraz zaległa praca sprzed dnia odniesienia. *Cały projekt* nie filtruje według daty.

**Uwzględnij zakończone zadania** — Domyślnie: wyłączone. Efekt: włączona opcja uwzględnia także przydziały zakończonych zadań.

Wiersze są pogrupowane według zasobu, a w obrębie zasobu według rozpoczęcia. Blok *Podsumowanie* liczy *Zasoby*, *Przydziały* i *Zadania bez zasobu*. Kolumny to *Zasób*, *Typ*, *WBS*, *Nazwa*, *Początek*, *Zakończ*, *Pozost. (dr)*, *Jedn./dzień*, *Ukoń*, *Krytyczne* i *Stan*. *Zasób* i *Typ* pojawiają się tylko w pierwszym wierszu danego zasobu. Stan w każdym wierszu jest taki sam jak w raporcie postępu: *Ukończone*, *W toku*, *Nierozpoczęte*, *Powinno się rozpocząć* albo *Powinno się zakończyć*.

## Podsumowanie WBS

Harmonogram zsumowany na element WBS: przegląd dla kierownictwa. Opcje znajdziesz w obszarze *Opcje raportu*.

**Poziom:** — do którego poziomu pokazany jest WBS. Wybierz *Pełny WBS* lub poziomy od 1 do 8. Domyślnie: poziom 2. Efekt: podtytuł brzmi *Do poziomu 2*.

**Pokaż zadania** — Domyślnie: wyłączone. Efekt: włączona opcja pokazuje także same zadania końcowe pod każdym elementem.

Kolumny obejmują *WBS*, *Nazwa*, *Początek*, *Koniec*, *Początek planu bazowego*, *Koniec planu bazowego*, *Czas trwania (dr)*, *Ukoń*, *Δ koniec (dr)*, *Min. ZC*, *Czyn* (liczba czynności), *Kryt*, *W toku* i *Gotowe*. Początek i zakończenie zadania sumarycznego pochodzą z ostatniego obliczenia. Postęp jest ważony czasem trwania zadań końcowych. *Min. ZC* (zapas całkowity, TF) i liczby dotyczą zadań końcowych poniżej. Blok *Podsumowanie* liczy *Elementy WBS* i *Czynności*.

## Okres raportu

Cztery raporty tabelaryczne i *Diagram zasobów* korzystają z pola *Okres raportu*: *Prognoza (look-ahead)*, *Raport postępu*, *Obciążenie zasobów*, *Przydziały zasobów* i *Diagram zasobów*. Każdy raport zapamiętuje swój własny okres. Pod listą rozwijaną są pola *Od* i *Do* z datami, które wynikają z wyboru.

**Dzień odniesienia.** Okres z opcją *Następny* lub *Ostatni* liczy się od daty statusu projektu, albo od dzisiaj, gdy nie ma daty statusu. Wtedy raporty tabelaryczne pokazują: *Nie ustawiono daty statusu — raport używa dnia dzisiejszego (…).* Jeśli przesuniesz datę statusu, okno przesunie się razem z nią. Oba dni są uwzględniane.

**Następny tydzień, Następne 2 tygodnie, Następne 4 tygodnie, Następne 6 tygodni, Następne 8 tygodni, Następne 12 tygodni** — od dnia odniesienia, każdy tydzień trwa 7 dni. Przy dacie statusu czwartek 20 maja *Następny tydzień* trwa od 20 do 26 maja, a *Następne 4 tygodnie* od 20 maja do 16 czerwca.

**Ostatni tydzień, Ostatnie 2 tygodnie, Ostatnie 4 tygodnie, Ostatnie 6 tygodni, Ostatnie 8 tygodni, Ostatnie 12 tygodni** — te same sześć okresów, ale liczonych wstecz: każdy tydzień trwa 7 dni, do dnia odniesienia włącznie. Przy dniu odniesienia 20 maja *Ostatnie 2 tygodnie* trwają od 7 do 20 maja.

**Następny miesiąc, Ostatni miesiąc** — miesiąc kalendarzowy w przód lub w tył, do dnia przed tą samą datą w drugim miesiącu. Przy dacie 20 maja *Następny miesiąc* trwa do 19 czerwca; *Ostatni miesiąc* trwa od 21 kwietnia do 20 maja.

**Cały projekt** — od pierwszego rozpoczęcia do ostatniego zakończenia harmonogramu.

**Własny** — Twój własny okres. Efekt: *Od* i *Do* stają się dwoma polami dat. Na początku mają daty z wyboru, który przed chwilą miałeś. Data końcowa nie może być wcześniejsza niż data początkowa (*Data końcowa jest wcześniejsza niż data początkowa.*) i oba pola muszą być wypełnione (*Wpisz obie daty.*). Jeśli wpis jest błędny, raport zostaje przy ostatnim poprawnym okresie.

## Zobacz także

- [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken): cała droga od typu raportu do PDF.
- [Wybieranie okresu raportu](docs://howto-rapportageperiode-kiezen): kroki i przykłady.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co oznaczają zadania krytyczne i prawie krytyczne.
- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): data statusu i plan bazowy, z którymi pracują raporty.
- [Usuwanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić z przeciążonymi tygodniami z obciążenia zasobów.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): PDF obok pozostałych formatów.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dwa plany bazowe z postępem i datą statusu, do obejrzenia raportu variance.
