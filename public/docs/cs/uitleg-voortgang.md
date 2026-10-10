# Průběh, datum stavu a směrný plán

Plán je předpověď. Jakmile práce probíhá, chcete vědět, co je hotové, co ještě zbývá a co to znamená pro předání. Tento článek vysvětluje, jak aplikace zpracovává průběh: co dělá datum stavu, jak aplikace počítá zbývající práci, proč úkol, který už začal, někdy ještě čeká na svého předchůdce, a jak porovnáte aktuální stav s původní dohodou. Příklad s čísly ukazuje, jak to funguje.

## Základní pojmy

**Průběh** je to, co se skutečně stalo. U každého úkolu aplikace eviduje tři věci: procento, **skutečné zahájení** a **skutečné dokončení**. Co plán předpověděl, zůstává vedle toho. Skutečnost je to, co se opravdu stalo.

**Datum stavu** je den, kdy zhodnotíte stav. Vše, co se stalo před tímto dnem, je fakt. Vše, co ještě musí proběhnout, plánuje aplikace od začátku tohoto dne. Skutečné datum může připadnout na datum stavu, ale nikdy nemůže být po něm.

**Zbývající práce** je to, co na úkolu zbývá udělat. Úkol o 4 pracovních dnech, který je z 25 % hotový, má 3 pracovní dny zbývající práce.

**Směrný plán** je snímek plánu v určitém okamžiku, obvykle v okamžiku schválení dohody. Později vedle něj položíte skutečný plán a uvidíte, jak se provedení odchyluje.

## Jak aplikace počítá

Příklad níže používá profil výpočtu *Open Planner Studio*, se kterým nový projekt počítá. Dále se dočtete, co se liší v profilech Primavera P6 a Microsoft Project.

Aplikace sama nepřepočítává. Po každé změně průběhu nebo data stavu zobrazí stavový řádek *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například přes *Plán › Plán › Přepočítat*. Je-li zapnutá volba *Automaticky přepočítat* (na kartě *Nastavení › Projekt › Nastavení*, na kartě *Plán*, v nadpisu *Přepočítání*), aplikace to udělá sama.

### Datum stavu

Datum stavu má tři účinky.

Za prvé, aplikace odmítne skutečné datum, které je po datu stavu. Datum přesně na datu stavu je v pořádku.

Za druhé, práce, která ještě nezačala, nemůže ležet v minulosti. Je-li takový úkol naplánovaný před datem stavu, aplikace jej přesune na datum stavu. Stejně se posunou i úkoly po něm, které se hýbou podle svých závislostí. Účinek vidíte v příkladu níže. V profilu Microsoft Project aplikace toto nedělá.

Za třetí, zbývající práce úkolu, který už běží, začíná přesně na datu stavu. Aplikace bere datum stavu jako začátek toho dne. Zhodnotíte-li stav v pátek po pracovní době, nastavte datum stavu na pondělí. Nastavíte-li pátek, aplikace zbývající práci plánuje stále na ten pátek.

Nemáte-li zatím datum stavu a zadáte průběh, aplikace nastaví datum stavu na dnešek a upozorní vás na to. Bez data stavu aplikace počítá běžící úkol dopředu se zbývající dobou trvání, ale dozadu s plnou dobou trvání. Časová rezerva pak vyjde záporně a úkol vypadá kriticky bez důvodu.

### Procento, skutečná data a zbývající doba trvání

Pole na sobě závisí. Vyplníte-li jedno, aplikace doplní ostatní.

- Procento větší než 0 znamená, že úkol začal. Nezadáte-li skutečné zahájení, aplikace použije plánované zahájení. Je-li úkol naplánován na zahájení po datu stavu, aplikace se nejdřív zeptá, kdy skutečně začal.
- Procento 100 znamená dokončeno. Nezadáte-li skutečné dokončení, stane se jím datum stavu, i když práce byla ve skutečnosti hotová dříve.
- Skutečné dokončení udělá z úkolu 100 %. Vrátíte-li dokončený úkol pod 100 %, skutečné dokončení se zruší. Vymažete-li skutečné dokončení, procento se vrátí na 0 a úkol zůstane *Probíhá*, dokud nevymažete také skutečné zahájení.
- **Zbývající doba trvání** je doba trvání násobená tím, co ještě zbývá, zaokrouhlená na celé pracovní dny. U úkolu o 2 pracovních dnech dávají 0 % i 25 % zbývající práci 2 pracovní dny a 50 % i 75 % dávají 1. Při 90 % aplikace zaokrouhlí na 0: zbývající práce je pak hotová na datu stavu. Úkol v hodinách se počítá v celých minutách. Úkol s 5 hodinami při 40 % má 3 hodiny zbývající práce.
- Milník má jen jedno skutečné datum.
- Fáze (souhrnný úkol) nemá vlastní průběh. Po vypočtení jeho procento vyplyne z úkolů pod ním: vážený průměr jejich procent, kde váhou je doba trvání v pracovních dnech. Milník má váhu 0.

