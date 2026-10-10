# Hogyan működik az AI-kapcsolat

Valójában mi történik, amikor egy AI-segítőtárs dolgozik az ütemezésében? Ebben a cikkben megtudja, mi a kapcsolat, miben különbözik egy fájl cseréjétől, mely korlátokat véd az alkalmazás, és hogyan tudja meg az AI-segítőtárs, hogyan kell egy ütemezést felépíteni. A végén lévő példa számokkal mutatja, mit tud az AI-segítőtárs egy lépésben elvégezni, és mit kap vissza belőle Ön.

## A fogalom

Egy AI-segítőtárs, például egy csevegőprogram vagy egy programozási segéd, képes egy másik programot működtetni a **Model Context Protocol** (MCP) révén. Az Open Planner Studio ebben a cserében a szervert játssza. Az asztali alkalmazás egy kis szervert futtat az Ön saját számítógépén, a **hidat**. Az AI-segítőtárs kapcsolódik hozzá, és egy listát kap az **eszközökről**: olyan eszközökről, amelyek neve `planner_` kezdetű, például tevékenységek olvasása, egy kapcsolat hozzáadása vagy egy alaptervi mentés. Hogy melyek vannak, azt az [AI-eszközök](docs://ref-ai-tools) oldalon találja.

A figyelemre méltó rész az, hogy az AI-segítőtárs abban a projektben dolgozik, amelyet Ön éppen megnyitva tart, és nem egy másolatban. Ön nem exportál és nem importál semmit, és nincs olyan pillanat, amikor Ön és az AI-segítőtárs két különböző verziót néz. Egy tevékenység, amelyet az AI-segítőtárs hozzáad, azonnal megjelenik a Gantt-diagramban. Ebben nem naiv az alkalmazás: az AI-segítőtárs ugyanazt a számítást, ugyanazt a visszavonási előzményt és ugyanazokat a szabályokat használja, mint Ön.

Azt, hogyan kapcsolja be a kapcsolatot, az [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen) oldal írja le. Alább azt olvassa el, hogyan működik.

## Hogyan kezeli ezt az alkalmazás

### Egy szerver, amelyet csak az Ön számítógépe hall

A híd csak az Ön saját számítógépén figyel (`127.0.0.1`), egy porton, alapértelmezés szerint a 3877-es porton. Csak a `/mcp` címre fogad kéréseket, és csak akkor, ha a kérés `Authorization: Bearer` fejlécében ott van az Ön **tokenje**. Elutasít minden kérést, amelyben nincs a helyes token. Az `Origin` fejléc alapján felismert böngészőből érkező kérést is elutasítja. Így egy weboldal, amely éppen nyitva van, nem tud az ütemezésével beszélni. A kéréseket szigorúan egyenként dolgozza fel.

A kapcsolódás sima HTTP az Ön saját számítógépén. Az alkalmazáson keresztül semmi nem hagyja el a gépet. Az, hogy mit csinál egy AI-segítőtárs az ütemezéssel, amelyet olvas, például hogy mit csinál vele a szolgáltatója, az AI-segítőtárstól függ. Ez kívül esik az alkalmazáson.

### Az AI-segítőtárs egy dokumentumon dolgozik

Az első módosításakor a híd a kapcsolódást ahhoz a dokumentumhoz köti, amely akkor aktív. Ha Ön ezután maga vált lapot, az alkalmazás elutasítja az AI-segítőtárs következő módosítását (kód: `DOC_DRIFT`), amíg a `planner_switch_document` eszközzel meg nem erősíti, melyik dokumentumon akar dolgozni. Így semmi nem kerül rossz projektbe. Ha egy AI-segítőtárs maga nyit meg vagy duplikál egy dokumentumot, utána abban az új dokumentumban dolgozik.

### Minden módosítás újraszámít

Az alkalmazásban kézzel tervez: módosít valamit, majd a *Számítás* gombot nyomja meg (F5), kivéve, ha az *Automatikus ütemezés-számítás* be van kapcsolva. Ez nem vonatkozik az AI-segítőtárs módosítására. Minden írási művelete egy tranzakción megy keresztül. Ha ebben projektadatok változnak, az alkalmazás a végén magától, egy szkriptre egyszer újraszámít. Egy olvasó eszköz mindig aktuális dátumokat ad. Ha az ütemezés elavult, például mert Ön maga változtatott valamit, és még nem nyomta meg a *Számítás* gombot, az olvasó eszköz előbb újraszámít. Egy kivétel van: ha a projekt a *Rögzített dátumok* nézetben van (importálás után), egy olvasó eszköz nem számítja csendben újra, mert az felülírná ezeket a dátumokat. Az AI-segítőtárs ilyenkor a rögzített dátumokat kapja, azzal a megjegyzéssel, hogy nem lettek újraszámítva. Az AI-segítőtárs saját módosítása mindig újraszámít, akkor is, ha ez a helyzet. Az AI-segítőtárs módosítása után nem kell megnyomnia a *Számítás* gombot. Az AI-segítőtárs ezután az olvasó eszközökkel visszaolvassa az eredményt, például a projekt befejezését és a kritikus utat. Lásd még: [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen).

### Egy szkript egy lépés

Az AI-segítőtárs egy sorozatot egészben is beküldhet a `planner_batch` eszközzel, egy legfeljebb 100 lépésből álló szkriptben. Így egy visszavonási lépést, egy újraszámítást és egy biztonsági mentést kap Ön. Ha egy lépés szerkezetileg hibás, például ismeretlen eszköz vagy körkörös hivatkozás, az alkalmazás a teljes szkriptet visszagörgeti. Félkész ütemezés soha nem marad. Egy tömeges lépésen belül egy elem elutasítása enyhébb: egy érvénytelen előrehaladási adat a húszból kimarad, a többit pedig végrehajtja az alkalmazás. Az elutasítások a válasz elején szerepelnek.

### Az Ön korlátai

Négy dolgot Ön maga állít be az *AI* lapon:

- A *Szüneteltetés* és a *Csak olvasható* beállítás az AI-segítőtársat kapcsolódva hagyja, de elutasít minden módosítást. Az olvasás lehetséges marad, az elavult ütemezés olvasáskor történő újraszámításával együtt. Ezek számított mezők, nem projektadatok. Ezért nem kerül visszavonási lépés a történetbe, és a projekt nem számít módosítottnak. Ha Ön éppen maga szerkeszt, például húz egy sávot vagy kitölt egy mezőt, egy olvasó eszköz nem számít újra. Az AI-segítőtárs ilyenkor a szerkesztése előtti dátumokat kapja, azzal a megjegyzéssel, hogy elavultak.
- Egy nyitott párbeszédablak mindent blokkol. Ha például a tevékenységpárbeszédablak, a beállítások, a prezentációs mód vagy az üdvözlőablak nyitva van, az alkalmazás az olvasást is elutasítja, mert Ön éppen kézi műveletben van. Az AI-segítőtárs a `DIALOG_OPEN` hibakódot kapja. Az üzenet megnevezi a nyitott elem belső nevét, például `showTaskDialog` a tevékenységpárbeszédablakhoz.
- Az *Automatikus biztonsági mentés* dokumentumonként egy IFC-másolatot ír az első módosítás előtt. Ha ez a mentés nem sikerül, az alkalmazás nem hajtja végre a módosítást.
- A *Tevékenységpanel* minden hívást mutat, az argumentumokkal és a válasszal együtt.

Ezen felül jön a szokásos *Visszavonás* (Ctrl+Z). Az AI-segítőtárs ezt az előzményt Önnel osztja meg, és saját eszközei vannak hozzá: `planner_undo` és `planner_redo`.

### Amit az AI-segítőtárs nem tud

A híd szándékosan szűkebb, mint az alkalmazás. Amit az AI-segítőtárs nem tud, annak általában három oka van.

**Túlmutat a projekten.** Egy AI-segítőtárs nem módosíthatja az erőforrástárat. Az erőforrástárat minden projekt megosztja, és kívül esik a visszavonási előzményen. Egyetlen alapdíjmódosítás akkor olyan projektekben is hatna, amelyek nincsenek is megnyitva. Egy erőforrásnál a tárból a név, a típus, a leírás, az alapdíj és az egység rögzített, ahogy az erőforráspanelen is. Amit a projekt dönt el, az az AI-segítőtársnál marad: a maximális mennyiség, az időbeli rendelkezésre állás, a naptár és a csapat. Azt sem tudja kiválasztani, melyik naptár a projektnaptár. A számítási profilt és a számítási beállításokat olvashatja, de nem módosíthatja. Csak az előrehaladási módot és a munkaszabály projektszintű alapértelmezett értékét állíthatja be. Nincsenek eszközök a beállításokhoz, a témához, a nyelvhez, a bővítményekhez vagy a frissítésekhez.

**Nem alkalmas megbízható ellenőrzésre.** Az AI-segítőtárs nem tud hangmatot beállítani, nem tud tevékenységet kézzel ütemezni, nem tud második korlátozást megadni, nem tölt ki megjegyzéseket, színeket, tevékenységkódokat, egyéni mezőket vagy projektközi kapcsolatokat. Kézzel nem tud kiegyenlítési késleltetést beállítani. Egy WBS-kódot sem választ; azt az alkalmazás maga származtatja.

**Olyan dolgot érint, amit Önnek kell eldöntenie.** Előrehaladást csak akkor rögzít, ha van állapotdátum. Ezt az AI-segítőtárs nem választja ki maga: az Ön állapotdátuma. Ha egy még nem kezdett tevékenység tervezett kezdése az állapotdátum után van, akkor meg kell adnia a tényleges kezdést. Fájlokat csak az Ön felhasználói mappáján belül olvas és ír, és egy meglévő fájlt csak akkor ír felül, ha ezt kifejezetten kéri. Egy exportálás nem *Mentés*: a projekt az alkalmazásban mentetlen marad.

### Honnan tudja az AI-segítőtárs, hogyan kell tervezni

Egy AI-segítőtárs, amely ismeri az eszközöket, még olyan ütemezést építhet, amelyet egyetlen tervező sem tud használni: kapcsolat nélküli tevékenységeket, minden tevékenységen egy fix dátumot vagy túlzottan apró bontást. Ezért az alkalmazás három dolgot ad neki.

**Az alapszabályok a kézfogásban.** Kapcsolódáskor a híd egy rövid szöveget küld az MCP-kézfogás `instructions` mezőjében. Sok kliens ezt a szöveget a rendszerpromptjába teszi. Hogy az Ön kliensénél ez így van-e, az a klienstől függ. A szabályok: kezdje a mérföldkövekkel és az átadási dátummal, építsen nagyjából egy naptól két hétig tartó tevékenységeket, vezesse az ütemezést kapcsolatokkal, ne fix dátumokkal, korlátozást csak kemény külső dátumokhoz használjon, egy sikertelen számítást előbb javítson ki, egy koherens sorozathoz használja a `planner_batch` eszközt, előrehaladást csak az állapotdátumával és az Ön által megadott tényleges dátumokkal rögzítsen, és a végén mondja meg, mit feltételezett és mit szándékosan nem csinált.

**Az AI-segítőtársaknak szóló útmutató.** Az eszköz `planner_get_planning_guide` egy útmutatót ad vissza, amelyet kifejezetten AI-segítőtársaknak írtak. Ez ugyanazokat az elveket követi, mint a [Jól tervezés](docs://gids-goed-plannen) oldal, de egy AI-segítőtárs másképp dolgozik, mint Ön: nem nyomja meg az F5-öt és nem kattint a menüszalagon, hanem eszközöket hív, és az alkalmazás számít újra helyette. Az útmutató ezért minden elvhez megnevezi, melyik eszközt az AI-segítőtárs erre használja, és elmagyarázza, mit csinál a *Rögzített dátumok* nézettel vagy egy sikertelen számítással. Az útmutató angol nyelvű, mint minden, amit az AI-segítőtárs a kapcsolaton át olvas. Az eszköz régebbi AI-segítőtársak miatt még elfogad nyelvválasztást, de ez nem változtatja meg a szöveget. Ön magától is elolvashatja itt: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. A *Kapcsolat adatai* ablak kapcsolódási szövege arra kéri az AI-segítőtársat, hogy először olvassa el az útmutatót. Az eszköz működik akkor is, ha párbeszédablak van nyitva, szüneteltetett vagy csak olvasható módban, mert nem olvassa az ütemezést.

**Két skill.** A skill egy kis utasításfájl, amelyet az AI-segítőtárs minden munkamenetben végigolvas. Kettő van, mert kétféle munkáról van szó. Egy ütemezés felállítása logikáról szól. Az előrehaladás frissítése olyan tényekről szól, amelyeket csak Ön tud. A *goed-plannen* skill egy ütemezés felállítására vagy átalakítására szolgál: az eszközök használatának sorrendje, az újraszámítási szabály, a `planner_batch` és a kötelezettség, hogy a feltételezéseket jelentse. A *progress-update* skill a heti előrehaladási frissítésre szolgál: először az állapotdátum, utána a tényleges kezdés és befejezés és a készültségi szint, majd jelentés az alaptervtől való eltérésről, a kritikus útról és az új befejezési dátumról. Maguk a tervezési alapelvek az útmutatóban vannak. Mindkét skill angol nyelvű. Az eszköz mindkettőt visszaadja, a helyükkel együtt. Telepítésük módját az [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen) oldal írja le.

## Egy példa

Ön azt kéri egy AI-segítőtárstól: építsen egy épületbővítést, alapozással, falazattal és tetővel, ebben a sorrendben. A projekt 2026. március 2., hétfőn kezdődik. Az AI-segítőtárs először elolvassa az útmutatót, és azután egy szkriptet küld be:

1. a projektkezdés 2026. március 2.;
2. három tevékenység: Foundation 5 munkanap, Brickwork 10 és Roof 4 munkanap;
3. két befejezés-kezdés kapcsolat: Foundation-tól Brickwork-ig, Brickwork-tól Roof-ig.

Az alkalmazás végrehajtja a három lépést, és újraszámít. Ha az AI-segítőtárs utána visszaolvas, ezt találja: a projekt befejezése 2026. március 26., csütörtök, a projekt időtartama 19 munkanap, és mind a három tevékenység kritikus. Ez megfelel az összegnek: 5 + 10 + 4 a 19, és 19 munkanappal a március 2-i hétfő után március 26., csütörtökön fejeződik be. Az egész szkript egy lépés az előzményei között. Egy *Visszavonás* eltávolítja a három tevékenységet, a két kapcsolatot és az új projektkezdést.

Most jön a „mi lenne, ha” eset. Ezután megkéri az AI-segítőtársat, hogy frissítse az előrehaladást, és ehhez az állapotdátumot március 16., hétfőre állítja. Az állapotdátum nem címke: a még nem kezdett tevékenység nem eshet e dátum elé, és odakerül. Egyetlen előrehaladási adat nélkül is az egész ütemezés ezért eltolódik: a Foundation március 16-tól 20-ig tart, a Brickwork március 23-tól április 7-ig, a Roof április 8-tól 13-ig. A projekt befejezése március 26-ról április 13-ra ugrik. Az ütemezés két munkahéttel tolódik, és ebben a példában a *Bouwkalender NL* naptárban Nagypéntek (április 3.) és húsvét (április 5. és 6.) szerepel. Ez a két szabad hétköznap két nappal tovább tolja a befejezést. Ezért állítja az AI-segítőtárs az állapotdátumot csak Ön kérésére, és csak akkor, ha van rögzítendő tényleges előrehaladás.

## Következmények az ütemezésére és gyakori tévhitek

**Az AI-segítőtársnak nincs saját másolata.** Amit módosít, az az Ön projektjét módosítja. Ha az *Automatikus biztonsági mentés* be van kapcsolva, az első módosítása előtt van egy IFC-biztonsági másolat. A *Csak olvasható* beállítással az AI-segítőtárs elemezni tud, anélkül hogy bármit módosítana.

**Új token minden kapcsolatot megszakít.** A token a híd jelszava. Egy új token érvényteleníti a régit, akár egy futó hídon is, és az AI-segítőtársnak az újat kell megkapnia.

**Az, hogy az AI-segítőtárs azt állítja, sikerült, nem bizonyíték.** A tevékenységpanel mutatja, melyik eszközt hívta valójában, és mi jött vissza. Egy elutasítás szinte mindig megnevezi a rossz mezőt, és az utat, amely működik.

**Az AI-segítőtárs nem tud visszavonható „mi lenne, ha” elemzést futtatni.** A visszavonást Önnel osztja meg, ezért a változatokhoz a dokumentumot a `planner_duplicate_document` eszközzel duplikálja. A másolat független, nincs fájlútvonala, és mentetlenként látszik. Az AI-segítőtárs nem zárja be a változatokat; ezt Ön dönti el.

**Az AI-segítőtárs által végzett export nem mentés.** Egy IFC-fájlt ír egy útvonalra, amelyet maga választ, az Ön felhasználói mappáján belül. Egy meglévő fájlt csak akkor ír felül, ha ezt kifejezetten kéri. A projekt az alkalmazásban mentetlen marad, és megtartja a saját mentési célját. Ha fájlt importál, az egy új lapon nyílik meg, vagy egy üres, nem módosított lapon.

## Lásd még

- [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen): a lépések a híd elindításához, egy AI-segítőtárs csatlakoztatásához és a skill telepítéséhez.
- [AI-eszközök](docs://ref-ai-tools): az összes eszköz csoportonként, mit utasítanak el, és meddig maradnak meg a biztonsági mentések.
- [Jól tervezés](docs://gids-goed-plannen): a tervezési alapelvek; az AI-segítőtárs ezeket angol változatban kapja, az eszközökkel kiegészítve.
- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mit tesz az állapotdátum az ütemezésével.
