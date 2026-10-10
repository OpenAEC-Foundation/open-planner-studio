# Jelentéstípusok

Minden jelentés a *Jelentés* lapon található, a hozzá tartozó beállításokkal: mit tesznek, mi a kezdeti értékük, mi változik a jelentésben, és hol találja őket. A jelentés készítését és PDF-ként mentését itt olvashatja: [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken).

## Hogyan működik a jelentésablak

Nyissa meg a *Jelentés* lapot (vagy nyomja meg a Ctrl+P billentyűkombinációt). Bal oldalon a *Jelentés* oszlop található. Ebben van a legördülő *Jelentés típusa* lista, az *Áttekintés* blokk a darabszámokkal, a *Beállítások* vagy *Jelentésbeállítások* blokk, alul pedig a *PDF exportálás* gomb. Jobb oldalon látható az előnézet. Amit az előnézetben lát, az kerül a PDF-be.

**Jelentés típusa** — a jelentés, amelyet lát. Válasszon a tizenegy jelentés közül. Alapértelmezett: *Gantt-nyomtatvány*. Hol: a *Jelentés* oszlop tetején.

**PDF exportálás** — PDF-fájlt készít. Hatás: az eredmény csak egy PDF-fájl; az alkalmazás nem küld semmit nyomtatóra. Ha az ütemezés nincs naprakész, az alkalmazás előbb kiszámítja. Ha a számítás hibát ad, például a kapcsolatokban lévő hurok miatt, a gomb nem készít fájlt, hanem megjeleníti a hibát. Hol: a *Jelentés* oszlop alján.

**Megjegyezve.** Az alkalmazás az összes jelentésbeállítást ezen az eszközön tárolja, minden projekthez. Ezek nem tartoznak a projektfájlhoz. Csak a Gantt-nyomtatvány *Cég:* mezője nem marad meg.

**Aktuális ütemezés.** A jelentések az utolsó számítás eredményét használják. Ha az ütemezés azóta módosult, a táblázatos jelentések tetején ez látszik: *Az ütemezés az utolsó számítás óta módosult. Nyomja meg a Számítás (F5) gombot az aktuális értékekhez.* Ha még nem volt számítás, ez látszik: *Még nincs kiszámítva. Nyomja meg a Számítás (F5) gombot a dátumokhoz és a tartalékidőhöz.* Ha a projekt a *Rögzített dátumok* nézetben van, a jelentések a forrásfájl dátumait mutatják, és egy üzenet ezt jelzi.

**Rövidítések.** A *wd* a munkanapot jelenti. A *TF* a teljes tartalékidő, az *FF* a szabad tartalékidő.

## Papírméret és tájolás

**Papír:** — a PDF papírmérete. Válasszon az A4, A3, A2 és A1 közül. Alapértelmezett: A3. Hatás: az oldalak ehhez a mérethez igazodnak. Minden jelentéshez egy választás van: amit egy jelentésnél választ, a többinél is érvényben marad. Álló A4-en egy széles táblázat kicsi lesz, mert a táblázat az oldal szélességéhez igazodik. Hol: a *Beállítások* (Gantt-nyomtatvány és Erőforrás-diagram) vagy a *Jelentésbeállítások* (a hét táblázatos jelentés) alatt. A Mérföldkövek áttekintése és az Eltérés nem mutat választási lehetőséget.

**Tájolás:** — fekvő vagy álló. Válasszon a *Fekvő* és az *Álló* közül. Alapértelmezett: *Fekvő*. Hatás: ugyanaz, mint a *Papír:* esetén. Hol: ugyanott, mint a *Papír:*.

## Gantt-nyomtatvány

Az ütemezés sáv-diagramként: balra egy táblázat, jobbra egy idővonal, szükség esetén több oldalon. Az előnézet a papírt mutatja, oldalfejléccel, táblázattal, idővonallal és jelmagyarázattal. Az *Áttekintés* blokk ezeket számolja: *Tevékenységek:*, *Alsó szintű tevékenységek:*, *Kritikus:* és *Kapcsolatok:*. Minden beállítás a *Beállítások* alatt található.

**Cég:** — a cég az oldalfejlécben. Alapértelmezett: a cég a projektinfóból. Hatás: csak a jelentés fejlécét érinti; amit itt beír, nem marad meg. A céget a *Beállítások › Projekt › Projektinfó* menüpontban módosíthatja, a *Megrendelő/szervezet* mezőben, majd az *Alkalmazás* gombbal erősítse meg.

**Szerző:** — a szerző az oldalfejlécben. Csak olvasható: az alkalmazás a projektinfóból veszi.

