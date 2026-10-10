# Jak funguje propojení s AI

Co se skutečně stane, když AI asistent pracuje ve vašem plánu? V tomto článku se dozvíte, co je propojení, proč se liší od výměny souboru, která omezení aplikace sama hlídá a jak asistent zjistí, jak se má plán sestavit. Příklad na konci ukazuje na číslech, co asistent zvládne najednou a co z toho zůstane vám.

## Pojem

AI asistent, například chatovací program nebo programovací asistent, může ovládat jiný program přes **Model Context Protocol** (MCP). Open Planner Studio v této výměně hraje roli serveru. Desktopová aplikace spouští na vašem počítači malý server, **most**. Asistent se k mostu připojí a dostane seznam **nástrojů**: nástrojů s názvem, který začíná na `planner_`, například čtení úkolů, přidání závislosti nebo uložení směrného plánu. Které nástroje existují, je uvedeno v [Nástroje AI](docs://ref-ai-tools).

Pozoruhodné je, že asistent pracuje v projektu, který máte právě otevřený, a ne v kopii. Nic neexportujete ani neimportujete a nenastane okamžik, kdy se vy i asistent díváte na dvě různé verze. Úkol, který asistent přidá, se hned objeví v diagramu Gantt. Aplikace v tom není naivní: asistent pracuje se stejným výpočtem, stejnou historií vrácení zpět a stejnými pravidly jako vy.

Jak propojení zapnete, je popsáno v [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen). Dále si přečtete, jak funguje.

## Jak to aplikace řeší

### Server, který naslouchá jen vašemu počítači

Most naslouchá jen na vašem počítači (`127.0.0.1`), na jednom portu, ve výchozím nastavení 3877. Přijímá jen požadavky na adresu `/mcp` a jen s vaším **tokenem** v hlavičce `Authorization: Bearer`. Požadavek bez správného tokenu odmítne. Požadavek z prohlížeče, který pozná podle hlavičky `Origin`, odmítne také, aby webová stránka, kterou máte náhodou otevřenou, nemohla mluvit s vaším plánem. Požadavky zpracovává přísně jeden po druhém.

Spojení je prosté HTTP na vašem počítači; aplikace sama nic neodesílá. Co asistent udělá s plánem, který přečte, například co s ním udělá jeho poskytovatel, je věc asistenta a mimo aplikaci.

### Asistent pracuje s jedním dokumentem

Při své první změně most připojí spojení k dokumentu, který je tehdy aktivní. Když potom sami přepnete karty, aplikace odmítne další změnu asistenta (kód `DOC_DRIFT`), dokud asistent pomocí `planner_switch_document` nepotvrdí, se kterým dokumentem chce pracovat. Tak se nic nedostane do špatného projektu. Asistent, který dokument sám otevře nebo duplikuje, potom pracuje v tomto novém dokumentu.

### Každá změna přepočítá plán

V aplikaci plánujete ručně: něco změníte a potom stisknete *Přepočítat* (F5), pokud není zapnuto *Automaticky přepočítat*. U změny od asistenta to neplatí. Každá zápisová akce asistenta projde jednou transakcí. Změní-li se v ní data projektu, aplikace přepočítá sama na závěr, u skriptu jednou. Nástroj pro čtení vždy vrací aktuální data. Je-li plán neaktuální, například protože jste něco sami změnili a ještě jste nestiskli *Přepočítat*, nástroj pro čtení nejdřív přepočítá. Jedna výjimka: je-li projekt v zobrazení *Zaznamenaná data* (po importu), nástroj pro čtení tiše nepřepočítá, protože by ta data nahradil. Asistent pak dostane zaznamenaná data s upozorněním, že nebyla přepočítána. Změna od asistenta sama vždy přepočítá, i v tom případě. Po změně od asistenta nemusíte stisknout *Přepočítat*. Výsledek, například dokončení projektu a kritickou cestu, asistent přečte zpět nástroji pro čtení. Viz také [Zaznamenaná data](docs://uitleg-datums-zoals-opgeslagen).

### Skript je jeden krok

Asistent může odeslat řadu kroků jako celek pomocí `planner_batch`, skriptu o nejvýše 100 krocích. Vy tak dostanete jeden krok vrácení zpět, jedno přepočítání a jednu zálohu. Když jeden krok selže strukturálně, například neznámým nástrojem nebo cyklickou závislostí, aplikace vrátí celý skript zpět. Nikdy si nenecháte napůl hotový plán. Odmítnutí jedné položky uvnitř hromadného kroku, například jednoho neplatného řádku průběhu z dvaceti, je mírnější: ta položka zůstane stranou a zbytek se provede. Odmítnutí jsou uvedena v horní části odpovědi.

### Vaše omezení

Čtyři věci nastavíte sami na kartě *AI*:

- *Pozastavit* a *Jen pro čtení* nechají asistenta připojeného, ale odmítnou každou změnu. Čtení zůstává možné, včetně přepočítání neaktuálního plánu při čtení: to jsou vypočítaná pole, ne data projektu, proto se nepřidá krok vrácení zpět a projekt se nepovažuje za změněný. Když sami právě upravujete, například přetahujete pruh nebo píšete do pole, nástroj pro čtení nepřepočítá: asistent pak dostane data z doby před vaší úpravou, s upozorněním, že jsou neaktuální.
- Otevřené dialogové okno blokuje všechno. Když je otevřené například okno úkolu, nastavení, režim prezentace nebo uvítací okno, aplikace odmítne i čtení, protože jste uprostřed ruční akce. Asistent dostane chybový kód `DIALOG_OPEN`. Hlášení uvádí interní název otevřeného okna, například `showTaskDialog` pro okno úkolu.
- *Automatická záloha* zapíše kopii IFC před první změnou v každém dokumentu. Když se tato záloha nezdaří, aplikace změnu neprovede.
- *Panel činnosti* zobrazuje každé volání s argumenty a odpovědí.

Kromě toho platí vaše běžné *Vrátit zpět* (Ctrl+Z). Asistent tu historii sdílí s vámi a sám má `planner_undo` a `planner_redo`.

### Co asistent nemůže

Most je záměrně užší než aplikace. Co asistent nemůže, má obvykle jeden ze tří důvodů.

**Zasahuje dál než projekt.** Asistent nemůže měnit knihovnu zdrojů. Knihovna je sdílena všemi vašimi projekty a nespadá do historie vrácení zpět. Jedna změna standardní sazby by se pak projevila i v projektech, které nejsou ani otevřené. U zdroje z knihovny jsou název, typ, popis, standardní sazba a jednotka pevné, stejně jako v panelu zdrojů. Věci, které rozhoduje projekt, zůstávají asistentovi: maximální počet jednotek, dostupnost v čase, kalendář a pracovní četa. Nemůže také vybrat, který kalendář je kalendář projektu. Profil výpočtu a možnosti výpočtu může číst, ale neupravit; může nastavit jen režim průběhu a výchozí hodnotu projektu pro pravidlo pevné veličiny. Nástroje pro nastavení, motiv, jazyk, rozšíření nebo aktualizace neexistují.

**Nehodí se k spolehlivému ověření.** Asistent nemůže nastavit překlenovací úkol, naplánovat úkol ručně, nastavit druhé omezení, vyplnit poznámky, barvy, kódy aktivit, vlastní pole nebo vazby mezi projekty. Nemůže ani ručně nastavit zpoždění vyrovnání. Kód WBS také nevybírá; aplikace si ho odvodí sama.

**Zasahuje do věcí, které musíte rozhodnout sami.** Průběh zapíše jen tehdy, když existuje datum stavu. Datum stavu si asistent nevybírá: je to vaše referenční datum. Pokud úkol, který nezačal, má plánované zahájení po datu stavu, musí asistent doplnit skutečné zahájení. Soubory čte a zapisuje jen ve vaší uživatelské složce a existující soubor přepíše jen tehdy, když o to výslovně požádá. Export není *Uložit*: projekt zůstane v aplikaci neuložený.

### Jak asistent ví, jak plánovat

Asistent, který zná nástroje, může přesto sestavit plán, který žádný plánovač nevyužije: úkoly bez závislostí, pevné datum u každého úkolu nebo členění, které je příliš jemné. Proto mu aplikace dává tři věci.

**Základní pravidla při navázání spojení.** Při připojení pošle most krátký text do pole `instructions` v navázání spojení MCP. Mnoho klientů tento text vloží do systémového pokynu; zda to udělá váš, závisí na klientovi. Pravidla: začněte u milníků a termínu předání, vytvářejte úkoly zhruba od jednoho dne do dvou týdnů, řiďte plán závislostmi, ne pevnými daty, omezení používejte jen pro pevná vnější data, nejdřív opravte neúspěšný výpočet, pro ucelenou řadu používejte `planner_batch`, průběh zapisujte jen s vaším datem stavu a skutečnými daty, která zadáte, a na závěr řekněte, co jste předpokládal a co jste záměrně nedělal.

**Příručka pro asistenty.** Nástroj `planner_get_planning_guide` vrací příručku napsanou zvlášť pro asistenty. Vychází ze stejných zásad jako [Dobré plánování](docs://gids-goed-plannen), ale asistent pracuje jinak než vy: nestiskne F5 ani neklikne na pás karet, volá nástroje a aplikace pro něj přepočítá. Příručka proto u každé zásady uvádí nástroje, které asistent pro ni používá, a vysvětluje, co asistent udělá se *Zaznamenaná data* nebo s neúspěšným výpočtem. Příručka je v angličtině, stejně jako vše, co asistent čte přes propojení. Nástroj sice přijímá volbu jazyka pro starší asistenty, ale text tím nemění. Přečíst si ji můžete sami na adrese `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Výzva k připojení z okna *Údaje o připojení* žádá asistenta, aby nejdřív přečetl příručku. Nástroj funguje i při otevřeném dialogu, když je pozastaveno a v režimu jen pro čtení, protože nečte váš plán.

**Dvě dovednosti.** Dovednost je malý soubor pokynů, který asistent čte v každé relaci. Jsou dvě, protože jde o dva druhy práce. Sestavení plánu se týká logiky; aktualizace průběhu se týká skutečností, které znáte jen vy. Dovednost *goed-plannen* slouží k sestavení nebo přestavbě plánu: pořadí, v jakém se nástroje používají, pravidlo přepočítání, `planner_batch` a povinnost hlásit předpoklady. Dovednost *progress-update* slouží k týdenní aktualizaci průběhu: nejdřív vaše datum stavu, potom skutečné zahájení a dokončení a dokončeno %, a nakonec sestava odchylek oproti směrnému plánu, kritické cestě a novému datu dokončení. Samotné zásady plánování jsou v příručce. Obě dovednosti jsou v angličtině. Nástroj vrací obě, s místem, kam patří. Jak je nainstalujete, je popsáno v [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Příklad

Požádáte asistenta: postavte přístavbu se základem, zdivem a střechou, v tomto pořadí. Váš projekt začíná v pondělí 2. března 2026. Asistent nejdřív přečte příručku a potom odešle jeden skript:

1. zahájení projektu 2. března 2026;
2. tři úkoly: Foundation (5 pracovních dnů), Brickwork (10 pracovních dnů) a Roof (4 pracovní dny);
3. dvě závislosti dokončení-zahájení: z Foundation do Brickwork a z Brickwork do Roof.

Aplikace provede tři kroky a přepočítá. Když asistent potom přečte výsledky zpět, zjistí: dokončení projektu ve čtvrtek 26. března 2026, dobu trvání projektu 19 pracovních dnů a všechny tři úkoly kritické. To souhlasí se součtem: 5 + 10 + 4 je 19 pracovních dnů, a 19 pracovních dnů po pondělí 2. března skončí ve čtvrtek 26. března. Celý skript je v historii vrácení zpět jeden krok. Jeden příkaz *Vrátit zpět* odstraní tři úkoly, dvě závislosti a nové zahájení projektu.

Teď následuje případ „co kdyby“. Potom požádáte asistenta, aby aktualizoval průběh, a kvůli tomu nastaví datum stavu na pondělí 16. března. Datum stavu není jen štítek: úkoly, které ještě nezačaly, nesmí ležet před tímto datem a posunou se na něj. I bez jediného řádku průběhu se proto celý plán posune: Foundation běží od 16. do 20. března, Brickwork od 23. března do 7. dubna a Roof od 8. do 13. dubna. Dokončení projektu skočí z 26. března na 13. dubna. Plán se posune o dva pracovní týdny. Kalendář v tomto příkladu, *Bouwkalender NL*, má Velký pátek (3. dubna) a Velikonoce (5. a 6. dubna). Ty dva volné všední dny posunou dokončení o dva dny navíc. Proto asistent nastaví datum stavu jen na vaši žádost a jen tehdy, když je co zaznamenat.

## Důsledky pro váš plán a časté omyly

**Asistent nemá vlastní kopii.** Co změní, mění váš projekt. Je-li zapnutá *Automatická záloha*, máte před jeho první změnou zálohu IFC. V režimu *Jen pro čtení* může asistent analyzovat bez jakékoli změny.

**Nový token přeruší všechna spojení.** Token je heslo mostu. Nový token zneplatní starý, i u běžícího mostu, a asistent musí dostat nový.

**Tvrzení asistenta, že to funguje, není důkaz.** *Panel činnosti* ukáže, který nástroj skutečně zavolal a co se vrátilo. Odmítnutí téměř vždy uvede pole, které bylo špatně, a postup, který funguje.

**Asistent nemůže udělat případ „co kdyby“ s vrácením zpět.** Historii vrácení zpět sdílí s vámi, takže pro varianty dokument duplikuje pomocí `planner_duplicate_document`. Kopie je odpojená, nemá cestu k souboru a zobrazuje se jako neuložená. Asistent varianty nezavírá; o tom rozhodnete vy.

**Export od asistenta není uložení.** Zapíše soubor IFC na cestu, kterou si sám zvolí uvnitř vaší uživatelské složky, a existující soubor přepíše jen tehdy, když o to výslovně požádá. Váš projekt zůstane v aplikaci neuložený a zachová si vlastní cíl uložení. Když importuje soubor, otevře se v nové kartě nebo v prázdné, nezměněné kartě.

## Viz také

- [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): kroky ke spuštění mostu, připojení asistenta a instalaci dovednosti.
- [Nástroje AI](docs://ref-ai-tools): všechny nástroje podle skupin, co odmítají a jak dlouho se uchovávají zálohy.
- [Dobré plánování](docs://gids-goed-plannen): zásady plánování; asistent je dostane v anglické verzi s doplněnými nástroji.
- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co datum stavu dělá s vaším plánem.
