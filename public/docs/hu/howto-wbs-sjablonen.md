# WBS-sablonok mentése és beszúrása

Cél: egy szakaszt az altevékenységeivel és azok kapcsolataival sablonként menteni, és később ugyanabban vagy egy másik projektben újra beszúrni.

## Mikor van erre szükség

Ugyanolyan munkát tervez újra és újra: minden háznak van alapozása földmunkával, vasalással, betonöntéssel és betonápolással. Ahelyett, hogy ezeket a tevékenységeket újra és újra létrehozná és összekapcsolná, mentse el a szakaszt egyszer **sablonként**. Egy sablon a WBS egy ága: egy tevékenység mindazzal együtt, ami alatta van.

## Lépések

### Ág mentése sablonként

1. Építse fel az ágat úgy, ahogy később újra használni szeretné: egy összefoglaló tevékenységet altevékenységekkel és a köztük lévő kapcsolatokkal.
2. Kattintson a jobb gombbal erre az összefoglaló tevékenységre, és válassza az *Ág mentése sablonként* lehetőséget. Ez a menüpont csak olyan tevékenységeken jelenik meg, amelyeknek vannak altevékenységeik.

Az alkalmazás ezt jelzi: *Ág mentve sablonként: „Foundation”*. Az alkalmazás nem kér nevet: a sablon az ág legfelső tevékenységéről kapja a nevét.

### Sablon beszúrása

1. Jelölje ki azt a tevékenységet, amely alá a sablon kerül, vagy ne jelöljön ki semmit.
2. Válassza az *Ütemezés › Struktúra › Sablonok* lehetőséget. A lista megjeleníti az egyes sablonok nevét, és – például – a *4 tevékenység, 2 kapcsolat* szöveget.
3. Kattintson a sablonra.

Ha van kijelölt tevékenység, a sablon utolsó altevékenységként kerül az adott tevékenység alá. Ezzel az adott tevékenység összefoglaló tevékenységgé válik. Ha több tevékenység van kijelölve, az számít, amelyre először kattintott. Ha nincs kijelölés, az ág a lista aljára kerül, a legfelső szintre. A beszúrt ág utána kijelölve marad.

Minden beszúrt tevékenység a projektkezdés dátumára kerül, és az ütemezés már nem naprakész. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* lehetőségen keresztül, és a dátumok a kapcsolatokból adódnak. A beszúrás egyetlen lépésben vonható vissza a *Visszavonás* paranccsal. A sablon mentése vagy törlése ehhez nem tartozik.

### Sablon törlése

Nyissa meg az *Ütemezés › Struktúra › Sablonok* menüpontot, és kattintson a sablon jobb oldalán lévő kis kukára (*Sablon törlése*). Az alkalmazás nem kér megerősítést.

### Mi van a sablonban

Egy sablon minden tevékenységnél megőrzi a nevet, a leírást, a tevékenységtípust, azt, hogy mérföldkő-e, és az időtartamot napokban. A kapcsolatok közül csak azokat tartja meg, amelyek az ágon belül két tevékenység között vannak, a típussal és a késleltetéssel együtt.

Minden más nem kerül át: a dátumok, az előrehaladás és a tényleges dátumok, az erőforrás-hozzárendelések, a kódok és az egyéni mezők (lásd [Kódok és egyéni mezők](docs://howto-codes-en-velden)), a naptár, a korlátozások és a határidők, a prioritás, az egyéni tevékenységtípus, mérföldkő esetén a típus és a *Kötelező (szerződéses)* jelölőnégyzet, valamint az ágon kívüli tevékenységekkel meglévő kapcsolatok. A beszúrás után ezeket újra meg kell adnia: az erőforrás-hozzárendelések, a kódok, a naptár és a korlátozások üresek, és minden tevékenység a projektkezdés dátumán indul.

A tevékenység, amely órában volt, napalapú tevékenységként tér vissza, az időtartama a munkanap törtrészére átszámítva. Egy 5 órás tevékenység 8 órás munkanappal 0,625 napos lesz.

## Buktatók és az alkalmazás viselkedése

**A sablonok nem tartoznak a projekthez.** Az alkalmazás ezeket az eszköz saját tárhelyén tartja, nem a projektfájlban. Ha egy kolléga megnyitja a fájlját, nem látja a sablonjait. A böngészőben futó változatban a sablon az adott böngészőhöz tartozik. Ha a sablonok fontosak, tartsa őket máshol is: tegye egy olyan projektbe, amelyet fájlként ment el.

**Ugyanaz a név többször is előfordulhat.** Ha az ágat kétszer menti el, a listában két sablon lesz ugyanazzal a névvel. Az alkalmazás nem ír felül semmit.

**A legfelső tevékenység időtartama nem számít.** Egy összefoglaló tevékenység időtartamát az altevékenységei adják, amint lefuttatja az ütemezés-számítást.

**Tevékenység erőforrás-hozzárendelésekkel célként.** Ha olyan tevékenységet jelöl ki, amelynek vannak erőforrás-hozzárendelései, de még nincsenek altevékenységei, és alá sablont szúr be, az alkalmazás megtagadja a műveletet. A tevékenység összefoglaló tevékenységgé válna, az pedig nem hordozhat hozzárendeléseket. A sablon legfelső tevékenységének már vannak altevékenységei, ezért a hozzárendeléseknek nincs hova kerülniük. Az alkalmazás ezt jelzi, és nem változtat semmit. Válasszon ilyenkor másik tevékenységet, vagy ne jelöljön ki semmit. A mérföldkő, amely sablont kap, elveszíti a mérföldkő-jelölését, és az alkalmazás üzenetben jelzi ezt.

**Érvénytelen kapcsolat a sablonban.** Ha a sablonban egy kapcsolat nem megengedett, például egy tevékenység a saját szakaszához kötődik, vagy már létezik, az alkalmazás kihagyja, és megmondja, hány kapcsolatot hagyott ki.

## Lásd még

- [A szerkezet módosítása](docs://howto-structuur-aanpassen): a beszúrt ág áthelyezése vagy behúzása.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): hozzon létre kapcsolatokat egy ágon belül, mielőtt elmenti.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mi történik a beszúrt ággal az ütemezés-számítás után.
