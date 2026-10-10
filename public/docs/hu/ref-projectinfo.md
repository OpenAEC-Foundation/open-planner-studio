# Új projekt és Projektinfó

Az *Új projekt* ablak és a *Projektinfó* mezői: mit csinál egy mező, mi az alapértelmezett érték, és hol lép érvénybe. Ez ugyanannak az űrlapnak két oldala. Az *Új projekt* új projektet hoz létre, és néhány extra mezője van. A *Projektinfó* a megnyitott projektet módosítja.

## Megnyitás

**Új projekt** — *Fájl › Új*, Ctrl+N, vagy a plusz jel a dokumentumlapok jobb oldalán (*Projekt indítása*, majd *Új projekt*). Az ablak úgy nyílik meg, hogy a kurzor a *Projektnév* mezőben van.

**Projektinfó** — a *Beállítások › Projekt › Projektinfó* az űrlapot *Projektadatok* címmel ellátott ablakban nyitja meg. A *Fájl › Projektinfó* ugyanezt az űrlapot mutatja a *Fájl* képernyőn. A *Számítási profil és beállítások* blokk mindkét helyen alul van. Hogy mi van benne, azt itt olvashatja: [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies).

## Létrehozás, Alkalmazás és Mégse

**Létrehozás** (az *Új projekt* ablakban) létrehozza a projektet, és saját lapon nyitja meg. **Alkalmazás** (a *Projektinfó* ablakban) rögzíti a módosításokat a projektben.

