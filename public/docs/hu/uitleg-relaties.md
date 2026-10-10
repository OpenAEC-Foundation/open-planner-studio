# Kapcsolatok és késleltetés

Miért kezdődik a falazás csak akkor, ha az alap már készen van? És miért csúszik egy hetet a tetőszerelés, ha a tetőelemek későn érkeznek? Ezt a tevékenységek közötti kapcsolatok okozzák. Ebben a cikkben megtudja, milyen négy kapcsolattípust ismer az alkalmazás, mit jelent a késleltetés és az átfedés, melyik naptárban számít a késleltetés, mi történik egy kapcsolattal egy összefoglaló tevékenységen, és hogyan dönti el az alkalmazás, melyik kapcsolat határozza meg egy tevékenység kezdő dátumát.

A szabályok és a példák új projektre vonatkoznak, az *Open Planner Studio* számítási profillal és hétfőtől péntekig tartó munkahéttel.

## A fogalom

A **kapcsolat** azt rögzíti, hogy két tevékenység egymástól függ. Az első tevékenység az **előd**, a második az **utód**. A kapcsolat alsó határ: az utód sosem kezdődhet vagy fejeződhet be korábban, mint ahogy a kapcsolat megengedi, de később igen. Ha egy tevékenységnek több előde van, a tevékenység a legkésőbbi dátumot várja meg, amely ezekből a kapcsolatokból adódik.

Négy típus van. Ezek abban különböznek, hogy az előd melyik pontja (kezdés vagy befejezés) az utód melyik pontjához kötődik:

- **FS (befejezés-kezdés).** Az utód csak azután kezdődik, hogy az előd befejeződött. A tetőelemeket csak azután lehet felhelyezni, hogy a falak felálltak. Ez messze a leggyakrabban használt kapcsolat.
- **SS (kezdés-kezdés).** Az utód csak azután kezdődhet, hogy az előd elkezdődött. A tevékenységek átfedhetik egymást: a csőszerelés elkezdhető, amint a falazás már folyamatban van.
- **FF (befejezés-befejezés).** Az utód csak azután fejeződhet be, hogy az előd befejeződött. A fugázást nem lehet elvégezni, amíg a falazás nincs kész, de korábban elkezdhető.
- **SF (kezdés-befejezés).** Az utód csak azután fejeződhet be, hogy az előd elkezdődött. Ez a típus ritka. Példa: az ideiglenes víztelenítést csak akkor szabad leállítani, amikor az alapfalazás már elkezdődött.

A kapcsolathoz **késleltetés** is tartozhat: várakozási idő a két tevékenység között, például olyan beton, amelynek meg kell keményednie. Egy negatív késleltetést **átfedésnek** neveznek: az utód ilyenkor az előd befejezése előtt kezdődik, így a tevékenységek átfedik egymást.

## Így számít az alkalmazás

### A négy típus

Minden kapcsolatnál az alkalmazás kiszámítja azt a legkorábbi dátumot, amikor az utód elkezdődhet. Egy tevékenységnél a legkésőbbi ilyen dátumot veszi figyelembe. Késleltetés nélkül így működik:

- Az FS típusnál az utód az előd befejezése utáni első munkanapon kezdődik.
- Az SS típusnál az utód ugyanazon a napon kezdődik, mint az előd.
- Az FF típusnál az utód ugyanazon a napon fejeződik be, mint az előd. A kezdő dátum megkereséséhez az alkalmazás visszafelé számol az utód időtartamán keresztül. Egy 3 munkanapos utód ezért 2 munkanappal az előd befejezése előtt kezdődik.
- Az SF típusnál az utód ugyanazon a napon fejeződik be, mint ahogy az előd elkezdődik. Itt is visszafelé számol az alkalmazás az utód időtartamán keresztül.

