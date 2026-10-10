# Az erőforrástár

A kőművescsapata nem csak egy projekten dolgozik. Ma az északi házakon dolgozik, holnap a déli garázsokon. Az erőforrástár az a hely, ahol egyszer rögzíti az ilyen csapatot, hogy minden projekt ugyanazt a csapatot használja. Az alkalmazás ezután azt is látja, ha két projekt ugyanarra a napra kéri ugyanazokat az embereket. Ezt egyetlen projekt sem látja. Ebben a cikkben megtudja, hogyan függ össze az erőforrástár és a projekt, és hogyan számolja az alkalmazás a foglaltságot a projektek között.

## Az alapgondolat

Két réteg van.

Az **erőforrástár** a szervezetéhez tartozó erőforrások és naptárak listája: egy kőműves, egy daru, egy vakolómunkás, a típusukkal, az alapdíjukkal és a darabszámukkal. A lista maga, amelyet az alkalmazás „pool” néven is nevez, nem a projektfájljaiban van, hanem az alkalmazásban: az asztali alkalmazásban egy fájlban ezen a számítógépen, a böngészőben pedig annak a böngészőnek a tárolójában. Ha törli a webhely adatait a böngészőben, az erőforrástár elvész, ezért exportálja biztonsági másolatként. Mindig van legalább egy erőforrástár. Az első neve *Mijn resourcebibliotheek* (holland név), és át lehet nevezni.

A **projekt** dönti el, mennyit használ egy erőforrásból, és mikor. Egy projekt egy erőforrástárhoz kapcsolódik, vagy önállóan áll. Egy önálló projekt jól működik, csak nincs közös lista.

Egy projekt nem hivatkozik az erőforrástárra, hanem **másolatot** tart. Ha a *Bricklayer* erőforrást az erőforrástárból egy projekthez rendeli, az alkalmazás készít egy másolatot a projektben, egy **eredetjelöléssel**. Ez a megjegyzés azt mondja, hogy a másolat az X erőforrástárból származik, és ott az Y elem. Az erőforrás-táblázatban egy kis erőforrástár-ikon jelzi az ilyen másolatot. A másolat egy szokványos erőforrás: tevékenységek rendelhetők hozzá, és maga a projektfájlban tárolódik.

Az erőforrástár naptárai mást jelentenek, mint a projekt naptárjainak listája, amelyet a naptárablakban kezel. Egy erőforrástár-naptár azzal az erőforrással kerül a projektbe, amely használja.

## Hogyan működik vele az alkalmazás

### Mit dönt el az erőforrástár, és mit a projekt

Az erőforrástár határozza meg, hogy **mi** egy erőforrás: a nevet, a típust, az óránkénti alapdíjat, a mértékegységet és a leírást. A projektmásolatokban ezek a mezők egyszerű szövegként jelennek meg. Ezeket az erőforrástárban szerkeszti, hogy mindenhol helyesek legyenek. Ha a másolat mégis más úton akar járni, szüntesse meg a kapcsolatot az erőforrástárral.

A projekt dönti el, **mennyit** és **mikor**: a *Maximális mennyiség*, az idő szerint változó kapacitás (*Időszakonkénti kapacitás*), és az, hogy melyik naptár tartozik az erőforráshoz. Ezek a mezők a projektben szerkeszthetők maradnak, és nem számítanak eltérésnek az erőforrástártól. Ugyanaz a csapat ugyanis egy sürgős munkán más naptárral dolgozhat, mint egy szokásos projekten. A naptár tartalma, amely az erőforrással együtt került a projektbe, viszont követi az erőforrástárat.

### Mikor követ egy másolat

Az erőforrástár nem frissíti folyamatosan a másolatokat, hanem rögzített pillanatokban.

- Ha az erőforrástárban szerkeszt valamit, a nem szerkesztett másolatok minden megnyitott projektben azonnal követik.
- Ha megnyit egy projektet, vagy másik fülre vált, az alkalmazás összehasonlítja a másolatokat az erőforrástárral. Ha egy nem szerkesztett másolat le van maradva, az alkalmazás csendben frissíti, és röviden jelzi: *1 elem frissült az erőforrástárból* vagy *N elem frissült az erőforrástárból*.

