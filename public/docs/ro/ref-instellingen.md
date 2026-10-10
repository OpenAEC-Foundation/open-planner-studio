# Setări

Fiecare setare a aplicației: ce face, ce valoare de pornire are, ce schimbă și unde o găsiți. Pentru opțiunile de calcul ale unui proiect (profilul de calcul, definiția criticului) consultați [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies). Acestea aparțin fișierului proiectului, nu aplicației.

## Unde le găsiți și cum funcționează

Panoul cu setări se află în trei locuri, iar peste tot este același panou: pictograma cu roată din partea de sus a ferestrei, *Setări › Proiect › Setări* și *Fișier › Setări*. Panoul are trei file: *Afișare*, *Planificare* și *Avansat*. Fiecare setare de mai jos indică doar fila.

O modificare intră în vigoare imediat. Nu există buton *Aplicare*, nici *Anulare*.

**Pentru toată aplicația, nu pe proiect.** Toate setările din acest articol se aplică tuturor proiectelor dumneavoastră și aparțin acestui dispozitiv. Aplicația le păstrează în spațiul de stocare al aplicației sau al browserului, nu în fișierul proiectului. Dacă altcineva deschide fișierul dumneavoastră, acesta vede propriile setări. Un browser al cărui spațiu de stocare îl goliți pornește din nou cu valorile de pornire.

## Fila Afișare

**Temă** — schema de culori a interfeței. Alegeți dintre *Întunecat*, *Luminos* și *Contrast ridicat*. Implicit: *Întunecat*. Efect: culorile întregii interfețe, inclusiv Gantt și histograma. Unde: *Afișare*.

**Urmărire temă sistem** — permite ca tema sistemului dumneavoastră de operare să decidă. Implicit: dezactivat. Efect: aplicația este *Luminos* sau *Întunecat*, în funcție de sistem; cele trei carduri de temă sunt atunci dezactivate. *Contrast ridicat* nu urmărește sistemul: îl alegeți singur. Dacă dezactivați această opțiune, rămâne tema care era pe ecran în acel moment. Unde: *Afișare*, sub *Temă*.

**Limbă** — limba interfeței. Implicit: limba browserului sau a sistemului dumneavoastră, dacă aplicația o cunoaște; altfel engleza. Efect: toate textele din aplicație. Cele paisprezece limbi sunt sortate după codul lor scurt. Araba și persana oglindesc interfața de la dreapta la stânga. Limba articolelor de ajutor o setați separat, sub *Limba documentației* în *Fișier › Ajutor*. Unde: *Afișare*.

**Font** — fontul întregii interfețe. Alegeți dintre *Implicit*, *Sistem*, *Cu serife* și *Monospațiat*. Implicit: *Implicit*. Efect: titlurile și textul din fereastră, precum și textul din Gantt și din histogramă. O aplicație web nu urmează singură fontul sistemului; de aceea îl alegeți aici. Unde: *Afișare*.

**Dimensiune text** — scara interfeței. Alegeți dintre 90%, 100%, 110% și 125%. Implicit: 100%. Efect: textul și aspectul panglicii, panourilor și dialogurilor devin mai mari sau mai mici. Înălțimea rândurilor din tabel și din Gantt se modifică în același fel. Nu există o valoare peste 125%, deoarece etichetele butoanelor din panglică s-ar rupe atunci pe mai multe rânduri. Unde: *Afișare*.

**Format dată** — modul în care apar datele în aplicație. Alegeți dintre *zz-ll-aaaa*, *ll-zz-aaaa* și *aaaa-ll-zz*. Implicit: *zz-ll-aaaa*. Efect: datele din tabel, din dialoguri, din rapoarte și de la tipărire. Fișierele și calculele nu se schimbă: se schimbă doar afișarea. Unde: *Afișare*.

