# Beállítások

Az alkalmazás minden beállítása: mit csinál, mi a kezdeti értéke, mi változik tőle, és hol találja meg. A projekt számítási beállításait (számítási profil, kritikussági meghatározás) itt találja: [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies). Ezek a projektfájlhoz tartoznak, nem az alkalmazáshoz.

## Hol találja meg őket, és hogyan működnek

A beállítópanel három helyen érhető el, és mindenhol ugyanaz a panel: az ablak tetején lévő fogaskerék, a *Beállítások › Projekt › Beállítások* és a *Fájl › Beállítások*. A panelnek három lapja van: *Megjelenés*, *Ütemezés* és *Speciális*. Az alábbi beállítások csak megnevezik a lapot.

Egy módosítás azonnal érvényesül. Nincs *Alkalmazás* gomb és nincs *Mégse* gomb.

**Az egész alkalmazásra érvényes, nem projektenként.** Ebben a cikkben minden beállítás az összes projektjére vonatkozik, és ehhez az eszközhöz tartozik. Az alkalmazás a beállításokat az alkalmazás vagy a böngészője tárolójában tartja, nem a projektfájlban. Ha valaki más nyitja meg a fájlt, az ő saját beállításait látja. Ha a böngésző tárolóját törli, a beállítások a kezdeti értékekkel indulnak újra.

## Megjelenés lap

**Téma** — a felület színsémája. Válasszon ezek közül: *Sötét*, *Világos* és *Magas kontraszt*. Alapértelmezett: *Sötét*. Hatás: a teljes felület színei, a Gantt és a hisztogram is beleértve. Hol: *Megjelenés*.

**Rendszertéma követése** — a számítógép operációs rendszerének színsémája dönt. Alapértelmezett: ki. Hatás: az alkalmazás a rendszertől függően *Világos* vagy *Sötét* lesz; a három témakártya ekkor nem használható. A *Magas kontraszt* nem követi a rendszert: ezt Ön választja ki. Ha ezt kikapcsolja, a képernyőn éppen látható téma marad. Hol: *Megjelenés*, a *Téma* alatt.

**Nyelv** — a felület nyelve. Alapértelmezett: a böngészője vagy rendszere nyelve, ha az alkalmazás ismeri; egyébként angol. Hatás: az alkalmazás összes szövege. A tizennégy nyelv a rövid kódjuk szerint van rendezve. Az arab és a perzsa jobbról balra tükrözi a felületet. A súgócikkek nyelvét külön állítja be: a *Fájl › Súgó* lapon, a *Dokumentáció nyelve* alatt. Hol: *Megjelenés*.

**Betűtípus** — a teljes felület betűtípusa. Válasszon ezek közül: *Alapértelmezett*, *Rendszer*, *Talpas* és *Fix szélességű*. Alapértelmezett: *Alapértelmezett*. Hatás: a címsorok és a szöveg az ablakban, valamint a szöveg a Gantt-ben és a hisztogramban. Egy webes alkalmazás nem követi automatikusan a rendszer betűtípusát, ezért választhatja ki itt. Hol: *Megjelenés*.

**Szövegméret** — a felület mérete. Válasszon ezek közül: 90%, 100%, 110% és 125%. Alapértelmezett: 100%. Hatás: a menüszalag, a panelek és a párbeszédablakok szövege és elrendezése nagyobb vagy kisebb lesz. A táblázat és a Gantt sorainak magassága vele együtt változik. 125% felett nem lehet választani, mert a menüszalag gombfeliratai ekkor több sorba törnek. Hol: *Megjelenés*.

**Dátumformátum** — az alkalmazásban megjelenő dátumok módja. Válasszon ezek közül: *nn-hh-éééé*, *hh-nn-éééé* és *éééé-hh-nn*. Alapértelmezett: *nn-hh-éééé*. Hatás: a dátumok a táblázatban, a párbeszédablakokban, a jelentésekben és a nyomtatásban. A fájlok és a számítások nem változnak, csak a megjelenítés. Hol: *Megjelenés*.

