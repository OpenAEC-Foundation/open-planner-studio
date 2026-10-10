# Korlátozások és határidők

A téglát csak június 21-én szállítják ki. Az engedély még nem érkezett meg. A tetőt az építési ünnepnap előtt le kell zárni. A kapcsolatok azt rögzítik, hogy egy tevékenység egy másikra vár, de a dátumokra vonatkozó megállapodások nem következnek a munkálatok sorrendjéből. Erre valók a korlátozások és a határidők. Ebben a cikkben megismeri, mit tesz az egyes típus, mikor mozdul el egy tevékenység, és mikor változik csak a tartalékidő. Azt is megtudja, mi a merev rögzítés, és hogyan jelzi az alkalmazás az ütközést.

A szabályok és a példák új projektre vonatkoznak, az *Open Planner Studio* számítási profillal és hétfőtől péntekig tartó munkahéttel.

## A fogalom

A **korlátozás** dátumkorlát egyetlen tevékenységen, a kapcsolatoktól függetlenül. Egy ilyen korlát kétféleképpen működhet:

- **Tolja**: a tevékenység nem kezdődhet és nem fejeződhet be a dátumnál korábban. Ha a kapcsolatai miatt korábban kezdődne, a dátumra tolódik.
- **Őrzi**: a tevékenységnek legkésőbb a dátumon kell kezdődnie vagy befejeződnie. Az alkalmazás semmit sem mozdít el. Ha az ütemezés nem teljesíti a dátumot, a tevékenység **tartalékideje** és az előtte álló lánc tartalékideje negatív lesz. A tartalékidő az a mozgástér, amely egy tevékenységnek megmarad, mielőtt a projekt befejezési dátuma elmozdul. A negatív azt jelenti, hogy papíron már késésben van (lásd: [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad)).

A **határidő** az őrzés egyszerűbb formája: egy tevékenység befejezésére kitűzött célra szánt dátum, anélkül hogy a tevékenységet bármi elmozdítaná.

Minden korlátozás **rugalmas**: a számítás akkor is folytatódik, ha valamelyik dátum nem teljesül. Egyetlen kivétel van, a **merev rögzítés**, amely felülírja a kapcsolatokat. Erről alább olvashat bővebben.

## Hogyan számít az alkalmazás

### A nyolc típus

A típust a *Tulajdonságok* panelen, a *Korlátozás* mezőben választja ki. Így számít minden típus:

- *Lehető legkorábban (ASAP)*: nincs korlát. Ez az alapértelmezett: a tevékenység akkor kezdődik, amikor a kapcsolatai engedik.
- *Lehető legkésőbb (ALAP)*: a tevékenység a lehető legkésőbbre tolódik, anélkül hogy egy utódja később kezdődne. Ezzel felhasználja a szabad tartalékidejét. Ha ezután még marad teljes tartalékideje, mert az utódjainak maguknak van mozgástere, nem kritikus marad. Ha az is elfogy, a tevékenység kritikussá válik.
- *Nem korábban kezdődő (SNET)*: alsó korlát a kezdésre. Ha a tevékenység korábban kezdődne, a dátumra tolódik. Ha a dátum korábbi, mint amit a kapcsolatok engednek, a korlátozás nem tesz semmit.
- *Nem korábban befejeződő (FNET)*: ugyanaz, de a tevékenység befejezésére vonatkozik.
- *Nem később kezdődő (SNLT)* és *Nem később befejeződő (FNLT)*: felső korlát a kezdésre vagy a befejezésre. Ezek semmit sem mozdítanak el. Ha a korlát nem teljesül, az alkalmazás megsértett korlátozást jelez, és a tartalékidő negatív lesz.
- *Kötelező kezdés (MSO)* és *Kötelező befejezés (MFO)*: egyszerre alsó és felső korlát. A tevékenység a dátumra tolódik, ha a dátum későbbi, mint amit a kapcsolatai megkövetelnek. Ha a dátum korábbi, mint amit a kapcsolatok engednek, a tevékenység ott marad, ahová a kapcsolatai helyezték, és a tartalékidő negatív lesz.

Ha a dátum szombatra, vasárnapra vagy nem munkanapra esik, az alkalmazás munkanapként kezeli: az alsó korlátot (SNET, FNET) a következő munkanapon, a felső korlátot (SNLT, FNLT) az azt megelőző munkanapon veszi figyelembe.

