# Refacerea în urma unei căderi

Scop: recuperați modificările după ce aplicația sau browserul s-a oprit neașteptat și nu ați salvat.

## Când aveți nevoie de aceasta

Laptopul s-a defectat, aplicația a înghețat sau fila din browser s-a blocat, iar dumneavoastră nu ați salvat ultimele modificări. De îndată ce faceți o modificare oriunde, aplicația păstrează în fundal copii de restaurare ale tuturor proiectelor deschise, cel mult o dată la zece secunde. Această copie este separată de fișierul proiectului dumneavoastră. Diferența față de salvare și de Salvare automată o aflați în [Fișiere și formate](docs://uitleg-bestanden).

## Pași

1. Porniți din nou aplicația. În browser reîncărcați aceeași filă: copia de restaurare aparține doar acelei file.
2. Dacă aplicația a găsit copii, apare fereastra *Restaurare lucru nesalvat*. *Open Planner Studio nu s-a închis normal. Următoarele documente aveau modificări nesalvate care pot fi restaurate:* Pentru fiecare proiect se afișează numele, calea fișierului dacă proiectul are un fișier (în browser doar numele fișierului), numărul de activități și ora copiei, de exemplu *21 de activități* și *Salvat: 29 sept. 2026, 9:41 AM*. Fereastra poate afișa și proiecte pe care nu le-ați modificat.
3. Alegeți *Restaurare*. Aplicația deschide toate proiectele din listă, fiecare într-o filă, cu starea ultimei copii. Tasta Enter face același lucru.
4. Verificați proiectele și salvați-le imediat cu Ctrl+S.

Dacă nu doriți să restaurați, aveți două variante. *Fără restaurare* șterge copiile, iar acest lucru nu se poate anula. Dacă închideți fereastra cu Escape, cu crucea sau dacă faceți clic lângă ea, copiile rămân, iar aplicația întreabă din nou la următoarea pornire.

Semnul de întrebare din dreapta sus a ferestrei deschide acest articol, fără să faceți o alegere. Cât timp citiți în Ajutor, fereastra așteaptă. Când reveniți, fereastra este din nou acolo și puteți totuși restaura.

## Capcane și ce face aplicația atunci

**Obțineți starea ultimei copii.** Ce ați făcut în ultimele secunde înainte de cădere poate lipsi. Un proiect care avea modificări este marcat din nou ca *Nesalvat*. Istoricul *Anulare* este gol: nu puteți anula pașii de dinaintea căderii. Zoomul, poziția de derulare și selecția se reconstruiesc.

**Pe desktop un proiect restaurat își păstrează fișierul, în browser nu.** Pe desktop *Salvare* scrie în fișierul original, cu starea restaurată. În browser, un proiect restaurat nu mai este legat de fișierul său: *Salvare* întreabă unde trebuie salvat fișierul. Și comutatorul *Salvare automată* este atunci gri, până salvați proiectul o dată.

**Un proiect aflat în vizualizarea *Datele așa cum au fost înregistrate* rămâne în acea vizualizare.** Vezi [Datele așa cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen).

**Pe desktop fereastra nu apare după fiecare pornire.** Copiile de restaurare se află în folderul de date al aplicației, ca fișiere IFC al căror nume începe cu *recovery*. Dacă închideți aplicația în mod normal, aceasta își șterge singură copiile. Fereastra apare deci după o încheiere neașteptată, după o repornire pentru o actualizare a aplicației sau dacă ați amânat restaurarea la o pornire anterioară.

**În browser copia se păstrează pe fiecare filă.** Copia se află în stocarea browserului. O filă nouă sau o fereastră nouă nu oferă copiile altei file. Copiile filelor care nu mai există sunt șterse după șapte zile, de îndată ce aplicația scrie din nou copii.

**În browser fereastra apare și după o reîncărcare obișnuită.** Acest lucru se întâmplă chiar dacă ați salvat totul. Dacă ați salvat chiar înainte de reîncărcare și nu ați mai modificat nimic după aceea, puteți alege în siguranță *Fără restaurare*: fișierul dumneavoastră este la zi.

**Fereastra nu apare.** Atunci aplicația nu a găsit nicio copie. Acest lucru se întâmplă dacă nu ați modificat încă nimic, dacă folosiți o filă nouă în browser, dacă ați renunțat mai devreme la restaurare cu *Fără restaurare* sau dacă s-a produs căderea înainte ca aplicația să păstreze prima copie. Aceasta poate dura până la aproximativ zece secunde după prima modificare.

**O copie este deteriorată.** Aplicația afișează *Fișierul restaurat nu a putut fi citit*, cu motivul, și vă oferă celelalte proiecte. Dacă alegeți *Restaurare*, aplicația șterge după aceea toate copiile, inclusiv pe cea care nu poate fi citită. Dacă nicio copie nu poate fi citită, fereastra nu apare, iar copiile rămân.

**Restaurarea eșuează.** Aplicația afișează *Restaurarea a eșuat*, cu motivul. Copiile rămân, iar întrebarea revine la următoarea pornire.

**Unele proiecte nu pot fi încărcate.** Aplicația afișează: *2 fișiere de restaurare nu au putut fi încărcate și au fost omise.* Pentru un singur fișier aplicația afișează *1 fișier de restaurare nu a putut fi încărcat și a fost omis.* Celelalte proiecte se restaurează. Deoarece ceva a fost omis, toate copiile rămân, iar fereastra revine la următoarea pornire cu aceeași listă. Atunci alegeți *Fără restaurare*, dacă ați recuperat deja tot ce s-a putut.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): salvarea, Salvare automată și refacerea în urma unei căderi, una lângă alta.
- [Activarea salvării automate](docs://howto-automatisch-opslaan): lăsarea aplicației să actualizeze singură fișierul dumneavoastră.
- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): salvarea după restaurare.
- [Datele așa cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen): ce se întâmplă cu un proiect în acea vizualizare.
