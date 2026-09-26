# Biblioteki zasobów

Jeśli pracujesz nad kilkoma projektami z tymi samymi brygadami, tymi samymi podwykonawcami i tymi samymi kalendarzami, nie chcesz utrzymywać ich stawki, kalendarza i typu osobno w każdym projekcie — wpisywać ich za każdym razem od nowa i gonić za każdą kopią, gdy coś się zmieni. Właśnie do tego służy biblioteka zasobów: wspólne źródło zasobów i kalendarzy, które należy do Twojej organizacji, żyje poza pojedynczymi projektami i z którego może czerpać wiele projektów. Ten przewodnik wyjaśnia, jak biblioteka odnosi się do projektu, co dokładnie podąża razem z zasobem, a co pozostaje przypisane do projektu, oraz jak przełączasz się między tymi dwoma światami.

## Czego się tu nauczysz

- Rozróżnienia między biblioteką (współdzieloną, obejmującą całą organizację) a projektem (tym, co dany projekt faktycznie wykorzystuje).
- Łączenia projektu z biblioteką albo świadomego pozostawienia go niezależnym.
- Dwóch widoków na karcie Zasoby: **Biblioteka** i **Projekt**.
- Trzech rodzajów wierszy, które napotkasz w widoku projektu: z biblioteki, tylko projektowe i osierocone.
- Tego, co dokładnie zasób biblioteczny wnosi do projektu, a co ustawiasz swobodnie dla każdego projektu.
- Trzech akcji, które łączą bibliotekę z projektem.
- Sposobu, w jaki aplikacja odświeża kopie, i tego, co masz do zdecydowania, gdy kopia się rozjedzie.
- Udostępniania, kopii zapasowej i ich ograniczeń.

Podążaj za przykładem [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) oraz [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): otwarcie któregokolwiek z tych przykładów automatycznie łączy go z jedną wspólną demo-biblioteką zasobów, a brygady **Timmerlieden**, **Installateurs**, **Stukadoors** i **Schilders** pojawiają się w obu pod dokładnie tą samą nazwą — bezpośredni dowód, że jedna biblioteka zasila wiele projektów.

## Biblioteka i projekt: dwa światy

**Biblioteka zasobów** to wspólne źródło: należy do Twojej organizacji, a nie do jednego projektu, i przetrwa każdy pojedynczy projekt. **Projekt** decyduje, co ten konkretny projekt faktycznie z niej wykorzystuje — z własną zdolnością, dostępnością i wyborem kalendarza. Projekt łączy się z dokładnie jedną biblioteką albo stoi całkowicie samodzielnie: w takim wypadku wszystko po prostu działa jak zwykle, tylko bez wspólnego źródła, z którego można czerpać albo do którego można zapisywać.

## Łączenie projektu z biblioteką

Bibliotekę wybierasz w dwóch miejscach, które pokazują ten sam panel:

