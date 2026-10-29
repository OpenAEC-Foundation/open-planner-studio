# Dobre planowanie

Co sprawia, że harmonogram jest dobry? Nie to, jak schludnie wygląda, lecz to, czy odpowiada na pytanie, które ma znaczenie, gdy realizacja jest w toku: jeśli coś się opóźni, co stanie się z przekazaniem? Ten artykuł wyjaśnia zasady, na których opiera się niezawodny harmonogram, i dlaczego mają tak duże znaczenie w Open Planner Studio: aplikacja oblicza na podstawie tego, co wpiszesz, i na niczym innym.

Przykłady pochodzą z budownictwa — roboty konstrukcyjne, roboty wykończeniowe, czasy dostaw, przestoje z powodu pogody, podwykonawcy, umowny termin przekazania — ale same zasady nie są związane wyłącznie z budownictwem.

## Koncepcja

Dobry harmonogram nie jest obrazem tego, na co liczysz, lecz **modelem obliczeniowym**: zadania z czasem trwania, połączone relacjami, w kalendarzu. Aplikacja oblicza daty na podstawie tego modelu. Gdy coś się zmieni, model przelicza się i od razu widzisz, co to oznacza dla reszty.

Planista pracuje w stałej kolejności:

1. Cel: kamienie milowe i termin przekazania.
2. Podział: fazy, pakiety robót, zadania.
3. Czas trwania każdego zadania.
4. Relacje.
5. Ograniczenia i stałe daty.
6. Kalendarze.
7. Zasoby.
8. Ścieżka krytyczna i zapas.
9. Plan bazowy i postęp.
10. Przegląd.

Ta kolejność nie jest tylko zwyczajem. Pominięcie kroku wraca jako niespodzianka: zadania bez relacji nie przesuwają się razem z resztą, czasy trwania bez kalendarza są błędne, a plan bazowy zapisany dopiero później zamraża przesunięte terminy zamiast uzgodnienia.

## Jak aplikacja oblicza harmonogram

Każda zasada poniżej wiąże się z czymś, co robi aplikacja. Dlatego ta część idzie w tej samej kolejności.

### Zacznij od celu, nie od zadań

Najpierw wpisz momenty, które są ustalone. Dopiero potem prace, które muszą się między nimi zmieścić: start przygotowania terenu, ostateczne pozwolenie, budynek zabezpieczony przed pogodą, start wykończenia, przekazanie. To są **kamienie milowe**: punkty bez czasu trwania. Wpisuj je naprawdę jako kamień milowy (*Start › Zadania › Kamień milowy ▾*), a nie jako zadanie o zerowym czasie trwania z nazwą, która tylko do niego przypomina.

Dlaczego ta kolejność: harmonogram, który zaczyna się od listy zadań, staje się sumą. A suma rzadko trafia w datę z umowy. Zacznij od kamieni milowych, a od razu zadasz właściwe pytanie. Nie „ile czasu zajmie to wszystko razem”, lecz „czy praca mieści się między tymi dwoma momentami, a jeśli nie, co musi się zmienić”. Licz wstecz: od wymaganej daty przekazania do chwili, w której budynek najpóźniej musi być zabezpieczony przed pogodą, a stamtąd do startu.

Przekazanie, które jest ustalone w umowie, dostaje pole wyboru *Obowiązkowy (umowny)*. Ktokolwiek otworzy plik, zobaczy wtedy, że ten moment nie podlega negocjacjom ani przesunięciu. Pole wyboru jest znacznikiem dla wykresu Gantt i raportów. Nie chroni daty. Do tego służy termin ostateczny lub ograniczenie (zobacz niżej).

### Podział: fazy, pakiety robót, zadania

Pod kamieniami milowymi buduj strukturę: fazy, pod nimi pakiety robót, pod nimi zadania. Robisz to przez wcięcie. Zadanie z podzadaniami staje się automatycznie **zadaniem sumarycznym**. Aplikacja wyznacza jego pasek i czas trwania z zadań pod nim. Dlatego nigdy nie wpisuj czasu trwania zadania sumarycznego sam.

