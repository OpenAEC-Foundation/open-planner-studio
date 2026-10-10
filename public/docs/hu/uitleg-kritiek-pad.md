# Kritikus út és tartalékidő

Miért ez a projektbefejezés? És melyik tevékenység csúszhat egy napot úgy, hogy az átadás nem tolódik el? Ezekre a kérdésekre ad választ a kritikus út. Ez a cikk pontosan leírja, mit számít ki az alkalmazás, egy kidolgozott példával.

## A fogalom

Egy ütemezés tevékenységek hálózata. A tevékenységeket **kapcsolatok** kötik össze: megállapodások, például „az ablakkeretek csak akkor kerülhetnek be, ha a tető már zárt”. Ezek a kapcsolatok összekötik a tevékenységeket. Néhány tevékenységlánc hosszabb másoknál. A leghosszabb lánc határozza meg, mennyi ideig tart az egész projekt.

Ez a leghosszabb lánc a **kritikus út**. Ha ezen az úton egy tevékenység egy napot késik, az átadás is egy napot késik. Ezen az úton nincs tartalék.

A nem kritikus úton lévő tevékenységeknek van tartaléka. Ezt a tartalékot **tartalékidőnek** nevezzük. A falazó, aki a külső falréteget építi, két nappal később is elkezdhetné a munkát, anélkül hogy bárki észrevenné. Ez a két nap az adott tevékenység tartalékideje.

Tehát a kritikus szó nem azt mondja meg, mennyire fontos egy tevékenység. Csak azt jelzi, hogy nincs több időtartalék.

A számítási módszer neve **CPM** (Critical Path Method, kritikus út módszer). Ezért az eredményblokk neve a *Tulajdonságok* panelen: *CPM-eredmény*.

## Hogyan számít az alkalmazás

Az alkalmazás nem számítja újra az ütemezést magától. A számítást az **ütemezés-számítás** (F5) parancs indítja, például a *Kezdőlap › Ütemezés › Számítás* útvonalon. Ha az utolsó számítás óta változott valami, az állapotsor ezt mutatja: *Elavult — újraszámítsa (F5)*. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (a *Beállítások › Projekt › Beállítások* alatt, az *Ütemezés* fülön, az *Ütemezés-számítás* részben), akkor az alkalmazás ezt maga végzi el.

A számítás két menetben jár be a hálózaton.

### Előre bejárás

Az alkalmazás a projektkezdéstől indul. A kapcsolatokat követve haladva az előd tevékenységtől az utód tevékenység felé halad. Minden tevékenységhez megkeresi a legkorábbi napot, amikor az kezdődhet. Ha egy tevékenységnek több előde van, a tevékenység megvárja az utolsó befejezését. Így minden tevékenység megkapja a **korai kezdés** és a **korai befejezés** dátumát. Az összes tevékenység legkésőbbi korai befejezése a projektbefejezés.

### Visszafelé bejárás

Ezután az alkalmazás visszafelé halad, a befejezési dátumtól a kezdésig. Most minden tevékenységhez megkeresi azt az utolsó napot, amíg a tevékenységnek be kell fejeződnie, úgy hogy a befejezési dátum ne tolódjon el. Ha egy tevékenységnek több utódja van, a számítás az utódot veszi figyelembe, amelynek előbb kell kezdődnie. Így kapja meg a **legkésőbbi kezdés** és a **legkésőbbi befejezés** dátumát.

### Teljes és szabad tartalékidő

A tevékenység legkésőbbi és legkorábbi dátumának különbsége a **teljes tartalékidő**. Ez az a munkanapokban mért idő, amennyit a tevékenység késhet, vagy később kezdődhet, anélkül hogy a projektbefejezés eltolódna. Az alkalmazás a tevékenység naptárának munkanapjaiban számol. Hétvége és ünnepnap nem számít bele.

A **szabad tartalékidő** szigorúbb. Ez az a tartalék, amelyet a tevékenység addig használhat fel, amíg egyik utódjának később kell kezdődnie. Ezt a tartalékot más tevékenység észrevétele nélkül használhatja fel.

