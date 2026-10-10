# Kritická cesta a časová rezerva

Proč má datum dokončení vašeho projektu právě tuto hodnotu? A který úkol může běžet o jeden den později, aniž se posune předání? Na tyto otázky odpovídá kritická cesta. Tento článek přesně vysvětluje, co aplikace přepočítává, a to na příkladu.

## Princip

Plán je síť úkolů spojených **závislostmi**: dohodami, například „okenní rámy se osadí až po uzavření střechy“. Tyto závislosti spojují úkoly. Některé řetězce úkolů jsou delší než jiné. Nejdelší řetězec určuje, jak dlouho trvá celý projekt.

Ten nejdelší řetězec je **kritická cesta**. Když úkol na ní má zpoždění o jeden den, posune se předání o jeden den. Na kritické cestě není žádná rezerva.

Úkoly mimo kritickou cestu rezervu mají. Tato rezerva se nazývá **časová rezerva**. Zedník, který staví vnější vrstvu zdiva, může začít o dva dny později, aniž si toho někdo všimne. Tyto dva dny jsou časovou rezervou tohoto úkolu.

Slovo kritický tedy neříká nic o tom, jak důležitý úkol je. Říká jen, že není žádný čas navíc.

Metoda výpočtu se jmenuje **CPM** (Critical Path Method). Proto se blok s výsledky v panelu *Vlastnosti* jmenuje *Výsledek CPM*.

## Jak aplikace přepočítává

Aplikace nepřepočítává plán sama. Výpočet začíná příkazem **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*. Když se od posledního výpočtu něco změnilo, ukáže stavový řádek *Zastaralé — přepočítejte (F5)*. Když je zapnutá volba *Automaticky přepočítat* (v nabídce *Nastavení › Projekt › Nastavení*, na kartě *Plánování*, pod nadpisem *Přepočítání*), udělá to aplikace sama.

Výpočet projde síť dvakrát.

### Dopředný průchod

Aplikace začne u zahájení projektu. Sleduje závislosti od předchůdce k následníkovi. U každého úkolu najde nejdřívější den, kdy může začít. Když má úkol více předchůdců, čeká na dokončení posledního z nich. Tak každý úkol dostane **nejdřívější zahájení** a **nejdřívější dokončení**. Nejpozdější nejdřívější dokončení ze všech úkolů je datum dokončení projektu.

### Zpětný průchod

Potom aplikace jde zpět, od data dokončení k zahájení. U každého úkolu najde poslední den, kdy musí být dokončen, aniž se posune datum dokončení. Když má úkol více následníků, rozhodující je ten, který musí začít jako první. Tak vzniknou **pozdní zahájení** a **pozdní dokončení**.

### Celková a volná časová rezerva

Rozdíl mezi pozdními a nejdřívějšími termíny úkolu je jeho **celková časová rezerva**. Je to počet pracovních dnů, o které se úkol může zpozdit nebo začít později, aniž se posune datum dokončení projektu. Aplikace počítá v pracovních dnech kalendáře úkolu. Víkend nebo svátek se nepočítá.

**Volná časová rezerva** je přísnější. Je to prostor, který má úkol, než musí některý z jeho následníků začít později. Tento prostor může úkol využít, aniž si toho některý jiný úkol všimne.

Celková časová rezerva se může sdílet. Když po sobě jdou dva nekritické úkoly, sdílejí stejnou rezervu. Když první ji využije, druhý už nemá nic. První úkol pak má celkovou časovou rezervu, ale žádnou volnou. Část celkové časové rezervy, která není volná, se nazývá **rušivá časová rezerva**. Když ji využijete, posunou se i následující úkoly. Příklad níže to ukazuje na číslech.

### Záporná časová rezerva

Časová rezerva může být také záporná. To nastane, když má úkol konečný termín nebo omezení, které ukládá nejpozdější datum, a ten leží před dnem, který aplikace pro úkol přepočítá. Na papíře je úkol už pozdě. Úkol a řetězec před ním se stanou kritickými.

### Kdy je úkol kritický?

Ve výchozím nastavení je úkol kritický, když je jeho celková časová rezerva 0 nebo méně. Toto lze změnit v nabídce *Nastavení › Projekt › Info o projektu*, v bloku *Profil výpočtu a možnosti výpočtu*, u *Možnosti výpočtu tohoto projektu*. Když kliknete na *Použít*, aplikace plán hned přepočítá. Tyto možnosti patří k souboru projektu, ne k aplikaci.

