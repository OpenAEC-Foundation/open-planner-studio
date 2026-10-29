# Ustawienia aplikacji

Każde ustawienie aplikacji: co robi, jaka jest jego wartość początkowa, co się zmienia i gdzie je znajdziesz. Opcje obliczeń projektu (profil obliczeń, definicja zadania krytycznego) znajdziesz w [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies). Należą one do pliku projektu, a nie do aplikacji.

## Gdzie je znaleźć i jak działają

Panel ustawień jest w trzech miejscach, a wszędzie to ten sam panel: koło zębate u góry okna, *Ustawienia › Projekt › Ustawienia aplikacji* oraz *Plik › Ustawienia aplikacji*. Panel ma trzy karty: *Wygląd*, *Planowanie* i *Zaawansowane*. Każde ustawienie poniżej podaje tylko kartę.

Zmiana działa od razu. Nie ma przycisku *Zastosuj* ani *Anuluj*.

**Dla całej aplikacji, nie dla projektu.** Wszystkie ustawienia w tym artykule działają we wszystkich Twoich projektach i należą do tego urządzenia. Aplikacja przechowuje je w pamięci aplikacji lub przeglądarki, a nie w pliku projektu. Jeśli ktoś inny otworzy Twój plik, zobaczy swoje własne ustawienia. Przeglądarka, w której wyczyścisz pamięć, zaczyna od wartości początkowych.

## Karta Wygląd

**Motyw** — kolorystyka interfejsu. Wybierz spośród *Ciemny*, *Jasny* i *Wysoki kontrast*. Domyślnie: *Ciemny*. Efekt: kolory całego interfejsu, w tym Gantt i histogram. Gdzie: *Wygląd*.

**Motyw zgodnie z systemem** — pozwala, aby o kolorystyce decydował system operacyjny. Domyślnie: wyłączone. Efekt: aplikacja używa motywu *Jasny* albo *Ciemny*, zależnie od systemu; trzy kafelki motywu są wtedy wyłączone. *Wysoki kontrast* nie podąża za systemem: wybierasz go sam. Gdy to wyłączysz, zostaje motyw, który był wtedy na ekranie. Gdzie: *Wygląd*, pod *Motyw*.

**Język** — język interfejsu. Domyślnie: język przeglądarki lub systemu, jeśli aplikacja go zna, w przeciwnym razie angielski. Efekt: wszystkie teksty w aplikacji; języki są uporządkowane według krótkiego kodu. Arabski i perski odwracają interfejs od prawej do lewej. Język artykułów Pomocy ustawiasz osobno, pod *Język dokumentacji* w *Plik › Pomoc*. Gdzie: *Wygląd*.

**Czcionka** — czcionka całego interfejsu. Wybierz spośród *Domyślna*, *Systemowa*, *Szeryfowa* i *Monospace*. Domyślnie: *Domyślna*. Efekt: nagłówki i tekst w oknie oraz tekst w Gantt i histogramie. Aplikacja internetowa sama nie używa czcionki systemu, dlatego wybierasz ją tutaj. Gdzie: *Wygląd*.

**Rozmiar tekstu** — skala interfejsu. Wybierz spośród 90%, 100%, 110% i 125%. Domyślnie: 100%. Efekt: tekst i układ wstążki, paneli oraz okien dialogowych stają się większe lub mniejsze, a wysokość wierszy w tabeli i w Gantt skaluje się razem z nimi. Nie ma wyboru powyżej 125%, bo etykiety przycisków we wstążce wtedy łamią się na kilka wierszy. Gdzie: *Wygląd*.

**Format daty** — jak daty wyglądają w aplikacji. Wybierz spośród *dd-mm-rrrr*, *mm-dd-rrrr* i *rrrr-mm-dd*. Domyślnie: *dd-mm-rrrr*. Efekt: daty w tabeli, oknach dialogowych, raportach i na wydruku. Pliki i obliczenia się nie zmieniają: zmienia się tylko wyświetlanie. Gdzie: *Wygląd*.