Ezek alsó határok. Az utód később kezdődik, ha egy másik kapcsolat vagy korlátozás ezt kéri. Minden dátum csak az **Ütemezés-számítás** (F5) után jelenik meg. Amíg az állapotsorban az *Elavult — újraszámítsa (F5)* üzenet látszik, a sávok az előző számítást mutatják.

### Késleltetés és átfedés

A késleltetést négyféleképpen lehet megadni:

- **Munkanapban** (`3` vagy `3d`): az alkalmazás kihagyja a szabadnapokat és a hétvégéket. Ez az alapértelmezett érték.
- **Naptári napban** (`3ed`, az *e* jelentése *elapsed*, azaz eltelt idő): minden nap számít, a szombat és a vasárnap is. Ez a mértékegység olyan folyamathoz való, amely munka nélkül is halad, például a betonkeményedés.
- **Százalékban** az előd időtartamának (`40%`): az alkalmazás minden számításnál újra kiszámítja, és egész napra kerekít (2,5 nap 3 lesz).
- **Munkaórában** (`4h`): az alkalmazás a késleltetést a késleltetési naptárban számolja, alapértelmezés szerint az előd naptárában. Ha az előd napalapú tevékenység, és a naptárának nincsenek saját idősávjai, ahogy a szabványos naptárnak sincsenek, az alkalmazás az órákat egész munkanapokra váltja át, a legközelebbi egész napra kerekítve (a fél nap felfelé kerekít). 8 órás munkanap esetén a `2h` és a `3h` ezért 0 napot ad, a `4h` és a `11h` közötti érték (ezek is beleértve) 1 napot, a `12h` 2 napot. Ha az adott naptárnak vannak saját idősávjai, vagy az előd óraalapú tevékenység, a késleltetés pontosan munkaórában számít.

Az N munkanapos késleltetés szabálya FS típusnál: az előd befejezése utáni N munkanap várakozási idő, és az utód az ezt követő munkanapon kezdődik. SS és FF esetén a késleltetés az előd kezdési, illetve befejezési dátumához adódik. Negatív késleltetés visszafelé számol: egy 1 munkanapos átfedés FS típusnál azt jelenti, hogy az utód azon a napon kezdődik, amikor az előd befejeződik.

Egy átfedés nem helyezhet tevékenységet a projektkezdés elé. Ha ez történne, az alkalmazás az utódot a projektkezdésen tartja, és a *Figyelmeztetések* panelen jelzi: *Az átfedést a projektkezdés csonkolja — a kapcsolat nincs teljesen kihasználva*.

### Melyik naptárban számít a késleltetés

Minden tevékenységnek lehet saját naptára. Munkanapban megadott késleltetésnél az számít, melyik naptár számolja a munkanapokat. A *Késleltetési naptár* beállítás dönti ezt el, négy lehetőséggel: *Előd*, *Utód*, *24 órás* és *Projektnaptár*. Alapértelmezés szerint a késleltetés az **előd** naptárában számít. A beállítást a *Beállítások › Projekt › Projektinfó* útvonalon találja, a *Számítási profil és beállítások* blokkban, az *Ennek a projektnek a számítási beállításai* résznél. A választás a projektfájlhoz tartozik, és csak akkor érvényesül, miután rákattintott az *Alkalmazás* gombra. Ekkor az alkalmazás újraszámítja az ütemezést.

A naptári napban megadott késleltetés (`3ed`) mindig minden napot számol, bármelyik *Késleltetési naptár* beállítást választja is.

### Kapcsolatok összefoglaló tevékenységeken

Kapcsolatot egy összefoglaló tevékenységre is tehet, az azon belüli tevékenység helyett. Az alkalmazás belül ezt a kapcsolatot az összefoglaló tevékenység minden tevékenységére ráteszi:

- Ha az összefoglaló tevékenység az **előd** FS vagy FF típusnál, az utód addig vár, amíg az összefoglaló tevékenységen belül utoljára befejező tevékenység el nem készül.
- Ha az összefoglaló tevékenység az **utód** FS vagy SS típusnál, minden tevékenység az összefoglaló tevékenységen belül az elődre vár, a többi tevékenységtől függetlenül.
- Ha az összefoglaló tevékenység az **előd** SS vagy SF típusnál, az utód az összefoglaló tevékenységen belül **utoljára** kezdődő tevékenység kezdésére vár, nem az összefoglaló tevékenység kezdésére. Ez óvatosabb, mint ahogy várná: az utód sosem kezdődik túl korán, de lehet, hogy később kezdődik, mint szeretné. Ha azt szeretné, hogy az utód az összefoglaló tevékenység kezdését kövesse, a kapcsolatot az összefoglaló tevékenységen belüli első tevékenységre helyezze.
- Ha az összefoglaló tevékenység az **utód** FF vagy SF típusnál, minden tevékenységnek magának kell megfelelnie a befejezési követelménynek (FF esetén a befejezésnek az előd befejezésével egyidőre vagy később kell esnie, SF esetén az előd kezdésével egyidőre vagy később), még akkor is, ha egy tevékenység jóval korábban is elkészülhetett volna. Inkább az összefoglaló tevékenységen belül utoljára befejező tevékenységre helyezze az ilyen kapcsolatot.

Egy tevékenység és a saját összefoglaló tevékenysége közötti kapcsolat nem megengedett.

### Meghatározó kapcsolatok

Ha egy utódnak több előde van, általában egy kapcsolat határozza meg a kezdő dátumát: az a kapcsolat, amely miatt az utód nem kezdődhet egy nappal korábban, mint most. Egy ilyen kapcsolat a **meghatározó**. Egyenlőség esetén több meghatározó kapcsolat is lehet. A meghatározó kapcsolatot felismeri a villámjelről az *Elődök* és az *Utódok* oszlopban, a *Meghatározó kapcsolat* oszlopról (a táblázat fejlécének jobb szélén lévő **+** jel alatt, a *Kapcsolatok* résznél), és az erősebb színezésről, amikor útvonalat követ. Az útvonal megnyitásának módját a [Útvonal követése](docs://howto-pad-traceren) cikk írja le.

A meghatározó szerep a dátumokra vonatkozik, nem az időtartamra. Egy rövid előd is lehet meghatározó, például egy hosszú késleltetés miatt. Ezt az alábbi példában láthatja.

## Kidolgozott példa

A példák külön mini-projekteket használnak, mindegyik 2027. június 7., hétfőn kezdődik, hacsak másként nincs jelezve. A kritikus út és a tartalékidő olyan fogalmak, amelyeket a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad) cikk magyaráz. A kapcsolathálózat saját felépítését és ellenőrzését a 2. oktatóanyagban, a „Kapcsolatok és a kritikus út” című részben gyakorolhatja.

### A négy típus egymás mellett

A *Pour foundation* 5 munkanapig tart: június 7., hétfőtől június 11., péntekig. A *Build walls* (5 munkanap) FS típussal követi, és június 14., hétfőtől június 18., péntekig tart. Négy, egyenként 3 munkanapos tevékenység függ a *Build walls* tevékenységtől, mindegyik más típussal:

- A *Place roof elements* (FS) június 21., hétfőn kezdődik, a falazás utáni első munkanapon, és június 23., szerdán készül el.
- A *Pipework* (SS) június 14., hétfőn kezdődik, a falazással egyidőben, és június 16., szerdán készül el.
- A *Pointing* (FF) június 18., péntekig kész kell legyen, a falazással együtt. 3 munkanappal ezért június 16., szerdán kezdődik.
- A *Dewatering* (SF) június 14., hétfőn, a falazás kezdőnapján kell, hogy befejeződjön. Ha 3 munkanapot visszafelé számolunk (csütörtök, június 10.; péntek, június 11.; hétfő, június 14.), a kezdés június 10., csütörtökre esik.

Csak a *Place roof elements* van a kritikus úton; a projekt június 23., szerdán készül el. A *Pipework*, a *Pointing* és a *Dewatering* rendre 5, 3 és 7 munkanap tartalékidővel rendelkezik.

