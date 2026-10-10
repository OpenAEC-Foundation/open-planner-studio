# Jó ütemezés

Mitől jó egy ütemezés? Nem attól, hogy mennyire rendezett. Attól, hogy választ ad a kérdésre, amely a munka megkezdése után számít: ha ez csúszik, mi történik az átadással? Ez a cikk a megbízható ütemezés alapelveit magyarázza el, és azt, miért nyomnak ezek ilyen sokat az Open Planner Studio-ban: az alkalmazás csak a megadott adatokkal számol, mással nem.

A példák az építőiparból származnak: szerkezeti munkák, befejező szakipari munkák, átfutási idők, időjárási késedelem, alvállalkozók és egy szerződéses átadási dátum. Maguk az elvek azonban nem építőipari jellegűek.

## A fogalom

A jó ütemezés nem a remélt helyzet képe, hanem egy **számítási modell**: tevékenységek időtartammal, kapcsolatokkal összekötve, naptárban. Az alkalmazás ebből a modellből számítja ki a dátumokat. Ha valami megváltozik, a modell újraszámít, és Ön azonnal látja, mit jelent ez a többi tevékenységre nézve.

A tervező fix sorrendben dolgozik:

1. A cél: mérföldkövek és az átadási dátum.
2. A bontás: szakaszok, munkacsomagok, tevékenységek.
3. Az egyes tevékenységek időtartama.
4. A kapcsolatok.
5. Korlátozások és rögzített dátumok.
6. Naptárak.
7. Erőforrások.
8. Kritikus út és tartalékidő.
9. Alapterv és előrehaladás.
10. Felülvizsgálat.

Ez a sorrend nem illemszabály. Ha egy lépés kimarad, az később váratlanul visszaüt: a kapcsolat nélküli tevékenységek nem követik a többit, a naptár nélküli időtartam téves, és a csak utólag rögzített alapterv a késést rögzíti a megállapodás helyett.

## Hogyan számol vele az alkalmazás

Az alábbi elvek mindegyike ahhoz kapcsolódik, amit az alkalmazás tesz. Ezért ez a rész ugyanabban a sorrendben követi azokat.

### A célból induljon ki, ne a tevékenységekből

Először rögzítse azokat az időpontokat, amelyek fixek. Csak utána a munkát, amelynek ezek közé kell férnie: az építési terület előkészítésének kezdete, az engedély véglegessé válása, az épület időjárásálló lezárása, a belső munkák kezdete, az átadás. Ezek **mérföldkövek**: időtartam nélküli pontok. Ezeket valóban mérföldkőként vegye fel (*Kezdőlap › Tevékenységek › Mérföldkő ▾*), ne nulla napos tevékenységként, amelynek neve egy mérföldkőre hasonlít.

Miért ez a sorrend: egy ütemezés, amely egy tevékenységlistából indul ki, összeg lesz. Egy összeg ritkán esik egybe a szerződés dátumával. Induljon a mérföldkövekből, és azonnal a helyes kérdés merül fel: nem az, hogy „mennyi ideig tart ez mind együtt”, hanem az, hogy „belefér-e a munka e két időpont közé, és ha nem, mit kell megváltoztatni”. Dolgozzon visszafelé a szükséges átadási dátumtól: mikorra kell legkésőbb az épületnek időjárásállónak lennie, és onnan a kezdésig.

A szerződésben rögzített átadás megkapja a jelölőnégyzetet *Kötelező (szerződéses)*. Így aki megnyitja a fájlt, látja, hogy ez az időpont nem tárgyalható és nem mozdítható. A jelölőnégyzet jelzés a Gantt-diagramnak és a jelentéseknek. Nem véd egy dátumot. Ezt határidővel vagy korlátozással éri el (lásd lentebb).

### A bontás: fázisok, munkacsomagok, tevékenységek

