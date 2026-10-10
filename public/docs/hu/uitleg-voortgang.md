# Előrehaladás, állapotdátum és alapterv

Az ütemezés előrejelzés. Ha a munka elkezdődött, Ön tudni szeretné, mi készült el, mi van még hátra, és mit jelent ez az átadásra nézve. Ez a cikk leírja, hogyan dolgozza fel az alkalmazás az előrehaladást: mit tesz az állapotdátum, hogyan számítja ki a hátralévő munkát, miért kell egy már elkezdett tevékenységnek néha még várnia az elődjére, és hogyan hasonlítja össze az aktuális állapotot az eredeti megállapodással. Egy kidolgozott példa mutatja a számokat.

## Az alapfogalom

Az **előrehaladás** az, ami valóban megtörtént. Az alkalmazás tevékenységenként három dolgot rögzít: egy százalékot, egy **tényleges kezdést** és egy **tényleges befejezést**. Ami az ütemezés szerint várható volt, az mellette marad. A tényleges az, ami valóban történt.

Az **állapotdátum** az a nap, amelyen Ön számba veszi a helyzetet. Minden, ami ezen a napon előtt történt, tény. Ami még hátra van, azt az alkalmazás az adott nap kezdetétől tervezi. Egy tényleges dátum lehet az állapotdátumon, de sosem lehet utána.

A **hátralévő munka** az, ami egy tevékenységből még hátra van. Egy 4 munkanapos tevékenység, amely 25%-ban kész, 3 munkanapnyi hátralévő munkával rendelkezik.

Az **alapterv** az ütemezés pillanatfelvétele egy adott pillanatban, általában akkor, amikor a megállapodást jóváhagyták. Később a tényleges ütemezést mellé helyezi, és látja, mennyire tér el a megvalósítás.

## Hogyan számít az alkalmazás

A példa az *Open Planner Studio* számítási profilt használja, amellyel egy új projekt számol. Később olvashatja, mi tér el a Primavera P6 és a Microsoft Project profiljában.

Az alkalmazás nem számítja újra magától az ütemezést. Minden változás után az előrehaladásban vagy az állapotdátumban az állapotsor ezt mutatja: *Elavult — újraszámítsa (F5)*. Nyomja meg a **Számítás** gombot (F5), például az *Ütemezés › Ütemezés › Számítás* menüúton. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (a *Beállítások › Projekt › Beállítások* alatt, az *Ütemezés* lapon, az *Ütemezés-számítás* szakaszban), az alkalmazás ezt maga végzi.

### Az állapotdátum

Az állapotdátum három dolgot tesz.

Először: az alkalmazás nem fogad el az állapotdátum utáni tényleges dátumot. Egy dátum az állapotdátumon megengedett.

Másodszor: olyan munka, amely még nem kezdődött el, nem eshet a múltba. Ha egy ilyen tevékenység az állapotdátum előtt van tervezve, az alkalmazás az állapotdátumra helyezi. Ez a kapcsolatain keresztül vonatkozik a későbbi tevékenységekre is, amelyek vele együtt mozognak. Az alábbi példában láthatja a hatást. A Microsoft Project profiljában az alkalmazás ezt nem teszi meg.

Harmadszor: egy már futó tevékenység hátralévő munkája magán az állapotdátumon kezdődik. Az alkalmazás az állapotdátumot a nap kezdeteként kezeli. Ha pénteken munkaidő után veszi számba a helyzetet, állítsa az állapotdátumot hétfőre. Ha pénteket állít be, az alkalmazás a hátralévő munkát még arra a péntekre tervezi.

Ha még nincs állapotdátum, és előrehaladást ad meg, az alkalmazás az állapotdátumot a mai napra állítja, és ezt jelzi. Állapotdátum nélkül az alkalmazás egy futó tevékenységet előre a hátralévő időtartamával, visszafelé viszont a teljes időtartamával számít. A tartalékidő ekkor negatív lesz, és a tevékenység ok nélkül kritikusnak látszik.

### Százalék, tényleges dátumok és hátralévő időtartam

A mezők egymástól függnek. Ha az egyiket kitölti, az alkalmazás a többit is kitölti.

