# Importowanie postępu z arkusza kalkulacyjnego

Cel: wpisz do harmonogramu jednym krokiem postęp, który kierownicy budowy wpisują w arkuszu. Nie klikaj każdego zadania osobno.

## Kiedy tego potrzebujesz

Podwykonawca lub kierownik budowy nie ma aplikacji, ale co tydzień podaje stan prac: ile procent jest gotowe, kiedy zaczęto i kiedy skończono. Wysyłasz mu arkusz z Twoimi zadaniami. On wypełnia trzy kolumny i odsyła go do Ciebie. Z tego aplikacja odczytuje tylko trzy wartości na zadanie: ukończenie, rzeczywiste rozpoczęcie i rzeczywiste zakończenie. Reszta harmonogramu zostaje bez zmian. Co aplikacja robi z tym postępem, opisano w [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).

## Kroki

### 1. Ustaw datę statusu i oblicz

Ustaw datę statusu, tak jak opisano w [Aktualizowanie postępu](docs://howto-voortgang-bijwerken). Kierownik budowy wpisuje rzeczywiste daty do tego dnia włącznie. Jeśli harmonogram nie jest aktualny, aplikacja przelicza go, zanim zostanie utworzony arkusz.

### 2. Utwórz arkusz

Wybierz *Planowanie › Postęp › Eksportuj arkusz postępu*. Ten sam przycisk jest na kartach *Tabela* i *Raport*. Aplikacja tworzy plik Excel i proponuje nazwę *(nazwa projektu)-voortgang.xlsx*. W przeglądarce plik trafia do Twoich pobranych plików. Wolisz CSV? Wybierz *Plik › Eksport › Arkusz postępu (CSV)*. Arkusz Excel jest tam także jako *Arkusz postępu (Excel)*.

Arkusz ma osiem kolumn. Nazwy kolumn zostają po angielsku, z krótką instrukcją w języku aplikacji po nich:

- `OPS Task ID`, `WBS` i `Name` służą tylko do rozpoznania zadania. Nie zmieniaj ich.
- `Start` i `Finish` to planowane daty, dla informacji. Aplikacja nigdy ich nie zapisuje z powrotem.
- `Completion (%)`, `Actual Start` i `Actual Finish` to kolumny, które wypełniasz.

Arkusz Excel jest chroniony, bez hasła: można edytować tylko trzy kolumny do wypełnienia. Excel sprawdza, czy procent mieści się w zakresie 0–100 i czy rzeczywista data jest prawidłową datą. Faza (zadanie sumaryczne) jest oznaczona na szaro z napisem *— zadanie sumaryczne: nie wypełniać*.

### 3. Poproś o wypełnienie

Dla każdego zadania kierownik budowy wpisuje:

- `Completion (%)`: od 0 do 100 włącznie. Aplikacja odczytuje też liczby dziesiętne, z przecinkiem lub kropką (na przykład 33,3 lub 33.3). Instrukcja w CSV nadal prosi o liczby całkowite: arkusz z innymi ustawieniami regionalnymi może odczytać 8,38 jako 838.
- `Actual Start` i `Actual Finish`: w Excelu jako datę w Twoich ustawieniach regionalnych; w CSV jako dd-mm-rrrr lub rrrr-mm-dd.

Pusta komórka niczego nie zmienia. Pusta komórka więc też nie usuwa istniejącego postępu; to można zrobić tylko w aplikacji. Zadanie, które się jeszcze nie rozpoczęło, kierownik budowy zostawia całkowicie puste.

### 4. Wczytaj arkusz

1. Wybierz *Planowanie › Postęp › Aktualizuj postęp z arkusza* (także na kartach *Tabela* i *Raport*), albo *Plik › Importuj › Aktualizuj postęp z arkusza*. Otwiera się okno *Aktualizuj postęp z arkusza*.
2. Kliknij *Wybierz plik…* i wybierz wypełniony plik `.xlsx` lub `.csv`.
3. Jeśli daty w pliku CSV są niejednoznaczne, aplikacja pyta *Najpierw dzień czy najpierw miesiąc?*. Pokazuje datę z Twojego pliku odczytaną na dwa sposoby. Kliknij datę, która jest poprawna.
4. Zobaczysz teraz podgląd. Na górze są cztery liczniki: *Zastosowano*, *Bez zmian*, *Czeka na powiązanie* i *Odrzucone*. Niżej, przy każdym zadaniu, widać, co się zmieni, na przykład *Ukończenie: 0% → 100%*.
5. Sprawdź podgląd i kliknij *Zastosuj*. Okno pokazuje *Wynik* z licznikami i wierszami, które odrzucono, wraz z powodem. Zakończ, klikając *Zamknij*.

Nie możesz pominąć podglądu. Przycisk *Zastosuj* jest wyłączony, dopóki nie ma nic do zastosowania.

### 5. Przelicz harmonogram

Wczytanie samo nie przelicza harmonogramu. Naciśnij **Oblicz** (F5), na przykład w menu *Planowanie › Harmonogram › Oblicz*, chyba że opcja *Oblicz automatycznie* jest włączona.

## Wiersze, które nie pasują od razu

Aplikacja łączy każdy wiersz z zadaniem: najpierw po `OPS Task ID`, a w przeciwnym razie po numerze WBS.

**Powiązanie niepewne.** Jeśli aplikacja znalazła zadanie tylko po numerze WBS, wiersz jest pod *Powiązanie niepewne*, z przyciskami *Potwierdź* i *Zmień*. Wiersz zostanie zastosowany także wtedy, gdy nic nie zrobisz. Dlatego sprawdź, czy zadanie jest właściwe. *Potwierdź* usuwa wiersz z tej listy. Niczego nie zmienia w tym, co zostanie zastosowane. *Zmień* pozwala wybrać inne zadanie. Przyciskiem *Usuń powiązanie* usuwasz powiązanie, które sam utworzyłeś. Uwaga: arkusz z innego projektu z tymi samymi numerami WBS mimo to zostaje powiązany, pod *Powiązanie niepewne*, i zostanie zastosowany po kliknięciu *Zastosuj*.

**Czeka na powiązanie.** Jeśli aplikacja nie znalazła zadania albo znalazła kilka z tym samym numerem WBS, wiersz jest pod *Czeka na powiązanie*. Przy przycisku *Wybierz zadanie…* wybierz właściwe zadanie. Szukasz po numerze WBS albo nazwie. Jeśli go nie powiążesz, wiersz zostanie odrzucony.

## Pułapki i co robi aplikacja

Wiersz, który nie pasuje, zostaje odrzucony z podaniem powodu. Reszta arkusza jest dalej przetwarzana. To są główne komunikaty:

- *Rzeczywista data przypada po dacie statusu*. Ustaw późniejszą datę statusu albo popraw arkusz.
- *To zadanie zgodnie z planem zaczyna się dopiero po dacie statusu: najpierw wpisz w arkuszu jego rzeczywisty początek*. Aplikacja nie wymyśla początku. Podaj go w arkuszu.
- *Procent poza zakresem 0–100. Sprawdź separator dziesiętny: w arkuszu kalkulacyjnym z innymi ustawieniami regionalnymi „8,38” może zostać odczytane jako 838*.
- *Zadania sumaryczne nie mogą otrzymywać postępu z arkusza*. Postęp fazy wynika z zadań poniżej niej.
- *Rzeczywiste zakończenie przypada przed rzeczywistym startem*.
- *Nieczytelna data* i *Nieczytelny procent*.
- *Wprowadzone wartości są ze sobą sprzeczne*. Na przykład rzeczywiste zakończenie z procentem poniżej 100.
- *Nie znaleziono zadania dla tego wiersza*. Arkusz podaje identyfikator zadania i numer WBS, które nie występują w tym projekcie.
- *Ten kod WBS występuje w wielu zadaniach — powiąż wiersz ręcznie*.
- *Inny wiersz już zajął to zadanie*. Dwa wiersze wskazują na to samo zadanie.
- *Odrzucone przez planistę*. Inne odrzucenie przez samo planowanie, bez własnego komunikatu.

Jeśli odrzucony jest cały plik, w oknie pojawia się jeden z tych komunikatów: *Ten plik nie ma kolumny „OPS Task ID” ani „WBS” do powiązania wierszy z zadaniami*, *Ten plik nie ma żadnej z kolumn Ukończenie, Rzeczywiste rozpoczęcie ani Rzeczywiste zakończenie*, *Ten plik jest zbyt duży, aby odczytać go jako arkusz postępu* (więcej niż 16 MB), *Ten plik ma zbyt wiele wierszy, aby odczytać go jako arkusz postępu* (więcej niż 50 000 wierszy), *Ten plik jest chroniony hasłem i nie można go odczytać* lub *Nie udało się odczytać tego pliku jako arkusza postępu*.

**Brak daty statusu.** Jeśli nie ma jeszcze daty statusu, a import stosuje postęp, aplikacja ustawia ją na dzisiaj i informuje o tym. Ustaw ją więc najpierw sam.

**Wszystko cofasz jednym krokiem.** Cały arkusz to jeden krok dla Ctrl+Z.

**Tylko to, co wypełnisz.** Wiersz bez różnicy względem harmonogramu liczy się jako *Bez zmian*. Zadanie bez wiersza w arkuszu zostaje takie, jakie było.

## Zobacz też

- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): co aplikacja oblicza, gdy wpisano rzeczywiste daty i procenty.
- [Aktualizowanie postępu](docs://howto-voortgang-bijwerken): postęp wpisujesz bezpośrednio w aplikacji.
