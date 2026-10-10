# Coloanele tabelului

Tabelul de activități are 86 de coloane fixe, plus câte o coloană pentru fiecare cod de activitate și câmp particularizat al proiectului, și opt coloane pentru fiecare referință. Acest articol descrie, pentru fiecare coloană, ce arată, dacă o puteți edita și în ce formă se scrie valoarea. Cum alegeți și aranjați coloanele, este descris în [Personalizarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen).

## Unde alegeți coloanele

Tabelul de activități de lângă Gantt și tabelul din fila *Tabel* au fiecare propria alegere de coloane. Semnul plus din dreapta antetului deschide selectorul de coloane (titlul ferestrei *Alegere coloană*). Pe *Tabel* puteți folosi și *Tabel › Coloane › Coloane…*. Selectorul listează coloanele pe categorii: *Activitate*, *Planificare*, *Restricții*, *Dependențe*, *Resurse*, *Progres*, *Calculat*, *Referință*, *Particularizat* și *Tehnic*. Căutați după nume. *Utilizate recent* este în partea de sus. *Restabilire implicită* readuce coloanele implicite.

Implicit, tabelul de lângă Gantt arată *WBS*, *Nume activitate* și *Durată*. Tabelul din fila *Tabel* arată *WBS*, *Nume activitate*, *Durată*, *Început*, *Sfârșit*, *Tip de activitate*, *Critic*, *Marjă totală* și *Progres*, plus câte o coloană pentru fiecare cod de activitate și câmp particularizat al proiectului.

## Cum se citesc și se editează valorile

- **Coloane calculate** — coloanele din categoria *Calculat* și alte câteva sunt doar în citire: ele vin din calcul. Dacă încercați să editați o celulă doar în citire, aplicația afișează *Această coloană calculată nu poate fi editată.* Acesta este mesajul general pentru fiecare celulă doar în citire, și când coloana nu este calculată. Dacă sunt învechite, pentru că ați modificat ceva, lângă ele apare *învechit* până apăsați *Calculare*.
- **Date** — apar în notația pe care ați ales-o la *Setări*, fila *Vizualizare*, sub titlul *Format dată*.
- **Durate și marjă** — o durată apare în unitatea activității (`5d`, `12h`), sau conform *Afișare durată* din aceeași filă (*Automat (unitatea proprie a fiecărei activități)*, *Întotdeauna zile* sau *Întotdeauna ore*). Marja apare în zile lucrătoare, cu două zecimale și cu separatorul zecimal al limbii dumneavoastră.
- **Da/Nu** — o valoare da/nu apare ca *Da* sau *Nu*. O valoare goală apare ca o liniuță (—).
- **Editare** — tastați sau alegeți o valoare. O valoare nevalidă este refuzată, cu un motiv sub celulă, de exemplu *Introduceți o durată validă, de exemplu 5d sau 8h.* sau *Introduceți un procent între 0 și 100.* Lipirea unui bloc de celule funcționează celulă cu celulă. Celulele doar în citire sunt sărite, iar aplicația spune câte au fost.

## Activitate

- **Nume activitate** — numele activității. Editabil; obligatoriu. O activitate rezumat apare cu caractere aldine și cu un fond ușor colorat în celula numelui. Un jalon apare cu caractere aldine, în culoarea jalonului (aceeași familie de culori ca jalonul din Gantt). O activitate obișnuită rămâne neschimbată. Este doar formatare: selectarea, trăgerea și editarea funcționează la fel.
- **Descriere** — descrierea. Editabilă; text liber.
- **WBS** — codul WBS. Editabil și obligatoriu, dar doar în citire cât timp *WBS automat* este activat.
- **Tip de activitate** — tipul de activitate (*Construcție*, *Instalare*, *Demolare*, *Logistică*, *Inspecție*, *Relocare*, *Renovare*, *Întreținere* sau *Altele*). Editabil, cu o listă.
- **Tip particularizat de activitate** — tipul particularizat de activitate din proiect, sau o liniuță. Editabil, cu o listă cu tipurile particularizate ale proiectului.
- **Culoare** — culoarea salvată a activității, ca un cod de culoare, de exemplu `#1a73e8`. Editabilă, cu un selector de culori. Ea este salvată în fișierul IFC, dar nicio bară sau raport nu o folosește. Culorile barelor le setați la *Vizualizare › Referințe și progres › Culori bare*.
- **Note** — notele, ca `✓ text; ○ text`. Editabile, cât timp există cel mult o notă (atunci editați textul ei). Cu mai multe note, sunt doar în citire.

