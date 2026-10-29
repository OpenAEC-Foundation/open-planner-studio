# Otevření souboru Primavera P6 (.xer)

Cíl: otevřít plán z Primavera P6 přímo v aplikaci, bez předchozího exportu do XML.

## Kdy to potřebujete

Klient nebo hlavní dodavatel pracuje v Primaveře a dodává svůj plán jako soubor `.xer`. Chcete ho zobrazit, přepočítat nebo do něj přidat. Aplikace jen čte soubory `.xer`. Aplikace nezapisuje soubor `.xer` a váš soubor nikdy nemění. Ze souboru přebírá strukturu WBS a úkoly včetně doby trvání, dat, omezení a průběhu. Dále přebírá závislosti s prodlevou, kalendáře, zdroje a jejich přiřazení. Přebírá také kódy aktivit, vlastní pole (UDF), poznámky a nastavení výpočtu v P6. Úkol typu *Level of Effort* se stane překlenovacím úkolem.

## Postup

1. Zvolte *Domů › Soubor › Otevřít* nebo stiskněte Ctrl+O. Zvolte soubor `.xer`.
2. Aplikace otevře jednu kartu pro každý projekt, který má úkoly. Aktivní karta je projekt s nejvíce úkoly. Karta se jmenuje *Název projektu (ID projektu)*, pokud se ID projektu v P6 liší od názvu. *Nastavení projektu* zobrazuje jen název. Když projekt přejmenujete, ID projektu zůstane za názvem. Okno potom krátce vysvětlí, co aplikace převzala ze souboru a jak funguje ukládání; viz [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan).
3. Přečtěte si zprávu dole. U souboru se třemi projekty může vypadat takto: *Soubor XER otevřen: 3 projektové dokumenty.* Pod ní jsou řádky, které popisují, co aplikace udělala. Viz nadpis níže.
4. Zkontrolujte, zda se pod pásem karet nachází lišta: *Vidíte plán tak, jak ho Primavera uložila; při přepočítání se odchýlí 1 úkol.* Primavera ukládá do souboru vlastní vypočtená data. Pokud se výpočet aplikace od nich liší, aplikace zobrazí data Primavery, dokud nic neměníte. Úkol, který už začal nebo je dokončen, vždy zůstává na svých skutečných datech, stejně jako v Primaveře. Co to znamená a jak přejdete na vlastní výpočet aplikace, je popsáno v [Data tak, jak je uložila Primavera](docs://uitleg-datums-zoals-opgeslagen). Může se také zobrazit zpráva *Tento soubor obsahuje plánování v hodinách.* s tlačítkem *Zapnout plánování v hodinách*. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).
5. Uložte projekt pomocí Ctrl+S. Protože se `.xer` nikdy nepřepisuje, aplikace se zeptá, kam uložit nový soubor IFC. Jako název souboru navrhne *Název projektu (ID projektu)*.

### Řádky pod zprávou

První řádek zprávy uvádí počet otevřených karet. Pod ním jsou jen řádky, které se týkají vašeho souboru. Na tyto řádky věnujte pozornost:

- *Tento projekt se počítá jako Primavera P6. Změnit to lze v nabídce Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu.* Aplikace tento projekt vypočítá podle pravidel výpočtu Primavery. Tlačítkem *Otevřít profil výpočtu* přejdete k nastavení.
- *Vyloučen 1 projekt směrného plánu.* a *Vytvořen 1 směrný plán.* Pokud projekt v P6 označí jiný projekt jako svůj směrný plán, tento jiný projekt se neotevře jako vlastní karta. Stane se aktivním směrným plánem projektu, který ho označil.
- *Byl použit ochranný záložní směrný plán.* Pokud by označení směrných plánů znamenalo, že se neotevře žádný projekt, nebo pokud projekt označí sám sebe, nebo pokud se projekty označí navzájem v kruhu, aplikace jednoduše otevře všechny projekty a žádné směrné plány nevytvoří.
- *Zachována 1 vazba mezi projekty.* Vazba mezi dvěma projekty. Aplikace ji uchová jako zdrojová data, ale nepřevede ji na závislost ve vašem plánu.
- *12 úkolů zobrazuje data tak, jak je Primavera uložila (bez přepočtu).* Počet úkolů, u kterých zobrazení *Data tak, jak je uložila Primavera* ukazuje data Primavery: každý úkol, pro který soubor obsahuje data, ne jen ty, které se liší.

Ostatní řádky jsou diagnostické údaje o samotném čtení. Nic po vás nevyžadují:

- počet nalezených projektů;
- přeskočený prázdný projekt;
- ignorovaný neplatný údaj o směrném plánu;
- kódování textu jiné než prosté UTF-8 (oznámení uvede, které; u arabského, cyrilického nebo řeckého textu aplikace zvolí odpovídající kódovou stránku Windows, jinak Windows-1252);
- úkoly bez plánovaného začátku (začínají v den stavu nebo v den zahájení projektu ze souboru);
- počítadla nálezů v tabulkách, kalendářích a číslech, u neznámých hodnot polí a u nastavení plánování P6, která aplikace nahradila bezpečnou volbou.

*Číst více* otevře nápovědu o otevírání souborů Primavery.

## Úskalí a co aplikace pak udělá

**Ne všechno se stane kartou nebo závislostí.** Projekt bez úkolů se neotevře, projekt směrného plánu se neotevře jako vlastní karta a vazba mezi dvěma projekty se nestane závislostí ve vašem plánu. Aplikace to uvádí v řádcích pod zprávou.

**Každá karta je samostatný projekt.** Když jednu uložíte, soubor IFC si ponechá celý původní `.xer`. Když později znovu otevřete tento soubor IFC, aplikace pořád zná data Primavery. Pokud je zdrojový archiv poškozený nebo soubor IFC přepsal jiný program, aplikace uvede: *Zdrojový archiv XER v tomto souboru je nepoužitelný a byl vynechán; samotný projekt byl otevřen úplně.* Plán, profil výpočtu a všechna data projektu jsou úplná. Chybí: data tak, jak je Primavera uložila, a zdrojový původ pro AI a rozšíření. Otevřete původní `.xer` znovu, aby se archiv vrátil.

**Soubor IFC se zvětší.** Protože soubor IFC nese celý původní `.xer`, je větší než soubor IFC bez archivu. U velkého `.xer` to poznáte na velikosti souboru a na tom, jak dlouho ukládání trvá. Pokud `.xer` otevře několik projektů, každá karta, kterou uložíte, nese celý `.xer`, ne jen svůj projekt.

**Export do CSV, MS Project XML nebo P6 XML ztrácí data.** Aplikace upozorní: *Při exportu do formátu CSV se ztratí zdrojové informace XER.* IFC neztrácí nic.

**Volná sobota nebo neděle, která v souboru není.** Aplikace může takový víkendový den označit za volný sama. Den se pak v kalendáři jmenuje *Výjimka kalendáře (rekonstrukce víkendu)*. Vzor je v [Formáty pro import a export](docs://ref-import-exportformaten).

**Časová rezerva až do dokončení projektu, bez data dokončení.** Pokud soubor nemá datum dokončení, aplikace vypne možnost *Přepočítat časovou rezervu až do dokončení projektu*. To se projeví v řádku *N nastavení plánování P6 používají bezpečnou záložní hodnotu.* Podrobnosti jsou v [Formáty pro import a export](docs://ref-import-exportformaten).

**Dokončené úkoly na datu stavu.** Dokončený úkol se může v zobrazení *Data tak, jak je uložila Primavera* ukázat jako úzký pruh na datu stavu. To není chyba ve vašem souboru. Vysvětlení a související konvence jsou v [Formáty pro import a export](docs://ref-import-exportformaten).

**Čísla s čárkou jako desetinným oddělovačem.** Pokud aplikace nedokáže spolehlivě určit desetinný oddělovač, soubor neotevře. Tak se nikdy neotevře plán se špatně načtenými čísly. Požádejte odesílatele o nový export.

**Soubor, který aplikace nedokáže přečíst.** Zobrazí se chybové hlášení s důvodem. Několik příkladů:

- *Tento soubor není platný nebo podporovaný soubor XER.*
- *V tabulce XER chybí povinné sloupce.*
- *Projekt P6 v tomto souboru XER neobsahuje žádné úkoly.*
- *Desetinný zápis tohoto souboru XER nelze spolehlivě určit.*

Pak se nic neotevře. Zkontrolujte soubor v P6 nebo si od odesílatele vyžádejte nový export.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): proč se `.xer` jen čte a co export ztratí.
- [Data tak, jak je uložila Primavera](docs://uitleg-datums-zoals-opgeslagen): zobrazení vlastních dat Primavery.
- [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen): totéž pro MS Project.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): pokud soubor obsahuje data v hodinách.
- [Formáty pro import a export](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): proč se soubor P6 otevře se svým vlastním profilem výpočtu.
