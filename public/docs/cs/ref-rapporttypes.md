# Typy sestav

Každá sestava na kartě *Sestava* s možnostmi, které k ní patří: co dělají, výchozí hodnota, co se v sestavě změní a kde je najdete. Jak vytvořit sestavu a uložit ji jako PDF, je popsáno v [Vytváření a tisk sestavy](docs://howto-rapport-maken-en-afdrukken).

## Jak funguje okno sestavy

Otevřete kartu *Sestava* (nebo stiskněte Ctrl+P). Vlevo je sloupec *Sestava* s rozbalovacím seznamem *Typ sestavy*, blok *Přehled* s počty, blok *Nastavení* nebo *Možnosti sestavy* a dole tlačítko *Exportovat PDF*. Vpravo je náhled. Co vidíte v náhledu, jde do PDF.

**Typ sestavy** — která sestava se zobrazí. Zvolte jednu z jedenácti sestav. Výchozí: *Gantt-diagram*. Kde: *Sestava*, nahoře ve sloupci *Sestava*.

**Exportovat PDF** — vytvoří PDF. Účinek: výsledkem je jen PDF. Aplikace nic neposílá na tiskárnu. Pokud je plán zastaralý, aplikace nejdřív vypočítá. Když přepočet vrátí chybu, například kvůli smyčce v závislostech, tlačítko soubor nevytvoří a chybu zobrazí. Kde: *Sestava*, dole ve sloupci *Sestava*.

**Zapamatováno.** Aplikace uchovává všechny možnosti sestav na tomto zařízení, pro všechny vaše projekty. Nepatří do souboru projektu. Jen pole *Společnost:* v Gantt-diagramu se neukládá.

**Aktuální plán.** Sestavy používají poslední přepočet. Pokud se plán od té doby změnil, ukazují tabulkové sestavy nahoře *Plán se od posledního přepočtu změnil — stiskněte Přepočítat (F5) pro aktuální hodnoty.* Pokud nikdy nebylo nic vypočítáno, zobrazí se *Ještě nepřepočítáno — stiskněte Přepočítat (F5) pro data a časovou rezervu.* Pokud je projekt v zobrazení *Data podle záznamu*, sestavy zobrazují data ze zdrojového souboru a upozornění to uvádí.

**Zkratky.** *pd* znamená pracovní dny. *TF* je celková časová rezerva, *FF* je volná časová rezerva.

## Papír a orientace

**Papír:** — velikost papíru PDF. Zvolte z A4, A3, A2 a A1. Výchozí: A3. Účinek: stránky se rozvrhnou pro tuto velikost. Pro všechny sestavy je jedna volba: co zvolíte u jedné sestavy, platí i pro ostatní. Na výšku A4 je široká tabulka malá, protože se tabulka přizpůsobí šířce stránky. Kde: *Nastavení* (Gantt-diagram a Diagram zdrojů) nebo *Možnosti sestavy* (sedm tabulkových sestav). Přehled milníků a Odchylka žádné volby nemají.

**Orientace:** — na šířku, nebo na výšku. Zvolte z *Na šířku* a *Na výšku*. Výchozí: *Na šířku*. Účinek: jako u *Papír:*. Kde: na stejném místě jako *Papír:*.

## Gantt-diagram

Plán jako pruhový graf, s tabulkou vlevo a časovou osou vpravo, případně přes více stránek. Náhled ukazuje papír se záhlavím stránky, tabulkou, časovou osou a legendou. Blok *Přehled* počítá *Úkoly:*, *Koncové úkoly:*, *Kritické:* a *Závislosti:*. Všechny možnosti jsou pod *Nastavení*.

**Společnost:** — společnost v záhlaví stránky. Výchozí: společnost z informací o projektu. Účinek: jen záhlaví sestavy. Co zde napíšete, se neukládá. Změňte společnost v *Nastavení › Projekt › Info o projektu*, v poli *Objednatel/organizace*, a potvrďte tlačítkem *Použít*.

**Autor:** — autor v záhlaví stránky. Jen pro čtení: aplikace ho bere z informací o projektu.

**Velikost písma:** — velikost textu a tabulky v sestavě. Zvolte z 90 %, 100 %, 110 % a 125 %. Výchozí: 100 %. Účinek: s větším písmem rostou text, řádky a tabulka a časová osa ztrácí šířku. Nezávisí na *Velikost textu* v nastavení.

**Barvy pruhů:** — podle čeho se barva pruhu řídí. Zvolte z *Kritická cesta*, *Podle úkolu — automaticky* a *Podle kategorie*, s rozbalovacím seznamem *Pole kategorie* pro *Podle kategorie*. Výchozí: *Kritická cesta*. Účinek: je to stejná volba jako *Barvy pruhů* na kartě *Zobrazení*. Když ji změníte tady, změní se i Gantt na obrazovce. Pokud zvolené pole v tomto projektu neexistuje, zobrazí se *Toto pole v tomto projektu neexistuje. Dočasně se použije typ úkolu.*

**Stavová čára:** — čára u data stavu. Zvolte z *Žádná*, *Čára datumu stavu* a *Čára průběhu*. Výchozí: *Žádná*. Účinek: *Čára datumu stavu* kreslí čáru u data stavu. *Čára průběhu* kreslí klikatou čáru, která se vyklene k průběhu každého úkolu. Pokud projekt nemá datum stavu, zobrazí se *Nejprve nastavte datum stavu* a sestava nic nekreslí.

**Sledovat zobrazení (filtr, seskupení, řazení)** — jen pro Gantt-diagram. Výchozí: vypnuto. Účinek: vypnuto vytiskne celý strom úkolů. Zapnuto vykreslí přesně řádky na obrazovce, s vaším filtrem, seskupením, řazením a sbalenými fázemi.

**Automaticky přizpůsobit papíru** — přizpůsobí měřítko časové osy šířce stránky. Výchozí: zapnuto. Účinek: zapnuto přizpůsobí časovou osu šířce stránky. Počet stran se řídí výškou. Vypnuto použije pevné měřítko (*Zoom:*) a dělí se také přes šířku, což rychle dá hodně stran.

**Zoom:** — pevné měřítko časové osy. Vidět jen, když je *Automaticky přizpůsobit papíru* vypnuto. Posuvník od 1 do 40. Výchozí: 22. Účinek: větší hodnota dělá časovou osu širší, takže přes stránky vedle sebe bude víc stránek.

**Časová osa přes:** — rozloží časovou osu přes více šířek stránky. Volba od 1 do 8 stran. Výchozí: 1 strana. Účinek: jen s *Automaticky přizpůsobit papíru*. Jinak je volba vypnutá a zobrazí se *Jen při automatickém přizpůsobení*. Hodí se pro dlouhý plán, který chcete vytisknout v čitelné velikosti.

**Opakovat záhlaví na každé stránce** — Výchozí: zapnuto. Účinek: zapnuto dá záhlaví stránky na každou stránku. Vypnuto jen na první.

**Opakovat zápatí na každé stránce** — Výchozí: zapnuto. Účinek: zapnuto dá zápatí (název projektu, datum tisku a legendu) na každou stránku. Vypnuto jen na poslední. Podklad bez legendy se nedá číst, proto je výchozí zapnuto.

**Názvy úkolů na pruzích** — Výchozí: zapnuto. Účinek: název úkolu na pruhu, kde je na něj místo.

**Zobrazit procento dokončení** — Výchozí: zapnuto. Účinek: tmavší část pruhu až do průběhu úkolu a sloupec *Dokonč* v tabulce.

**Zkrátit názvy úkolů** — Výchozí: zapnuto. Účinek: zapnuto zkrátí názvy v tabulce na šířku *Sloupec názvů:*. Vypnuto nechá sloupec růst s nejdelším názvem. Pak se zobrazí *Sloupec názvů se přizpůsobí nejdelšímu názvu úkolu*.

**Sloupec názvů:** — šířka sloupce názvů. Vidět jen, když je *Zkrátit názvy úkolů* zapnuto. Posuvník od 60 do 400. Výchozí: 130.

**Zobrazit překryv směrného plánu** — aktivní směrný plán vedle pruhů. Výchozí: vypnuto. Účinek: tenký pruh v barvě směrného plánu pod pruhem úkolu, jen u úkolů, které jsou ve směrném plánu.

**Kritická cesta** — Výchozí: zapnuto. Účinek: řídí jen červené čáry závislostí mezi dvěma kritickými úkoly a řádek v legendě. Samotné pruhy se řídí *Barvy pruhů:*, bez ohledu na toto zaškrtávací pole.

**Zobrazit časovou rezervu** — Výchozí: zapnuto. Účinek: časová rezerva jako pás za nekritickými pruhy.

**Závislosti** — čáry závislostí. Výchozí: zapnuto. Účinek: kreslí šipky mezi pruhy.

**Zobrazit jen pracovní dny** — zhustí osu času v této sestavě. Výchozí: vypnuto. Účinek: víkendy a svátky se přeskočí a místo stínování víkendů se zobrazí pásy týdnů. Nezávisí na stejném nastavení pro Gantt na obrazovce.

**Víkendy** — Výchozí: zapnuto. Účinek: stínuje víkendy a svátky na časové ose, pokud měřítko rozliší dny. Na zhuštěné ose (*Zobrazit jen pracovní dny*) toto zaškrtávací pole nemá účinek.

**Legenda** — Výchozí: zapnuto. Účinek: legenda v zápatí.

**Kvalita náhledu** — jak ostrý je náhled. Zvolte z *Standardní*, *Vysoká* a *Maximální*. Výchozí: *Vysoká*. Účinek: jen ostrost náhledu na obrazovce. PDF se nemění. Kde: *Sestava*, nad náhledem.

## Diagram zdrojů

Stejné pruhy jako Gantt-diagram, seskupené podle zdroje: kdo dělá co a kdy. Blok *Přehled* počítá *Zdroje:*, *Přiřazení:* a *Bez zdroje:* (s obdobím také *Mimo období:*). Diagram sdílí všechny možnosti Gantt-diagramu kromě *Sledovat zobrazení (filtr, seskupení, řazení)*, *Kritická cesta* a *Závislosti*. Řádky nepřicházejí z obrazovky, úkol se může objevit u několika zdrojů a závislosti se tu nekreslí. Zaškrtávací pole *Kritická cesta* je skryté a zapnuté. K tomu patří možnosti Gantt-diagramu v části *Nastavení*, s těmito čtyřmi zaškrtávacími poli a obdobím:

**Každý zdroj na nové stránce** — Výchozí: vypnuto. Účinek: každý zdroj začne na nové stránce, takže můžete rozdat list pro každou partu nebo zaměstnance. Vypnuto dá jeden souvislý dokument.

**Zahrnout úkoly bez zdroje** — Výchozí: vypnuto. Účinek: úkoly bez zdroje přijdou jako poslední pás v diagramu. Uvidíte, co zatím nikdo nemá.

**Seskupit podle typu zdroje** — Výchozí: vypnuto. Účinek: vrstva navrch. Nejdřív je pás pro každý typ zdroje (pracovní síla, parta, subdodavatel, zařízení, materiál), uvnitř pak pás pro každý zdroj.

**Zobrazit jednotky přiřazení za den a křivku** — Výchozí: zapnuto. Účinek: dva sloupce za názvem úkolu, s jednotkami přiřazení za den a křivkou rozložení práce zdroje u daného pásu. Když je pro časovou osu málo místa, sestava sloupce vynechá a napíše *Sloupce Jedn./d a Křivka byly vynechány: …*. Více místa dá větší velikost papíru nebo režim na šířku, menší velikost písma nebo užší tabulka.

**Období sestavy:** — jen úkoly, které se dotýkají období. Výchozí: *Celý projekt*. Účinek: osa času běží přesně přes období. Když v období nic není, zobrazí se *V sestavovaném období nejsou žádné úkoly — zvolte jiné období nebo Celý projekt.* Viz *Období sestavy* níže.

## Přehled milníků

Všechny milníky projektu v tabulce. Vlastní možnosti nemá. Blok *Přehled* počítá *Milníky*, *Povinné* a *Opožděné*. Sloupce jsou *WBS*, *Název*, *Druh* (*Automaticky*, *Zahájení* nebo *Dokončení*), *Datum*, *Omezení/konečný termín*, *Časová rezerva*, *Povinný* a *Stav*. Stav je *Opožděný*, když je porušeno omezení, když je zmeškán konečný termín nebo když je celková časová rezerva záporná. Jinak je *Kritický*, pokud je milník kritický podle kritické definice projektu. Jinak je *V plánu*. Bez milníků se zobrazí *V tomto projektu nejsou žádné milníky.* PDF používá papír a orientaci, které jste naposledy zvolili u jiné sestavy.

## Odchylka

Aktuální plán vedle aktivního směrného plánu, pro koncové úkoly. Vlastní možnosti nemá. Blok *Přehled* počítá *Úkoly*, *Opožděno* a *Dříve*. Ukazuje *Dokončení projektu: +3 pd*, tedy rozdíl v pracovních dnech mezi dokončením směrného plánu a aktuálním dokončením. Sloupce jsou *WBS*, *Název*, *Začátek směrného plánu*, *Dokončení směrného plánu*, *Aktuální začátek*, *Aktuální dokončení*, *Δ začátek (pd)*, *Δ dokončení (pd)* a *Stav*. Stav sleduje dokončení: *Opožděno*, pokud je dokončení později než ve směrném plánu. *Dříve*, pokud je dřív. Jinak *V plánu*. *Nový* je úkol, který není ve směrném plánu. *Vypuštěno* je úkol, který je ve směrném plánu, ale už není v plánu. Bez aktivního směrného plánu se zobrazí *Žádný aktivní směrný plán — uložte směrný plán nebo některý nastavte jako aktivní.* PDF používá papír a orientaci, které jste naposledy zvolili u jiné sestavy.

## Výhled

Co běží nebo začíná v období: seznam pro týdenní schůzku. Možnosti jsou pod *Možnosti sestavy*.

**Období sestavy:** — okno sestavy. Výchozí: *Příští měsíc*. Účinek: sestava obsahuje nedokončené úkoly, které se dotýkají období, i když ho přesahují. Obsahuje také opožděné úkoly z doby před referenčním dnem, pokud konec období není před referenčním dnem.

**Téměř kritický ≤ (pd):** — prahová hodnota pro *Téměř kritický*. Číslo od 0 do 60. Výchozí: 5. Účinek: úkol s více než 0 a nejvýše tolika pracovními dny celkové časové rezervy se počítá jako téměř kritický. Při 0 se počítá jen to, co označí výpočetní volba projektu *Označit téměř kritické*.

Blok *Přehled* počítá *Úkoly*, *Opožděné*, *Probíhá*, *Mělo začít*, *Začíná*, *Kritické* a *Téměř kritický*. Stav u každého řádku se vždy vztahuje k referenčnímu dni: *Opožděný* (nedokončený a dokončení je před referenčním dnem), *Mělo začít* (nezahájený, ale začátek byl před referenčním dnem), *Probíhá*, *Začíná* (ještě nezahájený, začíná v okně). Sloupce jsou *WBS*, *Název*, *Začátek*, *Dokončení*, *Zbývá (pd)*, *Dokonč*, *TF (prac. dny)*, *Kritický*, *Zdroje* a *Stav*.

## Kritické a téměř kritické

Úkoly, které určují dokončení projektu, a úkoly, které jsou tomu blízko. Možnost je pod *Možnosti sestavy*.

**Téměř kritický ≤ (pd):** — Výchozí: 5. Číslo od 0 do 60. Účinek a význam jako u Výhledu. Podnadpis uvádí zvolenou prahovou hodnotu.

Sestava obsahuje nedokončené úkoly, které jsou kritické (podle řešiče a kritické definice projektu) nebo téměř kritické. Seřazené jsou podle cesty časové rezervy, pak podle celkové časové rezervy a pak podle začátku. Blok *Přehled* počítá *Kritické*, *Téměř kritický*, *Kritické řetězce* a *Koncové úkoly*. Sloupce jsou *WBS*, *Název*, *Začátek*, *Dokončení*, *Zbývá (pd)*, *TF (prac. dny)*, *FF (prac. dny)*, *Cesta* a *Stav*. Sloupec *Cesta* ukazuje cestu časové rezervy, když je zapnutá výpočetní volba *Více cest časové rezervy*. Jinak ukazuje pomlčku.

## Sestava o průběhu

Kde projekt stojí k datu stavu. Možnosti jsou pod *Možnosti sestavy*.

**Období sestavy:** — Výchozí: *Uplynulý měsíc*. Účinek: *Dokončeno v uplynulém období* počítá v rámci období. *Začíná v příštím období* se dívá dopředu od data stavu, až do *Výhled do*. U *Uplynulý měsíc* jde tak daleko dopředu, jak daleko období sahá zpět.

**Téměř kritický ≤ (pd):** — Výchozí: 5. Jako u Výhledu.

Blok *Přehled* ukazuje *Datum stavu*, *Období*, *Výhled do*, *Dokončení směrného plánu*, *Předpokládané dokončení*, *Δ dokončení (pd)*, *Plánovaný* (s *(směrný plán)* nebo *(současný plán)*), *Skutečný* a počty *Dokončeno*, *Probíhá*, *Nezahájeno*, *Opožděné* a *Kritické*. Plánovaný a skutečný jsou váženy dobou trvání úkolů. Plánovaný se měří proti směrnému plánu, pokud je aktivní. Jinak se měří proti současnému plánu. Sekce jsou *Dokončeno v uplynulém období*, *Probíhá*, *Začíná v příštím období*, *Opožděné* a *Otevřené kritické úkoly*. Úkol může být v více sekcích.

## Stav plánu

Kontrola samotného plánu na chyby a neobvyklé hodnoty, nahoře s 14bodovým posouzením DCMA. Možnosti najdete pod *Možnosti sestavy*.

**Vysoká časová rezerva > (pd):** — Číslo od 1 do 365. Výchozí: 44. Účinek: nedokončený úkol s celkovou časovou rezervou vyšší než tato hodnota spadá pod položku *Vysoká časová rezerva*.

**Dlouhá doba trvání > (pd):** — Číslo od 1 do 365. Výchozí: 44. Účinek: nedokončený úkol, který není milník, s delší dobou trvání spadá pod položku *Dlouhá doba trvání*.

**Prodleva > (pd):** — Číslo od 0 do 365. Výchozí: 10. Účinek: závislost s větší prodlevou spadá pod položku *Dlouhá prodleva*. Záporná prodleva (předstih) se vždy uvede.

**Téměř kritický ≤ (pd):** — Číslo od 0 do 60. Výchozí: 5. Účinek: určuje kontrolu *Téměř kritický*.

Na začátku je část *14bodové posouzení DCMA*. Vychází ze čtrnácti kontrol americké agentury US Defense Contract Management Agency, s vzorci a prahovými hodnotami z jejich *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, říjen 2012). U každého bodu uvidíte *Počet*, *Z* (celkový počet, ze kterého se počítalo), *Hodnota*, *Prahová hodnota*, *Výsledek* a *Podrobnosti*. Výsledek je *Vyhovuje*, *Označení* nebo *n/a*. U n/a najdete důvod ve sloupci *Podrobnosti*. Označení není selhání: příručka je označuje jako důvod k dalšímu prozkoumání. Prahové hodnoty pod položkou *Možnosti sestavy* se na tuto část nevztahují; vždy používá prahové hodnoty z příručky.

