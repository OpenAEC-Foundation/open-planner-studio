# Naptár létrehozása és hozzárendelése

Cél: hozzon létre saját naptárat, például hatnapos munkahetet, és rendelje hozzá azokhoz a tevékenységekhez, amelyeket ebben a naptárban kell kiszámítani.

## Mikor van erre szükség

Egy alvállalkozó szombaton is dolgozik. Egy munkacsoport csak hétfőtől csütörtökig dolgozik. Egy tevékenység olyan időszakba esik, amelyben csak az adott tevékenység áll. A projektnaptárban ekkor rossz munkanapok szerepelnek. Saját naptárral az alkalmazás ezeket a tevékenységeket a helyes napokon számítja ki, a többi pedig a projektnaptáron marad. Hogy az alkalmazás pontosan mit tesz egy naptárral, azt itt olvashatja el: [Naptárak és munkanapok](docs://uitleg-kalenders).

## Lépések

### Naptár létrehozása

1. Válassza az *Ütemezés › Naptár › Naptár* lehetőséget. Ugyanez a gomb a *Beállítások › Naptár › Naptár* alatt is megtalálható. Megnyílik a *Naptárak* ablak. A bal oldalon láthatók a projektnaptárak; a projektnaptárat csillag jelöli.
2. Kattintson a lista alatti plusz jelű gombra (*Új naptár*). Az új naptár a szabványos naptár másolata: hétfőtől péntekig, 07:00 és 16:00 között, egyórás szünettel. Ha az *Építési mód* be van kapcsolva, a holland állami ünnepnapok is benne vannak. Ha alapként egy meglévő naptárat szeretne használni, válassza ki a listában, és kattintson a lista alatti, két lapot ábrázoló gombra (*Duplikálás*).
3. Adja meg a naptár nevét a *Név* mezőben, amely jelzi, ki használja azt, például *Six-day week*.
4. A *Munkanapok* résznél kattintson a hétköznapokra a be- vagy kikapcsoláshoz. A *H–P* visszaállítja a szabványos hetet, 07:00 és 16:00 között. A *Folyamatos (24/7)* mind a hét napot bekapcsolja, 00:00-tól 24:00-ig.
5. Szükség esetén módosítsa a munkaidőt: a *Kezdés (óra)*, a *Befejezés (óra)*, a *Szünet kezdete* és a *Szünet időtartama (perc)* mezőt. Az időket HH:MM formában írja be; a nyilakkal negyedórával emelheti vagy csökkentheti őket. Ha a szünet időtartamát 0-ra állítja, a naptár szünet nélkül működik. A *Nettó óra naponta* értékét az alkalmazás maga számítja ki. Ha az óraalapú tervezés be van kapcsolva, és a naptárnak hétköznaponként vannak idősávjai, ezeket a mezőket nem látja; lásd: [Munkaidő beállítása](docs://howto-werktijden-instellen).
6. Szükség esetén módosítsa az ünnepnapokat. Hogy ez hogyan működik, azt ebben ismertetjük: [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren).
7. Kattintson az *Alkalmazás* gombra. Az alkalmazás azonnal újraszámítja az ütemezést, és bezárja az ablakot. A *Mégse* gombbal elveti a módosításokat. Az Enter egy beviteli mezőben közben menti a naptárat, és az ütemezést is újraszámítja, de az ablak nyitva marad. A *Mégse* gomb ekkor csak azt vonja vissza, amit ezután módosított.

### Naptár hozzárendelése tevékenységekhez

Egy új naptárnak csak akkor van hatása, ha egy tevékenység használja. Két mód van.

**A tulajdonságok panelen keresztül**

1. Jelölje ki a tevékenységet. Ha nem látja a *Tulajdonságok* panelt, kapcsolja be a *Nézet › Panelek › Tulajdonságok* menüponton keresztül.
2. A *Tevékenység* résznél válassza ki a naptárt a *Naptár* listában. A legfelső választás, a *Projektnaptár* a nevével együtt, azt jelenti, hogy a tevékenységnek nincs saját naptára.

**A helyi menün keresztül**

1. Kattintson jobb gombbal a tevékenységre a tevékenységtáblázatban vagy a Gantt-diagram sávján.
2. Válassza a *Naptár hozzárendelése* lehetőséget, majd a naptárat. Ha a tevékenység saját naptárát el akarja távolítani, válassza a *Projektnaptár* lehetőséget. Az éppen érvényes naptár mellett pipa látható.
3. Ha egyszerre több tevékenységhez akarja ugyanazt a naptárat hozzárendelni, jelölje ki őket először a Ctrl billentyűvel (Mac-en ⌘), majd kattintson jobb gombbal az egyik kijelölt tevékenységre. A választás az összes kijelölt tevékenységre vonatkozik. Ha olyan tevékenységre kattint jobb gombbal, amely nincs kijelölve, a választás csak arra a tevékenységre vonatkozik.

Egy új naptárválasztás még nem frissíti az ütemezést: az állapotsor ezt jelzi: *Elavult — újraszámítsa (F5)*. Nyomja meg a **Számítás** (F5) gombot, például a *Kezdőlap › Ütemezés › Számítás* menüpontban. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (*Beállítások › Projekt › Beállítások*, az *Ütemezés* fülön, az *Ütemezés-számítás* címsornál), az alkalmazás ezt maga elvégzi.

### Projektnaptár váltása

1. Nyissa meg az *Ütemezés › Naptár › Naptár* menüpontot, és válassza ki a naptárat a listában.
2. Az űrlap fölött kattintson a *Projektalapértelmezett beállítása* gombra. A csillag átkerül arra a naptárra.
3. Kattintson az *Alkalmazás* gombra.

Csak azok a tevékenységek követik az új projektnaptárat, amelyeknek nincs saját naptáruk.

### Naptár törlése

1. Nyissa meg a *Naptárak* ablakot, és válassza ki a naptárat a listában.
2. A lista alatt kattintson a kuka jelű gombra (*Törlés*). Ez a gomb addig inaktív, amíg csak egy naptár van.
3. Kattintson az *Alkalmazás* gombra. A tevékenységek és erőforrások, amelyek a naptárat használták, ezentúl a projektnaptárat használják. Ha a projektnaptárat magát törli, a lista első naptára lesz a projektnaptár.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**Nincs munkanap.** Ha minden hétköznapot kikapcsol, az alkalmazás nem tud számítani. Számításkor a következőt jelzi: *A naptárban nincs munkanap beállítva*.

**Érvénytelen adat.** Ha a szünet a munkanapon kívül esik, a kezdési idő a befejezési idő után van, vagy az ünnepnap dátuma hibás, a mezőnél piros üzenet jelenik meg, és az *Alkalmazás* gomb addig nem használható, amíg ki nem javítja. Érvénytelen szünet vagy ünnepnap esetén a naptár mellett a listában figyelmeztető jel is megjelenik (*Ez a naptár érvénytelen adatokat tartalmaz*).

**Naptár egy fázison.** Egy fázis mindig a projektnaptár szerint számol, mert az időtartama a tevékenységeiből adódik. Rendelje a naptárat közvetlenül a tevékenységekhez.

**Ugyanaz a naptár, két választás.** A listában a projektnaptár kétszer szerepel: mint *Projektnaptár: név*, és mint közönséges naptár ezzel a névvel. Ha az utóbbit választja, az a tevékenység saját választása lesz. Ekkor a tevékenység nem követi a később kiválasztott másik projektnaptárt.

**Eltérő órák naponta.** Ha úgy módosítja a munkaidőt vagy a szünetet, hogy egy naptár *Nettó óra naponta* értéke megváltozik, a napokban megadott tevékenység továbbra is ugyanannyi napot számol. Erőforrásokkal rendelkező tevékenységnél, ahol a munkaszabály a *Rögzített munka* vagy a *Rögzített egységek*, az időtartam is változik, mert a munka ugyanaz marad. Negyven óra munka 5 nap, ha naponta 8 óra van, és 7 nap, ha naponta 6 óra van. Az alkalmazás jelzi, hány tevékenység kapott más időtartamot.

## Lásd még

- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan számolja az alkalmazás a munkanapokat, és melyik naptár érvényesül.
- [Napok és órák](docs://uitleg-dagen-en-uren): mit csinál a *Nettó óra naponta* érték.
- [Erőforrásnaptár beállítása](docs://howto-resourcekalender-instellen): naptár egy erőforráshoz, a tevékenység helyett.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