**Betűméret:** — a szöveg és a táblázat mérete a jelentésben. Válasszon a 90%, 100%, 110% és 125% közül. Alapértelmezett: 100%. Hatás: nagyobb betűnél a szöveg, a sorok és a táblázat nőnek, az idővonal szélessége csökken. Nem függ a beállítások *Betűméret* értékétől.

**Sávszínek:** — attól függ, mi határozza meg a sáv színét. Válasszon a *Kritikus út*, a *Tevékenységenként — automatikus* és a *Kategória szerint* közül; a *Kategória szerint* beállításhoz a *Kategóriamező* legördülő listában válasszon mezőt. Alapértelmezett: *Kritikus út*. Hatás: ez ugyanaz a választás, mint a *Nézet* lap *Sávszínek* beállítása: ha itt módosítja, a képernyőn látható Gantt is változik. Ha a kiválasztott mező nincs ebben a projektben, a következő üzenet jelenik meg: *Ez a mező nincs ebben a projektben. Ideiglenesen a tevékenységtípus használatos.*

**Állapotvonal:** — egy vonal az állapotdátumnál. Válasszon a *Nincs*, az *Állapotdátum-vonal* és az *Előrehaladási vonal* közül. Alapértelmezett: *Nincs*. Hatás: az *Állapotdátum-vonal* egy vonalat húz az állapotdátumnál; az *Előrehaladási vonal* cikkcakkos vonalat rajzol, amely minden tevékenység előrehaladásának megfelelően kitér. Ha a projektnek nincs állapotdátuma, a következő üzenet jelenik meg: *Állítsa be először az állapotdátumot.* A jelentés ilyenkor nem rajzol semmit.

**Nézet követése (szűrő, csoportosítás, rendezés)** — csak a Gantt-nyomtatványnál. Alapértelmezett: ki. Hatás: ki állapotban a teljes tevékenységfa kerül a papírra. Be állapotban pontosan a képernyő sorai kerülnek rá: a szűrővel, csoportosítással, rendezéssel és összecsukott szakaszokkal.

**Automatikus illesztés papírra** — az idővonal méretezése az oldal szélességére. Alapértelmezett: be. Hatás: be állapotban az idővonal az oldal szélességéhez igazodik; az oldalak száma a magasságtól függ. Ki állapotban a rögzített méretarány lesz érvényes (*Nagyítás:*), és az idővonal a szélességben is több oldalra oszlik, ami gyorsan sok oldalt ad.

**Nagyítás:** — az idővonal rögzített méretaránya. Csak akkor látszik, ha az *Automatikus illesztés papírra* ki van kapcsolva. Csúszka 1-től 40-ig. Alapértelmezett: 22. Hatás: nagyobb érték szélesebb idővonalat ad, így egymás mellett több oldal lesz.

**Idővonal több oldalon:** — az idővonal több oldalszélességre oszlik. Választás 1-től 8 oldalig. Alapértelmezett: 1 oldal. Hatás: csak az *Automatikus illesztés papírra* beállítással működik; különben a választás nem használható, és a következő üzenet jelenik meg: *Csak automatikus illesztés esetén.* Hasznos hosszú ütemezésnél, ha olvasható méretben szeretné nyomtatni.

**Fejléc ismétlése minden oldalon** — Alapértelmezett: be. Hatás: be állapotban az oldalfejléc minden oldalon megjelenik; ki állapotban csak az elsőn.

**Lábléc ismétlése minden oldalon** — Alapértelmezett: be. Hatás: be állapotban a lábléc (projektnév, nyomtatás dátuma és jelmagyarázat) minden oldalon megjelenik; ki állapotban csak az utolsón. Jelmagyarázat nélkül a nyomtatott példány olvashatatlan, ezért van bekapcsolva.

**Tevékenységnevek a sávokon** — Alapértelmezett: be. Hatás: a tevékenység neve a sávon jelenik meg, ahol van hely.

**Elkészültség megjelenítése** — Alapértelmezett: be. Hatás: a sáv sötétebb része mutatja a tevékenység előrehaladását, és a táblázatban megjelenik az *Elk* oszlop.

**Tevékenységnevek csonkítása** — Alapértelmezett: be. Hatás: be állapotban a nevek a táblázatban a *Névoszlop:* szélességénél vágódnak le. Ki állapotban az oszlop a leghosszabb névig nő, és a következő üzenet jelenik meg: *A névoszlop a leghosszabb tevékenységnévhez igazodik.*

