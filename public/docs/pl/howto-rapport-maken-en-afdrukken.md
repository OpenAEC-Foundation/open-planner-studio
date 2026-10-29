# Tworzenie i drukowanie raportu

Cel: wybierz raport harmonogramu, sprawdź go w podglądzie i zapisz jako PDF, abyś mógł go rozdać albo wydrukować samodzielnie.

## Kiedy tego potrzebujesz

W piątek jest narada na budowie. Klient chce harmonogram na papierze. Kierownik budowy chce wiedzieć, co zacznie się w najbliższych tygodniach. Brygadzista chce kartkę tylko z zadaniami, za które odpowiada. Zestawienia tego typu tworzysz na karcie *Raport*. Aplikacja oblicza je z harmonogramu i najpierw pokazuje podgląd. Potem eksportujesz je do pliku PDF.

Aplikacja nie wysyła raportu do drukarki sama. Końcowym wynikiem jest zawsze plik PDF. Drukujesz go w czytniku PDF albo wysyłasz e-mailem.

## Kroki

### 1. Otwórz kartę Raport

Wybierz *Raport* na wstążce albo naciśnij Ctrl+P. Ctrl+P przenosi Cię na tę kartę. Jeśli wpisujesz w polu, masz otwarte okno dialogowe albo włączony tryb prezentacji, Ctrl+P nie działa. W przeglądarce otworzy się wtedy okno drukowania przeglądarki. Ono wydrukuje ekran, a nie raport.

Po lewej stronie jest panel *Raport* z listą *Typ raportu*, podsumowaniem i ustawieniami. Po prawej stronie jest podgląd.

### 2. Wybierz typ raportu

Lista *Typ raportu* ma jedenaście raportów. Wybierz ten, który pasuje do Twojego pytania.

- *Wykres Gantta*: harmonogram w postaci wykresu z paskami, zwykły harmonogram do rozdania.
- *Diagram zasobów*: te same paski, ale z osobnym pasmem na każdy zasób. Dla pytania „co robi ekipa X?”, jeśli chcesz, z arkuszem na każdą ekipę.
- *Przegląd punktów kontrolnych*: wszystkie kamienie milowe z datą i statusem.
- *Variance*: bieżący harmonogram obok aktywnego planu bazowego. Dla pytania „o ile jesteśmy opóźnieni?”.
- *Prognoza (look-ahead)*: co trwa lub zaczyna się w nadchodzącym okresie. Lista na cotygodniową naradę.
- *Krytyczne i prawie krytyczne*: zadania bez zapasu albo prawie bez zapasu.
- *Raport postępu*: stan projektu na dacie statusu, czyli dniu, w którym mierzysz postęp.
- *Kondycja harmonogramu*: sprawdzenie samego harmonogramu pod kątem błędów i nietypowych wartości.
- *Obciążenie zasobów*: dla każdego zasobu na tydzień lub miesiąc, ile jest potrzebne, a ile dostępne.
- *Przydziały zasobów*: dla każdego zasobu zadania, do których jest przydzielony.
- *Podsumowanie WBS*: harmonogram zsumowany na poziomy WBS, dla kierownictwa.

### 3. Upewnij się, że harmonogram jest aktualny

Aplikacja sama nie oblicza. Jeśli od ostatniego obliczenia zmieniasz zadania, relacje albo kalendarze, naciśnij **Oblicz** (F5). Tabele raportów same Cię ostrzegają, na górze raportu: *Harmonogram zmienił się od ostatniego obliczenia — naciśnij Oblicz (F5), aby zobaczyć aktualne wartości.* Albo, jeśli nigdy nie został obliczony: *Jeszcze nie obliczono — naciśnij Oblicz (F5), aby uzyskać daty i zapasy.*

Na karcie Raport nie ma przycisku Oblicz, ale F5 tu działa. **Eksportuj PDF** też sam najpierw oblicza, jeśli harmonogram jest nieaktualny, więc PDF nigdy nie odstaje od Twojego harmonogramu.