Praktyczna reguła dla szczegółowości: **zadanie trwa mniej więcej od jednego dnia do dwóch tygodni**. Krótsze niż jeden dzień oznacza, że planujesz plac budowy zamiast projektu. To należy do tygodniowego planu kierownika budowy, a nie do modelu obliczeniowego, który ma działać przez miesiące. Dłuższe niż dwa tygodnie oznacza zadanie, którego nie da się dobrze oszacować ani śledzić w trakcie realizacji: „wykończenie parteru, 40 dni, 45% ukończenia” nie mówi nikomu, czy wszystko idzie dobrze. Przeglądy harmonogramu dlatego często liczą, ile zadań trwa dłużej niż około dwóch miesięcy. Powyżej kilku procent uznaje się to za brak szczegółowości.

Zbyt drobno szkodzi tak samo jak zbyt grubo. Każde zadanie kosztuje utrzymanie: relacje do narysowania, postęp do zapisania, nową ocenę po każdej zmianie. Harmonogram z dwoma tysiącami zadań na projekt sześciomiesięczny nie staje się dokładniejszy. Staje się nieutrzymywany. Harmonogram, którego nikt nie aktualizuje, jest fikcją po trzech tygodniach. Wybierz poziom, na którym możesz rzetelnie raportować postęp, każdego tygodnia.

W praktyce: „3. Finishing” to faza, „Finishing house 4” to pakiet robót, „Plastering house 4 ground floor” to zadanie w dniach trwające pięć dni. Górną granicę możesz świadomie przekroczyć przy czasach dostaw i nadzoru. Dostawa stolarki okiennej w czasie dziesięciu tygodni to naprawdę jeden niepodzielny blok oczekiwania. Ciągły nadzór pasuje do hamaka, a nie do serii sztucznych kawałków.

### Szacowanie czasu trwania

Czas trwania to szacunek, jak długo trwa praca, a nie jak szybko mogłaby przebiegać. Szacuj dla zwykłego dnia z ekipą, którą naprawdę dostaniesz. Nie szacuj dla najlepszego dnia z najlepszą ekipą. Optymizm kumuluje się wzdłuż łańcucha. Harmonogram, w którym każde zadanie zakłada najlepszy dzień, prawie nigdy nie trafia w datę przekazania.

