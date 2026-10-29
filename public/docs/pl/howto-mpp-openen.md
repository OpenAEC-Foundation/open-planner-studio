# Otwieranie pliku MS Project (.mpp)

Cel: otworzyć harmonogram z Microsoft Project bezpośrednio w aplikacji, bez wcześniejszego eksportu.

## Kiedy tego potrzebujesz

Wykonawca, konsultant lub klient wysyła Ci swój harmonogram jako plik `.mpp`. Chcesz go przejrzeć, obliczyć lub dalej rozwijać. Aplikacja odczytuje pliki `.mpp` z MS Project 2010 do wersji 2021 włącznie. Tylko odczytuje: nie zapisuje plików `.mpp` i nigdy nie zmienia Twojego pliku. Z pliku bierze sam harmonogram: zadania ze strukturą, czasem trwania i ograniczeniami, relacje z opóźnieniem, kalendarze, zasoby, przydziały i postęp. Odczytuje też daty i zapas, które obliczył sam MS Project, ale używa ich tylko w widoku *Daty zapisane*, nigdy jako danych wejściowych.

## Kroki

1. Wybierz *Start › Plik › Otwórz* lub naciśnij Ctrl+O. Wybierz plik `.mpp`.
2. Projekt otwiera się w nowej karcie albo w bieżącej, jeśli była jeszcze pusta i niezmieniona. Projekt nie ma pliku: *Zapisz* zapisze później nowy plik IFC. Potem okno krótko wyjaśnia, co aplikacja przejęła z pliku i jak działa zapisywanie; zobacz [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan).
3. Przeczytaj komunikat na dole: *Ten projekt liczy się jako Microsoft Project. Zmień to w Plik → Info o projekcie → Profil obliczeń i opcje.* Aplikacja oblicza ten projekt według reguł obliczeń MS Project: profilu obliczeń *Microsoft Project*. Przyciskiem *Otwórz profil obliczeń* przechodzisz do tego ustawienia. *Dowiedz się więcej* otwiera Pomoc o profilach obliczeń.
4. Sprawdź, czy pod wstążką jest pasek komunikatu: *Widzisz daty takie, jak zostały zapisane w pliku; ponowne przeliczenie przesunęłoby 4 zadania.* Wtedy wynik aplikacji dla tych zadań różni się od dat, które zapisał MS Project. Pod komunikatem z kroku 3 pojawia się wtedy także wiersz: *4 zadania pokazują daty tak, jak zapisano je w pliku (bez ponownego przeliczenia).* Co to znaczy i jak przełączyć się na obliczenia aplikacji, znajdziesz w [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen).
5. Jeśli pojawi się *Ten plik zawiera planowanie godzinowe.* z przyciskiem *Włącz planowanie godzinowe*, plik zawiera dane w godzinach. Zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).

Jeśli plik zawiera zadania z podziałem, bilansowaniem lub harmonogramem zależnym od zasobów, pojawia się kolejny komunikat, na przykład *Ten plik MS Project zawiera 3 zadania z podzielonym, wyrównanym lub zależnym od zasobów harmonogramem. Są one importowane i wyświetlane w takiej postaci.* Przy jednym zadaniu komunikat jest w liczbie pojedynczej.

## Pułapki i co wtedy robi aplikacja

**Nie wszystko zostaje przeniesione.** Po otwarciu aplikacja w jednym komunikacie mówi, czego nie przejęła: *Nie wszystko z tego pliku MS Project zostało zaimportowane.* Pod nim jest jeden wiersz na każdą pozycję, z liczbą, na przykład *2 plany bazowe nie zostały zaimportowane.* Przy pliku `.mpp` zdanie o profilu obliczeń z kroku 3 jest wtedy pierwszym wierszem tego komunikatu. Komunikat zostaje, aż klikniesz krzyżyk. Jeśli nic nie przepadło, nie dostajesz tego komunikatu. Wiersz może dotyczyć:

