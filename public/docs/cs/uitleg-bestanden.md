# Soubory a formáty

Co je ve skutečnosti v souboru, který uložíte? A co se stane s vaším plánem, když ho exportujete do jiného programu? V tomto článku se dozvíte, jak aplikace pracuje se soubory: IFC jako vlastní formát, ostatní formáty jako překladače, co export vynechá a jak se liší uložení, AutoSave a zotavení systému po chybě. Příklad na konci ukazuje na číslech, co export dělá.

## Princip

Open Planner Studio má jeden vlastní formát souboru: **IFC**, otevřený výměnný formát pro stavební informace od buildingSMART. Aplikace zapisuje IFC 4.3. V seznamu exportu se jmenuje *IFC 4x3*. Druhý vlastnický soubor projektu neexistuje. Příkaz *Uložit* zapíše celý projekt jako soubor IFC (`.ifc`). Příkaz *Otevřít* takový soubor načte zpět. Chcete vidět, co je v souboru? Karta *IFC* ukazuje IFC text vašeho projektu. Příkaz *Generovat IFC* ten text obnoví.

Všechny ostatní formáty jsou **adaptéry**: překladače mezi modelem jiného programu a modelem aplikace. Aplikace čte CSV, MS Project XML, Primavera P6 XML, soubory MS Project (`.mpp`) a soubory Primavera (`.xer`). Zapisuje CSV, MS Project XML, Primavera P6 XML a dva přehledy průběhu. Export do `.mpp` nebo `.xer` není možný.

Proč na tom rozdílu záleží? Překladač může přenést jen to, co znají obě strany. Soubor IFC aplikace uchovává vše, co patří k vašemu projektu. Každý jiný formát něco postrádá, a ta část se ztratí.

## Jak aplikace pracuje se soubory

### Co dělá otevření

Aplikace vybírá čtečku podle přípony: `.ifc`, `.csv`, `.xml`, `.mpp` nebo `.xer`. U souboru `.xml` se podívá dovnitř, zda jde o XML formát MS Project, nebo o XML formát Primavera P6. S neznámou příponou zachází jako s IFC. Když soubor není IFC, aplikace zobrazí *Otevření souboru se nezdařilo* s důvodem.

Každý soubor se otevře na vlastní kartě. Výjimkou je karta, která je ještě prázdná a beze změn: ta karta soubor převezme. Jeden soubor Primavera může vytvořit několik karet, jednu pro každý projekt, který má úkoly.

