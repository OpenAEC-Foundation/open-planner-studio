# Otevírání a ukládání souboru

Cíl: otevřít projekt ze souboru a zachovat své změny.

## Kdy to potřebujete

Začínáte den s včerejším projektem, dostanete soubor od kolegy nebo z jiného balíku, nebo chcete uložit mezistav, než něco velkého změníte. Co aplikace ukládá do souboru a proč jen IFC uchová celý váš projekt, vysvětluje [Soubory a formáty](docs://uitleg-bestanden).

## Postup

### Otevření souboru

1. Zvolte *Domů › Soubor › Otevřít*, nebo *Soubor › Otevřít*, nebo stiskněte Ctrl+O (na Macu ⌘+O). *Otevřít* je také v liště úplně nahoře. Skupina *Soubor* je také na kartě *Tabulka*.
2. Zvolte soubor. Najednou otevřete jen jeden soubor. Na počítači a v prohlížečích s přístupem k souborům, jako jsou Chrome a Edge, okno ukazuje seznam typů souborů: *Všechny podporované*, *Soubory IFC*, *Soubory CSV*, *Soubory XML*, *Soubory MS Project* a *Soubory Primavera XER*.
3. Projekt se otevře na nové kartě. Pokud byla aktuální karta ještě prázdná a beze změn, otevře se projekt v ní.

Soubor IFC dá kartě svůj název souboru. Projekt z jiného formátu dostane svůj název projektu.

Aplikace otevře `.ifc`, `.csv`, `.xml` (MS Project XML nebo Primavera P6 XML), `.mpp` a `.xer`. Pro poslední dva formáty existují samostatné postupy v článcích [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen) a [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen).

### Otevření nedávného projektu

Zvolte *Domů › Soubor › Nedávné* a klikněte na soubor v seznamu, nebo zvolte *Soubor › Nedávné*. Seznam uchovává posledních deset souborů, které jste otevřeli, uložili nebo exportovali. Desktopová aplikace u každého souboru ukazuje cestu, prohlížeč jen název.

Pokud aplikace soubor v seznamu už nedokáže přečíst, například proto, že jste ho přesunuli, zmizí ze seznamu bez upozornění. V prohlížečích bez přístupu k souborům, jako je Firefox, zůstane *Nedávné* prázdné.

### Otevření příkladu

Zvolte *Soubor › Příklady* a klikněte na ukázkový projekt. Otevře se na kartě bez souboru, takže *Uložit* se proto zeptá, kde ho chcete uložit.

### Ukládání

Zvolte *Domů › Soubor › Uložit*, nebo *Soubor › Uložit*, nebo stiskněte Ctrl+S. Co se pak stane, závisí na vašem projektu:

1. Pokud projekt už má soubor, protože jste otevřeli soubor IFC nebo jste ho dříve uložili, aplikace zapíše do tohoto souboru. Žádné okno se neobjeví.
2. Pokud projekt zatím žádný soubor nemá, aplikace se zeptá, kam ho uložit. Navrhne název projektu s příponou `.ifc`. Potom se tento soubor stane souborem projektu.
3. Pokud váš prohlížeč ukládá jen stažením (například Firefox), soubor skončí ve složce Stažené soubory a každé uložení vytvoří nové stažení. Poprvé v relaci uvidíte hlášení *Uloženo jako stažení: „name.ifc“ je ve složce Stažené soubory. Tento prohlížeč nedovoluje aplikaci zapisovat na vlastní místo, takže každé uložení vytvoří nové stažení. V Chrome, Edge nebo desktopové aplikaci Uložit jen aktualizuje stejný soubor.*
4. Pokud prohlížeč nedokáže zapsat zpět do souboru projektu, aplikace se při každém uložení znovu zeptá, kam soubor uložit. Vypadá to jako *Uložit jako*, ale je to omezení prohlížeče. Poprvé v relaci to vysvětlí hlášení *Tento prohlížeč nedovoluje aplikaci zapsat zpět do „name.ifc“.*, které vede na článek [Soubory](docs://uitleg-bestanden).

Po uložení zmizí značka *Neuloženo*: tečka na kartě, hvězdička před názvem projektu nahoře a text *Neuloženo* vpravo dole ve stavovém řádku.

### Uložení pod jiným názvem

Zvolte *Domů › Soubor › Uložit jako*, nebo *Soubor › Uložit jako*, nebo stiskněte Ctrl+Shift+S. Zvolte název a místo (ve Firefoxu aplikace místo toho stáhne nový soubor). Potom projekt pracuje s tímto novým souborem: příští *Uložit* zapíše do něj. Starý soubor zůstane takový, jaký byl při posledním uložení.

### Zavření projektu

Klikněte na křížek na kartě, nebo zvolte *Soubor › Zavřít projekt*. Pokud má projekt změny, které jste neuložili, aplikace se zeptá: *Neuložené změny: „name“ obsahuje změny, které ještě nebyly uloženy.* Zvolíte *Zrušit* (projekt zůstane otevřený), *Neukládat* (projekt se zavře a vaše změny zmizí), nebo *Uložit* (nejdřív uložit, pak zavřít). Pokud zavřete celou aplikaci na počítači (tlačítkem zavřít, klávesou Alt+F4 nebo nabídkou operačního systému), zeptá se u každého projektu se změnami. *Zrušit* nebo neúspěšné uložení zastaví zavírání. Po běžném zavření aplikace smaže záložní kopie obnovy z této relace, takže se okno obnovy zobrazí jen po skutečném pádu. Pokud má projekt změny a zavřete kartu nebo okno prohlížeče, prohlížeč požádá o potvrzení.

## Úskalí a co aplikace potom udělá

**Otevřený soubor IFC se hned stane souborem vašeho projektu.** *Uložit* přepíše tento soubor, i když pochází z jiného programu. Pokud chcete originál zachovat, zvolte nejdřív *Uložit jako*.

**Jiné formáty se nikdy nepřepisují.** Projekt z `.csv`, `.xml`, `.mpp` nebo `.xer` nemá po otevření žádný soubor. *Uložit* zapíše nový soubor IFC a původní soubor nechá být.

**Ve Firefoxu vytvoří každé uložení nový soubor.** Aplikace tam nemůže zapisovat do vašeho souboru. Při každém uložení stáhne nový soubor s názvem projektu, ne s názvem souboru, který jste otevřeli.

**Chrome a Edge žádají o povolení.** Při prvním použití příkazu *Uložit* u otevřeného souboru se prohlížeč zeptá, zda smí aplikace do něj zapisovat. Pokud odmítnete, aplikace otevře okno, ve kterém zvolíte nový soubor. V Chrome a Edge se toto okno objeví i tehdy, když zápis do existujícího souboru selže, například protože soubor zmizel nebo je zamčený.

**Uložení může selhat.** Pokud samotné uložení vrátí chybu, aplikace nahlásí *Uložení se nezdařilo* a důvod. Váš projekt zůstane otevřený a dál bude označen jako *Neuloženo*.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): co je v souboru IFC a jak aplikace zachází s formáty.
- [Zapnutí automatického ukládání](docs://howto-automatisch-opslaan): nechte aplikaci aktualizovat váš soubor sama.
- [Export](docs://howto-exporteren): vytvoření kopie v jiném formátu.
- [Obnovení po pádu](docs://howto-herstellen-na-een-crash): co uděláte, když se aplikace neukončila správně.
- [Formáty pro import a export](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
