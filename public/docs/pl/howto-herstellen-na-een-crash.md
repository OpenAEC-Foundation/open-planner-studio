# Odzyskiwanie po awarii

Cel: odzyskaj swoją pracę, gdy aplikacja lub przeglądarka nieoczekiwanie przestała działać, a zmiany nie są jeszcze zapisane.

## Kiedy tego potrzebujesz

Laptop przestał działać, aplikacja się zawiesiła albo karta przeglądarki uległa awarii, a ostatnie zmiany nie były jeszcze zapisane. Jak tylko cokolwiek się zmieni, aplikacja w tle zachowuje kopie odzyskiwania wszystkich otwartych projektów, najwyżej raz na dziesięć sekund. Ta kopia jest oddzielna od pliku projektu. Czym różni się zapisywanie od automatycznego zapisu, przeczytasz w [Pliki i formaty](docs://uitleg-bestanden).

## Kroki

1. Uruchom aplikację ponownie. W przeglądarce odśwież tę samą kartę: kopia odzyskiwania należy właśnie do tej jednej karty.
2. Jeśli aplikacja znajdzie kopie, pojawi się okno *Przywróć niezapisaną pracę*: *Open Planner Studio nie zostało zamknięte poprawnie. Poniższe dokumenty miały niezapisane zmiany, które można przywrócić:* dla każdego projektu okno pokazuje nazwę, ścieżkę do pliku, jeśli projekt ma plik (w przeglądarce tylko nazwę pliku), liczbę zadań i czas kopii, na przykład *21 zadań* i *Zapisano: Sep 29, 2026 9:41 AM*. Czas zależy od ustawienia *Format godziny*. Okno może też pokazywać projekty, których nie zmieniałeś.
3. Wybierz *Przywróć*. Aplikacja otwiera wszystkie projekty z listy, każdy w osobnej karcie, ze stanem ostatniej kopii. Klawisz Enter robi to samo.
4. Sprawdź swoje projekty i od razu zapisz je klawiszami Ctrl+S.

Jeśli nie chcesz przywracać, masz dwie możliwości. *Nie przywracaj* usuwa kopie, a tego nie da się cofnąć. Jeśli zamkniesz okno klawiszem Escape, krzyżykiem albo kliknięciem obok niego, kopie zostają, a aplikacja zapyta ponownie przy następnym uruchomieniu.

Znak zapytania w prawym górnym rogu okna otwiera ten artykuł bez podejmowania decyzji. Gdy czytasz w Pomocy, okno czeka. Gdy wrócisz, okno pojawi się ponownie, a Ty nadal możesz przywrócić pracę.

## Pułapki i co wtedy robi aplikacja

**Otrzymujesz stan ostatniej kopii.** Zmiany z ostatnich sekund przed awarią mogą brakować. Projekt, który miał zmiany, jest znowu oznaczony jako *Niezapisane*. Historia *Cofnij* jest pusta: nie możesz cofnąć kroków sprzed awarii. Powiększenie, pozycja przewijania i zaznaczenie są odtwarzane od nowa.

**W aplikacji na komputerze odzyskany projekt zachowuje swój plik, w przeglądarce nie.** W aplikacji na komputerze *Zapisz* zapisuje do oryginalnego pliku, z odzyskanym stanem. W przeglądarce odzyskany projekt nie jest już powiązany ze swoim plikiem: *Zapisz* pyta, gdzie plik ma zostać zapisany. Przełącznik *Automatyczny zapis* jest wtedy też wyszarzony, dopóki raz nie zapiszesz projektu.

**Projekt w widoku *Daty zapisane* zostaje w tym widoku.** Zobacz [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen).

**W aplikacji na komputerze okno nie pojawia się przy każdym uruchomieniu.** Kopie odzyskiwania znajdują się w folderze danych aplikacji, jako pliki IFC, których nazwa zaczyna się od *recovery*. Jeśli zamkniesz aplikację w zwykły sposób, sama usuwa swoje kopie. Dlatego okno pojawia się po nieoczekiwanym zakończeniu, po ponownym uruchomieniu w związku z aktualizacją aplikacji albo gdy przy poprzednim uruchomieniu odłożono odzyskiwanie.

**W przeglądarce kopia jest zachowywana osobno dla każdej karty.** Kopia znajduje się w pamięci przeglądarki. Nowa karta lub nowe okno nie pokazuje kopii innej karty. Kopie kart, które już nie istnieją, są usuwane po siedmiu dniach, gdy aplikacja znowu zapisze kopie.

**W przeglądarce okno pojawia się także po zwykłym odświeżeniu.** Dzieje się tak nawet wtedy, gdy wszystko zapisano. Jeśli zapis nastąpił tuż przed odświeżeniem i po nim nic nie zmieniono, możesz bezpiecznie wybrać *Nie przywracaj*: Twój plik jest aktualny.

**Okno nie pojawia się.** Wtedy aplikacja nie znalazła żadnej kopii. Tak jest, gdy nic jeszcze nie zmieniono, gdy używasz nowej karty w przeglądarce, gdy wcześniej wybrano *Nie przywracaj*, albo gdy awaria nastąpiła, zanim aplikacja zachowała pierwszą kopię: może to potrwać do około dziesięciu sekund po pierwszej zmianie.

**Kopia jest uszkodzona.** Aplikacja zgłasza *Nie udało się odczytać odzyskanego pliku* wraz z przyczyną i proponuje pozostałe projekty. Jeśli wybierzesz *Przywróć*, aplikacja potem usuwa wszystkie kopie, także tę, której nie da się odczytać. Jeśli żadna kopia nie jest czytelna, okno się nie pojawia, a kopie zostają.

**Przywracanie się nie udaje.** Aplikacja zgłasza *Nie udało się przywrócić* wraz z przyczyną. Kopie zostają, a pytanie wraca przy następnym uruchomieniu.

**Niektórych projektów nie da się wczytać.** Aplikacja zgłasza: *2 pliki odzyskiwania nie mogły zostać wczytane i zostały pominięte*. Przy jednym pliku aplikacja zgłasza *1 plik odzyskiwania nie mógł zostać wczytany i został pominięty*. Pozostałe projekty zostają przywrócone. Ponieważ coś zostało pominięte, wszystkie kopie zostają, a okno wraca przy następnym uruchomieniu z tą samą listą. Wybierz wtedy *Nie przywracaj*, gdy wszystko, co dało się odzyskać, już masz z powrotem.

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): zapisywanie, automatyczny zapis i odzyskiwanie po awarii obok siebie.
- [Włączanie automatycznego zapisu](docs://howto-automatisch-opslaan): pozwalasz aplikacji samej aktualizować Twój plik.
- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): zapisywanie po odzyskaniu.
- [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen): co dzieje się z projektem w tym widoku.
