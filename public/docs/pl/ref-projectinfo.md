# Nowy projekt i Ustawienia projektu

Pola okna *Nowy projekt* oraz *Ustawienia projektu*: co robi każde pole, jaka jest wartość domyślna i gdzie działa. To dwie strony tego samego formularza. *Nowy projekt* tworzy nowy projekt i ma kilka dodatkowych pól. *Ustawienia projektu* zmieniają projekt, który masz otwarty.

## Otwieranie

**Nowy projekt** — *Plik › Nowy*, Ctrl+N lub przycisk plus po prawej stronie kart dokumentów (*Rozpocznij projekt*, potem *Nowy projekt*). Okno otwiera się z kursorem w polu *Nazwa projektu*.

**Ustawienia projektu** — *Ustawienia › Projekt › Ustawienia projektu* otwiera formularz jako okno o tytule *Ustawienia projektu*. *Plik › Ustawienia projektu* pokazuje ten sam formularz na ekranie *Plik*. Blok *Profil obliczeń i opcje* znajduje się na dole, w obu miejscach. Co w nim jest, opisuje [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).

## Utwórz, zastosuj i anuluj

**Utwórz** (w oknie *Nowy projekt*) tworzy projekt. Jeśli bieżąca karta jest pusta i niezmieniona, aplikacja używa tej karty. W przeciwnym razie projekt otwiera się na nowej karcie. **Zastosuj** (w oknie *Ustawienia projektu*) zapisuje Twoje zmiany w projekcie.

- **Tylko po kliknięciu przycisku Zastosuj.** Wpisujesz w szkic. Projekt zmienia się dopiero, gdy klikniesz *Zastosuj*. *Zastosuj* zapisuje tylko to, co naprawdę zmieniłeś, jako jeden krok, który można cofnąć (*Cofnij*). Jeśli klikniesz *Zastosuj* bez zmiany, nic się nie dzieje i nie dodaje się żaden krok.
- **Anuluj, krzyżyk i Esc** zamykają okno bez zapisywania czegokolwiek. Kliknięcie obok okna go nie zamyka: to, co wpisałeś, zostaje.
- **Enter** działa jak *Utwórz* lub *Zastosuj*, z wyjątkiem pola *Opis* i otwartej listy rozwijanej.
- **Na ekranie Plik** *Ustawienia projektu* pokazują na dole *Zmiany nie zostały zastosowane — kliknij Zastosuj, aby je zachować.*, dopóki Twój szkic różni się od projektu. Jeśli potem opuścisz ekran, aplikacja zapyta, czy chcesz zastosować zmiany, je odrzucić, czy anulować. Zobacz [Wstążka, karta po karcie](docs://ref-lint).
- **Niestandardowy profil obliczeń bez nazwy** blokuje *Zastosuj* i *Utwórz*. Nadaj mu nazwę albo odrzuć zmianę.

## Pola w obu oknach

**Nazwa projektu** — nazwa projektu w pasku tytułu, na karcie i w nazwie pliku, gdy zapiszesz. Domyślnie: puste. Puste pole jest dozwolone: projekt wtedy nazywa się *Nowy harmonogram* i jest pokazany szarym tekstem w polu. Gdzie działa: cały ekran.

**Opis** — dowolny tekst. Domyślnie: puste. Skutek: zapisywany razem z projektem, w pliku IFC i w eksporcie do Primavera P6 XML. Nie ma wpływu na harmonogram.

**Autor** — dowolny tekst. Domyślnie: puste. Skutek: trafia do pliku IFC i pojawia się jako *Autor:* w nagłówku raportu, gdzie nie możesz go ponownie wpisać.

**Biblioteka zasobów** — z którą biblioteką zasobów projekt jest połączony. Wybierz *brak (projekt niezależny)*, jedną ze swoich bibliotek albo *+ Nowa biblioteka zasobów…*. Domyślnie: w oknie *Nowy projekt* domyślna biblioteka, w oknie *Ustawienia projektu* bieżące połączenie. Skutek: zobacz [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken). Gdy wybierzesz opcję *+ Nowa biblioteka zasobów…*, wpisujesz nazwę w polu poniżej. Biblioteka powstaje dopiero przy *Utwórz* lub *Zastosuj*, więc anulowanie nic nie zostawia. Połączenie w oknie *Ustawienia projektu* zmienia się tylko wtedy, gdy sam ruszysz to pole.

**Klient/organizacja** — dowolny tekst. Domyślnie: puste. Skutek: trafia do pliku IFC i pojawia się jako *Firma:* w nagłówku raportu.

**Data rozpoczęcia** — początek projektu. Domyślnie: w oknie *Nowy projekt* dzisiaj. Co robi to pole, znajdziesz niżej w sekcji *Co robi data rozpoczęcia*.

**Data zakończenia** — planowany koniec projektu. Domyślnie: puste. Skutek: to informacja, nie wymóg. Aplikacja nie planuje do tej daty. Pojawia się w nagłówku raportu i w eksportach. Określa też, do którego roku generowane są święta. Tylko w pliku Primavera z ustawieniem *Licz zapas do daty zakończenia projektu* (zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies)) obliczanie zapasu sięga do tej daty.

