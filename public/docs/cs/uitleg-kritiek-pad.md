# Kritická cesta a časová rezerva

Proč je dokončení vašeho projektu takové, jaké je? A který úkol se může zpozdit o den, aniž se posune předání? Tyto otázky se týkají kritické cesty. Tento článek přesně vysvětluje, co aplikace počítá, a to na příkladu.

## Princip

Plán je síť úkolů, které spojují **závislosti**: dohody, například „okenní rámy se osadí až po uzavření střechy“. Závislosti spojují úkoly dohromady. Některé řetězce úkolů jsou delší než jiné. Nejdelší řetězec určuje, jak dlouho bude trvat celý projekt.

Tento nejdelší řetězec je **kritická cesta**. Pokud se jeden úkol na ní zpozdí o den, posune se předání o den. Na kritické cestě není žádná rezerva.

Úkoly mimo kritickou cestu rezervu mají. Ta rezerva se nazývá **časová rezerva**. Zedník, který staví vnější vrstvu dutinové zdi, může začít o dva dny později, aniž si toho kdokoli všimne. Ty dva dny tvoří časovou rezervu tohoto úkolu.

Označení kritický tedy nevypovídá nic o tom, jak podstatný úkol je. Říká jen, že není žádný čas navíc.

Výpočetní metoda se nazývá **CPM** (Critical Path Method). Proto se oddíl s výsledky v panelu *Vlastnosti* jmenuje *Výsledek CPM*.

## Jak aplikace počítá

Aplikace sama plán nepřepočítává. Výpočet začíná příkazem **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*. Pokud se od posledního výpočtu něco změnilo, stavový řádek zobrazí hlášku *Zastaralé — přepočítejte (F5)*. Je-li zapnuto *Automaticky přepočítat* (na kartě *Nastavení › Projekt › Nastavení*, na kartě *Plán*, v nadpisu *Přepočítání*), aplikace to udělá sama.

Výpočet projde síť dvakrát.

### Dopředný průchod

Aplikace začíná u zahájení projektu a sleduje závislosti od předchůdce k následníkovi. U každého úkolu najde nejdřívější den, kdy může úkol začít. Má-li úkol více předchůdců, počká na dokončení posledního z nich. Tím každý úkol dostane své **nejdřívější zahájení** a **nejdřívější dokončení**. Nejpozdější z nejdřívějších dokončení všech úkolů je dokončení projektu.

### Zpětný průchod

Aplikace pak postupuje zpět, od dokončení projektu k zahájení projektu. U každého úkolu teď najde poslední den, do kterého musí být úkol dokončen, aniž se posune dokončení projektu. Má-li úkol více následníků, rozhoduje ten, který musí začít jako první. Tím vzniknou **pozdní zahájení** a **pozdní dokončení**.

### Celková a volná časová rezerva

Rozdíl mezi pozdními termíny a nejdřívějšími termíny úkolu je jeho **celková časová rezerva**: počet pracovních dnů, o který se může úkol zpozdit nebo později začít, aniž se posune dokončení projektu. Aplikace počítá v pracovních dnech kalendáře úkolu. Víkend ani svátek se nepočítá.

**Volná časová rezerva** je přísnější. Je to rezerva, kterou má úkol, než musí některý z jeho následníků začít později. Tuto rezervu můžete využít, aniž si toho všimne jiný úkol.

Celkovou časovou rezervu lze sdílet. Pokud na sebe navazují dva nekritické úkoly, sdílejí stejnou rezervu. Využije-li ji první úkol celou, druhý už žádnou nemá. První úkol pak má celkovou časovou rezervu, ale žádnou volnou. Část celkové časové rezervy, která není volná, se nazývá **rušivá časová rezerva**: když ji využijete, posunou se i úkoly, které za ním následují. Příklad níže to ukazuje na číslech.

### Záporná časová rezerva

Časová rezerva může být také záporná. Stane se to, když má úkol konečný termín nebo omezení, které ukládá nejpozdější datum, a to dříve, než je datum, které aplikace pro úkol určí. Na papíře je úkol už zpožděný a úkol i řetězec před ním se stanou kritickými.

### Kdy je úkol kritický?

Ve výchozím nastavení je úkol kritický, když je jeho celková časová rezerva 0 nebo méně. Změnit to lze na kartě *Nastavení › Projekt › Info o projektu*, v oddílu *Profil výpočtu a možnosti výpočtu*, v poli *Možnosti výpočtu tohoto projektu*. Když kliknete na *Použít*, aplikace plán ihned přepočítá. Tato nastavení patří k souboru projektu, ne k aplikaci.

