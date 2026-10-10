# Útvonalkövetés

Cél: egy tevékenység előtti vagy utáni tevékenységek láncát láthatóvá tenni. Így látja, mi határozza meg egy tevékenység dátumát, és mi tolódik el, ha az késik.

## Mikor van erre szükség

A tetőfedés csak három hét múlva kezdődik. Azt szeretné tudni, melyik tevékenység határozza meg ezt. Vagy a falazó egy hetet késik, és Ön látni szeretné, mely későbbi tevékenységek tolódnak el emiatt. Több tucat kapcsolatot tartalmazó ütemezésben ezt a vonalakból nem lehet látni. Az **útvonalkövetés** bekapcsolása esetén az alkalmazás az összes **elődöt** (a kiválasztott tevékenység előtt álló tevékenységek, közvetlenül vagy más tevékenységeken át) és az összes **utódot** (a kiválasztott tevékenység után következő tevékenységek) színezi. A többit halványítja.

## Lépések

1. Jelölje ki azt a tevékenységet, amelynek az útvonalát látni szeretné, a tevékenységtáblázatban vagy a Gantt-diagramban a sávján. Ha több tevékenységet jelöl ki, az alkalmazás azt a tevékenységet veszi alapul, amelyet először jelölt ki.
2. Válassza az *Ütemezés › Útvonalkövetés › Elődök* lehetőséget, ha a tevékenység előtti összes tevékenységet látni szeretné. Válassza az *Ütemezés › Útvonalkövetés › Utódok* lehetőséget, ha a tevékenység utáni összes tevékenységet látni szeretné. Mindkét gomb egyszerre is bekapcsolható. Ugyanez a két gomb megtalálható a *Táblázat* lapon, az *Útvonalkövetés* csoportban.
3. Ha mindkét irányt egyszerre szeretné látni, kattintson a tevékenységre jobb gombbal a Gantt-diagramban vagy a tevékenységtáblázatban, és válassza az *Útvonalkövetés* lehetőséget.
4. Nézze meg az eredményt a Gantt-diagramban és a tevékenységtáblázatban. Az olvasásának módját alább ismertetjük.
5. Az útvonalkövetést úgy állíthatja le, hogy újra az aktív gombra kattint. Az is lehetséges, hogy jobb gombbal kattint egy tevékenységre, és az *Útvonalkövetés leállítása* lehetőséget választja. Ezt az Esc billentyűvel is megteheti. Az Esc a kijelölést is törli.

Ha az útvonalkövetés közben másik tevékenységet jelöl ki, az útvonal az új kijelöléshez igazodik.

## Az eredmény olvasása

- Az elődök aranyszínűek, az utódok lilák. A Gantt-diagramban a sávok színe változik. A tevékenységtáblázatban a sor bal oldalán csík jelenik meg: folytonos csík az elődöknél, szaggatott csík az utódoknál. A kiválasztott tevékenység körvonalat kap.
- Egy sötétebb szín, a tevékenységtáblázatban pedig vastagabb csík és félkövér szöveg jelzi a **meghatározó kapcsolatok** láncát: azokat a kapcsolatokat, amelyek valóban meghatározzák a dátumokat. Hogy ez mit jelent, azt a [Kapcsolatok és késleltetés](docs://uitleg-relaties) ismerteti.
- Az útvonalon kívüli összes tevékenység halvány lesz. Az útvonalhoz nem tartozó kapcsolatvonalak halványabbak és pontozottak.

## Buktatók és az alkalmazás viselkedése

**Nincs kijelölt tevékenység.** Kijelölt tevékenység nélkül nincs mit követni: a gomb be van kapcsolva, de a képernyőn semmi sem változik. Először jelöljön ki egy tevékenységet.

**Nincs kiemelés a meghatározó kapcsolatok láncán.** A kiemelés az utolsó számításból származik. Ha az ütemezést még nem számolták ki, vagy a számítás hibát ad, az alkalmazás az összes elődöt és utódot egyformán erősen színezi. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* lehetőséggel, és nézze meg újra az útvonalat. Egy módosítás után a kiemelés továbbra is az előző számításhoz tartozik, amíg az állapotsor az *Elavult — újraszámítsa (F5)* üzenetet mutatja.

**Kapcsolat egy szakaszon.** Az útvonalkövetés azokat a kapcsolatokat követi, ahogyan Ön felvette őket. Egy szakasz (összefoglaló tevékenység) felé vagy onnan induló kapcsolat magát a szakaszt köti össze. A számításban ez a kapcsolat a szakasz minden tevékenységére vonatkozik, de az útvonal nem folytatódik a benne lévő tevékenységekig. Ha egy szakaszon belüli tevékenységet követ nyomon, amely a szakasz saját kapcsolatán keresztül egy másik tevékenységhez kapcsolódik, akkor ezt a kapcsolatot nem látja. Ebben az esetben jelölje ki magát a szakaszt.

**Csak a kiválasztott irány.** Ha csak az *Elődök* gomb van bekapcsolva, nem látja, mi következik a tevékenység után, és fordítva.

## Lásd még

- [Kapcsolatok és késleltetés](docs://uitleg-relaties): miért meghatározó egy kapcsolat, és hogyan számítja ki az alkalmazás egy tevékenység kezdődátumát.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): melyik lánc határozza meg a projekt befejezését.
- [Kapcsolatok felvétele](docs://howto-relaties-leggen): kapcsolat felvétele, ha az útvonalon hiányzik egy összeköttetés.
