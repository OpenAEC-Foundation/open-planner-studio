# Notificări și avertismente

Aplicația vă arată ce se întâmplă în trei locuri: bara de stare din partea de jos, panoul *Avertismente* din coloana din dreapta și notificările care apar pentru scurt timp în partea de jos a ecranului. Acest articol spune, pentru fiecare loc, ce vedeți, când apare și ce puteți face. Motivul pentru care o planificare are drum critic sau supraalocare este în [Drumul critic și marja](docs://uitleg-kritiek-pad); rezolvarea supraalocării este în [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen); crearea dependențelor este în [Crearea dependențelor](docs://howto-relaties-leggen).

## Diferența dintre cele trei

- **Bara de stare** — un rând fix cu contoare. Ele vin de la ultimul calcul și rămân până calculați din nou.
- **Panoul de avertismente** — lista din spatele acestor contoare, cu tot ce a găsit ultimul calcul. Un clic vă duce la activitate, la dependență sau la resursă. Lista se formează din ultimul calcul; nimic nu este salvat.
- **Notificări** — mesaje scurte despre ceva ce tocmai ați făcut (salvarea nu a reușit, dependența a fost refuzată, importul a fost citit). Ele dispar și nu apar în panou.

## Bara de stare

Bara din partea de jos arată, de la stânga la dreapta:

- **Activități:** — numărul activităților de bază (activitățile rezumat nu se numără).
- **Jaloane:** — numărul jaloanelor.
- **Drum critic: N activități, N zile lucrătoare** — numărul activităților critice și durata proiectului. Este vizibil doar după un calcul.
- **Sfârșit:** — sfârșitul proiectului din calcul. Este vizibil doar după un calcul; un proiect gol nu are niciunul.
- **N termen(e) limită depășit(e)**, **N restricție(i) încălcată(e)**, **N dependență(e) cu progres în afara secvenței** și **N resursă(e) supraalocată(e)** — fiecare este un buton cu semn de avertizare. Apare doar când contorul este mai mare decât 0 și există un calcul. Un clic deschide panoul *Avertismente* (text de ajutor: *Deschidere panou de avertismente (detalii și navigare)*). Dacă sunteți pe fila *IFC* sau *Raport*, aplicația trece în același timp la *Acasă*, pentru că acolo nu există coloana din dreapta. Contorul pentru *resursă(e) supraalocată(e)* se actualizează și după modificări ale resurselor și atribuirilor; celelalte contoare se schimbă doar după *Calculare*. Cele patru contoare sunt o selecție: ce arată panoul în plus (devans tăiat, dependență ignorată, hamac fără legătură determinantă pentru sfârșit, dată de sfârșit limitată, eroare de planificare) nu este în bara de stare.
- **Învechită — recalculați (F5)** — cu semn de avertizare (text de ajutor: *Planificare învechită — recalculați (F5)*). Este vizibilă de îndată ce modificați ceva ce influențează planificarea și nu ați recalculat. Dacă *Calculare automată* este activată, nu apare, cu excepția cazului în care a apărut o eroare la calcul: atunci apare.
- **Selecție: N activitate(i)** — numărul activităților selectate. Este vizibil doar când există o selecție.
- **Scară:** și **Zoom: Npx/zi** — scara de timp a graficului și nivelul de zoom. Scara rezultă din zoom.
- **Nesalvat** — atât timp cât documentul are modificări care nu sunt în fișier.
- **AI** — un punct colorat cu cuvântul AI, doar când modul AI este activat. Textul de ajutor spune *Punte AI:* cu *Oprit*, *Activ pe portul N*, *Portul N este ocupat* sau *Eroare*. Un clic deschide fila *AI*.
- **Terminal de depanare** — un buton de terminal, doar când terminalul de depanare este activat; arată sau ascunde terminalul (*Afișare terminal de depanare* / *Ascundere terminal de depanare*).

## Panoul de avertismente

- **Deschidere** — *Planificare › Planificare › Avertismente*, *Vizualizare › Panouri › Avertismente*, sau un contor din bara de stare. Panoul se află în coloana din dreapta, sub *Proprietăți* și panoul de resurse, și extinde o coloană strânsă. În mod implicit este închis și nu se reține între sesiuni. Când este sub alte panouri, trageți de marginea lui pentru a schimba înălțimea; înălțimea se reține. Crucea din dreapta sus îl închide (*Închidere avertismente*).
- **Linia de antet** — *N eroare(i), N avertisment(e)*. Dacă nimic nu a fost calculat încă, scrie *Nu este calculată încă — apăsați Calculare (F5) pentru a efectua verificările.*
- **Calculare** — un buton în linia de antet, vizibil cât timp planificarea este învechită sau nu a fost calculată încă. Face același lucru ca *Calculare* din panglică.
- **Semn de avertizare în linia de antet** — când planificarea este învechită, cu textul de ajutor *Planificarea este învechită — această listă provine de la ultimul calcul. Recalculați (F5).* Lista nu este ascunsă, doar marcată ca învechită.
- **Listă goală** — *Niciun avertisment. Planificarea respectă toate verificările.*
- **Un rând** — sus este locul (activitate, dependență, resursă sau proiect), iar dedesubt descrierea. O eroare are un semn octogonal propriu, un avertisment un semn triunghiular. O activitate apare ca `nume WBS`. O dependență apare ca `predecesor → succesor (FS+2z)`, cu tip și decalaj. Un clic duce la loc (text de ajutor *Mergeți la: …*), vedeți mai jos. Rândul care aparține activității active (la o dependență: succesorul ei) sau resursei alese în histogramă este evidențiat.
- **Ordine** — mai întâi erorile; apoi pe fiecare fel, în ordinea listei de mai jos; în cadrul unui fel, în ordinea din document (la o dependență, cea a succesorului; la o resursă, cea din lista de resurse). O activitate, dependență sau resursă ștearsă după ultimul calcul dispare din listă.

### Tipuri de avertismente

- **Eroare de planificare** — *Planificarea nu a putut fi calculată: …*, cu motivul după el, vedeți mai jos. Un clic: la un ciclu, aplicația selectează toate activitățile din ciclu și trece la prima. La celelalte erori nu există un loc unde să treacă, iar rândul nu este un buton.
- **Termen limită depășit** — *Termen limită {date} depășit — sfârșit cel mai devreme {date}*. Activitatea are un termen limită, iar calculul nu îl respectă. Un clic trece la activitate. Pentru remediere: ajustați logica sau durata ori mutați termenul limită.
- **Restricție încălcată** — *Restricția {tip și dată} este suprascrisă de logică (marjă negativă)*. Restricția nu poate fi respectată fără să se rupă logica; marja este negativă. Un clic trece la activitate. Vedeți [Restricții](docs://uitleg-constraints).
- **În afara secvenței** — *În afara secvenței: progresul succesorului contrazice dependența*. Progresul succesorului nu se potrivește cu tipul dependenței. De exemplu: un succesor deja în lucru, cât timp predecesorul nu este încă terminat, la o dependență sfârșit-început. Un clic selectează ambele activități, cu succesorul activ. Verificați datele reale sau dependența.
- **Devans tăiat** — *Devans tăiat de începutul proiectului — dependența nu este folosită complet*. Devansul (decalaj negativ) al dependenței ajunge înaintea începutului proiectului. Un clic selectează ambele activități.
- **Dependență ignorată** — *Dependență ignorată: predecesorul sau succesorul lipsește sau nu este o activitate frunză*. Calculul nu folosește dependența. Un clic selectează activitățile care încă există. Vedeți [Dependențe](docs://uitleg-relaties).
- **Hamac fără legătură determinantă pentru sfârșit** — *Hamac fără legătură determinantă pentru sfârșit (niciun predecesor FF/SF): durata revine la zero*. Un clic trece la activitate. Vedeți [Activități hamac](docs://howto-hammock).
- **Dată de sfârșit limitată** — *Dată de sfârșit limitată: calendarul nu lasă nicio fereastră de lucru pentru această activitate*. Calculul a atins limita numărului de zile în care caută, de exemplu din cauza unei perioade foarte lungi de zile libere fără întrerupere în calendar. Un clic trece la activitate. Vedeți [Calendare și zile lucrătoare](docs://uitleg-kalenders).
- **Supraalocare** — *Supraalocare în N zi(le) (prima – ultima)*, cu *resursa nu lucrează în aceste zile conform calendarului ei* adăugat dacă toate zilele sunt zile libere, sau *din care N zi(le) resursa nu lucrează conform calendarului ei* în cazul unui amestec. Un clic selectează activitățile cu o atribuire la acea resursă, activează histograma și alege în ea acea resursă. Din *Tabel*, *IFC* sau *Raport* aplicația trece la *Resurse*. Vedeți [Panoul de resurse](docs://ref-resourcepaneel).

### Motive pentru o eroare de planificare

- *Dependență circulară între activități: {path}* — dependențele formează un ciclu. Activitățile sunt în traseu; inversați sau ștergeți o dependență.
- *Calendarul nu are zile lucrătoare setate* — dați calendarului cel puțin o zi lucrătoare, vedeți [Ferestrele calendarului](docs://ref-kalenders).
- *Durată nevalidă în zile pentru activitatea '{task}'* și *Durată nevalidă în ore pentru activitatea '{task}'* — durata activității nu este un număr valid.
- *Activitatea pe ore '{task}' nu are ore de lucru valide în calendarul său* — o activitate pe ore într-un calendar fără ore de lucru.
- *Dată de început nevalidă pentru activitatea '{task}'* — data de început a activității nu este validă.

## Notificări

Notificările apar în partea de jos a ecranului, de asemenea în tabel, în Backstage și în modul de prezentare. O notificare este o *eroare* sau o *informație*. O eroare rămâne până când faceți clic pe ea ca să o închideți. O informație dispare după 5 secunde. Cronometrele pornesc din nou de fiecare dată când se schimbă stiva. Un clic pe o notificare o închide (text explicativ *Închidere notificare*). Cel mult trei sunt afișate deodată. Dacă apare a patra, prima care iese este cea mai veche informație. Dacă nu există nicio informație, iese cea mai veche notificare, astfel încât o eroare nu iese niciodată din cauza unei informații. Stiva se mută din calea butoanelor unei ferestre de dialog deschise și a barelor de acțiuni fixate.

- **Contor ×N** — o notificare cu o cheie fixă reunește o repetare într-un singur rând, cu un contor. De exemplu, o eroare la salvare care revine mereu sau o dependență refuzată pe care o repetați. Nu fiecare notificare face asta.
- **Citiți mai multe** — unele notificări au un link *Citiți mai multe* sau un subiect propriu (de exemplu *Despre regulile de lucru*) care duce la ghidul din *Backstage › Ajutor*.
- **Buton de acțiune** — notificarea despre profilul de calcul are un buton *Deschidere profil de calcul*, care duce la *Informații proiect*.

Lista de mai jos este o selecție, grupată pe subiecte. Dacă nu se precizează altfel, este vorba despre o informație.

### Salvare, deschidere și restaurare

- **Salvare eșuată** (eroare) — *Salvarea a eșuat*, cu motivul dedesubt. La salvare, la salvare ca și la exportul unui raport.
- **Salvat ca descărcare** (informație) — *Salvat ca descărcare: „{name}” se află acum în folderul dumneavoastră de descărcări. …* Cu *Salvare ca* și cu exporturi, când mediul nu permite aplicației să scrie direct în locația pe care o alegeți. Două descărcări una după alta se reunesc.
- **Salvat ca descărcare (explicație)** (informație) — *Salvat ca descărcare: „{name}” se află în folderul dumneavoastră de descărcări. Acest browser nu permite aplicației să scrie într-un loc propriu, …* Cu *Salvare* într-un browser care salvează doar printr-o descărcare. O dată pe sesiune, cu un link către explicația despre fișiere.
- **Browserul nu scrie înapoi** (informație) — *Acest browser nu permite aplicației să scrie înapoi în „{name}”. …* Cu *Salvare* pentru un proiect care are un fișier, când browserul trebuie să ceară din nou o locație. O dată pe sesiune, cu un link către explicația despre fișiere.
- **Salvare automată eșuată** (eroare) — *Salvarea automată a eșuat*, cu motivul. Se aplică salvării automate în fișier și refacerii în urma unei căderi.
- **Biblioteca de resurse nu a putut fi salvată** (eroare) — *Biblioteca de resurse nu a putut fi salvată*, la salvarea bibliotecii de resurse.
- **Deschiderea fișierului a eșuat** (eroare) — *Deschiderea fișierului a eșuat*, cu motivul. De exemplu, pentru un fișier recent sau pentru unul importat.
- **Fișier .mpp vechi sau protejat** (eroare) — *Acest fișier .mpp are un format mai vechi (Project 2007 sau anterior)…* sau *Acest fișier .mpp este protejat cu parolă…*, ambele cu sfatul de a-l exporta ca XML din MS Project și de a deschide acel fișier.
- **Fișier XER nevalid** (eroare) — unul dintre textele *XER…*, de exemplu *Acesta nu este un fișier XER valid sau acceptat.* sau *Fișierul XER conține un tabel duplicat.*, cu motivul adăugat.
- **Fișierul IFC nu a putut fi citit** (eroare) — *Fișierul IFC nu a putut fi citit*, cu motivul, în vizualizarea IFC.
- **Restaurare** (eroare) — *Fișierul restaurat nu a putut fi citit*, *Restaurarea a eșuat* și *N fișiere de restaurare nu au putut fi încărcate și au fost omise.* La restaurarea după o oprire neașteptată.
- **Ramură salvată ca șablon** (informație) — *Ramura a fost salvată ca șablon „{name}”*.
- **Mesaj de la o extensie** (informație, sau eroare dacă extensia raportează o eroare) — *Extensia {name}: {message}*. O extensie poate afișa cel mult trei mesaje noi la fiecare 10 secunde, ca să nu umple stiva. Dacă un pas din îndrumarea unei extensii eșuează, apare *Un pas al extensiei {name} a eșuat. Îndrumarea continuă.* Dacă un fișier de proiect al unei extensii nu poate fi deschis, apare *Fișierul de proiect {file} din extensia {name} nu a putut fi deschis.* Ambele sunt erori.
- **O modificare a intervenit între timp** (informație) — *O modificare făcută de asistentul de inteligență artificială sau de o extensie a intervenit între timp. …* Când anulați fereastra de dialog a activității, în timp ce asistentul de inteligență artificială sau o extensie a modificat ceva între timp: modificările de activitate făcute înainte de acea modificare nu se anulează. Ele rămân ca pași obișnuiți, pe care îi puteți anula cu *Anulare*.

### Calcularea

- **Planificarea nu a putut fi calculată** (eroare) — *Planificarea nu a putut fi calculată*, cu motivul dedesubt (vezi *Motive pentru o eroare de planificare*). La *Calculare*, la trecerea de la un document la altul și la deschiderea unui fișier.
- **Data raportului de stare setată la azi** (informație) — *Încă nu exista o dată a raportului de stare: a fost setată la azi ({date}), deoarece progresul se măsoară până la data raportului de stare. O puteți modifica din Planificare → Data raportului de stare.* La introducerea progresului într-un proiect fără dată a raportului de stare.
- **Durată mai scurtă decât lucrul efectuat** (informație) — *Activitatea „{name}” este deja realizată în proporție de {N}%: o durată mai scurtă decât lucrul deja efectuat nu este posibilă. Durata nu a fost modificată.*

### Dependențe și ierarhie

- **Dependență creată** (informație) — *Dependență creată: {predecessor} → {successor}*.
- **Dependență refuzată** (informație) — *Această dependență există deja*, *O dependență între o activitate și propria activitate rezumat părinte sau strămoș nu este permisă.* sau *Această dependență ar crea un ciclu în planificare ({cycle}) și nu a fost creată.* Ciclul numește activitățile, astfel încât să știți ce dependență trebuie eliminată sau inversată mai întâi.
- **Mutare refuzată** (informație) — *Această mutare ar crea un ciclu în planificare ({cycle}): dependențele unei activități rezumat se aplică și subactivităților ei. Nimic nu a fost mutat.*
- **Dependențe care ies din calcul după o mutare** (informație) — *După mutare, N dependențe leagă activități de propriile activități rezumat; ele nu mai intră în calcul.*
- **Dependențe omise la inserare** (informație) — *N dependențe nu au fost create: legătură invalidă…*, la lipirea sau inserarea unei ramuri.
- **Dependențe neincluse după import** (informație) — *N dependență(e) nu au putut fi incluse în calcul. Verificați coloanele Predecesori și Succesori.*
- **ID-uri duplicate după import** (informație) — *Obiecte cu un ID duplicat în acest fișier: N. Li s-a atribuit un ID propriu…*

### Editarea activităților

- **Început înregistrat ca restricție** (informație) — *„{name}” are un predecesor: noul început este salvat ca restricție Nu începe înainte de (SNET) {date}. După ce recalculați (F5), activitatea nu începe înainte de această dată.* La modificarea începutului unei activități cu predecesor. Dacă activitatea avea deja o astfel de restricție, notificarea arată că a fost mutată. Pentru mai multe activități deodată, dă un număr.
- **Început neaplicat** (informație) — *Noul început al „{name}” nu a fost aplicat: activitatea are un predecesor și restricția {type} {date}, iar acestea îi stabilesc începutul. Modificați acea restricție pentru a muta începutul.*
- **Jalon refuzat** (informație) — *„{task}” are atribuiri de resurse și nu poate deveni jalon. Eliminați mai întâi atribuirile.* sau *„{task}” este o activitate rezumat cu subactivități și nu poate deveni jalon.* La conversia din fereastra de dialog a activității, din panoul de proprietăți, din meniul contextual și din tabel.
- **Atribuiri mutate la o subactivitate** (informație) — *Atribuirea pentru {resources} a fost mutată de la „{phase}” la noua subactivitate „{child}”: o activitate rezumat nu poartă ea însăși atribuiri.* Când o activitate cu atribuiri primește subactivități.
- **Marcaj de jalon eliminat** (informație) — *Jalonul „{phase}” are acum subactivități și a devenit activitate rezumat; marcajul de jalon a fost eliminat.*
- **Activitate rezumat refuzată** (informație) — *„{phase}” nu poate deveni activitate rezumat: …* cu motivul, și *Nu s-a modificat nimic.*
- **Celule omise la lipire** (informație) — *N celule omise: sunt doar în citire (de exemplu un cod WBS numerotat automat sau o coloană calculată).*
- **Referințe eliminate la lipire** (informație) — *N referințe nu existau în acest document și au fost eliminate (calendare de activitate, tipuri de activitate particularizate, coduri de activitate sau câmpuri particularizate din documentul sursă).*
- **Durate ajustate de o regulă de lucru** (informație) — *După modificarea calendarului, regula de lucru a ajustat durata pentru N activități (lucrul rămâne, orele pe zi s-au schimbat).* Cu un link *Despre regulile de lucru*.

### Primavera (XER)

- **Fișier XER deschis** (informație) — *Fișier XER deschis: N documente de proiect.* O notificare pentru fiecare fișier, chiar dacă fișierul deschide mai multe proiecte, cu un link *Citiți mai multe* și rânduri de detalii dedesubt. Întotdeauna *N proiecte găsite.* Doar când numărul este mai mare decât 0: *N proiecte goale omise.*, *N proiecte de referință excluse.*, *N referințe materializate.*, *N trimiteri de referință orfane ignorate.*, *S-a folosit o revenire de protecție la referință.* și *N legături între proiecte păstrate.* Doar pentru o codificare diferită de UTF-8: *Codificarea textului a fost stabilită ca {encoding}.* Mai departe, când numărul este mai mare decât 0: *N constatări ale analizorului.*, *N constatări din calendar.*, *N probleme de format numeric.*, *N reveniri pentru enumerări* și *N setări de planificare P6 au folosit o revenire sigură.*
- **Date așa cum le-a salvat Primavera** (rând de detalii în aceeași notificare) — *N activități afișează datele așa cum le-a salvat Primavera (nerecalculate).*, sau, dacă modul nu a fost pornit, *N activități diferă de datele din fișier — le puteți afișa.*
- **Arhiva sursă XER nu este utilizabilă** (informație) — *Arhiva sursă XER din acest fișier nu este utilizabilă și a fost omisă; proiectul în sine a fost deschis complet.* cu motivul (de exemplu *Motiv: suma de control nu se potrivește cu octeții sursă; arhiva este deteriorată.*) și consecința (*Planificarea, profilul de calcul și toate datele proiectului din IFC sunt complete. …*). La deschiderea unui fișier IFC în care o arhivă sursă XER salvată anterior nu poate fi folosită.
- **Exportul pierde informații XER** (informație) — *La exportul în {format} se pierd informațiile sursă din XER.* După un export reușit într-un format diferit de IFC, pentru un proiect cu date care există doar într-un fișier XER. Cu un link *Citiți mai multe*.

### Import, export și profil de calcul

- **Date ca în fișier** (informație) — *N activități afișează datele așa cum sunt în fișier (nerecalculate).* sau *N activități diferă de datele din fișier — le puteți afișa.* La deschiderea unui fișier cu date salvate.
- **Lucru și reguli de lucru vizibile** (informație) — *Acest fișier conține lucru salvat sau reguli de lucru proprii; regula de lucru și lucrul rămas sunt vizibile pentru acest proiect.*
- **Planificare MS Project citită** (informație) — *Acest fișier MS Project conține N activități cu o planificare fragmentată, redistribuită sau ghidată de resurse. Sunt importate și afișate ca atare.*
- **Întreruperi neexportate** (informație) — *N activități cu întreruperi au fost exportate fără întreruperile lor: MS Project și P6 cunosc întreruperile doar ca distribuție a lucrului.* La exportul în MS Project sau Primavera.
- **Început proiect mutat** (informație) — *Început proiect mutat: N ancore de activitate fără predecesor sau restricție au fost deplasate la noua dată de început.*
- **Fereastra de date nu mai ghidează** (informație) — *Fereastra de date din MS Project nu mai ghidează N activități după această modificare; …* O dată pe document.
- **Întârziere prin redistribuire rotunjită** (informație) — *Redistribuirea rotunjește la zile lucrătoare întregi întârzierea prin redistribuire din MS Project, exactă până la minut, pentru N activități.* O dată pe document.
- **Profil de calcul aplicat** (informație) — *Acest proiect se calculează conform profilului {profile}. Modificați din Fișier → Informații proiect → Profil de calcul și opțiuni de calcul.* Cu butonul *Deschidere profil de calcul*. După aplicarea unui profil, urmează, dacă este nevoie, *După aplicare, N activități au fost deplasate.*