**Afișare durată** — în ce unitate apare durata unei activități. Alegeți dintre *Automat (unitatea proprie a fiecărei activități)*, *Întotdeauna zile* și *Întotdeauna ore*. Implicit: *Automat (unitatea proprie a fiecărei activități)*. Efect: în tabelul de activități, în etichetele barelor din Gantt, în textul explicativ, la tipărire și în rapoarte. Cu *Automat* o activitate pe zile arată zile, iar o activitate pe ore arată ore. Cu *Întotdeauna zile* sau *Întotdeauna ore* aplicația convertește folosind orele pe zi din calendarul activității. Dacă unitatea activității este alta, aplicația adaugă propria unitate între paranteze, de exemplu `2.25d(18h)`. Se schimbă doar afișarea; activitatea își păstrează propria unitate. Unde: *Afișare*.

**Stil comutare documente** — modul în care treceți de la un proiect deschis la altul. Alegeți dintre *File orizontale*, *File verticale* și *Pastilă*. Implicit: *File orizontale*. Efect: *File orizontale* pune o bară cu file sub panglică. *File verticale* pune o bară de proiecte în stânga. *Pastilă* pune un mic buton de proiect în bara de titlu. Unde: *Afișare*.

### Secțiunea Gantt

**Afișare doar zile lucrătoare** — comprimă axa timpului. Implicit: dezactivat. Efect: weekendurile și sărbătorile din calendarul proiectului sunt sărite. Astfel, o activitate de 5 zile lucrătoare are exact lățimea a 5 zile. Comenzile *Derulare la azi* și *Potrivire la proiect* numără atunci și ele în zile lucrătoare. Raportul are propria casetă de bifare cu același nume, independentă de această setare. Unde: *Afișare*, sub *Gantt › Axa timpului*.

**Afișare sferturi de oră la zoom mare** — o scară de timp suplimentară și mai fină. Implicit: dezactivat. Efect: puteți mări mai mult, iar scara orelor primește un rând suplimentar cu sferturi de oră. Tragerea unei bare de ore se poate alinia atunci la sferturi de oră, nu la ore întregi. Acest lucru îl vedeți doar când *Activare planificare pe ore* este activată. Unde: *Afișare*, sub *Gantt › Zoom pe sfert de oră*.

**Bare de activitate la întreruperi** — dacă o activitate pe ore se desenează în blocuri. Alegeți dintre *Niciodată împărțire*, *Împărțire la selectare* și *Întotdeauna împărțire*. Implicit: *Împărțire la selectare*. Efect: bara unei activități pe ore se desenează atunci pe intervale de lucru, nu ca un singur interval continuu. *Împărțire la selectare* face asta doar pentru activitatea selectată. Setarea privește doar activitățile pe ore. O activitate care este cu adevărat scindată (cu *Scindare activitate*) își arată întreruperea, indiferent de această setare. Unde: *Afișare*, sub *Gantt*.

**Derulare și zoom › Mod** — ce face rotița mouse-ului peste Gantt. Alegeți dintre *Poziție*, *Taste* și *Zoom + tragere*. Implicit: *Zoom + tragere*. Efect: cu *Zoom + tragere* rotița face zoom în jurul cursorului, Shift + rotița derulează prin rânduri, iar trăgând fundalul deplasați axa timpului. Ctrl + tragere (Cmd pe Mac) desenează o casetă de selecție. Cu *Poziție* funcția rotiței depinde de locul cursorului; Ctrl + rotița face întotdeauna zoom, iar Shift + rotița derulează întotdeauna orizontal. Cu *Taste* alegeți singur ce tastă face ce. Alegerea se aplică și celei de-a doua axe a vizualizării împărțite. Unde: *Afișare*, sub *Gantt › Derulare și zoom*.

**Derulare și zoom › Împărțirea ecranului** — unde trebuie să fie cursorul pentru fiecare funcție. Vizibil doar în modul *Poziție*. Alegeți dintre *Stânga/dreapta*, *Sus/jos* și *Colț dreapta sus*. Implicit: *Stânga/dreapta*. Efect: cu *Stânga/dreapta* rotița derulează vertical peste jumătatea stângă și orizontal peste jumătatea dreaptă. Cu *Sus/jos* rotița derulează orizontal peste primii 30% de sus, lângă scara timpului, și vertical sub ea. Cu *Colț dreapta sus* rotița derulează orizontal în cadranul din dreapta sus și vertical în rest. Unde: *Afișare*, sub *Gantt › Derulare și zoom*.

