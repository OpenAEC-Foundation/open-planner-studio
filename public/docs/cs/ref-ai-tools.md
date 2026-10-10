# Nástroje AI (planner_*)

Všechny nástroje, které může AI asistent volat přes most, podle skupiny, s tím, co dělají a co odmítají. Všechny začínají na `planner_`. Výzva k připojení v okně *Údaje o připojení* uvádí aktuální číslo a asistent dostane úplný seznam s popisy přímo od mostu (`tools/list`). Proč propojení funguje tak, jak funguje, je v [Jak funguje propojení s AI](docs://uitleg-ai-koppeling). Jak ho zapnete, je v [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Jak číst tento seznam

**Čtení** znamená: nástroj nic nemění. Funguje i tehdy, když je zapnuto *Pozastavit* nebo *Jen pro čtení*. Otevřené dialogové okno ho ale blokuje (viz *Když je nástroj odmítnut* níže). Nástroj pro čtení vždy vrátí aktuální termíny. Když je plán zastaralý, nejdřív ho přepočítá. Dělá to i tehdy, když je zapnuto *Pozastavit* nebo *Jen pro čtení*, protože tyto režimy zadrží změny, ne přepočet při čtení. Když jste uprostřed úpravy (přetahujete pruh, píšete do pole), přepočet neproběhne. Asistent pak dostane termíny z doby před vaší úpravou s upozorněním, že jsou zastaralé. Když je projekt v zobrazení *Termíny podle záznamu*, přepočet neproběhne. Asistent pak dostane zaznamenané termíny s upozorněním, že nebyly přepočítány.

**Změna** znamená: nástroj mění váš projekt. Nástroj odmítne změnu, když je zapnuto *Pozastavit* nebo *Jen pro čtení*, nebo když je otevřené dialogové okno. Totéž platí pro nástroje bez označení níže (`planner_undo`, `planner_redo`, nástroje pro soubory a nástroje pro dokumenty, kromě `planner_list_documents`). Každá změna je jeden krok v historii vrácení. Když se změní data projektu, aplikace plán potom přepočítá sama. Nemusíte stisknout tlačítko *Přepočítat*. Před první změnou v dokumentu zapíše aplikace zálohu, je-li zapnuto *Automatická záloha*.

**Dávka** znamená: jedno volání může obsahovat několik položek. Neplatná položka se odmítne s důvodem a platné položky zůstanou. Odpověď uvádí, které položky byly odmítnuty.

## Čtení: plán

- `planner_get_project_info` (čtení) — údaje o projektu a klíčová čísla: počet úkolů, závislostí, zdrojů a milníků, datum stavu, dokončení projektu a doba trvání, zda je plán zastaralý, profil výpočtu a přehled kalendářů. Vhodné jako první volání.
- `planner_get_project_overview` (čtení) — celý strom WBS v jedné odpovědi: u každého úkolu jeho id, WBS, název, doba trvání, nejdřívější termíny, průběh, zda je kritický, a odchozí závislosti s jejich id.
- `planner_list_tasks` (čtení) — úkoly s filtry (kritické, stav, časové okno, úkoly bez závislostí) a stránkování.
- `planner_get_task` (čtení) — jeden úkol podrobně: termíny, časová rezerva, průběh, omezení, konečný termín, kalendář, přiřazení, předchůdci a následníci, přerušení práce.
- `planner_get_critical_path` (čtení) — kritické úkoly s jejich celkovou časovou rezervou a závislosti, které určují kritickou cestu.
- `planner_list_resources` (čtení) — zdroje s kapacitou, standardní sazbou, kalendářem, posádkou, dostupností a přehledem jejich přiřazení. Pochází-li zdroj z knihovny zdrojů, ukáže, která pole jsou pevná.
- `planner_get_resource_histogram` (čtení) — vytížení oproti kapacitě na zdroj, po dnech, týdnech nebo měsících (výchozí je týden). Bez časového okna a bez zdrojů dá souhrn na zdroj. S časovým oknem nebo se zdroji dá úplnou řadu a úkoly, které způsobují přetížení.
- `planner_get_calendars` (čtení) — všechny kalendáře s celou definicí a počtem úkolů a zdrojů, které je používají.

## Čtení: směrné plány a odchylka

- `planner_list_baselines` (čtení) — uložené směrné plány a který z nich je aktivní.
- `planner_compare_baseline` (čtení) — aktuální plán oproti aktivnímu směrnému plánu: jen úkoly, které se liší, a rozdíl v dokončení projektu v pracovních dnech podle kalendáře projektu. Bez aktivního směrného plánu nástroj odmítne.
- `planner_analyze_delay` (čtení) — analýza zpoždění oproti aktivnímu směrnému plánu: rozdíl v termínu dokončení a kritické úkoly, které se posunuly. Bez aktivního směrného plánu nástroj odmítne.

## Úkoly a struktura

- `planner_add_tasks` (změna, dávka) — vytvoří úkoly, včetně vnořeného WBS v jednom volání. Každý úkol dostane vlastní dočasný název (`tmp-…`), aby podřízený úkol mohl odkázat na nadřazený. Bez doby trvání dostane úkol 5 pracovních dnů. Milník má dobu trvání 0. Všechny úkoly jednoho volání buď uspějí společně, nebo selžou společně.
- `planner_update_tasks` (změna, dávka) — změní pole existujících úkolů: název, popis, dobu trvání s jednotkou (dny nebo hodiny), typ doby trvání, typ úkolu, milník, povinný, prioritu, omezení, konečný termín, kalendář a pravidlo pevné veličiny. Také pole pro průběh: dokončeno %, skutečné zahájení a skutečné dokončení. Jakýkoli jiný klíč se odmítne s důvodem.
- `planner_delete_tasks` (změna) — smaže úkoly včetně celého podstromu, závislostí a přiřazení. Odpověď přesně uvede, co s nimi zmizelo.
- `planner_move_task` (změna) — přesune úkol pod jiný nadřazený úkol, na zadanou pozici. Vznik cyklu nebo zařazení úkolu pod sebe sama se odmítne.
- `planner_set_task_splits` (změna) — nastaví přerušení práce u jednoho úkolu: po kolika pracovních dnech (nebo pracovních hodinách) práce a kolik pracovních dnů (nebo hodin) pauzy. Prázdný seznam zruší všechna přerušení práce. Viz [Rozdělení úkolu](docs://howto-taak-splitsen).

## Závislosti

- `planner_add_dependencies` (změna, dávka) — vytvoří závislosti s typem (`FS`, `SS`, `FF`, `SF` nebo dlouhý tvar) a prodlevou, například `+2d`.
- `planner_update_dependencies` (změna, dávka) — změní typ, prodlevu, předchůdce nebo následníka existující závislosti podle id závislosti. Je to jeden krok, místo smazání a nového vytvoření.
- `planner_remove_dependencies` (změna, dávka) — smaže závislosti podle id závislosti.

## Projekt a kalendáře

- `planner_update_project` (změna) — název, popis, autor, společnost, datum zahájení, datum dokončení, datum stavu, režim průběhu a výchozí pravidlo pevné veličiny pro projekt. Datum zahájení je kotva pro nové úkoly. Pokud je asistent později nastaví, posunou se jen volné úkoly (bez předchůdce a bez omezení, které stanoví spodní mez, například *zahájit nejdříve*). Odpověď uvede jejich počet jako `anchorsClamped`. Zbytek plánu zůstane na místě, viz [Nový projekt a info o projektu](docs://ref-projectinfo). Datum stavu není popisek, ale referenční datum výpočtu: u plánu bez průběhu se všechno posune spolu. Datum dokončení je pouze metadata.
- `planner_move_project` (změna) — přesune celý stávající plán na nové datum zahájení. Kalendáře se nepřesouvají, takže dokončení může skočit o jiný počet dnů než zahájení. Směrné plány zůstanou, pokud je asistent výslovně nepřesune také. Viz [Přesun projektu](docs://howto-project-verplaatsen).
- `planner_update_calendar` (změna, dávka) — změní nebo vytvoří kalendáře: pracovní dny, pracovní hodiny, přestávku, bloky hodin, svátky (vygenerovat pro zemi a region, nebo zadat doslova) a výjimky pracovní doby. Nemůže změnit, který kalendář je kalendářem projektu.

## Zdroje a jednotky přiřazení

- `planner_manage_resources` (změna, dávka) — vytvoří, změní nebo smaže zdroje: název, typ (labor, equipment, material, subcontractor nebo crew), popis, maximální počet jednotek, náklady za hodinu, jednotku, kalendář, posádku a dostupnost v čase. Nástroj odmítne smazat zdroj, který má přiřazení, dokud asistent výslovně nepotvrdí. U zdroje z knihovny zdrojů jsou název, typ, popis, standardní sazba za hodinu a jednotka pevné.
- `planner_manage_assignments` (změna, dávka) — přidá, změní, přesune nebo odebere přiřazení: jednotky za pracovní den, křivku a zbývající práci. Jen u úkolu bez podúkolů a stejný zdroj jen jednou u každého úkolu. Co změna jednotek udělá s dobou trvání, závisí na pravidle pevné veličiny úkolu, viz [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels).
- `planner_level_resources` (změna) — vyrovná přetížení. Ve výchozím nastavení v rámci časové rezervy, takže datum dokončení zůstane. S `constrainToFloat: false` se dokončení může posunout. Při zkušebním běhu dostane asistent nejdřív náhled bez jakékoli změny. Materiálové zdroje přeskočí. Viz [Vyrovnání zdrojů](docs://uitleg-nivelleren).
- `planner_clear_leveling` (změna) — smaže všechna zpoždění vyrovnání.

## Správa směrných plánů

- `planner_save_baseline` (změna) — uloží aktuální plán jako směrný plán a hned ho aktivuje. Zastaralé termíny nejdřív přepočítá. Nedá se použít ve skriptu.
- `planner_activate_baseline` (změna) — nastaví směrný plán jako aktivní, nebo žádný.
- `planner_rename_baseline` (změna) — přejmenuje směrný plán.
- `planner_delete_baseline` (změna) — smaže jeden směrný plán. Byl-li aktivní, stane se aktivním poslední zbývající směrný plán, nebo žádný, pokud žádný nezbyl.

## Vrácení změn

- `planner_undo` a `planner_redo` — vrátí nebo znovu provede jeden krok v aktivním dokumentu. Historie je stejná jako vaše. Odpověď uvede, zda se něco skutečně vrátilo.

## Dokumenty a soubory

- `planner_list_documents` (čtení) — všechny otevřené dokumenty s názvem, zda jsou aktivní a změněné, počtem úkolů, zahájením projektu a vypočteným dokončením.
- `planner_new_document` — nový, prázdný dokument na vlastní kartě, bez okna *Nový projekt*.
- `planner_duplicate_document` — zkopíruje aktivní dokument na novou kartu, pro variantu „co když“ nebo variantu nabídky. Kopie je odpojená a nemá cestu k souboru.
- `planner_switch_document` — nastaví jiný dokument jako aktivní. Je to také způsob, jak potvrdit, na kterém dokumentu asistent pracuje, poté co jste přepnuli karty.
- `planner_import_schedule` — otevře soubor plánu z disku jako dokument: `.ifc`, `.xml` (Primavera P6 nebo MS Project, rozpozná se podle obsahu), `.csv`, `.xer` a `.mpp` (MS Project 2010 až 2021). Nic se nesloučí s aktuálním plánem. CSV nemá kalendář, takže se termíny mohou posunout. Jen uvnitř vaší uživatelské složky. Po importu CSV, XML nebo `.mpp` nemá dokument cíl pro uložení. Jen IFC převezme cestu k souboru.
- `planner_export_ifc` — zapíše aktivní dokument jako soubor IFC 4.3. Jen uvnitř vaší uživatelské složky. Existující soubor se přepíše jen na výslovnou žádost. Projekt zůstane neuložený.

## Průvodce a původ zdrojů

- `planner_get_planning_guide` (čtení) — anglický průvodce pro asistenty (zásady [Dobré plánování](docs://gids-goed-plannen) s nástroji pro každou zásadu), dvě dovednosti *goed-plannen* (sestavení plánu) a *progress-update* (aktualizace průběhu), nebo vše. Vyberte pomocí `part`: `guide`, `skill` (obě dovednosti) nebo `both`; výchozí je `both`. Pro každou dovednost vrátí místa, kam patří, a adresy ke stažení. Parametr `language` se stále přijímá kvůli starším asistentům, ale text je vždy v angličtině. Plán nijak nemění.
- `planner_inspect_xer_provenance` (čtení) — zkontroluje zachovaný význam zdrojových dat otevřeného souboru Primavera P6 (`.xer`): co soubor obsahoval, s počty importu a diagnostiky. Volná textová pole ze souboru zůstanou ve výchozím nastavení neviditelná. Asistent je musí výslovně vyžádat. Nedá se použít ve skriptu.

## Skript

- `planner_batch` — spustí skript o nejvýše 100 krocích jako jednu změnu: jeden krok vrácení, jeden přepočet, jedna záloha. Selže-li krok strukturálně, celý skript se vrátí zpět. Odpověď uvede u každého kroku, co proběhlo, co selhalo a co se nedostalo na řadu. Dočasné názvy (`tmp-…`) z `planner_add_tasks` platí v pozdějších krocích. Jako krok nejsou povoleny: samotný `planner_batch`, vrácení a znovu provedení, nástroje pro dokumenty a soubory, `planner_save_baseline`, `planner_get_planning_guide` a `planner_inspect_xer_provenance`. Skript není programovací jazyk: nejsou v něm proměnné, podmínky ani smyčky.

## Když je nástroj odmítnut

Asistent pak dostane odpověď s chybovým kódem a vysvětlením.

- `PAUSED` — *Pozastavit* je zapnuto.
- `READ_ONLY` — *Jen pro čtení* je zapnuto.
- `DIALOG_OPEN` — je otevřené dialogové okno. To platí i pro čtení, kromě `planner_get_planning_guide`. Odpověď uvede, co je otevřené, podle interního názvu, například `showTaskDialog`.
- `DOC_DRIFT` — přepnuli jste karty, zatímco asistent pracoval. Musí potvrdit pomocí `planner_switch_document`, na kterém dokumentu pracuje.
- `VALIDATION` — argumenty neodpovídají schématu, nebo požadovaná změna není povolena. Odpověď uvede pole.
- `NOT_FOUND` — id nebo dokument neexistuje.
- `CYCLE` — změna by vytvořila cyklus. Vše v tomto volání se vrátí zpět.
- `SCOPE` — cesta k souboru leží mimo vaši uživatelskou složku.
- `BACKUP_FAILED` — záloha před změnou selhala; změna se neprovedla.
- `INTERNAL` — neočekávaná chyba při běhu nástroje, například neúspěšná operace se souborem. Odpověď uvede původní chybové hlášení.
- `STALE_PRECONDITION` — je součástí rozhraní mostu, ale žádný současný nástroj tento kód nevrací.

Požadavek, který čekal ve frontě déle než 110 sekund, aplikace už neprovede. Klient totiž už dostal časový limit, a kdyby ho aplikace provedla, opakované volání by věci změnilo dvakrát. Volání, které trvá déle než 120 sekund, dostane časový limit od mostu.

## Co asistent nemůže nastavit

U úkolu asistent nemůže nastavit: překlenovací úkol, ručně plánováno, druhé omezení, poznámky, barvu, kódy aktivit, vlastní pole, vazby mezi projekty a zpoždění vyrovnání ručně. Kód WBS vypočítá aplikace sama. Na úrovni projektu nemůže změnit profil výpočtu ani možnosti výpočtu. Nastavení, motiv, jazyk, rozšíření a aktualizace jsou mimo dosah, stejně jako knihovna zdrojů. Nemá ani sestavy, rozložení, filtry nebo zobrazení. Proč tomu tak je, je popsáno v [Jak funguje propojení s AI](docs://uitleg-ai-koppeling).

## Co aplikace ukládá

- **Token** je na tomto počítači, v uložených nastaveních aplikace. Má 64 znaků a je náhodný. *Nový token* ho nahradí.
- **Port** je ve výchozím nastavení 3877 a změnit jej lze jen tehdy, když je most zastavený.
- **Panel aktivity** uchovává posledních 500 volání, jen dokud je aplikace otevřená. Argumenty a odpovědi se u každého pole ořežou po 20 kB. *Vymazat* seznam vyprázdní.
- **Zálohy** jsou ve složce `ai-backups` v datové složce aplikace. *Otevřít složku záloh* vás tam přenese. Jmenují se `<project name>-<timestamp>.ifc`. Uložený soubor projektu má jednu složku pro všechna sezení. Dokument, který jste nikdy neuložili, má pro každé sezení vlastní složku. Při každém spuštění mostu vznikne jedna záloha na dokument, k tomu zálohy, které si sami vytvoříte pomocí tlačítka *Zálohovat nyní*.
- **Prořeďování** probíhá samo, po složkách. Ze záloh posledních 7 dnů zůstanou všechny, nejvýše 20. Cokoli, co vytvořilo běžící sezení, zůstane vždy. Potom zůstane jedna záloha za týden u záloh do 30 dnů stáří, jedna za měsíc u záloh do jednoho roku, a potom jedna za rok. Zálohy dokumentu, který jste nikdy neuložili, zmizí po roce úplně. Soubory ve složce, které nepatří aplikaci, zůstanou nedotčené.

## Viz také

- [Jak funguje propojení s AI](docs://uitleg-ai-koppeling): proč je most nastavený tak, jak je, a co smí asistent dělat a co nesmí.
- [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): spustit most, připojit se a nainstalovat dovednost.
- [Nastavení](docs://ref-instellingen): dva přepínače AI.
- [Oznámení a varování](docs://ref-meldingen): tečka AI ve stavovém řádku.
