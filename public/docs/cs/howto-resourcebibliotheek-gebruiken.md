# Práce s knihovnou zdrojů

Cíl: používat zdroje z knihovny zdrojů ve vašem projektu a přidat do knihovny zdroj, který jste vytvořili v projektu, aby všechny projekty používaly stejná data.

## Kdy to potřebujete

Máte pevnou partu zedníků, jeřáb a omítkáře, kteří se objevují v několika projektech. Bez knihovny je v každém projektu zadáte znovu, s rizikem jiných názvů a standardních sazeb, a žádný projekt nevidí, že o stejnou partu žádá i jiný. V knihovně je zaznamenáte jen jednou.

Co knihovna je a co z ní projekt přebírá, si přečtete v článku [Knihovna zdrojů](docs://uitleg-resourcebibliotheek). Tento článek se týká úkonů. Vytváření, exportu a mazání knihoven popisuje článek [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren).

## Kroky

### 1. Propojte projekt s knihovnou

S knihovnou pracujete jen tehdy, když je projekt s ní propojený. Bez propojení panel *Zdroje* nezobrazuje přepínač *Knihovna*, *Projekt* a *Obsazenost*.

Pro nový projekt:

1. Zvolte *Soubor › Nový*. Otevře se okno *Nový projekt*.
2. Podívejte se na pole *Knihovna zdrojů*. Pole je nastaveno na výchozí knihovnu. Můžete zvolit jinou, *žádná knihovna (samostatný projekt)* nebo *+ Nová knihovna zdrojů…*.
3. Klikněte na *Vytvořit*.

Pro existující projekt:

1. Zvolte *Soubor › Info o projektu*.
2. V poli *Knihovna zdrojů* zvolte knihovnu.
3. Klikněte na *Použít*. Do té doby je dole vidět *Změny nebyly použity — klikněte na Použít, aby se uchovaly.*

Pokud projekt už má zdroje se stejným názvem jako položka knihovny, otevře se okno *Propojit knihovnu zdrojů* se sekcí *Rozpoznáno*. U každého zdroje, který se shoduje, je *Návrh: Bricklayer*. Klikněte na *Propojit*, chcete-li propojit tento zdroj, nebo na *Propojit všechny návrhy*, pokud je návrhů více. Aplikace porovnává názvy bez ohledu na velká písmena a dvojité mezery. Při propojení zdroj převezme název, typ, sazbu, jednotku a popis z položky knihovny. *Maximální počet jednotek* zůstane takový, jaký jste měli v projektu. Okno také ukazuje kalendáře projektu, které mají stejný název jako kalendář v knihovně. Tlačítkem *Rozhodnout později* okno zavřete bez propojení.

### 2. Dejte zdroj do knihovny

1. Zvolte *Zdroje › Správa › Zdroje*. Panel zdrojů převezme celou pracovní plochu. Vždy se otevře na *Projekt*, i u propojeného projektu.
2. V pravém horním rohu zvolte zobrazení *Knihovna*. Nad tabulkou je text *Tím se upravuje knihovna a platí to pro všechny projekty — nelze to vrátit zpět.*
3. Klikněte na *Nový zdroj v knihovně*. Dole v tabulce se objeví prázdný řádek.
4. Napište název, například *Bricklayer*, a stiskněte Enter. Zdroj je nyní v knihovně a hned se otevře prázdný řádek pro další. Až skončíte, stiskněte Esc. Bez názvu aplikace nic nevytvoří.
5. Vyplňte zbytek řádku. *Typ* je ve výchozím nastavení *Práce*. V poli *Maximální počet jednotek* zadejte, kolik je celkem tohoto zdroje, například 3 pro tři zedníky. Přehled obsazenosti použije toto číslo jako kapacitu. *Standardní sazba/hod* je nepovinná. Pole *Jednotka* můžete vyplnit jen u typu *Materiál*. V poli *Kalendář* zvolte kalendář z knihovny, nebo *+ Kalendář zdroje* a vytvořte nový. Viz [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen). Aplikace uloží název, sazbu a jednotku, až opustíte pole, a ostatní pole hned.

Každá změna v knihovně se okamžitě projeví v nezměněných kopiích ve vašich otevřených projektech.

### 3. Přiřaďte zdroj k projektu

1. V zobrazení *Knihovna* zvolte u zdroje *Přiřadit k projektu*. Nad tabulkou je *Přidáno.* Když kliknete znovu, zobrazí se *Už je v projektu.* a žádná druhá kopie se nevytvoří.
2. Zvolte *Projekt*. Kopie je v tabulce s malou ikonou knihovny u názvu, s označením *Z knihovny*. Název, typ, sazba a jednotka jsou obyčejný text. Když podržíte myš nad nimi, uvidíte *Hodnota z knihovny — upravte ji v zobrazení Knihovna, nebo tento zdroj od knihovny odpojte.*
3. Nastavte *Maximální počet jednotek* pro tento projekt. Pole začíná s hodnotou z knihovny a v projektu ji lze dál měnit.
4. Zdroj nyní přiřaďte k úkolům stejně jako jiné zdroje, viz [Přiřazování zdrojů s křivkou](docs://howto-resource-toewijzen). *Zdroje › Přiřazení › Přiřadit* ukáže jen zdroje, které jsou už v projektu. Proto nejdřív přiřaďte zdroj z knihovny k projektu tímto způsobem.

*Přiřadit k projektu* je jen v zobrazení *Knihovna* projektu, který je propojený s touto knihovnou.

### 4. Přeneste zdroj z projektu do knihovny

Uděláte to u zdroje, který jste vytvořili v projektu a používáte častěji, například u pronajatého jeřábu.

1. V zobrazení *Projekt* zvolte u zdroje *Do knihovny*. Tlačítko se objeví jen u zdroje, který má název a ještě nepochází z knihovny, v propojeném projektu.
2. Přečtěte si zprávu nad tabulkou.

Zpráva může říkat tyto tři věci:

- *Přidáno.* Knihovna neměla položku s tímto názvem. Vytvořila se nová položka a váš zdroj je k ní propojen.
- *Již existovalo v knihovně zdrojů — nyní propojeno.* Položka se stejným názvem a stejnými daty už existovala. Váš zdroj je k ní propojen.
- *Propojeno s existující položkou knihovny zdrojů — hodnoty se liší, viz označení.* Položka se stejným názvem, ale jinými daty už existovala. Váš zdroj je propojen a hned je označen *se liší — rozhodněte*. Pokračujte krokem 6.

### 5. Odpojte kopii

Chcete-li se v jednom projektu od knihovny odchýlit, například s jinou sazbou, kopii odpojte.

1. V zobrazení *Projekt* klikněte na ikonu *Odpojit od knihovny* na konci řádku.
2. Zdroj je nyní běžný zdroj projektu. Všechna pole lze upravovat a už nesleduje knihovnu. Kalendář, který přišel spolu se zdrojem, se také odpojí, ledaže ho v tomto projektu ještě sleduje jiný zdroj.

Pomocí *Vrátit zpět* (Ctrl+Z) odpojení vrátíte.

### 6. Vyřešte odchylku

Kopie s označením *se liší — rozhodněte* se liší od položky knihovny. Aplikace nevybírá, kdo má pravdu.

1. Klikněte na označení *se liší — rozhodněte* u zdroje. Otevře se okno *Propojit knihovnu zdrojů*. Otevře se také samo, když otevřete soubor s takovou kopií.
2. V sekci *Odchylky* zvolte, co chcete pro položku, viz níže.
3. Pokud se zatím nechcete rozhodnout, klikněte na *Rozhodnout později*. Okno se zavře a označení zůstane.

U odchylky máte dvě možnosti:

- *Použít hodnoty z knihovny*: kopie převezme data z knihovny.
- *Převzít hodnoty ze souboru do knihovny*: knihovna převezme data z vaší kopie. Pod tím je text *Pozor: tím se změní knihovna a platí to pro všechny vaše projekty.* Kopie v ostatních otevřených projektech se podle toho také změní.

## Úskalí a co aplikace potom udělá

**Příklady projektů mají vlastní knihovnu.** Když otevřete jeden ze tří ukázkových příkladů (*Soubor › Příklady*, nebo přes propojení v nápovědě), aplikace jednou vytvoří knihovnu *Demo knihovna zdrojů* a propojí s ní projekt. Zdroje projektu se stejným názvem jako položka knihovny se propojí hned; kalendáře ne. Vaše vlastní knihovny zůstanou beze změny. Když otevřete dva ukázkové příklady vedle sebe, společně ukážou konflikty v [Práce s přehledem obsazenosti](docs://howto-bezettingsoverzicht-gebruiken), například u zedníků (*Masonry crew*) mezi *Refurbishment & Extension of a Family Home* a *6 New Terraced Houses, De Akkers*.

**Nevidíte přepínač.** Projekt není propojený s knihovnou. Proveďte krok 1.

**Upravíte knihovnu omylem.** Panel se vždy otevře na *Projekt*, aby se tomu zabránilo. Změny v zobrazení *Knihovna* platí pro všechny projekty a jsou mimo *Vrátit zpět*.

**Smažete zdroj z knihovny.** Aplikace se nejdřív zeptá: *Odebrat 'Bricklayer' z knihovny? Platí to pro všechny projekty a nelze to vrátit zpět.* Kopie v projektech zůstanou a dál fungují. Dostanou označení *už není v knihovně* a lze je plně upravovat. Tlačítkem *Odebrat z projektu* kopii z projektu vyřadíte.

**V poli *Knihovna zdrojů* zvolíte jinou knihovnu nebo *žádná knihovna (samostatný projekt)*.** Označení původu z předchozí knihovny zmizí. Zdroje zůstanou v projektu jako běžné zdroje projektu. Při jiné knihovně aplikace znovu hledá zdroje se stejným názvem.

**Zdroj nemá návrh v sekci *Rozpoznáno*.** Zobrazí se *Bez návrhu — vyberte ručně*, ale toto okno nemá tlačítko pro ruční výběr. To vypadá jako nedostatek. Dejte takový zdroj do knihovny tlačítkem *Do knihovny* (krok 4).

## Viz také

- [Knihovna zdrojů](docs://uitleg-resourcebibliotheek): co rozhoduje knihovna, co rozhoduje projekt a jak kopie sledují změny.
- [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren): vytváření, export a import knihoven.
- [Práce s přehledem obsazenosti](docs://howto-bezettingsoverzicht-gebruiken): zjištění, zda dva projekty žádají stejný zdroj ve stejný čas.
- [Správa zdrojů](docs://howto-resources-beheren): zdroje jednoho projektu.