**Időtartam megjelenítése** — az egység, amelyben a tevékenység időtartama látszik. Válasszon ezek közül: *Automatikus (tevékenységenként saját egység)*, *Mindig napok* és *Mindig órák*. Alapértelmezett: *Automatikus (tevékenységenként saját egység)*. Hatás: a tevékenységtáblázatban, a Gantt sávjainak feliratán, a tippben, a nyomtatásban és a jelentésekben. Az *Automatikus* beállítással a napalapú tevékenység napokat, az óraalapú tevékenység órákat mutat. A *Mindig napok* vagy a *Mindig órák* beállítással az alkalmazás a tevékenység naptárának napi munkaóráival számol át. Ha a tevékenység egysége eltér, az alkalmazás zárójelben utána írja a saját egységét, például `2.25d(18h)`. Csak a megjelenés változik; a tevékenység megtartja a saját egységét. Hol: *Megjelenés*.

**Dokumentumváltás stílusa** — hogyan vált a megnyitott projektek között. Válasszon ezek közül: *Vízszintes lapok*, *Függőleges lapok* és *Kapszula*. Alapértelmezett: *Vízszintes lapok*. Hatás: a *Vízszintes lapok* a menüszalag alatt egy lapsort tesz; a *Függőleges lapok* a bal oldalon egy projektsávot; a *Kapszula* a címsorban egy kis projektgombot. Hol: *Megjelenés*.

### Gantt szakasz

**Csak munkanapok megjelenítése** — összenyomja az időskálát. Alapértelmezett: ki. Hatás: a hétvégék és az ünnepnapok kimaradnak a projektnaptárból, így egy 5 munkanapos tevékenység pontosan 5 oszlop széles lesz. Az *Ugrás a mai napra* és az *Illesztés a projekthez* parancsok ekkor szintén munkanapokban számolnak. A jelentésnek saját, azonos nevű jelölőnégyzete van, amely független ettől a beállítástól. Hol: *Megjelenés*, a *Gantt › Időskála* alatt.

**Negyedórák megjelenítése erős nagyításnál** — egy további, finomabb időskála. Alapértelmezett: ki. Hatás: tovább nagyíthat, és az órás skála egy további negyedórás sort kap. Egy óraalapú sáv húzásakor ekkor a negyedórákra lehet igazítani, nem csak egész órákra. Ezt csak akkor látja, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Hol: *Megjelenés*, a *Gantt › Negyedórás nagyítás* alatt.

**Tevékenységsávok szüneteknél** — azt szabályozza, hogy az óraalapú tevékenység idősávonként jelenjen-e meg. Válasszon ezek közül: *Nincs bontás*, *Bontás kijelöléskor* és *Mindig bontás*. Alapértelmezett: *Bontás kijelöléskor*. Hatás: egy óraalapú tevékenység sávja ekkor idősávonként rajzolódik ki, nem egyetlen folytonos sávként. A *Bontás kijelöléskor* csak a kijelölt tevékenységnél teszi ezt. Ez csak az óraalapú tevékenységekre vonatkozik. A ténylegesen megszakított tevékenység (a *Tevékenység megszakítása* paranccsal) a szüneteit ettől a beállítástól függetlenül mutatja. Hol: *Megjelenés*, a *Gantt* alatt.

