# Łączenie asystenta AI (MCP)

Open Planner Studio może otworzyć się na asystenta AI. Włącz tryb AI, a aplikacja sama staje się **serwerem MCP**: asystent taki jak Claude łączy się z oknem, które masz akurat otwarte, odczytuje Twój harmonogram i może go zmieniać. Widzisz to na żywo — każde dodane zadanie pojawia się natychmiast na wykresie Gantta — a wszystko, co zrobi asystent, cofasz jednym Ctrl+Z.

To zasadniczo inny model niż eksportowanie pliku, edytowanie go gdzie indziej i importowanie z powrotem. Nie ma kopii, nie ma formatu pośredniego i nie ma momentu, w którym Ty i asystent patrzycie na coś innego. Ten przewodnik pokazuje, jak go włączyć, jak połączyć asystenta, co wolno mu robić, a czego nie, oraz co zrobić, gdy coś nie działa.

## Czego się tu nauczysz

- Włączania trybu AI i znajdowania karty AI.
- Uruchamiania mostka i automatycznego startu razem z aplikacją.
- Łączenia asystenta — za pomocą gotowego polecenia albo fragmentu konfiguracji.
- Tego, co asystent może zrobić z Twoim harmonogramem.
- Elementów sterowania bezpieczeństwem: wstrzymania, trybu tylko do odczytu, automatycznej kopii zapasowej i dziennika aktywności.
- Tego, co zrobić, gdy połączenie się nie uda.

Mostek działa **wyłącznie w aplikacji desktopowej**. Karta AI jest widoczna również w wersji przeglądarkowej, ale sam serwer działa w powłoce desktopowej i tam nie może wystartować.

## Włączanie

Tryb AI jest domyślnie wyłączony. Włączasz go w **Ustawienia → Aplikacja → Włącz tryb AI** — przez ikonę koła zębatego, kartę wstążki Ustawienia albo Plik → Ustawienia; wszystkie trzy pokazują ten sam przełącznik.

Gdy jest włączony, na wstążce pojawia się dodatkowa karta **AI**. Wyłącz tryb AI z powrotem, a karta znika, a działający mostek zostaje natychmiast zatrzymany — serwer nigdy więc nie nasłuchuje bez obecności karty.

Poniżej znajduje się **Automatycznie uruchamiaj most**. Z włączonym tym przełącznikiem serwer startuje na żywo, gdy tylko otworzysz aplikację, dzięki czemu asystent może się połączyć bez wcześniejszego wchodzenia na kartę AI. Domyślnie jest wyłączony: otwarcie nasłuchującego portu na własnym komputerze powinno być świadomą decyzją.

## Karta AI

Karta składa się z czterech grup.

**Serwer** — przycisk **Uruchom mostek** (albo **Zatrzymaj mostek**) z widocznym obok statusem: *Wyłączony*, *Aktywny na porcie 3877*, *Port … zajęty* albo *Błąd*. Ten sam status pokazuje kolorowa kropka w prawym dolnym rogu paska stanu, dzięki czemu widzisz, czy mostek żyje, z poziomu dowolnej innej karty.

**Połączenie** — numer portu (edytowalny tylko wtedy, gdy serwer jest zatrzymany; działający serwer trzyma swój port), token oraz przycisk **Połącz**. Token jest domyślnie ukryty; przycisk z okiem go ujawnia, przycisk kopiowania go przejmuje, a **Nowy token** generuje świeży token. Zwróć uwagę, że ta ostatnia opcja przerywa *każde* istniejące połączenie, ponieważ wszystkie niosą stary token — dlatego aplikacja najpierw prosi o potwierdzenie.

**Bezpieczeństwo** — **Wstrzymaj**, **Tylko do odczytu**, przełącznik **Automatyczna kopia zapasowa** oraz przyciski **Utwórz kopię zapasową teraz** i **Otwórz folder kopii zapasowych**. Co dokładnie robią, opisano dalej w części *Elementy sterowania bezpieczeństwem*.

**Aktywność** — przycisk **Panel aktywności** otwiera listę każdego wywołania asystenta: znacznik czasu, nazwę narzędzia, jak długo trwało i czy się powiodło. Każdy wiersz możesz rozwinąć, aby zobaczyć argumenty i odpowiedź. To Twój dziennik: nie musisz wierzyć asystentowi na słowo, co właściwie zrobił.

## Łączenie asystenta

Kliknij **Połącz**. Otwierające się okno zawiera cztery bloki, które możesz kopiować jeden po drugim:

1. **Punkt końcowy** — adres, na którym nasłuchuje mostek, domyślnie `http://localhost:3877/mcp`. Transport to strumieniowy HTTP.
2. **Uwierzytelnianie** — nagłówek HTTP, który musi towarzyszyć każdemu żądaniu, w formie `Authorization: Bearer …`.
3. **Fragment konfiguracji** — gotowy blok JSON do wklejenia w konfiguracji MCP Twojego klienta.
4. **Polecenie połączenia** — fragment tekstu, który wklejasz bezpośrednio do asystenta; ten sam się łączy, a potem sprawdza własną listę narzędzi.

