# Volba schématu IFC

Cíl: uložit váš plán ve schématu IFC modelu budovy, se kterým ho chcete sloučit.

## Kdy to potřebujete

Ve výchozím nastavení aplikace ukládá projekt jako IFC 4.3 ADD2. To je název IFC 4.3 v souborech, které vytvářejí IfcOpenShell a Bonsai. Chcete-li spojit plán s modelem budovy do jednoho souboru 4D, například pomocí receptu *MergeProjects* z IfcOpenShell (ifcpatch), musí mít oba soubory stejné schéma. Když je model budovy soubor IFC4, IfcOpenShell odmítne sloučit ho s plánem v IFC 4.3. Potom zde zvolte schéma modelu.

## Kroky

1. Otevřete *Nastavení projektu*: na kartě *Nastavení › Projekt › Nastavení projektu*, nebo na kartě *Soubor › Nastavení projektu*.
2. V poli *Schéma IFC při ukládání* zvolte schéma vašeho modelu budovy.
3. Klikněte na *Použít*. Projekt je nyní *Neuloženo*.
4. Uložte příkazem *Uložit* (Ctrl+S) nebo příkazem *Uložit jako*.

Tři možnosti:

- *IFC 4.3 ADD2 (výchozí)* zapíše `IFC4X3_ADD2` do hlavičky souboru.
- *IFC 4.3* zapíše `IFC4X3`. Tak zapisovaly IFC 4.3 starší verze aplikace.
- *IFC4* zapíše `IFC4`, pro model budovy v IFC4.

## Úskalí a co aplikace dělá

**Sloučení jako poslední krok.** Neotevírejte sloučený soubor 4D (model budovy plus plán) v aplikaci, abyste ho znovu uložili. Aplikace si ponechá jen plán: stěny a ostatní části modelu budovy se ztratí, i když zachováte schéma. Změňte plán ve svém vlastním souboru a potom ho znovu sloučte.

**Aplikace se nejdřív zeptá, když má otevřený soubor jiné schéma.** Když otevřete například soubor IFC4 nebo soubor IFC 4.3 ze starší verze aplikace, aplikace typ souboru jen tak nezmění. Při prvním použití příkazu *Uložit* nebo *Uložit jako* se nejdřív zeptá, zda chcete zachovat schéma souboru, nebo přejít na IFC 4.3 ADD2. *Zachovat IFC4* (nebo *Zachovat IFC 4.3*) je tlačítko, které zvolí Enter. Když otázku zavřete klávesou Esc nebo křížkem, aplikace nic neuloží.

**Aplikace se zeptá jen jednou u každého souboru.** Vaše volba se uloží do samotného souboru. Když ho později znovu otevřete, aplikace se znovu neptá. Když sami zvolíte schéma v *Nastavení projektu* a kliknete na *Použít*, aplikace se také neptá.

**Schéma, které aplikace neumí zapsat**, například IFC2X3, se v aplikaci otevře. Při prvním uložení na to otázka upozorní a vy zvolíte jedno ze tří schémat uvedených výše.

**Automatické ukládání a zotavení systému po chybě se na nic neptají.** Zapisují schéma souboru a otázku ponechají až na první uložení, které provedete sami. U schématu, které aplikace neumí zapsat, *Automatické ukládání* do souboru nezapisuje, dokud neodpovíte na otázku.

**Nový projekt se na nic neptá.** Nový projekt a projekt z jiného formátu, například XER, MPP nebo CSV, dostane schéma *IFC 4.3 ADD2 (výchozí)*.

**Obsah souboru se nemění.** Všechna tři schémata podporují data plánu, která aplikace zapisuje stejným způsobem. Liší se jen řádek `FILE_SCHEMA` v hlavičce. Když zvolíte jiné schéma, nic neztratíte.

**Model IFC 4.3 z IfcOpenShell nebo Bonsai** má obvykle v hlavičce `IFC4X3_ADD2`, stejně jako výchozí nastavení aplikace. IfcOpenShell do modelu se schématem `IFC4X3` plán nesloučí. Pokud si nejste jistí, podívejte se na řádek `FILE_SCHEMA` na začátku souboru modelu.

**Příkaz Vrátit zpět schéma nemění.** Schéma patří souboru, stejně jako místo, kde je uložený. Volba v *Nastavení projektu* a odpověď na otázku při ukládání proto nejsou krokem příkazu *Vrátit zpět*. Chcete-li schéma vrátit, zvolte v *Nastavení projektu* jiné schéma. Takto *Automatické ukládání* nikdy tiše nezapíše jiné schéma, když vrátíte úpravu zpět.

## Viz také

- [Nový projekt a nastavení projektu](docs://ref-projectinfo): všechna pole formuláře.
- [Soubory a formáty](docs://uitleg-bestanden): proč je IFC vlastní formát aplikace.
- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): uložení a uložení jako.
