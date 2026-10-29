# Tworzenie i używanie układu

Cel: przełączać się jednym kliknięciem między widokami harmonogramu, na przykład tylko zadania krytyczne, zadania dla każdej ekipy albo inna kolejność sortowania.

## Kiedy tego potrzebujesz

Na spotkaniu na budowie klient chce zobaczyć tylko zadania krytyczne. Potem kierownik budowy chce zobaczyć dla każdej ekipy, kto jest potrzebny kiedy. Potem chcesz znowu cały harmonogram. Ustawianie filtrów, grup i kolejności sortowania raz po raz jest uciążliwe. **Układ** zapisuje taki widok jako przycisk na wstążce.

Układ może zapisać sześć rzeczy: filtr, grupowanie, sortowanie, kolumny tabeli zadań obok wykresu Gantt, skalę czasu oraz linie relacji i nakładki (plan bazowy, linia postępu, linia daty statusu, akcent zasobów, pasmo zapasu i kolory pasków). Po kliknięciu przycisku zmienia się tylko to, co zaznaczysz. Reszta widoku zostaje, jak jest.

Filtrujesz, grupujesz i sortujesz przez układ. Osobne przyciski *Filtr…*, *Grupuj…* i *Sortuj…* istnieją teraz tylko za ukrytym ustawieniem (zob. pułapki).

## Kroki

### Korzystanie z istniejącego układu

1. Wybierz zakładkę *Widok*. W grupie *Układ* jest przycisk dla każdego układu. Domyślnie jest to *Diagram zasobów*.
2. Kliknij go. *Diagram zasobów* grupuje zadania według zasobu, sortuje w każdej grupie według początku i wyłącza linie relacji. Zadanie z dwoma zasobami pojawia się pod obydwoma.
3. Kliknij ponownie, aby wyłączyć układ. Widok wraca do stanu sprzed kliknięcia.

Każde kliknięcie to jeden krok dla *Cofnij* (Ctrl+Z), zarówno włączanie, jak i wyłączanie.

### Tworzenie własnego układu

1. W grupie *Układ* kliknij *Nowy układ*. Otwiera się okno *Nowy układ*.
2. Wpisz nazwę w polu *Nazwa* i wybierz ikonę w polu *Ikona*.
3. Pod *Co zapisuje ten układ?* są sześć części z polem wyboru. Nowe okno zaczyna się z zaznaczonymi wszystkimi częściami, wypełnionymi tym, co widzisz teraz na ekranie. Odznacz wszystko, czego układ nie może zmieniać. Jeśli chcesz tylko filtr, zostaw włączony tylko *Filtr*. *Przejmij bieżący widok* wypełnia ponownie wszystkie części tym, co jest na ekranie.
4. Ustaw poszczególne części.
5. Kliknij *Zapisz*.

Układ jest teraz przyciskiem na wstążce, ale jeszcze nie jest zastosowany. Kliknij przycisk, aby go włączyć.

### Ustawianie filtra

Pod *Filtr* tworzysz reguły. Kliknij *+ reguła*, wybierz *Pole*, *Operator* i wartość. Jeśli chcesz tylko zadania krytyczne: pole *Krytyczne*, operator *równa się*, wartość *Tak*. Pola to między innymi *Nazwa zadania*, *Początek*, *Zakończ*, *Zapas całkowity*, *Postęp* i *Kamień milowy*, plus Twoje własne kody czynności i pola oraz *Zasoby*. Operatory zależą od rodzaju pola: dla tekstu możesz wybrać *zawiera*, dla liczb i dat *pomiędzy*.

Dostępne operatory zależą od rodzaju pola:

- Tekst (*Nazwa zadania*, *WBS*): *równa się*, *różne od*, *zawiera*, *zaczyna się od* i *jest puste*.
- Liczba i data (*Zapas całkowity*, *Początek*, *Postęp*): *równa się*, *różne od*, *mniejsze niż*, *mniejsze lub równe*, *większe niż*, *większe lub równe*, *pomiędzy* i *jest puste*. Przy *pomiędzy* są dwa pola: dla liczby z podpowiedziami *Od* i *Do*, dla daty bez podpowiedzi (pierwsza data to początek, druga to koniec).
- Tak/nie (*Krytyczne*, *Kamień milowy*, *Prawie krytyczne*): *równa się* i *różne od*, z wartością *Tak* lub *Nie*.
- Wybór (*Rodzaj robót*, kod czynności): *równa się*, *różne od*, *jest jednym z* (z wartościami z polami wyboru) i *jest puste*.
- *Zasoby*: *jest jednym z* i *jest puste*.
- *W toku*: tylko *pomiędzy*, z dwiema datami (od i do).

Z polem *W toku*, operatorem *pomiędzy* i dwiema datami dostajesz wszystkie zadania, które trwają w dowolnym momencie tego okresu, na przykład wszystko aktywne w czerwcu.

Kilka reguł łączysz z listą na górze: *Wszystkie poniższe (AND)* pokazuje zadania, które spełniają wszystkie reguły, *Dowolne z poniższych (OR)* zadania, które spełniają co najmniej jedną regułę. Z *+ grupa* dodajesz podgrupę z własnymi regułami.

Filtr patrzy na same zadania. Fazy (zadania sumaryczne), pod które podpada takie zadanie, pozostają widoczne na szaro, dzięki czemu widzisz, gdzie zadanie należy. Jeśli dodatkowo grupujesz, te szare fazy znikają.

### Grupowanie i sortowanie