- **Kreator nowego projektu** („Nowy projekt"), z selektorem biblioteki.
- **Info o projekcie** dla istniejącego projektu — zarówno okno dialogowe, jak i **Plik → Info o projekcie**.

Ten sam selektor ma też **+ Nowa biblioteka zasobów…**, dzięki czemu możesz utworzyć ją na miejscu, bez wcześniejszego wchodzenia do Plik → Biblioteka. **Brak (projekt niezależny)** to jawny wybór w tej samej liście — odłączenie projektu nigdy nie jest przypadkowym efektem ubocznym, zawsze jest czymś, co świadomie wybierasz.

## Karta Zasoby: dwa widoki

Gdy tylko projekt zostanie połączony z biblioteką, karta Zasoby zyskuje w prawym górnym rogu przełącznik z dwoma widokami:

- **Biblioteka** — zarządzanie samym źródłem. Wszystko tutaj jest bezpośrednio edytowalne, zmiana obowiązuje natychmiast we **wszystkich** projektach czerpiących z tej biblioteki i wykracza poza cofanie (Ctrl+Z) — to nie jest edycja projektu.
- **Projekt** — to, co dany projekt faktycznie wykorzystuje: zwykła tabela projektu, z oznaczeniami przy każdym wierszu dla pochodzenia i ewentualnych odchyleń.

Jeśli pracujesz z kilkoma otwartymi projektami czerpiącymi z tej samej biblioteki, istnieje jeszcze trzeci widok: **Obłożenie**. Pokazuje on, dla każdego zasobu biblioteki, gdzie jest on zarezerwowany we *wszystkich* otwartych dokumentach, i oznacza dni, w których suma tych rezerwacji przekracza możliwości firmy — podwójne obłożenie między projektami, którego żaden pojedynczy projekt sam nie zobaczy. Przeczytaj przewodnik [Przegląd obłożenia](docs://gids-bezettingsoverzicht).

## Trzy rodzaje wierszy w widoku projektu

W widoku projektu napotkasz trzy rodzaje wierszy:

1. **Z biblioteki** — rozpoznawalne po oznaczeniu **Z biblioteki**. Nazwa, typ, stawka/godz. i jednostka są odziedziczone z biblioteki i pokazane tutaj jako zwykły tekst: nie edytujesz ich tutaj, lecz w widoku **Biblioteka**. Maks. jednostki, zdolność rozłożona w czasie i wybór kalendarza są jednak w pełni edytowalne — to właśnie jest inwestycja tego konkretnego projektu.
2. **Tylko projektowe** — bez oznaczenia, w pełni edytowalne. Nawet połączony projekt może mieć takie wiersze: przydatne dla jednorazowych pozycji, które nie należą do wspólnej biblioteki, na przykład wynajętego żurawia albo podwykonawcy zatrudnionego tylko do tego jednego zlecenia.
3. **Osierocone** — oryginał w bibliotece już nie istnieje; wiersz jest oznaczony jako **nie ma już w bibliotece**. Sama kopia nadal działa bez problemu — możesz ją odłączyć albo usunąć.

## Co podąża za biblioteką — a co nie

To jest część warta zapamiętania: niektóre pola to ustalenie obowiązujące w całej organizacji i podążają za biblioteką, inne są inwestycją własną tego projektu i ustawiasz je swobodnie — nigdy nie licząc się to jako odchylenie.

**Podąża za biblioteką:**
- Nazwa
- Typ
- Opis
- Stawka/godz.
- Jednostka
- **Zawartość** kalendarza, który podróżuje razem z zasobem (dni robocze, godziny, święta)

**Decydujesz per projekt, bez ryzyka, że policzy się to jako odchylenie:**
- Maks. jednostki
- Zdolność rozłożona w czasie
- **Wybór**, który kalendarz jest przypisany do zasobu

Przydziel zasób biblioteczny, a jego kalendarz podąża za nim jako połączona kopia, która sama nadal podąża za biblioteką — dlatego *zawartość* tego kalendarza znajduje się powyżej, pod nagłówkiem **Podąża za biblioteką**. Ale *wybór*, który kalendarz jest przypisany do zasobu, znajduje się pod nagłówkiem **Decydujesz per projekt**: ta sama brygada może przy pilnym zleceniu działać na innym kalendarzu niż zwykle, bez naruszania biblioteki. To rozróżnienie jest subtelne, ale ważne: zmień w zasobie bibliotecznym stawkę albo nazwę, a kopia odbiega od biblioteki; zmień wybór kalendarza albo maks. jednostki, a robisz dokładnie to, do czego to pole służy.

## Trzy akcje łączące oba światy

- **Przypisz do projektu** — z biblioteki do projektu: tworzy edytowalną kopię z zachowanym pochodzeniem.
- **Do biblioteki** — z wiersza tylko projektowego do wspólnej biblioteki: łączy natychmiast. Jeśli w bibliotece istnieje już pozycja o tej samej nazwie, aplikacja łączy się z nią zamiast duplikować.
- **Odłącz od biblioteki** — pochodzenie znika, wszystko znów staje się w pełni edytowalne. Kalendarz, który podróżował razem z zasobem, odłącza się wraz z nim, chyba że tego samego kalendarza używa jeszcze inny, wciąż połączony zasób.

## Odświeżanie i odchylenia

Aplikacja sprawdza, czy Twoje kopie nadal zgadzają się z biblioteką, w czterech stałych momentach: przy **otwieraniu** pliku, przy **przełączaniu** dokumentów, po **edycji w bibliotece** oraz po **przywróceniu po awarii**.

- Jeśli kopia po prostu została w tyle (sam jej nie zmieniałeś, ale biblioteka poszła od tego czasu naprzód), zostaje **cicho odświeżona** — zobaczysz tylko krótkie powiadomienie, żadnego pytania.
- Jeśli kopia została zmieniona lokalnie (albo przez kogoś innego), pojawia się oznaczenie **różni się — zdecyduj**, a aplikacja pyta dla każdej pozycji, co ma się stać: **Użyj wartości biblioteki**, **Przyjmij wartości z pliku do biblioteki** albo **Zdecyduj później**.

Tych wyborów nie da się cofnąć przez Ctrl+Z — druga opcja zmienia samą bibliotekę, która w ogóle znajduje się poza historią cofania projektu.

## Udostępnianie i kopia zapasowa

Plik projektu jest zawsze samodzielny: przekaż go komuś bez swojej biblioteki, a wszystko nadal działa, tylko bez wspólnego źródła. Bibliotekę eksportujesz i importujesz przez **Plik → Biblioteka** — to zarazem Twoja kopia zapasowa.

Podczas importu wybierasz spośród dwóch opcji:

- **Dodaj jako nową bibliotekę zasobów** — biblioteka z pliku zostaje po prostu dodana, jako dodatkowa biblioteka obok Twoich istniejących, i nigdy niczego u Ciebie nie nadpisuje. Jeśli nadawca miał już wcześniej wydzieloną drugą, własną bibliotekę (na przykład dla osobnego podwykonawcy), ta biblioteka niesie ze sobą własną tożsamość: wysłany razem z nią projekt od razu rozpoznaje brygady i kalendarze, których już używał, ponownie jako pozycje biblioteczne, bez niczego do posprzątania z Twojej strony. Jeśli nadawca miał tylko jedną, nigdy niewydzieloną bibliotekę — najczęstszy przypadek u większości osób — to automatyczne rozpoznanie nie zadziała: sam łączysz wysłany projekt z nową biblioteką, tylko raz, po czym dalszą pracę przejmuje dopasowywanie po nazwie. Jeśli dokładnie taka biblioteka już u Ciebie istnieje, zamiast tego dochodzi jako osobna kopia obok niej.
- **Zastąp istniejącą bibliotekę zasobów** — cała zawartość wybranej biblioteki zostaje nadpisana tym, co jest w pliku. Jeśli Twoja własna wersja jest nowsza niż ta, którą importujesz, aplikacja wcześniej Cię o tym ostrzega.

To, która opcja jest domyślnie zaznaczona, zależy od pliku: jeśli aplikacja jeszcze nie rozpoznaje biblioteki, zaznaczona jest opcja „Dodaj jako nową bibliotekę zasobów"; jeśli ją rozpoznaje (ta sama biblioteka, inna wersja), zaznaczona jest opcja „Zastąp istniejącą bibliotekę zasobów" z tą biblioteką już wybraną.

Biblioteki nie synchronizują się same między urządzeniami: jeśli dwóch planistów pracuje z tą samą biblioteką na różnych komputerach, biblioteki mogą się rozjechać.

## Demo-biblioteka zasobów w przykładach

Otwórz jeden z przykładów showcase (**Plik → Przykłady** albo z tego panelu Pomocy), a aplikacja jednorazowo tworzy **Demo-bibliotekę zasobów** i łączy z nią otwarty przykład. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) i [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) współdzielą te same brygady z tej biblioteki, dzięki czemu od razu widzisz, jak jedna biblioteka zasila wiele projektów. Twoje własne, istniejące biblioteki zasobów pozostają przy tym całkowicie nietknięte.

## Czytaj dalej

- Przydzielanie zasobów, odczytywanie histogramu i bilansowanie — to wszystko dotyczy projektowej strony zasobów: przeczytaj przewodnik [Zasoby, histogram i bilansowanie](docs://gids-resources-histogram).
- Połączony z zasobem kalendarz korzysta z tych samych elementów co każdy inny kalendarz — przeczytaj przewodnik [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren).
- Zobacz na własne oczy współdzielone między projektami brygady w [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) i [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
