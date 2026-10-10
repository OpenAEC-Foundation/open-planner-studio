# Hangmat létrehozása

Cél: olyan tevékenység létrehozása, amely nem ismeri a saját időtartamát, hanem egy tevékenység kezdetétől egy másik tevékenység befejezéséig tart, például a munkaterület előkészítése, a felügyelet vagy egy munkaterületi iroda bérlése.

## Mikor van rá szükség

A site cabin ott áll, amíg tart az építkezés, az első földmunkától az átadásig. Ha ennek a tevékenységnek 13 munkanapos rögzített időtartamot ad, az nem követi a változást, ha a falazás késik, és az ütemezés már nem lesz helyes. Egy **hangmat** (más néven *ráfordítási szint*) azokhoz a tevékenységekhez igazodik, amelyekhez kapcsolódik: a kezdete egy kezdési kapcsolatból, a befejezése egy befejezési kapcsolatból származik, az időtartama pedig a kettő különbsége.

## Lépések

1. Hozzon létre egy tevékenységet, például *Site cabin*, vagy jelöljön ki egy meglévő tevékenységet. Mérföldkő és összefoglaló tevékenység (fázis) nem lehet hangmat. Ilyen tevékenység esetén a *Tulajdonságok* panelben és a *Tevékenység szerkesztése* ablakban hiányzik a jelölőnégyzet, az oszlopban pedig nem lehet módosítani.
2. Jelölje be a *Hangmat (származtatott időtartam)* jelölőnégyzetet a *Tulajdonságok* panelben, a *Tevékenység szerkesztése* ablakban (kattintson a tevékenységre jobb gombbal, majd válassza a *Szerkesztés...* lehetőséget), vagy az *Ütemezés* alatti *Hangmat (származtatott időtartam)* oszlopban. Ezután nem lehet szerkeszteni az *Időtartam* mezőt.
3. Adjon hozzá kapcsolatot attól a tevékenységtől, amellyel a hangmat kezdődik, a hangmathoz. Típusa **SS** (a hangmat ugyanakkor kezdődik, mint az adott tevékenység) vagy **FS** (a hangmat az adott tevékenység után kezdődik). Ehhez jelölje ki a hangmatot, kattintson a *Kapcsolat hozzáadása* gombra a *Kapcsolatok* részben, hagyja az irányt *Előd* értéken, válassza ki a tevékenységet, majd válassza ki a típust. A lépéseket a [Kapcsolatok hozzáadása](docs://howto-relaties-leggen) leírás ismerteti.
4. Adjon hozzá kapcsolatot attól a tevékenységtől, amellyel a hangmat véget ér, a hangmathoz. Típusa **FF** (a hangmat ugyanakkor fejeződik be, mint az adott tevékenység) vagy **SF**.
5. Nézze meg a *Tulajdonságok* panelt a *Hangmat (származtatott időtartam)* alatt. Ott látja a *Kezdést meghatározó kapcsolat* sort a tevékenységgel és a típussal, valamint a *Befejezést meghatározó kapcsolat* sort a tevékenységgel és a típussal. Meghatározó tevékenység az a tevékenység, amelytől a hangmat a kezdését vagy a befejezését veszi.
6. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* útvonalon. A hangmat most a kezdést meghatározó tevékenység kezdetétől a befejezést meghatározó tevékenység befejezéséig tart. Az *Időtartam* mező megmutatja a származtatott időtartamot.

A Gantt-diagramban a hangmat vékony, türkizkék sáv, mindkét végén egy horoggal.

Példa: a *Site cabin* SS kapcsolatot kap a *Groundwork* tevékenységtől (2027. június 7., hétfő), és FF kapcsolatot a *Roofing* tevékenységtől (befejezve: június 23., szerda). A **Számítás** után a hangmat június 7-től (hétfő) június 23-ig (szerda) tart: 13 munkanap. Ha a falazás 2 munkanappal késik, a *Roofing* befejezése péntek, június 25. lesz, a hangmat pedig 15 munkanapra nyúlik.

## Mit tesz az alkalmazás a hangmattal

- A hangmat soha nem kritikus, és nincs rajta tartalékidő. Az alkalmazás a hangmat miatt azokat a tevékenységeket sem korlátozza, amelyektől a kezdését és a befejezését kapja: ezek a tevékenységek a hangmat miatt nem kapnak legkésőbbi dátumokat.
- A késleltetés is számít. SS és `1d` késleltetés esetén a hangmat egy munkanappal a kezdést meghatározó kapcsolat elődje után kezdődik. FF és `2d` késleltetés esetén két munkanappal a befejezést meghatározó kapcsolat elődje után fejeződik be.

## Buktatók és az alkalmazás működése

**Nincs befejezést meghatározó kapcsolat.** Ha a hangmatnak nincs FF- vagy SF-kapcsolata, az alkalmazás nem tudja származtatni a befejezését. A *Tulajdonságok* panel ezt jelzi: *Nincs befejezést meghatározó kapcsolat (FF/SF) — a terjedelem nulla hosszúságúra áll vissza.* A *Figyelmeztetések* panel pedig ezt jelzi: *Hangmat befejezést meghatározó kapcsolat nélkül (nincs FF/SF-előd): az időtartam nulla lesz*. Ekkor a hangmat ugyanazon a napon kezdődik és fejeződik be. Adjon hozzá FF- vagy SF-kapcsolatot.

**A hangmat az utolsó tevékenység után fejeződik be.** Ha a hangmat az utolsó tevékenység után is tart, például FF kapcsolattal és 2 munkanapos késleltetéssel, a projekt befejezési dátuma vele együtt mozdul el. A tényleges tevékenységek ekkor tartalékidőt kapnak, és egyik sem kritikus többé.

**Tevékenységek, amelyek a hangmatra várnak.** Ha kapcsolatot ad a hangmattól egy másik tevékenységhez, az a tevékenység csak a hangmat befejezése után indulhat. A hangmat előtti teljes lánc, beleértve azokat a tevékenységeket is, amelyektől a hangmat a kezdését és a befejezését kapja, ekkor tartalékidőt kap, és már nem kritikus, mert a hangmat nem gyakorol visszahatást. Ezért ne hagyja, hogy tevékenységek a hangmatra várjanak. Inkább kösse ezeket a tevékenységeket a hangmat befejezést meghatározó kapcsolatához.

**Időtartam megadása.** A hangmat *Időtartam* mezője származtatott, ezért nem szerkeszthető. A jelölőnégyzet bejelölése előtt megadott időtartam már nem számít.

## Lásd még

- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): a lépések egy SS- vagy FF-típusú kapcsolat hozzáadásához.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): mit jelent az SS és az FF, és hogyan számít a késleltetés.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mit jelent a kritikus, és hogyan működik a tartalékidő.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tartalmazza a *Structural works tower A (LOE)* hangmatot.