### 4. Dostosuj raport

W sekcji *Ustawienia* są wybory dla wykresu Gantt i diagramu zasobów. Prognoza (look-ahead), Krytyczne i prawie krytyczne, Raport postępu, Kondycja harmonogramu, Obciążenie zasobów, Przydziały zasobów i Podsumowanie WBS mają tylko *Papier:* i *Orientacja:*, a także blok *Opcje raportu* z wyborami tego raportu. Przegląd punktów kontrolnych i Variance nie mają własnych wyborów. Informacje o okresie raportu znajdziesz w [Wybieranie okresu raportowania](docs://howto-rapportageperiode-kiezen).

- *Papier:* i *Orientacja:* określają arkusz. Domyślnie jest to A3 poziomo, co jest wygodne dla harmonogramu budowy, ale nie każda drukarka drukuje A3. Jeśli masz drukarkę A4, wybierz teraz A4: aplikacja rozplanuje strony pod A4, a Ty nie musisz ich później zmniejszać.
- Przy diagramie zasobów pole wyboru *Każdy zasób na nowej stronie* daje arkusz na każdą ekipę.
- *Rozmiar czcionki:* (od 90% do 125%) powiększa albo zmniejsza tekst i tabelę. Większa czcionka zostawia mniej miejsca na oś czasu.
- *Podążaj za widokiem (filtr, grupowanie, sortowanie)* pojawia się tylko dla wykresu Gantt. Domyślnie na papier idzie całe drzewo zadań. Przy tym polu raport rysuje dokładnie te wiersze, które widzisz na ekranie, także zwinięte fazy, na przykład tylko zadania krytyczne z układu. Jak zrobić taki widok, znajdziesz w [Tworzenie i używanie układu](docs://howto-layouts-gebruiken).
- *Pokaż nakładkę planu bazowego* pokazuje aktywny plan bazowy obok bieżących pasków. Przy *Linia statusu:* wybierasz *Linia daty statusu* albo *Linia postępu*.
- *Dopasuj do papieru* jest domyślnie włączone: oś czasu wtedy skaluje się do szerokości strony, a liczba stron wynika z wysokości. Gdy to wyłączysz, raport używa stałej skali i dzieli też oś czasu na kafelki w szerokości, co szybko daje dużo stron. Przy *Oś czasu na:* rozkładasz oś czasu na od 2 do 8 stron szerokości, przy dopasowaniu, dla długiego harmonogramu, który chcesz wydrukować w czytelnym rozmiarze.

### 5. Sprawdź podgląd

Przy wykresie Gantt i diagramie zasobów widzisz papier z nagłówkiem strony, tabelą, osią czasu i legendą. Przewiń, aby obejrzeć strony. *Jakość podglądu* ustawia tylko ostrość podglądu na ekranie. PDF się od tego nie zmienia. Jeśli pod stronami pojawia się napis *… i jeszcze 1 strona — wyeksportuj, aby zobaczyć cały dokument* (przy większej liczbie stron *… i jeszcze 2 strony — wyeksportuj, aby zobaczyć cały dokument*), podgląd nie ma jeszcze wszystkich stron gotowych. PDF zawiera je wszystkie.

Pozostałe raporty pokazują się na ekranie jako tabela. To, co widzisz, trafia do PDF.

### 6. Eksportuj do PDF

Na dole lewego panelu kliknij **Eksportuj PDF**. Proponowana nazwa pliku to nazwa projektu, a za nią rodzaj raportu, na przykład dla wykresu Gantt *Extension house-planning.pdf*.

- W aplikacji na komputer oraz w przeglądarce, która ma okno zapisu plików, wybierasz, gdzie trafi PDF. Jeśli zamkniesz to okno bez zapisu, nic się nie stanie.
- W przeglądarce bez takiego okna przeglądarka zapisuje PDF w folderze pobranych plików.

### 7. Wydrukuj PDF

Otwórz PDF w czytniku PDF i wydrukuj go tam. Jeśli drukujesz PDF w A3 na drukarce A4, okno drukowania musi zmniejszyć strony. Ustaw więc rozmiar papieru najpierw w kroku 4.

## Pułapki i co robi aplikacja

**Przycisk Drukuj i Ctrl+P nic nie drukują.** Przycisk *Drukuj* w grupie *Raport* jest na samej karcie Raport i nie robi nic dodatkowego. Ctrl+P przenosi Cię na tę kartę. W aplikacji nie ma osobnego polecenia drukowania: droga na papier prowadzi przez PDF. Jeśli Ctrl+P nie działa (zob. krok 1), w przeglądarce otworzy się okno drukowania przeglądarki. Ono drukuje ekran, a nie raport.

**Firma: nadpisany tekst nie zostaje zachowany.** Pole *Firma:* na wykresie Gantt zaczyna się od firmy z ustawień projektu. To, co nadpiszesz, nie zostaje zachowane. Tutaj nie możesz wpisywać w polu *Autor:*. Obie wartości zmienisz w *Ustawienia › Projekt › Ustawienia projektu*, w polach *Zleceniodawca/organizacja* i *Autor*, i potwierdzisz przyciskiem *Zastosuj*.

**Kolory słupków: dotyczy też ekranu.** Wybór *Kolory słupków:* w raporcie jest tym samym wyborem co *Kolory słupków* na karcie Widok. Jeśli zmienisz go w raporcie, Twój wykres Gantt na ekranie zmieni się razem z nim.

**Variance bez planu bazowego.** Plan bazowy to zapisana kopia harmonogramu, z którą później porównujesz. Jak go zapisać, jest w [Zapisywanie i zarządzanie planem bazowym](docs://howto-baseline-opslaan-en-beheren). Jeśli nie masz aktywnego planu bazowego, zamiast porównania pojawia się napis *Brak aktywnego planu bazowego — zapisz plan bazowy lub ustaw jeden jako aktywny.*

**Linia statusu bez daty statusu.** Jeśli wybierzesz *Linia statusu:*, a projekt nie ma daty statusu, raport ostrzega *Najpierw ustaw datę statusu* i nic nie rysuje. Datę statusu ustawiasz w *Planowanie › Plan bazowy i postęp › Data statusu*.

**Harmonogram zawiera pętlę.** Jeśli harmonogram zawiera pętlę, *Eksportuj PDF* nie tworzy pliku i pokazuje błąd.

**Papier obowiązuje obecnie dla wszystkich raportów.** Jest jeden wybór dla *Papier:* i *Orientacja:*, wspólny dla wszystkich raportów. Przegląd punktów kontrolnych i Variance nie mają własnego wyboru papieru. Używają tego, co ustawiono w innym raporcie, domyślnie A3 poziomo. Wybierz więc papier najpierw w raporcie, który go oferuje, na przykład w wykresie Gantt, a potem wróć.

**Ustawienia obowiązują dla wszystkich projektów.** Papier, rozmiar czcionki, okres i pozostałe wybory zapamiętuje aplikacja na tym urządzeniu, dla wszystkich Twoich projektów. Nie należą do pliku projektu.

## Zobacz też

- [Wybieranie okresu raportowania](docs://howto-rapportageperiode-kiezen): prognoza (look-ahead) albo raport postępu za określony przedział czasu.
- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): najpierw filtruj lub grupuj, potem drukuj z *Podążaj za widokiem (filtr, grupowanie, sortowanie)*.
- [Zapisywanie i zarządzanie planem bazowym](docs://howto-baseline-opslaan-en-beheren): zapisana kopia, z którą porównuje się Variance.
- [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen): co zrobić, gdy Obciążenie zasobów pokazuje przeciążone tygodnie.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): dlaczego zadanie jest krytyczne albo prawie krytyczne.
- [Typy raportów](docs://ref-rapporttypes): wszystkie typy raportów i ich opcje.
