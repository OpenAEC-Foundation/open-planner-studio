# Mutarea proiectului

Scop: mutați întreaga planificare la o nouă dată de început și vedeți dinainte ce efect are asta asupra sfârșitului.

## Când aveți nevoie de asta

Începutul lucrărilor se mută: autorizația vine mai târziu sau refolosiți planificarea unei case anterioare pentru următoarea. Mutarea fiecărei activități una câte una cere mult efort. Cu **Mutare proiect** introduceți o singură nouă dată de început, iar aplicația mută totul împreună.

Sfârșitul proiectului nu se mută întotdeauna cu același număr de zile ca începutul. **Calendarul** nu se mută odată cu proiectul: sărbătorile, concediul colectiv din construcții și oprirea de iarnă rămân pe date fixe. Un exemplu: cu *Acasă › Fișier › Nou* creați un proiect cu *Data de început* 29-09-2026, cu *Țară* pe *Țările de Jos* și cu *Concediu colectiv din construcții* pe *Fără*. Adăugați în el o planificare de 30 de zile lucrătoare, care se termină la 9 noiembrie 2026. Dacă o mutați la 14 decembrie 2026, adică cu 76 de zile calendaristice mai târziu, ea se termină la 26 ianuarie 2027. Asta înseamnă cu 78 de zile mai târziu, pentru că 25 decembrie și 1 ianuarie sunt acum zile libere în planificarea dumneavoastră. Durata rămâne de 30 de zile lucrătoare. Previzualizarea din fereastră arată acest lucru înainte să modificați ceva.

## Pași

1. Alegeți *Planificare › Planificare › Mutare proiect…*. Butonul este dezactivat cât timp proiectul nu are o dată de început.
2. Sub *Început proiect curent* vedeți unde începe acum proiectul, iar sub *Început proiect nou* alegeți noua dată.
3. Dacă proiectul are referințe, apare caseta *Deplasați și referințele*. Lăsați-o debifată dacă doriți să vedeți deplasarea ca varianță (consultați capcanele).
4. Faceți clic pe *Calculare previzualizare*. Aplicația calculează planificarea deplasată integral, fără să modifice nimic în proiectul dumneavoastră.
5. Verificați previzualizarea (vedeți mai jos). Dacă este corectă, faceți clic pe *Mutare*.

În previzualizare vedeți:

- deplasarea în zile calendaristice (*Deplasare: 76 zile calendaristice înainte*);
- *Început proiect* și *Sfârșit proiect*, de la valoarea dinainte la cea de după;
- un avertisment roșu dacă un calendar interferează, sau mesajul că durata proiectului rămâne aceeași;
- numărul de activități mutate și ce mai este mutat odată cu ele;
- avertismentele pe care trebuie să le citiți (consultați capcanele).

Aplicația calculează noua planificare imediat, deci nu trebuie să folosiți **calcula** (F5), și încadrează vizualizarea pe întregul proiect. Totul este un singur pas pentru *Anulare* (Ctrl+Z).

Butonul *Mutare* funcționează numai după o previzualizare fără eroare și numai dacă noua dată este diferită de cea actuală. Dacă modificați data sau caseta, previzualizarea dispare și trebuie să calculați din nou.

### Ce se mută împreună cu proiectul și ce nu

Ce se mută: începutul și sfârșitul fiecărei activități, începutul efectiv și sfârșitul efectiv, datele restricțiilor (și ale unei fixări obligatorii stricte, vedeți [Restricții și termene limită](docs://uitleg-constraints)), termenele limită, data raportului de stare, ancorele legăturilor între proiecte și etapele de disponibilitate ale resurselor. Începutul proiectului și, dacă ați completat-o, data de sfârșit a proiectului se mută și ele.

Ce nu se mută:

- calendarele, deci sărbătorile, concediul colectiv din construcții și oprirea de iarnă;
- referințele, dacă activați *Deplasați și referințele*;
- un câmp particularizat completat, de tipul *Dată*.

## Capcane și ce face aplicația

**Sfârșitul se mută cu un alt număr de zile.** Dacă previzualizarea constată că sfârșitul se mută cu mai multe sau cu mai puține zile calendaristice decât începutul, sau că durata proiectului în zile lucrătoare se schimbă, afișează un avertisment roșu cu cifrele. Atunci puteți totuși renunța.

**Referințele rămân pe loc.** O referință există ca să măsoare varianța. Dacă mutați proiectul cu caseta debifată, vedeți deplasarea ca varianță față de referință. Dacă bifați caseta, referințele se mută odată cu planificarea. Se mută numai datele lor; data la care a fost salvată referința nu se mută.

**Un proiect în desfășurare.** Datele reale se mută odată cu proiectul. Într-un proiect în care ați introdus deja progresul, nu întotdeauna asta doriți. Aplicația avertizează: *Verificați dacă aceasta este corectă pentru un proiect în desfășurare.*

**Legături între proiecte.** Ancora din propriul proiect se mută odată cu proiectul; proiectul sursă nu se mută. Reîmprospătați legăturile după mutare cu *Acasă › Activități › Dependență ▾ › Reîmprospătare legături între proiecte*. Consultați [Legături între proiecte](docs://howto-externe-relaties).

**Sărbători care nu ajung destul de departe.** Un calendar cu sărbători generate acoperă un număr de ani. Dacă planificarea mutată depășește acest interval, aplicația calculează anul respectiv fără sărbători. Previzualizarea avertizează, de exemplu: *Sărbătorile generate ale calendarului „Bouwkalender NL” acoperă 2025–2029; planificarea deplasată continuă până în 2030. Regenerați sărbătorile.* Mutați mai întâi proiectul. Apoi deschideți *Planificare › Calendar › Calendar*: lângă sărbători scrie acum *Regenerare*. Confirmați cu *Aplicare*, iar aplicația recalculează. Intervalul noilor sărbători urmează datele proiectului, deci regenerarea înainte de mutare nu ajută.

**Data se află în trecut.** Acest lucru este permis, dar previzualizarea îl menționează: *Noua dată de început se află în trecut.*

**Modificarea începutului proiectului în Informații proiect este altceva.** Dacă modificați data de început în *Setări › Proiect › Informații proiect* și alegeți *Aplicare*, planificarea nu se mută. Se mută către noua dată numai activitățile fără predecesor sau restricție care s-ar afla altfel înaintea noului început, iar aplicația vă spune câte sunt. Dacă doriți să mutați totul, folosiți *Mutare proiect…*.

## Vezi și

- [Drum critic și marjă](docs://uitleg-kritiek-pad): cum calculează planificarea și de ce se mută sfârșitul.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): dependențele rămân pur și simplu pe loc când mutați.
- [Proiect nou și Informații proiect](docs://ref-projectinfo): ce face data de început din Informații proiect.
