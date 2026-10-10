# Zotavení systému po chybě

Cíl: získat zpět vaši práci poté, co aplikace nebo prohlížeč neočekávaně přestaly fungovat a vy jste nic neuložili.

## Kdy to potřebujete

Notebook přestal fungovat, aplikace zamrzla nebo karta prohlížeče spadla a vy jste poslední změny ještě neuložili. Jakmile dojde kdekoli k změně, aplikace na pozadí ukládá obnovovací kopie všech otevřených projektů, nejvýše jednou za deset sekund. Tato kopie je oddělená od souboru projektu. Rozdíl mezi uložením a automatickým ukládáním najdete v článku [Soubory a formáty](docs://uitleg-bestanden).

## Postup

1. Spusťte aplikaci znovu. V prohlížeči znovu načtěte stejnou kartu: obnovovací kopie patří právě k této kartě.
2. Pokud aplikace našla kopie, zobrazí se okno *Obnovit neuloženou práci*: *Open Planner Studio se neukončil běžným způsobem. Následující dokumenty měly neuložené změny, které lze obnovit:* Pro každý projekt okno ukáže název, cestu k souboru, pokud má projekt soubor (v prohlížeči jen název souboru), počet úkolů a čas kopie, například *21 úkolů* a *Uloženo: 29. září 2026 9:41*. Okno může ukázat i projekty, které jste nezměnili.
3. Zvolte *Obnovit*. Aplikace otevře všechny projekty v seznamu, každý na vlastní kartě, se stavem poslední kopie. Klávesa Enter udělá totéž.
4. Projekty zkontrolujte a hned je uložte pomocí Ctrl+S.

Pokud nechcete obnovit, máte dvě možnosti. *Neobnovovat* kopie odstraní a nelze to vrátit zpět. Když okno zavřete klávesou Escape, křížkem nebo kliknutím vedle něj, kopie zůstanou a aplikace se zeptá znovu při dalším spuštění.

Otazník vpravo nahoře v okně otevře tento článek, aniž byste něco zvolili. Dokud čtete v nápovědě, okno čeká. Až se vrátíte, okno tam bude znovu a obnovit můžete stále.

## Úskalí a co aplikace potom udělá

**Dostanete stav poslední kopie.** Co jste udělali v posledních sekundách před pádem, může chybět. Projekt, který měl změny, se znovu označí jako *Neuloženo*. Historie *Vrátit zpět* je prázdná: kroky z doby před pádem nelze vrátit. Zoom, poloha posouvání a výběr se obnoví.

**V desktopové aplikaci si obnovený projekt zachová soubor, v prohlížeči ne.** V desktopové aplikaci *Uložit* zapíše do původního souboru, s obnoveným stavem. V prohlížeči obnovený projekt už není spojen se svým souborem: *Uložit* se zeptá, kam má soubor uložit. Přepínač *Automatické ukládání* je tehdy také šedý, dokud projekt jednou neuložíte.

**Projekt v zobrazení *Data tak, jak byla zaznamenána* zůstane v tomto zobrazení.** Viz [Data tak, jak byla zaznamenána](docs://uitleg-datums-zoals-opgeslagen).

**V desktopové aplikaci se okno neobjeví po každém spuštění.** Obnovovací kopie jsou ve složce s daty aplikace jako soubory IFC, jejichž název začíná na *recovery*. Když aplikaci zavřete běžným způsobem, vymaže své kopie. Okno se proto objeví po neočekávaném ukončení, po restartu kvůli aktualizaci aplikace nebo tehdy, když jste obnovení při předchozím spuštění odložili.

**V prohlížeči se kopie uchovává zvlášť pro každou kartu.** Kopie je v úložišti prohlížeče. Nová karta nebo okno nenabídne kopie jiné karty. Kopie karet, které už neexistují, se po sedmi dnech vymažou, jakmile aplikace znovu začne zapisovat kopie.

**V prohlížeči se okno objeví také po běžném znovunačtení.** To se stane i tehdy, když jste všechno uložili. Pokud jste uložili těsně před načtením a poté jste nic neměnili, můžete bezpečně zvolit *Neobnovovat*: váš soubor je aktuální.

**Okno se neobjeví.** Aplikace tehdy nenašla žádnou kopii. To nastane, když jste zatím nic neměnili, když v prohlížeči použijete novou kartu, když jste obnovení dříve zahodili volbou *Neobnovovat*, nebo když pád nastal dříve, než aplikace uchovala první kopii. To může trvat až zhruba deset sekund od vaší první změny.

**Kopie je poškozená.** Aplikace zobrazí *Obnovený soubor se nepodařilo přečíst* s důvodem a nabídne ostatní projekty. Pokud zvolíte *Obnovit*, aplikace potom smaže všechny kopie, včetně nečitelné. Pokud není čitelná žádná kopie, okno se neobjeví a kopie zůstanou.

**Obnovení selže.** Aplikace zobrazí *Obnovení se nezdařilo* s důvodem. Kopie zůstanou a otázka se vrátí při dalším spuštění.

**Některé projekty nelze načíst.** Aplikace zobrazí: *2 obnovovací soubory se nepodařilo načíst a byly přeskočeny.* Pokud jde o jeden soubor, zobrazí *1 obnovovací soubor se nepodařilo načíst a byl přeskočen.* Ostatní projekty se obnoví. Protože něco bylo přeskočeno, všechny kopie zůstanou a okno se při dalším spuštění vrátí se stejným seznamem. Potom zvolte *Neobnovovat*, pokud jste už získali zpět vše, co se dalo.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): ukládání, automatické ukládání a zotavení systému po chybě vedle sebe.
- [Zapnutí automatického ukládání](docs://howto-automatisch-opslaan): nechat aplikaci, ať váš soubor aktualizuje sama.
- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): ukládání po obnovení.
- [Data tak, jak byla zaznamenána](docs://uitleg-datums-zoals-opgeslagen): co se stane s projektem v tomto zobrazení.
