# Ako funguje prepojenie s AI asistentom

Čo sa v skutočnosti stane, keď AI asistent pracuje vo vašom pláne? V tomto článku sa dozviete, čo je prepojenie, v čom sa líši od výmeny súboru, aké obmedzenia si aplikácia sama stráži a ako asistent zistí, ako sa plán má zostaviť. Príklad na konci ukazuje číslami, čo môže asistent urobiť naraz a čo z toho dostanete späť.

## Koncept

AI asistent, napríklad chatovací program alebo programovací asistent, dokáže ovládať iný program cez **Model Context Protocol** (MCP). Open Planner Studio v tejto výmene pôsobí ako server. Desktopová aplikácia spustí na vašom počítači malý server, **most**. Asistent sa k nemu pripojí a dostane zoznam **nástrojov**: nástrojov s názvom, ktorý začína na `planner_`, napríklad čítanie úloh, pridanie závislosti alebo uloženie pôvodného plánu. Ktoré nástroje existujú, je uvedené v [AI nástroje](docs://ref-ai-tools).

Pozoruhodné je, že asistent pracuje v projekte, ktorý máte práve otvorený, nie v kópii. Nič neexportujete a nič neimportujete. Nikdy nenastane okamih, keď vy a asistent vidíte dve rôzne verzie. Úloha, ktorú asistent pridá, sa hneď zobrazí v diagrame Gantt. Aplikácia v tom nie je naivná: asistent pracuje s rovnakým výpočtom, rovnakou históriou vrátení späť a rovnakými pravidlami ako vy.

Ako prepojenie zapnete, je uvedené v [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen). Ďalej si prečítate, ako funguje.

## Ako to aplikácia rieši

### Server, ktorý počuje iba váš počítač

Most počúva iba na vašom počítači (`127.0.0.1`), na jednom porte, štandardne 3877. Prijíma iba požiadavky na adresu `/mcp` a iba s vaším **tokenom** v hlavičke `Authorization: Bearer`. Požiadavku bez správneho tokenu odmietne. Požiadavku z prehliadača, ktorý spozná podľa hlavičky `Origin`, tiež odmietne. Webová stránka, ktorú máte náhodou otvorenú, tak nemôže komunikovať s vaším plánom. Požiadavky spracúva prísne jednu po druhej.

Pripojenie je obyčajné HTTP na vašom počítači. Aplikácia sama nič neodosiela von. Čo asistent urobí s plánom, ktorý načíta, napríklad čo s ním urobí jeho poskytovateľ, záleží od asistenta a leží mimo aplikácie.

### Asistent pracuje na jednom dokumente

Pri prvej zmene naviaže most pripojenie na dokument, ktorý je vtedy aktívny. Ak potom prepnete karty sami, aplikácia odmietne ďalšiu zmenu asistenta (kód `DOC_DRIFT`), kým asistent potvrdí cez `planner_switch_document`, na ktorom dokumente chce pracovať. Tak sa nič nedostane do nesprávneho projektu. Asistent, ktorý dokument sám otvorí alebo duplikuje, potom pracuje v tomto novom dokumente.

### Každá zmena prepočíta plán

V aplikácii plánujete ručne: niečo zmeníte a potom stlačíte *Prepočítať* (F5), pokiaľ nie je zapnutý *Automatický prepočet*. Pre zmenu od asistenta to neplatí. Každá zapisovacia akcia asistenta prebieha v jednej transakcii. Ak sa v nej zmenia údaje projektu, aplikácia na konci sama prepočíta plán, pri skripte iba raz. Čítací nástroj vždy dáva aktuálne dátumy. Ak je plán zastaraný, napríklad pretože ste niečo zmenili sami a ešte ste nestlačili *Prepočítať*, čítací nástroj najprv prepočíta. Jedna výnimka: ak je projekt v zobrazení *Dátumy ako zaznamenané* (po importe), čítací nástroj potichu neprepočíta, lebo by tieto dátumy nahradil. Asistent potom dostane zaznamenané dátumy s upozornením, že neboli prepočítané. Zmena samotného asistenta sa vždy prepočíta, aj vtedy. Po zmene asistenta nemusíte stlačiť *Prepočítať*. Asistent potom výsledok, napríklad dátum dokončenia projektu a kritickú cestu, načíta späť čítacími nástrojmi. Pozri aj [Dátumy ako zaznamenané](docs://uitleg-datums-zoals-opgeslagen).

### Skript je jeden krok

Asistent môže predložiť sériu krokov ako celok pomocou `planner_batch`, skriptu s najviac 100 krokmi. Vy tak dostanete jeden krok vrátenia späť, jeden prepočet a jednu zálohu. Ak jeden krok zlyhá štrukturálne, napríklad neznámym nástrojom alebo cyklickou závislosťou, aplikácia vráti celý skript späť. Nikdy neostane rozpracovaný plán. Odmietnutie jednej položky vnútri hromadného kroku, napríklad jedného neplatného riadku postupu z dvadsiatich, je miernejšie: táto položka zostane vynechaná a zvyšok sa vykoná. Odmietnutia sú na začiatku odpovede.

### Vaše obmedzenia

Štyri veci nastavíte sami na karte *AI*:

- *Pozastaviť* a *Iba na čítanie* nechajú asistenta pripojeného, ale odmietnu každú zmenu. Čítanie zostáva možné, vrátane prepočtu zastaraného plánu pri čítaní. Ide o vypočítavané polia, nie o údaje projektu. Preto sa nepridá krok vrátenia späť a projekt sa nepovažuje za zmenený. Ak sami práve upravujete, napríklad presúvate pruh alebo píšete do poľa, čítací nástroj neprepočíta. Asistent potom dostane dátumy zo stavu pred vašou úpravou s upozornením, že sú zastarané.
- Otvorené dialógové okno blokuje všetko. Ak je napríklad otvorené dialógové okno úlohy, nastavenia, prezentačný režim alebo uvítacie okno, aplikácia odmietne aj čítanie, lebo ručne niečo robíte. Asistent dostane chybový kód `DIALOG_OPEN`. Chybové hlásenie uvedie interný názov otvoreného okna, napríklad `showTaskDialog` pre dialógové okno úlohy.
- *Automatická záloha* zapíše kópiu IFC pred prvou zmenou v každom dokumente. Ak zálohu nedokáže zapísať, aplikácia zmenu nevykoná.
- *Panel činnosti* zobrazuje každé volanie s argumentmi a odpoveďou.

Okrem toho platí vaše bežné *Vrátiť späť* (Ctrl+Z). Asistent túto históriu zdieľa s vami a má vlastné `planner_undo` a `planner_redo`.

### Čo asistent nedokáže

Most je úmyselne užší než aplikácia. Čo asistent nedokáže, má zvyčajne jeden z troch dôvodov.

**Zasahuje ďalej než projekt.** Asistent nemôže meniť knižnicu. Knižnica je zdieľaná všetkými vašimi projektmi a leží mimo histórie vrátení späť. Jedna zmena sadzby by sa tak prejavila aj v projektoch, ktoré nie sú ani otvorené. Pri zdroji z knižnice sú názov, typ, popis, štandardná sadzba a jednotka priradenia pevné, rovnako ako v paneli zdrojov. To, čo rozhoduje projekt, zostáva na asistentovi: maximálny počet jednotiek, dostupnosť v čase, kalendár a posádka. Nemôže ani vybrať, ktorý kalendár je kalendárom projektu. Profil výpočtu a možnosti výpočtu môže čítať, ale nemôže ich meniť. Môže nastaviť iba režim postupu a predvolené pravidlo práce projektu. Nástroje pre nastavenia, motív, jazyk, rozšírenia alebo aktualizácie neexistujú.

**Nedá sa spoľahlivo overiť.** Asistent nemôže nastaviť hamak, naplánovať úlohu ručne, nastaviť druhé obmedzenie, vyplniť poznámky, farby, kódy aktivít, vlastné polia ani prepojenia medzi projektmi. Asistent nemôže ručne nastaviť oneskorenie pri vyvažovaní. Kód WBS si tiež nevyberie. Ten odvodí aplikácia sama.

**Zasahuje do niečoho, o čom musíte rozhodnúť sami.** Postup zaznamená iba vtedy, keď existuje dátum kontroly stavu. Ten si nevyberie sám: je to váš referenčný dátum. Ak úloha, ktorá nezačala, má plánovaný začiatok po dátume kontroly stavu, musí uviesť skutočný začiatok. Súbory číta a zapisuje iba vo vašom používateľskom priečinku. Existujúci súbor prepíše iba vtedy, keď to výslovne požiada. Export nie je *Uložiť*: projekt v aplikácii zostáva neuložený.

### Ako asistent vie, ako plánovať

Asistent, ktorý pozná nástroje, môže aj tak zostaviť plán, ktorý žiadny plánovač nevie použiť: úlohy bez závislostí, pevný dátum pri každej úlohe alebo rozpis, ktorý je príliš jemný. Preto mu aplikácia dáva tri veci.

**Kľúčové pravidlá v handshake.** Pri pripojení pošle most krátky text do poľa `instructions` MCP handshake. Mnoho klientov dá tento text do systémového promptu. Či to urobí váš klient, závisí od neho. Pravidlá: začnite pri medzníkoch a dátume dodania, vytvárajte úlohy zhruba od jedného dňa do dvoch týždňov, plán riaďte závislosťami namiesto pevných dátumov, obmedzenia používajte iba pre pevné externé dátumy, najprv opravte neúspešný výpočet, na súvislú sériu použite `planner_batch`, postup zaznamenávajte iba s vaším dátumom kontroly stavu a skutočnými dátumami, ktoré zadáte, a na konci uveďte, čo ste predpokladali a čo ste zámerne nerobili.

**Príručka pre asistentov.** Nástroj `planner_get_planning_guide` vracia príručku napísanú špeciálne pre asistentov. Vychádza z rovnakých zásad ako [Dobré plánovanie](docs://gids-goed-plannen), ale asistent pracuje inak ako vy: nestlačí F5 ani neklikne na páse s nástrojmi, volá nástroje a aplikácia pre neho prepočíta. Príručka preto pri každej zásade uvádza, ktoré nástroje asistent na to použije, a vysvetľuje, čo asistent urobí so zobrazením *Dátumy ako zaznamenané* alebo s neúspešným výpočtom. Príručka je v angličtine, rovnako ako všetko, čo asistent cez prepojenie číta. Nástroj síce prijme voľbu jazyka pre staršie asistenty, ale text sa tým nemení. Môžete si ju prečítať sami na adrese `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Výzva na pripojenie z okna *Údaje o pripojení* žiada asistenta, aby si najprv prečítal príručku. Nástroj funguje aj vtedy, keď je otvorený dialóg, pri funkcii *Pozastaviť* aj v režime *Iba na čítanie*, pretože nečíta váš plán.

**Dva skills.** Skill je malý súbor s pokynmi, ktorý asistent číta pri každej relácii. Sú dve, lebo ide o dva druhy činností. Zostavenie plánu je o logike. Aktualizácia postupu je o skutočnostiach, ktoré poznáte iba vy. Skill *goed-plannen* slúži na zostavenie alebo prestavbu plánu: poradie, v akom sa nástroje používajú, pravidlo prepočtu, `planner_batch` a povinnosť uviesť predpoklady. Skill *progress-update* slúži na týždennú aktualizáciu postupu: najprv váš dátum kontroly stavu, potom skutočný začiatok, skutočný dátum dokončenia a percento dokončenia a na konci prehľad odchýlky od pôvodného plánu, kritickej cesty a nového dátumu dokončenia. Samotné plánovacie zásady sú v príručke. Oba skills sú v angličtine. Nástroj vráti oba spolu s miestom, kam patria. Ako ich nainštalujete, je uvedené v [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Príklad

Požiadate asistenta: postavte prístavbu s foundation, brickwork a roof, v tomto poradí. Váš projekt začína v pondelok 2. marca 2026. Asistent najprv prečíta príručku a potom predloží jeden skript:

1. začiatok projektu 2. marca 2026;
2. tri úlohy: Foundation s trvaním 5 pracovných dní, Brickwork s 10 a Roof so 4;
3. dve závislosti typu dokončenie-začiatok: Foundation k Brickwork, Brickwork k Roof.

Aplikácia vykoná tri kroky a prepočíta plán. Ak asistent potom načíta výsledok, zistí: dátum dokončenia projektu vo štvrtok 26. marca 2026, trvanie projektu 19 pracovných dní a všetky tri úlohy sú kritické. To sedí so súčtom: 5 + 10 + 4 je 19 pracovných dní a 19 pracovných dní po pondelku 2. marca skončí vo štvrtok 26. marca. Celý skript je jeden krok vo vašej histórii. Jedno *Vrátiť späť* odstráni tri úlohy, dve závislosti a nový začiatok projektu.

Teraz scenár „čo ak“. Potom od asistenta požiadate, aby aktualizoval postup, a na to nastaví dátum kontroly stavu na pondelok 16. marca. Dátum kontroly stavu nie je iba označenie: úloha, ktorá ešte nezačala, nesmie začať pred týmto dátumom a posunie sa naň. Bez jediného riadku postupu sa preto posunie celý plán: Foundation beží od 16. do 20. marca, Brickwork od 23. marca do 7. apríla a Roof od 8. do 13. apríla. Dátum dokončenia projektu skočí z 26. marca na 13. apríla. Plán sa posunie o dva pracovné týždne a kalendár v tomto príklade, *Bouwkalender NL*, má Veľký piatok (3. apríla) a Veľkú noc (5. a 6. apríla). Tieto dva sviatky, ktoré padnú na pracovné dni, posunú dátum dokončenia o ďalšie dva dni. Preto asistent nastavuje dátum kontroly stavu iba na vašu žiadosť a iba vtedy, keď je čo zaznamenať ako skutočný postup.

## Dôsledky pre váš plán a časté omyly

**Asistent nemá vlastnú kópiu.** Čo zmení, mení váš projekt. Ak je zapnutá automatická záloha, máte pred jeho prvou zmenou zálohu IFC. S režimom *Iba na čítanie* môže analyzovať bez akejkoľvek zmeny.

**Nový token preruší všetky pripojenia.** Token je heslo mosta. Nový token zneplatní starý, aj keď most beží, a asistent musí dostať nový.

**To, že asistent povie, že to fungovalo, nie je dôkaz.** Panel činnosti ukazuje, ktorý nástroj naozaj zavolal a čo vrátil. Odmietnutie takmer vždy uvedie pole, ktoré bolo nesprávne, a spôsob, ktorý funguje.

**Asistent nedokáže scenár „čo ak“ s vrátením späť.** Históriu vrátení späť zdieľa s vami, preto pre varianty duplikuje dokument pomocou `planner_duplicate_document`. Kópia je odpojená, nemá cestu k súboru a zobrazuje sa ako neuložená. Asistent varianty nezatvára. Rozhodujete o tom vy.

**Export od asistenta nie je uloženie.** Zapíše súbor IFC na cestu, ktorú si sám zvolí vo vašom používateľskom priečinku. Existujúci súbor prepíše iba vtedy, keď to výslovne požiada. Váš projekt zostáva v aplikácii neuložený a má vlastný cieľ uloženia. Ak importuje súbor, ten sa otvorí v novej karte alebo v prázdnej a nezmenenej karte.

## Pozri aj

- [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): kroky na spustenie mosta, pripojenie asistenta a inštaláciu skillu.
- [AI nástroje](docs://ref-ai-tools): všetky nástroje podľa skupín, čo odmietajú a ako dlho sa uchovávajú zálohy.
- [Dobré plánovanie](docs://gids-goed-plannen): plánovacie zásady; asistent ich dostane v anglickej verzii s pridanými nástrojmi.
- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo dátum kontroly stavu robí s vaším plánom.