Část počítá nedokončené listové úkoly bez milníků a překlenovacích úkolů a závislosti vedoucí do takových úkolů. Poznámka nad sestavou uvádí obě čísla. Čtrnáct bodů:

- *Logika*: úkoly bez předchůdce nebo následníka. Prahová hodnota: nejvýše 5 %.
- *Předstihy*: závislosti se zápornou prodlevou. Prahová hodnota: žádná.
- *Prodlevy*: závislosti s kladnou prodlevou, ať je jakkoli krátká. Prahová hodnota: nejvýše 5 %.
- *Typy závislostí*: podíl závislostí typu FS. Prahová hodnota: nejméně 90 %.
- *Pevná omezení*: úkoly s povinným omezením nebo s MSO, MFO, SNLT nebo FNLT. Prahová hodnota: nejvýše 5 %.
- *Vysoká časová rezerva*: úkoly s celkovou časovou rezervou větší než 44 pracovních dnů. Prahová hodnota: nejvýše 5 %. Vyžaduje výpočet.
- *Záporná časová rezerva*: úkoly s celkovou časovou rezervou pod 0. Prahová hodnota: žádná. Vyžaduje výpočet.
- *Vysoká doba trvání*: úkoly delší než 44 pracovních dnů. Počítá se doba trvání ze směrného plánu, pokud je úkol v aktivním směrném plánu, jinak aktuální doba trvání. Prahová hodnota: nejvýše 5 %.
- *Neplatná data*: skutečné zahájení nebo skutečné dokončení je po datu stavu, nebo předpokládané zahájení či předpokládané dokončení je před datem stavu. Prahová hodnota: žádná. Vyžaduje datum stavu.
- *Zdroje*: úkoly bez zdroje. Prahová hodnota: žádná. Pouze pokud projekt používá zdroje; jinak *n/a*.
- *Opožděné úkoly*: z úkolů, které mají podle směrného plánu být dokončeny nejpozději k datu stavu, podíl těch, které se dokončí později, nebo jejichž předpokládané dokončení je později. Prahová hodnota: nejvýše 5 %. Vyžaduje datum stavu a aktivní směrný plán.
- *Test kritické cesty*: aplikace prodlouží kritický úkol o 100 pracovních dnů a přepočítá plán na kopii, aniž se změní projekt. Test vyhoví, pokud poslední úkol projektu pak nedokončí dříve než tento úkol. Testuje kritický nedokončený úkol s nejdřívějším zahájením. V podrobnostech je uveden úkol a počet pracovních dnů, o který se dokončení posunulo.
- *CPLI*: (délka kritické cesty + časová rezerva) / délka kritické cesty. Délka je počet pracovních dnů od data stavu do dokončení posledního úkolu. Časová rezerva je rozdíl od dokončení toho úkolu ve směrném plánu, nebo vypočtená časová rezerva, pokud úkol ve směrném plánu není. Prahová hodnota: nejméně 0,95. Vyžaduje datum stavu.
- *BEI*: počet úkolů dokončených k datu stavu, vydělený počtem úkolů, které podle směrného plánu měly být k tomu datu dokončeny, plus úkoly bez směrného plánu. Prahová hodnota: nejméně 0,95. Vyžaduje datum stavu a aktivní směrný plán.

