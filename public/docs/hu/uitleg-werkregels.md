# Tevékenységtípusok: időtartam, hozzárendelt mennyiség és munka

Egy vakolót rendel a vakoláshoz, és a tevékenység négy napig tart. Ha egy második vakolót is hozzáad, a munka két nap alatt elkészülhet. A tevékenység ugyanígy maradhat négy napos is, de akkor benne kétszer annyi munka van. Mindkettő értelmes. Hogy az alkalmazás a kettő közül melyiket választja, azt a **tevékenységtípus** dönti el. Ebben a cikkben megismeri, hogyan köti össze az alkalmazás az időtartamot, a hozzárendelt mennyiséget és a munkát, és hogy az egyes tevékenységtípusok mit tartanak állandónak.

## A fogalom

Három mennyiség függ össze:

- **Időtartam**: mennyi ideig tart a tevékenység, munkanapokban vagy órában.
- **Hozzárendelt mennyiség**: mekkora részt dolgozik egy erőforrás a tevékenységen munkanaponként. A *Tulajdonságok* panelen ez a neve: *Hozzárendelt mennyiség*, más ablakokban *Hozzárendelt mennyiség/nap*. A hozzárendelt mennyiség 1 egy vakolót jelent egész napra, a 2 kettőt, a 0,5 pedig fél napot.
- **Munka**: az erőforrás által a tevékenységen töltött órák összes száma.

Az összefüggés: munka = időtartam × hozzárendelt mennyiség × munkanaponkénti órák. A munkanaponkénti órák a tevékenység naptárából jönnek. Négy munkanapos vakolás egy vakolóval, 8 órás munkanappal: 4 × 1 × 8 = 32 óra munka.

