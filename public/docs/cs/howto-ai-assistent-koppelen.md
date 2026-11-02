# Připojení klienta MCP

Cíl: nechat klienta MCP číst váš plán a pracovat s ním. Máte přehled o tom, co dělá, a omezení si nastavíte sami.

## Rychle: nechte to udělat Claude

Pracujete s Claude Desktop nebo Claude Code? Pak může Claude připojení nainstalovat sám:

1. Klikněte na *Zkopírovat prompt* níže.
2. Vložte prompt do nového chatu s Claude a odešlete ho.

Claude potom nainstaluje rozšíření pro Open Planner Studio a průběžně vysvětlí, co dělá. Pokud musíte něco udělat sami, například kliknout na *Instalovat* v Claude Desktop, Claude vám přesně řekne, který klik provést. Token k tomu nepotřebujete.

```prompt
Nainstalujte mi rozšíření Open Planner Studio, abyste mohl číst a měnit mé stavební plány v Open Planner Studio. Udělejte co nejvíc sami. Před každým krokem jednou jednoduchou větou řekněte, co budete dělat a proč. Potřebujete-li ode mě něco, ptejte se vždy jen na jednu věc a počkejte na mou odpověď. Pokud musím něco udělat sám, řekněte mi přesně, který jeden klik nebo jakou jednu akci mám provést a kde.

Co musíte vědět:
- Rozšíření je jeden soubor, open-planner-studio-<version>.mcpb, v nejnovějším vydání: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Přímý odkaz je v https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (soubor, jehož název končí na .mcpb). Soubor je archiv ZIP.
- Rozšíření funguje s desktopovou aplikací Open Planner Studio i bez ní. Když je aplikace otevřená a běží její most MCP, pracujete v plánu, který je v aplikaci otevřený. Když je aplikace zavřená, pracujete se soubory plánů v pracovní složce, kterou vyberu já.
- Instalace nepotřebuje token ani heslo. Nežádejte mě o něj a nečtěte ho ani nezobrazujte.

Pokud běžíte v Claude Desktop:
1. Pokud můžete stáhnout soubor a otevřít ho na mém počítači, udělejte to se souborem .mcpb. Pokud ne, dejte mi přímý odkaz ke stažení a řekněte mi, abych po dokončení stahování dvakrát klikl na soubor.
2. Claude Desktop potom zobrazí rozšíření Open Planner Studio. Řekněte mi, abych klikl na Instalovat. Potom mi řekněte, abych u položky Pracovní složka zvolil složku se svými soubory plánů.
3. Řekněte mi, ať začnu nový chat, a tam se vás zeptám, které nástroje Open Planner Studio vidíte.

Pokud běžíte v Claude Code:
1. Zkontrolujte, že je nainstalován Node.js 22 nebo novější. Pokud není, řekněte mi, jak ho nainstalovat, a zastavte se.
2. Zeptejte se mě, ve které složce jsou mé soubory plánů. Je to pracovní složka.
3. Stáhněte soubor .mcpb a rozbalte ho do nové vlastní složky v mé uživatelské složce. Přečtěte tam soubor manifest.json: server.mcp_config říká, jak se server spustí. Nahraďte ${__dirname} rozbalenou složkou a ${user_config.workdir} pracovní složkou.
4. Spusťte claude mcp list. Pokud tam už je server se jménem open-planner-studio, zeptejte se mě, jestli ho smíte nahradit. Jeho nastavení nezobrazujte, protože může obsahovat token.
5. Přidejte server pro můj uživatelský účet, například: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<pracovní složka> -- node <rozbalená složka>/server/index.mjs
6. Řekněte mi, ať spustím novou relaci Claude Code, a že /mcp tam ukáže, jestli je open-planner-studio připojený.

Pokud běžíte jinde, například v prohlížeči na claude.ai, řekněte mi, že to vyžaduje Claude Desktop nebo Claude Code. Pokud nevíte, kde běžíte, zeptejte se mě.

Až bude instalace hotová, vysvětlete mi v několika větách:
- jak vám umožním pracovat v otevřené aplikaci: v Open Planner Studio zvolte Nastavení › Projekt › Nastavení aplikace, na kartě Upřesnit zapněte Povolit připojení MCP. Potom na kartě MCP klikněte na Spustit most.
- že bez aplikace je změna v souboru až poté, co ji uložíte, a že existující soubor nepřepisujete, dokud je aplikace otevřená.
Pokud některý krok selže, řekněte mi jednou větou, co se pokazilo a co mohu udělat. Nehádejte.
```