Změníte-li dobu trvání úkolu, který už běží, hotová práce zůstane hotová. Procento se upraví. Úkol s 5 pracovními dny, hotový z 60 %, který nastavíte na 10 pracovních dnů, skončí na 30 %. Aplikace odmítne dobu trvání kratší, než je práce, která už je hotová.

### Dokončené a běžící úkoly

Dokončený úkol je pevně daný svými skutečnými daty. Už se nehýbe a s datem stavu nikdy není kritický. Bez data stavu může být dokončený úkol stále kritický.

Běžící úkol si zachová skutečné zahájení. Hýbe se jen jeho zbývající práce. Kde zbývající práce začíná, závisí na režimu průběhu.

### Retained Logic a Progress Override

Co udělá aplikace, když úkol už začal, zatímco jeho předchůdce ještě běží? Taková závislost se nazývá **průběh mimo posloupnost**: průběh odporuje pořadí. Představte si malíře, který už začne v místnosti, která je omítnutá, zatímco omítkář je ještě zaneprázdněn jinde.

Dva režimy průběhu rozhodují, jak aplikace počítá:

- **Retained Logic** (výchozí): závislost zůstává v platnosti. Zbývající práce následníka se řídí závislostí. U dokončení-zahájení začne až po dokončení předchůdce a nikdy před datem stavu.
- **Progress Override**: rozhodující je skutečnost. Zbývající práce následníka začne na datu stavu, bez čekání na předchůdce.

V tomto profilu je rozdíl jen ve zbývající práci úkolů, které už začaly, zatímco předchůdce ještě není hotový. Ostatní úkoly se počítají stejně v obou režimech. Aplikace takovou závislost hlásí v obou režimech: na stavovém řádku jako *Závislosti mimo posloupnost: 1* a v panelu *Varování*.

### Směrné plány a odchylky

Při uložení aplikace zaznamená u každého úkolu bez dílčích úkolů nejdřívější zahájení, nejdřívější dokončení, dobu trvání a typ milníku. Souhrnné úkoly v tom nejsou. Co změníte později, směrný plán nezmění. Můžete mít více směrných plánů, ale přesně jeden je **aktivní**. Gantt, sestava odchylek a sestava průběhu používají aktivní směrný plán.

**Odchylka** je rozdíl v pracovních dnech mezi směrným plánem a aktuálním plánem. Plus znamená později, minus dříve. Aplikace počítá v kalendáři projektu. Sestava odchylek dává odchylku začátku a dokončení pro každý úkol. Stav vyplývá jen z dokončení: *Opožděno* při plusu, *Dříve* při minusu, jinak *V plánu*. Úkol přidaný po směrném plánu se nazývá *Nový*. Úkol, který už neexistuje, je *Vypuštěno*.

Dvě poznámky. Odchylka doby trvání je v tabulce úkolů (sloupec *Odchylka doby trvání*), ne v sestavě odchylek. Porovnává plánovanou dobu trvání úkolu nyní s tou ve směrném plánu. Průběh tuto plánovanou dobu nemění: úkol naplánovaný na dva dny, který trval tři, má proto odchylku dokončení +1, ale odchylku doby trvání 0. A uložíte-li směrný plán poté, co zadáte průběh, zaznamená stav s těmi skutečnými daty. Odchylka je pak nula.

Sestava průběhu staví plánovaný průběh vedle skutečného. Obojí je váženo pracovními dny. *Plánovaný* je podíl každého úkolu, který měl být podle směrného plánu hotový k datu stavu. *Skutečný* je procento, které bylo zadáno.

### Kde to vidíte

