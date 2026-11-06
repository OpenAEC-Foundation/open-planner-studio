# Podłączanie klienta MCP

Cel: pozwól klientowi MCP śledzić Twój harmonogram na bieżąco i w nim pracować, z wglądem w to, co robi, oraz z ograniczeniami, które sam ustalasz.

## Szybko: niech Claude to zrobi

Pracujesz z Claude Desktop lub Claude Code? Wtedy Claude może sam zainstalować połączenie:

1. Kliknij poniżej *Skopiuj prompt*.
2. Wklej prompt do nowego czatu z Claude i wyślij go.

Claude następnie instaluje rozszerzenie dla Open Planner Studio i po drodze wyjaśnia, co ono robi. Jeśli musisz coś zrobić sam, na przykład kliknąć *Zainstaluj* w Claude Desktop, Claude dokładnie powie ci, które kliknięcie wykonać. Nie potrzebujesz do tego tokenu.

```prompt
Zainstaluj za mnie rozszerzenie Open Planner Studio, abyś mógł czytać i zmieniać moje harmonogramy budowy w Open Planner Studio. Zrób tyle, ile możesz sam. Przed każdym krokiem powiedz w jednym prostym zdaniu, co zamierzasz zrobić i dlaczego. Jeśli potrzebujesz mojej pomocy, pytaj o jedną rzecz naraz i czekaj na moją odpowiedź. Jeśli sam muszę coś zrobić, powiedz mi dokładnie, jakie jedno kliknięcie lub działanie wykonać i gdzie.

Co musisz wiedzieć:
- Rozszerzenie to jeden plik, open-planner-studio-<version>.mcpb, w najnowszym wydaniu: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Bezpośredni link znajdziesz pod adresem https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (w nim plik, którego nazwa kończy się na .mcpb). Plik to archiwum ZIP.
- Rozszerzenie działa z aplikacją desktopową Open Planner Studio, ale też bez niej. Gdy aplikacja jest otwarta i działa jej mostek MCP, pracujesz w planie, który jest otwarty w aplikacji. Gdy aplikacja jest zamknięta, pracujesz na plikach harmonogramów w folderze roboczym, który wybiorę.
- Instalacja nie wymaga tokenu ani hasła. Nie proś mnie o żadne z nich i nie odczytuj ani nie pokazuj ich.

Jeśli działasz w Claude Desktop:
1. Jeśli możesz pobrać plik i otworzyć go na moim komputerze, zrób to z plikiem .mcpb. Jeśli nie możesz, podaj mi bezpośredni link do pobrania i powiedz mi, żebym dwukrotnie kliknął plik, gdy pobieranie się zakończy.
2. Claude Desktop pokazuje wtedy rozszerzenie Open Planner Studio. Powiedz mi, żebym kliknął Zainstaluj. Potem powiedz mi, żebym przy Working folder wybrał folder z moimi plikami harmonogramów.
3. Powiedz mi, żebym rozpoczął nowy czat i zapytał cię tam, jakie narzędzia Open Planner Studio widzisz.

Jeśli działasz w Claude Code:
1. Sprawdź, czy jest zainstalowany Node.js 22 lub nowszy. Jeśli nie, powiedz mi, jak go zainstalować, i zatrzymaj się.
2. Zapytaj mnie, w którym folderze są moje pliki harmonogramów. To jest folder roboczy.
3. Pobierz plik .mcpb i rozpakuj go do nowego, własnego folderu w moim folderze użytkownika. Przeczytaj tam manifest.json: server.mcp_config mówi, jak uruchamia się serwer. Zastąp ${__dirname} przez rozpakowany folder, a ${user_config.workdir} przez folder roboczy.
4. Uruchom claude mcp list. Jeśli serwer o nazwie open-planner-studio już tam jest, zapytaj mnie, czy wolno ci go zastąpić. Nie pokazuj jego ustawień, bo mogą zawierać token.
5. Dodaj serwer dla mojego konta użytkownika, na przykład: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<folder roboczy> -- node <rozpakowany folder>/server/index.mjs
6. Powiedz mi, żebym rozpoczął nową sesję Claude Code i że /mcp tam pokazuje, czy serwer open-planner-studio jest połączony.

Jeśli działasz gdzie indziej, na przykład w claude.ai w przeglądarce, powiedz mi, że to wymaga Claude Desktop lub Claude Code. Jeśli nie wiesz, gdzie działasz, zapytaj mnie.

Gdy instalacja jest gotowa, wyjaśnij w kilku zdaniach:
- jak ci pozwalam pracować w otwartej aplikacji: w Open Planner Studio wybierz Ustawienia › Projekt › Ustawienia aplikacji, kartę Zaawansowane, i włącz opcję Zezwalaj na połączenie MCP. Potem kliknij Uruchom mostek na karcie MCP.
- że bez aplikacji zmiana trafia do pliku dopiero po tym, jak go zapiszesz, i że nie nadpisujesz istniejącego pliku, gdy aplikacja jest otwarta.
Jeśli któryś krok się nie uda, powiedz mi w jednym zdaniu, co poszło źle i co mogę zrobić. Nie zgaduj.
```