- **Definice kritičnosti** volbou *Celková časová rezerva ≤ prahová hodnota* a polem *Prahová hodnota (pracovní dny)*. Prahová hodnota je ve výchozím nastavení 0. Chcete-li si ponechat rezervu, nastavte například 2. Pak každý úkol s 2 pracovními dny časové rezervy nebo méně se počítá jako kritický a zčervená.
- **Označit téměř kritické** s vlastní *Prahová hodnota*, ve výchozím nastavení 2 pracovní dny. Úkol s rezervou větší než 0, ale nejvýše tolik, dostane jantarový pruh. Tak je vidět, které úkoly mají téměř žádnou rezervu, aniž by se nazývaly kritické.
- **Úkoly s otevřeným dokončením jsou kritické**: úkol bez následníka, který ještě není dokončen, se počítá jako kritický. Je to užitečná pojistka proti zapomenutým závislostem (viz mylné představy níže).
- **Výpočet časové rezervy** rozhoduje, zda se celková časová rezerva měří na začátku úkolu, na jeho dokončení, nebo jako menší z těchto dvou hodnot. Nové projekty mají nastaveno *Automaticky (výchozí)*. Pokud postupujete podle způsobu výpočtu, jaký má Primavera P6, nastaví tlačítko *Použít výchozí možnosti tohoto profilu* tuto volbu na *Časová rezerva dokončení*. U MS Project nastaví totéž tlačítko zpět *Automaticky (výchozí)*: když je zadané datum stavu, MS Project sám přepočítává takto.

### Kde to vidíte

V diagramu Gantt mají kritické úkoly červený pruh. Za nekritickým pruhem je zelený pás až k pozdnímu dokončení úkolu. To je časová rezerva. Pás lze zapnout nebo vypnout v nabídce *Zobrazení › Směrné plány a průběh › Pás časové rezervy*.

Pro vybraný úkol panel *Vlastnosti* uvádí vše pod *Výsledek CPM*: nejdřívější a pozdní zahájení a dokončení, celkovou, volnou a rušivou časovou rezervu a to, zda je úkol na kritické cestě. Časová rezerva všech úkolů vedle sebe je ve sloupcích pod *Vypočítané* (tlačítko **+** vpravo v záhlaví tabulky), například *Celková časová rezerva*, *Volná časová rezerva*, *Kritický* a *Téměř kritický*.

Stavový řádek dole počítá kritické úkoly, například *Kritická cesta: 21 úkolů, 45 pracovních dnů*.

## Příklad: přístavba domu

Příklad je cvičný projekt z kurzů *House extension*, v podobě, v jaké je, když jsou všechny závislosti na místě. V kurzu 2, „Závislosti a kritická cesta“, si ho sestavíte sami a zkontrolujete čísla. Tady přečtete, proč jsou čísla taková, jaká jsou.

Rozšíření začíná v pondělí 7. června 2027. Po přepočtu je předání v pátek 6. srpna 2027 a stavový řádek ukazuje *Kritická cesta: 21 úkolů, 45 pracovních dnů*. Dva úkoly nejsou kritické: *Build outer cavity leaf* a *Painting*.

### Dva řetězce, které se stýkají

Po konstrukční podlaze (*Lay hollow-core floor*, dokončeno v pondělí 28. června) se práce rozdělí na dva řetězce. Oba končí u *Install window frames*:

- Vnitřek: *Build inner cavity leaf* (5 pracovních dnů), pak *Place roof elements* (1), pak *Apply roofing* (2). Okenní rámy se mohou osadit, až když je střecha uzavřená.
- Venku: *Build outer cavity leaf* (6 pracovních dnů). Rámy sedí ve fasádě, takže i tato práce musí být hotová.

**Dopředu.** Obě vrstvy zdiva mohou začít v úterý 29. června. Vnitřní vrstva je hotová v pondělí 5. července. Střešní prvky se kladou v úterý 6. července a krytina následuje ve středu 7. a ve čtvrtek 8. července. Vnější vrstva je hotová v úterý 6. července. *Install window frames* čeká na pozdější z obou řetězců, tedy na krytinu, a začíná v pátek 9. července.

**Zpětně.** Okenní rámy musí začít nejpozději v pátek 9. července, jinak se posune předání. Vnější vrstva tedy musí být hotová nejpozději ve čtvrtek 8. července. Šest pracovních dnů zpět je to pozdní zahájení ve čtvrtek 1. července.

**Časová rezerva.** Vnější vrstva může začít nejdříve 29. června a musí začít nejpozději 1. července. Mezi nimi jsou 2 pracovní dny: středa 30. června a čtvrtek 1. července. To je její celková časová rezerva. Panel ukazuje *Celková časová rezerva: 2 dny* a *Kritická cesta: ne*. Volná časová rezerva je také 2 dny, protože její jediný následník, *Install window frames*, je na kritické cestě.

Vnitřní řetězec nemá žádnou rezervu. Každý den zpoždění tam posune rámy i všechno za nimi.

### Painting

*Painting* (3 pracovní dny) začíná po omítání v pondělí 26. července a je dokončen ve středu 28. července. Následující úkol, *Snagging and cleaning*, také čeká na obklady. Ty jsou dokončeny až ve čtvrtek 5. srpna, protože potěr musí nejdřív pět pracovních dnů schnout. Malování tedy může běžet až do čtvrtka 5. srpna. To dává 6 pracovních dnů časové rezervy: 29. a 30. července a 2. až 5. srpna. I zde se volná časová rezerva rovná celkové, protože následník je kritický.