Dva body se od příručky liší, protože aplikace tento pojem nezná. *Vysoká doba trvání* počítá každý nedokončený úkol, zatímco příručka ji omezuje na období podrobného plánování (rolling wave). *Zdroje* sledují jen přiřazené zdroje, ne náklady. Příručka neuvádí číslo pro test kritické cesty. 100 pracovních dnů je volba aplikace.

Kontroly jsou v tomto pořadí a se svou závažností. Chyba: *Záporná časová rezerva*, *Zmeškaný konečný termín*, *Porušené omezení* a *Nekonzistentní průběh* (skutečné zahájení nebo skutečné dokončení po datu stavu, předpokládané zahájení nebo předpokládané dokončení před datem stavu, 100 % bez skutečného dokončení, skutečné dokončení, ale ne 100 %, průběh bez skutečného zahájení). Varování: *Bez předchůdce (otevřený začátek)* a *Bez následníka (otevřené dokončení)* (ne milníky), *Dlouhá doba trvání*, *Předstih (záporná prodleva)*, *Pevné omezení* (povinné omezení nebo MSO, MFO, SNLT nebo FNLT), *Průběh mimo posloupnost* a *Opožděný úkol (oproti směrnému plánu)*. Informace: *Téměř kritický*, *Vysoká časová rezerva*, *Dlouhá prodleva*, *Závislost jiná než FS* a *Bez zdroje* (jen pokud projekt používá zdroje). Sestava kontroluje jen listové úkoly, které nejsou překlenovací úkoly. Blok *Přehled* počítá *Příznaky DCMA*, *Chyby*, *Varování*, *Informace*, *Listové úkoly* a *Závislosti*. Pod částí DCMA jsou část *Přehled* (u každé kontroly závažnost a počet) a část *Zjištění* (každý úkol nebo závislost). Bez výpočtu chybí kontroly, které potřebují časovou rezervu.

