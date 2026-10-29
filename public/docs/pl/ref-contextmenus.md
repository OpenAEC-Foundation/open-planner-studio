# Menu prawego przycisku myszy

Które menu otwiera prawy przycisk myszy w Gantt i w tabeli zadań, co robi każda pozycja i na które zadania działa. Pozycje, które istnieją też jako przycisk albo skrót, znajdziesz w [Wstążka, zakładka po zakładce](docs://ref-lint) i [Skróty klawiszowe](docs://ref-sneltoetsen).

## Które menu gdzie

Są cztery menu. Które menu się otworzy, zależy od tego, gdzie klikniesz:

- **Na pasku zadania w Gantt** — menu zadania, z pozycją *Rozpocznij relację stąd* na górze.
- **Na zadaniu w tabeli zadań** — to samo menu zadania, bez tej jednej pozycji na górze. Dotyczy to tabeli zadań po lewej stronie Gantt oraz na karcie *Tabela*.
- **Na nagłówku grupy w tabeli zadań** — małe menu do rozwijania i zwijania grup. Nagłówki grup pojawiają się tylko wtedy, gdy grupujesz, na przykład z układem *Diagram zasobów*.
- **Na pustym miejscu** — w Gantt obok pasków albo pod nimi oraz w tabeli zadań pod ostatnim zadaniem lub na szarym wierszu *Nowe zadanie*. Menu zawiera *Nowe zadanie*, *Dodaj kamień milowy* i *Wklej*; w Gantt także *Resetuj powiększenie* i *Dopasuj do projektu*. Nowe zadanie albo nowy kamień milowy trafia na koniec listy. W Gantt zaczyna się od daty, w której kliknąłeś. W tabeli zadań od razu otwiera się komórka nazwy, dzięki czemu możesz pisać.

Na pasie nagłówka grupy w Gantt prawy przycisk myszy otwiera menu dla pustego miejsca. Sam nagłówek grupy ma menu tylko w tabeli zadań. Kliknięcie prawym przyciskiem w nagłówku osi czasu nic nie robi. Nagłówki kolumn tabeli zadań mają własne menu, opisane w [Dopasowywanie kolumn tabeli](docs://howto-tabelkolommen-aanpassen).

**Na które zadania działa pozycja?** Klikasz na jedno zadanie, ale zaznaczenie określa zakres. Jeśli klikniesz zadanie, które jest częścią zaznaczenia, pozycja działa na całe zaznaczenie. Jeśli nie jest częścią zaznaczenia, działa tylko na to jedno zadanie. Przy kliknięciu prawym przyciskiem na pasku w Gantt albo na wierszu w tabeli zadań to zadanie zastępuje zaznaczenie, jeśli nie było jego częścią. Każda pozycja, która coś zmienia, to jeden krok w *Cofnij*, także dla całego zaznaczenia.

## Menu zadania

Pozycje są w tej kolejności. Linia między grupami to separator w menu.

**Rozpocznij relację stąd** — tylko w Gantt, na pasku. Włącza tryb relacji z tym zadaniem zaznaczonym. Potem przeciągasz do następnika. Zobacz [Dodawanie relacji](docs://howto-relaties-leggen).

**Usuń przerwę** i **Usuń wszystkie przerwy** — tylko w Gantt, na pasku z przerwami. *Usuń przerwę* jest tylko wtedy, gdy klikniesz na przerwę albo na fragment za nią, i gdy przerwa jest edytowalna. Wtedy usuwa tę jedną przerwę. *Usuń wszystkie przerwy* usuwa wszystkie, także przerwy z pliku źródłowego, których nie możesz edytować. Zobacz [Dzielenie zadania](docs://howto-taak-splitsen).

**Edytuj...** — otwiera okno *Edytuj zadanie* dla tego zadania. Zobacz [Okno zadania i panel właściwości](docs://ref-taak-eigenschappen).

**Wstaw powyżej** i **Wstaw poniżej** — wstawia jedno nowe zadanie nad najwyższym albo pod najniższym zadaniem zakresu, na tym samym poziomie. Działa tylko w czystym widoku drzewa, bez filtru, grupowania i sortowania. W przeciwnym razie aplikacja odmawia i pokazuje komunikat. Zobacz [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen).

**Dodaj podzadanie** — dodaje nowe zadanie jako podzadanie klikniętego zadania, na końcu jego podzadań. Tylko dla tego jednego zadania, nie dla całego zaznaczenia.

**Dodaj kamień milowy** — dodaje kamień milowy jako podzadanie klikniętego zadania. Tylko dla tego jednego zadania.

**Dodaj relację** — działa tak samo jak *Rozpocznij relację stąd*. Włącza tryb relacji z tym zadaniem zaznaczonym. W tabeli zadań pozycja jest wyłączona, gdy Gantt nie jest widoczny. Pokazuje wtedy podpowiedź *Dostępne tylko wtedy, gdy wykres Gantta jest widoczny*.

**Wcięcie** i **Zmniejsz wcięcie** — przesuwa zadania zakresu o jeden poziom głębiej albo o jeden poziom wyżej w WBS. Te dwie pozycje są tylko w czystym widoku drzewa. Zobacz [Dopasowywanie struktury](docs://howto-structuur-aanpassen).

**Przełącz kamień milowy** — zmienia zadanie w kamień milowy albo z powrotem. Nowy stan wynika z klikniętego zadania i działa na cały zakres. Jeśli kliknięte zadanie jest zwykłym zadaniem, wszystkie zadania w zakresie stają się kamieniami milowymi. Zadanie sumaryczne i zadanie z przydziałami nie stają się kamieniem milowym. Reszta zakresu staje się kamieniami milowymi, a za każdy powód dostajesz osobny komunikat.

**Przypisz kalendarz ▸** — podmenu z pozycją *Kalendarz projektu* (zadanie wtedy nie ma własnego kalendarza) i pod nim dostępne kalendarze. Aktualny wybór ma znacznik wyboru. Zadanie, które już ma ten kalendarz, nie jest brane pod uwagę i nie tworzy dodatkowego kroku w *Cofnij*. Zobacz [Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen).

**Postęp ▸** — podmenu z 0%, 25%, 50%, 75% i 100%. Aktualna wartość ma znacznik wyboru. Zadanie sumaryczne nie ma własnego postępu. Jeśli jest w zakresie, jego zadania bez podzadań dostają ten procent. Bez daty statusu aplikacja ustawia ją na dziś i pokazuje komunikat. Zadanie, którego planowany początek jest dopiero po dacie statusu i nie ma jeszcze rzeczywistego rozpoczęcia, najpierw prowadzi do pytania o rzeczywiste rozpoczęcie. Jeśli je anulujesz, nic się nie zmienia. Zobacz [Aktualizowanie postępu](docs://howto-voortgang-bijwerken).

**Priorytet ▸** — podmenu z pozycjami *Niski* (100), *Normalny* (500) i *Wysoki* (900), czyli priorytet bilansowania zadania. Aktualna wartość ma znacznik wyboru. Zobacz [Bilansowanie zasobów](docs://uitleg-nivelleren).

**Śledź ścieżkę** — pokazuje poprzedniki i następniki tego zadania. Jeśli śledzenie jest już włączone, pozycja nazywa się *Zatrzymaj śledzenie ścieżki*. Zobacz [Śledzenie ścieżki](docs://howto-pad-traceren).

**Zwiń**, **Rozwiń** i **Zapisz gałąź jako szablon** — tylko dla zadania sumarycznego. *Zwiń* i *Rozwiń* są zawsze obie, także gdy zadanie jest już zwinięte albo rozwinięte. Działają na cały zakres. *Zapisz gałąź jako szablon* zapisuje zadanie z jego podzadaniami i relacjami między nimi jako szablon WBS. Zobacz [Zapisywanie i wstawianie szablonów WBS](docs://howto-wbs-sjablonen).

**Usuń** — usuwa zadania zakresu razem z ich podzadaniami. Nie ma potwierdzenia. Odzyskasz je klawiszami Ctrl+Z, jednym krokiem dla całego zakresu. Zobacz [Zaznaczanie, usuwanie i cofanie zadań](docs://howto-taken-selecteren-verwijderen).

## Menu nagłówka grupy

To menu istnieje tylko w tabeli zadań, na nagłówku grupy:

**Zwiń grupę** albo **Rozwiń grupę** — zwija albo rozwija tylko tę grupę. Pozycja pokazuje, co możesz zrobić.

**Rozwiń wszystko** i **Zwiń wszystko** — rozwijają albo zwijają wszystkie grupy naraz.

Grupowanie ustawiasz z układem. Zobacz [Tworzenie i używanie układu](docs://howto-layouts-gebruiken).

## Zobacz także

- [Przeciąganie, przesuwanie i powiększanie w Gantt](docs://howto-gantt-bedienen): co robi przeciąganie lewym i środkowym przyciskiem myszy.
- [Wstążka, zakładka po zakładce](docs://ref-lint): przyciski z tymi samymi działaniami.
- [Skróty klawiszowe](docs://ref-sneltoetsen): klawisze, które do nich pasują.
