# Projektközi kapcsolatok egy másik projekthez

Cél: egy tevékenység összekapcsolása ebben a projektben egy másik projekt fájljában lévő tevékenységével, hogy az ütemezés figyelembe vegye a máshol tervezett munkát.

## Mikor van erre szüksége

Az Ön épületbővítése csak akkor kezdhető el, ha a telephelyet már előkészítették az építésre, és ez a munka a kivitelező projektjében van. Vagy a szerelő csak akkor kezdhet, ha az Ön szerkezete elkészült, és ő a saját fájljában tervez. Egy szokásos kapcsolat csak ugyanabban a projektben lévő tevékenységek között működik. Egy **projektközi kapcsolat** egy tevékenységet egy másik fájlban lévő tevékenységhez köt.

A projektközi kapcsolat nem számol élőben a másik projekttel. Az alkalmazás egy rögzített **horgonydátumot** tárol: a külső tevékenység dátumát abban a pillanatban, amikor összekapcsolja. A számítás ezt a dátumot korlátként használja. Ha a másik projekt módosul, az Ön projektjében semmi sem mozdul el, amíg nem frissíti a horgonyt.

## Lépések

1. Válasszon ki pontosan egy tevékenységet ebben a projektben: azt, amely a külső tevékenységtől függ, vagy amelytől a külső tevékenység függ.
2. Válassza a *Kezdőlap › Tevékenységek › Összekapcsolás ▾ › Projektközi kapcsolat hozzáadása…* lehetőséget. Ugyanez a menü elérhető az *Ütemezés › Kapcsolatok* alatt és a *Táblázat › Tevékenységek* alatt is. A menüpont csak akkor érhető el, ha pontosan egy tevékenység van kijelölve.
3. A *Projektközi kapcsolat* ablakban válasszon a két lehetőség közül egyet. A *Forrásfájl* lehetőségnél válassza ki a projektfájlt a *Válasszon egy legutóbbi fájlt* alatt, majd a tevékenységet a *Forrástevékenység* mezőben. Az alkalmazás csak olvasási móddal olvassa be a fájlt, nem nyitja meg dokumentumként, és maga veszi át a horgonydátumot. Ez az út csak az asztali alkalmazásban működik, és csak a legutóbbi fájlok listájában lévő fájlnál. Egyébként a *Forrásfájl* gomb le van tiltva. A *Kézi (tartalék)* lehetőségnél írja be a külső tevékenység *Projekt-azonosító* és *Tevékenység-azonosító* mezőit, adott esetben a *Tevékenységnév (opcionális)* mezőt, és a *Horgonydátum* mezőt. A böngészőverzióban ez az egyetlen lehetőség.
4. Az *Irány* alatt válassza ki, hogy a külső tevékenység az Ön elődje vagy utódja: *Előd (külső → én)* vagy *Utód (én → külső)*.
5. Válassza ki a *Kapcsolattípus* értékét (FS, SS, FF vagy SF), és szükség esetén töltse ki a *Késleltetés (munkanap)* mezőt, például `0d` vagy `2d` értékkel.
6. Kattintson a *Kapcsolat hozzáadása* gombra, majd nyomja meg az **Ütemezés-számítás** parancsot (F5).

Melyik dátumot kell horgonyként megadni egy kézi kapcsolatnál, az az iránytól és a típustól függ:

- Külső **előd** esetén a típus első betűje számít: az F a külső tevékenység befejezési dátumát jelenti, az S a kezdési dátumát. FS és FF esetén tehát a befejezést adja meg, SS és SF esetén a kezdést.
- Külső **utód** esetén a típus második betűje számít: az S a külső tevékenység kezdési dátumát jelenti, az F a befejezési dátumát. FS és SS esetén tehát a kezdést adja meg, FF és SF esetén a befejezést.

Ha óraalapú tervezést használ (az óraalapú tervezés be van kapcsolva, és a tevékenység munkaidővel rendelkező naptárban van), a *Horgonydátum* mező időpontot is kér.

Példa: a telephely projektje 2027. június 18-án, pénteken fejeződik be. Ön a *Groundwork* tevékenységet összekapcsolja egy külső előddel, FS típussal, horgonydátum 2027. június 18. Az **Ütemezés-számítás** után a groundwork június 21-én, hétfőn kezdődik, a horgonydátum utáni első munkanapon. Egy külső utód fordítva működik: korlátozza, hogy a tevékenysége legkésőbb mikor fejeződhet be.

## Mit lát, és hogyan kezeli