Chcete to udělat sami, nebo používáte jiného klienta MCP? Potom postupujte podle kroků níže.

## Kdy to potřebujete

Chcete, aby klient MCP četl, analyzoval nebo měnil váš plán. Chcete například, aby navrhl první WBS, opravil úkoly nebo vysvětlil kritickou cestu. To funguje přes **Model Context Protocol** (MCP): standard, který umožňuje programu s umělou inteligencí, **klientovi MCP**, používat nástroje jiného programu. K tomu Open Planner Studio na vašem počítači spouští malý server, **most**. Nabízí sadu nástrojů, jejichž název začíná na `planner_`: čtení a změny úkolů, závislostí, zdrojů, kalendářů, směrných plánů, dokumentů a souborů. Které nástroje existují a co odmítají, najdete v [Nástroje MCP](docs://ref-ai-tools). Klient MCP pracuje v projektu, který máte otevřený, ne v kopii: úkol, který přidá, se hned zobrazí v diagramu Gantt. Používá stejný výpočet a stejnou historii *Vrátit zpět* jako vy.

Most funguje pouze v desktopové aplikaci. Pokud v prohlížeči povolíte připojení MCP, uvidíte kartu *MCP*, ale tlačítko *Spustit most* je šedé s textem *Most funguje pouze v desktopové aplikaci.* Zbytek tohoto článku se týká desktopové aplikace. V prohlížeči jsou šedé také *Zálohovat nyní* a *Otevřít složku záloh*.

## Kroky

### 1. Povolte připojení MCP

1. Zvolte *Nastavení › Projekt › Nastavení aplikace*. Můžete také zvolit *Soubor › Nastavení aplikace*, nebo ozubené kolečko nahoře.
2. Zvolte kartu *Pokročilé* a zapněte *Povolit připojení MCP*. Karta *MCP* se objeví v pásu karet.
3. Chcete-li, aby most byl aktivní hned po spuštění aplikace, zapněte také *Spustit most automaticky*. Přepne se to jen tehdy, když je připojení MCP zapnuté, a funguje to jen v desktopové aplikaci. Ve výchozím nastavení je vypnuto, protože otevření portu je záměrná volba.

Když připojení MCP vypnete, most se zastaví a karta *MCP* zmizí.

### 2. Spusťte most

1. Přejděte na kartu *MCP* a klikněte na *Spustit most* ve skupině *Server*.
2. Podívejte se na stav vedle tlačítka. Zobrazí se *Vypnuto*, *Aktivní na portu 3877*, *Port 3877 je obsazen* nebo *Chyba*. Když se spuštění podaří, zobrazí se *Aktivní na portu 3877* a tlačítko se jmenuje *Zastavit most*. Při stavu *Port 3877 je obsazen* nebo *Chyba* tlačítko zůstane *Spustit most*; viz úskalí níže.

Most naslouchá jen na vašem počítači, na jednom portu. Ve výchozím nastavení je to 3877. Ve skupině *Připojení* můžete v poli *Port* zvolit jiný port, ale jen když je most zastavený. Připojení je prosté HTTP na vašem počítači. Aplikace sama nic neodesílá ven. Co MCP klient udělá s vaším plánem, například co s ním udělá jeho poskytovatel, leží mimo aplikaci.

### 3. Připojte MCP klienta

1. Ve skupině *Připojení* klikněte na *Připojit*. Otevře se okno *Údaje o připojení*.
2. Zvolte, co váš klient potřebuje, viz níže.
3. Token je skrytý. Ikonou oka ho zobrazíte. Tlačítka pro kopírování vždy zkopírují skutečnou hodnotu, i když obrazovka token skrývá.
4. Požádejte MCP klienta o seznam nástrojů. Tato kontrola je také v promptu pro propojení: klient by měl vidět nástroje s předponou `planner_`. Očekávaný počet je uveden v promptu pro propojení.

Okno nabízí čtyři způsoby připojení:

- *Nechat to na Claudovi*: stejný prompt jako nahoře v tomto článku, s tlačítkem *Zkopírovat prompt*. Je určen pro Claude Desktop a Claude Code. Token k tomu nepotřebujete.
- *Konfigurační úryvek*: kus konfigurace, který vložíte do nastavení MCP vašeho klienta.
- *Prompt pro propojení*: text, který vložíte do MCP klienta, a ten se pak připojí sám.
- *Endpoint* a *Ověření*: samostatné údaje. Endpoint je `http://localhost:3877/mcp` s přenosem *streamable HTTP*. Každý požadavek potřebuje hlavičku `Authorization: Bearer` a za ní váš token. Váš klient musí také podporovat sezení MCP: když se připojí, most mu v hlavičce `Mcp-Session-Id` předá kód sezení a každý další požadavek bez tohoto kódu odmítne. Claude Code a `mcp-remote` to dělají samy.

**Po aktualizaci aplikace se připojte znovu.** Pokud byl váš klient MCP už připojen ke starší verzi aplikace, zatím neposílá kód sezení a most každý požadavek odmítne. Připojte se proto po aktualizaci znovu: v Claude Code spusťte nové sezení a Claude Desktop zcela ukončete a znovu spusťte.

**Claude Code.** Konfigurační úryvek se hodí přímo pro Claude Code. V terminálu zadejte tento příkaz a místo `<token>` vložte svůj token:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Úryvek můžete také vložit do souboru `.mcp.json` ve složce projektu. Pak tento soubor nedávejte do gitu, protože token dává přístup k vašemu plánu. Server z `.mcp.json` musíte v Claude Code poprvé schválit.

**Claude Desktop.** Pro Claude Desktop existuje rozšíření: soubor `open-planner-studio-<version>.mcpb`. Claude Desktop ho nainstaluje dvojklikem. Node.js k tomu nepotřebujete. Rozšíření funguje s aplikací i bez ní. Rychlejší je prompt nahoře v tomto článku; níže jsou kroky ručně.

1. Stáhněte soubor `.mcpb` z nejnovějšího vydání: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dvakrát klikněte na soubor. Claude Desktop se otevře a zobrazí rozšíření *Open Planner Studio*. Potvrďte instalaci. Pokud dvojklik nefunguje, otevřete v Claude Desktop *Nastavení › Extensions* a soubor tam nainstalujte.
3. U pole *Working folder* zvolte složku se soubory plánu. Claude použije tuto složku jen tehdy, když je aplikace zavřená. Claude pak čte a zapisuje jen v této složce.
4. Zapněte rozšíření a začněte novou konverzaci. Zeptejte se Clauda, které nástroje Open Planner Studio vidí.

Token ani port nezadáváte: když most běží, rozšíření najde aplikaci samo. Při každém dotazu od Clauda rozšíření vybere znovu:

- *Aplikace je otevřená a most běží*: Claude pracuje v plánu, který je v aplikaci otevřený. Každou změnu vidíte v aplikaci hned.
- *Aplikace je zavřená, nebo most je vypnutý*: Claude pracuje se souborem plánu v pracovní složce. Změna je v souboru jen tehdy, když ji Claude uloží. Automatické ukládání není. Dokud je aplikace otevřená, Claude existující soubor nepřepíše, ale uloží ho pod novým názvem.

Když se aplikace otevře nebo zavře, zatímco Claude pracuje, rozšíření přepne a Claudovi to oznámí. Claude pak nejdřív plán znovu vybere nebo otevře a teprve potom něco změní. Pokud má Claude ještě změny bez aplikace, které nejsou uložené, rozšíření bez aplikace pracuje dál, dokud je Claude neuloží. Žádná práce se tak neztratí. Pokud rozšíření nedosáhne na aplikaci a není použitelná pracovní složka, Claude vidí jen nástroj `open_planner_studio_status` se zprávou, která vám řekne, co máte dělat.

**Claude Desktop bez rozšíření.** Pokud rozšíření nemůžete použít, připojte Claude Desktop pomocí externího nástroje `mcp-remote`. Konfigurační úryvek se pro Claude Desktop přímo nehodí: v souboru `claude_desktop_config.json` pojmenujete program, který Claude Desktop spustí sám, a ne adresu. `mcp-remote` potřebuje Node.js. V Claude Desktop zvolte *Nastavení › Developer › Edit Config*, vložte do souboru tento text (s vaším tokenem) a Claude Desktop znovu spusťte:

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

Token je v `env`, a ne v `args`, záměrně: ve Windows Claude Desktop rozbije argument, který obsahuje mezeru. *Custom connector* v Claude (*Customize › Connectors*) s mostem nefunguje. Claude se pak připojuje z cloudu Anthropic a ten se k mostu na vašem počítači nedostane.

Ve skupině *Připojení* je také pole *Token*. Je to dlouhý, náhodný kód, který aplikace pro vás vytvoří a uloží na tomto počítači. V okně je napsáno *Tento token poskytuje přístup k otevřenému plánu. Nesdílejte ho s jinými.* Ikonou *Nový token* vytvoříte nový token. Aplikace se nejdřív zeptá *Vytvořením nového tokenu přerušíte všechna stávající propojení. Pokračovat?* Když most běží, restartuje se s novým tokenem a starý token přestane fungovat.

**Jak rozšíření najde aplikaci.** Když most běží, desktopová aplikace zapíše port a token do souboru `mcp/runtime.json` v datové složce aplikace. Rozšíření pro Claude Desktop tento soubor čte pro každý dotaz. Na Linuxu a macOS ho může číst jen váš uživatelský účet. Ve Windows chrání soubor výchozí ACL vaší profilové složky; aplikace to zvlášť nekontroluje. Když most zastavíte nebo vypnete připojení MCP, aplikace soubor odstraní. Aplikace také vede seznam otevřených souborů v `mcp/open-files.json`, a to i tehdy, když je připojení MCP vypnuté. Dokud tento soubor existuje, rozšíření a server MCP bez grafického rozhraní nepřepisují žádný existující soubor, ani soubor, který jste právě otevřeli a který v seznamu ještě není. Nový soubor je povolen. Čtení je také povoleno: Claude pak vidí verzi na disku bez vašich změn, které ještě nejsou uložené.

### 4. Zjistěte, co MCP klient dělá

1. Ve skupině *Činnost* klikněte na *Panel činnosti*. V bočním sloupci se otevře panel *MCP činnost*.
2. Každé volání mostu je na jednom řádku, nejnovější nahoře: čas, co se stalo, jak dlouho to trvalo a jestli to uspělo, nebo ne. Kliknutím na řádek rozbalíte *Argumenty* a *Odpověď*.
3. Tlačítkem *Vymazat* seznam vyprázdníte. Panel uchovává posledních 500 volání. Dokud se nic nestalo, zobrazuje se *Zatím žádná MCP činnost. Volání mostu se zobrazí zde.*

Když je připojení MCP zapnuté, vpravo dole ve stavovém řádku je tečka s *MCP*. Její barva ukazuje stav mostu a kliknutím na ni přejdete na kartu *MCP*.

### 5. Omezte MCP klienta

Ve skupině *Bezpečnost* jsou tlačítka, kterými MCP klienta omezíte:

- *Pozastavit*: MCP klient dočasně nesmí nic měnit, čtení je stále povoleno. Most zůstane aktivní. Tlačítko se změní na *Pokračovat*.
- *Jen pro čtení*: dokud je to zapnuté, aplikace odmítá všechny nástroje, které něco mění.
- *Auto-záloha: zapnuto*: před první změnou, kterou MCP klient v dokumentu provede, aplikace zapíše zálohu IFC. Ve výchozím nastavení je to zapnuto. Tlačítkem to vypnete a pak se zobrazí *Auto-záloha: vypnuto*. Tohle se stane jednou pro každý dokument při každém spuštění mostu.
- *Zálohovat nyní*: vytvoří zálohu aktivního dokumentu hned. Potom se zobrazí *Záloha vytvořena:* a název souboru.
- *Otevřít složku záloh*: otevře složku se zálohami.

Zálohy jsou ve složce `ai-backups` v datové složce aplikace. Aplikace ponechá nedávné zálohy a ze starších některé odstraní; přesný postup je popsán v [nástrojích MCP](docs://ref-ai-tools).

### 6. Nechte MCP klienta dobře tvořit plán

MCP klient plánuje dobře jen tehdy, když zná pravidla pro tvorbu plánu. Tohle uděláte sami:

1. **Pro základní pravidla nic nedělejte.** Při připojení se pošlou sama: most je pošle v poli `instructions` při úvodním navázání MCP. Zda je klient vloží do svého systémového promptu, závisí na klientovi.
2. **Nechte příručku přečíst.** Prompt pro propojení v okně *Údaje o připojení* žádá MCP klienta, aby příručku přečetl nástrojem `planner_get_planning_guide`. Pokud prompt nepoužijete, požádejte klienta větou: *Nejdřív přečtěte příručku k plánování pomocí planner_get_planning_guide, než cokoli změníte.* Příručku si můžete přečíst sami na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Volitelně: nainstalujte dovednosti.** To funguje jen s MCP klientem, který podporuje dovednosti. Uložte `SKILL.md` z *goed-plannen* a *progress-update* do `.claude/skills/goed-plannen/SKILL.md` a `.claude/skills/progress-update/SKILL.md` ve složce projektu, se kterou MCP klient pracuje, nebo do `~/.claude/skills/` pro každý projekt.

Soubory získáte dvěma způsoby. Požádejte MCP klienta, aby zavolal nástroj `planner_get_planning_guide` s `part` nastaveným na `skill`: odpověď obsahuje oba texty a u každé dovednosti místa, kam patří. Nebo je stáhněte z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` a `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Pokud je *goed-plannen* ještě ze starší verze aplikace, nahraďte ho: starý text je v nizozemštině a odkazuje na článek nápovědy místo příručky pro MCP klienty.

Zda MCP klient příručku skutečně přečetl, uvidíte v panelu *Panel činnosti*: je tam volání `planner_get_planning_guide`. Závěrečná odpověď by měla obsahovat seznam předpokladů: odhadované doby trvání, zvolené členění, závislosti, které vytvořil sám, a každé omezení, které nastavil. Když tento seznam chybí, požádejte o něj. Po aktualizaci průběhu podle *progress-update* má odpověď uvést datum stavu, nové datum dokončení a odchylku oproti směrnému plánu.

## Úskalí a co aplikace potom dělá

**MCP klient změní něco, co chcete vzít zpět.** Každá změna od MCP klienta je krok, který vrátíte pomocí *Vrátit zpět* (Ctrl+Z). Řada změn, které MCP klient předá jako celek, je jeden krok. Potom se projekt zobrazí jako neuložený. Po změně se plán znovu přepočítá, takže F5 nemusíte stisknout sami.

**Aplikace odmítne volání od MCP klienta.** Při tlačítkách *Pozastavit* a *Jen pro čtení* aplikace odmítne všechny změny. Čtení zůstane možné, včetně přepočtu neaktuálního plánu. Když právě sami něco upravujete, například přetahujete pruh nebo píšete do pole, dostane MCP klient data z doby před vaší úpravou s upozorněním, že jsou neaktuální. Když máte otevřené dialogové okno, například nastavení, dialogové okno úkolu nebo uvítací okno, nebo je zapnutý režim prezentace, aplikace odmítne všechna volání, včetně čtení, dokud dialogové okno nezavřete. MCP klient pak dostane chybovou zprávu s interním názvem toho, co je otevřené, například `showTaskDialog`. Jen `planner_get_planning_guide` dál funguje, protože nečte váš plán.

**Přepnete kartu, zatímco MCP klient pracuje.** MCP klient pracuje v dokumentu, ve kterém provedl svou první změnu. Když mezitím přepnete kartu, aplikace odmítne jeho další změnu, dokud MCP klient nepotvrdí, že chce pracovat na jiné kartě. Nic tak neskončí v jiném projektu. Pokud MCP klient sám otevře nebo zduplikuje dokument, pak pracuje v tomto novém dokumentu.

**MCP klient zapisuje nebo otevírá soubor.** MCP klient může zapsat plán jako soubor IFC a otevřít soubor plánu jako novou kartu. Smí to jen ve vaší uživatelské složce. Existující soubor přepíše jen tehdy, když to výslovně požádá.

**Stav je *Port 3877 je obsazen*.** Port používá jiný program. Zpráva aplikace se zobrazí pod ním. Pole pro port pak zůstane zamčené (*Upravitelné jen při zastaveném serveru.*), i když most neběží, a tlačítko pro zastavení chybí. Je to známý nedostatek. Dokud se to neopraví, vypněte *Povolit připojení MCP* a znovu ho zapněte. Stav se pak vrátí na *Vypnuto* a můžete zvolit jiný port. Potom údaje o připojení znovu zkopírujte, protože endpoint obsahuje port.

**Klient se po novém tokenu nemůže připojit.** Nový token přeruší všechna stávající připojení. Klientovi dejte nový token, nebo znovu vložte konfigurační úryvek. Rozšíření v Claude Desktop načte nový token samo; tam nemusíte dělat nic.

**Most jste zastavili sami a sám se nespustí.** *Spustit most automaticky* funguje jednou při každém spuštění aplikace. Když most zastavíte sami, aplikace ho tiše znovu nezapne.

**Karta *MCP* zmizela.** Připojení MCP je vypnuté. Zapněte ho v kroku 1.

**Webová stránka ve vašem prohlížeči nemůže s mostem mluvit.** Most odmítá každý požadavek, který přichází z prohlížeče, a každý požadavek bez správného tokenu.

## Bez aplikace

Existuje také server MCP, který funguje bez počítačové aplikace: **server MCP bez grafického rozhraní**. Nabízí stejné nástroje `planner_*`, ale pracuje se souborem plánu na disku, ne s vaším otevřeným projektem. Změny tedy v diagramu Gantt neuvidíte a příkaz *Vrátit zpět* v aplikaci se na ně nevztahuje. Použijte ho, když nechcete mít aplikaci otevřenou, nebo na počítači bez obrazovky.

Rozšíření pro Claude Desktop spustí tento server samo, když je aplikace zavřená (viz krok 3). Kroky níže jsou určené pro jiného klienta MCP, například Claude Code.

Vydání neobsahuje hotovou verzi serveru ke stažení. Sestavíte ji ze zdrojového kódu příkazem `npm run build:mcp-server`; k tomu potřebujete Node.js 22 nebo novější. Výsledkem je jeden soubor `server.mjs`.

1. Zvolte pracovní složku se soubory plánu. Server čte a zapisuje pouze v této složce.
2. Připojte svého klienta MCP. Pro Claude Code je příkaz pod těmito kroky.
3. Požádejte klienta MCP, aby otevřel plán, například `~/plan.ifc`. V tomto serveru znamená `~` pracovní složku.
4. Požádejte klienta MCP, aby výsledek uložil. Automatické ukládání neexistuje: klient MCP zapíše soubor pomocí `planner_export_ifc`. Co se neuloží, se ztratí, když server skončí.

Pro krok 2 v Claude Code zadejte tento příkaz v terminálu se svými cestami:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Před první změnou v každém dokumentu vytvoří server zálohu MCP, stejně jako aplikace. Klient MCP, který zvolí cestu mimo pracovní složku, a to i přes zástupce (symbolický link), dostane odmítnutí. Dokud je aplikace otevřená, server nepřepíše existující soubor.

## Viz také

- [Odeslání zpětné vazby](docs://howto-feedback-geven): pokud se připojení chová jinak, než jak je zde popsáno, nahlaste to.
- [Nástroje MCP](docs://ref-ai-tools): všechny nástroje `planner_*` podle skupiny, kódy chyb a jak dlouho se zálohy uchovávají.
- [Nastavení aplikace](docs://ref-instellingen): nastavení MCP.