A teljes tartalékidő megoszható. Ha két nem kritikus tevékenység egymás után következik, ugyanazt a tartalékot osztják meg. Ha az első felhasználja, a másodiknak nem marad semmi. Az elsőnek ekkor van teljes tartaléka, de nincs szabad tartaléka. A teljes tartalékidőnek azt a részét, amely nem szabad, **zavaró tartalékidőnek** nevezzük. Ha ezt felhasználja, az utána következő tevékenységek is elmozdulnak. Az alábbi példa ezt számokkal mutatja.

### Negatív tartalékidő

A tartalékidő negatív is lehet. Ez akkor fordul elő, ha egy tevékenységnek határideje van, vagy olyan korlátozása, amely legkésőbbi dátumot ír elő, és ez a dátum korábbi, mint az a dátum, amelyet az alkalmazás az adott tevékenységre kiszámít. Papíron a tevékenység már késik. A tevékenység és az előtte lévő lánc kritikussá válik.

### Mikor kritikus egy tevékenység?

Alapértelmezés szerint egy tevékenység akkor kritikus, ha a teljes tartalékideje 0 vagy kevesebb. Ezt a *Beállítások › Projekt › Projektinfó* alatt lehet módosítani, a *Számítási profil és beállítások* blokkban, az *Ennek a projektnek a számítási beállításai* résznél. Ha az *Alkalmazás* gombra kattint, az alkalmazás azonnal újraszámítja az ütemezést. A beállítások a projektfájlhoz tartoznak, nem az alkalmazáshoz.

- **Kritikus meghatározás** a *Teljes tartalékidő ≤ küszöbérték* beállítással és a *Küszöbérték (munkanap)* mezővel. A küszöbérték alapértéke 0. Ha egy puffert szeretne védeni, állítsa 2-re. Például: minden tevékenység, amelynek 2 munkanap vagy annál kevesebb tartalékideje van, kritikusnak számít, és pirosra vált.
- **Közel kritikus jelölése** a saját *Küszöbérték* beállításával, alapértelmezés szerint 2 munkanap. Egy tevékenység, amelynek 0-nál több, de legfeljebb ennyi tartalékideje van, borostyánsárga sávot kap. Így látszik, mely tevékenységekben alig maradt tartalék, anélkül hogy kritikusnak neveznénk őket.
- **Nyitott végű tevékenységek kritikusak**: egy tevékenység, amelynek nincs utódja, és még nincs befejezve, kritikusnak számít. Hasznos biztonsági hálóként az elfelejtett kapcsolatok ellen (lásd lent a tévhiteknél).
- **Tartalékidő-számítás** dönti el, hogy a teljes tartalékidőt a tevékenység kezdetén, a befejezésénél, vagy a kettő közül a kisebbnek megfelelően mérjük. Az új projektek beállítása *Automatikus (alapértelmezett)*. Ha a Primavera P6 számítási módját követi, az *Ennek a profilnak az alapbeállításainak alkalmazása* gomb a választást erre állítja: *Befejezési tartalékidő*. Az MS Projectnél ugyanez a gomb a választást visszaállítja erre: *Automatikus (alapértelmezett)*. Állapotdátummal az MS Project maga is így számol.

### Hol látja?

Kritikus tevékenységek piros sávot kapnak a Gantt-diagramon. Egy nem kritikus sáv mögött zöld tartalékidő-sáv húzódik a tevékenység legkésőbbi befejezéséig: ez a tartalékidő. Ezt a sávot a *Nézet › Alaptervek és előrehaladás › Tartalékidő-sáv* útvonalon lehet be- és kikapcsolni.

Egy kijelölt tevékenységnél a *Tulajdonságok* panel minden adatot felsorol a *CPM-eredmény* alatt: a korai és legkésőbbi kezdést és befejezést, a teljes, szabad és zavaró tartalékidőt, és azt, hogy a tevékenység a kritikus úton van-e. A tevékenységek tartaléka egymás mellett látszik a *Számított* alatti oszlopokban (a táblázat fejlécének jobb szélén lévő **+**-szal), például *Teljes tartalékidő*, *Szabad tartalékidő*, *Kritikus* és *Közel kritikus*.

Az alsó állapotsor megszámolja a kritikus tevékenységeket, például: *Kritikus út: 21 tevékenység, 45 munkanap*.

## Kidolgozott példa: a házbővítés