## Vytížení zdrojů

Pro každý zdroj a každý týden nebo měsíc: co je požadováno oproti tomu, co je dostupné. Možnosti najdete pod *Možnosti sestavy*.

**Období sestavy:** — Výchozí: *Celý projekt*. Účinek: každý týden nebo měsíc, který se období dotýká, je zahrnut celý. Řádek tak ukazuje stejné číslo jako histogram.

**Agregace:** — Zvolte *Týdně* nebo *Měsíčně*. Výchozí: *Týdně*. Účinek: jeden řádek na kalendářní týden (sloupec *Týden od*, s pondělím) nebo na kalendářní měsíc (sloupec *Měsíc*).

**Pouze přetížená období** — Výchozí: vypnuto. Účinek: po zapnutí se zobrazí jen týdny nebo měsíce s alespoň jedním přetíženým dnem.

Sloupce jsou *Zdroj*, *Typ*, *Týden od* nebo *Měsíc*, *Požadováno*, *Dostupné*, *Odchylka* (dostupné mínus požadováno; záporná hodnota je nedostatek), *Špička/den* a *Přetíženo*. *Požadováno* je součet jednotkodnů. Jsou v něm jen týdny nebo měsíce s poptávkou. Blok *Přehled* počítá *Zdroje*, *Týdny* nebo *Měsíce*, *Přetížené týdny* nebo *Přetížené měsíce* a *Přetížené zdroje*.