A mérföldkövek alatt építi fel a szerkezetet: fázisok, alattuk munkacsomagok, alattuk tevékenységek. Ezt úgy végzi, hogy behúzza a sorokat. Egy altevékenységet tartalmazó tevékenység automatikusan **összefoglaló tevékenységgé** válik: az alkalmazás a sávját és az időtartamát az alatta lévő tevékenységekből számítja ki. Ezért soha ne adjon meg maga időtartamot egy összefoglaló tevékenységnek.

A részletesség irányadója: **egy tevékenység körülbelül egy naptól két hétig tartson**. Egy napnál rövidebb tevékenység azt jelenti, hogy a munkaterületet tervezi a projekt helyett. Ez az építésvezető heti tervébe tartozik, nem egy olyan számítási modellbe, amelynek hónapokig ki kell tartania. Két hétnél hosszabb tevékenységet nem lehet megfelelően megbecsülni, és a végrehajtás során nem lehet nyomon követni. „finishing ground floor, 40 days, 45% complete” nem mond senkinek semmit arról, hogy jól megy-e a munka. Az ütemezés-felülvizsgálatok ezért gyakran megszámolják, hány tevékenység tart két hónapnál tovább. Ha ez néhány százalék fölé megy, az a részletesség hiányának számít.

A túl finom bontás ugyanolyan káros, mint a túl durva. Minden tevékenység karbantartást igényel: kapcsolatokat kell rajzolni, előrehaladást kell rögzíteni, és minden változtatás után újra meg kell ítélni a helyzetet. Egy kétezer tevékenységből álló, hathónapos projekt ütemezése ettől nem lesz pontosabb, hanem karbantartatlan marad. Egy ütemezés, amelyet senki nem frissít, három héten belül fikció. Válassza ki azt a részletességi szintet, amelyen minden héten becsületesen jelentést tud tenni az előrehaladásról.

A gyakorlatban: „3. Finishing” egy fázis, „Finishing house 4” egy munkacsomag, „Plastering house 4 ground floor” egy öt napos tevékenység. Kivételesen túllépheti a felső határt szállítási átfutási idők és felügyelet esetén. Egy tíz hetes ablakkeret-szállítás valóban egy oszthatatlan várakozási blokk. A folyamatos felügyelet pedig egy hangmatba tartozik, nem mesterséges szeletek sorozatába.

### Az időtartam becslése

Az időtartam becslése arra vonatkozik, mennyi ideig tart a munka, nem arra, milyen gyorsan lehetne elvégezni. Egy szokásos napra becsüljön, a ténylegesen rendelkezésre álló munkacsapattal, ne a legjobb napra a legjobb csapattal. Az optimizmus láncszemről láncszemre halmozódik. Egy ütemezés, amelyben minden tevékenység a legjobb napot feltételezi, szinte soha nem éri el az átadási dátumát.

A napok vagy órák megadása valódi döntés, nem formázás. Válassza a **napokat** a helyszín ütemét meghatározó munkákhoz: falazás, vakolás, burkolás. Ezek öt napig tartanak, akkor is, ha egy nap éppen nyolc vagy kilenc óra. Válassza az **órákat**, ha maguk az órák a mértékegység, és a nap hátralévő része számít: például egy három órás ellenőrzés, egy tizennégy órás betonozás két napon át, vagy műszakos munka. Az alkalmazás ezt a választást tevékenységenként tárolja.

Ne rejtse el a kockázatot az egyes tevékenységek időtartamába. Ha mindenhez hozzáad egy napot, a ráhagyást eltemeti, és senki nem látja vagy irányíthatja többé. Ahol pedig valóban szükség lett volna rá, kiderül, hogy túl kicsi. Tegye láthatóvá a tartalékot: egy külön puffer-tevékenységgel az átadási dátum előtt, vagy egy külön időjárási kerettel. Figyeljen a kettős számításra. A holland építőipar évente nagyjából 180 munkanappal számol. Ez egy szerződéses éves érték (UAV), amelyből az állami ünnepnapok, az építőipari szabadság *és* az elveszett napok már le vannak vonva. Ha az ünnepnapok és a szabadság már benne van a projektnaptárban, csak az időjárási késedelem marad külön tételként. A fagy- és viharkésedelemre az *Onwerkbaar weer Bouw & Infra* kollektív szerződés saját szabályai vonatkoznak. Ezeket a várhatóan elveszett napokat a naptárba vagy külön tételként vegye fel, ne rejtse a falazás időtartamába.

