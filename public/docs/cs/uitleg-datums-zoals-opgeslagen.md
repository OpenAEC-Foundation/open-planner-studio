# Data tak, jak byla uložena

Když otevřete plán z Primavery nebo MS Project, liší se data od toho, co jste viděli v tom programu. Selhal import? Obvykle ne. V tomto článku se dozvíte, proč aplikace přepočítává sama. Dozvíte se také, kdy zobrazí data ze souboru, co tehdy zůstane prázdné a jak se vrátíte k vlastnímu výpočtu. Příklad na konci sleduje dva úkoly celým cyklem.

## Pojem

Soubor plánu obsahuje dva druhy dat. Za prvé logiku: úkoly, doby trvání, závislosti, kalendáře a omezení. Za druhé data, která z ní program sám vypočítal. Při otevření používá Open Planner Studio logiku a vypočítává sám. Data v souboru proto nejsou vstupní údaje.

Když výpočet aplikace skončí na jiných datech, než uvádí soubor, nevíte, která strana má pravdu. Soubor může postrádat logiku, kterou program použil. Program může v některém bodě vypočítávat jinak než aplikace. Proto aplikace umí zobrazit data **tak, jak byla uložena**: data, která druhý program zapsal do souboru. Porovnáte tak s tím, co jste viděli v tom programu.

## Jak s tím aplikace pracuje

### Který profil výpočtu aplikace používá