Az alkalmazás megjegyzi az értékeket abból a pillanatból, amikor a másolat készült vagy frissült. Ha egy másolat most eltér ezektől, az alkalmazás nem dönti el, melyik a helyes. A másolat ekkor az *eltér — döntsön* jelölést kapja. Ha olyan fájlt nyit meg, amelyben van ilyen másolat, az *Erőforrástár összekapcsolása* ablak magától megnyílik. Ott elemenként Ön választja ki, hogy az erőforrástár értékei érvényesek-e, vagy a fájljából származó értékek kerülnek az erőforrástárba. Fülváltáskor soha nem jelenik meg ablak.

Eltérés keletkezik például akkor, ha a projektben egy saját erőforrást a *Felvétel az erőforrástárba* lehetőséggel egy azonos nevű, de más értékeket tartalmazó erőforrástár-elemhez köt. Az alkalmazás tényleg összekapcsolja őket, és a másolatot azonnal eltérőnek jelöli.

### Mi történik, ha egy erőforrás kikerül az erőforrástárból

Ha töröl egy erőforrást az erőforrástárból, a másolat a projektekben megmarad, és tovább működik. Megkapja a *már nincs az erőforrástárban* jelölést. Ezután teljesen szerkesztheti, vagy eltávolíthatja a projektből.

### Foglaltság a projektek között

A hisztogram és a túlterhelés egy projektben csak azt a projektet nézi. Az erőforrástár többet tud: hány darab az erőforrásból összesen van. A *Foglaltság* nézet naponként összeadja a terhelést minden megnyitott projektből, amely ugyanahhoz az erőforrástárhoz kapcsolódik, és onnan másolatot használ az erőforrásból. Ha az összeg egy napon nagyobb az erőforrástár kapacitásánál, az a nap túlterhelésként számít.

Három szabály dönti el, mi számít:

- A kapacitás az erőforrástárból jön (az erőforrástár-elem *Maximális mennyiség* értéke, vagy az adott napra érvényes *Időszakonkénti kapacitás*), nem a projektmásolat *Maximális mennyiség* értékéből. Két projekt, amelyek mindegyike a saját keretén belül marad, együtt így is többet kérhet a kelleténél.
- Egy összeg, amely pontosan egyenlő a kapacitással, nem ütközés. Többet kell kérni a kapacitásnál.
- Csak az eredetjelöléssel rendelkező másolatok számítanak, és csak azokban a projektekben, amelyek abban a pillanatban meg vannak nyitva ebben az alkalmazásban. Egy projekt saját erőforrása, amely nincs az erőforrástárban, ezért nem számít bele. Az áttekintés nem látja azokat a dokumentumokat, amelyeket nem nyitottak meg ebben az alkalmazásban; ezt az áttekintés alján maga is írja.

## Kidolgozott példa: a kőművescsapat két projektben

Az erőforrástárban van a *Bricklayer* erőforrás, *Maximális mennyiség* 3 értékkel: három kőműves van a bérlistán. Két projekt használja, mindkettő másolattal, amelynek *Maximális mennyiség* értéke 2.

- A *Houses North* projektben a *Bricklaying facades* tevékenység 5 munkanap, 2027. június 7., hétfőtől kezdve, napi 2 hozzárendelt mennyiséggel. A tevékenység június 7-től 11-ig tart, a végpontokat is beleszámítva.
- A *Garages South* projektben a *Bricklaying garages* tevékenység 4 munkanap, 2027. június 9., szerdától kezdve, napi 2 hozzárendelt mennyiséggel. A hétvége nem számít bele, ezért a tevékenység június 9., 10., 11. és 14. napját fedi le.

Minden projektben a kőművestől a 2 hozzárendelt mennyiségéből mind a 2-t kérik. Egyik projekt sem jelent túlterhelést: az *Erőforrások › Túlterhelés* útvonalon mindkettő *Nincs* értéket mutat. Mégis együtt meghaladják a 3 kőművest. Naponta az alkalmazás így számol:

- Június 7. (hétfő) és június 8. (kedd): 2 (csak *Houses North*)
- Június 9. (szerda), 10. (csütörtök) és 11. (péntek): 2 + 2 = 4
- Június 14. (hétfő): 2 (csak *Garages South*)

A csúcs 4, a kapacitás 3. Az áttekintés a *Bricklayer* erőforrást *2 dokumentum* jelzéssel mutatja, az időszak *2027-06-07 – 2027-06-14*, a csúcsot és a kapacitást *4.0 / 3.0* formában, és *3 nap túlterhelt* sorral: június 9., 10. és 11.