**Névoszlop:** — a névoszlop szélessége. Csak akkor látszik, ha a *Tevékenységnevek csonkítása* be van kapcsolva. Csúszka 60-tól 400-ig. Alapértelmezett: 130.

**Alaptervi réteg megjelenítése** — az aktív alapterv a sávok mellett. Alapértelmezett: ki. Hatás: egy vékony sáv az alapterv színében a tevékenységsáv alatt, csak azoknál a tevékenységeknél, amelyek benne vannak az alaptervben.

**Kritikus út** — Alapértelmezett: be. Hatás: csak a két kritikus tevékenység közötti piros kapcsolatvonalakat és a jelmagyarázat sorát szabályozza. A sávok maguk a *Sávszínek:* beállítást követik, függetlenül ettől a jelölőnégyzettől.

**Tartalékidő megjelenítése** — Alapértelmezett: be. Hatás: a tartalékidő háttérsávként jelenik meg a nem kritikus sávok mögött.

**Kapcsolatok** — a kapcsolatvonalak. Alapértelmezett: be. Hatás: nyilakat rajzol a sávok közé.

**Csak munkanapok megjelenítése** — ebben a jelentésben tömöríti az idővonal tengelyét. Alapértelmezett: ki. Hatás: a hétvégék és az ünnepnapok kimaradnak, a heti háttérsávok pedig a hétvégi árnyékolás helyébe lépnek. Nem függ a képernyőn látható Gantt ugyanezen beállításától.

**Hétvégék** — Alapértelmezett: be. Hatás: árnyékolja a hétvégéket és az ünnepnapokat az idővonalon, amíg a méretarány megkülönbözteti a napokat. A tömörített tengelyen (*Csak munkanapok megjelenítése*) ez a jelölőnégyzet nem hat.

**Jelmagyarázat** — Alapértelmezett: be. Hatás: a jelmagyarázat a láblécben.

**Előnézet minősége** — mennyire éles az előnézet. Válasszon a *Normál*, a *Magas* és a *Maximális* közül. Alapértelmezett: *Magas*. Hatás: csak a képernyőn látható előnézet élessége változik; a PDF nem változik. Hol: a *Jelentés* lapon, az előnézet felett.

## Erőforrás-diagram

Ugyanazok a sávok, mint a Gantt-nyomtatványnál, erőforrásonként csoportosítva: ki mit csinál és mikor. Az *Áttekintés* blokk ezeket számolja: *Erőforrások:*, *Hozzárendelések:* és *Erőforrás nélkül:* (időszakkal együtt az *Az időszakon kívül:* is). A diagram a Gantt-nyomtatvány összes beállítását használja, kivéve a *Nézet követése (szűrő, csoportosítás, rendezés)*, a *Kritikus út* és a *Kapcsolatok* beállítást: a sorok nem a képernyőről jönnek, egy tevékenység több erőforrás alatt is megjelenhet, és a kapcsolatok nem jelennek meg. A *Kritikus út* jelölőnégyzet rejtve van, és be van kapcsolva. Ezek a beállítások a *Beállítások* alatt találhatók, ezzel a négy jelölőnégyzettel és az időszakkal:

**Minden erőforrás új oldalon** — Alapértelmezett: ki. Hatás: minden erőforrás új oldalon kezdődik, így minden csapathoz vagy munkatárshoz külön oldalt adhat ki. Ki állapotban egy folytonos dokumentum lesz.

**Erőforrás nélküli tevékenységek felvétele** — Alapértelmezett: ki. Hatás: az erőforrás nélküli tevékenységek a diagram utolsó sávjaként jelennek meg, hogy lássa, mi van még senkinél.

**Csoportosítás erőforrástípus szerint** — Alapértelmezett: ki. Hatás: egy plusz réteg a tetején: először erőforrástípusonként egy sáv (munkaerő, csapat, alvállalkozó, gép, anyag), azon belül erőforrásonként.

**Mennyiség/nap és eloszlásgörbe megjelenítése** — Alapértelmezett: be. Hatás: két oszlop a tevékenység neve után, az adott sáv erőforrásának napi hozzárendelt mennyiségével és eloszlásgörbéjével. Ha az idővonalnak túl kevés hely jut, a jelentés kihagyja az oszlopokat, és a következő üzenet jelenik meg: *A Mennyiség/nap és az eloszlásgörbe oszlopok kimaradtak: …* Több hely nagyobb papírméretből vagy fekvő tájolásból, kisebb betűméretből vagy keskenyebb táblázatból lesz.