## Planificare

- **Jalon** — dacă activitatea este jalon. Editabil. Dacă îl activați, durata devine 0. Aplicația refuză acest lucru pentru o activitate rezumat și pentru o activitate cu atribuiri.
- **Tip de jalon** — *Jalon de început* sau *Jalon de sfârșit*, sau o liniuță pentru automat. Editabil doar la un jalon.
- **Jalon obligatoriu** — indicatorul *Obligatoriu (prin contract)*. Editabil doar la un jalon.
- **Prioritate de redistribuire** — un număr întreg de la 0 la 1000, implicit 500. Editabil. 1000 fixează activitatea pentru redistribuire.
- **Întreruperi** — numărul de întreruperi, ca `Split gaps: 2`, sau o liniuță. Doar în citire. Le editați în panoul *Proprietăți*.
- **Regulă de lucru** — regula de lucru a activității. Gol înseamnă implicitul proiectului. Editabilă, cu o listă. Dar este goală și doar în citire la un jalon, o activitate rezumat sau un hamac. Apare în selector doar când regulile de lucru sunt vizibile (*Afișare reguli de lucru și lucru*, sau fișierul conține reguli de lucru).
- **Hamac (durată derivată)** — dacă activitatea este un hamac. Editabil, cu excepția unui jalon sau a unei activități rezumat.
- **Calendar** — identificatorul calendarului activității. Gol (—) înseamnă calendarul proiectului. Scrieți sau alegeți un identificator din sugestii. Un identificator necunoscut este refuzat. Notă: celula arată în prezent identificatorul intern, nu numele. Alegeți mai bine un calendar în panoul *Proprietăți*.
- **Tip de durată** — *Timp de lucru* (durata se numără în zile lucrătoare sau ore de lucru din calendar) sau *Timp scurs* (durata se numără în timp continuu al ceasului, fără calendar). Editabil.
- **Unitate de durată** — *Zile* sau *Ore*. Editabilă, cu excepția unei activități rezumat, a unui hamac sau a unui jalon. Schimbarea funcționează doar dacă conversia este exactă și *Activare planificare pe ore* este activat.
- **Durată** — durata activității, în unitatea activității sau conform *Afișare durată*. Editabilă: tastați `5d`, `12h` sau `1h 30m`, sau un număr în unitatea activității. Doar în citire la o activitate rezumat, un hamac și un jalon cu durata 0.
- **Început** — începutul afișat, aceeași dată ca bara din Gantt. Editabil. O activitate cu predecesor, căreia dați un nou început, primește restricția *Nu începe înainte de (SNET)* la această dată. Doar în citire la o activitate rezumat sau un hamac, dacă nu este planificată manual.
- **Sfârșit** — sfârșitul afișat. Editabil: un sfârșit nou devine o durată nouă. Aplicația refuză acest lucru pentru o activitate finalizată, un jalon, o activitate în timp scurs și o activitate cu întreruperi. Refuză și un sfârșit înainte de început (*Sfârșitul este înainte de început.*). Doar în citire la o activitate rezumat sau un hamac, dacă nu este planificată manual.
- **Început planificat** — ancora de planificare de la care pornește calculul. Nu este neapărat începutul afișat. Editabilă; același efect ca scrierea în *Început*.
- **Sfârșit planificat** — sfârșitul introdus. Editabil doar la o activitate planificată manual. În caz contrar, aplicația spune *Sfârșitul planificat se aplică doar unei activități planificate manual. Modificați sfârșitul în coloana Sfârșit sau prin durată.*

## Restricții

- **Tip de restricție** — tipul restricției, de la *Cât mai devreme posibil (ASAP)* până la *Trebuie să se termine la (MFO)*. Editabil. O activitate fără restricție arată *ASAP*.
- **Data restricției** — data restricției. Editabilă.
- **Restricție strictă** — indicatorul *Obligatoriu (logica de fixare)*. Editabil doar la *MSO* și *MFO*.
- **Tip de restricție secundară** — tipul celei de-a doua limite, sau o liniuță. Editabil. Tabelul oferă toate tipurile, dar o combinație nepermisă este refuzată. Trebuie să fie *SNET*, *FNET*, *SNLT* sau *FNLT*. Restricția principală trebuie să fie o limită (nu *ASAP*, *ALAP*, *MSO*, *MFO* sau o restricție strictă). Cele două trebuie să limiteze laturi opuse: o limită inferioară *SNET*/*FNET* cu o limită superioară *SNLT*/*FNLT*, sau invers.
- **Data restricției secundare** — data celei de-a doua limite. Editabilă.
- **Termen limită** — data-țintă pentru sfârșit. Editabilă.

