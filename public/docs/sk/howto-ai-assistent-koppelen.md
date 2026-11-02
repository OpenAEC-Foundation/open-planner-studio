# Pripojenie klienta MCP

Cieľ: nechajte klienta MCP čítať váš plán a pracovať na ňom. Vidíte, čo klient robí. Limity si nastavujete sami.

## Rýchlo: nechajte, aby to urobil Claude

Pracujete s Claude Desktop alebo Claude Code? Potom vie Claude pripojenie nainštalovať sám:

1. Kliknite na *Kopírovať prompt* nižšie.
2. Vložte výzvu do novej konverzácie s Claude a odošlite ju.

Claude potom nainštaluje rozšírenie pre Open Planner Studio a pritom vysvetľuje, čo robí. Ak musíte niečo urobiť sami, napríklad kliknúť na *Inštalovať* v Claude Desktop, Claude vám presne povie, ktoré kliknutie. Na to nepotrebujete token.

```prompt
Nainštalujte mi rozšírenie Open Planner Studio, aby ste mohli čítať a meniť moje stavebné plány v Open Planner Studio. Urobte sami, čo môžete. Pred každým krokom povedzte v jednej jednoduchej vete, čo budete robiť a prečo. Ak potrebujete odo mňa niečo, pýtajte sa vždy len na jednu vec a počkajte na moju odpoveď. Ak musím niečo urobiť osobne, povedzte mi presne, ktoré jedno kliknutie alebo akciu treba urobiť a kde.

Čo potrebujete vedieť:
- Rozšírenie je jeden súbor open-planner-studio-<version>.mcpb v najnovšom vydaní: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Priamy odkaz je v odpovedi na https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (súbor, ktorého názov končí na .mcpb). Súbor je archív ZIP.
- Rozšírenie funguje s desktopovou aplikáciou Open Planner Studio aj bez nej. Ak je aplikácia otvorená a beží jej most MCP, pracujete v pláne, ktorý je otvorený v aplikácii. Ak je aplikácia zatvorená, pracujete so súbormi plánov v pracovnom priečinku, ktorý vyberiem ja.
- Inštalácia nepotrebuje token ani heslo. Nepýtajte sa ma na ne a nečítajte ich ani nezobrazujte.

Ak bežíte v Claude Desktop:
1. Ak viete stiahnuť súbor a otvoriť ho na mojom počítači, urobte to so súborom .mcpb. Ak nie, dajte mi priamy odkaz na stiahnutie a povedzte mi, aby som po dokončení sťahovania dvakrát kliknul na súbor.
2. Claude Desktop potom zobrazí rozšírenie Open Planner Studio. Povedzte mi, aby som kliknul na Inštalovať. Potom mi povedzte, aby som v poli Working folder vybral priečinok s mojimi súbormi plánov.
3. Povedzte mi, aby som začal novú konverzáciu a tam sa vás opýtal, ktoré nástroje Open Planner Studio vidíte.

Ak bežíte v Claude Code:
1. Skontrolujte, či je nainštalovaný Node.js 22 alebo novší. Ak nie je, povedzte mi, ako ho nainštalovať, a zastavte sa.
2. Opýtajte sa ma, ktorý priečinok obsahuje moje súbory plánov. To je pracovný priečinok.
3. Stiahnite súbor .mcpb a rozbaľte ho do nového vlastného priečinka v mojom používateľskom priečinku. Prečítajte tam súbor manifest.json: server.mcp_config hovorí, ako sa server spúšťa. Nahraďte ${__dirname} rozbaleným priečinkom a ${user_config.workdir} pracovným priečinkom.
4. Spustite claude mcp list. Ak tam už je server s názvom open-planner-studio, opýtajte sa ma, či ho smiete nahradiť. Jeho nastavenia nezobrazujte, lebo môžu obsahovať token.
5. Pridajte server pre môj používateľský účet, napríklad: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<pracovný priečinok> -- node <rozbalený priečinok>/server/index.mjs
6. Povedzte mi, aby som spustil novú reláciu Claude Code. Povedzte mi tiež, že /mcp tam ukáže, či je open-planner-studio pripojený.

Ak bežíte inde, napríklad v prehliadači na claude.ai, povedzte mi, že na to treba Claude Desktop alebo Claude Code. Ak neviete, kde bežíte, opýtajte sa ma.

Keď je inštalácia hotová, vysvetlite v niekoľkých vetách:
- ako vám umožním pracovať v otvorenej aplikácii: v Open Planner Studio vyberte Nastavenia › Projekt › Nastavenia aplikácie, na karte Rozšírené zapnite Povoliť pripojenie MCP. Potom kliknite na Spustiť most na karte MCP.
- že bez aplikácie sa zmena dostane do súboru až po uložení a že existujúci súbor sa neprepíše, kým je aplikácia otvorená.
Ak krok zlyhá, povedzte mi v jednej vete, čo sa pokazilo a čo môžem urobiť. Nehádajte.
```

