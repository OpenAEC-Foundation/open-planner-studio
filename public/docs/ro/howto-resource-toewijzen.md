# Atribuirea resurselor cu o curbă

Doel: puneți o resursă pe o activitate, cu unități de atribuire pe zi și cu o curbă care stabilește cum se repartizează aceste unități de atribuire pe zilele activității.

## Când aveți nevoie de aceasta

Imediat ce vreți să vedeți cine lucrează unde și când: zidarul de pe stratul exterior al zidului cu cavitate, macaraua pentru plăcile alveolare de planșeu. Fără atribuire nu există încărcare și deci nu există nici histogramă, nici supraalocare.

Doi termeni. **Unitățile de atribuire** (în aplicație *Unit./zi*) arată cât din resursă lucrează la activitate pe zi lucrătoare: 1 înseamnă un zidar, 2 înseamnă doi zidari, 0,5 înseamnă o jumătate de zi. **Curba** stabilește cum se repartizează totalul, adică unitățile de atribuire înmulțite cu durata, pe zilele lucrătoare ale activității. Lucrul este rar egal: la un perete, începutul este liniștit, mijlocul este aglomerat, iar sfârșitul este din nou liniștit.

Stratul exterior al zidului cu cavitate durează 6 zile lucrătoare. Cu un zidar și curba *Uniform*, sunt 1 unitate de atribuire pe fiecare dintre cele 6 zile, adică 6 în total. Cu curba *În formă de clopot*, totalul rămâne 6 unități de atribuire, dar distribuția devine 0, 1, 2, 2, 1 și 0.

## Pași

Puteți atribui o resursă în două moduri. Resursa trebuie să existe deja (vezi [Gestionarea resurselor](docs://howto-resources-beheren)).

### Prin panglică

1. Selectați o activitate din tabelul de activități. Trebuie să fie o activitate obișnuită, nu un jalon și nu o fază.
2. Alegeți *Resurse › Atribuire › Atribuire ▾*.
3. În fereastră, completați *Unit./zi* (implicit 1) și alegeți *Curbă* (implicită *Uniform*). Acestea se aplică resursei pe care o alegeți acum.
4. Faceți clic pe resursă. Fereastra se închide, iar atribuirea apare.

Pentru o a doua resursă, deschideți din nou fereastra. Resursele care sunt deja pe activitate nu mai apar în listă.

### Prin panoul de proprietăți

1. Selectați activitatea. Panoul *Proprietăți* se află în dreapta; dacă nu îl vedeți, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. În secțiunea *Atribuiri*, chiar jos, alegeți resursa de la *Atribuire resursă*. Atribuirea pornește cu 1 unitate de atribuire și cu curba *Uniform*.
3. Pentru fiecare atribuire, modificați *Unit./zi* și alegeți altă *Curbă*.

Așa modificați și o atribuire existentă. Cu pictograma coș (*Ștergere*) de lângă nume scoateți atribuirea de pe activitate. Resursa în sine rămâne. Cu *Mutare la…* mutați atribuirea pe altă activitate.

### Curbele

- *Uniform*: aceeași în fiecare zi. Aceasta este valoarea implicită și se potrivește lucrului la fel de intens în fiecare zi.
- *Încărcat la început*: începutul este mai intens decât sfârșitul. Se potrivește lucrului care începe cu un efort mare, cum este trasarea.
- *Încărcat la sfârșit*: sfârșitul este mai intens decât începutul. Se potrivește lucrului care devine tot mai intens spre finalizare.
- *În formă de clopot*: un vârf la mijloc, cu un început și un sfârșit liniștite. Se potrivește unui perete care începe liniștit, este în plin ritm la mijloc și scade treptat.
- *Vârf timpuriu*: un vârf înainte de mijloc. Se potrivește lucrului care ajunge rapid la ritmul normal.
- *Vârf târziu*: un vârf după mijloc. Se potrivește lucrului al cărui moment intens vine abia târziu.
- *Vârf dublu*: două vârfuri. Se potrivește lucrului cu două momente intense.
- *Țestoasă*: un început și un sfârșit liniștite, cu un vârf larg la mijloc. Se potrivește lucrului lung care crește și scade treptat.

Curba schimbă doar distribuția. Durata, datele și totalul rămân aceleași. Nu trebuie să recalculați după aceea. Histograma se ajustează imediat. Alegeți *Resurse › Histogramă › Histogramă* ca s-o vedeți. Dacă selectați o activitate, histograma arată doar încărcarea acelei activități.

## Probleme posibile și ce face aplicația atunci

**O curbă poate împinge vârful peste unitățile dumneavoastră.** Dacă unitățile sunt un număr întreg, aplicația rotunjește valoarea pe zi la unități întregi, iar totalul rămâne același. Un zidar, cu 1 unitate de atribuire pe stratul exterior al zidului cu cavitate și curba *În formă de clopot*, dă 0, 1, 2, 2, 1, 0. În cele două zile din mijloc sunt 2 unități, față de *Capacitate maximă* de 1. Histograma colorează acele zile cu roșu, iar resursa este în supraalocare. Alegeți altă curbă sau distribuiți singur orele (vezi [Ajustarea distribuției orelor](docs://howto-urenverdeling-aanpassen)). Pentru unități precum 0,5, aplicația rotunjește la sutimi. La o activitate scurtă cu unități întregi, forma devine astfel grosieră: pe 10 zile, *Țestoasă* cu 1 unitate dă distribuția 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, exact ca *Vârf timpuriu*.

**Nu jalon și nu fază.** Butonul *Atribuire* este atunci dezactivat, iar *Proprietăți* afișează *Atribuirile nu sunt posibile pe jaloane.* sau *Atribuirile nu sunt posibile pe activități rezumat.*

**O resursă, o singură dată pe activitate.** Dacă resursa este deja pe activitate, nu mai apare în listă. Dacă toate resursele sunt deja pe activitate, aplicația afișează *Toate resursele sunt deja atribuite.* Dacă nu există încă nicio resursă, afișează *Creați mai întâi resurse (fila Resurse).*

**Unitățile de atribuire trebuie să fie mai mari decât 0.** Aplicația nu acceptă o valoare de 0 sau mai mică.

**Material.** Pentru o resursă de tip material, unitățile sunt cantitatea pe zi, în unitatea de măsură a resursei, de exemplu m³. Materialul nu intră în durata activității.

**O regulă de lucru poate ajusta durata.** Dacă activitatea are *Muncă fixă* sau *Unități fixe*, o a doua resursă modifică durata activității. Planificarea nu mai este atunci actualizată; apăsați **Calculare** (F5). Vezi [Reguli de lucru: durată, unități și lucru](docs://uitleg-werkregels).

**O distribuție proprie.** Dacă atribuirea are deja o distribuție proprie a orelor, curba este dezactivată și afișează *Contur*. Eliberați mai întâi această distribuție prin *Distribuție ore…*.

**Anularea acțiunii.** Puteți anula crearea, modificarea sau ștergerea unei atribuiri cu *Anulare* (Ctrl+Z).

## Vezi și

- [Ajustarea distribuției orelor](docs://howto-urenverdeling-aanpassen): stabilirea manuală a orelor pe zi.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți când o resursă are prea mult de lucru într-o zi.
- [Reguli de lucru: durată, unități și lucru](docs://uitleg-werkregels): ce se întâmplă cu durata când modificați unitățile de atribuire.
- [Panou resurse](docs://ref-resourcepaneel): toate câmpurile și butoanele panoului de resurse.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): toate cele cinci tipuri de resurse, toate cele șase curbe și o macara turn cu o treaptă de capacitate de la 30 august 2027.
