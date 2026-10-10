# Korlátozás vagy határidő beállítása

Cél: egy dátumra vonatkozó megállapodás rögzítése egy tevékenységen, hogy az ütemezés figyelembe vegye, vagy jelezze, ha nem tartja be.

## Mikor van erre szükség

A téglát csak június 21-én szállítják, ezért a falazás nem kezdődhet korábban: **korlátozás**, *nem korábban kezdődő*. A tetőt az építési ünnepnap előtt le kell fedni, és figyelmeztetést szeretne kapni, ha ez nem sikerül: **határidő**. Az öntés egy napra van rögzítve, mert a betonüzem ezt megígérte: *kötelező kezdés*. Hogy melyik típus mikor illik, és mit csinál vele az alkalmazás, a [Korlátozások és határidők](docs://uitleg-constraints) leírásában olvasható.

## Lépések

A korlátozást és a határidőt a *Tulajdonságok* panelen állítja be.

1. Jelölje ki a tevékenységet. Ha nem látja a *Tulajdonságok* panelt, kapcsolja be a *Nézet › Panelek › Tulajdonságok* útvonalon.
2. A *Korlátozás* mezőben válassza ki a típust, például a *Nem korábban kezdődő (SNET)* lehetőséget.
3. A *Lehető legkorábban (ASAP)* és a *Lehető legkésőbb (ALAP)* kivételével minden típusnál megjelenik a *Korlátozás dátuma* mező. Írja be a dátumot a három dobozba, a napot, a hónapot és az évet, például 21, 06 és 2027, majd nyomja meg az Entert. Amint egy doboz megtelik, az alkalmazás magától a következő dobozra ugrik. A típus kiválasztása után már van egy dátum: az előző korlátozásé, vagy ennek hiányában a tevékenység eredeti tervezett kezdése. Ez eltérhet a panelen látható kezdéstől, ezért mindig Ön írja be a kívánt dátumot.
4. Ha a tevékenységet az adott napra akarja rögzíteni, még az elődei előtt is, válassza a *Kötelező kezdés (MSO)* vagy a *Kötelező befejezés (MFO)* lehetőséget, és jelölje be a *Kötelező (pin-logika)* négyzetet. Ez egy kötelező rögzítés. Csak valóban rögzített dátumnál használja.
5. Ha egy második korlátot is akar, például egy tevékenységet, amely június 14-e előtt nem kezdődhet, és június 17-ig be kell fejeződnie, válasszon típust a *Másodlagos korlátozás* mezőben, és töltse ki a *Másodlagos dátum* mezőt. Ez a mező minden olyan korlátozásnál megjelenik, amelynek van dátuma, a kötelező rögzítés kivételével. MSO és MFO esetén másodlagos korlátozás nem megengedett: az alkalmazás ezt pirossal jelöli meg.
6. Határidő beállításához töltse ki a *Határidő* mezőt, ugyanúgy, mint a korlátozás dátumát. A határidő független a korlátozástól: ugyanazon a tevékenységen mindkettőt beállíthatja.
7. Nyomja meg a **Számítás** (F5) gombot, például a *Kezdőlap › Ütemezés › Számítás* útvonalon. Addig az állapotsor ezt írja ki: *Elavult — újraszámítsa (F5)*.

A mezők a *Tevékenység szerkesztése* ablakban is megvannak. Ezt az ablakot úgy nyitja meg, hogy a tevékenységre jobb gombbal kattint, és a *Szerkesztés...* lehetőséget választja. A *Mentés* gombbal erősíti meg.

A táblázatban oszlopokkal dolgozik. Kattintson a táblázat fejlécében lévő **+** jelre, és a *Korlátozások* alatt válassza ki a *Korlátozástípus*, a *Korlátozás dátuma* és a *Határidő* oszlopot. Van még a *Kötelező korlátozás*, a *Másodlagos korlátozástípus* és a *Másodlagos korlátozás dátuma* is. Szerkesztéshez kattintson duplán a cellára: a típust egy listából választja ki, a dátumot pedig kötőjelekkel írja be, például 21-06-2027. A *Kötelező korlátozás* csak MSO és MFO esetén módosítható.

Ha a tevékenységnek van előde, van egy gyorsút a *Nem korábban kezdődő (SNET)* korlátozáshoz: csak írjon be új kezdési dátumot a *Kezdés* mezőbe (a *Tulajdonságok* panelen, a *Tevékenység szerkesztése* ablakban vagy a táblázatban), vagy húzza el a sávot a Gantt-diagramban. Az alkalmazás ekkor magától korlátozássá alakítja, *Nem korábban kezdődő (SNET)*, és ezt jelzi is.

## Az eredmény ellenőrzése

- A Gantt-diagramban a sáv fölött egy kis rombusz látható: kezdési korlátozásnál a kezdés oldalán, befejezési korlátozásnál a befejezés oldalán. Kék az SNET és FNET esetén, lila az SNLT, FNLT, MSO és MFO esetén, piros, ha megsértett korlátozásról van szó. A kötelező rögzítésnek van egy pin-jelölése. A határidő egy lefelé mutató nyíl a határidő napján: zöld, ha a tevékenység időben kész, piros, ha késik.
- Egy megsértett korlátozás vagy lekésett határidő megjelenik a *Figyelmeztetések* panelen (*Ütemezés › Ütemezés › Figyelmeztetések*) és az állapotsorban. A tevékenység és az előtte lévő tevékenységek *Teljes tartalékidő* értéke ekkor negatív.
- Felső korlát (*nem később kezdődő*, *nem később befejeződő*) vagy határidő esetén, ha nincs figyelmeztetés, az ütemezés teljesíti a dátumot.

## Korlátozás vagy határidő eltávolítása

A *Korlátozás* mezőben ismét válassza a *Lehető legkorábban (ASAP)* lehetőséget. Ezzel a másodlagos korlátozás is eltávolítódik. A határidőt úgy távolítja el, hogy kiüríti a három dobozt, és megnyomja az Entert. Ezután nyomja meg a **Számítás** gombot.

## Buktatók és az alkalmazás működése

**Korlátozás egy szakaszon.** Korlátozásnak vagy határidőnek egy szakaszon (összefoglaló tevékenység) nincs hatása. Állítsa be magán a tevékenységen.

**Egy már elkezdett tevékenység.** Ha a tevékenységnek van tényleges kezdése vagy előrehaladása, megtartja a tényleges kezdését. Egy későbbi dátumú *nem korábban kezdődő* korlátozás nem mozdítja el.

**Kezdési dátum beírása egy másik korlátozás mellett.** Ha a tevékenységnek van előde, és már van egy másik korlátozása, például *Lehető legkésőbb (ALAP)*, az alkalmazás nem alkalmazza a beírt kezdési dátumot. Egy üzenet megnevezi a korlátozást. Ha a kezdést el akarja mozdítani, azt módosítsa.

**Dátum a hétvégén.** Szombaton, vasárnapon vagy ünnepnapon lévő dátumot az alkalmazás munkanapként kezeli: alsó korlátnál (*nem korábban kezdődő*, *nem korábban befejeződő*) a következő munkanapra, felső korlátnál (*nem később kezdődő*, *nem később befejeződő*) az előzőre tolja.

**Nem megengedett másodlagos korlátozás.** Az alkalmazás egy érvénytelen kombinációt pirossal jelöl meg, az okkal együtt, például *Az elsődleges és a másodlagos korlátozás nem határolhatja ugyanazt az oldalt.* ASAP, ALAP, MSO, MFO és kötelező rögzítés esetén másodlagos korlátozás nem megengedett.

**Kötelező rögzítés.** Az első bekapcsoláskor az alkalmazás figyelmeztet, hogy a kötelező rögzítés felülírja a kapcsolatokat. A tevékenység ekkor a dátumon van, még az elődei előtt is. Ezek az elődök negatív tartalékidőt kapnak.

**Nincs változás a beállítás után.** A korlátozások csak a **Számítás** után működnek. Ha egy felső korlát (*nem később kezdődő*, *nem később befejeződő*) nem hat a sávokra, az normális: egy felső korlát nem mozdít el semmit. Ha a dátumot nem tartják be, negatív tartalékidőt okoz.

## Lásd még

- [Korlátozások és határidők](docs://uitleg-constraints): mit csinál minden típus, és a kötelező rögzítés, a negatív tartalékidő és a határidő magyarázata.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mit tesz a negatív tartalékidő a kritikus úttal.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): a kapcsolatok, amelyekkel egy korlátozás együtt szerepel.
- [Értesítések és figyelmeztetések](docs://ref-meldingen): a figyelmeztetések egy megsértett korlátozásnál vagy lekésett határidőnél.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): egy engedélyhez kötött korlátozás *nem korábban kezdődő* a *Demolish existing extension* tevékenységen (2027. május 14.), és egy határidő, amelyet bőven betartanak.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): szándékosan szoros határidő a *Contractual project handover* tevékenységen (2027. július 15.). Az ütemezés-számítás után a befejezés augusztus 17. lesz, és sok tevékenységnek negatív tartalékideje van.