- A 0-nál nagyobb százalék azt jelenti, hogy a tevékenység elkezdődött. Ha nem ad meg tényleges kezdést, az alkalmazás a tervezett kezdést veszi. Ha a tevékenység az állapotdátum után van tervezve, az alkalmazás előbb azt kérdezi, mikor kezdődött valójában.
- A 100%-os százalék azt jelenti, hogy a tevékenység kész. Ha nem ad meg tényleges befejezést, az az állapotdátum lesz, akkor is, ha a munka valójában korábban készült el.
- Egy tényleges befejezés 100%-ra állítja a tevékenységet. Ha egy kész tevékenységet 100% alá állít vissza, a tényleges befejezés törlődik. Ha a tényleges befejezést törli, a százalék 0-ra áll vissza, és a tevékenység *Folyamatban* marad, amíg a tényleges kezdést is ki nem törli.
- A **hátralévő időtartam** az időtartam szorozva azzal, ami még hátra van, egész munkanapra kerekítve. Egy 2 munkanapos tevékenység esetén a 0% és a 25% is 2 munkanapnyi hátralévő munkát jelent, az 50% és a 75% pedig 1 munkanapot. 90%-nál az alkalmazás 0-ra kerekít: a hátralévő munka ekkor az állapotdátumon készül el. Órában megadott tevékenység egész percben számol: egy 5 órás tevékenység 40%-nál 3 óra hátralévő munkát tartalmaz.
- Egy mérföldkőnek csak egy tényleges dátuma van.
- Egy szakasz (összefoglaló tevékenység) nem rendelkezik saját előrehaladással. Számítás után a százaléka az alatta lévő tevékenységek százalékaiból adódik: ezek súlyozott átlaga, ahol a súly a munkanapokban megadott időtartam. Egy mérföldkő súlya 0.

Ha egy már futó tevékenység időtartamát módosítja, az elvégzett munka megmarad. A százalék ehhez igazodik: egy 5 munkanapos, 60%-ban kész tevékenység, amelyet 10 munkanapra állít, 30%-on áll meg. Az alkalmazás nem fogad el az elvégzett munkánál rövidebb időtartamot.

### Kész és futó tevékenységek

Egy kész tevékenység a tényleges dátumain rögzül. Nem mozog tovább, és állapotdátummal sosem kritikus. Állapotdátum nélkül egy kész tevékenység még lehet kritikus.

Egy futó tevékenység megtartja a tényleges kezdését. Csak a hátralévő munka mozog. Hogy a hátralévő munka hol kezdődik, az előrehaladási módtól függ.

### Retained Logic és Progress Override

Mi történik, ha egy tevékenység már elkezdődött, miközben az előde még fut? Az ilyen kapcsolatot **sorrenden kívüli kapcsolatnak** nevezzük: az előrehaladás ellentmond a sorrendnek. Gondoljon a festőre, aki már egy olyan szobában kezd, amelyet már bevakoltak, miközben a vakoló máshol még dolgozik.

Két előrehaladási mód dönti el, hogyan számítja ezt ki az alkalmazás:

- **Retained Logic** (az alapértelmezett): a kapcsolat érvényben marad. Az utód hátralévő munkája követi a kapcsolatot: befejezés-kezdés esetén csak akkor kezdődik, ha az előde befejeződött, és sosem az állapotdátum előtt.
- **Progress Override**: a valóság dönt. Az utód hátralévő munkája az állapotdátumon kezdődik, az előde befejezésére várakozás nélkül.

Ebben a profilban a különbség csak a hátralévő munkánál van, azoknál a tevékenységeknél, amelyek már elkezdődtek, miközben az elődjük még nincs kész. A többi tevékenység mindkét módban ugyanúgy számít. Az alkalmazás mindkét módban jelzi az ilyen kapcsolatot: az állapotsorban *1 sorrenden kívüli kapcsolat*, és a *Figyelmeztetések* panelben.

### Alapterv és eltérés

Mentéskor az alkalmazás minden olyan tevékenységhez rögzíti a korai kezdést, a korai befejezést, az időtartamot és a mérföldkőtípust, amelynek nincs altevékenysége. A szakaszok nincsenek benne. Ami később változik, az nem érinti az alaptervet. Több alapterv is megtartható, de pontosan egy az **aktív**. A Gantt, az eltérésjelentés és az előrehaladási jelentés az aktív alaptervet használja.

