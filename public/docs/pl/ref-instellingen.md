# Ustawienia

Okno **Ustawienia** zawiera ustawienia aplikacji: preferencje, które obowiązują na tym urządzeniu, niezależnie od pliku projektu. Każda zmiana jest stosowana i zapisywana natychmiast — nie ma przycisku OK. Opcje harmonogramowania, które zmieniają obliczony harmonogram, żyją zamiast tego z projektem — zobacz [Informacje o projekcie](docs://ref-projectgegevens).

## Otwieranie — trzy wejścia, ta sama treść

- **Koło zębate** (⚙) na pasku tytułu.
- **Ustawienia** (karta wstążki) → grupa wstążki **Projekt** → **Ustawienia**.
- **Plik** → **Ustawienia** (Backstage).

Wszystkie trzy pokazują dokładnie te same ustawienia. Zależnie od Twojej wersji są one rozłożone na trzy
albo cztery karty — czwarta, **Aplikacja**, niedawno oddzieliła się od końcówki pierwszej karty — ale
same ustawienia i to, co robią, są w obu przypadkach identyczne; ten artykuł grupuje je jako
**Ogólne**, **Język** i **Oś czasu / Powiększenie**.

## Karta Ogólne

**Wygląd:**

- **Motyw** — **Ciemny**, **Jasny** lub **Wysoki kontrast**; kliknij kartę, aby przełączyć.
- **Czcionka** — **Domyślna**, **Systemowa**, **Szeryfowa** lub **Monospace**; nadpisuje krój pisma interfejsu. Aplikacje webowe nie przejmują automatycznie czcionki ustawionej w systemie, więc ta opcja i następna to sposób, by wybrać ją samodzielnie.
- **Rozmiar tekstu** — 90%, 100%, 110% lub 125%; skaluje tekst interfejsu i układ.
- **Styl przełączania dokumentów** — jak przełączasz się między otwartymi dokumentami: **Karty poziome**, **Karty pionowe** lub **Pigułka**.
- **Format daty** — **dd-mm-rrrr**, **mm-dd-rrrr** lub **rrrr-mm-dd**. Tylko wyświetlanie; pliki i obliczenia pozostają bez zmian.
- **Tryb budowlany** — **Włącz tryb budowlany** przełącza ustawienia domyślne dla *nowych* projektów między zorientowanymi na budownictwo (kalendarz budowy z holenderskimi świętami, przerwa urlopowa w budownictwie, szablony faz) a neutralną, niezależną od branży konfiguracją. Istniejące projekty w obu przypadkach pozostają bez zmian.

**Aplikacja:**

- **Wersja** — numer wersji aplikacji (tylko do odczytu), z odnośnikiem **Sprawdź aktualizacje**, który otwiera okno aktualizacji. Instalowanie aktualizacji działa tylko w aplikacji desktopowej; instalacje Snap i AppImage aktualizują się przez własny kanał. Osobno, przy pierwszym otwarciu aplikacji po jej samodzielnej aktualizacji, pojawia się jednorazowe okno „Masz najnowszą wersję!" — skok wersji, różnica w rozmiarze instalatora, liczba dni od poprzedniego wydania i informacje o wydaniu z GitHub, cokolwiek z tego udało się pobrać. To inny, automatyczny moment niż ręczny odnośnik **Sprawdź aktualizacje** tutaj.
- **Informacje o projekcie...** — skrót do okna [Informacje o projekcie](docs://ref-projectgegevens).
- **Wycieczka** — **Rozpocznij wycieczkę** odtwarza ponownie wycieczkę wprowadzającą. To samo ponowne uruchomienie znajduje się też na karcie wstążki **Widok** → **Wycieczka** oraz w Backstage (**Plik** → **Rozpocznij wycieczkę**).
- **Benchmark** — otwiera wbudowane narzędzie benchmarku, do mierzenia wydajności harmonogramowania/renderowania na tym komputerze.
- **Tryb AI** — **Włącz tryb AI** pokazuje kartę wstążki **AI** z mostkiem MCP, dzięki czemu asystent AI może pracować z Twoim harmonogramem przez Model Context Protocol; wyłączenie natychmiast zatrzymuje działający mostek. **Automatycznie uruchamiaj most** (dostępne tylko przy włączonym trybie AI) uruchamia mostek od razu po starcie aplikacji, bez konieczności najpierw odwiedzać karty AI — tylko w aplikacji desktopowej. Pełny obraz znajdziesz w wbudowanym przewodniku po asystencie AI.
- **Terminal debugowania** — **Włącz terminal debugowania** pokazuje panel dziennika do rozwiązywania problemów.

## Karta Język

- **Język** — język wyświetlania aplikacji; czternaście języków, stosowane natychmiast.

## Karta Oś czasu / Powiększenie

- **Planowanie godzinowe** — **Włącz planowanie godzinowe** udostępnia skalę godzinową i pasma czasu pracy. Po wyłączeniu nowe zadania zaczynają się w dniach, a istniejące zadania godzinowe zachowują dokładną wartość. Po włączeniu zadania dniowe i godzinowe mogą współistnieć. Zobacz [Kalendarze i planowanie godzinowe](docs://gids-kalenders-uren).
- **Wyświetlanie czasu trwania** — **Automatycznie (własna jednostka dla zadania)**, **Zawsze w dniach** lub **Zawsze w godzinach**.
- **Paski zadań przy przerwach** — **Nigdy nie dziel**, **Dziel przy zaznaczeniu** lub **Zawsze dziel**: czy pasek wizualnie dzieli się wokół dni niepracujących.
- **Oś czasu** — **Pokazuj tylko dni robocze** kompresuje oś czasu: weekendy i święta z kalendarza projektu są pomijane, dzięki czemu zadanie trwające 5 dni roboczych ma dokładnie 5 kolumn szerokości, niezależnie od tego, jak wygląda kalendarz pomiędzy nimi.
- **Tydzień zaczyna się w** — **Poniedziałek** lub **Niedziela** (układ tygodnia na skali czasu).
- **Pokazuj ćwierćgodziny przy dużym powiększeniu** — dodatkowa gradacja ćwierćgodzinna na skali czasu godzinowej.
- **Obliczanie** — **Oblicz automatycznie** przelicza harmonogram, gdy tylko stanie się nieaktualny, zamiast czekać na F5.
- **Przewijanie i powiększenie** — **Tryb**:
- **Zoom + przeciąganie** (domyślnie) — kółko myszy powiększa (zakotwiczone na kursorze); przeciągnij tło wykresu, aby przesunąć widok; Shift+kółko przewija wiersze; Ctrl/⌘+przeciąganie rysuje ramkę zaznaczenia.
- **Pozycja** — pozycja kursora decyduje o kierunku przewijania; z **Podziałem ekranu** (**Lewo/prawo**, **Góra/dół** lub **Prawy górny róg**). Ctrl+scroll = powiększenie, Shift+scroll = poziomo.
- **Klawisze** — przypisz, które sterowanie (**Przewijanie**, **Ctrl + przewijanie**, **Shift + przewijanie**) wykonuje którą funkcję (**Pionowo**, **Poziomo**, **Powiększenie**), przeciągając chipy; upuszczenie na zajętym miejscu zamienia sterowania.