### Kapcsolatok: kapcsolathálózat nélkül nincs ütemezés

Az alkalmazás a dátumokat a **kapcsolatok** mentén számítja ki: egy tevékenység csak akkor kezdődik, ha az elődjei ezt megengedik. Kapcsolat nélküli tevékenység semmihez sincs kötve. Ha a szerkezeti munkák két hetet csúsznak, egy elszakadt befejező tevékenység nem követi őket. Az ütemezés így hazudik, anélkül hogy bármi pirosra váltana.

Ezért adjon minden tevékenységnek legalább egy elődöt és legalább egy utódot. Csak a projekt első tevékenysége és az utolsó mérföldkő mentes ez alól. Egy ütemezés-felülvizsgálatban ez az első ellenőrzés: a hiányos logikájú tevékenységek aránya nem haladhatja meg néhány százalékot.

**A befejezés-kezdés az alapértelmezett, és így is érdemes maradnia**: az alapozás kész, utána a szerkezeti munkák. Egy egészséges építési ütemezésben a kapcsolatok nagyjából tízből kilenc befejezés-kezdés. Ez olvashatósági követelmény: a befejezés-kezdés az egyetlen típus, amelyet a helyszínen mindenki magyarázat nélkül megért, és amely a végrehajtás során kiszámíthatóan viselkedik.

A **kezdés-kezdés késleltetéssel** arra való, ha a munka valóban párhuzamosan fut, és nem vár. A klasszikus eset egy sorházsor vagy egy emeletes torony: a szerelő három napos késleltetéssel követi a falazást. Ez egy kezdés-kezdés kapcsolat három napos késleltetéssel, nem egy mesterségesen darabolt tevékenység befejezés-kezdés kapcsolata. Tegyen mellé egy befejezés-befejezés kapcsolatot, különben az utód elméletben korábban fejezhetné be, mint az elődje. Az építőiparban szinte soha nem használják a kezdés-befejezés kapcsolatot.

Ezt a kezdés-kezdés kapcsolatot lehetőleg tevékenységek között húzza meg, ne fázisok között. Ha egy kezdés-kezdés vagy kezdés-befejezés kapcsolat elődje egy fázis, az alkalmazás az utódot a fázis azon tevékenységéhez köti, amely **utoljára** kezdődik, nem ahhoz, amely először. Így soha nem tervez túl korán, de néha később, mint ahogy szánta. A befejezés-kezdés és a befejezés-befejezés kapcsolat, amelynek elődje egy fázis, a fázisban lévő utolsó tevékenység befejezésére vár. Ez általában pontosan az, amit akar.

Legyen óvatos a késleltetésekkel, különösen a negatívakkal. A késleltetés olyan várakozási idő, amelynek nem látszik az oka: később senki nem tudja megmondani, miért van hét nap közben. Ha a beton érleléséről van szó, állítsa be naptári napokban mért késleltetésként (a beton hétvégén is szilárdul). Még jobb, ha egy valódi „érlelés” tevékenységet hoz létre, amelyet mindenki lát és követ. Negatív késleltetés (átfedés) valójában egyáltalán nem kellene, hogy legyen; ütemezés-felülvizsgálatban a norma nulla. Ha átfedést szeretne, bontsa az elődöt, vagy használjon kezdés-kezdés kapcsolatot.

### Korlátozások és rögzített dátumok: a lehető legkevesebb

Minden tevékenység „a lehető legkorábban” indul, és az esetek túlnyomó többségében így is érdemes maradnia. A **korlátozás** egy dátumkorlát a kapcsolatok mellett. Minél több korlátozást ad hozzá, annál kevesebbet számít ki az ütemezés, és annál inkább csak rajz lesz belőle. Egy rögzített dátumokkal teli terv stabilnak látszik. Éppen ezért elrejti a kockázatot: nem mozdul, ezért nem is figyelmeztet.

