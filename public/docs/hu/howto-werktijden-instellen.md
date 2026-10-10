# Munkaidő beállítása

Cél: hétköznaponként rögzíteni, hogy a naptár mely órákban dolgozik. Így az órában tervezett tevékenységek a megfelelő időben futnak.

## Mikor van erre szükség

A péntek délutánja szabad. A csapat két műszakban dolgozik, 06:00-tól 22:00-ig. Van éjszakai csapat is. A szünet egy óránál rövidebb. Ha csak napokban tervez, a *Kezdés (óra)*, a *Befejezés (óra)* és a szünet elegendő ([Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen)). Ha órában tervez tevékenységeket, az alkalmazás a naptár **idősávjain** belül számolja a munkaperceket. Az alkalmazásban ezeket az idősávokat *sávoknak* nevezzük. Egy idősáv a munkaidő folytonos szakasza egy hétköznapon. A két idősáv közötti rés szünet. Hogy ez az ütemezésére nézve mit jelent, azt a [Napok és órák](docs://uitleg-dagen-en-uren) című oldal tárgyalja.

Ehhez be kell kapcsolnia az *Óraalapú tervezés bekapcsolása* beállítást ([Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten)). Óraalapú tervezés nélkül nem látja a *Munkaórák* blokkot.

## Lépések

### Műszak-előbeállítás kiválasztása

1. Válassza az *Ütemezés › Naptár › Naptár* lehetőséget, majd a bal oldalon jelölje ki a naptárat.
2. A *Munkaórák* blokkban kattintson egy előbeállításra. Ez felülírja a naptár munkanapjait és munkaidejét.
3. Kattintson az *Alkalmazás* gombra.

Minden előbeállítás az alábbit végzi:

- *Nappali műszak*: hétfőtől péntekig 08:00-tól 16:00-ig, szünet nélkül. Ezzel a naptár újra hagyományos naptár lesz, idősávok nélkül.
- *2 műszak*: hétfőtől péntekig 06:00-tól 14:00-ig és 14:00-tól 22:00-ig, összesen 16 óra.
- *3 műszak*: hétfőtől péntekig három műszak: 06:00-tól 14:00-ig, 14:00-tól 22:00-ig és 22:00-tól másnap 06:00-ig, összesen 24 óra.
- *Éjszakai műszak*: hétfőtől péntekig 22:00-tól másnap 06:00-ig, 8 óra.
- *24/7*: mind a hét napon 00:00-tól 24:00-ig.

### Munkaidő beállítása hétköznaponként

1. A *Munkaórák* blokkban kattintson a *Beállítás hétköznaponként…* gombra. A gombok alatt hétköznaponként egy sor jelenik meg a napi munkaidővel. A naptárnak most hétköznaponként vannak idősávjai. Ha a naptárnak már vannak idősávjai, ez az áttekintés azonnal nyitva van. Ekkor a gomb neve *Munkaórák elrejtése*, és a gomb összecsukja az áttekintést.
2. Állítsa be minden idősáv kezdési és befejezési idejét a két időmezőben.
3. Ha szünetet szeretne beépíteni, kattintson az adott nap **+** (*Sáv hozzáadása*) gombjára, és állítsa be az idősávok idejét úgy, hogy legyen köztük rés. Egy új idősáv 08:00-kor kezdődik és 16:00-kor végződik.
4. Ha egy idősáv éjfélen túl tart, jelölje be a *következő nap* lehetőséget. Az idősáv arra a napra számít, amelyen kezdődik.
5. Kattintson egy idősáv mögötti kukára, ha törölni szeretné. Idősáv nélküli nap így jelenik meg: *Nem munkanap*.
6. Hétfőtől péntekig terjedő nap esetén kattintson a másolás jelre (*Másolás az összes munkanapra*), hogy az adott nap idősávjai hétfőtől péntekig is érvényesek legyenek.
7. Alul található a *Számított órák/nap:* sor. Ez az alkalmazás által ebből számított nettó napi órákat mutatja. Kattintson az *Alkalmazás* gombra.

**Példa: szabad péntek délután.** Kattintson a *Beállítás hétköznaponként…* gombra. Törölje a második idősávot (13:00-tól 16:00-ig) a *P* sorban. Péntek most 5 órás, a többi nap 8 órás. A napi számított órák értéke 8 marad.

### Saját előbeállítás mentése

1. Kattintson a *Mentés előbeállításként…* gombra, és írjon be egy nevet a *Név a saját előbeállításhoz* mezőbe.
2. Kattintson a *Mentés* gombra. Az előbeállítás most a többi előbeállítás között van, és bármely projektben használhatja. A mellette lévő X jellel az előbeállítást újra eltávolítja.

A saját előbeállítás ezen az eszközön tárolódik, nem a projektfájlban.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Az előbeállítás mindent felülír.** Ha előbeállítást választ, a korábban beállított munkanapok és munkaidő eltűnnek. Az ünnepnapok megmaradnak.

**A napgombok és az idősávok két különböző dolog.** A *Munkanapok* alatti gombok nem változtatják meg az idősávokat. Egy nap úgy kap munkaidőt, hogy az adott napra kattint a *Sáv hozzáadása* gombra. Ha csak a gombbal kapcsol be egy napot, ez napokban tervezett tevékenységeknél számít, órában tervezett tevékenységeknél nem. Ha a naptárnak van munkaideje, használja a hétköznaponkénti sorokat.

**Munkaidő módosítása óraalapú tervezés nélkül.** Ha kikapcsolja az óraalapú tervezést, visszatérnek a *Kezdés (óra)*, a *Befejezés (óra)* mezők és a szünet. Idősávos naptárnál ezek nem változtatják meg az idősávokat. Ezért a munkaidőt mindig akkor módosítsa, ha az óraalapú tervezés be van kapcsolva.

**Nincs használható munkaidő.** Idősávok nélküli vagy munkanap nélküli naptár nem tud órában tervezett tevékenységet fogadni. Az alkalmazás ekkor ezt jelzi: *Ennek a naptárnak nincsenek érvényes munkaidői. Ellenőrizze a munkanapokat és a munkaidőket.*

## Lásd még

- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan számolja az alkalmazás a munkaórákat, és hogyan határozza meg a napi nettó órákat.
- [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): tevékenység tervezése órában.
- [Naptárak és munkanapok](docs://uitleg-kalenders): melyik naptár melyik tevékenységre vonatkozik.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