### Késleltetés és átfedés számokban

A *Pour foundation* június 18., pénteken készül el. A *Build walls* (2 munkanap) FS típussal követi. Így hat a késleltetés a kezdő dátumra:

- Késleltetés nélkül a falazás június 21., hétfőn kezdődik.
- Ha a késleltetés `3` (három munkanap), a hétfő, június 21., a kedd, június 22., és a szerda, június 23. várakozási idő; a falazás június 24., csütörtökön kezdődik.
- Ha a késleltetés `3ed` (három naptári nap), a szombat, a vasárnap és a hétfő számít; a falazás június 22., kedden kezdődik.
- Ha a késleltetés `-1` (egy munkanapos átfedés), a falazás június 18., pénteken kezdődik, azon a napon, amikor a *Pour foundation* befejeződik.
- Ha a késleltetés `40%`, akkor ez 5 munkanap 40%-a, vagyis 2 munkanap; a falazás június 23., szerdán kezdődik.
- Ha a késleltetés `50%`, akkor ez 2,5 munkanap, amelyet 3 munkanapra kerekítünk; a falazás június 24., csütörtökön kezdődik.

### Melyik naptár számítja a késleltetést

A *Build walls* (4 munkanap) a projektnaptárban van (hétfőtől péntekig), és június 10., csütörtökön készül el. A *Pointing* (2 munkanap) FS típussal és `3` késleltetéssel követi, és olyan naptáron van, ahol a szombat és a vasárnap is munkanap. Ekkor a kezdő dátum a *Késleltetési naptár* beállítástól függ:

- *Előd* (alapértelmezett): a késleltetés az előd, vagyis a *Build walls* naptárában számít. Június 11., péntek, június 14., hétfő és június 15., kedd várakozási idő; a *Pointing* június 16., szerdán kezdődik.
- *Utód*: a késleltetés a *Pointing* naptárában számít. Június 11., péntek, június 12., szombat és június 13., vasárnap várakozási idő; a *Pointing* június 14., hétfőn kezdődik.
- *24 órás*: minden naptári nap számít. Itt is a péntek, a szombat és a vasárnap várakozási idő; a *Pointing* június 14., hétfőn kezdődik.
- *Projektnaptár*: a késleltetés a projektnaptárban számít, éppúgy, mint az *Előd* esetén; a *Pointing* június 16., szerdán kezdődik.

### Kapcsolatok egy összefoglaló tevékenységen

A *Foundation* egy összefoglaló tevékenység két tevékenységgel: az *Excavate* (2 munkanap, június 7., hétfő és június 8., kedd), majd a *Pour* (3 munkanap, június 9., szerda és június 11., péntek között). A *Build walls* FS típussal követi a *Foundation* összefoglaló tevékenységet, és június 14., hétfőn kezdődik. Az alkalmazás a *Build walls* tevékenységet a *Pour* tevékenységre várakoztatja, mivel ez az utoljára befejező tevékenység.

Összefoglaló tevékenység utódként: a *Permit* (3 munkanap, június 9., szerdán készül el) FS típussal a *Szerkezet* összefoglaló tevékenységre mutat. Ebben van a *Build walls* (4 munkanap), majd a *Lay floor* (2 munkanap). Az összefoglaló tevékenység minden tevékenysége az engedélyre vár: a *Build walls* június 10., csütörtökön kezdődik és június 15., kedden készül el. A *Lay floor* szintén a falazásra vár, és június 16., szerdától június 17., csütörtökig tart.

SS típusú kapcsolat összefoglaló tevékenységről: a *Finishing* összefoglaló tevékenységben van a *Plastering* (2 munkanap, június 7. és 8.), majd a *Painting* (3 munkanap, június 9–11.), végül a *Snagging* (2 munkanap, június 14. és 15.). A *Cleaning* SS típussal követi az összefoglaló tevékenységet. Az ember június 7., hétfői kezdésre számítana, de az alkalmazás megvárakoztatja a *Cleaning* tevékenységet a *Snagging* kezdésére, az utoljára kezdődő tevékenységre: június 14., hétfő.

