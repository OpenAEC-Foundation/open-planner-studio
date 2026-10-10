# Coduri și câmpuri particularizate

Scop: atașați propriile clasificări (coduri de activitate, de exemplu *Locație*) și propriile câmpuri (de exemplu *Antreprenor*) activităților dumneavoastră.

## Când aveți nevoie de aceasta

Pe lângă datele fixe ale unei activități (nume, durată, dependențe, …) puteți adăuga date proprii. Dacă doriți să clasificați activitățile după aripa de nord și aripa de sud, după disciplină sau să urmăriți ce antreprenor execută o activitate, înregistrați dumneavoastră aceste date. Există două moduri, iar diferența contează.

Un **cod de activitate** este o clasificare cu o listă fixă de opțiuni. Creați un **tip de cod** (de exemplu *Locație*) cu **valori** (*N* pentru aripa de nord, *Z* pentru aripa de sud). O activitate primește cel mult o valoare pentru fiecare tip de cod.

Un **câmp particularizat** (sub *Câmpuri particularizate* din fereastră) este un câmp liber de introducere, cu un tip: *Text*, *Număr*, *Număr întreg*, *Cost*, *Dată* sau *Da/nu*. Câmpul poate avea o valoare diferită la fiecare activitate.

## Pași

### Definirea codurilor și a câmpurilor

1. Alegeți *Planificare › Organizare › Coduri și câmpuri*.
2. **Crearea unui tip de cod.** Sub *Tip de cod nou (de ex. Locație)* tastați numele și apăsați Enter sau faceți clic pe *Adăugare tip de cod*.
3. **Adăugarea valorilor.** Sub tipul de cod, faceți clic pe *Adăugare valoare*. Aplicația pune acolo un cod provizoriu, de exemplu *V1*. Modificați-l în caseta *Cod* (scurt, cum l-ați tasta: *N*), completați, dacă este necesar, o *Descriere* (*Aripa de nord*) și alegeți o *Culoare*. Modificarea se înregistrează imediat ce părăsiți caseta sau apăsați Enter.
4. **Crearea unui câmp particularizat.** Sub *Câmp nou (de ex. Antreprenor)* tastați numele, alegeți tipul și faceți clic pe *Adăugare câmp* (sau apăsați Enter).

Fereastra nu are un buton OK: fiecare modificare se aplică imediat. După creare nu puteți schimba tipul unui câmp, doar numele. Dacă doriți alt tip, creați un câmp nou.

### Completarea unui cod sau a unui câmp la o activitate

Aveți două locuri.

- **În panoul *Proprietăți*** (sau în fereastra pe care o deschideți cu F2). Jos se află blocul *Coduri și câmpuri*: o listă de selectare pentru fiecare tip de cod și un câmp de introducere pentru fiecare câmp. Blocul apare abia când există cel puțin un tip de cod sau un câmp.
- **Ca o coloană în tabelul de activități.** Faceți clic pe **+** din dreapta antetului tabelului (*Adăugare coloană*) și, sub *Particularizat*, alegeți tipul de cod sau câmpul. În celula unui tip de cod tastați codul, de exemplu `N`, sau alegeți din listă. Un cod care nu există afișează mesajul *Alegeți o valoare din acest cod de activitate.*

### Utilizarea lor

Puteți folosi un tip de cod sau un câmp particularizat pentru a filtra, grupa și sorta. Configurați acest lucru cu un aspect: *Vizualizare › Aspect › Creare aspect*. În fereastră bifați părțile pe care doriți să le salvați. Dacă alegeți *Salvare*, obțineți un buton în *Vizualizare › Aspect*, pe care îl puteți apăsa din nou mai târziu. Cu *Aplicare fără salvare* aplicați aspectul doar pe ecran, acum. La grupare, activitățile fără valoare ajung sub *(niciunul)*.

Pentru culoarea barelor alegeți *Vizualizare › Referințe și progres › Culori bare*, apoi *După categorie* și tipul de cod. Fiecare bară primește culoarea din câmpul *Culoare* al valorii sale.

## Capcane și ce face aplicația

**Ștergerea elimină valorile de la activități.** Dacă ștergeți un tip de cod, o valoare sau un câmp cu pictograma coșului de gunoi, aplicația nu cere confirmare, iar valorile de pe toate activitățile dispar odată cu el. O grupare sau o sortare după acel tip de cod sau câmp își pierde și ea efectul. *Anulare* (Ctrl+Z) readuce tipul de cod, valoarea sau câmpul și valorile completate, dar nu gruparea sau sortarea: le configurați din nou.

**Două valori cu același cod.** *Adăugare valoare* continuă numerotarea după numărul de valori care există deja. Dacă ștergeți una și adăugați alta, un cod poate apărea deci de două ori. Dacă tastați acest cod într-o celulă de coloană, aplicația refuză cu mesajul *Această valoare de cod de activitate apare de mai multe ori. Alegeți-o din listă.* Dați fiecărei valori un cod propriu.

**Șabloanele nu preiau codurile și câmpurile.** Consultați [Salvarea și inserarea șabloanelor WBS](docs://howto-wbs-sjablonen). Dacă lipiți activități într-un alt document, aplicația șterge codurile și câmpurile care nu există acolo și vă anunță.

**Un câmp de tip dată nu urmează proiectul.** Dacă mutați întregul proiect, câmpurile particularizate completate de tipul *Dată* rămân la data lor. Aplicația avertizează despre acest lucru în previzualizare.

## Vezi și

- [Ajustarea structurii](docs://howto-structuur-aanpassen): arborele WBS, cealaltă modalitate de organizare a activităților.
- [Mutarea unui proiect](docs://howto-project-verplaatsen): ce se întâmplă cu datele când mutați proiectul.
- [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken): gruparea și filtrarea după un cod sau un câmp particularizat.
- [Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen): afișarea unui cod sau a unui câmp particularizat ca și coloană.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): codurile de activitate *House* și *Discipline*, câmpul particularizat *Cost estimate* și notițele (deschise și finalizate).
