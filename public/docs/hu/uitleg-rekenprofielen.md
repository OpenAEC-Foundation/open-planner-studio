# Számítási profilok és ütemezési szabályok

Ugyanaz az ütemezés más dátumokat adhat, attól függően, milyen számítási szabályokat alkalmaz. Ez a cikk elmagyarázza, miért számol másként a Primavera P6 és a Microsoft Project néhány ponton, hogyan rögzíti az alkalmazás ezt a különbséget egy **számítási profilban**, és miben tér el egy profil attól a számítási beállítástól, amelyet Ön projektenként állít be. Egy kis hálózaton bemutatott példa mutatja meg, mit jelent ez a dátumokra nézve.

## A fogalom

A tevékenységek, a kapcsolatok és a naptár meghatározzák az ütemezés nagy részét, de nem mindent. Mi történik a még nem kezdett munkával, amikor állapotdátumot állít be? Hol kezdődik egy már folyamatban lévő tevékenység hátralévő munkája? Mekkora a tevékenység szabad tartalékideje, ha a tevékenység lekésik a határidőt? A hálózat erről nem mond semmit. Egy ütemezőprogramnak szabályt kell választania ezekre. Az alkalmazás több olyan pontot ismer, ahol a Primavera P6 szabálya és a Microsoft Project szabálya eltér.

Az alkalmazás ezt a választást **ütemezési szabálynak** nevezi. A **számítási profil** egy programhoz tartozó ütemezési szabályok halmaza. Az alkalmazásnak három profilja van:

- *Open Planner Studio*: az a profil, amellyel az új projekt számol. Egyik ütemezési szabály sincs bekapcsolva.
- *Primavera P6*: az ütemezési szabályok, amelyeket az alkalmazás a P6-ból ismer.
- *Microsoft Project*: az ütemezési szabályok, amelyeket az alkalmazás a Microsoft Projectből ismer.

A profil tehát azt mondja meg, hogyan számol egy programcsomag. Amit Ön a projektjéhez szeretne, nem tartozik hozzá. Ezek a **számítási beállítások**: például az, hogy milyen kevés tartalékidő teszi a tevékenységet kritikussá, vagy melyik naptárban számít a késleltetés. Ezeket projektenként Ön állítja be.

## Hogyan számol az alkalmazás

### Ütemezési szabályok és számítási beállítások

Az ütemezési szabály kapcsoló: be vagy ki. A profil dönti el, melyik kapcsoló van bekapcsolva. A számítási beállítást Ön választja ki. A különbséget magában az alkalmazásban láthatja, a *Számítási profil és beállítások* blokkban:

- **Ütemezési szabályok** az *Ennek a profilnak az ütemezési szabályai* alatt vannak, témakör szerint csoportosítva, például *Befejezett munka és előrehaladás*, *Késleltetés és kapcsolatok* és *Legkésőbbi dátumok és tartalékidő*. Minden sor egy jelölőnégyzet, utána a profil értéke áll (*alap: be* vagy *alap: ki*). Ha az Ön választása ettől eltér, a sor kiemelődik, és megjelenik a *Visszaállítás az alapra*. A sor előtti nyíl megnyitja az adott szabály magyarázatát. Ha szabályt szeretne módosítani, olvassa el előbb a magyarázatot.
- **Számítási beállítások** az *Ennek a projektnek a számítási beállításai* alatt vannak: többek között a *Kritikus definíció*, a *Tartalékidő-számítás*, a *Nyitott végű tevékenységek kritikusak*, a *Közel kritikus jelölése* és a *Késleltetési naptár*. Ezek azt mondják meg, mit szeretne ehhez a projekthez, nem azt, hogyan számol egy programcsomag. Működésüket a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad) és a [Kapcsolatok és késleltetés](docs://uitleg-relaties) cikk írja le.

Egy példa mindkettőre. „A tevékenység akkor kritikus, ha teljes tartalékideje 0 vagy kisebb” egy számítási beállítás: a küszöbértéket 4-re állíthatja, és akkor minden, aminek legfeljebb 4 munkanap a tartalékideje, kritikus lesz. „A még nem kezdett munka az állapotdátumra mozdul” egy ütemezési szabály: az Open Planner Studio és a Primavera P6 így működik, a Microsoft Project nem.

A profil és a számítási beállítások a projektfájlhoz tartoznak, nem az alkalmazáshoz. Ha elmenti a projektet, azok vele együtt mentődnek. Ezért ugyanabban az alkalmazásban két projekt másik profillal is számolhat. Profil nélküli projekt az Open Planner Studio profillal számol.

Ha olyan számítási beállítások vannak, amelyeket csak a Primavera ismer, a blokk alján megjelenik a *Beállítások a forrásfájlból* rész. Ez történik egy .xer file-ból származó projekt esetén, de akkor is, ha az *Új projekt* ablakban a *Primavera P6* profilt választja, vagy a Primavera P6 alapbeállításait alkalmazza. Ezeket itt nem módosíthatja.

### Hol választja ki a profilt

Új projekt esetén a profil az *Új projekt* ablakban van, amelyet a *Kezdőlap › Fájl › Új* útvonalon nyit meg. Ott a *Számítási profil* egy legördülő lista. Ha itt profilt választ, az alkalmazás a már kitöltött számítási beállításokat az adott profil alapértékeire cseréli; csak a forrásfájlból származó beállítások maradnak meg. *Primavera P6* esetén a *Tartalékidő-számítás* ekkor *Befejezési tartalékidő* lesz. A *Microsoft Project* és az *Open Planner Studio* esetén minden számítási beállítás az alapértékén van, ezért a *Tartalékidő-számítás* értéke *Automatikus (alapértelmezett)*. Állapotdátummal a Microsoft Project is így számol: egy elkezdett tevékenység a befejezési tartalékidőt kapja, minden más tevékenység pedig a kezdési és a befejezési tartalékidő közül a kisebbet.

Egy meglévő projektnél a profilt a *Beállítások › Projekt › Projektinfó* alatt választja ki, a *Számítási profil és beállítások* blokkban, a *Számítási profil* legördülő listában. Ugyanide a *Fájl › Projektadatok* útvonalon is eljut. Profilváltáskor itt csak az ütemezési szabályok változnak. A számítási beállításai megmaradnak. Ha az új profil alapértelmezett számítási beállításait is szeretné, válassza az *Ennek a profilnak az alapbeállításainak alkalmazása* lehetőséget.

Amíg az *Alkalmazás* gombot meg nem nyomja, a változás csak az űrlapon van meg. Az *Alkalmazás* gombbal az alkalmazás azonnal újraszámítja az ütemezést, még akkor is, ha az *Automatikus ütemezés-számítás* ki van kapcsolva. Ha tevékenységek mozdultak el, megmondja, hány tevékenység mozdult el, például: *Az alkalmazás után 4 tevékenység tolódott el.* Az egész váltás egyetlen lépés, amelyet a *Visszavonás* visszavonhat.

Ha egyetlen szabályt bekapcsol vagy kikapcsol egy profilban, az alkalmazás egyéni profillá alakítja. Ennek neve *Másolat: Open Planner Studio*, vagy *Másolat:* a kiindulási profil neve. Másik nevet is adhat neki, és a *Mentés sablonként* paranccsal megtarthatja más projektekhez ebben az alkalmazásban. A projektnek mindig saját példánya van: ha később módosítja a sablont, a projekt nem változik vele.

### Mikor választ profilt maga az alkalmazás

Fájl megnyitásakor az alkalmazás a formátum alapján javasol profilt:

- Egy .mpp fájl (Microsoft Project) a *Microsoft Project* profillal nyílik meg.
- Egy .xer fájl (Primavera P6) a *Primavera P6* profillal nyílik meg.
- Egy *MS Project XML*, *Primavera P6 XML* vagy *CSV (pontosvesszővel tagolt)* formátumú fájl az *Open Planner Studio* profillal nyílik meg, profilüzenet nélkül.
- Az Ön saját projektje (.ifc) a benne tárolt profillal nyílik meg.

Egy .mpp vagy .xer fájl esetén az alkalmazás jelzi a profilt: *Ez a projekt a(z) Microsoft Project számítási profillal számol. Módosítsa a Fájl → Projektinfó → Számítási profil és beállítások menüpontban.* Az üzenetben lévő *Számítási profil megnyitása* gomb közvetlenül a Projektinfóhoz visz. Egy .xer fájlnál ez a sor a fájl megnyitási üzenetének első részletsora. Az üzenetről bővebben itt olvashat: [Primavera P6-fájl megnyitása (.xer)](docs://howto-xer-openen) és [MS Project-fájl megnyitása (.mpp)](docs://howto-mpp-openen).

Egy .mpp fájl esetén az alkalmazás csak a profilt állítja be. A számítási beállítások üresek maradnak, ahogy a *Microsoft Project* profilú új projektnél is: a *Tartalékidő-számítás* értéke *Automatikus (alapértelmezett)*. Egy megnyitott .mpp fájl és egy *Microsoft Project* profilú új projekt ezért ugyanúgy számolja a tartalékidőt.

## Példa: egy hálózat, három profil

A példa egy kis hálózat. A naptárban a munkahét hétfőtől péntekig tart, és ezekben a hetekben nincs szabadnap. Az előrehaladási mód a Retained Logic (az alapértelmezett). A projekt 2027. június 7-én, hétfőn kezdődik. Minden tevékenység munkanapban van megadva.

- *Pour foundation*: 5 munkanap, június 7., hétfői tervezett kezdéssel.
- *Lay walls*: 5 munkanap, a *Pour foundation* után (befejezés-kezdés).
- *Order window frames*: 3 munkanap, nincs előde, június 7., hétfői tervezett kezdéssel.
- *Fit roof*: 2 munkanap, a *Lay walls* és az *Order window frames* után. Ennek a tevékenységnek a befejezése az átadás.

A számokat az alkalmazás számítómotorja számolta ki. Ezeket a *Tulajdonságok* panelen, a *CPM-eredmény* alatt olvashatja le.

**Állapotdátum és előrehaladás nélkül a három profil ugyanúgy számolja ki ezt a hálózatot.** A *Pour foundation* június 7-től június 11-ig, hétfőtől péntekig tart. A *Lay walls* június 14-től 18-ig, hétfőtől péntekig tart, a *Fit roof* június 21-én, hétfőn és június 22-én, kedden. Az átadás június 22., kedd. Az *Order window frames* (június 7-től június 9-ig, hétfőtől szerdáig) 7 munkanap teljes tartalékidővel rendelkezik.

Most rögzíti az előrehaladást. Az állapotdátum június 9., szerda. Az alapozás június 7-én, hétfőn kezdődött, és 60 %-on áll. A hátralévő munka ezért 2 munkanap (5 × 40 %). Az *Order window frames* még nem kezdődött. Az [előrehaladás és az állapotdátum](docs://uitleg-voortgang) működése abban a cikkben szerepel. Itt az a kérdés, mit kezd vele a profil.

### Open Planner Studio

A *Pour foundation* hátralévő munkája az állapotdátumon kezdődik: június 9., szerda és június 10., csütörtök. A korai kezdés a tényleges kezdés marad, június 7., hétfő. A korai befejezés június 10., csütörtök. A *Lay walls* június 11., péntektől június 17., csütörtökig fut, a *Fit roof* június 18-án, pénteken és június 21-én, hétfőn.

Az *Order window frames* június 7., hétfői tervezett kezdéssel szerepelt, de nem kezdődött el. A még nem kezdett munka nem lehet a múltban. Ezért az alkalmazás az állapotdátumra mozgatja: június 9-től június 11-ig, szerdától péntekig, 4 munkanap teljes tartalékidővel. Az átadás június 21., hétfő.

### Primavera P6

Minden ugyanaz, mint az Open Planner Studio esetén, egy pont kivételével: a *Pour foundation* korai kezdése június 9., szerda. Ez a hátralévő munka kezdete, nem a tényleges kezdés. Ezt a *Folyamatban lévő tevékenység: korai kezdés = a hátralévő munka kezdete* szabály okozza, a *Befejezett munka és előrehaladás* csoportban. A befejezés és a tartalékidő ettől nem változik. Az átadás június 21., hétfő.

### Microsoft Project

Itt eltérnek a dátumok. Két szabály okozza ezt az *Előrehaladás a Microsoft Project szerint* csoportban.

*Nem elkezdett tevékenységek nem tolódnak az állapotdátumra*: az *Order window frames* június 7-től június 9-ig, szerdáig marad, pedig ez a szakasz részben az állapotdátum előtt van. A teljes tartalékidő 7 munkanap.

*A hátralévő munka a már eltelt időtartam után folytatódik*: a hátralévő munka legkorábban az állapotdátumon kezdődik, és legkorábban a tényleges kezdés plusz a már eltelt időtartam után. Az 5 munkanap 60 %-a 3 munkanap, ennyi már kész. Június 7., hétfő plusz 3 munkanap: június 10., csütörtök. Ez az állapotdátum után van, ezért a hátralévő munka június 10., csütörtökön és június 11., pénteken fut. A *Lay walls* június 14., hétfőtől június 18., péntekig fut, a *Fit roof* június 21., hétfőn és június 22., kedden. Az átadás június 22., kedd: egy munkanappal később, mint a másik két profilnál.

### Mi lenne, ha

**Az alapozás 60 % helyett 20 %-on áll.** A hátralévő munka ekkor 4 munkanap. Mindhárom profil szerint az alapozás június 14., hétfőn fejeződik be, az átadás pedig június 23., szerda. A Microsoft Project ütemezési szabálya a hátralévő munkára itt nincs hatással: június 7., hétfő plusz 1 eltelt munkanap június 8., kedd, ez pedig az állapotdátum előtt van. Egy ilyen szabály alsó korlát, amely csak későbbre tolhatja a hátralévő munkát. Az *Order window frames* és a Primavera P6 szerinti korai kezdés továbbra is eltér, ahogy fent. A Microsoft Project szerint az *Order window frames* ekkor 8 munkanap teljes tartalékidővel rendelkezik.

**Csak állapotdátumot állít be, és nem visz be előrehaladást.** Az Open Planner Studio és a Primavera P6 szerint az egész hálózat június 9., szerdára mozdul. Az alapozás ekkor június 9., szerdától június 15., keddig fut, az átadás pedig június 24., csütörtökre kerül: két munkanappal később, mint állapotdátum nélkül. A Microsoft Projectnél minden a helyén marad, az átadás június 22., kedd.

**Saját profilt állít össze.** Ha az Open Planner Studio profilon csak a *Nem kezdett tevékenységek nem mozdulnak az állapotdátumra* szabályt kapcsolja be, az egyéni profil lesz, *Másolat: Open Planner Studio* néven. 60 %-os előrehaladás mellett az alapozás megtartja az Open Planner Studio dátumait (befejezés: június 10., csütörtök, átadás: június 21., hétfő). Az *Order window frames* valóban június 7-től június 9-ig marad, 6 munkanap teljes tartalékidővel. Egy profil tehát külön kapcsolók csomagja, és ezeket egyenként módosíthatja.

**Számítási beállítás a szabály helyett.** Ha az Open Planner Studio alatt a *Kritikus definíció* (*Teljes tartalékidő ≤ küszöbérték*) mellett a *Küszöbérték (munkanap)* értékét 4-re állítja, az *Order window frames* kritikussá válik, mert teljes tartalékideje pontosan 4. Dátum nem változik. A számítási beállítás az Ön projektjére vonatkozó választás, és független a profiltól.

**Lekésett határidő.** Adjon a *Fit roof* tevékenységnek határidőt, június 18., péntek. Az Open Planner Studio alatt a *Fit roof* teljes tartalékideje ekkor −1 munkanap, a szabad tartalékideje is −1. A Primavera P6 alatt a teljes tartalékidő −1 marad, de a szabad tartalékidő 0 lesz. Ezt a(z) *A szabad tartalékidő soha nem negatív* szabály teszi a *Legkésőbbi dátumok és tartalékidő* csoportban. A Microsoft Projectnél mindkettő −2, mert az átadás ott egy nappal később esik. Hogy hogyan működik a határidő, azt a [Korlátozások és határidők](docs://uitleg-constraints) cikk írja le.

## Következmények és félreértések

**„A profil az alkalmazás beállítása.”** Nem. A profil és a számítási beállítások a projekthez tartoznak. Ezek benne vannak a fájlban. Csak a sablonok tartoznak az alkalmazáshoz, ha megtartja őket. Egy projekt mindig a saját példányát tartja meg.

**„Ha exportálok, a profilom vele megy.”** Csak a saját projektformátumnál (.ifc) igaz. Ha exportál *MS Project XML*, *Primavera P6 XML* vagy *CSV (pontosvesszővel tagolt)* formátumba, a profil nincs benne a fájlban. A számítási beállítások közül az MS Project XML export legfeljebb a kritikus küszöbértéket írja ki. Az alkalmazás csak egy .xer file-ból származó projektnél figyelmeztet erre. Egy saját projektnél nincs üzenet. A fájl ezután Open Planner Studio-ként nyílik meg, profilüzenet nélkül. Vegyük példának a Microsoft Project profilt 60%-os előrehaladással. Ha *MS Project XML* formátumba exportálja, majd újra megnyitja, az alkalmazás először a fájl dátumait mutatja. Az átadás kedden, június 22-én van. Ha hagyja, hogy az alkalmazás maga újraszámítson, ez hétfő, június 21. lesz. Azt, hogy egy export mit veszít még, a [Fájlok és formátumok](docs://uitleg-bestanden) című részben találja.

**„A Primavera P6 profil ugyanazt az eredményt adja, mint a P6.”** Ezt az alkalmazás nem ígérhet. A profil azokat az ütemezési szabályokat kapcsolja be, amelyeket az alkalmazás a P6-ból ismer. Ezek nem a P6 összes beállítása. A P6-nak a Retained Logic és a Progress Override mellett van egy harmadik előrehaladási módja is: Actual Dates. Az alkalmazás ezt nem ismeri. Egy ilyen .xer file ezért Retained Logic szerint számít. A megnyitási üzenet ezt jelzi, például így: *1 P6-ütemezési beállítás biztonságos tartalékot használt.* A Primavera P6 profil néhány ütemezési szabálya, például a *Nem elkezdett LOE a célablakot használja* és a *A tényleges dátumok pontos megtartása*, szintén csak olyan tevékenységeknél működik, amelyek egy .xer file-ból származnak. Néhány magyarázat ezt ki is mondja: „csak P6-eredetű tevékenységeknél”. Az Ön által létrehozott tevékenységeknél ezek a szabályok nem hatnak.

**„Az előrehaladási mód a profil része.”** Nem. A Retained Logic vagy a Progress Override projektenként külön választás. Ezt a profiltól függetlenül állítja be, lásd [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen). Egy Primavera P6 ütemezési szabály csak a Progress Override esetén tesz valamit: *A Progress Override a már elkezdett utódot visszafelé is figyelmen kívül hagyja*.

**„Csak váltok profilt, hogy lássam, mi történik.”** Ezt megteheti. Az *Alkalmazás* egy lépés, és a *Visszavonás* ezt is egy lépésben visszavonja: a profil és a dátumok együtt térnek vissza. A dátumok viszont tényleg elmozdulhatnak. A példában az Open Planner Studio-ról Microsoft Project-re váltva mind a 4 tevékenység elmozdul. Az üzenet megszámolja őket. Nézze át utána az ütemezést, mielőtt tovább dolgozik. Ha a .xer- vagy .mpp-megnyitás után az alkalmazás még a fájl dátumait mutatja, a profilváltás ezt a nézetet elhagyja, és az alkalmazás maga számít. Hogy ez hogyan működik, azt a [Az eltárolt dátumok](docs://uitleg-datums-zoals-opgeslagen) című részben találja.

**A példa négy ütemezési szabályt mutat, de az alkalmazás listája hosszabb.** A blokk minden sorának saját magyarázata van. Olvassa el ezt először. Nézze meg a *Csak saját profilok* csoportot is. Ezek az ütemezési szabályok minden beépített profilban ki vannak kapcsolva, a Primavera P6 profilban is. Ha egyet bekapcsol, a profil saját profillá válik.

## Lásd még

- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mit tesz az állapotdátum és a hátralévő munka, profilonkénti különbségekkel.
- [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen): a Retained Logic vagy a Progress Override kiválasztása.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): a számítási beállítások a kritikus úthoz és a tartalékidőhöz.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): a számítási beállítás *Késleltetési naptár*.
- [Fájlok és formátumok](docs://uitleg-bestanden): mit visz magával egy export, és mit nem.
- [Exportálás](docs://howto-exporteren): egy projekt exportálása.
- [Az előrehaladás frissítése](docs://howto-voortgang-bijwerken): százalék, tényleges kezdés és állapotdátum megadása.
- [Az eltárolt dátumok](docs://uitleg-datums-zoals-opgeslagen): miért térhetnek el az importált dátumok attól, amit az alkalmazás maga számít.
- [Számítási beállítások és szabályok](docs://ref-rekenopties-en-conventies): az összes ütemezési szabály és számítási beállítás egy listában.