### Když vnější vrstva běží pozdě

Když vnější vrstva trvá 8 pracovních dnů místo 6, je hotová ve čtvrtek 8. července, přesně na svém pozdním dokončení. Časová rezerva je pryč a úkol zčervená. Obě řetězce jsou pak kritické a stavový řádek počítá 22 kritických úkolů. Předání zůstává v pátek 6. srpna.

Když trvá 9 pracovních dnů, je vnější vrstva hotová až v pátek 9. července. Rámy se posunou na pondělí 12. července a předání na pondělí 9. srpna: o jeden pracovní den později. Vnější řetězec je nyní kritická cesta; stavový řádek ukazuje *Kritická cesta: 19 úkolů, 46 pracovních dnů*.

Vnitřní řetězec pak má 1 pracovní den celkové časové rezervy, ale tento den se sdílí:

- *Build inner cavity leaf*: celková časová rezerva 1, volná časová rezerva 0, rušivá časová rezerva 1. Když vnitřní vrstva běží o den pozdě, posunou se s ní střešní prvky.
- *Place roof elements*: celková časová rezerva 1, volná časová rezerva 0, rušivá časová rezerva 1.
- *Apply roofing*: celková časová rezerva 1, volná časová rezerva 1. Teprve tady zpoždění o den nikoho nic nestojí.

Je to stejný jediný den, sdílený celým řetězcem. Když ho vnitřní vrstva využije, je pryč pro *Place roof elements* a *Apply roofing*.

### Téměř kritické a záporná časová rezerva

Když je zapnuté *Označit téměř kritické* s výchozí prahovou hodnotou 2 pracovní dny, dostane vnější vrstva se svými 2 dny rezervy jantarový pruh. Malování se 6 dny zůstává modré.

Když má předání konečný termín ve středu 4. srpna, dva pracovní dny před přepočteným předáním, stane se časová rezerva záporná. Všech 21 úkolů na kritické cestě má celkovou časovou rezervu −2 pracovní dny. Vnější vrstva už nemá žádnou rezervu a také se stane kritickou. Malování si zachová 4 pracovní dny.

## Důsledky a mylné představy

**„Kritický znamená důležitý.“** Ne. Kontrola může být zásadní, ale přesto mít časovou rezervu. Naopak jednoduchá práce může být kritická: v příkladu je *Snagging and cleaning* na kritické cestě. Kritický se týká jen času: nezbývá žádná rezerva.

**„Tento úkol má rezervu, takže může počkat.“** Nejdřív se podívejte na volnou časovou rezervu. Když úkol má celkovou časovou rezervu, ale žádnou volnou, každý den zpoždění ubere rezervu úkolům za ním, jako u vnitřní vrstvy v případě s 9 pracovními dny.

**Zapomenutá závislost dává falešnou časovou rezervu.** Úkol bez následníka dostane rezervu až do dokončení projektu. Kdyby příklad neměl závislost od vnější vrstvy k rámům, měla by vnější vrstva najednou 23 pracovních dnů rezervy, až do předání 6. srpna. Na papíře by pak mohla běžet týdny pozdě, aniž by rámy čekaly. Když je zapnutá volba *Úkoly s otevřeným dokončením jsou kritické*, vnější vrstva se v tom případě stane kritickou a mezera se ukáže.

**Kritická cesta není pevná.** Když nekritický úkol běží později, než je jeho rezerva, stane se nejdelším jiný řetězec. Výše jste to viděli u zdiva s 9 pracovními dny. Plán se proto musí přepočítat po každé změně. Dokud stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*, patří červené pruhy ještě k předchozímu výpočtu.

**Časová rezerva se počítá v pracovních dnech.** Malování má 6 pracovních dnů časové rezervy: od čtvrtka 29. července do čtvrtka 5. srpna. V diáři je to osm dní, protože víkend se nepočítá. Svátek nebo letní stavební uzávěra v kalendáři se také nepočítá.

## Viz také

- [Přidání závislostí](docs://howto-relaties-leggen): postup, jak propojit úkoly a nastavit prodlevu.
- [Závislosti a prodleva](docs://uitleg-relaties): jak závislosti a prodleva určují nejdřívější termíny.
- [Omezení a konečné termíny](docs://uitleg-constraints): jak omezení nebo konečný termín vytvoří zápornou časovou rezervu.
- [Sledování cesty](docs://howto-pad-traceren): sledování řetězce za úkolem.
- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): definice kritičnosti, téměř kritické úkoly a výpočet časové rezervy, volba po volbě.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): velký projekt, v němž je několik cest časové rezervy, téměř kritické práce (prahová hodnota 3 pracovní dny), překlenovací úkol, pevný termín a vazba mezi projekty.