**Format czasu** — jak godziny wyglądają w aplikacji. Wybierz spośród *24-godzinny (13:00)* i *12-godzinny (1:00 PM)*. Domyślnie: *24-godzinny (13:00)*. Efekt: godziny w oknie kalendarza, data i godzina zadań godzinowych (tabela, podziały, komunikaty) oraz skala czasu *Godzina* w Gantt. W polu czasu możesz wpisać każdą z tych form: *13:00*, *1300*, *13*, *1:00 PM* albo *1 pm*. Północ jako koniec dnia to *24:00* albo *12:00 AM*. Pliki i obliczenia się nie zmieniają: zostają 24-godzinne. Gdzie: *Wygląd*.

**Wyświetlanie czasu trwania** — w jakiej jednostce pokazuje się czas trwania zadania. Wybierz spośród *Automatycznie (własna jednostka dla zadania)*, *Zawsze w dniach* i *Zawsze w godzinach*. Domyślnie: *Automatycznie (własna jednostka dla zadania)*. Efekt: w tabeli zadań, w etykietach pasków w Gantt, w podpowiedzi, na wydruku i w raportach. Przy wyborze *Automatycznie* zadanie w dniach pokazuje dni, a zadanie godzinowe pokazuje godziny. Przy wyborze *Zawsze w dniach* lub *Zawsze w godzinach* aplikacja zamienia jednostki, używając godzin na dzień z kalendarza zadania. Gdy jednostka zadania jest inna, dodaje w nawiasie za wynikiem jednostkę zadania, na przykład `2.25d(18h)`. Zmienia się tylko wyświetlanie; zadanie zachowuje swoją jednostkę. Gdzie: *Wygląd*.

**Styl przełączania dokumentów** — jak przełączasz się między otwartymi projektami. Wybierz spośród *Karty poziome*, *Karty pionowe* i *Pigułka*. Domyślnie: *Karty poziome*. Efekt: *Karty poziome* dają pasek kart pod wstążką; *Karty pionowe* dają pasek projektów po lewej; *Pigułka* dodaje mały przycisk projektu na pasku tytułu. Gdzie: *Wygląd*.

### Sekcja Gantt

**Pokazuj tylko dni robocze** — zagęszcza oś czasu. Domyślnie: wyłączone. Efekt: weekendy i święta z kalendarza projektu są pomijane, więc zadanie trwające 5 dni roboczych ma dokładnie 5 kolumn szerokości. Skróty *Przejdź do dziś* i *Dopasuj do projektu* liczą wtedy też dni robocze. Raport ma własne pole wyboru o tej samej nazwie, niezależne od tego ustawienia. Gdzie: *Wygląd*, pod *Gantt › Oś czasu*.

**Kwadranse przy mocnym powiększeniu** — dodatkowa, drobniejsza skala czasu. Domyślnie: wyłączone. Efekt: możesz powiększyć bardziej, a skala godzin dostaje dodatkowy wiersz z kwadransami. Przeciągając pasek zadania godzinowego, można wtedy przyciągać go do kwadransów zamiast do pełnych godzin. Zobaczysz to tylko wtedy, gdy *Włącz planowanie godzinowe* jest włączone. Gdzie: *Wygląd*, pod *Gantt › Powiększenie kwadransowe*.

**Paski zadań i przerwy** — czy zadanie godzinowe rysuje się w blokach. Wybierz spośród *Nigdy nie dziel*, *Dziel przy zaznaczeniu* i *Zawsze dziel*. Domyślnie: *Dziel przy zaznaczeniu*. Efekt: pasek zadania godzinowego rysuje się wtedy osobno dla każdego pasma czasu pracy, zamiast jako jeden ciągły pasek. *Dziel przy zaznaczeniu* robi tak tylko dla zaznaczonego zadania. Dotyczy to wyłącznie zadań godzinowych. Zadanie, które jest naprawdę podzielone (przez *Podziel zadanie*), pokazuje swoją przerwę niezależnie od tego ustawienia. Gdzie: *Wygląd*, pod *Gantt*.

