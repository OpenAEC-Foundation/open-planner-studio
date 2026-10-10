# Visszaállás összeomlás után

Cél: a munka visszaszerzése, miután az alkalmazás vagy a böngésző váratlanul leállt, és a munkát nem mentette el.

## Mikor van erre szükség

A laptop leállt, az alkalmazás lefagyott, vagy a böngészőlap összeomlott, és az utolsó módosításokat még nem mentette el. Amint bárhol változás történik, az alkalmazás a háttérben visszaállítási másolatot készít minden megnyitott projektről, legfeljebb tízmásodpercenként egyszer. Ez a másolat független a projektfájltól. A mentés és az Automatikus mentés közötti különbséget a [Fájlok és formátumok](docs://uitleg-bestanden) című cikkben olvashatja el.

## Lépések

1. Indítsa újra az alkalmazást. A böngészőben töltse újra ugyanazt a lapot: a visszaállítási másolat ahhoz a laphoz tartozik.
2. Ha az alkalmazás másolatot talált, megjelenik a *Nem mentett munka visszaállítása* ablak: *Az Open Planner Studio nem zárult le rendesen. Az alábbi dokumentumokban nem mentett módosítások voltak, amelyek visszaállíthatók*: Minden projektnél látszik a neve, a fájl elérési útja, ha a projekthez tartozik fájl (böngészőben csak a fájlnév), a tevékenységek száma és a másolat ideje, például *21 tevékenység* és *Mentve: Sep 29, 2026, 9:41 AM*. Az ablak olyan projekteket is mutathat, amelyeket nem módosított.
3. Válassza a *Visszaállítás* lehetőséget. Az alkalmazás megnyitja a listában szereplő összes projektet, mindegyiket egy lapon, az utolsó másolat állapotával. Az Enter billentyű ugyanezt teszi.
4. Ellenőrizze a projekteket, és azonnal mentse őket a Ctrl+S billentyűkombinációval.

Ha nem szeretne visszaállítani, két lehetősége van. A *Visszaállítás nélkül* törli a másolatokat, és ezt nem lehet visszavonni. Ha az ablakot az Esc billentyűvel, a bezárógombbal vagy az ablak melletti kattintással zárja be, a másolatok megmaradnak, és az alkalmazás a következő indításkor újra megkérdezi.

A kérdőjel az ablak jobb felső sarkában megnyitja ezt a cikket, anélkül hogy döntést kellene hoznia. Amíg a Súgóban olvas, az ablak vár. Amikor visszatér, az ablak újra megjelenik, és még mindig visszaállíthat.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**Az utolsó másolat állapotát kapja.** Az összeomlás előtti utolsó másodpercek módosításai hiányozhatnak. Az a projekt, amelyben voltak változások, újra *Nincs mentve* jelölést kap. A *Visszavonás* előzményei üresek: az összeomlás előtti lépéseket nem vonhatja vissza. A nagyítás, a görgetési pozíció és a kijelölés újra beállítódik.

**Asztali gépen a visszaállított projekt megtartja a fájlját, böngészőben nem.** Asztali gépen a *Mentés* az eredeti fájlba ír, a visszaállított állapottal. Böngészőben a visszaállított projekt már nincs összekapcsolva a fájljával: a *Mentés* megkérdezi, hova kell menteni a fájlt. Az *Automatikus mentés* kapcsoló ilyenkor is szürke, amíg a projektet egyszer el nem mentette.

**Egy projekt a *Rögzített dátumok* nézetben ebben a nézetben marad.** Lásd: [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen).

**Asztali gépen nem jelenik meg az ablak minden indításkor.** A visszaállítási másolatok az alkalmazás adatmappájában vannak, IFC-fájlokként, amelyek neve *recovery* szóval kezdődik. Ha az alkalmazást a szokásos módon zárja be, az törli a saját másolatait. Az ablak tehát akkor jelenik meg, ha az alkalmazás váratlanul állt le, egy alkalmazásfrissítés miatti újraindítás után, vagy ha az előző indításkor elhalasztotta a visszaállítást.

**Böngészőben a másolat laponként marad meg.** A másolat a böngésző tárolójában van. Egy új lap vagy ablak nem kínálja fel egy másik lap másolatait. A már nem létező lapok másolatait hét nap után törli az alkalmazás, amint újra ír másolatokat.

**Böngészőben az ablak egy normál újratöltés után is megjelenik.** Ez akkor is történik, ha mindent elmentett. Ha közvetlenül az újratöltés előtt mentett, és utána nem módosított semmit, nyugodtan választhatja a *Visszaállítás nélkül* lehetőséget: a fájl naprakész.

**Az ablak nem jelenik meg.** Ilyenkor az alkalmazás nem talált másolatot. Ez akkor fordul elő, ha még nem módosított semmit, ha új lapot használ a böngészőben, ha korábban a *Visszaállítás nélkül* lehetőséggel már eldobta a visszaállítást, vagy ha az összeomlás azelőtt történt, hogy az alkalmazás elmentette az első másolatot: ez az első módosítás után akár körülbelül tíz másodpercig is eltarthat.

**Egy másolat sérült.** Az alkalmazás a következő üzenetet jeleníti meg, az okkal együtt: *A visszaállított fájl nem olvasható*, és felajánlja a többi projektet. Ha a *Visszaállítás* lehetőséget választja, az alkalmazás utána töröl minden másolatot, a nem olvashatót is. Ha egyetlen másolat sem olvasható, az ablak nem jelenik meg, és a másolatok megmaradnak.

**A visszaállítás nem sikerül.** Az alkalmazás a *Visszaállítás sikertelen* üzenetet jeleníti meg, az okkal együtt. A másolatok megmaradnak, és a kérdés a következő indításkor újra megjelenik.

**Néhány projekt nem tölthető be.** Az alkalmazás ezt jelzi: *2 visszaállítási fájl nem tölthető be, ezért ki lett hagyva.* Egy fájlnál így szól: *1 visszaállítási fájl nem tölthető be, ezért ki lett hagyva.* A többi projekt visszaáll. Mivel valami ki lett hagyva, minden másolat megmarad, és az ablak a következő indításkor ugyanazzal a listával tér vissza. Ha már visszakapott mindent, ami visszakapható volt, válassza a *Visszaállítás nélkül* lehetőséget.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): a mentés, az Automatikus mentés és a visszaállás összeomlás után egymás mellett.
- [Az Automatikus mentés bekapcsolása](docs://howto-automatisch-opslaan): annak beállítása, hogy az alkalmazás maga frissítse a fájlt.
- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): mentés a visszaállítás után.
- [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen): mi történik egy projekttel ebben a nézetben.
