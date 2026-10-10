# Panel zdrojů

Panel zdrojů je místo, kde spravujete zdroje: kdo a co je k dispozici, s jakou kapacitou a v jakém kalendáři. K panelu patří také histogram pod diagramem Gantt a přetížení. Tento článek popisuje u každého pole a tlačítka, co dělá, jaká je výchozí hodnota a čeho si všimnete. Jak vytvořit zdroje a jak je přiřadit, je popsáno v článcích [Správa zdrojů](docs://howto-resources-beheren) a [Přiřazení zdrojů pomocí křivky](docs://howto-resource-toewijzen). Řešení přetížení je v článku [Řešení přetížení](docs://howto-overbezetting-oplossen).

## Kde to najdete

- **Celý panel** — *Zdroje › Správa › Zdroje* nebo *Zobrazení › Panely › Zdroje*. Panel zabere celou pracovní plochu. Křížek vpravo nahoře jej zavře.
- **Ukotvit zdroje** — *Zdroje › Správa › Ukotvit zdroje* nebo *Zobrazení › Panely › Ukotvit zdroje*: kompaktní seznam v pravé části vedle diagramu Gantt. Viz níže.
- **Histogram** — *Zdroje › Histogram › Histogram* nebo *Zobrazení › Panely › Histogram*: pás pod diagramem Gantt. Viz níže.
- **Zobrazení** — když projekt patří ke knihovně zdrojů, je vpravo nahoře v panelu volba mezi zobrazeními *Knihovna*, *Projekt* a *Obsazenost*. Bez knihovny je k dispozici jen tabulka projektu. Při každém otevření začne panel na *Projekt*, takže se nedostanete do sdílené knihovny bez toho, abyste si toho všimli.

## Nový zdroj

- **Nový zdroj v projektu** (v zobrazení *Knihovna* tlačítkem *Nový zdroj v knihovně*) — tlačítko vpravo nahoře. Otevře rozpracovaný řádek v dolní části tabulky. Nic se nevytvoří, dokud nezadáte název a neopustíte řádek nebo nestisknete Enter. Když kliknete mimo prázdný řádek nebo stisknete Esc, nezůstane po něm nic: žádný zdroj a žádný krok pod *Vrátit zpět*. Pole můžete vyplnit v libovolném pořadí; vše se uloží najednou. Enter nebo šipka dolů řádek potvrdí a otevře nový rozpracovaný řádek. Shift+Enter nebo šipka nahoru jej potvrdí a vrátí vás do tabulky. Rozpracovaný řádek nemá rozbalovací šipku pro kapacitu, tužku pro kalendář ani koš, protože ty pracují se zdrojem, který ještě neexistuje. Tlačítko *Nový zdroj* na kartě *Zdroje › Správa* dělá totéž.
- **Pohyb v tabulce** — v tabulce přesouvají klávesy Enter a Shift+Enter a šipky nahoru a dolů kurzor mezi řádky. Enter na posledním řádku otevře nový rozpracovaný řádek.

## Zobrazení Projekt

Tabulka toho, co tento projekt používá. Každý řádek je jeden zdroj. Změny textu a sazby platí, jakmile opustíte pole, a počítají se jako jeden krok pod *Vrátit zpět*.

- **Barva** — výběr barvy. Výchozí: první volná barva z palety. Účinek: barva zvýraznění zdrojů pod pruhy v diagramu Gantt (*Zobrazení › Směrné plány a průběh › Zvýraznění zdrojů*) a barva čtverečku v panelu Ukotvit zdroje.
- **Název** — název zdroje. Prázdný název se neuloží; pole se vrátí ke starému názvu.
- **Typ** — *Práce*, *Vybavení*, *Materiál*, *Subdodavatel* nebo *Parta*. Výchozí pro nový zdroj: *Práce*. Účinek: *Materiál* má pole *Jednotka* a nepočítá se do součtu *Všechny zdroje* v histogramu. Při vyrovnání se materiál přeskočí. Zdroj typu *Parta* lze vybrat jako *Parta* u jiných zdrojů. Ostatní typy se počítají stejně.
- **Maximální počet jednotek** — kolik zdroje je k dispozici za den. Číslo větší než 0; desetinná čísla jsou povolena. Výchozí: 1. Účinek: kapacita za den. Je-li zátěž vyšší, je zdroj přetížen. Šipka vedle pole rozbalí položku *Kapacita podle období*; číslo u šipky je počet kroků.
- **Kapacita podle období** — kroky s polem *Od* (datum) a *Maximální počet jednotek*. Tlačítko *Přidat krok* přidá krok s dnešním datem a hodnotou 1. Bez kroků se zobrazí *Žádné kroky — platí vždy plochý maximální počet jednotek*. Účinek: od data kroku platí jeho *Maximální počet jednotek* místo ploché hodnoty. Rozhoduje poslední krok s datem na tento den nebo dříve.
- **Kalendář** — seznam s položkami *Kalendář projektu* (výchozí), kalendáři projektu a *+ Kalendář zdroje* pro nový. Tužka (*Upravit*…) otevře zvolený kalendář a je neaktivní u položky *Kalendář projektu*. Účinek: dny, kdy zdroj pracuje. V den volna je kapacita 0. Je-li tehdy plánovaná práce, je zdroj přetížen s důvodem *Podle kalendáře „…“ v tento den nepracuje*. Kalendář zdroje nemění data úkolu. Viz [Okna kalendářů](docs://ref-kalenders).
- **Standardní sazba/hod** — náklady za hodinu. Prázdné pole znamená žádnou sazbu. Neplatné číslo se vrátí k předchozí hodnotě. Účinek: žádný vliv na plán ani na zátěž. Sazba určuje sloupec *Celkem*, je uložena v souboru IFC a při exportu se zapíše do MS Project (standardní sazba) a do Primavera P6 XML (náklady na jednotku).
- **Celkem** — jen pro čtení: hodiny zátěže × sazba, se dvěma desetinnými místy; *—* bez sazby nebo zátěže. Dole řádek *Celkem* sečte všechny zdroje. Hodiny pocházejí z posledního výpočtu a počítají jednotky × hodiny za den podle kalendáře úkolu. Jsou-li zastaralé, stiskněte tlačítko *Přepočítat*.
- **Jednotka** — měrná jednotka materiálu, například `m³`. Lze ji vyplnit jen u typu *Materiál* (nápověda *Vyplňte pouze u zdrojů typu Materiál*.). Účinek: popisek; nic se nepočítá.
- **Parta** — parta, ke které zdroj patří. Vybírá se ze zdrojů typu *Parta*. Výchozí: *Žádná*. Účinek: jen seskupení. Kapacita a zátěž party se nerovnají součtu jejích členů.
- **Odstranit** (koš) — odstraní zdroj. Má-li zdroj přiřazení, aplikace se nejdřív zeptá *'…' má … přiřazení — odstranit?* Potvrdíte zaškrtnutím, zrušíte křížkem.
- **Do knihovny** — jen pokud projekt patří ke knihovně zdrojů, a jen u zdroje, jehož název dosud nepochází z knihovny. Uloží zdroj do knihovny, nebo ho propojí s existující položkou se stejným názvem, a oznámí, co se stalo: *Přidáno*, *Již existovalo v knihovně zdrojů — nyní propojeno* nebo *Propojeno s existující položkou knihovny zdrojů — hodnoty se liší, viz označení*.
- **Odpojit od knihovny** — ikona odpojení u zdroje, který pochází z knihovny. Odstraní propojení s knihovnou. Potom jsou všechna pole zase volná.

Bez zdrojů se zobrazí *Zatím žádné zdroje. Přidejte první, abyste mohli začít*. Patří-li projekt ke knihovně zdrojů, zobrazí se *Tento projekt zatím nepoužívá žádné zdroje z knihovny*, s nápovědou.

### Zdroje z knihovny

Zdroj, který pochází z knihovny, má malou ikonu knihovny (*Z knihovny*). Jeho pole *Název*, *Typ*, *Standardní sazba/hod* a *Jednotka* jsou potom jen text (*Hodnota z knihovny — upravte ji v zobrazení Knihovna, nebo tento zdroj od knihovny odpojte*.), protože o tom, čím zdroj je, rozhoduje knihovna. *Barva*, *Maximální počet jednotek*, kroky kapacity, *Kalendář* a *Parta* zůstanou upravitelné, protože o tom, kolik a kdy, rozhoduje projekt. Mohou se zobrazit dva štítky: *se liší — rozhodněte* (kliknutím se otevře okno *Propojit knihovnu zdrojů*) a *už není v knihovně*, s tlačítkem *Odebrat z projektu*.

## Zobrazení Knihovna

Jen tehdy, když projekt patří ke knihovně zdrojů. Viz [Práce s knihovnou zdrojů](docs://howto-resourcebibliotheek-gebruiken) a [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren). Nahoře je barevné upozornění: *Tím se upravuje knihovna a platí to pro všechny projekty — nelze to vrátit zpět*. Tabulka má stejná pole jako zobrazení *Projekt*, s těmito rozdíly:

- Sloupec *Celkem* tu není, protože jde o výpočet pro jeden projekt.
- Sloupec *Parta* je tu, jakmile knihovna obsahuje zdroje.
- Sloupec *Kalendář* nabízí kalendáře knihovny; výchozí je *Žádný kalendář*.
- **Přiřadit k projektu** — zařadí zdroj do projektu s kopií jeho kalendáře. Oznámí *Přidáno* nebo *Už je v projektu*.
- **Odstranit** — zeptá se: *Odebrat '…' z knihovny? Platí to pro všechny projekty a nelze to vrátit zpět*.
- Bez zdrojů se zobrazí *V knihovně zdrojů zatím nejsou žádné zdroje*.

## Zobrazení Obsazenost

Zobrazení jen pro čtení přes všechny otevřené dokumenty ukazuje, které zdroje z knihovny jsou kde zarezervované. Tlačítko pro nový zdroj tu není. Viz [Práce s přehledem obsazenosti](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabulka** — pro každý zdroj z knihovny: *Název*, *Dokumenty* (počet dokumentů, ve kterých je), *Období* a *Špička / kapacita* (nejvyšší společná zátěž proti kapacitě v daný den). Červeně označené *N dnů přetíženo* znamená, že ve více dokumentech má zdroj víc, než je jeho kapacita. Šipka vedle názvu rozbalí dokumenty, každý s obdobím a špičkou. Kliknutím na řádek se zobrazí histogram tohoto zdroje (*Vyberte zdroj a zobrazí se histogram*.).
- **Co se počítá** — jen dokumenty otevřené v této aplikaci (*Tento přehled vidí jen dokumenty otevřené v této aplikaci*.). Dokument, který nebyl přepočítán, dostane na svém řádku zprávu. Aktivní dokument se počítá podle posledních přepočtených čísel (*Zastaralé: jde o naposledy přepočítaná čísla — stiskněte F5 v tomto dokumentu*.). Přehled předem přepočítá jiný dokument (*Pro tento přehled předem přepočítáno — samotný dokument ukazuje starší data, dokud v něm nestisknete F5 nebo nezapnete „Automaticky přepočítat“*.). Je-li zapnuto *Automaticky přepočítat*, přehled ty dokumenty skutečně přepočítá. Selže-li přepočet, dokument se nepočítá (*Nezapočítává se: plán nebyl přepočítán — aktivujte tento dokument a stiskněte F5*.). Bez zarezervovaných zdrojů se zobrazí *V otevřených dokumentech nejsou zarezervovány žádné zdroje z knihovny*.
- **Pořadí** — nahoře jsou zdroje s dvojí rezervací, nejdřív ty s nejvíce dny se střetem, potom podle abecedy.

## Ukotvit zdroje

Kompaktní seznam v pravém sloupci vedle panelu *Vlastnosti*. Pro každý zdroj: barevný čtvereček, název (jen pro čtení), červený trojúhelník *Přetížen*, jakmile má zdroj aspoň jeden přetížený den, a pole Maximální počet jednotek k úpravě. Je-li vybrán úkol, seznam obsahuje jen zdroje těchto úkolů. V záhlaví jsou tlačítka *Celý panel* (otevře celý panel) a *Zavřít panel*. Bez zdrojů se zobrazí *Zatím žádné zdroje. Přidejte první, abyste mohli začít*.

## Histogram

Pás pod diagramem Gantt, který ukazuje zátěž zdroje po dnech. Zapnete jej nebo vypnete na kartě *Zdroje › Histogram › Histogram* nebo na kartě *Zobrazení › Panely › Histogram*. Výchozí: vypnuto. Vaše volba se zapamatuje. Výška je ve výchozím stavu 160 pixelů a dá se táhnout za hranu mezi diagramem Gantt a histogramem.

- **Výběr** — vlevo pod tabulkou úkolů je seznam: nahoře připnuté *Všechny zdroje* a pod nimi jeden řádek na zdroj. Kliknutím zvolíte řádek, šipkami procházíte seznam a stejně to dělají *Zdroje › Histogram › Předchozí* a *Další*. Červená tečka vedle řádku znamená, že zdroj má aspoň jeden přetížený den. U položky *Všechny zdroje* se tečka dívá jen na zdroje, které nejsou materiál. Je-li vybrán úkol, seznam obsahuje jen zdroje těchto úkolů. Není-li zvolený zdroj v tomto výběru, pás dočasně ukáže *Všechny zdroje* z výběru.
- **Sloupce** — jeden sloupec za den: zátěž v jednotkách. Čára ukazuje kapacitu a část sloupce nad kapacitou je červená. Vlevo nahoře je nejvyšší hodnota s označením *jednotky*. *Všechny zdroje* sečte zátěž a kapacitu všech zdrojů kromě materiálu.
- **Bublina nápovědy** — podržte myš nad dnem bez pohybu. Zobrazí se *N úkolů přispívá dne {date}* s názvy nejvýše osmi úkolů. U zvoleného zdroje a dne, kdy jeho kalendář nepracuje, se navíc zobrazí *Podle kalendáře „…“ v tento den nepracuje*.
- **Zprávy v pásu** — *Přepočítejte (F5), aby se zobrazilo vytížení*, dokud není žádná zátěž. *Zatím žádné zdroje* se zobrazí bez zdrojů. *⚠ Plán je zastaralý — přepočítejte (F5)* se zobrazí vpravo nahoře, když je plán zastaralý.
- **Co se počítá** — jednotky přiřazení za den u každého přiřazení, rozložené na pracovní dny úkolu podle pole *Křivka* (nebo *Rozložení práce v čase*). Počítají se jen listové úkoly, ne milníky. Zátěž se obnoví po příkazu *Přepočítat* a po změnách zdrojů a přiřazení. Změníte-li data úkolů, projeví se to až po příkazu *Přepočítat*.

## Přetížení

Zdroj je přetížen v den, kdy je jeho zátěž vyšší než kapacita. Kapacita je *Maximální počet jednotek* (s kroky kapacity) v pracovní den jeho kalendáře a 0 v den volna. Materiál se tu počítá. Příčinou je buď nízká kapacita, nebo den, kdy zdroj podle svého kalendáře nepracuje.

Kde to uvidíte:

- **Zdroje › Přetížení** — počet přetížených zdrojů, nebo *Žádná*.
- **Stavový řádek** — *Přetížení zdrojů: N*; kliknutím se otevře panel *Varování*.
- **Varování** — řádek na každý zdroj *Přetížení v počtu dnů: N (první – poslední)*. Jsou-li všechny dny volné, přidá se *zdroj v tyto dny podle svého kalendáře nepracuje*; u směsi dnů se přidá *z toho N dnů zdroj podle svého kalendáře nepracuje*. Viz [Oznámení a varování](docs://ref-meldingen).
- **Histogram** — červené části sloupců a červená tečka ve výběru.
- **Ukotvit zdroje** — trojúhelník *Přetížen*.

Vyrovnání může přetížení vyřešit posunutím úkolů v jejich časové rezervě. Nevyřeší zdroj, který musí pracovat ve dni volna. Viz [Vyrovnání](docs://uitleg-nivelleren).