Ta ostatnia opcja to najkrótsza droga i działa z każdym asystentem, który potrafi dodawać serwery MCP. Polecenie jest celowo neutralne wobec dostawcy: podaje tylko adres, token i to, co asystent powinien potem sprawdzić, więc działa tak samo dobrze u jednego dostawcy, jak i u innego.

Połączenie jest gotowe, gdy tylko asystent potrafi wylistować swoje narzędzia. Powinien zobaczyć blisko czterdzieści, wszystkie zaczynające się od `planner_`. Jeśli nie widzi żadnego, mostek nie działa albo token jest nieprawidłowy.

Token daje dostęp do planu, który masz akurat otwarty. Traktuj go jak hasło: nie umieszczaj go w udostępnionym dokumencie ani w rozmowie z innymi osobami.

## Co wolno asystentowi

Narzędzia obejmują z grubsza wszystko, co sam robisz w aplikacji:

- **Odczyt** — przegląd projektu, listę zadań, pojedyncze zadanie ze szczegółami, ścieżkę krytyczną, zasoby i ich histogram, kalendarze, baseline oraz porównanie z baseline.
- **Planowanie** — tworzenie zadań (całą strukturę WBS z fazami i podzadaniami za jednym razem), edytowanie, przenoszenie i usuwanie ich; dodawanie, zmienianie i usuwanie relacji; rejestrowanie postępu.
- **Konfigurowanie** — tworzenie i przydzielanie zasobów, zarządzanie kalendarzami i dniami wolnymi, zapisywanie i aktywowanie baseline, bilansowanie.
- **Zarządzanie** — tworzenie, duplikowanie i przełączanie dokumentów, importowanie plików harmonogramu oraz eksportowanie do IFC.

Dwie rzeczy są ważniejsze niż sama lista.

**Asystent może pracować w jednym scenariuszu.** Zamiast wywoływać narzędzie po narzędziu, może przesłać sekwencję kroków jako jedną całość. To nie tylko szybsze: cały scenariusz staje się jednym krokiem w Twojej historii. Jeśli zbuduje za jednym razem harmonogram czterdziestu zadań wraz ze wszystkimi relacjami, jedno Ctrl+Z usuwa go z powrotem. Jeśli coś strukturalnie zawiedzie w połowie, cały scenariusz zostaje wycofany, zamiast zostawiać Cię z na wpół ukończonym harmonogramem.

**Harmonogram jest przeliczany po każdej zmianie.** Asystent nie musi prosić o to osobno, więc nie może przez pomyłkę dalej pracować na nieaktualnych datach.

## Czego asystentowi nie wolno

Mostek jest celowo węższy niż sama aplikacja. Jest kilka rzeczy, których asystent po prostu nie może zrobić, nawet jeśli o to poprosisz — dostaje wtedy odmowę, która wyjaśnia, jaka droga faktycznie działa. To nie jest blokada rodzicielska: w każdym przypadku chodzi o coś, co wykracza poza projekt, na który akurat patrzysz.

**Samą bibliotekę zasobów.** Asystent nie może utworzyć, zmienić ani usunąć zasobu ani kalendarza bibliotecznego. Biblioteka to dane obejmujące całą aplikację, współdzielone przez wszystkie Twoje projekty, a zmiany w niej wykraczają poza zwykłą historię cofania. Jedna zmiana stawki rozeszłaby się więc po projektach, które nawet nie są otwarte, bez możliwości cofnięcia. To robisz sam, w Plik → Biblioteka.

**Ustalone pola odziedziczonego zasobu.** Jeśli zasób pochodzi z biblioteki, to biblioteka decyduje, czym ten zasób *jest*: nazwa, typ, opis, stawka za godzinę i jednostka. Te pola nie bez powodu widnieją na karcie Zasoby jako zwykły tekst — Ty też nie możesz ich tam edytować — i asystent ma do nich dostęp dokładnie taki sam, czyli żaden. To, co decyduje *projekt*, pozostaje dla niego dostępne: maks. jednostki, zdolność rozłożona w czasie, kalendarz i przynależność do brygady. Poprosisz mimo to o inną stawkę godzinową, a odmowa wskaże dwie realne drogi: zmień ją w bibliotece (co obowiązuje wtedy w każdym projekcie) albo najpierw odłącz zasób od biblioteki — po tym staje się on projektowy i w pełni edytowalny, a samo odłączenie cofasz przez Ctrl+Z.

**Który kalendarz jest kalendarzem projektu.** Może edytować zawartość tego kalendarza, ale zmianę tego, którego kalendarza używa projekt, robisz sam w bibliotece kalendarzy. To samo dotyczy opcji harmonogramowania, takich jak ustawienie wielu ścieżek krytycznych.

