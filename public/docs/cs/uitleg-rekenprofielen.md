# Profily výpočtu a konvence

Stejný plán může dát jiné termíny podle toho, která pravidla výpočtu použijete. Tento článek vysvětluje, proč Primavera P6 a Microsoft Project počítají v několika bodech jinak, jak aplikace tento rozdíl zaznamenává v **profilu výpočtu** a čím se profil liší od možností výpočtu, které nastavujete sami pro každý projekt. Příklad s jednou malou sítí ukazuje, co to dělá s termíny.

## Pojem

Úkoly, závislosti a kalendář určují většinu plánu, ale ne všechno. Co se stane s prací, která ještě nezačala, když nastavíte datum stavu? Kde začne zbývající práce úkolu, který už probíhá? Jaká je volná časová rezerva úkolu, když se mine konečný termín? Síť o tom nic neříká. Plánovací program musí pro to zvolit pravidlo. Aplikace zná řadu bodů, ve kterých se pravidlo Primavery P6 a pravidlo Microsoft Project liší.

Aplikace takovou volbu nazývá **konvence**. **Profil výpočtu** je soubor konvencí, který patří k jednomu programu. Aplikace má tři:

- *Open Planner Studio*: profil, podle kterého se počítá nový projekt. Žádná konvence není zapnutá.
- *Primavera P6*: konvence, které aplikace zná z P6.
- *Microsoft Project*: konvence, které aplikace zná z Microsoft Project.

Profil tedy říká, jak program počítá. To, co chcete pro svůj projekt, do něj nepatří. To jsou **možnosti výpočtu**: volby, například jak malá časová rezerva dělá úkol kritickým, nebo v jakém kalendáři se počítá prodleva. Nastavíte je pro každý projekt.

## Jak aplikace počítá

### Konvence a možnosti výpočtu

Konvence je přepínač: zapnutý nebo vypnutý. Profil určuje, které přepínače jsou zapnuté. Možnost výpočtu je volba, kterou uděláte vy. Rozdíl uvidíte přímo v aplikaci, v části *Profil výpočtu a možnosti výpočtu*:

- **Konvence** jsou pod *Konvence tohoto profilu*, seskupené podle tématu, například *Průběh a dokončená práce*, *Závislosti a prodleva* a *Časová rezerva a pozdní termíny*. Každý řádek je zaškrtávací políčko s hodnotou profilu za ním (*základ: zapnuto* nebo *základ: vypnuto*). Pokud se vaše volba od ní liší, řádek se zvýrazní a objeví se *zpět na základ*. Šipka před řádkem otevře vysvětlení dané konvence. Chcete-li konvenci změnit, přečtěte si ho nejdřív.
- **Možnosti výpočtu** jsou pod *Možnosti výpočtu tohoto projektu*: mezi jinými *Definice kritičnosti*, *Výpočet časové rezervy*, *Úkoly s otevřeným dokončením jsou kritické*, *Označit téměř kritické* a *Kalendář prodlev*. Říkají, co chcete pro tento projekt, ne jak program počítá. Co dělají, je vysvětleno v [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad) a [Závislosti a prodleva](docs://uitleg-relaties).

Příklad každého. „Úkol je kritický, pokud je jeho celková časová rezerva 0 nebo méně“ je možnost výpočtu: můžete nastavit prahovou hodnotu na 4 a pak je kritické všechno s časovou rezervou 4 pracovní dny nebo méně. „Práce, která nebyla zahájena, se přesune na datum stavu“ je konvence: Open Planner Studio a Primavera P6 to dělají, Microsoft Project ne.

Profil a možnosti výpočtu patří k souboru projektu, ne k aplikaci. Když projekt uložíte, putují spolu s ním. Dva projekty ve stejné aplikaci proto mohou počítat s jiným profilem. Projekt bez profilu se počítá jako Open Planner Studio.

Když existují možnosti výpočtu, které zná jen Primavera, část dole také zobrazí *Nastavení ze zdrojového souboru*. Ukáže se to u projektu ze souboru .xer file, a také když zvolíte *Primavera P6* v okně *Nový projekt* nebo použijete výchozí možnosti profilu Primavera P6. Tady je nemůžete změnit.

### Kde zvolíte profil

U nového projektu je profil v okně *Nový projekt*, které otevřete na kartě *Domů › Soubor › Nový*. Tam je *Profil výpočtu* rozbalovací seznam. Když tam zvolíte profil, aplikace nahradí možnosti výpočtu, které jste už vyplnili, výchozími hodnotami tohoto profilu. Zůstanou jen nastavení ze zdrojového souboru. U profilu *Primavera P6* je *Výpočet časové rezervy* pak *Časová rezerva dokončení*. U *Microsoft Project* a *Open Planner Studio* je každá možnost výpočtu na výchozí hodnotě, takže *Výpočet časové rezervy* je nastaven na *Automaticky (výchozí)*. S datem stavu tak počítá i samotný MS Project: zahájený úkol dostane časovou rezervu dokončení a každý další úkol menší z časové rezervy začátku a časové rezervy dokončení.

Pro existující projekt zvolíte profil na kartě *Nastavení › Projekt › Info o projektu*, v části *Profil výpočtu a možnosti výpočtu*, v rozbalovacím seznamu *Profil výpočtu*. Stejné místo najdete také na kartě *Soubor › Info o projektu*. Přepnutí profilu zde změní jen konvence. Vaše možnosti výpočtu zůstanou beze změny. Chcete-li i výchozí možnosti výpočtu nového profilu, zvolte *Použít výchozí možnosti tohoto profilu*.

Dokud nestisknete *Použít*, existuje změna jen ve formuláři. Po stisknutí *Použít* aplikace plán hned přepočítá, i když je *Automaticky přepočítat* vypnuto. Když se úkoly posunou, aplikace uvede kolik, například *Po použití se posunuly 4 úkoly.* Celé přepnutí lze vrátit jedním krokem pomocí *Vrátit zpět*.

Když v profilu zapnete nebo vypnete jednu konvenci, aplikace z něj udělá vlastní profil. Jmenuje se *Kopie Open Planner Studio*, nebo *Kopie* profilu, ze kterého jste vyšli. Můžete mu dát jiný název a uložit ho pomocí *Uložit jako šablonu* pro další projekty v této aplikaci. Projekt má vždy vlastní kopii: když šablonu později změníte, projekt se s ní nezmění.

### Kdy aplikace vybere profil sama

Když otevřete soubor, aplikace navrhne profil podle formátu:

- Soubor .mpp (Microsoft Project) se otevře s profilem *Microsoft Project*.
- Soubor .xer (Primavera P6) se otevře s profilem *Primavera P6*.
- Soubor ve formátu *MS Project XML*, *Primavera P6 XML* nebo *CSV (oddělené středníkem)* se otevře s *Open Planner Studio* bez zprávy o profilu.
- Váš vlastní projekt (.ifc) se otevře s profilem, který je v něm uložený.

U souboru .mpp nebo .xer aplikace uvede profil: *Tento projekt se počítá jako Microsoft Project. Změnit to lze v Soubor → Informace o projektu → Profil výpočtu a možnosti výpočtu.* Tlačítko *Otevřít profil výpočtu* ve zprávě vás přenese přímo do Info o projektu. U souboru .xer je tento řádek prvním řádkem podrobností ve zprávě při otevření souboru. Více o zprávě najdete v [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen) a [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen).

U souboru .mpp aplikace nastaví jen profil. Možnosti výpočtu zůstanou prázdné, stejně jako u nového projektu s profilem *Microsoft Project*: *Výpočet časové rezervy* je nastaven na *Automaticky (výchozí)*. Otevřený soubor .mpp a nový projekt s *Microsoft Project* proto počítají časovou rezervu stejně.

## Příklad: jedna síť, tři profily

Příklad je malá síť. Kalendář má pracovní týden od pondělí do pátku a v těchto týdnech žádné volné dny. Režim průběhu je Retained Logic (výchozí). Zahájení projektu je pondělí 7. června 2027. Všechny doby trvání jsou v pracovních dnech.

- *Pour foundation*: 5 pracovních dnů, začátek plánovaný na pondělí 7. června.
- *Lay walls*: 5 pracovních dnů, po *Pour foundation* (dokončení-zahájení).
- *Order window frames*: 3 pracovní dny, bez předchůdce, začátek plánovaný na pondělí 7. června.
- *Fit roof*: 2 pracovní dny, po *Lay walls* a po *Order window frames*. Dokončení tohoto úkolu je předání.

Čísla určilo výpočetní jádro aplikace. Čtete je v panelu *Vlastnosti* v části *Výsledek CPM*.

**Bez data stavu a bez průběhu počítají tři profily tuto síť stejně.** *Pour foundation* běží od pondělí 7. do pátku 11. června, *Lay walls* od pondělí 14. do pátku 18. června a *Fit roof* v pondělí 21. a úterý 22. června. Předání je úterý 22. června. *Order window frames* (od pondělí 7. do středy 9. června) má celkovou časovou rezervu 7 pracovních dnů.

Teď zaznamenáte stav. Datum stavu je středa 9. června. *Pour foundation* začal v pondělí 7. června a je dokončen na 60 %. Zbývající práce je proto 2 pracovní dny (5 × 40 %). *Order window frames* ještě nezačal. Jak fungují [průběh a datum stavu](docs://uitleg-voortgang), je popsáno v tom článku. Tady jde o to, co s tím profil udělá.

### Open Planner Studio

Zbývající práce úkolu *Pour foundation* začíná na datum stavu: středa 9. a čtvrtek 10. června. Nejdřívější zahájení zůstává skutečným zahájením, pondělí 7. června. Nejdřívější dokončení je čtvrtek 10. června. *Lay walls* běží od pátku 11. do čtvrtku 17. června a *Fit roof* v pátek 18. a pondělí 21. června.

*Order window frames* byl plánován na pondělí 7. června, ale ještě nezačal. Práce, která nezačala, nemůže ležet v minulosti. Aplikace ji proto přesune na datum stavu: od středy 9. do pátku 11. června, s celkovou časovou rezervou 4 pracovní dny. Předání je pondělí 21. června.

### Primavera P6

Všechno je stejné jako v Open Planner Studio, až na jeden bod: nejdřívější zahájení úkolu *Pour foundation* je středa 9. června. To je začátek zbývající práce, ne skutečné zahájení. To zajišťuje konvence *Probíhající úkol: nejdřívější zahájení = začátek zbývající práce* ve skupině *Průběh a dokončená práce*. Dokončení a časová rezerva se kvůli tomu nemění. Předání je pondělí 21. června.

### Microsoft Project

Tady se termíny liší. Způsobují to dvě konvence ve skupině *Průběh jako v Microsoft Project*.

*Nezahájené úkoly nepřesouvat na datum stavu*: *Order window frames* zůstává od pondělí 7. do středy 9. června, i když to zčásti leží před datem stavu. Celková časová rezerva je 7 pracovních dnů.

*Zbývající práce pokračuje po uplynulé době trvání*: zbývající práce začíná nejdříve na datum stavu a nejdříve na skutečné zahájení plus uplynulá doba trvání. Při 60 % z 5 pracovních dnů jsou hotové 3 pracovní dny. Pondělí 7. června plus 3 pracovní dny je čtvrtek 10. června. To je po datu stavu, takže zbývající práce běží čtvrtek 10. a pátek 11. června. *Lay walls* běží od pondělí 14. do pátku 18. června a *Fit roof* v pondělí 21. a úterý 22. června. Předání je úterý 22. června: o jeden pracovní den později než u ostatních dvou profilů.

### Co když

**Úkol Pour foundation je na 20 % místo na 60 %.** Zbývající práce je pak 4 pracovní dny. U všech tří profilů se úkol *Pour foundation* dokončí v pondělí 14. června a předání je středa 23. června. Konvence Microsoft Project pro zbývající práci tady nic nemění: pondělí 7. června plus 1 uplynulý pracovní den je úterý 8. června, a to je před datem stavu. Taková konvence je dolní mez, která může zbývající práci jen posunout později. *Order window frames* a nejdřívější zahájení u Primavery P6 se pořád liší, jak je uvedeno výše. U Microsoft Project má *Order window frames* pak celkovou časovou rezervu 8 pracovních dnů.

**Nastavíte jen datum stavu a průběh nezadáte.** U Open Planner Studio a profilu Primavera P6 se celá síť posune na středu 9. června. *Pour foundation* pak běží od středy 9. do úterý 15. června a předání je čtvrtek 24. června: o dva pracovní dny později než bez data stavu. U Microsoft Project zůstane všechno tam, kde bylo, a předání je úterý 22. června.

**Profil si sestavíte sami.** Když u Open Planner Studio zapnete jen *Nezahájené úkoly nepřesouvat na datum stavu*, vznikne vlastní profil *Kopie Open Planner Studio*. Při průběhu 60 % si *Pour foundation* ponechá termíny Open Planner Studio (dokončení čtvrtek 10. června, předání pondělí 21. června). *Order window frames* skutečně zůstává od pondělí 7. do středy 9. června, s celkovou časovou rezervou 6 pracovních dnů. Profil je tedy svazek samostatných přepínačů a můžete je měnit jeden po druhém.

**Možnost výpočtu místo konvence.** Když u Open Planner Studio nastavíte *Definice kritičnosti* (*Celková časová rezerva ≤ prahová hodnota*) a v poli *Prahová hodnota (pracovní dny)* zadáte 4, *Order window frames* se stane kritickým, protože jeho celková časová rezerva je přesně 4. Žádný termín se nemění. Možnost výpočtu je vaše volba pro projekt a na profilu nezávisí.

**Konečný termín, který se nesplní.** Dejte úkolu *Fit roof* konečný termín v pátek 18. června. U Open Planner Studio je celková časová rezerva úkolu *Fit roof* pak −1 pracovní den a volná časová rezerva je také −1. U profilu Primavera P6 zůstane celková časová rezerva −1, ale volná časová rezerva se stane 0. To dělá konvence *Volná časová rezerva nikdy není záporná* ve skupině *Časová rezerva a pozdní termíny*. U Microsoft Project jsou obě −2, protože předání tam připadne o den později. Jak konečný termín funguje, je popsáno v [Omezení a konečné termíny](docs://uitleg-constraints).

## Důsledky a nedorozumění

**„Profil je nastavení aplikace.“** Ne. Profil a možnosti výpočtu patří k projektu a přenášejí se v souboru. K aplikaci patří jen šablony, které si uchováte. Projekt si vždy ponechá vlastní kopii.

**„Když exportuji, můj profil půjde s ním.“** Jen při exportu do vlastního formátu projektu (.ifc). Když exportujete do *MS Project XML*, *Primavera P6 XML* nebo *CSV (oddělené středníkem)*, profil v souboru není. Z možností výpočtu zapíše export do MS Project XML nejvýše kritickou prahovou hodnotu. Aplikace na to upozorní jen u projektu, který vznikl z xer file. U projektu, který jste vytvořili sami, žádné upozornění nepřijde. Soubor se pak otevře jako Open Planner Studio, bez upozornění o profilu. Vezměte příklad s profilem Microsoft Project a průběhem 60 %. Když ho exportujete do *MS Project XML* a znovu otevřete, aplikace nejdřív zobrazí data ze souboru, s předáním v úterý 22. června. Když necháte aplikaci přepočítat plán sama, předání bude v pondělí 21. června. Co dalšího export ztratí, je popsáno v [Soubory a formáty](docs://uitleg-bestanden).

**„Profil Primavera P6 dá stejný výsledek jako P6.“** Aplikace to nemůže slíbit. Profil zapíná konvence, které aplikace zná z P6, a ty nejsou všechna nastavení P6. Kromě Retained Logic a Progress Override má P6 třetí režim průběhu, Actual Dates. Aplikace ho nezná. Takový xer file se proto počítá jako Retained Logic a upozornění při otevření to uvede, například jako *1 nastavení plánování P6 používá bezpečnou záložní hodnotu.* Některé konvence profilu Primavera P6 fungují také jen u úkolů z xer file, například *Nezahájená LOE použije cílové okno* a *Zachovat skutečná data přesně*. U některých z nich to vysvětlení říká: „jen úkoly s původem P6“. U úkolů, které vytvoříte sami, tyto konvence nic nedělají.

**„Režim průběhu je součástí profilu.“** Ne. Retained Logic nebo Progress Override je samostatná volba pro každý projekt. Nastavujete ji odděleně od profilu, viz [Volba režimu průběhu](docs://howto-voortgangsmodus-kiezen). Jedna konvence profilu Primavera P6, *Progress Override ignoruje zahájeného následníka i při výpočtu zpět*, dělá něco jen při Progress Override.

**„Přepnu jen profil a uvidím, co se stane.“** Můžete, protože *Použít* je jeden krok, který jde vrátit pomocí *Zpět*: profil a data se vrátí společně. Data se ale mohou opravdu posunout. V příkladu přepnutí z Open Planner Studio na Microsoft Project přesune všechny 4 úkoly. Upozornění je počítá za vás. Podívejte se pak na plán, než budete pokračovat. Když aplikace po otevření souboru .xer nebo .mpp stále zobrazuje data ze souboru, přepnutí profilu tento pohled opustí a aplikace počítá sama. Jak to funguje, je popsáno v [Data, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen).

**Příklad ukazuje čtyři konvence, seznam v aplikaci je delší.** Každý řádek bloku má vlastní vysvětlení. Přečtěte si ho nejdřív. Podívejte se také na skupinu *Pouze pro vlastní profily*. Tyto konvence jsou vypnuté v každém vestavěném profilu, včetně Primavery P6. Když jednu zapnete, vznikne vlastní profil.

## Viz také

- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co dělají datum stavu a zbývající práce, s rozdíly podle profilu.
- [Volba režimu průběhu](docs://howto-voortgangsmodus-kiezen): volba Retained Logic nebo Progress Override.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): možnosti výpočtu pro kritičnost a časovou rezervu.
- [Závislosti a prodlevy](docs://uitleg-relaties): možnost výpočtu *Kalendář prodlev*.
- [Soubory a formáty](docs://uitleg-bestanden): co export nese a co ne.
- [Export](docs://howto-exporteren): export projektu.
- [Aktualizace průběhu](docs://howto-voortgang-bijwerken): zadání procenta, skutečného zahájení a data stavu.
- [Data, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen): proč se importovaná data mohou lišit od toho, co aplikace počítá sama.
- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): všechny konvence a možnosti výpočtu v jednom seznamu.