Ez a példa az oktatóanyagok gyakorlóprojektje, a *House extension*, abban az állapotban, amikor minden kapcsolat már fel van véve. A 2. oktatóanyagban, „Kapcsolatok és a kritikus út” címmel, ezt maga építi fel, és ellenőrzi a számokat. Itt azt olvassa el, miért ezek a számok.

A bővítés 2027. június 7-én, hétfőn kezdődik. A számítás után az átadás 2027. augusztus 6-án, pénteken lesz. Az állapotsor ezt mutatja: *Kritikus út: 21 tevékenység, 45 munkanap*. Két tevékenység nem kritikus: a *Build outer cavity leaf* és a *Painting*.

### Két lánc, ami találkozik

A szerkezeti padló (*Lay hollow-core floor*, hétfőn, június 28-án befejezve) után a tevékenységek két láncra válnak szét. Mindkettő az *Install window frames* tevékenységben ér véget:

- A belső rész: *Build inner cavity leaf* (5 munkanap), majd *Place roof elements* (1), majd *Apply roofing* (2). Az ablakkeretek csak akkor kerülhetnek be, ha a tető már zárt.
- A külső rész: *Build outer cavity leaf* (6 munkanap). Az ablakkeretek a homlokzatba kerülnek, ezért ennek is készen kell lennie.

**Előre.** Mindkét üreges fal kezdődhet kedden, június 29-én. A belső fal július 5-én, hétfőn készül el. A tetőelemek július 6-án, kedden kerülnek fel, a tetőfedés pedig július 7-én és 8-án, szerdán és csütörtökön következik. A külső fal július 6-án, kedden készül el. Az *Install window frames* a két lánc közül a későbbire vár, vagyis a tetőfedésre, ezért július 9-én, pénteken kezdődik.

**Visszafelé.** Az ablakkereteknek július 9-én, pénteken legkésőbb kezdődniük kell, különben az átadás eltolódik. Ezért a külső falnak legkésőbb július 8-án, csütörtökön kell befejeződnie. Hat munkanappal visszaszámolva ez a legkésőbbi kezdés: július 1., csütörtök.

**Tartalék.** A külső fal június 29-én kezdődhet a legkorábban, és július 1-jén kell kezdődnie legkésőbb. A kettő között 2 munkanap van: június 30., szerda és július 1., csütörtök. Ez a teljes tartalékideje. A panelen *Teljes tartalékidő: 2 nap* és *Kritikus út: nem* látszik. A szabad tartalékidő is 2 nap, mert egyetlen utódja, az *Install window frames*, a kritikus úton van.

A belső láncnak nincs tartaléka. Minden késés ott eltolja az ablakkereteket és mindent, ami utánuk következik.

### Painting

A *Painting* (3 munkanap) a vakolás után, hétfőn, július 26-án kezdődik, és július 28-án, szerdán fejeződik be. A következő tevékenység, a *Snagging and cleaning*, a burkolásra is vár. Az csak augusztus 5-én, csütörtökön fejeződik be, mert a padlóaljzatnak előbb öt munkanapig kell száradnia. Ezért a festés augusztus 5-ig, csütörtökig tarthat. Ez 6 munkanap tartalékot ad: július 29-e és 30-a, valamint augusztus 2-től 5-ig. Itt is megegyezik a szabad tartalékidő a teljes tartalékidővel, mert az utód kritikus.

### Ha a külső fal késik

Ha a külső fal 6 helyett 8 munkanapig tart, július 8-án, csütörtökön készül el: pontosan a legkésőbbi befejezésénél. A tartalék elfogy, és a tevékenység pirosra vált. Mindkét lánc kritikussá válik, és az állapotsor 22 kritikus tevékenységet számol. Az átadás továbbra is augusztus 6-án, pénteken lesz.

Ha 9 munkanapig tart, a külső fal csak július 9-én, pénteken készül el. Az ablakkeretek július 12-re, hétfőre tolódnak, az átadás pedig augusztus 9-re, hétfőre: egy munkanappal később. A külső lánc most a kritikus út. Az állapotsor ezt mutatja: *Kritikus út: 19 tevékenység, 46 munkanap*.

A belső láncnak ekkor 1 munkanap teljes tartaléka van, de ez a nap megosztott:

- *Build inner cavity leaf*: teljes tartalékidő 1, szabad tartalékidő 0, zavaró tartalékidő 1. Ha a belső fal egy napot késik, a tetőelemek is vele mozdulnak.
- *Place roof elements*: teljes tartalékidő 1, szabad tartalékidő 0, zavaró tartalékidő 1.
- *Apply roofing*: teljes tartalékidő 1, szabad tartalékidő 1. Csak itt nem kerül senkibe egy napnyi késés.

Ez ugyanaz az egy nap, amelyet az egész lánc megoszt. Ha a belső fal felhasználja, a tetőelemek és a tetőfedés már nem kapják meg.

### Közel kritikus és negatív tartalékidő

Ha a *Közel kritikus jelölése* be van kapcsolva az alapértelmezett, 2 munkanapos küszöbértéken, a külső fal, amelynek pontosan 2 nap tartaléka van, borostyánsárga sávot kap. A festés, 6 nappal, kék marad.

Ha az átadás augusztus 4., szerdai határidőt kap, ami két munkanappal a kiszámított átadás előtt van, a tartalékidő negatív lesz. A kritikus úton lévő 21 tevékenység teljes tartaléka −2 munkanap lesz. A külső falnak nincs több tartaléka, ezért ő is kritikussá válik. A festés 4 munkanapos tartalékot tart meg.

## Következmények és tévhitek

**„A kritikus azt jelenti, hogy fontos.”** Nem. Egy ellenőrzés lehet kulcsfontosságú, és mégis lehet tartaléka. Fordítva: egy egyszerű tevékenység is lehet kritikus. A példában a *Snagging and cleaning* a kritikus úton van. A kritikus csak az időre vonatkozik: nincs több tartalék.

**„Ennek a tevékenységnek van tartaléka, tehát várhat.”** Nézze meg előbb a szabad tartalékidőt. Ha egy tevékenységnek van teljes tartaléka, de nincs szabad tartaléka, minden késés elveszi a tartalékot az utána következő tevékenységektől, mint a belső falnál a 9 munkanapos esetben.

**Egy elfelejtett kapcsolat hamis tartalékot ad.** Egy tevékenység, amelynek nincs utódja, a projektbefejezésig kap tartalékot. Ha a példából hiányozna a kapcsolat a külső fal és az ablakkeretek között, a külső falnak hirtelen 23 munkanap tartaléka lenne, egészen az augusztus 6-i átadásig. Papíron így hetekkel is késhetne úgy, hogy az ablakkeretek nem várnának rá. A *Nyitott végű tevékenységek kritikusak* bekapcsolásával a külső fal ebben az esetben kritikussá válik, és a hiányosság látszik.

**A kritikus út nem rögzített.** Ha egy nem kritikus tevékenység a tartalékidejénél később fejeződik be, egy másik lánc lesz a leghosszabb. Ezt fent láttuk a 9 munkanapos falazásnál. Ezért minden változás után el kell végezni az újraszámítást. Amíg az állapotsor *Elavult — újraszámítsa (F5)* üzenetet mutat, a piros sávok még az előző számításhoz tartoznak.

**A tartalékidő munkanapokban számít.** A festés 6 munkanapos tartaléka július 29., csütörtöktől augusztus 5., csütörtökig tart: a naptárban nyolc nap, mert a hétvége nem számít bele. Egy ünnepnap vagy építőipari szabadság a naptárban szintén nem számít bele.

## Lásd még

- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): a tevékenységek összekapcsolásának lépései, és a késleltetés beállítása.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): hogyan határozzák meg a kapcsolatok és a késleltetés a korai dátumokat.
- [Korlátozások és határidők](docs://uitleg-constraints): hogyan okoz egy korlátozás vagy határidő negatív tartalékidőt.
- [Útvonal követése](docs://howto-pad-traceren): a tevékenység mögött álló lánc követése.
- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): a kritikus meghatározás, a közel kritikus és a tartalékidő-számítás, beállításonként.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): nagy projekt, több tartalékidő-útvonallal, közel kritikus tevékenységekkel (küszöbérték 3 munkanap), egy hangmattal, egy kemény rögzítéssel és egy projektközi kapcsolattal.