Az **eltérés** a munkanapokban mért különbség az alapterv és az aktuális ütemezés között. Plusz esetén *Később*, mínusz esetén *Korábban*, egyébként *Ütemezés szerint*. Az alkalmazás a projektnaptárban számol. Az eltérésjelentés tevékenységenként megadja a kezdési és a befejezési eltérést. A besorolás csak a befejezéstől függ. Az alapterv után hozzáadott tevékenység neve *Új*; egy már nem létező tevékenység *Elhagyott*.

Két megjegyzés. Az időtartam-eltérés a tevékenységtáblázatban van (az *Időtartam-eltérés* oszlopban), nem az eltérésjelentésben. Ez a tevékenység mostani tervezett időtartamát hasonlítja össze az alapterv időtartamával. Az előrehaladás nem változtatja meg ezt a tervezett időtartamot. Egy két munkanapra tervezett tevékenység, amely három munkanapig tartott, ezért befejezési eltérése +1, de időtartam-eltérése 0. Ha az előrehaladás megadása után menti az alaptervet, az a tényleges dátumokkal rögzíti az állapotot; az eltérés ekkor nulla.

Az előrehaladási jelentés a tervezett előrehaladást állítja a ténylegesé mellé. Mindkettő munkanapokkal súlyozott. A tervezett az a rész, amelynek az alapterv szerint az állapotdátumon már készen kellett volna lennie. A tényleges az, amit a megadott százalék mutat.

### Hol látja

A Gantt-diagramon szaggatott vonal jelöli az állapotdátumot, a dátummal a fejlécben. Minden futó tevékenységnél a vonal a sávnak arra a pontjára tér ki, amelyet a százalék jelöl. Ez az **előrehaladási vonal**. Ha az előrehaladási vonalat kikapcsolja, de az állapotdátum-vonal be van kapcsolva, egyenes vonal marad. Ha mindkettőt kikapcsolja, a vonal és a címke eltűnik. A gombok *Alapterv-átfedés*, *Előrehaladási vonal* és *Állapotdátum-vonal* a *Nézet › Alaptervek és előrehaladás* menüben vannak, és nem változtatnak a számításon. Az alapterv vékony sávként jelenik meg minden tevékenységsáv alatt. A tevékenységtáblázatban vannak oszlopok az előrehaladáshoz, és alaptervenként az eltéréshez. A *Jelentés* lapon találja az *Eltérés* és az *Előrehaladási jelentés* jelentés típusait.

## Kidolgozott példa: a House extension három hét után

A példa a *House extension* gyakorlóprojekt az oktatóanyagokból, abban az állapotban, miután minden kapcsolatot felvett, építőipari szabadság, erőforrások vagy órák nélkül. A 6. oktatóanyagban ezt Ön maga végzi el a gyakorlóprojektben. Addigra abban a projektben már több minden van, ezért a számok ott mások. Itt azt olvashatja el, miért ilyenek a számok.

A bővítés 2027. június 7., hétfőn kezdődik. Az ütemezés kiszámítása után az alkalmazás egy *Alapterv* nevű alaptervet ment: átadás 2027. augusztus 6., péntek, 45 munkanap.

### A helyzet hétfőn, június 28.

Az állapotdátum 2027. június 28., hétfő. Ez történt:

- A *Start of construction*, *Set up site*, *Clear garden and paving* és *Set out the extension* a tervnek megfelelően készen vannak, június 7. és 10. között.
- Az *Excavate foundation trench* 2 munkanapra volt tervezve (péntek, június 11., és hétfő, június 14.), de 3 munkanapig tartott: június 11-től 15-ig.
- A *Foundation formwork and reinforcement* június 16-tól 18-ig tart. A *Reinforcement inspection* június 18-án van, a *Pour foundation* hétfőn, június 21-én.
- A *Foundation brickwork* (2 munkanap) pénteken, június 25-én kezdődött, és 50%-on áll.

A **Számítás** után az alkalmazás így számol:

- A foundation brickwork hátralévő munkája 2 × (1 − 0,5) = 1 munkanap. Az állapotdátumon kezdődik, ezért hétfőn, június 28-án fejeződik be.
- A *Lay hollow-core floor* kedden, június 29-én következik. Ennek eredményeként a *Build inner cavity leaf* szerdán, június 30-án kezdődik, nem kedden, június 29-én. Az átadás hétfőn, augusztus 9-én lesz: egy munkanappal később, mint az alapterv. Az ásás egy extra napja ezért az egész projekt késése, mert ez a tevékenység a kritikus úton volt.
- Az állapotsor ezt jelzi: *Kritikus út: 13 tevékenység, 46 munkanap*, az előrehaladás előtt pedig 21 tevékenység és 45 munkanap volt. A nyolc kész tevékenység, amely a kritikus úton volt, már nem számít bele.
- A *Foundations* szakasz 77,8%-on áll. A szakaszban lévő tevékenységek súlya 2 + 3 + 1 + 2 + 1 = 9 munkanap. Kész 2 + 3 + 1 munkanap, plusz a 2 fele: összesen 7. A 9 munkanapból 7 kész, ez 77,8%. A *Reinforcement inspection* mérföldkő súlya 0.

Az eltérésjelentés ezt az alaptervvel állítja szembe:

- *Excavate foundation trench*: kezdés 0, befejezés +1 (az alapterv szerinti befejezés június 14., most június 15.).
- *Foundation brickwork*: kezdés +1 (június 24-ből június 25. lett), befejezés +1.
- *Build outer cavity leaf*: +1, +1. Ez a tevékenység még nem kritikus: 2 munkanap tartalékidővel rendelkezett, és ezt meg is tartja.
- *Handover*: +1. A projektbefejezés 1 munkanappal tér el.
- Összesen 19 tevékenység van *Később* állapotban, 4 pedig *Ütemezés szerint* állapotban; *Korábban* állapotban nincs tevékenység.

Az előrehaladási jelentés a *Tervezett* 28,3%-ot és a *Tényleges* 23,9%-ot mutatja. A tevékenységek együtt 46 munkanapot érnek. Az alapterv szerint 13 munkanapnyi munkának kellett volna készen lennie: 4 munkanap az előkészítésből, 2 munkanap az ásásból, 3 a vasalásból, 1 a betonozásból, 2 az alapfalazatból és 1 az üreges födémből. Ténylegesen 11 munkanap kész: 4 + 2 + 3 + 1, plusz az alapfalazat fél napja.

### Mi történik, ha áthelyezi az állapotdátumot?

Ugyanaz az előrehaladás, más állapotdátum. A foundation brickwork hátralévő munkája mindig az állapotdátumon kezdődik, ezért az átadás vele együtt mozog:

- Állapotdátum, péntek, június 25.: a hátralévő munka péntek, június 25-én esik, az átadás péntek, augusztus 6. marad.
- Hétfő, június 28.: az átadás hétfő, augusztus 9.
- Kedd, június 29.: az átadás kedd, augusztus 10., 2 munkanappal később, mint az alapterv.

### Mi történik, ha módosítja a százalékot?

A foundation brickwork 2 munkanapos. 0%-nál vagy 25%-nál a hátralévő munka 2 munkanap: kedden, június 29-én fejeződik be, az átadás pedig kedd, augusztus 10. 50%-nál vagy 75%-nál 1 munkanap: hétfő, június 28., az átadás hétfő, augusztus 9. 90%-nál a hátralévő munka 0, és a tevékenység az állapotdátumon fejeződik be.

### Mi történik, ha előrehaladás nélkül állít be állapotdátumot?

Ha csak az állapotdátumot állítja be június 28., hétfőre, és semmit nem ad meg, akkor az ütemezés szerint még semmi sem történt. Olyan munka, amely még nem kezdődött el, nem eshet a múltba. Az alkalmazás ezért mindent június 28-ra helyez át: a *Start of construction* ekkor erre a napra kerül, és az átadás péntek, augusztus 27. lesz, 15 munkanappal az alaptervhez képest. Ezért adja meg előbb a már meglévő előrehaladást.

## Kidolgozott példa: vakoló és festő

