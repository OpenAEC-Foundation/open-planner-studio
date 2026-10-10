# Munkaszabályok: időtartam, hozzárendelt mennyiség és munka

Egy vakolót rendel a vakoláshoz, és a tevékenység négy napig tart. Ha egy második vakolót is hozzáad, a munka két nap alatt elkészülhet. A tevékenység ugyanígy maradhat négy napos is, de akkor benne kétszer annyi munka van. Mindkettő értelmes. Hogy a kettő közül melyiket választja az alkalmazás, az a tevékenység **munkaszabályától** függ. Ebben a cikkben megismeri, hogyan köti össze az alkalmazás az időtartamot, a hozzárendelt mennyiséget és a munkát, és hogy az egyes munkaszabályok mit tartanak állandónak.

## A fogalom

Három mennyiség függ össze:

- **Időtartam**: mennyi ideig tart a tevékenység, munkanapban vagy órában.
- **Hozzárendelt mennyiség**: mekkora része egy erőforrásnak dolgozik a tevékenységen munkanaponként. Az alkalmazásban ez a neve: *Hozzárendelt mennyiség/nap*. A hozzárendelt mennyiség 1 egy vakolót jelent egész napra, a 2 kettőt, a 0,5 pedig fél napot.
- **Munka**: az összes óra, amennyit az erőforrás a tevékenységen tölt.

Az összefüggés: munka = időtartam × hozzárendelt mennyiség × órák munkanaponként. A munkanaponkénti órák a tevékenység naptárából jönnek. Egy vakolóval, négy munkanapig tartó vakolás 8 órás munkanappal számolva: 4 × 1 × 8 = 32 óra munka.