**Jelentési időszak:** — csak azok a tevékenységek, amelyek érintik az időszakot. Alapértelmezett: *Projekt időtartama*. Hatás: az időtengely pontosan az időszakon fut. Ha az időszakban nincs semmi, a következő üzenet jelenik meg: *Nincs tevékenység a jelentési időszakban. Válasszon másik időszakot vagy a Teljes projektet.* Lásd lent: *Jelentési időszak*.

## Mérföldkövek áttekintése

A projekt összes mérföldköve egy táblázatban. Saját beállítása nincs. Az *Áttekintés* blokk ezeket számolja: *Mérföldkövek*, *Kötelező* és *Késésben*. Az oszlopok: *WBS*, *Név*, *Típus* (*Automatikus*, *Kezdés* vagy *Befejezés*), *Dátum*, *Korlátozás/határidő*, *Tartalékidő*, *Kötelező* és *Státusz*. A státusz *Késésben*, ha a korlátozás sérül, a határidő lejárt, vagy a teljes tartalékidő negatív. Egyébként *Kritikus*, ha a mérföldkő a projekt szerinti kritikus-meghatározás alapján kritikus. Egyébként *Ütemezés szerint*. Mérföldkő nélkül a következő üzenet jelenik meg: *Ebben a projektben nincs mérföldkő.* A PDF azt a papírméretet és tájolást használja, amelyet utoljára egy másik jelentésnél választott.

## Eltérés

Az aktuális ütemezés az aktív alaptervvel egymás mellett, alsó szintű tevékenységekre. Saját beállítása nincs. Az *Áttekintés* blokk ezeket számolja: *Tevékenységek*, *Később* és *Korábban*, és ez látszik: *Projektbefejezés: +3 munkanap* (a munkanapokban mért különbség az alaptervi befejezés és a jelenlegi befejezés között). Az oszlopok: *WBS*, *Név*, *Alapterv kezdése*, *Alapterv befejezése*, *Jelenlegi kezdés*, *Jelenlegi befejezés*, *Δ kezdés (munkanap)*, *Δ befejezés (munkanap)* és *Státusz*. A státusz a befejezést követi: *Később*, ha a befejezés későbbi, mint az alaptervben; *Korábban*, ha korábbi; egyébként *Ütemezés szerint*. Az *Új* olyan tevékenység, amely nincs az alaptervben. Az *Elhagyott* olyan tevékenység, amely az alaptervben van, de már nincs az ütemezésben. Aktív alapterv nélkül a következő üzenet jelenik meg: *Nincs aktív alapterv. Mentsen egy alaptervet, vagy állítson be egyet aktívként.* A PDF azt a papírméretet és tájolást használja, amelyet utoljára egy másik jelentésnél választott.

## Előretekintés

Ami az időszakban fut vagy kezdődik: a lista a heti megbeszéléshez. Beállítások a *Jelentésbeállítások* alatt.

**Jelentési időszak:** — a jelentés időablaka. Alapértelmezett: *Következő hónap*. Hatás: a jelentés tartalmazza azokat a befejezetlen tevékenységeket, amelyek érintik az időszakot, akkor is, ha az egész időszakot átfogják, továbbá a referencianap előtti, *Késésben* lévő tevékenységeket, feltéve hogy az időszak befejezése nem a referencianap előtt van.

**Közel kritikus ≤ (munkanap):** — a *Közel kritikus* küszöbértéke. Szám 0-tól 60-ig. Alapértelmezett: 5. Hatás: az a tevékenység, amelynek teljes tartalékideje több mint 0, de legfeljebb ennyi munkanap, közel kritikusnak számít. 0 esetén csak az számít közel kritikusnak, amit a projekt *Közel kritikus jelölése* számítási beállítása megjelöl.

Az *Áttekintés* blokk ezeket számolja: *Tevékenységek*, *Késésben*, *Folyamatban*, *Már el kellett volna kezdeni*, *Kezdődik*, *Kritikus* és *Közel kritikus*. A státusz soronként, mindig a referencianaphoz képest: *Késésben* (nincs befejezve, és a befejezés a referencianap előtt van), *Már el kellett volna kezdeni* (nincs elkezdve, pedig a kezdés a referencianap előtt volt), *Folyamatban*, *Kezdődik* (még nincs elkezdve, az időszakon belül kezdődik). Az oszlopok: *WBS*, *Név*, *Kezdés*, *Befejezés*, *Hátr. (munkanap)*, *Elk*, *TF (munkanap)*, *Kritikus*, *Erőforrások* és *Státusz*.

## Kritikus és közel kritikus

A tevékenységek, amelyek meghatározzák a projekt végét, és azok, amelyek közel vannak hozzá. Beállítás a *Jelentésbeállítások* alatt.

