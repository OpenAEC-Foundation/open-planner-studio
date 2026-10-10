# Formate de import și export

Pentru fiecare format de fișier: dacă puteți să deschideți, să salvați și să exportați fișierul, ce se transferă și ce nu, și cu ce profil de calcul se deschide. Motivul din spatele acestora și un exemplu cu cifre se află în [Fișiere și formate](docs://uitleg-bestanden).

## Vedere de ansamblu

**Deschidere** funcționează cu IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` și `.xer`. Aplicația tratează un fișier cu orice altă extensie ca IFC.

**Salvarea** scrie întotdeauna IFC. Numai un fișier IFC deschis devine ținta salvării. Un proiect dintr-un alt format nu are fișier după deschidere, iar *Salvare* întreabă atunci unde trebuie să fie fișierul IFC.

**Exportul** funcționează către IFC 4x3, MS Project XML, Primavera P6 XML, CSV și două foi de progres (Excel și CSV). Un export nu modifică proiectul dumneavoastră.

**Doar în citire** sunt `.mpp` și `.xer`: aplicația le poate deschide, dar nu le poate scrie.

**PDF** provine numai dintr-un raport (consultați [Tipuri de raport](docs://ref-rapporttypes)). Aplicația nu citește PDF.

**Unde.** Deschidere: *Acasă › Fișier › Deschidere*, *Fișier › Deschidere* sau Ctrl+O. Exportare: *Acasă › Fișier › Exportare* sau *Fișier › Exportare*. Puteți importa o foaie de progres completată cu *Fișier › Importare*, sau cu butonul *Actualizare progres din foaie de calcul* din grupul *Progres* de pe panglică, de pe filele *Planificare*, *Tabel* și *Raport*.

**Profil de calcul la deschidere.** Fiecare format se deschide cu un profil de calcul. Ce este acesta, se explică în [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies). `.xer` se deschide cu *Primavera P6*, `.mpp` cu *Microsoft Project*, iar CSV, MS Project XML și P6 XML cu *Open Planner Studio*. IFC păstrează profilul salvat în fișier. Pentru `.xer` și `.mpp`, aplicația afișează că proiectul se calculează în acest mod. Numai IFC transportă profilul de calcul și opțiunile de calcul. Dintre opțiunile de calcul, MS Project XML scrie cel mult pragul critic. Un export redeschis dintr-un alt format se calculează ca *Open Planner Studio*.

## IFC

**Deschidere** — da, `.ifc`. Aplicația citește IFC 4.3. Profil de calcul: cel din fișier.

**Salvare** — da, și este singurul format în care se salvează. *Salvare* scrie întregul dumneavoastră proiect ca fișier IFC. Fișierul devine ținta salvării.

**Exportare** — da, ca *IFC 4x3* (descris ca *Standard BuildingSMART. Conectare 4D cu modele BIM.*). Nume implicit: numele proiectului cu extensia `.ifc`. Dacă proiectul dumneavoastră este legat de o bibliotecă de resurse, caseta *Salvare fișier bibliotecă alături* se află sub carduri, în *Fișier › Exportare*. Dacă este bifată, aplicația cere, după proiect, un loc pentru *numeproiect-bibliotheek.ifc*. Caseta nu se află în lista de pe fila *Acasă*.

**Ce se transferă** — tot ce aparține proiectului: activități cu structură, durată, date și progres; dependențe cu decalaj; restricții și termene limită; calendare; resurse și atribuiri, inclusiv distribuția pe ore; referințe; coduri de activitate și câmpuri particularizate; note; legături între proiecte; întreruperi; reguli de lucru și tipuri de activitate; setările proiectului, cum ar fi data raportului de stare, modul de progres, profilul de calcul și opțiunile de calcul; legătura cu o bibliotecă de resurse. Pentru un proiect dintr-un `.xer`, fișierul sursă original se transferă și el. Un tip de activitate particularizat se păstrează ca tipul IFC `USERDEFINED`, cu numele său în câmpul ObjectType, astfel încât alte programe IFC citesc activitatea normal. Aplicația păstrează și identificatorul fix al tipului, deci redenumirea nu rupe legătura. Dacă cineva deschide fișierul pe alt calculator, tipul apare acolo sub *Din acest proiect*, nu în propriile *Tipurile mele de activitate*.

**Ce nu se transferă** — modul în care ați configurat ecranul (zoom, poziția de derulare, activitatea selectată, fazele restrânse, filtrul și gruparea alese) și setările aplicației ([Setări](docs://ref-instellingen)). Fila *IFC* arată textul IFC al proiectului dumneavoastră.

## MS Project XML (MSPDI)

**Deschidere** — da. Aplicația recunoaște un fișier `.xml` ca MS Project XML după elementul rădăcină `Project` din spațiul de nume MS Project (sau fără spațiu de nume). Profil de calcul: *Open Planner Studio*.

**Salvare** — nu. Un astfel de proiect nu primește țintă pentru salvare.

**Exportare** — da, ca *MS Project XML* (*Se deschide în Microsoft Project. Structură WBS completă.*). Nume implicit: numele proiectului cu `.xml`.

**Ce se transferă** — activități cu structură (nivel și WBS), durată, date și progres; dependențe cu decalaj, și în ore sau procente; restricții, inclusiv termenul limită; calendare, inclusiv calendarele activităților și ale resurselor; resurse și atribuiri, inclusiv curba sau distribuția pe ore; data raportului de stare; pragul critic, ca număr întreg de zile lucrătoare, de 0 sau mai mult, cu *Marjă totală ≤ prag*; descrierea unei activități (ca notă); regula de lucru a unei activități (ca tip de activitate MS Project); un tip de activitate particularizat, într-un câmp liber (`ExtendedAttribute`), pe care aplicația îl citește la loc și pe care MS Project îl poate ignora. Dintre referințele dumneavoastră se transferă numai cea activă, ca referința 0. O activitate în ore își păstrează unitatea, iar un jalon își păstrează tipul (început, sfârșit sau automat).

**Ce nu se transferă** — note (lista de verificare a unei activități), legăturile între proiecte, codurile de activitate și câmpurile particularizate, o a doua restricție, marcajul *Planificat manual*, întârzierea prin redistribuire, punctul de reluare și punctul de oprire ale unei activități cu progres în afara secvenței, convențiile de calcul *Lucrul rămas se reia după timpul scurs* și *Activități nepornite nu se mută la data raportului de stare* ale unui profil MS Project, și celelalte opțiuni de calcul. Activitățile întrerupte fără distribuție pe ore se transferă fără întreruperile lor.

**Ce se schimbă pe parcurs** — o restricție *Trebuie să înceapă la (MSO)* sau *Trebuie să se termine la (MFO)*, fără opțiunea *Obligatoriu (logica de fixare)*, devine *Nu începe înainte de (SNET)* sau *Nu se termină mai devreme de (FNET)*. Un hamac devine o activitate obișnuită cu date calculate.

## Fișier MS Project (`.mpp`)

**Deschidere** — da, din MS Project 2010 până la 2021. Profil de calcul: *Microsoft Project*. Aplicația citește numai fișierul: nu modifică niciodată fișierul `.mpp` dumneavoastră. Aplicația refuză un fișier din MS Project 2007 sau mai vechi, și un fișier protejat cu parolă, cu un mesaj care indică exportul XML din MS Project.

**Salvare** — nu, și nu există țintă pentru salvare: *Salvare* scrie un fișier IFC nou.

**Exportare** — nu.

**Ce se transferă** — activități cu structură, durată și restricții; dependențe cu decalaj; calendare; resurse și atribuiri; progres; un cod WBS pe care l-ați completat singur în MS Project. Datele și marja pe care MS Project le-a calculat singur se citesc și ele, pentru vizualizarea *Date cum au fost înregistrate*.

**Ce nu se transferă** — referințele, costurile și tarifele standard, notele și câmpurile particularizate din MS Project. Consultați [Deschiderea unui fișier MS Project (.mpp)](docs://howto-mpp-openen).

**Origine și licență** — cititorul pentru `.mpp` a fost scris pentru Open Planner Studio și este derivat din codul sursă și din cunoștințele structurale ale MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), o bibliotecă Java sub LGPL-2.1. Structura și constantele de câmp au fost portate în TypeScript. Open Planner Studio în sine este open source sub LGPL-3.0. Cititorul pentru `.xer` nu este derivat: MPXJ a fost acolo doar consultat ca sursă de informare.

## Primavera P6 XML

**Deschidere** — da. Aplicația recunoaște un fișier `.xml` ca P6 XML după elementul rădăcină `APIBusinessObjects`. Profil de calcul: *Open Planner Studio*.

**Salvare** — nu.

**Exportare** — da, ca *Primavera P6 XML* (*Pentru Oracle Primavera P6.*). Nume implicit: numele proiectului cu `.xml`, deci același nume ca la un export MS Project XML. Dați-le nume diferite.

**Ce se transferă** — structura WBS și activități cu durată, date și progres; dependențe cu decalaj; restricții (și o a doua, ca restricție moale); calendare; resurse și atribuiri; data raportului de stare (ca `DataDate`); un tip de activitate particularizat, într-un câmp propriu, `OPS Custom Task Type`, pe care aplicația îl citește la loc și pe care P6 îl poate ignora.

**Ce nu se transferă** — referințele și termenele limită; codurile de activitate, câmpurile particularizate, notele și legăturile între proiecte; opțiunile de calcul; o excepție din calendarul de lucru (o excepție care face o zi lucrătoare). P6 nu are decalaj în procente: aplicația îl convertește într-un număr fix de zile. Un decalaj în zile calendaristice devine un decalaj în timp de lucru: 3 zile calendaristice devin 3 zile lucrătoare. Un hamac devine o activitate obișnuită, o activitate planificată manual devine o activitate obișnuită cu date calculate, iar o întârziere prin redistribuire de mai puțin de o zi se elimină.

## Fișier Primavera (`.xer`)

**Deschidere** — da. Profil de calcul: *Primavera P6*. Aplicația citește numai fișierul: nu scrie `.xer` și nu modifică niciodată fișierul dumneavoastră. Aplicația deschide câte o filă pentru fiecare proiect cu activități. Aplicația refuză un fișier fără activități sau cu tabele deteriorate și afișează un mesaj.

**Salvare** — nu, și nu există țintă pentru salvare: *Salvare* scrie un fișier IFC nou, cu fișierul `.xer` original în interior.

**Exportare** — nu. Dacă exportați un proiect dintr-un `.xer` în CSV, MS Project XML sau P6 XML, aplicația arată că informațiile sursă XER se pierd, chiar dacă ați salvat proiectul ca IFC între timp. În IFC nu se pierde nimic.

**Ce se transferă** — structura WBS și activități cu durată, date, restricții și progres; dependențe cu decalaj; calendare; resurse cu atribuiri; coduri de activitate; câmpuri particularizate (UDF); note; setările de planificare ale P6. O activitate de tipul *Nivel de efort* devine un hamac. Un proiect de referință devine referința activă a proiectului care îl menționează. Aplicația păstrează o legătură între proiecte ca date sursă.

**Ce nu se transferă** — un proiect fără activități și o legătură între proiecte ca dependență reală în planificarea dumneavoastră. Consultați [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Deschidere** — da. Aplicația citește `;` și `,` ca separatori. Recunoaște anteturile de coloane în engleză și olandeză (de exemplu `Name` sau `Naam`, `Duration` sau `Duur`, `Predecessors` sau `Voorgangers`). Datele pot fi *aaaa-ll-zz*, *zz-ll-aaaa* sau *zz/ll/aaaa*. Scrieți un predecesor ca cod WBS, tip de dependență și decalaj, de exemplu `1.2FS+2d`. Profil de calcul: *Open Planner Studio*. Proiectul se numește *CSV Import*. Un `Task Type` care nu este niciunul dintre codurile fixe (cum ar fi `CONSTRUCTION` sau `INSTALLATION`, pe care aplicația le scrie singură) devine un tip de activitate particularizat sub *Din acest proiect*, nu în *Tipurile mele de activitate*. Cu `OPS Custom Task Type ID` se păstrează identificatorul unui tip particularizat.

**Salvare** — nu.

**Exportare** — da, ca *CSV (;)* (*Export universal de tabel. Toate activitățile cu date și durate.*), pe cardul *CSV (separat prin punct și virgulă)*. Fișierul folosește punct și virgulă ca separator, este în UTF-8 cu BOM și are anteturi de coloane în engleză.

**Ce se transferă** — per activitate, aceste coloane: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` și `Description`. Procentul de finalizare este în procente întregi.

**Ce nu se transferă** — resurse, atribuiri, calendare, restricții, termene limită, referințe și data raportului de stare. Dacă datele sunt în vizualizarea *Date cum au fost înregistrate*, exportul lasă goale `Critical` și `Total Float` pentru activitățile al căror fișier sursă nu a înregistrat acest lucru.

## Foaie de progres (Excel și CSV)

**Deschidere** — da, prin *Fișier › Importare* (*Actualizare progres din foaie de calcul*) sau prin butonul cu același nume din grupul *Progres*, de pe *Planificare*, *Tabel* și *Raport*. Aplicația citește `.xlsx` și `.csv`, până la 16 MB și 50.000 de rânduri. Aceasta nu deschide un proiect: actualizează progresul proiectului dumneavoastră deschis. Consultați [Importul progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren).

**Salvare** — nu.

**Exportare** — da, ca *Foaie de progres (Excel)* (*Progres (Excel)* în listă) și *Foaie de progres (CSV)* (*Progres (CSV)*). Nume implicit: *numeproiect-voortgang*. Butonul *Exportare foaie de progres* din același grup de panglică creează foaia Excel dintr-un clic. Foaia Excel are lățimi fixe ale coloanelor, câmpuri blocate și verificare a datelor. Foaia CSV are același conținut, ca text simplu.

**Ce se transferă** — coloanele `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` și `Actual Finish`. La citire, aplicația folosește `Completion (%)`, `Actual Start` și `Actual Finish`. `Start` și `Finish` servesc numai la recunoașterea notației datelor și nu modifică planificarea dumneavoastră. Aplicația leagă rândurile de activități după `OPS Task ID`, sau altfel după un cod WBS unic.

**Ce nu se transferă** — tot ce este în afara acestor coloane: durata, dependențele, resursele și restul planificării dumneavoastră. O activitate rezumat nu primește progres din foaie.

## PDF

**Deschidere** — nu.

**Salvare** — nu.

**Exportare** — da, dintr-un raport: pe fila *Raport* butonul *Exportare PDF*. Aplicația nu trimite singură un raport la imprimantă; drumul spre hârtie trece prin PDF. Conținutul depinde de tipul de raport: consultați [Tipuri de raport](docs://ref-rapporttypes) și [Crearea și imprimarea unui raport](docs://howto-rapport-maken-en-afdrukken).

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): de ce IFC este formatul propriu și ce pierde un export, cu un exemplu.
- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): pașii.
- [Exportul](docs://howto-exporteren): alegerea unui format și mesajele după un export.
- [Date cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen): de ce un fișier deschis poate arăta alte date.
- [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies): profilele de calcul.
