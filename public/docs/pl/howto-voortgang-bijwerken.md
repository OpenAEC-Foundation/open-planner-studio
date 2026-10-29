# Aktualizowanie postępu

Cel: wpisz rzeczywisty stan prac do harmonogramu i przelicz harmonogram: które zadania są ukończone, które trwają i ile pracy jeszcze zostało.

## Kiedy je potrzebujesz

Postęp aktualizujesz w stałych momentach, na przykład co piątek, gdy kierownik budowy zgłasza stan. Dzięki temu harmonogram widzi, co się naprawdę wydarzyło, i wylicza pozostałą pracę od daty statusu. Dlaczego aplikacja działa w ten sposób, wyjaśnia [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).

## Kroki

### 1. Ustaw datę statusu

Data statusu to dzień, w którym robisz podsumowanie. Ustaw ją, zanim wpiszesz postęp.

1. Przejdź do *Planowanie › Plan bazowy i postęp › Data statusu*.
2. Wpisz datę w trzech polach dnia, miesiąca i roku (w kolejności, jaką używasz w zapisie dat), na przykład 28, 06 i 2027, i naciśnij Enter. Aplikacja sama przechodzi do następnego pola.
3. Czy kalendarz projektu ma pasma czasu pracy (*Godziny pracy* w oknie *Kalendarze*)? Wtedy aplikacja liczy w godzinach i po prawej stronie pokazuje się pole czasu, na przykład 17:00. Wpisz inny czas, na przykład 12:00, i naciśnij Enter. Jeśli opróżnisz pole czasu, zostaje tylko data. Jeśli zmienisz tylko datę, czas zostaje. Godzina zależy od Twojego zapisu czasu (24- lub 12-godzinnego). Bez pasm czasu pracy aplikacja liczy w pełnych dniach: wtedy nie ma pola czasu, a linia daty statusu stoi na początku dnia.
4. Małym krzyżykiem obok pola opróżniasz datę statusu.

Jeśli robisz podsumowanie w piątek po godzinach pracy, ustaw datę statusu na następny dzień roboczy, poniedziałek. Aplikacja planuje pozostałą pracę od początku daty statusu.

Jeśli wpiszesz postęp, zanim jest jakakolwiek data statusu, aplikacja ustawi ją na dziś i pokaże komunikat: *Datę statusu ustawiono na dziś (…).* Lepiej więc najpierw ustaw ją samodzielnie.

### 2. Wpisz postęp

Wybierz sposób, który pasuje do Twojej sytuacji. Wszystkie dają ten sam wynik.

**Jedno zadanie w panelu właściwości.** Przydatne, gdy aktualizujesz pojedyncze zadanie.

1. Kliknij zadanie. Jeśli nie widzisz panelu *Właściwości*, włącz go w *Widok › Panele › Właściwości*.
2. Przeciągnij suwak *Postęp (%)* na wykonany procent.
3. W razie potrzeby wpisz *Rzeczywiste rozpoczęcie* i *Rzeczywiste zakończenie* tak samo jak datę statusu. Aplikacja sama oblicza pole *Pozostało*; tutaj nie możesz go zmienić.

Kamień milowy ma jedno pole: *Rzeczywista data*.

**Wybór procentu z menu.** Przydatne do szybkiego ustawienia stanu.

1. Kliknij prawym przyciskiem pasek zadania na wykresie Gantt.
2. Wybierz *Postęp*, a potem 0%, 25%, 50%, 75% albo 100%.

**Kilka zadań w tabeli.** Przydatne, gdy aktualizujesz całą listę.

1. Kliknij **+** z prawej strony nagłówka tabeli zadań (*Dodaj kolumnę*) i otwórz kategorię *Postęp*. Dodaj kolumny *Rzeczywiste rozpoczęcie*, *Rzeczywiste zakończenie*, *Pozostało* i *Stan*. Kolumna *Postęp* jest już na karcie *Tabela*.
2. Dwukrotnie kliknij komórkę, wpisz wartość i naciśnij Enter. Procent wpisujesz jako `50` albo `50%`, datę jako `25-06-2027`, pozostały czas trwania jako `1`.
3. W kolumnie *Stan* kliknij dwukrotnie, naciśnij Enter i wybierz *Nierozpoczęte*, *W toku* albo *Ukończone*.

Jeśli wpiszesz pozostały czas trwania, aplikacja wylicza z tego procent: przy zadaniu trwającym 2 dni robocze pozostałość 1 daje procent 50. Pozostałość 0 kończy zadanie. Kolumna *Rzeczywisty czas trwania* (także w kategorii *Postęp*) działa odwrotnie: wpisz, ile pracy jest już wykonane, a aplikacja oblicza procent. Przy zadaniu trwającym 4 dni robocze rzeczywisty czas trwania 1 daje 25%. Jeśli wybierzesz *Nierozpoczęte* w kolumnie *Stan*, procent spada do 0, a daty rzeczywiste znikają.

**Wszystko o jednym zadaniu w oknie edycji zadania.** Kliknij prawym przyciskiem zadanie i wybierz *Edytuj...*. Pola postępu są tam także. Zaczynają obowiązywać dopiero po kliknięciu *Zapisz*.

