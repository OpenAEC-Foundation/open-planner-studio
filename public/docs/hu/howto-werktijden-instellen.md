# Munkaidő beállítása

Cél: hétköznaponként rögzíteni, hogy a naptár mely órákban dolgozik. Így az órában tervezett tevékenységek a megfelelő időben futnak.

## Mikor van erre szükség

A péntek délutánja szabad. A csapat két műszakban dolgozik, 06:00-tól 22:00-ig. Van éjszakai csapat. A szünet egy óránál rövidebb. Ha csak napokban tervez, a *Kezdés (óra)*, a *Befejezés (óra)* és a szünet elegendő ([Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen)). Ha órában tervez tevékenységeket, az alkalmazás a naptár **idősávjain** belül számolja a munkaperceket. Az alkalmazásban ezeket az idősávokat *sáv* néven nevezzük. Egy idősáv a munkaidő folytonos szakasza egy hétköznapon. A két idősáv közötti rés szünet. Hogy ez az ütemezésére nézve mit jelent, azt a [Napok és órák](docs://uitleg-dagen-en-uren) című oldal tárgyalja.

Ahhoz, hogy egy hagyományos naptárnak idősávokat adjon, be kell kapcsolnia az *Óraalapú tervezés bekapcsolása* beállítást ([Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten)). Ha a naptárnak már vannak idősávjai, például egy MS Project-fájlból, a *Munkaórák* blokk mindig látható, és az idősávokat óraalapú tervezés nélkül is módosíthatja.

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
2. Állítsa be minden idősáv kezdési és befejezési idejét a két időmezőben. Írja be az időt, és nyomja le az Enter billentyűt, vagy használja a nyilakat (lépésenként 15 perc). A mezők a beállításokban megadott *Időformátumot* követik; a *13:00* és az *1:00 PM* is működik.
3. Ha szünetet szeretne beépíteni, kattintson az adott nap **+** (*Sáv hozzáadása*) gombjára, és állítsa be az idősávok idejét úgy, hogy legyen köztük rés. Egy új idősáv 08:00-kor kezdődik és 16:00-kor végződik.
4. Ha egy idősáv éjfélen túl tart, jelölje be a *következő nap* lehetőséget. Az idősáv arra a napra számít, amelyen kezdődik.
5. Kattintson egy idősáv mögötti kukára, ha törölni szeretné. Idősáv nélküli nap így jelenik meg: *Nem munkanap*.
6. Hétköznap esetén kattintson a másolás jelre (*Másolás az összes munkanapra*), hogy az adott nap idősávjai hétfőtől péntekig érvényesek legyenek.
7. A *Munkaórák* blokk fölött van a *Szokásos munkanap*: a napi munkaidő, amelyet az alkalmazás az idősávokból számít ki, és ezzel számol. A szám azonnal változik, ha módosítja az idősávokat. Ha a naptárnak saját óraszáma van naponta (például a Primavera P6-ból), ez a saját érték megmarad, és exportáláskor is megmarad, amíg egy előbeállítás le nem cseréli. Ha ez a saját érték eltér a *Szokásos munkanap* értékétől, a szám alatt közvetlenül narancssárga doboz jelenik meg, például: *A fájlnak saját munkanapja van: 8 ó. Exportáláskor ez megmarad az MS Projectben és a P6-ban. Ott egy nap 8 órát számít, itt 10 órát.* A doboz eltűnik, amint az idősávok ugyanazt a napi összeget adják, vagy amikor egy előbeállítás lecseréli a saját értéket. A doboz nem változtatja meg a számítást. Kattintson az *Alkalmazás* gombra.

**Példa: szabad péntek délután.** Kattintson a *Beállítás hétköznaponként…* gombra. Törölje a második idősávot (13:00-tól 16:00-ig) a *P* sorban. Péntek most 5 órás, a többi nap 8 órás. A *Szokásos munkanap* 8 óra marad.

### Saját előbeállítás mentése

1. Kattintson a *Mentés előbeállításként…* gombra, és írjon be egy nevet a *Név a saját előbeállításhoz* mezőbe.
2. Kattintson a *Mentés* gombra. Az előbeállítás most a többi előbeállítás között van, és bármely projektben használhatja. A mellette lévő X jellel az előbeállítást újra eltávolítja.

A saját előbeállítás ezen az eszközön tárolódik, nem a projektfájlban.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Az előbeállítás mindent felülír.** Ha előbeállítást választ, a korábban beállított munkanapok és munkaidő eltűnnek. Az ünnepnapok megmaradnak.

**A napgombok módosítják az idősávokat.** Ha a *Munkanapok* alatt kikapcsol egy napot, az adott nap idősávjai eltűnnek. Ha újra bekapcsolja, visszakapja azokat az idősávokat, amelyek a párbeszédablak megnyitásakor voltak rajta (vagy az utolsó előbeállítás után), különben az első munkanap idősávjait. A *H–P* gomb hétfőtől péntekig ezt végzi, és eltávolítja a szombat és a vasárnap idősávjait. A *Folyamatos (24/7)* minden idősávot lecserél: minden nap 00:00-tól 24:00-ig tart.

**Munkaidő módosítása óraalapú tervezés nélkül.** Az idősávos naptárnál a *Munkaórák* blokk megmarad akkor is, ha kikapcsolja az óraalapú tervezést. Az idősávokat ott egyszerűen módosítja. Ha a *Nappali műszak* lehetőséget választja, a naptár ismét hagyományos naptár lesz, a *Kezdés (óra)*, a *Befejezés (óra)* mezőkkel és a szünettel; az idősávok visszaállítása ekkor csak óraalapú tervezéssel lehetséges.

**Nincs használható munkaidő.** Idősávok nélküli vagy munkanap nélküli naptár nem tud órában tervezett tevékenységet fogadni. Az alkalmazás ekkor ezt jelzi: *Ennek a naptárnak nincsenek érvényes munkaidői. Ellenőrizze a munkanapokat és a munkaidőket.*

## Lásd még

- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan számolja az alkalmazás a munkaórákat, és hogyan határozza meg a szokásos munkanapot.
- [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): tevékenység tervezése órában.
- [Naptárak és munkanapok](docs://uitleg-kalenders): melyik naptár melyik tevékenységre vonatkozik.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