- **Definice kritického úkolu** pomocí *Celková časová rezerva ≤ prahová hodnota* a pole *Prahová hodnota (pracovní dny)*. Prahová hodnota je ve výchozím nastavení 0. Chcete-li si pohlídat rezervu, nastavte například 2: každý úkol s 2 pracovními dny časové rezervy nebo méně se pak počítá jako kritický a zobrazí se červeně.
- **Označit téměř kritické** s vlastní položkou *Prahová hodnota*, ve výchozím nastavení 2 pracovní dny. Úkol s rezervou větší než 0, ale nejvýše tak velkou, dostane oranžový pruh. Tak je vidět, které úkoly mají téměř žádnou rezervu, aniž by se označovaly jako kritické.
- **Úkoly s otevřeným dokončením jsou kritické**: úkol bez následníka, který ještě není dokončen, se počítá jako kritický. Hodí se jako pojistka proti zapomenutým závislostem (viz níže v části o nesprávných představách).
- **Výpočet časové rezervy** určuje, zda se celková časová rezerva měří od zahájení úkolu, od jeho dokončení, nebo jako menší z těchto dvou hodnot. Nové projekty mají nastaveno *Automaticky (výchozí)*. Pokud chcete počítat jako Primavera P6, nastaví tlačítko *Použít výchozí možnosti tohoto profilu* tuto volbu na *Časová rezerva dokončení*. U MS Project nastaví stejné tlačítko zpět *Automaticky (výchozí)*: s datem stavu totiž MS Project počítá sám tak.

### Kde to uvidíte

Kritické úkoly mají v Gantt diagramu červený pruh. Za nekritickým pruhem je zelený pás až k pozdnímu dokončení úkolu: to je časová rezerva. Pás zapnete nebo vypnete na kartě *Zobrazení › Směrné plány a průběh › Pás časové rezervy*.

U vybraného úkolu uvádí panel *Vlastnosti* všechno v sekci *Výsledek CPM*: nejdřívější a pozdní zahájení a dokončení, celkovou, volnou a rušivou časovou rezervu a to, zda je úkol na kritické cestě. Rezervy všech úkolů vedle sebe jsou ve sloupcích pod nadpisem *Vypočítané* (**+** vpravo v záhlaví tabulky), například *Celková časová rezerva*, *Volná časová rezerva*, *Kritický* a *Téměř kritický*.

Stavový řádek dole počítá kritické úkoly, například *Kritická cesta: 21 úkolů, 45 pracovních dnů*.

## Příklad: House extension

Příklad je cvičný projekt z kurzu *House extension* ve stavu, kdy jsou všechny závislosti zadány. V kurzu 2 „Závislosti a kritická cesta“ si ho sestavíte sami a zkontrolujete čísla. Tady se dozvíte, proč jsou čísla taková, jaká jsou.

Projekt začíná v pondělí 7. června 2027. Po výpočtu je předání v pátek 6. srpna 2027 a v stavovém řádku se zobrazí *Kritická cesta: 21 úkolů, 45 pracovních dnů*. Dva úkoly nejsou kritické: *Build outer cavity leaf* a *Painting*.

### Dva řetězce, které se stýkají

Po nosné podlaze (*Lay hollow-core floor*, dokončeno v pondělí 28. června) se stavba rozdělí do dvou řetězců. Oba končí úkolem *Install window frames*:

- Vnitřní část: *Build inner cavity leaf* (5 pracovních dnů), pak *Place roof elements* (1), pak *Apply roofing* (2). Okenní rámy lze osadit až po uzavření střechy.
- Vnější část: *Build outer cavity leaf* (6 pracovních dnů). Rámy jsou ve fasádě, proto musí být dokončena i tato část.

**Dopředný průchod.** Obě dutinové vrstvy mohou začít v úterý 29. června. Vnitřní vrstva je hotová v pondělí 5. července. Střešní prvky se osadí v úterý 6. července, střešní krytina navazuje ve středu 7. a ve čtvrtek 8. července. Vnější vrstva je hotová v úterý 6. července. *Install window frames* čeká na pozdější z obou řetězců, tedy na střešní krytinu, a začne tak v pátek 9. července.

**Zpětný průchod.** Rámy musí začít nejpozději v pátek 9. července, jinak se posune předání. Vnější vrstva tedy musí být nejpozději ve čtvrtek 8. července hotová. Šest pracovních dnů zpět je to pozdní zahájení ve čtvrtek 1. července.

**Časová rezerva.** Vnější vrstva může začít nejdříve 29. června a musí začít nejpozději 1. července. Mezi tím jsou 2 pracovní dny: středa 30. června a čtvrtek 1. července. To je její celková časová rezerva. V panelu se zobrazí *Celková časová rezerva: 2 dny* a *Kritická cesta: Ne*. Volná časová rezerva je také 2 dny, protože její jediný následník, *Install window frames*, je na kritické cestě.

Vnitřní řetězec nemá žádnou rezervu. Každý den zpoždění tam posune rámy a vše za nimi.

### Painting

*Painting* (3 pracovní dny) začíná po omítání v pondělí 26. července a je dokončeno ve středu 28. července. Následující úkol, *Snagging and cleaning*, čeká také na obkládání. To je dokončeno až ve čtvrtek 5. srpna, protože podlahový potěr musí nejdřív pět pracovních dnů schnout. Úkol Painting tedy může běžet až do čtvrtka 5. srpna. Celkem je to 6 pracovních dnů časové rezervy: 29. a 30. července a 2. až 5. srpna. I zde se volná časová rezerva rovná celkové, protože následník je kritický.

