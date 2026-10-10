# Stabilirea unei restricții sau a unui termen limită

Obiectiv: înregistrați un acord privind data pentru o activitate. Planificarea ține cont de el sau arată că nu îl respectați.

## Când aveți nevoie de acest lucru

Cărămizile sunt livrate abia pe 21 iunie, deci zidăria nu poate începe mai devreme: o **restricție** *Nu începe înainte de*. Acoperișul trebuie închis înainte de sărbătoarea constructorilor. Doriți să fiți avertizat dacă acest lucru nu reușește: un **termen limită**. Turnarea betonului este fixată pentru o anumită zi, deoarece fabrica de beton a promis-o: *Trebuie să înceapă la*. Ce tip se potrivește când și ce face aplicația cu el este explicat în [Restricții și termene limită](docs://uitleg-constraints).

## Pași

Setați o restricție și un termen limită în panoul *Proprietăți*.

1. Selectați activitatea. Dacă nu vedeți panoul *Proprietăți*, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. La *Restricție* alegeți tipul, de exemplu *Nu începe înainte de (SNET)*.
3. Cu fiecare tip, în afară de *Cât mai devreme posibil (ASAP)* și *Cât mai târziu posibil (ALAP)*, apare câmpul *Dată restricție*. Introduceți data în cele trei casete pentru zi, lună și an, de exemplu 21, 06 și 2027, apoi apăsați Enter. Aplicația trece singură la următoarea casetă de îndată ce o casetă este plină. După ce alegeți tipul, există deja o dată: cea a restricției anterioare sau, altfel, începutul planificat inițial al activității. Ea poate diferi de începutul afișat în panou, așa că introduceți întotdeauna dumneavoastră data dorită.
4. Dacă doriți să fixați activitatea la această dată, chiar înainte de predecesorii ei, alegeți *Trebuie să înceapă la (MSO)* sau *Trebuie să se termine la (MFO)* și bifați *Obligatoriu (logica de fixare)*. Aceasta este o fixare strictă. Folosiți-o doar pentru o dată care este cu adevărat fixată.
5. Dacă doriți și o a doua limită, de exemplu o activitate care nu poate începe înainte de 14 iunie și trebuie să se termine până pe 17 iunie, alegeți un tip la *Restricție secundară* și completați câmpul *Data restricției secundare*. Acest câmp apare la fiecare restricție care are o dată, cu excepția cazului fixării stricte. Cu MSO și MFO nu este permisă o restricție secundară: aplicația o marchează atunci cu roșu.
6. Pentru un termen limită completați câmpul *Termen limită*, în același mod ca data restricției. Un termen limită este separat de restricție: puteți seta ambele pe aceeași activitate.
7. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Până atunci bara de stare afișează *Învechit — recalculați (F5)*.

Câmpurile există și în fereastra *Editare activitate*, pe care o deschideți făcând clic dreapta pe activitate și alegând *Editare...*. Confirmați cu *Salvare*.

În tabel lucrați cu coloane. Faceți clic pe **+** din antetul tabelului și, sub *Restricții*, alegeți coloanele *Tip de restricție*, *Dată restricție* și *Termen limită* (există și *Restricție strictă*, *Tip de restricție secundară* și *Dată restricție secundară*). Faceți dublu clic pe o celulă pentru a o edita: alegeți tipul dintr-o listă și introduceți o dată cu cratime, de exemplu 21-06-2027. Coloana *Restricție strictă* poate fi modificată doar pentru MSO și MFO.

Dacă activitatea are un predecesor, există o scurtătură pentru *Nu începe înainte de*: introduceți pur și simplu o nouă dată de început în câmpul *Început* (în panoul *Proprietăți*, în fereastra *Editare activitate* sau în tabel), ori mutați bara în Gantt. Aplicația transformă atunci singură această dată într-o restricție *Nu începe înainte de (SNET)* și vă anunță.

## Verificarea rezultatului

- În diagrama Gantt, deasupra barei apare un mic romb: pe latura de început pentru o restricție de început și pe latura de sfârșit pentru o restricție de sfârșit. Rombul este albastru pentru SNET și FNET, violet pentru SNLT, FNLT, MSO și MFO, roșu dacă restricția este încălcată. O fixare strictă are un simbol de fixare. Un termen limită este o săgeată în jos la data termenului limită: verde cât timp activitatea se termină la timp, roșu dacă este întârziată.
- O restricție încălcată sau un termen limită nerespectat apare în panoul *Avertismente* (*Planificare › Planificare › Avertismente*) și în bara de stare. *Marjă totală* a activității și a activităților dinaintea ei devine atunci negativă.
- La o limită superioară (*Nu începe după*, *Nu se termină mai târziu de*) sau la un termen limită, lipsa unui avertisment înseamnă că planificarea respectă data.

## Eliminarea unei restricții sau a unui termen limită

La *Restricție* alegeți din nou *Cât mai devreme posibil (ASAP)*. Astfel se elimină și restricția secundară. Eliminați un termen limită golind cele trei casete și apăsând Enter. Apoi apăsați **Calculare**.

## Capcane și ce face aplicația

**O restricție la o fază.** O restricție sau un termen limită pe o fază (activitate rezumat) nu are efect. Setați-o direct pe activitate.

**O activitate care a început deja.** Dacă activitatea are un început efectiv sau un progres, își păstrează începutul efectiv. O restricție *Nu începe înainte de* cu o dată mai târzie nu o mută.

**Introducerea unei date de început lângă altă restricție.** Dacă activitatea are un predecesor și are deja o altă restricție, de exemplu *Cât mai târziu posibil (ALAP)*, aplicația nu aplică o dată de început introdusă. Un mesaj indică restricția; modificați-o dacă doriți să mutați începutul.

**O dată în weekend.** O dată care cade sâmbătă, duminică sau într-o zi liberă este tratată ca zi lucrătoare: o limită inferioară (*Nu începe înainte de*, *Nu se termină mai devreme de*) ca următoarea zi lucrătoare, o limită superioară (*Nu începe după*, *Nu se termină mai târziu de*) ca cea anterioară.

**O restricție secundară care nu este permisă.** Aplicația marchează cu roșu o combinație nevalidă și indică motivul, de exemplu *Restricția primară și cea secundară nu pot limita aceeași parte.* O restricție secundară nu este permisă cu ASAP, ALAP, MSO, MFO și o fixare strictă.

**O fixare strictă.** Prima dată când o activați, aplicația avertizează că o fixare strictă înlocuiește dependențele. Activitatea se află atunci la dată, chiar înainte de predecesorii ei; acești predecesori primesc marjă negativă.

**Nimic nu s-a schimbat după setare.** Restricțiile funcționează doar după **Calculare**. Dacă o limită superioară (*Nu începe după*, *Nu se termină mai târziu de*) nu are efect asupra barelor, acest lucru este normal: o limită superioară nu mută nimic, ci face marja negativă dacă data nu este respectată.

## Vezi și

- [Restricții și termene limită](docs://uitleg-constraints): ce face fiecare tip și explicația pentru fixarea strictă, marja negativă și termenul limită.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce face marja negativă cu drumul critic.
- [Dependențe și decalaj](docs://uitleg-relaties): dependențele alături de care se află o restricție.
- [Notificări și avertismente](docs://ref-meldingen): avertismentele pentru o restricție încălcată sau un termen limită nerespectat.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): o restricție legată de autorizație *Nu începe înainte de* pe *Demolish existing extension* (14 mai 2027) și un termen limită care este respectat cu timp în rezervă.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): un termen limită intenționat strâns pentru *Contractual project handover* (15 iulie 2027): după calculare, sfârșitul este pe 17 august, iar multe activități au marjă negativă.