Dni czy godziny to prawdziwy wybór, nie formatowanie. Wybierz **dni** dla pracy, która wyznacza tempo na budowie: murowanie, tynkowanie, układanie płytek. Trwa pięć dni, niezależnie od tego, czy dzień ma osiem, czy dziewięć godzin. Wybierz **godziny**, gdy same godziny są jednostką, a reszta dnia ma znaczenie: trzygodzinna inspekcja, czternastogodzinne wylewanie betonu rozłożone na dwa dni, praca na zmiany. Aplikacja zapisuje ten wybór dla każdego zadania. Ten wybór pojawia się dopiero wtedy, gdy najpierw włączysz *Włącz planowanie godzinowe*; zobacz [Dni i godziny](docs://uitleg-dagen-en-uren).

Nie ukrywaj ryzyka w pojedynczych czasach trwania. Dodanie dnia wszędzie chowa zapas tak, że nikt już go nie widzi ani nim nie steruje. A tam, gdzie zapas był naprawdę potrzebny, okazuje się za mały. Pokaż zapas: wyraźne zadanie buforowe przed datą przekazania albo osobny zapas na pogodę. Uważaj na podwójne liczenie. Około 180 dni roboczych w roku, z którymi liczy się holenderskie budownictwo, to umowna roczna wartość (UAV). Od niej odjęto już święta ustawowe, urlop budowlany *i* dni stracone. Jeśli święta i urlop budowlany są już w kalendarzu projektu, zostaje tylko przestój przez pogodę jako osobna pozycja. Przestoje przez mróz i sztorm podlegają własnym zasadom w układzie zbiorowym Onwerkbaar weer Bouw & Infra. Wpisz przewidziane dni stracone do kalendarza albo do osobnej pozycji. Nie ukrywaj ich w czasie trwania murowania.

### Relacje: bez sieci to nie harmonogram

Aplikacja oblicza daty wzdłuż **relacji**. Zadanie zaczyna się dopiero wtedy, gdy na to pozwalają jego poprzedniki. Zadanie bez relacji nie jest z niczym związane. Jeśli roboty konstrukcyjne opóźnią się o dwa tygodnie, odłączone zadanie wykończeniowe za nimi nie pójdzie. Harmonogram wprowadza wtedy w błąd, a nic nie zmienia koloru na czerwony.

Dlatego każde zadanie ma co najmniej jednego poprzednika i co najmniej jednego następnika. Zwolnione są tylko pierwsze zadanie projektu i ostatni kamień milowy. Przy przeglądzie harmonogramu to pierwsza kontrola: brakującą logikę może mieć najwyżej kilka procent zadań.

**Zakończenie-rozpoczęcie jest domyślnym typem**, i tak powinno zostać: najpierw ukończony fundament, potem roboty konstrukcyjne. W zdrowym harmonogramie budowy około dziewięciu na dziesięć relacji to zakończenie-rozpoczęcie. To wymóg czytelności. Zakończenie-rozpoczęcie to jedyny typ, który każdy na budowie rozumie bez wyjaśnień, i w realizacji zachowuje się przewidywalnie.

**Rozpoczęcie-rozpoczęcie z opóźnieniem** służy do pracy, która naprawdę przebiega równolegle, zamiast czekać. Klasyczny przypadek to szereg domów albo wieża z kondygnacjami: instalator idzie trzy dni za murarzami. To jest rozpoczęcie-rozpoczęcie z opóźnieniem trzech dni, a nie zakończenie-rozpoczęcie na sztucznie pocięte zadanie. Dodaj obok zakończenie-zakończenie. Inaczej następnik mógłby w teorii zakończyć się przed poprzednikiem. W budownictwie prawie nigdy nie używa się rozpoczęcie-zakończenie.

Narysuj tę relację rozpoczęcie-rozpoczęcie najlepiej między zadaniami, nie między fazami. Jeśli poprzednikiem relacji rozpoczęcie-rozpoczęcie lub rozpoczęcie-zakończenie jest faza, aplikacja każe następnikowi czekać na to zadanie w fazie, które **zaczyna się ostatnie**, a nie na pierwsze. Dzięki temu nigdy nie planuje za wcześnie, ale czasem później, niż zamierzałeś. Zakończenie-rozpoczęcie i zakończenie-zakończenie z fazą jako poprzednikiem czekają na zakończenie ostatniego zadania w niej. Zwykle dokładnie tego chcesz.

Stosuj opóźnienia oszczędnie, a szczególnie ujemne. Opóźnienie to czas oczekiwania bez widocznego powodu: nikt później nie odgadnie, dlaczego między nimi jest siedem dni opóźnienia. Jeśli chodzi o dojrzewanie betonu, zapisz je jako opóźnienie w dniach kalendarzowych (beton dojrzewa też w weekend). Lepiej jeszcze: prawdziwe zadanie „curing”, które każdy może zobaczyć i śledzić. Ujemne opóźnienie, czyli wyprzedzenie lub nakładanie, w ogóle nie powinno się tam znaleźć. Przy przeglądzie harmonogramu norma to zero. Jeśli chcesz nakładania, podziel poprzednika albo użyj rozpoczęcie-rozpoczęcie.

### Ograniczenia i stałe daty: jak najmniej

Każde zadanie zaczyna jako „jak najwcześniej” i w zdecydowanej większości przypadków tak powinno zostać. **Ograniczenie** to limit daty obok relacji. Im więcej dodasz, tym mniej harmonogram się oblicza i tym bardziej staje się rysunkiem. Plan pełen stałych dat wygląda stabilnie i właśnie dlatego ukrywa ryzyko. Nic się w nim nie przesuwa, więc nic nie ostrzega.

Stosuj ograniczenie tylko przy twardej, zewnętrznej dacie, na którą sam harmonogram nie ma wpływu: pozwolenie, które nie będzie ostateczne przed 1 marca (*rozpocznij nie wcześniej niż*), okno wyłączenia drogi, które nadała gmina, termin przyłączenia od dostawcy mediów. „Chcę to zadanie w maju” nie jest zewnętrznym faktem. Rozwiązujesz to logiką albo innym czasem trwania. Jako orientacyjna reguła: najwyżej kilka procent pozostałych zadań ma twardą granicę daty.

Nigdy nie wpisuj daty startu, żeby zadanie zostało ustalone. Dla zadania z poprzednikiem aplikacja zamienia wpisany (albo przeciągnięty) start w ograniczenie *Rozpocznij nie wcześniej niż (SNET)*. Zadanie stoi wtedy tam, gdzie chcesz, i zostaje tam, nawet gdy cały łańcuch przed nim się opóźni.

Jeśli chcesz pilnować daty, nie sterując obliczeniem, użyj **terminu ostatecznego**. Nic nie przesuwa, ale daje ujemny zapas i ostrzeżenie, gdy zadanie przestaje spełniać termin. Dokładnie taki sygnał chcesz widzieć. Zachowaj twarde przypięcie (*Obowiązkowe (twarde przypięcie)*) na skrajny przypadek. Wiedz wtedy, że łańcuch przed nim dostaje ujemny zapas. To znaczy, że harmonogram mówi: to się nie mieści. Nie znaczy to, że coś jest zepsute.

### Kalendarze: najpierw projekt, potem wyjątki

Wszystkie czasy trwania liczą się w dniach roboczych lub godzinach pracy kalendarza. Dlatego ustaw kalendarz projektu porządnie, zanim wpiszesz czasy trwania: dni robocze, godziny pracy, święta ustawowe i urlop budowlany. Kalendarz, który poprawisz w połowie, przesunie cały harmonogram. Dodaj od razu przewidywalne wyłączenia: czas mrozów, w którym nie wylewasz betonu, oraz zamknięcie firmy między Bożym Narodzeniem a Nowym Rokiem.

Daj zasobowi własny kalendarz tylko wtedy, gdy naprawdę się różni. Na przykład monter fasad, który przychodzi cztery dni w tygodniu, albo ekipa, która ma inny urlop letni. Kalendarz zasobu nie zmienia ani jednej daty zadania. Zadanie dalej liczy się w kalendarzu zadania lub projektu. Kalendarz zasobu pokazuje tylko, że zasób nie pracuje w jednym z dni roboczych zadania. W histogramie widać to jako przeciążenie. Tę różnicę trudno zauważyć, jeśli nie wiesz, że sam ją utworzyłeś.

### Zasoby: kto to robi i czy to możliwe

Harmonogram bez zasobów odpowiada tylko na połowę pytania. Gdy przypiszesz ekipy i sprzęt, histogram pokaże to, czego sama oś czasu nie pokaże: że 14 czerwca potrzebujesz trzech ekip tynkarskich, a masz dwie.

Zacznij od zasobów, które najbardziej ograniczają. Nie każda śruba musi się tam znaleźć. Ale żuraw wieżowy, własne ekipy, podwykonawcy z górnym limitem zdolności i długie czasy dostaw muszą. Każdemu zasobowi podaj uczciwą zdolność. Dwóch tynkarzy oznacza dwóch, a nie „dwóch, ale w razie potrzeby trzech”.

Czytaj histogram jako pytanie, nie jako błąd. Czerwony słupek ponad linią oznacza, że harmonogram chce więcej, niż masz tego dnia. Czasem odpowiedź brzmi: przesuń. Często brzmi: to się nie uda, i właśnie to chciałeś wiedzieć. **Bilansowanie** przesuwa zadania, aż zapotrzebowanie zmieści się w zdolności. Jeśli data zakończenia może się przesunąć, pozwól na to. Jeśli data przekazania jest stała, bilansuj tylko w ramach zapasu (pole wyboru *Bilansuj tylko w ramach zapasu (wygładzanie) — data zakończenia projektu pozostaje bez zmian*). Data zakończenia zostaje wtedy na miejscu, a aplikacja zgłasza ci pozostały konflikt. To uczciwszy wynik niż harmonogram, który tylko wygląda na rozwiązany.

*Nie* bilansuj, gdy zapotrzebowanie jest strukturalnie większe niż zdolność. Bilansowanie przestawia istniejącą pracę w czasie. Nie zatrudnia dodatkowych tynkarzy ani nie buduje drugiego żurawia. Trzy wieże, które w tym samym czasie potrzebują tej samej ekipy, nadal potrzebują tej samej ekipy po bilansowaniu. Zmienia się tylko to, że przekazanie się przesuwa. Pomaga wtedy etapowanie, dodatkowa zdolność albo inna praca. Nie bilansuj też przed ustawieniem logiki i czasów trwania: bilansowałbyś harmonogram, który jutro będzie inny.

### Ścieżka krytyczna i zapas: gdzie harmonogram jest wrażliwy

Aplikacja nie przelicza przy każdej zmianie. Oblicz poleceniem **Oblicz** (F5) i dopiero potem czytaj wynik. Jeśli pasek stanu pokazuje *Nieaktualne — przelicz (F5)*, patrzysz na poprzednie obliczenie, nie na obecne. Przy ustawieniu *Oblicz automatycznie* aplikacja robi to sama.

**Ścieżka krytyczna** to łańcuch bez zapasu: każdy dzień straty tam to o dzień późniejsze przekazanie. Tam trafia Twój nadzór i najlepsi ludzie. Nie patrz tylko na czerwone. **Zapas całkowity** mówi, o ile zadanie może się spóźnić, nie wpływając na przekazanie. **Zapas swobodny** mówi, o ile może się spóźnić, nie przesuwając następnika. Różnica nikomu nie zmienia daty zakończenia, ale przeszkadza. Jest przydatna, gdy pracujesz z podwykonawcami, których nie możesz dwa razy przesuwać w czasie.

Zwróć uwagę na trzy sygnały. Zadanie z kilkoma dniami zapasu nie jest bezpieczne, lecz prawie krytyczne. Przy *Oznaczaj jako prawie krytyczne* takie zadania dostają własny kolor. Zadanie z bardzo dużym zapasem — w przeglądach harmonogramu więcej niż 44 dni robocze, czyli około dwóch miesięcy — prawie zawsze nie ma następnika. Wskazuje to od razu luki w Twojej sieci relacji. Ujemny zapas nigdy nie jest błędem obliczenia. Harmonogram mówi, że termin ostateczny albo stała data się nie mieści.

### Plan bazowy przed rozpoczęciem, potem aktualizacja

Zapisz **plan bazowy** zaraz po zatwierdzeniu harmonogramu, zanim pierwsza łopata wejdzie w ziemię (*Planowanie › Plan bazowy i postęp › Zarządzaj planem bazowym…*). Najpierw oblicz: plan bazowy zapisuje daty z ostatniego obliczenia. Bez tego odniesienia możesz później powiedzieć tylko, *że* sprawy idą inaczej, nie o ile ani od kiedy. A dokładnie tego potrzebujesz na naradzie budowy, przy robotach dodatkowych i wtedy, gdy rozmawia się o tym, że coś się opóźnia.

Plan bazowy zapisuje daty, ale nie założenia, które za nimi stoją. A właśnie o nie pyta się, gdy tylko mowa o tym, że coś się opóźnia. Zapisując plan bazowy, krótko napisz, na czym harmonogram się opiera (w praktyce planowania: *podstawa harmonogramu*). Podaj, jakich wydajności użyto. Podaj, jaki kalendarz i dlaczego jest tak ustawiony. Podaj, co świadomie pominięto w harmonogramie. Podaj, kto dostarczył przyjęte czasy dostaw, i kto zatwierdził harmonogram. Wystarczy pół strony.

Potem aktualizacja to rytm, nie projekt. Aktualizuj co tydzień, w tej samej kolejności: ustaw **datę statusu** na datę raportowania, wpisz rzeczywiste rozpoczęcie i rzeczywiste zakończenie tego, co się zaczęło i skończyło, popraw pozostały czas trwania tego, co trwa, i oblicz. Sam procent nie wystarczy. Rzeczywiste daty to zapis faktów, do którego później się zajrzy.

Wiedz, co robi data statusu. Praca, która jeszcze się nie zaczęła, zostaje przez aplikację przesunięta na datę statusu. Zadania po niej przesuwają się razem z nią (z wyjątkiem profilu obliczeń Microsoft Project). Jeśli zapomnisz zapisać zakończenie zadania lub kamienia milowego, przesunie się ono samo w prawo. To nie jest usterka. Model nie udaje, że coś w przeszłości może jeszcze się zdarzyć. Gdy dostaniesz ostrzeżenie *Poza kolejnością*, prace wykonano w innej kolejności, niż nakazuje logika. Zwykle jest to powód, by zrewidować kolejność, a nie by ostrzeżenie kliknąć i zamknąć. Nowy plan bazowy twórz tylko przy prawdziwej zmianie zakresu. Zapisz go obok pierwszego, a nie na jego miejsce.

Na koniec: harmonogram jest wiarygodny tylko wtedy, gdy ludzie wykonujący pracę mu wierzą. Niech kierownik budowy i podwykonawcy porównują tygodniowy plan z tym modelem. Jeśli tydzień po tygodniu realizujesz tylko połowę tego, co uzgodniono, problem częściej leży w harmonogramie niż w wykonaniu.

## Przykład: trzy wybory, które po cichu okłamują harmonogram

Liczby pochodzą z dwóch przykładów opracowanych gdzie indziej w Pomocy: ćwiczeniowego projektu *House extension* z samouczków oraz małej sieci dla rozbudowy domu. Tu chodzi o to, co każdy wybór robi z Twoim harmonogramem. Sam wypróbujesz to w samouczku 2 (relacje i ścieżka krytyczna) oraz w samouczku 3 (ograniczenie i termin ostateczny).

### Zapomniana relacja

Przy rozbudowie prace zaczynają się w poniedziałek 7 czerwca 2027. Przekazanie jest w piątek 6 sierpnia. *Build outer cavity leaf* (6 dni roboczych) ma jako następnika *Install window frames*, ponieważ ramy okienne znajdują się w elewacji. Przy tej relacji zewnętrzna warstwa muru ma 2 dni robocze zapasu.

Bez tej relacji zewnętrzna warstwa ma nagle 23 dni robocze zapasu, aż do przekazania. Na papierze może się spóźnić o tygodnie, a nikt na to nie czeka. Nic nie zmienia koloru na czerwony i nie pojawia się żadne ostrzeżenie. Tylko z opcją obliczeń *Zadania z otwartym końcem krytyczne* takie zadanie bez następnika staje się krytyczne. Dzięki temu brak się wyróżnia.

### Wpisana data zamiast relacji

Mała sieć: *Groundwork* (3 dni robocze), *Pour foundation* (2), *Brickwork* (5) i *Roofing* (3), jedno po drugim, od poniedziałku 7 czerwca 2027. Projekt jest gotowy w środę 23 czerwca.

Jeśli wpiszesz start na poniedziałek 21 czerwca dla *Brickwork*, bo cegły przyjadą dopiero wtedy, powstaje ograniczenie *Rozpocznij nie wcześniej niż*. Murowanie przesuwa się o tydzień, a projekt jest gotowy w środę 30 czerwca. *Groundwork* i *Pour foundation* dostają 5 dni roboczych zapasu i nie są już krytyczne. Jeśli cegły jednak przyjadą wcześniej, murowanie zostaje na 21 czerwca. Teraz steruje data, a nie logika.

Jeśli zamiast tego wpiszesz środę 9 czerwca, zanim fundament będzie gotowy, nic się nie zmienia. Relacje i tak pozwalają zacząć murowanie dopiero w poniedziałek 14 czerwca.

### Termin ostateczny zamiast ograniczenia

Jeśli chcesz, żeby *Roofing* był zakończony w piątek 18 czerwca, ustaw tam termin ostateczny. Nic się nie przesuwa. *Roofing* zostaje od poniedziałku 21 do środy 23 czerwca. Ale łańcuch ma −3 dni robocze zapasu, a aplikacja zgłasza *Przekroczono termin 18-06-2027 — najwcześniejsze zakończenie 23-06-2027*. Od razu widzisz, że uzgodnienie nie pasuje, zamiast paska na właściwym miejscu, za którym łańcuch tego nie potwierdza.

## Skutki i błędne przekonania

- **Zadania bez poprzednika albo następnika.** Najczęstsze i najbardziej szkodliwe: takie zadania nie przesuwają się razem z resztą i dostają fałszywy zapas.
- **Wpisywanie dat albo przeciąganie pasków zamiast rysowania logiki.** Tak po cichu ustawiasz ograniczenie.
- **Za dużo ograniczeń i twarde przypięcie używane jako zakładka.** Harmonogram wtedy już nie oblicza, tylko rysuje.
- **Zadania trzymiesięczne albo zadania na pół dnia.** Użyteczny zakres to mniej więcej od jednego dnia do dwóch tygodni.
- **Optymistyczne czasy trwania i ukryty margines w każdym zadaniu** zamiast widocznego bufora.
- **Przestoje pogodowe i urlop budowlany nie są w kalendarzu.** I tak w styczniu trafią do niego.
- **Opóźnienia zamiast zadań.** Siedem dni nienazwanego czasu oczekiwania po trzech miesiącach nie da się wyjaśnić.
- **Bilansowanie, zanim logika jest ustalona**, albo dalsze bilansowanie przy strukturalnym niedoborze zdolności.
- **Zapomnienie o obliczeniu.** *Nieaktualne* w pasku stanu oznacza, że widzisz poprzednie obliczenie.
- **Brak planu bazowego albo plan bazowy zapisany dopiero po starcie.**
- **Postęp zapisany tylko jako procent**, bez rzeczywistych dat i bez daty statusu.
- **Zamykanie panelu *Ostrzeżenia* bez czytania.** Tam zbiegają się przekroczone terminy ostateczne, naruszone ograniczenia, relacje poza kolejnością i przeciążone zasoby (*Planowanie › Harmonogram › Ostrzeżenia*).

## Zobacz także

- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak aplikacja oblicza wczesne i późne terminy oraz zapas.
- [Relacje i opóźnienie](docs://uitleg-relaties): cztery rodzaje relacji, opóźnienie oraz relacje na fazie.
- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): co każde ograniczenie i termin ostateczny robi z obliczeniami.
- [Kalendarze i dni robocze](docs://uitleg-kalenders): jak aplikacja liczy dni robocze i który kalendarz ma pierwszeństwo.
- [Dni i godziny](docs://uitleg-dagen-en-uren): planowanie w dniach, w godzinach albo mieszane.
- [Bilansowanie zasobów](docs://uitleg-nivelleren): co bilansowanie przesuwa, a czego nie.
- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): co robi data statusu i jak czytać odchylenie.
- [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen): wpisywanie kamieni milowych i zadań.
- [Dodawanie relacji](docs://howto-relaties-leggen): łączenie zadań ze sobą.
- [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen): asystent, który planuje według tych zasad.
- [Powiadomienia i ostrzeżenia](docs://ref-meldingen): wszystkie ostrzeżenia w jednym miejscu.
