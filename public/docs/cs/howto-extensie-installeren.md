# Instalace a správa rozšíření

Cíl: nainstalovat rozšíření, přečíst dotaz na oprávnění a později rozšíření vypnout nebo odstranit.

## Kdy to potřebujete

Rozšíření přidá něco do aplikace, aniž musíte čekat na novou verzi. Rozšíření může například přidat formát importu, který se objeví na kartě *Soubor › Importovat*. Může umístit tlačítko do pásu karet nebo dodat písmo pro export do PDF. Oficiální katalog je dělí do těchto kategorií: *Import/Export*, *Plánování*, *Sestavy*, *Nástroje*, *Písma* a *Ostatní*.

Zvažte pečlivě, než nějaké rozšíření nainstalujete. Rozšíření je programový kód, který běží se stejnými právy jako samotná aplikace. Aplikace to nemůže omezit. Proto se aplikace při každé instalaci ptá na oprávnění. Co v tomto dotazu vidíte, je vysvětleno níže.

## Kroky

### Instalace rozšíření z katalogu

1. Zvolte *Soubor › Rozšíření*.
2. Zvolte kartu *Procházet*. Aplikace načítá katalog a zobrazuje přitom *Načítání katalogu...*. O obsahu katalogu rozhoduje nadace OpenAEC Foundation, která jej spravuje. Obsah se může změnit.
3. Vyhledejte rozšíření v poli *Hledat rozšíření...*. Hledání probíhá podle názvu, popisu, autora a značek.
4. Každá kartička zobrazuje název, verzi, kategorii, popis a autora. Klikněte na *Instalovat*.
5. Otevře se okno *Nainstalovat rozšíření?*. Přečtěte si ho, viz další krok.
6. Klikněte na *Instalovat* a pokračujte. Po kliknutí na *Neinstalovat* se nic nestane. Stisknutí klávesy Esc nebo klik vedle okna se také počítá jako odmítnutí. Aplikace pak nezobrazí žádné chybové hlášení.

Po instalaci je rozšíření okamžitě zapnuté. Na kartičce rozšíření v seznamu *Procházet* je nyní uvedeno *Nainstalováno*. Co rozšíření přidá, uvidíte přímo v aplikaci: nové tlačítko v pásu karet, nebo formát importu na kartě *Soubor › Importovat*. Některá rozšíření také zobrazí hlášení. Poznáte je podle předpony *Rozšíření* a názvu rozšíření.

**Kurzy.** Kurzy jsou rozšíření. Pokud v nabídce *Nápověda* uvidíte pod nadpisem *Kurzy* tlačítko *Nainstalovat kurzy*, otevře se *Soubor › Rozšíření* na kartě *Procházet*. Dotaz, který se objeví po první prohlídce, také nainstaluje toto rozšíření. Obě cesty zobrazí stejný dotaz na oprávnění; můžete jej odmítnout.

### Instalace rozšíření ze souboru

Pokud jste rozšíření dostali jako soubor, nainstalujte jej takto.

1. Zvolte *Soubor › Rozšíření*.
2. Vpravo nahoře klikněte na *ZIP* pro soubor ZIP, nebo na *JS* pro samostatný soubor JavaScriptu.
3. Vyberte soubor. Otevře se okno *Nainstalovat rozšíření?*, jako výše.

Soubor ZIP musí obsahovat `manifest.json` a hlavní soubor rozšíření. Pokud nainstalujete rozšíření, které už je nainstalované, nová verze nahradí starou. Pokud aplikace soubor nedokáže nainstalovat, například protože je soubor ZIP poškozený, nestane se nic. Aplikace pro ZIP a JS nezobrazí žádné chybové hlášení a rozšíření se v seznamu neobjeví. Důvod je ale v ladicím terminálu. Zapněte jej na kartě *Nastavení › Projekt › Nastavení aplikace*, potom na kartě *Pokročilé* zaškrtněte *Zapnout ladicí terminál*. Otevřete jej tlačítkem *Zobrazit ladicí terminál* ve stavovém řádku. Tam se zobrazí například *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikace tento technický text zobrazuje nizozemsky).

### Přečtěte si dotaz na oprávnění