**Közel kritikus ≤ (munkanap):** — Alapértelmezett: 5. Szám 0-tól 60-ig. Hatás és jelentés ugyanaz, mint az Előretekintésnél. Az alcím kiírja a beállított küszöbértéket.

A jelentés tartalmazza a befejezetlen tevékenységeket, amelyek kritikusak (a számítás és a projekt szerinti kritikus-meghatározás alapján) vagy közel kritikusak. Rendezés: tartalékidő-útvonal szerint, majd teljes tartalékidő, majd kezdés szerint. Az *Áttekintés* blokk ezeket számolja: *Kritikus*, *Közel kritikus*, *Kritikus láncok* és *Alsó szintű tevékenységek*. Az oszlopok: *WBS*, *Név*, *Kezdés*, *Befejezés*, *Hátr. (munkanap)*, *TF (munkanap)*, *FF (munkanap)*, *Útvonal* és *Státusz*. Az *Útvonal* oszlop a tartalékidő-útvonalat mutatja, ha a *Több tartalékidő-útvonal* számítási beállítás be van kapcsolva; egyébként kötőjel látszik.

## Előrehaladási jelentés

Hol tart a projekt az állapotdátumon. Beállítások a *Jelentésbeállítások* alatt.

**Jelentési időszak:** — Alapértelmezett: *Elmúlt hónap*. Hatás: a *Befejezve a múltbeli időszakban* az időszakon belül számít. A *Kezdődik a következő időszakban* az állapotdátumtól előre néz, legfeljebb az *Előretekintés eddig* dátumig. *Elmúlt* időszaknál ugyanolyan messzire néz előre, mint amilyen messzire az időszak visszatekint.

**Közel kritikus ≤ (munkanap):** — Alapértelmezett: 5. Mint az Előretekintésnél.

Az *Áttekintés* blokk ezeket mutatja: *Állapotdátum*, *Időszak*, *Előretekintés eddig*, *Alapterv befejezése*, *Előrejelzett befejezés*, *Δ befejezés (munkanap)*, *Tervezett* (*(alapterv)* vagy *(jelenlegi ütemezés)* jelzéssel), *Tényleges*, továbbá a darabszámok: *Befejezett*, *Folyamatban*, *Nem kezdődött el*, *Késésben* és *Kritikus*. A tervezett és a tényleges értéket a tevékenységek időtartama súlyozza. A *Tervezett* az alaptervhez mérten számít, ha van aktív alapterv; egyébként a jelenlegi ütemezéshez. A szakaszok: *Befejezve a múltbeli időszakban*, *Folyamatban*, *Kezdődik a következő időszakban*, *Késésben* és *Nyitott kritikus tevékenységek*. Egy tevékenység több szakaszban is szerepelhet.

## Ütemezés állapota

Ez az ütemezés saját ellenőrzése hibákra és szokatlan értékekre, a tetején a DCMA 14 pontos értékeléssel. A beállítások a *Jelentésbeállítások* alatt találhatók.

**Magas tartalékidő > (munkanap):** — 1 és 365 közötti szám. Alapértelmezett: 44. Hatás: egy nem befejezett tevékenység, amelynek teljes tartalékideje ennél nagyobb, a *Magas tartalékidő* alá kerül.

**Hosszú időtartam > (munkanap):** — 1 és 365 közötti szám. Alapértelmezett: 44. Hatás: egy nem befejezett tevékenység, amely nem mérföldkő, és amelynek időtartama ennél hosszabb, a *Hosszú időtartam* alá kerül.

**Késleltetés > (munkanap):** — 0 és 365 közötti szám. Alapértelmezett: 10. Hatás: a több késleltetésű kapcsolat a *Hosszú késleltetés* alá kerül. A negatív késleltetés (átfedés) mindig szerepel a jelentésben.

**Közel kritikus ≤ (munkanap):** — 0 és 60 közötti szám. Alapértelmezett: 5. Hatás: ez határozza meg a *Közel kritikus* ellenőrzést.

A *DCMA 14 pontos értékelés* szakasz van legelöl. Ez az Egyesült Államok Védelmi Szerződéskezelő Ügynöksége (US Defense Contract Management Agency) tizennégy ellenőrzését követi. A képletek és küszöbértékek az *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, 2012. október) kiadványból származnak. Pontonként ezeket látja: *Darabszám*, *Alap* (az összes, amelyre a számlálás vonatkozik), *Érték*, *Küszöbérték*, *Eredmény* és *Részletek*. Az eredmény *Megfelel*, *Jelölés* vagy *n. é*; n. é. esetén az ok a részletekben látható. A *Jelölés* nem jelent hibát. A kiadvány szerint ez ok további vizsgálatra. A *Jelentésbeállítások* alatti küszöbértékek erre a szakaszra nem vonatkoznak. Ez a szakasz mindig a kiadvány küszöbértékeit használja.

