# Több projekt egyidejű használata

Cél: több ütemezés megnyitása egyszerre, váltás közöttük és külön-külön bezárásuk.

## Mikor van erre szükség

A városrészben lévő lakóberuházáson dolgozik, de a helyszíni megbeszélés a klubház felújításáról is szól. Vagy egy változatot szeretne az eredeti mellett megtartani. Minden projekt a saját lapján található, saját tevékenységekkel, számítással és időablakkal. A váltás egy kattintás, és semmi sem vész el.

## Lépések

### Második projekt megnyitása

1. Kattintson a lapok jobb oldalán lévő plusz jelre (*Projekt indítása*). Megnyílik a *Projekt indítása* ablak.
2. Üres ütemezéshez válassza az *Új projekt* lehetőséget, fájl kiválasztásához pedig a *Meglévő projekt megnyitása* lehetőséget. A *Mégse* gomb bezárja az ablakot.
3. Az *Új projekt* választása esetén töltse ki az *Új projekt* ablakot, majd kattintson a *Létrehozás* gombra.

A projekt a saját lapján jelenik meg, és azonnal aktív lesz. A menüszalagon lévő *Új* és *Megnyitás* gomb, a Ctrl+O billentyűkombináció és a *Fájl › Példák* alatti példák is új lapon nyitnak meg egy projektet. Az alkalmazás csak egy friss, üres ütemezést használ újra, amelyet még nem módosított. Ilyenkor nem jön létre új lap.

### Váltás a projektek között

- Kattintson a projekt lapjára.
- Nyomja meg a Ctrl+1 és Ctrl+9 közötti billentyűk egyikét (macOS-en a Ctrl helyett a ⌘), a sorban az adott helyen álló projekthez, balról jobbra számolva.
- Kattintson a lapok bal oldalán lévő menüikonra (*Összes projekt*). A *Megnyitott projektek* áttekintésben minden projekthez egy kártya látható. A kártyán a projekt neve, a fájlnév (ha a projekthez tartozik fájl), az ütemezés bélyegképe, a tevékenységek száma, a kritikus tevékenységek száma és a befejezési dátum szerepel. Kattintson egy kártyára a projekt megnyitásához. Az Esc billentyű bezárja az áttekintést.

Minden lapon van egy színes pont, amely a projekthez tartozik. Az a lap, amelynek a neve mellett kis pont látszik, nem mentett módosításokat tartalmaz.

### Projekt bezárása

Kattintson a lapon a név melletti kereszt jelre (*Bezárás*), vagy az áttekintésben lévő kártya keresztjére. A módosítás nélküli projekt azonnal bezáródik. Ha vannak nem mentett módosításai, az alkalmazás a *Nem mentett módosítások* ablakban három lehetőséget kínál:

- A *Mentés* elmenti a projektet, majd bezárja.
- A *Mentés nélkül* bezárja a projektet, és elveti a módosításokat.
- A *Mégse* nyitva hagyja a projektet.

Ha megszakítja a mentést, például a mentési ablak bezárásával, a projekt nyitva marad.

Ha bezárja az utolsó projektet, egy *Új ütemezés* nevű üres ütemezés marad.

### A váltási stílus kiválasztása

A lapok megjelenése választható. Nyissa meg a beállítások ablakot a címsorban lévő fogaskerékkel, lépjen a *Megjelenés* lapra, és a *Dokumentumátkapcsolás stílusa* beállításnál válasszon:

- *Vízszintes lapok*: az alapértelmezett. Egy sor lap a menüszalag alatt.
- *Függőleges lapok*: keskeny oldalsáv a bal oldalon, projektenként egy gombbal (a név első betűivel) és egy plusz jellel. Ha a gomb fölé viszi az egeret, megjelenik a név, a fájlnév, a tevékenységek száma, a kritikus tevékenységek száma és a befejezési dátum. A tetején lévő gomb megnyitja az áttekintést.
- *Kapszula*: egy kapszula a címsorban az aktív projekt nevével és egy számlálóval, például *2 megnyitva*. Kattintson rá az áttekintés megnyitásához és a váltáshoz.

Mindhárom stílus ugyanazt az áttekintést nyitja meg, és a Ctrl+1 és Ctrl+9 közötti billentyűk minden stílusban működnek.

## Buktatók és az alkalmazás működése

**Mi tartozik a projekthez, és mi közös.** Minden projektnek saját nézete van: nagyítás és pozíció, az aktív elrendezés szűréssel, csoportosítással vagy rendezéssel, az osztott nézet, a kapcsolatvonalak és az összecsukott fázisok. Ha másik projektre vált, ott annak a saját nézetét látja. Minden projektben közös: a menüszalagon kiválasztott lap, a mini-térkép, az átfedések (alapterv-átfedés, előrehaladási vonal és a többi), az oszlopválasztása, az elrendezései és a jelentésbeállításai.

**Amíg párbeszédablak van nyitva, nem lehet váltani.** Amíg párbeszédablak van nyitva, például a beállítások ablak vagy egy tevékenység ablaka, a Ctrl+1 és Ctrl+9 billentyűk nem tesznek semmit az alkalmazásban. A böngészőben ilyenkor a böngésző lapjai között váltanak. Zárja be előbb a párbeszédablakot. A Backstage *Projektadatok* nézetében lévő, még nem alkalmazott módosítás szintén blokkolja a váltást.

**A Ctrl+1 és Ctrl+9 sorrend szerint számolnak.** A billentyűkombináció a sorban az adott helyen álló projekthez ugrik. Ha bezár egy projektet, a többi projekt egy hellyel előrébb kerül. Ha kilencnél több projekt van nyitva, a többihez csak a lapokon vagy az áttekintésen keresztül jut el.

**Az ütemezés-számítás és a jelentések az aktív projektre vonatkoznak.** Az ütemezés-számítás (F5), a *PDF exportálás* és a jelentések arra a projektre vonatkoznak, amely most aktív.

## Lásd még

- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): nézet beállítása projektenként.
- [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken): az aktív projekt jelentése.
