# Munkaszabály kiválasztása

Cél: tevékenységenként beállítani, hogy az alkalmazás módosításkor mit igazít: az időtartamot, a hozzárendelt mennyiséget vagy a munkát.

## Mikor van erre szükség

Erőforrásokat rendelt egy tevékenységhez, és azt szeretné, hogy az alkalmazás Ön módján számoljon. Egy példa: a darut egy napra bérelték, és ez a nap rögzített. Egy másik példa: tudja, hogy 160 óra falazómunka van benne, és látni szeretné, mennyi ideig tart három emberrel kettő helyett. Ez a két helyzet más munkaszabályt igényel.

A szabály dönti el, hogy az időtartam, a hozzárendelt mennyiség és a munka közül melyik igazodik, ha másikat módosít. A háttér és a kidolgozott példák itt olvashatók: [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels).

## Lépések

### A munkaszabály megjelenítése

A munkaszabály alapértelmezés szerint nincs megjelenítve. Egyszer kapcsolja be:

1. Válassza ki a *Beállítások › Projekt › Beállítások* menüpontot, majd az *Ütemezés* lapon.
2. Az *Ütemezés-számítás* címsor alatt jelölje be a *Munkaszabályok és munka megjelenítése* beállítást.
3. Zárja be az ablakot a *Bezárás* gombbal.

Ez az alkalmazás beállítása, nem a projektfájlé. Ha egy fájl már tartalmaz munkaszabályokat vagy tárolt munkát, például egy MS Project vagy Primavera P6 fájl, az alkalmazás a munkaszabályt akkor is megjeleníti, ha ez a beállítás ki van kapcsolva. Ugyanez igaz, amint Ön maga választ munkaszabályt egy fájlban: a megjelenítés ekkor az adott fájlnál bekapcsolva marad, akkor is, ha később kikapcsolja a beállítást. Addig marad bekapcsolva, amíg a fájl nyitva van, és újranyitás után is, amíg a fájl tartalmaz munkaszabályt vagy tárolt munkát.

### Szabály kiválasztása

1. Jelölje ki a tevékenységet. A *Tulajdonságok* panel a jobb oldalon van; ha nem látja, kapcsolja be a *Nézet › Panelek › Tulajdonságok* menüponttal.
2. A *Munkaszabály* mezőnél válasszon az öt lehetőség közül: *Projektalapbeállítás (Rögzített időtartam és egységek)*, *Rögzített időtartam és egységek*, *Rögzített időtartam és munka*, *Rögzített munka* vagy *Rögzített egységek*. A *Projektalapbeállítás* esetén a tevékenység a projekt alapértelmezett értékét követi.
3. A legördülő lista alatt az alkalmazás megmutatja, mit véd a szabály, például: *Védett: munka (az időtartam a hozzárendelt mennyiséget követi)*.

A *Projektalapbeállítás* az első lehetőség, és ez az alapértelmezett érték egy tevékenységnél. A zárójelben lévő szabály az, amely a projektnek jelenleg alapértelmezettként van beállítva. Az alkalmazásban nincs gomb a projekt alapértelmezett szabályának megváltoztatására: ez importálásból (például MS Project vagy Primavera P6 fájlból) vagy az MCP-kapcsolaton keresztül származik. Ha egy tevékenységnél másik szabályt szeretne, itt válassza ki.

A szabályt a táblázatban is kiválaszthatja. Kattintson a tevékenységtáblázat fejlécének jobb oldalán lévő **+** jelre (*Oszlop hozzáadása*), majd az *Ütemezés* csoportban válassza a *Munkaszabály* oszlopot.

Hozzárendelés nélküli tevékenységnél nincs mit összekötni, ezért a szabály ott nem tesz semmit. Először rendeljen erőforrást hozzá (lásd: [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen)).

### A munka megtekintése és módosítása

Egy hozzárendelésekkel rendelkező tevékenységnél megjelenik a *Munka (hátr.)* oszlop a *Tulajdonságok* panel *Hozzárendelések* blokkjában, a *Hozzárendelt mennyiség/nap* mellett. Ez az erőforrás hátralévő munkája órában. Egy kis lakat az oszlop fölött mutatja, mit tart állandóan a szabály: a *Hozzárendelt mennyiség/nap* a *Rögzített időtartam és egységek* és a *Rögzített egységek* esetén, a *Munka (hátr.)* a *Rögzített időtartam és munka* és a *Rögzített munka* esetén.

