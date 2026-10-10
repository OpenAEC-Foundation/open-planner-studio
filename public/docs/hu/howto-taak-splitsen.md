# Tevékenység megszakítása

Cél: szünetet adni egy tevékenységbe úgy, hogy a munka leálljon, és később folytatódjon, anélkül hogy két tevékenységgé válna.

## Mikor van erre szükség

A vasalás lerakása nyolc munkanapot vesz igénybe. Négy nap után azonban a darunak másik munkára kell mennie. A munka két nappal később folytatódik. Két külön tevékenység létrehozása azt jelentené, hogy a kapcsolatokat és a hozzárendeléseket kétszer kell karbantartani. Egy **szünettel** a tevékenység egy marad, egy sávval, amelyben rés van. Az alkalmazás ugyanezt a fogalmat *szünet* néven is ismeri.

A munka hossza ugyanaz marad, de a tevékenység a naptáron tovább tart. Példa: egy 8 munkanapos tevékenység, amely 2026. szeptember 29-én, kedden kezdődik, október 8-án, csütörtökön fejeződik be. Ha 4 munkanap után 2 munkanapos szünetet ad meg, a befejezés október 12-én, hétfőn lesz. Az időtartam 8 munkanap marad, csak a befejezés mozdul el két munkanappal.

## Lépések

### Megszakítás a Gantt-diagramban

1. Válassza a *Kezdőlap › Tevékenységek › Tevékenység megszakítása* lehetőséget (vagy *Ütemezés › Kapcsolatok › Tevékenység megszakítása*). Az ütemezés fölött megjelenik ez az értesítés: *Kattintson arra a sávra azon a napon, amelyen a szünet kezdődik, majd húzzon jobbra a hosszához. Az Esc leállítja*. A gomb a *Táblázat* fülön is látható (*Táblázat › Tevékenységek › Tevékenység megszakítása*), de ott le van tiltva.
2. Vigye az egeret a sáv fölé. Egy szaggatott vonal és a dátumot mutató címke jelzi, hol kezdődne a szünet. Nyomja le a sávon, azon a napon, amelyen a szünet kezdődik.
3. Húzzon jobbra. A címke mutatja a hosszát, például *2 munkanap szünet*: a munkanapok száma az egér alatti napig. Engedje el.

Ha csak kattint, húzás nélkül, a szünet egy munkanap lesz. Ha balra húzza vissza, a szünet ismét rövidebb lesz, legalább egy munkanapig. Órában megadott tevékenységnél a szünet órában működik.

A mód bekapcsolva marad, így további tevékenységeket is megszakíthat. Az Esc billentyűvel vagy az értesítésben lévő *Leállítás* gombbal lép ki. Ha húzás közben megnyomja az Esc billentyűt, az alkalmazás visszavonja a szünetet, és a mód leáll. Minden mozdulat egy lépésként visszavonható a *Visszavonás* paranccsal.

A megszakítás után az ütemezés már nem naprakész. Nyomja meg az **Ütemezés-számítás** (F5) parancsot a végső dátumokért.

### Meglévő szünet húzása a Gantt-diagramban

Ez megszakítási mód nélkül is működik, közvetlenül azon a sávon, amelyen szünet van.

- Húzza a szünet **utáni** részt jobbra vagy balra. A szünet hosszabb vagy rövidebb lesz, a címke: *3 munkanap szünet*. Ha addig húzza vissza, amíg a szünet 0 lesz, a címkén az *Összevonás* látszik, és a két rész ismét egy lesz.
- Húzza a szünet **előtti** rész jobb szélét. Ez a rész hosszabb vagy rövidebb lesz, a címkén *Rész: 5 munkanap* látszik. A tevékenység időtartama ezzel együtt változik.
- Ha az első részt húzza, az egész tevékenységet mozgatja, mint minden más sávot.

### Megszakítás és módosítás a Tulajdonságok panelen

Jelölje ki a tevékenységet. A *Tulajdonságok* panelen a *Szünetek* blokk a *Kapcsolatok* alatt és a *Hozzárendelések* felett van. Ha kell, görgessen oda.

- A *Szünet hozzáadása* gomb egy munkanapos szünetet helyez el a leghosszabb rész közepére.
- Minden szünetnek két mezője van: *után* (hány munkanap munka van a szünet előtt) és *szünet* (a szünet hossza). Mellettük a szünet utáni rész dátumai látszanak. Óraalapú tevékenységnél az értékek órában látszanak.
- Ha a *szünet* mezőt 0-ra állítja, a szünet megszűnik. A kis kuka (*Szünet megszüntetése*) ugyanezt teszi.

Legyen óvatos az *után* mezővel: ez a szünet előtti munkarészt hosszabbítja vagy rövidíti, és vele az egész tevékenység időtartamát. A *szünet* mezővel csak a befejezés változik.

### Szünet eltávolítása

