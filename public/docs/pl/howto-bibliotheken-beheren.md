# Zarządzanie bibliotekami zasobów i ich udostępnianie

Cel: tworzyć i usuwać biblioteki zasobów, dodawać do nich kalendarze oraz eksportować lub importować bibliotekę, jako kopię zapasową albo po to, by użyć jej na innym komputerze.

## Kiedy tego potrzebujesz

Biblioteka nie znajduje się w Twoich plikach projektu, lecz w aplikacji: w aplikacji desktopowej w pliku na tym komputerze, a w przeglądarce w pamięci tej przeglądarki. Nie jest synchronizowana. Jeśli wyczyścisz dane strony w przeglądarce, biblioteka zniknie. Dlatego wyeksportuj ją jako kopię zapasową. Jeśli kolega chce pracować z tymi samymi ekipami i stawkami, przekazujesz mu bibliotekę także jako plik. Jeśli Twoja organizacja ma kilka firm operacyjnych z własnymi ekipami, tworzysz osobną bibliotekę dla każdej z nich. Dla nowego projektu wybierasz, której biblioteki używa.

Czym jest biblioteka, przeczytasz w [Biblioteka zasobów](docs://uitleg-resourcebibliotheek). Samych zasobów tu nie edytujesz, lecz w panelu zasobów. Zob. [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken).

## Kroki

### Otwieranie ekranu zarządzania

Wybierz *Plik › Biblioteka*. Po lewej jest lista *Biblioteki zasobów*. Po prawej są szczegóły biblioteki, którą klikniesz: nazwa, przyciski i lista *Kalendarze*. Na górze jest napisane, że zasobami zarządzasz w zakładce *Zasoby*.

### Tworzenie, zmiana nazwy i wybór domyślnej biblioteki

1. Kliknij plus nad listą (*Dodaj bibliotekę zasobów*). Pojawia się nowa biblioteka *Nowa biblioteka zasobów* i od razu zostaje zaznaczona.
2. Wpisz nową nazwę w polu nazwy u góry prawej części i naciśnij Enter albo kliknij poza polem. Aplikacja nie przyjmuje pustej nazwy.
3. Kliknij *Ustaw jako domyślną*, aby ta biblioteka od teraz była wstępnie wybrana dla nowych projektów. Domyślna biblioteka ma na liście gwiazdkę.

### Dodawanie kalendarza do biblioteki

1. Pod nagłówkiem *Kalendarze* kliknij *Z projektu*. Otwiera się lista kalendarzy Twojego aktywnego projektu.
2. Kliknij małą strzałkę za kalendarzem, który chcesz przejąć. Nad listą pojawia się *Dodano.* Kalendarz, który jest już powiązany z tą biblioteką, ma za nazwą *już powiązane*.
3. Kalendarz jest teraz na liście *Kalendarze* biblioteki. Ołówkiem (*Edytuj*) zmieniasz nazwę i zapisujesz ją ptaszkiem. Kosz usuwa kalendarz od razu, bez pytania o potwierdzenie. Kopie w projektach zostają.

Pod listą *Kalendarze* jest numer wersji, na przykład *v2*. Rośnie przy każdej zmianie biblioteki. Kalendarz z biblioteki przechodzi do projektu, gdy przypisujesz zasób, który go używa. Przypisujesz go do zasobu w widoku *Biblioteka* (zakładka *Zasoby*), w kolumnie *Kalendarz*.

### Eksport biblioteki

1. Wybierz bibliotekę na liście.
2. Kliknij *Eksportuj*.
3. W aplikacji desktopowej oraz w Chrome i Edge wybierasz, gdzie zapisać plik. W innych przeglądarkach plik trafia od razu do folderu pobranych, a aplikacja o tym informuje. Plik nazywa się `bibliotheek-` plus nazwa biblioteki, z rozszerzeniem `.ifc`.

Pod przyciskami jest napisane *Eksport jest jednocześnie kopią zapasową: przechowuj plik w bezpiecznym miejscu.*

### Import biblioteki

1. Kliknij *Importuj*. Otwiera się okno *Importuj bibliotekę* dla biblioteki wybranej wcześniej na liście.
2. Kliknij *Wybierz plik…* i wskaż plik `.ifc` z eksportu. Jeśli plik nie zawiera biblioteki, pojawia się komunikat *Ten plik IFC nie zawiera biblioteki zasobów.*
3. Aplikacja pokazuje, co jest w pliku, na przykład *2 kalendarzy, 5 zasobów (wersja 3).*
4. Wybierz, co chcesz z nim zrobić. Zob. niżej.
5. Kliknij *Dodaj* albo *Zastąp*, albo *Anuluj*, aby przerwać.

Masz dwie możliwości:

- *Dodaj jako nową bibliotekę zasobów*: plik staje się osobną biblioteką obok istniejących. Pod spodem jest napisane, pod jaką nazwą, na przykład *Zostanie dodana jako „Mijn resourcebibliotheek (2)”.* Nic nie przepada, a Twój aktywny projekt pozostaje powiązany ze swoją biblioteką.
- *Zastąp istniejącą bibliotekę zasobów*: cała zawartość wybranej biblioteki zostaje zastąpiona tą z pliku. Aplikacja też to mówi: *Import zastępuje CAŁĄ pulę wybranej biblioteki zasobów.* Jeśli masz dwie lub więcej bibliotek, wybierasz, którą z nich, pod etykietą *Importuj do biblioteki zasobów*. Jeśli Twoja biblioteka jest nowsza niż plik, aplikacja ostrzega: *Twoja lokalna biblioteka jest nowsza — import może nadpisać twoje zmiany.*

Aplikacja sama proponuje wybór. Dla pliku, który zawierał domyślną bibliotekę, wstępnie wybrana jest opcja *Dodaj jako nową bibliotekę zasobów*. Jeśli biblioteka z pliku już istnieje na Twoim komputerze i nie jest domyślna, wstępnie wybrana jest opcja *Zastąp istniejącą bibliotekę zasobów*, z dokładnie tą biblioteką wybraną. Jeśli nie masz pewności, wybierz opcję dodania: nic wtedy nie zostanie nadpisane.

### Usuwanie biblioteki

1. Wybierz bibliotekę na liście i kliknij *Usuń bibliotekę zasobów*. Przycisk jest szary, gdy zostaje tylko jedna biblioteka, bo zawsze musi zostać jedna.
2. Potwierdź przyciskiem *Usuń*. Pytanie brzmi *Usunąć tę bibliotekę zasobów?* Jeśli są z nią powiązane otwarte projekty, pojawia się komunikat *Ta biblioteka zasobów jest powiązana z 1 otwartym projektem. Usunięcie jej odłączy ten projekt. Kontynuować?* Dla większej liczby projektów komunikat jest taki sam, z odpowiednią liczbą, na przykład *powiązana z 2 otwartymi projektami*.

Biblioteka wtedy znika razem ze wszystkimi zasobami i kalendarzami. Otwarte projekty, które jej używały, zostają odłączone. Ich zasoby pozostają zwykłymi zasobami projektu. Jeśli chcesz zachować zawartość, najpierw ją wyeksportuj.

### Przekazywanie projektu razem z jego biblioteką

Plik projektu zawiera własne kopie zasobów. Jeśli chcesz przekazać także całą bibliotekę, zrób następująco. Sam eksport jest też opisany w [Eksportowanie](docs://howto-exporteren).

1. Otwórz projekt, który jest powiązany z biblioteką, i wybierz *Plik › Eksportuj*.
2. Zaznacz *Zapisz również plik biblioteki*. Pole wyboru pojawia się tylko przy powiązanym projekcie.
3. Wybierz kartę *IFC* i zapisz plik. Aplikacja wtedy prosi również o drugi plik. Nazywa się tak jak projekt, z dopiskiem `-bibliotheek` na końcu, i zawiera bibliotekę.

Pole wyboru działa tylko przy eksporcie IFC, nie przy innych formatach eksportu. Twój kolega importuje drugi plik zgodnie z opisem powyżej.

## Pułapki i co wtedy robi aplikacja

**Dwóch planistów, dwie biblioteki.** Aplikacja nie synchronizuje bibliotek między komputerami. Okno importu zawsze pokazuje na ten temat ostrzeżenie: *Uwaga: biblioteki nie są synchronizowane między komputerami. Jeśli dwóch planistów pracuje z tą samą biblioteką zasobów, biblioteki mogą się rozbiec. Jeśli Twoja organizacja dzieli ekipy między firmy operacyjne, wybierz świadomie jedną wspólną bibliotekę zasobów.*

**Zastąpienie nadpisuje wszystko.** Wszystko, co było w wybranej bibliotece, znika. Zmiany w bibliotece nie da się cofnąć przyciskiem *Cofnij*. Jeśli nie masz pewności, najpierw wyeksportuj. Twoje projekty zachowują swoje kopie. Aplikacja aktualizuje kopie, które nadal istnieją w nowym pliku. Kopie, których w nim nie ma, dostają oznaczenie *nie ma już w bibliotece* i dalej działają. Jeśli kopia się różni, otwiera się okno *Połącz bibliotekę zasobów* (zob. [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken)).

**Kalendarz usuwa się z listy od razu.** Aplikacja nie pyta o potwierdzenie, w przeciwieństwie do usuwania zasobu. To wygląda na wadę. Zmiany w bibliotece nie da się cofnąć przyciskiem *Cofnij*.

## Zobacz także

- [Biblioteka zasobów](docs://uitleg-resourcebibliotheek): jak biblioteka i projekt się do siebie odnoszą.
- [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken): powiązywanie zasobów, przypisywanie ich i rozwiązywanie odchyleń.
- [Eksportowanie](docs://howto-exporteren): formaty eksportu, w tym IFC z plikiem biblioteki.
