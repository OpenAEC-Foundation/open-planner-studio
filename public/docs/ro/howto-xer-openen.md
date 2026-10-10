# Deschiderea unui fișier Primavera P6 (.xer)

Scop: deschideți o planificare din Primavera P6 direct în aplicație, fără să o exportați mai întâi în XML.

## Când aveți nevoie de aceasta

Un client sau un antreprenor principal lucrează în Primavera și livrează planificarea sub forma unui fișier `.xer`. Doriți să îl vizualizați, să îl calculați sau să adăugați activități la el. Aplicația citește doar fișierele `.xer`: nu scrie în `.xer` și nu modifică niciodată fișierul dumneavoastră. Din fișier preia structura WBS și activitățile cu durată, date, restricții și progres, dependențele cu decalaj, calendarele și resursele cu atribuirile lor, plus codurile de activitate, câmpurile particularizate (UDF), notele și setările de planificare ale P6. O activitate de tip *Nivel de efort* devine un hamac.

## Pași

1. Alegeți *Acasă › Fișier › Deschidere* sau apăsați Ctrl+O. Alegeți fișierul `.xer`.
2. Aplicația deschide câte o filă pentru fiecare proiect care are activități. Proiectul cu cele mai multe activități este fila activă. O filă se numește *Nume proiect (ID proiect)* dacă ID-ul proiectului P6 diferă de nume.
3. Citiți mesajul din partea de jos. Pentru un fișier cu trei proiecte, mesajul poate arăta astfel: *Fișier XER deschis: 3 documente de proiect.* Sub mesaj sunt rânduri care explică ce a făcut aplicația. Consultați titlul de mai jos.
4. Verificați dacă sub panglică apare un mesaj: *Vizualizați planificarea așa cum a salvat-o Primavera; la recalculare, 1 activitate s-ar deplasa.* Primavera salvează în fișier propriile date calculate. Dacă datele calculate de aplicație diferă de acestea, aplicația afișează datele Primavera atâta timp cât nu modificați nimic. Ce înseamnă aceasta și cum treceți la calculul propriu al aplicației este descris în [Date salvate](docs://uitleg-datums-zoals-opgeslagen). Poate apărea și mesajul *Acest fișier conține planificare pe ore.*, cu butonul *Activare planificare pe ore*. Consultați [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).
5. Salvați proiectul cu Ctrl+S. Deoarece un fișier `.xer` nu se suprascrie niciodată, aplicația întreabă unde trebuie salvat noul fișier IFC. Ea propune *Nume proiect (ID proiect)* ca nume de fișier.

### Rândurile de sub mesaj

Prima linie a mesajului indică numărul de file deschise. Sub ea sunt doar rândurile care se aplică. Acestea merită atenția dumneavoastră:

- *Acest proiect se calculează conform profilului Primavera P6. Modificați din Fișier → Informații proiect → Profil de calcul și opțiuni de calcul.* Aplicația calculează acest proiect cu regulile de calcul ale Primavera. Cu *Deschidere profil de calcul* ajungeți la setare.
- *1 proiect de referință exclus.* și *1 referință materializată.* Dacă un proiect din P6 desemnează alt proiect drept referință, acel alt proiect nu se deschide ca filă proprie. Devine referința activă a proiectului care se referă la el.
- *S-a folosit o revenire de protecție la referință.* Dacă desemnarea referințelor ar face ca niciun proiect să nu se deschidă, dacă un proiect se referă la sine sau dacă proiectele se referă unele la altele în buclă, aplicația deschide pur și simplu toate proiectele și nu creează nicio referință.
- *1 legătură între proiecte păstrată.* O legătură între două proiecte. Aplicația o păstrează ca date sursă, dar nu o transformă într-o dependență în planificarea dumneavoastră.
- *1 activitate afișează datele așa cum le-a salvat Primavera (nerecalculate).* Numărul de activități pe care le vedeți în vizualizarea *Date salvate*.

Celelalte rânduri sunt diagnostice ale citirii: numărul de proiecte găsite, un proiect gol omis, o trimitere către o referință inexistentă ignorată, o codificare a textului diferită de UTF-8 simplu și contoare pentru constatările din tabele, din calendare și din numere, pentru valori necunoscute ale câmpurilor și pentru setările de planificare P6 pe care aplicația le-a înlocuit cu o alegere sigură. Acestea nu cer nimic din partea dumneavoastră. *Citiți mai multe* deschide Ajutorul despre deschiderea fișierelor Primavera.

## Capcane și ce face aplicația atunci

**Nu totul devine filă sau dependență.** Un proiect fără activități nu se deschide, un proiect de referință nu se deschide ca filă proprie, iar o legătură între două proiecte nu devine o dependență în planificarea dumneavoastră. Aplicația raportează acest fapt în rândurile de sub mesaj.

**Fiecare filă este un proiect propriu.** Dacă salvați una, fișierul IFC păstrează alături fișierul `.xer` original complet. Dacă redeschideți mai târziu fișierul IFC, aplicația cunoaște în continuare datele Primavera. Dacă arhiva sursă este deteriorată sau alt program IFC a rescris fișierul, aplicația raportează: *Arhiva sursă XER din acest fișier nu este utilizabilă și a fost omisă; proiectul în sine a fost deschis complet.* Planificarea, profilul de calcul și toate datele proiectului sunt complete. Lipsesc: datele așa cum le-a stocat Primavera și proveniența sursei pentru AI și extensii. Deschideți din nou fișierul `.xer` original pentru a recupera arhiva.

**Un export în CSV, MS Project XML sau P6 XML pierde date.** Aplicația avertizează: *La exportul în CSV se pierd informațiile sursă din XER.* IFC nu pierde nimic.

**Un fișier pe care aplicația nu îl poate citi.** Primiți un mesaj de eroare, cu motivul. Câteva exemple:

- *Acesta nu este un fișier XER valid sau acceptat.*
- *Un tabel XER nu are coloanele obligatorii.*
- *Proiectul P6 din acest fișier XER nu conține activități.*

Atunci nu se deschide nimic. Verificați fișierul în P6 sau cereți expeditorului un nou export.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): de ce un `.xer` este doar citit și ce pierde un export.
- [Date salvate](docs://uitleg-datums-zoals-opgeslagen): vizualizarea datelor proprii Primavera.
- [Deschiderea unui fișier MS Project (.mpp)](docs://howto-mpp-openen): același lucru pentru MS Project.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): dacă fișierul conține date în ore.
- [Formate de import și export](docs://ref-import-exportformaten): pe format, ce se transferă și ce nu.
- [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen): de ce un fișier P6 se deschide cu propriul profil de calcul.