## Přiřazení zdrojů

U každého zdroje úkoly, ke kterým je přiřazen: co dělá tato parta nebo jeřáb? Možnosti najdete pod *Možnosti sestavy*.

**Období sestavy:** — Výchozí: *Celý projekt*. Účinek: při zvoleném období se zahrnou jen přiřazení úkolů, které se období dotýkají, a zpožděná práce z doby před referenčním dnem. *Celý projekt* nefiltruje podle data.

**Zahrnout dokončené úkoly** — Výchozí: vypnuto. Účinek: zapnuto zahrne i přiřazení dokončených úkolů.

Řádky jsou po zdrojích a v rámci zdroje podle zahájení. Blok *Přehled* počítá *Zdroje*, *Přiřazení* a *Úkoly bez zdroje*. Sloupce zahrnují zdroj, úkol, zahájení a dokončení, *Zbývá (pd)*, *Jedn./den*, *Dokonč.*, *Kritický* a *Stav*.

## Souhrn WBS

Plán shrnutý po prvcích WBS: přehled pro vedení. Možnosti najdete pod *Možnosti sestavy*.

**Úroveň:** — do které úrovně se WBS zobrazí. Zvolte *Úplná WBS* nebo úrovně 1 až 8. Výchozí: úroveň 2. Účinek: podnadpis říká *Až do úrovně 2*.

