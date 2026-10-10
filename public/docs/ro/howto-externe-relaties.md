# Legături între proiecte cu un alt proiect

Obiectiv: legați o activitate din acest proiect de o activitate dintr-un alt fișier de proiect, astfel încât planificarea dumneavoastră să țină cont de lucrările planificate în altă parte.

## Când aveți nevoie de aceasta

Extinderea dumneavoastră poate începe doar după ce amplasamentul a fost pregătit pentru construcție, iar această lucrare figurează în proiectul antreprenorului. Sau montatorul poate începe doar după ce structura dumneavoastră este gata, iar el planifică în fișierul propriu. O dependență obișnuită funcționează doar între activități din același proiect. O **legătură între proiecte** leagă o activitate de o activitate dintr-un alt fișier.

O legătură între proiecte nu se calculează în timp real împreună cu celălalt proiect. Aplicația stochează o **dată ancoră** fixă: data activității externe în momentul în care o legați. Calculul folosește această dată ca limită. Dacă celălalt proiect se modifică, nimic nu se mută în proiectul dumneavoastră până nu reîmprospătați data ancoră.

## Pași

1. Selectați exact o activitate din acest proiect: activitatea care depinde de activitatea externă sau de care depinde activitatea externă.
2. Alegeți *Acasă › Activități › Legare ▾ › Adăugare legătură între proiecte…*. Același meniu se află la *Planificare › Dependențe* și la *Tabel › Activități*. Elementul este disponibil doar dacă este selectată exact o activitate.
3. În fereastra *Legătură între proiecte* alegeți una din cele două variante. Cu butonul *Fișier sursă* alegeți fișierul de proiect sub *Alegeți un fișier recent* și apoi *Activitate sursă*. Aplicația citește fișierul doar în citire, nu îl deschide ca document și preia singură data ancoră. Această variantă funcționează doar în aplicația desktop și doar pentru un fișier din lista fișierelor recente. Altfel butonul *Fișier sursă* este dezactivat. Cu varianta *Manual (rezervă)* completați *ID proiect* și *ID activitate* ale activității externe, opțional *Numele activității (opțional)*, și *Dată ancoră*. În versiunea din browser aceasta este singura variantă.
4. Sub *Direcție* alegeți dacă activitatea externă este predecesorul sau succesorul dumneavoastră: *Predecesor (extern → această activitate)* sau *Succesor (această activitate → extern)*.
5. Alegeți *Tip de dependență* (FS, SS, FF sau SF) și completați *Decalaj (zile lucrătoare)* dacă este nevoie, de exemplu `0d` sau `2d`.
6. Faceți clic pe butonul *Adăugare legătură* și apăsați **Calculare** (F5).

Ce dată introduceți ca ancoră la o legătură manuală depinde de direcție și de tip:

- La un **predecesor** extern contează prima literă a tipului: F înseamnă data de sfârșit a activității externe, S data de început. Cu FS și FF introduceți deci data de sfârșit, cu SS și SF data de început.
- La un **succesor** extern contează a doua literă: S este data de început a activității externe, F data de sfârșit. Cu FS și SS introduceți deci data de început, cu FF și SF data de sfârșit.

Dacă planificați pe ore (planificarea pe ore este activată și o activitate are un calendar cu timp de lucru), câmpul *Dată ancoră* cere și o oră.

Exemplu: sfârșitul proiectului de șantier este vineri, 18 iunie 2027. Legați *Groundwork* cu un predecesor extern de tip FS, cu dată ancoră 18 iunie 2027. După **Calculare**, activitatea *Groundwork* începe luni, 21 iunie, prima zi lucrătoare după ancoră. Un succesor extern funcționează invers: limitează cât de târziu poate să se încheie activitatea dumneavoastră.

## Ce vedeți și cum le gestionați