**Wiele zadań naraz z arkusza kalkulacyjnego.** Zobacz [Importowanie postępu z arkusza kalkulacyjnego](docs://howto-voortgang-importeren).

### 3. Przelicz harmonogram

Każda zmiana postępu lub daty statusu sprawia, że harmonogram jest nieaktualny: pasek stanu pokazuje *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Planowanie › Harmonogram › Oblicz*. Jeśli opcja *Oblicz automatycznie* jest włączona (w *Ustawienia › Projekt › Ustawienia aplikacji*, na karcie *Planowanie*), aplikacja robi to sama.

## Sprawdzenie wyniku

- W dacie statusu wykres Gantt pokazuje przerywaną linię z datą w nagłówku. Przy zadaniach w toku linia wybrzusza się do procentu na pasku. Włączasz je lub wyłączasz w *Widok › Plan bazowy i postęp › Linia postępu* oraz *Linia daty statusu*.
- Ukończona część paska staje się szara; reszta zachowuje swój kolor. Zadanie w pełni ukończone jest całkowicie szare, z ptaszkiem przed nazwą i bez obszaru zapasu. Pasek fazy także szarzeje do wyliczonego procentu, więc widzisz dla każdej fazy, jak bardzo jest ukończona. Jeśli pokazujesz poprzedników lub następników zadania, te paski zachowują kolor wyróżnienia, także wtedy, gdy są ukończone.
- Ukończone zadania nigdy nie są czerwone: przy dacie statusu ukończone zadanie nie jest krytyczne.
- Fazy pokazują wyliczony procent, a zakończenie harmonogramu mogło się przesunąć.
- Jeśli zapisałeś plan bazowy, pod każdym paskiem widać pierwotny harmonogram, a typ raportu *Variance* pokazuje odchylenie.

## Pułapki i co robi aplikacja

**Data po dacie statusu.** Aplikacja nie przyjmuje rzeczywistego rozpoczęcia ani rzeczywistego zakończenia po dacie statusu. W panelu pod polami pojawia się komunikat *Rzeczywiste daty nie mogą wypadać po dacie statusu*; w tabeli komórka pokazuje *Data rzeczywista przypada po dacie stanu.* Najpierw ustaw późniejszą datę statusu albo popraw datę.

**Zadanie, które według harmonogramu zacząłoby się dopiero po dacie statusu.** Jeśli wpiszesz postęp dla zadania, które według harmonogramu jeszcze by się nie zaczęło, otwiera się okno *Podaj rzeczywiste rozpoczęcie*. Pyta, kiedy zadanie faktycznie się zaczęło; propozycją jest data statusu. Przyciskiem *Zastosuj postęp* zapisujesz ją, przyciskiem *Anuluj* nic się nie zmienia.

**100% bez dat.** Jeśli ustawisz zadanie na 100% bez rzeczywistego zakończenia, rzeczywiste zakończenie stanie się datą statusu, także gdy zadanie zostało skończone wcześniej. Wtedy wpisz rzeczywiste zakończenie samodzielnie.

**Procent poniżej 100%.** Jeśli ukończone zadanie cofniesz poniżej 100%, rzeczywiste zakończenie zostaje usunięte. Jeśli usuniesz tylko rzeczywiste zakończenie, procent spada do 0 i zadanie zostaje *W toku*. Jeśli chcesz, żeby zadanie znowu liczyło się jako nierozpoczęte, usuń też rzeczywiste rozpoczęcie albo wybierz w tabeli *Nierozpoczęte* w kolumnie *Stan*.

**Zmiana czasu trwania zadania w toku.** Wykonana praca zostaje, a procent się dostosowuje. Zadanie o 5 dniach roboczych przy 60%, które zmienisz na 10 dni roboczych, wynosi po zmianie 30%. Aplikacja nie przyjmuje czasu trwania krótszego niż już wykonana praca: *„Build inner cavity leaf” jest już wykonane w 60%: czas trwania krótszy niż wykonana praca jest niemożliwy. Czas trwania nie został zmieniony.* W tabeli komórka pokazuje *Ten czas trwania jest krótszy niż już wykonana praca.*

**Pozostały czas trwania jest zaokrąglany.** Aplikacja zaokrągla pozostały czas trwania do pełnych dni roboczych. Przy zadaniu trwającym 2 dni robocze zarówno 50%, jak i 75% dają pozostałość 1 dnia roboczego.

**Faza.** Faza nie ma własnego postępu. W panelu pojawia się komunikat *Wyliczane z podzadań: zmień postęp tam. Zadanie sumaryczne zaktualizuje się po przeliczeniu (F5)*. W tabeli komórka pokazuje *Postęp zadania sumarycznego jest wyliczany z jego podzadań i nie można go tutaj zmienić.*

**Przesunięcie daty statusu na później.** Pozostała praca zadań w toku zaczyna się od nowej daty statusu, a praca, która jeszcze się nie zaczęła, nie może przypadać przed tą datą. Przesuwaj ją więc tylko razem z aktualizacją postępu. Jeśli ustawisz datę statusu bez wpisania postępu, cała praca, która jeszcze się nie zaczęła, przesunie się na tę datę (z wyjątkiem profilu Microsoft Project).

**Pomyłka.** Każdą zmianę postępu cofniesz jednym krokiem klawiszami Ctrl+Z.

## Zobacz też

- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): jak aplikacja wylicza pozostałą pracę i datę statusu, z przykładem.
- [Importowanie postępu z arkusza kalkulacyjnego](docs://howto-voortgang-importeren): wczytywanie postępu dla wielu zadań naraz.
- [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen): co aplikacja robi z zadaniem, które się rozpoczęło, gdy jego poprzednik jest jeszcze w toku.
- [Zapisywanie planu bazowego i zarządzanie nim](docs://howto-baseline-opslaan-en-beheren): zapisanie pierwotnego harmonogramu, do którego porównujesz postęp.