- wstawionych projektów (podprojektów): aplikacja odczytuje je jako zwykłe zadanie, bez połączenia z innym plikiem;
- zadań zewnętrznych z innego projektu: aplikacja odczytuje je jako zwykłe zadanie;
- planów bazowych: z pliku `.mpp` aplikacja nie przejmuje żadnego planu bazowego, z eksportu XML z MS Project tylko Plan bazowy 0 zadań, a z niego tylko daty i czas trwania (dla zadania w godzinach także czas; bez pracy i kosztu oraz bez planów bazowych zasobów i przydziałów);
- przy eksporcie XML z MS Project: przydział, którego plan bazowy ma inne daty niż jego zadanie. Aplikacja zachowuje tylko plan bazowy zadania; jeśli daty są takie same, nic nie przepada i aplikacja nic nie zgłasza. Inna godzina tego samego dnia też liczy się jako różnica;
- pola niestandardowe z wartościami, w tym wartości z tabeli wyszukiwania i kody struktury (aplikacja nie liczy pól tak/nie w pliku `.mpp`);
- notatki (także notatka zawierająca tylko obraz) przy zasobach i przydziałach, a z pliku `.mpp` także przy zadaniach (z eksportu XML z MS Project notatka zadania przechodzi jako jego opis);
- hiperłącza;
- koszty stałe zadań;
- stawki zasobów: z pliku `.mpp` żadna stawka, z eksportu XML z MS Project tylko stawka standardowa;
- tylko przy eksporcie XML z MS Project: zadania planowane ręcznie (aplikacja planuje je automatycznie), nieaktywne zadania (są uwzględniane w obliczeniach) i opóźnienie bilansowania;
- tylko przy pliku `.mpp`: próg krytyczności z MS Project; aplikacja używa progu 0.

Kod WBS, który sam wpisałeś w MS Project, zostaje przejęty. W przeciwnym razie aplikacja numeruje zadania zgodnie ze strukturą.

**Plik z MS Project 2007 lub starszy.** Aplikacja go odrzuca i zgłasza: *Ten plik .mpp używa starszego formatu (Project 2007 lub starszy). Wyeksportuj go w MS Project jako XML (Plik → Zapisz jako → XML) i otwórz ten plik.* Pod komunikatem aplikacja dodaje techniczny powód po angielsku.

**Plik z hasłem.** Aplikacja zgłasza: *Ten plik .mpp jest zabezpieczony hasłem. Wyeksportuj go w MS Project jako XML (Plik → Zapisz jako → XML) i otwórz ten plik.* Także tutaj komunikat zawiera techniczny powód po angielsku.

**Plik, który nie jest plikiem `.mpp`.** Pojawia się *Nie udało się otworzyć pliku*, z technicznym powodem.

**Ścieżka przez XML liczy inaczej.** Jeśli otworzysz eksport XML z MS Project zamiast pliku `.mpp`, aplikacja oblicza według profilu obliczeń *Open Planner Studio* i nie zobaczysz komunikatu o *Microsoft Project*. Daty mogą wtedy wyjść inaczej niż przy pliku `.mpp`. Także przy eksporcie XML aplikacja mówi, czego nie przejmuje; zobacz *Nie wszystko zostaje przeniesione*.

**Edycja zwalnia sterowanie z MS Project.** Jeśli edytujesz zadanie, którego harmonogram sterowany był oknem dat MS Project, aplikacja zgłasza to raz na projekt: *2 zadania straciły powiązanie z rozkładem godzin z MS Project po tej edycji; pierwotny rozkład pozostaje zachowany w pliku.* Przy jednym zadaniu komunikat jest w liczbie pojedynczej.

**Zapisywanie nigdy nie nadpisuje Twojego pliku `.mpp`.** Projekt nie ma pliku. *Zapisz* pyta, gdzie zapisać nowy plik IFC.

## Zobacz też

- [Pliki i formaty](docs://uitleg-bestanden): dlaczego plik `.mpp` jest tylko odczytywany i co zapisuje zapis.
- [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen): widok dat, które zapisał sam MS Project.
- [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten): gdy plik zawiera dane w godzinach.
- [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen): to samo dla Primavera.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): przy każdym formacie: co zostaje przeniesione, a czego nie.
- [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen): dlaczego plik MS Project otwiera się z własnym profilem obliczeń.