Most egy példa következik az előrehaladási módra. Ugyanaz a bővítés, más állapotban: most 2027. július 21., szerda van. Minden, az *Install building services* tevékenységet is beleértve, a terv szerint készült el. A *Plastering* (4 munkanap) július 20., kedden kezdődött, és 25%-nál tart. A *Painting* (3 munkanap) a vakolást követi, de a festő már ma elkezdte, és 33%-nál tart.

Előrehaladás nélkül a vakolást július 20., keddtől július 23., péntekig, a festést július 26., hétfőtől július 28., szerdáig tervezték. Az állapotsor most ezt mutatja: *1 sorrenden kívüli kapcsolat*. A festés már elkezdődött, de a vakolás még nincs befejezve. A *Figyelmeztetések* panelen ez olvasható: *Sorrenden kívüli előrehaladás: az utód előrehaladása ellentmond a kapcsolatnak*.

A vakolás hátralévő munkája 4 × (1 − 0,25) = 3 munkanap: július 21., 22. és 23. A festés hátralévő munkája 3 × (1 − 0,33) = 2 munkanap.

- A **Retained Logic** mellett ez a hátralévő munka csak akkor kezdődhet, ha a vakolás befejeződött. Ez július 23., péntek, ezért a festés július 26., hétfőn kezdődik, és július 27., kedden fejeződik be. A sáv a tényleges kezdéstől, július 21-től július 27-ig tart. A teljes tartalékidő 7 munkanap.
- A **Progress Override** mellett a hátralévő munka az állapotdátumon kezdődik. A festés július 22., csütörtökön fejeződik be, még azelőtt, hogy a vakolás befejeződne. A teljes tartalékidő 10 munkanap.

Az átadás mindkét esetben augusztus 6., péntek marad: a festésnek amúgy is volt tartalékideje.

### Más számítási profilok

A Primavera P6 és a Microsoft Project profilban a festés ebben a példában ugyanazokon a dátumokon fejeződik be (július 27. és július 22.). Az alábbi pontokban térnek el. Ezek a profil ütemezési szabályai. Megtalálja őket a *Beállítások › Projekt › Projektinfó* alatt, a *Számítási profil és beállítások* blokkban.

- A Microsoft Project profilban a még nem kezdett tevékenység nem mozdul az állapotdátumra (ütemezési szabály: *Nem elkezdett tevékenységek nem tolódnak az állapotdátumra*). Ha a fenti példában csak állapotdátumot állít be, és nem visz be semmit, az átadás abban a profilban augusztus 6., péntek marad.
- A Microsoft Project profilban a hátralévő munka sem kezdődik korábban, mint a tényleges kezdés plusz a már eltelt időtartam (ütemezési szabály: *A hátralévő munka a már eltelt időtartam után folytatódik*). Ez az állapotdátum mellett további alsó határ: a kettő közül a későbbi számít. Vegyük példaként a *Build inner cavity leaf* tevékenységet (5 munkanap). Június 29., kedden kezdődött. Az állapotdátum június 30., szerda, és a tevékenység 40%-nál tart. Két csapat egyszerre falaz, ezért a 40% már egy nap után megvan. Minden, ami előtte van, a terv szerint készült el. Az Open Planner Studio és a Primavera P6 szerint a tevékenység július 2., péntekre fejeződik be. A Microsoft Project július 5., hétfőre, mert június 29., kedd plusz 2 eltelt munkanap július 1., csütörtök, ami az állapotdátum után van.
- A Primavera P6 a folyamatban lévő tevékenység korai kezdéseként a hátralévő munka kezdetét mutatja, nem a tényleges kezdést (a belső fal példájában június 30., szerda).
- A Primavera P6 profilban a Progress Override mellett a már elkezdett utódhoz tartozó kapcsolat az elődre nézve sem számít: nem korlátozza többé az előd legkésőbbi dátumait és szabad tartalékidejét (ütemezési szabály: *A Progress Override a már elkezdett utódot visszafelé is figyelmen kívül hagyja*). A vakoló és festő példájában ezt nem látja, mert a vakolás úgyis kritikus a padlóaljzat miatt. Legkésőbbi dátumai és szabad tartalékideje a Retained Logic és a Progress Override mellett ugyanaz.
- Ha .xer file-t nyit meg, az alkalmazás az előrehaladási módot onnan veszi át. Az Actual Dates, a harmadik P6-mód, nem ismert az alkalmazás számára. Az ilyen fájl Retained Logic szerint számít.