## Dependențe

- **Predecesori** — predecesorii, ca `WBS type±lag`, separați prin `; `, de exemplu `1.2 FS+2d`. Editabili prin scrierea aceleiași forme. O legătură între proiecte nu o adăugați aici, ci cu *Planificare › Dependențe › Legare › Adăugare legătură între proiecte…*.
- **Succesori** — succesorii, în aceeași formă. Editabili.
- **Legături determinante** — dependențele care stabilesc data acestei activități, ca `← 1.2` (predecesor) sau `→ 1.4` (succesor). Doar în citire. Este învechită până la *Calculare*.
- **Marjă liberă** (în categoria *Dependențe*) — marja liberă pe dependență, ca `← 1.2: 3d`. Nu este aceeași coloană ca *Marjă liberă* din *Calculat*, care arată marja activității în sine. Doar în citire.
- **Avertismente** — avertismente pe dependență, de exemplu *În afara secvenței* sau *Nu este inclus în calcul*. Doar în citire. Vedeți [Notificări și avertismente](docs://ref-meldingen).

## Resurse

- **Resurse atribuite** — numele resurselor atribuite, separate prin virgulă. Editabil: adăugarea unui nume atribuie resursa cu 1 unitate pe zi, iar eliminarea unui nume elimină atribuirea. Doar în citire la un jalon sau o activitate rezumat.
- **Unități de atribuire pe zi** — unitățile pe resursă, ca `Name: 1; Name: 0.5`. Editabile la o activitate cu atribuiri.
- **Curbă de atribuire** — curba pe resursă, ca `Name: Uniform`. Editabilă la o activitate cu atribuiri.
- **Început fereastră de lucru** și **Sfârșit fereastră de lucru** — fereastra de lucru pe resursă, dintr-un fișier importat, ca `Name: date`. Doar în citire.
- **Lucru planificat (ore)** și **Lucru real (ore)** — lucrul planificat și lucrul real pe resursă, în ore, ca `Name: 12`, dintr-un fișier importat. Doar în citire.
- **Lucru rămas (ore)** — lucrul rămas pe resursă, în ore, ca `Name: 6`: lucrul salvat, altfel durata rămasă × unități. Editabil la o activitate cu atribuiri la care se aplică o regulă de lucru. Apare în selector doar când regulile de lucru sunt vizibile.

## Progres

- **Stare** — *Nepornită*, *În curs* sau *Finalizată*. Editabilă, cu excepția unei activități rezumat.
- **Progres** — procentul de finalizare, ca `40%`. Editabil cu un număr de la 0 la 100, cu excepția unei activități rezumat.
- **Început efectiv** — data la care a început activitatea. Editabilă, cu excepția unei activități rezumat.
- **Sfârșit efectiv** — data la care activitatea a fost finalizată. Editabilă, cu excepția unei activități rezumat.
- **Durată reală** — durata deja parcursă, ca număr. Editabilă, cu excepția unei activități rezumat.
- **Rămas** — durata rămasă, în unitatea activității. Editabil, cu excepția unei activități rezumat.
- **Data reluării** și **Data opririi** — reluarea și oprirea unei activități în curs dintr-un fișier MS Project sau Primavera. Doar în citire.

Coloanele de progres respectă regulile de progres ale aplicației: o dată reală după data raportului de stare este refuzată. La o activitate rezumat, aplicația spune *Progresul unei activități rezumat se calculează din subactivități și nu poate fi modificat aici.*

## Calculat

Toate coloanele din această categorie sunt doar în citire.

- **Întârziere prin redistribuire** — câte zile lucrătoare a întârziat redistribuirea activitatea. O liniuță dacă nu s-a aplicat nicio redistribuire.
- **Început cel mai devreme** și **Sfârșit cel mai devreme** — cele mai devreme date din calcul.
- **Început târziu** și **Sfârșit târziu** — cele mai târzii date de început și de sfârșit ale activității, fără să întârzie proiectul.
- **Marjă liberă** — zilele lucrătoare cu care activitatea poate aluneca, fără să întârzie o succesoare.
- **Marjă totală** — zilele lucrătoare cu care activitatea poate aluneca, fără să întârzie sfârșitul proiectului. Negativă dacă o restricție sau un termen limită nu poate fi respectat.
- **Critic** — *Da*, dacă activitatea se află pe drumul critic.
- **Marjă de interferență** — marja totală minus marja liberă.
- **Aproape critic** — *Da* pentru o activitate aproape critică. Este completată doar dacă *Marcare activități aproape critice* este activat (*Informații proiect*, blocul *Profil de calcul și opțiuni de calcul*). În caz contrar, o liniuță.
- **Drum de marjă** — numărul drumului de marjă, 1 pentru cel mai critic. Este completat doar dacă *Mai multe drumuri de marjă* este activat. În caz contrar, o liniuță.
- **Sursa datelor înregistrate** — pentru un fișier cu date înregistrate: *Abatere* sau *Parțial nenregistrat*. Este vizibilă în selector doar pentru un astfel de fișier. Pe o axă neînregistrată, *Nenregistrat* apare în coloanele de date târzii și de marjă.

Vedeți [Drumul critic și marja](docs://uitleg-kritiek-pad).

## Referință

Pentru fiecare referință a proiectului se adaugă coloane, cu numele referinței în fața numelui coloanei (`<baseline> — Scheduled start`). Ele sunt doar în citire. O activitate care nu este în referință arată o liniuță, cu indiciul *Nu există în această referință*.

- **Început planificat**, **Sfârșit planificat** și **Durată** — începutul, sfârșitul și durata așa cum le-a salvat referința.
- **Varianță de început** și **Varianță de sfârșit** — numărul de zile lucrătoare între referință și începutul sau sfârșitul afișat, în calendarul proiectului. Pozitiv dacă activitatea este mai târzie.
- **Varianță de durată** — durata curentă minus durata din referință, în zile lucrătoare.

## Particularizat

- **Cod de activitate** — câte o coloană pentru fiecare cod de activitate, cu numele codului. Arată codul valorii alese. Editabil: scrieți codul sau îl alegeți din sugestii. Un cod necunoscut este refuzat. Dacă un cod apare de mai multe ori, aplicația vă cere să-l alegeți din listă.
- **Câmp particularizat** — câte o coloană pentru fiecare câmp particularizat, cu numele lui. Introducerea se potrivește tipului: text, număr, număr întreg, cost, dată sau da/nu. Editabil.

Aceste coloane aparțin proiectului în care se află codul sau câmpul. Vedeți [Coduri și câmpuri particularizate](docs://howto-codes-en-velden).

## Tehnic

Toate coloanele din această categorie sunt doar în citire. Ele arată date pe care aplicația le stochează, dar nu într-o coloană obișnuită, de exemplu pentru verificarea unui import.

- **ID activitate** — id-ul intern al activității.
- **ID activitate părinte** și **ID-uri activități copil** — id-urile activității părinte și ale activităților copil.
- **ID-uri resurse** — id-urile resurselor de pe activitate.
- **ID atribuire**, **ID activitate atribuire** și **ID resursă atribuire** — id-urile atribuirii, activității și resursei acestei activități.
- **Durată (minute)** și **Rămas (minute)** — durata și durata rămasă, în minute. Este completată doar pentru o activitate în ore.
- **Întârziere prin redistribuire (minute)** și **Întârziere prin redistribuire, timp scurs** — întârzierea prin redistribuire din MS Project, în minute, și dacă se numără în timp scurs.
- **Planificat manual** — dacă activitatea este planificată manual.
- **Tip de activitate MS Project (import)** și **Determinat de efort** — tipul de activitate și indicatorul determinat de efort, așa cum le avea MS Project.
- **Proveniență Primavera P6** — câmpurile sursă dintr-un fișier Primavera, ca `key: value`.
- **Activitate rezumat explicită** — dacă activitatea este o activitate rezumat explicită, fără subactivități (dintr-un fișier Primavera).
- **Limită sfârșit pe ore**, **Ancoră început pe ore**, **Segmente de durată pe ore** și **Contururi pe ore** — distribuția pe ore dintr-un fișier MS Project, ca date și numere.
- **Date cod de activitate**, **Date câmp particularizat** și **Date note** — numărul de atribuiri de coduri, de câmpuri particularizate și de note.
- **Date dependențe interne** și **Date legături între proiecte** — numărul de dependențe interne și de legături între proiecte.
- Din fiecare referință, **Jalon** și **Tip de jalon** sunt, de asemenea, aici, așa cum le-a salvat referința.