Pod *Grupuj* dodajesz pole przyciskiem *+ poziom*. Są najwyżej dwa poziomy grupowania. Bez grupowania widzisz drzewo WBS. Pod *Sortuj* dodajesz pole przyciskiem *+ poziom* i wybierasz *Rosnąco* albo *Malejąco*. Przy dwóch poziomach drugi poziom rozstrzyga, gdy wartości na pierwszym są równe.

### Szybkie wypróbowanie bez przycisku

W oknie kliknij *Zastosuj bez zapisywania*. Zaznaczone części trafiają na ekran, ale nie dodaje się żadnego przycisku. To wygodne przy filtrze, którego potrzebujesz tylko raz. Ctrl+Z to cofa.

### Zmiana, kopiowanie lub usuwanie układu

Kliknij prawym przyciskiem myszy przycisk układu. Wybierasz *Edytuj…*, *Duplikuj* albo *Usuń*. *Usuń* najpierw pyta o potwierdzenie. Kopia nazywa się *nazwa (kopia)*. Wbudowanego układu, na przykład *Diagram zasobów*, nie możesz edytować ani usuwać; duplikujesz go, aby zrobić własną wersję.

### Więcej niż jeden układ naraz

Układy, które nie zapisują tych samych części, mogą być włączone razem. Jeśli masz układ, który zapisuje tylko filtr *Krytyczne równa się Tak* (nazwij go na przykład *Tylko krytyczne*), i włączysz go razem z *Diagram zasobów* (grupowanie, sortowanie, linie relacji), zobaczysz zadania krytyczne pogrupowane według zasobu. Jeśli oba układy zapisują tę samą część, na przykład filtr, drugi przejmuje ją, a pierwszy się wyłącza. Jeśli wyłączysz ten drugi, wrócisz do widoku sprzed pierwszego kliknięcia, nie do pierwszego układu.

## Pułapki i co robi aplikacja

**Zapomnisz odznaczyć części.** Układ, który zapisuje też kolumny, skalę czasu i nakładki, przy każdym kliknięciu przywraca je do zapisanego stanu. Twoje powiększenie wtedy przeskakuje, choć chciałeś tylko filtr. Sprawdź w oknie, czy zaznaczone są tylko części, które chcesz.

**Niekompletna reguła nic nie pokazuje.** Jeśli nie wybierzesz wartości dla pola tak/nie (nadal jest tam *—*) albo zostawisz puste daty *W toku*, żadne zadanie nie pasuje i lista pozostaje pusta. Uzupełnij regułę.

**Ręczna zmiana wyłącza układ.** Jeśli sam zmienisz część, którą układ zapisuje, na przykład *Linie relacji*, gdy jest włączony *Diagram zasobów*, ten układ się wyłącza, a pozostałe części wracają do widoku sprzed układu. Powiększanie wyłącza układ, który zapisuje skalę czasu, a poszerzenie kolumny wyłącza układ, który zapisuje kolumny. Reszta widoku zostaje wtedy jak jest. Diagram zasobów nie zapisuje skali czasu, więc powiększanie na niego nie wpływa.

**Kolumny dotyczą tabeli zadań obok wykresu Gantt.** Część *Kolumny* zapisuje kolumny tabeli po lewej stronie osi czasu. Tabela na zakładce *Tabela* ma własne kolumny. Jak wybierasz kolumny, opisano w [Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen).

**Wcięcie i zmniejszanie wcięcia są wyłączone.** Dopóki filtr, grupowanie lub sortowanie jest włączone, wyświetlana kolejność nie jest kolejnością harmonogramu. *Wcięcie* i *Zmniejsz wcięcie* są wtedy wyłączone, z podpowiedzią *Niedostępne podczas filtrowania/grupowania/sortowania*. Wyłącz układ, aby znowu zmienić strukturę, jak opisano w [Dostosowywanie struktury](docs://howto-structuur-aanpassen).

**Pasek stanu nie podąża za widokiem.** Pole *Zadania:* na pasku stanu pokazuje liczbę zadań całego projektu, nawet gdy filtr pokazuje tylko ich część.

**Układy są zapisane na Twoim urządzeniu, nie w projekcie.** Aplikacja trzyma Twoje układy i kolumny dla wszystkich projektów na tym urządzeniu. Nakładki z układu (plan bazowy, linia postępu i reszta) działają we wszystkich Twoich projektach. Filtr, grupowanie i sortowanie, które są właśnie włączone, należą do otwartego projektu, ale nie trafiają do pliku projektu: po zapisaniu i ponownym otwarciu widok jest znów czysty. Nie sprawiają też, że projekt wygląda na zmieniony.

**Osobne przyciski są ukryte.** *Kolumny…*, *Filtr…*, *Grupuj…* i *Sortuj…* jako osobne przyciski na zakładce *Widok* to starszy widok. Przywrócisz je opcją *Pokaż klasyczne przyciski widoku* w sekcji *Funkcje starszego typu* na zakładce *Zaawansowane* w oknie *Ustawienia aplikacji* (⚙ na pasku tytułu). Lepiej używaj układów.

## Zobacz także

- [Dostosowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen): wybieranie, przesuwanie i przypinanie samych kolumn.
- [Tworzenie i drukowanie raportu](docs://howto-rapport-maken-en-afdrukken): widok na papierze, z opcją *Śledź widok*.
- [Dostosowywanie struktury](docs://howto-structuur-aanpassen): dlaczego nie możesz zwiększać wcięcia podczas filtrowania.