**Zobrazit úkoly** — Výchozí: vypnuto. Účinek: zapnuto zobrazí pod každým prvkem i samotné listové úkoly.

Sloupce zahrnují *WBS*, *Název*, *Zahájení*, *Dokončení*, *Začátek směrného plánu*, *Dokončení směrného plánu*, *Doba trvání (prac. d.)*, *Dokonč.*, *Δ dokončení (pd)*, *Min. TF*, *Úk.* (počet úkolů), *Krit.*, *Probíhá* a *Hotovo*. Zahájení a dokončení souhrnného úkolu pocházejí z posledního výpočtu. Průběh je vážený dobou trvání listových úkolů. *Min. TF* a počty se týkají listových úkolů níže. Blok *Přehled* počítá *Prvky WBS* a *Úkoly*.

## Období sestavy

Čtyři tabulkové sestavy a diagram zdrojů pracují s *Obdobím sestavy:*: *Look-ahead*, *Sestava průběhu*, *Vytížení zdrojů*, *Přiřazení zdrojů* a *Diagram zdrojů*. Každá sestava si pamatuje své vlastní období. Pod rozbalovacím seznamem jsou *Od* a *Do* s daty, která výběr vytvoří.

**Referenční den.** Období, jehož název začíná na *Další*, Příští nebo Uplynulé, se počítá od data stavu projektu, nebo od dneška, pokud datum stavu není. Tabulkové sestavy pak zobrazí *Datum stavu není nastaveno — sestava počítá s dneškem (…).* Když přesunete datum stavu, okno se posune s ním. Oba dny se do období počítají.