Korlátozást csak olyan kemény külső dátumra használjon, amelyre az ütemezésnek nincs befolyása. Például: az engedély, amely március 1. előtt nem lesz véglegessé (*Nem korábban kezdődő*), az önkormányzat által megadott lezárási időszak, vagy a közműszolgáltató csatlakozási dátuma. „Ezt a tevékenységet májusra szeretném” nem külső tény. Ezt logikával vagy más időtartammal oldja meg. Általános szabályként a hátralévő tevékenységek legfeljebb néhány százaléka hordozzon kemény dátumkorlátot.

Soha ne írjon be kezdési dátumot, hogy egy tevékenységet a helyére tegyen. Egy előddel rendelkező tevékenységnél az alkalmazás a beírt (vagy húzással áthelyezett) kezdést *Nem korábban kezdődő (SNET)* korlátozássá alakítja. A tevékenység ekkor ott van, ahol szeretné, és ott is marad, akkor is, ha az előtte lévő teljes lánc késik.

Ha egy dátumot szeretne figyelni anélkül, hogy a számítást befolyásolná, használjon **határidőt**. Ez nem mozdít semmit, de negatív tartalékidőt és figyelmeztetést ad, amint a tevékenység már nem felel meg neki. Ez pontosan az a jelzés, amelyet látni akar. A kemény rögzítést (*Kötelező (pin-logika)*) tartsa meg a szélsőséges esetre. Tudja, hogy ez negatív tartalékidőt okoz az előtte lévő láncban. Ez az ütemezés jelzése, hogy a dátum nem fér bele, és nem azt, hogy valami elromlott.

### Naptárak: előbb a projekt, utána a kivételek

Minden időtartam a naptár munkanapjaiban vagy munkaóráiban számít. Ezért állítsa be rendesen a projektnaptárat, mielőtt időtartamokat ad meg: a munkanapok, a munkaidők, az állami ünnepnapok és az építőipari szabadság. Egy naptár, amelyet félúton javít, az egész ütemezését eltolja. Vegye fel rögtön az előre látható leállásokat: a fagyidőszakot, amelyben nem öntenek betont, és a karácsony és újév közötti vállalati leállást.

Csak akkor adjon egy erőforrásnak saját naptárat, ha az valóban más: például a homlokzatépítőnek, aki heti négy napot dolgozik, vagy a munkacsapatnak, amely más nyári szabadságot vesz ki. Az erőforrás-naptár egyetlen tevékenység dátumát sem változtatja meg; a tevékenység a tevékenység- vagy a projektnaptár szerint fut tovább. Csak azt mutatja, hogy az erőforrás nem dolgozik a tevékenység egyik munkanapján, ez pedig túlterhelésként jelenik meg a hisztogramban. Ezt nehéz észrevenni, ha nem tudja, hogy maga hozta létre.

### Erőforrások: ki végzi, és ez lehetséges-e

Az ütemezés erőforrások nélkül csak a kérdés felére válaszol. Amint hozzárendeli a munkacsapatokat és a gépeket, a hisztogram megmutatja azt, amit egy idővonal önmagában nem: például hogy június 14-én három vakolócsapatra van szükség, miközben kettő áll rendelkezésre.

Kezdje a szűk keresztmetszetet jelentő erőforrásokkal. Nem minden csavart kell beleírni. A toronydarut, a saját munkacsapatait, a kapacitásplafonnal rendelkező alvállalkozókat és a hosszú szállítási átfutási időket viszont igen. Adjon minden erőforrásnak becsületes kapacitást: két vakolónak kettő, nem „kettő, de vészhelyzetben három”.

