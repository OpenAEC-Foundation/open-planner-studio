# Kody i pola niestandardowe

Cel: dołączyć do swoich zadań własne klasyfikacje (kody czynności, na przykład *Lokalizacja*) i własne pola (na przykład *Wykonawca*).

## Kiedy tego potrzebujesz

Oprócz stałych danych zadania (nazwa, czas trwania, relacje, …) możesz dodać własne dane. Jeśli chcesz klasyfikować zadania według północnego i południowego skrzydła, według dyscypliny, albo śledzić, który wykonawca wykonuje zadanie, zapisujesz to sam. Są dwa sposoby i różnica ma znaczenie.

**Kod czynności** to klasyfikacja z ustaloną listą wyboru. Tworzysz **typ kodu** (na przykład *Lokalizacja*) z **wartościami** (*N* dla północnego skrzydła, *Z* dla południowego skrzydła). Zadanie dostaje najwyżej jedną wartość na typ kodu.

**Pole niestandardowe** (pod *Pola użytkownika* w oknie) to wolne pole wejściowe z typem: *Tekst*, *Liczba*, *Liczba całkowita*, *Koszt*, *Data* albo *Tak/nie*. Pole może mieć na każdym zadaniu inną wartość.

## Kroki

### Definiowanie kodów i pól

1. Wybierz *Planowanie › Struktura › Kody i pola*.
2. **Tworzenie typu kodu.** Pod *Nowy typ kodu (np. Lokalizacja)* wpisz nazwę i naciśnij Enter albo kliknij *Dodaj typ kodu*.
3. **Dodawanie wartości.** Pod typem kodu kliknij *Dodaj wartość*. Aplikacja wstawia tam tymczasowy kod, na przykład *V1*. Zmień go w polu *Kod* (krótko, tak jak byś go wpisał: *N*), w razie potrzeby wypełnij pole *Opis* (*Północne skrzydło*) i wybierz *Kolor*. Zmiana obowiązuje zaraz po tym, jak opuścisz pole albo naciśniesz Enter.
4. **Tworzenie pola niestandardowego.** Pod *Nowe pole (np. Wykonawca)* wpisz nazwę, wybierz typ i kliknij *Dodaj pole* (albo naciśnij Enter).

Okno nie ma przycisku OK: każda zmiana działa od razu. Typu pola nie możesz później zmienić, tylko jego nazwę. Jeśli chcesz inny typ, utwórz nowe pole.

### Wypełnianie kodu lub pola w zadaniu

Masz dwa miejsca.

- **W panelu *Właściwości*** (albo w oknie, które otworzysz klawiszem F2). Na dole jest blok *Kody i pola*: lista wyboru dla każdego typu kodu i pole wejściowe dla każdego pola. Blok pojawia się dopiero wtedy, gdy jest co najmniej jeden typ kodu albo jedno pole.
- **Jako kolumna w tabeli zadań.** Kliknij **+** po prawej stronie nagłówka tabeli (*Dodaj kolumnę*) i pod *Niestandardowe* wybierz typ kodu albo pole. W komórce typu kodu wpisz kod, na przykład `N`, albo wybierz go z listy. Kod, który nie istnieje, daje komunikat *Wybierz wartość z tego kodu czynności.*

### Korzystanie z nich

Typ kodu albo pole niestandardowe możesz użyć do filtrowania, grupowania i sortowania. Ustawiasz to za pomocą układu: *Widok › Układ › Nowy układ*. W oknie zaznacz części, które chcesz zapisać. Po wybraniu *Zapisz* dostajesz przycisk w *Widok › Układ*. Możesz go później ponownie kliknąć. Przy *Zastosuj bez zapisywania* układ pojawia się tylko teraz, na ekranie. Przy grupowaniu zadania bez wartości trafiają pod *(brak)*.

Aby ustawić kolor paska, wybierz *Widok › Plan bazowy i postęp › Kolory słupków*, potem *Według kategorii* i typ kodu. Każdy pasek dostaje wtedy *Kolor* swojej wartości.

## Pułapki i co robi aplikacja

**Usunięcie usuwa wartości w zadaniach.** Jeśli usuniesz za pomocą kosza typ kodu, wartość albo pole, aplikacja nie pyta o potwierdzenie. Przydziały na wszystkich zadaniach znikają razem z nim. Grupowanie lub sortowanie na tym typie kodu albo polu też przestaje działać. *Cofnij* (Ctrl+Z, najpierw zamknij okno) przywraca typ kodu, wartość albo pole oraz wypełnione wartości, ale nie grupowanie ani sortowanie: ustawiasz je ponownie.

**Dwie wartości z tym samym kodem.** *Dodaj wartość* nadaje kolejny numer od liczby istniejących wartości. Jeśli usuniesz jedną i dodasz jedną, kod może więc wystąpić dwa razy. Jeśli wpiszesz ten kod w komórce kolumny, aplikacja odrzuca wpis komunikatem *Ta wartość kodu czynności występuje więcej niż raz. Wybierz ją z listy.* Nadaj każdej wartości własny kod.

**Szablony nie zabierają kodów i pól.** Zobacz [Zapisywanie i wstawianie szablonów WBS](docs://howto-wbs-sjablonen). Jeśli wkleisz zadania do innego dokumentu, aplikacja usuwa kody i pola, których tam nie ma, i informuje cię o tym.

**Pole typu data nie przesuwa się razem z projektem.** Jeśli przeniesiesz cały projekt, wypełnione pola niestandardowe typu *Data* zostają przy swojej dacie. Aplikacja ostrzega o tym w podglądzie.

## Zobacz też

- [Dostosowywanie struktury](docs://howto-structuur-aanpassen): drzewo WBS, drugi sposób na uporządkowanie zadań.
- [Przenoszenie projektu](docs://howto-project-verplaatsen): co dzieje się z datami, gdy przenosisz projekt.
- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): grupowanie i filtrowanie według kodu lub pola niestandardowego.
- [Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen): wyświetlanie kodu lub pola niestandardowego jako kolumny.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): kody czynności *Dom* i *Dyscyplina*, pole niestandardowe *Szacunek kosztów* i notatki (otwarte i ukończone).