**Derulare și zoom › Vertical, Orizontal, Zoom** — ce tastă aparține cărei funcții a rotiței. Vizibil doar în modul *Taste*. Pentru fiecare funcție alegeți dintre *Derulare*, *Ctrl + derulare* și *Shift + derulare*. Implicit: *Vertical* este *Derulare*, *Zoom* este *Ctrl + derulare*, iar *Orizontal* este *Shift + derulare*. Efect: dacă alegeți o tastă care este deja folosită, aceasta schimbă locul cu funcția care o avea. Unde: *Afișare*, sub *Gantt › Derulare și zoom*.

## Fila Planificare

**Activare mod construcție** — valori de pornire orientate spre construcții, pentru proiecte noi. Implicit: activat. Efect: activat dă unui proiect nou calendarul *Bouwkalender NL* cu sărbătorile legale olandeze. Permite să alegeți o sărbătoare de șantier la generarea sărbătorilor și oferă șabloanele de etapizare *Construcție de locuințe* și *Clădiri nerezidențiale / renovare*. Activitățile noi primesc tipul de activitate *Construcție*. Dezactivat oferă calendarul *Standaardkalender* fără sărbători, doar șablonul *Gol* și tipul de activitate *Altele*. O activitate nouă sub o activitate părinte care are un tip de activitate preia mai întâi acel tip. Abia după aceea se aplică *Construcție* sau *Altele*. Activitățile și calendarele existente nu se schimbă. Unde: *Planificare*.

**Activare planificare pe ore** — planificare în ore de lucru, pe lângă zilele de lucru. Implicit: dezactivat. Efect: scara de timp *Oră* apare sub *Vizualizare › Scară de timp*. Fereastra *Calendare* primește blocul *Ore de lucru*. Fereastra *Creare proiect nou* primește opțiunile *Tură* și *Unitate implicită pentru activități noi*. *Informații proiect* primește opțiunea *Unitate implicită pentru activități noi*. Dezactivat, aplicația lucrează pe zile. Activitățile care sunt deja în ore rămân așa și sunt incluse în calcul. Puteți modifica durata lor abia după ce activați planificarea pe ore. Unde: *Planificare*, sub *Planificare pe ore*. Consultați [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).