Olvassa a hisztogramot kérdésként, nem hibaként. A vonal fölötti piros azt jelzi, hogy az ütemezés aznap többet kér, mint amennyi rendelkezésre áll. Néha a válasz: eltolás. Gyakran a válasz az, hogy ez nem fog működni, és pontosan ezt akartam tudni. A **kiegyenlítés** addig tolja el a tevékenységeket, amíg a kereslet be nem illeszkedik a kapacitásba. Ha a befejezési dátumnak van mozgástere, engedje meg. Ha az átadási dátum rögzített, csak a tartalékidőn belül egyenlítsen ki (a jelölőnégyzet *Kiegyenlítés csak a tartalékidőn belül — a projekt befejezési dátuma változatlan marad*). A befejezési dátum ekkor a helyén marad. Egy jelentett, megmaradt ütközés marad, ami őszintébb eredmény, mint egy ütemezés, amely csak megoldottnak látszik.

Ne *egyenlítsen* ki, ha a kereslet szerkezetileg nagyobb, mint a kapacitás. A kiegyenlítés a meglévő munkát átrendezi az időben. Nem fogad fel több vakolót, és nem épít második darut. Három torony, amelyekhez egyszerre ugyanaz a munkacsapat kell, a kiegyenlítés után is ugyanazt a munkacsapatot igényli. Az egyetlen változás, hogy az átadás később lesz. Ilyenkor a szakaszolás, a többlet-kapacitás vagy más munka segít. Addig se egyenlítsen ki, amíg a logika és az időtartamok nincsenek a helyükön: olyan ütemezést egyenlítene ki, amely holnapra már más lesz.

### Kritikus út és tartalékidő: hol sebezhető az ütemezés

Az alkalmazás nem számítja újra minden változtatásnál. Végezze el az **ütemezés-számítást** (F5), és csak utána olvassa le az eredményt. Ha az állapotsor ezt mutatja: *Elavult — újraszámítsa (F5)*, akkor az előző számítást látja, nem a mostanit. Az *Automatikus ütemezés-számítás* beállítással az alkalmazás ezt maga végzi el.

A **kritikus út** a tartalékidő nélküli lánc: minden ott elveszett nap egy nappal későbbi átadást jelent. Ide irányul a felügyelet és a legjobb emberek. Ne csak a pirosra figyeljen. A **teljes tartalékidő** megmutatja, mennyit csúszhat egy tevékenység az átadás befolyásolása nélkül. A **szabad tartalékidő** azt mutatja, mennyit csúszhat anélkül, hogy az utódját mozgassa. A kettő különbsége senki befejezési dátumát nem érinti, de útban van valakinek. Ez hasznos, ha olyan alvállalkozókkal dolgozik, akiket nem lehet kétszer átütemezni.

Három jelre figyeljen. Egy tevékenység, amelynek néhány nap tartalékidője van, nem biztonságos, hanem közel kritikus. A *Közel kritikus jelölése* beállítással az ilyen tevékenységek saját színt kapnak. Egy szélsőségesen nagy tartalékidő, ütemezés-felülvizsgálatban több mint 44 munkanap, körülbelül két hónap, szinte mindig hiányzó utódot jelent. Ez közvetlenül a hálózat hiányosságaira mutat rá. A negatív tartalékidő soha nem számítási hiba: az ütemezés jelzi, hogy egy határidő vagy rögzített dátum nem fér bele.

### Alapterv a kezdés előtt, utána tartsa naprakészen

Rögzítsen egy **alaptervet**, amint az ütemezést jóváhagyták, és mielőtt megkezdődik a földmunka (*Ütemezés › Alaptervek és előrehaladás › Alapterv kezelése…*). Végezze el előbb az ütemezés-számítást: az alapterv a legutóbbi számítás dátumait tárolja. Enélkül később csak azt mondhatja meg, hogy a dolgok másképp mennek, de nem azt, hogy mennyivel vagy mióta. Pedig erre van szüksége egy helyszíni egyeztetésen, többletmunkánál és akkor, amikor a késedelemről tárgyalnak.