- Legăturile între proiecte apar ca text în coloanele *Predecesori* și *Succesori* din tabelul de activități (adăugați-le cu **+** din antetul tabelului, sub *Dependențe*), cu numele proiectului, al activității și cu tipul. Un mic triunghi cu eticheta *Sursa lipsește* arată că sursa nu a fost citită. Țineți mouse-ul peste legătură ca să vedeți proiectul (linia *ID proiect* arată numele proiectului de îndată ce este cunoscut), ID-ul activității, data ancoră și starea sursei.
- În diagrama Gantt există o bară fantomă, gri, la activitate. La un predecesor bara se termină la data ancoră, la un succesor începe la data ancoră. O margine întreruptă cu eticheta roșie *învechit* arată că sursa nu a fost citită. La o legătură manuală este mereu așa.
- Faceți clic dreapta pe o legătură din coloană pentru *Editare legătură între proiecte…* și *Ștergere dependență*. Dacă legătura are un fișier sursă, este disponibilă și *Reîmprospătare sursă*.
- Alegeți *Legare ▾ › Reîmprospătare legături între proiecte* ca să citiți din nou fișierele sursă și să actualizați ancorele. Aceasta funcționează doar în aplicația desktop. Dacă aveți doar legături manuale, aplicația afișează *Nu există surse externe care pot fi reîmprospătate (lipsește calea fișierului).* După reîmprospătare apăsați **Calculare**.
- Dacă modificați tipul sau direcția, astfel încât ancora are nevoie de cealaltă parte a activității externe (începutul în loc de sfârșit, sau invers), aplicația cere o nouă ancoră la o legătură manuală: *Alegeți o nouă dată ancoră: tipul de dependență folosește acum cealaltă parte din activitatea sursă.* La o legătură cu fișier sursă, aplicația citește singură din nou ancora.

## Capcane și ce face aplicația

**Modificările din celălalt proiect nu se transmit automat.** Dacă activitatea externă își schimbă data, planificarea dumneavoastră continuă să se calculeze pe vechea ancoră până o reîmprospătați sau până schimbați ancora. Pe varianta manuală schimbați singur data ancoră: faceți clic dreapta pe legătură și alegeți *Editare legătură între proiecte…*.

**Un predecesor extern este o limită inferioară.** Dacă activitatea dumneavoastră începe mai târziu decât cere ancora din cauza propriilor predecesori, acea dependență are prioritate. Ancora doar împinge.

**Un succesor extern este o limită superioară.** Dacă ancora este prea strânsă, vedeți asta ca marjă negativă la activitatea dumneavoastră și la activitățile dinaintea ei. Nu apare un avertisment separat, așa că urmăriți coloana *Marjă totală*.

**Doar un decalaj fix.** Pentru o legătură între proiecte nu puteți indica un decalaj în zile calendaristice sau în procente. Aplicația afișează *Legăturile între proiecte acceptă doar un decalaj fix în zile lucrătoare sau în timp de lucru*. Zilele lucrătoare se socotesc în calendarul propriei activități. Un decalaj în ore se ia în calcul doar pentru o activitate planificată pe ore. Pentru o activitate pe zile, calculul îl ignoră. Atunci folosiți zile lucrătoare.

**ID-ul proiectului unui alt fișier.** ID-ul proiectului nu se află într-un câmp sau o coloană, ci este salvat ca `InternalProjectId` în fișierul IFC al acelui proiect: deschideți proiectul, mergeți la fila *IFC* și alegeți *Generare IFC*. Calculul folosește doar data ancoră; ID-ul nu este doar o etichetă. La reîmprospătare, aplicația recunoaște întâi un fișier sursă după ID-ul proiectului (apoi după calea fișierului). Dacă introduceți la o legătură manuală același ID ca al unui fișier sursă, legătura se actualizează și ea când acel fișier este reîmprospătat. Găsiți *ID activitate* al unei activități din celălalt proiect în tabelul acelui proiect, în coloana *ID activitate* de sub *Tehnic*.

## Vedeți și

- [Dependențe și decalaj](docs://uitleg-relaties): cum calculează aplicația o dependență și un decalaj.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): dependențe între activități din același proiect.
- [Restricții și termene limită](docs://uitleg-constraints): limite de dată pentru o activitate, fără alt proiect.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): conține o legătură între proiecte la *Car park paving* (un predecesor extern).