- A projektközi kapcsolatok szövegként jelennek meg a tevékenységtáblázat *Elődök* és *Utódok* oszlopában. A **+** jellel a táblázat fejlécében adhatja hozzá őket, a *Kapcsolatok* alatt. Ott látja a projekt és a tevékenység nevét, valamint a típust. Egy kis háromszög a *Forrás hiányzik* felirattal azt jelzi, hogy a forrást nem olvasták be. Vigye az egeret a kapcsolat fölé: ott megjelenik a projekt (a *Projekt-azonosító* sor mutatja a projekt nevét, amint az ismert), a tevékenység-azonosító, a horgonydátum és a forrás állapota.
- A Gantt-diagramon a tevékenységnél egy szürke, áttetsző sáv látható. Előd esetén a sáv a horgonydátumnál ér véget, utód esetén a horgonydátumnál kezdődik. A szaggatott szegély és a piros *elavult* címke azt jelzi, hogy a forrást nem olvasták be. Kézi kapcsolatnál ez mindig így van.
- Kattintson jobb gombbal egy kapcsolatra az oszlopban. Itt találja a *Projektközi kapcsolat szerkesztése…* és a *Kapcsolat törlése* lehetőséget. Ha a kapcsolatnak van forrásfájlja, a *Forrás frissítése* is itt van.
- Válassza az *Összekapcsolás ▾ › Összes projektközi kapcsolat frissítése* lehetőséget, hogy az alkalmazás újra beolvassa a forrásfájlokat, és frissítse a horgonyokat. Ez csak az asztali alkalmazásban működik. Ha csak kézi kapcsolatai vannak, az alkalmazás ezt írja: *Nincs frissíthető külső forrás (a fájlelérési út hiányzik).* Frissítés után nyomja meg az **Ütemezés-számítás** parancsot.
- Ha módosítja a típust vagy az irányt úgy, hogy a horgonynak a külső tevékenység másik oldalára van szüksége (kezdés a befejezés helyett, vagy fordítva), az alkalmazás kézi kapcsolatnál új horgonyt kér: *Válasszon új horgonyt: a kapcsolattípus most a forrástevékenység másik oldalát használja.* Forrásfájllal rendelkező kapcsolatnál az alkalmazás maga olvassa be újra a horgonyt.

## Buktatók és az alkalmazás működése

**A másik projekt nem mozdul el.** Ha a külső tevékenység dátuma megváltozik, az Ön ütemezése a régi horgonnyal számol tovább, amíg nem frissíti vagy nem módosítja a horgonyt. Kézi kapcsolatnál Ön maga módosítja a horgonydátumot: kattintson jobb gombbal a kapcsolatra, és válassza a *Projektközi kapcsolat szerkesztése…* lehetőséget.

**Egy külső előd alsó korlát.** Ha a tevékenysége a saját elődei miatt később kezdődik, mint a horgony kívánja, akkor az a kapcsolat érvényesül. A horgony csak későbbi kezdést írhat elő.

**Egy külső utód felső korlát.** Ha a horgony túl szoros, ezt negatív tartalékidőként látja a tevékenységén és a megelőző tevékenységeken. Külön figyelmeztetés nem jelenik meg, ezért kövesse figyelemmel a *Teljes tartalékidő* oszlopot.

**Csak rögzített késleltetés.** Projektközi kapcsolatnál nem adhat meg késleltetést naptári napokban vagy százalékban. Az alkalmazás ezt írja: *A projektközi kapcsolatok csak rögzített késleltetést támogatnak, munkanapban vagy munkaidőben.* A munkanapok a saját tevékenysége naptárában számítanak. Órában megadott késleltetés csak olyan tevékenységnél számít, amelyet órában terveznek; napokban tervezett tevékenységnél a számítás figyelmen kívül hagyja. Ilyenkor használja a munkanapokat.

**A másik fájl projekt-azonosítója.** A projekt-azonosító nincs mezőben vagy oszlopban. Az adott projekt IFC-fájljában `InternalProjectId` néven van tárolva: nyissa meg a projektet, lépjen az *IFC* lapra, és válassza az *IFC-generálás* lehetőséget. A számítás csak a horgonydátumot használja, de az azonosító nem puszta címke. Frissítéskor az alkalmazás először a projekt-azonosító alapján ismeri fel a forrásfájlt, csak azután a fájl elérési útja alapján. Ha kézi kapcsolatnál ugyanazt az azonosítót adja meg, mint egy forrásfájlé, a kapcsolat együtt frissül, amikor ez a fájl frissül. A másik projektben lévő tevékenység *Tevékenység-azonosító* értékét a projekt táblázatában találja, a *Technikai* alatti *Tevékenység-azonosító* oszlopban.

## Lásd még

- [Kapcsolatok és késleltetés](docs://uitleg-relaties): hogyan számítja ki az alkalmazás egy kapcsolat és a késleltetés értékét.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): kapcsolatok ugyanabban a projektben lévő tevékenységek között.
- [Korlátozások és határidők](docs://uitleg-constraints): dátumkorlátok egy tevékenységen, másik projekt nélkül.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): egy projektközi kapcsolatot tartalmaz a *Car park paving* tevékenységen (külső előd).