Az alapterv a dátumokat tárolja, de nem a mögöttük álló feltevéseket. Pedig pontosan ezekre kérdeznek rá, amint késedelemről van szó. Ezért rögzítéskor írja le röviden, mire épül ez az ütemezés (az ütemezési gyakorlatban: az *ütemezés alapja*). Írja le, mely termelékenységi adatokat használta, melyik naptárat és miért állította be így, mit hagyott szándékosan ki az ütemezésből, ki adta meg a feltételezett szállítási átfutási időket, és ki hagyta jóvá az ütemezést. Fél oldal is elég.

Utána a naprakészen tartás ritmus, nem projekt. Hetente frissítsen, mindig ugyanabban a sorrendben: állítsa be az **állapotdátumot** a jelentési dátumra, írja be a tényleges kezdési és befejezési dátumokat arra, ami elkezdődött és befejeződött, javítsa a folyamatban lévő tevékenységek hátralévő időtartamát, majd végezze el az ütemezés-számítást. Egy elkészültségi százalék önmagában nem elég. A tényleges dátumok a tényszerű nyilvántartás, amelyet később megvizsgálnak.

Tudja meg, mit csinál az állapotdátum. Az alkalmazás az állapotdátumra mozgatja azokat a munkákat, amelyek még nem kezdődtek el, és az utánuk következő tevékenységek együtt mozdulnak (kivéve a Microsoft Project számítási profilban). Ha tehát elfelejti rögzíteni egy befejezett tevékenység vagy mérföldkő befejezését, az magától jobbra tolódik. Ez nem hiba: a modell nem tesz úgy, mintha a múltbeli dolog még megtörténhetne. Ha a *Rossz sorrend* figyelmeztetést kapja, a munkát más sorrendben végezték, mint ahogy a logika előírja. Ez általában azt jelenti, hogy a sorrendet kell átdolgozni, nem azt, hogy a figyelmeztetést el kell tüntetni. Csak valós hatókörváltozás esetén készítsen új alaptervet, és akkor az első mellé, nem fölé.

Végül: egy ütemezés csak akkor megbízható, ha a munkát végzők hisznek benne. Kérje meg az építésvezetőt és az alvállalkozókat, hogy hetente vessék össze a heti tervet ezzel a modellel. Ha hét után hét csak a megállapodott munka felét érik el, akkor a probléma gyakrabban van az ütemezésben, mint a kivitelezésben.

## Kidolgozott példa: három döntés, amely csendben hamis ütemezést ad

A számok a súgó más helyén kidolgozott két példából származnak. Az egyik a *House extension* gyakorlóprojekt az oktatóanyagokból, a másik egy kis hálózat egy épületbővítéshez. Itt az a fontos, hogy minden választás mit tesz az ütemezésével. Ön maga is kipróbálhatja a 2. oktatóanyagban (kapcsolatok és kritikus út) és a 3. oktatóanyagban (korlátozás és határidő).

### Elfelejtett kapcsolat

Az épületbővítésnél a kivitelezés 2027. június 7., hétfőn kezdődik, az átadás pedig augusztus 6., pénteken van. A *Build outer cavity leaf* (6 munkanap) utódja az *Install window frames*, mert az ablakkeretek a homlokzaton vannak. Ezzel a kapcsolattal a külső héjazatnak 2 munkanap tartalékideje van.

Ha elfelejti ezt a kapcsolatot, a külső héjazatnak hirtelen 23 munkanap tartalékideje lesz az átadásig. Papíron hetekkel is késhet úgy, hogy senki nem vár rá. Semmi nem lesz piros, és nem jelenik meg figyelmeztetés. Csak a *Nyitott végű tevékenységek kritikusak* számítási beállítással válik kritikussá az utód nélküli tevékenység, így a hiány feltűnik.

### Beírt dátum kapcsolat helyett

A kis hálózat: *Groundwork* (3 munkanap), *Pour foundation* (2), *Brickwork* (5) és *Roofing* (3), egymás után, 2027. június 7., hétfőtől kezdve. A projekt június 23., szerdán készül el.