### Mit jelent a negatív tartalékidő

Egy felső korlát visszafelé működik. Ha a korlátozás a tevékenység legkésőbbi dátumát a legkorábbi dátuma elé teszi, a teljes tartalékidő negatív lesz. Ez az előtte álló tevékenységekre is érvényes: ha a brickwork tevékenységnek legkésőbb péntek, június 11-én kell kezdődnie, de hétfő, június 14-e előtt nem kezdhető, akkor a brickwork előtti tevékenységek is egy munkanappal késnek. Minden negatív tartalékidejű tevékenység kritikus. Hogy ez hogyan működik, a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad) cikkben olvashat.

Egy felső korlát miatt a sávok nem mozdulnak el. Az ütközést a negatív *Teljes tartalékidő* értékben látja, a sáv fölött megjelenő piros rombuszban, az állapotsor üzenetében (például *1 korlátozás megsértve*), és a *Figyelmeztetések* panelen.

### A merev rögzítés

MSO és MFO esetén megjelenik a *Kötelező (pin-logika)* jelölőnégyzet. Ezzel a jelöléssel a tevékenységet a dátumon rögzíti, akkor is, ha az elődei addigra nem fejeződnek be. A kapcsolatok felülíródnak:

- A tevékenység a dátumon van (MSO esetén ott kezdődik, MFO esetén ott fejeződik be), és átfedésbe kerül az elődeivel.
- Az elődök negatív tartalékidőt kapnak. Az alkalmazás megsértett korlátozást jelez, amint a kapcsolatok a tevékenységet a rögzítésnél későbbre engednék kezdeni. A rögzített tevékenység maga 0 tartalékidőt tart meg.
- Az utódok a rögzített tevékenységtől számítanak tovább. Ezért korábban is kezdődhetnek, mint rögzítés nélkül, pedig az előttük álló logika még nincs kész. A példában alább a projekt befejezési dátuma ennek következtében három munkanappal előbbre kerül.

Amikor először bekapcsolja a rögzítést, az alkalmazás rövid magyarázatot mutat: a merev rögzítés felülírja a kapcsolatokat, a sáv a dátumra van rögzítve, az elődei befejezése előtt is.

### A másodlagos korlátozás

Egy tevékenységnek egy elsődleges korlátozása van. Ha egy második korlátot is szeretne, például egy olyan tevékenységet, amely június 14. előtt nem kezdődhet, és június 17-ig be kell fejeződnie, akkor **másodlagos korlátozást** ad hozzá. Valódi korlátnak kell lennie (SNET, FNET, SNLT vagy FNLT), és az elsődlegestől ellentétes irányban kell korlátoznia: alsó korlát (SNET vagy FNET) egy felső korláttal (SNLT vagy FNLT). Az SNET és az SNLT kombinációja ezért megengedett, az SNET és az FNET nem. Az alkalmazás a többi kombinációt pirossal jelöli, az okkal együtt, például *Az elsődleges és a másodlagos korlátozás nem határolhatja ugyanazt az oldalt.* ASAP, ALAP, MSO, MFO és merev rögzítés esetén nem megengedett másodlagos korlátozás.

### A határidő

A **határidő** külön dátum egy tevékenységen, a korlátozás mellett. Ez a befejezésre vonatkozó felső korlát: semmit sem mozdít el, de negatívvá teszi a tartalékidőt, ha a tevékenység nem fejeződik be időben. Az alkalmazás ezután a *Figyelmeztetések* panelen jelzi: *A … határidő lekésve — korai befejezés: …*, az állapotsor pedig megszámolja a lekésett határidőket. A Gantt-diagramon a határidő dátumán lefelé mutató nyíl van: zöld, amíg a tevékenység időben be van fejezve, piros, amint késik. A szombatra eső határidő az előtte lévő péntekig számít, azt is beleértve.

A tartalékidő szempontjából a határidő ugyanazt teszi, mint az FNLT. A különbség a használatban rejlik. A határidő olyan célként kitűzött dátum, amelyet őrizni szeretne. A korlátozástól függetlenül áll, így egy tevékenységnek lehet korlátozása és határidője is. Az FNLT korlátozás: a megsértése megsértett korlátozásként jelenik meg, és nem lekésett határidőként.

### Mit nem tesz a korlátozás

