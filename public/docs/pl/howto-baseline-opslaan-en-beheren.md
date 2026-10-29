# Zapisywanie i zarządzanie planem bazowym

Cel: zapisać harmonogram jako ustalenie (plan bazowy), żeby później zobaczyć, jak bardzo wykonanie odbiega, oraz zachować, zmienić nazwę, wybrać i usunąć kilka planów bazowych.

## Kiedy tego potrzebujesz

Plan bazowy zapisujesz, gdy harmonogram jest zatwierdzony, a roboty jeszcze się nie rozpoczęły. Jeśli harmonogram zostanie później formalnie zmieniony, na przykład po zleceniu zmiany, zapisz drugi plan bazowy i zachowaj pierwszy. Tak mierzysz wykonanie względem pierwszego ustalenia i względem zmienionego. Dokładnie to, co zapisuje plan bazowy, i sposób, w jaki aplikacja oblicza odchylenie, wyjaśnia [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang).

## Kroki

### Zapisywanie planu bazowego

1. Naciśnij **Oblicz** (F5), na przykład przez *Planowanie › Harmonogram › Oblicz*. Plan bazowy zapisuje daty, które są obliczone w tym momencie.
2. Wybierz *Planowanie › Plan bazowy i postęp › Zarządzaj planem bazowym…*. Otwiera się okno *Plan bazowy*.
3. W części *Zapisz nowy plan bazowy* jest proponowana nazwa, na przykład *Plan bazowy 1 — (dzisiejsza data)*. Wpisz własną nazwę, którą później rozpoznasz, na przykład *Plan bazowy*.
4. Kliknij *Zapisz*. Plan bazowy jest teraz na liście i od razu staje się aktywnym planem bazowym.
5. Kliknij *Zamknij*.

Pod każdym paskiem zadania w wykresie Gantt jest teraz cienki pasek z datami planu bazowego. Kamień milowy dostaje mały romb. Tę nakładkę włączasz lub wyłączasz za pomocą *Widok › Plan bazowy i postęp › Nakładka planu bazowego*.

### Wybieranie aktywnego planu bazowego

Otwórz *Zarządzaj planem bazowym…* i wybierz w kolumnie *Aktywny* plan bazowy, z którym chcesz porównać. Dopóki są plany bazowe, dokładnie jeden jest aktywny. Z niego korzystają: nakładka w wykresie Gantt, typ raportu *Variance* i *Raport postępu*.

### Zmiana nazwy planu bazowego

Zmień nazwę na liście. Zmiana działa od razu. Nie musisz klikać *Zapisz*.

### Usuwanie planu bazowego

Kliknij mały kosz obok planu bazowego na liście. Jeśli usuniesz aktywny plan bazowy, aplikacja zapyta *Usunąć aktywny plan bazowy?*. Potem najnowszy pozostały plan bazowy staje się aktywnym. Jeśli nie ma innego, nie ma już aktywnego planu bazowego i nakładka znika. Naciśnij Ctrl+Z, aby przywrócić usunięty plan bazowy. Najpierw zamknij okno; Ctrl+Z nie działa w oknie.

### Odchylenia w tabeli zadań

Każdy plan bazowy ma sześć kolumn w tabeli zadań. Kliknij **+** z prawej strony nagłówka tabeli zadań (*Dodaj kolumnę*) i otwórz kategorię *Plan bazowy*. Dla każdego planu bazowego są kolumny *Planowane rozpoczęcie*, *Planowane zakończenie*, *Czas trwania*, *Odchylenie rozpoczęcia*, *Odchylenie zakończenia* i *Odchylenie czasu trwania*. Przed nazwą kolumny stoi nazwa planu bazowego, na przykład *Plan bazowy — Odchylenie zakończenia*. Odchylenia są podawane w dniach roboczych: plus oznacza późniejszy termin, minus wcześniejszy. Zadanie, którego nie ma w planie bazowym, pokazuje w tych kolumnach myślnik (—).

## Pułapki i co robi aplikacja

**Nieaktualny harmonogram.** Jeśli harmonogram jest nieaktualny, okno pokazuje *Harmonogram jest nieaktualny — najpierw przelicz (F5)*. To jest ostrzeżenie; zapisanie nadal jest możliwe. Wtedy jednak zapisujesz stare daty. Zamknij okno, naciśnij **Oblicz** i dopiero potem zapisz.

**Plan bazowy z postępem.** Jeśli zapiszesz plan bazowy po wprowadzeniu postępu, zapisuje on stan, w którym są rzeczywiste daty. Odchylenie wynosi wtedy zero i nie mówi już nic o wykonaniu. Zapisz plan bazowy, zanim roboty się rozpoczną.

**Plan bazowy nie może zostać zaktualizowany.** Jeśli chcesz zrewidować ustalenia, zapisz nowy plan bazowy i w razie potrzeby usuń stary.

**⚠ przy *Czas trwania* lub *Odchylenie czasu trwania*.** Dla zadania w godzinach jeden dzień to godziny pracy jego kalendarza. Jeśli kalendarz ma własną liczbę godzin na dzień (na przykład 8 przy pasmach po 10 godzin, z Primavera P6), starsza wersja aplikacji liczyła dni inaczej. Plan bazowy z tej wersji zachowuje stary wynik: zadanie 1870 godzin to 233,75 dnia w planie bazowym, a teraz 187 dni. Aplikacja nie zmienia takiego planu bazowego. Kolumny *Czas trwania* i *Odchylenie czasu trwania* tego planu bazowego pokazują wtedy ⚠; wskaż go, aby zobaczyć wyjaśnienie. Daty planu bazowego są poprawne. Zapisz nowy plan bazowy i w razie potrzeby usuń stary.

**Tylko zadania bez podzadań.** Faza nie jest w planie bazowym: nie ma paska planu bazowego ani odchylenia. Faza wynika z zadań poniżej niej.

**Nowe i usunięte zadania.** Zadanie dodane po zapisaniu nie ma paska planu bazowego. W raporcie *Variance* pojawia się jako *Nowe*. Zadanie, które usuniesz, pojawia się jako *Usunięte*.

**Przesuń projekt.** W oknie *Przesuń projekt…*, gdy są plany bazowe, jest pole wyboru *Przesuń także plany bazowe*. Domyślnie jest ono wyłączone: plany bazowe nie są przesuwane, więc przesunięcie widać jako odchylenie. Zobacz [Przesuwanie projektu](docs://howto-project-verplaatsen).

**Zapisane w pliku projektu.** Plany bazowe i wybór aktywnego planu zapisują się razem z projektem i wracają po otwarciu pliku.

## Zobacz także

- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): co zapisuje plan bazowy i jak oblicza się odchylenie.
- [Przesuwanie projektu](docs://howto-project-verplaatsen): pole wyboru *Przesuń także plany bazowe*.
- [Aktualizowanie postępu](docs://howto-voortgang-bijwerken): wprowadzanie rzeczywistego stanu, który porównujesz z planem bazowym.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): jeden plan bazowy (*Baseline at start*) przed rozpoczęciem, z postępem i datą statusu 20 maja 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dwa plany bazowe, *Contract* i *Re-baseline (variation order)*, z postępem i datą statusu 5 lipca 2027.