- **Csak az Alkalmazásnál.** Ön vázlatba ír. A projekt csak akkor változik, ha az *Alkalmazás* gombra kattint. Az *Alkalmazás* csak azt rögzíti, amit valóban módosított, egy lépésben, amelyet a *Visszavonás* paranccsal lehet visszavonni. Ha az *Alkalmazás* gombra kattint, de nem módosított semmit, nem történik semmi, és nem kerül be új lépés.
- **Mégse, a kereszt és az Esc** bezárja az ablakot, és nem ment semmit. Ha az ablak mellé kattint, az ablak nem záródik be. A beírt szöveg megmarad.
- Az **Enter** ugyanazt teszi, mint a *Létrehozás* vagy az *Alkalmazás*, kivéve a *Leírás* mezőben és egy megnyitott legördülő listában.
- **A Fájl képernyőn** a *Projektinfó* alul ezt mutatja: *A módosítások nincsenek alkalmazva — a megtartásukhoz kattintson erre: Alkalmazás.* Ez addig látszik, amíg a vázlata eltér. Ha ezután elhagyja a képernyőt, az alkalmazás megkérdezi, hogy Ön alkalmazza, elveti vagy megszakítja-e a módosításokat. Lásd: [A menüszalag, lapról lapra](docs://ref-lint).
- **Egyéni számítási profil név nélkül** blokkolja az *Alkalmazás* és a *Létrehozás* műveletet. Adjon neki nevet, vagy vesse el a módosítást.

## Mezők mindkét ablakban

**Projektnév** — a projekt neve a címsorban, a lapon és mentéskor a fájlnévben. Alapértelmezett: üres. Egy üres mező megengedett: a projekt neve ekkor *Új ütemezés*, szürke szövegként a mezőben. Hol: a teljes képernyőn.

**Leírás** — szabad szöveg. Alapértelmezett: üres. Hatás: a projekttel együtt tárolódik, az IFC-fájlban és a Primavera P6 XML-exportban. Nincs hatása az ütemezésre.

**Szerző** — szabad szöveg. Alapértelmezett: üres. Hatás: az IFC-fájlba kerül, és a jelentés fejlécében *Szerző:* néven jelenik meg, ahol nem írhatja át.

**Erőforrástár** — az erőforrástár, amelyhez a projekt kapcsolódik. Válasszon ezek közül: *nincs erőforrástár (önálló projekt)*, a meglévő erőforrástárai, vagy *+ Új erőforrástár…*. Alapértelmezett: az *Új projekt* ablakban az alapértelmezett erőforrástár, a *Projektinfó* ablakban a jelenlegi kapcsolat. Hatás: lásd [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken). A *+ Új erőforrástár…* választásakor egy alul lévő mezőbe írja be a nevet. Az erőforrástár csak a *Létrehozás* vagy az *Alkalmazás* gombra kattintva jön létre, így a megszakítás nem hagy semmit hátra. A *Projektinfó* ablakban a kapcsolat csak akkor változik, ha Ön maga módosítja ezt a mezőt.

**Ügyfél/szervezet** — szabad szöveg. Alapértelmezett: üres. Hatás: az IFC-fájlba kerül, és a jelentés fejlécében *Cég:* néven jelenik meg.

**Kezdődátum** — a projekt kezdete. Alapértelmezett: az *Új projekt* ablakban a mai nap. Hogy mit csinál a mező, azt az alábbi *Mit csinál a kezdődátum* részben találja.

**Befejezési dátum** — a projekt tervezett befejezése. Alapértelmezett: üres. Hatás: információ, nem követelmény. Az alkalmazás nem ehhez a dátumhoz igazítja az ütemezést. Megjelenik a jelentés fejlécében és az exportokban, és meghatározza, hogy az ünnepnapok mely évig generálódnak. Csak Primavera-fájl esetén fut a tartalékidő-számítás eddig a dátumig, a *Tartalékidő ütemezés-számítása a projektbefejezési dátumig* beállítással (lásd [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies)).

**Alapértelmezett egység új tevékenységekhez** — csak akkor látható, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Válasszon a *Napok* és az *Órák* közül. Alapértelmezett: *Napok*. Hatás és feltételek: lásd [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).

**Számítási profil és beállítások** — a *Projektinfó* ablakban a teljes blokk. Az *Új projekt* ablakban csak a *Számítási profil* legördülő lista, a *Primavera P6*, a *Microsoft Project* és az *Open Planner Studio* lehetőségekkel. Alapértelmezett: *Open Planner Studio*. Profil választásakor a program a profil alapértelmezett beállításait is beállítja. Lásd: [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies).

## Csak az Új projekt ablakban

**Fázissablon** — a fázisok, amelyekkel a projekt indul. Válasszon az *Üres*, a *Lakóépítés* és a *Nem lakó célú építés / felújítás* közül. Alapértelmezett: *Üres*. Hatás: az *Üres* beállítás tevékenységek nélküli projektet ad. A másik két sablon nyolc fázis-tevékenységet készít elő. Mindegyik időtartama 5 a projekt alapértelmezett egységében: 5 munkanap, vagy 5 óra, ha az *Alapértelmezett egység új tevékenységekhez* beállításnál az *Órák* lehetőséget választja. Kapcsolatok nincsenek közöttük. Ezeket Ön átnevezheti, áthelyezheti és bővítheti. A *Lakóépítés* esetén ezek: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking és Oplevering. A *Nem lakó célú építés / felújítás* esetén: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen és Oplevering. A nevek a projekt adatai, és a felület más nyelvén is hollandul maradnak. Ha az *Építési mód bekapcsolása* ki van kapcsolva, csak az *Üres* sablon létezik. Lásd: [Beállítások](docs://ref-instellingen).

**Műszak** — csak akkor látható, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Válasszon a *Nappali műszak*, a *2 műszak*, a *3 műszak* és a *24/7* közül. Alapértelmezett: *Nappali műszak*. Hatás: a *Nappali műszak* a szabványos naptárat hagyja érintetlenül, egy hétköznapi nappali naptárral, hétfőtől péntekig. A másik három idősávokat helyez el a projekt naptárába, ugyanúgy, mint a *Naptárak* ablakban az azonos nevű gombok. Hogy melyek ezek az időpontok, azt a [Munkaidő beállítása](docs://howto-werktijden-instellen) oldalon olvashatja. A *Nappali műszak* esetén az *Órák* nem választható az *Alapértelmezett egység új tevékenységekhez* beállításnál, mert egy nappali naptárban nincsenek munkaidő-idősávok.

**Ünnepnaplista** — mely szabadnapok kerülnek a projekt naptárába. Az *Ország* beállításnál válasszon a *Hollandia* (alapértelmezett), *Németország*, *Belgium*, *Franciaország*, *Egyesült Királyság*, *Ausztria*, *Svájc*, *Nincs ünnepnap* vagy *Egyéni…* közül. Ha az országnak vannak régiói, megjelenik a *Régió* legördülő lista. Hollandia esetén, ha az *Építési mód bekapcsolása* be van kapcsolva, Ön emellett kiválasztja az *Építőipari szabadság* beállítást: *Nincs* (alapértelmezett), *Észak*, *Közép* vagy *Dél*. Alatta olyan sor látszik, mint *36 ünnepnap, 2025–2029*. Ezt kibontva látja a listát. Az évek a kezdődátum előtti évtől a befejezési dátum utáni évig tartanak. Ha nincs befejezési dátum, a kezdési év után három évig. Az *Egyéni…* egy ünnepnapok nélküli naptárat ad, és a létrehozás után közvetlenül megnyitja a *Naptárak* ablakot, hogy Ön maga ki tudja tölteni az ünnepnapokat. A projekt naptárának neve *Bouwkalender NL*, vagy *Standaardkalender*, ha az *Építési mód bekapcsolása* ki van kapcsolva. Ekkor a *Nincs ünnepnap* is választható. Hogy a generátor hogyan működik, azt a [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren) oldalon olvashatja.

## Mit csinál a kezdődátum

A kezdődátum a projekt kiindulópontja. Három szabály van:

- **Az új tevékenységek a kezdődátumon kezdődnek.** Egy hozzáadott tevékenység a projektkezdést kapja tervezett kezdésként.
- **Egy tevékenység, amelynek van elődje, soha nem kezdődik a kezdődátum előtt.** Ha az előd befejezése korábbi, a tevékenység a kezdődátumig vár. Egy tevékenység, amelynek *nincs* elődje, megtartja a saját dátumát, akkor is, ha az a kezdődátum előtt van. Erre azért van szükség, hogy egy MS Project- vagy Primavera-ütemezés úgy jelenjen meg, ahogy a forrásprogram mutatja. Egy *Kötelező kezdés (MSO)* vagy *Kötelező befejezés (MFO)* korlátozás mindkét szabályt megtöri: az ilyen tevékenység a saját dátumán marad, akkor is, ha az a kezdődátum előtt esik.
- **A későbbi kezdődátum a kötetlen tevékenységeket is odébb viszi.** Ha a kezdődátumot később állítja be a *Projektinfó* ablakban, és az *Alkalmazás* gombra kattint, akkor azok a tevékenységek, amelyeknek nincs elődjük, és nincs olyan korlátozásuk, amely alsó határt állít (*Nem korábban kezdődő*, *Kötelező kezdés*, *Nem korábban befejeződő* vagy *Kötelező befejezés*), arra a dátumra kerülnek, ha az új dátum előtt lennének. Ez ugyanabban a lépésben történik, amelyet a *Visszavonás* parancs visszavon. Az alkalmazás jelzi, hány tevékenységet mozgatott. Ez csak akkor történik meg, ha Ön maga módosítja a kezdődátumot, soha nem fájl megnyitásakor. A kezdődátum későbbre állítása nem mozdítja el az ütemezés többi részét. Ezt a *Projekt áthelyezése* végzi, lásd [Projekt áthelyezése](docs://howto-project-verplaatsen).

## Lásd még

- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): a *Számítási profil és beállítások* blokk.
- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): miért változtatja meg a profil az eredményt.
- [Projekt áthelyezése](docs://howto-project-verplaatsen): a teljes ütemezés másik kezdődátummal.
- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): az első tevékenységek felvétele.
- [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren): az ünnepnaplista részletesen.
