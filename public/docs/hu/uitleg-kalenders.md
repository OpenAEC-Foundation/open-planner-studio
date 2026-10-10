# Naptárak és munkanapok

Hány munkanapig tart egy tevékenység, és melyik napon fejeződik be? Ez attól függ, melyik naptárban számol az alkalmazás. Ebben a cikkben megtudja, mi az a naptár, hogyan számol az alkalmazás munkanapokat vele, és melyik naptár érvényesül, ha több is szerepet játszik. A kidolgozott példa segít követni a számokat.

## A fogalom

Egy ütemezés **munkanapokban** számol, nem naptári napokban. „Öt nap falazás” azt jelenti, hogy öt olyan napon van munka. A hétvége vagy egy állami ünnepnap nem számít, ezért a tevékenység a naptári időben öt napnál hosszabb ideig tart.

Hogy mely napok munkanapok, azt a **naptár** rögzíti. A naptár három dolgot határoz meg:

- A **munkahét**: azok a hétköznapok, amelyeken munka van. Alapértelmezés szerint ez hétfőtől péntekig tart.
- A **munkaidő**: a kezdés, a befejezés és a szünet. Ezekből adódnak a **napi nettó órák**. Alapértelmezés szerint 07:00-tól 16:00-ig tart, egy órás szünettel, tehát 8 óra.
- Az **ünnepnapok**: egyes napok vagy egész időszakok, amelyeken nincs munka, például a Koningsdag, a karácsony vagy az építőipari szabadság.

Egy projektben egy erőforrástár tartalmazza a naptárakat. Az egyik ezek közül a **projektnaptár**. Ez minden olyan tevékenységre vonatkozik, amelynek nincs saját naptára. Egy egyedi tevékenységhez másik naptárt is megadhat, például egy hatnapos munkahetet egy alvállalkozónak, aki szombaton is dolgozik. Egy erőforrásnak is lehet saját naptára, de az másként működik (lásd lent).

## Hogyan számít az alkalmazás

Ez a cikk a szokásos számítást írja le: az *Open Planner Studio* számítási profilt, amellyel egy új projekt számol.

### Munkanapok számolása

Az első munkanap a tevékenységben az 1. nap. Egy 5 napos tevékenység ezért az ötödik munkanapon fejeződik be. Ha a kezdés nem munkanapra esik, a tevékenység a következő munkanapon kezdődik. Ünnepnap vagy építőipari szabadság a tevékenység közepén nem számít: a tevékenység egyszerűen átnyúlik rajta, és a naptári időben hosszabb lesz.

