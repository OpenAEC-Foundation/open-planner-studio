# Notificări și avertismente

Aplicația vă arată ce se întâmplă în patru locuri: bara de stare din partea de jos, panoul *Avertismente* din coloana din dreapta, notificările care apar pentru scurt timp în partea de jos a ecranului și fâșiile de sub panglică. Acest articol spune, pentru fiecare loc, ce vedeți, când apare și ce puteți face. Motivul pentru care o planificare are drum critic sau supraalocare este în [Drumul critic și marja](docs://uitleg-kritiek-pad); rezolvarea supraalocării este în [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen); crearea dependențelor este în [Crearea dependențelor](docs://howto-relaties-leggen).

## Diferența dintre cele patru

- **Bara de stare** — un rând fix cu contoare. Ele vin de la ultimul calcul și rămân până calculați din nou.
- **Panoul de avertismente** — lista din spatele acestor contoare, cu tot ce a găsit ultimul calcul. Un clic vă duce la activitate, la dependență sau la resursă. Lista se formează din ultimul calcul; nu se salvează nimic.
- **Notificări** — mesaje scurte despre ceva ce tocmai ați făcut (salvarea nu a reușit, dependența a fost refuzată, importul a fost citit). Informările dispar, iar erorile rămân până le închideți. Ele nu apar în panou.
- **Fâșie sub panglică** — o fâșie colorată cu o explicație și un buton. Ea aparține unei stări a documentului sau unui mod și rămâne cât timp se aplică starea respectivă. Consultați *Fâșiile de sub panglică*.

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

## Fâșiile de sub panglică

O fâșie se află direct sub panglică, deasupra spațiului de lucru. Are un text și un buton. Fâșia pentru un mod nu are cruce; celelalte le închideți cu crucea. Cele cinci fâșii sunt:

- **Mod de dependență** — *Mod de dependență: trageți în Gantt de la o bară la alta pentru a crea o dependență. Apăsați Esc pentru a opri*. Rămâne cât timp modul de dependență este activ. Buton: *Oprire*. Consultați [Crearea dependențelor](docs://howto-relaties-leggen).
- **Mod de scindare** — *Faceți clic pe o bară în ziua în care începe întreruperea și trageți spre dreapta pentru durată. Apăsați Esc pentru a opri*. Rămâne cât timp *Scindare activitate* este pornită. Buton: *Oprire*.
- **Planificare pe ore în fișier** — *Acest fișier conține planificare pe ore*. Apare când un fișier deschis conține planificare pe ore, iar *Activare planificare pe ore* este dezactivată. Buton: *Activare planificare pe ore*. Consultați [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).
- **Structură blocată** — *Indisponibil la filtrare, grupare sau sortare*. Apare când nu puteți indenta sau indenta negativ o activitate, pentru că tabelul de activități este filtrat, grupat sau sortat. Buton: *Golire*, care șterge filtrul, gruparea și sortarea.
- **Datele salvate** — după deschiderea unui fișier în care recalcularea a mutat datele, apare: *Recalcularea a mutat N din M activități față de datele din fișier.* Cu butonul *Afișare date salvate*. Cât timp vizualizarea este activă: *Sunteți în vizualizarea datelor salvate în fișier …*, cu butonul *Recalculare*. Consultați [Datele salvate](docs://uitleg-datums-zoals-opgeslagen).

## Notificări

Notificările apar în partea de jos a ecranului, de asemenea în tabel, în Backstage și în modul de prezentare. O notificare este o *eroare* sau o *informație*. O eroare este roșie și rămâne până faceți clic pe cruce. O informație dispare după 5 secunde (o notificare cu multe explicații rămâne mai mult timp). Aceste cronometre pornesc din nou imediat ce se modifică stiva. Fiecare notificare are o cruce în dreapta sus (sugestia *Închidere notificare*), care o închide imediat. Un clic pe textul notificării nu face nimic. Un refuz este întotdeauna o eroare: o notificare că aplicația nu a realizat ceva ce ați făcut, cum ar fi o dependență, o durată, un început sau un jalon refuzat. Astfel nu o ratați dacă priviți o clipă în altă parte. Un refuz dispare după Ctrl+Z sau Ctrl+Y și când treceți la alt document, pentru că nu mai este corect. Altă eroare, cum ar fi *Salvarea a eșuat*, rămâne. Acest lucru este valabil și dacă restul aceleiași acțiuni a reușit, de exemplu la lipirea în mai multe celule. Dacă sunt implicate mai multe activități, o linie de mai jos arată care activități nu au fost modificate, de exemplu *Nu s-a modificat: Foundation, Masonry.* Cu mai mult de cinci, linia se termină cu *și încă N activități*. Același refuz se grupează într-o singură linie cu un contor când se repetă. Cel mult trei sunt afișate în același timp. Dacă vine o a patra, iese prima informație, cea mai veche. Dacă nu există informații, iese cel mai vechi refuz, apoi cea mai veche notificare de deschidere fixată și abia apoi cea mai veche eroare. Astfel, o informație sau un refuz nu împinge afară o altă eroare, cum ar fi *Salvarea a eșuat*. Stiva se mută de la butoanele unei casete de dialog deschise și de la barele de acțiuni fixate. De asemenea, o notificare la deschiderea unui fișier rămâne până faceți clic pe cruce, dacă aplicația a completat, înlocuit, reparat sau lăsat deoparte date la deschidere: o linie despre constatări ale analizorului sau din calendar, probleme de format numeric, reveniri pentru enumerări, setări de planificare P6 cu o revenire sigură, o revenire de protecție la referință, referințe orfane ignorate, activități fără început planificat cărora li s-a dat un început, dependențe între proiecte sau activități fără proiect care nu au fost preluate (P6 XML), ceva dintr-un fișier MS Project care nu a fost importat (MS Project XML și `.mpp`) sau o arhivă sursă XER neutilizabilă, precum și notificările despre id-uri și dependențe duplicate care nu sunt calculate. Dacă conține doar informații fără o astfel de modificare (de exemplu numărul de proiecte, documente sau codificarea textului), notificarea dispare după 5 secunde.

- **Contor ×N** — o notificare cu o cheie fixă reunește o repetare într-o singură linie cu un contor, de exemplu o eroare de salvare care revine mereu sau o dependență refuzată pe care o repetați. Nu fiecare notificare face asta.
- **Citiți mai multe** — unele notificări au un link *Citiți mai multe* sau un subiect propriu (de exemplu *Despre tipurile de activitate*) către ghidul din Backstage › Ajutor.
- **Buton de acțiune** — notificarea despre profilul de calcul are un buton *Deschidere profil de calcul* către Informații despre proiect.

Lista de mai jos este o selecție, grupată pe subiecte. Acolo unde nu se precizează altfel, este o informație.

### Salvare, deschidere și refacere

- **Salvare eșuată** (eroare) — *Salvarea a eșuat*, cu motivul dedesubt. La salvare, la salvare ca și la exportul unui raport.
- **Salvat ca descărcare** (informație) — *Salvat ca descărcare: „{name}” se află acum în folderul de descărcări. …* La *Salvare ca* și la exporturi, când mediul nu permite aplicației să scrie direct în locul ales. Două descărcări una după alta se grupează.
- **Salvat ca descărcare (explicație)** (informație, 15 secunde) — *Salvat ca descărcare: „{name}” se află în folderul de descărcări. Acest browser nu permite aplicației să scrie într-un loc propriu, …* La *Salvare*, într-un browser care salvează numai prin descărcare. O dată pe sesiune, cu un link către explicația despre fișiere.
- **Browserul nu scrie înapoi** (informație, 15 secunde) — *Acest browser nu permite aplicației să scrie înapoi în „{name}”. …* La *Salvare* a unui proiect care are un fișier, când browserul trebuie să ceară din nou un loc. O dată pe sesiune, cu un link către explicația despre fișiere.
- **Salvarea automată a eșuat** (eroare) — *Salvarea automată a eșuat*, cu motivul. Se aplică salvării automate în fișier și refacerii în urma unei căderi.
- **Biblioteca nu a putut fi salvată** (eroare) — *Biblioteca de resurse nu a putut fi salvată*, la salvarea bibliotecii de resurse.
- **Deschiderea unui fișier a eșuat** (eroare) — *Deschiderea fișierului a eșuat*, cu motivul. De exemplu, la un fișier recent sau la un fișier importat.
- **.mpp vechi sau protejat** (eroare) — *Acest fișier .mpp folosește un format mai vechi (Project 2007 sau anterior)…* sau *Acest fișier .mpp este protejat cu parolă…*, ambele cu sfatul de a exporta ca XML din MS Project și de a deschide acel fișier.
- **Fișier XER nevalid** (eroare) — unul dintre textele *XER…*, de exemplu *Acesta nu este un fișier XER valid sau acceptat.* sau *Fișierul XER conține un tabel duplicat.*, cu motivul adăugat.
- **Fișierul IFC nu a putut fi citit** (eroare) — *Fișierul IFC nu a putut fi citit*, cu motivul, în vizualizarea IFC.
- **Refacere** (eroare) — *Fișierul restaurat nu a putut fi citit*, *Restaurarea a eșuat* și *N fișiere de restaurare nu au putut fi încărcate și au fost omise.* La refacerea după o oprire neașteptată.
- **Ramură salvată ca șablon** (informație) — *Ramura a fost salvată ca șablon „{name}”*.
- **Mesaj de la o extensie** (informație, sau eroare dacă extensia raportează o eroare) — *Extensia {name}: {message}*. O extensie poate afișa cel mult trei mesaje noi la 10 secunde, ca să nu umple stiva. Dacă un pas din îndrumarea unei extensii eșuează, apare *Un pas al extensiei {name} a eșuat. Îndrumarea continuă.*, iar dacă un fișier de proiect al unei extensii nu poate fi deschis, apare *Fișierul de proiect {file} din extensia {name} nu a putut fi deschis.* Ambele sunt erori.
- **O modificare a intervenit între timp** (eroare) — *O modificare făcută de asistentul de inteligență artificială sau de o extensie a intervenit între timp. …* La anularea casetei de dialog a activității, când asistentul de inteligență artificială sau o extensie a modificat ceva între timp: modificările activității de dinaintea acelei modificări nu sunt anulate și rămân ca pași obișnuiți sub *Anulare*.

### Calcularea

- **Planificarea nu a putut fi calculată** (eroare) — *Planificarea nu a putut fi calculată*, cu motivul dedesubt (consultați *Motivele unei erori de planificare*). La *Calculare*, la trecerea la alt document și la deschiderea unui fișier.
- **Data raportului de stare a fost setată la azi** (informație) — *Data raportului de stare a fost setată la azi ({date}).* La introducerea progresului într-un proiect fără dată a raportului de stare. Aplicația măsoară progresul până la data raportului de stare, deci fără această dată nu poate prelucra progresul. Stabiliți o altă dată sub *Planificare › Referințe și progres › Data raportului de stare*. Cu un link *Citiți mai multe* către [Progres, data raportului de stare și referință](docs://uitleg-voortgang).
- **Durată mai scurtă decât lucrul deja efectuat** (eroare) — *Activitatea „{name}” este deja realizată în proporție de {N}%: o durată mai scurtă decât lucrul deja efectuat nu este posibilă. Durata nu a fost modificată.*

### Dependențe și ierarhie

- **Dependență refuzată** (eroare) — *Această dependență există deja*, *O dependență între o activitate și propria activitate rezumat părinte sau strămoș nu este permisă.* sau *Această dependență ar crea un ciclu în planificare ({cycle}) și nu a fost creată.* Ciclul numește activitățile, astfel încât știți mai întâi ce dependență trebuie ștearsă sau inversată.
- **Mutare refuzată** (eroare) — *Această mutare ar crea un ciclu în planificare ({cycle}): dependențele unei activități rezumat se aplică și subactivităților ei. Nimic nu a fost mutat.*
- **Dependențe ies din calcul după o mutare** (informație) — *După mutare, N dependențe leagă activități de propriile activități rezumat; ele nu mai intră în calcul.*
- **Dependențe omise la inserare** (eroare) — *N dependențe nu au fost create: legătură nevalidă…*, la lipirea sau inserarea unei ramuri. O linie de mai jos arată care dependențe, de exemplu *Nu s-a creat: Foundation → Masonry.*
- **Dependențe neluate în calcul după import** (informație) — *N dependență(e) nu au putut fi incluse în calcul. Verificați coloanele Predecesori și Succesori.*
- **Id-uri duplicate după import** (informație) — *Obiecte cu un id duplicat în acest fișier: N. Au primit id-ul lor propriu…*

### Editarea activităților

- **Început înregistrat ca restricție** (informație) — *„{name}” nu începe înainte de {date} (SNET).* La modificarea începutului unei activități cu un predecesor. Predecesorul stabilește începutul, deci aplicația înregistrează data dumneavoastră ca restricție *nu începe înainte de* (SNET). După recalcularea (F5), activitatea nu începe înainte de acea dată. Dacă activitatea avea deja o astfel de restricție, apare *„{name}” acum nu începe înainte de {date} (SNET).*; pentru mai multe activități deodată se afișează un număr. Cu un link *Citiți mai multe* către [Restricții și termene limită](docs://uitleg-constraints).
- **Început neaplicat** (eroare) — *Noul început al „{name}” nu a fost aplicat: activitatea are un predecesor, iar restricția {type} {date} și predecesorul îi stabilesc începutul. Modificați acea restricție pentru a muta începutul.*
- **Jalon refuzat** (eroare) — *„{task}” are atribuiri de resurse și nu poate deveni jalon. Eliminați mai întâi atribuirile.* sau *„{task}” este o activitate rezumat cu subactivități și nu poate deveni jalon.* La conversia în caseta de dialog a activității, în panoul de proprietăți, în meniul contextual și în tabel.
- **Atribuiri mutate la o subactivitate** (informație) — *Atribuirea a fost mutată la subactivitatea „{child}”.* sau *N atribuiri au fost mutate la subactivitatea „{child}”.* Când o extensie dă subactivități unei activități cu atribuiri. Activitatea devine activitate rezumat, iar o activitate rezumat nu are atribuiri proprii. De aceea acestea se mută la prima subactivitate nouă. În aplicația în sine alegeți asta în fereastra *Activitatea devine activitate rezumat*; acest mesaj nu apare. Cu un link *Citiți mai multe* către [Ajustarea structurii](docs://howto-structuur-aanpassen).
- **Marcaj de jalon eliminat** (informație) — *„{phase}” nu mai este jalon.* Când un jalon primește subactivități. Un jalon este un moment fără subactivități; cu subactivități devine activitate rezumat. Cu un link *Citiți mai multe* către [Ajustarea structurii](docs://howto-structuur-aanpassen).
- **Întrebare depășită** (eroare) — *Activitățile sau atribuirile au fost modificate cât timp întrebarea era deschisă. Nu s-a modificat nimic; încercați din nou.* Când alegeți în fereastra *Activitatea devine activitate rezumat*, dar întrebarea nu mai corespunde.
- **Activitate rezumat refuzată** (eroare) — *„{phase}” nu poate deveni activitate rezumat: …* cu motivul, și *Nu s-a modificat nimic.* Când o extensie dă subactivități unei activități cu atribuiri, iar atribuirile nu pot merge la prima subactivitate nouă. În aplicația în sine acest mesaj nu apare: acolo fereastra *Activitatea devine activitate rezumat* întreabă ce să se facă, iar *Mutare* este atunci dezactivată.
- **Celule omise la lipire** (eroare) — *N celule omise: sunt doar în citire (de exemplu un cod WBS numerotat automat sau o coloană calculată).*
- **Referințe eliminate la lipire** (informație) — *N referințe nu existau în acest document și au fost eliminate (calendare de activitate, categorii de lucrări particularizate, coduri de activitate sau câmpuri particularizate din documentul sursă).*
- **Structură blocată** (eroare, o fâșie roșie sub panglică) — *Indisponibil la filtrare, grupare sau sortare*, cu butonul *Golire*. Cât timp lista este filtrată, grupată sau sortată: când indentați, când indentați negativ și când trageți activități, cu *Inserare deasupra* și *Inserare dedesubt* (meniul cu clic dreapta sau o comandă rapidă). Fâșia rămâne până faceți clic pe cruce, folosiți Ctrl+Z sau Ctrl+Y ori treceți la alt document. Consultați [Ajustarea structurii](docs://howto-structuur-aanpassen).
- **Activitate adăugată la sfârșit** (eroare) — *Noua activitate se află la sfârșit. În timpul filtrării, grupării sau sortării, aplicația nu o poate plasa sub selecția dumneavoastră.* Cu butonul *Golire*. Cu *Activitate* și *Jalon ▾*, când o activitate este selectată și lista este filtrată, grupată sau sortată. Activitatea se adaugă, dar jos. *Golire* elimină filtrul, gruparea și sortarea și închide notificarea. Consultați [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen).
- **Durate ajustate de tipul de activitate** (informație) — *După modificarea calendarului, tipul de activitate a ajustat durata pentru N activități (lucrul rămâne, orele pe zi s-au schimbat).* Cu un link *Despre tipurile de activitate*.

### Primavera P6 XML

- **Fișier P6 XML deschis** (informație) — *Fișierul P6 XML a fost deschis: N documente de proiect.* După deschiderea unui fișier P6 XML.
- **Neimportat** (rămâne) — *N dependențe între proiecte nu au fost preluate ca dependențe.* și *N activități fără proiect nu au fost citite.* Verificați dacă planificarea dumneavoastră este completă.
- **Gol sau neutilizabil** (eroare) — nu se deschide nimic. Trei motive: *În acest fișier nu există activități pe care aplicația le poate citi.*, *Activitățile nu au ObjectId. …* și *Fișierul folosește denumirile coloanelor XER … Deschideți chiar fișierul .xer.*

### Primavera (XER)

- **Fișier XER deschis** (informație) — *Fișier XER deschis: N documente de proiect.* Câte o notificare pentru fiecare fișier, chiar dacă fișierul deschide mai multe proiecte, cu un link *Citiți mai multe* și linii de detalii dedesubt. Mereu *N proiecte găsite.* Doar când numărul este mai mare decât 0: *N proiecte goale omise.*, *N proiecte de referință excluse.*, *N referințe materializate.*, *N trimiteri de referință orfane ignorate.*, *S-a folosit o revenire de protecție la referință.* și *N legături între proiecte păstrate.* Doar pentru o codificare diferită de UTF-8: *Codificarea textului a fost stabilită ca {encoding}.* Mai departe, când numărul este mai mare decât 0: *N constatări ale analizorului.*, *N constatări din calendar.*, *N probleme de format numeric.*, *N reveniri pentru enumerări* și *N setări de planificare P6 au folosit o revenire sigură.*
- **Date așa cum le-a salvat Primavera** (linie de detalii în aceeași notificare) — *N activități afișează datele așa cum le-a salvat Primavera (nerecalculate).* N numără fiecare activitate pentru care fișierul a înregistrat date, inclusiv cele care nu diferă. Sau, dacă modul nu s-a activat, *N activități diferă de datele din fișier — puteți să le afișați.*
- **Arhivă sursă XER neutilizabilă** (informație) — *Arhiva sursă XER din acest fișier nu este utilizabilă și a fost omisă; proiectul în sine a fost deschis complet.* cu motivul (de exemplu *Motiv: suma de control nu se potrivește cu octeții sursă; arhiva este deteriorată.*) și consecința (*Planificarea, profilul de calcul și toate datele de proiect din IFC sunt complete. …*). La deschiderea unui fișier IFC în care o arhivă sursă XER salvată anterior nu poate fi folosită. Și la refacerea după o oprire neașteptată, dacă spațiul de refacere nu mai conține arhiva sursă.
- **Exportul pierde informații XER** (informație) — *La exportul în {format} se pierd informațiile sursă din XER.* După un export reușit, într-un alt format decât IFC, al unui proiect cu date care există doar într-un fișier XER. Cu un link *Citiți mai multe*.

### Importul, exportul și profilul de calcul

- **Date ca în fișier** (informație) — *N activități afișează datele așa cum sunt în fișier (nerecalculate).* (N numără fiecare activitate cu date înregistrate) sau *N activități diferă de datele din fișier — puteți să le afișați.* La deschiderea unui fișier cu date înregistrate.
- **Lucru și tipuri de activitate vizibile** (informație) — *Acest fișier conține lucru salvat sau tipuri de activitate; tipul de activitate și lucrul rămas sunt vizibile pentru acest proiect.*
- **Planificare MS Project citită** (informație) — *Acest fișier MS Project conține N activități cu o planificare fragmentată, redistribuită sau ghidată de resurse. Sunt importate și afișate ca atare.*
- **Întreruperi neexportate** (informație) — *N activități cu întreruperi au fost exportate fără întreruperile lor: MS Project și P6 cunosc întreruperile doar ca distribuție a lucrului.* La exportul în MS Project sau Primavera.
- **Început de proiect mutat** (informație) — *N activități s-au mutat odată cu începutul proiectului.* Când stabiliți mai târziu începutul proiectului. Se mută la această dată doar activitățile fără predecesor și fără o restricție care ar cădea înaintea noii date de început. Cu un link *Citiți mai multe* către [Proiect nou și Informații despre proiect](docs://ref-projectinfo).
- **Fereastra de date nu mai conduce** (informație) — *Fereastra de date din MS Project nu mai conduce N activități după această modificare; …* O dată pe document.
- **Întârziere prin redistribuire rotunjită** (informație) — *Redistribuirea rotunjește la zile lucrătoare întregi întârzierea prin redistribuire din MS Project, exactă până la minut, pentru N activități.* O dată pe document.
- **Profil de calcul aplicat** (informație) — *Acest proiect se calculează ca {profile}. Modificați din Fișier → Informații despre proiect → Profil de calcul și opțiuni de calcul.* Cu butonul *Deschidere profil de calcul*. După aplicarea unui profil urmează, dacă este nevoie, *După aplicare, N activități au fost deplasate.*