Kattintson jobb gombbal a szünetre a Gantt-diagramban, vagy a mögötte lévő részre, és válassza a *Szünet megszüntetése* lehetőséget. Az *Összes szünet megszüntetése* a jobb gombbal megnyíló menüben van minden olyan sávon, amelynek van szünete. Vagy használja a *Szünetek* blokkot a *Tulajdonságok* panelen, ahogy fent leírtuk.

### AI-segítőtárs használatával

Egy csatlakoztatott AI-segítőtárs a `planner_set_task_splits` eszközzel állít be szüneteket, ugyanabban a formában, mint a panel: hány munkanap (vagy munkaóra) munka után, és hány munkanap (vagy munkaóra) szünet. Mindig a teljes listát küldi el; egy üres lista minden szünetet eltávolít. A szüneteket a `planner_get_task` eszközzel olvassa vissza. Ugyanazok a szabályok érvényesek, mint lent: olyan tevékenységet, amelyet nem lehet megszakítani, az AI-segítőtárs sem tud megszakítani. Ellentétben a kézi megszakítással, az alkalmazás a művelet után magától újraszámítja az ütemezést. Az AI-segítőtárs csatlakoztatását az [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen) ismerteti.

## Buktatók és mit tesz az alkalmazás

**Nem minden tevékenység szakítható meg.** Ezeket nem lehet megszakítani: mérföldkő, összefoglaló tevékenység, az a tevékenység, amelyen a *Hangmat (származtatott időtartam)* be van kapcsolva (lásd [Hangmat létrehozása](docs://howto-hammock)), az a tevékenység, amelynek időtartamtípusa *Eltelt időtartam*, a *Kézzel ütemezett* tevékenység, és a két munkanapnál rövidebb tevékenység. Megszakítási módban az egér tiltó kurzort mutat, és nem történik semmi. Ilyen tevékenységnél a *Szünetek* blokk a *Tulajdonságok* panelen szintén hiányzik.

**A Táblázat fülön a gomb nem működik.** A *Tevékenység megszakítása* gomb ott le van tiltva, súgószövege: *Csak akkor érhető el, ha a Gantt-diagram látható*. A művelethez egy sáv kell. A megszakítási mód és az összekapcsolási mód kikapcsolják egymást.

**Kattintás hatás nélkül.** Szünet nem kezdődhet a tevékenység első napján, és nem lehet egy meglévő szünet belsejében. Minden munkarésznek is legalább egy munkanap hosszúnak kell maradnia. Ha ilyen helyre kattint, semmi nem történik, és nincs üzenet.

**Tevékenység előrehaladással.** Ha a tevékenységnek van előrehaladása, szünet csak a már elkészült munka után kezdődhet. 8 munkanap 50%-ánál ez legkorábban az ötödik munkanap. Az elkészült részre kattintva semmi nem történik. A 100%-ban elkészült tevékenységet nem lehet tovább megszakítani. A panelen ilyenkor a *Szünet hozzáadása* gomb le van tiltva. Ez akkor is így van, ha a leghosszabb rész közepe elkészült munkára esik, például 8 munkanap 75%-ánál.

**A kiegyenlítés is létrehoz szüneteket.** Ezek a *Szünetek* blokkban a *kiegyenlítés* címkével jelennek meg. Az *Erőforrások › Kiegyenlítés › Kiegyenlítés törlése* eltávolítja őket. Ha szerkeszti egy ilyen tevékenység szüneteit, a kiegyenlítési szünetek kézi szünetekké válnak, és a *Kiegyenlítés törlése* nem távolítja el őket többé.

**A szünetek nem kerülnek át az MS Projectbe vagy a Primaverába.** Ha *MS Project XML* vagy *Primavera P6 XML* formátumba exportál, a program a szünetet csak egy hozzárendelés munkaeloszlásaként ismeri. Ilyen eloszlás nélkül a tevékenység szünet nélkül érkezik meg, és az alkalmazás jelzi, hány ilyen tevékenység van: *1 szünetes tevékenység szünetek nélkül lett exportálva. Az MS Project és a P6 csak munkaeloszlásként ismeri a szüneteket*. Az alkalmazás IFC-fájljában ezek megmaradnak.

**Fájl olyan szünetekkel, amelyeket az alkalmazás nem tud szerkeszteni.** A forrásfájl szünetei, amelyek nem illenek az alkalmazás formájába, a panelen ezt az üzenetet mutatják: *Ezek a szünetek a forrásfájlból származnak olyan formában, amelyet itt nem lehet szerkeszteni*, és csak az *Összes szünet megszüntetése* gomb érhető el.

## Lásd még

- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan számítja az ütemezés a munkanapokat, és miért mozdul el a befejezés.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): egy másik mód a Gantt-diagramban, amelyet sáv húzásával használ.
- [Tevékenységpárbeszédablak és tulajdonságok panel](docs://ref-taak-eigenschappen): a Szünetek szakasz a tulajdonságok panelen.
