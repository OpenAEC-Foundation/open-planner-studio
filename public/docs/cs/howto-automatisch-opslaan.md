# Zapnutí automatického ukládání

Cíl: nechte aplikaci průběžně aktualizovat soubor projektu, zatímco pracujete. Nemusíte pořád stisknout Ctrl+S.

## Kdy to potřebujete

Pracujete dlouho na jednom plánu nebo často zapomínáte ukládat. Chcete, aby soubor na disku nebo ve sdílené složce zůstal aktuální. Automatické ukládání nenahrazuje zotavení systému po chybě. Zotavení systému po chybě je vždy zapnuté a funguje odděleně od automatického ukládání. Rozdíl si přečtete v článku [Soubory a formáty](docs://uitleg-bestanden).

## Postup

1. Pokud projekt ještě nemá soubor, nejdřív ho jednou uložte: na kartě *Domů* v nabídce *Soubor* zvolte *Uložit jako*. Dokud soubor není, je přepínač šedý a text nápovědy říká: *Nejprve uložte tento projekt, abyste mohli použít automatické ukládání.*
2. Vlevo nahoře na liště klikněte na přepínač *Automatické ukládání*. Když je zapnutý, text nápovědy říká: *Automatické ukládání je zapnuté: změny se zapisují do tohoto souboru.*
3. Pracujte dál. Jakmile má váš projekt změny, aplikace ho zapíše do vašeho souboru bez dialogu a nejvýše jednou za deset sekund. Značka *Neuloženo* potom zmizí sama.
4. Chcete-li přestat, klikněte na přepínač ještě jednou. Text nápovědy potom říká: *Automatické ukládání je vypnuté. Zotavení systému po chybě zůstává vždy aktivní.*

Chrome a Edge zpočátku dovolí soubor jen číst, který jste otevřeli. Přepínač tam nic nedělá, dokud jednou neuložíte pomocí *Uložit* (Ctrl+S) a prohlížeč nedá oprávnění k zápisu. Potom ho můžete zapnout. Ve Firefoxu zůstává přepínač šedý. Aplikace tam do vašeho souboru zapisovat nemůže.

## Úskalí a co aplikace v takovém případě udělá

**Přepínač patří jednomu projektu.** Každá otevřená záložka projektu má vlastní stav. Po otevření projektu je přepínač vždy vypnutý a aplikace si jej pro příště nepamatuje.

**Automatické ukládání zapisuje jen do souboru, který projekt už má.** Zvolíte-li *Uložit jako*, zapisuje od té doby do nového souboru. Aplikace zapisuje jen tehdy, když jsou změny.

**Zápis se může nezdařit.** Když soubor například zmizí nebo je zamčen, objeví se zpráva *Automatické ukládání se nezdařilo* s důvodem. Pokud prohlížeč nemá (nebo už nemá) oprávnění k zápisu, aplikace tento krok tiše přeskočí a o oprávnění nežádá.

**Soubor dostane i změny, které byste nechtěli zachovat.** Automatické ukládání zapíše stav projektu, jaký je zrovna v tu chvíli. Když něco vrátíte pomocí Ctrl+Z, soubor dostane i tento vrácený stav do deseti sekund. Chcete-li zachovat starší verzi, nejdřív si vytvořte kopii pomocí *Uložit jako*.

**Při pádu přijdete o poslední sekundy.** Aplikace zapisuje nejvýše jednou za deset sekund, takže to, co jste udělali mezitím, zatím v souboru není. Zotavení systému po chybě má stejný limit.

**Po obnovení v prohlížeči je přepínač opět šedý.** Projekt, který v prohlížeči po pádu obnovíte, už není spojen se svým souborem. Uložte jej jednou a přepínač opět funguje. Viz [Obnovení po pádu](docs://howto-herstellen-na-een-crash).

**Projekt z jiného formátu nemá soubor.** Projekt z CSV, XML, `.mpp` nebo `.xer` dostane soubor IFC až při uložení. Potom můžete automatické ukládání zapnout.

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): rozdíl mezi ukládáním, automatickým ukládáním a zotavením systému po chybě.
- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): *Uložit*, *Uložit jako* a značka *Neuloženo*.
- [Obnovení po pádu](docs://howto-herstellen-na-een-crash): co aplikace nabídne, když se neukončila správně.
