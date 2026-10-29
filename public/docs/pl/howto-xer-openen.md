# Otwieranie pliku Primavera P6 (.xer)

Cel: otworzyć harmonogram z programu Primavera P6 bezpośrednio w aplikacji, bez wcześniejszego eksportu do XML.

## Kiedy tego potrzebujesz

Klient lub generalny wykonawca pracuje w Primaverze i dostarcza swój harmonogram jako plik `.xer`. Chcesz go obejrzeć, obliczyć albo coś do niego dodać. Aplikacja tylko odczytuje pliki `.xer`: nie zapisuje w formacie `.xer` i nigdy nie zmienia Twojego pliku. Z pliku pobiera strukturę WBS oraz zadania z czasem trwania, datami, ograniczeniami i postępem, relacje z opóźnieniami, kalendarze i zasoby z ich przydziałami, a także kody czynności, pola niestandardowe (UDF), notatki i ustawienia planowania P6. Zadanie typu *Level of Effort* staje się hamakiem.

## Kroki

1. Wybierz *Start › Plik › Otwórz* lub naciśnij Ctrl+O. Wybierz plik `.xer`.
2. Aplikacja otwiera jedną kartę dla każdego projektu, który ma zadania. Aktywną kartą jest projekt z największą liczbą zadań. Karta nosi nazwę *Nazwa projektu (ID projektu)*, jeśli ID projektu w P6 różni się od nazwy. Okno *Ustawienia projektu* pokazuje tylko nazwę. Jeśli zmienisz nazwę projektu, ID projektu zostaje za nią. Potem okno krótko wyjaśnia, co aplikacja przejęła z pliku i jak działa zapisywanie. Zobacz [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan).
3. Przeczytaj komunikat na dole. Dla pliku z trzema projektami może wyglądać tak: *Otwarto plik XER: 3 dokumenty projektu.* Pod nim są wiersze, które wyjaśniają, co aplikacja zrobiła. Zobacz nagłówek poniżej.
4. Sprawdź, czy pod wstążką jest komunikat: *Widzisz harmonogram tak, jak zapisał go Primavera; ponowne przeliczenie przesunęłoby 1 zadanie.* Primavera zapisuje w pliku własne, obliczone daty. Jeśli obliczenia aplikacji różnią się od nich, aplikacja pokazuje daty Primavery, dopóki niczego nie zmienisz. Zadanie, które się rozpoczęło lub zostało ukończone, zawsze ma swoje rzeczywiste daty, jak w Primaverze. Co to znaczy i jak przełączyć się na własne obliczenia aplikacji, opisuje [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen). Może też pojawić się komunikat *Ten plik zawiera planowanie godzinowe.* z przyciskiem *Włącz planowanie godzinowe*. Zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).
5. Zapisz projekt, naciskając Ctrl+S. Ponieważ plik `.xer` nigdy nie jest nadpisywany, aplikacja pyta, gdzie zapisać nowy plik IFC. Jako nazwę pliku podpowiada *Nazwa projektu (ID projektu)*.

### Wiersze pod komunikatem

Pierwszy wiersz komunikatu podaje liczbę otwartych kart. Pod nim są tylko wiersze, które dotyczą Twojego pliku. Zwróć na nie uwagę:

- *Ten projekt liczy się jako Primavera P6. Zmień to w Plik → Info o projekcie → Profil obliczeń i opcje.* Aplikacja oblicza ten projekt zgodnie z regułami obliczeń Primavery. Przyciskiem *Otwórz profil obliczeń* przechodzisz do tego ustawienia.
- *Wykluczono 1 projekt bazowy.* i *Utworzono 1 plan bazowy.* Jeśli projekt w P6 wskazuje inny projekt jako swój plan bazowy, ten drugi projekt nie otwiera się jako osobna karta. Staje się aktywnym planem bazowym projektu, który się do niego odwołuje.
- *Użyto ochronnego rozwiązania awaryjnego dla planu bazowego.* Jeśli wskazanie planów bazowych oznaczałoby, że nie otwiera się żaden projekt, jeśli projekt odwołuje się sam do siebie albo jeśli projekty odwołują się do siebie w pętli, aplikacja po prostu otwiera wszystkie projekty i nie tworzy planów bazowych.
- *Zachowano 1 relację zewnętrzną.* Relacja między dwoma projektami. Aplikacja zachowuje ją jako dane źródłowe, ale nie zamienia jej w relację w Twoim harmonogramie.
- *12 zadań pokazuje daty tak, jak zapisał je Primavera (bez ponownego przeliczenia).* Liczba zadań, dla których widok *Daty zapisane* pokazuje daty Primavery: każde zadanie, dla którego plik zapisał daty, a nie tylko te, które się różnią.

Pozostałe wiersze to diagnostyka samego odczytu. Nic od Ciebie nie wymagają:

- liczba znalezionych projektów;
- pominięty pusty projekt;
- zignorowane nieprawidłowe odwołanie do planu bazowego;
- kodowanie tekstu inne niż zwykły UTF-8 (komunikat podaje, które; dla tekstu arabskiego, cyrylicy lub greki aplikacja wybiera odpowiednią stronę kodową Windows, w pozostałych przypadkach Windows-1252);
- zadania bez planowanego początku (zaczynają się od daty statusu lub od początku projektu z pliku);
- liczniki uwag dotyczących tabel, kalendarzy i liczb, nieznanych wartości pól oraz ustawień planowania P6, które aplikacja zastąpiła bezpiecznym wyborem.

*Dowiedz się więcej* otwiera Pomoc o otwieraniu plików Primavery.

## Pułapki i co aplikacja wtedy robi

**Nie wszystko staje się kartą ani relacją.** Projekt bez zadań się nie otwiera, projekt bazowy nie otwiera się jako osobna karta, a relacja między dwoma projektami nie staje się relacją w harmonogramie. Aplikacja informuje o tym w wierszach pod komunikatem.

**Każda karta to osobny projekt.** Jeśli zapiszesz taki projekt, plik IFC zachowa razem z nim kompletny, oryginalny plik `.xer`. Jeśli później ponownie otworzysz ten plik IFC, aplikacja nadal zna daty Primavery. Jeśli to archiwum źródłowe jest uszkodzone albo inny program IFC przepisał plik, aplikacja zgłasza: *Archiwum źródłowe XER w tym pliku jest bezużyteczne i zostało pominięte; sam projekt otwarto w całości.* Harmonogram, profil obliczeń i wszystkie dane projektu są kompletne. Brakuje dat, które zapisała Primavera, oraz pochodzenia danych źródłowych dla AI i rozszerzeń. Otwórz ponownie oryginalny plik `.xer`, aby odzyskać archiwum.

**Plik IFC staje się większy.** Ponieważ plik IFC przenosi cały oryginalny `.xer`, jest większy niż plik IFC bez archiwum. Przy dużym pliku `.xer` widać to po rozmiarze pliku i po czasie zapisu. Jeśli plik `.xer` otwiera kilka projektów, każda zapisana karta przenosi cały `.xer`, nie tylko swój projekt.

**Eksport do CSV, MS Project XML lub P6 XML powoduje utratę danych.** Aplikacja ostrzega: *Eksport do CSV powoduje utratę informacji źródłowych XER.* Przy IFC nic nie ginie.

**Wolna sobota lub niedziela, której nie ma w pliku.** Aplikacja może taki dzień weekendu sam ustawić jako wolny. W kalendarzu nazywa się wtedy *Wyjątek kalendarzowy (odtworzenie weekendu)*. Zasady opisuje [Formaty importu i eksportu](docs://ref-import-exportformaten).

**Zapas do końca projektu, bez daty zakończenia.** Jeśli plik nie ma daty zakończenia, aplikacja wyłącza opcję *Licz zapas do daty zakończenia projektu*. Widać to w wierszu *N ustawień planowania P6 użyło bezpiecznych wartości zastępczych.* Szczegóły znajdziesz w [Formaty importu i eksportu](docs://ref-import-exportformaten).

**Ukończone zadania na dacie statusu.** Ukończone zadanie może w widoku *Daty zapisane* pokazywać się jako wąski pasek na dacie statusu. Nie jest to błąd w Twoim pliku. Wyjaśnienie i powiązaną konwencję znajdziesz w [Formaty importu i eksportu](docs://ref-import-exportformaten).

**Liczby z przecinkiem jako separatorem dziesiętnym.** Jeśli aplikacja nie może wiarygodnie ustalić separatora dziesiętnego, nie otwiera pliku. Tak nigdy nie otwiera się harmonogram z błędnie odczytanymi liczbami. Poproś nadawcę o nowy eksport.

**Plik, którego aplikacja nie może odczytać.** Dostajesz komunikat o błędzie z podaniem przyczyny. Kilka przykładów:

- *Ten plik XER jest nieprawidłowy lub nieobsługiwany.*
- *W tabeli XER brakuje wymaganych kolumn.*
- *Projekt P6 w tym pliku XER nie zawiera działań.*
- *Nie można wiarygodnie ustalić zapisu dziesiętnego w tym pliku XER.*

Wtedy nic się nie otwiera. Sprawdź plik w P6 albo poproś nadawcę o nowy eksport.

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): dlaczego plik `.xer` tylko się odczytuje i co gubi eksport.
- [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen): widok dat, które zapisała sama Primavera.
- [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen): to samo dla MS Project.
- [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten): gdy plik zawiera dane w godzinach.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): dla każdego formatu, co się przenosi, a czego nie.
- [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen): dlaczego plik P6 otwiera się z własnym profilem obliczeń.
