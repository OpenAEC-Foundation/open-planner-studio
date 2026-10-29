# Relacje i opóźnienie

Dlaczego murowanie zaczyna się dopiero po wylaniu fundamentu? A dlaczego montaż dachu przesuwa się o tydzień, gdy elementy dachu są dostarczone późno? Wszystko zależy od relacji między Twoimi zadaniami. W tym artykule dowiesz się, jakie cztery rodzaje relacji zna aplikacja, co robią opóźnienie i wyprzedzenie, w jakim kalendarzu liczy się opóźnienie, co się dzieje z relacją na fazie i jak aplikacja ustala, która relacja wyznacza datę początku zadania.

Reguły i przykłady dotyczą nowego projektu z profilem obliczeń *Open Planner Studio* i tygodniem roboczym od poniedziałku do piątku.

## Pojęcie

**Relacja** określa, że dwa zadania zależą od siebie. Pierwsze zadanie to **poprzednik**, drugie to **następnik**. Relacja to dolna granica: następnik nigdy nie może zacząć się ani zakończyć wcześniej, niż relacja dopuszcza, ale może zacząć się lub zakończyć później. Jeśli zadanie ma kilku poprzedników, czeka na najpóźniejszą datę, która wynika ze wszystkich tych relacji.

Są cztery rodzaje. Różnią się tym, który moment poprzednika (początek lub zakończenie) jest powiązany z którym momentem następnika:

- **FS (zakończenie-rozpoczęcie).** Następnik zaczyna się dopiero wtedy, gdy poprzednik jest zakończony. Elementy dachu montuje się dopiero wtedy, gdy ściany są już postawione. To zdecydowanie najczęściej używana relacja.
- **SS (rozpoczęcie-rozpoczęcie).** Następnik zaczyna się dopiero wtedy, gdy poprzednik się rozpoczął. Zadania mogą na siebie zachodzić: prace rurowe można zacząć, gdy murowanie już trwa.
- **FF (zakończenie-zakończenie).** Następnik kończy się dopiero wtedy, gdy poprzednik jest zakończony. Spoinowanie nie może być wykonane przed zakończeniem murowania, ale może się zacząć wcześniej.
- **SF (rozpoczęcie-zakończenie).** Następnik kończy się dopiero wtedy, gdy poprzednik się rozpoczął. Ten rodzaj jest rzadki. Przykład: tymczasowe odwodnienie może się zakończyć dopiero wtedy, gdy rozpocznie się murowanie fundamentu.

Relacja może też mieć **opóźnienie**: czas oczekiwania między dwoma zadaniami, na przykład na to, aż beton dojrzeje. Ujemne opóźnienie nazywa się **wyprzedzeniem**: następnik zaczyna się wtedy, zanim poprzednik jest zakończony, więc zadania nachodzą na siebie.

## Jak aplikacja liczy

### Cztery rodzaje

Dla każdej relacji aplikacja oblicza najwcześniejszą datę, w której następnik może się zacząć, i bierze najpóźniejszą ze wszystkich relacji zadania. Bez opóźnienia działa to tak:

- Przy FS następnik zaczyna się w pierwszym dniu roboczym po zakończeniu poprzednika.
- Przy SS następnik zaczyna się tego samego dnia co poprzednik.
- Przy FF następnik kończy się tego samego dnia co poprzednik. Aby znaleźć początek, aplikacja liczy wstecz przez czas trwania następnika. Następnik trwający 3 dni robocze zaczyna się więc 2 dni robocze przed zakończeniem poprzednika.
- Przy SF następnik kończy się dnia, w którym zaczyna się poprzednik. Także tutaj aplikacja liczy wstecz przez czas trwania następnika.

Są to dolne granice. Następnik zaczyna się później, jeśli wymaga tego inna relacja lub ograniczenie. Wszystkie daty pojawiają się dopiero po uruchomieniu polecenia **Oblicz** (F5). Dopóki pasek stanu pokazuje *Nieaktualne — przelicz (F5)*, paski należą do poprzedniego obliczenia.

### Opóźnienie i wyprzedzenie

Opóźnienie można zapisać na cztery sposoby:

- W **dniach roboczych** (`3` lub `3d`): aplikacja pomija dni wolne i weekendy. To wartość domyślna.
- W **dniach kalendarzowych** (`3ed`, e oznacza *elapsed*, czyli czas, który mija): liczy się każdy dzień, także sobota i niedziela. To jednostka dla czegoś, co trwa dalej bez wykonywania prac, na przykład dojrzewanie betonu.
- Jako **procent** czasu trwania poprzednika (`40%`): aplikacja wylicza to przy każdym obliczeniu od nowa i zaokrągla do pełnych dni (2,5 dnia staje się 3).
- W **godzinach pracy** (`4h`): aplikacja liczy opóźnienie w kalendarzu zwłoki, domyślnie w kalendarzu poprzednika. Jeśli poprzednik to zadanie w dniach, a kalendarz nie ma własnych pasm godzin pracy, na przykład standardowy kalendarz, aplikacja zamienia godziny na pełne dni robocze, zaokrąglone do najbliższego pełnego dnia (pół dnia zaokrągla się w górę). Przy dniu roboczym trwającym 8 godzin `2h` i `3h` dają więc 0 dni, `4h` do `11h` włącznie daje 1 dzień, a `12h` daje 2 dni. Jeśli ten kalendarz ma własne pasma godzin pracy albo poprzednik to zadanie godzinowe, opóźnienie liczy się dokładnie w godzinach pracy.

Zasada dla opóźnienia N dni roboczych przy FS: N dni roboczych po zakończeniu poprzednika to czas oczekiwania, a następnik zaczyna się w dniu roboczym następującym po nich. Przy SS i FF opóźnienie dodaje się odpowiednio do początku i zakończenia poprzednika. Ujemne opóźnienie liczy się wstecz: wyprzedzenie o 1 dzień roboczy przy FS pozwala, by następnik zaczął się w dniu, w którym kończy się poprzednik.

Wyprzedzenie nie może przesunąć zadania przed początkiem projektu. Gdyby to miało nastąpić, aplikacja zostawia następnika na początku projektu i pokazuje ostrzeżenie w panelu *Ostrzeżenia*: *Wyprzedzenie obcięte przez start projektu — relacja nie jest w pełni zachowana*.

### W jakim kalendarzu liczy się opóźnienie

Każde zadanie może mieć własny kalendarz. Przy opóźnieniu w dniach roboczych ważne jest, który kalendarz liczy dni robocze. O tym decyduje ustawienie *Kalendarz zwłoki*, z czterema wyborami: *Poprzednik*, *Następnik*, *24-godzinny* i *Kalendarz projektu*. Domyślnie opóźnienie liczy się w kalendarzu **poprzednika**. Ustawienie znajdziesz w menu *Ustawienia › Projekt › Ustawienia projektu*, w bloku *Profil obliczeń i opcje*, w polu *Opcje obliczeń tego projektu*. Wybór należy do pliku projektu i działa dopiero po kliknięciu przycisku *Zastosuj*; harmonogram jest wtedy przeliczany.

Opóźnienie w dniach kalendarzowych (`3ed`) liczy zawsze wszystkie dni, niezależnie od tego, jaki *Kalendarz zwłoki* wybierzesz.

### Relacje na zadaniach sumarycznych

Relację możesz założyć na fazie (zadaniu sumarycznym) zamiast na zadaniu, które się w niej znajduje. Wewnętrznie aplikacja przypisuje tę relację do każdego zadania w fazie:

- Faza jako **poprzednik** przy FS lub FF: następnik czeka, aż zakończy się zadanie w fazie, które kończy się jako ostatnie.
- Faza jako **następnik** przy FS lub SS: każde zadanie w fazie czeka na poprzednika, niezależnie od pozostałych zadań w fazie.
- Faza jako **poprzednik** przy SS lub SF: następnik czeka na początek zadania w fazie, które zaczyna się **jako ostatnie**, a nie na początek samej fazy. To ostrożniej, niż można by sądzić: następnik nigdy nie zaczyna się za wcześnie, ale może zacząć się później, niż zamierzasz. Jeśli chcesz, by następnik podążał za początkiem fazy, załóż relację na pierwszym zadaniu w fazie.
- Faza jako **następnik** przy FF lub SF: każde zadanie w fazie musi samo spełnić wymóg zakończenia (przy FF zakończenie w dniu zakończenia poprzednika lub później, przy SF w dniu rozpoczęcia poprzednika lub później), nawet zadanie, które mogło być wykonane znacznie wcześniej. Lepiej załóż taką relację na ostatnim zadaniu w fazie.

Relacja między zadaniem a fazą, w której się znajduje, jest niedozwolona.

### Relacje wiodące

Jeśli następnik ma kilku poprzedników, zwykle jedna relacja wyznacza jego datę początku: relacja, która nie pozwala następnikowi zacząć się choćby o jeden dzień wcześniej, niż zaczyna się teraz. Taką relację nazywa się **relacją wiodącą**. Przy remisie jest kilka relacji wiodących. Poznasz relację wiodącą po symbolu błyskawicy w kolumnach *Poprzedniki* i *Następniki* tabeli, po kolumnie *Wiodąca* (**+** po prawej stronie nagłówka tabeli, pod nagłówkiem *Relacje*) i po mocniejszym podświetleniu, gdy śledzisz ścieżkę. Jak otworzyć tę ścieżkę, opisano w [Śledzenie ścieżki](docs://howto-pad-traceren).

Relacja wiodąca mówi coś o datach, a nie o czasie trwania. Także krótki poprzednik może być relacją wiodącą, na przykład przez długie opóźnienie; zobaczysz to w poniższym przykładzie.

## Przykład krok po kroku

Przykłady używają osobnych mini-projektów. Wszystkie zaczynają się w poniedziałek 7 czerwca 2027, chyba że podano inaczej. Pojęcia takie jak ścieżka krytyczna i zapas są wyjaśnione w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad). Samodzielne zbudowanie sieci relacji i jej sprawdzenie robisz w samouczku 2, „Relacje i ścieżka krytyczna”.