## Következmények és félreértések

**„Majd csak eltolom az állapotdátumot.”** Ha eltolja, a folyamatban lévő tevékenységek hátralévő munkája az új dátumon kezdődik. A még nem kezdett munka pedig soha nem kerülhet e dátum elé. Ezért csak az előrehaladás frissítésével együtt mozdítsa el az állapotdátumot.

**„A 100% megadása rögzíti a tényleges befejezést.”** Csak akkor, ha a tényleges befejezést is megadja. Ha egy tevékenységet tényleges befejezés nélkül 100%-ra állít, a befejezése az állapotdátum lesz. Ha valójában korábban fejeződött be, adja meg a tényleges befejezést.

**„A 0% azt jelenti, hogy nem kezdődött el.”** Ha egy tevékenységnek van tényleges kezdése, elkezdettnek számít, még akkor is, ha 0%. A hátralévő munka ekkor a teljes időtartam, és az állapotdátumon kezdődik. Törölje a tényleges kezdést, hogy a tevékenység újra nem elkezdettnek számítson.

**„A Progress Override megoldja a figyelmeztetést.”** A sorrenden kívüli előrehaladás figyelmeztetés megmarad. Az előrehaladási mód csak azt határozza meg, hogyan számít az alkalmazás. Ha a kapcsolat már nem helyes, módosítsa a kapcsolatot.

**„A szünet kiesik a megszakított tevékenységből.”** Nem. A még hátralévő rész szünete a hátralévő munkában marad. Vegyünk egy 5 munkanapos tevékenységet, amelynek 2 munkanap munka után 1 napos szünete van. Június 29., kedden kezdődött. Az állapotdátum június 30., szerda, a tevékenység pedig 40%-nál tart. A hátralévő 3 munkanap az állapotdátumon kezdődik, és átfut a szünetén. A befejezés július 5., hétfő. Szünet nélkül július 2., péntek lett volna.

**Órák és az állapotdátum.** A menüszalagon nem lehet időpontot megadni: az állapotdátumot dátumként adja meg. Ha munkaidő után végez felmérést, állítsa az állapotdátumot a következő munkanapra. Órában megadott tevékenységnél a hátralévő munkát az állapotdátum kezdetétől számítja ki az alkalmazás. Vegyük a *Lay hollow-core floor* tevékenységet a gyakorló projektben, a 4. oktatóanyag után: 5 óra, június 28., hétfő, a munkanap 07:00-kor kezdődik. Ha az állapotdátum június 28., hétfő, és a tevékenység 40%-nál tart, 3 óra hátralévő munka van, 07:00-tól 10:00-ig, akkor is, ha aznap reggel már történt munka. Azt, hogyan számolja az alkalmazás az órákat, a [Napok és órák](docs://uitleg-dagen-en-uren) ismerteti.

**Alapterv frissítése.** Ez nem lehetséges. Mentsen egy újat, és törölje a régit. Ha áthelyezi a projektet, a tényleges dátumok és az állapotdátum vele mozdul. Az alaptervek alapértelmezés szerint nem mozdulnak: így az eltolódás eltérésként látható marad. Lásd: [Projekt áthelyezése](docs://howto-project-verplaatsen).

## Lásd még

- [Előrehaladás frissítése](docs://howto-voortgang-bijwerken): az állapotdátum beállítása és az előrehaladás megadása.
- [Előrehaladás importálása táblázatból](docs://howto-voortgang-importeren): az előrehaladás egy lépésben beolvasása a helyszíni munkatársaktól.
- [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen): a Retained Logic vagy a Progress Override beállítása.
- [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren): alapterv rögzítése és használata.
- [Projekt áthelyezése](docs://howto-project-verplaatsen): mi történik a tényleges dátumokkal, az állapotdátummal és az alaptervekkel.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): miért kritikus egy tevékenység, és mit jelent a tartalékidő.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): az előrehaladás és egy állapotdátum a projekt közepén (2027. május 20.).