Aplikace vypočítává podle **profilu výpočtu**: sadou pravidel výpočtu (konvencí), která určuje mimo jiné, jak se zachází s plánovaným začátkem úkolu a s omezeními. Viz [Profily výpočtu a konvence](docs://uitleg-rekenprofielen). Existují tři vestavěné profily: *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Soubor `.xer` se otevře s profilem *Primavera P6* a soubor `.mpp` s profilem *Microsoft Project*. CSV, MS Project XML a Primavera P6 XML se otevřou s profilem *Open Planner Studio*. Profil projektu najdete na kartě *Soubor › Info o projektu* v poli *Profil výpočtu a možnosti výpočtu*. IFC soubor z aplikace si svůj profil ponechá.

### Kdy aplikace porovnává

Při otevření aplikace zaznamená, co soubor uváděl, a porovná to se svým vlastním výsledkem. Dělá to u:

- soubor Primavery (`.xer`) a Primavera P6 XML;
- MS Project XML a soubory MS Project (`.mpp`);
- IFC soubor z jiného programu, u úkolů, jejichž nejdřívější data jsou v souboru;
- IFC soubor z aplikace samotné, který si zapamatoval svůj původ. Níže se dozvíte, kdy to tak je.

Aplikace nikdy neporovnává soubor CSV: datum začátku v CSV je vstupní údaj, ne výsledek výpočtu. IFC soubor z aplikace bez zapamatovaného původu se také neporovnává.

Když se žádný úkol neliší, nic nepoznáte. Když se alespoň jeden úkol liší v souboru, který právě importujete, aplikace zobrazení okamžitě zapne.

U souboru Primavery vypočítává aplikace podle profilu výpočtu *Primavera P6*. Ten ponechá plánovaný začátek ze souboru jako nejdřívější zahájení. Úkol, který je v souboru později, než vyžadují závislosti, ale je tam také naplánován, proto zůstane, kde je. Potom žádný rozdíl není.

### Co vidíte

Pod pásem karet je lišta: *Vidíte data tak, jak jsou uložena v souboru; při přepočítání se odchýlí 4 úkoly.* Při zdroji Primavery (`.xer` nebo Primavera P6 XML) říká *Vidíte plán tak, jak ho Primavera uložila; při přepočítání se odchýlí 1 úkol.* Vpravo na liště je tlačítko *Přepočítat*. Lišta nemá křížek.

Zobrazí se také hlášení: *4 úkoly zobrazují data tak, jak jsou uložena v souboru (bez přepočtu).* Jen u `.xer` zní: *1 úkol zobrazuje data tak, jak je Primavera uložila (bez přepočtu).* Každý úkol, pro který soubor zapsal data, ukazuje značku v panelu *Vlastnosti*: *Zobrazuje vlastní uložená data Primavery pro tento úkol* u zdroje Primavery, nebo *Zobrazuje data tak, jak jsou pro tento úkol uložena v souboru* u jiného zdroje. Gantt, tabulka úkolů a stavový řádek zobrazují data ze souboru.

### Co v tomto zobrazení zůstane prázdné

V tomto zobrazení aplikace nic nevypočítává. Ukazuje jen to, co soubor zapsal. Časovou rezervu a kritickou cestu tedy uvidíte jen tehdy, když je soubor obsahuje. Když soubor neuvádí žádné kritické úkoly, stavový řádek ukáže 0 kritických úkolů. To nic neříká o kritické cestě v samotném programu. Co vzniká jen výpočtem, v tomto zobrazení neexistuje: které závislosti řídí plán, porušená omezení, úkoly v nesprávném pořadí a téměř kritické úkoly.

Když soubor pro úkol nezapíše všechno, uvidíte v panelu *Vlastnosti* značku *Záznam je částečně neúplný – viz sloupce pozdní zahájení, pozdní dokončení a časová rezerva*. Při exportu do CSV zůstanou u takového úkolu sloupce *Kritický* a *Celková časová rezerva* prázdné, místo vymyšlené nuly.

### Opuštění zobrazení

Zobrazení opustíte dvěma způsoby:

- Klikněte na tlačítko *Přepočítat* v liště, nebo zvolte *Přepočítat* (F5). Aplikace vypočítává podle vlastních pravidel.
- Změňte něco, co může změnit data, například dobu trvání úkolu nebo nový úkol. Aplikace zobrazení opustí a přepočítá hned, i když je vypnuto *Automaticky přepočítat*. Změna názvu to nedělá: zobrazení zůstane zapnuté.

Po opuštění není žádné tlačítko, kterým se zobrazení znovu zapne. Ctrl+Z zobrazení obnoví, hned po přepočítání nebo hned po takové úpravě. Jinak můžete zdrojový soubor znovu otevřít. U `.xer` znovu zapne zobrazení také otevření IFC souboru, který jste uložili po přepočítání, ale neupravili.

### Zotavení systému po chybě

Když obnovíte projekt po chybě, při které bylo zapnuté zobrazení, zobrazení zůstane zapnuté. Aktivní projekt ukazuje stejnou lištu jako dříve. Projekt na jiné kartě ukazuje lištu bez čísla: *Vidíte data tak, jak jsou uložena v souboru. Nic nebylo přepočítáno.* Viz [Obnovení po chybě systému](docs://howto-herstellen-na-een-crash).

### Uložení a opětovné otevření

Když uložíte, zatímco používáte zobrazení, aplikace zapíše zobrazená data do IFC souboru spolu se zdrojovým formátem. Když ten IFC soubor později znovu otevřete a od importu jste ho neupravili, zobrazení je zase zapnuté, bez nového hlášení.

Když jste mezitím upravili a uložili, záleží to na zdroji. U souboru Primavery IFC soubor ponechá původní `.xer`. Aplikace pak znovu porovná a nabídne zobrazení: *Přepočítání posunulo 1 úkol z 2 oproti datům v souboru.* Součástí je tlačítko *Zobrazit uložená data* a křížek. U každého odchylného úkolu ukazuje panel *Vlastnosti* značku *Liší se od uložených dat*. *Zobrazit uložená data* zapne zobrazení; Ctrl+Z to vrátí zpět. Křížek nabídku skryje.

U MS Project XML, `.mpp`, Primavera P6 XML nebo IFC souboru z jiného programu IFC soubor zdroj neuchová. Když takový projekt upravíte a uložíte, aplikace při novém otevření už neporovnává.

## Příklad: přístavba

Předpokládejme, že otevřete soubor Primavery *Uitbouw* (přístavba) se dvěma úkoly v kalendáři bez svátků. V roce 2027 připadá 6. května na Nanebevstoupení a 17. května na Svatodušní pondělí. Když kalendář obsahuje svátky, vyjdou data jinak. *Fundering storten* (lití základů) trvá 5 pracovních dnů, *Metselwerk* (zdivo) 10 pracovních dnů a Metselwerk následuje po Fundering se závislostí dokončení-zahájení. Soubor zapisuje, že Fundering běží od pondělí 3. května do pátku 7. května 2027 a Metselwerk od pondělí 17. května do pátku 28. května 2027: o týden později, než je nejdřívější zahájení, které závislost dovoluje. Plánovaný začátek Metselwerk v souboru je pondělí 10. května 2027.

Hned po otevření vidíte data ze souboru. Stavový řádek ukazuje *Dokončení: 28-05-2027* a *Kritická cesta: 2 úkoly, 20 pracovních dnů*. Lišta hlásí, že při přepočítání se odchýlí 1 úkol, a oba úkoly ukazují *Zobrazuje vlastní uložená data Primavery pro tento úkol*.

Po kliknutí na tlačítko *Přepočítat* zůstane Fundering na 3. až 7. května. Metselwerk teď začíná v pondělí 10. května, první pracovní den po skončení Fundering, a končí v pátek 21. května. Plán končí 21. května 2027 a trvá 15 pracovních dnů místo 20. Kritickou cestu tvoří stejné 2 úkoly.

Co když je to jinak?

- Když je Metselwerk v souboru také naplánován na pondělí 17. května, profil výpočtu *Primavera P6* ponechá ten začátek. Výpočet vyjde na 17. až 28. května, žádný rozdíl není a zobrazení se nezapne.
- Přidáte úkol v zobrazení: stejné přepočítání. Metselwerk se posune na 10. až 21. května.
- Uložíte v zobrazení a IFC soubor znovu otevřete bez úprav: Metselwerk je zpět na 17. až 28. května.
- Přepočítáte, uložíte bez dalších úprav a IFC soubor znovu otevřete: zobrazení je zase zapnuté a Metselwerk je na 17. až 28. května.
- Upravíte, uložíte a znovu otevřete: aplikace nabídne zobrazení s hlášením *Přepočítání posunulo 1 úkol z 2 oproti datům v souboru.* Metselwerk ukazuje *Liší se od uložených dat*.

## Důsledky a nedorozumění

**Rozdíl není chyba importu.** Aplikace vypočítává podle vlastních pravidel: u `.xer` s profilem výpočtu *Primavera P6*, u `.mpp` s *Microsoft Project*, u CSV, MS Project XML a Primavera P6 XML s *Open Planner Studio*. Důvod, proč data ve zdrojovém programu vyšla jinak, může být v souboru nebo v programu. Zobrazení vám ukáže, *že* se liší.

**Zobrazení není výsledek výpočtu.** Aplikace data nevypočítala. Nepřebírejte je jednoduše jako výsledek vlastního plánu.

**Uložení v zobrazení zachová data zdrojového programu.** IFC soubor pak obsahuje to, co zdrojový program uváděl, ne to, co by aplikace vypočetla.

**Tlačítko *Zobrazit uložená data* se neobjeví při každém importu.** U nově otevřeného souboru je zobrazení už zapnuté. Tlačítko se objeví jen u znovu otevřeného IFC souboru se zdrojem Primavery, který jste od importu upravili.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): co aplikace ukládá do souboru a co nese import nebo export.
- [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen): postup a hlášení pro soubor `.xer`.
- [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen): postup a hlášení pro soubor `.mpp`.
- [Obnovení po chybě systému](docs://howto-herstellen-na-een-crash): co se s tímto projektem stane po chybě.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak aplikace vypočítává časovou rezervu a kritičnost, když vypočítává.