**Görgetés és nagyítás › Mód** — mit csinál a görgetőkerék a Gantt felett. Válasszon ezek közül: *Pozíció*, *Billentyűk* és *Nagyítás + húzás*. Alapértelmezett: *Nagyítás + húzás*. Hatás: a *Nagyítás + húzás* módban a görgetőkerék a kurzor körül nagyít, a Shift + görgetőkerék a sorokon görget, a háttér húzásával mozgatja az idővonalat, a Ctrl + húzás (Mac-en Cmd + húzás) pedig kijelölő keretet rajzol. A *Pozíció* módban a görgetőkerék funkciója attól függ, hol van a kurzor. A Ctrl + görgetőkerék mindig nagyít, a Shift + görgetőkerék mindig vízszintesen görget. A *Billentyűk* módban Ön választja ki, melyik billentyű mit csinál. A választás az osztott nézet második idővonalára is vonatkozik. Hol: *Megjelenés*, a *Gantt › Görgetés és nagyítás* alatt.

**Görgetés és nagyítás › Képernyőfelosztás** — hogy a kurzor helye melyik funkciót határozza meg. Csak a *Pozíció* módban látható. Válasszon ezek közül: *Bal/jobb*, *Fent/lent* és *Jobb felső sarok*. Alapértelmezett: *Bal/jobb*. Hatás: a *Bal/jobb* beállításnál a görgetőkerék a bal félen függőlegesen, a jobb félen vízszintesen görget. A *Fent/lent* beállításnál a görgetőkerék a felső 30%-on (az időskála közelében) vízszintesen, az alatta lévő részen függőlegesen görget. A *Jobb felső sarok* beállításnál a görgetőkerék a jobb felső negyedben vízszintesen, a többi részen függőlegesen görget. Hol: *Megjelenés*, a *Gantt › Görgetés és nagyítás* alatt.

**Görgetés és nagyítás › Függőleges, Vízszintes, Nagyítás** — melyik billentyű melyik görgetőkerék-funkcióhoz tartozik. Csak a *Billentyűk* módban látható. Minden funkciónál Ön választ ezek közül: *Görgetés*, *Ctrl + görgetés* vagy *Shift + görgetés*. Alapértelmezett: a *Függőleges* a *Görgetés*, a *Nagyítás* a *Ctrl + görgetés*, a *Vízszintes* a *Shift + görgetés*. Hatás: ha olyan billentyűt választ, amelyet már használ egy másik funkció, a két funkció felcserélődik. Hol: *Megjelenés*, a *Gantt › Görgetés és nagyítás* alatt.

## Ütemezés lap

**Építési mód bekapcsolása** — építésre irányuló kezdőértékek az új projektekhez. Alapértelmezett: be. Hatás: be esetén az új projekt a *Bouwkalender NL* naptárat kapja a holland állami ünnepnapokkal. Az ünnepnapok létrehozásakor kiválasztható az építési ünnepnap. Felkínálja a *Lakóépítés* és a *Nem lakó célú építés / felújítás* fázissablonokat, az új tevékenységek pedig az *Építés* tevékenységtípust kapják. Ki esetén az új projekt a *Standaardkalender* naptárat kapja, ünnepnapok nélkül, és csak az *Üres* sablon és az *Egyéb* tevékenységtípus érhető el. Ha az új tevékenység olyan szülő tevékenység alatt van, amelynek van tevékenységtípusa, először azt veszi át. Ezután érvényesül az *Építés* vagy az *Egyéb*. A meglévő tevékenységek és naptárak nem változnak. Hol: *Ütemezés*.

**Óraalapú tervezés bekapcsolása** — tervezés munkaórákban a munkanapok mellett. Alapértelmezett: ki. Hatás: az *Óra* időskála megjelenik a *Nézet › Időskála* alatt. A *Naptárak* ablakban megjelenik a *Munkaórák* rész. Az *Új projekt* ablakban két beállítás jelenik meg: a *Műszak* és az *Alapértelmezett egység új tevékenységekhez*. A *Projektinfó* ablakban is megjelenik az *Alapértelmezett egység új tevékenységekhez* beállítás. Ki esetén az alkalmazás napi felbontásban dolgozik. A már óraalapú tevékenységek megmaradnak, és beletartoznak a számításba. Az időtartamukat csak az óraalapú tervezés bekapcsolása után szerkesztheti. Hol: *Ütemezés*, az *Óraalapú tervezés* alatt. Lásd: [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).

