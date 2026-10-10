# Nástroje AI (planner_*)

Všetky nástroje, ktoré môže AI asistent volať cez most, podľa skupín. Uvádzame, čo robia a čo odmietajú. Všetky začínajú na `planner_`. Výzva na pripojenie v okne *Údaje o pripojení* ukazuje súčasné číslo. Asistent dostane úplný zoznam s popismi priamo z mosta (`tools/list`). Prečo pripojenie funguje tak, ako funguje, je v [Ako funguje pripojenie AI](docs://uitleg-ai-koppeling). Ako ho zapnete, je v [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Ako čítať tento zoznam

**Čítanie** znamená: nástroj nič nemení. Funguje to aj počas režimu *Pozastaviť* a režimu *Iba na čítanie*. Otvorený dialóg čítanie blokuje (pozrite *Keď je nástroj odmietnutý* nižšie). Nástroj na čítanie vždy vracia súčasné dátumy. Ak je plán zastaraný, najskôr sa prepočíta, aj počas režimu *Pozastaviť* a režimu *Iba na čítanie*. Tieto režimy blokujú zmeny, nie prepočet pri čítaní. Ak ste uprostred úpravy (presúvate pruh, píšete do poľa), prepočet sa nespustí. Asistent potom dostane dátumy z času pred vašou úpravou, s upozornením, že sú zastarané. Ak je projekt v zobrazení *Zaznamenané dátumy*, prepočet sa nespustí. Asistent potom dostane zaznamenané dátumy s upozornením, že neboli prepočítané.

**Zmena** znamená: nástroj mení váš projekt. Nástroj je odmietnutý počas režimu *Pozastaviť*, režimu *Iba na čítanie* a pri otvorenom dialógu. Platí to aj pre nástroje bez označenia nižšie (`planner_undo`, `planner_redo`, nástroje pre súbory a dokumenty okrem `planner_list_documents`). Každá zmena je jeden krok vo vašej histórii. Ak sa menia údaje projektu, aplikácia po nej sama prepočíta plán. Nemusíte stlačiť *Prepočítať*. Pred prvou zmenou v každom dokumente zapíše aplikácia zálohu, ak je zapnutá *Automatická záloha*.

**Hromadné** znamená: jedno volanie môže obsahovať viac položiek. Neplatná položka je odmietnutá s dôvodom. Platné položky zostanú. Odpoveď uvádza odmietnuté položky.

## Čítanie: plán

- `planner_get_project_info` (čítanie) — podrobnosti o projekte a kľúčové údaje: počet úloh, závislostí, zdrojov a medzníkov, dátum kontroly stavu, dokončenie projektu a trvanie, či je plán zastaraný, profil výpočtu a prehľad kalendárov. Dobré prvé volanie.
- `planner_get_project_overview` (čítanie) — celý strom WBS v jednej odpovedi: pre každú úlohu id, WBS, názov, trvanie, skoré dátumy, postup, či je kritická, a odchádzajúce závislosti s ich id závislosti.
- `planner_list_tasks` (čítanie) — úlohy s filtrami (kritické, stav, časové okno, úlohy bez závislostí) a stránkovanie.
- `planner_get_task` (čítanie) — jedna úloha podrobne: dátumy, časová rezerva, postup, obmedzenia, termín, kalendár, priradenia, predchádzajúce úlohy a nasledujúce úlohy, prestávky.
- `planner_get_critical_path` (čítanie) — kritické úlohy s ich celkovou časovou rezervou a závislosti, ktoré určujú kritickú cestu.
- `planner_list_resources` (čítanie) — zdroje s kapacitou, štandardnou sadzbou, kalendárom, posádkou, dostupnosťou a prehľadom ich priradení. Ak zdroj pochádza z knižnice, ukazuje, ktoré polia sú pevné.
- `planner_get_resource_histogram` (čítanie) — zaťaženie oproti kapacite na zdroj, po dňoch, týždňoch alebo mesiacoch (predvolene týždne). Bez časového okna a bez zdrojov dá súhrn na zdroj. S časovým oknom alebo zdrojmi dá celú sériu a úlohy, ktoré spôsobujú preťaženie.
- `planner_get_calendars` (čítanie) — všetky kalendáre s ich úplnou definíciou a počtom úloh a zdrojov, ktoré ich používajú.

## Čítanie: pôvodné plány a odchýlky

- `planner_list_baselines` (čítanie) — uložené pôvodné plány a ktorý je aktívny.
- `planner_compare_baseline` (čítanie) — súčasný plán oproti aktívnemu pôvodnému plánu: len úlohy, ktoré sa líšia, a rozdiel v dokončení projektu v počte pracovných dní podľa kalendára projektu. Bez aktívneho pôvodného plánu odmietne.
- `planner_analyze_delay` (čítanie) — analýza oneskorenia oproti aktívnemu pôvodnému plánu: rozdiel v dodaní a kritické úlohy, ktoré sa posunuli. Bez aktívneho pôvodného plánu odmietne.

## Úlohy a štruktúra

- `planner_add_tasks` (zmena, hromadne) — vytvorí úlohy vrátane vnoreného WBS v jednom volaní. Každá úloha dostane vlastný dočasný názov (`tmp-…`), aby na nadradenú úlohu mohla odkazovať podriadená. Bez trvania dostane úloha 5 pracovných dní. Medzník má trvanie 0. Všetky úlohy jedného volania uspejú spolu alebo zlyhajú spolu.
- `planner_update_tasks` (zmena, hromadne) — mení polia existujúcich úloh: názov, popis, trvanie s jednotkou (dni alebo hodiny), typ trvania, typ úlohy, medzník, povinnosť, prioritu, obmedzenie, termín, kalendár a pravidlo práce. Tiež polia postupu: percento dokončenia, skutočný začiatok a skutočné dokončenie. Každý iný kľúč je odmietnutý s dôvodom.
- `planner_delete_tasks` (zmena) — odstráni úlohy vrátane celého podstromu, závislostí a priradení. Odpoveď presne uvedie, čo sa odstránilo spolu s nimi.
- `planner_move_task` (zmena) — presunie úlohu pod inú nadradenú úlohu, na určenú pozíciu. Cyklus alebo úloha pod sebou samou je odmietnutá.
- `planner_set_task_splits` (zmena) — nastaví prestávky jednej úlohy: počet pracovných dní (alebo pracovných hodín) práce pred prestávkou a počet pracovných dní (alebo hodín) trvania prestávky. Prázdny zoznam zruší všetky prestávky. Pozrite [Rozdelenie úlohy](docs://howto-taak-splitsen).

## Závislosti

- `planner_add_dependencies` (zmena, hromadne) — vytvorí závislosti s typom (`FS`, `SS`, `FF`, `SF` alebo dlhý tvar) a oneskorením, napríklad `+2d`.
- `planner_update_dependencies` (zmena, hromadne) — zmení typ, oneskorenie, predchádzajúcu alebo nasledujúcu úlohu existujúcej závislosti podľa id závislosti. Je to jeden krok, nie zmazanie a nové vytvorenie.
- `planner_remove_dependencies` (zmena, hromadne) — zmaže závislosti podľa id závislosti.

## Projekt a kalendáre

- `planner_update_project` (zmena) — názov, popis, autor, firma, dátum začiatku, dátum dokončenia, dátum kontroly stavu, režim postupu a predvolené pravidlo práce pre projekt. Dátum začiatku je kotva pre nové úlohy. Ak ho asistent nastaví neskôr, posunú sa len voľné úlohy (bez predchádzajúcej úlohy a bez obmedzenia, ktoré nastavuje dolnú hranicu, napríklad *začiatok nie skôr ako*). Odpoveď uvedie počet takto ovplyvnených úloh ako `anchorsClamped`. Zvyšok plánu zostane na mieste. Pozrite [Nový projekt a info o projekte](docs://ref-projectinfo). Dátum kontroly stavu nie je štítok, ale referenčný dátum výpočtu: pri pláne bez postupu sa všetko posunie spolu s ním. Dátum dokončenia je len metaúdaj.
- `planner_move_project` (zmena) — presunie celý existujúci plán na nový dátum začiatku. Kalendáre sa spolu s plánom nepresúvajú, takže dokončenie môže skočiť o iný počet dní než začiatok. Pôvodné plány zostanú na mieste, pokiaľ asistent výslovne nepožiada aj o ich presun. Pozrite [Presun projektu](docs://howto-project-verplaatsen).
- `planner_update_calendar` (zmena, hromadne) — mení alebo vytvára kalendáre: pracovné dni, pracovnú dobu, prestávku, pracovné bloky, sviatky (generovanie pre krajinu a región alebo zadanie priamo) a výnimky pracovných dní. Nemôže zmeniť, ktorý kalendár je kalendárom projektu.

## Zdroje a jednotky

- `planner_manage_resources` (zmena, hromadne) — vytvára, mení alebo maže zdroje: názov, typ (pracovná sila, zariadenie, materiál, subdodávateľ alebo posádka), popis, maximálny počet jednotiek, náklad na hodinu, jednotku, kalendár, posádku a dostupnosť v čase. Odmietne zmazať zdroj, ktorý má priradenia, kým asistent to výslovne nepotvrdí. Pri zdroji z knižnice sú názov, typ, popis, štandardná sadzba a jednotka pevné.
- `planner_manage_assignments` (zmena, hromadne) — pridáva, mení, presúva alebo odstraňuje priradenia: jednotky priradenia na pracovný deň, krivku a zostávajúcu prácu. Len na koncovej úlohe a jeden zdroj len raz na úlohu. Čo zmena jednotiek priradenia urobí s trvaním, závisí od pravidla práce úlohy, ako v [Pravidlá práce: trvanie, jednotky a práca](docs://uitleg-werkregels).
- `planner_level_resources` (zmena) — vyváži preťaženie. Predvolene v rámci časovej rezervy, takže dátum dokončenia zostane. S `constrainToFloat: false` sa dokončenie môže posunúť. Pri skúšobnom behu asistent najskôr dostane náhľad bez zmeny. Preskakuje materiál. Pozrite [Vyvažovanie zdrojov](docs://uitleg-nivelleren).
- `planner_clear_leveling` (zmena) — zruší všetky oneskorenia pri vyvažovaní.

## Správa pôvodných plánov

- `planner_save_baseline` (zmena) — uloží súčasný plán ako pôvodný plán a hneď ho aktivuje. Najskôr prepočíta zastarané dátumy. Nedá sa použiť v skripte.
- `planner_activate_baseline` (zmena) — aktivuje pôvodný plán, alebo žiadny.
- `planner_rename_baseline` (zmena) — premenuje pôvodný plán.
- `planner_delete_baseline` (zmena) — zmaže jeden pôvodný plán. Ak bol aktívny, aktívnym sa stane posledný zostávajúci pôvodný plán, alebo žiadny, ak už nič nezostane.

## Vrátenie zmien

- `planner_undo` a `planner_redo` — vráti späť alebo znovu vykoná jeden krok v aktívnom dokumente. História je rovnaká ako vaša. Odpoveď uvádza, či sa niečo naozaj vrátilo.

## Dokumenty a súbory

- `planner_list_documents` (čítanie) — všetky otvorené dokumenty s názvom, či sú aktívne a zmenené, počtom úloh, dátumom začiatku projektu a vypočítaným dokončením.
- `planner_new_document` — nový, prázdny dokument na vlastnej karte, bez okna *Nový projekt*.
- `planner_duplicate_document` — skopíruje aktívny dokument na novú kartu, pre variant „čo ak“ alebo variant ponuky. Kópia je odpojená a nemá cestu k súboru.
- `planner_switch_document` — aktivuje iný dokument. Je to aj spôsob, ako po prepnutí kariet potvrdiť, na ktorom dokumente asistent pracuje.
- `planner_import_schedule` — otvorí súbor plánu z disku ako dokument: `.ifc`, `.xml` (Primavera P6 alebo MS Project, rozpoznané podľa obsahu), `.csv`, `.xer` a `.mpp` (MS Project 2010 až 2021). Nič sa nezlúči so súčasným plánom. CSV nemá kalendár, takže dátumy sa môžu posunúť. Len vo vašom používateľskom priečinku. Po importe CSV, XML alebo `.mpp` nemá dokument cieľ na uloženie. Len IFC prevezme jeho cestu.
- `planner_export_ifc` — zapíše aktívny dokument ako súbor IFC 4.3. Len vo vašom používateľskom priečinku. Existujúci súbor sa prepíše len na výslovnú žiadosť. Projekt zostáva neuložený.

## Sprievodca a pôvod zdrojov

- `planner_get_planning_guide` (čítanie) — anglický sprievodca pre asistentov (zásady [Dobré plánovanie](docs://gids-goed-plannen), s nástrojmi pre každú zásadu), dve zručnosti *goed-plannen* (vytvorenie plánu) a *progress-update* (aktualizácia postupu), alebo všetko. Vyberte pomocou `part`: `guide`, `skill` (obe zručnosti) alebo `both`. Predvolene `both`. Pre každú zručnosť vráti miesta, kde patrí, a adresy na stiahnutie. Parameter `language` sa stále prijíma kvôli starším asistentom, ale text je vždy v angličtine. Nemení plán.
- `planner_inspect_xer_provenance` (čítanie) — kontroluje zachovaný význam zdroja otvoreného súboru Primavera P6 (`.xer`): čo súbor obsahoval, s počtami importu a diagnostiky. Voľné textové polia zo súboru sú predvolene neviditeľné. Asistent ich musí výslovne vyžiadať. Nedá sa použiť v skripte.

## Skript

- `planner_batch` — spustí skript s najviac 100 krokmi ako jednu zmenu: jeden krok vrátenia, jedno prepočítanie, jedna záloha. Ak krok zlyhá štrukturálne, celý skript sa vráti späť. Odpoveď uvedie pre každý krok, čo sa vykonalo, čo zlyhalo a čo sa nedostalo na rad. Dočasné názvy (`tmp-…`) z `planner_add_tasks` platia v ďalších krokoch. Ako krok nie je povolené: `planner_batch` samotný, vrátenie a znovu vykonanie, nástroje pre dokumenty a súbory, `planner_save_baseline`, `planner_get_planning_guide` a `planner_inspect_xer_provenance`. Skript nie je programovací jazyk. Nemá premenné, podmienky ani slučky.

## Keď je nástroj odmietnutý

Asistent potom dostane odpoveď s kódom chyby a vysvetlením.

- `PAUSED` — *Pozastaviť* je zapnuté.
- `READ_ONLY` — *Iba na čítanie* je zapnuté.
- `DIALOG_OPEN` — je otvorený dialóg. Platí to aj pre čítanie, okrem `planner_get_planning_guide`. Odpoveď uvedie, čo je otvorené, pod interným názvom, napríklad `showTaskDialog`.
- `DOC_DRIFT` — prepli ste karty, kým asistent pracoval. Musí potvrdiť pomocou `planner_switch_document`, na ktorom dokumente pracuje.
- `VALIDATION` — argumenty nezodpovedajú schéme, alebo požadovaná zmena nie je povolená. Odpoveď uvedie pole.
- `NOT_FOUND` — id alebo dokument neexistuje.
- `CYCLE` — zmena by vytvorila cyklus. Všetko v tomto volaní sa vráti späť.
- `SCOPE` — cesta k súboru je mimo vášho používateľského priečinku.
- `BACKUP_FAILED` — záloha pred zmenou zlyhala. Zmena sa nevykonala.
- `INTERNAL` — neočakávaná chyba pri spúšťaní nástroja, napríklad zlyhaná operácia so súborom. Odpoveď uvedie pôvodnú chybovú správu.
- `STALE_PRECONDITION` — je súčasťou zmluvy mosta, ale žiadny nástroj tento kód zatiaľ nevracia.

Požiadavka, ktorá čakala vo fronte dlhšie ako 110 sekúnd, už aplikácia nevykoná. Klient už dostal časový limit a vykonanie by pri opakovaní zmenilo veci dvakrát. Volanie, ktoré trvá dlhšie ako 120 sekúnd, dostane od mosta časový limit.

## Čo asistent nemôže nastaviť

Pri každej úlohe asistent nemôže nastaviť: hamak, manuálne plánovanie, druhé obmedzenie, poznámky, farbu, kódy aktivít, vlastné polia, prepojenia medzi projektmi a oneskorenie pri vyvažovaní ručne. Kód WBS vypočíta aplikácia sama. Na úrovni projektu nemôže zmeniť profil výpočtu a možnosti výpočtu. Nastavenia, motív, jazyk, rozšírenia a aktualizácie sú mimo dosahu, rovnako knižnica zdrojov. Nemá ani zostavy, rozloženia, filtre ani zobrazenie. Prečo tomu tak je, je v [Ako funguje pripojenie AI](docs://uitleg-ai-koppeling).

## Čo aplikácia ukladá

- **Token** je v tomto počítači, v uložených nastaveniach aplikácie. Má 64 znakov a je náhodný. *Vytvoriť nový token* ho nahradí.
- **Port** je predvolene 3877. Dá sa zmeniť len vtedy, keď je most zastavený.
- **Panel s prehľadom volaní** uchováva posledných 500 volaní, len kým je aplikácia otvorená. Argumenty a odpovede sa skrátia po 20 kB na pole. *Vymazať* vyprázdni zoznam.
- **Zálohy** sú v priečinku `ai-backups` v dátovom priečinku aplikácie. *Otvoriť priečinok záloh* vás tam dostane. Názvy majú tvar `<project name>-<timestamp>.ifc`. Uložený projektový súbor má jeden priečinok pre všetky relácie. Dokument, ktorý ste nikdy neuložili, dostane vlastný priečinok pre každú reláciu. Pri každom spustení mosta sa vytvorí jedna záloha na dokument, plus zálohy, ktoré vytvoríte sami tlačidlom *Zálohovať teraz*.
- **Čistenie** prebieha samo, po jednotlivých priečinkoch. Zo záloh za posledných 7 dní sa ponechajú všetky, najviac 20. To, čo vytvorila bežiaca relácia, zostane vždy. Potom sa ponechá jedna za týždeň až do 30 dní, jedna za mesiac až do roka a potom jedna za rok. Zálohy dokumentu, ktorý ste nikdy neuložili, zmiznú úplne po roku. Súbory v priečinku, ktoré aplikácii nepatria, sa nechajú bez zmeny.

## Pozrite tiež

- [Ako funguje pripojenie AI](docs://uitleg-ai-koppeling): prečo je most nastavený tak, ako je, a čo smie a nesmie asistent.
- [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): spustenie mosta, pripojenie, inštalácia zručnosti.
- [Nastavenia](docs://ref-instellingen): dva prepínače pre AI.
- [Oznámenia a upozornenia](docs://ref-meldingen): bodka AI v stavovom riadku.