Ha a három mennyiség egyikét módosítja, a másik kettő közül legalább az egyiknek együtt kell mozdulnia, különben az összefüggés már nem áll fenn. A tevékenységtípus dönti el, melyik. Tevékenységenként a *Tulajdonságok* panelen állítja be. Az alkalmazás csak akkor mutatja a tevékenységtípust és a munkát, ha bekapcsolja őket. Hogy ez hogyan működik, azt a [Tevékenységtípus kiválasztása](docs://howto-werkregel-kiezen) cikk írja le.

A tevékenységtípus csak normál tevékenységeknél működik. A mérföldköveknél, a fázisoknál (összefoglaló tevékenységek), a hangmatoknál és azoknál a tevékenységeknél, amelyeknél az *Időtartam típusa* értéke *Eltelt időtartam*, nincs tevékenységtípus: a *Tevékenységtípus* mező ott nincs. Az anyagok, például a beton vagy a vakolóhabarcs, sem számítanak. Az anyagmennyiség soha nem határozza meg az időtartamot, és az alkalmazás tevékenységtípus miatt sem módosítja azt.

## Hogyan számítja ki az alkalmazás

### A tevékenységtípus a módosításra reagál

Az alkalmazás az időtartamot, a hozzárendelt mennyiséget és a munkát csak abban a pillanatban számítja újra, amikor az egyiket módosítja: a tevékenység időtartamát, egy hozzárendelés hozzárendelt mennyiségét, a munkát, egy erőforrás hozzáadását vagy eltávolítását, vagy a napi órákat egy naptárban. Az **Ütemezés-számítás** (F5) egyiket sem változtatja meg: az F5 csak a dátumokat számítja ki. A tevékenységtípus kiválasztása sem változtat meg egyetlen számot sem. A tevékenységtípus a következő módosításnál érvényesül.

Ha a tevékenységtípus megváltoztatja a tevékenység időtartamát, az ütemezés elavulttá válik. Az állapotsor ekkor ezt írja ki: *Elavult — újraszámítsa (F5)*, hacsak nincs bekapcsolva az *Automatikus ütemezés-számítás*.

### Négy tevékenységtípus

A *Tulajdonságok* panelen van egy i ikon a *Tevékenységtípus* legördülő lista mellett. Mutasson rá, kattintson rá vagy koppintson rá, és az alkalmazás elmagyarázza az éppen érvényes tevékenységtípust. A kinyitott listában minden lehetőség mellett szintén van ilyen i ikon. A magyarázat félkövér mondattal kezdődik. A négy tevékenységtípus a hozzá tartozó mondattal, az alkalmazásból:

- **Rögzített időtartam és egységek** (*A munka az időtartamból és a hozzárendelt mennyiségből adódik.*). Ez az alapértelmezett. Az alkalmazás soha nem módosítja maga az időtartamot, a munka az időtartamból és a hozzárendelt mennyiségből adódik. Ha Ön írja be a munkát, az alkalmazás a hozzárendelt mennyiséget igazítja, mert az időtartam rögzített.
- **Rögzített időtartam és munka** (*A hozzárendelt mennyiség az időtartamból és a munkából adódik.*). Az alkalmazás soha nem módosítja maga az időtartamot. Ha Ön módosítja az időtartamot, a munka megmarad, és a hozzárendelt mennyiség igazodik.
- **Rögzített munka** (*Az időtartam a munkából és a hozzárendelt mennyiségből adódik.*). A munka rögzített, az időtartam a munkából és a hozzárendelt mennyiségből adódik.
- **Rögzített egységek** (*Az időtartam a munkából és a hozzárendelt mennyiségből adódik.*). A hozzárendelt mennyiség rögzített, az időtartam a munkából adódik.

Így két tevékenységtípus hagyja érintetlenül az időtartamot. A másik kettőnél az időtartam együtt mozdul, ha módosítja a hozzárendelt mennyiséget, a munkát vagy az erőforrások számát. Egy erőforrás esetén a *Rögzített munka* és a *Rögzített egységek* ugyanazt teszi. Akkor térnek el egymástól, ha Ön maga módosítja az időtartamot: *Rögzített munka* esetén a munka megmarad, és a hozzárendelt mennyiség igazodik; *Rögzített egységek* esetén a hozzárendelt mennyiség marad, és a munka együtt nő. Akkor is eltérnek, ha a tevékenységen több erőforrás van (lásd lent).

Az alábbi kidolgozott példák megmutatják, mit tesz mindegyik tevékenységtípus.

### Kerekítés

Az összefüggésből következő időtartamot az alkalmazás felfelé kerekíti: napokban megadott tevékenységnél egész munkanapokra, órákban megadott tevékenységnél egész percekre. A munka és a hozzárendelt mennyiség az marad, amit Ön megadott, vagy amit az alkalmazás az összefüggésből kapott. Emiatt az összefüggés néha nem áll fenn pontosan. Az alábbi példa megmutatja, mi történik ilyenkor.

### Több erőforrás

Ha egy tevékenységen több erőforrás van, két szabály érvényesül. *Rögzített időtartam és munka*, *Rögzített munka* és *Rögzített egységek* esetén a teljes munka ugyanannyi marad, amikor erőforrást ad hozzá vagy távolít el. Az alkalmazás ezt ekkor a hozzárendelt mennyiségek arányában osztja el. *Rögzített időtartam és egységek* esetén egy új erőforrás ehelyett saját munkát hoz. *Rögzített munka* és *Rögzített egységek* esetén a leglassabb erőforrás dönti el az időtartamot: erőforrásonként a munka osztva a hozzárendelt mennyiséggel, és a legnagyobb eredmény számít.

Egy példa: két erőforrás mindegyikének 32 óra munkája és 1-es hozzárendelt mennyisége van, a tevékenység 4 munkanapig tart. Az első erőforrás hozzárendelt mennyiségét 0,5-re állítja. Az időtartam ekkor 8 munkanap lesz. *Rögzített munka* esetén a második erőforrás megtartja 32 órás munkáját, a hozzárendelt mennyisége 0,5-re csökken. *Rögzített egységek* esetén a második megtartja 1-es hozzárendelt mennyiségét, a munkája 64 órára nő.

### Előrehaladás

Ha a tevékenységnek már van előrehaladása, a tevékenységtípus a hátralévő részen működik: a hátralévő időtartamon és a hátralévő munkán. A *Tulajdonságok* panelen ez a munka a *Munka (ó)* oszlopban van. Ami már kész, az megmarad.

### Óraalapú tevékenységek

Az óraalapú tevékenységet ugyanígy számítja ki az alkalmazás, de percekben. Ha egy 5 órás tevékenységen csak a daru van, az 5 óra munka. *Rögzített munka* esetén 2-es hozzárendelt mennyiségnél az időtartam 2,5 óra lesz. A gyakorlati projekt üreges födém tevékenységén az ácscsapat is dolgozik. Az üreges födémnek továbbra is 5 óra munka kell, ez a leglassabb, így az időtartam 5 óra marad. Hogy az órák és a napok hogyan függnek össze, azt a [Napok és órák](docs://uitleg-dagen-en-uren) cikk magyarázza.

## Kidolgozott példa: a vakolás

A példa az oktatóanyagok gyakorlati projektje, a *House extension*. Az 5. oktatóanyagban Ön maga számítja ki a számokat, és ellenőrzi őket. Itt azt olvassa el, hogy mit tesz minden tevékenységtípus.

A vakolás 4 munkanapig tart. Egy vakoló van hozzárendelve, 1-es hozzárendelt mennyiséggel, a munkanap pedig 8 óra. Így a munka 32 óra.

### Rögzített időtartam és egységek

- Az időtartamot 6 munkanapra állítja: a munka 48 órára nő, a hozzárendelt mennyiség 1 marad.
- A hozzárendelt mennyiséget 2-re állítja: az időtartam 4 munkanap marad, a munka 64 óra lesz.
- A *Munka (ó)* mezőbe 48 órát ír: az időtartam 4 munkanap marad, a hozzárendelt mennyiség 1,5 lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: az időtartam 4 munkanap marad, és ez a második 32 óra munkát hoz, együtt 64 óra.

### Rögzített időtartam és munka

- Az időtartamot 6 munkanapra állítja: a munka 32 óra marad, a hozzárendelt mennyiség 0,67-re csökken.
- A hozzárendelt mennyiséget 2-re állítja: az időtartam 4 munkanap marad. Mivel az időtartam rögzített, a munka 64 órára nő.
- A *Munka (ó)* mezőbe 16 órát ír: az időtartam 4 munkanap marad, a hozzárendelt mennyiség 0,5 lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és a hozzárendelt mennyiség mindkettőnél 0,5 lesz. Az időtartam 4 munkanap marad.

### Rögzített munka

- Az időtartamot 6 munkanapra állítja: a munka 32 óra marad, a hozzárendelt mennyiség 0,67-re csökken.
- A hozzárendelt mennyiséget 2-re állítja: a munka 32 óra marad, az időtartam 2 munkanap lesz. Ez az a lépés, amelyet az 5. oktatóanyagban tesz meg.
- A *Munka (ó)* mezőbe 48 órát ír: a hozzárendelt mennyiség 1 marad, az időtartam 6 munkanap lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és az időtartam 2 munkanap lesz. Ha ezt a második erőforrást eltávolítja, az időtartam ismét 4 munkanap lesz.

### Rögzített egységek

- Az időtartamot 6 munkanapra állítja: a hozzárendelt mennyiség 1 marad, a munka 48 órára nő.
- A hozzárendelt mennyiséget 2-re állítja: a munka 32 óra marad, az időtartam 2 munkanap lesz.
- A *Munka (ó)* mezőbe 48 órát ír: a hozzárendelt mennyiség 1 marad, az időtartam 6 munkanap lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és az időtartam 2 munkanap lesz.

### Amikor az összefüggés nem jön ki

*Rögzített munka* esetén a hozzárendelt mennyiséget 3-ra állítja. A munka 32 óra, ezért az időtartam 32 ÷ (3 × 8) = 1,33 munkanap lesz. Az alkalmazás ezt felfelé kerekíti 2 munkanapra. A munka (32 óra) és a hozzárendelt mennyiség (3) megmarad, de 2 × 3 × 8 a 48 óra. A hisztogram ezért a 32 órát a 2 munkanapra osztja el: naponta 2-es hozzárendelt mennyiséggel, nem 3-assal. A *Munka (ó)* mellett figyelmeztető jel jelenik meg, *Eltér a hozzárendelt mennyiség × időtartam szorzattól* felirattal, hogy ezt jelezze.

Két erőforrással, eltérő hozzárendelt mennyiségekkel, ugyanígy működik. Ha *Rögzített munka* esetén egy második erőforrást ad hozzá, például a *Plasterer 2* erőforrást, 2-es hozzárendelt mennyiséggel az 1-es hozzárendelt mennyiségű vakolóhoz, az alkalmazás a 32 órát 1 : 2 arányban osztja el, azaz 10,7 és 21,3 órára. Mindkettőnek ekkor 1,33 munkanap kell. Az időtartam 2 munkanap lesz.

Egy P6-ból vagy MS Project-ből származó fájl tartalmazhat olyan *Munka (hátr.)* értéket is, amely nem egyenlő a hozzárendelt mennyiség × hátralévő időtartam szorzattal. Ekkor ugyanez a figyelmeztető jel jelenik meg. Az alkalmazás ezt a munkát magától nem módosítja. Ha módosítja egy ilyen tevékenység időtartamát, az alkalmazás a tevékenységtípust követi, akkor is, ha a hátralévő munka a fájlból származik. *Rögzített időtartam és egységek* és *Rögzített egységek* esetén a hátralévő munka a hozzárendelt mennyiség × az új hátralévő időtartam lesz. *Rögzített időtartam és munka* és *Rögzített munka* esetén a munka megmarad, a hozzárendelt mennyiség igazodik. Ha egy fájlból származó hátralévő munka így megszűnik, értesítést kap a régi és az új órák számával. A Ctrl+Z visszaállítja a régi értéket. A figyelmeztető jelnél lévő magyarázat tevékenységenként megmondja, melyik történik.

### Másik naptár

*Rögzített munka* esetén a naptár munkanapja 8 óráról 6 órára változik. A munka 32 óra marad, ezért az időtartam 32 ÷ 6 = 5,33 lesz, felfelé kerekítve 6 munkanap. Hogy az alkalmazás hogyan számolja a munkanapokat és a munkaórákat, azt a [Naptárak és munkanapok](docs://uitleg-kalenders) cikk magyarázza. Az alkalmazás ezt jelzi: *A tevékenységtípus a naptármódosítás után 1 tevékenység időtartamát módosította (a munka megmaradt, a napi órák száma változott).*

### Tevékenység előrehaladással

A belső üregfal-réteg 5 munkanapig tart, és 40%-ban kész: 2 munkanap kész, 3 munkanap (24 óra) van hátra. *Rögzített munka* esetén a hozzárendelt mennyiséget 1-ről 2-re állítja. A hátralévő munka 24 óra marad, a hátralévő időtartam 1,5 lesz, felfelé kerekítve 2 munkanap. A tevékenység most 2 + 2 = 4 munkanapig tart, az előrehaladás 50%. A százalék együtt változik, mert az elkészült rész ugyanaz marad, a hátralévő rész pedig rövidebb lesz.

## Következmények és tévhitek

**„_Rögzített munka_ azt jelenti, hogy az időtartam rögzített.”** Nem, éppen az ellenkezője igaz. *Rögzített időtartam és egységek* és *Rögzített időtartam és munka* esetén az időtartam rögzített. *Rögzített munka* és *Rögzített egységek* esetén az időtartam a másik kettőből következik.

**„Ha kiválasztja a tevékenységtípust, megváltozik az ütemezése.”** Nem. A kiválasztás egy számot sem változtat meg. Csak a következő módosításnál dönti el a tevékenységtípus, mi mozdul együtt. Munkát védő tevékenységtípus esetén az alkalmazás a kiválasztás pillanatában rögzíti a munkát, hogy legyen egy szám, amit meg lehet védeni. Az ilyen tevékenységnek ezután tárolt *Munka (ó)* értéke van.

**„Az időtartam megváltozott, anélkül hogy hozzányúltam volna.”** Ez történhet a hozzárendelt mennyiség, a munka, az erőforrások száma vagy a napi órák módosítása után, *Rögzített munka* vagy *Rögzített egységek* esetén. Az állapotsor ekkor azt jelzi, hogy az ütemezés elavult. Nyomja meg az **Ütemezés-számítás** (F5) parancsot az új dátumok megtekintéséhez.

**Hozzárendelés nélkül a tevékenységtípus nem tesz semmit.** Ekkor nincs hozzárendelt mennyiség és nincs munka, amelyet az időtartamhoz lehetne kötni.

**Az MS Project-ből vagy a Primavera P6-ból származó fájlok mindig megmutatják a tevékenységtípust.** Egy MS Project-ből származó tevékenységnél az alkalmazás néha megtartja a munkamennyiség alapú beállítást. Ez a tárolt beállítás két esetet változtat meg. *Rögzített időtartam és munka* esetén, ha a tevékenység munkamennyiség alapú, a munka mozdul együtt, amikor az időtartamot módosítja, a hozzárendelt mennyiség helyett. *Rögzített egységek* esetén, ha a tevékenység nem munkamennyiség alapú, a munka mozdul együtt, amikor erőforrást ad hozzá vagy távolít el, és az időtartam marad. Az alkalmazásban létrehozott tevékenységeknél nincs ilyen beállítás. Az i ikon mögötti magyarázat figyelembe veszi ezt a beállítást.

## Lásd még

- [Tevékenységtípus kiválasztása](docs://howto-werkregel-kiezen): a lépések, amelyekkel beállítja egy tevékenység tevékenységtípusát.
- [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen): erőforrás hozzárendelése egy tevékenységhez, hozzárendelt mennyiséggel és eloszlással.
- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan váltja át az alkalmazás a napokat és az órákat.
- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan számolja az alkalmazás a munkanapokat és a munkaórákat.