V diagramu Gantt označuje čárkovaná čára datum stavu, datum je v záhlaví. U každého běžícího úkolu se čára vyboulí do bodu na pruhu, který odpovídá procentu. To je **čára průběhu**. Vypnete-li čáru průběhu a necháte čáru datumu stavu zapnutou, zůstane rovná čára. Vypnete-li obě, zmizí čára i popisek. Tlačítka *Překryv směrného plánu*, *Čára průběhu* a *Čára datumu stavu* najdete na kartě *Zobrazení › Směrné plány a průběh*. Nic z nich nemění výpočet. Směrný plán se zobrazí jako tenký pruh pod každým pruhem úkolu. Tabulka úkolů má sloupce pro průběh a pro každý směrný plán odchylku. Na kartě *Sestava* najdete typy sestav *Odchylka* a *Sestava průběhu*.

## Příklad: přístavba po třech týdnech

Příklad je cvičný projekt *House extension* z kurzů ve stavu po přidání všech závislostí: bez letní stavební uzávěry, zdrojů a hodin. V kurzu 6 to uděláte sami v cvičném projektu. Ten projekt má do té doby více obsahu, takže čísla se tam liší. Tady si přečtete, proč jsou čísla taková, jaká jsou.

Přístavba začíná v pondělí 7. června 2027. Na vypočteném plánu aplikace uloží směrný plán s názvem *Směrný plán*: předání v pátek 6. srpna 2027, 45 pracovních dnů.

### Stav v pondělí 28. června

Datum stavu je pondělí 28. června 2027. Stalo se toto:

- *Start of construction*, *Set up site*, *Clear garden and paving* a *Set out the extension* jsou hotové podle plánu, od 7. do 10. června.
- *Excavate foundation trench* byl naplánován na 2 pracovní dny (pátek 11. a pondělí 14. června) a trval 3: od 11. do 15. června.
- *Foundation formwork and reinforcement* běží od 16. do 18. června. *Reinforcement inspection* je 18. června, *Pour foundation* v pondělí 21. června.
- *Foundation brickwork* (2 pracovní dny) začal v pátek 25. června a je z 50 % hotový.

Po přepočítání (**Přepočítat**) aplikace počítá takto:

- Zbývající práce úkolu *Foundation brickwork* je 2 × (1 − 0.5) = 1 pracovní den. Začíná na datu stavu, proto skončí v pondělí 28. června.
- *Lay hollow-core floor* navazuje v úterý 29. června. Proto *Build inner cavity leaf* začne ve středu 30. června místo v úterý 29. června. Předání přijde v pondělí 9. srpna: o jeden pracovní den později než směrný plán. Jeden extra den výkopu je tedy zpoždění celého projektu, protože ten úkol byl na kritické cestě.
- Stavový řádek hlásí *Kritická cesta: 13 úkolů, 46 pracovních dnů*, oproti 21 úkolům a 45 pracovním dnům před průběhem. Osm dokončených úkolů, které byly na kritické cestě, se už nepočítá.
- Fáze *Foundations* je na 77,8 %. Úkoly v ní mají váhu 2 + 3 + 1 + 2 + 1 = 9 pracovních dnů. Hotové jsou 2 + 3 + 1 pracovní dny a polovina z 2: celkem 7. A 7 z 9 je 77,8 %. Milník *Reinforcement inspection* má váhu 0.

Sestava odchylek to staví vedle směrného plánu:

- *Excavate foundation trench*: začátek 0, dokončení +1 (dokončení ve směrném plánu 14. června, nyní 15. června).
- *Foundation brickwork*: začátek +1 (24. června se změnilo na 25. června), dokončení +1.
- *Build outer cavity leaf*: +1, +1. Ten úkol ještě není kritický: měl 2 pracovní dny časové rezervy a ty si zachová.
- *Handover*: +1. Dokončení projektu se odchyluje o 1 pracovní den.
- Celkem je 19 úkolů ve stavu *Opožděno* a 4 ve stavu *V plánu*. Žádný úkol není ve stavu *Dříve*.

Sestava průběhu ukazuje *Plánovaný* 28,3 % a *Skutečný* 23,9 %. Úkoly mají dohromady 46 pracovních dnů. Podle směrného plánu mělo být hotových 13: 4 pracovní dny přípravy, 2 za výkop, 3 za armování, 1 za nalití, 2 za *Foundation brickwork* a 1 za *hollow-core floor*. Skutečně je hotovo 11: 4 + 2 + 3 + 1, plus jeden pracovní den úkolu *Foundation brickwork*.

### Co když přesunete datum stavu?

Stejný průběh, jiné datum stavu. Zbývající práce úkolu *Foundation brickwork* vždy začíná na datu stavu, takže se s ním posune i předání:

- Datum stavu v pátek 25. června: zbývající práce připadne na pátek 25. června, předání zůstane v pátek 6. srpna.
- Pondělí 28. června: předání v pondělí 9. srpna.
- Úterý 29. června: předání v úterý 10. srpna, o 2 pracovní dny později než směrný plán.

### Co když změníte procento?

*Foundation brickwork* má 2 pracovní dny. Při 0 % nebo 25 % je zbývající práce 2 pracovní dny: skončí v úterý 29. června a předání bude v úterý 10. srpna. Při 50 % nebo 75 % je to 1 pracovní den: v pondělí 28. června, předání v pondělí 9. srpna. Při 90 % je zbývající práce 0 a úkol skončí na datu stavu.

### Co když nastavíte datum stavu bez zadání průběhu?

Nastavíte-li jen datum stavu na pondělí 28. června a nezadáte nic, pak podle plánu zatím nic nenastalo. Práce, která ještě nezačala, nemůže ležet v minulosti. Aplikace proto přesune všechno na 28. června: *Start of construction* je pak na ten den a předání přijde v pátek 27. srpna, 15 pracovních dnů po směrném plánu. Proto nejdřív zadejte průběh, který existuje.

## Příklad: omítač a malíř

Nyní příklad pro režim průběhu. Stejná přístavba, jiný stav: je středa 21. července 2027. Vše až včetně *Install building services* je hotovo podle plánu. *Plastering* (4 pracovní dny) začal v úterý 20. července a je na 25 %. *Painting* (3 pracovní dny) navazuje na *Plastering*, ale malíř už začal dnes a je na 33 %.

Bez průběhu měl *Plastering* plánované termíny od úterý 20. do pátku 23. července a *Painting* od pondělí 26. do středy 28. července. Stavový řádek nyní hlásí *Závislosti mimo posloupnost: 1*. Úkol *Painting* už začal, ale úkol *Plastering* ještě není hotový. V panelu *Varování* stojí: *Mimo posloupnost: průběh následníka je v rozporu se závislostí*.

*Plastering* má 4 × (1 − 0.25) = 3 pracovní dny zbývající práce: 21., 22. a 23. července. *Painting* má 3 × (1 − 0.33) = 2 pracovní dny zbývající práce.

- Při **Retained Logic** může zbývající práce začít až po dokončení *Plastering*. To je pátek 23. července. *Painting* proto začne v pondělí 26. července a skončí v úterý 27. července. Pruh vede od skutečného zahájení 21. července do 27. července. Celková časová rezerva je 7 pracovních dnů.
- Při **Progress Override** začne zbývající práce v datu stavu. *Painting* skončí ve čtvrtek 22. července, dřív než je úkol *Plastering* hotový. Celková časová rezerva je 10 pracovních dnů.

Předání zůstává v obou případech na pátek 6. srpna, protože úkol *Painting* měl tak jako tak časovou rezervu.

### Další profily výpočtu

U profilů Primavera P6 a Microsoft Project skončí malování v tomto příkladu ve stejných dnech (27. a 22. července). Liší se v těchto bodech. Jsou to konvence profilu. Najdete je na kartě *Nastavení › Projekt › Info o projektu*, v části *Profil výpočtu a možnosti výpočtu*.

- V profilu Microsoft Project se práce, která ještě nezačala, nepřesune na datum stavu (konvence *Nezahájené úkoly nepřesouvat na datum stavu*). Pokud v příkladu výše nastavíte jen datum stavu a nic nezadáte, předání v tomto profilu zůstane na pátek 6. srpna.
- V profilu Microsoft Project zbývající práce také nezačne dřív než skutečné zahájení plus uplynulá doba trvání (konvence *Zbývající práce pokračuje po uplynulé době trvání*). Je to další dolní mez vedle data stavu: platí pozdější z obou. Vezměte úkol *Build inner cavity leaf* (5 pracovních dnů). Začal v úterý 29. června a ve středu 30. června, což je datum stavu, je na 40 %. Dvě party zedníků zdí současně, takže 40 % je už po jednom dni hotovo. Vše před ním je hotovo podle plánu. Open Planner Studio a Primavera P6 nechají úkol skončit v pátek 2. července. Microsoft Project ho nechá skončit v pondělí 5. července, protože úterý 29. června plus 2 uplynulé pracovní dny je čtvrtek 1. července, tedy po datu stavu.
- Primavera P6 zobrazuje jako nejdřívější zahájení běžícího úkolu začátek zbývající práce, ne skutečné zahájení (v příkladu s *Build inner cavity leaf* středa 30. června).
- V profilu Primavera P6 se při Progress Override závislost na následníkovi, který už začal, nepočítá ani pro předchůdce. Taková závislost už neomezuje jeho pozdní termíny ani volnou časovou rezervu (konvence *Progress Override ignoruje zahájeného následníka i při výpočtu zpět*). V příkladu s *Plastering* a *Painting* to nevidíte. Úkol *Plastering* je stejně kritický kvůli potěru podlahy, takže jeho pozdní termíny a volná časová rezerva jsou stejné při Retained Logic i při Progress Override.
- Když otevřete .xer file, aplikace převezme režim průběhu ze souboru. Režim Actual Dates, třetí režim P6, aplikace nezná. Takový soubor se počítá jako Retained Logic.