- Egy **fázison** (összefoglaló tevékenységen) a korlátozás vagy a határidő nem számít: az alkalmazás a fázisban lévő tevékenységekkel számol. Helyezze a korlátozást magára a tevékenységre.
- Egy tevékenység, amely már rendelkezik tényleges kezdéssel vagy előrehaladással, megtartja a kezdését. Egy későbbi dátumú SNET nem mozdítja el.
- **A kezdődátum begépelése** olyan tevékenységnél, amelynek van elődje, nem rögzített kezdésként működik: az előd továbbra is dönt. Ezért az alkalmazás a begépelt dátumot SNET-té alakítja, a *Tulajdonságok* panelen, a *Tevékenység szerkesztése* ablakban, a táblázatban és akkor is, amikor a sávot a Gantt-diagramon mozgatja. Az alkalmazás ezt jelzi. Ha a tevékenységnek már van másik korlátozása (például ALAP vagy MSO), az alkalmazás nem alkalmazza az új kezdést, és ezt is jelzi. Ebben az esetben módosítsa azt a korlátozást.

Minden módosítás csak az **ütemezés-számítás** (F5) után látszik.

## Kidolgozott példa

A példa egy házbővítés kis hálózata. A példa 2027. június 7-én, hétfőn kezdődik:

- *Groundwork* (3 munkanap): június 7., hétfő – június 9., szerda.
- *Pour foundation* (2): június 10., csütörtök és június 11., péntek.
- *Brickwork* (5): június 14., hétfő – június 18., péntek.
- *Roofing* (3): június 21., hétfő – június 23., szerda.
- *Scaffolding* (2): a *Pour foundation* után következik, és a *Roofing* előtt van. Június 14-én, hétfőn és június 15-én, kedden fut, és 3 munkanap tartalékideje van.

A kritikus utat a *Groundwork*, a *Pour foundation*, a *Brickwork* és a *Roofing* alkotja. A projekt június 23., szerdán készül el. Mi változik, ha a *Brickwork* tevékenységen egy korlátozás van?

- **SNET június 21., hétfő** (a téglát csak akkor szállítják): a *Brickwork* június 21., hétfőtől június 25., péntekig fut, a *Roofing* június 28., hétfőtől június 30., szerdáig. A projekt június 30-án, szerdán készül el. A *Groundwork* és a *Pour foundation* tevékenységeknek most 5 munkanap tartalékideje van, és már nem kritikusak. A *Scaffolding* tevékenységnek 8 munkanap tartalékideje van.
- **SNET június 9., szerda**: nincs hatása. A kapcsolatok amúgy is csak június 14-én, hétfőn engedik a *Brickwork* kezdését.
- **SNLT június 16., szerda**: nincs hatása. A *Brickwork* június 14-én, hétfőn kezdődik, és kényelmesen teljesíti a korlátot.
- **SNLT június 11., péntek**: túl szoros. A *Brickwork* továbbra is június 14-én, hétfőn kezdődik, egy munkanappal későn. A *Groundwork*, a *Pour foundation* és a *Brickwork* −1 munkanap tartalékidőt kap, és az alkalmazás ezt jelzi: *Korlátozás: Nem később kezdődő (SNLT) 11-06-2027 a logika által felülbírálva (negatív tartalékidő)*. Semmi sem mozdul el.
- **MSO június 16., szerda** (merev rögzítés nélkül): a *Brickwork* június 16-ra, szerdára tolódik, és június 22-én, kedden fejeződik be. A *Roofing* június 23., szerdától június 25., péntekig fut, a projekt június 25-én, pénteken készül el.
- **MSO június 11., péntek** (merev rögzítés nélkül): a dátum korábbi, mint amit a kapcsolatok engednek. A *Brickwork* ennek ellenére június 14-én, hétfőn kezdődik, és a tartalékidő −1 lesz, akárcsak SNLT esetén.
- **MSO június 9., szerda merev rögzítéssel**: a *Brickwork* június 9-én, szerdán kezdődik és június 15-én, kedden fejeződik be, miközben a *Pour foundation* még június 11-ig, péntekig tart. A *Roofing* június 16., szerdától június 18., péntekig fut: a projekt három munkanappal korábban készül el, mint rögzítés nélkül. A *Groundwork* és a *Pour foundation* −3 munkanap tartalékidőt kap.