### Když se vnější vrstva zpozdí

Pokud vnější vrstva zabere 8 pracovních dnů místo 6, je hotová ve čtvrtek 8. července: přesně na svém pozdním dokončení. Rezerva je pryč a úkol se zobrazí červeně. Oba řetězce jsou pak kritické a stavový řádek počítá 22 kritických úkolů. Předání zůstává v pátek 6. srpna.

Pokud to zabere 9 pracovních dnů, je vnější vrstva hotová až v pátek 9. července. Rámy se posunou na pondělí 12. července a předání na pondělí 9. srpna: o jeden pracovní den později. Vnější řetězec je teď kritickou cestou. V stavovém řádku se zobrazí *Kritická cesta: 19 úkolů, 46 pracovních dnů*.

Vnitřní řetězec pak má 1 pracovní den celkové časové rezervy, ale ten den se sdílí:

- *Build inner cavity leaf*: celková časová rezerva 1, volná časová rezerva 0, rušivá časová rezerva 1. Pokud se vnitřní vrstva zpozdí o den, posunou se s ní střešní prvky.
- *Place roof elements*: celková časová rezerva 1, volná časová rezerva 0, rušivá časová rezerva 1.
- *Apply roofing*: celková časová rezerva 1, volná časová rezerva 1. Jen tady zpoždění o jeden den nikoho nestojí.

Je to ten samý jeden den, který sdílí celý řetězec. Pokud jej vnitřní vrstva využije, pro střešní prvky a střešní krytinu už nezbude nic.

### Téměř kritické úkoly a záporná časová rezerva

Když je zapnuta volba *Označit téměř kritické* s výchozí prahovou hodnotou 2 pracovní dny, dostane vnější vrstva, která má přesně 2 dny rezervy, oranžový pruh. Úkol Painting s 6 dny zůstane modrý.

Pokud předání dostane konečný termín ve středu 4. srpna, tedy dva pracovní dny před předáním podle výpočtu, časová rezerva se stane zápornou. Všech 21 úkolů na kritické cestě dostane celkovou časovou rezervu −2 pracovní dny. Vnější vrstva nemá žádnou rezervu a také se stane kritickou. Úkol Painting si ponechá 4 pracovní dny.

## Důsledky a nesprávné představy

**„Kritické znamená podstatné.“** Ne. Kontrola může být zásadní a přesto mít časovou rezervu. Naopak jednoduchý úkol může být kritický: v příkladu je *Snagging and cleaning* na kritické cestě. Kritický se týká jen času: nezbývá žádná rezerva.

**„Tento úkol má rezervu, takže může počkat.“** Nejdřív se podívejte na volnou časovou rezervu. Pokud úkol má celkovou časovou rezervu, ale žádnou volnou, každý den zpoždění ubírá rezervu úkolům za ním, jako u vnitřní vrstvy v případě 9 pracovních dnů.

**Zapomenutá závislost dává falešnou rezervu.** Úkol bez následníka dostane rezervu až do dokončení projektu. Kdyby v příkladu chyběla závislost mezi vnější vrstvou a rámy, měla by vnější vrstva najednou 23 pracovních dnů časové rezervy, až do předání 6. srpna. Na papíře by pak mohla mít zpoždění několik týdnů, aniž by na ni rámy čekaly. Když je zapnuta volba *Úkoly s otevřeným dokončením jsou kritické*, vnější vrstva se v tom případě stane kritickou a mezera se ukáže.

**Kritická cesta není pevná.** Když se nekritický úkol zpozdí víc, než je jeho rezerva, stane se nejdelším jiný řetězec. Výše jste to viděli u 9 pracovních dnů zdění. Plán se proto musí přepočítat po každé změně. Dokud stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*, červené pruhy stále patří k předchozímu výpočtu.

**Časová rezerva se počítá v pracovních dnech.** Časová rezerva úkolu Painting, tedy 6 pracovních dnů, sahá od čtvrtka 29. července do čtvrtka 5. srpna: v diáři je to osm dnů, protože víkend se nepočítá. Svátek nebo letní stavební uzávěra v kalendáři se také nepočítá.

## Viz také

- [Přidání závislostí](docs://howto-relaties-leggen): postup, jak propojit úkoly a nastavit prodlevu.
- [Závislosti a prodleva](docs://uitleg-relaties): jak závislosti a prodleva určují nejdřívější termíny.
- [Omezení a konečné termíny](docs://uitleg-constraints): jak omezení nebo konečný termín vytvoří zápornou časovou rezervu.
- [Sledování cesty](docs://howto-pad-traceren): sledování řetězce za úkolem.
- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): definice kritického úkolu, téměř kritické úkoly a výpočet časové rezervy, možnost po možnosti.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): velký projekt s více cestami časové rezervy, téměř kritickými úkoly (prahová hodnota 3 pracovní dny), překlenovacím úkolem, pevným bodem a vazbou mezi projekty.