Mi történik, ha változtat valamit:

- Ha a *Bricklaying facades* 6 munkanapig tart, június 14., hétfőig fut. Ezen a napon is 2 + 2 = 4 az összeg, ezért az áttekintés *4 nap túlterhelt* jelzést mutat: június 9., 10., 11. és 14. A csúcs továbbra is 4.
- Ha az erőforrástárban a *Maximális mennyiség* 4, az áttekintés *4.0 / 4.0* értéket mutat, és nincs ütközés, mert az összeg nem nagyobb a kapacitásnál.
- Ha a *Garages South* napi 2 helyett 1 hozzárendelt mennyiséggel dolgozik, a csúcs 3, és az áttekintés *3.0 / 3.0* értéket mutat: nincs ütközés.
- Ha a *Garages South* csak június 14., hétfőn kezd, a projektek nem fedik egymást. Az időszak *2027-06-07 – 2027-06-17* lesz, a csúcs pedig *2.0 / 3.0*.

A lépéseket, amelyekkel a saját projektjeiben ezt megnézheti, a következő cikk írja le: [A foglaltság áttekintésének használata](docs://howto-bezettingsoverzicht-gebruiken).

## Következmények és félreértések

**„Az erőforrástárat megosztom a kollégáimmal.”** Nem. Az erőforrástár az alkalmazásban van (az asztali alkalmazásban egy fájlban ezen a számítógépen, a böngészőben annak a böngészőnek a tárolójában), és nincs szinkronizálva. Ha két tervező ugyanazzal az erőforrástárral dolgozik, az erőforrástáraik eltérhetnek. Megosztani exportálással és importálással lehet. A részleteket itt találja: [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren). Ha a szervezete üzemeltető cégei között oszt meg csapatokat, tudatosan válasszon egy közös erőforrástárat. Az áttekintés csak azokat a projekteket látja, amelyek ebben az alkalmazásban nyitva vannak.

**„Ha megváltoztatom az erőforrástárat, minden megváltozik a projektjeimben.”** Csak az erőforrás azonossága változik: a név, a típus, az alapdíj, a mértékegység és a leírás. A projekt *Maximális mennyiség* értéke, az idő szerinti kapacitás és a naptárválasztás marad, ahogy volt.

**„Az erőforrástár-változtatást visszavonhatom.”** Nem. Az erőforrástár az alkalmazáshoz tartozik, nem egy projekthez, ezért a változtatások kívül esnek a *Visszavonás* (Ctrl+Z) funkción. Az *Erőforrástár* nézet ezt maga is jelzi: *Ez az erőforrástárat szerkeszti, és az összes projektre hat — ez nem vonható vissza.* Az erőforrástárból való törlésnél az alkalmazás is megerősítést kér, és a törlés nem vonható vissza.

**„Az áttekintés megoldja a túlterhelést.”** Nem, az áttekintés csak egy csak megtekinthető nézet. Azt mutatja, mely napokon kér két projekt együtt túl sokat. A kiegyenlítés (*Erőforrások › Kiegyenlítés › Kiegyenlítés…*, erről bővebben: [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren)) egy projekt erőforrásait nézi, és nem veszi figyelembe a többi projektet. Mozgassa egy tevékenységet az egyik projektben maga, vagy változtassa meg a kapacitást az erőforrástárban, ha valaki valóban csatlakozik.

**„A saját erőforrásom beleszámít a foglaltságba.”** Csak akkor, ha az erőforrástárban van. Egy erőforrás, amelyet csak a projektben hozott létre, például egy egyetlen munkához bérelt daru, nem kap eredetjelölést, ezért nincs benne az áttekintésben. A *Felvétel az erőforrástárba* lehetőséggel hozzáadhatja.

## Lásd még

- [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken): összekapcsolás, erőforrások hozzárendelése és eltérések megoldása.
- [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren): erőforrástárak létrehozása, exportálása és importálása.
- [A foglaltság áttekintésének használata](docs://howto-bezettingsoverzicht-gebruiken): több projekt közötti túlterhelések megtalálása.
- [Erőforrások kezelése](docs://howto-resources-beheren): egyetlen projekt erőforrásai.
