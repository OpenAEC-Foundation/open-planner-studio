# Praca z kilkoma projektami naraz

Cel: mieć otwarte więcej niż jeden harmonogram, przełączać się między nimi i zamykać je osobno.

## Kiedy tego potrzebujesz

Pracujesz nad osiedlem mieszkaniowym w okolicy, ale spotkanie na budowie dotyczy także remontu budynku klubowego. Albo chcesz zachować wariant obok oryginału. Każdy projekt ma własną kartę, własne zadania, własne obliczenia i własny zakres czasu. Przełączenie zajmuje jedno kliknięcie i nic nie tracisz.

## Kroki

### Otwieranie drugiego projektu

1. Kliknij plus po prawej stronie kart (*Rozpocznij projekt*). Otwiera się okno *Rozpocznij projekt*.
2. Wybierz *Nowy projekt* dla pustego harmonogramu albo *Otwórz istniejący projekt*, aby wybrać plik. *Anuluj* zamyka okno.
3. Przy wyborze *Nowy projekt* wypełnij okno *Nowy projekt* i kliknij *Utwórz*.

Projekt pojawia się na własnej karcie i jest od razu aktywny. Także *Nowy* i *Otwórz* na wstążce, Ctrl+O oraz przykłady w *Plik › Przykłady* otwierają projekt w nowej karcie. Tylko świeży, pusty harmonogram, którego jeszcze nie ruszałeś, zostaje użyty ponownie zamiast dodania karty.

### Przełączanie między projektami

- Kliknij kartę projektu.
- Naciśnij Ctrl+1 do Ctrl+9 (⌘ zamiast Ctrl na macOS), aby przejść do projektu na tym miejscu w rzędzie, liczonym od lewej do prawej.
- Kliknij ikonę menu po lewej stronie kart (*Wszystkie projekty*). Przegląd *Otwarte projekty* pokazuje kafelek na każdy projekt z nazwą projektu, nazwą pliku (jeśli projekt ma plik), miniaturą harmonogramu, liczbą zadań, liczbą zadań krytycznych i datą zakończenia. Kliknij kafelek, aby tam przejść. Esc zamyka przegląd.

Każda karta ma kolorową kropkę, która należy do projektu. Karta z małą kropką obok ma niezapisane zmiany.

Jeśli karty nie mieszczą się w szerokości, między kartami a plusem pojawiają się dwie strzałki (*Przewiń karty do początku* i *Przewiń karty do końca*). Każde kliknięcie przesuwa karty o dwie pozycje. Strzałka jest szara, gdy jesteś już na początku albo na końcu. Możesz też przewijać karty kółkiem myszy. Wybrana karta zawsze sama przewija się do widoku.

### Zamykanie projektu

Kliknij krzyżyk obok nazwy na karcie (*Zamknij*) albo krzyżyk na kafelku w przeglądzie. Projekt bez zmian zamyka się od razu. Jeśli ma niezapisane zmiany, aplikacja pokazuje okno *Niezapisane zmiany* z trzema możliwościami:

- *Zapisz* zapisuje projekt i zamyka go.
- *Nie zapisuj* zamyka projekt i odrzuca zmiany.
- *Anuluj* zostawia projekt otwarty.

Jeśli przerwiesz zapisywanie, na przykład przez zamknięcie okna zapisu, projekt pozostaje otwarty.

Jeśli zamkniesz ostatni projekt, zostaje pusty harmonogram o nazwie *Nowy harmonogram*.

### Wybór stylu przełączania

Sposób przełączania możesz wybrać. Otwórz okno *Ustawienia aplikacji* ikoną koła zębatego w belce tytułu, przejdź do zakładki *Wygląd* i w ustawieniu *Styl przełączania dokumentów* wybierz:

- *Karty poziome*: domyślnie. Rząd kart pod wstążką.
- *Karty pionowe*: wąski panel po lewej stronie z przyciskiem na każdy projekt (pierwsze litery nazwy) i plusem. Gdy najedziesz na przycisk, zobaczysz nazwę, nazwę pliku, liczbę zadań, liczbę zadań krytycznych i datę zakończenia. Przycisk na górze otwiera przegląd.
- *Pigułka*: jedna pigułka w belce tytułu z nazwą aktywnego projektu i licznikiem, na przykład *2 otwarte*. Kliknij ją, aby otworzyć przegląd i tam przełączyć projekt.

Wszystkie trzy style otwierają ten sam przegląd, a Ctrl+1 do Ctrl+9 działa w każdym stylu.

## Na co uważać i co robi aplikacja

**Co należy do projektu, a co jest wspólne.** Każdy projekt ma własny widok: powiększenie i położenie, aktywny układ z filtrem, grupowaniem lub sortowaniem, widok podzielony, linie relacji i zwinięte fazy. Jeśli przejdziesz do innego projektu, zobaczysz tam jego własny widok. Wspólne dla wszystkich projektów są: wybrana zakładka na wstążce, minimapa, nakładki (nakładka planu bazowego, linia postępu i reszta), Twój wybór kolumn, Twoje układy i wybory raportów.

**Nie możesz przełączać projektów, gdy jest otwarte okno dialogowe.** Dopóki jest otwarte okno dialogowe, na przykład okno *Ustawienia aplikacji* albo okno zadania, Ctrl+1 do Ctrl+9 nic nie robią w aplikacji. W przeglądarce przełączają wtedy karty przeglądarki. Najpierw zamknij okno dialogowe. Niezastosowana zmiana w sekcji *Ustawienia projektu* w Backstage też blokuje przełączanie.

**Ctrl+1 do Ctrl+9 liczą według kolejności.** Skrót przechodzi do projektu na tym miejscu w rzędzie. Jeśli zamkniesz projekt, pozostałe miejsca przesuwają się w lewo. Jeśli masz otwartych więcej niż dziewięć projektów, do reszty dojdziesz tylko przez karty albo przegląd.

**Polecenie Oblicz i raporty dotyczą aktywnego projektu.** Oblicz (F5), *Eksportuj PDF* i raporty dotyczą projektu, który jest teraz aktywny.

## Zobacz też

- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): ustawienie widoku dla każdego projektu.
- [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken): raport aktywnego projektu.
