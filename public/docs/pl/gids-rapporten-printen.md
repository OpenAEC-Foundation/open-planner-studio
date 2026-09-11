# Raporty i drukowanie

Harmonogram nie jest gotowy, dopóki nie można się nim podzielić — na papierze na spotkaniu na budowie,
jako obraz w prezentacji, albo jako przegląd tego, co nadchodzi i co się już przesunęło. Do tego służy
karta **Raport**, z trzema typami raportów i podglądem wydruku.

## Czego się tu nauczysz

- Trzech typów raportów na karcie **Raport**: wydruk Gantta, przegląd punktów kontrolnych, variance.
- Jak działa podgląd wydruku: rozmiar papieru, orientacja i które elementy włączasz/wyłączasz.
- Jak faktycznie wydrukować raport albo zapisać go jako plik.
- Co robi **Ctrl+P** w tej aplikacji.

## Dotarcie do ekranu raportu

Istnieją trzy drogi do tego samego ekranu: kliknij kartę wstążki **Raport**, przejdź do
**Backstage → Drukuj** (co otwiera ekran raportu bezpośrednio), albo naciśnij **Ctrl+P**. Wszystkie trzy prowadzą
w to samo miejsce — nie ma osobnego okna dialogowego „drukuj"; ekran raportu *jest* podglądem wydruku.

Ekran jest podzielony na dwie kolumny: panel ustawień po lewej z selektorem **Typu raportu**
na górze oraz podgląd na żywo po prawej, który aktualizuje się natychmiast wraz ze zmianą ustawień po
lewej.

## Trzy typy raportów

### Wykres Gantta

Pełny, sformatowany wydruk pasków Gantta — to jedyny typ raportu z blokiem ustawień:

- **Papier**: A4, A3 lub A1.
- **Orientacja**: poziomo lub pionowo.
- **Dopasuj do papieru** (włączone = harmonogram skaluje się automatycznie do wybranego rozmiaru) albo ręczny
  suwak **powiększenia**, jeśli wyłączysz dopasowanie automatyczne.
- **Rozmiar czcionki** — 90, 100, 110 lub 125%; skaluje tekst raportu, wysokość wiersza oraz nagłówek/stopkę,
  niezależnie od poziomu powiększenia powyżej.
- **Powtarzaj nagłówek na każdej stronie** — domyślnie włączone; utrzymuje nagłówek raportu widoczny na każdej wydrukowanej
  stronie, a nie tylko na pierwszej.
- **Oś czasu na** — rozkłada oś czasu Gantta obok siebie na od 1 do 8 stron; dostępne tylko
  przy włączonym dopasowaniu automatycznym.
- Przełączniki dla **nazw zadań na paskach**, **pokaż postęp**, **ścieżki krytycznej**, **pokaż zapas**,
  **zależności**, **weekendów** i **legendy**.
- Pole **firma** (wypełnia się automatycznie z ustawienia projektu, ale można je tu osobno edytować) i
  **autor** (tylko do odczytu, z informacji o projekcie).

Linie relacji w raporcie używają tego samego języka wizualnego co widok Gantta: linia **ciągła**
oznacza relację wiodącą, linia **przerywana** — niewiodącą, a relacja wiodąca między dwoma
zadaniami krytycznymi jest **czerwona**. Wyłącz *ścieżkę krytyczną*, a te linie też staną się neutralne.
Legenda na dole podsumowuje tę różnicę. Przed pierwszym obliczeniem każda linia jest rysowana neutralnie
i w sposób ciągły — najpierw naciśnij *Oblicz* (F5).

Blok podsumowania powyżej pokazuje na żywo liczbę zadań, zadań końcowych, zadań krytycznych i relacji
w projekcie. Panel ustawień pamięta Twoje wybory między sesjami — otwórz kartę Raport ponownie
później, a rozmiar papieru, przełączniki, rozmiar czcionki i reszta wracają dokładnie takie, jak je
zostawiłeś. Resetuje się tylko pole firmy: zawsze zaczyna od własnego ustawienia projektu, więc raport
nigdy nie przenosi nazwy firmy z innego projektu.

### Przegląd punktów kontrolnych

Tabela każdego kamienia milowego w projekcie: WBS, nazwa, rodzaj (automatycznie/start/koniec), data,
leżące u podstaw ograniczenie lub termin ostateczny, zapas, czy kamień milowy jest obowiązkowy, oraz stan (zgodnie z
planem / krytyczny / opóźniony). Blok podsumowania pokazuje łączną liczbę kamieni milowych, ile jest
obowiązkowych i ile jest opóźnionych. Ten raport nie ma ustawień rozmiaru papieru/orientacji — drukuje
tabelę dokładnie tak, jak jest pokazana.

### Variance

