# Instrumente AI (planner_*)

Toate instrumentele pe care le poate apela un asistent de inteligență artificială prin punte, pe grupe, cu ce fac și ce refuză. Toate încep cu `planner_`. Solicitarea de conectare din fereastra *Date de conectare* arată numărul curent. Asistentul de inteligență artificială primește lista completă, cu descrieri, direct de la punte (`tools/list`). Motivul pentru care legătura funcționează așa este explicat în [Cum funcționează legătura AI](docs://uitleg-ai-koppeling). Cum o porniți este explicat în [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen).

## Cum se citește această listă

**Citire** înseamnă: instrumentul nu modifică nimic. Acest lucru funcționează chiar și când *Pauzare* și *Doar în citire* sunt activate. O fereastră de dialog deschisă blochează instrumentul (vezi *Când un instrument este refuzat* mai jos). Un instrument de citire oferă întotdeauna date curente. Dacă planificarea este învechită, instrumentul recalculează mai întâi, chiar și când *Pauzare* și *Doar în citire* sunt activate. Aceste stări opresc modificările, nu recalcularea la citire. Dacă sunteți în mijlocul unei modificări (trăgând o bară, scriind într-un câmp), instrumentul nu recalculează. Asistentul de inteligență artificială primește atunci datele de dinainte de modificarea dumneavoastră, cu o notificare că sunt învechite. Dacă proiectul se află în vizualizarea *Datele înregistrate*, instrumentul nu recalculează. Asistentul de inteligență artificială primește atunci datele înregistrate, cu o notificare că nu au fost recalculate.

**Modificare** înseamnă: instrumentul modifică proiectul dumneavoastră. Este refuzat dacă *Pauzare* este activată, dacă *Doar în citire* este activată sau dacă este deschisă o fereastră de dialog. Același lucru se aplică instrumentelor fără etichetă de mai jos (`planner_undo`, `planner_redo`, instrumentele pentru fișiere și cele pentru documente, cu excepția `planner_list_documents`). Fiecare modificare este un pas în istoricul dumneavoastră de anulare. Dacă datele proiectului se modifică, aplicația recalculează singură planificarea după aceea. Nu trebuie să apăsați *Calculare*. Înainte de prima modificare pe document, aplicația scrie un backup, dacă *Backup automat* este activat.

**În bloc** înseamnă: un apel poate conține mai multe elemente. Un element nevalid este refuzat, cu un motiv, iar elementele valide rămân. Răspunsul numește elementele refuzate.

## Citire: planificare

- `planner_get_project_info` (citire) — detaliile proiectului și cifrele principale: numărul de activități, dependențe, resurse și jaloane, data raportului de stare, sfârșitul și durata proiectului, dacă planificarea este învechită, profilul de calcul și un rezumat al calendarelor. Este un bun prim apel.
- `planner_get_project_overview` (citire) — întregul arbore WBS într-un singur răspuns: pentru fiecare ID de activitate, WBS, nume, durată, datele timpurii, progres, critic și dependențele de ieșire, cu ID-ul lor de dependență.
- `planner_list_tasks` (citire) — activități, cu filtre (critice, stare, interval de date, activități fără dependențe) și paginare.
- `planner_get_task` (citire) — o activitate în detaliu: date, marjă, progres, restricții, termen limită, calendar, atribuiri, predecesori și succesori, întreruperi.
- `planner_get_critical_path` (citire) — activitățile critice cu marjă totală și dependențele care determină drumul critic.
- `planner_list_resources` (citire) — resurse cu capacitate, tarif standard, calendar, echipă și disponibilitate, plus un rezumat al atribuirilor lor. Dacă o resursă vine dintr-o bibliotecă de resurse, arată ce câmpuri sunt fixe.
- `planner_get_resource_histogram` (citire) — încărcarea față de capacitate, pe resursă, pe zi, pe săptămână sau pe lună (implicit pe săptămână). Fără interval și fără resurse, oferă un rezumat pe resursă. Cu un interval sau cu resurse, oferă seria completă și activitățile care cauzează o supraalocare.
- `planner_get_calendars` (citire) — toate calendarele, cu definiția completă și numărul de activități și resurse care le folosesc.

## Citire: referințe și varianță

- `planner_list_baselines` (citire) — referințele salvate și care dintre ele este activă.
- `planner_compare_baseline` (citire) — planul curent față de referința activă: doar activitățile care diferă și diferența de sfârșit al proiectului, în zile lucrătoare din calendarul proiectului. Fără referință activă, refuză.
- `planner_analyze_delay` (citire) — analiza întârzierii față de referința activă: diferența de livrare și activitățile critice care s-au mutat. Fără referință activă, refuză.

## Activități și arbore WBS

- `planner_add_tasks` (modificare, în bloc) — creează activități, inclusiv un arbore WBS imbricat, într-un singur apel. Fiecare activitate primește un nume temporar propriu (`tmp-…`), ca o activitate copil să poată indica activitatea părinte. Fără durată, o activitate primește 5 zile lucrătoare. Un jalon are durata 0. Toate activitățile unui apel reușesc împreună sau eșuează împreună.
- `planner_update_tasks` (modificare, în bloc) — modifică câmpurile activităților existente: nume, descriere, durată cu unitate (zile sau ore), tip de durată, tip de activitate, jalon, obligatoriu, prioritate, restricție, termen limită, calendar și regulă de lucru. Există și câmpuri de progres: procent finalizare, început efectiv și sfârșit efectiv. Orice altă cheie este refuzată, cu un motiv.
- `planner_delete_tasks` (modificare) — șterge activități, inclusiv tot subarborele, dependențele și atribuirile lor. Răspunsul numește exact ce a fost șters împreună cu ele.
- `planner_move_task` (modificare) — mută o activitate sub alt părinte, pe o poziție dată. Un ciclu sau mutarea unei activități sub ea însăși este refuzată.
- `planner_set_task_splits` (modificare) — stabilește întreruperile unei activități: după câte zile lucrătoare (sau ore de lucru) de lucru, și cât durează fiecare întrerupere, în zile lucrătoare (sau ore de lucru). O listă goală elimină toate întreruperile. Vezi [Împărțirea unei activități](docs://howto-taak-splitsen).

## Dependențe

- `planner_add_dependencies` (modificare, în bloc) — creează dependențe cu un tip (`FS`, `SS`, `FF`, `SF` sau forma lungă) și cu decalaj, de exemplu `+2d`.
- `planner_update_dependencies` (modificare, în bloc) — modifică tipul, decalajul, predecesorul sau succesorul unei dependențe existente, după ID-ul dependenței. Este un singur pas, în loc să ștergeți și să creați din nou.
- `planner_remove_dependencies` (modificare, în bloc) — șterge dependențe după ID-ul dependenței.

## Proiect și calendare

- `planner_update_project` (modificare) — nume, descriere, autor, companie, data de început, data de sfârșit, data raportului de stare, modul de progres și implicitul proiectului pentru regula de lucru. Data de început este ancora pentru activitățile noi. Dacă asistentul de inteligență artificială o stabilește mai târziu, se mută doar activitățile libere (fără predecesor și fără o restricție care stabilește o limită inferioară, cum ar fi *Nu începe înainte de*). Răspunsul indică numărul lor în `anchorsClamped`; restul planificării rămâne pe loc. Vezi [Proiect nou și Informații proiect](docs://ref-projectinfo). Data raportului de stare nu este o etichetă, ci data de referință a calculului: la o planificare fără progres, totul se mută. Data de sfârșit este doar metadată.
- `planner_move_project` (modificare) — mută întreaga planificare existentă la o nouă dată de început. Calendarele nu se mută împreună cu ea, deci sfârșitul poate sări cu alt număr de zile decât începutul. Referințele rămân, cu excepția cazului în care asistentul de inteligență artificială le mută explicit și pe acestea. Vezi [Mutarea unui proiect](docs://howto-project-verplaatsen).
- `planner_update_calendar` (modificare, în bloc) — modifică sau creează calendare: zile lucrătoare, ore de lucru, pauză, intervale orare, sărbători (generate pentru o țară și o regiune, sau specificate literal) și excepții de lucru. Nu poate schimba care calendar este calendarul proiectului.

## Resurse și unități de atribuire

- `planner_manage_resources` (modificare, în bloc) — creează, modifică sau șterge resurse: nume, tip (muncă, echipament, material, subcontractant sau echipă), descriere, capacitate maximă, cost pe oră, unitate, calendar, echipă și disponibilitate în timp. Refuză să șteargă o resursă cu atribuiri până când asistentul de inteligență artificială confirmă explicit. Pentru o resursă din biblioteca de resurse, numele, tipul, descrierea, tariful standard pe oră și unitatea sunt fixe.
- `planner_manage_assignments` (modificare, în bloc) — adaugă, modifică, mută sau șterge atribuiri: unități de atribuire pe zi lucrătoare, curbă și lucru rămas. Numai pe o activitate fără subactivități, și aceeași resursă doar o dată pe activitate. Ce face o modificare a unităților de atribuire cu durata depinde de regula de lucru a activității, ca în [Reguli de lucru: durată, unități și lucru](docs://uitleg-werkregels).
- `planner_level_resources` (modificare) — redistribuie supraalocarea. Implicit, în limita marjei, astfel că data de sfârșit rămâne; cu `constrainToFloat: false`, sfârșitul se poate muta. Cu o rulare de probă, asistentul de inteligență artificială primește mai întâi o previzualizare, fără nicio modificare. Omite materialele. Vezi [Redistribuirea resurselor](docs://uitleg-nivelleren).
- `planner_clear_leveling` (modificare) — elimină toate întârzierile prin redistribuire.

## Gestionarea referințelor

- `planner_save_baseline` (modificare) — salvează planificarea curentă ca referință și o face activă imediat. Mai întâi recalculează datele învechite. Nu poate fi folosit într-un script.
- `planner_activate_baseline` (modificare) — face o referință activă, sau niciuna.
- `planner_rename_baseline` (modificare) — redenumește o referință.
- `planner_delete_baseline` (modificare) — șterge o referință. Dacă era cea activă, ultima referință rămasă devine activă, sau niciuna, dacă nu mai rămâne nimic.

## Anulare

- `planner_undo` și `planner_redo` — anulează sau refac un pas în documentul activ. Istoricul este același cu al dumneavoastră. Răspunsul arată dacă s-a anulat efectiv ceva.

## Documente și fișiere

- `planner_list_documents` (citire) — toate documentele deschise, cu titlu, dacă sunt active și dacă sunt modificate, numărul de activități, începutul proiectului și sfârșitul calculat.
- `planner_new_document` — un document nou, gol, într-o filă proprie, fără fereastra *Proiect nou*.
- `planner_duplicate_document` — copiază documentul activ într-o filă nouă, pentru o variantă „ce-ar fi dacă” sau pentru o ofertă. Copia este detașată și nu are o cale de fișier.
- `planner_switch_document` — face activ alt document. Este și modul de a confirma, după ce ați schimbat fila, cu ce document lucrează asistentul de inteligență artificială.
- `planner_import_schedule` — deschide un fișier de planificare de pe disc ca document: `.ifc`, `.xml` (Primavera P6 sau MS Project, recunoscut după conținut), `.csv`, `.xer` și `.mpp` (MS Project 2010 până la 2021). Nimic nu se îmbină cu planul curent. Un CSV nu are calendar, deci datele se pot deplasa. Numai în dosarul dumneavoastră de utilizator. După un import CSV, XML sau `.mpp`, documentul nu are o destinație de salvare; numai un IFC preia calea lui.
- `planner_export_ifc` — scrie documentul activ ca fișier IFC 4.3. Numai în dosarul dumneavoastră de utilizator, iar un fișier existent se suprascrie numai la cerere explicită. Proiectul rămâne nesalvat.

## Ghid și proveniența sursei

- `planner_get_planning_guide` (citire) — ghidul în engleză pentru asistenți de inteligență artificială (principiile din [Planificare bună](docs://gids-goed-plannen), cu instrumentele pentru fiecare principiu), cele două abilități *goed-plannen* (stabilirea unei planificări) și *progress-update* (actualizarea progresului), sau totul. Alegeți cu `part`: `guide`, `skill` (ambele abilități) sau `both`; implicit `both`. Pentru fiecare abilitate, răspunsul arată unde trebuie să fie plasată și adresele de descărcare. Parametrul `language` este încă acceptat pentru asistenții mai vechi, dar textul este întotdeauna în engleză. Nu modifică planificarea.
- `planner_inspect_xer_provenance` (citire) — inspectează semantica sursei păstrate dintr-un fișier Primavera P6 deschis (`.xer`): ce conținea fișierul, cu numărul celor importate și diagnostice. Câmpurile cu text liber din fișier rămân implicit invizibile; asistentul de inteligență artificială trebuie să le ceară explicit. Nu poate fi folosit într-un script.

## Scriptul

- `planner_batch` — rulează un script de cel mult 100 de pași ca o singură modificare: un singur pas de anulare, o singură recalculare, un singur backup. Dacă un pas eșuează structural, tot scriptul se anulează, iar răspunsul arată pentru fiecare pas ce s-a executat, ce a eșuat sau ce nu a fost atins. Numele temporare (`tmp-…`) de la `planner_add_tasks` se aplică în pașii următori. Nu se pot folosi ca pas: `planner_batch` în sine, anularea și refacerea, instrumentele pentru documente și fișiere, `planner_save_baseline`, `planner_get_planning_guide` și `planner_inspect_xer_provenance`. Un script nu este un limbaj de programare: nu există variabile, condiții sau bucle.

## Când un instrument este refuzat

Asistentul de inteligență artificială primește atunci un răspuns cu un cod de eroare și o explicație.

- `PAUSED` — *Pauzare* este activată.
- `READ_ONLY` — *Doar în citire* este activată.
- `DIALOG_OPEN` — o fereastră de dialog este deschisă. Aceasta se aplică și la citire, cu excepția `planner_get_planning_guide`. Răspunsul numește ce este deschis, după numele intern, de exemplu `showTaskDialog`.
- `DOC_DRIFT` — ați schimbat fila în timp ce asistentul de inteligență artificială lucra. Asistentul de inteligență artificială trebuie să confirme cu `planner_switch_document` cu ce document lucrează.
- `VALIDATION` — argumentele nu corespund schemei, sau modificarea cerută nu este permisă. Răspunsul numește câmpul.
- `NOT_FOUND` — un ID sau un document nu există.
- `CYCLE` — modificarea ar crea un ciclu. Totul din acel apel se anulează.
- `SCOPE` — calea fișierului se află în afara dosarului dumneavoastră de utilizator.
- `BACKUP_FAILED` — backupul înainte de modificare a eșuat; modificarea nu a fost executată.
- `INTERNAL` — o eroare neașteptată la rularea unui instrument, de exemplu o operație cu fișiere care a eșuat. Răspunsul dă mesajul de eroare original.
- `STALE_PRECONDITION` — face parte din contractul punții, dar niciun instrument curent nu returnează acest cod.

O cerere care a stat în coadă mai mult de 110 secunde nu mai este executată de aplicație: clientul a primit deja un timeout, iar executarea ar modifica lucrurile de două ori la o reîncercare. Un apel care durează mai mult de 120 de secunde primește un timeout de la punte.

## Ce nu poate seta asistentul de inteligență artificială

Pentru fiecare activitate, asistentul de inteligență artificială nu poate seta: hamacul, planificarea manuală, o a doua restricție, notițe, culoarea, codurile de activitate, câmpurile particularizate, legăturile între proiecte și o întârziere prin redistribuire, introdusă manual. Aplicația calculează singură codul WBS. La nivel de proiect, nu poate modifica profilul de calcul și opțiunile de calcul. Setările, tema, limba, extensiile și actualizările sunt inaccesibile, la fel ca biblioteca de resurse. Nu are nici rapoarte, aspecte, filtre sau vizualizare. Motivul este explicat în [Cum funcționează legătura AI](docs://uitleg-ai-koppeling).

## Ce stochează aplicația

- **Tokenul** se află pe acest calculator, în setările salvate ale aplicației. Are 64 de caractere și este aleatoriu. *Creare token nou* îl înlocuiește.
- **Portul** este implicit 3877 și poate fi modificat numai când puntea este oprită.
- **Panoul de apeluri** păstrează ultimele 500 de apeluri, numai cât timp aplicația este deschisă. Argumentele și răspunsurile se taie după 20 kB pe câmp. *Ștergere* golește lista.
- **Backupurile** se află în dosarul `ai-backups` din dosarul de date al aplicației; *Deschidere dosar backup* vă duce acolo. Au numele `<project name>-<timestamp>.ifc`. Un fișier de proiect salvat are un singur dosar pentru toate sesiunile. Un document pe care nu l-ați salvat niciodată primește propriul dosar pentru fiecare sesiune. La fiecare pornire a punții se face câte un backup pentru fiecare document, plus backupurile pe care le faceți singur cu *Creare backup*.
- **Rărirea** se face singură, pe fiecare dosar. Din ultimele 7 zile rămân toate, până la 20; ce a făcut sesiunea care rulează rămâne întotdeauna. După aceea rămâne câte unul pe săptămână, până la 30 de zile vechime, câte unul pe lună până la un an, și apoi câte unul pe an. Backupurile unui document pe care nu l-ați salvat niciodată dispar complet după un an. Fișierele din dosar care nu aparțin aplicației rămân neatinse.

## Vezi și

- [Cum funcționează legătura AI](docs://uitleg-ai-koppeling): de ce puntea este configurată așa și ce are voie și ce nu are voie să facă asistentul de inteligență artificială.
- [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen): porniți puntea, conectați-vă, instalați abilitatea.
- [Setări](docs://ref-instellingen): cele două comutatoare AI.
- [Notificări și avertismente](docs://ref-meldingen): punctul AI din bara de stare.
