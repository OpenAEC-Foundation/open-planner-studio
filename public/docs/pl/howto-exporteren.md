# Eksportowanie

Cel: przekaż Twój harmonogram jako plik w innym formacie, dla osoby, która nie czyta IFC, lub dla innego pakietu.

## Kiedy tego potrzebujesz

Konsultant pracuje w MS Project, klient w Primaverze, podwykonawca chce zadania w Excelu, albo wysyłasz harmonogram do pakietu, który nie obsługuje IFC. Eksport to kopia w innym formacie. Jeśli chcesz zachować sam projekt, zapisz go. Zapisuje się wtedy IFC, który zawiera wszystko. Co zawiera każdy format, a czego nie, jest w [Pliki i formaty](docs://uitleg-bestanden).

## Kroki

1. Wybierz *Start › Plik › Eksportuj* i wybierz format z listy, albo wybierz *Plik › Eksportuj*. Tam każdy format to karta z krótkim opisem.
2. W oknie wybierz nazwę i miejsce. Aplikacja podpowiada nazwę projektu z rozszerzeniem pliku danego formatu. Arkusze postępu nazywają się *projectname-voortgang* i otwierają się w folderze pobierania, jeśli to możliwe.
3. Potwierdź. Jeśli eksport się powiedzie, nie pojawia się żaden komunikat, poza komunikatami poniżej. Z *Plik › Eksportuj* wracasz potem na kartę *Start*, nawet jeśli anulujesz okno. Jeśli anulujesz okno przy eksporcie z listy na karcie *Start*, nic się nie dzieje.

Jeśli Twoja przeglądarka zapisuje tylko przez pobieranie (na przykład Firefox), plik jest w folderze pobierania zaraz po kroku 1. Widzisz komunikat *Zapisano jako pobrany plik: 'name.xml' znajduje się teraz w folderze pobierania. To środowisko nie pozwala aplikacji zapisywać bezpośrednio w wybranej lokalizacji.*

### Który format wybierasz?

Lista na karcie *Start* i karty w *Plik › Eksportuj* oferują te same formaty:

- *Postęp (Excel)* i *Postęp (CSV)*, na kartach *Arkusz postępu (Excel)* i *Arkusz postępu (CSV)*: prosty arkusz z id, WBS, nazwą, datami i ukończeniem, do wysłania osobom, które uzupełniają postęp.
- *CSV (;)*, na karcie *CSV (rozdzielany średnikiem)*: lista zadań, którą otwierasz w arkuszu kalkulacyjnym.
- *MS Project XML*: można go otworzyć w Microsoft Project.
- *Primavera P6 XML*: dla Oracle Primavera P6.
- *IFC*: własny format aplikacji, ze wszystkim, co w nim jest, w schemacie IFC projektu (domyślnie IFC 4.3 ADD2).

### Eksport IFC z plikiem biblioteki

Jeśli Twój projekt jest połączony z biblioteką zasobów, pole wyboru *Zapisz również plik biblioteki* znajduje się pod kartami w *Plik › Eksportuj*. Jeśli je zaznaczysz i wybierzesz *IFC*, aplikacja dwa razy pyta o miejsce: najpierw dla projektu, potem dla *projectname-bibliotheek.ifc*. To pole wyboru jest tylko w *Plik › Eksportuj*, nie na liście na karcie *Start*.

### Wczytywanie wypełnionego arkusza postępu

Uzupełniony arkusz postępu wczytujesz przez *Plik › Importuj*. Zobacz [Importowanie postępu z arkusza kalkulacyjnego](docs://howto-voortgang-importeren).

## Pułapki i co wtedy robi aplikacja

**Twój projekt się nie zmienia.** Plik projektu zostaje taki sam, a znacznik *Niezapisane* zostaje, jeśli był.

**Nieaktualny harmonogram jest najpierw przeliczany.** Dzięki temu dostajesz aktualne daty, nawet gdy zapomnisz nacisnąć *Oblicz*.

**Eksport trafia też na listę ostatnich.** Nie dotyczy to arkuszy postępu. Jeśli otworzysz tam eksport, otwiera się jako import tego formatu.

**Eksport nie zawiera wszystkiego.** Plik CSV nie ma zasobów ani ograniczeń, P6 XML nie ma planów bazowych ani terminów ostatecznych. Profil obliczeń też nie jest przenoszony: ponownie otwarty eksport oblicza się jako *Open Planner Studio*. Tylko IFC zawiera wszystko. Przykład z liczbami znajdziesz w [Pliki i formaty](docs://uitleg-bestanden).

**Dwa formaty z tym samym rozszerzeniem.** MS Project XML i Primavera P6 XML dostają tę samą nazwę *projectname.xml*. Nadaj im sam różne nazwy, inaczej później nie będziesz wiedzieć, który plik ma który format.

**Harmonogram z pętlą relacji nie jest eksportowany.** Aplikacja najpierw oblicza i zatrzymuje się, jeśli jest pętla. Na karcie *Start* zobaczysz komunikat *Nie udało się obliczyć harmonogramu*, a pod nim na przykład *Zależność cykliczna między zadaniami: Set up site → Demolish existing extension → Set up site*. W *Plik › Eksportuj* na stronie jest tylko ten drugi tekst. Usuń pętlę i eksportuj ponownie.

**Projekt z Primavery traci informacje źródłowe.** Jeśli eksportujesz taki projekt do CSV, MS Project XML lub P6 XML, aplikacja zgłasza: *Eksport do CSV powoduje utratę informacji źródłowych XER.* Dla MS Project XML komunikat mówi *MSPDI*, dla P6 XML *P6*. Zobacz [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen).

**Zadania podzielone tracą podziały.** MS Project i Primavera znają podział tylko jako rozkład godzin. Jeśli Twój projekt zawiera zadania podzielone bez rozkładu godzin, aplikacja po eksporcie do MS Project XML lub P6 XML zgłasza: *2 zadania z przerwami zostały wyeksportowane bez przerw: MS Project/P6 znają je tylko jako rozkład pracy.* Dla jednego zadania mówi: *1 zadanie z przerwami zostało wyeksportowane bez przerw: MS Project/P6 znają je tylko jako rozkład pracy.* Zobacz [Dzielenie zadania](docs://howto-taak-splitsen).

**Harmonogram w widoku *Daty zapisane*.** Jeśli eksportujesz do CSV, gdy widzisz daty z pliku źródłowego, aplikacja zostawia puste pola `Critical` i `Total Float` dla zadań, w których plik źródłowy tego nie zapisał. Zobacz [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen).

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): co zawiera każdy format, a czego nie.
- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): zachowanie samego projektu jako IFC.
- [Importowanie postępu z arkusza kalkulacyjnego](docs://howto-voortgang-importeren): wczytanie uzupełnionego arkusza postępu.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): dla każdego formatu, co się przenosi, a czego nie.