A napi órák nincsenek hatással a napalapú tevékenységek dátumaira. Csak a munkahét és az ünnepnapok számítanak. A munkaidő csak az óraalapú tevékenységnél kerül szóba; ezt a [Napok és órák](docs://uitleg-dagen-en-uren) ismerteti.

### Melyik naptár érvényesül

Az alkalmazás tevékenységenként egy naptárt választ:

1. Ha a tevékenységnek van saját naptára, az alkalmazás a tevékenységet teljes egészében ebben a naptárban számítja ki: időtartam, befejezés és tartalékidő.
2. Ha nincs, a projektnaptár érvényes. Ha a tevékenység olyan naptárra mutat, amely már nincs meg, a tevékenység szintén a projektnaptárra tér vissza.

Egy összefoglaló tevékenység (egy szakasz) nem tartalmaz saját munkát, ezért saját naptára sincs. Időtartama a tevékenységeinek dátumaiból adódik, és az alkalmazás a projektnaptár szerint számolja.

Az **erőforrás** naptára nincs hatással a dátumokra. Ha az alkalmazásban saját ütemezést épít, a naptár csak azt határozza meg, mikor áll rendelkezésre az erőforrás: a hisztogramban, a túlterhelés észlelésekor és a kiegyenlítés alatt.

### Tevékenységek különböző naptárakkal

Ha két, különböző naptárral rendelkező tevékenységet összekapcsol, az alábbi szabály érvényes:

- Befejezés-kezdés kapcsolatnál az utód az előd befejezése utáni első munkanapon kezdődik, az **utód** naptára szerint számítva. Ha egy tevékenység pénteken fejeződik be, a hatnapos munkahetű utód szombaton kezdődik.
- A **késleltetés** alapértelmezés szerint az **előd** naptárában számít. Ezt megváltoztathatja a *Beállítások › Projekt › Projektinfó* menüpontban, a *Számítási profil és beállítások* blokkban, az *Ennek a projektnek a számítási beállításai* részen belül, a *Késleltetési naptár* beállításával, amelynek értéke lehet: *Előd* (alapértelmezett), *Utód*, *24 órás* vagy *Projektnaptár*.
- A **teljes tartalékidő** a tevékenység saját naptárának munkanapjaiban számít. Ebben a profilban a **szabad tartalékidő** az utód naptárában számít.

A késleltetés pontos jelentését a [Kapcsolatok hozzáadása](docs://howto-relaties-leggen) ismerteti; a tartalékidő fogalmát a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad).

### A Gantt-diagramban

A Gantt-diagram szürke háttere mindig a **projektnaptár** nem munkanapjait mutatja. Egy saját naptárral rendelkező tevékenység ezért átfuthat egy szürke napon, például egy hatnapos tevékenység a szombaton is. Az összefüggő, három vagy több napos ünnepnapok nevükkel jelennek meg, például *Bouwvak (Noord)*. Ez nem történik meg, ha a *Csak munkanapok megjelenítése* be van kapcsolva. Ha egyáltalán nem szeretné látni a szürke napokat, kapcsolja be a *Csak munkanapok megjelenítése* beállítást a *Beállítások › Projekt › Beállítások* menüpontban, a *Megjelenés* lapon, az *Időskála* résznél.

## Kidolgozott példa: az építési ütemezés

A példa a szokásos *Bouwkalender NL* naptárat használja: hétfőtől péntekig, a holland állami ünnepnapokkal. Minden tevékenység egész számú napig tart. A naptárakról szóló oktatóanyagban (3. oktatóanyag) ilyen naptárat Ön maga készít el.

### Hétvége, ünnepnap és építőipari szabadság

*Brickwork* 5 munkanapig tart, és 2027. május 13-án, csütörtökön kezdődik. Május 13. (csütörtök) és május 14. (péntek) az 1. és a 2. nap. A hétvége és a Pünkösdhétfő, május 17. nem számít. Május 18. (kedd), 19. (szerda) és 20. (csütörtök) a 3., 4. és 5. nap. A tevékenység **május 20-án, csütörtökön** fejeződik be: nyolc naptári nap öt munkanapra.

Az építőipari szabadság a különbséget még nagyobbá teszi. Tekintse a *Bouwvak (Noord)* időszakot, 2027. július 26-tól augusztus 13-ig bezárólag. Ugyanez az 5 munkanapos tevékenység július 23-án, pénteken kezdődik. Július 23. (péntek) az 1. nap. Ezután a naptár három hétig szünetel. Augusztus 16. (hétfő) a 2., augusztus 19. (csütörtök) az 5. nap. A befejezés **augusztus 19., csütörtök**, a kezdés után 28 naptári nappal. Építőipari szabadság nélkül július 29., csütörtök lett volna a befejezés.

### Szombaton is dolgozó tevékenység

Három tevékenység követi egymást, mind befejezés-kezdés kapcsolattal, késleltetés nélkül: *Groundwork* (4 nap), *Pour foundation* (3 nap) és *Brickwork* (5 nap). A projekt 2027. május 24-én, hétfőn kezdődik.

Ha mind a három a projektnaptáron van, a *Groundwork* május 24-től (hétfő) május 27-ig (csütörtök) tart. A *Pour foundation* május 28-tól (péntek) június 1-ig (kedd) tart: péntek, hétfő, kedd. A *Brickwork* június 2-tól (szerda) június 8-ig (kedd) tart. A projekt **június 8-án, kedden** fejeződik be.

Adja a *Pour foundation* tevékenységnek a *Six-day week* naptárat (hétfőtől szombatig), és a szombat is számít. A tevékenység május 28-tól (péntek) **május 31-ig** (hétfő) tart: péntek, szombat, hétfő. A *Brickwork* a projektnaptáron marad, június 1-jén, kedden kezdődik, és **június 7-én, hétfőn** fejeződik be. A teljes projekt egy nappal rövidebb, mert egy tevékenység szombaton is dolgozik.

### Késleltetés két naptár között

*Pour floor* (hatnapos munkahét, 4 nap) május 31-én, hétfőn kezdődik, és június 3-án, csütörtökön fejeződik be. A *Pointing* (projektnaptár, 3 nap) 2 munkanapos késleltetéssel követi. Késleltetés nélkül a *Pointing* június 4-én, pénteken kezdődne.

- Alapértelmezés szerint a késleltetés az előd naptárában, azaz a hatnapos munkahétben számít. Június 4-től (péntek) június 5. (szombat) az első munkanap, június 7. (hétfő) a második. A *Pointing* **június 7-én, hétfőn** kezdődik, és június 9-én, szerdán fejeződik be.
- Ha a *Késleltetési naptár* beállítást *Utód* értékre állítja, a projektnaptár számít. Ekkor a szombat nem számít: június 7. (hétfő) az első munkanap, június 8. (kedd) a második. A *Pointing* **június 8-án, kedden** kezdődik, és június 10-én, csütörtökön fejeződik be.

### Tartalékidő a saját naptárban

A *Brickwork* (5 nap, projektnaptár) és a *Crane hire* (3 nap, hatnapos munkahét) mindkettő május 24-én, hétfőn kezdődik. Mindkettő a *Fit window frames* tevékenység (2 nap, projektnaptár) előde.

A *Brickwork* május 28-án, pénteken fejeződik be, ezért a *Fit window frames* május 31-én, hétfőn kezdődik. A *Crane hire* május 26-án, szerdán már kész. A *Crane hire* teljes tartalékideje a saját naptárában számít: csütörtök 27., péntek 28. és szombat 29. május, tehát **3 munkanap**. Ha a *Crane hire* a projektnaptáron lenne, 2 munkanap lett volna. A szabad tartalékidő 2 munkanap (csütörtök és péntek), mert az alkalmazás az utód naptárában számolja.

### Az erőforrás naptára

Egy másik példaprojektben a *Bricklaying crew* erőforrásnak a *Crew Mon–Thu* naptára van (hétfőtől csütörtökig). Az erőforrást napi 1 hozzárendelt mennyiséggel rendelték a *Brickwork* tevékenységhez (5 nap, projektnaptár, május 31. (hétfő) és június 4. (péntek) között).

A *Brickwork* dátumai nem változnak. Június 4. (péntek) azonban pirossal jelenik meg a hisztogramban, ezzel az üzenettel: *Az erőforrás a(z) „Crew Mon–Thu” naptár szerint ezen a napon nem dolgozik*. A menüszalag egy erőforrást jelez a *Túlterhelés* alatt. A kiegyenlítés ezt nem oldja meg. Az eltolás sem segít, mert öt egymást követő munkanap mindig tartalmaz pénteket. Az *Erőforrás-kiegyenlítés* ablakban a tevékenység ezért a *Fennmaradó ütközések* alatt szerepel, az indokkal: *Az erőforrás nem dolgozik minden olyan napon, amelyre ez a tevékenység szükséges — eltolás nem oldja meg.*

## Következmények és félreértések

**„Az erőforrás naptára eltolja a tevékenységeimet.”** Nem. Az erőforrás naptára egyetlen dátumot sem változtat meg; csak a túlterhelést teszi láthatóvá. Ha azt szeretné, hogy maga a tevékenység más napokon fusson, adjon a tevékenységnek saját naptárat.

**„Ha átváltom a projektnaptárt, minden eltolódik.”** Csak azok a tevékenységek mozdulnak el, amelyeknek nincs saját naptáruk. Az a tevékenység, amelynek Ön maga adott naptárat a listából, megtartja azt, még akkor is, ha az éppen a régi projektnaptár. Ha töröl egy naptárat, a használó tevékenységek és erőforrások a projektnaptárra térnek vissza.

**„Az ünnepnapok benne vannak, ugye?”** Az ünnepnapok csak azokra az évekre léteznek, amelyekre létrehozták őket. Az ezeken az éveken kívül eső nap egyszerűen munkanap. A naptár párbeszédpanelen az alkalmazás ezt így jelzi: *Az ünnepnapok a(z) 2025–2028 időszakot fedik le; a projekt 2030-ig tart. Újragenerálja?*

**„Több óra naponta rövidebbé teszi a tevékenységemet.”** Napalapú tevékenységnél nem: egész munkanapokat számol, akár 6, akár 8 órás a nap. Csak erőforrásokkal rendelkező tevékenység esetén, a *Rögzített munka* vagy a *Rögzített egységek* munkaszabály mellett változik vele az időtartam.

**Munkanap nélküli naptár**: az alkalmazás ezt nem tudja kiszámítani. A számítás ezt jelzi: *A naptárban nincs munkanap beállítva*.

## Lásd még

- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan számolja az alkalmazás a munkaórákat, és mi történik, ha napalapú tevékenységek és óraalapú tevékenységek találkoznak.
- [Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen): a lépések egy saját naptár elkészítéséhez és a tevékenységekhez rendeléséhez.
- [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren): egy ország ünnepnapjainak és az építőipari szabadságnak a kitöltése.
- [Erőforrásnaptár beállítása](docs://howto-resourcekalender-instellen): egy erőforrás rendelkezésre állásának rögzítése.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