## Důsledky a nedorozumění

**„Posunu jen datum stavu dál.“** Když ho posunete, zbývající práce běžících úkolů začne od nového data. Práce, která ještě nezačala, nemůže nikdy ležet před tímto datem. Posouvejte proto datum stavu jen spolu s aktualizací průběhu.

**„Zadání 100 % zaznamená skutečné dokončení.“** Platí jen tehdy, když zadáte i skutečné dokončení. Pokud úkol nastavíte na 100 % bez skutečného dokončení, dokončení se stane datem stavu. Pokud byl ve skutečnosti hotový dřív, vyplňte skutečné dokončení.

**„0 % znamená, že úkol nezačal.“** Má-li úkol skutečné zahájení, počítá se jako začatý, i při 0 %. Zbývající práce je pak celá doba trvání a začne od datu stavu. Vymažte skutečné zahájení, aby se úkol znovu počítal jako nezačatý.

**„Progress Override vyřeší upozornění.“** Hlášení o průběhu mimo posloupnost zůstane. Režim jen určuje, jak aplikace počítá. Pokud už závislost neplatí, změňte závislost.

**„Přestávka v rozděleném úkolu vypadne.“** Ne: přestávka v části, která ještě zbývá, zůstane ve zbývající práci. Vezměte úkol s dobou trvání 5 pracovních dnů, s 1-denní přestávkou po 2 dnech práce. Začal v úterý 29. června a při datu stavu ve středu 30. června je na 40 %. Zbývající práce, 3 pracovní dny, začne od datu stavu a běží přes přestávku. Dokončení je v pondělí 5. července. Bez přestávky by bylo v pátek 2. července.

**Hodiny a datum stavu.** V pásu karet nelze zadat čas. Datum stavu vyplníte jako datum. Děláte-li přehled po skončení pracovních hodin, nastavte datum stavu na další pracovní den. Úkol v hodinách počítá zbývající práci od začátku data stavu. Vezměte *Lay hollow-core floor* v cvičném projektu po kurzu 4: 5 hodin, v pondělí 28. června, pracovní den od 07:00. Při datu stavu v pondělí 28. června a úkolu na 40 % má 3 hodiny zbývající práce, od 07:00 do 10:00, i když se ráno část práce už odvedla. Jak aplikace počítá hodiny, je vysvětleno v [Dny a hodiny](docs://uitleg-dagen-en-uren).

**Aktualizace směrného plánu.** To není možné. Uložíte nový a starý odstraníte. Když projekt přesunete, skutečné termíny a datum stavu se posunou spolu s ním. Směrné plány se ve výchozím nastavení neposunou. Tak zůstane posun vidět jako odchylka. Viz [Přesun projektu](docs://howto-project-verplaatsen).

## Viz také

- [Aktualizace průběhu](docs://howto-voortgang-bijwerken): nastavení data stavu a zadání průběhu.
- [Import průběhu z tabulky](docs://howto-voortgang-importeren): načtení průběhu od pracovníků na stavbě najednou.
- [Výběr režimu průběhu](docs://howto-voortgangsmodus-kiezen): nastavení Retained Logic nebo Progress Override.
- [Uložení a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren): uložení směrného plánu a jeho použití.
- [Přesun projektu](docs://howto-project-verplaatsen): co se stane se skutečnými termíny, datem stavu a směrnými plány.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): proč je úkol kritický a co znamená časová rezerva.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): průběh a datum stavu uprostřed projektu (20. května 2027).