**Domyślna jednostka nowych zadań** — widoczne tylko wtedy, gdy opcja *Włącz planowanie godzinowe* jest zaznaczona. Wybierz *Dni* albo *Godziny*. Domyślnie: *Dni*. Skutek i warunki: zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).

**Profil obliczeń i opcje** — w oknie *Ustawienia projektu* cały blok. W oknie *Nowy projekt* tylko listę rozwijaną *Profil obliczeń* z wyborem *Primavera P6*, *Microsoft Project* lub *Open Planner Studio*. Domyślnie: *Open Planner Studio*. Wybór profilu ustawia też domyślne opcje tego profilu. Zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).

## Tylko w ustawieniach projektu

**Schemat IFC przy zapisie** — który schemat IFC znajduje się w nagłówku zapisanego pliku. Wybór: *IFC 4.3 ADD2 (domyślny)*, *IFC 4.3* i *IFC4*. Domyślnie: *IFC 4.3 ADD2 (domyślny)*. Dla otwartego pliku IFC: schemat tego pliku. Skutek: zmienia się tylko nagłówek pliku, nie zawartość. Użyj tego, aby połączyć harmonogram z modelem budynku w tym samym schemacie. Jeśli otwarty plik ma inny schemat niż domyślny, aplikacja przy pierwszym zapisie pyta, czy zachować ten schemat. Wybór w tym miejscu liczy się jako odpowiedź. Inny wybór tutaj nie jest krokiem w *Cofnij*: schemat należy do pliku. Zobacz [Wybieranie schematu IFC](docs://howto-ifc-schema-kiezen).

## Tylko w oknie Nowy projekt

**Szablon faz** — jakie fazy ma projekt na starcie. Wybierz jedną z opcji: *Pusty*, *Budownictwo mieszkaniowe* i *Budownictwo użytkowe / remont*. Domyślnie: *Pusty*. Skutek: *Pusty* daje projekt bez zadań. Pozostałe dwa dodają gotowe osiem zadań faz. Każde ma czas trwania 5 w domyślnej jednostce projektu (5 dni roboczych, albo 5 godzin, jeśli w polu *Domyślna jednostka nowych zadań* wybierzesz *Godziny*) i nie ma relacji. Sam zmieniasz nazwy, przesuwasz je i wydłużasz. Dla *Budownictwo mieszkaniowe* są to: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking and Oplevering. Dla *Budownictwo użytkowe / remont*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen and Oplevering. Namen są danymi projektu i pozostają w języku niderlandzkim, także przy innym języku interfejsu. Gdy *Włącz tryb budowlany* jest wyłączone, istnieje tylko *Pusty*. Zobacz [Ustawienia aplikacji](docs://ref-instellingen).

**Zmiana** — widoczne tylko wtedy, gdy *Włącz planowanie godzinowe* jest zaznaczone. Wybierz jedną z opcji: *Zmiana dzienna*, *2 zmiany*, *3 zmiany* i *24/7*. Domyślnie: *Zmiana dzienna*. Skutek: *Zmiana dzienna* zostawia standardowy kalendarz bez zmian, czyli zwykły kalendarz dzienny od poniedziałku do piątku. Pozostałe trzy dodają pasma czasu pracy do kalendarza projektu, tak jak przyciski o tej samej nazwie w oknie *Kalendarze*. Jakie to godziny, opisuje [Ustawianie godzin pracy](docs://howto-werktijden-instellen). Gdy wybierzesz opcję *Zmiana dzienna*, nie można wybrać *Godziny* w polu *Domyślna jednostka nowych zadań*, bo kalendarz dzienny nie ma pasm pracy.

**Zestaw świąt** — jakie dni wolne dostaje kalendarz projektu. W polu *Kraj* wybierz jedną z opcji: *Holandia* (domyślnie), *Niemcy*, *Belgia*, *Francja*, *Wielka Brytania*, *Austria*, *Szwajcaria*, *Bez świąt* albo *Niestandardowy…*. Jeśli kraj ma regiony, pojawia się lista rozwijana *Region*. Dla Holandii wybierasz też, gdy *Włącz tryb budowlany* jest włączone, *Urlop budowlany*: *Brak* (domyślnie), *Północ*, *Środek* lub *Południe*. Pod spodem jest wiersz w stylu *36 świąt, 2025–2029*. Rozwiń go, aby zobaczyć listę. Lata obejmują okres od roku przed datą rozpoczęcia do roku po dacie zakończenia. Gdy nie ma daty zakończenia, to do trzech lat po roku startu. *Niestandardowy…* daje kalendarz bez świąt i otwiera zaraz po utworzeniu okno *Kalendarze*, żebyś mógł je sam uzupełnić. Kalendarz projektu nazywa się *Bouwkalender NL*, albo *Standaardkalender*, gdy *Włącz tryb budowlany* jest wyłączone. Wtedy wybór to również *Bez świąt*. Jak działa generator, opisuje [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren).

## Co robi data rozpoczęcia

Data rozpoczęcia jest punktem odniesienia projektu. Trzy reguły:

- **Nowe zadania zaczynają się w dniu rozpoczęcia.** Dodane zadanie dostaje jako planowany początek datę rozpoczęcia.
- **Zadanie z poprzednikiem nigdy nie zaczyna się przed datą rozpoczęcia.** Gdy zakończenie poprzednika jest wcześniejsze, zadanie czeka do dnia rozpoczęcia. Zadanie *bez* poprzednika zachowuje swoją datę, nawet gdy leży przed dniem rozpoczęcia. Jest to potrzebne, aby pokazać harmonogram z Microsoft Project lub Primavera tak, jak pokazuje go program źródłowy. Ograniczenie *Musi rozpocząć się (MSO)* lub *Musi zakończyć się (MFO)* łamie obie reguły. Takie zadanie stoi na swojej dacie, nawet gdy wypada przed dniem rozpoczęcia.
- **Późniejsza data rozpoczęcia przesuwa luźne zadania.** Gdy w oknie *Ustawienia projektu* ustawisz datę rozpoczęcia później i klikniesz *Zastosuj*, zadania bez poprzednika i bez ograniczenia, które ustala dolną granicę (*rozpocznij nie wcześniej niż*, *musi rozpocząć się*, *zakończ nie wcześniej niż* lub *musi zakończyć się*), przesuną się na nową datę. Dzieje się to, gdy ich data leżałaby przed nową datą rozpoczęcia. Przesunięcie jest w tym samym kroku w *Cofnij*. Aplikacja podaje, ile zadań przesunęła. Dzieje się to tylko wtedy, gdy sam zmienisz datę rozpoczęcia, nigdy przy otwieraniu pliku. Ustawienie późniejszej daty nie przesuwa reszty harmonogramu. Do tego służy *Przesuń projekt*, zobacz [Przesuwanie projektu](docs://howto-project-verplaatsen).

## Zobacz także

- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): blok *Profil obliczeń i opcje*.
- [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen): dlaczego profil zmienia wynik.
- [Przesuwanie projektu](docs://howto-project-verplaatsen): cały harmonogram na inny start.
- [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen): start od pierwszych zadań.
- [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren): zestaw świąt szczegółowo.
- [Wybieranie schematu IFC](docs://howto-ifc-schema-kiezen): zapis do modelu budynku w IFC4.