Ez a nem befejezett alsó szintű tevékenységeket számolja, a mérföldköveket és a hangmatokat nem, valamint az ilyen tevékenységekbe mutató kapcsolatokat. A jelentés fölötti megjegyzés mindkét számot megadja. A tizennégy pont:

- *Logika*: tevékenységek előd vagy utód nélkül. Küszöbérték: legfeljebb 5%.
- *Átfedések*: negatív késleltetésű kapcsolatok. Küszöbérték: nincs.
- *Késleltetések*: pozitív késleltetésű kapcsolatok, bármilyen rövidek. Küszöbérték: legfeljebb 5%.
- *Kapcsolattípusok*: az FS-kapcsolatok aránya. Küszöbérték: legalább 90%.
- *Kötelező korlátozások*: tevékenységek kötelező korlátozással, vagy MSO, MFO, SNLT vagy FNLT korlátozással. Küszöbérték: legfeljebb 5%.
- *Magas tartalékidő*: tevékenységek, amelyek teljes tartalékideje több mint 44 munkanap. Küszöbérték: legfeljebb 5%. Ütemezés-számítást igényel.
- *Negatív tartalékidő*: tevékenységek, amelyek teljes tartalékideje 0 alatti. Küszöbérték: nincs. Ütemezés-számítást igényel.
- *Hosszú időtartam*: tevékenységek, amelyek 44 munkanapnál hosszabbak. Ha a tevékenység benne van az aktív alaptervben, az alapterv szerinti időtartamot veszi figyelembe. Egyébként az aktuális időtartamot. Küszöbérték: legfeljebb 5%.
- *Érvénytelen dátumok*: tényleges kezdés vagy tényleges befejezés az állapotdátum után, vagy előrejelzett kezdés vagy előrejelzett befejezés az állapotdátum előtt. Küszöbérték: nincs. Állapotdátumot igényel.
- *Erőforrások*: erőforrás nélküli tevékenységek. Küszöbérték: nincs. Csak akkor, ha a projekt erőforrásokat használ; egyébként *n. é*.
- *Lekésett tevékenységek*: az alapterv szerint az állapotdátumig vagy addig befejezendő tevékenységek közül azok aránya, amelyek később fejeződnek be, vagy amelyeknek az előrejelzett befejezése később van. Küszöbérték: legfeljebb 5%. Állapotdátumot és aktív alaptervet igényel.
- *Kritikus út teszt*: az alkalmazás egy kritikus tevékenységet 100 munkanappal meghosszabbít, és egy másolaton újraszámít, a projektet nem változtatva meg. A teszt akkor sikeres, ha a projekt utolsó tevékenysége ezután nem fejeződik be az adott tevékenység előtt. A teszt a legkorábban kezdődő, kritikus, nem befejezett tevékenységet vizsgálja. A részletek megnevezik a tevékenységet, és azt, hogy a befejezés hány munkanappal tolódott el.
- *CPLI*: (kritikus út hossza + tartalékidő) / kritikus út hossza. A hossz az állapotdátumtól az utolsó tevékenység befejezéséig tartó munkanapokat számolja. A tartalékidő az adott tevékenység alapterv szerinti befejezésétől mért különbség, vagy a számított tartalékidő, ha a tevékenység nincs az alaptervben. Küszöbérték: legalább 0,95. Állapotdátumot igényel.
- *BEI*: az állapotdátumra befejezett tevékenységek száma osztva ezzel az összeggel: az alapterv szerint addigra befejezendő tevékenységek száma plusz az alapterv nélküli tevékenységek száma. Küszöbérték: legalább 0,95. Állapotdátumot és aktív alaptervet igényel.

Két pont azért tér el a kiadványtól, mert az alkalmazásnak nincs meg ez a fogalom: a *Hosszú időtartam* minden nem befejezett tevékenységet számol, míg a kiadvány ezt a részletes tervezési időszakra (gördülő hullám) korlátozza. Az *Erőforrások* pedig csak a hozzárendelt erőforrásokat nézi, nem a költségeket. A kiadvány nem ad számot a kritikus út teszthez; a 100 munkanap az alkalmazás választása.