Radšej to urobíte sami, alebo používate iného klienta MCP? Potom postupujte podľa krokov nižšie.

## Kedy to potrebujete

Chcete, aby klient MCP čítal, analyzoval alebo upravoval váš plán. Napríklad aby navrhol prvú WBS, opravil úlohy alebo vysvetlil kritickú cestu. To funguje cez **Model Context Protocol** (MCP): štandard, ktorý umožňuje, aby program s umelou inteligenciou, teda **klient MCP**, používal nástroje iného programu. Na to Open Planner Studio spúšťa malý server na vašom počítači, **most**. Ponúka sadu nástrojov, ktorých názov začína na `planner_`: čítanie a zmenu úloh, závislostí, zdrojov, kalendárov, pôvodných plánov, dokumentov a súborov. Aké nástroje sú a čo odmietajú, nájdete v [Nástroje MCP](docs://ref-ai-tools). Klient MCP pracuje v projekte, ktorý máte otvorený, nie v kópii: úloha, ktorú pridá, sa hneď zobrazí v diagrame Gantt. Používa rovnaký výpočet a rovnakú históriu príkazu *Vrátiť späť* ako vy.

Most funguje iba v desktopovej aplikácii. Ak v prehliadači povolíte pripojenie MCP, uvidíte kartu *MCP*, ale tlačidlo *Spustiť most* je sivé a má text *Most funguje iba v desktopovej aplikácii.* Zvyšok tohto článku sa týka desktopovej aplikácie. V prehliadači sú sivé aj *Zálohovať teraz* a *Otvoriť priečinok záloh*.

## Kroky

### 1. Povoľte pripojenie MCP

1. Vyberte *Nastavenia › Projekt › Nastavenia aplikácie*. Môžete tiež vybrať *Súbor › Nastavenia aplikácie* alebo ozubené koliesko v hornej časti.
2. Vyberte kartu *Rozšírené* a zapnite *Povoliť pripojenie MCP*. Na páse s nástrojmi sa zobrazí karta *MCP*.
3. Ak chcete, aby most bol aktívny hneď po spustení aplikácie, zapnite aj *Spustiť most automaticky*. Táto možnosť funguje len vtedy, keď je pripojenie MCP zapnuté, a len v stolovej aplikácii. Predvolené nastavenie je vypnuté, lebo otvorenie portu je vedomé rozhodnutie.

Ak vypnete pripojenie MCP, most sa zastaví a karta *MCP* zmizne.

### 2. Spustite most

1. Prejdite na kartu *MCP* a kliknite na *Spustiť most* v skupine *Server*.
2. Pozrite sa na stav vedľa tlačidla. Zobrazí sa *Vypnuté*, *Aktívny na porte 3877*, *Port 3877 je obsadený* alebo *Chyba*. Ak spustenie uspeje, zobrazí sa *Aktívny na porte 3877* a tlačidlo sa volá *Zastaviť most*. Ak je stav *Port 3877 je obsadený* alebo *Chyba*, tlačidlo zostane *Spustiť most*; pozrite si úskalia.

Most počúva len na vašom počítači, na jednom porte. Predvolený je port 3877. V skupine *Pripojenie* môžete v poli *Port* vybrať iný port, ale len vtedy, keď je most zastavený. Pripojenie je HTTP bez šifrovania na vašom počítači. Samotná aplikácia nič neodosiela. Čo MCP klient robí s vaším plánom, napríklad čo s ním robí jeho poskytovateľ, nespadá pod aplikáciu.

### 3. Pripojte MCP klienta

1. Kliknite na *Pripojiť* v skupine *Pripojenie*. Otvorí sa okno *Údaje o pripojení*.
2. Vyberte, čo váš klient potrebuje (pozrite si nižšie).
3. Token je skrytý. Ikonou oka ho zobrazíte. Tlačidlá na kopírovanie vždy skopírujú skutočnú hodnotu, aj keď obrazovka token skrýva.
4. Nechajte MCP klienta vyžiadať zoznam nástrojov. Táto kontrola je aj vo výzve na pripojenie: klient má vidieť nástroje s predponou `planner_`; očakávaný počet je vo výzve na pripojenie.

Okno ponúka štyri spôsoby pripojenia:

- *Nechať to na Claude*: rovnaká výzva ako na začiatku tohto článku, s tlačidlom *Kopírovať prompt*. Je to určené pre Claude Desktop a Claude Code. Token na to nepotrebujete.
- *Úryvok konfigurácie*: časť konfigurácie, ktorú vložíte do nastavení MCP vášho klienta.
- *Výzva na pripojenie*: text, ktorý vložíte do MCP klienta, a potom sa klient pripojí sám.
- *Endpoint* a *Overenie*: samostatné údaje. Endpoint je `http://localhost:3877/mcp` s transportom *streamable HTTP*. Každá požiadavka potrebuje hlavičku `Authorization: Bearer` a za ňou váš token. Váš klient musí tiež podporovať relácie MCP: keď sa pripojí, most dá kód relácie v hlavičke `Mcp-Session-Id` a každú ďalšiu požiadavku bez tohto kódu odmietne. Claude Code a `mcp-remote` to robia samy.

**Pripojte sa znovu po aktualizácii aplikácie.** Ak bol váš MCP klient už pripojený k staršej verzii aplikácie, zatiaľ neposiela kód relácie a most odmietne každú požiadavku. Preto sa po aktualizácii pripojte znovu: v Claude Code začnite novú reláciu a Claude Desktop úplne ukončite a znovu spustite.

**Claude Code.** Úryvok konfigurácie sa hodí priamo pre Claude Code. Zadajte tento príkaz v termináli a namiesto `<token>` použite svoj token:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Úryvok môžete tiež vložiť do súboru `.mcp.json` vo vašom priečinku projektu. Potom tento súbor nepridávajte do Gitu, lebo token dáva prístup k vášmu plánu. Server zo súboru `.mcp.json` musí Claude Code schváliť pri prvom použití.

**Claude Desktop.** Pre Claude Desktop je k dispozícii rozšírenie: súbor `open-planner-studio-<version>.mcpb`. Claude Desktop ho nainštaluje dvojklikom. Node.js na to nepotrebujete. Rozšírenie funguje s aplikáciou aj bez nej. Rýchlejšie je s výzvou na začiatku tohto článku; nižšie sú kroky ručne.

1. Stiahnite súbor `.mcpb` z najnovšieho vydania: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dvakrát kliknite na súbor. Claude Desktop sa otvorí a zobrazí rozšírenie *Open Planner Studio*. Nainštalujte ho. Ak dvojklik nefunguje, v Claude Desktop otvorte *Nastavenia › Rozšírenia* a súbor nainštalujte tam.
3. V poli *Pracovný priečinok* vyberte priečinok so súbormi vášho plánu. Claude používa tento priečinok len vtedy, keď je aplikácia zatvorená. Claude potom číta a zapisuje len v tomto priečinku.
4. Zapnite rozšírenie a začnite novú konverzáciu. Opýtajte sa Claude, ktoré nástroje Open Planner Studio vidí.

Token ani port nezadávate: počas behu mosta rozšírenie nájde aplikáciu samo. Pri každej požiadavke od Claude sa rozšírenie rozhodne znovu:

- *Aplikácia je otvorená a most beží*: Claude pracuje v pláne, ktorý je otvorený v aplikácii. Každú zmenu vidíte v aplikácii okamžite.
- *Aplikácia je zatvorená, alebo most je vypnutý*: Claude pracuje na súbore plánu v pracovnom priečinku. Zmena je v súbore až vtedy, keď Claude súbor uloží. Automatické ukladanie neexistuje. Kým je aplikácia otvorená, Claude existujúci súbor neprepíše, ale uloží ho pod novým názvom.

Ak sa aplikácia otvorí alebo zatvorí, kým Claude pracuje, rozšírenie prepne a povie to Claude. Claude potom najprv znovu vyberie alebo otvorí plán a až potom niečo zmení. Ak má Claude ešte neuložené zmeny bez aplikácie, rozšírenie pokračuje bez aplikácie, kým ich Claude neuloží. Tak sa nestratí žiadna zmena. Ak rozšírenie nedosiahne aplikáciu a nie je k dispozícii použiteľný pracovný priečinok, Claude vidí len nástroj `open_planner_studio_status` so správou, ktorá vám povie, čo máte urobiť.

**Claude Desktop bez rozšírenia.** Ak rozšírenie nemôžete použiť, pripojte Claude Desktop externým nástrojom `mcp-remote`. Úryvok konfigurácie sa do Claude Desktop priamo nehodí: v súbore `claude_desktop_config.json` uvediete program, ktorý Claude Desktop spustí sám, nie adresu. `mcp-remote` potrebuje Node.js. V Claude Desktop vyberte *Nastavenia › Vývojár › Upraviť konfiguráciu*, vložte do súboru tento text (s vaším tokenom) a Claude Desktop znovu spustite:

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

Token je v `env` a nie v `args` zámerne: vo Windows Claude Desktop pokazí argument, ktorý obsahuje medzeru. *Vlastný konektor* v Claude (*Prispôsobiť › Konektory*) s mostom nefunguje. Claude sa potom pripája z cloudu Anthropic a ten sa k mostu na vašom počítači nedostane.

V skupine *Pripojenie* je aj pole *Token*. Je to dlhý, náhodný kód, ktorý pre vás vytvorí aplikácia a uloží na tomto počítači. V okne je text *Tento token dáva prístup k otvorenému plánu. Nezdieľajte ho s inými.* Ikonou *Vytvoriť nový token* vytvoríte nový token. Aplikácia sa najprv opýta: *Vytvorenie nového tokenu preruší všetky existujúce pripojenia. Pokračovať?* Ak most beží, reštartuje sa s novým tokenom a starý token už nefunguje.

**Ako rozšírenie nájde aplikáciu.** Keď most beží, stolová aplikácia zapíše port a token do súboru `mcp/runtime.json` v dátovom priečinku aplikácie. Rozšírenie pre Claude Desktop tento súbor číta pri každej požiadavke. Na Linuxe a macOS môže tento súbor čítať len váš používateľský účet. Vo Windows chráni súbor predvolené ACL vášho priečinka profilu; aplikácia to samostatne nekontroluje. Keď most zastavíte alebo vypnete pripojenie MCP, aplikácia súbor odstráni. Aplikácia tiež vedie zoznam otvorených súborov v `mcp/open-files.json`, aj keď je pripojenie MCP vypnuté. Kým tento súbor existuje, rozšírenie a MCP server bez aplikácie neprepíšu žiadny existujúci súbor, ani súbor, ktorý ste práve otvorili a ešte nie je v zozname. Nový súbor je povolený. Čítanie je povolené tiež: Claude potom vidí verziu na disku, bez vašich zmien, ktoré ešte nie sú uložené.

### 4. Pozrite si, čo MCP klient robí

1. Kliknite na *Panel činnosti* v skupine *Činnosť*. V bočnom stĺpci sa otvorí panel *Činnosť MCP*.
2. Každé volanie mosta je na jednom riadku, najnovšie je hore: čas, čo sa stalo, ako dlho to trvalo a či to uspelo. Kliknutím na riadok rozbalíte *Argumenty* a *Odpoveď*.
3. Tlačidlom *Vymazať* vyprázdnite zoznam. Panel uchováva posledných 500 volaní. Kým sa nič nestane, zobrazuje sa: *Zatiaľ žiadna činnosť MCP. Volania mosta sa zobrazia tu.*

Ak je pripojenie MCP zapnuté, v stavovom riadku v pravom dolnom rohu je bodka s *MCP*. Jej farba ukazuje stav mosta a kliknutím na ňu sa dostanete na kartu *MCP*.

### 5. Nastavte obmedzenia

V skupine *Bezpečnosť* sú tlačidlá, ktorými obmedzíte MCP klienta:

- *Pozastaviť*: MCP klient smie dočasne nič nemeniť, čítanie je stále povolené. Most zostane aktívny. Tlačidlo sa zmení na *Obnoviť*.
- *Iba na čítanie*: všetky nástroje, ktoré niečo menia, sa odmietnu, kým je toto zapnuté.
- *Auto-záloha: zapnutá*: pred prvou zmenou od MCP klienta v dokumente zapíše aplikácia zálohu IFC. Predvolené nastavenie je zapnuté. Tlačidlom ju vypnete a potom sa zobrazí *Auto-záloha: vypnutá*. Zálohovanie sa spustí raz na dokument pri každom spustení mosta.
- *Zálohovať teraz*: vytvorí zálohu aktívneho dokumentu hneď. Potom sa zobrazí *Záloha vytvorená:* s názvom súboru.
- *Otvoriť priečinok záloh*: otvorí priečinok so zálohami.

Zálohy sú v priečinku `ai-backups` v dátovom priečinku aplikácie. Aplikácia ponechá nedávne zálohy a staršie postupne redukuje; presne, ako to funguje, je v [Nástroje MCP](docs://ref-ai-tools).

### 6. Zabezpečte, aby MCP klient dobre plánoval

MCP klient dobre plánuje len vtedy, keď pozná pravidlá plánovania. Toto robíte sami:

1. **Pre základné pravidlá nemusíte nič robiť.** Pri pripojení sa prenesú: most ich pošle v poli `instructions` pri úvodnej výmene MCP. To, či ich klient zaradí do svojej systémovej výzvy, závisí od klienta.
2. **Nechajte príručku prečítať.** Výzva na pripojenie z okna *Údaje o pripojení* žiada MCP klienta, aby príručku prečítal nástrojom `planner_get_planning_guide`. Ak výzvu nepoužijete, napíšte klientovi: *Najprv prečítajte plánovaciu príručku pomocou planner_get_planning_guide, skôr než niečo zmeníte.* Príručku si môžete prečítať sami na `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Nepovinné: nainštalujte zručnosti.** Toto funguje len s MCP klientom, ktorý zručnosti podporuje. Uložte `SKILL.md` zručností *goed-plannen* a *progress-update* do `.claude/skills/goed-plannen/SKILL.md` a `.claude/skills/progress-update/SKILL.md` v priečinku projektu, s ktorým MCP klient pracuje, alebo pod `~/.claude/skills/` pre každý projekt.

Súbory získate dvoma spôsobmi. Požiadajte MCP klienta, aby zavolal nástroj `planner_get_planning_guide` s parametrom `part` nastaveným na `skill`: odpoveď obsahuje oba texty a pri každej zručnosti aj miesta, kam patrí. Alebo ich stiahnite z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` a `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ak je *goed-plannen* ešte prítomný zo staršej verzie aplikácie, nahraďte ho: starý text je v holandčine a odkazuje na článok nápovedy namiesto príručky pre MCP klientov.

Či MCP klient príručku naozaj prečítal, vidíte na paneli *Panel činnosti*: vtedy je tam volanie `planner_get_planning_guide`. Konečná odpoveď by mala obsahovať zoznam predpokladov: odhadnuté trvania, zvolené rozdelenie, závislosti, ktoré si vytvoril sám, a každé obmedzenie, ktoré nastavil. Ak tento zoznam chýba, vyžiadajte si ho. Po aktualizácii postupu podľa *progress-update* má odpoveď uviesť dátum kontroly stavu, nový dátum dokončenia a odchýlku oproti pôvodnému plánu.

## Úskalia a čo aplikácia potom urobí

**MCP klient zmenil niečo, čo chcete vziať späť.** Každá zmena od MCP klienta je krok, ktorý vrátite tlačidlom *Vrátiť späť* (Ctrl+Z). Séria zmien, ktorú MCP klient odovzdá ako celok, je jeden krok. Potom sa projekt zobrazí ako neuložený. Po zmene sa plán znovu prepočíta, takže F5 nemusíte stlačiť sami.

**Aplikácia odmietne volanie od MCP klienta.** Keď použijete *Pozastaviť* alebo *Iba na čítanie*, aplikácia odmietne všetky zmeny, čítanie zostáva možné, vrátane prepočítania zastaralého plánu. Ak práve sami upravujete, napríklad ťaháte pruh alebo píšete do poľa, MCP klient dostane dátumy z času pred vašou úpravou s upozornením, že sú zastarané. Ak máte otvorené dialógové okno, napríklad nastavenia, dialóg úlohy alebo uvítacie okno, alebo je zapnutý režim prezentácie, aplikácia odmietne všetky volania vrátane čítania, kým dialóg nezavriete. MCP klient potom dostane chybovú správu s interným názvom toho, čo je otvorené, napríklad `showTaskDialog`. Funguje už len `planner_get_planning_guide`, lebo nečíta váš plán.

**Prepnete na inú kartu, kým MCP klient pracuje.** MCP klient pracuje na dokumente, v ktorom sa uskutočnila jeho prvá zmena. Ak medzitým prepnete kartu, aplikácia odmietne jeho ďalšiu zmenu, kým nepotvrdí, že chce pracovať na inej karte. Tak sa nič nedostane do zlého projektu. Ak MCP klient otvorí alebo duplikuje dokument sám, potom pracuje v tomto novom dokumente.

**MCP klient zapíše alebo otvorí súbor.** MCP klient môže zapísať plán ako súbor IFC a otvoriť súbor plánu ako novú kartu. Môže to robiť len vo vašom používateľskom priečinku. Existujúci súbor prepíše len vtedy, keď to výslovne požiada.

**Stav je *Port 3877 je obsadený*.** Iný program používa port. Pod ním sa zobrazí správa aplikácie. Pole *Port* potom zostane zamknuté (*Upraviteľné len vtedy, keď je server zastavený.*), aj keď most nebeží, a chýba tlačidlo zastavenia. To je známy nedostatok. Kým sa to neopraví: vypnite a znovu zapnite *Povoliť pripojenie MCP*. Stav sa potom vráti na *Vypnuté* a môžete vybrať iný port. Potom znovu skopírujte údaje o pripojení, lebo endpoint obsahuje port.

**Klient sa po novom tokene nemôže pripojiť.** Nový token preruší všetky existujúce pripojenia. Klientovi dajte nový token alebo znovu vložte úryvok konfigurácie. Rozšírenie v Claude Desktop načíta nový token samo; nemusíte tam nič robiť.

**Most ste zastavili sami a sám sa nespustí.** *Spustiť most automaticky* funguje raz pri každom spustení aplikácie. Ak most zastavíte sami, aplikácia ho potichu znovu nezapne.

**Karta *MCP* zmizla.** Pripojenie MCP je vypnuté. Zapnite ho v kroku 1.

**Webová stránka v prehliadači nemôže komunikovať s mostom.** Most odmietne každú požiadavku, ktorá príde z prehliadača, a každú požiadavku bez správneho tokenu.

## Bez aplikácie

Existuje aj server MCP, ktorý funguje bez desktopovej aplikácie: **headless server MCP**. Ponúka rovnaké nástroje `planner_*`, ale pracuje so súborom plánu na disku, nie s vaším otvoreným projektom. Zmeny preto v Gantt diagrame neuvidíte a príkaz *Vrátiť späť* v aplikácii sa na ne nevzťahuje. Použite ho, keď nechcete mať otvorenú aplikáciu, alebo na počítači bez monitora.

Rozšírenie pre Claude Desktop spustí tento server automaticky, keď je aplikácia zatvorená (pozrite krok 3). Kroky nižšie sú určené pre iného klienta MCP, napríklad Claude Code.

Vydanie neobsahuje hotový súbor servera na stiahnutie. Server zostavíte zo zdrojového kódu pomocou `npm run build:mcp-server`; na to potrebujete Node.js 22 alebo novší. Výsledkom je jeden súbor `server.mjs`.

1. Vyberte pracovný priečinok, v ktorom sú vaše súbory plánov. Server číta a zapisuje iba v tomto priečinku.
2. Pripojte svojho klienta MCP. Pre Claude Code je príkaz uvedený pod týmito krokmi.
3. Požiadajte klienta MCP, aby otvoril plán, napríklad `~/plan.ifc`. Na tomto serveri `~` znamená pracovný priečinok.
4. Požiadajte klienta MCP, aby výsledok uložil. Automatické ukladanie neexistuje: klient MCP zapíše súbor pomocou `planner_export_ifc`. Čo klient neuloží, sa stratí po zastavení servera.

Pre krok 2 v Claude Code zadajte tento príkaz v termináli a doplňte svoje vlastné cesty:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Pred prvou zmenou každého dokumentu vytvorí server zálohu MCP, rovnako ako aplikácia. Klient MCP, ktorý zvolí cestu mimo pracovného priečinka, aj cez skratku (symbolický odkaz), dostane odmietnutie. Kým je aplikácia otvorená, server neprepíše existujúci súbor.

## Pozrite aj

- [Poskytovanie spätnej väzby](docs://howto-feedback-geven): ak sa pripojenie chová inak, než je tu opísané, nahláste to.
- [Nástroje MCP](docs://ref-ai-tools): všetky nástroje `planner_*` podľa skupín, chybové kódy a to, ako dlho sa uchovávajú zálohy.
- [Nastavenia aplikácie](docs://ref-instellingen): nastavenia MCP.
