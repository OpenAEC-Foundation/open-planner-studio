# Projekt áthelyezése

Cél: az egész ütemezés eltolása új kezdődátumra, és előre látni, mi történik a befejezéssel.

## Mikor van erre szüksége

Az építkezés kezdete eltolódik: az engedély később érkezik, vagy egy korábbi ház ütemezését használja újra a következő házhoz. Minden tevékenységet egyenként áthelyezni sok időt vesz igénybe. A **Projekt áthelyezése** paranccsal egyetlen új kezdődátumot ad meg, és az alkalmazás mindent vele együtt eltolja.

A projektbefejezés nem mindig ugyanannyival tolódik el, mint a projektkezdés. A **naptár** nem tolódik el: az ünnepnapok, az építőipari szabadság és a téli leállás rögzített dátumokon marad. Példa: a *Kezdőlap › Fájl › Új* paranccsal hoz létre egy projektet, amelynek *Kezdési dátum* mezője 29-09-2026, az *Ország* mezője *Hollandia*, az *Építőipari szabadság* mezője pedig *Nincs*. Vegyen fel egy 30 munkanapos ütemezést, amely 2026. november 9-én fejeződik be. Ha 2026. december 14-ére helyezi át, vagyis 76 naptári nappal később, a projekt 2027. január 26-án fejeződik be. Ez 78 nappal később van, mert december 25. és január 1. most már nem munkanap az ütemezésén belül. Az időtartam 30 munkanap marad. Az ablakban látható előnézet ezt megmutatja, mielőtt bármit módosítana.

## Lépések

1. Válassza az *Ütemezés › Ütemezés › Projekt áthelyezése…* lehetőséget. A gomb nem használható, amíg a projektnek nincs kezdődátuma.
2. A *Jelenlegi projektkezdés* alatt látja, hol kezdődik most a projekt. Az *Új projektkezdés* alatt válassza ki az új dátumot.
3. Ha a projektben van alapterv, megjelenik az *Alapterveket is eltolja* jelölőnégyzet. Hagyja kikapcsolva, ha az eltolást eltérésként szeretné látni (tekintse meg a buktatókat).
4. Kattintson az *Előnézet ütemezés-számítása* gombra. Az alkalmazás teljesen kiszámítja az eltolt ütemezést, a projekt módosítása nélkül.
5. Nézze meg az előnézetet (lent). Ha az megfelelő, kattintson az *Áthelyezés* gombra.

Az előnézetben ezeket látja:

- az eltolás naptári napokban (*Eltolás: 76 naptári nappal később*);
- a *Projektkezdés* és a *Projektbefejezés* az eltolás előtt és után;
- piros figyelmeztetés, ha a naptár zavart okoz, vagy üzenet arról, hogy a projekt időtartama ugyanaz marad;
- az eltolt tevékenységek száma, és az, hogy mi más tolódik el velük;
- figyelmeztetések, amelyeket érdemes elolvasni (tekintse meg a buktatókat).

Az alkalmazás az új ütemezést azonnal kiszámítja, ezért nem kell az **Ütemezés-számítás** (F5) parancsot használnia. A nézet az egész projektre igazodik. Az egész művelet egyetlen lépésként vonható vissza a *Visszavonás* (Ctrl+Z) paranccsal.

Az *Áthelyezés* gomb csak hibamentes előnézet után működik, és csak akkor, ha az új dátum eltér a jelenlegitől. Ha módosítja a dátumot vagy a jelölőnégyzetet, az előnézet eltűnik, és újra ki kell számítania.

### Mi tolódik el, és mi nem