És korlátozás vagy határidő egy másik tevékenységen:

- **ALAP** a *Scaffolding* tevékenységen: a tevékenység június 17., csütörtökre és június 18., péntekre tolódik, a *Roofing* előtti legkésőbbi pillanatra. A *Roofing* az egyetlen utódja, és pontosan 3 munkanapnyi mozgástere volt. Ez most elfogy, és a *Scaffolding* kritikus lesz.
- **SNET június 19., szombat** a *Scaffolding* tevékenységen: a korlát június 21., hétfőnek számít. A *Scaffolding* június 21-én, hétfőn és június 22-én, kedden fut, a *Roofing* pedig együtt tolódik: június 23., szerdától június 25., péntekig.
- **Határidő június 18., péntek** a *Roofing* tevékenységen: semmi sem mozdul, a *Roofing* június 21., hétfőtől június 23., szerdáig marad. A *Groundwork*, a *Pour foundation*, a *Brickwork* és a *Roofing* −3 munkanap tartalékidőt kap, és az alkalmazás ezt jelzi: *A 18-06-2027 határidő lekésve — korai befejezés: 23-06-2027*. A *Scaffolding* tartalékideje 0 munkanap marad, és ő is kritikus lesz.
- **SNET június 21., hétfő** a *Brickwork* tevékenységen, **határidő június 25., péntek** a *Roofing* tevékenységen: a korlátozás egy héttel hátrébb tolja a brickwork tevékenységet, a határidő pedig jelzi, hogy a *Roofing* június 30-án, szerdán késik. A *Brickwork* és a *Roofing* −3 munkanap tartalékidőt kap. A *Groundwork* és a *Pour foundation* 2 munkanapot tart meg.

A 3. oktatóanyagban korlátozást és határidőt állít be az oktatóanyag projektjében, és figyelheti, hogyan mozdul el az ütemezés.

## Következmények és tévhitek

**„A korlátozás mozgatja a tevékenységet.”** Csak az SNET, az FNET, az MSO és az MFO képes a tevékenységet későbbre tolni, mint a kapcsolatai engedik, az ALAP pedig a szabad tartalékidején belül mozgathatja. Az SNLT és az FNLT soha nem mozdít el semmit: csak figyelmeztet. A dátum betartása ilyenkor azt jelenti, hogy le kell rövidíteni az előtte álló láncot.

**„A negatív tartalékidő hiba az alkalmazásban.”** Ez jelzi, hogy az ütemezés ütközik a dátumokra vonatkozó megállapodásával. Ezt úgy oldja meg, hogy lerövidíti a láncot, enyhíti a megállapodást, vagy szándékosan elfogadja az ütközést.

**„A merev rögzítés megoldja az ütközést.”** A merev rögzítés elrejti az ütközést: a tevékenység a dátumon van, de az elődei nincsenek rá felkészülve, az utódok pedig úgy számítanak, mintha készen lennének. Csak olyan dátumra használja, amely valóban rögzített, például egy jogi átadási dátumra. Ne arra használja, hogy egy tevékenységet egy dátumra kényszerítsen.

**„Csak beírok egy kezdődátumot.”** Olyan tevékenységnél, amelynek van elődje, ez SNET-té válik. Ha a dátum az előd által engedettnél korábbi, nem tesz semmit.

**„Határidő vagy FNLT?”** Határidőt válasszon olyan célként kitűzött dátumhoz, amelyet őrizni szeretne. Korlátozást pedig olyan dátumhoz válasszon, amely valóban határfeltétel az ütemezés számára.

**„Korlátozás egy fázison.”** Ez nem számít. Helyezze a korlátozást magára a tevékenységre.

## Lásd még

- [Korlátozás vagy határidő beállítása](docs://howto-constraint-deadline-zetten): a lépések egy korlátozás vagy határidő beállításához.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): a függőségek, amelyek mellett a korlátozások állnak.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan keletkezik a negatív tartalékidő, és mit tesz a kritikus úttal.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): egy merev rögzítés, *Kötelező kezdés (MSO)*, a *Municipal road closure (permitted closure period)* tevékenységen, és egy másodlagos korlátozás, *Nem később kezdődő (SNLT)*, a *Lift supply & installation — Tower A* tevékenységen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): egy határidő, amelyet nem tartanak be, negatív tartalékidővel.
