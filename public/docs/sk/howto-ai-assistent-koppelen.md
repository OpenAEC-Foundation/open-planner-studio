# Pripojenie AI asistenta (MCP)

Cieľ: umožniť AI asistentovi sledovať a upravovať váš plán. Vidíte, čo asistent robí, a limity si nastavujete sami.

## Kedy to potrebujete

Chcete, aby AI asistent čítal, analyzoval alebo menil váš plán. Napríklad aby navrhol prvú WBS, opravil úlohy alebo vysvetlil kritickú cestu. To funguje cez **Model Context Protocol** (MCP): štandard, ktorý umožňuje AI asistentovi používať nástroje programu. Na to Open Planner Studio spúšťa malý server na vašom počítači, **most**. Ponúka sadu nástrojov, všetky s názvom, ktorý začína na `planner_`: čítanie a zmenu úloh, závislostí, zdrojov, kalendárov, pôvodných plánov, dokumentov a súborov. Ktoré nástroje existujú a čo odmietajú, je v článku [Nástroje AI](docs://ref-ai-tools). Prečo prepojenie funguje takto, je v článku [Ako funguje prepojenie s AI](docs://uitleg-ai-koppeling).

Most funguje iba v desktopovej aplikácii. Ak v prehliadači zapnete režim AI, uvidíte kartu *AI*, ale tlačidlo *Spustiť most* je sivé s textom *Most funguje iba v desktopovej aplikácii.* Zvyšok tohto článku sa týka desktopovej aplikácie. V prehliadači sú sivé aj *Zálohovať teraz* a *Otvoriť priečinok záloh*.

## Postup

### 1. Zapnite režim AI

1. Vyberte *Nastavenia › Projekt › Nastavenia*. Môžete tiež vybrať *Súbor › Nastavenia* alebo ozubené koliesko v hornej časti.
2. Vyberte kartu *Rozšírené* a zapnite možnosť *Zapnúť režim AI*. Na páse s nástrojmi sa zobrazí karta *AI*.
3. Ak chcete, aby most bežal hneď po spustení aplikácie, zapnite aj *Spustiť most automaticky*. To sa prepne iba vtedy, keď je režim AI zapnutý, a funguje to iba v desktopovej aplikácii. Predvolené nastavenie je vypnuté, pretože otvorenie portu je vaše vedomé rozhodnutie.

Ak režim AI vypnete, most sa zastaví a karta *AI* zmizne.

### 2. Spustite most

1. Prejdite na kartu *AI* a kliknite na tlačidlo *Spustiť most* v skupine *Server*.
2. Pozrite sa na stav vedľa tlačidla. Zobrazí sa *Vypnuté*, *Aktívny na porte 3877*, *Port 3877 je obsadený* alebo *Chyba*. Ak spustenie uspeje, stav hovorí *Aktívny na porte 3877* a tlačidlo sa volá *Zastaviť most*. Pri stave *Port 3877 je obsadený* alebo *Chyba* zostáva tlačidlo *Spustiť most*; pozrite si úskalia.

Most počúva iba na vašom počítači, na jednom porte. Predvolené nastavenie je port 3877. V skupine *Pripojenie* môžete zvoliť iný port v poli *Port*, ale iba vtedy, keď je most zastavený.

### 3. Pripojte asistenta

1. Kliknite na tlačidlo *Pripojiť* v skupine *Pripojenie*. Otvorí sa okno *Údaje o pripojení*.
2. Vyberte, čo váš klient potrebuje. Pozrite si nižšie.
3. Token je skrytý. Ikonou oka ho zobrazíte. Tlačidlá kopírovania vždy skopírujú skutočnú hodnotu, aj keď obrazovka token skrýva.
4. Požiadajte asistenta o zoznam nástrojov. Táto kontrola je aj vo výzve na pripojenie: asistent by mal vidieť nástroje s predponou `planner_`; očakávaný počet je vo výzve na pripojenie.

Okno ponúka tri spôsoby pripojenia:

- *Úryvok konfigurácie*: časť konfigurácie, ktorú vložíte do nastavení MCP vášho klienta.
- *Výzva na pripojenie*: text, ktorý vložíte do AI asistenta. Potom sa asistent pripojí sám.
- *Endpoint* a *Overenie*: samostatné údaje. Endpoint je `http://localhost:3877/mcp` s transportom *streamable HTTP*. Každá požiadavka potrebuje hlavičku `Authorization: Bearer` a za ňou váš token.

V skupine *Pripojenie* je aj pole *Token*. Je to dlhý, náhodný kód, ktorý aplikácia pre vás vytvorí a uloží na tomto počítači. V okne je napísané: *Tento token dáva prístup k otvorenému plánu. Nezdieľajte ho s inými.* Ikonou *Vytvoriť nový token* vytvoríte nový token. Aplikácia najprv zobrazí otázku: *Vytvorenie nového tokenu preruší všetky existujúce pripojenia. Pokračovať?* Ak most beží, reštartuje sa s novým tokenom a starý token už nefunguje.

### 4. Pozrite si, čo AI robí

1. Kliknite na tlačidlo *Panel činnosti* v skupine *Činnosť*. V bočnom stĺpci sa otvorí panel *Činnosť AI*.
2. Každé volanie mostu je na jednom riadku, najnovšie je hore: čas, čo sa stalo, ako dlho to trvalo a či to uspelo alebo nie. Kliknite na riadok, aby sa rozbalili *Argumenty* a *Odpoveď*.
3. Tlačidlom *Vymazať* vyprázdnite zoznam. Panel si ponecháva posledných 500 volaní. Kým sa nič nestalo, je tam text *Zatiaľ žiadna činnosť AI. Volania mostu sa zobrazia tu.*

Keď je režim AI zapnutý, vpravo dole na stavovom riadku je bodka s *AI*. Jej farba ukazuje stav mostu. Kliknutím na ňu sa dostanete na kartu *AI*.

### 5. Nastavte limity

V skupine *Bezpečnosť* sú tlačidlá, ktorými obmedzíte AI:

- *Pozastaviť*: AI smie dočasne nič nemeniť, čítanie je stále povolené. Most zostáva aktívny. Tlačidlo sa zmení na *Obnoviť*.
- *Iba na čítanie*: všetky nástroje, ktoré niečo menia, sú odmietnuté, kým je toto zapnuté.
- *Auto-záloha: zapnutá*: pred prvou zmenou od AI v dokumente aplikácia zapíše zálohu vo formáte IFC. Predvolené nastavenie je zapnuté. Tlačidlom ju vypnete; potom sa zobrazí *Auto-záloha: vypnutá*. Toto sa stane raz pre každý dokument pri každom spustení mostu.
- *Zálohovať teraz*: okamžite vytvorí zálohu aktívneho dokumentu. Potom sa zobrazí *Záloha vytvorená:* s názvom súboru.
- *Otvoriť priečinok záloh*: otvorí priečinok so zálohami.

Zálohy sú v priečinku `ai-backups` v dátovom priečinku aplikácie. Aplikácia uchováva posledné zálohy a staršie postupne odstraňuje. Presný postup je v článku [Nástroje AI](docs://ref-ai-tools).

### 6. Nechajte asistenta dobre plánovať

Asistent, ktorý pozná nástroje, môže aj tak vytvoriť plán, z ktorého nemá plánovač žiadny úžitok: úlohy bez závislostí, pevný dátum pri každej úlohe alebo príliš jemné rozčlenenie. Preto asistent dostáva pravidlá plánovania tromi spôsobmi. Pri prvých dvoch nemusíte nič robiť.

1. **Základné pravidlá prichádzajú samy.** Pri pripojení most pošle krátky text so základnými pravidlami. Mnohí klienti ho vložia do systémovej výzvy; či to urobí váš klient, závisí od klienta. Text hovorí okrem iného: začnite s medzníkmi, vytvárajte úlohy v rozsahu zhruba jedného dňa až dvoch týždňov, riaďte plán závislosťami namiesto pevných dátumov a na konci uveďte, čo ste predpokladali.
2. **Výzva na pripojenie odkazuje na celý návod.** Výzva na pripojenie z okna *Údaje o pripojení* žiada asistenta, aby najprv prečítal plánovací návod nástrojom `planner_get_planning_guide`. Ten vráti anglický návod pre asistentov: rovnaké zásady ako v článku [Dobre plánovať](docs://gids-goed-plannen), a pri každej zásade nástroje, ktoré asistent na ňu používa. Môžete si ho prečítať sami na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Ak výzvu nepoužijete, opýtajte sa asistenta sami: *Prečítajte si najprv plánovací návod nástrojom planner_get_planning_guide, skôr než čokoľvek zmeníte.*
3. **Nepovinné: skilly.** Skill je malý súbor s pokynmi, ktorý asistent číta v každej relácii, aby aj v neskoršom rozhovore poznal správny spôsob práce. Sú dva, oba v angličtine: *goed-plannen* na zostavenie alebo prestavbu plánu a *progress-update* na týždenný záznam postupu. Funguje to iba s asistentom, ktorý skilly podporuje. Samotné skilly spomínajú Claude Code a podobných asistentov. Každý skill je súbor `SKILL.md` v priečinku s názvom skillu: `.claude/skills/goed-plannen/SKILL.md` a `.claude/skills/progress-update/SKILL.md` v priečinku projektu, v ktorom asistent pracuje, alebo rovnaké priečinky pod `~/.claude/skills/`, ak ich chcete mať v každom projekte.

Súbory získate dvoma spôsobmi. Požiadajte asistenta, aby zavolal nástroj `planner_get_planning_guide` s `part` nastaveným na `skill`: odpoveď obsahuje oba texty a pri každom skille miesta, kam patrí. Alebo si ich stiahnite z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` a `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ak je *goed-plannen* ešte zo staršej verzie aplikácie, nahraďte ho. Ten starý text je v holandčine a odkazuje na článok nápovedy namiesto na návod pre asistentov.

Či asistent naozaj čítal návod, uvidíte v paneli *Panel činnosti*: je tam volanie `planner_get_planning_guide`. Konečná odpoveď asistenta by mala obsahovať zoznam predpokladov: odhadnuté trvania, zvolené rozčlenenie, závislosti, ktoré vytvoril sám, a každé obmedzenie, ktoré nastavil. Ak tento zoznam chýba, požiadajte o neho. Po zázname postupu podľa *progress-update* by odpoveď mala uviesť dátum kontroly stavu, nový dátum dokončenia a odchýlku oproti pôvodnému plánu.

## Úskalia a čo vtedy aplikácia robí

**AI zmení niečo, čo chcete vrátiť.** Každá zmena od AI je jeden krok, ktorý vrátite tlačidlom *Vrátiť späť* (Ctrl+Z). Séria zmien, ktorú AI odošle ako celok, je jeden krok. Potom sa projekt zobrazí ako neuložený. Po zmene sa plán znovu vypočíta, takže F5 nemusíte stlačiť sami.

**Aplikácia odmietne volanie od AI.** Pri tlačidlách *Pozastaviť* a *Iba na čítanie* aplikácia odmieta všetky zmeny. Čítanie zostáva možné, vrátane prepočítania zastaralého plánu. Ak práve upravujete sami, napríklad ťaháte pruh alebo píšete do poľa, AI dostane dátumy, aké boli pred vašou úpravou, s upozornením, že sú zastaralé. Ak máte otvorené dialógové okno, napríklad nastavenia, dialóg úlohy alebo uvítacie okno, alebo je zapnutý režim prezentácie, aplikácia odmieta všetky volania vrátane čítania, kým dialóg nezatvoríte. AI potom dostane chybové hlásenie s interným názvom toho, čo je otvorené, napríklad `showTaskDialog`. Funguje iba `planner_get_planning_guide`, lebo nečíta váš plán.

**Prepnete karty, kým AI pracuje.** AI pracuje v dokumente, v ktorom urobil svoju prvú zmenu. Ak medzitým prepnete karty, aplikácia odmietne jeho ďalšiu zmenu, kým nepotvrdí, že chce pracovať na druhej karte. Tak sa nič nedostane do zlého projektu.

**AI zapisuje alebo otvára súbor.** AI môže zapísať plán ako súbor IFC a otvoriť súbor plánu ako novú kartu. Môže to robiť iba vo vašom používateľskom priečinku. Existujúci súbor prepíše iba vtedy, keď to výslovne požiada.

**Stav je *Port 3877 je obsadený*.** Iný program používa port. Hlásenie aplikácie je zobrazené pod ním. Pole *Port* potom zostane zamknuté (*Upraviteľné iba vtedy, keď je server zastavený.*), hoci most nebeží, a tlačidlo na zastavenie tam nie je. Ide o známy nedostatok. Kým sa to neopraví: vypnite a znovu zapnite možnosť *Zapnúť režim AI*. Stav sa potom vráti na *Vypnuté* a môžete zvoliť iný port. Potom znovu skopírujte údaje o pripojení, lebo endpoint obsahuje port.

**Klient sa po novom tokene nemôže pripojiť.** Nový token preruší všetky existujúce pripojenia. Dajte klientovi nový token alebo znovu vložte úryvok konfigurácie.

**Most ste zastavili sami a sám sa nespustí.** *Spustiť most automaticky* funguje raz pri každom spustení aplikácie. Ak most zastavíte sami, aplikácia ho potichu opäť nezapne.

**Karta *AI* zmizla.** Režim AI je vypnutý. Zapnite ho v kroku 1.

**Webová stránka vo vašom prehliadači nemôže komunikovať s mostom.** Most odmieta každú požiadavku, ktorá prichádza z prehliadača, a každú požiadavku bez správneho tokenu.

## Pozri tiež

- [Dávanie spätnej väzby](docs://howto-feedback-geven): ak pripojenie funguje inak, než je tu opísané, nahláste to.
- [Ako funguje prepojenie s AI](docs://uitleg-ai-koppeling): čo je prepojenie, prečo asistent pracuje vo vašom otvorenom projekte a čo nesmie robiť.
- [Nástroje AI](docs://ref-ai-tools): všetky nástroje `planner_*` podľa skupín, chybové kódy a ako dlho sa zálohy uchovávajú.
- [Dobre plánovať](docs://gids-goed-plannen): zásady plánovania; asistent ich dostane v anglickej verzii s pridanými nástrojmi.
- [Nastavenia](docs://ref-instellingen): nastavenia AI.