Az ellenőrzések ebben a sorrendben szerepelnek, a súlyosságukkal. Hiba: *Negatív tartalékidő*, *Elmulasztott határidő*, *Megsértett korlátozás* és *Ellentmondásos előrehaladás* (tényleges kezdés vagy tényleges befejezés az állapotdátum után, előrejelzett kezdés vagy előrejelzett befejezés az állapotdátum előtt, 100% tényleges befejezés nélkül, tényleges befejezés, de nem 100%, előrehaladás tényleges kezdés nélkül). Figyelmeztetés: *Előd nélkül (nyitott kezdet)* és *Utód nélkül (nyitott befejezés)* (nem mérföldkövek), *Hosszú időtartam*, *Átfedés (negatív késleltetés)*, *Kötelező korlátozás* (kötelező korlátozás, vagy MSO, MFO, SNLT vagy FNLT), *Sorrenden kívüli előrehaladás* és *Lekésett tevékenység (alapterv szerint)*. Tájékoztató: *Közel kritikus*, *Magas tartalékidő*, *Hosszú késleltetés*, *FS-től eltérő kapcsolat* és *Erőforrás nélkül* (csak ha a projekt erőforrásokat használ). A jelentés csak azokat az alsó szintű tevékenységeket nézi, amelyek nem hangmatok. Az *Áttekintés* blokk a *DCMA-jelölések*, a *Hibák*, a *Figyelmeztetések*, a *Tájékoztató*, az *Alsó szintű tevékenységek* és a *Kapcsolatok* számát számolja. A DCMA szakasz alatt található az *Összefoglaló* szakasz (ellenőrzésenként a súlyosság és a darabszám), és a *Megállapítások* szakasz (minden tevékenység vagy kapcsolat). Ütemezés-számítás nélkül a tartalékidőt igénylő ellenőrzések hiányoznak.

## Erőforrás-terhelés

Erőforrásonként és hetenként vagy havonként megmutatja, mennyi kell és mennyi áll rendelkezésre. A beállítások a *Jelentésbeállítások* alatt találhatók.

**Jelentési időszak:** — Alapértelmezett: *Projekt időtartama*. Hatás: minden olyan hét vagy hónap teljes egészében bekerül, amely érinti az időszakot. Így egy sor ugyanazt a számot mutatja, mint a hisztogram.

**Összesítés:** — Válassza a *Hetenként* vagy a *Havonként* lehetőséget. Alapértelmezett: *Hetenként*. Hatás: egy sor naptári hetenként (*Hét kezdete* oszlop, a hétfő dátumával) vagy naptári havonként (*Hónap* oszlop).

**Csak a túlterhelt időszakok** — Alapértelmezett: ki. Hatás: bekapcsolva csak azokat a heteket vagy hónapokat mutatja, amelyekben legalább egy túlterhelt nap van.

Az oszlopok: *Erőforrás*, *Típus*, *Hét kezdete* vagy *Hónap*, *Igényelt*, *Rendelkezésre álló*, *Eltérés* (rendelkezésre álló mínusz igényelt; a negatív érték hiányt jelent), *Csúcs/nap* és *Túlterhelt*. Az *Igényelt* a hozzárendelt mennyiség-napok összege. Csak azok a hetek vagy hónapok szerepelnek benne, amelyekben van igény. Az *Áttekintés* blokk az *Erőforrások*, a *Hetek* vagy *Hónapok*, a *Túlterhelt hetek* vagy *Túlterhelt hónapok* és a *Túlterhelt erőforrások* számát adja meg.

## Erőforrás-hozzárendelések

Erőforrásonként a hozzárendelt tevékenységek: mit csinál ez a csapat vagy daru? A beállítások a *Jelentésbeállítások* alatt találhatók.

**Jelentési időszak:** — Alapértelmezett: *Projekt időtartama*. Hatás: ha van időszak, csak azok a hozzárendelések kerülnek be, amelyek tevékenységei érintik az időszakot, plusz a referencianap előtti lejárt munka. A *Projekt időtartama* nem szűr dátum szerint.

**Befejezett tevékenységek is** — Alapértelmezett: ki. Hatás: bekapcsolva a befejezett tevékenységek hozzárendeléseit is tartalmazza.

A sorok erőforrásonként vannak, és erőforrásonként a kezdés szerint rendezettek. Az *Áttekintés* blokk az *Erőforrások*, a *Hozzárendelések* és az *Erőforrás nélküli tevékenységek* számát adja meg. Az oszlopok között van az erőforrás, a tevékenység, a kezdés és a befejezés, a *Hátr. (munkanap)*, a *Hozzárendelt mennyiség/nap*, az *Elk*, a *Kritikus* és a *Státusz*.