Dotaz ukazuje, co musíte rozhodnout.

- *Autor* a *Repozitář* říkají, kdo rozšíření vytvořil a kde je zdrojový kód.
- *Původ* říká, odkud soubor pochází, a zda byl ověřen. Pokud se červeně zobrazí, že stažení nebylo ověřeno, instalujte jen tehdy, když znáte zdroj.
- *S čím souhlasíte* opakuje, že rozšíření je programový kód, který běží se stejnými oprávněními jako sama aplikace, a co to znamená na vaší platformě. Instalujte jen rozšíření, jejichž autorovi důvěřujete.
- *Co toto rozšíření údajně používá* ukazuje oprávnění, která autor uvedl, jako malé štítky. Je to prohlášení autora, nikoli omezení. Pokud se zobrazí *Nic nebylo uvedeno.*, rozšíření přesto může číst a měnit data vašeho plánu.

Co každý štítek znamená a přesné texty okna jsou v [Oprávnění rozšíření](docs://ref-extensiepermissies).

### Vypnutí, opětovné zapnutí nebo odstranění rozšíření

1. Zvolte *Soubor › Rozšíření* a kartu *Nainstalované*. Každé rozšíření má kartičku s názvem, verzí, kategorií, popisem a autorem.
2. Přepínačem na kartičce rozšíření jej vypněte (*Vypnout*), nebo znovu zapněte (*Zapnout*). Po vypnutí zmizí tlačítka a formáty importu, které rozšíření přidalo. Rozšíření zůstane nainstalované. Zůstane vypnuté i po restartu aplikace. Zapnuté rozšíření se při spuštění aplikace spustí samo.
3. Klikněte na *Odstranit*. Tlačítko se změní na *Potvrdit* s vysvětlením *Klikněte znovu pro trvalé odebrání*. Klikněte ještě jednou a rozšíření se odstraní. Aplikace také vyčistí nastavení, které rozšíření uložilo.

## Časté problémy a co aplikace potom dělá

**Katalog se nenačte.** Aplikace zobrazí *Katalog se nepodařilo načíst:* a technický důvod za tím, a tlačítko *Zkusit znovu*. Příčinou může být, že nemáte připojení k internetu.

**Pod kartičkou v katalogu se zobrazí *Instalace se nezdařila*.** Stažení nebo instalace se nezdařila, například protože kontrolní součet nesouhlasil. Nic se pak nenainstalovalo. To je něco jiného než odmítnutí dotazu: tehdy se žádné chybové hlášení nezobrazí.

**Nad seznamem se zobrazí *Přeskočené položky katalogu: 1*.** Katalog obsahoval položku, kterou aplikace nedokáže použít. Ostatní rozšíření můžete nainstalovat jako obvykle.

**Rozšíření se nespustí.** Kartička pak zobrazí chybové hlášení: například že rozšíření potřebuje novější verzi Open Planner Studio, s vaší aktuální verzí, nebo chybu, kterou samo rozšíření vrátilo. Rozšíření pak není aktivní. Aktualizujte aplikaci, nebo rozšíření odstraňte.

**Kartička označená *Karanténa*.** Aplikace nedokázala uložené rozšíření použít. Pod názvem se zobrazí *Důvod:* a příčina. Tlačítkem *Odstranit z úložiště* ho vyčistíte.

**Vytvoření vlastního rozšíření.** Průvodce pro autory rozšíření (manifest, API, oprávnění) je v repozitáři `OpenAEC-Foundation/open-planner-studio` na GitHubu, v souboru `docs/extensions.md`.

**Rozšíření nepatří k projektu.** Rozšíření se ukládají v aplikaci: v desktopové aplikaci na tomto počítači, v prohlížeči v jeho úložišti. Platí pro všechny vaše projekty a nejsou součástí souboru projektu. Pokud v prohlížeči vymažete data webu, rozšíření zmizí.

## Viz také

- [Aktualizace aplikace](docs://howto-app-bijwerken): rozšíření může požadovat novější verzi aplikace.
- [Oprávnění rozšíření](docs://ref-extensiepermissies): co znamená každé oprávnění v dotazu na instalaci.
