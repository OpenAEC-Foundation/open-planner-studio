# Export

Cíl: předat váš plán jako soubor v jiném formátu pro někoho, kdo nečte IFC, nebo pro jiný program.

## Kdy to potřebujete

Konzultant pracuje v MS Project, klient v Primavera, subdodavatel chce úkoly v Excelu, nebo vy posíláte plán do programu, který nezvládne IFC. Export je kopie v jiném formátu. Pokud chcete uchovat samotný projekt, uložte ho. Zapíše se IFC a přenese se všechno. Co který formát přenáší a co ne, najdete v [Soubory a formáty](docs://uitleg-bestanden).

## Kroky

1. Na kartě *Domů › Soubor › Exportovat* vyberte formát ze seznamu, nebo zvolte *Soubor › Exportovat*. Tam je každý formát zobrazen jako dlaždice s krátkým popisem.
2. V okně zvolte název a místo. Aplikace navrhne název projektu s příponou daného formátu. Tabulky průběhu se jmenují *projectname-voortgang* a otevřou se ve složce Stažené, pokud to jde.
3. Potvrďte. Když export proběhne úspěšně, nezobrazí se žádné hlášení kromě hlášení níže. Když použijete *Soubor › Exportovat*, vrátíte se potom na kartu *Domů*, i když okno zrušíte. Pokud zrušíte okno u exportu ze seznamu na kartě *Domů*, nestane se nic.

Pokud váš prohlížeč ukládá soubory jen jako stažení (například Firefox), je soubor ve složce Stažené hned po kroku 1. Uvidíte hlášení *Uloženo jako stažený soubor: „name.xml“ je nyní ve složce Stažené. Toto prostředí neumožňuje aplikaci zapisovat přímo na zvolené místo.*

### Který formát zvolíte?

Seznam na kartě *Domů* a dlaždice na kartě *Soubor › Exportovat* nabízejí stejné formáty:

- *Průběh (Excel)* a *Průběh (CSV)*, na dlaždicích *Tabulka průběhu (Excel)* a *Tabulka průběhu (CSV)*: štíhlý list s ID, WBS, názvem, daty a procentem dokončení, který rozešlete těm, kdo průběh vyplňují.
- *CSV (;)*, na dlaždici *CSV (oddělené středníkem)*: seznam úkolů, který otevřete v tabulkovém procesoru.
- *MS Project XML*: lze otevřít v programu Microsoft Project.
- *Primavera P6 XML*: pro Oracle Primavera P6.
- *IFC 4x3*: vlastní formát aplikace, se vším, co obsahuje.

### Export IFC se souborem knihovny zdrojů

Je-li váš projekt propojen s knihovnou zdrojů, je zaškrtávací políčko *Uložit soubor knihovny zdrojů vedle* pod dlaždicemi na kartě *Soubor › Exportovat*. Pokud ho zaškrtnete a zvolíte *IFC 4x3*, aplikace se zeptá na místo dvakrát: nejdřív pro projekt, potom pro *projectname-bibliotheek.ifc*. Toto zaškrtávací políčko je jen na kartě *Soubor › Exportovat*, ne v seznamu na kartě *Domů*.

### Obnovení tabulky průběhu

Vyplněnou tabulku průběhu načtete zpět přes *Soubor › Importovat*. Viz [Import průběhu z tabulky](docs://howto-voortgang-importeren).

## Úskalí a co aplikace potom udělá

**Váš projekt se nezmění.** Soubor vašeho projektu zůstane stejný a značka *Neuloženo* zůstane, pokud tam byla.

**Zastaralý plán se nejdřív přepočítá.** Dostanete tak aktuální data, i když jste zapomněli stisknout tlačítko *Přepočítat*.

**Export je také v seznamu Nedávné.** To se netýká tabulek průběhu. Když z tohoto seznamu export otevřete, otevře se jako import daného formátu.

**Export nepřenese všechno.** Soubor CSV nemá zdroje ani omezení, P6 XML nemá směrné plány ani konečné termíny. Profil výpočtu se také nepřenese: znovu otevřený export se vypočítá s profilem *Open Planner Studio*. Jen IFC přenese všechno. Příklad s čísly najdete v [Soubory a formáty](docs://uitleg-bestanden).

**Dva formáty se stejnou příponou.** MS Project XML i Primavera P6 XML dostanou název *projectname.xml*. Dejte jim názvy sami, jinak později nepoznáte, který soubor je který formát.

**Plán s cyklickou závislostí se neexportuje.** Aplikace nejdřív vypočítá plán a zastaví se, pokud je v něm smyčka. Na kartě *Domů* dostanete hlášení *Plán nelze přepočítat*, pod ním například *Cyklus závislostí mezi úkoly: Set up site → Demolish existing extension → Set up site*. Na kartě *Soubor › Exportovat* je na stránce jen ten druhý text. Odstraňte smyčku a exportujte znovu.

**Projekt z Primavera ztrácí zdrojové informace.** Když takový projekt exportujete do CSV, MS Project XML nebo P6 XML, aplikace nahlásí: *Při exportu do formátu CSV se ztratí zdrojové informace XER.* U MS Project XML hlásí *MSPDI*, u P6 XML *P6*. Viz [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen).

**Rozdělené úkoly ztrácejí své rozdělení.** MS Project a Primavera znají rozdělení jen jako rozložení po hodinách. Pokud váš projekt obsahuje rozdělené úkoly bez rozložení po hodinách, aplikace po exportu do MS Project XML nebo P6 XML nahlásí: *2 úkoly s přerušeními práce byly exportovány bez přerušení práce: MS Project a P6 znají přerušení pouze jako rozložení práce.* U jednoho úkolu hlásí: *1 úkol s přerušeními práce byl exportován bez přerušení práce: MS Project a P6 znají přerušení pouze jako rozložení práce.* Viz [Rozdělení úkolu](docs://howto-taak-splitsen).

**Plán ve zobrazení *Data tak, jak byla zaznamenána*.** Když exportujete do CSV a vidíte data ze zdrojového souboru, aplikace nechá sloupce `Critical` a `Total Float` u úkolů prázdné, pokud zdrojový soubor tento údaj nezaznamenal. Viz [Data tak, jak byla zaznamenána](docs://uitleg-datums-zoals-opgeslagen).

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): co který formát přenáší a co ne.
- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): uchování samotného projektu jako IFC.
- [Import průběhu z tabulky](docs://howto-voortgang-importeren): načtení vyplněné tabulky průběhu.
- [Formáty importu a exportu](docs://ref-import-exportformaten): u každého formátu, co se přenese a co ne.