**Przewijanie i powiększenie › Tryb** — co robi kółko myszy nad Gantt. Wybierz spośród *Pozycja*, *Klawisze* i *Zoom + przeciąganie*. Domyślnie: *Zoom + przeciąganie*. Efekt: w trybie *Zoom + przeciąganie* kółko powiększa wokół kursora, Shift+kółko przewija po wierszach, oś czasu przesuwasz, przeciągając tło, a Ctrl+przeciągnięcie (Cmd na Macu) rysuje pole zaznaczenia. W trybie *Pozycja* funkcja kółka zależy od tego, gdzie jest kursor. Ctrl+kółko zawsze powiększa, a Shift+kółko zawsze przewija poziomo. W trybie *Klawisze* sam wybierasz, który klawisz co robi. Wybór dotyczy też drugiej osi czasu widoku podzielonego. Gdzie: *Wygląd*, pod *Gantt › Przewijanie i powiększenie*.

**Przewijanie i powiększenie › Podział ekranu** — w którym miejscu kursor wywołuje którą funkcję. Widoczne tylko w trybie *Pozycja*. Wybierz spośród *Lewo/prawo*, *Góra/dół* i *Prawy górny róg*. Domyślnie: *Lewo/prawo*. Efekt: przy wyborze *Lewo/prawo* kółko przewija pionowo nad lewą połową, a poziomo nad prawą połową. Przy wyborze *Góra/dół* kółko przewija poziomo nad górnymi 30% (przy skali czasu), a pionowo poniżej. Przy wyborze *Prawy górny róg* kółko przewija poziomo w prawej górnej ćwiartce, a pionowo w reszcie. Gdzie: *Wygląd*, pod *Gantt › Przewijanie i powiększenie*.

**Przewijanie i powiększenie › Pionowo, Poziomo, Powiększenie** — który klawisz działa z którą funkcją kółka. Widoczne tylko w trybie *Klawisze*. Dla każdej funkcji wybierasz spośród *Przewijanie*, *Ctrl + przewijanie* lub *Shift + przewijanie*. Domyślnie: *Pionowo* to *Przewijanie*, *Powiększenie* to *Ctrl + przewijanie*, a *Poziomo* to *Shift + przewijanie*. Efekt: jeśli wybierzesz klawisz, który już jest w użyciu, zamienia się on z funkcją, która go miała. Gdzie: *Wygląd*, pod *Gantt › Przewijanie i powiększenie*.

## Karta Planowanie

**Włącz tryb budowlany** — startowe wartości dla nowych projektów, nastawione na budownictwo. Domyślnie: włączone. Efekt: włączone daje nowemu projektowi kalendarz *Bouwkalender NL* z holenderskich świąt państwowych, pozwala wybrać święto budowlane przy generowaniu świąt, oferuje szablony faz *Budownictwo mieszkaniowe* i *Budownictwo użytkowe / remont* oraz nadaje nowym zadaniom rodzaj robót *Budowa*. Wyłączone daje kalendarz *Standaardkalender* bez świąt, tylko szablon *Pusty* i rodzaj robót *Inne*. Nowe zadanie pod zadaniem nadrzędnym, które ma rodzaj robót, najpierw przejmuje ten rodzaj robót; *Budowa* albo *Inne* stosuje się dopiero potem. Istniejące zadania i kalendarze się nie zmieniają. Gdzie: *Planowanie*.

**Włącz planowanie godzinowe** — planowanie według godzin pracy obok dni roboczych. Domyślnie: wyłączone. Efekt: skala czasu *Godzina* pojawia się pod *Widok › Skala czasu*. W oknie *Kalendarze* zwykły kalendarz może dostać pasma czasu pracy (blok *Godziny pracy*; kalendarz, który już ma pasma, zawsze pokazuje ten blok). Okno *Nowy projekt* dostaje wybór *Zmiana* i *Domyślna jednostka nowych zadań*. *Ustawienia projektu* dostają też wybór *Domyślna jednostka nowych zadań*. Wyłączone: aplikacja pracuje z dokładnością do dnia. Zadania, które są już godzinowe, zostają i są uwzględniane w obliczeniach. Czas trwania tych zadań możesz zmienić dopiero po włączeniu planowania godzinowego. Gdzie: *Planowanie*, pod *Planowanie godzinowe*. Zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).