## WBS-összefoglaló

Az ütemezés WBS-elemenként összesítve: a vezetői áttekintés. A beállítások a *Jelentésbeállítások* alatt találhatók.

**Szint:** — melyik szintig látható a WBS. Válassza a *Teljes WBS* lehetőséget vagy az 1–8. szintek egyikét. Alapértelmezett: 2. szint. Hatás: az alcím ezt mondja: *2. szintig*.

**Tevékenységek megjelenítése** — Alapértelmezett: ki. Hatás: bekapcsolva minden elem alatt megjeleníti az alsó szintű tevékenységeket is.

Az oszlopok között van a *WBS*, a *Név*, a *Kezdés*, a *Befejezés*, az *Alapterv kezdete*, az *Alapterv befejezése*, az *Időtartam (munkanap)*, az *Elk*, a *Δ befejezés (munkanap)*, a *Min. TF*, a *Tev* (a tevékenységek száma), a *Krit*, a *Folyamatban* és a *Kész*. Egy összefoglaló tevékenység kezdete és befejezése az utolsó ütemezés-számításból származik. Az előrehaladás az alsó szintű tevékenységek időtartamával súlyozott. A *Min. TF* és a számok az alatta lévő alsó szintű tevékenységekre vonatkoznak. Az *Áttekintés* blokk a *WBS-elemek* és a *Tevékenységek* számát adja meg.

## Jelentési időszak

Négy táblázatos jelentés és az *Erőforrásdiagram* egy *Jelentési időszak:* beállítással dolgozik: *Look-ahead*, *Előrehaladási jelentés*, *Erőforrás-terhelés*, *Erőforrás-hozzárendelések* és az *Erőforrásdiagram*. Minden jelentés a saját időszakát jegyzi meg. A legördülő lista alatt a *Dátumtól* és az *Eddig* mezők vannak, a választás által adott dátumokkal.

**Referencianap.** A *Következő* vagy *Elmúlt* időszak a projekt állapotdátumától számít, ha nincs állapotdátum, akkor a mai naptól. Ilyenkor a táblázatos jelentések ezt írják: *Nincs állapotdátum beállítva. A jelentés a mai napot használja (…).* Ha módosítja az állapotdátumot, az időszak vele együtt mozog. Mindkét nap beleszámít.

**Következő hét, Következő 2 hét, Következő 4 hét, Következő 6 hét, Következő 8 hét, Következő 12 hét** — a referencianaptól, hetenként 7 nap hosszan. Ha az állapotdátum május 20., csütörtök, a *Következő hét* május 20-tól 26-ig, a *Következő 4 hét* május 20-tól június 16-ig tart.

**Elmúlt hét, Elmúlt 2 hét, Elmúlt 4 hét, Elmúlt 6 hét, Elmúlt 8 hét, Elmúlt 12 hét** — ugyanez a hat időszak, de visszafelé számítva: hetenként 7 nap hosszan, a referencianapig bezárólag. Az *Elmúlt 2 hét* május 20-án május 7-től 20-ig tart.

**Következő hónap, Elmúlt hónap** — egy naptári hónap előre vagy hátra, a másik hónapban az azonos dátum előtti napig. A *Következő hónap* május 20-án június 19-ig tart; az *Elmúlt hónap* április 21-től május 20-ig tart.

**Projekt időtartama** — az ütemezés első kezdésétől az utolsó befejezéséig.

**Egyéni** — saját időszak. Hatás: a *Dátumtól* és az *Eddig* két dátummező lesz. Ezek az előző választás dátumaival indulnak. A befejezési dátum nem lehet a kezdődátum előtt (*A befejezési dátum a kezdődátum előtt van*.), és mindkét mezőt ki kell tölteni (*Töltse ki mindkét dátumot*.). Ha a bevitel nem helyes, a jelentés az utolsó érvényes időszakon marad.

## Lásd még

- [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken): a teljes út a jelentés típusától a PDF-ig.
- [A jelentési időszak kiválasztása](docs://howto-rapportageperiode-kiezen): lépések és példák.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mit jelent a kritikus és a közel kritikus.
- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): az állapotdátum és az alapterv, amellyel a jelentések dolgoznak.
- [Túlterhelés megoldása](docs://howto-overbezetting-oplossen): mit kell tenni az *Erőforrás-terhelés* túlterhelt heteivel.
- [Import- és exportformátumok](docs://ref-import-exportformaten): a PDF a többi formátum mellett.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): két alaptervvel, előrehaladással és állapotdátummal, hogy megnézze az eltérésjelentést.