**Vegyes nap/óra tervezés engedélyezése** — azt határozza meg, hogy tevékenységenként választhat-e egységet. Csak akkor látható, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Alapértelmezett: be. Hatás: be esetén minden tevékenység időtartama mellett megjelenik az *Időtartam-egység* legördülő lista. Ki esetén ez a lista rejtve marad. Hol: *Ütemezés*, az *Óraalapú tervezés* alatt. Lásd: [Napok és órák](docs://uitleg-dagen-en-uren).

**A hét kezdőnapja** — a hét első napja. Válasszon ezek közül: *Hétfő* és *Vasárnap*. Alapértelmezett: *Hétfő*. Hatás: a hét felosztása és a hétszámok az időskálán a Gantt-ben és a jelentésekben (a Gantt-diagram nyomtatásában), valamint a napok sorrendje a *Naptárak* ablakban. Hol: *Ütemezés*.

**Automatikus ütemezés-számítás** — újraszámítja az ütemezést, amint az elavult. Alapértelmezett: ki. Hatás: ki esetén Ön indítja el a *Számítás* (F5) parancsot. Be esetén az alkalmazás a tevékenységek, a kapcsolatok vagy a naptár módosítása után egy másodperc töredéke alatt újraszámítja az ütemezést. Húzás közben vagy mezőbe írás közben az alkalmazás vár, és a befejezés után egyszer számol újra. Sikertelen számítás után csak akkor számol újra, ha közben módosított valamit. Hol: *Ütemezés*, az *Ütemezés-számítás* alatt.

**Munkaszabályok és munka megjelenítése** — a munkaszabály és a munka mezői az alkalmazásban. Alapértelmezett: ki. Hatás: be esetén megjelenik a *Munkaszabály* mező egy tevékenységen és a hozzárendelések munkaoszlopa, valamint elérhetővé válik a *Munkaszabály* oszlop a táblázatban. Ki esetén ezek rejtve maradnak; az időtartam és a hozzárendelt mennyiség megmarad, a munka pedig ezekhez igazodik. Egy projekt, amely már tartalmaz munkaszabály- vagy munkaadatot, például `.mpp` vagy `.xer` fájlból, ezeket mindig megjeleníti, a beállítástól függetlenül. Hol: *Ütemezés*, az *Ütemezés-számítás* alatt. Lásd: [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels).

## Speciális lap

**AI-mód bekapcsolása** — lehetővé teszi, hogy egy AI-segítőtárs dolgozzon az ütemezésével. Alapértelmezett: ki. Hatás: be esetén megjelenik az *AI* lap az MCP-híddal, így az AI-segítőtárs a Model Context Protocol-on keresztül dolgozhat az ütemezésével. Ki esetén a lap eltűnik, és a híd leáll. Hol: *Speciális*, az *AI-mód* alatt. Lásd: [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen).

**Híd automatikus indítása** — elindítja az MCP-hidat, amikor az alkalmazás elindul. Csak akkor kapcsolható be, ha az *AI-mód bekapcsolása* be van kapcsolva. Alapértelmezett: ki. Hatás: a híd azonnal aktív, így egy AI-kliens csatlakozhat anélkül, hogy Ön előbb megnyitná az *AI* lapot. Ez csak az asztali alkalmazásban működik, és indításonként egyszer: ha utána Ön maga kikapcsolja a hidat, az nem indul újra. Hol: *Speciális*, az *AI-mód* alatt.

**Hibakereső terminál bekapcsolása** — naplópanel a hibakereséshez. Alapértelmezett: ki. Hatás: be esetén egy terminálgomb jelenik meg az állapotsorban, amely megjeleníti vagy elrejti a naplópanelt. Ki esetén a panel bezárul. Hol: *Speciális*, a *Hibakereső terminál* alatt.

**Benchmark…** — méri az ütemezőmotor teljesítményét. Hatás: megnyit egy ablakot. Ebben az ablakban egy kiválasztott méretű tesztütemezés jön létre, és az alkalmazás megméri a fő fázisokat. A megnyitott projekt érintetlen marad. Ez egy gomb, nem beállítás: nincs mit megjegyezni. Hol: *Speciális*, a *Benchmark* alatt.

**Statisztika…** — hányszor töltötték le az alkalmazást. Hatás: megnyitja a *Letöltési statisztika* ablakot a GitHub Releases nyilvános adataival; az alkalmazás nem gyűjt Öntől semmit. Ez egy gomb, nem beállítás. Hol: *Speciális*, a *Statisztika* alatt. Az ablakban:

- *Letöltések operációs rendszerenként* — rendszerenként ezek az oszlopok vannak: *Letöltések*, *Telepítők* (amit valaki letölt) és *Frissítések* (amit az alkalmazás frissítője lekér), és egy *Összesen* sor. Linuxon a kettőt nem lehet szétválasztani: a frissítő ugyanazt a `.deb`, `.rpm` vagy `.AppImage` fájlt kéri le, amelyet az emberek kézzel is letöltenek, ezért ott csak a snap-fájl számít telepítőnek. Alatta a *Frissítésellenőrzések az alkalmazásból*: hányszor kérte le egy telepített alkalmazás frissítője a verziófájlt a GitHubról, hogy új verziót keressen. Ezek ellenőrzések, nem telepítések.
- *Kiadásonként* — ugyanezek a letöltések verziónként, a dátummal együtt; először a hat legújabb, a többihez a *Mind a … kiadás megjelenítése* parancsot használhatja.
- *Forrás* — az adatok dátuma (GitHub Releases, hetente frissül) és a *Frissítés most* gomb. Az alkalmazás a lekért adatokat fél óráig tárolja. Ha a lekérés nem sikerül, az ablak ezt jelzi. A Snap Store-on át végzett telepítések nem a GitHubon keresztül érkeznek, ezért hiányoznak.

**Körbevezetés indítása** — a bevezető körbevezetés ismét. Hatás: bezárja a beállítások ablakát, és a körbevezetést az első lépéstől indítja. Hol: *Speciális*, a *Körbevezetés* alatt.

**Verzió** — az alkalmazás verziószáma, két gombbal. A *Frissítések keresése* megnyitja a frissítési ablakot. Az *Újdonságok* megjeleníti az aktuális verzió újdonságait. Hol: *Speciális*, a *Verzió* alatt.

**Klasszikus nézetgombok megjelenítése** — egy helyettesített funkció, a *Régi funkciók* alatt. Alapértelmezett: ki. Hatás: be esetén a *Nézet* lapon újra megjelenik a *Megjelenítés* csoport a külön gombokkal: *Oszlopok kiválasztása…*, *Szűrés…*, *Csoportosítás…* és *Rendezés…*. Ezeket a táblázatfejléc pluszjele, az elrendezés gombjai és az elrendezés ablaka váltotta fel. Hol: *Speciális*, a *Régi funkciók* alatt.

## Megjegyzett megjelenítési beállítások a panelen kívül

Az alkalmazás ezeket a beállításokat is ezen az eszközön tárolja. Ön azonban magán az elemen állítja be őket, nem a beállítási panelen.

**Alapterv-átfedés** — az aktív alapterv vékony sávként a tevékenységsáv alatt. Alapértelmezett: be. Hol: *Nézet › Alaptervek és előrehaladás › Alapterv-átfedés*.

**Előrehaladási vonal** — a cikkcakk alakú előrehaladási vonal az állapotdátumnál. Alapértelmezett: be. Hatás: a vonal csak akkor jelenik meg, ha a projektnek van állapotdátuma. Ekkor a vonal helyettesíti a külön állapotdátum-vonalat. Hol: *Nézet › Alaptervek és előrehaladás › Előrehaladási vonal*.

**Állapotdátum-vonal** — pontozott vonal az állapotdátumnál. Alapértelmezett: be. Hatás: ha az előrehaladási vonal be van kapcsolva, az állapotdátum-vonal maga rajzolja ki a jelölést. Hol: *Nézet › Alaptervek és előrehaladás › Állapotdátum-vonal*.

**Erőforrás-kiemelés** — vékony csík az erőforrás színében a tevékenységsáv alatt. Alapértelmezett: ki. Hol: *Nézet › Alaptervek és előrehaladás › Erőforrás-kiemelés*.

**Tartalékidő-sáv** — a tartalékidő sávként jelenik meg a nem kritikus sávok mögött. Alapértelmezett: be. Hol: *Nézet › Alaptervek és előrehaladás › Tartalékidő-sáv*.

**Sávszínek** — attól függ, milyen színű a sáv. Válasszon ezek közül: *Kritikus út*, *Tevékenységenként — automatikus* vagy *Kategória szerint*. Alapértelmezett: *Kritikus út*. Hatás: egyszerre vonatkozik a Gantt-diagramra és a jelentésre. Hol: *Nézet › Alaptervek és előrehaladás › Sávszínek*.

**Hisztogram** — a hisztogram csíkja a Gantt-diagram alatt. Alapértelmezett: ki. Hol: *Erőforrások › Hisztogram › Hisztogram*, *Nézet › Panelek › Hisztogram* vagy Ctrl+Shift+H. Ön a csík magasságát a szélének húzásával állítja be. Alapértelmezett: 160 pixel, 80 és 480 között.

**Mini-térkép** — az idővonal áttekintő térképe. Alapértelmezett: ki. Hol: *Nézet › Bemutató › Mini-térkép*.

**Menüszalag összecsukása** — kompakt menüszalag. Alapértelmezett: ki. Hol: a nyílgomb a menüszalag jobb alsó sarkában.

**A tevékenységtáblázat szélessége** — alapértelmezett: 350 pixel, 150 és 800 között. Ön a tevékenységtáblázat melletti elválasztót húzva állítja be, vagy a bal és a jobb nyílbillentyűvel, ha az elválasztó fókuszban van.

**A jobb oldali panel szélessége** — alapértelmezett: 280 pixel, 200 és 900 között. Ön a panel szélét húzva állítja be.

**A *Tulajdonságok* és a *Figyelmeztetések* magassága a jobb oldali panelen** — alapértelmezett: 240, illetve 220 pixel, 120 és 2000 között. A *Tulajdonságok* akkor is ezt a magasságot kapja, ha az erőforráslista nyitva van. Ön a szakaszok közötti fogantyúval állítja be a magasságot. Az alkalmazás nem jegyzi meg, hogy a szakaszok nyitva vagy zárva vannak.

**Szintén megjegyezve, máshol leírva** — a tevékenységtáblázat oszlopai ([Oszlopok beállítása a tevékenységtáblázatban](docs://howto-tabelkolommen-aanpassen)), az elrendezései ([Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken)), a jelentések beállításai ([A jelentés típusai](docs://ref-rapporttypes)), a saját számítási profilsablonjai ([Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies)) és a *Dokumentáció nyelve* a Súgóban (*Fájl › Súgó*) is az alkalmazás tárolja ezen az eszközön, nem a projektfájlban.

## Lásd még

- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): a projekthez tartozó beállítások.
- [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): a lépések az *Óraalapú tervezés bekapcsolása* kapcsolóhoz.
- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan számolja az alkalmazás a napokat és az órákat.
- [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels): amit a *Munkaszabályok és munka megjelenítése* kapcsoló láthatóvá tesz.
- [Billentyűparancsok](docs://ref-sneltoetsen): az alkalmazás összes billentyűje, a nagyításé és a görgetésé is.