### Cztery rodzaje obok siebie

*Pour foundation* trwa 5 dni roboczych: od poniedziałku 7 do piątku 11 czerwca. *Build walls* (5 dni roboczych) następuje po nim z FS i trwa od poniedziałku 14 do piątku 18 czerwca. Od *Build walls* zależą cztery zadania, każde trwa 3 dni robocze i każde ma inny rodzaj relacji:

- *Place roof elements* (FS) zaczyna się w poniedziałek 21 czerwca, w pierwszym dniu roboczym po murowaniu, i kończy się w środę 23 czerwca.
- *Pipework* (SS) zaczyna się w poniedziałek 14 czerwca, razem z murowaniem, i kończy się w środę 16 czerwca.
- *Pointing* (FF) musi być zakończone w piątek 18 czerwca, razem z murowaniem. Przy 3 dniach roboczych zaczyna się więc w środę 16 czerwca.
- *Dewatering* (SF) musi się zakończyć w poniedziałek 14 czerwca, w dniu, w którym zaczyna się murowanie. Liczenie wstecz o 3 dni robocze (czwartek 10, piątek 11, poniedziałek 14 czerwca) daje początek w czwartek 10 czerwca.

Tylko *Place roof elements* leży na ścieżce krytycznej; projekt kończy się w środę 23 czerwca. *Pipework*, *Pointing* i *Dewatering* mają odpowiednio 5, 3 i 7 dni roboczych zapasu.

### Opóźnienie i wyprzedzenie w liczbach

*Pour foundation* kończy się w piątek 18 czerwca. *Build walls* (2 dni robocze) następuje po nim z FS. Tak opóźnienie wpływa na datę początku:

- Bez opóźnienia murowanie zaczyna się w poniedziałek 21 czerwca.
- Przy opóźnieniu `3` (trzy dni robocze) poniedziałek 21, wtorek 22 i środa 23 czerwca to czas oczekiwania; murowanie zaczyna się w czwartek 24 czerwca.
- Przy opóźnieniu `3ed` (trzy dni kalendarzowe) liczą się sobota, niedziela i poniedziałek; murowanie zaczyna się we wtorek 22 czerwca.
- Przy opóźnieniu `-1` (wyprzedzenie o jeden dzień roboczy) murowanie zaczyna się w piątek 18 czerwca, w dniu zakończenia wylewania.
- Przy opóźnieniu `40%` opóźnienie wynosi 40% z 5 dni roboczych, czyli 2 dni robocze; murowanie zaczyna się w środę 23 czerwca.
- Przy opóźnieniu `50%` opóźnienie wynosi 2,5 dnia roboczego, zaokrąglone do 3 dni roboczych; murowanie zaczyna się w czwartek 24 czerwca.

### Który kalendarz liczy opóźnienie

*Build walls* (4 dni robocze) korzysta z kalendarza projektu (od poniedziałku do piątku) i kończy się w czwartek 10 czerwca. *Pointing* (2 dni robocze) następuje po nim z FS i opóźnieniem `3`. Ma kalendarz, w którym soboty i niedziele też są dniami roboczymi. Data początku zależy wtedy od ustawienia *Kalendarz zwłoki*:

- *Poprzednik* (domyślnie): opóźnienie liczy się w kalendarzu murowania. Piątek 11, poniedziałek 14 i wtorek 15 czerwca to czas oczekiwania; spoinowanie zaczyna się w środę 16 czerwca.
- *Następnik*: opóźnienie liczy się w kalendarzu spoinowania. Piątek 11, sobota 12 i niedziela 13 czerwca to czas oczekiwania; spoinowanie zaczyna się w poniedziałek 14 czerwca.
- *24-godzinny*: liczy się każdy dzień kalendarzowy. Także tutaj piątek, sobota i niedziela to czas oczekiwania; spoinowanie zaczyna się w poniedziałek 14 czerwca.
- *Kalendarz projektu*: opóźnienie liczy się w kalendarzu projektu, tak samo jak przy ustawieniu *Poprzednik*; spoinowanie zaczyna się w środę 16 czerwca.

### Relacje na fazie

