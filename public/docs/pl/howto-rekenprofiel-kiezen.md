# Wybieranie lub tworzenie profilu obliczeń

Cel: wybierz reguły obliczeń, których używa projekt. Wybierasz wbudowany profil albo tworzysz własny profil z własnymi konwencjami.

## Kiedy tego potrzebujesz

Otwierasz projekt, który musi się obliczać jak Primavera P6 lub Microsoft Project, albo chcesz jedną konwencję ustawić inaczej, niż robi profil. Czym jest profil i dlaczego daty mogą się przesunąć, opisano w [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen).

## Kroki

### Wybór profilu dla nowego projektu

1. Wybierz *Start › Plik › Nowy*. Otwiera się okno *Nowy projekt*.
2. Na liście rozwijanej *Profil obliczeń* wybierz profil: *Open Planner Studio*, *Primavera P6* lub *Microsoft Project*.
3. Utwórz projekt. Aplikacja zastępuje opcje obliczeń, które już wpisałeś, wartościami domyślnymi tego profilu.

### Zmiana profilu istniejącego projektu

1. Wybierz *Ustawienia › Projekt › Ustawienia projektu*. Możesz też wybrać *Plik › Ustawienia projektu*.
2. W bloku *Profil obliczeń i opcje* otwórz listę rozwijaną *Profil obliczeń* i wybierz inny profil.
3. Kliknij **Zastosuj**. Aplikacja od razu przelicza harmonogram, nawet gdy *Oblicz automatycznie* jest wyłączone. Jeśli zadania się przesunęły, aplikacja podaje ich liczbę.

Dopóki nie klikniesz *Zastosuj*, zmiana istnieje tylko w formularzu. Całą zmianę cofniesz jednym krokiem przez *Cofnij*. Zmiana profilu zmienia tylko konwencje; Twoje opcje obliczeń zostają bez zmian.

### Tworzenie własnego profilu

1. W bloku *Profil obliczeń i opcje* kliknij *Nowy profil* obok listy rozwijanej.
2. Wpisz nazwę. Aplikacja proponuje nazwę *Kopia* wybranego profilu, na przykład *Kopia Open Planner Studio*.
3. Kliknij *Utwórz*. Sekcja *Konwencje tego profilu* się rozwija.
4. Włącz lub wyłącz konwencje za pomocą pól wyboru. Ikona z literą i przy wierszu pokazuje wyjaśnienie tej konwencji. Konwencja, która różni się od bazy, dostaje etykietę *przywróć bazę*.
5. Kliknij **Zastosuj**. Dopiero wtedy projekt oblicza się z nowym profilem.

Trzech wbudowanych profili nie można zmienić. Ich konwencje są pokazane tylko dla informacji.

### Zapisywanie własnego profilu jako szablonu

1. Jeśli trzeba, nadaj własnemu profilowi inną nazwę w polu *Nazwa tego własnego profilu*.
2. Kliknij *Zapisz jako szablon*. Aplikacja informuje, że szablon został zapisany, albo podaje, dlaczego się to nie udało.
3. W innym projekcie w tej samej aplikacji szablon jest na liście rozwijanej *Profil obliczeń*.

Jeśli profil później różni się od szablonu, żółty blok to pokazuje. Wtedy wybierz *Aktualizuj szablon z tego projektu* albo *Aktualizuj z szablonu*.

Szablon usuwasz przyciskiem *Usuń szablon*. Aplikacja najpierw prosi o potwierdzenie.

## Sprawdzanie wyniku

- Blok *Profil obliczeń i opcje* pokazuje wybrany profil.
- Po kliknięciu *Zastosuj* aplikacja podaje liczbę przesuniętych zadań, na przykład *Po zastosowaniu przesunięto 4 zadania.*
- Pomarańczowy blok nad opcjami obliczeń mówi, że Twoje opcje obliczeń różnią się od domyślnych ustawień profilu. To często jest zamierzone. Jeśli jednak chcesz wrócić do domyślnych, kliknij *Użyj domyślnych ustawień …*.

## Pułapki i co robi aplikacja

**Daty się przesuwają.** Inny profil może faktycznie zmienić daty. Sprawdź wynik. Jeśli Ci się nie podoba, kliknij *Cofnij*: profil i daty wracają razem.

**Żółty blok po cofnięciu.** Jeśli klikniesz *Cofnij* albo *Ponów*, gdy otwarte jest okno *Ustawienia projektu*, blok podąża za stanem projektu. Jeśli sam coś już zmieniłeś w bloku, Twój wybór zostaje. Żółty blok wtedy mówi, że *Zastosuj* przywraca ten wybór.

**Może być najwyżej 100 szablonów.** Jeśli jest ich już 100, aplikacja nie zapisuje szablonu i to melduje. Najpierw usuń szablon. Pełny albo niedostępny magazyn danych aplikacji też pokazuje komunikat.

**Szablony należą do aplikacji, profil do projektu.** Projekt zawsze ma własną kopię profilu. Jeśli później zmienisz szablon, projekt się z nim nie zmieni.

**Ustawienia z pliku źródłowego.** Jeśli wybierzesz *Primavera P6* lub *Microsoft Project* dla projektu, który pochodzi z innego pliku, ustawienia z pliku źródłowego zostają. Tutaj nie możesz ich zmienić.

## Zobacz także

- [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen): czym jest profil i co robi z datami.
- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): wszystkie konwencje i opcje obliczeń w jednym miejscu.
- [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen): Retained Logic albo Progress Override, osobno od profilu.