Porównuje bieżący harmonogram z aktywną baseline: początek/koniec baseline w porównaniu z bieżącym
początkiem/końcem, różnicę w dniach roboczych dla początku i końca oraz stan dla każdego zadania (zgodnie z
planem / opóźniony / wcześniej / nowy / usunięty). Jeśli nie ma aktywnej baseline, ekran wprost to
zaznacza, zamiast pokazywać pusty raport. Blok podsumowania pokazuje też przesunięcie daty
zakończenia projektu w dniach roboczych, jeśli takie istnieje. Zobacz przewodnik
[Baseline i postęp](docs://gids-baselines-voortgang), aby dowiedzieć się, jak zarejestrować baseline, zanim ten
raport będzie mógł powiedzieć Ci coś użytecznego.

## Siedem raportów tabelarycznych

Pozostałe typy raportów to tabele pobierane wprost z ostatniego obliczenia. Łączy je kilka zasad:
tylko **zadania liściowe** liczą się jako czynności (zadania sumaryczne pojawiają się wyłącznie w
podsumowaniu WBS, zadania hamakowe wcale); **dzień odniesienia** to data statusu projektu — bez daty
statusu raport przyjmuje dzisiaj i o tym informuje; daty i zapasy pochodzą z ostatniego
**obliczenia** (F5), zmieniony od tego czasu harmonogram sygnalizuje notatka, a eksport PDF zawsze
najpierw przelicza; każdy raport ma mały blok **Opcje raportu**, zapamiętywany między sesjami. Dni
robocze skracane są do *dr*.

### Prognoza (look-ahead)

Lista na cotygodniową naradę budowy: wszystkie czynności najbliższych *N* tygodni (domyślnie
czterech) — co się zaczyna, trwa lub kończy — plus to, co już powinno było się wydarzyć. W wierszu:
WBS, nazwa, start i koniec, pozostały czas, ukończenie, zapas całkowity, krytyczne lub prawie
krytyczne, przydzielone zasoby i status: **Rozpoczyna się**, **W toku**, **Powinno się rozpocząć**
lub **Zaległe**. Czynność obejmująca całe okno również się pojawia.

### Krytyczne i prawie krytyczne

Które czynności wyznaczają koniec projektu, a które są tego bliskie. Krytyczność pochodzi z
obliczenia; *prawie krytyczne* to zapas całkowity od 0 do progu z opcji (domyślnie 5 dni roboczych)
lub oznaczenie z opcji harmonogramowania. Zadania ukończone są pomijane. Sortowanie według ścieżki
zapasu, potem zapasu, potem startu; z zapasem swobodnym i numerem ścieżki.

### Raport postępu

Okresowy przegląd „gdzie jesteśmy” na datę statusu. Podsumowanie podaje koniec bazowy i
prognozowany z różnicą w dniach roboczych, postęp **planowany** wobec **rzeczywistego** (oba ważone
czasem trwania zadań liściowych; planowany na datach aktywnego planu bazowego, w przeciwnym razie na
bieżącym harmonogramie) oraz liczby według stanu. Poniżej pięć sekcji: ukończone w minionym okresie,
w toku, rozpoczynające się w następnym okresie, zaległe i otwarte czynności krytyczne. Okres
(domyślnie dwa tygodnie) sięga tak samo wstecz, jak w przód.

### Kondycja harmonogramu

Automatyczny przegląd harmonogramu w duchu 14-punktowej oceny DCMA. Każda kontrola otrzymuje wagę i
liczbę, a pod spodem ustalenia dla zadań lub relacji: **błędy** (ujemny zapas, niedotrzymany termin,
naruszone ograniczenie, niespójny postęp), **ostrzeżenia** (otwarty początek lub koniec, długi czas
trwania, wyprzedzenia, twarde ograniczenia, postęp poza kolejnością) i **informacje** (prawie
krytyczne, duży zapas, długie zwłoki). Progi są w opcjach; domyślnie według DCMA: 44 dni robocze
dla dużego zapasu i długiego czasu trwania, 10 dla zwłok. Czysty harmonogram ma zero błędów.

### Obciążenie zasobów tygodniowo

Dla zasobu i tygodnia zapotrzebowanie wobec dostępnej zdolności (w jednostko-dniach), różnica,
dzienny szczyt i czy tydzień jest przeciążony — to samo obliczenie co histogram na karcie **Zasoby**,
w postaci tabeli. Pokazywane są tylko tygodnie z zapotrzebowaniem; opcja *Tylko przeciążone
tygodnie* zostawia same wąskie gardła.

### Przydziały zasobów

Dla zasobu przydzielone czynności: WBS, nazwa, start i koniec, pozostały czas, jednostki na dzień,
ukończenie, krytyczność i status. Ukończone zadania są domyślnie pomijane. Z oknem w tygodniach
staje się to *prognozą zasobów*. Podsumowanie liczy też zadania bez zasobu.

### Podsumowanie WBS

Harmonogram zwinięty według elementów WBS do wybranego poziomu — widok dla kierownictwa. Dla
elementu: start i koniec, start i koniec bazowy, czas trwania, postęp ważony czasem trwania, różnica
końca względem planu bazowego, najmniejszy zapas całkowity i liczba czynności, w tym krytycznych, w
toku i ukończonych. Wybierz poziom (domyślnie 2) lub pełny WBS, opcjonalnie z samymi czynnościami.

## Drukowanie i eksportowanie

Panel ustawień zawsze ma na dole przycisk **Drukuj...** — otwiera on osobne okno druku
zawierające raport i od razu wywołuje okno dialogowe drukowania przeglądarki/systemu operacyjnego. Dla raportu Gantta
to okno wykorzystuje wybrany rozmiar papieru i orientację; raporty punktów kontrolnych i variance drukują
tabelę tak, jak jest wyświetlana.

Tylko raport Gantta ma też przycisk **Eksportuj PDF**. Zapisuje on bieżący podgląd jako
rzeczywisty plik PDF (nazwa pliku kończąca się na `-planning.pdf`) — jedną stronę o wymiarach dopasowanych do fizycznych wymiarów
wybranego rozmiaru papieru i orientacji. Plik PDF jest **wektorowy**: paski, linie i tekst
są zapisane jako instrukcje rysowania PDF, a nie jako pojedynczy osadzony obraz, więc pozostaje ostry
przy dowolnym poziomie powiększenia, a tekst jest zaznaczalny i przeszukiwalny w każdej przeglądarce PDF. Dotyczy to tekstu
łacińskiego, cyrylicy, greckiego, arabskiego i perskiego — tekst arabski i perski jest kształtowany i osadzany jako tekst
wektorowy tak samo. Tekst chiński, japoński i koreański jest opcjonalny: zainstaluj rozszerzenie z czcionką,
które dostarcza te glify, a on również zostanie osadzony jako wektor (zaznaczalny i przeszukiwalny); bez takiego
rozszerzenia ten tekst jest eksportowany jako obraz rastrowy — nadal poprawnie wyświetlany, ale niezaznaczalny
ani nieprzeszukiwalny. Przydatne do wysyłki e-mailem lub archiwizacji bez przechodzenia przez systemowe
okno dialogowe druku. Jeśli wolisz drukować bezpośrednio (albo zapisać do PDF przez okno systemowe, np. aby wybrać
inny rozmiar papieru niż skonfigurowany powyżej), użyj **Drukuj...**.

## Raporty w praktyce

Każdy typ raportu służy innej rozmowie:

- **Raport Gantta** to klasyczny materiał na spotkanie na budowie: podświetlona ścieżka krytyczna, widoczny
  zapas na paskach niekrytycznych i legenda wyjaśniająca, co oznacza każdy kolor. Włącz
  **nazwy zadań na paskach** i **pokaż postęp**, jeśli odbiorcy nie znają jeszcze harmonogramu;
  wyłącz je dla czystego przeglądu na A1, jeśli obok wydawana jest osobna lista zadań.
- **Przegląd punktów kontrolnych** jest dla każdego, kto chce tylko ważnych dat bez przeglądania
  dziesiątek wierszy zadań — na przykład klienta, który przede wszystkim chce wiedzieć, czy obowiązkowe daty
  odbioru są dotrzymywane. Symbol ◆ przed nazwą kamienia milowego w tabeli oznacza kamień milowy
  **obowiązkowy**.
- **Raport variance** to rozmowa o korygowaniu kursu: które zadania się opóźniają
  względem baseline i o ile dni roboczych. Zobacz ten raport w praktyce w przykładzie
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), który ma
  dwie baseline (baseline kontraktową i przeliczoną baseline po zleceniu zmiany) z własnym postępem
  i datą statusu — dobry przykład tego, jak wypełniają się kolumny Δ, gdy pojawia się rzeczywista różnica
  między baseline a bieżącym harmonogramem.

Podgląd na żywo po prawej odświeża się przy każdej zmianie ustawień po lewej — nie ma osobnego przycisku
„odśwież", a nic nie jest obliczane dopiero w momencie druku.

## Dalsza lektura

- Raport variance nie ma z czym porównywać, dopóki nie zarejestrowano baseline — przeczytaj przewodnik
  [Baseline i postęp](docs://gids-baselines-voortgang).
- Ścieżka krytyczna i zapas pokazane w raporcie Gantta pochodzą z tego samego obliczenia co widok
  Gantta — przeczytaj przewodnik [Ścieżka krytyczna i analiza zaawansowana](docs://gids-kritiek-pad-analyse),
  aby dowiedzieć się, jak to odczytać.