**Mieszane planowanie dni i godzin** — czy jednostkę wybierasz dla każdego zadania osobno. Widoczne tylko, gdy *Włącz planowanie godzinowe* jest włączone. Domyślnie: włączone. Efekt: włączone pokazuje listę rozwijaną *Jednostka czasu trwania* przy czasie trwania każdego zadania. Wyłączone ukrywa tę listę. Gdzie: *Planowanie*, pod *Planowanie godzinowe*. Zobacz [Dni i godziny](docs://uitleg-dagen-en-uren).

**Tydzień zaczyna się od** — pierwszy dzień tygodnia. Wybierz spośród *Poniedziałek* i *Niedziela*. Domyślnie: *Poniedziałek*. Efekt: układ tygodni i numery tygodni na skali czasu w Gantt oraz w raportach (wydruk wykresu Gantt), a także kolejność dni tygodnia w oknie *Kalendarze*. Gdzie: *Planowanie*.

**Oblicz automatycznie** — przelicza harmonogram, gdy tylko jest nieaktualny. Domyślnie: wyłączone. Efekt: wyłączone oznacza, że sam naciskasz *Oblicz* (F5). Włączone sprawia, że aplikacja przelicza harmonogram w ułamku sekundy po zmianie zadań, relacji lub kalendarza. Podczas przeciągania albo gdy wpisujesz wartość w polu, aplikacja czeka i oblicza raz, gdy skończysz. Po nieudanym obliczeniu aplikacja oblicza ponownie dopiero wtedy, gdy coś zmienisz. Gdzie: *Planowanie*, pod *Obliczanie*.

**Używaj typów zadań** — pola typu zadania i pracy w aplikacji. Domyślnie: wyłączone. Efekt: włączone pokazuje pole *Typ zadania* przy zadaniu i kolumnę pracy dla przydziałów, a także udostępnia kolumnę tabeli *Typ zadania*. Wyłączone je ukrywa; czas trwania i jednostki zostają, a praca się do nich dostosowuje. Projekt, który już zawiera dane typu zadania lub pracy, na przykład z pliku `.mpp` lub `.xer`, pokazuje je zawsze, także gdy ustawienie jest wyłączone. Gdzie: *Planowanie*, pod *Obliczanie*. Zobacz [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels).

## Karta Zaawansowane

**Pokaż wyjaśnienie po otwarciu** — jedno pole wyboru na format: *Plik Primavera (.xer)*, *Plik MS Project (.mpp)*, *MS Project XML*, *Primavera P6 XML* i *Plik CSV*. Domyślnie: wszystkie włączone. Efekt: włączone pokazuje okno z krótkim wyjaśnieniem formatu, gdy otworzysz taki plik: co aplikacja przejęła, czego nie przejęła i jak działają zapisywanie oraz zapis zwrotny. *Nie pokazuj ponownie dla …* w tym oknie czyści pole wyboru tutaj; tutaj znowu je włączysz. Plik IFC, przykład oraz projekt, który otwiera asystent AI lub rozszerzenie, nigdy nie dostają tego wyjaśnienia. Gdzie: *Zaawansowane*, pod *Pokaż wyjaśnienie po otwarciu*. Zobacz [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan).

**Włącz tryb AI** — pozwala, aby asystent AI pracował z Twoim harmonogramem. Domyślnie: wyłączone. Efekt: włączone pokazuje kartę *AI* z mostkiem MCP, dzięki czemu asystent AI może pracować z Twoim harmonogramem przez Model Context Protocol. Wyłączone ukrywa kartę i zatrzymuje mostek. Gdzie: *Zaawansowane*, pod *Tryb AI*. Zobacz [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen).

**Uruchom mostek automatycznie** — uruchamia mostek MCP, gdy aplikacja startuje. Można to włączyć tylko, gdy *Włącz tryb AI* jest włączone. Domyślnie: wyłączone. Efekt: mostek działa od razu, więc klient AI może się połączyć bez wcześniejszego otwierania karty *AI*. To działa tylko w aplikacji desktopowej i tylko raz przy starcie: jeśli później sam wyłączysz mostek, nie uruchomi się on ponownie. Gdzie: *Zaawansowane*, pod *Tryb AI*.

**Włącz terminal debugowania** — panel dziennika do rozwiązywania problemów. Domyślnie: wyłączone. Efekt: włączone dodaje na pasku stanu przycisk terminala, który pokazuje lub ukrywa panel dziennika. Wyłączone zamyka panel. Gdzie: *Zaawansowane*, pod *Terminal debugowania*.

**Benchmark…** — mierzy wydajność silnika harmonogramu. Efekt: otwiera okno, w którym generujesz harmonogram testowy wybranego rozmiaru i mierzysz główne fazy. Twój otwarty projekt zostaje nietknięty. To przycisk, a nie ustawienie: nic nie trzeba zapamiętywać. Gdzie: *Zaawansowane*, pod *Benchmark*.

**Statystyki…** — jak często aplikację pobrano. Efekt: otwiera okno *Statystyki pobrań* z publicznymi danymi z GitHub Releases; od Ciebie nic nie jest zbierane. To przycisk, a nie ustawienie. Gdzie: *Zaawansowane*, pod *Statystyki*. W oknie:

- *Pobrania według systemu operacyjnego* — dla każdego systemu kolumny *Pobrania*, *Instalatory* (co pobiera człowiek) i *Aktualizacje* (co pobiera aktualizator w aplikacji), z sumą *Razem*. W Linuksie obu nie da się rozdzielić: aktualizator pobiera ten sam plik `.deb`, `.rpm` lub `.AppImage`, który ludzie pobierają też ręcznie, więc liczy się tam jako instalator tylko plik snap. Pod tym jest *Sprawdzenia aktualizacji z aplikacji*: jak często aktualizator w zainstalowanej aplikacji pobrał plik z wersją z GitHub, żeby szukać nowej wersji. To są sprawdzenia, nie instalacje.
- *Według wydania* — te same pobrania dla każdej wersji, z datą; najpierw sześć najnowszych, a dla reszty *Pokaż wszystkie wydania (…)*.
- *Źródło* — data danych (GitHub Releases, aktualizowane co tydzień) oraz *Odśwież teraz*. Aplikacja trzyma pobrane dane przez pół godziny. Gdy pobieranie się nie uda, okno to pokazuje. Instalacje przez Snap Store nie przechodzą przez GitHub, więc ich brakuje.

**Uruchom wycieczkę** — wprowadzająca wycieczka jeszcze raz. Efekt: zamyka okno *Ustawienia aplikacji* i uruchamia wycieczkę od pierwszego kroku. Gdzie: *Zaawansowane*, pod *Wycieczka*.

**Wersja** — numer wersji aplikacji, z dwoma przyciskami. *Sprawdź aktualizacje* otwiera okno aktualizacji. *Co nowego* pokazuje nowości bieżącej wersji. Gdzie: *Zaawansowane*, pod *Wersja*.

**Pokazuj klasyczne przyciski widoku** — funkcja zastąpiona, pod *Funkcje starszego typu*. Domyślnie: wyłączone. Efekt: włączone przywraca grupę *Wyświetlanie* na karcie *Widok* z osobnymi przyciskami *Kolumny…*, *Filtr…*, *Grupuj…* i *Sortuj…*. Zastąpiły je plus w nagłówku tabeli, przyciski układów i okno układów. Gdzie: *Zaawansowane*, pod *Funkcje starszego typu*.

## Zapamiętane wybory wyświetlania poza panelem

Aplikacja zapisuje te wybory także na tym urządzeniu. Ustawiasz je jednak bezpośrednio przy danym elemencie, a nie w panelu ustawień.

**Nakładka planu bazowego** — aktywny plan bazowy jako cienki pasek pod paskiem zadania. Domyślnie: włączone. Gdzie: *Widok › Plan bazowy i postęp › Nakładka planu bazowego*.

**Linia postępu** — zygzakowata linia postępu przy dacie statusu. Domyślnie: włączone. Efekt: linia pojawia się tylko wtedy, gdy projekt ma datę statusu. Wtedy zastępuje osobną linię daty statusu. Gdzie: *Widok › Plan bazowy i postęp › Linia postępu*.

**Linia daty statusu** — kropkowana linia przy dacie statusu. Domyślnie: włączone. Efekt: jeśli linia postępu jest włączona, linia daty statusu rysuje oznaczenie samodzielnie. Gdzie: *Widok › Plan bazowy i postęp › Linia daty statusu*.

**Akcent zasobu** — cienka linia w kolorze zasobu pod paskiem zadania. Domyślnie: wyłączone. Gdzie: *Widok › Plan bazowy i postęp › Akcent zasobu*.

**Pas zapasu** — zapas jako pas za paskami zadań niekrytycznych; nie dotyczy zadań ukończonych. Domyślnie: włączone. Gdzie: *Widok › Plan bazowy i postęp › Pas zapasu*.

**Kolory słupków** — od czego zależy kolor paska. Wybierz jedną opcję: *Ścieżka krytyczna*, *Na zadanie — automatycznie* lub *Według kategorii*. Domyślnie: *Ścieżka krytyczna*. Efekt: dotyczy jednocześnie wykresu Gantt i raportu. Gdzie: *Widok › Plan bazowy i postęp › Kolory słupków*.

**Histogram** — pas histogramu pod wykresem Gantt. Domyślnie: wyłączone. Gdzie: *Zasoby › Histogram › Histogram*, *Widok › Panele › Histogram* lub Ctrl+Shift+H. Wysokość pasa ustawiasz, przeciągając jego krawędź. Domyślnie 160 pikseli, zakres od 80 do 480.

**Minimapa** — mapa przeglądowa osi czasu. Domyślnie: wyłączone. Gdzie: *Widok › Prezentacja › Minimapa*.

**Zwiń wstążkę** — kompaktowa wstążka. Domyślnie: wyłączone. Gdzie: przycisk ze strzałką w prawym dolnym rogu wstążki.

**Szerokość tabeli zadań** — domyślnie 350 pikseli, zakres od 150 do 800. Ustawiasz ją, przeciągając podział obok tabeli. Możesz też użyć strzałki w lewo i strzałki w prawo, gdy podział jest aktywny.

**Szerokość prawego panelu** — domyślnie 280 pikseli, zakres od 200 do 900. Ustawiasz ją, przeciągając krawędź panelu.

**Wysokość *Właściwości* i *Ostrzeżenia* w prawym panelu** — domyślnie 240 i 220 pikseli, zakres od 120 do 2000. *Właściwości* ma tę wysokość także wtedy, gdy otwarta jest lista zasobów. Wysokość ustawiasz uchwytem między sekcjami. Aplikacja nie zapamiętuje, czy sekcje są otwarte, czy zamknięte.

**Także zapamiętane, opisane w innym miejscu** — kolumny tabeli ([Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen)), Twoje układy ([Tworzenie i używanie układu](docs://howto-layouts-gebruiken)), opcje raportów ([Typy raportów](docs://ref-rapporttypes)), własne szablony profilów obliczeń ([Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies)) oraz *Język dokumentacji* pomocy (*Plik › Pomoc*). Aplikacja zapisuje je także na tym urządzeniu, a nie w pliku projektu.

## Zobacz także

- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): opcje, które należą do projektu.
- [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten): kroki dla przełącznika *Włącz planowanie godzinowe*.
- [Dni i godziny](docs://uitleg-dagen-en-uren): jak aplikacja liczy dni i godziny.
- [Typy zadań: czas trwania, jednostki i praca](docs://uitleg-werkregels): co pokazuje *Używaj typów zadań*.
- [Skróty klawiszowe](docs://ref-sneltoetsen): wszystkie klawisze aplikacji, także do powiększania i przewijania.