Wolisz zrobić to sam, czy używasz innego klienta MCP? Wtedy wykonaj poniższe kroki.

## Kiedy tego potrzebujesz

Chcesz, żeby klient MCP czytał, analizował lub zmieniał Twój harmonogram. Na przykład żeby przygotował pierwszy szkic WBS, poprawił zadania albo wyjaśnił ścieżkę krytyczną. Działa to dzięki **Model Context Protocol** (MCP): standardowi, który pozwala programowi AI, czyli **klientowi MCP**, używać narzędzi innego programu. Do tego Open Planner Studio uruchamia na Twoim własnym komputerze mały serwer, **mostek**. Oferuje zestaw narzędzi, których nazwy wszystkie zaczynają się od `planner_`: czytanie i zmienianie zadań, relacji, zasobów, kalendarzy, planów bazowych, dokumentów i plików. Jakie narzędzia są dostępne i czego nie zrobią, opisano w [Narzędzia MCP](docs://ref-ai-tools). Klient MCP pracuje w projekcie, który masz otwarty, a nie w kopii: zadanie, które doda, od razu pojawia się w widoku Gantt. Używa tego samego obliczenia i tej samej historii *Cofnij* co Ty.

Mostek działa tylko w aplikacji desktopowej. Jeśli zezwolisz na połączenie MCP w przeglądarce, zobaczysz kartę *MCP*, ale przycisk *Uruchom mostek* jest wyszarzony, z tekstem *Mostek działa tylko w aplikacji desktopowej*. Reszta tego artykułu dotyczy aplikacji desktopowej. W przeglądarce są też wyszarzone przyciski *Utwórz kopię zapasową teraz* i *Otwórz folder kopii zapasowych*.

## Kroki

### 1. Zezwól na połączenie MCP

1. Wybierz *Ustawienia › Projekt › Ustawienia aplikacji*. Możesz też wybrać *Plik › Ustawienia aplikacji* albo ikonę koła zębatego u góry.
2. Wybierz zakładkę *Zaawansowane* i włącz *Zezwalaj na połączenie MCP*. Zakładka *MCP* pojawia się na wstążce.
3. Jeśli chcesz, aby mostek był aktywny zaraz po starcie aplikacji, włącz także *Automatycznie uruchamiaj most*. Ta opcja działa tylko wtedy, gdy połączenie MCP jest włączone, i tylko w aplikacji desktopowej. Domyślnie jest wyłączona, bo otwarcie portu to świadomy wybór.

Jeśli wyłączysz połączenie MCP, mostek przestaje działać, a zakładka *MCP* zniknie.

### 2. Uruchom mostek

1. Przejdź do zakładki *MCP* i kliknij *Uruchom mostek* w grupie *Serwer*.
2. Zobacz stan obok przycisku. Pokazuje *Wyłączony*, *Aktywny na porcie 3877*, *Port 3877 zajęty* albo *Błąd*. Gdy uruchomienie się powiedzie, pokazuje *Aktywny na porcie 3877*, a przycisk nazywa się *Zatrzymaj mostek*. Gdy stan to *Port 3877 zajęty* albo *Błąd*, przycisk nadal nazywa się *Uruchom mostek*; zob. sekcję o pułapkach.

Mostek nasłuchuje tylko na Twoim komputerze, na jednym porcie. Domyślnie jest to port 3877. W grupie *Połączenie* możesz w polu *Port* wybrać inny port, ale tylko wtedy, gdy mostek jest zatrzymany. Połączenie działa przez zwykłe HTTP na Twoim komputerze. Aplikacja sama niczego nie wysyła. Co klient MCP robi z Twoim harmonogramem, na przykład co z nim robi jego dostawca, leży poza aplikacją.

### 3. Połącz klienta MCP

1. Kliknij *Połącz* w grupie *Połączenie*. Otwiera się okno *Szczegóły połączenia*.
2. Wybierz, czego potrzebuje Twój klient. Zob. niżej.
3. Token jest ukryty. Ikoną oka go pokazujesz. Przyciski kopiowania zawsze kopiują prawdziwą wartość, nawet gdy ekran ją ukrywa.
4. Poproś klienta MCP o listę narzędzi. Ta kontrola jest też w poleceniu połączenia: klient powinien zobaczyć narzędzia z prefiksem `planner_`; oczekiwana liczba jest w poleceniu połączenia.

Okno oferuje cztery sposoby połączenia:

- *Pozwól Claude to załatwić*: to samo polecenie, co na początku tego artykułu, z przyciskiem *Skopiuj prompt*. Jest to przeznaczone dla Claude Desktop i Claude Code. Do tego nie potrzebujesz tokenu.
- *Fragment konfiguracji*: tekst konfiguracji, który wklejasz w ustawienia MCP swojego klienta.
- *Polecenie połączenia*: tekst, który wklejasz do klienta MCP. Następnie klient połączy się sam.
- *Punkt końcowy* i *Uwierzytelnianie*: osobne dane. Punkt końcowy to `http://localhost:3877/mcp` z transportem *strumieniowy HTTP*. Każde żądanie wymaga nagłówka `Authorization: Bearer`, a po nim Twojego tokenu. Klient musi też obsługiwać sesje MCP: podczas połączenia mostek wydaje kod sesji w nagłówku `Mcp-Session-Id` i odrzuca każde kolejne żądanie bez tego kodu. Claude Code i `mcp-remote` robią to same.

**Połącz się ponownie po aktualizacji aplikacji.** Jeśli Twój klient MCP był już połączony z starszą wersją aplikacji, nie wysyła jeszcze kodu sesji, a mostek odrzuca każde żądanie. Połącz się więc ponownie po aktualizacji: rozpocznij nową sesję w Claude Code i zamknij Claude Desktop całkowicie, a potem uruchom go ponownie.

**Claude Code.** Fragment konfiguracji pasuje bezpośrednio do Claude Code. Wpisz to polecenie w terminalu, z własnym tokenem zamiast `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Możesz też wpisać fragment do pliku `.mcp.json` w folderze projektu. Nie dodawaj tego pliku do gita, bo token daje dostęp do Twojego harmonogramu. Serwer z `.mcp.json` trzeba przy pierwszym użyciu zatwierdzić w Claude Code.

**Claude Desktop.** Dla Claude Desktop jest rozszerzenie: plik `open-planner-studio-<version>.mcpb`. Claude Desktop instaluje je dwukrotnym kliknięciem. Node.js nie jest do tego potrzebny. Rozszerzenie działa z aplikacją i bez niej. Szybciej idzie z poleceniem na początku tego artykułu; poniżej są kroki ręczne.

1. Pobierz plik `.mcpb` z najnowszego wydania: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Kliknij dwukrotnie plik. Claude Desktop się otworzy i pokaże rozszerzenie *Open Planner Studio*. Zainstaluj je. Jeśli dwukrotne kliknięcie nie działa, otwórz w Claude Desktop *Ustawienia › Rozszerzenia* i zainstaluj plik tam.
3. W polu *Working folder* wybierz folder z plikami harmonogramu. Claude używa tego folderu tylko wtedy, gdy aplikacja jest zamknięta. Wtedy Claude czyta i zapisuje tylko w tym folderze.
4. Włącz rozszerzenie i zacznij nowy czat. Zapytaj Claude, które narzędzia Open Planner Studio widzi.

Nie wpisujesz tokenu ani portu: gdy mostek działa, rozszerzenie samo znajduje aplikację. Przy każdym pytaniu Claude rozszerzenie wybiera ponownie:

- *Aplikacja jest otwarta i mostek działa*: Claude pracuje w harmonogramie otwartym w aplikacji. Każdą zmianę widzisz w aplikacji od razu.
- *Aplikacja jest zamknięta albo mostek jest wyłączony*: Claude pracuje na pliku harmonogramu w folderze roboczym. Zmiana trafia do pliku dopiero wtedy, gdy Claude zapisze plik. Nie ma automatycznego zapisu. Dopóki aplikacja jest otwarta, Claude nie nadpisuje istniejącego pliku, tylko zapisuje pod nową nazwą.

Jeśli aplikacja otworzy się lub zamknie, gdy Claude pracuje, rozszerzenie przełącza się i mówi o tym Claude. Claude wtedy najpierw wybiera lub otwiera harmonogram ponownie, a dopiero potem coś zmienia. Jeśli Claude ma jeszcze zmiany poza aplikacją, które nie są zapisane, rozszerzenie działa dalej bez aplikacji, aż Claude je zapisze. Tak nic się nie traci. Jeśli rozszerzenie nie może dotrzeć do aplikacji i nie ma użytecznego folderu roboczego, Claude widzi tylko narzędzie `open_planner_studio_status` z komunikatem, co masz zrobić.

**Claude Desktop bez rozszerzenia.** Jeśli nie możesz użyć rozszerzenia, połącz Claude Desktop zewnętrznym narzędziem `mcp-remote`. Fragment konfiguracji nie pasuje do Claude Desktop bezpośrednio: w pliku `claude_desktop_config.json` podajesz program, który Claude Desktop uruchamia sam, a nie adres. `mcp-remote` wymaga Node.js. W Claude Desktop wybierz *Ustawienia › Deweloper › Edytuj konfigurację*, wklej to do pliku (z własnym tokenem) i uruchom Claude Desktop ponownie:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Token jest w `env`, a nie w `args`, celowo: w Windows Claude Desktop psuje argument, który zawiera spację. *Niestandardowy konektor* w Claude (*Dostosuj › Konektory*) nie działa z mostkiem. Claude łączy się wtedy z chmury Anthropic, a ta nie może dotrzeć do mostka na Twoim komputerze.

W grupie *Połączenie* jest też pole *Token*. To długi, losowy kod, który aplikacja dla Ciebie tworzy i zapisuje na tym komputerze. W oknie jest napisane: *Ten token daje dostęp do otwartego harmonogramu. Nie udostępniaj go innym*. Przy ikonie *Nowy token* tworzysz nowy token. Aplikacja najpierw pyta: *Wygenerowanie nowego tokenu przerywa wszystkie istniejące połączenia. Kontynuować?* Jeśli mostek działa, uruchamia się ponownie z nowym tokenem, a stary token przestaje działać.

**Jak rozszerzenie znajduje aplikację.** Gdy mostek działa, aplikacja zapisuje port i token w pliku `mcp/runtime.json` w folderze danych aplikacji. Rozszerzenie dla Claude Desktop czyta ten plik przy każdym pytaniu. W systemach Linux i macOS tylko Twoje konto użytkownika może czytać ten plik. W Windows chroni go domyślne ACL Twojego folderu profilu; aplikacja tego osobno nie sprawdza. Gdy zatrzymasz mostek albo wyłączysz połączenie MCP, aplikacja usuwa ten plik. Aplikacja trzyma też listę otwartych plików w `mcp/open-files.json`, także gdy połączenie MCP jest wyłączone. Dopóki ten plik istnieje, rozszerzenie i serwer MCP działający bez aplikacji nie nadpisują żadnego istniejącego pliku, także nie pliku, który właśnie otworzyłeś, a którego jeszcze nie ma na liście. Nowy plik wolno utworzyć. Odczytywać też wolno: Claude widzi wtedy wersję z dysku, bez Twoich jeszcze niezapisanych zmian.

### 4. Zobacz, co robi klient MCP

1. Kliknij *Panel aktywności* w grupie *Aktywność*. W bocznej kolumnie otwiera się panel *Aktywność MCP*.
2. Każde wywołanie mostka to jeden wiersz, najnowszy na górze: czas, co się stało, jak długo to trwało i czy się powiodło. Kliknij wiersz, aby rozwinąć *Argumenty* i *Odpowiedź*.
3. Przyciskiem *Wyczyść* opróżnisz listę. Panel przechowuje ostatnie 500 wywołań. Dopóki nic się nie wydarzyło, pokazuje: *Nie ma jeszcze aktywności MCP. Wywołania mostka pojawią się tutaj*.

Gdy połączenie MCP jest włączone, w prawym dolnym rogu paska stanu jest kropka z napisem *MCP*. Jej kolor pokazuje stan mostka, a kliknięcie przenosi Cię do zakładki *MCP*.

### 5. Ustaw limity

W grupie *Bezpieczeństwo* są przyciski, którymi ograniczasz klienta MCP:

- *Wstrzymaj*: klient MCP tymczasowo nie może nic zmieniać, czytanie jest nadal dozwolone. Mostek zostaje aktywny. Przycisk zmienia się w *Wznów*.
- *Tylko do odczytu*: wszystkie narzędzia, które coś zmieniają, są odrzucane, dopóki to jest włączone.
- *Automatyczna kopia zapasowa: włączona*: zanim klient MCP po raz pierwszy coś zmieni w dokumencie, aplikacja zapisuje kopię zapasową w formacie IFC. Jest domyślnie włączona. Przyciskiem ją wyłączysz; wtedy pokazuje *Automatyczna kopia zapasowa: wyłączona*. Dzieje się to raz na dokument, za każdym razem, gdy uruchamiasz mostek.
- *Utwórz kopię zapasową teraz*: tworzy od razu kopię zapasową aktywnego dokumentu. Potem pokazuje *Utworzono kopię zapasową:* i nazwę pliku.
- *Otwórz folder kopii zapasowych*: otwiera folder z kopiami zapasowymi.

Kopie zapasowe są w folderze `ai-backups` w folderze danych aplikacji. Aplikacja zachowuje najnowsze kopie zapasowe, a starsze przerzedza; dokładnie, jak to działa, jest opisane w [Narzędzia MCP](docs://ref-ai-tools).

### 6. Zadbaj, aby klient MCP dobrze planował

Klient MCP dobrze planuje tylko wtedy, gdy zna reguły planowania. To zrobisz sam:

1. **Nie musisz nic robić przy podstawowych regułach.** Przychodzą same przy połączeniu: mostek wysyła je w polu `instructions` podczas uzgadniania MCP. Czy klient wstawi je do swojego promptu systemowego, zależy od klienta.
2. **Poproś o przeczytanie przewodnika.** Polecenie połączenia w oknie *Szczegóły połączenia* prosi klienta MCP, aby przeczytał przewodnik narzędziem `planner_get_planning_guide`. Jeśli nie używasz polecenia, napisz klientowi: *Przeczytaj najpierw przewodnik planowania narzędziem planner_get_planning_guide, zanim cokolwiek zmienisz.* Przewodnik możesz przeczytać sam pod adresem `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcjonalnie: zainstaluj umiejętności.** Działa to tylko z klientem MCP, który obsługuje umiejętności. Umieść `SKILL.md` z *goed-plannen* i *progress-update* w `.claude/skills/goed-plannen/SKILL.md` i `.claude/skills/progress-update/SKILL.md` w folderze projektu, w którym pracuje klient MCP, albo pod `~/.claude/skills/` dla wszystkich projektów.

Pliki dostaniesz na dwa sposoby. Poproś klienta MCP, aby wywołał narzędzie `planner_get_planning_guide` z `part` ustawionym na `skill`: odpowiedź zawiera oba teksty oraz, przy każdej umiejętności, miejsca, w których ma się znaleźć. Albo pobierz je z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` i `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Jeśli *goed-plannen* z jeszcze starszej wersji aplikacji nadal tam jest, zastąp go: ten stary tekst jest po holendersku i wskazuje artykuł Pomocy zamiast przewodnika dla klientów MCP.

Czy klient MCP naprawdę przeczytał przewodnik, zobaczysz w panelu *Panel aktywności*: pojawia się tam wywołanie `planner_get_planning_guide`. Ostateczna odpowiedź powinna zawierać listę założeń: szacowane czasy trwania, wybrany podział na zadania, relacje, które klient sam utworzył, i każde ustawione ograniczenie. Jeśli tej listy brakuje, poproś o nią. Po aktualizacji postępu według *progress-update* odpowiedź powinna podać datę statusu, nową datę zakończenia i odchylenie od planu bazowego.

## Pułapki i co robi wtedy aplikacja

**Klient MCP zmienia coś, co chcesz cofnąć.** Każda zmiana klienta MCP to jeden krok, który cofasz przyciskiem *Cofnij* (Ctrl+Z). Seria zmian, które klient MCP przekazuje razem, to jeden krok. Potem projekt jest oznaczony jako niezapisany. Po zmianie harmonogram jest przeliczany, więc nie musisz sam naciskać F5.

**Aplikacja odrzuca wywołanie klienta MCP.** Gdy włączone jest *Wstrzymaj* albo *Tylko do odczytu*, aplikacja odrzuca wszystkie zmiany, a czytanie pozostaje możliwe, także przeliczenie nieaktualnego harmonogramu. Jeśli sam coś edytujesz, na przykład przeciągasz pasek albo wpisujesz tekst w polu, klient MCP dostaje daty sprzed Twojej edycji z informacją, że są nieaktualne. Jeśli masz otwarte okno dialogowe, na przykład ustawienia, okno zadania albo okno powitalne, albo włączony jest tryb prezentacji, aplikacja odrzuca wszystkie wywołania, także czytanie, aż zamkniesz to okno. Klient MCP dostaje wtedy komunikat o błędzie z wewnętrzną nazwą tego, co jest otwarte, na przykład `showTaskDialog`. Działa dalej tylko `planner_get_planning_guide`, bo nie czyta Twojego harmonogramu.

**Przełączasz karty, gdy klient MCP pracuje.** Klient MCP pracuje na dokumencie, w którym trafiła jego pierwsza zmiana. Jeśli w międzyczasie przełączysz kartę, aplikacja odrzuca jego następną zmianę, dopóki klient MCP nie potwierdzi, że chce pracować na innej karcie. Dzięki temu nic nie trafia do złego projektu. Jeśli klient MCP sam otworzy albo zduplikuje dokument, pracuje potem w tym nowym dokumencie.

**Klient MCP zapisuje albo otwiera plik.** Klient MCP może zapisać harmonogram jako plik IFC i otworzyć plik harmonogramu jako nową kartę. Może to robić tylko w Twoim folderze użytkownika. Klient MCP nadpisuje istniejący plik tylko wtedy, gdy o to wprost poprosi.

**Stan to *Port 3877 zajęty*.** Inny program używa portu. Komunikat aplikacji jest pokazany pod nim. Pole portu wtedy pozostaje zablokowane (*Edytowalne tylko wtedy, gdy serwer jest zatrzymany.*), mimo że mostek nie działa, i nie ma przycisku zatrzymania. To znany brak. Dopóki to nie jest naprawione: wyłącz *Zezwalaj na połączenie MCP* i włącz ponownie. Stan wraca wtedy do *Wyłączony* i możesz wybrać inny port. Potem skopiuj ponownie szczegóły połączenia, bo punkt końcowy zawiera port.

**Klient nie może się połączyć po nowym tokenie.** Nowy token przerywa wszystkie istniejące połączenia. Podaj klientowi nowy token albo wklej fragment konfiguracji jeszcze raz. Rozszerzenie w Claude Desktop odczytuje nowy token samo; nic tam nie musisz robić.

**Sam zatrzymałeś mostek i nie uruchamia się on sam.** *Automatycznie uruchamiaj most* działa raz przy każdym uruchomieniu aplikacji. Jeśli zatrzymasz mostek sam, aplikacja nie włączy go po cichu ponownie.

**Zakładka *MCP* zniknęła.** Połączenie MCP jest wyłączone. Włącz je w kroku 1.

**Strona internetowa w przeglądarce nie może rozmawiać z mostkiem.** Mostek odrzuca każde żądanie pochodzące z przeglądarki i każde żądanie bez właściwego tokenu.

## Bez aplikacji

Jest też serwer MCP, który działa bez aplikacji komputerowej: **bezgłowy serwer MCP**. Oferuje te same narzędzia `planner_*`, ale działa na pliku harmonogramu na dysku, a nie na otwartym projekcie. Dlatego nie widzisz zmian na wykresie Gantt, a *Cofnij* w aplikacji nie dotyczy ich. Użyj go, gdy nie chcesz mieć otwartej aplikacji albo gdy masz komputer bez ekranu.

Rozszerzenie dla Claude Desktop uruchamia ten serwer samodzielnie, gdy aplikacja jest zamknięta (zob. krok 3). Poniższe kroki dotyczą innego klienta MCP, na przykład Claude Code.

Wydanie nie zawiera gotowego pliku serwera do pobrania. Zbudujesz go z kodu źródłowego poleceniem `npm run build:mcp-server`; do tego potrzebny jest Node.js 22 lub nowszy. Wynikiem jest jeden plik, `server.mjs`.

1. Wybierz folder roboczy z plikami harmonogramu. Serwer czyta i zapisuje pliki tylko w tym folderze.
2. Podłącz swojego klienta MCP. Dla Claude Code polecenie znajdziesz pod tymi krokami.
3. Poproś klienta MCP o otwarcie harmonogramu, na przykład `~/plan.ifc`. W tym serwerze `~` oznacza folder roboczy.
4. Poproś klienta MCP o zapisanie wyniku. Nie ma automatycznego zapisu: klient MCP zapisuje plik za pomocą `planner_export_ifc`. Wszystko, czego nie zapisze, przepadnie, gdy serwer się zatrzyma.

Dla kroku 2 w Claude Code wpisz w terminalu to polecenie, z własnymi ścieżkami:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Przed pierwszą zmianą w każdym dokumencie serwer tworzy kopię zapasową MCP, tak samo jak aplikacja. Klient MCP, który wybierze ścieżkę poza folderem roboczym, także przez skrót (dowiązanie symboliczne), dostaje odmowę. Gdy aplikacja jest otwarta, serwer nie nadpisuje istniejącego pliku.

## Zobacz też

- [Przekazywanie opinii](docs://howto-feedback-geven): jeśli połączenie działa inaczej, niż tu opisano, zgłoś to.
- [Narzędzia MCP](docs://ref-ai-tools): wszystkie narzędzia `planner_*` według grup, kody błędów i to, jak długo przechowywane są kopie zapasowe.
- [Ustawienia aplikacji](docs://ref-instellingen): ustawienia MCP.