Ha a *Brickwork* kezdését június 21., hétfőre írja be, mert a téglák csak akkor érkeznek, ez egy *nem korábban kezdődő* korlátozás lesz. A *Brickwork* egy hetet csúszik, a projekt pedig június 30., szerdán készül el. A *Groundwork* és a *Pour foundation* 5 munkanap tartalékidőt kap, és már nem kritikusak. Ha a téglák mégis korábban érkeznek, a *Brickwork* június 21-én marad: most a dátum irányít, nem a logika.

Ha ehelyett június 9., szerdát írja be, még mielőtt az alap elkészül, nem történik semmi: a kapcsolatok miatt a *Brickwork* úgyis csak június 14., hétfőn kezdhet.

### Határidő korlátozás helyett

Ha azt szeretné, hogy a *Roofing* június 18., pénteken készüljön el, állítson be ott egy határidőt. Semmi nem mozdul: a *Roofing* június 21., hétfő és június 23., szerda között marad. Viszont a lánc tartalékideje −3 munkanap lesz, és az alkalmazás ezt jelzi: *A 18-06-2027 határidő lekésve — korai befejezés: 23-06-2027*. Így azonnal látja, hogy a megállapodás nem illik az ütemezésbe. Nem egy szépen elhelyezett sávot lát, amely mögött a lánc nem támasztja alá.

## Következmények és tévhitek

- **Előd vagy utód nélküli tevékenységek.** A leggyakoribb, és a legkárosabb: ezek a tevékenységek nem igazodnak a többihez, és hamis tartalékidőt kapnak.
- **Dátumok beírása vagy sávok húzása a logika felépítése helyett.** Ez csendben korlátozást állít be.
- **Túl sok korlátozás, és könyvjelzőként használt kemény rögzítés.** Az ütemezés ilyenkor már nem számol, csak rajzol.
- **Három hónapos, vagy fél napos tevékenységek.** Nagyjából egy nap és két hét között van a használható tartomány.
- **Optimista időtartamok, és minden egyes tevékenységbe rejtett biztonsági ráhagyás** ahelyett, hogy pufferként látható lenne.
- **Időjárási késedelem és az építőipari szabadság nincsenek a naptárban.** Januárban úgyis bekerülnek.
- **Késleltetések tevékenységek helyett.** Hét nap névtelen várakozási idő három hónappal később érthetetlen.
- **Kiegyenlítés a logika felépítése előtt**, vagy a kiegyenlítés folytatása szerkezeti kapacitáshiány ellenére.
- **Az ütemezés-számítás elfelejtése.** Az *Elavult* jelzés az állapotsorban azt jelenti, hogy a korábbi számítás eredményét látja.
- **Nincs alapterv, vagy csak a kezdés után rögzítették.**
- **Előrehaladás csak százalékban rögzítve**, tényleges dátumok és állapotdátum nélkül.
- **A *Figyelmeztetések* panel bezárása elolvasás nélkül.** Ezek a panelen együtt jelennek meg: a lekésett határidők, a megsértett korlátozások, a sorrenden kívüli előrehaladású kapcsolatok és az erőforrások túlterhelése (*Tervezés › Ütemezés › Figyelmeztetések*).

## Lásd még

- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan számítja ki az alkalmazás a korai és a legkésőbbi dátumokat, valamint a tartalékidőt.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): a négyféle kapcsolat, a késleltetés és a kapcsolatok egy fázison.
- [Korlátozások és határidők](docs://uitleg-constraints): mit tesz a számítással minden korlátozás és a határidő.
- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan számolja az alkalmazás a munkanapokat, és melyik naptár az érvényes.
- [Napok és órák](docs://uitleg-dagen-en-uren): ütemezés napokban, órákban vagy vegyesen.
- [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren): mit mozgat a kiegyenlítés, és mit nem.
- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mit tesz az állapotdátum, és hogyan olvassa az eltéréseket.
- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): a mérföldkövek és a tevékenységek bevitele.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): tevékenységek összekapcsolása.
- [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen): egy segítőtárs, amely ezek az elvek szerint ütemez.
- [Értesítések és figyelmeztetések](docs://ref-meldingen): az összes figyelmeztetés egy helyen.
