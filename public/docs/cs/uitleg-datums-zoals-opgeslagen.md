# Data tak, jak byla uložena

Když otevřete plán z Primavery nebo MS Project, liší se data od toho, co jste viděli v tom programu. Selhal import? Obvykle ne. V tomto článku se dozvíte, proč aplikace přepočítává sama. Dozvíte se také, kdy zobrazí data ze souboru, co tehdy zůstane prázdné a jak se vrátíte k vlastnímu výpočtu. Příklad na konci sleduje dva úkoly celým cyklem.

## Pojem

Soubor plánu obsahuje dva druhy dat. Za prvé logiku: úkoly, doby trvání, závislosti, kalendáře a omezení. Za druhé data, která z ní program sám vypočítal. Při otevření používá Open Planner Studio logiku a vypočítává sám. Data v souboru proto nejsou vstupní údaje.

Když výpočet aplikace skončí na jiných datech, než uvádí soubor, nevíte, která strana má pravdu. Soubor může postrádat logiku, kterou program použil. Program může v některém bodě vypočítávat jinak než aplikace. Proto aplikace umí zobrazit data **tak, jak byla uložena**: data, která druhý program zapsal do souboru. Porovnáte tak s tím, co jste viděli v tom programu.

## Jak s tím aplikace pracuje

### Který profil výpočtu aplikace používá

