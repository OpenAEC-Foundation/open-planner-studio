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
- Przełączniki dla **nazw zadań na paskach**, **pokaż postęp**, **ścieżki krytycznej**, **pokaż zapas**,
  **zależności**, **weekendów** i **legendy**.
- Pole **firma** (wypełnia się automatycznie z ustawienia projektu, ale można je tu osobno edytować) i
  **autor** (tylko do odczytu, z informacji o projekcie).

Blok podsumowania powyżej pokazuje na żywo liczbę zadań, zadań końcowych, zadań krytycznych i relacji
w projekcie.

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
łacińskiego, cyrylicy i greckiego; jeśli projekt zawiera tekst chiński, japoński, koreański, arabski lub perski,
eksport automatycznie przełącza się na obraz rastrowy dla tego tekstu — wciąż poprawnie wyświetlany,
ale niezaznaczalny ani nieprzeszukiwalny. Przydatne do wysyłki e-mailem lub archiwizacji bez przechodzenia przez systemowe
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