### Mi a meghatározó kapcsolat

A *Pour foundation* (2 munkanap) június 7., hétfőtől június 8., keddig tart. Két ág következik:

- *Build walls* (5 munkanap): június 9., szerdától június 15., keddig.
- *Order roof elements* (2 munkanap): június 9., szerda és június 10., csütörtök.

A *Place roof elements* (3 munkanap) mindkettőt követi: FS típussal a falazás után, és FS típussal, `5` késleltetéssel a megrendelés (a szállítási idő) után. A falazás után a felhelyezés június 16., szerdán kezdődhetne. A megrendelésből nézve június 11., péntek, június 14., hétfő, június 15., kedd, június 16., szerda és június 17., csütörtök várakozási idő; a felhelyezés június 18., pénteken kezdődik. A megrendeléssel való kapcsolat ezért meghatározó, pedig a megrendelés sokkal rövidebb, mint a falazás. A falazásnak 2 munkanap tartalékideje van.

## Következmények és tévhitek

**„A kapcsolat rögzíti a tevékenységeket.”** Nem, a kapcsolat alsó határ. Az utód legkorábban a kapcsolat által megadott napon kezdődik, később pedig akkor, ha egy másik kapcsolat vagy korlátozás ezt kéri. Hogyan illeszkednek a korlátozások, azt a [Korlátozások és határidők](docs://uitleg-constraints) cikk magyarázza.

**„Az SS azt jelenti, hogy a tevékenységek egyszerre kezdődnek.”** Az SS csak azt mondja ki, hogy az utód nem kezdődhet az előd kezdése előtt. Ha az utódnak van egy másik előde, amely később fejeződik be, az utód később kezdődik.

**„FF esetén az utód ugyanazon a napon kezdődik.”** Nem, FF esetén a befejezési dátumok esnek egybe. Egy rövid utód ezért később kezdődik, mint az előd, mint a példában a *Pointing*.

**„A napban megadott késleltetés naptári napokat számol.”** Alapértelmezés szerint a késleltetés munkanapokat számol, az előd naptárában. Ha keményedésről vagy száradásról van szó, és a hétvége is számít, naptári napokat (`ed`) használjon.

**„Egy kapcsolat nélküli tevékenység nem probléma.”** Egy tevékenység, amelynek nincs előde, a tervezett kezdő dátumán kezdődik, és amelynek nincs utódja, a projekt végéig kap tartalékidőt. Ha elfelejti a kapcsolatot, a tevékenységnek ezért sok tartalékidője látszik; a tévhiteket a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad) cikkben találja.

**„Az összefoglaló tevékenységre tett kapcsolat egy kapcsolat.”** A számításban minden tevékenységre egy kapcsolat jut az összefoglaló tevékenységen belül. Ha tevékenységeket helyez be egy összefoglaló tevékenységbe, vagy onnan ki, akkor a tevékenységekre vonatkozó kapcsolatok is megváltoznak.

## Lásd még

- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): a lépések a tevékenységek összekapcsolásához és a késleltetés beállításához.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mit számít ki az alkalmazás a kapcsolataiból, és miért válik egy tevékenység kritikussá.
- [Korlátozások és határidők](docs://uitleg-constraints): dátumos megállapodások a kapcsolatok mellett.
- [Út követése](docs://howto-pad-traceren): a lánc láthatóvá tétele egy tevékenység előtt vagy után.
- [Hangmat létrehozása](docs://howto-hammock): olyan tevékenység, származtatott időtartammal, amely SS és FF típusú kapcsolatokhoz kapcsolódik.
- [Projektközi kapcsolatok egy másik projekthez](docs://howto-externe-relaties): kapcsolatok egy másik projekt fájljában lévő tevékenységgel.
