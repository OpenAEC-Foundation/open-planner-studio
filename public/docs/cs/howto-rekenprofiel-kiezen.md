# Výběr nebo tvorba profilu výpočtu

Cíl: rozhodnout, podle kterých pravidel výpočtu projekt počítá. Zvolíte vestavěný profil, nebo vytvoříte vlastní profil s vlastními konvencemi.

## Kdy to potřebujete

Potřebujete to, když otevřete projekt, který musí počítat podle pravidel programu Primavera P6 nebo Microsoft Project, nebo když chcete jednu konvenci nastavit jinak, než jak ji nastavuje profil. Co je profil a proč se termíny mohou posunout, popisuje článek [Profily výpočtu a konvence](docs://uitleg-rekenprofielen).

## Postup

### Volba profilu pro nový projekt

1. Zvolte na kartě *Domů › Soubor › Nový*. Otevře se okno *Nový projekt*.
2. V rozbalovacím seznamu *Profil výpočtu* zvolte profil: *Open Planner Studio*, *Primavera P6* nebo *Microsoft Project*.
3. Vytvořte projekt. Aplikace nahradí možnosti výpočtu, které jste už vyplnili, výchozími hodnotami profilu.

### Změna profilu existujícího projektu

1. Zvolte na kartě *Nastavení › Projekt › Nastavení projektu*. Můžete také zvolit *Soubor › Nastavení projektu*.
2. V části *Profil výpočtu a možnosti výpočtu* otevřete rozbalovací seznam *Profil výpočtu* a zvolte jiný profil.
3. Klikněte na **Použít**. Aplikace přepočítá plán hned, i když je *Automaticky přepočítat* vypnuté. Když se úkoly posunuly, aplikace uvede, kolik.

Dokud nekliknete na *Použít*, existuje změna jen ve formuláři. Celé přepnutí se dá vrátit jedním krokem příkazem *Vrátit zpět*. Přepnutí mění jen konvence, vaše možnosti výpočtu zůstanou beze změny.

### Sestavení vlastního profilu

1. V části *Profil výpočtu a možnosti výpočtu* klikněte vedle rozbalovacího seznamu na *Vytvořit profil*.
2. Zadejte název. Aplikace navrhne *Kopie* zvoleného profilu, například *Kopie Open Planner Studio*.
3. Klikněte na *Vytvořit*. Část *Konvence tohoto profilu* se rozbalí.
4. Zapněte nebo vypněte konvence zaškrtávacími políčky. Ikona i za řádkem zobrazí vysvětlení dané konvence. Konvence, která se liší od základu, dostane štítek *zpět na základ*.
5. Klikněte na **Použít**. Teprve potom projekt počítá podle nového profilu.

Tři vestavěné profily nelze změnit. Jejich konvence se zobrazují jen pro informaci.

### Uložení vlastního profilu jako šablony

1. Pokud je třeba, dejte vlastnímu profilu jiný název v poli *Název tohoto vlastního profilu*.
2. Klikněte na *Uložit jako šablonu*. Aplikace oznámí, že se šablona uložila, nebo proč to selhalo.
3. V jiném projektu ve stejné aplikaci je šablona v rozbalovacím seznamu *Profil výpočtu*.

Pokud se profil později liší od šablony, žlutý panel to oznámí. Potom zvolte *Aktualizovat šablonu z tohoto projektu* nebo *Aktualizovat ze šablony*.

Šablonu odstraníte pomocí *Odstranit šablonu*. Aplikace si nejdřív vyžádá potvrzení.

## Kontrola výsledku

- Část *Profil výpočtu a možnosti výpočtu* zobrazuje zvolený profil.
- Po kliknutí na *Použít* aplikace oznámí posunuté úkoly, například *Po použití se posunuly 4 úkoly.*
- Oranžový panel nad možnostmi výpočtu oznámí, že se vaše možnosti výpočtu liší od výchozího nastavení profilu. To je často záměr. Pokud přesto chcete výchozí nastavení, klikněte na *Použít výchozí nastavení profilu …*.

## Úskalí a co aplikace dělá

**Termíny se posunou.** Jiný profil může opravdu posunout termíny. Zkontrolujte výsledek. Pokud se vám to nelíbí, zvolte *Vrátit zpět*: profil i termíny se vrátí spolu.

**Žlutý panel po *Vrátit zpět*.** Když stisknete *Vrátit zpět* nebo *Znovu* při otevřeném Nastavení projektu, žlutý panel sleduje stav projektu. Pokud jste v části už něco změnili sami, vaše volba zůstane. Žlutý panel pak oznámí, že *Použít* znovu nastaví tuto volbu.

**Může být nejvýše 100 šablon.** Pokud jich už je 100, aplikace šablonu neuloží a oznámí to. Nejdřív odstraňte jednu šablonu. Pokud je úložiště aplikace plné nebo chybí, aplikace to také oznámí.

**Šablony patří aplikaci, profil projektu.** Projekt má vždy svou vlastní kopii profilu. Když šablonu později změníte, projekt se s ní nezmění.

**Nastavení ze zdrojového souboru.** Když u projektu, který pochází z jiného souboru, zvolíte *Primavera P6* nebo *Microsoft Project*, nastavení ze zdrojového souboru zůstanou. Zde je nemůžete změnit.

## Viz také

- [Profily výpočtu a konvence](docs://uitleg-rekenprofielen): co je profil a co dělá s termíny.
- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): všechny konvence a možnosti výpočtu na jednom místě.
- [Volba režimu průběhu](docs://howto-voortgangsmodus-kiezen): Retained Logic nebo Progress Override, odděleně od profilu.
