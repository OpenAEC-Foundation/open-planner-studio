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

### Instalace rozšíření ze souboru

Pokud jste rozšíření dostali jako soubor, nainstalujte jej takto.

1. Zvolte *Soubor › Rozšíření*.
2. Vpravo nahoře klikněte na *ZIP* pro soubor ZIP, nebo na *JS* pro samostatný soubor JavaScriptu.
3. Vyberte soubor. Otevře se okno *Nainstalovat rozšíření?*, jako výše.

Soubor ZIP musí obsahovat `manifest.json` a hlavní soubor rozšíření. Pokud nainstalujete rozšíření, které už je nainstalované, nová verze nahradí starou. Pokud aplikace soubor nedokáže nainstalovat, například protože je soubor ZIP poškozený, nestane se nic. Aplikace pro ZIP a JS nezobrazí žádné chybové hlášení a rozšíření se v seznamu neobjeví. Důvod je ale v ladicím terminálu. Zapněte jej na kartě *Nastavení › Projekt › Nastavení*, potom na kartě *Pokročilé* zaškrtněte *Zapnout ladicí terminál*. Otevřete jej tlačítkem *Zobrazit ladicí terminál* ve stavovém řádku. Tam se zobrazí například *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikace tento technický text zobrazuje nizozemsky).

### Přečtěte si dotaz na oprávnění

Dotaz ukazuje, co musíte rozhodnout.

- *Autor* a *Repozitář* říkají, kdo rozšíření vytvořil a kde je zdrojový kód.
- *Původ* říká, odkud soubor pochází: *Z online katalogu rozšíření*, *Ze souboru ZIP na tomto počítači* nebo *Ze souboru JavaScript na tomto počítači*. Pod tím je uvedeno, zda byl soubor ověřen. U katalogu se zobrazí *Stažení ověřeno kontrolním součtem z katalogu*. Pokud katalog kontrolní součet nemá, zobrazí se červeně *Katalog neposkytuje kontrolní součet — toto stažení nebylo ověřeno*. U souboru, který jste vybrali sami, se zobrazí *Soubor jste vybrali sami; neexistuje externí zdroj, proti kterému by se ověřil*.
- *S čím souhlasíte* říká: *Rozšíření je programový kód, který běží se stejnými oprávněními jako samotná Open Planner Studio. Nic to neomezuje. Instalujte pouze rozšíření, jejichž autorovi důvěřujete*. Pod tím je uvedeno, co to znamená na vaší platformě. V desktopové aplikaci se zobrazí *V desktopové aplikaci to znamená mimo jiné: čtení a zápis souborů v celé uživatelské složce a přístup k vašim projektům, nastavení a schránce*. V prohlížeči se zobrazí *V prohlížeči to znamená: přístup k vašim uloženým projektům a nastavení, k souborům, ke kterým jste udělili přístup, a k síti*.
- *Co toto rozšíření údajně používá* ukazuje oprávnění, která autor uvedl, jako malé štítky. Je to prohlášení autora, ne omezení: *Toto je údaj autora, nikoli omezení — kód může stejně dělat víc*. Pokud štítek chybí, zobrazí se *Nic nebylo uvedeno*. To neznamená, že rozšíření nemůže nic dělat. I bez štítků může rozšíření číst a měnit data vašeho plánu a zobrazovat hlášení.

Štítky znamenají toto:

- *ribbon*: rozšíření umísťuje tlačítka do pásu karet.
- *events*: rozšíření sleduje události v aplikaci.
- *backstage*: rozšíření přidává formáty importu, které se objeví na kartě *Soubor › Importovat*.
- *pdf-fonts*: rozšíření dodává písmo pro export do PDF.
- *importSource*: rozšíření smí číst úplné původní bajty každého souboru, který importujete, například surový soubor Primavery, včetně polí, které se do vašeho projektu nedostanou. Okno to také samo vysvětluje.
- *help*: rozšíření smí přidávat články nápovědy, otevírat přiložené projekty jako nový dokument a zobrazit průvodce, který ukazuje na části aplikace. Okno to také samo vysvětluje.
- *filesystem* a *network*: jsou to jen údaje o tom, co autor zamýšlí. Aplikace pro ně nemá žádnou funkci.

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