*Foundation* jest fazą z dwoma zadaniami: *Excavate* (2 dni robocze, poniedziałek 7 i wtorek 8 czerwca) i potem *Pour* (3 dni robocze, od środy 9 do piątku 11 czerwca). *Build walls* następuje po fazie *Foundation* z FS i zaczyna się w poniedziałek 14 czerwca: aplikacja sprawia, że czeka na *Pour*, zadanie, które kończy się jako ostatnie.

Z fazą jako następnikiem: *Permit* (3 dni robocze, kończy się w środę 9 czerwca) idzie z FS do fazy *Struktura*. Faza zawiera *Build walls* (4 dni robocze), a potem *Lay floor* (2 dni robocze). Każde zadanie w fazie czeka na pozwolenie: *Build walls* zaczyna się w czwartek 10 czerwca i kończy się we wtorek 15 czerwca. *Lay floor* czeka także na murowanie i trwa od środy 16 do czwartku 17 czerwca.

Z fazą przy SS: faza *Finishing* zawiera *Plastering* (2 dni robocze, 7 i 8 czerwca), potem *Painting* (3 dni robocze, 9 do 11 czerwca) i potem *Snagging* (2 dni robocze, 14 i 15 czerwca). *Cleaning* następuje po fazie z SS. Można by się spodziewać początku w poniedziałek 7 czerwca, ale aplikacja sprawia, że *Cleaning* czeka na początek *Snagging*, zadania, które zaczyna się jako ostatnie: poniedziałek 14 czerwca.

### Która relacja jest wiodąca

*Pour foundation* (2 dni robocze) trwa od poniedziałku 7 do wtorku 8 czerwca. Po nim następują dwie gałęzie:

- *Build walls* (5 dni roboczych): od środy 9 do wtorku 15 czerwca.
- *Order roof elements* (2 dni robocze): środa 9 i czwartek 10 czerwca.

*Place roof elements* (3 dni robocze) następuje po obu: z FS po murowaniu, a z FS i opóźnieniem `5` po zamówieniu (czas dostawy). Od strony murowania montaż mógłby się zacząć w środę 16 czerwca. Od strony zamówienia piątek 11, poniedziałek 14, wtorek 15, środa 16 i czwartek 17 czerwca to czas oczekiwania; montaż zaczyna się w piątek 18 czerwca. Relacja z zamówieniem jest więc relacją wiodącą, chociaż zamówienie jest dużo krótsze niż murowanie. Murowanie ma zapas wynoszący 2 dni robocze.

## Skutki i błędne przekonania

**„Relacja ustala zadania.”** Nie, relacja to dolna granica. Następnik zaczyna się najwcześniej w dacie, którą daje relacja, a później, jeśli tego wymaga inna relacja lub ograniczenie. Jak ograniczenia do tego pasują, wyjaśniono w [Ograniczenia i terminy ostateczne](docs://uitleg-constraints).

**„SS oznacza, że zadania zaczynają się w tym samym czasie.”** SS mówi tylko, że następnik nie może zacząć się przed poprzednikiem. Jeśli następnik ma innego poprzednika, który kończy się później, zaczyna się później.

**„Przy FF następnik zaczyna się tego samego dnia.”** Nie, przy FF zgadzają się daty zakończenia. Krótki następnik zaczyna się więc później niż poprzednik, jak spoinowanie w przykładzie.

**„Opóźnienie w dniach liczy dni kalendarzowe.”** Domyślnie opóźnienie liczy dni robocze, w kalendarzu poprzednika. Przy dojrzewaniu lub schnięciu, gdy weekend też się liczy, używasz dni kalendarzowych (`ed`).

**„Zadanie bez relacji nie stanowi problemu.”** Zadanie bez poprzednika zaczyna się w planowanej dacie początku, a zadanie bez następnika dostaje zapas do końca projektu. Jeśli zapomnisz o relacji, zadanie wydaje się mieć dużo miejsca; zobacz błędne przekonania w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad).

**„Relacja na fazie to jedna relacja.”** Na potrzeby obliczeń to jedna relacja dla każdego zadania w fazie. Jeśli przeniesiesz zadania do fazy albo z niej, zmienią się także relacje, które dotyczą tych zadań.

## Zobacz też

- [Dodawanie relacji](docs://howto-relaties-leggen): kroki do połączenia zadań i ustawienia opóźnienia.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co aplikacja oblicza na podstawie Twoich relacji i dlaczego zadanie staje się krytyczne.
- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): ustalenia dotyczące dat obok relacji.
- [Śledzenie ścieżki](docs://howto-pad-traceren): pokazywanie łańcucha zadań przed lub po danym zadaniu.
- [Tworzenie hamaka](docs://howto-hammock): zadanie z wyliczonym czasem trwania, podpięte do relacji typu SS i FF.
- [Relacje zewnętrzne z innym projektem](docs://howto-externe-relaties): relacje z zadaniem w innym pliku projektu.
