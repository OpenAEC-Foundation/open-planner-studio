# Erőforrás-kiegyenlítés

Önnek egy kőművese van, és két falat kell ugyanazokon a napokon felépíteni. Papíron az ütemezés működik. A gyakorlatban viszont a kőműves csak egy helyen lehet. A kiegyenlítés így oldja fel az ilyen ütközéseket: a tevékenységek későbbre tolódnak, amíg az erőforrás már bírja a terhelést. Ebben a cikkben pontosan megtudja, mit tol el a kiegyenlítés, mikor enged a befejezési dátum, és mit nem old meg Ön helyett az alkalmazás.

## A fogalom

Egy erőforrás **túlterhelt** egy munkanapon, ha az ütemezés aznap többet kér tőle, mint amennyit nyújtani tud. Amit nyújtani tud, az a kapacitása: a naptárának munkanapjain érvényes *Maximális mennyiség*. Ha az erőforrás a naptárja szerint aznap nem dolgozik, a kapacitása 0.

A **kiegyenlítés** úgy old fel egy ütközést, hogy a tevékenységek később kezdődnek. Ennél többet nem tesz. Nem rövidíti meg a tevékenységet, nem bontja szét, nem változtatja a hozzárendelt mennyiségeket vagy a kapcsolatokat, és nem ad hozzá újabb erőforrást. Az alkalmazás minden tevékenységhez megkeresi az első helyet, ahol az erőforrások szabadok, és oda tolja a tevékenységet.