**Samą aplikację.** Nie ma narzędzia do ustawień, motywu, języka, rozszerzeń ani aktualizacji. Asystent nie zmienia niczego w sposobie skonfigurowania Twojego programu.

**Pliki — owszem, ale w granicach.** Importowanie oznacza, że może odczytać plik harmonogramu z Twojego dysku, a eksportowanie, że może zapisać plik IFC. Zapis jest ograniczony do Twojego osobistego folderu, a istniejący plik nigdy nie zostaje nadpisany, chyba że wyraźnie o to poproszono. Eksport to też nie „zapis": Twój dokument pozostaje w aplikacji oznaczony jako niezapisany, więc asystent nie może podmienić Twojego pliku projektu za Twoimi plecami.

Gdy pyta o listę zasobów, asystent od razu widzi, które zasoby pochodzą z biblioteki, do jakiej firmy należą i które pola są ustalone na stałe. Nie musi więc najpierw uderzyć w ścianę, żeby się o tym przekonać.

## Elementy sterowania bezpieczeństwem

**Wstrzymaj** utrzymuje mostek przy życiu, ale odrzuca każdą zmianę; odczyt pozostaje dozwolony. Przydatne, gdy chcesz coś zrobić sam, nie zrywając połączenia.

**Tylko do odczytu** robi to samo, ale jako postawa, a nie pauza: pozwól asystentowi analizować, raportować albo porównywać Twój harmonogram, bez możliwości zmieniania czegokolwiek.

**Automatyczna kopia zapasowa** zapisuje automatycznie kopię IFC przed pierwszą zmianą w dokumencie. Dzieje się to raz na dokument w każdej sesji, więc nie zbierasz stosu plików przy każdym wywołaniu. **Utwórz kopię zapasową teraz** robi to od razu — przydatne tuż przed tym, jak pozwolisz asystentowi zrobić coś drastycznego. **Otwórz folder kopii zapasowych** zabiera Cię tam, gdzie one żyją; aplikacja zachowuje ostatnie dziesięć na dokument.

Do tego dochodzi zwykła historia cofania, którą asystent dzieli z Tobą. Wszystko, co zrobi, możesz cofnąć — podobnie jak on sam, bo undo i redo też są w jego zestawie narzędzi.

## Gdy coś nie działa

**„Port … zajęty."** Coś już nasłuchuje na tym porcie. Zwykle to drugie okno tej aplikacji: mostek może obsługiwać tylko jedno naraz. Zamknij drugie okno albo wybierz inny numer portu, gdy serwer jest zatrzymany.

**Asystent nie dostaje odpowiedzi albo się zawiesza.** Dzieje się tak, gdy okno stojące za serwerem zniknęło albo zostało przeładowane. Zatrzymaj mostek i uruchom go ponownie; jeśli to nie pomoże, zrestartuj aplikację. Jeśli nie jesteś pewien, czy mostek jeszcze żyje, sprawdź kropkę statusu na pasku stanu.

**Asystent nie widzi żadnych narzędzi albo zgłasza błąd dostępu.** Wtedy token jest nieprawidłowy. Dzieje się to najczęściej po kliknięciu **Nowy token**, gdy połączenie było już nawiązane: asystent wciąż nosi stary. Skopiuj nowy z okna **Połącz** i zaktualizuj konfigurację swojego klienta.

**Nic się nie dzieje, choć asystent twierdzi, że mu się udało.** Sprawdź w panelu aktywności, co faktycznie wywołał i co wróciło w odpowiedzi. Jeśli pojawiła się odmowa, niemal zawsze wskaże ona pole, które było nieprawidłowe, oraz alternatywę.

## Jak sprawić, by asystent AI dobrze planował

Asystent, który zna narzędzia, wciąż może zbudować harmonogram bezużyteczny dla planisty: zadania bez powiązań, sztywna data przy każdym zadaniu albo podział zbyt drobny, by dało się go utrzymać. Zasady, które temu zapobiegają, opisuje przewodnik [Dobre planowanie](docs://gids-goed-plannen) — daj go asystentowi do przeczytania, zanim zacznie, albo powołaj się na niego w poleceniu. W kodzie źródłowym Open Planner Studio znajduje się ponadto krótka umiejętność agenta w `.claude/skills/goed-plannen/`, która w kwestii treści odsyła do tego samego przewodnika i dodaje tylko to, co dotyczy agenta: w jakiej kolejności używać narzędzi `planner_` i co zgłosić użytkownikowi.

## Czytaj dalej

- [Baseline i postęp](docs://gids-baselines-voortgang) — co data statusu robi z Twoim harmonogramem. Warto to wiedzieć, zanim pozwolisz asystentowi ją ustawić: to nie jest tylko data raportowa, przesuwa też do przodu jeszcze nierozpoczętą pracę.
- [Import/eksport](docs://gids-import-export) — jak IFC, CSV, MS Project i P6 mają się do siebie.
- [Ustawienia](docs://ref-instellingen) — wszystkie ustawienia w jednym miejscu, łącznie z dwoma przełącznikami AI.
