# Připojení AI asistenta (MCP)

Cíl: nechat AI asistenta číst spolu s vámi a pracovat na vašem plánu. Vidíte, co dělá, a omezení nastavujete sami.

## Kdy to potřebujete

Chcete, aby AI asistent četl, analyzoval nebo měnil váš plán. Například aby navrhl první WBS, opravil úkoly nebo vysvětlil kritickou cestu. To funguje přes **Model Context Protocol** (MCP): standard, který umožní AI asistentovi používat nástroje programu. Open Planner Studio k tomu spustí na vašem počítači malý server, **most**. Most nabízí sadu nástrojů. Všechny mají název, který začíná na `planner_`: čtení a změny úkolů, závislostí, zdrojů, kalendářů, směrných plánů, dokumentů a souborů. Jaké nástroje existují a co odmítají, je v [Nástroje AI](docs://ref-ai-tools). Proč propojení funguje tak, jak funguje, je v [Jak funguje propojení s AI](docs://uitleg-ai-koppeling).

Most funguje pouze v desktopové aplikaci. Když v prohlížeči zapnete režim AI, uvidíte kartu *AI*, ale tlačítko *Spustit most* je šedé a s textem *Most funguje pouze v desktopové aplikaci*. Zbytek tohoto článku se týká desktopové aplikace. V prohlížeči jsou šedé i *Zálohovat nyní* a *Otevřít složku záloh*.

## Postup

### 1. Zapněte režim AI

1. Na kartě *Nastavení* zvolte *Projekt › Nastavení aplikace*. Můžete také zvolit *Soubor › Nastavení aplikace*, nebo ikonu ozubeného kola nahoře.
2. Zvolte kartu *Pokročilé* a zapněte volbu *Zapnout režim AI*. Karta *AI* se objeví na pásu karet.
3. Chcete-li, aby most běžel hned po spuštění aplikace, zapněte také *Spustit most automaticky*. Volba funguje jen při zapnutém režimu AI a jen v desktopové aplikaci. Ve výchozím stavu je vypnutá, protože otevření portu je vědomé rozhodnutí.

Když vypnete režim AI, most se zastaví a karta *AI* zmizí.

### 2. Spusťte most

1. Přejděte na kartu *AI* a ve skupině *Server* klikněte na *Spustit most*.
2. Podívejte se na stav vedle tlačítka. Zobrazí *Vypnuto*, *Aktivní na portu 3877*, *Port 3877 je obsazen* nebo *Chyba*. Když se spuštění podaří, zobrazí *Aktivní na portu 3877* a tlačítko se jmenuje *Zastavit most*. Při stavu *Port 3877 je obsazen* nebo *Chyba* zůstane tlačítko *Spustit most*. Viz níže v části o častých problémech.

Most naslouchá jen na vašem počítači, na jednom portu. Výchozí port je 3877. Ve skupině *Připojení* můžete v poli *Port* zvolit jiný, ale jen při zastaveném mostu.

### 3. Připojte asistenta

1. Ve skupině *Připojení* klikněte na *Připojit*. Otevře se okno *Údaje o připojení*.
2. Zvolte, co váš klient potřebuje. Viz níže.
3. Token je skrytý. Ikonou oka jej zobrazíte. Tlačítka pro kopírování vždy zkopírují skutečnou hodnotu, i když obrazovka token skrývá.
4. Nechte asistenta vyžádat seznam nástrojů. Tuto kontrolu obsahuje i prompt pro propojení: asistent by měl vidět nástroje s předponou `planner_`. Očekávaný počet je uveden v promptu pro propojení.

Okno nabízí tři způsoby propojení:

- *Konfigurační úryvek*: kus konfigurace, který vložíte do nastavení MCP ve svém klientovi.
- *Prompt pro propojení*: text, který vložíte do AI asistenta. Potom se asistent propojí sám.
- *Endpoint* a *Ověření*: jednotlivé údaje. Endpoint je `http://localhost:3877/mcp` s přenosem *streamable HTTP*. Každý požadavek potřebuje hlavičku `Authorization: Bearer` a za ní váš token. Váš klient také musí podporovat spojení MCP: při připojení most předá kód spojení v hlavičce `Mcp-Session-Id` a každý další požadavek bez tohoto kódu odmítne. Claude Code a `mcp-remote` to dělají samy.

**Po aktualizaci aplikace se připojte znovu.** Pokud byl váš AI klient připojen ke starší verzi aplikace, zatím neposílá kód spojení a most každý požadavek odmítne. Připojte se proto po aktualizaci znovu: v Claude Code začněte nové spojení a Claude Desktop úplně ukončete a spusťte znovu.

**Claude Code.** Konfigurační úryvek se do Claude Code hodí přímo. Zadejte tento příkaz v terminálu a místo `<token>` použijte svůj vlastní token:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Úryvek můžete také uložit do souboru `.mcp.json` ve složce projektu. Tento soubor do gitu nevkládejte, protože token dává přístup k vašemu plánu. Server z `.mcp.json` musíte v Claude Code poprvé schválit.

**Claude Desktop.** Konfigurační úryvek se do Claude Desktop přímo nehodí. V souboru `claude_desktop_config.json` uvedete program, který Claude Desktop spustí sám, a ne adresu. Použijte proto externí nástroj `mcp-remote` jako prostředek mezi Claude Desktop a mostem; potřebuje Node.js. V Claude Desktop zvolte v nabídce *Nastavení › Vývojář › Upravit konfiguraci*, vložte do souboru tento text (se svým tokenem) a Claude Desktop znovu spusťte:

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

Token je záměrně v `env` a ne v `args`: na Windows Claude Desktop rozbije argument, který obsahuje mezeru. *Vlastní konektor* v Claude (*Přizpůsobit › Konektory*) s mostem nefunguje. Claude se pak připojuje z cloudu Anthropic a ten se k mostu na vašem počítači nedostane.

Ve skupině *Připojení* je také pole *Token*. Je to dlouhý, náhodný kód. Aplikace jej vytvoří za vás a uloží na tomto počítači. V okně se zobrazí: *Tento token poskytuje přístup k otevřenému plánu. Nesdílejte ho s jinými.* Ikonou *Nový token* vytvoříte nový token. Aplikace se nejdřív zeptá: *Vytvořením nového tokenu přerušíte všechna stávající propojení. Pokračovat?* Pokud most běží, restartuje se s novým tokenem a starý token přestane fungovat.

### 4. Zjistěte, co AI dělá

1. Ve skupině *Činnost* klikněte na *Panel činnosti*. V postranním sloupci se otevře panel *Činnost AI*.
2. Každé volání mostu je na jednom řádku, nejnovější nahoře: čas, co se stalo, jak dlouho to trvalo a zda to bylo úspěšné. Klikněte na řádek a rozbalte *Argumenty* a *Odpověď*.
3. Tlačítkem *Vymazat* seznam vyprázdníte. Panel si drží posledních 500 volání. Dokud se nic nestalo, zobrazí se *Zatím žádná činnost AI. Volání mostu se zobrazí zde.*

Když je režim AI zapnutý, vpravo dole ve stavovém řádku je tečka s *AI*. Její barva ukazuje stav mostu. Kliknutím na ni se přesunete na kartu *AI*.

### 5. Nastavte omezení

Ve skupině *Bezpečnost* jsou tlačítka, kterými omezíte AI:

- *Pozastavit*: AI nesmí dočasně nic měnit, čtení zůstává povolené. Most zůstává aktivní. Tlačítko se změní na *Pokračovat*.
- *Jen pro čtení*: všechny nástroje, které něco mění, se odmítnou, dokud je tato volba zapnutá.
- *Auto-záloha: zapnuto*: před první změnou od AI v dokumentu zapíše aplikace zálohu IFC. Ve výchozím stavu je to zapnuto. Tlačítkem ji vypnete a potom se zobrazí *Auto-záloha: vypnuto*. Toto se stane jednou pro každý dokument při každém spuštění mostu.
- *Zálohovat nyní*: vytvoří zálohu aktivního dokumentu hned. Potom se zobrazí *Záloha vytvořena:* a název souboru.
- *Otevřít složku záloh*: otevře složku se zálohami.

Zálohy jsou ve složce `ai-backups` v datové složce aplikace. Aplikace si nechává nedávné zálohy a starší průběžně promazává. Přesně, jak to funguje, je popsáno v [Nástroje AI](docs://ref-ai-tools).

### 6. Nechte asistenta plánovat dobře

Asistent plánuje dobře jen tehdy, když zná pravidla plánování. Proč na tom záleží a co pravidla obsahují, si přečtete v [Jak funguje propojení s AI](docs://uitleg-ai-koppeling). Tady je to, co uděláte sami:

1. **Pro základní pravidla nic nedělejte.** Přijdou při propojení. Zda je váš klient vloží do systémového promptu, závisí na klientovi.
2. **Nechte asistenta přečíst průvodce.** Prompt pro propojení z okna *Údaje o připojení* žádá asistenta, aby nejdřív přečetl průvodce plánováním nástrojem `planner_get_planning_guide`. Pokud prompt nepoužijete, požádejte asistenta sami: *Nejdřív si přečtěte průvodce plánováním pomocí `planner_get_planning_guide`, než cokoli změníte.* Průvodce si můžete přečíst sami na adrese `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Volitelně: nainstalujte dovednosti.** To funguje jen s asistentem, který dovednosti podporuje. Uložte `SKILL.md` dovedností *goed-plannen* a *progress-update* do `.claude/skills/goed-plannen/SKILL.md` a `.claude/skills/progress-update/SKILL.md` ve složce projektu, ve které asistent pracuje, nebo pod `~/.claude/skills/`, pokud je chcete mít v každém projektu.

Soubory získáte dvěma způsoby. Požádejte asistenta, aby zavolal nástroj `planner_get_planning_guide` s hodnotou `skill` v parametru `part`. Odpověď obsahuje oba texty a u každé dovednosti místo, kam patří. Nebo je stáhněte z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` a `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Pokud je *goed-plannen* ještě z dřívější verze aplikace, nahraďte ji. Ten starý text je v holandštině a odkazuje na článek nápovědy místo průvodce pro asistenty.

Zda asistent průvodce opravdu přečetl, poznáte na panelu *Panel činnosti*: je tam volání `planner_get_planning_guide`. Závěrečná odpověď asistenta má obsahovat seznam předpokladů: odhadované doby trvání, zvolené členění, závislosti, které asistent vytvořil sám, a každé omezení, které nastavil. Když ten seznam chybí, požádejte o něj. Po aktualizaci průběhu podle *progress-update* má odpověď uvést datum stavu, nové datum dokončení a odchylku od směrného plánu.

## Časté problémy a co aplikace potom dělá

**AI změní něco, co chcete vzít zpět.** Každá změna od AI je krok, který vrátíte tlačítkem *Vrátit zpět* (Ctrl+Z). Řada změn, kterou AI předá jako celek, je jeden krok. Potom se projekt zobrazí jako neuložený. Po změně se plán přepočítá znovu, takže F5 nemusíte stisknout sami.

**Aplikace odmítne volání od AI.** Když je zapnuté tlačítko *Pozastavit* nebo *Jen pro čtení*, aplikace odmítne všechny změny. Čtení zůstane možné, včetně přepočtu zastaralého plánu. Pokud sami zrovna upravujete, například přetahujete pruh nebo píšete do pole, dostane AI data z doby před vaší úpravou, s upozorněním, že jsou zastaralá. Pokud máte otevřený dialog, například nastavení, dialog úkolu nebo uvítací okno, nebo je zapnutý režim prezentace, aplikace odmítne všechna volání, včetně čtení. Platí to, dokud dialog nezavřete. AI pak dostane chybovou zprávu s interním názvem toho, co je otevřené, například `showTaskDialog`. Jen `planner_get_planning_guide` dál funguje, protože nečte váš plán.

**Přepnete kartu, zatímco AI pracuje.** AI pracuje na dokumentu, kam dopadla její první změna. Když mezitím přepnete kartu, aplikace odmítne její další změnu. Dokud AI nepotvrdí, že chce pracovat na jiné kartě, změnu neprovede. Tak se nic nedostane do špatného projektu.

**AI zapisuje nebo otevírá soubor.** AI umí zapsat plán jako soubor IFC a otevřít soubor s plánem jako novou kartu. Smí to jen ve vaší uživatelské složce. Existující soubor přepíše jen tehdy, když o to výslovně požádá.

**Stav je *Port 3877 je obsazen*.** Port používá jiný program. Zpráva aplikace se zobrazí pod stavem. Pole *Port* pak zůstane zamčené (*Lze upravit jen při zastaveném serveru.*), i když most neběží, a chybí tlačítko pro zastavení. Je to známý nedostatek. Dokud není opraven, vypněte a znovu zapněte *Zapnout režim AI*. Stav se pak vrátí na *Vypnuto* a můžete zvolit jiný port. Potom údaje o připojení zkopírujte znovu, protože endpoint obsahuje port.

**Klient se po novém tokenu nemůže připojit.** Nový token přeruší všechna stávající propojení. Dejte klientovi nový token, nebo znovu vložte konfigurační úryvek.

**Most jste zastavili sami a nespustí se sám.** *Spustit most automaticky* funguje jednou při každém spuštění aplikace. Když most zastavíte sami, aplikace jej tiše znovu nezapne.

**Karta *AI* zmizela.** Režim AI je vypnutý. Zapněte jej v kroku 1.

**Webová stránka v prohlížeči nemůže s mostem mluvit.** Most odmítne každý požadavek, který přijde z prohlížeče, a každý požadavek bez správného tokenu.

## Viz také

- [Zpětná vazba](docs://howto-feedback-geven): pokud se propojení chová jinak, než je popsáno zde, nahlaste to.
- [Jak funguje propojení s AI](docs://uitleg-ai-koppeling): co propojení je, proč asistent pracuje ve vašem otevřeném projektu a co nesmí dělat.
- [Nástroje AI](docs://ref-ai-tools): všechny nástroje `planner_*` podle skupin, chybové kódy a jak dlouho se uchovávají zálohy.
- [Dobře plánovat](docs://gids-goed-plannen): zásady plánování. Asistent je dostane v anglické verzi s doplněnými nástroji.
- [Nastavení aplikace](docs://ref-instellingen): nastavení AI.
