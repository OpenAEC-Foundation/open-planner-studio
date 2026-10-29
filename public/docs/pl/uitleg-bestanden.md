# Pliki i formaty

Jakie dane naprawdę zawiera plik, który zapisujesz? A co się dzieje z harmonogramem, gdy eksportujesz go do innego pakietu? W tym artykule czytasz, jak aplikacja obsługuje pliki: IFC jako własny format, inne formaty jako tłumacze, co eksport pomija oraz czym różnią się zapisywanie, AutoSave i odzyskiwanie po awarii. Przykład na końcu pokazuje na liczbach, co robi eksport.

## Koncepcja

Open Planner Studio ma jeden własny format pliku: **IFC**, otwarty format wymiany informacji o budowie od buildingSMART. Aplikacja zapisuje schemat IFC projektu, domyślnie IFC 4.3 ADD2 (zobacz [Wybór schematu IFC](docs://howto-ifc-schema-kiezen)). Na liście eksportu nazywa się *IFC*. Nie ma drugiego, zastrzeżonego pliku projektu. *Zapisz* zapisuje cały projekt jako plik IFC (`.ifc`), a *Otwórz* odczytuje taki plik z powrotem. Chcesz zobaczyć, co trafia do pliku? Zakładka *IFC* to edytor, który pokazuje tekst IFC Twojego projektu. *Generuj IFC* odświeża ten tekst, a *Kopiuj* kopiuje go do schowka. Jeśli zmienisz tekst, *Zastosuj* wczyta go jako Twój projekt. To całkowicie zastępuje projekt w tej zakładce.

Wszystkie pozostałe formaty to **adaptery**: tłumacze między modelem innego programu a modelem aplikacji. Aplikacja odczytuje CSV, MS Project XML, Primavera P6 XML, pliki MS Project (`.mpp`) i pliki Primavera (`.xer`). Zapisuje CSV, MS Project XML, Primavera P6 XML oraz dwa arkusze postępu. Do `.mpp` ani `.xer` eksportować nie można.

Dlaczego to rozróżnienie ma znaczenie? Tłumacz może przenieść tylko to, co znają obie strony. Plik IFC aplikacji zachowuje wszystko, co należy do Twojego projektu. Każdy inny format nie zna części z tego. Ta część zostaje pominięta.

## Jak aplikacja obsługuje pliki

### Co robi otwieranie

Aplikacja wybiera czytnik według rozszerzenia: `.ifc`, `.csv`, `.xml`, `.mpp` lub `.xer`. Przy pliku `.xml` zagląda do środka, żeby zobaczyć, czy to MS Project XML, czy Primavera P6 XML. Nieznane rozszerzenie traktuje jako IFC. Jeśli plik nie jest IFC, aplikacja pokazuje *Nie udało się otworzyć pliku* z podaniem przyczyny.

Każdy plik otwiera się we własnej zakładce. Wyjątkiem jest zakładka, która jest nadal pusta i niezmieniona: ta zakładka przejmuje plik. Jeden plik Primavera może dać kilka zakładek, po jednej dla każdego projektu z zadaniami.

Po otwarciu aplikacja zawsze przelicza na nowo. Jeśli plik pochodzi z innego pakietu, daty mogą się różnić od tego, co zapisano w pliku. Opisuje to [Daty zapisane w pliku](docs://uitleg-datums-zoals-opgeslagen).

Tylko plik IFC staje się **celem zapisu**: plikiem, do którego *Zapisz* zapisuje z powrotem. Plik CSV, XML, `.mpp` ani `.xer` nim nie staje. Taki projekt po otwarciu nie ma pliku; *Zapisz* wtedy pyta, gdzie zapisać nowy plik IFC. Dzięki temu Ctrl+S nigdy nie nadpisze Twojego oryginalnego pliku tekstem IFC.

### Co zapisuje zapis

*Zapisz* zawsze zapisuje cały projekt. Do pliku trafia:

- zadania ze strukturą, czasem trwania, datami i postępem;
- relacje, opóźnienia, ograniczenia i terminy ostateczne;
- kalendarze, zasoby i przydziały, łącznie z krzywymi;
- plany bazowe, kody czynności, pola niestandardowe i notatki;
- relacje zewnętrzne do innych projektów;
- ustawienia projektu, na przykład datę statusu, profil obliczeń i opcje obliczeń;
- łącze do biblioteki zasobów.

To, co na ekranie ustawiasz, nie należy do projektu i nie trafia do pliku: powiększenie, pozycja przewijania, wybrane zadanie i zwinięte fazy. Ustawienia aplikacji, na przykład język i motyw, też nie są w pliku. Aplikacja przechowuje je sama, w aplikacji albo w przeglądarce.

Eksport do innego formatu nie zmienia Twojego projektu. Po eksporcie projekt ma nadal ten sam cel zapisu i nadal ma oznaczenie *Niezapisane*, jeśli miał je wcześniej.

### Co eksport gubi

Każdy adapter przenosi to, co zna jego format.

**MS Project XML** przenosi zadania, relacje, kalendarze, zasoby, przydziały, ograniczenia, terminy ostateczne i datę statusu. Z Twoich planów bazowych przenoszony jest tylko aktywny. Kody czynności, pola niestandardowe, notatki i relacje zewnętrzne nie są przenoszone. Drugie ograniczenie zadania nie jest przenoszone. Ograniczenie *Musi rozpocząć się (MSO)* albo *Musi zakończyć się (MFO)* bez wyboru *Obowiązkowe (twarde przypięcie)* wraca jako *Rozpocznij nie wcześniej niż (SNET)* albo *Zakończ nie wcześniej niż (FNET)*. *Planowane ręcznie* i *Opóźnienie bilansowania* zadania nie wracają. Hamak staje się zwykłym zadaniem z obliczonymi datami.

**Primavera P6 XML** przenosi zadania, relacje, kalendarze, zasoby, przydziały, ograniczenia i datę statusu. Plany bazowe i terminy ostateczne nie są przenoszone, podobnie jak kody czynności, pola niestandardowe, notatki i relacje zewnętrzne. Również tutaj hamak staje się zwykłym zadaniem. P6 nie zna opóźnienia w procentach: aplikacja zamienia takie opóźnienie na stałą liczbę dni. Opóźnienie w dniach kalendarzowych staje się opóźnieniem w dniach roboczych.

**CSV** to tabela zadań. Plik ma dla każdego zadania te kolumny: identyfikator zadania, WBS, poziom, nazwa, czas trwania, rozpoczęcie, zakończenie, poprzednicy, rodzaj robót, identyfikator niestandardowego rodzaju robót (`OPS Custom Task Type ID`), status, ukończenie, rzeczywiste rozpoczęcie i zakończenie, krytyczne, zapas całkowity i opis. Zasobów, przydziałów, kalendarzy, ograniczeń, terminów ostatecznych, planów bazowych i daty statusu w nim nie ma. Nagłówki kolumn są zawsze po angielsku.

**Tylko IFC przenosi profil obliczeń i opcje obliczeń.** Jeśli eksportujesz do CSV, MS Project XML lub Primavera P6 XML, profilu obliczeń nie ma w pliku. Z opcji obliczeń MS Project XML zapisuje co najwyżej próg krytyczny. Taki plik otwiera się ponownie jako *Open Planner Studio*. Jeśli Twój projekt liczył według *Primavera P6* albo *Microsoft Project*, na przykład dlatego, że pochodził z `.xer` lub `.mpp`, daty mogą się przez to przesunąć. Czym jest profil obliczeń, wyjaśnia [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen).

Jeśli Twój projekt pochodzi z pliku Primavera (`.xer`), nawet jeśli wcześniej zapisano go jako IFC, aplikacja po eksporcie do CSV, MS Project XML lub P6 XML pokazuje komunikat: *Eksport do CSV powoduje utratę informacji źródłowych XER.* Dla MS Project XML pokazuje *MSPDI* zamiast *CSV*, dla P6 XML pokazuje *P6*. Dla IFC ten komunikat się nie pojawia: plik IFC zachowuje też plik źródłowy Primavery. Zobacz [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen).

Aplikacja robi przy eksporcie jeszcze dwie rzeczy. Jeśli harmonogram jest nieaktualny, najpierw go przelicza, a dopiero potem eksportuje. Harmonogramu z cykliczną relacją między zadaniami nie eksportuje: dostajesz komunikat z pętlą, na przykład *Zależność cykliczna między zadaniami: Set up site → Demolish existing extension → Set up site*.

### Zapis, AutoSave i odzyskiwanie po awarii

To są trzy różne rzeczy. Wyglądają podobnie, ale zapisują w innym miejscu.

**Zapisz** to czynność, którą wykonujesz. Aplikacja zapisuje projekt do Twojego pliku i usuwa oznaczenie *Niezapisane*.

**AutoSave** jest domyślnie wyłączony, a włączasz go dla każdego projektu osobno. Aplikacja wtedy zapisuje bez okna do tego samego pliku przy każdej zmianie, najwyżej raz na dziesięć sekund. Działa to tylko wtedy, gdy projekt ma już plik. Zobacz [Włączanie AutoSave](docs://howto-automatisch-opslaan).

**Odzyskiwanie po awarii** jest zawsze włączone. Zaraz po każdej zmianie aplikacja zachowuje, najwyżej raz na dziesięć sekund, kopię odzyskiwania wszystkich otwartych projektów, również tych, których nie zmieniasz sam. Ta kopia nie znajduje się w pliku projektu: w aplikacji na komputer jest w folderze danych aplikacji, w przeglądarce w pamięci przeglądarki. Przy następnym uruchomieniu aplikacja tę kopię proponuje. Opisuje to [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash). Odzyskiwanie po awarii nigdy nie zapisuje do pliku projektu.

Ponieważ kopia powstaje najwyżej raz na dziesięć sekund, przy awarii możesz stracić ostatnie sekundy zmian.

### Komputer i przeglądarka

Aplikacja na komputer i wersja w przeglądarce robią z projektem to samo, ale zapisują pliki inaczej.

Na komputerze aplikacja pracuje z prawdziwymi ścieżkami. *Zapisz* zapisuje od razu do Twojego pliku. Zwykle aplikacja najpierw zapisuje do pliku tymczasowego obok (`.ops-save.tmp`), a dopiero potem zastępuje Twój plik. Dzięki temu awaria w połowie zapisu nie uszkodzi starego pliku. Jeśli zamkniesz aplikację ze zmianami, pyta przy każdym projekcie, czy chcesz zapisać. Przy czystym zamknięciu usuwa swoje kopie odzyskiwania.

W przeglądarce, która może zapisywać pliki, gdzie chcesz (na przykład Chrome i Edge), zobaczysz zwykłe okno otwierania i zapisywania. Potem *Zapisz* zapisuje od razu do pliku; przy pliku otwartym w aplikacji przeglądarka pyta raz o zgodę. Lista *Ostatnie* działa, ale tylko z nazwami plików.

W przeglądarce bez tej możliwości (na przykład Firefox) aplikacja otwiera plik przez okno wyboru i zapisuje przez pobieranie. Przy *Zapisz* komunikat *Zapisano jako pobrany plik: 'name.ifc' jest w folderze pobierania. …* wyjaśnia to raz na sesję. Przy *Zapisz jako* i eksporcie zobaczysz *Zapisano jako pobrany plik: 'name.ifc' znajduje się teraz w folderze pobierania. To środowisko nie pozwala aplikacji zapisywać bezpośrednio w wybranej lokalizacji.* Jeśli przeglądarka może pokazać okno zapisu, ale nie może zapisać z powrotem do pliku projektu, *Zapisz* za każdym razem pyta o miejsce. Również o tym komunikat wyjaśnia raz na sesję. *Plik › Ostatnie* istnieje, ale otwiera pustą stronę, a AutoSave nie jest dostępny. Ten sam komunikat dostajesz w każdym środowisku, które nie pozwala aplikacji zapisywać w wybranym miejscu.

## Przykład: eksport projektu przykładowego

Weź przykład *Refurbishment & Extension of a Family Home* (*Plik › Przykłady*). Ma 20 zadań, w tym 4 fazy i 2 kamienie milowe, oraz 16 relacji. Jest 6 zasobów z 8 przydziałami, 1 plan bazowy i łącze do *Demo resource library*. Zadanie *Demolish existing extension* ma ograniczenie *Rozpocznij nie wcześniej niż (SNET)* na 14 maja 2027, a *Handover inspection* ma termin ostateczny na 29 lipca 2027. Harmonogram kończy się 7 lipca 2027.

Tak wygląda projekt po powrocie z każdego formatu. Wynik zmierzono po ponownym otwarciu pliku eksportu:

- Plik IFC zwraca wszystko: 20 zadań, 16 relacji, 6 zasobów, 8 przydziałów, plan bazowy, ograniczenie, termin ostateczny i łącze do biblioteki zasobów. Harmonogram znowu kończy się 7 lipca 2027.
- Plik MS Project XML też zwraca wszystko, oprócz łącza do biblioteki zasobów. Harmonogram kończy się 7 lipca 2027.
- Plik Primavera P6 XML zwraca zadania, relacje, zasoby, przydziały i ograniczenie. Brakuje planu bazowego i terminu ostatecznego. Harmonogram nadal kończy się 7 lipca 2027, bo ograniczenie nadal w nim jest.
- Plik CSV zwraca 20 zadań i 16 relacji. Brakuje zasobów, przydziałów, planu bazowego, ograniczenia i terminu ostatecznego, a projekt nazywa się *CSV Import*. Bez ograniczenia zadania przesuwają się wcześniej: harmonogram kończy się 2 lipca 2027, o pięć dni kalendarzowych wcześniej.

Bez tego ograniczenia także sam przykład kończy się 2 lipca 2027. Różnica pochodzi więc z ograniczenia, którego plik CSV nie przenosi.

## Konsekwencje i nieporozumienia

**Eksport nie jest kopią bezpieczeństwa.** Tylko IFC zachowuje wszystko. Jeśli chcesz zachować projekt, zapisz go jako IFC. Eksportuj tylko wtedy, gdy ktoś potrzebuje innego formatu.

**Ponowne otwarcie eksportu nie zawsze daje ten sam harmonogram.** Aplikacja przy otwieraniu zawsze przelicza, z profilem obliczeń, który należy do formatu. Jeśli brakuje logiki, takiej jak ograniczenie w przykładzie CSV, albo profil liczy inaczej, wynik się zmienia.

**Eksport trafia też do *Ostatnie*.** Na komputerze i w przeglądarkach z dostępem do plików eksport trafia tam tak samo jak zapisany projekt (arkusze postępu nie). Jeśli go tam otworzysz, otworzy się jako import tego formatu.

**Zapisywanie to nie to samo co odzyskiwanie po awarii.** Odzyskiwanie po awarii pomaga, gdy aplikacja przestanie działać, ale nie zastępuje zapisu. Zapisz więc, zanim zamkniesz zakładkę albo aplikację.

## Zobacz także

- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): kroki dla otwierania, zapisywania i zapisywania jako.
- [Eksport](docs://howto-exporteren): wybór formatu i to, co dostajesz.
- [Daty zapisane w pliku](docs://uitleg-datums-zoals-opgeslagen): dlaczego zaimportowany harmonogram może pokazywać inne daty.
- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): co robi ograniczenie, a więc co znika, gdy go brakuje.
- [Relacje i opóźnienia](docs://uitleg-relaties): czym jest opóźnienie i jak aplikacja je liczy.
- [Tworzenie hamaka](docs://howto-hammock): czym jest hamak, który eksport zapisuje jako zwykłe zadanie.
- [Kody i pola niestandardowe](docs://howto-codes-en-velden): kody czynności i pola niestandardowe, które zachowuje tylko IFC.
- [Relacje zewnętrzne do innego projektu](docs://howto-externe-relaties): relacje zewnętrzne, których MS Project XML i Primavera P6 XML nie przenoszą.
- [Zapisywanie i zarządzanie planem bazowym](docs://howto-baseline-opslaan-en-beheren): plany bazowe, z których MS Project XML przenosi tylko aktywny.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): dla każdego formatu, co jest przenoszone, a co nie.
