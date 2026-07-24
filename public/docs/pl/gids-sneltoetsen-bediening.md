# Skróty klawiszowe i obsługa

Ten przewodnik nie wymienia skrótów klawiszowych — ta lista już istnieje w jednym miejscu, a kopia
tutaj natychmiast by się zdezaktualizowała. Zamiast tego wyjaśnia, **jak zawsze wywołać aktualną listę**
oraz które koncepcje obsługi (menu kontekstowe, przeciąganie, zaznaczanie ramką kontra przesuwanie, powiększanie) warto
zrozumieć samodzielnie.

## Czego się tu nauczysz

- Jak otworzyć zawsze aktualny przegląd skrótów.
- Co zawiera każde z czterech menu kontekstowych w widoku Gantta.
- Jak działa przeciąganie: przesuwanie paska kontra rysowanie relacji.
- Kiedy przeciąganie na pustym płótnie przesuwa widok, a kiedy zaznacza ramką.
- Powiększania, kart dokumentów i trybu prezentacji.
- Jak ponownie uruchomić wycieczkę.

## Zawsze aktualny przegląd

Naciśnij **Ctrl+/** (albo **Cmd+/** na macOS), aby otworzyć przegląd skrótów — to samo okno jest
też dostępne przez przycisk **Skróty klawiszowe** na karcie wstążki **Widok**. To okno jest tylko do odczytu i jest
budowane bezpośrednio z kodu źródłowego aplikacji: nowy skrót pojawia się tu automatycznie, bez osobnej
listy, którą ktokolwiek musiałby utrzymywać w synchronizacji. Dlatego właśnie ten przewodnik nie powiela tej listy —
druga, ręcznie utrzymywana lista prędzej czy później oddaliłaby się od tego, co aplikacja faktycznie robi. Okno
grupuje skróty według kategorii: Plik, Edycja, Struktura, Widok i Nawigacja.

## Menu kontekstowe: cztery rodzaje, w zależności od miejsca kliknięcia prawym przyciskiem

Kliknięcie prawym przyciskiem w widoku Gantta daje inne menu w zależności od tego, gdzie znajduje się kursor:

- **Na pasku zadania** — pełne menu zadania (edycja, wstawianie, dodawanie podzadania/kamienia milowego/relacji,
  przypisanie kalendarza, postęp, priorytet, śledzenie ścieżki, usuwanie…), plus jedna dodatkowa pozycja specyficzna dla
  paska na górze: **Rozpocznij relację stąd**.
- **Na wierszu zadania bez trafienia w pasek** (na przykład wiersz, w którym pasek nie jest aktualnie widoczny) — to samo
  menu zadania, ale bez pozycji specyficznej dla paska.
- **Na wierszu nagłówka grupy** (wiersz podsumowujący pogrupowany zestaw zadań) — małe menu do
  zwijania/rozwijania tej jednej grupy, plus **Rozwiń wszystko**/**Zwiń wszystko** dla całego drzewa.
- **Na pustym płótnie** (bez zadania, bez nagłówka grupy) — **Nowe zadanie**, **Dodaj kamień milowy**, **Wklej** (jeśli
  jest coś w schowku), **Resetuj powiększenie** i **Dopasuj do projektu**.

To ostatnie menu zostało zweryfikowane na żywo: kliknięcie prawym przyciskiem w pustym miejscu na płótnie Gantta daje dokładnie
te pięć pozycji, w tej kolejności.

## Przeciąganie na pasku zadania

Chwycenie i przeciągnięcie paska zadania przesuwa zadanie (albo, gdy chwycisz krawędź, zmienia jego czas trwania).
Przytrzymaj **Shift** podczas przeciągania z paska, a zamiast tego zaczynasz rysować **relację** do
zadania, na którym zwolnisz przycisk — to samo, co **Rozpocznij relację stąd** w menu kontekstowym paska, ale
w jednym ruchu myszy.

## Przesuwanie widoku kontra zaznaczanie ramką

Przeciąganie zaczynające się na pustej przestrzeni robi jedną z dwóch rzeczy, w zależności od tego, gdzie je zaczniesz i
od Twojego trybu przewijania (**Ustawienia → Przewijanie i powiększenie**):

- **W tabeli zadań** (lewa kolumna z WBS/nazwą/czasem trwania) przeciąganie na pustej przestrzeni jest
  **zawsze** zaznaczaniem ramką — przesuwanie widoku nigdy tam nie następuje.
- **W samym płótnie Gantta**: jeśli tryb przewijania jest ustawiony na **Zoom + przeciąganie** (przesuwanie widoku w stylu mapy),
  wygrywa przesuwanie widoku — dokładnie tak, jak można by oczekiwać od aplikacji mapowej. Przy każdym z pozostałych trybów przewijania
  (**Pozycja** lub **Klawisze**), to samo przeciąganie na pustym płótnie jest zaznaczaniem ramką, pozwalającym
  zaznaczyć wiele zadań naraz, przeciągając wokół nich prostokąt.

Krótko mówiąc: tabela zadań zawsze zaznacza; płótno przesuwa widok tylko w trybie przewijania przeciąganiem, a poza tym zaznacza.

## Powiększanie

Oprócz przycisków powiększenia na wstążce, **+**/**=** (albo **Ctrl+=**) powiększa, a **-** (albo
**Ctrl+-**) pomniejsza. Samo **0** resetuje powiększenie do wartości domyślnej; **Ctrl+0** dostosowuje powiększenie tak, aby cały
projekt zmieścił się na ekranie („dopasuj do projektu") — to samo, co przycisk o tej nazwie w powyższym
menu kontekstowym na pustym płótnie.

## Karty dokumentów

Jeśli masz otwartych kilka projektów naraz (każdy we własnej karcie dokumentu), **Ctrl+1** do
**Ctrl+9** przeskakują bezpośrednio do pierwszej do dziewiątej karty dokumentu.

## Tryb prezentacji

**F11** przełącza tryb prezentacji — widok pełnoekranowy bez wstążki i paneli bocznych, przeznaczony do
pokazywania harmonogramu bez otoczki edycyjnej wokół niego. **Esc** ponownie wychodzi z trybu prezentacji
(a przy kolejnym naciśnięciu wykonuje zwykłe „usuń zaznaczenie").

## Ponowne uruchamianie wycieczki

Chcesz ponownie uruchomić wycieczkę wprowadzającą (na przykład, aby pokazać komuś innemu aplikację)? Są dwa
miejsca, aby to zrobić: przycisk **Wycieczka** na karcie wstążki **Widok**, albo **Rozpocznij wycieczkę** w
nawigacji Backstage (wiersz tuż nad Ustawieniami). Oba uruchamiają wycieczkę od razu, bez pokazywania
wcześniej okna powitalnego.

## Dalsza lektura

- Otwórz sam przegląd skrótów przez **Ctrl+/** — to jest źródło powiązań, nie ten przewodnik.
- Zachowanie przewijania i powiększania jest konfigurowane pod **Ustawienia → Przewijanie i powiększenie**, dostępne we wszystkich trzech
  stałych lokalizacjach ustawień aplikacji (ikona koła zębatego, karta wstążki Ustawienia i Backstage →
  Ustawienia).