Két mód van az *Erőforrás-kiegyenlítés* ablakban:
- Alapértelmezés szerint a projekt befejezési dátuma elmozdulhat. Ez a szó szoros értelmében vett kiegyenlítés.
- Ha bekapcsolja a *Kiegyenlítés csak a tartalékidőn belül — a projekt befejezési dátuma változatlan marad* jelölőnégyzetet, az alkalmazás csak a tartalékidőn belül mozgatja a tevékenységeket. A befejezési dátum ilyenkor helyben marad. Ha ez nem sikerül, a tevékenység a helyén marad, és az alkalmazás ütközést jelez. Hogy mi a tartalékidő, azt itt olvassa el: [A kritikus út és a tartalékidő](docs://uitleg-kritiek-pad).

## Hogyan számol az alkalmazás

### Mennyit kér egy tevékenység

Munkanaponként az alkalmazás megszámolja, hány hozzárendelt mennyiséget kér minden tevékenység egy erőforrástól. Ez a görbe szerinti hozzárendelt mennyiség, vagy az Ön saját eloszlása, pontosan ugyanannyi óra naponta, mint amennyit a hisztogram mutat. Az erőforrás kapacitása a *Maximális mennyiség*, vagy az időszakonként megadott kapacitás lépcsőjének értéke, amely aznap érvényes. Egy napon túlterhelés van, ha az igény nagyobb a kapacitásnál.

### Milyen sorrendben

Az alkalmazás a tevékenységeket egyenként helyezi el, ebben a sorrendben: először a legmagasabb prioritású, utána a legkevesebb teljes tartalékidővel rendelkező, majd a korábbi korai kezdésű, és végül a tevékenységtáblázatban elfoglalt sorrend szerint. Egy tevékenység csak akkor kerül sorra, ha az elődjei már megkapták a helyüket.

A prioritás 0 és 1000 közötti szám, és tevékenységenként Ön állítja be. Az alapértelmezett érték 500. A tevékenységsáv helyi menüjében a neve *Prioritás*, a választható lehetőségek pedig *Alacsony* (100), *Normál* (500) és *Magas* (900). A korábban sorra kerülő tevékenység megkapja a kívánt helyet. A későbbi tevékenységeknek ehhez kell igazodniuk. Így a prioritás dönti el, melyik tevékenység marad a helyén, és melyiknek kell helyet engednie. Az 1000-es érték különleges: az ilyen tevékenység soha nem tolódik el kapacitás miatt. Ez az MS Project „Do Not Level” beállítása.

### Hova tolódik egy tevékenység

Minden tevékenységnél az alkalmazás a kapcsolatok által megengedett korai kezdéssel indul. Ebben már az is benne van, hogy az elődök maguk is eltolódhattak. Ha a tevékenység ott elfér, a helyén marad. Ha nem fér el, az alkalmazás a tevékenység következő munkanapját próbálja, és így tovább. Egy tevékenység akkor fér el, ha minden napján minden erőforrásból van elég szabad. Ha több erőforrása van, mindnek szabadnak kell lennie ezeken a napokon. Így egy tevékenység mindig későbbre tolódik, sosem korábbra.

Az alkalmazás az eltolódást **kiegyenlítési késleltetésként** rögzíti: hány munkanappal kezdődik később a tevékenység, mint amennyit a kapcsolatai megkövetelnek, a tevékenység naptárában mérve. A *Kiegyenlítési késleltetés* oszlopban látja, a *Számított* csoportban. Az alkalmazás a késleltetést a projektfájllal együtt menti. Az ütemezés-számítás (F5) ezt extra várakozási időként veszi figyelembe a kezdés előtt. A tőle függő tevékenységek a kapcsolataikon keresztül együtt tolódnak.

### Tartalékidőn belül vagy azon túl

Ha a jelölőnégyzet nincs bejelölve, az alkalmazás addig keres, amíg a tevékenység el nem fér. Ennek eredményeként a projekt befejezési dátuma elmozdulhat.

Ha a jelölőnégyzet be van jelölve, a tevékenység nem kezdődhet később a legkésőbbi kezdésénél. Ez az utolsó nap, amikor még elkezdődhet anélkül, hogy a befejezési dátum elmozdulna. Ha a tevékenység ezen belül nem fér el, a legkorábbi helyén marad. Ekkor a tevékenység a *Fennmaradó ütközések* alatt jelenik meg.

### Amit az alkalmazás nem tol el

- Tevékenységek, amelyek már elkezdődtek vagy befejeződtek. A terhelésük beleszámít, de soha nem kapnak kiegyenlítési késleltetést.
- Tevékenységek 1000-es prioritással. Az elődjeiket követik, de kapacitás miatt nem tolódnak el.
- Tevékenységek, amelyeknek nincs hozzárendelésük a kiválasztott erőforrásokhoz, mérföldkövek és szakaszok. Csak akkor mozdulnak, ha egy elődjük eltolódik.
- Anyagok. A kiegyenlítés soha nem érinti őket.

### Javaslat és alkalmazás

A *Számítás* gomb javaslatot készít: a tevékenységek listáját, amelyek eltolódnak, a régi és az új kezdéssel, és a befejezési dátumot a változás előtt és után. Az ütemezésében addig nem változik semmi, amíg nem választja ki az *Alkalmazás* lehetőséget. Ekkor az alkalmazás beírja a késleltetéseket a tevékenységekbe, és azonnal újraszámítja az ütemezést.

## Kidolgozott példa: a kőműves két falon

A példa a *House extension* gyakorlati projekt, abban az állapotban, ahogy az 5. oktatóanyag kiegyenlítése előtt áll. Az 5. oktatóanyagban ezt Ön maga végzi el, és ellenőrzi a számokat. Ebben a példában a vakolás *Rögzített munka* típusú, a vakolómunkás hozzárendelt mennyisége pedig 2, ahogy azt a [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels) leírja.

Miután az üreges padló június 28-án, hétfőn elkészül, a belső falréteg (5 munkanap) és a külső falréteg (6 munkanap) is június 29-én, kedden kezdődik. Mindkettő a kőművesnek van hozzárendelve, 1 hozzárendelt mennyiséggel. A kőműves *Maximális mennyiség* értéke 1. A belső falréteg után következnek a tetőelemek (6 órás darus munka) és a tetőfedés (2 munkanap). A keretek a tetőfedésre és a külső falrétegre várnak. Az átadás augusztus 30., hétfőn lesz.

### A túlterhelés

A belső falréteg június 29-től július 5-ig tart, az utolsó napot is beleértve. A külső falréteg június 29-től július 6-ig tart, az utolsó napot is beleértve. Június 29. és július 5. között, az utolsó napot is beleértve, ez 5 munkanap. Ezen az 5 napon az ütemezés 2 hozzárendelt mennyiséget kér egy kőművestől, akinek a kapacitása 1. A kőműves ezen az 5 napon túlterhelt.

### A sorrend

Mindkét tevékenység prioritása 500. Az ablakkeretek csak július 14-én érkeznek meg (ezt a 3. oktatóanyagban egy *Nem korábban kezdődő (SNET)* korlátozással állította be). Ennek eredményeként a belső falrétegnek 3 munkanap tartalékideje van, a külsőnek 5. A belső falrétegnek van a legkevesebb tartalékideje, ezért ez kerül sorra előbb. A helyén marad június 29-től július 5-ig, az utolsó napot is beleértve.

### Az eltolódás

A külső falréteg nem kezdődhet június 29-én. A kőműves először július 6-án, kedden lesz újra szabad. Ez 5 munkanappal későbbi a korai kezdésnél, ezért a kiegyenlítési késleltetés 5. A külső falréteg most július 6-tól július 13-ig tart, az utolsó napot is beleértve. A keretek úgyis csak július 14-én kezdődnek, ezért az átadás augusztus 30., hétfőn marad. Az ablak a *Projekt befejezése: változatlan (30-08-2027)* üzenetet jeleníti meg, és egy sort mutat: *Build outer cavity leaf*, régi kezdés 29-06-2027, új kezdés 06-07-2027, *5 nap*.

Az eltolódás 5 munkanapja pontosan a külső falréteg tartalékideje. Ezért ad a tartalékidőn belüli kiegyenlítés itt ugyanazt az eredményt. A külső falrétegnek most nincs több tartalékideje, és kritikussá vált.

### Mi történik, ha a keretek nem július 14-én érkeznek

E korlátozás nélkül a keretek július 9-én, pénteken kezdődhetnek, és az átadás augusztus 25., szerdán lesz. A külső falrétegnek ekkor csak 2 munkanap tartalékideje van.

- Ha a jelölőnégyzet nincs bejelölve, a külső falréteg akkor is 5 munkanappal tolódik. A keretek ekkor várnak: július 14-én kezdődnek, 3 munkanappal később. Minden, ami utánuk következik, együtt mozog, és az átadás augusztus 25-ről augusztus 30-ra tolódik, szintén 3 munkanappal később.
- Ha a jelölőnégyzet be van jelölve, semmi sem tolódik el. A külső falréteg nem fér bele a 2 munkanap tartalékidejébe. Az ablak a *Build outer cavity leaf* ütközést mutatja, 5 nap, az indokkal: *Nincs elég szabad kapacitás a tartalékidőn belül az ütközés megoldásához.*

### Mi történik, ha a külső falréteg prioritást kap

Ha a külső falrétegnek *Magas* (900) prioritást ad, az kerül sorra előbb. A helyén marad június 29-én, és most a belső falrétegnek kell helyet engednie: 6 munkanappal később, július 7-től július 13-ig, az utolsó napot is beleértve. A belső falrétegnek csak 3 munkanap tartalékideje van, ezért a 6 munkanapos eltolódás 3 munkanappal több a megengedettnél. A tetőelemek, a keretek és minden utána következő tevékenység együtt tolódik. Az átadás augusztus 30., hétfőről szeptember 2., csütörtökre tolódik. Ugyanaz a túlterhelés tehát más befejezési dátumot ad, attól függően, melyik tevékenység marad a helyén.

### Mi történik, ha érkezik egy második kőműves

Ha a kőműves *Maximális mennyiség* értékét 2-re állítja, már nincs túlterhelés. A *Számítás* gomb ezt jelzi: *Egyetlen tevékenységet sem kell eltolni — az ütemezés már ütközésmentes.*

## Következmények és tévhitek

**„A kiegyenlítés megtalálja a legrövidebb ütemezést.”** Nem. Az alkalmazás tevékenységenként, rögzített sorrendben dolgozik, és nem keresi a legjobb összmegoldást. Lásd a prioritásról szóló példát: egy másik prioritás más befejezési dátumot ad.

**„Az eltolt tevékenység biztonságban van.”** A kiegyenlítés tartalékidőt használ fel. Az eltolt tevékenységnek ezután kevesebb tartalékideje marad, vagy nincs is, és kritikussá válhat, mint fent a külső falréteg. Ha ezután késik, az átadás eltolódik.

**„A kiegyenlítés követi a későbbi módosításait.”** Nem. A késleltetés rögzített számú munkanap. Ha a belső falréteg a kiegyenlítés után rövidebb lesz, a külső falréteg akkor is 5 munkanappal később kezdődik, pedig erre már nincs szükség. Ilyenkor futtassa újra a kiegyenlítést. Az alkalmazás elölről számol.

**Nem minden oldható meg eltolással.** Ha az erőforrás nem dolgozik azokon a napokon, amelyekre a tevékenységnek szüksége van, vagy ha a tevékenység görbéje szerint egy napon többet kér, mint amennyit az erőforrás nyújtani tud, a túlterhelés megmarad. Az alkalmazás ekkor a tevékenységnél megmondja az okot.

**Az anyagokat nem egyenlíti ki az alkalmazás.** Ha egy anyag egy napon több mennyiséget kér, mint a kapacitása, az alkalmazás ezt túlterhelésként jelzi, de a kiegyenlítés ezen nem változtat.

**Lerögzített tevékenységek.** Ha az ütköző tevékenységek mind 1000-es prioritásúak, az ablak ezt jelzi: *Egyetlen tevékenységet sem kell eltolni — az ütemezés már ütközésmentes.*, miközben a túlterhelés megmarad. Ezért az *Alkalmazás* lehetőség kiválasztása után nézze meg a *Túlterhelés* üzenetet a menüszalagon.

## Lásd még

- [A túlterhelés megoldása](docs://howto-overbezetting-oplossen): a lépések a túlterhelés megtalálásához és kiegyenlítéséhez.
- [A kritikus út és a tartalékidő](docs://uitleg-kritiek-pad): mi a tartalékidő, és miért válik egy tevékenység kritikussá.
- [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels): hogyan változik egy tevékenység időtartama a mennyiségekkel együtt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): három torony, amelyek ugyanazokat a munkacsapatokat és a toronydarut igénylik, és hogy mit tesz ezzel a kiegyenlítés.