Po otevření aplikace vždy přepočítá plán. Pochází-li soubor z jiného programu, data se mohou lišit od toho, co soubor uváděl. To popisuje [Data tak, jak byla uložena](docs://uitleg-datums-zoals-opgeslagen).

Jen soubor IFC se stane **cílem uložení**: souborem, do kterého příkaz *Uložit* zapisuje zpět. Soubor CSV, XML, `.mpp` ani `.xer` jím není. Takový projekt po otevření nemá soubor. Příkaz *Uložit* se pak zeptá, kam uložit nový soubor IFC. Ctrl+S tak nikdy nepřepíše váš původní soubor textem IFC.

### Co zapisuje uložení

Příkaz *Uložit* vždy zapíše celý projekt. Do souboru se zapíše:

- úkoly se strukturou, dobou trvání, daty a průběhem;
- závislosti s prodlevami, omezeními a konečnými termíny;
- kalendáře, zdroje a přiřazení, včetně křivek;
- směrné plány, kódy aktivit, vlastní pole a poznámky;
- vazby mezi projekty;
- nastavení projektu, například datum stavu, profil výpočtu a možnosti výpočtu;
- propojení s knihovnou zdrojů.

Co nastavíte na obrazovce, nepatří k projektu a do souboru se nezapíše: přiblížení, poloha posouvání, vybraný úkol a sbalené fáze. Nastavení aplikace, například jazyk a motiv, v souboru také nejsou. Aplikace si je uchovává sama, v aplikaci nebo ve vašem prohlížeči.

Export do jiného formátu váš projekt nezmění. Po exportu má projekt pořád stejný cílový soubor. Pokud byl před exportem označen *Neuloženo*, zůstane tak označen.

### Co export ztratí

Každý adaptér přenese to, co jeho formát zná.

**MS Project XML** přenese úkoly, závislosti, kalendáře, zdroje, přiřazení, omezení, konečné termíny a datum stavu. Z vašich směrných plánů se přenese jen aktivní. Kódy aktivit, vlastní pole, poznámky a vazby mezi projekty se nepřenesou. Druhé omezení úkolu se nepřenese. Omezení *Musí začít (MSO)* nebo *Musí skončit (MFO)* bez volby *Povinný (pevné ukotvení)* se vrátí jako *Zahájit nejdříve (SNET)* nebo *Dokončit nejdříve (FNET)*. *Ručně plánováno* a *Zpoždění vyrovnání* úkolu se nevrátí. Překlenovací úkol se změní na běžný úkol s vypočítanými daty.

**Primavera P6 XML** přenese úkoly, závislosti, kalendáře, zdroje, přiřazení, omezení a datum stavu. Směrné plány a konečné termíny se nepřenesou. Stejně tak kódy aktivit, vlastní pole, poznámky a vazby mezi projekty. Překlenovací úkol se i zde změní na běžný úkol. P6 nemá prodlevu v procentech. Aplikace takovou prodlevu převede na pevný počet dnů. Prodleva v kalendářních dnech se změní na prodlevu v pracovních dnech.

**CSV** je seznam úkolů. Soubor má pro každý úkol tyto sloupce: task id, WBS, level, name, duration, start, finish, predecessors, type, id vlastního typu úkolu (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float a description. Zdroje, přiřazení, kalendáře, omezení, konečné termíny, směrné plány a datum stavu v něm nejsou. Názvy sloupců jsou vždy v angličtině.

**Jen IFC přenáší profil výpočtu a možnosti výpočtu.** Když exportujete do CSV, MS Project XML nebo Primavera P6 XML, profil v souboru není. Z možností výpočtu zapíše MS Project XML nejvýš kritickou prahovou hodnotu. Takový soubor se znovu otevře jako *Open Planner Studio*. Pokud se váš projekt vypočítával podle *Primavera P6* nebo *Microsoft Project*, například protože pochází ze souboru `.xer` nebo `.mpp`, data se kvůli tomu mohou posunout. Co profil výpočtu je, vysvětluje [Profily výpočtu a konvence](docs://uitleg-rekenprofielen).

Pokud váš projekt pochází ze souboru Primavera (`.xer`), aplikace po exportu do CSV, MS Project XML nebo P6 XML zobrazí toto hlášení, i když jste ho mezitím uložili jako IFC: *Při exportu do formátu CSV se ztratí zdrojové informace XER.* U MS Project XML hlásí *MSPDI* místo *CSV*, u P6 XML hlásí *P6*. U IFC se toto hlášení nezobrazí, protože soubor IFC si zdrojový soubor Primavery uchová. Viz [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen).

Dvě věci aplikace dělá ještě u exportu. Když je plán neaktuální, nejdřív ho přepočítá a teprve potom exportuje. Plán s cyklickou závislostí neexportuje. Zobrazí hlášení s cyklem, například *Cyklus závislostí mezi úkoly: Set up site → Demolish existing extension → Set up site*.

### Uložení, AutoSave a zotavení systému po chybě

Tohle jsou tři různé věci. Vypadají podobně, ale zapisují na jiné místo.

**Uložení** děláte vy. Aplikace zapíše projekt do vašeho souboru a odstraní značku *Neuloženo*.

**AutoSave** je ve výchozím stavu vypnutý. Zapnete ho sami pro každý projekt. Aplikace pak bez okna zapisuje do stejného souboru při každé změně, nejvýš jednou za deset sekund. Funguje jen tehdy, když projekt už má soubor. Viz [Zapnutí AutoSave](docs://howto-automatisch-opslaan).

**Zotavení systému po chybě** je vždy zapnuté. Při každé změně kdekoli aplikace také nejvýš jednou za deset sekund uchovává záložní kopii všech otevřených projektů, včetně projektů, které jste sami nezměnili. Tato kopie není v souboru projektu. V desktopové aplikaci je ve složce dat aplikace, v prohlížeči v úložišti prohlížeče. Při dalším spuštění aplikace kopii nabídne. Přečtěte si o tom v [Obnovení po chybě](docs://howto-herstellen-na-een-crash). Zotavení systému po chybě nikdy nezapisuje do souboru projektu.

Protože se kopie uchovává nejvýš jednou za deset sekund, můžete při chybě přijít o posledních pár sekund práce.

### Počítačová aplikace a prohlížeč

Počítačová aplikace a verze v prohlížeči dělají s vaším projektem totéž, ale soubory zapisují jinak.

Na počítači pracuje aplikace se skutečnými cestami k souborům. *Uložit* zapíše přímo do vašeho souboru. Obvykle nejdřív zapíše do dočasného souboru vedle něj (`.ops-save.tmp`) a teprve potom nahradí váš soubor. Chyba uprostřed zápisu tak neporuší váš starý soubor. Když aplikaci zavřete se změnami, zeptá se u každého projektu, zda ho chcete uložit. Při řádném ukončení smaže své záložní kopie.

V prohlížeči, který umí ukládat soubory kamkoli chcete (například Chrome a Edge), dostanete běžné okno pro otevření a uložení. Potom *Uložit* zapisuje přímo do souboru. U souboru, který jste otevřeli, prohlížeč jednou požádá o oprávnění. Seznam *Nedávné* funguje, jen s názvy souborů.

V prohlížeči bez této schopnosti (například Firefox) otevře aplikace soubor přes výběr souboru a uloží ho jako stažení. U příkazu *Uložit* se zobrazí hlášení *Uloženo jako stažený soubor: „name.ifc“ je ve složce Stažené. …*, které jednou za relaci vysvětlí tento postup. U příkazu *Uložit jako* a u exportů vidíte *Uloženo jako stažený soubor: „name.ifc“ je nyní ve složce Stažené. Toto prostředí neumožňuje aplikaci zapisovat přímo na zvolené místo.* Pokud prohlížeč umí ukázat okno pro uložení, ale nemůže zapisovat zpět do souboru projektu, *Uložit* se pokaždé znovu zeptá na místo. Také to jednou za relaci vysvětlí hlášení. Položka *Soubor › Nedávné* existuje, ale otevře prázdnou stránku, a AutoSave není k dispozici. Stejné hlášení dostanete v každém prostředí, které aplikaci nedovolí zapisovat na místo, jež jste zvolili.

## Příklad: export ukázkového projektu

Vezměte ukázku *Refurbishment & Extension of a Family Home* (na kartě *Soubor › Příklady*). Má 20 úkolů, z toho 4 fáze a 2 milníky, a 16 závislostí. Je tam 6 zdrojů s 8 přiřazeními, 1 směrný plán a propojení s knihovnou zdrojů *Demo resource library*. Úkol *Demolish existing extension* má omezení *Zahájit nejdříve (SNET)* s datem 14. května 2027. Úkol *Handover inspection* má konečný termín 29. července 2027. Plán končí 7. července 2027.

Takto se projekt vrací z každého formátu. Měří se po novém otevření exportního souboru:

- Soubor IFC vrátí všechno: 20 úkolů, 16 závislostí, 6 zdrojů, 8 přiřazení, směrný plán, omezení, konečný termín a propojení s knihovnou. Plán znovu končí 7. července 2027.
- Soubor MS Project XML vrátí také všechno kromě propojení s knihovnou. Plán končí 7. července 2027.
- Soubor P6 XML vrátí úkoly, závislosti, zdroje, přiřazení a omezení. Směrný plán a konečný termín chybí. Plán pořád končí 7. července 2027, protože omezení v něm ještě je.
- Soubor CSV vrátí 20 úkolů a 16 závislostí. Zdroje, přiřazení, směrný plán, omezení a konečný termín chybí a projekt se jmenuje *CSV Import*. Bez omezení se úkoly posunou dopředu: plán končí 2. července 2027, o pět kalendářních dnů dříve.

Bez toho omezení by sám příklad také končil 2. července 2027. Rozdíl tedy vzniká omezením, které soubor CSV nepřenese.

## Důsledky a nedorozumění

**Export není záloha.** Jen IFC uchová všechno. Chcete-li projekt zachovat, uložte ho jako IFC. Exportujte jen pro někoho, kdo potřebuje jiný formát.

**Opětovné otevření exportu nemusí dát stejný plán.** Aplikace při otevření vždy přepočítá plán s profilem výpočtu, který patří k formátu. Když logika chybí, jako omezení v příkladu s CSV, nebo když profil vypočítá jinak, výsledek se změní.

**Export je také v seznamu *Nedávné*.** Na počítači a v prohlížečích s přístupem k souborům se export dostane do seznamu *Nedávné*, stejně jako uložený projekt (přehledy průběhu ne). Když ho tam otevřete, otevře se jako import toho formátu.

**Uložení není totéž co zotavení systému po chybě.** Zotavení pomáhá po chybě, ale uložení nenahrazuje. Proto uložte dřív, než zavřete kartu nebo aplikaci.

## Viz také

- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): postup pro otevření, uložení a uložení jako.
- [Export](docs://howto-exporteren): výběr formátu a to, co dostanete.
- [Data tak, jak byla uložena](docs://uitleg-datums-zoals-opgeslagen): proč importovaný plán může ukazovat jiná data.
- [Omezení a konečné termíny](docs://uitleg-constraints): co omezení dělá a co zmizí, když chybí.
- [Závislosti a prodlevy](docs://uitleg-relaties): co je prodleva a jak ji aplikace vypočítá.
- [Vytvoření překlenovacího úkolu](docs://howto-hammock): co je překlenovací úkol a jak ho export zapíše jako běžný úkol.
- [Kódy a vlastní pole](docs://howto-codes-en-velden): kódy aktivit a vlastní pole, které uchovává jen IFC.
- [Vazby mezi projekty](docs://howto-externe-relaties): vazby, které MS Project XML a P6 XML nepřenášejí.
- [Uložení a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren): směrné plány, z nichž MS Project XML přenese jen aktivní.
- [Formáty pro import a export](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