Ez tolódik el: minden tevékenység kezdése és befejezése, a tényleges kezdés és a tényleges befejezés, a korlátozások dátumai (beleértve a szigorú Mandatory rögzítést; tekintse meg: [Korlátozások és határidők](docs://uitleg-constraints)), a határidők, az állapotdátum, a projektközi kapcsolatok horgonyai és az erőforrások rendelkezésre állási lépései. A projektkezdés, és ha kitöltötte, a projektbefejezés dátuma is eltolódik.

Ez nem tolódik el:

- a naptárak, vagyis az ünnepnapok, az építőipari szabadság és a téli leállás;
- az alaptervek, kivéve ha bekapcsolja az *Alapterveket is eltolja* jelölőnégyzetet;
- egy kitöltött egyéni mező, amelynek típusa *Dátum*.

## Buktatók és az alkalmazás válasza

**A befejezés más számú nappal tolódik el.** Ha az előnézet azt látja, hogy a befejezés a kezdésnél több vagy kevesebb naptári nappal tolódik el, vagy hogy a projekt időtartama munkanapban változik, piros figyelmeztetést mutat a számokkal. Ekkor még mindig visszaléphet.

**Az alaptervek a helyükön maradnak.** Az alapterv az eltérés mérésére szolgál. Ha a jelölőnégyzet ki van kapcsolva, és áthelyezi a projektet, az eltolást eltérésként látja az alaptervhez képest. Ha bekapcsolja a jelölőnégyzetet, az alaptervek az ütemezéssel együtt tolódnak el. Csak a dátumaik tolódnak el; az a dátum, amikor az alaptervet elmentette, nem tolódik el.

**Folyamatban lévő projekt.** A tényleges dátumok is eltolódnak. Olyan projektben, ahol már rögzített az előrehaladás, ez nem mindig az, amit szeretne. Az alkalmazás figyelmeztet: *Ellenőrizze, hogy ez helyes-e egy folyamatban lévő projektnél.*

**Projektközi kapcsolatok.** A horgony a saját projektjében eltolódik, a forrásprojekt nem. Áthelyezés után frissítse a kapcsolatokat a *Kezdőlap › Tevékenységek › Kapcsolat ▾ › Összes projektközi kapcsolat frissítése* lehetőséggel. Tekintse meg: [Projektközi kapcsolatok egy másik projekthez](docs://howto-externe-relaties).

**Ünnepnapok, amelyek nem érnek elég messzire.** Egy naptár generált ünnepnapjai több évet fednek le. Ha az áthelyezett ütemezés ezen túl fut, az alkalmazás az adott évet ünnepnapok nélkül számítja ki. Az előnézet erre figyelmeztet, például: *A(z) „Bouwkalender NL” naptár generált ünnepnapjai a(z) 2025–2029 időszakot fedik le. Az áthelyezett ütemezés 2030-ig tart. Generálja újra az ünnepnapokat.* Először helyezze át a projektet. Ezután nyissa meg az *Ütemezés › Naptár › Naptár* menüpontot: az ünnepnapok mellett most az *Újragenerálás* felirat áll. Erősítse meg az *Alkalmazás* gombbal, és az alkalmazás újraszámít. Az új ünnepnapok tartománya a projekt dátumait követi, ezért az áthelyezés előtti újragenerálás nem segít.

**A dátum a múltban van.** Ez megengedett, de az előnézet megemlíti: *Az új kezdődátum a múltban van.*

**A projektkezdés módosítása a Projektinfóban más dolog.** Ha módosítja a kezdődátumot a *Beállítások › Projekt › Projektinfó* menüpontban, és az *Alkalmazás* gombot választja, az ütemezés nem tolódik el. Csak azok a tevékenységek tolódnak az új dátumra, amelyeknek nincs előde, vagy nincs olyan korlátozásuk, amely miatt az új kezdés elé kerülnének. Az alkalmazás megmondja, hány ilyen tevékenység van. Ha mindent el szeretne tolni, használja a *Projekt áthelyezése…* parancsot.

## Lásd még

- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan számítja ki az ütemezés, és miért tolódik el a befejezés.
- [Kapcsolatok létrehozása](docs://howto-relaties-leggen): áthelyezéskor a kapcsolatok egyszerűen a helyükön maradnak.
- [Új projekt és Projektinfó](docs://ref-projectinfo): mit csinál a kezdődátum a Projektinfóban.
