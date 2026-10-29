# Jak działa połączenie z AI

Co się naprawdę dzieje, gdy asystent AI pracuje w Twoim harmonogramie? W tym artykule czytasz, czym jest połączenie, czym różni się od wymiany pliku, jakie ograniczenia aplikacja sama pilnuje i skąd asystent dowiaduje się, jak harmonogram należy zbudować. Przykład na końcu pokazuje liczbami, co asystent może zrobić w jednym kroku i co z tego możesz cofnąć.

## Pojęcie

Asystent AI, na przykład program czatu lub asystent programistyczny, może obsługiwać inny program przez **Model Context Protocol** (MCP). W tej wymianie Open Planner Studio pełni rolę serwera. Aplikacja na pulpicie uruchamia mały serwer na Twoim komputerze, **most**. Asystent łączy się z mostem i dostaje listę **narzędzi**, czyli funkcji o nazwie zaczynającej się od `planner_`, na przykład do czytania zadań, dodawania relacji lub zapisywania planu bazowego. Które narzędzia są dostępne, opisuje [Narzędzia AI](docs://ref-ai-tools).

Warto zauważyć: asystent pracuje w projekcie, który masz w danej chwili otwarty, nie w kopii. Nic nie eksportujesz i nic nie importujesz. Nie ma momentu, w którym Ty i asystent patrzycie na dwie różne wersje. Zadanie, które dodaje asystent, od razu pojawia się w Gantt. Aplikacja jest w tym ostrożna: asystent pracuje z tym samym obliczeniem, tą samą historią cofania i tymi samymi regułami co Ty.

Jak włączyć połączenie, opisuje [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen). Poniżej czytasz, jak to działa.

## Jak aplikacja to obsługuje

### Serwer, który słyszy tylko Twój komputer

Most nasłuchuje tylko na Twoim komputerze (`127.0.0.1`), na jednym porcie, domyślnie 3877. Przyjmuje żądania tylko pod adresem `/mcp` i tylko wtedy, gdy masz Twój **token** w nagłówku `Authorization: Bearer`. Żądanie bez właściwego tokenu odrzuca. Żądanie z przeglądarki, którą rozpoznaje po nagłówku `Origin`, także odrzuca. Dzięki temu strona internetowa, którą masz otwartą, nie może rozmawiać z Twoim harmonogramem. Most przetwarza żądania ściśle jedno po drugim.

Połączenie to zwykłe HTTP na Twoim komputerze; przez samą aplikację nic nie wychodzi. Co asystent robi z harmonogramem, który odczytał, na przykład co robi z nim dostawca asystenta, zależy od asystenta i leży poza aplikacją.

### Asystent pracuje na jednym dokumencie

Przy pierwszej zmianie most wiąże połączenie z dokumentem, który wtedy jest aktywny. Jeśli potem sam przełączysz kartę, aplikacja odrzuca kolejną zmianę asystenta z kodem `DOC_DRIFT`. Asystent musi najpierw narzędziem `planner_switch_document` potwierdzić, z którym dokumentem chce pracować. Dzięki temu nic nie trafia do złego projektu. Asystent, który sam otwiera lub duplikuje dokument, pracuje od tej chwili w tym nowym dokumencie.

### Każda zmiana powoduje przeliczenie

W aplikacji planujesz ręcznie: zmieniasz coś, a potem naciskasz *Oblicz* (F5), chyba że jest włączona opcja *Oblicz automatycznie*. Dla zmiany asystenta nie jest to potrzebne. Każde polecenie zapisu asystenta przechodzi przez jedną transakcję. Jeśli zmienią się dane projektu, aplikacja sama przelicza na końcu, dla skryptu raz. Narzędzie do odczytu zawsze podaje aktualne daty. Gdy harmonogram jest nieaktualny, na przykład bo sam coś zmieniłeś i jeszcze nie nacisnąłeś *Oblicz*, narzędzie najpierw przelicza. Jest jeden wyjątek. Gdy projekt jest w widoku *Daty zapisane* (po imporcie), narzędzie do odczytu nie przelicza po cichu, bo zastąpiłoby te daty. Asystent dostaje wtedy zapisane daty z informacją, że nie zostały przeliczone. Zmiana wykonana przez samego asystenta zawsze przelicza, także wtedy. Po zmianie asystenta nie musisz naciskać *Oblicz*. Asystent odczytuje wynik, na przykład koniec projektu i ścieżkę krytyczną, narzędziami do odczytu. Zobacz też [Daty zapisane](docs://uitleg-datums-zoals-opgeslagen).

### Skrypt to jeden krok

Asystent może wysłać serię kroków jako całość narzędziem `planner_batch`, czyli skryptem z maksymalnie 100 kroków. Dzięki temu masz jeden krok cofnięcia, jedno przeliczenie i jedną kopię zapasową. Gdy jeden krok zawiedzie strukturalnie, na przykład przez nieznane narzędzie lub cykl w relacjach, aplikacja cofa cały skrypt. Nigdy nie zostaje Ci połowicznie gotowy harmonogram. Odmowa jednej pozycji w zbiorczym kroku, na przykład jednej nieprawidłowej linii postępu z dwudziestu, jest łagodniejsza: ta pozycja zostaje pominięta, a reszta wykonana. Odmowy zapisane są na początku odpowiedzi.

### Twoje ograniczenia

Cztery ustawienia wybierasz sam na karcie *AI*:

- *Wstrzymaj* i *Tylko do odczytu* zostawiają asystenta połączonego, ale odrzucają każdą zmianę. Czytanie pozostaje możliwe, łącznie z przeliczeniem nieaktualnego harmonogramu przy odczycie. To są pola obliczane, nie dane projektu, więc nie dodaje to kroku cofnięcia i projekt nie jest uznany za zmieniony. Jeśli sam jesteś w trakcie edycji, na przykład przeciągasz pasek albo wpisujesz wartość w polu, narzędzie do odczytu nie przelicza: asystent dostaje wtedy daty sprzed Twojej edycji, z informacją, że są nieaktualne.
- Otwarte okno dialogowe blokuje wszystko. Gdy na przykład jest otwarte okno zadania, ustawienia, tryb prezentacji lub okno powitalne, aplikacja odrzuca także odczyt, bo jesteś w trakcie ręcznej czynności. Asystent dostaje kod błędu `DIALOG_OPEN`. Komunikat podaje wewnętrzną nazwę tego, co jest otwarte, na przykład `showTaskDialog` dla okna zadania.
- *Automatyczna kopia zapasowa* zapisuje kopię IFC przed pierwszą zmianą w każdym dokumencie. Gdy ta kopia się nie uda, aplikacja zmiany nie wykonuje.
- *Panel aktywności* pokazuje każde wywołanie z argumentami i odpowiedzią.

Oprócz tego działa Twoje zwykłe *Cofnij* (Ctrl+Z). Asystent dzieli tę historię z Tobą i ma własne narzędzia `planner_undo` i `planner_redo`.

### Czego asystent nie może zrobić

Most jest celowo węższy niż aplikacja. Czego asystent nie może zrobić, ma zwykle jeden z trzech powodów.

**Sięga dalej niż sam projekt.** Asystent nie może zmienić biblioteki zasobów. Biblioteka jest wspólna dla wszystkich Twoich projektów i leży poza historią cofania. Jedna zmiana stawki działałaby wtedy w projektach, które nawet nie są otwarte. Dla zasobu z biblioteki nazwa, typ, opis, stawka godzinowa i jednostka są ustalone, tak jak w panelu zasobów. To, co decyduje projekt, zostaje przy asystencie: maks. jednostki, dostępność w czasie, kalendarz i ekipa. Nie może też wybrać, który kalendarz jest kalendarzem projektu. Profil obliczeń i opcje obliczeń może odczytać, ale nie zmienić; może ustawić tylko tryb postępu i domyślną wartość typu zadania dla projektu. Nie ma narzędzi do ustawień, motywu, języka, rozszerzeń ani aktualizacji.

**Nie nadaje się do pewnej walidacji.** Asystent nie może ustawić hamaka, ręcznie zaplanować zadania, ustawić drugiego ograniczenia, wpisać notatek, kolorów, kodów czynności, pól niestandardowych ani relacji zewnętrznych, i nie może ręcznie ustawić opóźnienia bilansowania. Kodu WBS też nie wybiera; ten wyznacza aplikacja sama.

**Dotyka czegoś, o czym musisz zdecydować sam.** Postęp zapisuje tylko wtedy, gdy istnieje data statusu. Asystent jej sam nie wybiera: to Twoja data odniesienia. Jeśli zadanie, które jeszcze się nie zaczęło, ma planowany start po dacie statusu, asystent musi podać rzeczywiste rozpoczęcie. Pliki czyta i zapisuje tylko w Twoim folderze użytkownika i nadpisuje istniejący plik tylko wtedy, gdy o to wyraźnie poprosi. Eksport nie równa się poleceniu *Zapisz*: projekt pozostaje w aplikacji niezapisany.

### Skąd asystent wie, jak planować

Asystent, który zna narzędzia, może i tak zbudować harmonogram, którego żaden planista nie potrzebuje: zadania bez relacji, stała data przy każdym zadaniu albo podział, który jest zdecydowanie za drobny. Dlatego aplikacja daje mu trzy rzeczy.

**Podstawowe reguły w powitaniu MCP.** Przy połączeniu most wysyła krótki tekst w polu `instructions` powitania MCP. Wiele klientów wkłada ten tekst do swojego promptu systemowego. Czy Twój klient to robi, zależy od klienta. Reguły: zacznij od kamieni milowych i daty oddania, buduj zadania o długości mniej więcej od dnia do dwóch tygodni, steruj harmonogramem relacjami, a nie stałymi datami, ograniczeń używaj tylko dla twardych zewnętrznych dat, napraw najpierw nieudane obliczenie, używaj `planner_batch` dla spójnej serii, zapisuj postęp tylko z Twoją datą statusu i rzeczywistymi datami, które podasz, a na końcu napisz, co zakładałeś i czego świadomie nie zrobiłeś.

**Przewodnik dla asystentów.** Narzędzie `planner_get_planning_guide` zwraca przewodnik napisany specjalnie dla asystentów. Opiera się na tych samych zasadach co [Dobre planowanie](docs://gids-goed-plannen), ale asystent pracuje inaczej niż Ty: nie naciska F5 i nie klika we wstążkę, tylko wywołuje narzędzia, a aplikacja dla niego przelicza. Przewodnik dlatego podaje przy każdej zasadzie, których narzędzi asystent używa, i wyjaśnia, co asystent robi przy widoku *Daty zapisane* albo przy nieudanym obliczeniu. Przewodnik jest po angielsku, tak jak wszystko, co asystent czyta przez połączenie. Narzędzie nadal przyjmuje wybór języka dla starszych asystentów, ale tekst się przez to nie zmienia. Sam możesz go przeczytać pod adresem `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Prompt połączenia z okna *Szczegóły połączenia* prosi asystenta, żeby najpierw przeczytał przewodnik. Narzędzie działa też wtedy, gdy okno dialogowe jest otwarte, przy wstrzymaniu i w trybie tylko do odczytu, bo nie czyta Twojego harmonogramu.

**Dwie umiejętności.** Umiejętność to mały plik z instrukcjami, który asystent czyta przy każdej sesji. Są dwie, bo to dwa rodzaje pracy. Ustawianie harmonogramu dotyczy logiki, a aktualizacja postępu dotyczy faktów, które zna tylko Ty. Umiejętność *goed-plannen* służy do ustawiania lub przebudowy harmonogramu: kolejność narzędzi, reguła przeliczania, `planner_batch` i obowiązek podania założeń. Umiejętność *progress-update* służy do tygodniowej aktualizacji postępu: najpierw Twoja data statusu, potem rzeczywiste daty rozpoczęcia i zakończenia oraz procent ukończenia, a na końcu raport odchylenia od planu bazowego, ścieżki krytycznej i nowej daty zakończenia projektu. Zasady planowania zapisane są w przewodniku. Obie umiejętności są po angielsku. Narzędzie zwraca obie, z opisem, gdzie pasują. Jak je zainstalować, opisuje [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen).

## Przykład

Prosisz asystenta: zbuduj dobudówkę z fundamentem, murem i dachem, w tej kolejności. Twój projekt zaczyna się w poniedziałek 2 marca 2026. Asystent najpierw czyta przewodnik, a potem wysyła jeden skrypt:

1. początek projektu 2 marca 2026;
2. trzy zadania: Foundation na 5 dni roboczych, Brickwork na 10 i Roof na 4;
3. dwie relacje zakończenie-rozpoczęcie: Foundation do Brickwork, Brickwork do Roof.

Aplikacja wykonuje trzy kroki i przelicza. Gdy asystent potem odczyta wynik, zobaczy: koniec projektu w czwartek 26 marca 2026, czas trwania projektu 19 dni roboczych i wszystkie trzy zadania krytyczne. To zgadza się z sumą: 5 + 10 + 4 to 19 dni roboczych, a 19 dni roboczych po poniedziałku 2 marca kończy się w czwartek 26 marca. Cały skrypt to jeden krok w Twojej historii. Jedno *Cofnij* usuwa trzy zadania, dwie relacje i nowy początek projektu.

Teraz scenariusz „co jeśli”. Prosisz asystenta, żeby zaktualizował postęp. W tym celu ustawia datę statusu na poniedziałek 16 marca. Data statusu nie jest etykietą: praca, która jeszcze się nie zaczęła, nie może leżeć przed tą datą i przesuwa się na nią. Bez ani jednej linii postępu cały harmonogram przesuwa się więc razem: Foundation trwa od 16 do 20 marca, Brickwork od 23 marca do 7 kwietnia, a Roof od 8 do 13 kwietnia. Koniec projektu skacze z 26 marca na 13 kwietnia. Harmonogram przesuwa się o dwa tygodnie robocze, a kalendarz w tym przykładzie, *Bouwkalender NL*, ma Wielki Piątek (3 kwietnia) i Wielkanoc (5 i 6 kwietnia). Te dwa wolne dni robocze przesuwają koniec o kolejne dwa dni. Dlatego asystent ustawia datę statusu tylko na Twoją prośbę i tylko wtedy, gdy jest prawdziwy postęp do zapisania.

## Skutki dla harmonogramu i częste błędne przekonania

**Asystent nie ma własnej kopii.** Co zmienia, zmienia Twój projekt. Przy włączonej *Automatycznej kopii zapasowej* masz kopię IFC przed jego pierwszą zmianą. Przy *Tylko do odczytu* może analizować bez żadnych zmian.

**Nowy token przerywa wszystkie połączenia.** Token to hasło mostu. Nowy token unieważnia stary, także na działającym moście, a asystent musi dostać nowy.

**Tekst asystenta, że się udało, nie jest dowodem.** Panel aktywności pokazuje, które narzędzie asystent naprawdę wywołał i co wróciło. Odmowa niemal zawsze podaje pole, które było złe, i drogę, która działa.

**Asystent nie może przetestować scenariusza „co jeśli” z cofnięciem.** Dzieli historię cofania z Tobą, więc dla wariantów duplikuje dokument narzędziem `planner_duplicate_document`. Kopia jest odłączona, nie ma ścieżki pliku i pokazuje się jako niezapisana. Asystent nie zamyka wariantów; to Ty o tym decydujesz.

**Eksport przez asystenta nie jest zapisaniem.** Zapisuje plik IFC pod ścieżką, którą sam wybiera, w Twoim folderze użytkownika, i nadpisuje istniejący plik tylko wtedy, gdy wyraźnie o to poprosi. Twój projekt pozostaje w aplikacji niezapisany i zachowuje własny cel zapisu. Gdy asystent importuje plik, otwiera się on w nowej karcie albo w pustej, niezmienionej karcie.

## Zobacz także

- [Podłączanie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen): kroki, aby uruchomić most, podłączyć asystenta i zainstalować umiejętność.
- [Narzędzia AI](docs://ref-ai-tools): wszystkie narzędzia według grup, czego odmawiają i jak długo trzymane są kopie zapasowe.
- [Dobre planowanie](docs://gids-goed-plannen): zasady planowania; asystent dostaje je w angielskiej wersji z dodanymi narzędziami.
- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): co data statusu robi z harmonogramem.
