# Új projekt és Projektbeállítások

Az *Új projekt* ablak és a *Projektbeállítások* mezői: mit csinál az egyes mező, mi az alapértelmezett érték, és hol lép érvénybe. A kettő ugyanannak az űrlapnak két oldala. Az *Új projekt* új projektet hoz létre, és néhány extra mezője van. A *Projektbeállítások* a megnyitott projektet módosítja.

## Megnyitás

**Új projekt** — *Fájl › Új*, Ctrl+N, vagy a dokumentumfülek jobb oldalán lévő plusz jel (*Projekt indítása*, majd *Új projekt*). Az ablak megnyílik, a kurzor a *Projektnév* mezőben áll.

**Projektbeállítások** — a *Beállítások › Projekt › Projektbeállítások* menüpont a *Projektbeállítások* című ablakban nyitja meg az űrlapot. A *Fájl › Projektbeállítások* ugyanezt az űrlapot mutatja a *Fájl* képernyőn. A *Számítási profil és beállítások* blokk mindkét helyen alul van. Hogy mi van benne, azt itt olvassa el: [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies).

## Létrehozás, Alkalmazás és mégse

**Létrehozás** (az *Új projekt* ablakban) hozza létre a projektet. Ha az aktuális fül üres és nem módosított, az alkalmazás ezt a fület használja. Egyébként a projekt új fülön nyílik meg. **Alkalmazás** (a *Projektbeállítások* ablakban) írja a módosításokat a projektbe.