Ha a három mennyiség egyikét módosítja, a másik kettő közül legalább az egyiknek együtt kell mozdulnia, különben az összefüggés már nem áll fenn. A munkaszabály dönti el, melyik. Tevékenységenként állítja be a *Tulajdonságok* panelen. Az alkalmazás csak akkor mutatja a munkaszabályt és a munkát, ha bekapcsolja őket; hogy ez hogyan működik, azt a [Munkaszabály kiválasztása](docs://howto-werkregel-kiezen) cikk írja le.

A munkaszabály csak normál tevékenységeknél működik. A mérföldköveknek, a fázisoknak (összefoglaló tevékenységek), a hangmatoknak és azoknak a tevékenységeknek, amelyeknél az *Időtartam típusa* értéke *Eltelt időtartam*, nincs munkaszabályuk: a *Munkaszabály* mező ott nincs. Az anyagok sem számítanak, például a beton vagy a vakolóhabarcs. Az anyagmennyiség soha nem határozza meg az időtartamot, és az alkalmazás munkaszabály miatt sem módosítja azt.

## Hogyan számítja ki az alkalmazás

### A szabály a módosításra reagál

Az alkalmazás az időtartamot, a hozzárendelt mennyiséget és a munkát csak abban a pillanatban számítja újra, amikor az egyiket módosítja: a tevékenység időtartamát, egy hozzárendelés hozzárendelt mennyiségét, a munkát, egy erőforrás hozzáadását vagy eltávolítását, vagy a napi órákat egy naptárban. Az **Ütemezés-számítás** (F5) egyiket sem változtatja meg: az F5 csak a dátumokat számítja ki. Egy szabály kiválasztása sem változtat meg egyetlen számot sem. A szabály a következő módosításánál érvényesül.

Ha a munkaszabály megváltoztatja a tevékenység időtartamát, az ütemezés elavulttá válik. Az állapotsor ekkor ezt írja ki: *Elavult — újraszámítsa (F5)*, hacsak nincs bekapcsolva az *Automatikus ütemezés-számítás*.

### Négy szabály

A *Tulajdonságok* panelen a legördülő lista alatt az alkalmazás megmutatja, mit véd a kiválasztott szabály. A négy szabály az alkalmazás saját szövegével:

- **Rögzített időtartam és egységek** (*Védett: időtartam és egységek (a munka követi)*). Ez az alapértelmezett. Az alkalmazás soha nem módosítja maga az időtartamot, a munka az időtartamból és a hozzárendelt mennyiségből következik. Ha beírja a munkát, az alkalmazás a hozzárendelt mennyiséget igazítja, mert az időtartam rögzített.
- **Rögzített időtartam és munka** (*Védett: időtartam és munka (a hozzárendelt mennyiség követi)*). Az alkalmazás soha nem módosítja maga az időtartamot. Ha módosítja az időtartamot, a munka megmarad, és a hozzárendelt mennyiség igazodik.
- **Rögzített munka** (*Védett: munka (az időtartam követi a hozzárendelt mennyiséget)*). A munka rögzített, az időtartam a munkából és a hozzárendelt mennyiségből következik.
- **Rögzített egységek** (*Védett: hozzárendelt mennyiség (az időtartam követi a munkát)*). A hozzárendelt mennyiség rögzített, az időtartam a munkából következik.

Két szabály tehát az időtartamot érintetlenül hagyja. A másik kettőnél az időtartam együtt mozdul, ha módosítja a hozzárendelt mennyiséget, a munkát vagy az erőforrások számát. Egy erőforrás esetén a Rögzített munka és a Rögzített egységek ugyanazt teszi. Akkor térnek el egymástól, ha maga módosítja az időtartamot: Rögzített munka esetén a munka megmarad, és a hozzárendelt mennyiség igazodik; Rögzített egységek esetén a hozzárendelt mennyiség marad, és a munka együtt nő. Akkor is eltérnek, ha a tevékenységen több erőforrás van (lásd lent).

Az alábbi kidolgozott példák megmutatják, mit tesz mindegyik szabály.

### Kerekítés

Az összefüggésből következő időtartamot az alkalmazás felfelé kerekíti: napokban megadott tevékenységnél egész munkanapokra, órákban megadott tevékenységnél egész percekre. A munka és a hozzárendelt mennyiség azt tartja meg, amit megadott, vagy amit az alkalmazás az összefüggésből kapott. Emiatt az összefüggés néha nem áll fenn pontosan. Az alábbi példa megmutatja, mi történik ilyenkor.

### Több erőforrás

Ha egy tevékenységen több erőforrás van, két szabály érvényesül. Rögzített időtartam és munka, Rögzített munka és Rögzített egységek esetén a teljes munka ugyanannyi marad, amikor erőforrást ad hozzá vagy távolít el. Az alkalmazás ezt ekkor a hozzárendelt mennyiségek arányában osztja el. Rögzített időtartam és egységek esetén egy új erőforrás helyette saját munkát hoz. Rögzített munka és Rögzített egységek esetén a leglassabb erőforrás dönti el az időtartamot: erőforrásonként a munka osztva a hozzárendelt mennyiséggel, és a legnagyobb eredmény számít.

Egy példa: két erőforrásnak van 32 óra munkája és 1-es hozzárendelt mennyisége, együtt 4 munkanapig tart. Az első erőforrás hozzárendelt mennyiségét 0,5-re állítja. Az időtartam ekkor 8 munkanap lesz. Rögzített munka esetén a második erőforrás megtartja 32 óra munkáját, a hozzárendelt mennyisége 0,5-re csökken. Rögzített egységek esetén a második megtartja 1-es hozzárendelt mennyiségét, a munkája pedig 64 órára nő.

### Előrehaladás

Ha a tevékenységnek már van előrehaladása, a szabály a hátralévő részen működik: a hátralévő időtartamon és a hátralévő munkán. Az alkalmazásban a munka neve: *Munka (hátr.)*. Ami már kész, az megmarad.

### Óraalapú tevékenységek

Az alkalmazás az óraalapú tevékenységet ugyanígy számítja, de percekben. Ha egy 5 órás tevékenységen csak a daru van, az 5 óra munka. Rögzített munka esetén 2-es hozzárendelt mennyiségnél az időtartam 2,5 óra lesz. A gyakorlati projekt üreges födém tevékenységén az ácscsapat is dolgozik. Az üreges födémnek továbbra is 5 óra munka kell, ez a leglassabb, így az időtartam 5 óra marad. Hogy az órák és a napok hogyan függnek össze, azt a [Napok és órák](docs://uitleg-dagen-en-uren) cikk magyarázza.

## Kidolgozott példa: a vakolás

A példa az oktatóanyagok gyakorlati projektje, a *House extension*. Az 5. oktatóanyagban kiszámítja a számokat és ellenőrzi őket. Itt azt olvassa el, hogy mit tesz minden szabály.

A vakolás 4 munkanapig tart. Egy vakoló van hozzárendelve, 1-es hozzárendelt mennyiséggel, a munkanap pedig 8 óra. Így a munka 32 óra.

### Rögzített időtartam és egységek

- Az időtartamot 6 munkanapra állítja: a munka 48 órára nő, a hozzárendelt mennyiség 1 marad.
- A hozzárendelt mennyiséget 2-re állítja: az időtartam 4 munkanap marad, a munka 64 óra lesz.
- A *Munka (hátr.)* mezőbe 48 órát ír: az időtartam 4 munkanap marad, a hozzárendelt mennyiség 1,5 lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: az időtartam 4 munkanap marad, és ez a második 32 óra munkát hoz, együtt 64 óra.

### Rögzített időtartam és munka

- Az időtartamot 6 munkanapra állítja: a munka 32 óra marad, a hozzárendelt mennyiség 0.67-re csökken.
- A hozzárendelt mennyiséget 2-re állítja: az időtartam 4 munkanap marad. Mivel az időtartam rögzített, a munka 64 órára nő.
- A *Munka (hátr.)* mezőbe 16 órát ír: az időtartam 4 munkanap marad, a hozzárendelt mennyiség 0,5 lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és a hozzárendelt mennyiség mindkettőnél 0,5 lesz. Az időtartam 4 munkanap marad.

### Rögzített munka

- Az időtartamot 6 munkanapra állítja: a munka 32 óra marad, a hozzárendelt mennyiség 0.67-re csökken.
- A hozzárendelt mennyiséget 2-re állítja: a munka 32 óra marad, az időtartam 2 munkanap lesz. Ez az a lépés, amelyet az 5. oktatóanyagban tesz meg.
- A *Munka (hátr.)* mezőbe 48 órát ír: a hozzárendelt mennyiség 1 marad, az időtartam 6 munkanap lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és az időtartam 2 munkanap lesz. Ha ezt a második erőforrást újra eltávolítja, az időtartam ismét 4 munkanap lesz.

### Rögzített egységek

- Az időtartamot 6 munkanapra állítja: a hozzárendelt mennyiség 1 marad, a munka 48 órára nő.
- A hozzárendelt mennyiséget 2-re állítja: a munka 32 óra marad, az időtartam 2 munkanap lesz.
- A *Munka (hátr.)* mezőbe 48 órát ír: a hozzárendelt mennyiség 1 marad, az időtartam 6 munkanap lesz.
- Egy második erőforrást rendel hozzá, például a *Plasterer 2* erőforrást, 1-es hozzárendelt mennyiséggel: a 32 órát elosztja, mindkettőnek 16 óra jut, és az időtartam 2 munkanap lesz.

### Amikor az összefüggés nem jön ki

Rögzített munka esetén a hozzárendelt mennyiséget 3-ra állítja. A munka 32 óra, ezért az időtartam 32 ÷ (3 × 8) = 1,33 munkanap lesz. Az alkalmazás ezt felfelé kerekíti 2 munkanapra. A munka (32 óra) és a hozzárendelt mennyiség (3) megmarad, de 2 × 3 × 8 egyenlő 48 órával. A hisztogram ezért a 32 órát a 2 munkanapra osztja el: naponta 2-es hozzárendelt mennyiséggel, nem 3-assal. A *Munka (hátr.)* mellett figyelmeztető jel jelenik meg, *Eltér a hozzárendelt mennyiség × időtartam szorzattól* felirattal, hogy ezt jelezze.

Két erőforrással, eltérő hozzárendelt mennyiségekkel ugyanígy működik. Ha Rögzített munka esetén egy második erőforrást ad hozzá, például a *Plasterer 2* erőforrást, 2-es hozzárendelt mennyiséggel az 1-es hozzárendelt mennyiségű vakolóhoz, az alkalmazás a 32 órát 1 : 2 arányban osztja el, azaz 10,7 és 21,3 órára. Mindkettőnek ekkor 1,33 munkanap kell. Az időtartam 2 munkanap lesz.

### Másik naptár

Rögzített munka esetén a naptár munkanapja 8 óráról 6 órára változik. A munka 32 óra marad, ezért az időtartam 32 ÷ 6 = 5,33 lesz, felfelé kerekítve 6 munkanap. Hogy az alkalmazás hogyan számolja a munkanapokat és a munkaórákat, azt a [Naptárak és munkanapok](docs://uitleg-kalenders) cikk magyarázza. Az alkalmazás ezt jelzi: *A munkaszabály a naptármódosítás után 1 tevékenység időtartamát módosította (a munka megmaradt, a napi órák száma változott).*

### Előrehaladással rendelkező tevékenység

A belső üregfal-réteg 5 munkanapig tart, és 40%-ban kész: 2 munkanap kész, 3 munkanap (24 óra) van hátra. Rögzített munka esetén a hozzárendelt mennyiséget 1-ről 2-re állítja. A hátralévő munka 24 óra marad, a hátralévő időtartam 1,5 lesz, felfelé kerekítve 2 munkanap. A tevékenység most 2 + 2 = 4 munkanapig tart, az előrehaladás 50%. A százalék együtt változik, mert az elkészült rész ugyanaz marad, a hátralévő rész pedig rövidebb lesz.

## Következmények és tévhitek

**„Rögzített munka azt jelenti, hogy az időtartam rögzített.”** Nem, éppen az ellenkezője igaz. Rögzített időtartam és egységek, valamint Rögzített időtartam és munka esetén az időtartam rögzített. Rögzített munka és Rögzített egységek esetén az időtartam a másik kettőből következik.

**„Ha kiválasztja a szabályt, megváltozik az ütemezése.”** Nem. A kiválasztás egy számot sem változtat meg. Csak a következő módosításnál dönti el a szabály, mi mozdul együtt. Munkát védő szabály esetén az alkalmazás a kiválasztás pillanatában rögzíti a munkát, hogy legyen egy szám, amit meg lehet védeni. Az ilyen tevékenységnek ezután tárolt *Munka (hátr.)* értéke van.

**„Az időtartam megváltozott, anélkül hogy hozzányúltam volna.”** Ez történhet a hozzárendelt mennyiség, a munka, az erőforrások száma vagy a napi órák módosítása után, Rögzített munka vagy Rögzített egységek esetén. Az állapotsor ekkor azt jelzi, hogy az ütemezés elavult. Nyomja meg az **Ütemezés-számítás** (F5) parancsot az új dátumok megtekintéséhez.

**Hozzárendelés nélkül a munkaszabály nem tesz semmit.** Ekkor nincs hozzárendelt mennyiség és nincs munka, amelyet az időtartamhoz lehetne kötni.

**Az MS Project-ből vagy a Primavera P6-ból származó fájlok mindig megmutatják a munkaszabályt.** Egy MS Project-tevékenységnél a szabály alatt néha megjelenik ez a szöveg: *MS Project-ből: munkamennyiség alapú* vagy *MS Project-ből: nem munkamennyiség alapú*. Ez a tárolt beállítás két esetet változtat meg. Rögzített időtartam és munka esetén, munkamennyiség alapú beállításnál a munka az időtartam módosításakor mozdul együtt, a hozzárendelt mennyiség helyett. Rögzített egységek esetén, ha nem munkamennyiség alapú, a munka erőforrás hozzáadásakor vagy eltávolításakor mozdul együtt, az időtartam pedig marad. Az alkalmazásban létrehozott tevékenységeknél nincs ilyen beállítás.

## Lásd még

- [Munkaszabály kiválasztása](docs://howto-werkregel-kiezen): a lépések, amelyekkel beállítja egy tevékenység munkaszabályát.
- [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen): erőforrás hozzárendelése egy tevékenységhez, hozzárendelt mennyiséggel és eloszlással.
- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan váltja át az alkalmazás a napokat és az órákat.
- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan számolja az alkalmazás a munkanapokat és a munkaórákat.