**Permite planificare mixtă zile/ore** — dacă alegeți unitatea pentru fiecare activitate. Vizibil doar când *Activare planificare pe ore* este activată. Implicit: activat. Efect: activat afișează lista derulantă *Unitate de durată* lângă durata fiecărei activități. Dezactivat ascunde lista. Unde: *Planificare*, sub *Planificare pe ore*. Consultați [Zile și ore](docs://uitleg-dagen-en-uren).

**Prima zi a săptămânii** — prima zi a săptămânii. Alegeți dintre *Luni* și *Duminică*. Implicit: *Luni*. Efect: aspectul săptămânilor și numerele săptămânilor din scara de timp din Gantt și din rapoarte (tipărirea diagramei Gantt). Efect și asupra ordinii zilelor săptămânii din fereastra *Calendare*. Unde: *Planificare*.

**Calculare automată** — recalculează planificarea imediat ce nu mai este actuală. Implicit: dezactivat. Efect: dezactivat înseamnă că apăsați singur *Calculare* (F5). Activat face ca aplicația să recalculeze planificarea într-o fracțiune de secundă după o modificare a activităților, dependențelor sau calendarului. În timpul unui gest de tragere sau cât scrieți într-un câmp, aplicația așteaptă și calculează o singură dată, când ați terminat. După un calcul nereușit, calculează din nou doar după ce ați schimbat ceva. Unde: *Planificare*, sub *Calcul*.

**Afișare reguli de lucru și lucru** — câmpurile pentru regula de lucru și lucru din aplicație. Implicit: dezactivat. Efect: activat afișează câmpul *Regulă de lucru* la o activitate și coloana de lucru pentru atribuiri. De asemenea, face disponibilă coloana de tabel *Regulă de lucru*. Dezactivat le ascunde; durata și unitățile de atribuire rămân, iar lucrul urmează. Un proiect care conține deja date despre regulă de lucru sau lucru, de exemplu dintr-un fișier `.mpp` sau `.xer`, le afișează întotdeauna, chiar dacă setarea este dezactivată. Unde: *Planificare*, sub *Calcul*. Consultați [Reguli de lucru: durată, unități și lucru](docs://uitleg-werkregels).

## Fila Avansat

**Activare mod AI** — lasă un asistent de inteligență artificială să lucreze cu planificarea dumneavoastră. Implicit: dezactivat. Efect: activat afișează fila *AI* cu puntea MCP, astfel încât un asistent de inteligență artificială poate lucra cu planificarea prin Model Context Protocol. Dezactivat ascunde fila și oprește puntea. Unde: *Avansat*, sub *Mod AI*. Consultați [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen).

**Pornire automată a punții** — pornește puntea MCP când pornește aplicația. Poate fi activată doar când *Activare mod AI* este activată. Implicit: dezactivat. Efect: puntea este activă imediat, astfel încât un client AI se poate conecta fără să deschideți mai întâi fila *AI*. Funcționează doar în aplicația desktop și o singură dată la fiecare pornire. Dacă opriți singur puntea după aceea, nu pornește din nou. Unde: *Avansat*, sub *Mod AI*.

**Activare terminal de depanare** — un panou cu jurnal pentru depanare. Implicit: dezactivat. Efect: activat pune un buton de terminal în bara de stare, care afișează sau ascunde panoul cu jurnal. Dezactivat închide panoul. Unde: *Avansat*, sub *Terminal de depanare*.

**Benchmark…** — măsoară performanța motorului de planificare. Efect: deschide o fereastră în care generați o planificare de test de o dimensiune aleasă și măsurați fazele principale. Proiectul deschis rămâne neatins. Este un buton, nu o setare: nu există nimic de reținut. Unde: *Avansat*, sub *Benchmark*.

**Statistici…** — de câte ori a fost descărcată aplicația. Efect: deschide fereastra *Statistici de descărcare* cu cifre publice din GitHub Releases. De la dumneavoastră nu se colectează nimic. Este un buton, nu o setare. Unde: *Avansat*, sub *Statistici*. În fereastră:

- *Descărcări pe sistem de operare* — pentru fiecare sistem apar coloanele *Descărcări*, *Programe de instalare* (ce descarcă o persoană) și *Actualizări* (ce preia actualizatorul din aplicație), cu un *Total*. Pe Linux cele două nu pot fi separate: actualizatorul preia același fișier `.deb`, `.rpm` sau `.AppImage` pe care oamenii îl descarcă și manual. Acolo contează ca fișier de instalare doar fișierul snap. Sub ele apare *Verificări de actualizare din aplicație*: cât de des a preluat actualizatorul dintr-o aplicație instalată fișierul cu versiunea de la GitHub, ca să caute o versiune nouă. Acestea sunt verificări, nu instalări.
- *Pe versiune* — aceleași descărcări pe versiune, cu data. Întâi apar cele șase versiuni cele mai noi. Pentru restul folosiți *Afișare toate cele … versiuni*.
- *Sursă* — data cifrelor (GitHub Releases, actualizat săptămânal) și *Reîmprospătare acum*. Aplicația păstrează cifrele preluate timp de o jumătate de oră. Dacă preluarea nu reușește, fereastra o spune. Instalările prin Snap Store nu trec prin GitHub și lipsesc.

**Pornire tur** — turul de introducere, din nou. Efect: închide fereastra cu setări și pornește turul de la primul pas. Unde: *Avansat*, sub *Tur ghidat*.

**Versiune** — numărul de versiune al aplicației, cu două butoane. *Verificare actualizări* deschide fereastra de actualizare. *Ce este nou* arată noutățile versiunii actuale. Unde: *Avansat*, sub *Versiune*.

**Afișare butoane clasice ale vizualizării** — o funcție înlocuită, sub *Funcții vechi*. Implicit: dezactivat. Efect: activat pune din nou un grup *Afișare* pe fila *Vizualizare*, cu butoanele separate *Coloane…*, *Filtrare…*, *Grupare…* și *Sortare…*. Ele au fost înlocuite de plusul din antetul tabelului, de butoanele de aspect și de fereastra de aspect. Unde: *Avansat*, sub *Funcții vechi*.

## Alegeri de afișare reținute în afara panoului

Aplicația păstrează și aceste alegeri pe acest dispozitiv, dar le setați direct la element, nu în panoul de setări.

**Suprapunere referință** — referința activă ca o bară subțire sub bara activității. Implicit: activat. Unde: *Vizualizare › Referințe și progres › Suprapunere referință*.

**Linia de progres** — linia în zigzag a progresului la data raportului de stare. Implicit: activat. Efect: linia apare doar dacă proiectul are o dată a raportului de stare și înlocuiește atunci linia separată a datei raportului de stare. Unde: *Vizualizare › Referințe și progres › Linia de progres*.

**Linia datei raportului de stare** — o linie punctată la data raportului de stare. Implicit: activat. Efect: dacă linia de progres este activată, ea desenează singură marcajul. Unde: *Vizualizare › Referințe și progres › Linia datei raportului de stare*.

**Accent resursă** — o fâșie subțire în culoarea resursei sub bara activității. Implicit: dezactivat. Unde: *Vizualizare › Referințe și progres › Accent resursă*.

**Zonă de marjă** — marja ca o zonă în spatele barelor necritice. Implicit: activat. Unde: *Vizualizare › Referințe și progres › Zonă de marjă*.

**Culori bare** — de ce depinde culoarea unei bare. Alegeți dintre *Drum critic*, *Per activitate — automat* și *Pe categorie*. Implicit: *Drum critic*. Efect: se aplică în același timp la diagrama Gantt și la raport. Unde: *Vizualizare › Referințe și progres › Culori bare*.

**Histogramă** — fâșia cu histograma de sub diagrama Gantt. Implicit: dezactivat. Unde: *Resurse › Histogramă › Histogramă*, *Vizualizare › Panouri › Histogramă* sau Ctrl+Shift+H. Setați înălțimea fâșiei (implicit 160 de pixeli, între 80 și 480) trăgând de marginea ei.

**Mini-hartă** — o hartă de ansamblu a liniei de timp. Implicit: dezactivat. Unde: *Vizualizare › Prezentare › Mini-hartă*.

**Panglică restrânsă** — o panglică compactă. Implicit: dezactivat. Unde: butonul cu săgeată din colțul din dreapta jos al panglicii.

**Lățimea tabelului de activități** — implicit 350 de pixeli, între 150 și 800. Setați-o trăgând separatorul de lângă tabel sau cu tastele cu săgeată la stânga și la dreapta, când separatorul are focusul.

**Lățimea panoului din dreapta** — implicit 280 de pixeli, între 200 și 900. Setați-o trăgând de marginea panoului.

**Înălțimea *Proprietăți* și *Avertismente* din panoul din dreapta** — implicit 240 și 220 de pixeli, între 120 și 2000. *Proprietăți* are și această înălțime când lista de resurse este deschisă. Setați înălțimea cu mânerul de tragere dintre secțiuni. Aplicația nu reține dacă secțiunile sunt deschise sau închise.

**Și alte setări, descrise în altă parte** — coloanele tabelului ([Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen)), aspectele dumneavoastră ([Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken)), opțiunile raportului ([Tipuri de raport](docs://ref-rapporttypes)), șabloanele dumneavoastră de profil de calcul ([Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies)) și *Limba documentației* din Ajutor (*Fișier › Ajutor*) sunt, de asemenea, păstrate de aplicație pe acest dispozitiv, nu în fișierul proiectului.

## Vezi și

- [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies): opțiunile care aparțin unui proiect.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): pașii pentru comutatorul *Activare planificare pe ore*.
- [Zile și ore](docs://uitleg-dagen-en-uren): cum numără aplicația zilele și orele.
- [Reguli de lucru: durată, unități de atribuire și lucru](docs://uitleg-werkregels): ce face vizibil *Afișare reguli de lucru și lucru*.
- [Comenzi rapide de la tastatură](docs://ref-sneltoetsen): toate tastele aplicației, inclusiv cele pentru zoom și derulare.