- **Csak az Alkalmazásnál.** Ön a vázlatba ír. A projekt csak akkor változik, ha az *Alkalmazás* gombra kattint. Az *Alkalmazás* csak azt írja be, amit ténylegesen módosított, egyetlen lépésként a *Visszavonás* előzményei közé. Ha az *Alkalmazás* gombra kattint úgy, hogy nem módosít semmit, nem történik semmi, és nem kerül új lépés az előzményekbe.
- **Mégse, a kereszt és az Esc** zárja be az ablakot úgy, hogy semmit nem ment el. Az ablak melletti kattintás nem zárja be: a korábban beírt adatok megmaradnak.
- **Enter** ugyanazt teszi, mint a *Létrehozás* vagy az *Alkalmazás* gomb, kivéve a *Leírás* mezőben és egy nyitott legördülő listában.
- **A Fájl képernyőn** a *Projektbeállítások* alul ezt mutatja: *A módosítások nincsenek alkalmazva — a megtartásukhoz kattintson erre: Alkalmazás.*, amíg a vázlat eltér. Ha ezután elhagyja a képernyőt, az alkalmazás megkérdezi, hogy alkalmazza-e a módosításokat, eldobja-e őket vagy mégse. Lásd [A menüszalag, fülenként](docs://ref-lint).
- **Egyéni számítási profil név nélkül** blokkolja az *Alkalmazás* és a *Létrehozás* gombot. Adjon neki nevet, vagy vesse el a módosítást.

## Mezők mindkét ablakban

**Projektnév** — a projekt neve a címsorban, a fülön és a fájlnévben, amikor menti. Alapértelmezett: üres. Üres mező is megengedett: a projekt neve ekkor *Új ütemezés* lesz, szürke szövegként látszik a mezőben. Hol: a teljes képernyőn.

**Leírás** — szabad szöveg. Alapértelmezett: üres. Hatás: a projektben tárolódik, az IFC-fájlba és az exportba Primavera P6 XML formátumban kerül, és nincs hatása az ütemezésre.

**Szerző** — szabad szöveg. Alapértelmezett: üres. Hatás: az IFC-fájlba kerül, és a jelentés fejlécében *Szerző:* néven jelenik meg, ahol nem lehet átírni.

**Erőforrástár** — melyik erőforrástárhoz kapcsolódik a projekt. Választható: *nincs erőforrástár (önálló projekt)*, a meglévő erőforrástárak és *+ Új erőforrástár…*. Alapértelmezett: az *Új projekt* ablakban az alapértelmezett erőforrástár, a *Projektbeállítások* ablakban a jelenlegi kapcsolat. Hatás: lásd [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken). Az *+ Új erőforrástár…* választása után egy mezőbe írja be a nevet. Az erőforrástárat csak a *Létrehozás* vagy az *Alkalmazás* gombra hozza létre az alkalmazás, így a mégse után nem marad semmi. A *Projektbeállítások* kapcsolata csak akkor változik, ha Ön maga módosítja ezt a mezőt.

**Ügyfél/szervezet** — szabad szöveg. Alapértelmezett: üres. Hatás: az IFC-fájlba kerül, és a jelentés fejlécében *Cég:* néven jelenik meg.

**Kezdődátum** — a projekt kezdete. Alapértelmezett: az *Új projekt* ablakban a mai nap. Hogy mit csinál a mező, azt lent olvassa el, a *Mit csinál a kezdődátum* részben.

**Befejezési dátum** — a projekt tervezett befejezése. Alapértelmezett: üres. Hatás: ez információ, nem követelmény. Az alkalmazás nem ehhez a dátumhoz tervez. Megjelenik a jelentés fejlécében és az exportban, és meghatározza, hogy az ünnepnapok melyik évig készüljenek el. Csak Primavera-fájlnál, a *Tartalékidő ütemezés-számítása a projektbefejezési dátumig* beállítás mellett fut a tartalékidő-számítás eddig a dátumig (lásd [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies)).

**Alapértelmezett egység új tevékenységekhez** — csak akkor látszik, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Választható: *Napok* és *Órák*. Alapértelmezett: *Napok*. Hatás és feltételek: lásd [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).

**Számítási profil és beállítások** — a *Projektbeállítások* ablakban a teljes blokk. Az *Új projekt* ablakban csak a legördülő lista, a *Számítási profil* mezővel, a következő értékekkel: *Primavera P6*, *Microsoft Project* és *Open Planner Studio*. Alapértelmezett: *Open Planner Studio*. Egy profil kiválasztása a profil alapértelmezett beállításait is beállítja. Lásd [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies).

## Csak a Projektbeállításokban

**IFC-séma mentéskor** — melyik IFC-séma van a mentett fájl fejlécében. Választható: *IFC 4.3 ADD2 (alapértelmezett)*, *IFC 4.3* és *IFC4*. Alapértelmezett: *IFC 4.3 ADD2 (alapértelmezett)*. Megnyitott IFC-fájlnál az adott fájl sémája. Hatás: csak a fájl fejlécében változik, a tartalma nem. Használja ezt, ha az ütemezést ugyanabban a sémában szeretné egyesíteni egy épületmodellel. Ha a megnyitott fájl az alapértelmezettől eltérő sémát használ, az alkalmazás az első mentéskor megkérdezi, megtartja-e azt a sémát. Az itt tett választás ezt a választ jelenti. Egy másik választás itt nem kerül a *Visszavonás* előzményei közé, mert a séma a fájlhoz tartozik. Lásd [Az IFC-séma kiválasztása](docs://howto-ifc-schema-kiezen).

## Csak az Új projekt ablakban

**Fázissablon** — mely fázisokkal indul a projekt. Választható: *Üres*, *Lakóépítés* és *Nem lakó célú építés / felújítás*. Alapértelmezett: *Üres*. Hatás: az *Üres* tevékenység nélküli projektet ad. A másik két sablon nyolc fázis-tevékenységet helyez el előre kitöltve. Mindegyik időtartama 5 a projekt alapértelmezett egységében: 5 munkanap, vagy 5 óra, ha az *Alapértelmezett egység új tevékenységekhez* alatt *Órák* van kiválasztva. Kapcsolatok nincsenek közöttük. Ezeket Ön maga nevezi át, mozgatja és bővíti. A *Lakóépítés* sablonban ezek: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking és Oplevering. A *Nem lakó célú építés / felújítás* sablonban: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen és Oplevering. A nevek a projekt adatai. Holland nyelven maradnak, akkor is, ha a felület más nyelvű. Ha az *Építési mód bekapcsolása* ki van kapcsolva, csak az *Üres* sablon létezik. Lásd [Alkalmazásbeállítások](docs://ref-instellingen).

**Műszak** — csak akkor látszik, ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva. Választható: *Nappali műszak*, *2 műszak*, *3 műszak* és *24/7*. Alapértelmezett: *Nappali műszak*. Hatás: a *Nappali műszak* meghagyja a szokásos naptárat, egy egyszerű, hétfőtől péntekig tartó nappali naptárt. A másik három idősávokat helyez a projektnaptárba, ugyanúgy, mint a *Naptárak* ablak azonos nevű gombjai. Hogy melyek ezek az időpontok, azt lásd itt: [Munkaidő beállítása](docs://howto-werktijden-instellen). A *Nappali műszak* mellett nem választható az *Órák* az *Alapértelmezett egység új tevékenységekhez* alatt, mert egy nappali naptárban nincsenek idősávok.

**Ünnepnaplista** — mely ünnepnapokat kapja a projektnaptár. Az *Ország* mezőben választhat: *Hollandia* (alapértelmezett), *Németország*, *Belgium*, *Franciaország*, *Egyesült Királyság*, *Ausztria*, *Svájc*, *Nincs ünnepnap* vagy *Egyéni…*. Ha az országnak vannak régiói, egy *Régió* legördülő lista jelenik meg. Hollandia esetén, ha az *Építési mód bekapcsolása* be van kapcsolva, azt is választja, mi legyen az *Építőipari szabadság*: *Nincs* (alapértelmezett), *Észak*, *Közép* vagy *Dél*. Alatta egy sor látható, például *36 ünnepnap, 2025–2029*. Ezt kibontva megjelenik a lista. Az évek a kezdődátum előtti évtől a befejezési dátum utáni évig tartanak. Ha nincs befejezési dátum, a kezdő évtől számított három évig. Az *Egyéni…* naptárat ad ünnepnapok nélkül, és a létrehozás után azonnal megnyitja a *Naptárak* ablakot, hogy Ön maga tölthesse ki őket. A projektnaptár neve *Bouwkalender NL*, vagy *Standaardkalender*, ha az *Építési mód bekapcsolása* ki van kapcsolva. Ekkor a *Nincs ünnepnap* is választható. Hogy működik a generátor, azt lásd itt: [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren).

## Mit csinál a kezdődátum

A kezdődátum a projekt kiindulópontja. Három szabály érvényes:

- **Az új tevékenységek a kezdődátumon kezdődnek.** Az Ön által hozzáadott tevékenység a projektkezdést kapja tervezett kezdésként.
- **Egy előddel rendelkező tevékenység soha nem kezdődik a kezdődátum előtt.** Ha az előd befejezése korábbi, a tevékenység a kezdődátumig vár. Egy előd nélküli tevékenység megtartja a saját dátumát, még akkor is, ha az a kezdődátum előtt van. Erre azért van szükség, hogy egy MS Project- vagy Primavera-ütemezést úgy lehessen megjeleníteni, ahogy a forrásprogram mutatja. A *Kötelező kezdés (MSO)* vagy *Kötelező befejezés (MFO)* korlátozás mindkét szabályt megtöri. Az ilyen tevékenység a saját dátumán marad, akkor is, ha az a kezdődátum előtt esik.
- **Egy későbbi kezdődátum magával viszi az előd nélküli tevékenységeket.** Ha a kezdődátumot a *Projektbeállítások* ablakban későbbire állítja, és az *Alkalmazás* gombra kattint, akkor az előd nélküli, korlátozás nélküli tevékenységek, amelyek az új dátum előtt lennének, az új dátumra kerülnek. Ez nem vonatkozik azokra a tevékenységekre, amelyek alsó határt szabnak (*Nem korábban kezdődő*, *Kötelező kezdés*, *Nem korábban befejeződő* vagy *Kötelező befejezés*). Ez ugyanabban a lépésben történik a *Visszavonás* előzményeiben. Az alkalmazás jelzi, hány tevékenységet mozgatott el. Ez csak akkor történik, ha Ön maga módosítja a kezdődátumot, soha nem fájl megnyitásakor. A kezdődátum későbbire állítása nem mozgatja az ütemezés többi részét. Ezt a *Projekt áthelyezése* teszi, lásd [Projekt áthelyezése](docs://howto-project-verplaatsen).

## Lásd még

- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): a *Számítási profil és beállítások* blokk.
- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): miért módosítja az eredményt egy számítási profil.
- [Projekt áthelyezése](docs://howto-project-verplaatsen): az egész ütemezés másik kezdő dátumra.
- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): kezdés az első tevékenységekkel.
- [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren): az ünnepnaplista részletesen.
- [Az IFC-séma kiválasztása](docs://howto-ifc-schema-kiezen): mentés épületmodellhez IFC4 formátumban.