Ha Ön maga szeretné módosítani a munkát, írja be az órákat a mezőbe, és nyomja meg az Entert. Az alkalmazás nem fogad el 0 vagy annál kisebb értéket: a mező visszaugrik az előző értékre.

### Az eredmény megtekintése

Ha szabályt választ, még egyetlen szám sem változik. Munkát védő szabály esetén az alkalmazás csak az aktuális munkát rögzíti, így a *Munka (hátr.)* tárolt értéket kap. A szabály csak a következő módosításnál dönti el, mi igazodik. Módosítsa például a *Hozzárendelt mennyiség/nap* értékét, és nézze meg, mi történik az időtartammal és a munkával.

Ha ez módosítja a tevékenység időtartamát, az állapotsor ezt írja ki: *Elavult — újraszámítsa (F5)*. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* menüponton keresztül, hogy lássa az új dátumokat. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (ugyanabban az *Ütemezés* lapon, az *Ütemezés-számítás* címsor alatt), az alkalmazás ezt maga végzi el.

## Melyik szabály a megfelelő

- **Rögzített időtartam és egységek** akkor alkalmas, ha az időtartam megállapodás, a hozzárendelt mennyiség pedig az Ön által megadott adat. A munka ebből a kettőből következik. Ez az alapértelmezett beállítás. Az egy napra bérelt daru ide tartozik: a nap rögzített, és Ön dönti el, hány daru van rajta.
- **Rögzített időtartam és munka** akkor alkalmas, ha a tevékenységet rögzített időszakon belül kell befejezni, és ismeri a benne lévő munka mennyiségét. Ha az időtartam változik, az alkalmazás a hozzárendelt mennyiséget igazítja.
- **Rögzített munka** akkor alkalmas, ha ismeri a benne lévő munkaórák számát, és látni szeretné, hogyan változik az időtartam az emberek számával. A 160 óra falazómunka három emberrel kettő helyett ide tartozik. A gyakorlóprojektben a vakolás ezt a szabályt kapja.
- **Rögzített egységek** akkor alkalmas, ha a hozzárendelt mennyiség rögzített, például egy daru, és a munka dönti el az időtartamot.

## Buktatók és az alkalmazás válasza

**A *Munkaszabály* mező hiányzik.** Ilyenkor a *Munkaszabályok és munka megjelenítése* beállítás ki van kapcsolva, és a fájlban még nincs munkaszabály, vagy mérföldkövet, fázist, hangmatot vagy olyan tevékenységet választott ki, amelynek időtartamtípusa *Eltelt időtartam*. Ott nincs munkaszabály. Válasszon egy normál tevékenységet.

**Az időtartam Ön módosítása nélkül változik.** A *Rögzített munka* és a *Rögzített egységek* esetén az időtartam a hozzárendelt mennyiségből és a munkából adódik. Ha ezek egyikét vagy az erőforrások számát módosítja, az alkalmazás kiigazítja az időtartamot, egész munkanapra felfelé kerekítve. Órában megadott tevékenységnél az alkalmazás egész percre kerekít felfelé.

**A munka nem egyezik pontosan a hozzárendelt mennyiség × időtartam szorzattal.** A kerekítés okozhatja ezt. A *Munka (hátr.)* mellett ekkor figyelmeztető jel jelenik meg: *Eltér a hozzárendelt mennyiség × időtartam szorzattól*. A hisztogram a tárolt munkát követi.

**Az anyag nem számít.** Anyag típusú erőforrásnál a *Munka (hátr.)* kötőjelet mutat. Az anyag soha nem határozza meg az időtartamot.

**Előrehaladással rendelkező tevékenység.** A szabály a hátralévő részen működik. Így a *Munka (hátr.)* csak azt mutatja, ami még hátravan.

**Visszavonás.** Egy szabály kiválasztása, és minden olyan módosítás, amelyet a szabály kiszámít, egy lépésként visszavonható a *Visszavonás* (Ctrl+Z) paranccsal. Ekkor a szabály újra eltűnik, de a *Munkaszabály* mező látható marad.

## Lásd még

- [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels): hogyan köti össze az alkalmazás az időtartamot, a hozzárendelt mennyiséget és a munkát, kidolgozott példákkal.
- [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen): erőforrás hozzárendelése egy tevékenységhez.
