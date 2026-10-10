# Panel zdrojov

Panel zdrojov je miesto, kde spravujete zdroje. Vidíte tu, kto a čo je k dispozícii, s akou kapacitou a v akom kalendári. Histogram pod diagramom Gantt a preťaženie k panelu patria. Tento článok popisuje pre každé pole a tlačidlo, čo robí, aká je predvolená hodnota a čo si z toho všimnete. Ako vytvárať a priraďovať zdroje, nájdete v článku [Správa zdrojov](docs://howto-resources-beheren) a [Priradenie zdrojov pomocou krivky](docs://howto-resource-toewijzen). Postup pri preťažení je v článku [Riešenie preťaženia](docs://howto-overbezetting-oplossen).

## Kde to nájdete

- **Celý panel** — *Zdroje › Zostava › Zdroje* alebo *Zobrazenie › Panely › Zdroje*. Panel zaberie celé pracovné okno. Krížik vpravo hore ho zavrie.
- **Ukotvený panel zdrojov** — *Zdroje › Zostava › Ukotvený panel zdrojov* alebo *Zobrazenie › Panely › Ukotvený panel zdrojov*: kompaktný zoznam v pravom stĺpci vedľa diagramu Gantt. Pozrite nižšie.
- **Histogram** — *Zdroje › Histogram › Histogram* alebo *Zobrazenie › Panely › Histogram*: pruh pod diagramom Gantt. Pozrite nižšie.
- **Zobrazenia** — ak projekt patrí do knižnice zdrojov, vpravo hore v paneli vyberiete *Knižnica*, *Projekt* alebo *Obsadenosť*. Bez knižnice je k dispozícii len tabuľka projektu. Pri každom otvorení panel začne na zobrazení *Projekt*. Tak sa nedostanete do zdieľanej knižnice bez toho, aby ste si to všimli.

## Nový zdroj

- **Nový zdroj v projekte** (v zobrazení *Knižnica* ako *Nový zdroj v knižnici*) — tlačidlo vpravo hore. Otvorí koncept riadka na konci tabuľky. Nič sa nevytvorí, kým nezadáte názov a neopustíte riadok alebo nestlačíte Enter. Ak kliknete mimo prázdneho riadka alebo stlačíte Esc, nezostane nič: žiadny zdroj a žiadny krok v *Vrátiť späť*. Polia môžete vyplniť v ľubovoľnom poradí. Všetko sa uloží naraz. Enter alebo šípka nadol uloží riadok a otvorí nový koncept. Shift+Enter alebo šípka nahor uloží riadok a vráti vás do tabuľky. Koncept nemá rozbaľovač kapacity, ceruzku kalendára ani kôš, lebo sa týkajú zdroja, ktorý ešte neexistuje. Tlačidlo *Vytvoriť zdroj* v ponuke *Zdroje › Zostava* robí to isté.
- **Navigácia v mriežke** — v tabuľke sa kurzor medzi riadkami presúva klávesmi Enter, Shift+Enter a šípkami nahor a nadol. Enter na poslednom riadku otvorí nový koncept.

## Zobrazenie Projekt

Tabuľka toho, čo tento projekt používa. Každý riadok je jeden zdroj. Zmeny textu a sadzby sa uplatnia, keď opustíte pole. Každá takáto zmena je jeden krok v *Vrátiť späť*.

- **Farba** — výber farby. Predvolené: prvá voľná farba z palety. Účinok: farba pruhu zdroja pod diagramom Gantt (*Zobrazenie › Smerné plány a postup › Zvýraznenie zdrojov*) a farba štvorčeka v ukotvenom paneli.
- **Názov** — názov zdroja. Prázdny názov sa neuloží; pole sa vráti k starému názvu.
- **Typ** — *Práca*, *Zariadenie*, *Materiál*, *Subdodávateľ* alebo *Pracovná zmena*. Predvolené pre nový zdroj: *Práca*. Účinok: *Materiál* má *Jednotku* a nepočíta sa do súčtu *Všetky zdroje* v histograme. Vyvažovanie preskočí materiál. Zdroj typu *Pracovná zmena* môže byť *Pracovnou zmenou* iných zdrojov. Ostatné typy sa počítajú rovnako.
- **Maximálny počet jednotiek** — koľko zo zdroja je k dispozícii za deň. Číslo nad 0, zlomky sú povolené. Predvolené: 1. Účinok: kapacita za deň. Ak je zaťaženie vyššie, zdroj je preťažený. Šípka vedľa poľa rozbalí *Časovo fázovanú kapacitu*. Číslo pri šípke je počet krokov.
- **Časovo fázovaná kapacita** — kroky s *Od* (dátum) a *Maximálnym počtom jednotiek*. *Pridať krok* pridá krok s dnešným dátumom a hodnotou 1. Bez krokov sa zobrazí *Žiadne kroky — rovný maximálny počet jednotiek platí vždy.* Účinok: od dátumu kroku platí jeho *Maximálny počet jednotiek* namiesto rovnej hodnoty. Pre daný deň platí posledný krok s dátumom v ten deň alebo skôr.
- **Kalendár** — zoznam s položkou *Projektový kalendár* (predvolené), kalendármi projektu a *+ Kalendár zdroja* pre nový kalendár. Ceruzka (*Upraviť…*) otvorí zvolený kalendár. Pri položke *Projektový kalendár* je ceruzka vypnutá. Účinok: dni, keď zdroj pracuje. V deň voľna je kapacita 0. Ak sa v ten deň plánuje práca, zdroj je preťažený s dôvodom *Podľa kalendára „…“ sa v tento deň nepracuje*. Kalendár zdroja nemení termíny úlohy. Pozrite [Okná kalendárov](docs://ref-kalenders).
- **Štandardná sadzba/hod** — náklad za hodinu. Prázdne pole = žiadna sadzba. Neplatné číslo sa nahradí predošlou hodnotou. Účinok: žiadny vplyv na plán ani na zaťaženie. Sadzba určuje stĺpec *Celkom*, uloží sa v súbore IFC a pri exporte sa zapíše do MS Project (štandardná sadzba) a do Primavera P6 XML (cena za jednotku).
- **Celkom** — iba na čítanie: naložené hodiny × sadzba, s dvoma desatinnými miestami. *—* bez sadzby alebo zaťaženia. Na konci riadok *Celkom* sčíta všetky zdroje. Hodiny vychádzajú z posledného prepočtu a počítajú sa ako jednotky × hodiny za deň podľa kalendára úlohy. Nie sú aktuálne? Stlačte *Prepočítať*.
- **Jednotka** — mernú jednotku materiálu, napríklad `m³`. Dá sa vyplniť len pri type *Materiál* (popisok *Vyplňte len pri zdrojoch typu Materiál.*). Účinok: iba popis, nič sa nevypočíta.
- **Pracovná zmena** — pracovná zmena, do ktorej zdroj patrí, zo zdrojov typu *Pracovná zmena*. Predvolené: *Žiadna*. Účinok: iba zoskupenie. Kapacita a zaťaženie pracovnej zmeny nie sú súčtom jej členov.
- **Odstrániť** (kôš) — odstráni zdroj. Ak má zdroj priradenia, aplikácia sa najprv opýta *„…“ má počet priradení: … — odstrániť?* so značkou na potvrdenie a krížikom na zrušenie.
- **Do knižnice** — len ak projekt patrí do knižnice zdrojov, pri zdroji s názvom, ktorý ešte nepochádza z knižnice. Uloží zdroj do knižnice alebo ho prepojí s existujúcou položkou s rovnakým názvom. Aplikácia oznámi, čo sa stalo: *Pridané.*, *Už bolo v knižnici. Teraz je prepojené.* alebo *Prepojené s existujúcou položkou knižnice. Hodnoty sa líšia, pozrite si označenie.*
- **Odpojiť od knižnice** — ikona odpojenia pri zdroji, ktorý pochádza z knižnice. Odstráni väzbu na pôvod. Potom sú všetky polia voľné.

Bez zdrojov sa zobrazí *Zatiaľ žiadne zdroje. Pridajte aspoň jeden, aby ste mohli začať.* Ak projekt patrí do knižnice, zobrazí sa *Tento projekt zatiaľ nepoužíva žiadne zdroje z knižnice.* s nápovedou.

### Zdroje z knižnice

Zdroj z knižnice má malú ikonu knižnice (*Z knižnice*). Jeho *Názov*, *Typ*, *Štandardná sadzba/hod* a *Jednotka* sú potom len text (*Hodnota z knižnice — upravte ju v zobrazení Knižnica, alebo tento zdroj odpojte od knižnice.*). Rozhoduje o tom knižnica. *Farba*, *Maximálny počet jednotiek*, kroky kapacity, *Kalendár* a *Pracovná zmena* zostávajú upraviteľné, lebo o tom, koľko a kedy, rozhoduje projekt. Môžu sa zobraziť dva odznaky: *sa líši — rozhodnite* (kliknutím sa otvorí okno *Prepojiť knižnicu zdrojov*) a *už nie je v knižnici* s tlačidlom *Odstrániť z projektu*.

## Zobrazenie Knižnica

Len ak projekt patrí do knižnice zdrojov. Pozrite [Použitie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken) a [Spravovanie a zdieľanie knižníc zdrojov](docs://howto-bibliotheken-beheren). Hore je farebné upozornenie: *Toto upravuje knižnicu a platí pre všetky projekty. Nedá sa vrátiť späť.* Tabuľka má tie isté polia ako zobrazenie *Projekt*, s týmito rozdielmi:

- Nie je tu stĺpec *Celkom*. Ten je výpočet pre jeden projekt.
- Stĺpec *Pracovná zmena* je tu hneď, ako má knižnica zdroje.
- Stĺpec *Kalendár* ponúka kalendáre knižnice. Predvolené je *Žiadny kalendár*.
- **Priradiť do projektu** — vloží zdroj do projektu s kópiou jeho kalendára. Oznámi *Pridané.* alebo *Už je v projekte.*
- **Odstrániť** — zobrazí otázku *Odstrániť „…“ z knižnice? Platí to pre všetky projekty a nedá sa to vrátiť späť.*
- Bez zdrojov sa zobrazí *Zatiaľ žiadne zdroje v spoločnom zozname.*

## Zobrazenie Obsadenosť

Zobrazenie iba na čítanie pre všetky otvorené dokumenty. Ukazuje, ktoré zdroje knižnice sú kde rezervované. Tlačidlo pre nový zdroj tu nie je. Pozrite [Použitie prehľadu obsadenosti](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabuľka** — pre každý zdroj knižnice: *Názov*, *Dokumenty* (počet dokumentov, v ktorých je), *Obdobie* a *Maximum / kapacita* (najvyššie spojené zaťaženie oproti kapacite v ten deň). Červený text *N dní s preťažením* znamená, že zdroj má vo viacerých dokumentoch viac, než je jeho kapacita. Šípka vedľa názvu rozbalí dokumenty, každý s obdobím a maximom. Kliknutie na riadok zobrazí histogram tohto zdroja (*Vyberte zdroj, aby sa zobrazil histogram.*).
- **Čo sa počíta** — len dokumenty otvorené v tomto programe (*Tento prehľad vidí len dokumenty otvorené v tomto programe.*). Dokument, ktorý nebol prepočítaný, dostane správu pri svojom riadku. Aktívny dokument sa počíta s naposledy prepočítanými údajmi (*Zastarané: toto sú naposledy prepočítané údaje — stlačte F5 v tomto dokumente.*). Iný dokument prehľad prepočíta vopred (*Pre tento prehľad je už vopred prepočítané — samotný dokument zobrazuje staršie dátumy, kým v ňom nestlačíte F5 alebo nezapnete „Automatický prepočet“.*). Ak je zapnutý *Automatický prepočet*, prehľad tie dokumenty naozaj prepočíta. Ak prepočet zlyhá, dokument sa nepočíta (*Nepočíta sa: plán nie je prepočítaný — aktivujte tento dokument a stlačte F5.*). Bez rezervovaných zdrojov sa zobrazí *V otvorených dokumentoch nie sú rezervované žiadne zdroje z knižnice.*
- **Poradie** — zdroje s preťažením sú hore, najprv tie s najväčším počtom dní s preťažením, potom abecedne.

## Ukotvený panel zdrojov

Kompaktný zoznam v pravom stĺpci vedľa panela *Vlastnosti*. Pri každom zdroji: farebný štvorček, názov (iba na čítanie), červený trojuholník *Preťažený*, ak má zdroj aspoň jeden preťažený deň, a *Maximálny počet jednotiek* na úpravu. Ak sú vybraté úlohy, zobrazia sa len zdroje týchto úloh. V hlavičke sú *Celý panel* (otvorí celý panel) a *Zavrieť panel*. Bez zdrojov sa zobrazí *Zatiaľ žiadne zdroje. Pridajte aspoň jeden, aby ste mohli začať.*

## Histogram

Pruh pod diagramom Gantt ukazuje zaťaženie zdroja za deň. Zapnete ho alebo vypnete v ponuke *Zdroje › Histogram › Histogram* alebo *Zobrazenie › Panely › Histogram*. Predvolene je vypnutý. Vaša voľba sa zapamätá. Výška je predvolene 160 pixelov. Dá sa ťahať za okraj medzi diagramom Gantt a histogramom.

- **Výber** — vľavo pod tabuľkou úloh je zoznam. *Všetky zdroje* sú navrchu, pod nimi jeden riadok na zdroj. Kliknutím vyberiete riadok. Šípky sa pohybujú v zozname a *Zdroje › Histogram › Predchádzajúci* a *Nasledujúci* robia to isté. Červená bodka pri riadku znamená, že zdroj má aspoň jeden preťažený deň. Pri riadku *Všetky zdroje* sa bodka pozerá len na zdroje, ktoré nie sú materiál. Ak sú vybraté úlohy, zoznam obsahuje len zdroje týchto úloh. Ak vybraný zdroj do výberu nepatrí, pruh dočasne zobrazí *Všetky zdroje* z výberu.
- **Pruhy** — jeden pruh za deň: zaťaženie v jednotkách. Čiara ukazuje kapacitu. Časť pruhu nad kapacitou je červená. Vľavo hore je najvyššia hodnota s textom *jednotky*. *Všetky zdroje* spočítajú zaťaženie a kapacitu všetkých zdrojov okrem materiálu.
- **Popisok** — podržte kurzor myši chvíľu nehybne nad dňom: *N úloh prispieva na {date}* s menami najviac osem úloh. Pri vybranom zdroji a dni, keď jeho kalendár nepracuje, sa zobrazí aj *Podľa kalendára „…“ sa v tento deň nepracuje*.
- **Správy v pruhu** — *Prepočítajte (F5), aby sa zobrazilo zaťaženie*, kým nie je žiadne zaťaženie. *Zatiaľ žiadne zdroje*, keď nie sú žiadne zdroje. *⚠ Plán je zastaraný — prepočítajte (F5)* vpravo hore, keď je plán zastaraný.
- **Čo sa počíta** — jednotky za deň z každého priradenia, rozložené na pracovné dni úlohy podľa poľa *Krivka* (alebo *Upraviť rozloženie práce*). Len listové úlohy, žiadne medzníky. Zaťaženie sa obnoví po príkaze *Prepočítať* a po zmenách zdrojov a priradení. Ak zmeníte termíny úloh, počíta sa to až po príkaze *Prepočítať*.

## Preťaženie

Zdroj je preťažený v daný deň, ak je jeho zaťaženie vyššie než jeho kapacita. Kapacita je *Maximálny počet jednotiek* (s krokmi kapacity) v pracovnom dni jeho kalendára. V deň voľna je kapacita 0. Materiál sa tu počíta. Dôvodom je buď príliš malá kapacita, alebo deň, keď zdroj podľa kalendára nepracuje.

Kde to vidíte:

- **Zdroje › Preťaženie** — počet preťažených zdrojov, alebo *Žiadne*.
- **Stavový riadok** — *Preťažené zdroje: N*. Kliknutím sa otvorí panel *Upozornenia*.
- **Upozornenia** — riadok na zdroj *Preťaženie, počet dní: N (prvý – posledný)*. Ak sú všetky dni dňami voľna, pridá sa *zdroj v tieto dni nepracuje podľa svojho kalendára*. Pri zmesi sa pridá *z toho N dní zdroj podľa svojho kalendára nepracuje*. Pozrite [Oznámenia a upozornenia](docs://ref-meldingen).
- **Histogram** — červené časti pruhov a červená bodka vo výbere.
- **Ukotvený panel** — trojuholník *Preťažený*.

Vyvažovanie môže vyriešiť preťaženie tak, že presunie úlohy v rámci ich časovej rezervy. Nevyrieši zdroj, ktorý musí pracovať v deň voľna. Pozrite [Vyvažovanie](docs://uitleg-nivelleren).
