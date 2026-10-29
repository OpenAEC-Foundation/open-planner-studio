# Dopasowanie kolumn tabeli

Cel: wybierz, które kolumny widzisz w tabeli zadań, w jakiej kolejności i jak szerokie.

## Kiedy tego potrzebujesz

Na spotkaniu chcesz zobaczyć termin ostateczny i zapas całkowity przy każdym zadaniu. Kierownik budowy chce mieć przy nazwie tylko początek i zakończenie. Albo kolumna jest tak wąska, że jej nagłówek jest ucięty. Tabela zadań składa się z kolumn, które wybierasz sam: jest ich kilkadziesiąt, od *Nazwa zadania* i *Czas trwania* do *Termin ostateczny*, *Zapas swobodny* i *Przydzielone zasoby*.

Są dwie tabele zadań, każda z własnymi kolumnami:

- **Tabela zadań obok wykresu Gantt** znajduje się po lewej stronie osi czasu, na kartach m.in. *Start*, *Planowanie* i *Widok*. Domyślnie ma *WBS*, *Nazwa zadania* i *Czas trwania*, więc zostaje miejsce na oś czasu.
- **Tabela na karcie *Tabela*** zajmuje cały obszar roboczy. Domyślnie ma *WBS*, *Nazwa zadania*, *Czas trwania*, *Początek*, *Koniec*, *Rodzaj robót*, *Krytyczne*, *Zapas całkowity* i *Postęp*, a także kolumnę dla każdego kodu czynności i pola niestandardowego projektu.

Zmiana w jednej tabeli nie zmienia drugiej.

## Kroki

### Dodawanie kolumny

1. Kliknij plus (**+**) z prawej strony nagłówka tabeli. Na karcie *Tabela* możesz też użyć *Tabela › Kolumny › Kolumny…*. Otwiera się okno *Wybierz kolumnę*.
2. Znajdź kolumnę. Na górze, jeśli wcześniej wybierałeś kolumny, jest *Ostatnio używane*. Wpisz część nazwy w polu *Szukaj*, na przykład *termi* dla *Termin ostateczny*, albo otwórz kategorię: *Zadanie*, *Planowanie*, *Ograniczenia*, *Relacje*, *Zasoby*, *Postęp*, *Obliczone*, *Plan bazowy*, *Niestandardowe* lub *Techniczne*.
3. Kliknij kolumnę. Trafia na koniec tabeli, a okno się zamyka.

Kolumna, która już jest w tabeli, jest szara i nie można jej wybrać.

### Usuwanie kolumny

Kliknij znak minus w nagłówku kolumny (*Usuń: Termin ostateczny*). Albo kliknij prawym przyciskiem nagłówek i wybierz *Usuń: Termin ostateczny*. Ctrl+Z przywraca kolumnę, albo wybierz ją ponownie plusem.

### Zmiana szerokości

Przeciągnij prawą krawędź nagłówka kolumny w lewo lub w prawo. Kliknij dwukrotnie tę krawędź albo wybierz *Dopasuj automatycznie* w menu nagłówka (prawy przycisk myszy), aby kolumna była wystarczająco szeroka dla swojej zawartości, maksymalnie 480 pikseli. Jeśli krawędź ma fokus, klawisze strzałek poszerzają lub zwężają ją krok po kroku.

### Przypinanie kolumn

Kliknij prawym przyciskiem nagłówek i wybierz *Przypnij*. Przypięte kolumny przesuwają się na początek i zostają po lewej stronie, gdy przewijasz w poziomie. Działa to tak długo, jak razem nie są szersze niż okno. *Odepnij* przywraca je do zwykłego rzędu.

### Zmiana kolejności

Przeciągnij nagłówek kolumny w inne miejsce. Przypiętą kolumnę przesuwasz wśród przypiętych kolumn, zwykłą kolumnę wśród zwykłych kolumn.

### Powrót do ustawień domyślnych

Otwórz okno *Wybierz kolumnę* i kliknij na dole *Przywróć domyślne*. Przycisk jest szary, jeśli kolumny są już domyślne. W tabeli na karcie *Tabela* dodaje się też kolumnę dla każdego kodu czynności i pola niestandardowego projektu, nawet jeśli wcześniej je usunąłeś. Te kolumny należą do projektu, w którym jest dany kod lub pole. Więcej o tych kodach i polach przeczytasz w artykule [Kody i pola niestandardowe](docs://howto-codes-en-velden).

## Problemy i co robi aplikacja

**Nagłówek jest ucięty.** Wąska kolumna obcina jej nazwę, na przykład *Zapas całkowity* do *Zap…*. Kliknij dwukrotnie krawędź nagłówka, aby dopasować kolumnę.

**Wybierasz złą tabelę.** Kolumny tabeli zadań obok wykresu Gantt i kolumny na karcie *Tabela* są oddzielne. Jeśli jesteś na karcie *Widok* lub *Start*, zmieniasz tabelę obok wykresu Gantt. Plus na karcie *Tabela* zmienia dużą tabelę.

**Układ przywraca kolumny.** Jeśli układ ma zaznaczoną część *Kolumny*, kliknięcie przycisku układu przywraca kolumny tabeli zadań obok wykresu Gantt do zapisanego stanu. Tabela na karcie *Tabela* zostaje bez zmian. Zobacz [Tworzenie i używanie układu](docs://howto-layouts-gebruiken).

**Kolumny zapisane są na urządzeniu, nie w projekcie.** Aplikacja zachowuje Twój wybór kolumn dla wszystkich projektów na tym urządzeniu i nie zapisuje go w pliku projektu. Nie oznacza też projektu jako „zmieniony”. Każdą zmianę kolumn możesz cofnąć przyciskiem *Cofnij* (Ctrl+Z); kroki nazywają się na przykład *Dodaj kolumnę Termin ostateczny* i *Zmień szerokość kolumny Nazwa zadania*.

## Zobacz też

- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): kolumny na przycisku razem z filtrem lub sortowaniem.
- [Kody i pola niestandardowe](docs://howto-codes-en-velden): tworzenie własnych kolumn, które możesz tutaj wybrać.
- [Kolumny tabeli](docs://ref-tabelkolommen): wszystkie kolumny i co pokazują.
