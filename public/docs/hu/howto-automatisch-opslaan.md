# Az automatikus mentés bekapcsolása

Cél: az alkalmazás frissítse a projektfájlt, miközben dolgozik, hogy ne kelljen folyamatosan megnyomnia a Ctrl+S billentyűkombinációt.

## Mikor van erre szüksége

Hosszú ideig dolgozik ugyanazon az ütemezésen, vagy gyakran elfelejt menteni, és azt szeretné, hogy a lemezen vagy egy megosztott mappában lévő fájl mindig naprakész legyen. Az automatikus mentés nem helyettesíti a visszaállást összeomlás után: ez mindig be van kapcsolva, és ettől függetlenül működik. A különbséget a [Fájlok és formátumok](docs://uitleg-bestanden) részben olvashatja el.

## Lépések

1. Ha a projektnek még nincs fájlja, először mentse el egyszer a *Kezdőlap › Fájl › Mentés másként* paranccsal. Amíg nincs fájl, a kapcsoló szürke, és a súgószöveg ezt mondja: *Mentse előbb ezt a projektet. Az automatikus mentés csak mentett projektnél használható*.
2. A felső eszközsorban, bal oldalon kattintson az *Automatikus mentés* kapcsolóra. Ha be van kapcsolva, a súgószöveg ezt mondja: *Az automatikus mentés be van kapcsolva: a módosítások ebbe a fájlba kerülnek*.
3. Dolgozzon tovább. Amint a projektben módosítás történik, az alkalmazás ezt a fájlba írja, párbeszédablak nélkül, legfeljebb tíz másodpercenként egyszer. Utána a *Nincs mentve* jelölés magától eltűnik.
4. Ha le szeretné állítani, kattintson még egyszer a kapcsolóra. A súgószöveg ekkor ezt mondja: *Az automatikus mentés ki van kapcsolva. A visszaállás összeomlás után továbbra is aktív*.

A Chrome és az Edge eleinte csak olvasni engedi a megnyitott fájlt. A kapcsoló ott addig nem működik, amíg Ön a *Mentés* (Ctrl+S) paranccsal egyszer el nem menti a fájlt, és a böngésző engedélyt nem ad az íráshoz. Utána bekapcsolhatja. A Firefoxban a kapcsoló szürke marad: az alkalmazás ott nem tud a fájlba írni.

## Buktatók és mit tesz ilyenkor az alkalmazás

**A kapcsoló egy projekthez tartozik.** Minden megnyitott projektnek saját állapota van. Projekt megnyitása után a kapcsoló mindig ki van kapcsolva, és az alkalmazás nem jegyzi meg a következő alkalomra.

**Az automatikus mentés csak a projekt meglévő fájljába ír.** Ha a *Mentés másként* parancsot választja, attól kezdve az új fájlba ír. Az alkalmazás csak akkor ír, ha van módosítás.

**Az írás sikertelen lehet.** Ha például a fájl eltűnt vagy zárolva van, megjelenik ez az üzenet: *Az automatikus mentés sikertelen*, az okkal együtt. Ha a böngészőnek nincs (vagy már nincs) engedélye az íráshoz, az alkalmazás csendben kihagyja ezt a kört: nem kér engedélyt.

**A fájlba olyan módosítások is kerülnek, amelyeket inkább nem szeretne megtartani.** Az automatikus mentés a projekt pillanatnyi állapotát írja a fájlba. Ha Ctrl+Z-vel visszavon valamit, a fájl tíz másodpercen belül a visszavont állapotot is megkapja. Ha egy régebbi változatot meg szeretne tartani, először készítsen róla másolatot a *Mentés másként* paranccsal.

**Összeomláskor továbbra is elvesznek az utolsó másodpercek.** Az alkalmazás legfeljebb tíz másodpercenként ír, ezért ami ezalatt történt, az még nincs a fájlban. A visszaállás összeomlás után ugyanezzel a korláttal működik.

**Visszaállítás után a böngészőben a kapcsoló újra szürke lesz.** Az a projekt, amelyet összeomlás után a böngészőben visszakap, nincs többé kapcsolatban a fájljával. Mentse el egyszer, és a kapcsoló újra működik. Lásd: [Visszaállítás összeomlás után](docs://howto-herstellen-na-een-crash).

**Egy más formátumú projektnek nincs fájlja.** Egy CSV, XML, `.mpp` vagy `.xer` fájl csak mentéskor kap IFC-fájlt. Utána bekapcsolhatja az automatikus mentést.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): a mentés, az automatikus mentés és a visszaállás összeomlás után közötti különbség.
- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): mentés, mentés másként és a *Nincs mentve* jelölés.
- [Visszaállítás összeomlás után](docs://howto-herstellen-na-een-crash): amit az alkalmazás felajánl, ha nem rendesen zárult be.