**Příští týden, Příští 2 týdny, Příští 4 týdny, Příští 6 týdnů, Příští 8 týdnů, Příští 12 týdnů** — od referenčního dne, každý týden má 7 dnů. Při datu stavu čtvrtek 20. května trvá *Příští týden* od 20. do 26. května a *Příští 4 týdny* od 20. května do 16. června.

**Uplynulý týden, Uplynulé 2 týdny, Uplynulé 4 týdny, Uplynulých 6 týdnů, Uplynulých 8 týdnů, Uplynulých 12 týdnů** — stejných šest, ale počítaných zpět: každý týden má 7 dnů, do referenčního dne včetně. Při datu 20. května trvají *Uplynulé 2 týdny* od 7. do 20. května.

**Příští měsíc, Uplynulý měsíc** — kalendářní měsíc dopředu nebo dozadu, až do dne před stejným datem v druhém měsíci. Při datu 20. května trvá *Příští měsíc* do 19. června včetně. *Uplynulý měsíc* trvá od 21. dubna do 20. května včetně.

**Celý projekt** — od prvního zahájení do posledního dokončení plánu.

**Vlastní** — vaše vlastní období. Účinek: *Od* a *Do* se změní na dvě datová pole. Začínají s daty výběru, který jste právě zvolili. Datum konce nesmí být před datem začátku (*Datum konce je před datem začátku.*) a obě pole musí být vyplněna (*Vyplňte obě data.*). Když vstup není správný, sestava zůstane u posledního platného období.

## Viz také

- [Vytvoření a tisk sestavy](docs://howto-rapport-maken-en-afdrukken): celá cesta od typu sestavy k PDF.
- [Výběr období sestavy](docs://howto-rapportageperiode-kiezen): kroky a příklady.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co znamenají pojmy kritický a téměř kritický.
- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): datum stavu a směrný plán, se kterými sestavy pracují.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat s přetíženými týdny z Vytížení zdrojů.
- [Formáty importu a exportu](docs://ref-import-exportformaten): PDF vedle ostatních formátů.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva směrné plány s průběhem a datem stavu, na kterých si prohlédnete sestavu odchylek.