Aplikace vypočítává podle **profilu výpočtu**: sady pravidel výpočtu (konvencí), která určuje mimo jiné, jak se zachází s plánovaným začátkem úkolu a s omezeními. Viz [Profily výpočtu a konvence](docs://uitleg-rekenprofielen). Existují tři vestavěné profily: *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Soubor `.xer` se otevře s profilem *Primavera P6* a soubor `.mpp` s profilem *Microsoft Project*. CSV, MS Project XML a Primavera P6 XML se otevřou s profilem *Open Planner Studio*. Profil projektu najdete na kartě *Soubor › Nastavení projektu* v poli *Profil výpočtu a možnosti výpočtu*. IFC soubor z aplikace si svůj profil ponechá.

### Kdy aplikace porovnává

Při otevření zaznamená aplikace, co soubor uváděl, a porovná to se svým vlastním výsledkem. Dělá to u:

- soubor Primavery (`.xer`) a Primavera P6 XML;
- MS Project XML a soubory MS Project (`.mpp`);
- IFC soubor z jiného programu, u úkolů, jejichž nejdřívější data jsou v souboru;
- IFC soubor z aplikace samotné, který si zapamatoval svůj původ. Níže se dozvíte, kdy to tak je.

Aplikace nikdy neporovnává soubor CSV: datum začátku v CSV je vstupní údaj, ne výsledek výpočtu. IFC soubor z aplikace bez zapamatovaného původu se také neporovnává.

Když se žádný úkol neliší, nic nepoznáte. Když se alespoň jeden úkol liší v souboru, který právě importujete, aplikace zobrazení okamžitě zapne.

U souboru Primavery vypočítává aplikace podle profilu výpočtu *Primavera P6*. Ten ponechá plánovaný začátek ze souboru jako nejdřívější zahájení. Úkol, který je v souboru později, než vyžadují závislosti, ale je tam také naplánován, proto zůstane, kde je. Potom žádný rozdíl není.

### Co vidíte

Pod pásem karet je lišta: *Vidíte data tak, jak jsou uložena v souboru; při přepočítání se odchýlí 4 úkoly.* Při zdroji Primavery (`.xer` nebo Primavera P6 XML) říká *Vidíte plán tak, jak ho Primavera uložila; při přepočítání se odchýlí 1 úkol.* Vpravo na liště je tlačítko *Přepočítat*. Lišta nemá křížek.

Zobrazí se také hlášení: *12 úkolů zobrazuje data tak, jak jsou uložena v souboru (bez přepočtu).* Jen u `.xer` zní: *12 úkolů zobrazuje data tak, jak je Primavera uložila (bez přepočtu).* Toto číslo počítá každý úkol, pro který soubor zapsal data, včetně úkolů, které se neliší. Počet úkolů, které se po přepočítání liší, je v liště. Každý úkol, pro který soubor zapsal data, ukazuje oranžový blok v panelu *Vlastnosti*, přímo nad *Zahájení*: *Vidíte data, která uložila Primavera, nikoli výpočet aplikace.* U jiného zdroje zní: *Vidíte data, která byla v souboru, nikoli výpočet aplikace.* Druhý řádek říká, co se s tímto úkolem stane při přepočítání: *Při přepočítání se tento úkol změní.* nebo *Při přepočítání zůstane tento úkol beze změny.* Gantt, tabulka úkolů a stavový řádek zobrazují data ze souboru.

### Úkoly, které začaly nebo jsou hotové

Hotový úkol leží na dnech, kdy se skutečně odehrál: od skutečného zahájení po skutečné dokončení. Úkol, který probíhá, začíná v den, kdy skutečně začal. Dokončí se podle výpočtu. To platí v tomto zobrazení, po přepočítání i u každého profilu výpočtu, stejně jako v Primavěře a v MS Projectu.

U takového úkolu soubor často zapisuje jiná nejdřívější data. Primavera nastaví nejdřívější zahájení úkolu, který probíhá nebo je hotový, na datum stavu. Ta data vidíte ve sloupcích *Nejdřívější zahájení* a *Nejdřívější dokončení*, ne v *Zahájení* a *Dokončení*. Hotový úkol proto nikdy nepočítá jako rozdíl. Úkol, který probíhá, se počítá jen tehdy, když se liší jeho dokončení.

U úkolu, který už začal, nejde zahájení přepsat. V tabulce úkolů, v panelu *Vlastnosti* a v okně *Upravit úkol* je zahájení jen pro čtení. U hotového úkolu platí to samé i pro dokončení v tabulce úkolů. Změňte místo toho pole *Skutečné zahájení* nebo *Skutečné dokončení* pomocí průběhu. V Ganttu se pruh takového úkolu nepohne; zobrazí se hlášení.

### Co v tomto zobrazení zůstane prázdné

V tomto zobrazení aplikace nic nevypočítává. Ukazuje jen to, co soubor zapsal. Časovou rezervu a kritickou cestu tedy uvidíte jen tehdy, když je soubor obsahuje. Když soubor neuvádí žádné kritické úkoly, stavový řádek ukáže 0 kritických úkolů. To nic neříká o kritické cestě v samotném zdrojovém programu. Co vzniká jen výpočtem, v tomto zobrazení neexistuje: které závislosti řídí plán, porušená omezení, úkoly v nesprávném pořadí a téměř kritické úkoly.

Když soubor pro úkol nezapíše všechno, přidá se u oranžového bloku v panelu *Vlastnosti* třetí řádek, například *Primavera pro tento úkol neuložila všechny údaje. Chybí: volná časová rezerva.* U jiného zdroje zní: *Soubor pro tento úkol neobsahuje všechno.* První dva řádky zůstávají: u takového úkolu tedy také vidíte, že data pocházejí ze souboru, a zda se úkol změní při přepočítání. Chybějící hodnoty mají stejné názvy jako sloupce v tabulce úkolů. V exportu do CSV zůstanou u takového úkolu sloupce *Kritický* a *Celková časová rezerva* prázdné, místo vymyšlené nuly.

### Opuštění zobrazení

Zobrazení opustíte dvěma způsoby:

- Klikněte na tlačítko *Přepočítat* v liště, nebo zvolte *Přepočítat* (F5). Aplikace vypočítává podle vlastních pravidel.
- Změňte něco, co může změnit data, například dobu trvání úkolu nebo nový úkol. Aplikace zobrazení opustí a přepočítá hned, i když je vypnuto *Automaticky přepočítat*. Změna názvu, popisu, druhu práce nebo typu úkolu to nedělá: zobrazení zůstane zapnuté.

Změna kalendáře z knihovny zdrojů nechá zobrazení zapnuté a data ze souboru beze změny, ale aktualizuje číslo v liště.

Po opuštění není žádné tlačítko, kterým se zobrazení znovu zapne. Ctrl+Z zobrazení obnoví, hned po přepočítání nebo hned po takové úpravě. Jinak můžete zdrojový soubor znovu otevřít. U `.xer` zapne zobrazení znovu také otevření IFC souboru, který jste uložili po přepočítání, ale neupravili.

### Zotavení systému po chybě

Když obnovíte projekt po chybě, při které bylo zobrazení zapnuté, zobrazení zůstane zapnuté. Když zobrazení zapnuté nebylo, aplikace data ze souboru zapomene. Aktivní projekt ukazuje stejnou lištu jako dříve. Projekt na jiné kartě ukazuje lištu bez čísla: *Vidíte data tak, jak jsou uložena v souboru. Nic nebylo přepočítáno.* Viz [Obnovení po chybě systému](docs://howto-herstellen-na-een-crash).

### Uložení a opětovné otevření

Když uložíte, zatímco používáte zobrazení, aplikace zapíše zobrazená data do IFC souboru spolu se zdrojovým formátem. Když ten IFC soubor později znovu otevřete, zobrazení je zase zapnuté, bez nového hlášení. To platí i tehdy, když jste v zobrazení změnili něco, co data neovlivní, například název. Aplikace otevře soubor tak, jak jste ho nechali.

Když uložíte po opuštění zobrazení, ať už přepočtem nebo úpravou, která může změnit data, obsahuje soubor vlastní výpočet aplikace. Při novém otevření vidíte tento výpočet, bez lišty a bez oranžového bloku v panelu *Vlastnosti*. Jedna výjimka existuje: `.xer`, který jste jen přepočítali a neupravili (viz výše). Váš upravený plán platí nyní; staré údaje ze zdrojového programu k němu už nepatří. Chcete-li je ještě vidět, otevřete znovu zdrojový soubor.

## Příklad: přístavba

Předpokládejme, že otevřete soubor Primavery *Uitbouw* (přístavba) se dvěma úkoly v kalendáři bez svátků. V roce 2027 připadá 6. května na Nanebevstoupení a 17. května na Svatodušní pondělí. Když kalendář obsahuje svátky, vyjdou data jinak. *Fundering storten* (lití základů) trvá 5 pracovních dnů, *Metselwerk* (zdivo) 10 pracovních dnů a Metselwerk následuje po Fundering se závislostí dokončení-zahájení. Soubor zapisuje, že Fundering běží od pondělí 3. května do pátku 7. května 2027 a Metselwerk od pondělí 17. května do pátku 28. května 2027: o týden později, než je nejdřívější zahájení, které závislost dovoluje. Plánovaný začátek Metselwerk v souboru je pondělí 10. května 2027.

Hned po otevření vidíte data ze souboru. Stavový řádek ukazuje *Dokončení: 28-05-2027* a *Kritická cesta: 2 úkoly, 20 pracovních dnů*. Lišta hlásí, že při přepočítání se odchýlí 1 úkol. Oba úkoly ukazují oranžový blok *Vidíte data, která uložila Primavera, nikoli výpočet aplikace.* Pod ním Metselwerk říká *Při přepočítání se tento úkol změní.* a Fundering říká *Při přepočítání zůstane tento úkol beze změny.*

Po kliknutí na *Přepočítat* zůstane Fundering na 3. až 7. května. Metselwerk teď začíná v pondělí 10. května, první pracovní den po skončení Fundering, a končí v pátek 21. května. Plán končí 21. května 2027 a trvá 15 pracovních dnů místo 20. Kritickou cestu tvoří stejné 2 úkoly.

Co když je to jinak?

- Když je Metselwerk v souboru naplánován také na pondělí 17. května, profil výpočtu *Primavera P6* ten začátek ponechá. Výpočet vyjde na 17. až 28. května, žádný rozdíl není a zobrazení se nezapne.
- Přidáte úkol v zobrazení: stejné přepočítání. Metselwerk se posune na 10. až 21. května.
- Uložíte v zobrazení a IFC soubor znovu otevřete bez úprav: Metselwerk je zpět na 17. až 28. května.
- Přepočítáte, uložíte bez dalších úprav a IFC soubor znovu otevřete: zobrazení je zase zapnuté a Metselwerk je na 17. až 28. května.
- Změníte jen název Metselwerk v zobrazení, uložíte a znovu otevřete: zobrazení je zase zapnuté a Metselwerk je na 17. až 28. května.
- Přidáte úkol v zobrazení, uložíte a znovu otevřete: aplikace data ze souboru zapomene. Metselwerk je na 10. až 21. května, bez lišty a bez bloku.
- Fundering je v souboru už hotový: skutečně začal 3. května a skutečně se dokončil 7. května. Soubor zapisuje datum stavu jako jeho nejdřívější zahájení. Pruh úkolu Fundering zůstává na 3. až 7. května, v zobrazení i po přepočítání. Fundering se nepočítá jako rozdíl.

## Důsledky a nedorozumění

**Rozdíl není chyba importu.** Aplikace vypočítává podle vlastních pravidel: u `.xer` s profilem výpočtu *Primavera P6*, u `.mpp` s *Microsoft Project*, u CSV, MS Project XML a Primavera P6 XML s *Open Planner Studio*. Důvod, proč data ve zdrojovém programu vyšla jinak, může být v souboru nebo ve zdrojovém programu. Zobrazení vám ukáže, *že* se liší.

**Zobrazení není výsledek výpočtu.** Aplikace data nevypočítala. Nepřebírejte je jednoduše jako výsledek vlastního plánu.

**Uložení v zobrazení zachová data zdrojového programu.** IFC soubor pak obsahuje to, co zdrojový program uváděl, ne to, co by aplikace vypočítala.

**Po úpravě, která může změnit data, se data ze souboru nevrátí.** Když jste zobrazení opustili takovou úpravou, uvidíte vlastní výpočet aplikace až po uložení a novém otevření. Změna názvu se nepočítá: zobrazení pak zůstane zapnuté (viz *Uložení a opětovné otevření*). Chcete-li vidět data ze zdrojového programu, otevřete znovu zdrojový soubor.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): co aplikace ukládá do souboru a co nese import nebo export.
- [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen): postup a hlášení pro soubor `.xer`.
- [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen): postup a hlášení pro soubor `.mpp`.
- [Obnovení po chybě systému](docs://howto-herstellen-na-een-crash): co se s tímto projektem stane po chybě.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak aplikace vypočítává časovou rezervu a kritičnost, když vypočítává.
